import { CanvasRenderer, drawSheetSprite } from '../../engine/render';
import type { Camera } from '../../engine/render';
import { clampFrame } from '../../engine/entities';
import { clamp } from '../../engine/math';
import type { CharacterAnimationKey, CharacterTierSprites, DungeonSprites } from '../assets';
import { CHARACTER_CLIPS, FALLBACK_ANIMATION } from '../assets';
import type { Dodger, Item } from '../entities';
import type { DungeonLevel } from '../level';
import type { Effect } from '../systems';
import { FACE_SMASHING } from '../config';
import { BackdropPainter } from './backdrop-painter';
import { TerrainRenderer } from './terrain-renderer';

const CHARACTER_FRAME_SIZE = 64;
const FOOT_OFFSET = 62;

export interface SceneDebug {
    colliders: boolean;
    effects: readonly Effect[];
}

export interface SceneFrame {
    deltaSeconds: number;
}

export class SceneRenderer {
    private readonly backdrop: BackdropPainter;
    private readonly terrain: TerrainRenderer;
    private worldLayer: HTMLCanvasElement | null = null;
    private worldSignature = '';

    constructor(
        private readonly renderer: CanvasRenderer,
        private readonly sprites: DungeonSprites,
    ) {
        this.backdrop = new BackdropPainter();
        this.terrain = new TerrainRenderer(sprites);
    }

    get camera(): Camera {
        return this.renderer.camera;
    }

    render(
        level: DungeonLevel,
        items: readonly Item[],
        dodger: Dodger,
        aimX: number,
        debug: SceneDebug,
        frame: SceneFrame,
    ): void {
        const ctx = this.renderer.context;

        ctx.drawImage(
            this.ensureWorldLayer(level),
            0,
            0,
            this.camera.viewportWidth,
            this.camera.viewportHeight,
        );

        for (const item of items) {
            if (!item.expired) {
                this.renderItem(item);
            }
        }

        this.renderBanners(level);
        this.renderDodger(dodger);
        this.renderProps(level);
        this.renderEffects(debug.effects);
        this.renderAim(level, aimX);

        if (debug.colliders) {
            this.renderColliders(level, items, dodger);
        }

        this.renderer.present(frame.deltaSeconds);
    }

    private ensureWorldLayer(level: DungeonLevel): HTMLCanvasElement {
        const { camera } = this;
        const signature = `${camera.viewportWidth}x${camera.viewportHeight}:${level.grid.tileSize}`;
        const cached = this.worldLayer;

        if (cached && this.worldSignature === signature) {
            return cached;
        }

        const canvas = cached ?? document.createElement('canvas');
        canvas.width = camera.viewportWidth;
        canvas.height = camera.viewportHeight;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            this.backdrop.paint(ctx, level, camera);
            this.terrain.paint(ctx, level, camera);
        }

        this.worldLayer = canvas;
        this.worldSignature = signature;
        return canvas;
    }

    private renderItem(item: Item): void {
        const image = this.sprites.items.get(item.definition.key);
        if (!image) {
            return;
        }

        const { camera } = this.renderer;
        const ctx = this.renderer.context;
        const screenWidth = camera.toScreenLength(item.halfWidth * 2);
        const screenHeight = camera.toScreenLength(item.halfHeight * 2);

        ctx.save();
        ctx.translate(camera.toScreenX(item.centerX), camera.toScreenY(item.centerY));
        ctx.rotate(item.angle);
        ctx.drawImage(image, -screenWidth / 2, -screenHeight / 2, screenWidth, screenHeight);
        ctx.restore();
    }

    private renderDodger(dodger: Dodger): void {
        const tier = this.sprites.character[dodger.level] ?? this.sprites.character[0];
        if (!tier) {
            return;
        }

        const key = this.pickAnimation(dodger, tier);
        const sheet = tier[key] ?? tier.walk;
        const clip = CHARACTER_CLIPS[key];
        const frame = clip ? clampFrame(clip, dodger.frame) : 0;
        const feet = dodger.feet;
        const row = dodger.spriteRow(CHARACTER_CLIPS);

        if (dodger.dashTrail.length > 0) {
            this.renderDashTrail(dodger, sheet, frame, row);
        }

        drawSheetSprite(this.renderer.context, sheet, this.camera, {
            column: frame,
            row,
            worldX: feet.x - CHARACTER_FRAME_SIZE / 2,
            worldY: feet.y - FOOT_OFFSET,
            width: CHARACTER_FRAME_SIZE,
            height: CHARACTER_FRAME_SIZE,
        });

        if (dodger.flash > 0) {
            this.renderFlash(dodger);
        }
    }

    private renderDashTrail(
        dodger: Dodger,
        sheet: CharacterTierSprites['walk'],
        frame: number,
        row: number,
    ): void {
        const config = FACE_SMASHING.dash;
        const ctx = this.renderer.context;
        const points = dodger.dashTrail;
        const strength = clamp(dodger.dashGlow / (config.seconds + config.trailAfter), 0, 1);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        for (let index = 0; index < points.length - 1; index++) {
            const distance = points.length - 1 - index;
            const age = 1 - distance / Math.max(points.length - 1, 1);
            const fade = age * config.trailAlpha * strength;
            const stretch = 1 + (1 - age) * 0.22;
            const point = points[index];

            if (fade <= 0.01) {
                continue;
            }

            ctx.globalAlpha = fade;
            drawSheetSprite(ctx, sheet, this.camera, {
                column: frame,
                row,
                worldX: point.x - (CHARACTER_FRAME_SIZE * stretch) / 2,
                worldY: point.y - FOOT_OFFSET,
                width: CHARACTER_FRAME_SIZE * stretch,
                height: CHARACTER_FRAME_SIZE,
            });
        }

        ctx.restore();
    }

    private pickAnimation(dodger: Dodger, tier: CharacterTierSprites): CharacterAnimationKey {
        const requested = dodger.animation as CharacterAnimationKey;
        return tier[requested] ? requested : FALLBACK_ANIMATION;
    }

    private renderFlash(dodger: Dodger): void {
        const { camera } = this.renderer;
        const ctx = this.renderer.context;
        const config = FACE_SMASHING.reaction;
        const alpha = Math.min(dodger.flash / Math.max(config.flashSeconds, 1e-3), 1) * 0.75;
        const feet = dodger.feet;
        const x = camera.toScreenX(feet.x - dodger.size.width / 2);
        const y = camera.toScreenY(feet.y - dodger.size.height);
        const width = camera.toScreenLength(dodger.size.width);
        const height = camera.toScreenLength(dodger.size.height);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = config.flashColor;
        ctx.fillRect(x, y, width, height);
        ctx.restore();
    }

    private renderProps(level: DungeonLevel): void {
        const { camera } = this.renderer;
        const ctx = this.renderer.context;
        const { grid } = level;
        const size = camera.toScreenLength(grid.tileSize);
        const bracket = this.sprites.props.bracket;
        const torch = this.sprites.props.torch;

        for (const placement of level.decorations.props) {
            const image = this.sprites.propDecor[placement.kind];
            const x = camera.toScreenX(grid.columnX(placement.column));
            const y = camera.toScreenY(grid.rowY(placement.row));

            ctx.save();
            ctx.globalAlpha = 0.82;
            ctx.drawImage(image, x, y, size, size);
            ctx.globalAlpha = 0.72;
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = FACE_SMASHING.backdrop.propTint;
            ctx.fillRect(x, y, size, size);
            ctx.restore();
        }

        for (const placement of level.decorations.torches) {
            const x = camera.toScreenX(grid.columnX(placement.column));
            const y = camera.toScreenY(grid.rowY(placement.row));

            ctx.save();
            ctx.globalAlpha = 0.9;
            ctx.drawImage(bracket, x, y, size, size);
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = FACE_SMASHING.backdrop.propTint;
            ctx.fillRect(x, y, size, size);
            ctx.restore();

            ctx.save();
            ctx.translate(x + size / 2, y + size / 2);
            ctx.scale(placement.facing, 1);
            ctx.drawImage(torch, -size / 2, -size / 2, size, size);
            ctx.restore();

            this.renderTorchGlow(x + size / 2, y + size / 2, size);
        }
    }

    private renderTorchGlow(centerX: number, centerY: number, size: number): void {
        const ctx = this.renderer.context;
        const radius = size * 2.4;
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);

        gradient.addColorStop(0, 'rgba(255, 186, 112, 0.34)');
        gradient.addColorStop(0.45, 'rgba(232, 140, 76, 0.13)');
        gradient.addColorStop(1, 'rgba(232, 140, 76, 0)');
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = gradient;
        ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
        ctx.restore();
    }

    private renderBanners(level: DungeonLevel): void {
        const { camera } = this.renderer;
        const ctx = this.renderer.context;
        const { grid } = level;
        const banner = this.sprites.propDecor.banner;
        const size = camera.toScreenLength(grid.tileSize);

        for (const tile of level.decorations.banners) {
            const x = camera.toScreenX(grid.columnX(tile.column));
            const y = camera.toScreenY(grid.rowY(tile.row));
            const isLeft = tile.column < grid.columns / 2;

            ctx.save();
            ctx.translate(x + size / 2, y);
            ctx.scale(isLeft ? 1 : -1, 1);
            ctx.globalAlpha = 0.85;
            ctx.drawImage(banner, -size / 2, 0, size, size);
            ctx.restore();
        }
    }

    private renderEffects(effects: readonly Effect[]): void {
        const { camera } = this.renderer;
        const ctx = this.renderer.context;

        for (const effect of effects) {
            const sheet = this.sprites.effects[effect.kind];
            drawSheetSprite(ctx, sheet, camera, {
                column: effect.frame,
                row: 0,
                worldX: effect.x - effect.size / 2,
                worldY: effect.y - effect.size / 2,
                width: effect.size,
                height: effect.size,
            });
        }
    }

    private renderAim(level: DungeonLevel, aimX: number): void {
        const { camera } = this.renderer;
        const ctx = this.renderer.context;
        const size = level.grid.tileSize;
        const x = camera.toScreenX(aimX - size / 2);
        const y = camera.toScreenY(level.spawnY - size);
        const side = camera.toScreenLength(size);

        ctx.save();
        ctx.fillStyle = 'rgba(125, 200, 255, 0.35)';
        ctx.fillRect(x, y, side, side);
        ctx.strokeStyle = '#7dc8ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(x + 1, y + 1, side - 2, side - 2);
        ctx.restore();
    }

    private renderColliders(level: DungeonLevel, items: readonly Item[], dodger: Dodger): void {
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
        for (const item of items) {
            if (item.expired) {
                continue;
            }

            ctx.save();
            ctx.translate(camera.toScreenX(item.centerX), camera.toScreenY(item.centerY));
            ctx.rotate(item.angle);
            ctx.strokeRect(
                -camera.toScreenLength(item.halfWidth),
                -camera.toScreenLength(item.halfHeight),
                camera.toScreenLength(item.halfWidth * 2),
                camera.toScreenLength(item.halfHeight * 2),
            );
            ctx.restore();
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