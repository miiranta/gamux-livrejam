import type { Camera } from './camera';
import type { SpriteSheet } from './images';
import { Screen, type ScreenOptions } from './screen';

export class CanvasRenderer {
    readonly context: CanvasRenderingContext2D;
    private readonly screen: Screen;

    constructor(
        display: HTMLCanvasElement,
        readonly camera: Camera,
        options: ScreenOptions,
    ) {
        this.screen = new Screen(display, options);

        const context = this.screen.surface.getContext('2d', { alpha: false });
        if (!context) {
            throw new Error('Canvas 2D nao esta disponivel neste navegador.');
        }

        this.context = context;
        this.context.imageSmoothingEnabled = false;
    }

    get width(): number {
        return this.screen.surface.width;
    }

    get height(): number {
        return this.screen.surface.height;
    }

    get isShaderBacked(): boolean {
        return this.screen.isShaderBacked;
    }

    resize(width: number, height: number): void {
        if (this.screen.surface.width === width && this.screen.surface.height === height) {
            return;
        }

        this.screen.resize(width, height);
        this.context.imageSmoothingEnabled = false;
        this.camera.resize(width, height);
    }

    clear(color: string): void {
        this.context.fillStyle = color;
        this.context.fillRect(0, 0, this.width, this.height);
    }

    present(deltaSeconds: number): void {
        this.context.imageSmoothingEnabled = false;
        this.screen.present(deltaSeconds);
    }

    get isReady(): boolean {
        return this.width > 0 && this.height > 0;
    }
}

export interface SpriteDrawOptions {
    column: number;
    row: number;
    worldX: number;
    worldY: number;
    width: number;
    height: number;
    tint?: string;
}

let tintBuffer: HTMLCanvasElement | null = null;
let tintContext: CanvasRenderingContext2D | null = null;

function acquireTintContext(): CanvasRenderingContext2D | null {
    if (!tintBuffer) {
        tintBuffer = document.createElement('canvas');
        tintContext = tintBuffer.getContext('2d');
    }

    return tintContext;
}

export function drawSheetSprite(
    ctx: CanvasRenderingContext2D,
    sheet: SpriteSheet,
    camera: Camera,
    options: SpriteDrawOptions,
): void {
    const sourceX = options.column * sheet.frameSize;
    const sourceY = options.row * sheet.frameSize;
    const x = camera.toScreenX(options.worldX);
    const y = camera.toScreenY(options.worldY);
    const width = camera.toScreenLength(options.width);
    const height = camera.toScreenLength(options.height);
    const scratch = options.tint ? acquireTintContext() : null;

    if (!scratch || !options.tint || !tintBuffer) {
        ctx.drawImage(
            sheet.image,
            sourceX,
            sourceY,
            sheet.frameSize,
            sheet.frameSize,
            x,
            y,
            width,
            height,
        );
        return;
    }

    tintBuffer.width = Math.max(1, Math.round(width));
    tintBuffer.height = Math.max(1, Math.round(height));
    scratch.clearRect(0, 0, tintBuffer.width, tintBuffer.height);
    scratch.imageSmoothingEnabled = false;
    scratch.drawImage(
        sheet.image,
        sourceX,
        sourceY,
        sheet.frameSize,
        sheet.frameSize,
        0,
        0,
        tintBuffer.width,
        tintBuffer.height,
    );
    scratch.globalCompositeOperation = 'source-atop';
    scratch.fillStyle = options.tint;
    scratch.fillRect(0, 0, tintBuffer.width, tintBuffer.height);
    scratch.globalCompositeOperation = 'source-over';

    ctx.drawImage(tintBuffer, x, y, width, height);
}

export function drawTiledSprite(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement | HTMLCanvasElement,
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