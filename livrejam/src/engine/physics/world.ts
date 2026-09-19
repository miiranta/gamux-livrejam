import type { Aabb, SolidBox } from './aabb';
import { overlaps, solidBox } from './aabb';
import type { Body } from './body';
import { integrate, integrateAxis } from './body';

export interface PhysicsBody {
    body: Body;

    size: { width: number; height: number };

    solid: boolean;
}

export interface CollisionResult {
    grounded: boolean;

    hitWall: 'left' | 'right' | null;

    hitCeiling: boolean;

    layer: number | null;
}

export function bodyBox(entry: PhysicsBody): Aabb {
    return {
        x: entry.body.position.x,
        y: entry.body.position.y,
        width: entry.size.width,
        height: entry.size.height,
    };
}

export class PhysicsWorld {
    private readonly blockers: SolidBox[] = [];

    addBlocker(box: Aabb, layer = 0): void {
        this.blockers.push(solidBox(box, layer));
    }

    addBlockers(boxes: readonly SolidBox[]): void {
        for (const box of boxes) {
            this.blockers.push(box);
        }
    }

    clearBlockers(): void {
        this.blockers.length = 0;
    }

    get blockerCount(): number {
        return this.blockers.length;
    }

    step(entry: PhysicsBody, dt: number): CollisionResult {
        const result: CollisionResult = {
            grounded: false,
            hitWall: null,
            hitCeiling: false,
            layer: null,
        };

        if (entry.solid) {
            integrateAxis(entry.body, 'x', dt);
            this.resolveAxis(entry, 'x', result);

            integrateAxis(entry.body, 'y', dt);
            this.resolveAxis(entry, 'y', result);
        } else {
            integrate(entry.body, dt);
        }

        entry.body.grounded = result.grounded;

        if (result.grounded) {
            entry.body.velocity.x *= entry.body.friction;
        }

        return result;
    }

    private resolveAxis(entry: PhysicsBody, axis: 'x' | 'y', result: CollisionResult): void {
        for (const blocker of this.blockers) {
            const box = bodyBox(entry);

            if (!overlaps(box, blocker)) {
                continue;
            }

            if (result.layer === null) {
                result.layer = blocker.layer;
            }

            if (axis === 'x') {
                if (entry.body.velocity.x > 0) {
                    entry.body.position.x = blocker.x - box.width;
                    result.hitWall = 'right';
                } else if (entry.body.velocity.x < 0) {
                    entry.body.position.x = blocker.x + blocker.width;
                    result.hitWall = 'left';
                } else {
                    continue;
                }
                entry.body.velocity.x = 0;
            } else {
                if (entry.body.velocity.y > 0) {
                    entry.body.position.y = blocker.y - box.height;
                    result.grounded = true;
                } else if (entry.body.velocity.y < 0) {
                    entry.body.position.y = blocker.y + blocker.height;
                    result.hitCeiling = true;
                } else {
                    continue;
                }
                entry.body.velocity.y = 0;
            }
        }
    }
}
