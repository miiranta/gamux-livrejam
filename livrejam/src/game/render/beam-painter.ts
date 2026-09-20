import { valueNoise } from '../../engine/math';
import type { GradientRamp } from '../../engine/render';
import { sampleRamp, toCss } from '../../engine/render';
import { FACE_SMASHING } from '../config';

const BEAM_SEGMENTS = 9;
const BEAM_THICKNESS_MIN = 7;
const BEAM_THICKNESS_MAX = 20;
const BEAM_DARK = 'rgba(10, 7, 14, 0.5)';
const PROTRUSION_MIN = 4;
const PROTRUSION_MAX = 46;
const PLATE_ROWS_MIN = 2;
const PLATE_ROWS_MAX = 6;
const CABLE_DROP_MIN = 18;
const CABLE_DROP_MAX = 90;

export interface BeamOptions {
    width: number;
    height: number;
    count: number;
    seed: number;
    ramp: GradientRamp;
}

export class BeamPainter {
    paint(ctx: CanvasRenderingContext2D, options: BeamOptions): void {
        for (let index = 0; index < options.count; index++) {
            const seed = options.seed + index * 613;
            this.paintBeam(ctx, options, seed, index);
        }
    }

    private paintBeam(
        ctx: CanvasRenderingContext2D,
        options: BeamOptions,
        seed: number,
        index: number,
    ): void {
        const { width, height } = options;
        const side = valueNoise(index, 1, seed) < 0.5 ? -1 : 1;
        const y = height * (0.05 + valueNoise(index, 2, seed) * 0.72);
        const thickness =
            BEAM_THICKNESS_MIN + valueNoise(index, 3, seed) * (BEAM_THICKNESS_MAX - BEAM_THICKNESS_MIN);
        const reach = width * (0.1 + valueNoise(index, 4, seed) * 0.42);
        const inner = side < 0 ? 0 : width - reach;
        const outer = side < 0 ? reach : width;

        this.paintPlank(ctx, options, side, y, thickness, inner, outer, seed, index);
        this.paintPlates(ctx, options, side, y, thickness, inner, outer, seed, index);
        this.paintCables(ctx, options, side, y, thickness, inner, outer, seed, index);
        this.paintProtrusions(ctx, options, side, y, thickness, inner, outer, seed, index);
    }

    private paintPlank(
        ctx: CanvasRenderingContext2D,
        options: BeamOptions,
        side: number,
        y: number,
        thickness: number,
        inner: number,
        outer: number,
        seed: number,
        index: number,
    ): void {
        const [red, green, blue] = sampleRamp(options.ramp, 0.46);

        ctx.save();
        ctx.fillStyle = toCss(red, green, blue, 1);
        ctx.beginPath();
        ctx.moveTo(inner, y);

        for (let segment = 1; segment <= BEAM_SEGMENTS; segment++) {
            const ratio = segment / BEAM_SEGMENTS;
            const x = inner + (outer - inner) * ratio;
            const jitter = (valueNoise(index * 47 + segment, 5, seed) - 0.5) * thickness * 0.6;

            ctx.lineTo(x, y + jitter);
        }

        for (let segment = BEAM_SEGMENTS; segment >= 0; segment--) {
            const ratio = segment / BEAM_SEGMENTS;
            const x = inner + (outer - inner) * ratio;
            const jitter = (valueNoise(index * 53 + segment, 6, seed) - 0.5) * thickness * 0.6;

            ctx.lineTo(x, y + thickness + jitter);
        }

        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = BEAM_DARK;
        ctx.fillRect(Math.min(inner, outer), y + thickness - 2, Math.abs(outer - inner), 3);
        ctx.restore();

        void side;
    }

    private paintPlates(
        ctx: CanvasRenderingContext2D,
        options: BeamOptions,
        side: number,
        y: number,
        thickness: number,
        inner: number,
        outer: number,
        seed: number,
        index: number,
    ): void {
        const rows =
            PLATE_ROWS_MIN + Math.floor(valueNoise(index, 7, seed) * (PLATE_ROWS_MAX - PLATE_ROWS_MIN));
        const [red, green, blue] = sampleRamp(options.ramp, 0.72);
        const span = Math.abs(outer - inner);

        ctx.save();
        ctx.fillStyle = toCss(red, green, blue, 0.9);

        for (let row = 0; row < rows; row++) {
            const ratio = 0.12 + valueNoise(index * 11 + row, 8, seed) * 0.72;
            const size = thickness * (0.7 + valueNoise(index * 13 + row, 9, seed) * 0.9);
            const along = side < 0 ? inner + span * ratio : inner + span * ratio;

            ctx.fillRect(
                Math.round(along - size / 2),
                Math.round(y + thickness * (0.1 + row * 0.16)),
                Math.round(size),
                Math.round(size * 0.55),
            );
        }

        ctx.restore();
    }

    private paintCables(
        ctx: CanvasRenderingContext2D,
        options: BeamOptions,
        side: number,
        y: number,
        thickness: number,
        inner: number,
        outer: number,
        seed: number,
        index: number,
    ): void {
        const [red, green, blue] = sampleRamp(options.ramp, 0.58);
        const span = Math.abs(outer - inner);

        ctx.save();
        ctx.strokeStyle = toCss(red, green, blue, 0.8);
        ctx.lineWidth = 2;

        for (let cable = 0; cable < 3; cable++) {
            const start = side < 0 ? inner + span * valueNoise(index * 17 + cable, 10, seed) : outer - span * valueNoise(index * 17 + cable, 10, seed);
            const drop =
                CABLE_DROP_MIN + valueNoise(index * 19 + cable, 11, seed) * (CABLE_DROP_MAX - CABLE_DROP_MIN);
            const drift = (valueNoise(index * 23 + cable, 12, seed) - 0.5) * thickness * 2;

            ctx.beginPath();
            ctx.moveTo(start, y + thickness);
            ctx.quadraticCurveTo(start + drift, y + thickness + drop * 0.6, start + drift * 1.4, y + thickness + drop);
            ctx.stroke();
        }

        ctx.restore();
    }

    private paintProtrusions(
        ctx: CanvasRenderingContext2D,
        options: BeamOptions,
        side: number,
        y: number,
        thickness: number,
        inner: number,
        outer: number,
        seed: number,
        index: number,
    ): void {
        const count = 1 + Math.floor(valueNoise(index, 13, seed) * 3);
        const [red, green, blue] = sampleRamp(options.ramp, 0.66);
        const span = Math.abs(outer - inner);

        ctx.save();
        ctx.fillStyle = toCss(red, green, blue, 1);

        for (let piece = 0; piece < count; piece++) {
            const ratio = valueNoise(index * 29 + piece, 14, seed);
            const length =
                PROTRUSION_MIN + valueNoise(index * 31 + piece, 15, seed) * (PROTRUSION_MAX - PROTRUSION_MIN);
            const x = side < 0 ? inner + span * ratio : outer - span * ratio;
            const width = thickness * (0.5 + valueNoise(index * 37 + piece, 16, seed) * 0.6);

            ctx.fillRect(Math.round(x - width / 2), Math.round(y + thickness), Math.round(width), Math.round(length));
        }

        ctx.restore();
    }
}