import type { Camera } from '../../engine/render';
import { waveOffset } from '../../engine/render';
import type { DungeonLevel, PropPlacement } from '../level';
import type { DungeonSprites } from '../assets';
import { PROP_SPRITES } from '../assets';

const SWAY_SPEED = 0.35;
const SWAY_AMPLITUDE = 0.045;
const TILE_PIXELS = 32;
const WALL_VALUE_SCALE = 0.62;
const CHAIN_VALUE_SCALE = 0.5;

export class PropPainter {
    constructor(private readonly sprites: DungeonSprites) {}

    paint(
        ctx: CanvasRenderingContext2D,
        level: DungeonLevel,
        camera: Camera,
        elapsed: number,
        depth: number,
    ): void {
        const tile = camera.toScreenLength(level.grid.tileSize);
        const pixel = tile / TILE_PIXELS;

        for (const prop of level.decorations.props) {
            if (prop.depth !== depth) {
                continue;
            }

            this.paintProp(ctx, prop, camera, pixel, elapsed);
        }
    }

    private paintProp(
        ctx: CanvasRenderingContext2D,
        prop: PropPlacement,
        camera: Camera,
        pixel: number,
        elapsed: number,
    ): void {
        const image = this.sprites.props.get(prop.kind);

        if (!image) {
            return;
        }

        const size = this.sizeOf(prop.kind);
        const anchor = this.anchorOf(prop);
        const sway =
            prop.sway > 0
                ? waveOffset(SWAY_AMPLITUDE, SWAY_SPEED, elapsed, prop.x * 0.01) * prop.sway
                : 0;
        const x = camera.toScreenX(prop.x);
        const y = camera.toScreenY(prop.y);
        const width = size.width * pixel * prop.scale;
        const height = size.height * pixel * prop.scale;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(sway);
        ctx.scale(prop.flip ? -1 : 1, 1);
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = this.valueOf(prop);
        ctx.drawImage(image, -width * anchor.x, -height * anchor.y, width, height);
        ctx.restore();

        if (prop.glow > 0) {
            this.paintGlow(ctx, prop, camera, pixel, elapsed);
        }
    }

    private paintGlow(
        ctx: CanvasRenderingContext2D,
        prop: PropPlacement,
        camera: Camera,
        pixel: number,
        elapsed: number,
    ): void {
        const glow = this.sprites.props.get('candleGlow');

        if (!glow) {
            return;
        }

        const size = this.sizeOf('candleGlow');
        const anchor = this.anchorOf(prop);
        const flicker = 0.85 + waveOffset(0.12, 5.5, elapsed, prop.x * 0.02);
        const width = size.width * pixel * prop.scale * flicker;
        const height = size.height * pixel * prop.scale * flicker;

        ctx.save();
        ctx.translate(camera.toScreenX(prop.x), camera.toScreenY(prop.y));
        ctx.scale(prop.flip ? -1 : 1, 1);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = prop.glow * flicker * 0.7;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(glow, -width * anchor.x, -height * anchor.y, width, height);
        ctx.restore();
    }

    private valueOf(prop: PropPlacement): number {
        if (prop.anchor === 'wall') {
            return WALL_VALUE_SCALE;
        }

        if (prop.anchor === 'ceiling') {
            return CHAIN_VALUE_SCALE;
        }

        return 1;
    }

    private anchorOf(prop: PropPlacement): { x: number; y: number } {
        if (prop.anchor === 'ceiling') {
            return { x: 0.5, y: 0 };
        }

        if (prop.anchor === 'wall') {
            return { x: 0.5, y: 0.5 };
        }

        return { x: 0.5, y: 1 };
    }

    private sizeOf(kind: PropPlacement['kind']): { width: number; height: number } {
        return PROP_SPRITES[kind];
    }
}
