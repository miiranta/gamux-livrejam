import { applyRamp, type Camera, type GradientRamp } from '../../engine/render';
import type { DungeonLevel } from '../level';

const WALL_RAMP: GradientRamp = [
    { luminance: 0.0, color: [10, 7, 5] },
    { luminance: 0.26, color: [34, 21, 17] },
    { luminance: 0.5, color: [70, 43, 35] },
    { luminance: 0.72, color: [108, 73, 55] },
    { luminance: 0.9, color: [136, 99, 72] },
    { luminance: 1.0, color: [150, 114, 84] },
];

const TEXEL_SCALE = 0.55;
const WALL_ALPHA = 0.78;
const BLACKOUT = 'rgba(7, 6, 5, 1)';
const BLACKOUT_CLEAR = 'rgba(7, 6, 5, 0)';
const SHADE = 'rgba(7, 6, 5, 0.72)';
const SHADE_CLEAR = 'rgba(7, 6, 5, 0)';

export class BackdropPainter {
    private texture: HTMLCanvasElement | null = null;

    constructor(private readonly image: HTMLImageElement) {}

    paint(ctx: CanvasRenderingContext2D, level: DungeonLevel, camera: Camera): void {
        const left = camera.toScreenX(level.playLeft);
        const top = camera.toScreenY(level.ceilingBottom);
        const width = camera.toScreenX(level.playRight) - left;
        const height = camera.toScreenY(level.floorTop) - top;

        if (width <= 0 || height <= 0) {
            return;
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(left, top, width, height);
        ctx.clip();
        this.paintMasonry(ctx, left, top, width, height);
        this.paintDepth(ctx, left, top, width, height);
        ctx.restore();
    }

    private paintMasonry(
        ctx: CanvasRenderingContext2D,
        left: number,
        top: number,
        width: number,
        height: number,
    ): void {
        const texture = this.texture ?? (this.texture = applyRamp(this.image, WALL_RAMP));
        const cellWidth = Math.max(1, Math.round(texture.width * TEXEL_SCALE));
        const cellHeight = Math.max(1, Math.round(texture.height * TEXEL_SCALE));
        const right = Math.round(left + width);
        const bottom = Math.round(top + height);
        const rows = Math.ceil((bottom - Math.round(top)) / cellHeight);

        ctx.save();
        ctx.globalAlpha = WALL_ALPHA;
        ctx.imageSmoothingEnabled = false;

        for (let row = 0; row < rows; row++) {
            const offset = row % 2 === 0 ? 0 : -Math.round(cellWidth / 2);
            let x = Math.round(left) - cellWidth + offset;

            while (x < right) {
                ctx.drawImage(
                    texture,
                    x,
                    Math.round(top) + row * cellHeight - Math.round(cellHeight / 2),
                    cellWidth,
                    cellHeight,
                );
                x += cellWidth;
            }
        }

        ctx.restore();
    }

    private paintDepth(
        ctx: CanvasRenderingContext2D,
        left: number,
        top: number,
        width: number,
        height: number,
    ): void {
        const vertical = ctx.createLinearGradient(0, top, 0, top + height);
        vertical.addColorStop(0, BLACKOUT);
        vertical.addColorStop(0.167, BLACKOUT);
        vertical.addColorStop(0.45, BLACKOUT_CLEAR);
        vertical.addColorStop(1, 'rgba(7, 6, 5, 0.44)');
        ctx.fillStyle = vertical;
        ctx.fillRect(left, top, width, height);

        const horizontal = ctx.createLinearGradient(left, 0, left + width, 0);
        horizontal.addColorStop(0, SHADE);
        horizontal.addColorStop(0.24, SHADE_CLEAR);
        horizontal.addColorStop(0.76, SHADE_CLEAR);
        horizontal.addColorStop(1, SHADE);
        ctx.fillStyle = horizontal;
        ctx.fillRect(left, top, width, height);
    }
}