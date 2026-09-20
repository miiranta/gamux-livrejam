import { GameLoop } from '../engine/loop';
import { Gamepads, KeyboardActionMap } from '../engine/input';
import type { GamepadProvider } from '../engine/input';
import { Camera, CanvasRenderer } from '../engine/render';
import { PhysicsWorld } from '../engine/physics';
import { CHARACTER_CLIPS, loadDungeonSprites } from './assets';
import type { ActionIntent, PolicyLike } from './ai';
import { IdlePolicy, createObservationBuffer, decodeAction, writeObservation } from './ai';
import { FACE_SMASHING } from './config';
import {
    PLAYER_BINDINGS,
    PLAYER_GAMEPAD_BINDINGS,
    PLAYER_ENTITY_BY_MODE,
    readPlayerIntent,
    speedFactorFor,
    type GameMode,
    type PlayerAction,
    type PlayerIntent,
} from './config';
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
    /** Who is driving the character in this match. */
    gameMode: GameMode;
    /** True when a gamepad is plugged in and will move the character. */
    gamepadConnected: boolean;
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
    /** Which mode the match starts in; `setGameMode` can switch it later. */
    gameMode?: GameMode;
    /** Overrides the pad source, so tests can drive a fake controller. */
    gamepadProvider?: GamepadProvider;
}

const DODGER_ANIMATIONS = CHARACTER_CLIPS;

export class FaceSmashing {
    private readonly level: DungeonLevel;
    private readonly world = new PhysicsWorld();
    /** The keys and pads that drive the character; only read in 2-player mode. */
    private readonly playerInput: KeyboardActionMap<PlayerAction>;
    private readonly gamepads: Gamepads<PlayerAction>;
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
    /** The item currently being steered; a new one is released once it lands. */
    private active: Item | null = null;
    private policy: PolicyLike;
    private action: ActionIntent = { axis: 0, jump: false, dash: false, facing: 0 };
    private playerAction: PlayerIntent = { axis: 0, jump: false, dash: false, run: false, fastFall: false };
    /** Edge detection for the player's held jump/dash, so holds are one-shot. */
    private jumpLatch = false;
    private playerDashLatch = false;
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
    private gameMode: GameMode;
    private matchDuration: number;
    private steeringMode: SteeringMode;

    constructor(private readonly options: FaceSmashingOptions) {
        this.random = options.random ?? Math.random;
        this.callbacks = options.callbacks;
        this.policy = options.policy ?? new IdlePolicy();
        this.gameMode = options.gameMode ?? 'single';
        this.matchDuration = options.matchDuration ?? FACE_SMASHING.match.defaultDurationSeconds;
        this.steeringMode = options.steeringMode ?? '67';
        this.level = createDungeonLevel();
        this.world.addBlockers(this.level.colliders);
        this.playerInput = new KeyboardActionMap<PlayerAction>(PLAYER_BINDINGS);
        this.gamepads = new Gamepads<PlayerAction>(
            PLAYER_GAMEPAD_BINDINGS,
            options.gamepadProvider,
        );
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
        this.playerInput.dispose();
        this.gamepads.clear();
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

    /**
     * Switches who drives the character. The policy keeps running in
     * 2-player mode (the observation is still written), it is simply ignored,
     * so the switch costs nothing and the AI can take over again on demand.
     */
    setGameMode(mode: GameMode): void {
        if (mode === this.gameMode) {
            return;
        }

        this.gameMode = mode;
        this.clearInput();
    }

    get mode(): GameMode {
        return this.gameMode;
    }

    /** True while the human, not the policy, is driving the character. */
    get playerControlled(): boolean {
        return PLAYER_ENTITY_BY_MODE[this.gameMode] === 'character';
    }

    get paused(): boolean {
        return !this.running;
    }

    pause(): void {
        this.running = false;
        // Held keys would otherwise stay "stuck" and fire on resume.
        this.clearInput();
    }

    resume(): void {
        this.running = true;
    }

    private clearInput(): void {
        this.playerInput.clear();
        this.gamepads.clear();
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
        this.dashLatch = false;
        this.jumpLatch = false;
        this.playerDashLatch = false;
        this.playerAction = { axis: 0, jump: false, dash: false, run: false, fastFall: false };
        this.clearInput();
        this.spawner.reset();
        this.impacts.reset();
        this.effects.clear();
        this.scorePopups.clear();
        this.steering.reset();
        this.scene?.reset();
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
        // Pads are sampled once per frame, like the browser exposes them.
        this.gamepads.sample();
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
        const dashRequested = this.steering.consumeMouthDash();

        if (!active || active.state !== 'falling') {
            return;
        }

        if (dashRequested && active.dash()) {
            return;
        }

        if (!active.steerable) {
            return;
        }

        const intent = this.steering.intent(this.steeringMode, active.centerX);
        const { body } = active.physics;

        body.velocity.x = intent.axis * FACE_SMASHING.drop.steerSpeed;
        body.velocity.y = Math.min(
            body.velocity.y + FACE_SMASHING.drop.thrust * dt,
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

        const playerControlled = this.playerControlled;
        // In 1-player mode the character belongs to the policy, so no key
        // reaches it: the dropper bindings are gone on purpose.
        const dashHeld =
            playerControlled && (this.playerInput.isDown('dash') || this.gamepads.isDown('dash'));
        const dashPressed = dashHeld && !this.dashLatch;
        this.dashLatch = dashHeld;

        if (playerControlled) {
            this.readPlayerAction(dodger);
        } else {
            this.readPolicyAction(dodger);
        }

        dodger.speedFactor = playerControlled ? speedFactorFor(this.playerAction.run) : 1;
        dodger.advanceReaction(dt);
        dodger.move(this.action.axis, dt);
        dodger.fastFall(playerControlled && this.playerAction.fastFall && !dodger.stunned, dt);

        const dashDirection = this.action.dash
            ? this.action.facing || dodger.facingDirection
            : dashPressed
              ? this.heldAxis() || dodger.facingDirection
              : 0;

        if (dashDirection !== 0) {
            this.tryDash(dodger, dashDirection);
        }

        if (this.action.jump) {
            dodger.requestJump();
        }

        this.world.step(dodger.physics, dt);
        dodger.consumeJump();

        if (playerControlled && !this.playerAction.jump) {
            dodger.cutJump();
        }

        dodger.sampleDashTrail();
        dodger.resolveAnimation();
        dodger.advanceAnimation(dt, DODGER_ANIMATIONS);
    }

    /** Fills `action` (and the walk/run intent) from the human's controllers. */
    private readPlayerAction(dodger: Dodger): void {
        this.playerAction = readPlayerIntent([this.playerInput, this.gamepads]);

        // Jump and dash are edge-triggered, so holding them does not
        // machine-gun hops or burn the dash cooldown.
        const jumped = this.playerAction.jump && !this.jumpLatch;
        const dashed = this.playerAction.dash && !this.playerDashLatch;
        this.jumpLatch = this.playerAction.jump;
        this.playerDashLatch = this.playerAction.dash;

        // A stunned character is out of the player's hands, exactly as it is
        // out of the policy's — but it must not fall back to the policy either.
        const stunned = dodger.stunned;
        this.action = {
            axis: stunned ? 0 : this.playerAction.axis,
            jump: !stunned && jumped,
            dash: !stunned && dashed,
            facing: this.playerAction.axis !== 0 ? this.playerAction.axis : dodger.facingDirection,
        };
    }

    /** Asks the trained policy for the character's next move. */
    private readPolicyAction(dodger: Dodger): void {
        this.playerAction = { axis: 0, jump: false, dash: false, run: false, fastFall: false };
        this.jumpLatch = false;
        this.playerDashLatch = false;

        this.action =
            this.policy.ready && !dodger.stunned
                ? decodeAction(this.policy.decide(this.observation))
                : { axis: 0, jump: false, dash: false, facing: 0 };
    }

    private heldAxis(): number {
        return this.playerControlled ? this.action.axis : 0;
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
        this.score += outcome.damage;

        for (const contact of outcome.contacts) {
            this.scorePopups.spawn(contact.x, contact.y, hitPoints(contact.damage));
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
            gameMode: this.gameMode,
            gamepadConnected: this.gamepads.connected,
        };
    }

    private get aimTracked(): boolean {
        const active = this.active;
        return active !== null && active.steerable;
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
            {
                deltaSeconds: this.frameDelta,
                aim: this.steering.aim(this.steeringMode),
                aimTracked: this.aimTracked,
            },
        );
    }
}
