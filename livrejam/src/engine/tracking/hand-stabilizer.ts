import { distance } from '../math';
import type { HandStabilityOptions, HandState } from './types';

interface HeldHand {
    hand: HandState;
    timestamp: number;
}

export class HandStabilizer {
    private held: HeldHand[] = [];

    constructor(private readonly options: HandStabilityOptions) {}

    resolve(detected: HandState[], timestamp: number): HandState[] {
        const unique = deduplicate(detected, this.options.duplicateDistance);
        const resolved: HandState[] = [];
        const claimed = new Set<number>();

        for (const previous of this.held) {
            const match = this.findMatch(unique, previous, claimed);

            if (match !== null) {
                claimed.add(match);
                resolved.push(unique[match]);
                continue;
            }

            const withinHoldWindow = timestamp - previous.timestamp <= this.options.holdMs;
            const clearOfDetections = unique.every(
                (hand) => distance(hand.center, previous.hand.center) > this.options.duplicateDistance,
            );

            if (withinHoldWindow && clearOfDetections) {
                resolved.push(previous.hand);
            }
        }

        unique.forEach((hand, index) => {
            if (!claimed.has(index)) {
                resolved.push(hand);
            }
        });

        this.held = resolved.map((hand) => ({ hand, timestamp }));
        return resolved;
    }

    reset(): void {
        this.held = [];
    }

    private findMatch(
        detected: HandState[],
        previous: HeldHand,
        claimed: Set<number>,
    ): number | null {
        let bestIndex: number | null = null;
        let bestDistance = Infinity;

        detected.forEach((candidate, index) => {
            if (claimed.has(index)) {
                return;
            }

            const candidateDistance = distance(candidate.center, previous.hand.center);
            if (candidateDistance < bestDistance) {
                bestDistance = candidateDistance;
                bestIndex = index;
            }
        });

        return bestIndex !== null && bestDistance <= this.options.matchDistance ? bestIndex : null;
    }
}

function deduplicate(hands: HandState[], threshold: number): HandState[] {
    return hands.filter((hand, index) =>
        hands.every(
            (other, otherIndex) =>
                otherIndex === index ||
                distance(other.center, hand.center) > threshold ||
                other.score <= hand.score,
        ),
    );
}
