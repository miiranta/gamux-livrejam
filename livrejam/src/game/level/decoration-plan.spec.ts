import { describe, expect, it } from 'vitest';

import { planDecorations } from './decoration-plan';
import { createDungeonLevel } from './dungeon-level';

describe('planDecorations', () => {
    const level = createDungeonLevel();

    it('is deterministic across repeated plans', () => {
        const again = planDecorations(level);

        expect(again.ground).toEqual(level.decorations.ground);
        expect(again.struts).toEqual(level.decorations.struts);
    });

    it('keeps every planned piece inside the grid', () => {
        const { grid } = level;

        for (const piece of level.decorations.ground) {
            expect(piece.row).toBe(grid.rowAt(level.floorTop));
            expect(piece.column).toBeGreaterThanOrEqual(0);
            expect(piece.column).toBeLessThan(grid.columns);
        }

        for (const piece of level.decorations.struts) {
            expect(piece.row).toBeGreaterThanOrEqual(level.ceilingRows);
            expect(piece.row).toBeLessThan(grid.rowAt(level.floorTop));
            expect(piece.column).toBeGreaterThanOrEqual(-1);
            expect(piece.column).toBeLessThanOrEqual(grid.columns + 1);
        }
    });
});