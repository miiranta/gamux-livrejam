import { describe, expect, it } from 'vitest';

import { PhysicsWorld } from '../../engine/physics';
import { FACE_SMASHING, ITEMS, ITEM_WEIGHT_TOTAL } from '../config';
import { DAMAGE_PER_LEVEL, TIER_LAST, damageLevel, damageScale } from '../damage';
import { Dodger } from './dodger';
import { Item, pickItem } from './item';
import { createDungeonLevel } from '../level';

function createTestDodger(): Dodger {
    const level = createDungeonLevel();
    return new Dodger({
        feetX: level.grid.left + level.grid.width / 2,
        feetY: level.floorTop,
    });
}

function createTestItem(): Item {
    return new Item({
        x: 100,
        y: 0,
        velocityX: 30,
        velocityY: 200,
        definition: ITEMS[0],
        spin: 6,
        damageRoll: 0,
    });
}

describe('Dodger', () => {
    it('starts at the intact tier with the fastest stats', () => {
        const dodger = createTestDodger();
        const config = FACE_SMASHING.dodger;

        expect(dodger.level).toBe(0);
        expect(dodger.maxSpeedX).toBe(config.maxSpeedStart);
        expect(dodger.jumpSpeed).toBe(config.jumpStart);
    });

    it('accelerates towards the requested direction up to its own max speed', () => {
        const dodger = createTestDodger();
        for (let step = 0; step < 120; step++) {
            dodger.move(1, 1 / 60);
        }

        expect(dodger.physics.body.velocity.x).toBeCloseTo(dodger.maxSpeedX, 4);
        expect(dodger.facing).toBe('right');
    });

    it('caps a walk below the sprint speed', () => {
        const dodger = createTestDodger();
        dodger.speedFactor = FACE_SMASHING.player.walkSpeedFactor;

        for (let step = 0; step < 120; step++) {
            dodger.move(1, 1 / 60);
        }

        expect(dodger.physics.body.velocity.x).toBeCloseTo(
            dodger.maxSpeedX * FACE_SMASHING.player.walkSpeedFactor,
            4,
        );
    });

    it('coasts to a stop when the axis intent is neutral', () => {
        const dodger = createTestDodger();
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

    it('only jumps when grounded', () => {
        const world = new PhysicsWorld();
        const level = createDungeonLevel();
        for (const collider of level.colliders) {
            world.addBlocker(collider);
        }

        const dodger = createTestDodger();
        for (let step = 0; step < 60; step++) {
            world.step(dodger.physics, 1 / 60);
        }

        expect(dodger.physics.body.grounded).toBe(true);
        dodger.requestJump();
        dodger.consumeJump();
        expect(dodger.physics.body.velocity.y).toBeCloseTo(-dodger.jumpSpeed, 4);
    });

    it('ignores a jump request while airborne', () => {
        const dodger = createTestDodger();
        dodger.physics.body.grounded = true;
        dodger.requestJump();
        dodger.consumeJump();
        const launch = dodger.physics.body.velocity.y;

        dodger.physics.body.grounded = false;
        for (let step = 0; step < 8; step++) {
            dodger.physics.body.velocity.y += FACE_SMASHING.physics.gravity / 60;
        }

        const falling = dodger.physics.body.velocity.y;
        dodger.requestJump();
        dodger.consumeJump();

        expect(dodger.physics.body.velocity.y).toBeCloseTo(falling, 6);
        expect(falling).toBeGreaterThan(launch);
    });

    it('clears a queued jump even when the attempt fails', () => {
        const dodger = createTestDodger();
        dodger.physics.body.grounded = false;
        dodger.requestJump();
        dodger.consumeJump();
        expect(dodger.jumpQueued).toBe(false);
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

describe('damage tiers', () => {
    it('keeps the dodger at tier 0 below the first threshold', () => {
        const dodger = createTestDodger();
        dodger.takeDamage(DAMAGE_PER_LEVEL - 1);
        expect(dodger.level).toBe(0);
    });

    it('advances exactly one tier per threshold crossed', () => {
        const dodger = createTestDodger();
        expect(dodger.takeDamage(DAMAGE_PER_LEVEL)).toBe(1);
        expect(dodger.level).toBe(1);
        expect(dodger.takeDamage(DAMAGE_PER_LEVEL * 2)).toBe(2);
        expect(dodger.level).toBe(3);
    });

    it('weakens max speed and jump as the tiers progress', () => {
        const dodger = createTestDodger();
        const config = FACE_SMASHING.dodger;
        const startSpeed = dodger.maxSpeedX;
        const startJump = dodger.jumpSpeed;

        dodger.takeDamage(DAMAGE_PER_LEVEL * TIER_LAST);

        expect(dodger.level).toBe(TIER_LAST);
        expect(dodger.maxSpeedX).toBeCloseTo(config.maxSpeedEnd, 4);
        expect(dodger.jumpSpeed).toBeCloseTo(config.jumpEnd, 4);
        expect(dodger.maxSpeedX).toBeLessThan(startSpeed);
        expect(dodger.jumpSpeed).toBeLessThan(startJump);
    });

    it('stops weakening beyond the last tier', () => {
        const dodger = createTestDodger();
        dodger.takeDamage(DAMAGE_PER_LEVEL * TIER_LAST);
        const wornSpeed = dodger.maxSpeedX;

        dodger.takeDamage(DAMAGE_PER_LEVEL * 10);

        expect(dodger.level).toBe(TIER_LAST);
        expect(dodger.isWorn).toBe(true);
        expect(dodger.maxSpeedX).toBeCloseTo(wornSpeed, 6);
    });

    it('scales stats monotonically', () => {
        const speeds = Array.from({ length: 8 }, (_, level) =>
            damageScale(
                level,
                FACE_SMASHING.dodger.maxSpeedStart,
                FACE_SMASHING.dodger.maxSpeedEnd,
            ),
        );

        for (let index = 1; index < speeds.length; index++) {
            expect(speeds[index]).toBeLessThan(speeds[index - 1]);
        }
    });

    it('clamps the tier index at both ends', () => {
        expect(damageLevel(-100)).toBe(0);
        expect(damageLevel(1e9)).toBe(TIER_LAST);
    });
});

describe('dash', () => {
    it('starts ready', () => {
        const dodger = createTestDodger();

        expect(dodger.dashReady).toBe(true);
        expect(dodger.dashing).toBe(false);
        expect(dodger.dashCooldownRatio).toBe(0);
    });

    it('bursts in the requested direction and faces it', () => {
        const dodger = createTestDodger();

        expect(dodger.dash(-1)).toBe(true);
        expect(dodger.physics.body.velocity.x).toBeCloseTo(-dodger.dashSpeed, 4);
        expect(dodger.facing).toBe('left');
        expect(dodger.dashing).toBe(true);
    });

    it('is faster than the tier max speed', () => {
        const dodger = createTestDodger();

        expect(dodger.dashSpeed).toBeGreaterThan(dodger.maxSpeedX);
    });

    it('loses range as the damage tiers progress', () => {
        const dodger = createTestDodger();
        const fresh = dodger.dashSpeed;

        dodger.takeDamage(DAMAGE_PER_LEVEL * TIER_LAST);

        expect(dodger.dashSpeed).toBeCloseTo(FACE_SMASHING.dash.speedEnd, 4);
        expect(dodger.dashSpeed).toBeLessThan(fresh);
    });

    it('refuses a second dash until the cooldown elapses', () => {
        const dodger = createTestDodger();
        const config = FACE_SMASHING.dash;

        expect(dodger.dash(1)).toBe(true);
        expect(dodger.dash(-1)).toBe(false);
        expect(dodger.dashReady).toBe(false);

        dodger.advanceReaction(config.seconds + 0.01);
        expect(dodger.dashReady).toBe(false);

        dodger.advanceReaction(config.cooldownSeconds);
        expect(dodger.dashReady).toBe(true);
        expect(dodger.dash(-1)).toBe(true);
    });

    it('does not dash while stunned', () => {
        const dodger = createTestDodger();
        dodger.react(1, 40);

        expect(dodger.stunned).toBe(true);
        expect(dodger.dash(1)).toBe(false);
    });

    it('keeps its burst instead of being clamped to the tier max speed', () => {
        const dodger = createTestDodger();
        dodger.dash(1);

        for (let step = 0; step < 8; step++) {
            dodger.move(1, 1 / 60);
            expect(dodger.physics.body.velocity.x).toBeGreaterThan(dodger.maxSpeedX * 1.2);
        }
    });

    it('reports the animated dash as the run clip', () => {
        const dodger = createTestDodger();
        dodger.dash(1);
        dodger.resolveAnimation();

        expect(dodger.animation).toBe('run');
    });

    it('restores the tier speed limit once the burst ends', () => {
        const dodger = createTestDodger();
        const limit = dodger.maxSpeedX;
        dodger.dash(1);

        expect(dodger.physics.body.maxSpeed.x).toBeGreaterThan(limit);
        dodger.advanceReaction(FACE_SMASHING.dash.seconds + 0.01);

        expect(dodger.physics.body.maxSpeed.x).toBeCloseTo(limit, 4);
    });
});

describe('Item', () => {
    it('starts falling with the initial velocity and spin', () => {
        const item = createTestItem();

        expect(item.state).toBe('falling');
        expect(item.physics.body.velocity.y).toBe(200);
        expect(item.spinRate).toBe(6);
        expect(item.centerX).toBeCloseTo(100 + item.halfWidth, 4);
    });

    it('switches to landed on the first ground contact and dumps spin', () => {
        const item = createTestItem();
        item.applyCollision({ grounded: true, hitWall: null, hitCeiling: false, layer: 2 });

        expect(item.state).toBe('landed');
        expect(item.spinRate).toBeCloseTo(6 * FACE_SMASHING.item.spinTransfer, 4);
    });

    it('pops in as it appears', () => {
        const item = createTestItem();

        expect(item.appear).toBe(0);
        expect(item.opacity).toBe(0);
        expect(item.appearScale).toBeCloseTo(1 + FACE_SMASHING.item.appearScale, 6);

        const halfAppear = Math.floor((FACE_SMASHING.item.appearSeconds / 2) * 60);
        for (let step = 0; step < halfAppear; step++) {
            item.update(1 / 60);
        }

        expect(item.appear).toBeGreaterThan(0);
        expect(item.appear).toBeLessThan(1);
        expect(item.opacity).toBeCloseTo(item.appear, 6);
        expect(item.appearScale).toBeGreaterThan(1);

        for (let step = 0; step < halfAppear + 2; step++) {
            item.update(1 / 60);
        }

        expect(item.appear).toBe(1);
        expect(item.opacity).toBe(1);
        expect(item.appearScale).toBeCloseTo(1, 6);
    });

    it('stays opaque while it is still settling', () => {
        const item = createTestItem();
        item.applyCollision({ grounded: true, hitWall: null, hitCeiling: false, layer: 2 });

        const halfSteps = Math.floor((FACE_SMASHING.item.settleSeconds / 2) * 60);

        for (let step = 0; step < halfSteps; step++) {
            item.update(1 / 60);
        }

        expect(item.state).toBe('landed');
        expect(item.opacity).toBe(1);
        expect(item.expired).toBe(false);
    });

    it('fades out and expires after settling', () => {
        const item = createTestItem();
        item.applyCollision({ grounded: true, hitWall: null, hitCeiling: false, layer: 2 });

        const settleSteps = Math.ceil(FACE_SMASHING.item.settleSeconds * 60);
        for (let step = 0; step < settleSteps; step++) {
            item.update(1 / 60);
        }

        expect(item.state).toBe('settled');
        expect(item.expired).toBe(false);

        const halfFade = Math.floor((FACE_SMASHING.item.fadeSeconds / 2) * 60);
        for (let step = 0; step < halfFade; step++) {
            item.update(1 / 60);
        }

        expect(item.fade).toBeGreaterThan(0);
        expect(item.fade).toBeLessThan(1);
        expect(item.opacity).toBeCloseTo(1 - item.fade, 6);
        expect(item.expired).toBe(false);

        for (let step = 0; step < halfFade + 2; step++) {
            item.update(1 / 60);
        }

        expect(item.opacity).toBe(0);
        expect(item.expired).toBe(true);
    });

    it('rolls damage inside the item range', () => {
        const definition = ITEMS[0];
        const low = new Item({
            x: 0,
            y: 0,
            velocityX: 0,
            velocityY: 0,
            definition,
            damageRoll: 0,
        });
        const high = new Item({
            x: 0,
            y: 0,
            velocityX: 0,
            velocityY: 0,
            definition,
            damageRoll: 1,
        });

        expect(low.baseDamage).toBeCloseTo(definition.damage.min, 6);
        expect(high.baseDamage).toBeCloseTo(definition.damage.max, 6);
    });

    it('scales damage with impact speed and spin', () => {
        const slow = new Item({
            x: 0,
            y: 0,
            velocityX: 0,
            velocityY: 0,
            definition: ITEMS[0],
            spin: 0,
            damageRoll: 1,
        });
        const fast = new Item({
            x: 0,
            y: 0,
            velocityX: 0,
            velocityY: FACE_SMASHING.item.referenceSpeed * 2,
            definition: ITEMS[0],
            spin: ITEMS[0].spin.max,
            damageRoll: 1,
        });

        expect(fast.damage).toBeGreaterThan(slow.damage);
    });
});

describe('pickItem', () => {
    it('always returns a known item', () => {
        const keys = new Set(ITEMS.map((item) => item.key));
        for (const value of [0, 0.01, 0.25, 0.5, 0.75, 0.99]) {
            expect(keys.has(pickItem(() => value).key)).toBe(true);
        }
    });

    it('respects the weight distribution', () => {
        const counts = new Map<string, number>();
        const samples = 20000;
        for (let index = 0; index < samples; index++) {
            const roll = (index + 0.5) / samples;
            const key = pickItem(() => roll).key;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }

        for (const item of ITEMS) {
            const observed = (counts.get(item.key) ?? 0) / samples;
            expect(observed).toBeCloseTo(item.weight / ITEM_WEIGHT_TOTAL, 4);
        }
    });
});
