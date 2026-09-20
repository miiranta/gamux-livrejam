import { Character, type CharacterOptions } from '../../engine/entities';
import { clamp } from '../../engine/math';
import { FACE_SMASHING } from '../config';
import { damageLevel, damageScale, TIER_LAST } from '../damage';

export interface DodgerOptions {
    feetX: number;
    feetY: number;
    facing?: 'left' | 'right';
}

export interface TrailPoint {
    x: number;
    y: number;
}

export class Dodger extends Character {
    jumpQueued = false;
    damage = 0;
    stun = 0;
    flash = 0;
    invulnerable = 0;
    dashTimer = 0;
    dashCooldown = 0;
    dashGlow = 0;
    /** Fraction of the sprint speed the player asked for (1 while policy-driven). */
    speedFactor = 1;
    readonly dashTrail: TrailPoint[] = [];
    private tierSpeed: number;

    constructor(options: DodgerOptions) {
        const config = FACE_SMASHING.dodger;
        const characterOptions: CharacterOptions = {
            feet: { x: options.feetX, y: options.feetY },
            box: config.box,
            animation: 'walk',
            gravity: FACE_SMASHING.physics.gravity,
            maxSpeedX: config.maxSpeedStart,
            accelerationX: config.accelerationX,
            dragX: config.dragX,
            jumpSpeed: config.jumpStart,
            maxFallSpeed: config.maxFallSpeed,
            facing: options.facing,
        };

        super(characterOptions);
        this.tierSpeed = config.maxSpeedStart;
    }

    override get maxSpeedX(): number {
        return this.tierSpeed;
    }

    override set maxSpeedX(value: number) {
        this.tierSpeed = value;

        if (!this.dashing) {
            this.physics.body.maxSpeed.x = value;
        }
    }

    get level(): number {
        return damageLevel(this.damage);
    }

    get isWorn(): boolean {
        return this.level >= TIER_LAST;
    }

    get stunned(): boolean {
        return this.stun > 0;
    }

    get isInvulnerable(): boolean {
        return this.invulnerable > 0;
    }

    get dashing(): boolean {
        return this.dashTimer > 0;
    }

    get dashReady(): boolean {
        return this.dashCooldown <= 0;
    }

    get dashCooldownRatio(): number {
        return clamp(this.dashCooldown / FACE_SMASHING.dash.cooldownSeconds, 0, 1);
    }

    get dashSpeed(): number {
        const config = FACE_SMASHING.dash;
        return damageScale(this.level, config.speedStart, config.speedEnd);
    }

    get dashProgress(): number {
        return clamp(1 - this.dashTimer / FACE_SMASHING.dash.seconds, 0, 1);
    }

    sampleDashTrail(): void {
        if (!this.dashing) {
            return;
        }

        this.dashTrail.push({ x: this.feet.x, y: this.feet.y });
        const cap = FACE_SMASHING.dash.ghostCount + 1;

        while (this.dashTrail.length > cap) {
            this.dashTrail.shift();
        }
    }

    override move(axis: number, dt: number): void {
        if (this.dashing) {
            if (axis !== 0) {
                this.facing = axis < 0 ? 'left' : 'right';
            }
            return;
        }

        this.applyGroundFriction();
        super.move(axis, dt, this.speedFactor);
    }

    applyGroundFriction(): void {
        if (!this.physics.body.grounded) {
            return;
        }

        this.physics.body.velocity.x *= FACE_SMASHING.physics.friction;
    }

    takeDamage(amount: number): number {
        const previous = this.level;
        this.damage += Math.max(amount, 0);
        this.invulnerable = FACE_SMASHING.reaction.invulnerableSeconds;
        const current = this.level;

        if (current !== previous) {
            this.applyTier();
        }

        return current - previous;
    }

    react(direction: number, damage: number): void {
        const config = FACE_SMASHING.reaction;
        const body = this.physics.body;
        const towards = direction === 0 ? 1 : Math.sign(direction);
        const magnitude = clamp(
            config.knockbackBase + damage * config.knockbackPerDamage,
            0,
            config.knockbackMax,
        );

        this.applyTier();
        body.velocity.x = towards * Math.min(magnitude, this.maxSpeedX);
        body.velocity.y = -config.pop;
        this.stun = config.stunSeconds;
        this.flash = config.flashSeconds;
    }

    advanceReaction(dt: number): void {
        const wasDashing = this.dashing;

        this.stun = Math.max(this.stun - dt, 0);
        this.flash = Math.max(this.flash - dt, 0);
        this.invulnerable = Math.max(this.invulnerable - dt, 0);
        this.dashTimer = Math.max(this.dashTimer - dt, 0);
        this.dashCooldown = Math.max(this.dashCooldown - dt, 0);
        this.dashGlow = Math.max(this.dashGlow - dt, 0);

        if (wasDashing && !this.dashing) {
            this.physics.body.maxSpeed.x = this.tierSpeed;
        }
    }

    dash(direction: number): boolean {
        if (!this.dashReady || this.dashing || this.stunned) {
            return false;
        }

        const config = FACE_SMASHING.dash;
        const towards = direction < 0 ? -1 : 1;
        const body = this.physics.body;

        this.facing = towards < 0 ? 'left' : 'right';
        body.maxSpeed.x = this.dashSpeed;
        body.velocity.x = towards * this.dashSpeed;
        this.dashTimer = config.seconds;
        this.dashCooldown = config.cooldownSeconds;
        this.dashGlow = config.seconds + config.trailAfter;
        this.dashTrail.length = 0;
        return true;
    }

    applyTier(): void {
        const config = FACE_SMASHING.dodger;
        const level = this.level;
        this.maxSpeedX = damageScale(level, config.maxSpeedStart, config.maxSpeedEnd);
        this.jumpSpeed = damageScale(level, config.jumpStart, config.jumpEnd);
    }

    requestJump(): void {
        this.jumpQueued = true;
    }

    consumeJump(): void {
        if (!this.jumpQueued) {
            return;
        }

        this.jumpQueued = false;
        this.jump();
    }

    resolveAnimation(): void {
        if (this.dashing) {
            this.setAnimation('run');
            return;
        }
        if (!this.physics.body.grounded) {
            this.setAnimation('jump');
            return;
        }

        this.setAnimation(this.horizontalSpeed > 1 ? 'run' : 'walk');
    }
}
