import type { SolidBox } from '../../engine/physics';
import { solidBox } from '../../engine/physics';
import { TileGrid } from '../../engine/level';
import type { TileSpriteKey } from '../assets';
import { DUNGEON_DROP } from '../config';

export interface TilePlacement {
    column: number;
    row: number;
    kind: TileSpriteKey;
}

export interface DungeonLevel {
    grid: TileGrid;
    tiles: TilePlacement[];
    colliders: SolidBox[];
    floorTop: number;
    playLeft: number;
    playRight: number;
    spawnY: number;
    despawnY: number;
}

const LAYER_WALL = 1;
const LAYER_FLOOR = 2;

export function createDungeonLevel(): DungeonLevel {
    const { size, scale, columns, rows, wallThickness, floorThickness } = DUNGEON_DROP.tile;
    const grid = new TileGrid({ columns, rows, tileSize: size * scale });
    const floorRow = rows - floorThickness;
    const tiles: TilePlacement[] = [];
    const solid = new Set<string>();

    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
            const isWall = column < wallThickness || column >= columns - wallThickness;
            const isFloor = row >= floorRow;

            if (isWall) {
                tiles.push({ column, row, kind: 'wall' });
                solid.add(`${column},${row}`);
            } else if (isFloor) {
                tiles.push({ column, row, kind: 'floor' });
                solid.add(`${column},${row}`);
            }
        }
    }

    const floorTop = grid.rowY(floorRow);

    return {
        grid,
        tiles,
        colliders: mergeColliders(
            solid,
            columns,
            rows,
            grid.tileSize,
            LAYER_WALL,
            LAYER_FLOOR,
            floorRow,
        ),
        floorTop,
        playLeft: grid.columnX(wallThickness),
        playRight: grid.columnX(columns - wallThickness),
        spawnY: grid.top + DUNGEON_DROP.faller.spawnHeight,
        despawnY: grid.bottom + DUNGEON_DROP.faller.despawnBelow,
    };
}

function mergeColliders(
    solid: Set<string>,
    columns: number,
    rows: number,
    tileSize: number,
    wallLayer: number,
    floorLayer: number,
    floorRow: number,
): SolidBox[] {
    const colliders: SolidBox[] = [];

    for (let row = 0; row < rows; row++) {
        let runStart = -1;

        for (let column = 0; column <= columns; column++) {
            const isSolid = column < columns && solid.has(`${column},${row}`);

            if (isSolid && runStart === -1) {
                runStart = column;
            } else if (!isSolid && runStart !== -1) {
                colliders.push(
                    solidBox(
                        {
                            x: runStart * tileSize,
                            y: row * tileSize,
                            width: (column - runStart) * tileSize,
                            height: tileSize,
                        },
                        row >= floorRow ? floorLayer : wallLayer,
                    ),
                );
                runStart = -1;
            }
        }
    }

    return colliders;
}
