import type { Camera } from '../../engine/render';
import { valueNoise } from '../../engine/math';
import type { DungeonSprites } from '../assets';
import type { DungeonLevel } from '../level';
import { FACE_SMASHING } from '../config';

const WALL_VARIATION_SEED = 0x2545f491;
const FLOOR_VARIATION_SEED = 0x9e3779b1;
const WALL_SHADE_RATIO = 0.45;
const FLOOR_EDGE_RATIO = 0.08;
const FLOOR_SHADOW_RATIO = 0.12;
const FLOOR_EDGE_COLOR = 'rgba(252, 226, 182, 0.47)';
const UNLIT_TINT = 'rgba(46, 18, 10, 0.42)';

export class TerrainRenderer {
    constructor(private readonly sprites: DungeonSprites) {}

    paint(ctx: CanvasRenderingContext2D, level: DungeonLevel, camera: Camera): void {
        this.paintWalls(ctx, level, camera);
        this.paintFloors(ctx, level, camera);
        this.paintFloorDepth(ctx, level, camera);
        this.paintWallDepth(ctx, level, camera);
    }

    private paintWalls(ctx: CanvasRenderingContext2D, level: DungeonLevel, camera: Camera): void {
        const { grid } = level;
        const size = camera.toScreenLength(grid.tileSize);
        const variation = FACE_SMASHING.backdrop.wallVariation;
        const face = this.sprites.wallFace;

        for (const tile of level.decorations.walls) {
            const x = camera.toScreenX(grid.columnX(tile.column));
            const y = camera.toScreenY(grid.rowY(tile.row));
            const brightness =
                1 - variation / 2 + valueNoise(tile.column, tile.row, WALL_VARIATION_SEED) * variation;

            ctx.save();
            ctx.globalAlpha = brightness;
            ctx.drawImage(face, x, y, size, size);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = UNLIT_TINT;
            ctx.fillRect(x, y, size, size);
            ctx.restore();
        }
    }

    private paintFloors(ctx: CanvasRenderingContext2D, level: DungeonLevel, camera: Camera): void {
        const { grid } = level;
        const size = camera.toScreenLength(grid.tileSize);
        const variation = FACE_SMASHING.backdrop.floorVariation;
        const face = this.sprites.floorFace;

        for (const tile of level.decorations.floors) {
            const brightness =
                1 -
                variation / 2 +
                valueNoise(tile.column, tile.row, FLOOR_VARIATION_SEED) * variation;

            ctx.save();
            ctx.globalAlpha = brightness;
            ctx.drawImage(
                face,
                camera.toScreenX(grid.columnX(tile.column)),
                camera.toScreenY(grid.rowY(tile.row)),
                size,
                size,
            );
            ctx.restore();
        }
    }

    private paintFloorDepth(
        ctx: CanvasRenderingContext2D,
        level: DungeonLevel,
        camera: Camera,
    ): void {
        const { grid, floorTop, playLeft, playRight } = level;
        const x = camera.toScreenX(playLeft);
        const y = camera.toScreenY(floorTop);
        const width = camera.toScreenLength(playRight - playLeft);
        const height = camera.toScreenLength(grid.tileSize);
        const edge = Math.max(1, height * FLOOR_EDGE_RATIO);
        const shadow = Math.max(2, height * FLOOR_SHADOW_RATIO);
        const depth = ctx.createLinearGradient(0, y, 0, y + height);

        depth.addColorStop(0, 'rgba(0, 0, 0, 0.02)');
        depth.addColorStop(0.55, 'rgba(0, 0, 0, 0.16)');
        depth.addColorStop(1, 'rgba(0, 0, 0, 0.46)');
        ctx.fillStyle = depth;
        ctx.fillRect(x, y, width, height);

        ctx.fillStyle = FLOOR_EDGE_COLOR;
        ctx.fillRect(x, y, width, edge);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
        ctx.fillRect(x, y + height - shadow, width, shadow);
    }

    private paintWallDepth(
        ctx: CanvasRenderingContext2D,
        level: DungeonLevel,
        camera: Camera,
    ): void {
        const { grid } = level;
        const strength = FACE_SMASHING.backdrop.wallShade;
        const shade = Math.max(2, camera.toScreenLength(grid.tileSize) * WALL_SHADE_RATIO);
        const top = camera.toScreenY(grid.top);
        const height = camera.toScreenLength(grid.height);

        this.paintInnerShade(ctx, camera.toScreenX(grid.left), shade, top, height, strength, 1);
        this.paintInnerShade(
            ctx,
            camera.toScreenX(grid.right) - shade,
            shade,
            top,
            height,
            strength,
            -1,
        );
    }

    private paintInnerShade(
        ctx: CanvasRenderingContext2D,
        x: number,
        shade: number,
        top: number,
        height: number,
        strength: number,
        direction: 1 | -1,
    ): void {
        const start = direction === 1 ? x : x + shade;
        const end = direction === 1 ? x + shade : x;
        const gradient = ctx.createLinearGradient(start, 0, end, 0);

        gradient.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 1)');
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = gradient;
        ctx.fillRect(x, top, shade, height);
        ctx.restore();
    }
}