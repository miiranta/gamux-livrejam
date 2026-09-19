import { valueNoise } from '../../engine/math';
import type { GradientRamp } from '../../engine/render';
import { sampleRamp, toCss } from '../../engine/render';
import { FACE_SMASHING } from '../config';

const MASS_SEGMENTS = 26;
const MASS_IRREGULARITY = 0.32;
const TENDRIL_MIN = 2;
const TENDRIL_MAX = 5;
const TENDRIL_SEGMENT_MIN = 3;
const TENDRIL_SEGMENT_MAX = 7;
const TENDRIL_STEP_MIN = 4;
const TENDRIL_STEP_MAX = 11;
const TENDRIL_DRIFT = 2.5;
const OVERSCAN = 90;
const GATHER_X = 1.7;
const GATHER_Y = 0.85;

export interface CanopyOptions {
    width: number;
    height: number;
    count: number;
    depth: number;
    depths: number;
    seed: number;
    ramp: GradientRamp;
}

export class CanopyPainter {
    paint(ctx: CanvasRenderingContext2D, options: CanopyOptions): void {
        const { width, height, depths, depth } = options;
        const ratio = depths <= 1 ? 0 : depth / (depths - 1);
        const topFraction = 0.34 - ratio * 0.24;
        const sizeMin = 70 - ratio * 30;
        const sizeMax = 170 - ratio * 65;
        const luminance = 0.34 - ratio * 0.18;
        const [red, green, blue] = sampleRamp(options.ramp, luminance);
        const color = toCss(red, green, blue, 1);
        const seed = options.seed + depth * 977;

        for (let index = 0; index < options.count; index++) {
            this.paintMass(ctx, width, height, topFraction, sizeMin, sizeMax, color, seed, index);
        }
    }

    private paintMass(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        topFraction: number,
        sizeMin: number,
        sizeMax: number,
        color: string,
        seed: number,
        index: number,
    ): void {
        const centerX = (valueNoise(index, 1, seed) * (width + OVERSCAN * 2) - OVERSCAN) * GATHER_X - width * 0.35;
        const centerY = valueNoise(index, 2, seed) * height * topFraction * GATHER_Y - height * 0.18;
        const sizeSeed = valueNoise(index, 3, seed);
        const radiusX = sizeMin + sizeSeed * (sizeMax - sizeMin);
        const radiusY = radiusX * (0.5 + valueNoise(index, 4, seed) * 0.35);

        ctx.beginPath();
        for (let segment = 0; segment < MASS_SEGMENTS; segment++) {
            const angle = (Math.PI * 2 * segment) / MASS_SEGMENTS;
            const jitter = 1 + (valueNoise(index * 31 + segment, 5, seed) - 0.5) * MASS_IRREGULARITY * 2;
            const x = centerX + Math.cos(angle) * radiusX * jitter;
            const y = centerY + Math.sin(angle) * radiusY * jitter;

            if (segment === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        this.paintTendrils(ctx, index, seed, centerX, centerY, radiusX, radiusY, color);
    }

    private paintTendrils(
        ctx: CanvasRenderingContext2D,
        index: number,
        seed: number,
        centerX: number,
        centerY: number,
        radiusX: number,
        radiusY: number,
        color: string,
    ): void {
        const spread = TENDRIL_MIN + Math.floor(valueNoise(index, 6, seed) * (TENDRIL_MAX - TENDRIL_MIN + 1));

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;

        for (let tendril = 0; tendril < spread; tendril++) {
            const offset = valueNoise(index * 17 + tendril, 7, seed) * 2 - 1;
            let x = centerX + offset * radiusX * 0.8;
            let y = centerY + radiusY * Math.sqrt(Math.max(0, 1 - offset * offset)) * 0.85;
            const segments =
                TENDRIL_SEGMENT_MIN +
                Math.floor(valueNoise(index * 13 + tendril, 8, seed) * (TENDRIL_SEGMENT_MAX - TENDRIL_SEGMENT_MIN + 1));

            ctx.beginPath();
            ctx.moveTo(x, y);

            for (let segment = 0; segment < segments; segment++) {
                const step =
                    TENDRIL_STEP_MIN +
                    valueNoise(index * 7 + tendril * 3 + segment, 9, seed) * (TENDRIL_STEP_MAX - TENDRIL_STEP_MIN);
                x += (valueNoise(index * 5 + tendril + segment, 10, seed) - 0.5) * TENDRIL_DRIFT * 2;
                y += step;
                ctx.lineTo(x, y);
            }

            ctx.stroke();
        }
    }
}

export function canopyDepths(): number {
    return FACE_SMASHING.backdrop.canopyDepths;
}

export function canopyCount(depth: number): number {
    const counts = FACE_SMASHING.backdrop.canopyMassCount;
    return counts[Math.min(depth, counts.length - 1)];
}