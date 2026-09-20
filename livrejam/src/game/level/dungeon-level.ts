import type { SolidBox } from '../../engine/physics';
import { solidBox } from '../../engine/physics';
import { TileGrid } from '../../engine/level';
import type { AutotileCell } from '../../engine/level';
import { planAutotiles } from '../../engine/level';
import { TREASURE_HUNTERS_AUTOTILE } from '../assets';
import { FACE_SMASHING } from '../config';
import type { DecorationPlan } from './decoration-plan';
import { planDecorations } from './decoration-plan';

export interface DungeonLevel {
    grid: TileGrid;
    tiles: AutotileCell[];
    decorations: DecorationPlan;
    colliders: SolidBox[];
    solid: ReadonlySet<string>;
    ceilingRows: number;
    ceilingBottom: number;
    floorTop: number;
    playLeft: number;
    playRight: number;
    spawnY: number;
    despawnY: number;
}

const LAYER_WALL = 1;
const LAYER_FLOOR = 2;

export function createDungeonLevel(): DungeonLevel {
    const {
        size,
        scale,
        columns,
        rows,
        wallThickness,
        floorThickness,
        ceilingRows: ceilingHeight,
    } = FACE_SMASHING.tile;
    const grid = new TileGrid({ columns, rows, tileSize: size * scale });
    const floorRow = rows - floorThickness;
    const solid = new Set<string>();

    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
            const isWall = column < wallThickness || column >= columns - wallThickness;
            const isFloor = row >= floorRow;

            if (isWall || isFloor) {
                solid.add(`${column},${row}`);
            }
        }
    }

    const isSolid = (column: number, row: number): boolean => solid.has(`${column},${row}`);
    const floorTop = grid.rowY(floorRow);
    const ceilingRows = Math.min(ceilingHeight, Math.max(0, floorRow - 2));
    const ceilingBottom = grid.rowY(ceilingRows);

    const level: DungeonLevel = {
        grid,
        tiles: planAutotiles(columns, rows, isSolid, TREASURE_HUNTERS_AUTOTILE),
        decorations: { props: [], emitters: [] },
        colliders: mergeColliders(solid, columns, rows, grid.tileSize, floorRow),
        solid,
        ceilingRows,
        ceilingBottom,
        floorTop,
        playLeft: grid.columnX(wallThickness),
        playRight: grid.columnX(columns - wallThickness),
        spawnY: ceilingBottom + FACE_SMASHING.item.spawnHeight,
        despawnY: grid.bottom + FACE_SMASHING.item.despawnBelow,
    };

    level.decorations = planDecorations(level);

    return level;
}

function mergeColliders(
    solid: Set<string>,
    columns: number,
    rows: number,
    tileSize: number,
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
                        row >= floorRow ? LAYER_FLOOR : LAYER_WALL,
                    ),
                );
                runStart = -1;
            }
        }
    }

    return colliders;
}