import type { Point2D } from '../math';

export interface OrientedBox {
    center: Point2D;
    halfWidth: number;
    halfHeight: number;
    angle: number;
}

export interface BoxPenetration {
    normalX: number;
    normalY: number;
    depth: number;
}

export interface AxisAlignedBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export function orientedCorners(box: OrientedBox): Point2D[] {
    const cos = Math.cos(box.angle);
    const sin = Math.sin(box.angle);
    return [
        [
            box.center.x - box.halfWidth * cos + box.halfHeight * sin,
            box.center.y - box.halfWidth * sin - box.halfHeight * cos,
        ],
        [
            box.center.x + box.halfWidth * cos + box.halfHeight * sin,
            box.center.y + box.halfWidth * sin - box.halfHeight * cos,
        ],
        [
            box.center.x + box.halfWidth * cos - box.halfHeight * sin,
            box.center.y + box.halfWidth * sin + box.halfHeight * cos,
        ],
        [
            box.center.x - box.halfWidth * cos - box.halfHeight * sin,
            box.center.y - box.halfWidth * sin + box.halfHeight * cos,
        ],
    ].map(([x, y]) => ({ x, y }));
}

export function alignedCorners(box: AxisAlignedBox): Point2D[] {
    return [
        { x: box.x, y: box.y },
        { x: box.x + box.width, y: box.y },
        { x: box.x + box.width, y: box.y + box.height },
        { x: box.x, y: box.y + box.height },
    ];
}

export function orientedAxes(box: OrientedBox): (readonly [number, number])[] {
    const cos = Math.cos(box.angle);
    const sin = Math.sin(box.angle);
    return [
        [cos, sin],
        [-sin, cos],
    ];
}

function overlapOnAxis(
    box: OrientedBox,
    target: AxisAlignedBox,
    axisX: number,
    axisY: number,
): number {
    const itemRadius =
        box.halfWidth * Math.abs(Math.cos(box.angle) * axisX + Math.sin(box.angle) * axisY) +
        box.halfHeight * Math.abs(-Math.sin(box.angle) * axisX + Math.cos(box.angle) * axisY);
    const targetRadius =
        (target.width / 2) * Math.abs(axisX) + (target.height / 2) * Math.abs(axisY);
    const targetX = target.x + target.width / 2;
    const targetY = target.y + target.height / 2;
    const distance =
        (box.center.x - targetX) * axisX + (box.center.y - targetY) * axisY;
    return itemRadius + targetRadius - Math.abs(distance);
}

export function orientedOverlapsAligned(box: OrientedBox, target: AxisAlignedBox): boolean {
    for (const [axisX, axisY] of separationAxes(box)) {
        if (overlapOnAxis(box, target, axisX, axisY) < 0) {
            return false;
        }
    }
    return true;
}

export function orientedPenetration(
    box: OrientedBox,
    target: AxisAlignedBox,
): BoxPenetration | null {
    const targetX = target.x + target.width / 2;
    const targetY = target.y + target.height / 2;

    let bestDepth = Infinity;
    let bestX = 0;
    let bestY = 0;

    for (const [axisX, axisY] of separationAxes(box)) {
        const depth = overlapOnAxis(box, target, axisX, axisY);
        if (depth < 0) {
            return null;
        }

        if (depth < bestDepth) {
            bestDepth = depth;
            bestX = axisX;
            bestY = axisY;
        }
    }

    if (bestDepth === Infinity) {
        return null;
    }

    const towards = (box.center.x - targetX) * bestX + (box.center.y - targetY) * bestY;
    const sign = towards < 0 ? -1 : 1;

    return { normalX: bestX * sign, normalY: bestY * sign, depth: bestDepth };
}

export function orientedTouchesPoint(box: OrientedBox, x: number, y: number): boolean {
    const cos = Math.cos(-box.angle);
    const sin = Math.sin(-box.angle);
    const offsetX = x - box.center.x;
    const offsetY = y - box.center.y;
    const localX = offsetX * cos - offsetY * sin;
    const localY = offsetX * sin + offsetY * cos;
    return Math.abs(localX) <= box.halfWidth && Math.abs(localY) <= box.halfHeight;
}

function separationAxes(box: OrientedBox): [number, number][] {
    const cos = Math.cos(box.angle);
    const sin = Math.sin(box.angle);
    return [
        [cos, sin],
        [-sin, cos],
        [1, 0],
        [0, 1],
    ];
}
