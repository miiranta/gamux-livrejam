import type { Point2D } from '../../engine/math';
import { clamp } from '../../engine/math';
import type { CollisionResult, PhysicsBody } from '../../engine/physics';
import { createBody, dampAngular, dampVelocity } from '../../engine/physics';
import type { ItemDefinition } from '../config';
import { FACE_SMASHING, ITEMS, ITEM_WEIGHT_TOTAL } from '../config';

export type ItemState = 'falling' | 'landed' | 'settled';

export interface ItemTrailPoint {
    x: number;
    y: number;
    angle: number;
}

export interface ItemOptions {
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    definition: ItemDefinition;
    spin?: number;
    damageRoll?: number;
}

export class Item {
    readonly physics: PhysicsBody;
    readonly definition: ItemDefinition;
    readonly damageRoll: number;
    state: ItemState = 'falling';
    settleTimer = 0;
    fadeTimer = 0;
    appearTimer = 0;
    dashTimer = 0;
    dashGlow = 0;
    dashed = false;
    dashAngle = 0;
    readonly dashTrail: ItemTrailPoint[] = [];

    constructor(options: ItemOptions) {
        const config = FACE_SMASHING.item;
        this.definition = options.definition;
        this.damageRoll = clamp(options.damageRoll ?? 0.5, 0, 1);
        this.physics = {
            body: createBody(
                { x: options.x, y: options.y },
                {
                    gravity: config.gravity,
                    maxFallSpeed: config.maxFallSpeed,
                    initialVelocity: { x: options.velocityX, y: options.velocityY },
                    angularVelocity: options.spin ?? 0,
                    angularDamping: config.groundFriction,
                },
            ),
            size: {
                width: options.definition.half.width * 2,
                height: options.definition.half.height * 2,
            },
            solid: true,
        };
    }

    get halfWidth(): number {
        return this.definition.half.width;
    }

    get halfHeight(): number {
        return this.definition.half.height;
    }

    get size(): number {
        return Math.max(this.halfWidth, this.halfHeight) * 2;
    }

    get centerX(): number {
        return this.physics.body.position.x + this.halfWidth;
    }

    get centerY(): number {
        return this.physics.body.position.y + this.halfHeight;
    }

    get position(): Point2D {
        return this.physics.body.position;
    }

    get angle(): number {
        return this.physics.body.angle;
    }

    get impactSpeed(): number {
        const { velocity } = this.physics.body;
        return Math.hypot(velocity.x, velocity.y);
    }

    get spinRate(): number {
        return Math.abs(this.physics.body.angularVelocity);
    }

    get baseDamage(): number {
        const { damage } = this.definition;
        return damage.min + (damage.max - damage.min) * this.damageRoll;
    }

    get damage(): number {
        const config = FACE_SMASHING.item;
        const speedFactor = clamp(
            this.impactSpeed / config.referenceSpeed,
            config.speedFactorMin,
            config.speedFactorMax,
        );
        const spinFactor =
            1 + config.spinDamageBonus * clamp(this.spinRate / this.definition.spin.max, 0, 1);
        return this.baseDamage * speedFactor * spinFactor;
    }

    applyCollision(result: CollisionResult): void {
        if (this.state !== 'falling') {
            return;
        }

        if (result.grounded) {
            this.state = 'landed';
            this.settleTimer = 0;
            const { body } = this.physics;
            body.angularVelocity *= FACE_SMASHING.item.spinTransfer;
            return;
        }

        if (result.hitWall !== null) {
            this.physics.body.velocity.x *= -1;
        }
    }

    update(dt: number): void {
        this.appearTimer = Math.min(this.appearTimer + dt, FACE_SMASHING.item.appearSeconds);
        this.advanceDash(dt);

        if (this.state === 'settled') {
            this.fadeTimer += dt;
            return;
        }

        if (this.state !== 'landed') {
            dampAngular(this.physics.body, dt);
            return;
        }

        dampVelocity(this.physics.body, 'x', FACE_SMASHING.item.groundFriction, dt);
        dampAngular(this.physics.body, dt);
        this.settleTimer += dt;

        if (this.settleTimer >= FACE_SMASHING.item.settleSeconds) {
            this.state = 'settled';
        }
    }

    /** How far the spawn pop-in has progressed, from 0 to 1. */
    get appear(): number {
        return clamp(this.appearTimer / Math.max(FACE_SMASHING.item.appearSeconds, 1e-3), 0, 1);
    }

    /** How far the ground fade-out has progressed, from 0 to 1. */
    get fade(): number {
        return clamp(this.fadeTimer / Math.max(FACE_SMASHING.item.fadeSeconds, 1e-3), 0, 1);
    }

    get opacity(): number {
        return this.appear * (1 - this.fade);
    }

    /** Overshoot that settles back to 1, so the item pops as it appears. */
    get appearScale(): number {
        return 1 + (1 - this.appear) * FACE_SMASHING.item.appearScale;
    }

    get expired(): boolean {
        return this.fade >= 1;
    }

    get dashing(): boolean {
        return this.dashTimer > 0;
    }

    get dashable(): boolean {
        return !this.dashed && this.state === 'falling';
    }

    get steerable(): boolean {
        return !this.dashed;
    }

    get dashProgress(): number {
        return clamp(1 - this.dashTimer / Math.max(FACE_SMASHING.itemDash.seconds, 1e-3), 0, 1);
    }

    get dashGlowRatio(): number {
        const config = FACE_SMASHING.itemDash;
        return clamp(this.dashGlow / Math.max(config.seconds + config.trailAfter, 1e-3), 0, 1);
    }

    dash(): boolean {
        if (!this.dashable) {
            return false;
        }

        const config = FACE_SMASHING.itemDash;
        const { body } = this.physics;
        const speed = Math.hypot(body.velocity.x, body.velocity.y);
        const dirX = speed > 1e-3 ? body.velocity.x / speed : 0;
        const dirY = speed > 1e-3 ? body.velocity.y / speed : 1;

        this.dashed = true;
        this.dashAngle = Math.atan2(dirY, dirX);
        this.dashTimer = config.seconds;
        this.dashGlow = config.seconds + config.trailAfter;
        this.dashTrail.length = 0;
        body.velocity.x = dirX * config.speed;
        body.velocity.y = dirY * config.speed;
        body.maxSpeed.y = config.speed;
        body.angularVelocity *= config.spinBoost;
        return true;
    }

    private sampleDashTrail(): void {
        this.dashTrail.push({ x: this.centerX, y: this.centerY, angle: this.angle });

        while (this.dashTrail.length > FACE_SMASHING.itemDash.ghostCount + 1) {
            this.dashTrail.shift();
        }
    }

    private advanceDash(dt: number): void {
        if (this.dashGlow > 0) {
            this.dashGlow = Math.max(this.dashGlow - dt, 0);
        }

        if (!this.dashing) {
            return;
        }

        this.sampleDashTrail();
        this.dashTimer = Math.max(this.dashTimer - dt, 0);

        if (this.dashing) {
            return;
        }

        const { body } = this.physics;
        const config = FACE_SMASHING.item;
        body.maxSpeed.y = config.maxFallSpeed;
        body.velocity.y = Math.min(body.velocity.y, config.maxFallSpeed);
        body.velocity.x = clamp(
            body.velocity.x,
            -FACE_SMASHING.drop.steerSpeed,
            FACE_SMASHING.drop.steerSpeed,
        );
    }
}

export function pickItem(random: () => number): ItemDefinition {
    let roll = random() * ITEM_WEIGHT_TOTAL;
    for (const item of ITEMS) {
        roll -= item.weight;
        if (roll <= 0) {
            return item;
        }
    }
    return ITEMS[ITEMS.length - 1];
}
