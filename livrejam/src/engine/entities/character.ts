import type { Point2D } from '../math';
import type { PhysicsBody } from '../physics';
import { createBody, dampVelocity } from '../physics';
import { accelerate } from '../physics';
import type { AnimationSet } from './animation';
import { advanceClip, clipAdvance, clipRow } from './animation';
import type { Facing } from './facing';

export interface CharacterBox {
    width: number;
    height: number;
}

export interface CharacterOptions {
    feet: Point2D;
    box: CharacterBox;
    animation: string;
    gravity: number;
    maxSpeedX: number;
    accelerationX: number;
    dragX: number;
    jumpSpeed: number;
    maxFallSpeed?: number;
    friction?: number;
    facing?: Facing;
}

export class Character {
    readonly physics: PhysicsBody;
    readonly accelerationX: number;
    readonly dragX: number;
    facing: Facing;
    animation: string;
    jumpSpeed: number;
    frame = 0;
    elapsed = 0;

    private readonly box: CharacterBox;

    constructor(options: CharacterOptions) {
        this.box = options.box;
        this.accelerationX = options.accelerationX;
        this.dragX = options.dragX;
        this.jumpSpeed = options.jumpSpeed;
        this.facing = options.facing ?? 'down';
        this.animation = options.animation;

        this.physics = {
            body: createBody(
                {
                    x: options.feet.x - options.box.width / 2,
                    y: options.feet.y - options.box.height,
                },
                {
                    gravity: options.gravity,
                    maxFallSpeed: options.maxFallSpeed ?? Infinity,
                    friction: options.friction ?? 1,
                },
            ),
            size: { width: options.box.width, height: options.box.height },
            solid: true,
        };

        this.physics.body.maxSpeed.x = options.maxSpeedX;
    }

    get size(): CharacterBox {
        return this.physics.size;
    }

    get maxSpeedX(): number {
        return this.physics.body.maxSpeed.x;
    }

    set maxSpeedX(value: number) {
        this.physics.body.maxSpeed.x = value;
    }

    get feet(): Point2D {
        const { position } = this.physics.body;
        return {
            x: position.x + this.box.width / 2,
            y: position.y + this.box.height,
        };
    }

    get horizontalSpeed(): number {
        return Math.abs(this.physics.body.velocity.x);
    }

    get facingDirection(): number {
        if (this.facing === 'left') {
            return -1;
        }

        if (this.facing === 'right') {
            return 1;
        }

        return 0;
    }

    move(axis: number, dt: number, speedScale = 1): void {
        if (axis === 0) {
            dampVelocity(this.physics.body, 'x', this.dragX, dt);
        } else {
            accelerate(
                this.physics.body,
                'x',
                axis * this.accelerationX,
                this.maxSpeedX * speedScale,
                dt,
            );
        }

        if (axis !== 0) {
            this.facing = axis < 0 ? 'left' : 'right';
        }
    }

    jump(): boolean {
        if (!this.physics.body.grounded) {
            return false;
        }

        this.physics.body.velocity.y = -this.jumpSpeed;
        return true;
    }
    setAnimation(animation: string): void {
        if (animation === this.animation) {
            return;
        }

        this.animation = animation;
        this.frame = 0;
        this.elapsed = 0;
    }

    advanceAnimation(dt: number, clips: AnimationSet): void {
        const clip = clips[this.animation];
        if (!clip) {
            return;
        }

        const travelled = this.physics.body.velocity.x * dt;
        const step = advanceClip(clip, this.frame, this.elapsed, clipAdvance(clip, dt, travelled));
        this.frame = step.frame;
        this.elapsed = step.elapsed;
    }

    spriteRow(clips: AnimationSet): number {
        const clip = clips[this.animation];
        return clip ? clipRow(clip, this.facing) : 0;
    }
}
