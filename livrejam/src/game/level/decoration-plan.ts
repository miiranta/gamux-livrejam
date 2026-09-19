import type { DungeonLevel } from './dungeon-level';

const TORCH_ROW_RATIOS = [0.22, 0.58];

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

export interface DecorationPlan {
    walls: WallTile[];
    floors: FloorTile[];
    torches: TorchPlacement[];
}

export function planDecorations(level: DungeonLevel): DecorationPlan {
    const { grid, playLeft, playRight, floorTop } = level;
    const floorRow = grid.rowAt(floorTop);

    return {
        walls: planWalls(level, floorRow),
        floors: planFloors(grid.columnAt(playLeft), grid.columnAt(playRight), floorRow),
        torches: planTorches(level, floorRow),
    };
}

function planWalls(level: DungeonLevel, floorRow: number): WallTile[] {
    const { grid } = level;
    const thickness = grid.columnAt(level.playLeft);
    const walls: WallTile[] = [];

    for (let offset = 0; offset < thickness; offset++) {
        for (const column of [offset, grid.columns - 1 - offset]) {
            for (let row = 0; row < floorRow; row++) {
                walls.push({ column, row });
            }
        }
    }

    return walls;
}

function planFloors(first: number, last: number, row: number): FloorTile[] {
    const floors: FloorTile[] = [];

    for (let column = first; column < last; column++) {
        floors.push({ column, row });
    }

    return floors;
}

function planTorches(level: DungeonLevel, floorRow: number): TorchPlacement[] {
    const { grid } = level;
    const thickness = grid.columnAt(level.playLeft);
    const left = thickness - 1;
    const right = grid.columns - thickness;
    const placements: TorchPlacement[] = [];

    for (const ratio of TORCH_ROW_RATIOS) {
        const row = Math.min(floorRow - 1, Math.max(1, Math.round(floorRow * ratio)));
        placements.push({ column: left, row, facing: 1 });
        placements.push({ column: right, row, facing: -1 });
    }

    return placements;
}