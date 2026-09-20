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

    it('reaches past the play area so no seam shows at the arena border', () => {
        const ground = level.decorations.ground;
        const first = level.grid.columnAt(level.playLeft) - 1;
        const last = level.grid.columnAt(level.playRight);

        expect(ground[0].column).toBe(first);
        expect(ground[ground.length - 1].column).toBe(last);
    });

    it('leaves vertical gaps in the struts so they do not read as a solid wall', () => {
        const columns = new Set(level.decorations.struts.map((piece) => piece.column));
        const floorRow = level.grid.rowAt(level.floorTop);

        expect(columns.size).toBeGreaterThan(0);
        for (const column of columns) {
            const rows = level.decorations.struts.filter((piece) => piece.column === column);

            expect(rows.length).toBeLessThan(floorRow - level.ceilingRows);
        }
    });

});
