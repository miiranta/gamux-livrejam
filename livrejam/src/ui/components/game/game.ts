import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    afterNextRender,
    inject,
    signal,
    viewChild,
} from '@angular/core';

import {
    ANIMATION_FRAMES,
    CELL_SIZE,
    FRAME_SIZE,
    TILE,
    TILE_SCALE,
    TILE_SOURCE_SIZE,
    advance,
    animationRow,
    animationSheet,
    createCharacter,
    createRoom,
    drawSprite,
    loadImages,
    resolveAnimation,
    spriteOrigin,
    type AnimationName,
    type Character,
    type Facing,
    type ImageMap,
    type Intent,
    type Room,
} from '../../../engine';
import { PhysicsWorld } from '../../../engine/physics';

/** Escala da simulacao: as unidades do mundo sao multiplicadas por isto na tela. */
const VIEW_SCALE = 1.5;

const CHARACTER_GRAVITY = 900;
const WALK_SPEED = 110;
const RUN_SPEED = 190;
const JUMP_SPEED = 300;

/** Nivel de dano do personagem usado nesta cena. */
const DAMAGE_TIER = 0;

/** Limite de passo, para o loop nao "pular" quando a aba fica em segundo plano. */
const MAX_DELTA_SECONDS = 1 / 30;

type SpriteKey = 'wall' | 'floor' | 'walk' | 'run' | 'jump' | 'hurt';

/** Imagens da cena: os dois tiles e um sheet por animacao. */
type SceneAssets = ImageMap<SpriteKey>;

@Component({
    selector: 'app-game',
    templateUrl: './game.html',
    styleUrl: './game.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Game {
    private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
    private readonly destroyRef = inject(DestroyRef);

    private readonly world = new PhysicsWorld();
    private character: Character | null = null;
    private room: Room | null = null;
    private assets: SceneAssets | null = null;

    private animationFrameId: number | null = null;
    private lastTimestamp = 0;
    private intent: Intent = { moveX: 0, run: false, jump: false };
    private jumpQueued = false;

    protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');
    protected readonly errorMessage = signal('');
    protected readonly grounded = signal(false);
    protected readonly facing = signal<Facing>('down');
    protected readonly animation = signal<AnimationName>('walk');
    protected readonly debugColliders = signal(false);
    /** Texto de diagnostico fisico, atualizado enquanto o modo debug esta ligado. */
    protected readonly debugText = signal('');

    constructor() {
        afterNextRender(() => void this.start());
        this.destroyRef.onDestroy(() => this.stop());
    }

    private async start(): Promise<void> {
        try {
            this.assets = await loadImages<SpriteKey>({
                wall: TILE.wall,
                floor: TILE.floor,
                walk: animationSheet(DAMAGE_TIER, 'walk'),
                run: animationSheet(DAMAGE_TIER, 'run'),
                jump: animationSheet(DAMAGE_TIER, 'jump'),
                hurt: animationSheet(DAMAGE_TIER, 'hurt'),
            });

            this.room = createRoom({
                columns: 20,
                rows: 12,
                wallThickness: 2,
                floorThickness: 1,
            });
            for (const collider of this.room.colliders) {
                this.world.addBlocker(collider);
            }

            const feetY = this.room.floorTop;
            this.character = createCharacter({
                feet: { x: this.room.width / 2, y: feetY },
                gravity: CHARACTER_GRAVITY,
                walkSpeed: WALK_SPEED,
                runSpeed: RUN_SPEED,
                jumpSpeed: JUMP_SPEED,
            });

            this.resizeCanvas();
            this.bindInput();
            this.status.set('ready');
            this.lastTimestamp = performance.now();
            this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
        } catch (error) {
            this.status.set('error');
            this.errorMessage.set(error instanceof Error ? error.message : String(error));
        }
    }

    private stop(): void {
        this.stopLoop();
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
    }

    private bindInput(): void {
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
    }

    private stopLoop(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    private resizeCanvas(): void {
        const canvas = this.canvasRef()?.nativeElement;
        if (!canvas || !this.room) {
            return;
        }
        canvas.width = Math.round(this.room.width * VIEW_SCALE);
        canvas.height = Math.round(this.room.height * VIEW_SCALE);
    }

    private loop(timestamp: number): void {
        const dt = Math.min((timestamp - this.lastTimestamp) / 1000, MAX_DELTA_SECONDS);
        this.lastTimestamp = timestamp;

        this.update(dt);
        this.render();

        this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
    }

    private update(dt: number): void {
        const character = this.character;
        if (!character) {
            return;
        }

        const { body } = character.physics;
        const speed = this.intent.run ? character.runSpeed : character.walkSpeed;

        body.velocity.x = this.intent.moveX * speed;

        if (this.jumpQueued && body.grounded) {
            body.velocity.y = -character.jumpSpeed;
            this.jumpQueued = false;
        }
        this.jumpQueued = this.jumpQueued && !body.grounded;

        const result = this.world.step(character.physics, dt);

        if (this.intent.moveX !== 0) {
            character.facing = this.intent.moveX < 0 ? 'left' : 'right';
        }

        const moving = this.intent.moveX !== 0;
        const next = resolveAnimation(character.animation, this.intent, result.grounded, moving);
        if (next !== character.animation) {
            this.setAnimation(next);
        }

        this.advanceAnimation(character, dt, moving);

        this.grounded.set(result.grounded);
        this.facing.set(character.facing);
        this.animation.set(character.animation);

        if (this.debugColliders()) {
            this.debugText.set(this.describeState());
        }
    }

    /** Resumo do estado fisico, exibido no HUD quando o modo debug esta ligado. */
    private describeState(): string {
        const character = this.character;
        const room = this.room;
        if (!character || !room) {
            return '-';
        }
        const { position, velocity } = character.physics.body;
        const { width, height } = character.physics.size;
        const feet = position.y + height;
        return (
            `feet y=${feet.toFixed(0)} (chao ${room.floorTop}) · ` +
            `vel(${velocity.x.toFixed(0)}, ${velocity.y.toFixed(0)}) · ` +
            `colisores ${this.world.blockerCount}`
        );
    }

    private setAnimation(animation: AnimationName): void {
        const character = this.character;
        if (!character) {
            return;
        }
        character.animation = animation;
        character.frame = 0;
        character.elapsed = 0;
    }

    private advanceAnimation(character: Character, dt: number, moving: boolean): void {
        // parado no chao: congela a caminhada no primeiro frame, como pose de idle
        if (!moving && character.physics.body.grounded && character.animation === 'walk') {
            character.frame = 0;
            character.elapsed = 0;
            return;
        }

        const next = advance(character.animation, character.frame, character.elapsed, dt);
        character.frame = next.frame;
        character.elapsed = next.elapsed;

        if (next.finished) {
            this.setAnimation(character.physics.body.grounded ? 'walk' : 'jump');
        }
    }

    private render(): void {
        const canvas = this.canvasRef()?.nativeElement;
        const assets = this.assets;
        const room = this.room;
        const character = this.character;
        if (!canvas || !assets || !room || !character) {
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }

        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        this.renderRoom(ctx, room);
        this.renderCharacter(ctx, character);

        if (this.debugColliders()) {
            this.renderColliders(ctx, room, character);
        }
    }

    private renderRoom(ctx: CanvasRenderingContext2D, room: Room): void {
        const assets = this.assets;
        if (!assets) {
            return;
        }

        const tileSize = Math.ceil(TILE_SOURCE_SIZE * TILE_SCALE * VIEW_SCALE);
        for (const tile of room.tiles) {
            const x = Math.round(tile.column * CELL_SIZE * VIEW_SCALE);
            const y = Math.round(tile.row * CELL_SIZE * VIEW_SCALE);
            ctx.drawImage(assets[tile.kind], x, y, tileSize, tileSize);
        }
    }

    private renderCharacter(ctx: CanvasRenderingContext2D, character: Character): void {
        const assets = this.assets;
        if (!assets) {
            return;
        }

        const sheet = assets[character.animation];
        const frame = Math.min(character.frame, ANIMATION_FRAMES[character.animation] - 1);
        const row = animationRow(character.animation, character.facing);
        const origin = spriteOrigin(character);

        ctx.save();
        ctx.translate(
            Math.round(origin.x * VIEW_SCALE),
            Math.round(origin.y * VIEW_SCALE),
        );
        ctx.scale(VIEW_SCALE, VIEW_SCALE);
        drawSprite(ctx, sheet, frame, row, FRAME_SIZE, 0, 0);
        ctx.restore();
    }

    /** Desenha os colisores do cenario e a caixa do personagem, para depuracao. */
    private renderColliders(
        ctx: CanvasRenderingContext2D,
        room: Room,
        character: Character,
    ): void {
        ctx.save();
        ctx.lineWidth = 1;

        ctx.strokeStyle = 'rgba(125, 200, 255, 0.55)';
        for (const collider of room.colliders) {
            ctx.strokeRect(
                Math.round(collider.x * VIEW_SCALE) + 0.5,
                Math.round(collider.y * VIEW_SCALE) + 0.5,
                Math.round(collider.width * VIEW_SCALE),
                Math.round(collider.height * VIEW_SCALE),
            );
        }

        const { body, size } = character.physics;
        ctx.strokeStyle = '#7dffb0';
        ctx.strokeRect(
            Math.round(body.position.x * VIEW_SCALE) + 0.5,
            Math.round(body.position.y * VIEW_SCALE) + 0.5,
            Math.round(size.width * VIEW_SCALE),
            Math.round(size.height * VIEW_SCALE),
        );

        ctx.restore();
    }

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        switch (event.code) {
            case 'ArrowLeft':
            case 'KeyA':
                this.intent = { ...this.intent, moveX: -1 };
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.intent = { ...this.intent, moveX: 1 };
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.intent = { ...this.intent, run: true };
                break;
            case 'Space':
            case 'ArrowUp':
            case 'KeyW':
                event.preventDefault();
                this.jumpQueued = true;
                break;
            case 'KeyC':
                if (!event.repeat) {
                    this.debugColliders.update((on) => !on);
                    this.debugText.set(this.debugColliders() ? this.describeState() : '');
                }
                break;
            default:
                return;
        }
    };

    private readonly onKeyUp = (event: KeyboardEvent): void => {
        switch (event.code) {
            case 'ArrowLeft':
            case 'KeyA':
                if (this.intent.moveX === -1) {
                    this.intent = { ...this.intent, moveX: 0 };
                }
                break;
            case 'ArrowRight':
            case 'KeyD':
                if (this.intent.moveX === 1) {
                    this.intent = { ...this.intent, moveX: 0 };
                }
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.intent = { ...this.intent, run: false };
                break;
            default:
                return;
        }
    };
}