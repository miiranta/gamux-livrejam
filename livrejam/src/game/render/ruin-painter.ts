import { valueNoise } from '../../engine/math';
import type { GradientRamp } from '../../engine/render';
import { sampleRamp, toCss } from '../../engine/render';
import { FACE_SMASHING } from '../config';

const OVERSCAN = 140;
const BRICK_COURSE_MIN = 3;
const BRICK_COURSE_MAX = 7;
const LITTER_MIN = 3;
const LITTER_MAX = 8;
const LITTER_SIZE_MIN = 2;
const LITTER_SIZE_MAX = 7;
const EDGE_LIT_STRENGTH = 0.34;
const SPLIT_DEPTH = 0.55;

export interface RuinOptions {
    width: number;
    height: number;
    count: number;
    depth: number;
    depths: number;
    seed: number;
    ramp: GradientRamp;
}

interface Mass {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export class RuinPainter {
    paint(ctx: CanvasRenderingContext2D, options: RuinOptions): void {
        const h = options.height;
        const w = options.width;
        const ratio = options.depths <= 1 ? 0 : options.depth / (options.depths - 1);
        const inset = (1 - ratio) * w * 0.3;

        for (let index = 0; index < options.count; index++) {
            const seed = options.seed + options.depth * 977 + index * 131;
            const side = valueNoise(index, 1, seed) < SPLIT_DEPTH ? -1 : 1;
            const mass = this.planMass(w, h, side, inset, ratio, seed, index);

            if (mass.right - mass.left < 8 || mass.bottom - mass.top < 8) {
                continue;
            }

            this.paintMass(ctx, mass, side, ratio, options.ramp, seed, index);
        }
    }

    private planMass(
        width: number,
        height: number,
        side: number,
        inset: number,
        ratio: number,
        seed: number,
        index: number,
    ): Mass {
        const anchorX = side < 0 ? inset : width - inset;
        const reach = (6 + valueNoise(index, 2, seed) * 130) * (1 + ratio * 0.5);
        const top = height * (0.02 + valueNoise(index, 3, seed) * 0.46);
        const bottom = height * (0.5 + valueNoise(index, 4, seed) * 0.52);

        return side < 0
            ? { left: anchorX - reach, right: anchorX + reach * 0.24, top, bottom }
            : { left: anchorX - reach * 0.24, right: anchorX + reach, top, bottom };
    }

    private paintMass(
        ctx: CanvasRenderingContext2D,
        mass: Mass,
        side: number,
        ratio: number,
        ramp: GradientRamp,
        seed: number,
        index: number,
    ): void {
        const luminance = 0.62 - ratio * 0.42;
        const [red, green, blue] = sampleRamp(ramp, luminance);

        ctx.fillStyle = toCss(red, green, blue, 1);
        this.strokeMass(ctx, mass, side, seed, index, ramp, luminance);
        this.paintLitter(ctx, mass, side, ramp, luminance, seed, index);
    }

    private strokeMass(
        ctx: CanvasRenderingContext2D,
        mass: Mass,
        side: number,
        seed: number,
        index: number,
        ramp: GradientRamp,
        luminance: number,
    ): void {
        const height = mass.bottom - mass.top;
        const direction = side < 0 ? 1 : -1;
        let y = mass.top;

        ctx.beginPath();
        ctx.moveTo(mass.left, mass.bottom);

        while (y < mass.bottom) {
            const course = height * (0.04 + valueNoise(index * 17 + Math.round(y), 5, seed) * 0.09);
            const step = 0.1 + valueNoise(index * 23 + Math.round(y), 6, seed) * 0.34;
            const edge = side < 0 ? mass.left + (mass.right - mass.left) * step : mass.right - (mass.right - mass.left) * step;
            const next = Math.min(y + course, mass.bottom);

            ctx.lineTo(edge, y + (next - y) * 0.34);
            ctx.lineTo(edge, next);
            y = next;
        }

        ctx.lineTo(side < 0 ? mass.left : mass.right, mass.bottom);
        ctx.closePath();
        ctx.fill();

        const [edgeRed, edgeGreen, edgeBlue] = sampleRamp(ramp, Math.min(1, luminance + EDGE_LIT_STRENGTH));
        const inward = (mass.right - mass.left) * 0.09 * -direction;

        ctx.save();
        ctx.strokeStyle = toCss(edgeRed, edgeGreen, edgeBlue, 0.22);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(mass.left + inward, mass.top);
        ctx.lineTo(mass.left + inward, mass.bottom);
        ctx.moveTo(mass.right + inward, mass.top);
        ctx.lineTo(mass.right + inward, mass.bottom);
        ctx.stroke();
        ctx.restore();

        this.paintCourses(ctx, mass, direction, ramp, luminance, seed, index);
    }

    private paintCourses(
        ctx: CanvasRenderingContext2D,
        mass: Mass,
        direction: number,
        ramp: GradientRamp,
        luminance: number,
        seed: number,
        index: number,
    ): void {
        const height = mass.bottom - mass.top;
        const width = mass.right - mass.left;
        const [red, green, blue] = sampleRamp(ramp, Math.max(0, luminance - 0.22));

        ctx.save();
        ctx.strokeStyle = toCss(red, green, blue, 0.5);
        ctx.lineWidth = 1;

        let y = mass.top;
        let course = 0;

        while (y < mass.bottom) {
            y += height * (0.08 + valueNoise(index * 31 + course, 7, seed) * 0.05);
            const edge = direction > 0 ? mass.left + width * 0.7 : mass.right - width * 0.7;
            const outer = direction > 0 ? mass.left : mass.right;

            ctx.beginPath();
            ctx.moveTo(outer, y);
            ctx.lineTo(edge, y + (valueNoise(index * 41 + course, 8, seed) - 0.5) * 3);
            ctx.stroke();
            course += 1;
        }

        ctx.restore();
    }

    private paintLitter(
        ctx: CanvasRenderingContext2D,
        mass: Mass,
        side: number,
        ramp: GradientRamp,
        luminance: number,
        seed: number,
        index: number,
    ): void {
        const count = LITTER_MIN + Math.floor(valueNoise(index, 9, seed) * (LITTER_MAX - LITTER_MIN));
        const [red, green, blue] = sampleRamp(ramp, Math.min(1, luminance + 0.24));
        const direction = side < 0 ? 1 : -1;

        ctx.save();
        ctx.fillStyle = toCss(red, green, blue, 0.7);

        for (let piece = 0; piece < count; piece++) {
            const size = LITTER_SIZE_MIN + valueNoise(index * 53 + piece, 10, seed) * (LITTER_SIZE_MAX - LITTER_SIZE_MIN);
            const spread = mass.right - mass.left;
            const x =
                side < 0
                    ? mass.left + spread * (0.5 + valueNoise(index * 61 + piece, 11, seed) * 0.5)
                    : mass.right - spread * (0.5 + valueNoise(index * 61 + piece, 11, seed) * 0.5);
            const y = mass.top + (mass.bottom - mass.top) * valueNoise(index * 71 + piece, 12, seed);

            ctx.fillRect(
                Math.round(x + direction * valueNoise(index * 83 + piece, 13, seed) * 16),
                Math.round(y),
                Math.round(size),
                Math.round(size * (0.5 + valueNoise(index * 89 + piece, 14, seed) * 0.9)),
            );
        }

        ctx.restore();
    }
}

export function ruinDepths(): number {
    return FACE_SMASHING.backdrop.ruinDepths;
}

export function ruinCount(depth: number): number {
    const counts = FACE_SMASHING.backdrop.ruinCount;
    return counts[Math.min(depth, counts.length - 1)];
}