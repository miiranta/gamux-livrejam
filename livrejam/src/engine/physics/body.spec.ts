import { describe, expect, it } from 'vitest';

import { createBody, dampVelocity, accelerate } from './body';

describe('body', () => {
    it('clamps the velocity to the axis max speed', () => {
        const body = createBody({ x: 0, y: 0 }, { gravity: 0 });
        body.maxSpeed.x = 100;

        for (let step = 0; step < 60; step++) {
            accelerate(body, 'x', 1000, 100, 1 / 60);
        }

        expect(body.velocity.x).toBeCloseTo(100, 6);
    });

    it('respects the smallest of the max speed and the requested limit', () => {
        const body = createBody({ x: 0, y: 0 }, { gravity: 0 });
        body.maxSpeed.x = 1000;

        for (let step = 0; step < 60; step++) {
            accelerate(body, 'x', 1000, 120, 1 / 60);
        }

        expect(body.velocity.x).toBeCloseTo(120, 6);
    });

    it('applies gravity and moves the body', () => {
        const body = createBody({ x: 0, y: 0 }, { gravity: 900 });
        body.velocity.y += body.acceleration.y * 0.5;
        expect(body.velocity.y).toBeCloseTo(450, 6);
    });

    it('damps the velocity towards zero', () => {
        const body = createBody({ x: 0, y: 0 }, { gravity: 0, initialVelocity: { x: 200 } });

        for (let step = 0; step < 60; step++) {
            dampVelocity(body, 'x', 6, 1 / 60);
        }

        expect(body.velocity.x).toBeGreaterThan(0);
        expect(body.velocity.x).toBeCloseTo(200 * Math.exp(-6), 4);
    });
});
