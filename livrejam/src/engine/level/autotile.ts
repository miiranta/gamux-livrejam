export const NEIGHBOUR_NORTH = 1;
export const NEIGHBOUR_EAST = 2;
export const NEIGHBOUR_SOUTH = 4;
export const NEIGHBOUR_WEST = 8;

export type NeighbourMask = number;

export interface AutotileSet {
    readonly columns: number;
    readonly rows: number;
    readonly maskToIndex: Readonly<Record<NeighbourMask, number>>;
}

export interface AutotileCell {
    column: number;
    row: number;
    index: number;
}

export function neighbourMask(
    column: number,
    row: number,
    isSolid: (column: number, row: number) => boolean,
): NeighbourMask {
    let mask = 0;

    if (isSolid(column, row - 1)) {
        mask |= NEIGHBOUR_NORTH;
    }

    if (isSolid(column + 1, row)) {
        mask |= NEIGHBOUR_EAST;
    }

    if (isSolid(column, row + 1)) {
        mask |= NEIGHBOUR_SOUTH;
    }

    if (isSolid(column - 1, row)) {
        mask |= NEIGHBOUR_WEST;
    }

    return mask;
}

export function resolveAutotile(set: AutotileSet, mask: NeighbourMask): number {
    const index = set.maskToIndex[mask];

    if (index === undefined) {
        throw new Error(`mascara de autotile sem variante: ${mask}`);
    }

    return index;
}

export function planAutotiles(
    columns: number,
    rows: number,
    isSolid: (column: number, row: number) => boolean,
    set: AutotileSet,
): AutotileCell[] {
    const cells: AutotileCell[] = [];

    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
            if (!isSolid(column, row)) {
                continue;
            }

            cells.push({
                column,
                row,
                index: resolveAutotile(set, neighbourMask(column, row, isSolid)),
            });
        }
    }

    return cells;
}

export function autotileFrame(index: number, set: AutotileSet): { column: number; row: number } {
    return { column: index % set.columns, row: Math.floor(index / set.columns) };
}