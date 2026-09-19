import { describe, expect, it } from 'vitest';
import { FACE_SMASHING, ITEMS } from '../config';
import { createDungeonLevel } from '../level';
import { Dodger, Item } from '../entities';
import { createObservationBuffer, writeObservation } from './observation';
import fixture from '../../../../tools/ai/fixtures/observation_fixture.json';

interface FixtureItem {
    index: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    spin: number;
    roll: number;
}

interface Fixture {
    dodger: {
        feetX: number;
        velocityX: number;
        maxSpeedX: number;
        damage: number;
        grounded: boolean;
        dashCooldown?: number;
    };
    items: FixtureItem[];
    observation: number[];
}

describe('observation contract', () => {
    it('matches the shared fixture', () => {
        const data = fixture as Fixture;
        const level = createDungeonLevel();
        const dodger = new Dodger({
            feetX: data.dodger.feetX,
            feetY: level.floorTop,
            facing: 'right',
        });

        dodger.maxSpeedX = data.dodger.maxSpeedX;
        dodger.damage = data.dodger.damage;
        dodger.applyTier();
        dodger.dashCooldown = data.dodger.dashCooldown ?? 0;
        dodger.physics.body.velocity.x = data.dodger.velocityX;
        dodger.physics.body.velocity.y = 0;
        dodger.physics.body.grounded = data.dodger.grounded;

        const items = data.items.map((entry) => {
            const definition = ITEMS[entry.index];
            return new Item({
                x: entry.x,
                y: entry.y,
                velocityX: entry.vx,
                velocityY: entry.vy,
                definition,
                spin: entry.spin,
                damageRoll: entry.roll,
            });
        });

        const buffer = createObservationBuffer();
        writeObservation(buffer, { level, dodger, items });

        expect(buffer).toHaveLength(data.observation.length);
        expect(buffer).toHaveLength(FACE_SMASHING.ai.observationSize);

        for (let index = 0; index < buffer.length; index++) {
            expect(buffer[index], `indice ${index}`).toBeCloseTo(data.observation[index], 5);
        }
    });

    it('covers every observation slot with items in the fixture', () => {
        const data = fixture as Fixture;
        const globals = 12;
        const slots = (FACE_SMASHING.ai.observationSize - globals) / 8;
        const present = Array.from({ length: slots }, (_, index) =>
            data.observation[globals + index * 8],
        );

        expect(data.items.length).toBeGreaterThanOrEqual(4);
        expect(present.filter((value) => value === 1).length).toBe(data.items.length);
    });
});
