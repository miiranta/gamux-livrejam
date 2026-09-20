import type { Camera } from '../../engine/render';
import { autotileFrame } from '../../engine/level';
import type { DungeonSprites } from '../assets';
import { TREASURE_HUNTERS_AUTOTILE } from '../assets';
import type { DungeonLevel } from '../level';

export class TerrainRenderer {
    constructor(private readonly sprites: DungeonSprites) {}

    paint(ctx: CanvasRenderingContext2D, level: DungeonLevel, camera: Camera): void {
        this.paintCeilingBeam(ctx, level, camera);
        this.paintTiles(ctx, level, camera);
    }

    private paintCeilingBeam(
        ctx: CanvasRenderingContext2D,
        level: DungeonLevel,
        camera: Camera,
    ): void {
        const { grid } = level;
        const sheet = this.sprites.platforms;
        const frame = this.sprites.tileSize;
        const tile = camera.toScreenLength(grid.tileSize);
        const span = level.playRight - level.playLeft;
        const count = Math.ceil(span / grid.tileSize);
        const sourceRow = 2;
        const base = camera.toScreenY(level.ceilingBottom - grid.tileSize);

        for (let index = 0; index < count; index++) {
            const column = 1 + (index % 4);
            const x = camera.toScreenX(level.playLeft + index * grid.tileSize);

            ctx.drawImage(
                sheet,
                column * frame,
                sourceRow * frame,
                frame,
                frame,
                x,
                base,
                tile,
                tile,
            );
        }
    }

    private paintTiles(
        ctx: CanvasRenderingContext2D,
        level: DungeonLevel,
        camera: Camera,
    ): void {
        const { grid } = level;
        const size = camera.toScreenLength(grid.tileSize);
        const sheet = this.sprites.autotile;
        const frame = this.sprites.tileSize;

        for (const tile of level.tiles) {
            const source = autotileFrame(tile.index, TREASURE_HUNTERS_AUTOTILE);

            ctx.drawImage(
                sheet,
                source.column * frame,
                source.row * frame,
                frame,
                frame,
                camera.toScreenX(grid.columnX(tile.column)),
                camera.toScreenY(grid.rowY(tile.row)),
                size,
                size,
            );
        }
    }
}
