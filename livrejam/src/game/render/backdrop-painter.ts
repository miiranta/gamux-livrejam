import type { Camera } from '../../engine/render';
import { scaleAlpha } from '../../engine/render';
import type { DungeonLevel } from '../level';
import { FACE_SMASHING } from '../config';

const HEARTH_RADIUS_RATIO = 0.35;
const TORCH_POOL_RATIO = 1.4;
const VIGNETTE_CENTER_Y = 0.55;
const VIGNETTE_INNER = 0.35;
const CEILING_SHADE_ALPHA = 0.62;

export class BackdropPainter {
    paint(ctx: CanvasRenderingContext2D, level: DungeonLevel, camera: Camera): void {
        const config = FACE_SMASHING.backdrop;

        this.paintGradient(ctx, camera, config.top, config.bottom);
        this.paintHearth(ctx, level, camera, config.hearthGlow);
        this.paintTorchLight(ctx, level, camera, config.torchGlow, config.torchRadius);
        this.paintCeiling(ctx, camera, config.ceilingShadeHeight);
        this.paintVignette(ctx, camera, config.vignetteStrength, config.vignetteRadius);
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

        this.paintGlow(ctx, centerX, centerY, radius, color, 1, [0, 1]);
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

            this.paintGlow(ctx, centerX, centerY, radius, color, 1, [0, 0.45]);
            this.paintGlow(
                ctx,
                centerX,
                poolY,
                poolRadius,
                color,
                FACE_SMASHING.backdrop.torchPoolAlpha,
                [0, 0.45],
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
        stops: readonly [number, number],
    ): void {
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);

        gradient.addColorStop(stops[0], scaleAlpha(color, intensity));
        gradient.addColorStop(stops[1], scaleAlpha(color, intensity * stops[1]));
        gradient.addColorStop(1, scaleAlpha(color, 0));
        ctx.fillStyle = gradient;
        ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
    }

    private paintCeiling(ctx: CanvasRenderingContext2D, camera: Camera, ratio: number): void {
        const band = Math.max(1, camera.viewportHeight * ratio);
        const gradient = ctx.createLinearGradient(0, 0, 0, band);

        gradient.addColorStop(0, `rgba(0, 0, 0, ${CEILING_SHADE_ALPHA})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, camera.viewportWidth, band);
    }

    private paintVignette(
        ctx: CanvasRenderingContext2D,
        camera: Camera,
        strength: number,
        radiusRatio: number,
    ): void {
        const radius = Math.max(camera.viewportWidth, camera.viewportHeight) * (0.5 + radiusRatio);
        const centerX = camera.viewportWidth / 2;
        const centerY = camera.viewportHeight * VIGNETTE_CENTER_Y;
        const gradient = ctx.createRadialGradient(
            centerX,
            centerY,
            radius * VIGNETTE_INNER,
            centerX,
            centerY,
            radius,
        );

        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, `rgba(0, 0, 0, ${strength})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);
    }
}