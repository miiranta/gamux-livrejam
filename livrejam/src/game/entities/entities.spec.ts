import { describe, expect, it } from 'vitest';

import { PhysicsWorld } from '../../engine/physics';
import { FACE_SMASHING } from '../config';
import { Dodger, randomMaxSpeed } from './dodger';
import { Faller, pickFallerSprite } from './faller';
import { createDungeonLevel } from '../level';

function createTestDodger(maxSpeed = 200): Dodger {
    const level = createDungeonLevel();
    return new Dodger({
        feetX: level.grid.left + level.grid.width / 2,
        feetY: level.floorTop,
        maxSpeedX: maxSpeed,
    });
}

describe('Dodger', () => {
    it('accelerates towards the requested direction up to the round max speed', () => {
        const dodger = createTestDodger(200);
        for (let step = 0; step < 120; step++) {
            dodger.move(1, 1 / 60);
        }

        expect(dodger.physics.body.velocity.x).toBeCloseTo(200, 4);
        expect(dodger.facing).toBe('right');
    });

    it('never exceeds its own max speed even when the round cap is higher', () => {
        const dodger = createTestDodger(120);
        for (let step = 0; step < 240; step++) {
            dodger.move(-1, 1 / 60);
        }

        expect(dodger.physics.body.velocity.x).toBeCloseTo(-120, 4);
    });

    it('coasts to a stop when the axis intent is neutral', () => {
        const dodger = createTestDodger(200);
        dodger.physics.body.velocity.x = 150;

        for (let step = 0; step < 60; step++) {
            dodger.move(0, 1 / 60);
        }

        expect(dodger.physics.body.velocity.x).toBeGreaterThan(0);
        expect(dodger.physics.body.velocity.x).toBeCloseTo(
            150 * Math.exp(-FACE_SMASHING.dodger.dragX),
            3,
        );
    });

    it('only jumps when grounded and consumes the request once', () => {
        const world = new PhysicsWorld();
        const level = createDungeonLevel();
        for (const collider of level.colliders) {
            world.addBlocker(collider);
        }

        const dodger = createTestDodger();
        for (let step = 0; step < 60; step++) {
            world.step(dodger.physics, 1 / 60);
        }

        dodger.requestJump();
        dodger.consumeJump();
        expect(dodger.physics.body.velocity.y).toBeCloseTo(-FACE_SMASHING.dodger.jumpSpeed, 4);

        world.step(dodger.physics, 1 / 60);
        dodger.consumeJump();
        expect(dodger.physics.body.velocity.y).not.toBeCloseTo(-FACE_SMASHING.dodger.jumpSpeed, 4);
    });

    it('derives the animation from the grounded state', () => {
        const dodger = createTestDodger();
        dodger.physics.body.grounded = false;
        dodger.resolveAnimation();
        expect(dodger.animation).toBe('jump');

        dodger.physics.body.grounded = true;
        dodger.physics.body.velocity.x = 0;
        dodger.resolveAnimation();
        expect(dodger.animation).toBe('walk');

        dodger.physics.body.velocity.x = 120;
        dodger.resolveAnimation();
        expect(dodger.animation).toBe('run');
    });
});

describe('randomMaxSpeed', () => {
    it('stays inside the configured range', () => {
        const values = [0, 0.25, 0.5, 0.75, 1].map((value) => randomMaxSpeed(() => value));

        expect(Math.min(...values)).toBe(FACE_SMASHING.dodger.maxSpeedMin);
        expect(Math.max(...values)).toBe(FACE_SMASHING.dodger.maxSpeedMax);
    });
});

describe('Faller', () => {
    it('starts falling with the initial velocity', () => {
        const faller = new Faller({
            x: 100,
            y: 0,
            velocityX: 30,
            velocityY: 200,
            sprite: 'barrel',
            size: 32,
        });

        expect(faller.state).toBe('falling');
        expect(faller.physics.body.velocity.y).toBe(200);
        expect(faller.centerX).toBeCloseTo(116, 4);
    });

    it('switches to landed on the first ground contact', () => {
        const faller = new Faller({
            x: 100,
            y: 0,
            velocityX: 0,
            velocityY: 200,
            sprite: 'barrel',
            size: 32,
        });

        faller.applyCollision({ grounded: true, hitWall: null, hitCeiling: false, layer: 2 });
        expect(faller.state).toBe('landed');
    });

    it('expires after the settle window', () => {
        const faller = new Faller({
            x: 100,
            y: 0,
            velocityX: 0,
            velocityY: 200,
            sprite: 'barrel',
            size: 32,
        });

        faller.applyCollision({ grounded: true, hitWall: null, hitCeiling: false, layer: 2 });
        for (let step = 0; step < 120; step++) {
            faller.update(1 / 60);
        }

        expect(faller.expired).toBe(true);
    });

    it('always picks a known sprite', () => {
        for (const value of [0, 0.2, 0.5, 0.99]) {
            expect(typeof pickFallerSprite(() => value)).toBe('string');
        }
    });
});
