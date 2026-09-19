import { describe, expect, it } from 'vitest';

import { DUNGEON_DROP } from '../config';
import { Dodger, Faller } from '../entities';
import { createDungeonLevel } from '../level';
import {
    DODGER_ACTIONS,
    createObservationBuffer,
    decodeAction,
    writeObservation,
} from './observation';

const FALLER_SIZE = 32;

function buildDodger(feetX: number, maxSpeedX = 200): Dodger {
    const level = createDungeonLevel();
    return new Dodger({ feetX, feetY: level.floorTop, maxSpeedX });
}

function buildFaller(level: ReturnType<typeof createDungeonLevel>, x: number, y: number): Faller {
    return new Faller({
        x,
        y,
        velocityX: 0,
        velocityY: 200,
        sprite: 'smallCrate',
        size: FALLER_SIZE,
    });
}

describe('decodeAction', () => {
    it('maps every action to an axis and jump intent', () => {
        expect(decodeAction(DODGER_ACTIONS.none)).toEqual({ axis: 0, jump: false });
        expect(decodeAction(DODGER_ACTIONS.left)).toEqual({ axis: -1, jump: false });
        expect(decodeAction(DODGER_ACTIONS.right)).toEqual({ axis: 1, jump: false });
        expect(decodeAction(DODGER_ACTIONS.jump)).toEqual({ axis: 0, jump: true });
        expect(decodeAction(DODGER_ACTIONS.jumpLeft)).toEqual({ axis: -1, jump: true });
        expect(decodeAction(DODGER_ACTIONS.jumpRight)).toEqual({ axis: 1, jump: true });
    });

    it('falls back to doing nothing for an unknown index', () => {
        expect(decodeAction(99)).toEqual({ axis: 0, jump: false });
    });
});

describe('writeObservation', () => {
    const level = createDungeonLevel();

    it('produces a vector of the configured size', () => {
        const buffer = createObservationBuffer();
        const result = writeObservation(buffer, { level, dodger: buildDodger(320), fallers: [] });

        expect(result).toBe(buffer);
        expect(buffer.length).toBe(DUNGEON_DROP.ai.observationSize);
    });

    it('centres the position channel for a dodger in the middle of the arena', () => {
        const buffer = createObservationBuffer();
        writeObservation(buffer, { level, dodger: buildDodger(320), fallers: [] });

        expect(buffer[0]).toBeCloseTo(0, 5);
    });

    it('signs the position channel by the side of the arena', () => {
        const buffer = createObservationBuffer();
        writeObservation(buffer, { level, dodger: buildDodger(100), fallers: [] });
        const left = buffer[0];

        writeObservation(buffer, { level, dodger: buildDodger(540), fallers: [] });

        expect(left).toBeLessThan(0);
        expect(buffer[0]).toBeGreaterThan(0);
    });

    it('normalises the horizontal velocity by the round max speed', () => {
        const buffer = createObservationBuffer();
        const dodger = buildDodger(320, 200);
        dodger.physics.body.velocity.x = 100;

        writeObservation(buffer, { level, dodger, fallers: [] });

        expect(buffer[1]).toBeCloseTo(0.5, 5);
        expect(buffer[2]).toBeCloseTo(200 / DUNGEON_DROP.dodger.maxSpeedMax, 5);
    });

    it('always reports the round max speed so the policy can adapt', () => {
        const buffer = createObservationBuffer();
        const slow = buildDodger(320, DUNGEON_DROP.dodger.maxSpeedMin);
        writeObservation(buffer, { level, dodger: slow, fallers: [] });

        expect(buffer[2]).toBeCloseTo(
            DUNGEON_DROP.dodger.maxSpeedMin / DUNGEON_DROP.dodger.maxSpeedMax,
            5,
        );
    });

    it('zeroes every slot when there is no faller', () => {
        const buffer = createObservationBuffer();
        writeObservation(buffer, { level, dodger: buildDodger(320), fallers: [] });

        for (let index = 3; index < buffer.length; index++) {
            expect(buffer[index]).toBe(0);
        }
    });

    it('describes the nearest faller in the first slot', () => {
        const buffer = createObservationBuffer();
        const dodger = buildDodger(320);
        const faller = buildFaller(level, 420, 100);

        writeObservation(buffer, { level, dodger, fallers: [faller] });

        expect(buffer[3]).toBe(1);
        expect(buffer[4]).toBeCloseTo(
            (420 + FALLER_SIZE / 2 - 320) / DUNGEON_DROP.ai.observeRadius,
            5,
        );
        expect(buffer[5]).toBeCloseTo(
            (100 + FALLER_SIZE / 2 - dodger.physics.body.position.y) /
                DUNGEON_DROP.ai.observeRadius,
            5,
        );
    });

    it('ranks closer threats ahead of distant ones', () => {
        const buffer = createObservationBuffer();
        const dodger = buildDodger(320);
        const near = buildFaller(level, 340, 120);
        const far = buildFaller(level, 560, 120);

        writeObservation(buffer, { level, dodger, fallers: [far, near] });

        const nearOffset = near.centerX - dodger.feet.x;
        expect(buffer[4]).toBeCloseTo(nearOffset / DUNGEON_DROP.ai.observeRadius, 5);
    });

    it('reports the settled flag once a faller has landed', () => {
        const buffer = createObservationBuffer();
        const faller = buildFaller(level, 340, 120);
        faller.applyCollision({ grounded: true, hitWall: null, hitCeiling: false, layer: 2 });

        writeObservation(buffer, { level, dodger: buildDodger(320), fallers: [faller] });

        expect(buffer[8]).toBe(1);
    });

    it('never leaves the buffer with non-finite values', () => {
        const buffer = createObservationBuffer();
        const fallers = [buildFaller(level, 100, 0), buildFaller(level, 320, 50)];

        writeObservation(buffer, { level, dodger: buildDodger(320), fallers });

        for (const value of buffer) {
            expect(Number.isFinite(value)).toBe(true);
        }
    });

    it('reuses the supplied buffer without reallocating', () => {
        const buffer = createObservationBuffer();
        const dodger = buildDodger(320);
        const first = writeObservation(buffer, { level, dodger, fallers: [] });

        expect(first).toBe(buffer);
    });
});
