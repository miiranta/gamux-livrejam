import { valueNoise } from '../../engine/math';
import type { CeilingKey, GroundKey, StrutKey } from '../assets';
import type { DungeonLevel } from './dungeon-level';

const GROUND_KINDS: readonly GroundKey[] = ['stone', 'grate', 'plate', 'rubble', 'cobble'];
const GROUND_WEIGHTS = [31, 22, 17, 16, 14];
const CEILING_KINDS: readonly CeilingKey[] = ['panel', 'slab', 'lattice', 'girder'];
const CEILING_WEIGHTS = [42, 31, 15, 12];
const STRUT_KINDS: readonly StrutKey[] = ['pillar', 'segment', 'capital', 'pier'];
const STRUT_WEIGHTS = [36, 26, 22, 16];

const GROUND_KIND_SEED = 0x9e3779b1;
const GROUND_SPILL_SEED = 0x7ed55d16;
const CEILING_KIND_SEED = 0x1b873593;
const CEILING_SHADE_SEED = 0x5bf03635;
const STRUT_KIND_SEED = 0x2f1a9c3d;
const STRUT_PLACE_SEED = 0x6d2b79f5;
const STRUT_RUN_SEED = 0x3c6ef372;

const STRUT_STRIDE = 3;
const STRUT_MARGIN = 1;
const STRUT_CHANCE = 0.42;
const STRUT_GAP_MIN = 1;
const STRUT_GAP_MAX = 4;
const STRUT_RUN_MIN = 3;
const STRUT_RUN_MAX = 8;
const CEILING_LIT_ROWS = 1;

export interface GroundPiece {
    column: number;
    row: number;
    kind: GroundKey;
    spill: GroundKey;
}

export interface CeilingPiece {
    column: number;
    row: number;
    kind: CeilingKey;
}

export interface StrutPiece {
    column: number;
    row: number;
    kind: StrutKey;
}

export interface DecorationPlan {
    ceiling: CeilingPiece[];
    ground: GroundPiece[];
    struts: StrutPiece[];
}

export function planDecorations(level: DungeonLevel): DecorationPlan {
    const { grid, floorTop } = level;
    const floorRow = grid.rowAt(floorTop);
    const thickness = grid.columnAt(level.playLeft);

    return {
        ceiling: planCeiling(level, thickness),
        ground: planGround(level, floorRow, thickness),
        struts: planStruts(level, floorRow),
    };
}

function planGround(level: DungeonLevel, floorRow: number, thickness: number): GroundPiece[] {
    const { grid } = level;
    const pieces: GroundPiece[] = [];
    const first = thickness - 1;
    const last = grid.columns - thickness;

    for (let column = first; column <= last; column++) {
        pieces.push({
            column,
            row: floorRow,
            kind: pick(GROUND_KINDS, GROUND_WEIGHTS, column, floorRow, GROUND_KIND_SEED),
            spill: pick(GROUND_KINDS, GROUND_WEIGHTS, column, floorRow, GROUND_SPILL_SEED),
        });
    }

    return pieces;
}

function planCeiling(level: DungeonLevel, thickness: number): CeilingPiece[] {
    const { grid } = level;
    const rows = Math.min(level.ceilingRows, Math.max(0, grid.rowAt(level.floorTop) - 1));
    const pieces: CeilingPiece[] = [];
    const first = thickness - 1;
    const last = grid.columns - thickness;

    for (let row = 0; row < rows; row++) {
        const seed = row < CEILING_LIT_ROWS ? CEILING_KIND_SEED : CEILING_SHADE_SEED;

        for (let column = first; column <= last; column++) {
            pieces.push({
                column,
                row,
                kind: pick(CEILING_KINDS, CEILING_WEIGHTS, column, row, seed),
            });
        }
    }

    return pieces;
}

function planStruts(level: DungeonLevel, floorRow: number): StrutPiece[] {
    const { grid } = level;
    const pieces: StrutPiece[] = [];
    const first = -STRUT_MARGIN;
    const last = grid.columns + STRUT_MARGIN;
    const top = level.ceilingRows;
    const span = Math.max(1, floorRow - top);
    let column = first;

    while (column <= last) {
        const present = valueNoise(column, 1, STRUT_PLACE_SEED) < STRUT_CHANCE;

        if (!present) {
            column +=
                STRUT_GAP_MIN +
                Math.floor(valueNoise(column, 2, STRUT_PLACE_SEED) * (STRUT_GAP_MAX - STRUT_GAP_MIN + 1));
            continue;
        }

        const kind = pick(STRUT_KINDS, STRUT_WEIGHTS, column, 0, STRUT_KIND_SEED);
        const run =
            STRUT_RUN_MIN +
            Math.floor(valueNoise(column, 3, STRUT_RUN_SEED) * (STRUT_RUN_MAX - STRUT_RUN_MIN + 1));
        const height = Math.min(run, span);
        const offset = Math.floor(valueNoise(column, 4, STRUT_RUN_SEED) * Math.max(1, span - height + 1));
        const start = top + offset;

        for (let row = start; row < start + height; row++) {
            pieces.push({ column, row, kind });
        }

        column += 1;
    }

    return pieces;
}

function pick<TKey extends string>(
    kinds: readonly TKey[],
    weights: readonly number[],
    column: number,
    row: number,
    seed: number,
): TKey {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let threshold = valueNoise(column, row, seed) * total;

    for (let index = 0; index < kinds.length; index++) {
        threshold -= weights[index];
        if (threshold <= 0) {
            return kinds[index];
        }
    }

    return kinds[kinds.length - 1];
}