import { CanvasRenderer, drawSheetSprite, drawTiledSprite } from '../../engine/render';
import type { Camera } from '../../engine/render';
import { clampFrame } from '../../engine/entities';
import type { CharacterAnimationKey, DungeonSprites } from '../assets';
import { CHARACTER_CLIPS, fallerSpriteSize } from '../assets';
import type { Dodger, Faller } from '../entities';
import type { DungeonLevel } from '../level';
import { DUNGEON_DROP } from '../config';

const CHARACTER_FRAME_SIZE = 64;
const FOOT_OFFSET = 62;

export interface SceneDebug {
    colliders: boolean;
}

export class SceneRenderer {
    constructor(
        private readonly renderer: CanvasRenderer,
        private readonly sprites: DungeonSprites,
    ) {}

    get camera(): Camera {
        return this.renderer.camera;
    }

    render(
        level: DungeonLevel,
        fallers: readonly Faller[],
        dodger: Dodger,
        aimX: number,
        debug: SceneDebug,
    ): void {
        const { camera } = this.renderer;
        const ctx = this.renderer.context;

        this.renderer.clear(DUNGEON_DROP.background);
        this.renderTiles(level);

        for (const faller of fallers) {
            if (faller.expired) {
                continue;
            }

            drawTiledSprite(
                ctx,
                this.sprites.fallers[faller.sprite],
                camera,
                faller.position.x,
                faller.position.y,
                faller.size,
            );
        }

        this.renderDodger(dodger);
        this.renderAim(level, aimX);

        if (debug.colliders) {
            this.renderColliders(level, fallers, dodger);
        }

        this.renderer.present();
    }

    private renderAim(level: DungeonLevel, aimX: number): void {
        const { camera } = this.renderer;
        const ctx = this.renderer.context;
        const size = fallerSpriteSize();
        const x = camera.toScreenX(aimX - size / 2);
        const y = camera.toScreenY(level.spawnY - size);
        const side = camera.toScreenLength(size);

        ctx.save();
        ctx.strokeStyle = 'rgba(125, 200, 255, 0.7)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, side, side);
        ctx.restore();
    }

    private renderTiles(level: DungeonLevel): void {
        const { camera } = this.renderer;
        const ctx = this.renderer.context;
        const { tileSize } = level.grid;

        for (const tile of level.tiles) {
            drawTiledSprite(
                ctx,
                this.sprites.tiles[tile.kind],
                camera,
                level.grid.columnX(tile.column),
                level.grid.rowY(tile.row),
                tileSize,
            );
        }
    }

    private renderDodger(dodger: Dodger): void {
        const { camera } = this.renderer;
        const ctx = this.renderer.context;
        const key = dodger.animation as CharacterAnimationKey;
        const sheet = this.sprites.character[key];

        if (!sheet) {
            return;
        }

        const clip = CHARACTER_CLIPS[key];
        const frame = clip ? clampFrame(clip, dodger.frame) : 0;
        const row = dodger.spriteRow(CHARACTER_CLIPS);
        const feet = dodger.feet;

        drawSheetSprite(ctx, sheet, camera, {
            column: frame,
            row,
            worldX: feet.x - CHARACTER_FRAME_SIZE / 2,
            worldY: feet.y - FOOT_OFFSET,
            width: CHARACTER_FRAME_SIZE,
            height: CHARACTER_FRAME_SIZE,
        });
    }

    private renderColliders(level: DungeonLevel, fallers: readonly Faller[], dodger: Dodger): void {
        const { camera } = this.renderer;
        const ctx = this.renderer.context;

        ctx.save();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(125, 200, 255, 0.55)';

        for (const collider of level.colliders) {
            ctx.strokeRect(
                camera.toScreenX(collider.x) + 0.5,
                camera.toScreenY(collider.y) + 0.5,
                camera.toScreenLength(collider.width),
                camera.toScreenLength(collider.height),
            );
        }

        ctx.strokeStyle = 'rgba(255, 156, 156, 0.75)';
        for (const faller of fallers) {
            if (faller.expired) {
                continue;
            }

            const box = faller.physics.body.position;
            ctx.strokeRect(
                camera.toScreenX(box.x) + 0.5,
                camera.toScreenY(box.y) + 0.5,
                camera.toScreenLength(faller.size),
                camera.toScreenLength(faller.size),
            );
        }

        const { body, size } = dodger.physics;
        ctx.strokeStyle = '#7dffb0';
        ctx.strokeRect(
            camera.toScreenX(body.position.x) + 0.5,
            camera.toScreenY(body.position.y) + 0.5,
            camera.toScreenLength(size.width),
            camera.toScreenLength(size.height),
        );

        ctx.restore();
    }
}
