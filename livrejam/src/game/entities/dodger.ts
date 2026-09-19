import { Character, type CharacterOptions } from '../../engine/entities';
import { clamp } from '../../engine/math';
import { FACE_SMASHING } from '../config';
import { damageLevel, damageScale, TIER_LAST } from '../damage';

export interface DodgerOptions {
    feetX: number;
    feetY: number;
    facing?: 'left' | 'right';
}

export class Dodger extends Character {
    jumpQueued = false;
    damage = 0;
    stun = 0;
    flash = 0;
    invulnerable = 0;

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
            friction: FACE_SMASHING.physics.friction,
            facing: options.facing,
        };

        super(characterOptions);
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
        this.stun = Math.max(this.stun - dt, 0);
        this.flash = Math.max(this.flash - dt, 0);
        this.invulnerable = Math.max(this.invulnerable - dt, 0);
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
        if (!this.physics.body.grounded) {
            this.setAnimation('jump');
            return;
        }

        this.setAnimation(this.horizontalSpeed > 1 ? 'run' : 'walk');
    }
}
