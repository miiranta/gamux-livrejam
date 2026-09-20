import { describe, expect, it } from 'vitest';

import {
    NEIGHBOUR_EAST,
    NEIGHBOUR_NORTH,
    NEIGHBOUR_SOUTH,
    NEIGHBOUR_WEST,
    autotileFrame,
    neighbourMask,
    planAutotiles,
    resolveAutotile,
    type AutotileSet,
} from './autotile';

const SET: AutotileSet = {
    columns: 17,
    rows: 5,
    maskToIndex: {
        15: 6,
        14: 1,
        13: 19,
        11: 35,
        7: 17,
        12: 2,
        6: 0,
        3: 36,
        9: 34,
        10: 1,
        5: 6,
        8: 17,
        4: 35,
        2: 19,
        1: 1,
        0: 6,
    },
};

function solidFrom(cells: readonly [number, number][]): (c: number, r: number) => boolean {
    const set = new Set(cells.map(([c, r]) => `${c},${r}`));

    return (column, row) => set.has(`${column},${row}`);
}

describe('neighbourMask', () => {
    it('sets one bit per solid orthogonal neighbour', () => {
        const isSolid = solidFrom([
            [1, 0],
            [2, 1],
            [1, 2],
            [0, 1],
        ]);

        expect(neighbourMask(1, 1, isSolid)).toBe(
            NEIGHBOUR_NORTH | NEIGHBOUR_EAST | NEIGHBOUR_SOUTH | NEIGHBOUR_WEST,
        );
    });

    it('ignores diagonal neighbours', () => {
        const isSolid = solidFrom([
            [0, 0],
            [2, 0],
            [0, 2],
            [2, 2],
        ]);

        expect(neighbourMask(1, 1, isSolid)).toBe(0);
    });

    it('reports an isolated tile as mask zero', () => {
        expect(neighbourMask(5, 5, () => false)).toBe(0);
    });
});

describe('resolveAutotile', () => {
    it('maps every mask to a variant that exists on the sheet', () => {
        const masks = Object.keys(SET.maskToIndex).map(Number);
        const total = SET.columns * SET.rows;

        for (const mask of masks) {
            const index = resolveAutotile(SET, mask);

            expect(index).toBeGreaterThanOrEqual(0);
            expect(index).toBeLessThan(total);
        }
    });

    it('reuses variants where the sheet has no dedicated art', () => {
        expect(resolveAutotile(SET, 15)).toBe(resolveAutotile(SET, 5));
        expect(resolveAutotile(SET, 14)).toBe(resolveAutotile(SET, 1));
    });

    it('throws on a mask with no variant instead of drawing the wrong tile', () => {
        expect(() => resolveAutotile(SET, 0b1111_0000)).toThrow(/mascara de autotile/);
    });
});

describe('planAutotiles', () => {
    it('covers every solid cell exactly once', () => {
        const isSolid = solidFrom([
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
        ]);
        const cells = planAutotiles(4, 4, isSolid, SET);

        expect(cells).toHaveLength(4);
        expect(new Set(cells.map((cell) => `${cell.column},${cell.row}`)).size).toBe(4);
    });

    it('skips empty cells', () => {
        const cells = planAutotiles(3, 3, () => false, SET);

        expect(cells).toHaveLength(0);
    });

    it('gives a fully enclosed tile the interior variant', () => {
        const isSolid = solidFrom([
            [1, 0],
            [0, 1],
            [2, 1],
            [1, 2],
            [1, 1],
        ]);
        const cells = planAutotiles(3, 3, isSolid, SET);
        const centre = cells.find((cell) => cell.column === 1 && cell.row === 1);

        expect(centre?.index).toBe(SET.maskToIndex[15]);
    });

    it('gives a lone tile the isolated variant', () => {
        const isSolid = solidFrom([[1, 1]]);
        const cells = planAutotiles(3, 3, isSolid, SET);

        expect(cells[0].index).toBe(SET.maskToIndex[0]);
    });
});

describe('autotileFrame', () => {
    it('wraps the index into sheet coordinates', () => {
        expect(autotileFrame(0, SET)).toEqual({ column: 0, row: 0 });
        expect(autotileFrame(16, SET)).toEqual({ column: 16, row: 0 });
        expect(autotileFrame(17, SET)).toEqual({ column: 0, row: 1 });
        expect(autotileFrame(35, SET)).toEqual({ column: 1, row: 2 });
    });
});