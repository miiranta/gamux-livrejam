import type { DungeonLevel } from './dungeon-level';

const TORCH_ROW_RATIOS = [0.22, 0.58];
const BANNER_ROW_COUNT = 2;
const PROP_KINDS = ['crate', 'rubble', 'barrel'] as const;
const PROP_STRIDE = 5;
const PROP_INSET = 2;

export interface WallTile {
    column: number;
    row: number;
}

export interface FloorTile {
    column: number;
    row: number;
}

export interface TorchPlacement {
    column: number;
    row: number;
    facing: -1 | 1;
}

export interface ArchTile {
    column: number;
    row: number;
    connectedBelow: boolean;
}

export type PropKind = (typeof PROP_KINDS)[number];

export interface PropPlacement {
    column: number;
    row: number;
    kind: PropKind;
}

export interface DecorationPlan {
    walls: WallTile[];
    floors: FloorTile[];
    torches: TorchPlacement[];
    ceiling: WallTile[];
    arch: ArchTile[];
    banners: WallTile[];
    props: PropPlacement[];
}

export function planDecorations(level: DungeonLevel): DecorationPlan {
    const { grid, floorTop } = level;
    const floorRow = grid.rowAt(floorTop);
    const thickness = grid.columnAt(level.playLeft);

    return {
        walls: planWalls(level, floorRow, thickness),
        floors: planFloors(level, floorRow, thickness),
        torches: planTorches(level, floorRow, thickness),
        ceiling: planCeiling(level, thickness),
        arch: planArch(level, floorRow, thickness),
        banners: planBanners(level, thickness),
        props: planProps(level, floorRow, thickness),
    };
}

function planWalls(level: DungeonLevel, floorRow: number, thickness: number): WallTile[] {
    const { grid } = level;
    const walls: WallTile[] = [];

    for (let row = 0; row < floorRow; row++) {
        for (const column of [thickness - 1, grid.columns - thickness]) {
            walls.push({ column, row });
        }
    }

    return walls;
}

function planFloors(level: DungeonLevel, floorRow: number, thickness: number): FloorTile[] {
    const { grid } = level;
    const floors: FloorTile[] = [];

    for (let column = thickness; column < grid.columns - thickness; column++) {
        floors.push({ column, row: floorRow });
    }

    return floors;
}

function planCeiling(level: DungeonLevel, thickness: number): WallTile[] {
    const { grid } = level;
    const rows = Math.min(level.ceilingRows, Math.max(0, grid.rowAt(level.floorTop) - 1));
    const tiles: WallTile[] = [];

    for (let row = 0; row < rows; row++) {
        for (let column = thickness; column < grid.columns - thickness; column++) {
            tiles.push({ column, row });
        }
    }

    return tiles;
}

function planArch(level: DungeonLevel, floorRow: number, thickness: number): ArchTile[] {
    const { grid } = level;
    const tiles: ArchTile[] = [];

    for (let row = 0; row < floorRow; row++) {
        for (const column of [thickness - 1, grid.columns - thickness]) {
            tiles.push({
                column,
                row,
                connectedBelow: level.solid.has(`${column},${row + 1}`),
            });
        }
    }

    return tiles;
}

function planBanners(level: DungeonLevel, thickness: number): WallTile[] {
    const { grid } = level;
    const floorRow = grid.rowAt(level.floorTop);
    const top = Math.max(level.ceilingRows + 1, 1);
    const span = Math.max(1, floorRow - top - 2);
    const step = Math.max(1, Math.floor(span / (BANNER_ROW_COUNT + 1)));
    const tiles: WallTile[] = [];

    for (let index = 1; index <= BANNER_ROW_COUNT; index++) {
        const row = top + step * index;

        if (row >= floorRow - 1) {
            continue;
        }

        tiles.push({ column: thickness - 1, row });
        tiles.push({ column: grid.columns - thickness, row });
    }

    return tiles;
}

function planProps(level: DungeonLevel, floorRow: number, thickness: number): PropPlacement[] {
    const { grid } = level;
    const props: PropPlacement[] = [];
    const behind = floorRow - 1;

    for (const [side, start] of [
        [1, thickness + PROP_INSET],
        [-1, grid.columns - thickness - PROP_INSET - 1],
    ] as const) {
        void side;

        for (let index = 0; index < 2; index++) {
            const column = start + index * PROP_STRIDE;

            if (column <= thickness || column >= grid.columns - thickness) {
                continue;
            }

            props.push({
                column,
                row: behind,
                kind: PROP_KINDS[(index + (side > 0 ? 0 : 1)) % PROP_KINDS.length],
            });
        }
    }

    return props;
}

function planTorches(level: DungeonLevel, floorRow: number, thickness: number): TorchPlacement[] {
    const { grid } = level;
    const left = thickness - 1;
    const right = grid.columns - thickness;
    const placements: TorchPlacement[] = [];
    const lowest = Math.max(level.ceilingRows + 1, 2);
    const highest = floorRow - 2;

    for (const ratio of TORCH_ROW_RATIOS) {
        const row = Math.min(highest, Math.max(lowest, Math.round(floorRow * ratio)));

        placements.push({ column: left, row, facing: 1 });
        placements.push({ column: right, row, facing: -1 });
    }

    return placements;
}