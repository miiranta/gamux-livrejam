import type { Point2D } from './point';

export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

export function distance(a: Point2D, b: Point2D): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

export function centroid(points: Point2D[]): Point2D {
    if (points.length === 0) {
        return { x: 0, y: 0 };
    }

    const total = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), {
        x: 0,
        y: 0,
    });

    return { x: total.x / points.length, y: total.y / points.length };
}

export function lerp(from: number, to: number, amount: number): number {
    return from + (to - from) * amount;
}

export function smooth(previous: number, next: number, alpha: number): number {
    return lerp(previous, next, alpha);
}
