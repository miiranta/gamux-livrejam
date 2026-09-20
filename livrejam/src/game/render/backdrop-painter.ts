import { valueNoise } from '../../engine/math';
import type { Camera, GradientRamp } from '../../engine/render';
import { sampleRamp, scaleAlpha, toCss } from '../../engine/render';
import type { DungeonLevel } from '../level';
import { FACE_SMASHING } from '../config';
import { BeamPainter } from './beam-painter';
import { ChainPainter } from './chain-painter';
import { RuinPainter, ruinCount, ruinDepths } from './ruin-painter';

const HAZE_STOPS = 5;
const EMBER_RADIUS_RATIO = 0.02;
const EMBER_DRIFT_RATIO = 0.04;
const EMBER_GLOW = 2.4;

export class BackdropPainter {
    private readonly ruins = new RuinPainter();
    private readonly chains = new ChainPainter();
    private readonly beams = new BeamPainter();

    paint(ctx: CanvasRenderingContext2D, level: DungeonLevel, camera: Camera): void {
        const config = FACE_SMASHING.backdrop;
        const depths = ruinDepths();
        const width = camera.viewportWidth;
        const height = camera.viewportHeight;

        this.paintGradient(ctx, camera, config.top, config.horizon, config.bottom);
        this.paintHaze(
            ctx,
            width,
            height,
            config.hazeColor,
            config.hazeCenterY,
            config.hazeRadius,
            config.hazeSoftness,
        );

        for (let depth = 0; depth < depths; depth++) {
            this.ruins.paint(ctx, {
                width,
                height,
                count: ruinCount(depth),
                depth,
                depths,
                seed: config.ruinSeed,
                ramp: FACE_SMASHING.palette.structure,
            });
        }

        this.chains.paint(ctx, {
            width,
            height,
            count: config.chainCount,
            seed: config.chainSeed,
            ramp: FACE_SMASHING.palette.structure,
        });

        this.beams.paint(ctx, {
            width,
            height,
            count: config.beamCount,
            seed: config.beamSeed,
            ramp: FACE_SMASHING.palette.structure,
        });

        this.paintHaze(
            ctx,
            width,
            height,
            config.hazeWarmth,
            config.hazeCenterY,
            config.hazeRadius,
            config.hazeSoftness,
        );
        this.paintRust(ctx, level, camera, config);
        this.paintEmbers(ctx, width, height, config);
        this.paintFloorBand(ctx, level, camera, config);
    }

    private paintGradient(
        ctx: CanvasRenderingContext2D,
        camera: Camera,
        top: string,
        horizon: string,
        bottom: string,
    ): void {
        const gradient = ctx.createLinearGradient(0, 0, 0, camera.viewportHeight);

        gradient.addColorStop(0, top);
        gradient.addColorStop(0.46, horizon);
        gradient.addColorStop(1, bottom);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);
    }

    private paintHaze(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        color: string,
        centerY: number,
        radiusRatio: number,
        softness: number,
    ): void {
        const centerX = width * 0.5;
        const y = height * centerY;
        const radius = width * radiusRatio;
        const gradient = ctx.createRadialGradient(centerX, y, 0, centerX, y, radius);

        for (let stop = 0; stop <= HAZE_STOPS; stop++) {
            const ratio = stop / HAZE_STOPS;
            const falloff = 1 - ratio;
            gradient.addColorStop(ratio, scaleAlpha(color, falloff ** (1 / Math.max(softness, 0.1))));
        }

        ctx.save();
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }

    private paintRust(
        ctx: CanvasRenderingContext2D,
        level: DungeonLevel,
        camera: Camera,
        config: typeof FACE_SMASHING.backdrop,
    ): void {
        const centerX = camera.toScreenX((level.playLeft + level.playRight) / 2);
        const centerY = camera.viewportHeight * config.rustCenterY;
        const radius = camera.viewportWidth * config.rustRadius;
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);

        gradient.addColorStop(0, config.rustColor);
        gradient.addColorStop(0.55, scaleAlpha(config.rustColor, 0.4));
        gradient.addColorStop(1, scaleAlpha(config.rustColor, 0));
        ctx.save();
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = gradient;
        ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
        ctx.restore();
    }

    private paintEmbers(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        config: typeof FACE_SMASHING.backdrop,
    ): void {
        const radius = width * EMBER_RADIUS_RATIO;
        const drift = height * EMBER_DRIFT_RATIO;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        for (let index = 0; index < config.emberCount; index++) {
            const x = width * (0.12 + valueNoise(index, 1, config.emberSeed) * 0.76);
            const y = height * (0.58 + valueNoise(index, 2, config.emberSeed) * 0.34);
            const size = radius * (0.4 + valueNoise(index, 3, config.emberSeed) * 0.9);
            const reach = size * EMBER_GLOW;
            const lift = driftSeed(index, config.emberSeed) * drift;
            const glow = ctx.createRadialGradient(x, y - lift, 0, x, y - lift, reach);

            glow.addColorStop(0, scaleAlpha(config.emberColor, 0.55));
            glow.addColorStop(0.4, scaleAlpha(config.emberColor, 0.18));
            glow.addColorStop(1, scaleAlpha(config.emberColor, 0));
            ctx.fillStyle = glow;
            ctx.fillRect(x - reach, y - lift - reach, reach * 2, reach * 2);
        }

        ctx.restore();
    }

    private paintFloorBand(
        ctx: CanvasRenderingContext2D,
        level: DungeonLevel,
        camera: Camera,
        config: typeof FACE_SMASHING.backdrop,
    ): void {
        const ramp: GradientRamp = FACE_SMASHING.palette.structure;
        const band = camera.toScreenLength(level.grid.tileSize * config.hazeBandTiles);
        const bottom = camera.toScreenY(level.floorTop);
        const top = bottom - band;
        const [red, green, blue] = sampleRamp(ramp, 0.2);
        const gradient = ctx.createLinearGradient(0, top, 0, bottom);

        gradient.addColorStop(0, toCss(red, green, blue, 0));
        gradient.addColorStop(1, toCss(red, green, blue, 0.72));
        ctx.fillStyle = gradient;
        ctx.fillRect(0, top, camera.viewportWidth, band);
    }
}

function driftSeed(index: number, seed: number): number {
    return valueNoise(index, 4, seed) * 0.6 - 0.3;
}