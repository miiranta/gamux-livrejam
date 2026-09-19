import { GameLoop } from '../engine/loop';
import { KeyboardActionMap, readAxisIntent } from '../engine/input';
import { Camera, CanvasRenderer } from '../engine/render';
import { PhysicsWorld } from '../engine/physics';
import { CHARACTER_CLIPS, loadDungeonSprites } from './assets';
import type { PolicyLike } from './ai';
import { IdlePolicy, createObservationBuffer, decodeAction, writeObservation } from './ai';
import type { ActionIntent } from './ai';
import { DUNGEON_DROP } from './config';
import { Dodger, Faller, randomMaxSpeed } from './entities';
import type { DungeonLevel } from './level';
import { createDungeonLevel } from './level';
import { SceneRenderer } from './render';
import { FallerSpawner, ImpactSystem } from './systems';

export type DropAction = 'left' | 'right' | 'fastFall' | 'drop';

export interface DropStats {
    score: number;
    best: number;
    survived: number;
    dodges: number;
    nearMisses: number;
    dodgerSpeed: number;
    fallerSpeed: number;
}

export interface DungeonDropCallbacks {
    onStats: (stats: DropStats) => void;
}

export interface DungeonDropOptions {
    canvas: HTMLCanvasElement;
    callbacks: DungeonDropCallbacks;
    random?: () => number;
    policy?: PolicyLike;
}

const KEY_BINDINGS: Record<string, DropAction> = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ArrowDown: 'fastFall',
    KeyS: 'fastFall',
    Space: 'drop',
};

const DODGER_ANIMATIONS = CHARACTER_CLIPS;
const DROPPED_ACCELERATION = 400;

export class DungeonDrop {
    private readonly level: DungeonLevel;
    private readonly world = new PhysicsWorld();
    private readonly input: KeyboardActionMap<DropAction>;
    private readonly spawner: FallerSpawner;
    private readonly impacts = new ImpactSystem();
    private readonly loop: GameLoop;
    private readonly observation = createObservationBuffer();
    private readonly random: () => number;
    private readonly callbacks: DungeonDropCallbacks;

    private scene: SceneRenderer | null = null;
    private dodger: Dodger | null = null;
    private fallers: Faller[] = [];
    private active: Faller | null = null;
    private policy: PolicyLike;
    private action: ActionIntent = { axis: 0, jump: false };
    private dropLatch = false;
    private deathTimer = 0;
    private survived = 0;
    private dodges = 0;
    private nearMisses = 0;
    private score = 0;
    private best = 0;
    private showColliders = false;

    constructor(private readonly options: DungeonDropOptions) {
        this.random = options.random ?? Math.random;
        this.callbacks = options.callbacks;
        this.policy = options.policy ?? new IdlePolicy();
        this.level = createDungeonLevel();
        this.world.addBlockers(this.level.colliders);
        this.input = new KeyboardActionMap<DropAction>(KEY_BINDINGS);
        this.spawner = new FallerSpawner({ level: this.level, random: this.random });
        this.loop = new GameLoop({
            update: (dt) => this.update(dt),
            render: () => this.render(),
            fixedTimeStep: 1 / 60,
        });
    }

    get viewWidth(): number {
        return Math.round(this.level.grid.width * DUNGEON_DROP.viewScale);
    }

    get viewHeight(): number {
        return Math.round(this.level.grid.height * DUNGEON_DROP.viewScale);
    }

    get dodgerMaxSpeed(): number {
        return this.dodger?.maxSpeedX ?? 0;
    }

    async start(): Promise<void> {
        const sprites = await loadDungeonSprites();
        const renderer = new CanvasRenderer(
            this.options.canvas,
            new Camera({
                scale: DUNGEON_DROP.viewScale,
                viewportWidth: this.viewWidth,
                viewportHeight: this.viewHeight,
            }),
        );
        renderer.resize(this.viewWidth, this.viewHeight);

        this.scene = new SceneRenderer(renderer, sprites);
        this.respawn();
        this.loop.start();
    }

    stop(): void {
        this.loop.stop();
        this.input.dispose();
    }

    setPolicy(policy: PolicyLike): void {
        this.policy = policy;
    }

    accelerate(): void {
        this.spawner.accelerate();
    }

    toggleColliders(): void {
        this.showColliders = !this.showColliders;
    }

    restart(): void {
        this.fallers = [];
        this.active = null;
        this.deathTimer = 0;
        this.survived = 0;
        this.dodges = 0;
        this.nearMisses = 0;
        this.score = 0;
        this.spawner.reset();
        this.impacts.reset();
        this.respawn();
        this.publishStats();
    }

    private respawn(): void {
        this.dodger = new Dodger({
            feetX: this.level.grid.left + this.level.grid.width / 2,
            feetY: this.level.floorTop,
            maxSpeedX: randomMaxSpeed(this.random),
        });
    }

    private update(dt: number): void {
        this.updateDropper(dt);
        this.updateDodger(dt);
        this.updateFallers(dt);
        this.updateRound(dt);
        this.observe();
    }

    private updateDropper(dt: number): void {
        const intent = readAxisIntent(this.input, {
            negative: 'left',
            positive: 'right',
            fast: 'fastFall',
        });
        const active = this.active;

        if (active && active.state === 'falling') {
            const body = active.physics.body;
            body.velocity.x = intent.axis * DUNGEON_DROP.drop.horizontalSpeed;
            body.velocity.y = intent.fast
                ? DUNGEON_DROP.drop.fastFallSpeed
                : Math.min(body.velocity.y + DROPPED_ACCELERATION * dt, DUNGEON_DROP.drop.maxSpeed);
        }

        const pressed = this.input.isDown('drop');
        if (pressed && !this.dropLatch) {
            this.dropFaller();
        }
        this.dropLatch = pressed;
    }

    private dropFaller(): void {
        const active = this.active;

        if (active && active.state === 'falling') {
            active.physics.body.velocity.y = DUNGEON_DROP.drop.fastFallSpeed;
            return;
        }

        const spawned = this.spawner.spawn();
        this.active = spawned;
        this.fallers.push(spawned);
    }

    private updateDodger(dt: number): void {
        const dodger = this.dodger;
        if (!dodger) {
            return;
        }

        if (this.deathTimer > 0) {
            this.world.step(dodger.physics, dt);
            dodger.advanceAnimation(dt, DODGER_ANIMATIONS);
            return;
        }

        this.action = this.policy.ready
            ? decodeAction(this.policy.decide(this.observation))
            : { axis: 0, jump: false };

        dodger.move(this.action.axis, dt);

        if (this.action.jump) {
            dodger.requestJump();
        }

        this.world.step(dodger.physics, dt);
        dodger.resolveAnimation();
        dodger.advanceAnimation(dt, DODGER_ANIMATIONS);
    }

    private updateFallers(dt: number): void {
        for (const faller of this.fallers) {
            const result = this.world.step(faller.physics, dt);
            faller.applyCollision(result);
            faller.update(dt);
        }

        this.fallers = this.fallers.filter(
            (faller) => !faller.expired && faller.position.y < this.level.despawnY,
        );

        if (this.active && this.active.expired) {
            this.active = null;
        }
    }

    private updateRound(dt: number): void {
        const dodger = this.dodger;
        if (!dodger) {
            return;
        }

        if (this.deathTimer > 0) {
            this.deathTimer -= dt;

            if (this.deathTimer <= 0) {
                this.best = Math.max(this.best, Math.round(this.score));
                this.restart();
            }
            return;
        }

        this.survived += dt;
        this.score += DUNGEON_DROP.score.survivedPerSecond * dt;

        const outcome = this.impacts.evaluate(this.fallers, dodger);

        if (outcome.hit) {
            this.deathTimer = DUNGEON_DROP.dodger.deathDelay;
            dodger.setAnimation('hurt');
            dodger.physics.body.velocity.y = -240;
            this.publishStats();
            return;
        }

        this.dodges += outcome.dodges;
        this.nearMisses += outcome.nearMisses;
        this.score +=
            outcome.dodges * DUNGEON_DROP.score.dodge +
            outcome.nearMisses * DUNGEON_DROP.score.nearMiss;

        this.publishStats();
    }

    private observe(): void {
        const dodger = this.dodger;
        if (!dodger) {
            return;
        }

        writeObservation(this.observation, {
            level: this.level,
            dodger,
            fallers: this.fallers,
        });
    }

    private publishStats(): void {
        this.callbacks.onStats({
            score: Math.round(this.score),
            best: this.best,
            survived: this.survived,
            dodges: this.dodges,
            nearMisses: this.nearMisses,
            dodgerSpeed: Math.round(this.dodgerMaxSpeed),
            fallerSpeed: Math.round(this.spawner.speed),
        });
    }

    private render(): void {
        const scene = this.scene;
        const dodger = this.dodger;
        if (!scene || !dodger) {
            return;
        }

        scene.render(this.level, this.fallers, dodger, { colliders: this.showColliders });
    }
}