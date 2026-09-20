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

    it('resolves one autotile variant per solid cell', () => {
        const solidCells = level.tiles.length;
        const solidCount = level.solid.size;

        expect(solidCells).toBe(solidCount);
        expect(new Set(level.tiles.map((tile) => `${tile.column},${tile.row}`)).size).toBe(solidCells);
    });

    it('uses the left-wall variant for a wall tile with a solid right side', () => {
        const leftEdge = level.tiles.find((tile) => tile.column === 0 && tile.row === 1);

        expect(leftEdge).toBeDefined();
        expect(leftEdge!.index).toBe(39);
    });

    it('uses the floor surface variant for the top of the floor slab', () => {
        const floorRow = level.grid.rowAt(level.floorTop);
        const surface = level.tiles.find((tile) => tile.column === 5 && tile.row === floorRow);

        expect(surface).toBeDefined();
        expect(surface!.index).toBe(97);
    });

    it('keeps the arena a solid U shape with no gaps in the floor', () => {
        const floorRow = level.grid.rowAt(level.floorTop);
        const thickness = level.grid.columnAt(level.playLeft);

        for (let column = thickness; column < level.grid.columns - thickness; column++) {
            expect(level.solid.has(`${column},${floorRow}`)).toBe(true);
        }
    });

    it('has no floating platforms inside the arena', () => {
        const floorRow = level.grid.rowAt(level.floorTop);
        const thickness = level.grid.columnAt(level.playLeft);

        for (let row = level.ceilingRows; row < floorRow; row++) {
            for (let column = thickness; column < level.grid.columns - thickness; column++) {
                expect(level.solid.has(`${column},${row}`)).toBe(false);
            }
        }
    });

});
