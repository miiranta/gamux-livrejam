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

export function rotatePoint(point: Point2D, angle: number): Point2D {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        x: point.x * cos - point.y * sin,
        y: point.x * sin + point.y * cos,
    };
}

export function rotatedCorners(center: Point2D, halfWidth: number, halfHeight: number, angle: number): Point2D[] {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const corners: Point2D[] = [];
    for (const [signX, signY] of CORNER_SIGNS) {
        const offsetX = signX * halfWidth;
        const offsetY = signY * halfHeight;
        corners.push({
            x: center.x + offsetX * cos - offsetY * sin,
            y: center.y + offsetX * sin + offsetY * cos,
        });
    }
    return corners;
}

const CORNER_SIGNS: readonly (readonly [number, number])[] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
];

export function projectedRadius(halfWidth: number, halfHeight: number): number {
    return Math.hypot(halfWidth, halfHeight);
}

export function rangeOverlaps(
    minA: number,
    maxA: number,
    minB: number,
    maxB: number,
): boolean {
    return minA <= maxB && minB <= maxA;
}

export function projectOntoAxis(
    points: readonly Point2D[],
    axisX: number,
    axisY: number,
): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;
    for (const point of points) {
        const projection = point.x * axisX + point.y * axisY;
        if (projection < min) {
            min = projection;
        }
        if (projection > max) {
            max = projection;
        }
    }
    return { min, max };
}

export function axisOverlap(
    cornersA: readonly Point2D[],
    cornersB: readonly Point2D[],
    axisX: number,
    axisY: number,
): number {
    const a = projectOntoAxis(cornersA, axisX, axisY);
    const b = projectOntoAxis(cornersB, axisX, axisY);
    if (a.min > b.max || b.min > a.max) {
        return 0;
    }
    return Math.min(a.max, b.max) - Math.max(a.min, b.min);
}
