import type { Point2D } from '../../engine/math';
import type { CollisionResult, PhysicsBody } from '../../engine/physics';
import { createBody, dampVelocity } from '../../engine/physics';
import type { FallerSpriteKey } from '../assets';
import { FALLER_KEYS } from '../assets';
import { FACE_SMASHING } from '../config';

export type FallerState = 'falling' | 'landed' | 'settled';

export interface FallerOptions {
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    sprite: FallerSpriteKey;
    size: number;
}

export class Faller {
    readonly physics: PhysicsBody;
    readonly sprite: FallerSpriteKey;
    readonly size: number;
    state: FallerState = 'falling';
    settleTimer = 0;

    constructor(options: FallerOptions) {
        this.sprite = options.sprite;
        this.size = options.size;
        this.physics = {
            body: createBody(
                { x: options.x, y: options.y },
                {
                    gravity: FACE_SMASHING.faller.gravity,
                    maxFallSpeed: FACE_SMASHING.faller.maxFallSpeed,
                    initialVelocity: { x: options.velocityX, y: options.velocityY },
                },
            ),
            size: { width: options.size, height: options.size },
            solid: true,
        };
    }

    get centerX(): number {
        return this.physics.body.position.x + this.size / 2;
    }

    get centerY(): number {
        return this.physics.body.position.y + this.size / 2;
    }

    get position(): Point2D {
        return this.physics.body.position;
    }

    applyCollision(result: CollisionResult): void {
        if (this.state !== 'falling') {
            return;
        }

        if (result.grounded) {
            this.state = 'landed';
            this.settleTimer = 0;
            return;
        }

        if (result.hitWall !== null) {
            this.physics.body.velocity.x *= -0.25;
        }
    }

    update(dt: number): void {
        if (this.state === 'landed') {
            dampVelocity(this.physics.body, 'x', FACE_SMASHING.faller.slideDragX, dt);
            this.settleTimer += dt;

            if (this.settleTimer >= FACE_SMASHING.faller.settleSeconds) {
                this.state = 'settled';
            }
        }
    }

    get expired(): boolean {
        return this.state === 'settled';
    }
}

export function pickFallerSprite(random: () => number): FallerSpriteKey {
    return FALLER_KEYS[Math.floor(random() * FALLER_KEYS.length)];
}
