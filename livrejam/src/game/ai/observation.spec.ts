import { describe, expect, it } from 'vitest';
import { FACE_SMASHING, ITEMS } from '../config';
import { createDungeonLevel } from '../level';
import type { DungeonLevel } from '../level';
import { Dodger, Item } from '../entities';
import { createObservationBuffer, writeObservation } from './observation';

const RADIUS = FACE_SMASHING.ai.observeRadius;
const GLOBAL_FEATURES = 12;
const ITEM_FEATURES = 8;
const SENSORS = ['wallLeft', 'wallRight', 'ceiling', 'ground'] as const;
const REACH = FACE_SMASHING.ai.sensorReach;
const SLOTS = (FACE_SMASHING.ai.observationSize - GLOBAL_FEATURES) / ITEM_FEATURES;
const ARENA = FACE_SMASHING.tile.columns - FACE_SMASHING.tile.wallThickness * 2;

interface ItemSpec {
    definition: number;
    centerX: number;
    y: number;
    velocityX?: number;
    velocityY?: number;
    roll?: number;
    state?: 'falling' | 'landed' | 'settled';
}

function buildDodger(level: DungeonLevel, feetX: number): Dodger {
    const dodger = new Dodger({ feetX, feetY: level.floorTop, facing: 'right' });
    dodger.applyTier();
    return dodger;
}

function buildItem(spec: ItemSpec): Item {
    const definition = ITEMS[spec.definition];
    const item = new Item({
        x: spec.centerX - definition.half.width,
        y: spec.y,
        velocityX: spec.velocityX ?? 0,
        velocityY: spec.velocityY ?? 0,
        definition,
        damageRoll: spec.roll ?? 0.5,
    });
    item.state = spec.state ?? 'falling';
    return item;
}

function observe(specs: ItemSpec[], feetX = 320): Float32Array {
    const level = createDungeonLevel();
    const dodger = buildDodger(level, feetX);
    const buffer = createObservationBuffer();

    writeObservation(buffer, {
        level,
        dodger,
        items: specs.map((spec) => buildItem(spec)),
    });

    return buffer;
}

function slot(buffer: Float32Array, index: number): number[] {
    const base = GLOBAL_FEATURES + index * ITEM_FEATURES;
    return Array.from(buffer.slice(base, base + ITEM_FEATURES));
}

interface SensorReading {
    wallLeft: number;
    wallRight: number;
    ceiling: number;
    ground: number;
}

function sensorMetres(buffer: Float32Array): SensorReading {
    const [wallLeft, wallRight, ceiling, ground] = SENSORS.map((name, index) => {
        void name;
        return Math.round(buffer[8 + index] * REACH);
    });

    return { wallLeft, wallRight, ceiling, ground };
}

function observeFrom(level: DungeonLevel, feetX: number, lift = 0): Float32Array {
    const dodger = buildDodger(level, feetX);
    if (lift > 0) {
        dodger.physics.body.position.y -= lift;
        dodger.physics.body.grounded = false;
    }

    const buffer = createObservationBuffer();
    writeObservation(buffer, { level, dodger, items: [] });
    return buffer;
}

describe('writeObservation', () => {
    it('writes one value per configured input', () => {
        expect(createObservationBuffer()).toHaveLength(FACE_SMASHING.ai.observationSize);
        expect(observe([])).toHaveLength(FACE_SMASHING.ai.observationSize);
    });

    it('reports the dodger state in the global features', () => {
        const level = createDungeonLevel();
        const dodger = buildDodger(level, level.playLeft + (ARENA * 32) / 2);
        dodger.physics.body.velocity.x = dodger.maxSpeedX / 2;
        dodger.physics.body.velocity.y = -FACE_SMASHING.dodger.maxFallSpeed / 2;
        dodger.physics.body.grounded = true;
        dodger.damage = FACE_SMASHING.damage.perLevel * 2;

        const buffer = createObservationBuffer();
        writeObservation(buffer, { level, dodger, items: [] });

        expect(buffer[0]).toBeCloseTo(0, 6);
        expect(buffer[1]).toBeCloseTo(0.5, 6);
        expect(buffer[2]).toBeCloseTo(1, 6);
        expect(buffer[3]).toBe(1);
        expect(buffer[4]).toBeCloseTo(-0.5, 6);
        expect(buffer[5]).toBeCloseTo((FACE_SMASHING.damage.perLevel * 2) / 4000, 6);
        expect(buffer[6]).toBeCloseTo(2 / 7, 6);
        expect(buffer[7]).toBeCloseTo(1, 6);
    });

    it('reports the dash cooldown as readiness', () => {
        const level = createDungeonLevel();
        const dodger = buildDodger(level, 320);
        const buffer = createObservationBuffer();
        const cooldown = FACE_SMASHING.dash.cooldownSeconds;

        dodger.dashCooldown = cooldown;
        writeObservation(buffer, { level, dodger, items: [] });
        expect(buffer[7]).toBeCloseTo(0, 6);

        dodger.dashCooldown = cooldown / 2;
        writeObservation(buffer, { level, dodger, items: [] });
        expect(buffer[7]).toBeCloseTo(0.5, 6);

        dodger.dashCooldown = 0;
        writeObservation(buffer, { level, dodger, items: [] });
        expect(buffer[7]).toBeCloseTo(1, 6);
    });

    it('measures the free distance to the nearest blocker', () => {
        const level = createDungeonLevel();
        const centre = observeFrom(level, (level.playLeft + level.playRight) / 2);
        const left = observeFrom(level, level.playLeft + 12);
        const right = observeFrom(level, level.playRight - 12);

        expect(sensorMetres(centre).ground).toBe(0);
        expect(sensorMetres(centre).wallLeft).toBe(REACH);
        expect(sensorMetres(centre).wallRight).toBe(REACH);

        expect(sensorMetres(left).wallLeft).toBe(0);
        expect(sensorMetres(right).wallRight).toBe(0);
    });

    it('measures the gap to the floor while airborne', () => {
        const level = createDungeonLevel();
        const buffer = observeFrom(level, 320, 100);

        expect(sensorMetres(buffer).ground).toBe(100);
        expect(sensorMetres(buffer).wallLeft).toBe(REACH);
    });

    it('clamps the blocker distance to the sensor reach', () => {
        const level = createDungeonLevel();
        const buffer = observeFrom(level, (level.playLeft + level.playRight) / 2);

        for (const name of SENSORS) {
            expect(sensorMetres(buffer)[name]).toBeLessThanOrEqual(REACH);
        }
    });

    it('reads the blockers it is given, so another map is described correctly', () => {
        const level = createDungeonLevel();
        const dodger = buildDodger(level, 320);
        const buffer = createObservationBuffer();
        const top = dodger.physics.body.position.y;

        writeObservation(buffer, {
            level,
            dodger,
            items: [],
            blockers: [{ x: 340, y: top, width: 16, height: dodger.size.height, layer: 1 }],
        });

        const metres = sensorMetres(buffer);
        expect(metres.wallRight).toBe(340 - (320 + dodger.size.width / 2));
        expect(metres.ground).toBe(REACH);
    });

    it('leaves every item slot empty without items', () => {
        const buffer = observe([]);

        for (let index = 0; index < SLOTS; index++) {
            expect(slot(buffer, index)).toEqual(new Array(ITEM_FEATURES).fill(0));
        }
    });

    it('orders items by threat, nearest first', () => {
        const buffer = observe([
            { definition: 0, centerX: 520, y: 100 },
            { definition: 8, centerX: 240, y: 100 },
        ]);
        const nearest = buffer[GLOBAL_FEATURES + 1];
        const farthest = buffer[GLOBAL_FEATURES + ITEM_FEATURES + 1];

        expect(nearest).toBeLessThan(0);
        expect(farthest).toBeGreaterThan(0);
        expect(Math.abs(nearest)).toBeLessThan(Math.abs(farthest));
    });

    it('describes the nearest item', () => {
        const definition = ITEMS[4];
        const centerX = 420;
        const y = 96;
        const buffer = observe([
            {
                definition: 4,
                centerX,
                y,
                velocityX: 12,
                velocityY: 180,
                roll: 0.25,
            },
        ]);
        const level = createDungeonLevel();
        const dodgerTop = level.floorTop - FACE_SMASHING.dodger.box.height;
        const values = slot(buffer, 0);

        expect(values[0]).toBe(1);
        expect(values[1]).toBeCloseTo((centerX - 320) / RADIUS, 6);
        expect(values[2]).toBeCloseTo((y + definition.half.height - dodgerTop) / RADIUS, 6);
        expect(values[3]).toBeCloseTo(12 / FACE_SMASHING.item.lateralSpeed, 6);
        expect(values[4]).toBeCloseTo(180 / FACE_SMASHING.item.maxFallSpeed, 6);
        expect(values[5]).toBe(0);
        expect(values[6]).toBeCloseTo(
            Math.max(definition.half.width, definition.half.height) / level.grid.tileSize,
            6,
        );
        expect(values[7]).toBeCloseTo(
            (definition.damage.min + (definition.damage.max - definition.damage.min) * 0.25) /
                Math.max(...ITEMS.map((item) => item.damage.max)),
            3,
        );
    });

    it('marks items that already landed', () => {
        const buffer = observe([{ definition: 2, centerX: 360, y: 300, state: 'landed' }]);

        expect(slot(buffer, 0)[5]).toBe(1);
    });

    it('ignores items that already settled', () => {
        const buffer = observe([{ definition: 2, centerX: 360, y: 300, state: 'settled' }]);

        expect(slot(buffer, 0)[0]).toBe(0);
    });

    it('sees the far edge of the arena from the opposite corner', () => {
        const level = createDungeonLevel();
        const leftEdge = level.playLeft + ITEMS[3].half.width;
        const rightEdge = level.playRight - ITEMS[3].half.width;

        const fromLeft = observe([{ definition: 3, centerX: leftEdge, y: 300 }], rightEdge);
        const fromRight = observe([{ definition: 3, centerX: rightEdge, y: 300 }], leftEdge);

        expect(slot(fromLeft, 0)[0]).toBe(1);
        expect(slot(fromRight, 0)[0]).toBe(1);
        expect(Math.abs(slot(fromLeft, 0)[1]) * RADIUS).toBeLessThan(RADIUS);
    });

    it('uses every slot when the arena is crowded', () => {
        const span = createDungeonLevel().playRight - createDungeonLevel().playLeft;
        const step = span / SLOTS;
        const specs = Array.from({ length: SLOTS }, (_, index) => ({
            definition: index,
            centerX: 64 + step * index + step / 2,
            y: 300,
        }));
        const buffer = observe(specs);

        for (let index = 0; index < SLOTS; index++) {
            expect(slot(buffer, index)[0]).toBe(1);
        }
    });
});
