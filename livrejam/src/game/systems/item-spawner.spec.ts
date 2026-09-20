import { describe, expect, it } from 'vitest';

import { FACE_SMASHING, ITEMS } from '../config';
import { createDungeonLevel } from '../level';
import { ItemSpawner } from './item-spawner';

function createSpawner(random: () => number): ItemSpawner {
    return new ItemSpawner({ level: createDungeonLevel(), random });
}

describe('ItemSpawner', () => {
    it('starts at the base drop speed', () => {
        const spawner = createSpawner(() => 0.5);
        expect(spawner.speed).toBe(FACE_SMASHING.drop.baseSpeed);
    });

    it('never accelerates past the configured maximum', () => {
        const spawner = createSpawner(() => 0.5);
        for (let step = 0; step < 200; step++) {
            spawner.accelerate();
        }

        expect(spawner.speed).toBe(FACE_SMASHING.drop.maxSpeed);
    });

    it('accelerates on the ramp cadence, not on every frame', () => {
        const spawner = createSpawner(() => 0.5);
        spawner.advance(FACE_SMASHING.drop.rampSeconds - 0.01);

        expect(spawner.speed).toBe(FACE_SMASHING.drop.baseSpeed);

        spawner.advance(0.02);
        expect(spawner.speed).toBe(FACE_SMASHING.drop.baseSpeed + FACE_SMASHING.drop.speedStep);
    });

    it('returns to the base speed on reset', () => {
        const spawner = createSpawner(() => 0.5);
        spawner.accelerate();
        spawner.reset();

        expect(spawner.speed).toBe(FACE_SMASHING.drop.baseSpeed);
    });

    it('spawns at the centre of the ceiling', () => {
        const level = createDungeonLevel();
        const spawner = new ItemSpawner({ level, random: () => 0.5 });
        const center = level.grid.left + level.grid.width / 2;

        for (const definition of ITEMS) {
            const item = spawner.spawnItem(definition);
            expect(item.centerX).toBeCloseTo(center, 6);
            expect(item.state).toBe('falling');
        }
    });

    it('falls straight down with no lateral drift', () => {
        const spawner = createSpawner(() => 0.5);

        for (let step = 0; step < 50; step++) {
            const item = spawner.spawn();
            expect(item.physics.body.velocity.x).toBe(0);
            expect(item.physics.body.velocity.y).toBe(FACE_SMASHING.drop.baseSpeed);
        }
    });

    it('gives every spawned item spin', () => {
        const spawner = createSpawner(() => 0.25);
        for (let step = 0; step < 50; step++) {
            const item = spawner.spawn();
            expect(item.spinRate).toBeGreaterThan(0);
        }
    });
});
