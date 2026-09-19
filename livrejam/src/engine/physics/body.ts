import type { Point2D } from '../math';
import { clamp } from '../math';

/**
 * Estado fisico de um corpo. Velocidade em unidades/s, aceleracao em unidades/s^2.
 * `grounded` e `vy` sao atualizados por `stepBody`.
 */
export interface Body {
    position: Point2D;
    velocity: Point2D;
    /** Aceleracao persistente (gravidade), em unidades/s^2. */
    acceleration: Point2D;
    /** Multiplicador aplicado a velocidade ao encostar (0 = para, 1 = mantem). */
    friction: number;
    /** Velocidade maxima aplicada ao resultado, por eixo. */
    maxSpeed: Point2D;
    /** Apoiado em uma superficie solida no frame atual. */
    grounded: boolean;
}

export interface BodyOptions {
    gravity: number;
    maxFallSpeed?: number;
    friction?: number;
    initialVelocity?: Partial<Point2D>;
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
    };
}

/** Aplica gravidade/aceleracao e desloca o corpo em um unico eixo. */
export function integrateAxis(body: Body, axis: 'x' | 'y', dt: number): void {
    const max = axis === 'x' ? body.maxSpeed.x : body.maxSpeed.y;
    body.velocity[axis] = clamp(body.velocity[axis], -max, max);
    body.velocity[axis] += body.acceleration[axis] * dt;
    body.position[axis] += body.velocity[axis] * dt;
}

/** Move um corpo com integracao semi-implicita de Euler, respeitando os limites. */
export function integrate(body: Body, dt: number): void {
    integrateAxis(body, 'x', dt);
    integrateAxis(body, 'y', dt);
}