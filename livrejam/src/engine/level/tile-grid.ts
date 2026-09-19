import type { Aabb } from '../physics';

export interface TileGridOptions {
    columns: number;
    rows: number;
    tileSize: number;
    originX?: number;
    originY?: number;
}

export interface TileRange {
    firstColumn: number;
    lastColumn: number;
    firstRow: number;
    lastRow: number;
}

export class TileGrid {
    readonly columns: number;
    readonly rows: number;
    readonly tileSize: number;
    readonly originX: number;
    readonly originY: number;

    constructor(options: TileGridOptions) {
        this.columns = options.columns;
        this.rows = options.rows;
        this.tileSize = options.tileSize;
        this.originX = options.originX ?? 0;
        this.originY = options.originY ?? 0;
    }

    get width(): number {
        return this.columns * this.tileSize;
    }

    get height(): number {
        return this.rows * this.tileSize;
    }

    get left(): number {
        return this.originX;
    }

    get right(): number {
        return this.originX + this.width;
    }

    get top(): number {
        return this.originY;
    }

    get bottom(): number {
        return this.originY + this.height;
    }

    columnAt(worldX: number): number {
        return Math.floor((worldX - this.originX) / this.tileSize);
    }

    rowAt(worldY: number): number {
        return Math.floor((worldY - this.originY) / this.tileSize);
    }

    columnX(column: number): number {
        return this.originX + column * this.tileSize;
    }

    rowY(row: number): number {
        return this.originY + row * this.tileSize;
    }

    clampX(worldX: number): number {
        return Math.min(Math.max(worldX, this.left), this.right);
    }

    clampY(worldY: number): number {
        return Math.min(Math.max(worldY, this.top), this.bottom);
    }

    rangeFor(box: Aabb): TileRange {
        return {
            firstColumn: this.columnAt(box.x),
            lastColumn: this.columnAt(box.x + box.width - Number.EPSILON),
            firstRow: this.rowAt(box.y),
            lastRow: this.rowAt(box.y + box.height - Number.EPSILON),
        };
    }

    clipBox(box: Aabb): Aabb | null {
        const left = Math.max(box.x, this.left);
        const top = Math.max(box.y, this.top);
        const right = Math.min(box.x + box.width, this.right);
        const bottom = Math.min(box.y + box.height, this.bottom);

        if (right <= left || bottom <= top) {
            return null;
        }

        return { x: left, y: top, width: right - left, height: bottom - top };
    }
}
