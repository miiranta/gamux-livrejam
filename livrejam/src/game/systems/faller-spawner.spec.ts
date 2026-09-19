import { describe, expect, it } from 'vitest';

import { DUNGEON_DROP } from '../config';
import { createDungeonLevel } from '../level';
import { FallerSpawner } from './faller-spawner';

describe('FallerSpawner', () => {
    const level = createDungeonLevel();

    it('spawns nothing before the first interval elapses', () => {
        const spawner = new FallerSpawner({ level, random: () => 0.5 });

        expect(spawner.update(DUNGEON_DROP.drop.baseInterval * 0.5)).toBeNull();
    });

    it('spawns a faller once the interval elapses', () => {
        const spawner = new FallerSpawner({ level, random: () => 0.5 });
        const faller = spawner.update(DUNGEON_DROP.drop.baseInterval);

        expect(faller).not.toBeNull();
        expect(faller?.physics.body.velocity.y).toBe(DUNGEON_DROP.drop.baseSpeed);
        expect(faller?.state).toBe('falling');
    });

    it('keeps spawns inside the playable span', () => {
        const spawner = new FallerSpawner({ level, random: () => 0 });
        const faller = spawner.update(DUNGEON_DROP.drop.baseInterval);

        expect(faller?.position.x).toBeGreaterThanOrEqual(level.grid.left);
        expect(faller?.position.x).toBeLessThan(level.playRight);
    });

    it('aims the spawn near the requested point', () => {
        const spawner = new FallerSpawner({ level, random: () => 0.5 });
        const target = 300;
        const faller = spawner.spawn(target);

        expect(faller.centerX).toBeCloseTo(target, 4);
    });

    it('clamps the aim to the playable span', () => {
        const spawner = new FallerSpawner({ level, random: () => 0.5 });
        const faller = spawner.spawn(-500);

        expect(faller.position.x).toBeGreaterThanOrEqual(level.grid.left);
    });

    it('still spawns somewhere valid without an aim point', () => {
        const spawner = new FallerSpawner({ level, random: () => 0.9 });
        const faller = spawner.spawn();

        expect(faller.position.x).toBeGreaterThanOrEqual(level.grid.left);
        expect(faller.position.x + faller.size).toBeLessThanOrEqual(level.playRight + 1);
    });

    it('accelerates towards the configured ceiling', () => {
        const spawner = new FallerSpawner({ level, random: () => 0.5 });

        for (let step = 0; step < 200; step++) {
            spawner.accelerate();
        }

        expect(spawner.speed).toBe(DUNGEON_DROP.drop.maxSpeed);
    });

    it('shortens the interval as the speed grows', () => {
        const spawner = new FallerSpawner({ level, random: () => 0.5 });
        const slow = spawner.interval;

        spawner.accelerate();
        spawner.accelerate();

        expect(spawner.interval).toBeLessThan(slow);
    });

    it('resets the speed and the timer', () => {
        const spawner = new FallerSpawner({ level, random: () => 0.5 });
        spawner.accelerate();
        spawner.update(1);
        spawner.reset();

        expect(spawner.speed).toBe(DUNGEON_DROP.drop.baseSpeed);
        expect(spawner.update(0.01)).toBeNull();
    });
});
