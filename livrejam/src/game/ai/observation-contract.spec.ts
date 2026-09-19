import { describe, expect, it } from 'vitest';

import { DUNGEON_DROP } from '../config';
import { Dodger, Faller } from '../entities';
import { createDungeonLevel } from '../level';
import { createObservationBuffer, writeObservation } from './observation';

const PYTHON_FIXTURE = {
    dodger: { feetX: 320, velocityX: 120, maxSpeedX: 200 },
    fallers: [
        { x: 420, y: 100, velocityX: 0, velocityY: 200, grounded: false },
        { x: 120, y: 40, velocityX: 0, velocityY: 300, grounded: false },
        { x: 560, y: 300, velocityX: 0, velocityY: 0, grounded: true },
    ],
    observation: [
        0, 0.6, 0.666667, 1, 0.446154, -0.807692, 0, 0.384615, 0, 1, 1, -0.707692, -1.038462, 0,
        0.576923, 0, 1, 1, 0.984615, -0.038462, 0, 0, 1, 1,
    ],
};

const FALLER_SIZE = 32;

describe('observation contract with the Python simulator', () => {
    it('keeps the fixture the same size as the configured observation', () => {
        expect(DUNGEON_DROP.ai.observationSize).toBe(24);
        expect(PYTHON_FIXTURE.observation.length).toBe(DUNGEON_DROP.ai.observationSize);
    });

    it('produces exactly the vector the Python simulator reproduces', () => {
        const level = createDungeonLevel();
        const { dodger: dodgerSpec } = PYTHON_FIXTURE;
        const dodger = new Dodger({
            feetX: dodgerSpec.feetX,
            feetY: level.floorTop,
            maxSpeedX: dodgerSpec.maxSpeedX,
        });
        dodger.physics.body.velocity.x = dodgerSpec.velocityX;

        const fallers = PYTHON_FIXTURE.fallers.map((spec) => {
            const faller = new Faller({
                x: spec.x,
                y: spec.y,
                velocityX: spec.velocityX,
                velocityY: spec.velocityY,
                sprite: 'smallCrate',
                size: FALLER_SIZE,
            });

            if (spec.grounded) {
                faller.applyCollision({
                    grounded: true,
                    hitWall: null,
                    hitCeiling: false,
                    layer: 2,
                });
            }

            return faller;
        });

        const buffer = createObservationBuffer();
        writeObservation(buffer, { level, dodger, fallers });

        const actual = Array.from(buffer).map((value) => Number(value.toFixed(6)));
        expect(actual).toEqual(PYTHON_FIXTURE.observation);
    });
});
