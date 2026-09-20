export const FACING_ROW = { up: 0, left: 1, down: 2, right: 3 } as const;

export type Facing = keyof typeof FACING_ROW;

export function facingRow(facing: Facing): number {
    return FACING_ROW[facing];
}
