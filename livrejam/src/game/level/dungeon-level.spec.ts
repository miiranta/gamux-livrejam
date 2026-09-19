import { describe, expect, it } from 'vitest';

import { createDungeonLevel } from './dungeon-level';

describe('createDungeonLevel', () => {
    const level = createDungeonLevel();

    it('uses the configured tile grid', () => {
        expect(level.grid.columns).toBe(20);
        expect(level.grid.rows).toBe(12);
        expect(level.grid.width).toBe(640);
        expect(level.grid.height).toBe(384);
    });

    it('places the floor on the last row', () => {
        expect(level.floorTop).toBe(352);
        expect(level.grid.bottom - level.floorTop).toBe(32);
    });

    it('keeps the playable span between the walls', () => {
        expect(level.playLeft).toBe(64);
        expect(level.playRight).toBe(576);
    });

    it('tags wall colliders and floor colliders with different layers', () => {
        const layers = new Set(level.colliders.map((collider) => collider.layer));
        expect(layers.size).toBeGreaterThan(1);
    });

    it('merges neighbouring solid tiles to keep the collider count low', () => {
        expect(level.colliders.length).toBeLessThan(level.grid.rows * level.grid.columns);
    });

    it('spawns above the ceiling and despawns below the floor', () => {
        expect(level.spawnY).toBeGreaterThanOrEqual(0);
        expect(level.despawnY).toBeGreaterThan(level.grid.bottom);
    });

    it('places decorative props on both inner wall faces', () => {
        const left = level.grid.columnAt(level.playLeft) - 1;
        const right = level.grid.columnAt(level.playRight);
        const columns = new Set(level.decorations.torches.map((torch) => torch.column));

        expect(level.decorations.torches.length).toBeGreaterThan(0);
        expect(columns.has(left)).toBe(true);
        expect(columns.has(right)).toBe(true);
    });

    it('keeps every torch clear of the floor row', () => {
        const floorRow = level.grid.rowAt(level.floorTop);

        for (const torch of level.decorations.torches) {
            expect(torch.row).toBeLessThan(floorRow);
        }
    });


    it('covers the same wall and floor footprint as the solid grid', () => {
        const floorRow = level.grid.rowAt(level.floorTop);
        const wallThickness = level.grid.columnAt(level.playLeft);
        const walls = level.decorations.walls.length;
        const floors = level.decorations.floors.length;

        expect(walls).toBe(level.grid.columns * 0 + wallThickness * 2 * floorRow);
        expect(floors).toBe(level.grid.columns - wallThickness * 2);
    });

});
