import type { Point2D } from '../math';

export interface CameraOptions {
    scale: number;
    viewportWidth: number;
    viewportHeight: number;
    anchor?: Point2D;
}

export class Camera {
    scale: number;
    viewportWidth: number;
    viewportHeight: number;
    anchor: Point2D;

    constructor(options: CameraOptions) {
        this.scale = options.scale;
        this.viewportWidth = options.viewportWidth;
        this.viewportHeight = options.viewportHeight;
        this.anchor = options.anchor ?? { x: 0, y: 0 };
    }

    resize(viewportWidth: number, viewportHeight: number): void {
        this.viewportWidth = viewportWidth;
        this.viewportHeight = viewportHeight;
    }

    toScreenX(worldX: number): number {
        return Math.round(worldX * this.scale);
    }

    toScreenY(worldY: number): number {
        return Math.round(worldY * this.scale);
    }

    toScreenLength(worldLength: number): number {
        return Math.round(worldLength * this.scale);
    }
}
