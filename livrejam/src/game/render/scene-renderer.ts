import { CanvasRenderer, applyFx, createFxState, drawSheetSprite, shakeOffset, wobble } from '../../engine/render';
import type { Camera, SpriteFxState } from '../../engine/render';
import { clampFrame } from '../../engine/entities';
import { clamp } from '../../engine/math';
import type { CharacterAnimationKey, CharacterTierSprites, DungeonSprites } from '../assets';
import { CHARACTER_CLIPS, FALLBACK_ANIMATION } from '../assets';
import type { Dodger, Item } from '../entities';
import type { DungeonLevel } from '../level';
import type { Effect, ScorePopup } from '../systems';
import { scorePopupPose } from '../systems';
import { FACE_SMASHING } from '../config';
import { BackdropPainter } from './backdrop-painter';
import { ParticleSystem } from './particle-system';
import { PropPainter } from './prop-painter';
import { TerrainRenderer } from './terrain-renderer';

const CHARACTER_FRAME_SIZE = 64;
const FOOT_OFFSET = 62;
const VOID_COLOR = '#0b0705';

export interface SceneDebug {
    colliders: boolean;
    effects: readonly Effect[];
    scorePopups: readonly ScorePopup[];
}

export interface SceneFrame {
    deltaSeconds: number;
}

export class SceneRenderer {
    private readonly terrain: TerrainRenderer;
    private readonly backdrop: BackdropPainter;
    private readonly props: PropPainter;
    private readonly particles: ParticleSystem;
    private worldLayer: HTMLCanvasElement | null = null;
    private worldSignature = '';
    private elapsed = 0;

    constructor(
        private readonly renderer: CanvasRenderer,
        private readonly sprites: DungeonSprites,
    ) {
        this.terrain = new TerrainRenderer(sprites);
        this.backdrop = new BackdropPainter(sprites.backdrop);
        this.props = new PropPainter(sprites);
        this.particles = new ParticleSystem(sprites);
    }

    get camera(): Camera {
        return this.renderer.camera;
    }

    render(
        level: DungeonLevel,
        items: readonly Item[],
        dodger: Dodger,
        debug: SceneDebug,
        frame: SceneFrame,
    ): void {
        const ctx = this.renderer.context;

        this.elapsed += frame.deltaSeconds;
        this.particles.update(level, frame.deltaSeconds);

        ctx.fillStyle = VOID_COLOR;
        ctx.fillRect(0, 0, this.camera.viewportWidth, this.camera.viewportHeight);

        this.backdrop.paint(ctx, level, this.camera);
        this.props.paint(ctx, level, this.camera, this.elapsed, 0);
        ctx.drawImage(
            this.ensureWorldLayer(level),
            0,
            0,
            this.camera.viewportWidth,
            this.camera.viewportHeight,
        );
        this.props.paint(ctx, level, this.camera, this.elapsed, 1);
        this.particles.paint(ctx, level, this.camera);

        for (const item of items) {
            if (!item.expired) {
                this.renderItem(item);
            }
        }

        this.renderDodger(dodger);
        this.props.paint(ctx, level, this.camera, this.elapsed, 2);
        this.renderEffects(debug.effects);
        this.renderScorePopups(debug.scorePopups);

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
            ctx.clearRect(0, 0, canvas.width, canvas.height);
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
        const opacity = item.opacity;

        if (opacity <= 0) {
            return;
        }

        const scale = item.appearScale;
        const half = scale / 2;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(camera.toScreenX(item.centerX), camera.toScreenY(item.centerY));
        ctx.rotate(item.angle);
        ctx.drawImage(
            image,
            -screenWidth * half,
            -screenHeight * half,
            screenWidth * scale,
            screenHeight * scale,
        );
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
        const fx = this.dodgerFx(dodger);

        if (dodger.dashTrail.length > 0) {
            this.renderDashTrail(dodger, sheet, frame, row);
        }

        const ctx = this.renderer.context;
        const centerX = this.camera.toScreenX(feet.x);
        const centerY = this.camera.toScreenY(feet.y - FOOT_OFFSET / 2);

        ctx.save();
        applyFx(ctx, fx, centerX, centerY);
        drawSheetSprite(ctx, sheet, this.camera, {
            column: frame,
            row,
            worldX: feet.x - CHARACTER_FRAME_SIZE / 2,
            worldY: feet.y - FOOT_OFFSET,
            width: CHARACTER_FRAME_SIZE,
            height: CHARACTER_FRAME_SIZE,
        });
        ctx.restore();

        if (fx.flash > 0) {
            this.renderFlash(dodger, fx);
        }
    }

    private dodgerFx(dodger: Dodger): SpriteFxState {
        const fx = createFxState();
        const config = FACE_SMASHING.reaction;
        const hurt = clamp(dodger.flash / Math.max(config.flashSeconds, 1e-3), 0, 1);

        fx.flash = hurt;
        fx.scaleX = 1 + hurt * 0.16;
        fx.scaleY = 1 - hurt * 0.12;
        fx.skewX = hurt * 0.12;

        if (dodger.stun > 0) {
            const stun = clamp(dodger.stun / Math.max(config.stunSeconds, 1e-3), 0, 1);
            const shake = shakeOffset(2.4 * stun, 34, this.elapsed, 0x51ed270b);

            fx.offsetX += shake.x;
            fx.offsetY += shake.y;
            fx.rotation += wobble(0.05 * stun, 9, this.elapsed);
        }

        if (dodger.dashGlow > 0) {
            const dash = clamp(dodger.dashGlow / FACE_SMASHING.dash.seconds, 0, 1);

            fx.scaleX += dash * 0.3;
            fx.scaleY -= dash * 0.14;
        }

        return fx;
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

    private renderFlash(dodger: Dodger, fx: SpriteFxState): void {
        const { camera } = this.renderer;
        const ctx = this.renderer.context;
        const config = FACE_SMASHING.reaction;
        const feet = dodger.feet;
        const centerX = camera.toScreenX(feet.x);
        const centerY = camera.toScreenY(feet.y - FOOT_OFFSET / 2);
        const x = camera.toScreenX(feet.x - dodger.size.width / 2);
        const y = camera.toScreenY(feet.y - dodger.size.height);
        const width = camera.toScreenLength(dodger.size.width);
        const height = camera.toScreenLength(dodger.size.height);

        ctx.save();
        applyFx(ctx, fx, centerX, centerY);
        ctx.globalAlpha = fx.flash * 0.75;
        ctx.fillStyle = config.flashColor;
        ctx.fillRect(x, y, width, height);
        ctx.restore();
    }

    private renderEffects(effects: readonly Effect[]): void {
        const { camera } = this.renderer;
        const ctx = this.renderer.context;

        for (const effect of effects) {
            const sheet = this.sprites.effects[effect.kind];
            const progress = effect.frame / Math.max(sheet.frames - 1, 1);
            const centerX = camera.toScreenX(effect.x);
            const centerY = camera.toScreenY(effect.y);
            const fx = createFxState();

            fx.scaleX = 1 + progress * 0.22;
            fx.scaleY = 1 + progress * 0.22;
            fx.rotation = effect.angle + wobble(0.04, 6, this.elapsed + effect.elapsed);
            fx.flash = effect.kind === 'explosion' ? Math.max(0, 1 - progress * 3) : 0;

            ctx.save();
            applyFx(ctx, fx, centerX, centerY);
            drawSheetSprite(ctx, sheet, camera, {
                column: effect.frame,
                row: 0,
                worldX: effect.x - effect.size / 2,
                worldY: effect.y - effect.size / 2,
                width: effect.size,
                height: effect.size,
            });
            ctx.restore();
        }
    }

    private renderScorePopups(popups: readonly ScorePopup[]): void {
        if (popups.length === 0) {
            return;
        }

        const { camera } = this.renderer;
        const ctx = this.renderer.context;
        const config = FACE_SMASHING.scorePopup;

        ctx.save();
        ctx.font = `${config.fontSize}px 'Pixelify Sans', system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 4;
        ctx.strokeStyle = config.outline;

        for (const popup of popups) {
            const progress = clamp(popup.elapsed / config.duration, 0, 1);
            const pose = scorePopupPose(progress);
            const x = camera.toScreenX(popup.x);
            const y = camera.toScreenY(popup.y) - camera.toScreenLength(pose.rise);
            const label = `+${popup.amount}`;

            ctx.save();
            ctx.globalAlpha = pose.alpha;
            ctx.translate(x, y);
            ctx.scale(pose.scale, pose.scale);
            ctx.strokeText(label, 0, 0);
            ctx.fillStyle = config.color;
            ctx.fillText(label, 0, 0);
            ctx.restore();
        }

        ctx.restore();
    }

    private renderColliders(level: DungeonLevel, items: readonly Item[], dodger: Dodger): void {
        const { camera } = this.renderer;
        const ctx = this.renderer.context;

        ctx.save();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(224, 164, 74, 0.55)';

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
