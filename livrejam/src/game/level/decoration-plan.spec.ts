import { describe, expect, it } from 'vitest';

import { planDecorations } from './decoration-plan';
import { createDungeonLevel } from './dungeon-level';

describe('planDecorations', () => {
    const level = createDungeonLevel();

    it('places one torch per wall face at two heights', () => {
        const torches = level.decorations.torches;
        const rows = new Set(torches.map((torch) => torch.row));
        const columns = new Set(torches.map((torch) => torch.column));

        expect(torches.length).toBe(4);
        expect(rows.size).toBe(2);
        expect(columns.size).toBe(2);
    });

    it('mirrors left and right torches toward the arena centre', () => {
        const left = level.decorations.torches.filter((torch) => torch.facing === 1);
        const right = level.decorations.torches.filter((torch) => torch.facing === -1);

        expect(left.length).toBe(right.length);
        for (const torch of left) {
            expect(torch.column).toBeLessThan(level.grid.columns / 2);
        }
    });

    it('is deterministic across repeated plans', () => {
        const again = planDecorations(level);
        expect(again.walls).toEqual(level.decorations.walls);
        expect(again.floors).toEqual(level.decorations.floors);
    });


});