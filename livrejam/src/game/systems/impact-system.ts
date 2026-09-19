import { overlaps } from '../../engine/physics';
import { bodyBox } from '../../engine/physics';
import type { Dodger, Faller } from '../entities';
import { DUNGEON_DROP } from '../config';

export interface ImpactOutcome {
    hit: boolean;
    dodges: number;
    nearMisses: number;
}

export class ImpactSystem {
    private scored = new WeakSet<Faller>();

    reset(): void {
        this.scored = new WeakSet<Faller>();
    }

    evaluate(fallers: readonly Faller[], dodger: Dodger): ImpactOutcome {
        const outcome: ImpactOutcome = { hit: false, dodges: 0, nearMisses: 0 };
        const dodgerBox = bodyBox(dodger.physics);
        const { fallerHalfWidth, dodgerHalfWidth, nearMissDistance } = DUNGEON_DROP.impact;
        const safeGap = fallerHalfWidth + dodgerHalfWidth;

        for (const faller of fallers) {
            if (faller.expired) {
                continue;
            }

            if (overlaps(bodyBox(faller.physics), dodgerBox)) {
                outcome.hit = true;
                continue;
            }

            if (this.scored.has(faller) || faller.state === 'falling') {
                continue;
            }

            const gap = Math.abs(faller.centerX - dodger.feet.x);
            if (gap > safeGap + DUNGEON_DROP.score.dodgeDistance) {
                continue;
            }

            this.scored.add(faller);
            outcome.dodges += 1;

            if (gap <= safeGap + nearMissDistance) {
                outcome.nearMisses += 1;
            }
        }

        return outcome;
    }
}
