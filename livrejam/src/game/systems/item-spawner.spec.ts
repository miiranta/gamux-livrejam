import { describe, expect, it } from 'vitest';

import { ITEMS } from '../config';
import { createDungeonLevel } from '../level';
import { ItemSpawner } from './item-spawner';

function createSpawner(random: () => number): ItemSpawner {
    return new ItemSpawner({ level: createDungeonLevel(), random });
}

describe('ItemSpawner', () => {
    it('starts at the base drop speed', () => {
        const spawner = createSpawner(() => 0.5);
        expect(spawner.speed).toBeGreaterThan(0);
    });

    it('never spawns faster than the minimum interval', () => {
        const spawner = createSpawner(() => 0.5);
        for (let step = 0; step < 200; step++) {
            spawner.accelerate();
        }

        expect(spawner.interval).toBeGreaterThanOrEqual(0.4);
    });

    it('spawns nothing until the interval elapses', () => {
        const spawner = createSpawner(() => 0.5);
        expect(spawner.update(0.01)).toBeNull();
    });

    it('spawns an item once the interval elapses', () => {
        const spawner = createSpawner(() => 0.5);
        let spawned = null;
        for (let step = 0; step < 200 && !spawned; step++) {
            spawned = spawner.update(1 / 60);
        }

        expect(spawned).not.toBeNull();
        expect(spawned?.definition.key.length).toBeGreaterThan(0);
    });

    it('keeps every spawned item inside the arena', () => {
        const level = createDungeonLevel();
        const spawner = new ItemSpawner({ level, random: () => 0.5 });

        for (const definition of ITEMS) {
            const item = spawner.spawnItem(definition, 0);
            expect(item.position.x).toBeGreaterThanOrEqual(level.grid.left - 1);
            expect(item.position.x + item.halfWidth * 2).toBeLessThanOrEqual(level.grid.right + 1);
        }
    });

    it('gives every spawned item spin', () => {
        const spawner = createSpawner(() => 0.25);
        for (let step = 0; step < 50; step++) {
            const item = spawner.spawn();
            expect(item.spinRate).toBeGreaterThan(0);
            expect(item.state).toBe('falling');
        }
    });

    it('respects the aim point when not scattering', () => {
        const spawner = createSpawner(() => 0.5);
        const item = spawner.spawnItem(ITEMS[0], 300);
        expect(item.centerX).toBeGreaterThan(280);
        expect(item.centerX).toBeLessThan(320);
    });
});
