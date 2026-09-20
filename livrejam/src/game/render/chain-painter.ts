import { valueNoise } from '../../engine/math';
import type { GradientRamp } from '../../engine/render';
import { sampleRamp, toCss } from '../../engine/render';
import { FACE_SMASHING } from '../config';

const ARC_SEGMENTS = 34;
const SAG_MIN = 0.1;
const SAG_MAX = 0.44;
const LINK_SPACING = 9;
const LINK_WIDTH_RATIO = 0.42;
const LINK_HEIGHT_RATIO = 0.62;
const LINK_LIT_COLOR = 'rgba(196, 200, 212, 0.5)';
const LINK_DARK_COLOR = 'rgba(16, 12, 20, 0.72)';
const STRAND_SPREAD_MIN = 1;
const STRAND_SPREAD_MAX = 3;
const STRAND_OFFSET_MIN = 4;
const STRAND_OFFSET_MAX = 15;

export interface ChainOptions {
    width: number;
    height: number;
    count: number;
    seed: number;
    ramp: GradientRamp;
}

interface Link {
    x: number;
    y: number;
    angle: number;
    scale: number;
    lit: boolean;
}

export class ChainPainter {
    paint(ctx: CanvasRenderingContext2D, options: ChainOptions): void {
        const width = options.width;

        for (let strand = 0; strand < options.count; strand++) {
            const seed = options.seed + strand * 379;
            const strands = STRAND_SPREAD_MIN + Math.floor(valueNoise(strand, 1, seed) * STRAND_SPREAD_MAX);

            for (let index = 0; index < strands; index++) {
                const offset = STRAND_OFFSET_MIN + valueNoise(strand * 13 + index, 2, seed) * STRAND_OFFSET_MAX;
                const links = this.planStrand(width, options.height, seed, index, offset, options.ramp);

                this.paintStrand(ctx, links, options.ramp);
            }
        }
    }

    private planStrand(
        width: number,
        height: number,
        seed: number,
        index: number,
        offset: number,
        ramp: GradientRamp,
    ): Link[] {
        const startX = -width * 0.12;
        const endX = width * 1.12;
        const startY = height * (0.04 + valueNoise(index, 3, seed) * 0.42) + offset;
        const endY = height * (0.06 + valueNoise(index, 4, seed) * 0.52) + offset;
        const sag = height * (SAG_MIN + valueNoise(index, 5, seed) * (SAG_MAX - SAG_MIN));
        const drift = (valueNoise(index, 6, seed) - 0.5) * height * 0.22;
        const scale = 0.7 + valueNoise(index, 7, seed) * 0.55;
        const links: Link[] = [];
        let previous: { x: number; y: number } | null = null;

        for (let segment = 0; segment <= ARC_SEGMENTS; segment++) {
            const ratio = segment / ARC_SEGMENTS;
            const x = startX + (endX - startX) * ratio;
            const base = startY + (endY - startY) * ratio;
            const curve = Math.sin(ratio * Math.PI) * sag + ratio * drift;
            const wobble = (valueNoise(index * 97 + segment, 8, seed) - 0.5) * height * 0.02;
            const y = base + curve + wobble;

            if (previous) {
                const distance = Math.hypot(x - previous.x, y - previous.y);
                const steps = Math.max(1, Math.floor(distance / LINK_SPACING));

                for (let step = 0; step < steps; step++) {
                    const amount = step / steps;
                    const lx = previous.x + (x - previous.x) * amount;
                    const ly = previous.y + (y - previous.y) * amount;
                    const angle = Math.atan2(y - previous.y, x - previous.x);

                    links.push({
                        x: lx,
                        y: ly,
                        angle,
                        scale,
                        lit: links.length % 3 === 0,
                    });
                }
            }

            previous = { x, y };
        }

        void ramp;
        return links;
    }

    private paintStrand(ctx: CanvasRenderingContext2D, links: readonly Link[], ramp: GradientRamp): void {
        const [red, green, blue] = sampleRamp(ramp, 0.86);
        const base = toCss(red, green, blue, 1);
        const width = LINK_SPACING * LINK_WIDTH_RATIO;
        const height = LINK_SPACING * LINK_HEIGHT_RATIO;

        ctx.save();
        ctx.lineWidth = Math.max(1, width * 0.36);

        for (const link of links) {
            ctx.save();
            ctx.translate(link.x, link.y);
            ctx.rotate(link.angle);
            ctx.scale(link.scale, link.scale);

            ctx.fillStyle = LINK_DARK_COLOR;
            ctx.fillRect(-height / 2 + 1, -width / 2 + 1, height, width);

            ctx.fillStyle = base;
            ctx.fillRect(-height / 2, -width / 2, height, width);

            ctx.fillStyle = link.lit ? LINK_LIT_COLOR : LINK_DARK_COLOR;
            ctx.fillRect(link.lit ? -height / 2 + 1.5 : height / 2 - 2.5, -width / 2, 1.5, width);
            ctx.restore();
        }

        ctx.restore();
    }
}