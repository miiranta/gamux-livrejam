import type { Camera, GradientRamp } from '../../engine/render';
import { sampleRamp, scaleAlpha, toCss } from '../../engine/render';
import type { DungeonLevel } from '../level';
import { FACE_SMASHING } from '../config';
import { CanopyPainter, canopyCount, canopyDepths } from './canopy-painter';

const HEARTH_RADIUS_RATIO = 0.42;
const SHAFT_RADIUS_RATIO = 0.30;
const SHAFT_CENTER_Y = -0.06;
const TORCH_POOL_RATIO = 1.4;
const CEILING_SHADE_ALPHA = 0.6;
const HAZE_BAND_TILES = 3;

export class BackdropPainter {
    private readonly canopy = new CanopyPainter();

    paint(ctx: CanvasRenderingContext2D, level: DungeonLevel, camera: Camera): void {
        const config = FACE_SMASHING.backdrop;
        const ramp = FACE_SMASHING.palette.canopy;
        const depths = canopyDepths();

        this.paintGradient(ctx, camera, config.top, config.bottom);

        for (let depth = 0; depth < depths; depth++) {
            this.canopy.paint(ctx, {
                width: camera.viewportWidth,
                height: camera.viewportHeight,
                count: canopyCount(depth),
                depth,
                depths,
                seed: config.canopySeed,
                ramp,
            });
        }

        this.paintShaft(ctx, camera, config.shaftGlow);
        this.paintHearth(ctx, level, camera, config.hearthGlow);
        this.paintTorchLight(ctx, level, camera, config.torchGlow, config.torchRadius);
        this.paintHaze(ctx, level, camera, ramp, config.hazeAlpha);
        this.paintCeiling(ctx, camera, config.ceilingShadeHeight);
    }

    private paintGradient(
        ctx: CanvasRenderingContext2D,
        camera: Camera,
        top: string,
        bottom: string,
    ): void {
        const gradient = ctx.createLinearGradient(0, 0, 0, camera.viewportHeight);
        gradient.addColorStop(0, top);
        gradient.addColorStop(1, bottom);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);
    }

    private paintShaft(ctx: CanvasRenderingContext2D, camera: Camera, color: string): void {
        const radius = camera.viewportWidth * SHAFT_RADIUS_RATIO;
        const centerX = camera.viewportWidth / 2;
        const centerY = camera.viewportHeight * SHAFT_CENTER_Y;
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);

        gradient.addColorStop(0, color);
        gradient.addColorStop(1, scaleAlpha(color, 0));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = gradient;
        ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
        ctx.restore();
    }

    private paintHearth(
        ctx: CanvasRenderingContext2D,
        level: DungeonLevel,
        camera: Camera,
        color: string,
    ): void {
        const centerX = camera.toScreenX((level.playLeft + level.playRight) / 2);
        const centerY = camera.toScreenY(level.floorTop);
        const radius = camera.toScreenLength(
            (level.playRight - level.playLeft) * HEARTH_RADIUS_RATIO,
        );
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);

        gradient.addColorStop(0, color);
        gradient.addColorStop(1, scaleAlpha(color, 0));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = gradient;
        ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
        ctx.restore();
    }

    private paintTorchLight(
        ctx: CanvasRenderingContext2D,
        level: DungeonLevel,
        camera: Camera,
        color: string,
        radiusTiles: number,
    ): void {
        const { grid } = level;
        const radius = camera.toScreenLength(grid.tileSize * radiusTiles);
        const poolRadius = radius * TORCH_POOL_RATIO;
        const poolY = camera.toScreenY(level.floorTop + grid.tileSize / 2);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const torch of level.decorations.torches) {
            const centerX = camera.toScreenX(grid.columnX(torch.column) + grid.tileSize / 2);
            const centerY = camera.toScreenY(grid.rowY(torch.row) + grid.tileSize / 2);

            this.paintGlow(ctx, centerX, centerY, radius, color, 1, 0.45);
            this.paintGlow(
                ctx,
                centerX,
                poolY,
                poolRadius,
                color,
                FACE_SMASHING.backdrop.torchPoolAlpha,
                0.45,
            );
        }
        ctx.restore();
    }

    private paintGlow(
        ctx: CanvasRenderingContext2D,
        centerX: number,
        centerY: number,
        radius: number,
        color: string,
        intensity: number,
        midStop: number,
    ): void {
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);

        gradient.addColorStop(0, scaleAlpha(color, intensity));
        gradient.addColorStop(midStop, scaleAlpha(color, intensity * 0.45));
        gradient.addColorStop(1, scaleAlpha(color, 0));
        ctx.fillStyle = gradient;
        ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
    }

    private paintHaze(
        ctx: CanvasRenderingContext2D,
        level: DungeonLevel,
        camera: Camera,
        ramp: GradientRamp,
        alpha: number,
    ): void {
        const band = camera.toScreenLength(level.grid.tileSize * HAZE_BAND_TILES);
        const bottom = camera.toScreenY(level.floorTop);
        const top = bottom - band;
        const [red, green, blue] = sampleRamp(ramp, 0.56);
        const gradient = ctx.createLinearGradient(0, top, 0, bottom);

        gradient.addColorStop(0, toCss(red, green, blue, 0));
        gradient.addColorStop(1, toCss(red, green, blue, alpha));
        ctx.fillStyle = gradient;
        ctx.fillRect(0, top, camera.viewportWidth, band);
    }

    private paintCeiling(ctx: CanvasRenderingContext2D, camera: Camera, ratio: number): void {
        const band = Math.max(1, camera.viewportHeight * ratio);
        const gradient = ctx.createLinearGradient(0, 0, 0, band);

        gradient.addColorStop(0, `rgba(0, 0, 0, ${CEILING_SHADE_ALPHA})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, camera.viewportWidth, band);
    }
}