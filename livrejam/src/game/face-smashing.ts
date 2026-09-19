import { GameLoop } from '../engine/loop';
import { KeyboardActionMap, readAxisIntent } from '../engine/input';
import { clamp } from '../engine/math';
import { Camera, CanvasRenderer } from '../engine/render';
import { PhysicsWorld } from '../engine/physics';
import { CHARACTER_CLIPS, loadDungeonSprites } from './assets';
import type { ActionIntent, PolicyLike } from './ai';
import { IdlePolicy, createObservationBuffer, decodeAction, writeObservation } from './ai';
import { FACE_SMASHING } from './config';
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
    /** Seconds left in the current match (0 once the match is over). */
    timeLeft: number;
    /** Length of the current match, in seconds. */
    matchDuration: number;
}

export interface FaceSmashingCallbacks {
    onStats: (stats: DropStats) => void;
    /** Fired once when the match timer reaches zero. */
    onMatchEnd?: (stats: DropStats) => void;
}

export interface FaceSmashingOptions {
    canvas: HTMLCanvasElement;
    callbacks: FaceSmashingCallbacks;
    random?: () => number;
    policy?: PolicyLike;
    /** Match length in seconds; falls back to the configured default. */
    matchDurationSeconds?: number;
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

function normalizeMatchDuration(seconds: number | undefined): number {
    const { defaultDurationSeconds, minDurationSeconds, maxDurationSeconds } = FACE_SMASHING.match;
    const value = Number.isFinite(seconds) ? Number(seconds) : defaultDurationSeconds;
    return clamp(value, minDurationSeconds, maxDurationSeconds);
}

export class FaceSmashing {
    private readonly level: DungeonLevel;
    private readonly world = new PhysicsWorld();
    private readonly input: KeyboardActionMap<DropAction>;
    private readonly spawner: FallerSpawner;
    private readonly impacts = new ImpactSystem();
    private readonly loop: GameLoop;
    private readonly observation = createObservationBuffer();
    private readonly random: () => number;
    private readonly callbacks: FaceSmashingCallbacks;

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
    private dropAimX = 0;
    private paused = false;
    private matchDuration: number;
    private timeLeft: number;
    private matchOver = false;

    constructor(private readonly options: FaceSmashingOptions) {
        this.random = options.random ?? Math.random;
        this.callbacks = options.callbacks;
        this.policy = options.policy ?? new IdlePolicy();
        this.matchDuration = normalizeMatchDuration(options.matchDurationSeconds);
        this.timeLeft = this.matchDuration;
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
        return Math.round(this.level.grid.width * FACE_SMASHING.viewScale);
    }

    get viewHeight(): number {
        return Math.round(this.level.grid.height * FACE_SMASHING.viewScale);
    }

    get dodgerMaxSpeed(): number {
        return this.dodger?.maxSpeedX ?? 0;
    }

    async start(): Promise<void> {
        const sprites = await loadDungeonSprites();
        const renderer = new CanvasRenderer(
            this.options.canvas,
            new Camera({
                scale: FACE_SMASHING.viewScale,
                viewportWidth: this.viewWidth,
                viewportHeight: this.viewHeight,
            }),
        );
        renderer.resize(this.viewWidth, this.viewHeight);

        this.scene = new SceneRenderer(renderer, sprites);
        this.dropAimX = this.level.grid.left + this.level.grid.width / 2;
        this.respawn();
        this.loop.start();
    }

    stop(): void {
        this.loop.stop();
        this.input.dispose();
        this.paused = false;
    }

    setPolicy(policy: PolicyLike): void {
        this.policy = policy;
    }

    pause(): void {
        if (this.paused) {
            return;
        }

        this.paused = true;
        this.loop.stop();
        // Release every key so the dropper does not "stick" after resuming.
        this.input.clear();
    }

    resume(): void {
        if (!this.paused || this.matchOver) {
            return;
        }

        this.paused = false;
        this.loop.start();
    }

    /** Sets the match length and starts a fresh match with it. */
    setMatchDuration(seconds: number): void {
        this.matchDuration = normalizeMatchDuration(seconds);
        this.restart();
    }

    accelerate(): void {
        this.spawner.accelerate();
    }

    toggleColliders(): void {
        this.showColliders = !this.showColliders;
    }

    /** Starts a brand-new match: full timer, cleared score. */
    restart(): void {
        this.matchOver = false;
        this.timeLeft = this.matchDuration;
        this.resetRound();
    }

    /**
     * Clears the current round (dodger, fallers, counters) but leaves the
     * match clock and `best` alone — dying respawns the player without
     * restarting the match.
     */
    private resetRound(): void {
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
        const airborne = active !== null && active.state === 'falling';

        if (airborne && active) {
            const body = active.physics.body;
            body.velocity.x = intent.axis * FACE_SMASHING.drop.horizontalSpeed;
            body.velocity.y = intent.fast
                ? FACE_SMASHING.drop.fastFallSpeed
                : Math.min(
                      body.velocity.y + DROPPED_ACCELERATION * dt,
                      FACE_SMASHING.drop.maxSpeed,
                  );
        } else if (intent.axis !== 0) {
            this.dropAimX = clamp(
                this.dropAimX + intent.axis * FACE_SMASHING.drop.aimSpeed * dt,
                this.level.playLeft,
                this.level.playRight,
            );
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
            active.physics.body.velocity.y = FACE_SMASHING.drop.fastFallSpeed;
            return;
        }

        const spawned = this.spawner.spawn(this.dropAimX);
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
        const spawned = this.spawner.update(dt, this.aimPoint());
        if (spawned) {
            this.fallers.push(spawned);
        }

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

    private aimPoint(): number {
        const dodger = this.dodger;
        if (!dodger) {
            return this.level.grid.left + this.level.grid.width / 2;
        }

        const { velocity, position } = dodger.physics.body;
        const travel = this.level.floorTop - position.y;
        const leadSeconds = Math.min(travel / FACE_SMASHING.faller.maxFallSpeed, 0.6);
        return dodger.feet.x + velocity.x * leadSeconds;
    }

    private updateRound(dt: number): void {
        const dodger = this.dodger;
        if (!dodger || this.matchOver) {
            return;
        }

        this.timeLeft = Math.max(0, this.timeLeft - dt);

        if (this.timeLeft <= 0) {
            this.endMatch();
            return;
        }

        if (this.deathTimer > 0) {
            this.deathTimer -= dt;

            if (this.deathTimer <= 0) {
                // Dying respawns the player; the match clock keeps running.
                this.best = Math.max(this.best, Math.round(this.score));
                this.resetRound();
            }
            return;
        }

        this.survived += dt;
        this.score += FACE_SMASHING.score.survivedPerSecond * dt;

        const outcome = this.impacts.evaluate(this.fallers, dodger);

        if (outcome.hit) {
            this.deathTimer = FACE_SMASHING.dodger.deathDelay;
            dodger.setAnimation('hurt');
            dodger.physics.body.velocity.y = -240;
            this.publishStats();
            return;
        }

        this.dodges += outcome.dodges;
        this.nearMisses += outcome.nearMisses;
        this.score +=
            outcome.dodges * FACE_SMASHING.score.dodge +
            outcome.nearMisses * FACE_SMASHING.score.nearMiss;

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
            timeLeft: this.timeLeft,
            matchDuration: this.matchDuration,
        });
    }

    private endMatch(): void {
        this.matchOver = true;
        this.timeLeft = 0;
        this.best = Math.max(this.best, Math.round(this.score));
        this.input.clear();
        this.publishStats();
        this.callbacks.onMatchEnd?.({
            score: Math.round(this.score),
            best: this.best,
            survived: this.survived,
            dodges: this.dodges,
            nearMisses: this.nearMisses,
            dodgerSpeed: Math.round(this.dodgerMaxSpeed),
            fallerSpeed: Math.round(this.spawner.speed),
            timeLeft: 0,
            matchDuration: this.matchDuration,
        });
    }

    private render(): void {
        const scene = this.scene;
        const dodger = this.dodger;
        if (!scene || !dodger) {
            return;
        }

        scene.render(this.level, this.fallers, dodger, this.dropAimX, {
            colliders: this.showColliders,
        });
    }
}
