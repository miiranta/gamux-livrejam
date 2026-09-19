import type { Aabb } from '../physics';

/** Lado de um tile de origem, em pixels do asset (Kenney Tiny Dungeon). */
export const TILE_SOURCE_SIZE = 16;

/** Escala aplicada aos tiles no mundo. 2x deixa o tile com 32 unidades. */
export const TILE_SCALE = 2;

/** Lado de um tile no mundo, ja escalado. */
export const CELL_SIZE = TILE_SOURCE_SIZE * TILE_SCALE;

/**
 * Indices dos tiles usados, na tilesheet do Kenney Tiny Dungeon (12 colunas).
 * Os caminhos sao servidos a partir de `public/`, por isso o prefixo `assets/`.
 */
export const TILE = {
    wall: 'assets/tiles/kenney-tiny-dungeon/Tiles/tile_0057.png',
    floor: 'assets/tiles/kenney-tiny-dungeon/Tiles/tile_0048.png',
} as const;

export type TileKind = keyof typeof TILE;

export interface TilePlacement {
    column: number;
    row: number;
    kind: TileKind;
}

export interface RoomLayout {
    columns: number;
    rows: number;
    /** Colunas de parede em cada lateral. */
    wallThickness: number;
    /** Linhas de chao no rodape. */
    floorThickness: number;
}

export interface Room {
    layout: RoomLayout;
    width: number;
    height: number;
    tiles: TilePlacement[];
    /** Y onde o chao comeca: e onde ficam os pes do personagem. */
    floorTop: number;
    /** Caixas solidas usadas pela fisica. */
    colliders: Aabb[];
}

/**
 * Sala simples: paredes solidas nas laterais e um chao no rodape.
 * O vao central fica livre para o personagem andar.
 */
export function createRoom(layout: RoomLayout): Room {
    const { columns, rows, wallThickness, floorThickness } = layout;
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

    return {
        layout,
        width: columns * CELL_SIZE,
        height: rows * CELL_SIZE,
        tiles,
        floorTop: floorRow * CELL_SIZE,
        colliders: mergeColliders(solid, columns, rows),
    };
}

/**
 * Funde tiles solidos vizinhos na horizontal em uma unica caixa por linha,
 * reduzindo bastante o numero de AABBs testados por frame.
 */
function mergeColliders(
    solid: Set<string>,
    columns: number,
    rows: number,
): Aabb[] {
    const colliders: Aabb[] = [];

    for (let row = 0; row < rows; row++) {
        let runStart = -1;

        for (let column = 0; column <= columns; column++) {
            const isSolid = column < columns && solid.has(`${column},${row}`);

            if (isSolid && runStart === -1) {
                runStart = column;
            } else if (!isSolid && runStart !== -1) {
                colliders.push({
                    x: runStart * CELL_SIZE,
                    y: row * CELL_SIZE,
                    width: (column - runStart) * CELL_SIZE,
                    height: CELL_SIZE,
                });
                runStart = -1;
            }
        }
    }

    return colliders;
}