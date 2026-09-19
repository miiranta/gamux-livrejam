import type { Camera } from './camera';
import type { SpriteSheet } from './images';

export class CanvasRenderer {
    readonly context: CanvasRenderingContext2D;

    constructor(
        private readonly canvas: HTMLCanvasElement,
        readonly camera: Camera,
    ) {
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) {
            throw new Error('Canvas 2D nao esta disponivel neste navegador.');
        }
        this.context = context;
        this.context.imageSmoothingEnabled = false;
    }

    get width(): number {
        return this.canvas.width;
    }

    get height(): number {
        return this.canvas.height;
    }

    resize(width: number, height: number): void {
        if (this.canvas.width === width && this.canvas.height === height) {
            return;
        }
        this.canvas.width = width;
        this.canvas.height = height;
        this.context.imageSmoothingEnabled = false;
        this.camera.resize(width, height);
    }

    clear(color: string): void {
        this.context.fillStyle = color;
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    present(): void {
        this.context.imageSmoothingEnabled = false;
    }

    get isReady(): boolean {
        return this.canvas.width > 0 && this.canvas.height > 0;
    }
}

export interface SpriteDrawOptions {
    column: number;
    row: number;
    worldX: number;
    worldY: number;
    width: number;
    height: number;
}

export function drawSheetSprite(
    ctx: CanvasRenderingContext2D,
    sheet: SpriteSheet,
    camera: Camera,
    options: SpriteDrawOptions,
): void {
    ctx.drawImage(
        sheet.image,
        options.column * sheet.frameSize,
        options.row * sheet.frameSize,
        sheet.frameSize,
        sheet.frameSize,
        camera.toScreenX(options.worldX),
        camera.toScreenY(options.worldY),
        camera.toScreenLength(options.width),
        camera.toScreenLength(options.height),
    );
}

export function drawTiledSprite(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    camera: Camera,
    worldX: number,
    worldY: number,
    worldSize: number,
): void {
    ctx.drawImage(
        image,
        camera.toScreenX(worldX),
        camera.toScreenY(worldY),
        camera.toScreenLength(worldSize),
        camera.toScreenLength(worldSize),
    );
}
