import { GameLoop } from '../engine/loop';
import { KeyboardActionMap, readAxisIntent } from '../engine/input';
import { clamp } from '../engine/math';
import { Camera, CanvasRenderer } from '../engine/render';
import { PhysicsWorld } from '../engine/physics';
import { CHARACTER_CLIPS, loadDungeonSprites } from './assets';
import type { ActionIntent, PolicyLike } from './ai';
import { IdlePolicy, createObservationBuffer, decodeAction, writeObservation } from './ai';
import { FACE_SMASHING } from './config';
import { Dodger, Item } from './entities';
import type { DungeonLevel } from './level';
import { createDungeonLevel } from './level';
import { SceneRenderer } from './render';
import {
    ItemSpawner,
    ImpactSystem,
    EffectSystem,
    ScorePopupSystem,
    SteeringSystem,
    hitPoints,
} from './systems';
import type { ImpactOutcome, SteeringMode } from './systems';
import type { TrackingFrame } from '../engine/tracking';

/** Keyboard actions that only aim and trigger the dodger's dash. */
export type DashAction = 'left' | 'right' | 'dash';

export interface MatchStats {
    score: number;
    best: number;
    survived: number;
    dodges: number;
    nearMisses: number;
    damage: number;
    level: number;
    dodgerSpeed: number;
    dropSpeed: number;
    dashReady: number;
    timeLeft: number;
    matchDuration: number;
}

export interface FaceSmashingCallbacks {
    onStats: (stats: MatchStats) => void;
    onMatchEnd?: (result: MatchStats) => void;
    /** The dodger just took a hit; `tierChange` > 0 when the damage tier rose. */
    onHit?: (damage: number, tierChange: number) => void;
}

export interface FaceSmashingOptions {
    canvas: HTMLCanvasElement;
    callbacks: FaceSmashingCallbacks;
    random?: () => number;
    matchDuration?: number;
    policy?: PolicyLike;
    /** Defaults to the hand gesture (`67`). */
    steeringMode?: SteeringMode;
}

const KEY_BINDINGS: Record<string, DashAction> = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ShiftLeft: 'dash',
    ShiftRight: 'dash',
};

const DODGER_ANIMATIONS = CHARACTER_CLIPS;
const DROPPED_ACCELERATION = 400;

export class FaceSmashing {
    private readonly level: DungeonLevel;
    private readonly world = new PhysicsWorld();
    private readonly input: KeyboardActionMap<DashAction>;
    private readonly spawner: ItemSpawner;
    private readonly impacts = new ImpactSystem();
    private readonly effects = new EffectSystem(FACE_SMASHING.effects);
    private readonly scorePopups = new ScorePopupSystem();
    private readonly steering: SteeringSystem;
    private readonly loop: GameLoop;
    private readonly observation = createObservationBuffer();
    private readonly random: () => number;
    private readonly callbacks: FaceSmashingCallbacks;

    private scene: SceneRenderer | null = null;
    private dodger: Dodger | null = null;
    private items: Item[] = [];
    private active: Item | null = null;
    private policy: PolicyLike;
    private action: ActionIntent = { axis: 0, jump: false, dash: false, facing: 0 };
    private dashLatch = false;
    private restartTimer = 0;
    private survived = 0;
    private dodges = 0;
    private nearMisses = 0;
    private score = 0;
    private best = 0;
    private showColliders = false;
    private frameDelta = 1 / 60;
    private running = true;
    private matchDuration: number;
    private steeringMode: SteeringMode;

    constructor(private readonly options: FaceSmashingOptions) {
        this.random = options.random ?? Math.random;
        this.callbacks = options.callbacks;
        this.policy = options.policy ?? new IdlePolicy();
        this.matchDuration = options.matchDuration ?? FACE_SMASHING.match.defaultDurationSeconds;
        this.steeringMode = options.steeringMode ?? '67';
        this.level = createDungeonLevel();
        this.world.addBlockers(this.level.colliders);
        this.input = new KeyboardActionMap<DashAction>(KEY_BINDINGS);
        this.spawner = new ItemSpawner({ level: this.level, random: this.random });
        this.steering = new SteeringSystem(this.level);
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

    get dodgerDamage(): number {
        return this.dodger?.damage ?? 0;
    }

    get dodgerLevel(): number {
        return this.dodger?.level ?? 0;
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
            {
                width: this.viewWidth,
                height: this.viewHeight,
                postProcess: undefined,
            },
        );
        renderer.resize(this.viewWidth, this.viewHeight);

        this.scene = new SceneRenderer(renderer, sprites);
        this.respawn();
        this.releaseItem();
        this.loop.start();
    }

    stop(): void {
        this.loop.stop();
        this.input.dispose();
    }

    setPolicy(policy: PolicyLike): void {
        this.policy = policy;
    }

    setSteeringMode(mode: SteeringMode): void {
        this.steeringMode = mode;
    }

    /** Latest tracking frame; `null` when the camera has nothing for us. */
    setTracking(frame: TrackingFrame | null): void {
        this.steering.update(frame);
    }

    get paused(): boolean {
        return !this.running;
    }

    pause(): void {
        this.running = false;
    }

    resume(): void {
        this.running = true;
    }

    setMatchDuration(seconds: number): void {
        this.matchDuration = seconds;
        this.restart();
    }

    accelerate(): void {
        this.spawner.accelerate();
    }

    toggleColliders(): void {
        this.showColliders = !this.showColliders;
    }

    restart(): void {
        this.items = [];
        this.active = null;
        this.restartTimer = 0;
        this.survived = 0;
        this.dodges = 0;
        this.nearMisses = 0;
        this.score = 0;
        this.running = true;
        this.spawner.reset();
        this.impacts.reset();
        this.effects.clear();
        this.scorePopups.clear();
        this.steering.reset();
        this.respawn();
        this.releaseItem();
        this.publishStats();
    }

    private respawn(): void {
        this.dodger = new Dodger({
            feetX: this.level.grid.left + this.level.grid.width / 2,
            feetY: this.level.floorTop,
        });
    }

    private update(dt: number): void {
        if (!this.running) {
            return;
        }

        this.frameDelta = dt;
        this.updateSteering(dt);
        this.updateDodger(dt);
        this.updateItems(dt);
        this.updateRound(dt);
        this.effects.update(dt);
        this.scorePopups.update(dt);
        this.observe();
    }

    /**
     * The player owns the falling item, not the spawn position: it always
     * leaves the centre of the ceiling and the tracking gesture pushes it
     * sideways on the way down.
     */
    private updateSteering(dt: number): void {
        this.spawner.advance(dt);

        const active = this.active;

        if (!active || active.state !== 'falling') {
            return;
        }

        const intent = this.steering.intent(this.steeringMode, active.centerX);
        const { body } = active.physics;

        body.velocity.x = intent.axis * FACE_SMASHING.drop.steerSpeed;
        body.velocity.y = Math.min(
            body.velocity.y + DROPPED_ACCELERATION * dt,
            FACE_SMASHING.drop.maxSpeed,
        );
    }

    /** Releases the next item from the middle of the ceiling. */
    private releaseItem(): void {
        const spawned = this.spawner.spawn();
        this.active = spawned;
        this.items.push(spawned);
    }

    private updateDodger(dt: number): void {
        const dodger = this.dodger;
        if (!dodger) {
            return;
        }

        if (this.restartTimer > 0) {
            this.world.step(dodger.physics, dt);
            dodger.advanceAnimation(dt, DODGER_ANIMATIONS);
            return;
        }

        const dashHeld = this.input.isDown('dash');
        const dashPressed = dashHeld && !this.dashLatch;
        this.dashLatch = dashHeld;

        this.action =
            this.policy.ready && !dodger.stunned
                ? decodeAction(this.policy.decide(this.observation))
                : { axis: 0, jump: false, dash: false, facing: 0 };

        dodger.advanceReaction(dt);
        dodger.move(this.action.axis, dt);

        const dashDirection = this.action.dash
            ? this.action.facing || dodger.facingDirection
            : dashPressed
              ? readAxisIntent(this.input, {
                    negative: 'left',
                    positive: 'right',
                    fast: 'dash',
                }).axis || dodger.facingDirection
              : 0;

        if (dashDirection !== 0) {
            this.tryDash(dodger, dashDirection);
        }

        if (this.action.jump) {
            dodger.requestJump();
        }

        this.world.step(dodger.physics, dt);
        dodger.consumeJump();
        dodger.sampleDashTrail();
        dodger.resolveAnimation();
        dodger.advanceAnimation(dt, DODGER_ANIMATIONS);
    }

    private tryDash(dodger: Dodger, direction: number): boolean {
        if (!dodger.dash(direction)) {
            return false;
        }

        const scale = dodger.size.width;
        this.effects.spawn({
            kind: 'dust',
            x: dodger.feet.x,
            y: dodger.feet.y - 4,
            size: scale * 1.4,
        });
        return true;
    }

    private updateItems(dt: number): void {
        for (const item of this.items) {
            const result = this.world.step(item.physics, dt);
            item.applyCollision(result);
            item.update(dt);
        }

        this.items = this.items.filter(
            (item) => !item.expired && item.position.y < this.level.despawnY,
        );

        const active = this.active;

        if (active && active.state !== 'falling') {
            this.active = null;
            this.releaseItem();
        }
    }

    private updateRound(dt: number): void {
        const dodger = this.dodger;
        if (!dodger) {
            return;
        }

        if (this.restartTimer > 0) {
            this.restartTimer -= dt;

            if (this.restartTimer <= 0) {
                this.restart();
            }
            return;
        }

        this.survived += dt;

        const outcome = this.impacts.evaluate(this.items, dodger);

        this.dodges += outcome.dodges;
        this.nearMisses += outcome.nearMisses;

        if (outcome.hits > 0) {
            this.onImpact(outcome);
        }

        if (this.survived >= this.matchDuration) {
            this.finishRound();
            return;
        }

        this.publishStats();
    }

    private onImpact(outcome: ImpactOutcome): void {
        const dodger = this.dodger;
        if (!dodger) {
            return;
        }

        const strongest = outcome.contacts.reduce(
            (worst, contact) => (contact.damage > worst.damage ? contact : worst),
            outcome.contacts[0],
        );

        dodger.react(strongest.direction, outcome.damage);

        if (outcome.tierChange > 0) {
            dodger.setAnimation('hurt');
        }

        this.awardHitScore(outcome);
        this.callbacks.onHit?.(outcome.damage, outcome.tierChange);

        const scale = dodger.size.width;
        this.effects.spawn({
            kind: 'explosion',
            x: dodger.feet.x,
            y: dodger.feet.y - dodger.size.height / 2,
            size: scale * 1.4,
        });
        this.effects.spawn({
            kind: 'dust',
            x: dodger.feet.x,
            y: dodger.feet.y - 4,
            size: scale * 1.6,
        });
    }

    private awardHitScore(outcome: ImpactOutcome): void {
        for (const contact of outcome.contacts) {
            const points = hitPoints(contact.damage);
            this.score += points;
            this.scorePopups.spawn(contact.x, contact.y, points);
        }
    }

    private finishRound(): void {
        this.best = Math.max(this.best, Math.round(this.score));
        this.restartTimer = FACE_SMASHING.round.restartDelay;
        this.publishStats();
        this.callbacks.onMatchEnd?.(this.statsSnapshot());
        this.running = false;
    }

    private observe(): void {
        const dodger = this.dodger;
        if (!dodger) {
            return;
        }

        writeObservation(this.observation, {
            level: this.level,
            dodger,
            items: this.items,
        });
    }

    private publishStats(): void {
        this.callbacks.onStats(this.statsSnapshot());
    }

    private statsSnapshot(): MatchStats {
        const dodger = this.dodger;
        return {
            score: Math.round(this.score),
            best: this.best,
            survived: this.survived,
            dodges: this.dodges,
            nearMisses: this.nearMisses,
            damage: dodger ? dodger.damage : 0,
            level: dodger ? dodger.level : 0,
            dodgerSpeed: Math.round(this.dodgerMaxSpeed),
            dropSpeed: Math.round(this.spawner.speed),
            dashReady: dodger ? 1 - dodger.dashCooldownRatio : 1,
            timeLeft: Math.max(this.matchDuration - this.survived, 0),
            matchDuration: this.matchDuration,
        };
    }

    private render(): void {
        const scene = this.scene;
        const dodger = this.dodger;
        if (!scene || !dodger) {
            return;
        }

        scene.render(
            this.level,
            this.items,
            dodger,
            {
                colliders: this.showColliders,
                effects: this.effects.active,
                scorePopups: this.scorePopups.active,
            },
            { deltaSeconds: this.frameDelta },
        );
    }
}
