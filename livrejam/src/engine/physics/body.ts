import type { Point2D } from '../math';
import { clamp } from '../math';

export interface Body {
    position: Point2D;
    velocity: Point2D;

    acceleration: Point2D;

    friction: number;

    maxSpeed: Point2D;

    grounded: boolean;

    angle: number;

    angularVelocity: number;

    angularDamping: number;
}

export interface BodyOptions {
    gravity: number;
    maxFallSpeed?: number;
    friction?: number;
    initialVelocity?: Partial<Point2D>;
    angle?: number;
    angularVelocity?: number;
    angularDamping?: number;
}

export function dampAngular(body: Body, dt: number): void {
    body.angularVelocity *= Math.exp(-body.angularDamping * dt);
    body.angle += body.angularVelocity * dt;
}

export function accelerate(
    body: Body,
    axis: 'x' | 'y',
    acceleration: number,
    maxSpeed: number,
    dt: number,
): void {
    const max = axis === 'x' ? body.maxSpeed.x : body.maxSpeed.y;
    const limit = Math.min(max, maxSpeed);
    body.velocity[axis] = clamp(body.velocity[axis] + acceleration * dt, -limit, limit);
}

export function dampVelocity(body: Body, axis: 'x' | 'y', ratePerSecond: number, dt: number): void {
    body.velocity[axis] *= Math.exp(-ratePerSecond * dt);
}

export function createBody(position: Point2D, options: BodyOptions): Body {
    const { gravity, maxFallSpeed = Infinity, friction = 1, initialVelocity } = options;
    return {
        position: { ...position },
        velocity: { x: initialVelocity?.x ?? 0, y: initialVelocity?.y ?? 0 },
        acceleration: { x: 0, y: gravity },
        friction,
        maxSpeed: { x: Infinity, y: maxFallSpeed },
        grounded: false,
        angle: options.angle ?? 0,
        angularVelocity: options.angularVelocity ?? 0,
        angularDamping: options.angularDamping ?? 0,
    };
}

export function integrateAxis(body: Body, axis: 'x' | 'y', dt: number): void {
    const max = axis === 'x' ? body.maxSpeed.x : body.maxSpeed.y;
    body.velocity[axis] = clamp(body.velocity[axis], -max, max);
    body.velocity[axis] += body.acceleration[axis] * dt;
    body.position[axis] += body.velocity[axis] * dt;
}

export function integrate(body: Body, dt: number): void {
    integrateAxis(body, 'x', dt);
    integrateAxis(body, 'y', dt);
}
