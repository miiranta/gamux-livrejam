import { bodyBox, overlaps, orientedOverlapsAligned } from '../../engine/physics';
import type { Dodger, Item } from '../entities';
import { FACE_SMASHING } from '../config';

export interface ImpactContact {
    x: number;
    y: number;
    direction: number;
    damage: number;
}

export interface ImpactOutcome {
    damage: number;
    hits: number;
    dodges: number;
    nearMisses: number;
    tierChange: number;
    contacts: ImpactContact[];
}

export class ImpactSystem {
    private scored = new WeakSet<Item>();
    private readonly contacts: ImpactContact[] = [];

    reset(): void {
        this.scored = new WeakSet<Item>();
    }

    evaluate(items: readonly Item[], dodger: Dodger): ImpactOutcome {
        this.contacts.length = 0;

        const dodgerBox = bodyBox(dodger.physics);
        const { nearMissDistance, dodgeDistance } = FACE_SMASHING.impact;
        const halfWidth = dodgerBox.width / 2;

        let damage = 0;
        let hits = 0;
        let dodges = 0;
        let nearMisses = 0;
        const invulnerable = dodger.isInvulnerable;

        for (const item of items) {
            if (item.expired || item.state === 'settled') {
                continue;
            }

            if (this.touches(item, dodgerBox)) {
                if (invulnerable) {
                    continue;
                }

                const dealt = item.damage;
                damage += dealt;
                hits += 1;
                this.contacts.push({
                    x: item.centerX,
                    y: item.centerY,
                    direction: item.centerX < dodger.feet.x ? -1 : 1,
                    damage: dealt,
                });
                continue;
            }

            if (this.scored.has(item) || item.state === 'falling') {
                continue;
            }

            const gap = Math.abs(item.centerX - dodger.feet.x);
            const reach = item.definition.half.width + halfWidth;
            if (gap > reach + dodgeDistance) {
                continue;
            }

            this.scored.add(item);
            dodges += 1;

            if (gap <= reach + nearMissDistance) {
                nearMisses += 1;
            }
        }

        const tierChange = damage > 0 ? dodger.takeDamage(damage) : 0;

        return { damage, hits, dodges, nearMisses, tierChange, contacts: this.contacts };
    }

    private touches(item: Item, target: { x: number; y: number; width: number; height: number }): boolean {
        if (item.state === 'falling') {
            const longSide = Math.max(item.definition.half.width, item.definition.half.height);
            const cube = {
                x: item.centerX - longSide,
                y: item.centerY - longSide,
                width: longSide * 2,
                height: longSide * 2,
            };
            return overlaps(cube, target);
        }

        return orientedOverlapsAligned(
            {
                center: { x: item.centerX, y: item.centerY },
                halfWidth: item.definition.half.width,
                halfHeight: item.definition.half.height,
                angle: item.angle,
            },
            target,
        );
    }
}
