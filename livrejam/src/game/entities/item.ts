import type { Point2D } from '../../engine/math';
import { clamp } from '../../engine/math';
import type { CollisionResult, PhysicsBody } from '../../engine/physics';
import { createBody, dampAngular, dampVelocity } from '../../engine/physics';
import type { ItemDefinition } from '../config';
import { FACE_SMASHING, ITEMS, ITEM_WEIGHT_TOTAL } from '../config';

export type ItemState = 'falling' | 'landed' | 'settled';

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

    get expired(): boolean {
        return this.state === 'settled';
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
