import { describe, expect, it } from 'vitest';

import { createBody } from './body';
import type { PhysicsBody } from './world';
import { PhysicsWorld } from './world';

function entry(x: number, y: number, width: number, height: number): PhysicsBody {
    return {
        body: createBody({ x, y }, { gravity: 900 }),
        size: { width, height },
        solid: true,
    };
}

describe('PhysicsWorld', () => {
    it('lands on the floor and reports grounded', () => {
        const world = new PhysicsWorld();
        world.addBlocker({ x: 0, y: 100, width: 200, height: 20 });

        const body = entry(10, 0, 20, 20);
        let grounded = false;

        for (let step = 0; step < 240; step++) {
            grounded = world.step(body, 1 / 60).grounded;
        }

        expect(grounded).toBe(true);
        expect(body.body.position.y + body.size.height).toBeCloseTo(100, 4);
    });

    it('stops against a wall instead of passing through', () => {
        const world = new PhysicsWorld();
        world.addBlocker({ x: 200, y: 0, width: 20, height: 400 });

        const body = entry(0, 0, 20, 20);
        body.body.acceleration.y = 0;

        for (let step = 0; step < 240; step++) {
            body.body.velocity.x = 300;
            world.step(body, 1 / 60);
        }

        expect(body.body.position.x + body.size.width).toBeLessThanOrEqual(200.001);
    });

    it('exposes the layer of the blocker that was hit', () => {
        const world = new PhysicsWorld();
        world.addBlocker({ x: 0, y: 100, width: 200, height: 20 }, 7);

        const body = entry(10, 0, 20, 20);
        let layer: number | null = null;

        for (let step = 0; step < 240; step++) {
            const result = world.step(body, 1 / 60);
            if (result.layer !== null) {
                layer = result.layer;
            }
        }

        expect(layer).toBe(7);
    });

    it('clears blockers on demand', () => {
        const world = new PhysicsWorld();
        world.addBlocker({ x: 0, y: 0, width: 10, height: 10 });
        expect(world.blockerCount).toBe(1);

        world.clearBlockers();
        expect(world.blockerCount).toBe(0);
    });
});
