import { clamp } from '../../math';
import type { HandState } from '../types';
import type { Stream, TopHandObservation } from './types';

const WINDOW_MS = 150;
const MIN_SAMPLES = 2;
const DEADBAND = 0.02;
const FULL_SWING = 0.15;

interface Sample {
    time: number;
    margin: number;
}

/**
 * How much higher one hand is held than the other, as a continuous value.
 *
 * The margin is `right.y - left.y`, so it grows as the left hand rises above
 * the right and goes negative as the right hand rises. Averaging it over a
 * short window absorbs landmark jitter.
 *
 * A deadband plus a rescale turns that average into the reported value: it
 * reads exactly 0 while the hands are level, then grows smoothly to -1 with the
 * left hand fully raised and 1 with the right hand fully raised. That continuity
 * is what allows proportional steering instead of a binary "which hand is up".
 */
export class TopHandStream implements Stream<HandState[], TopHandObservation> {
    private samples: Sample[] = [];

    update(hands: HandState[], timestamp: number): TopHandObservation {
        const pair = this.pair(hands);

        if (!pair) {
            this.reset();
            return { active: false, confidence: 0, value: 0 };
        }

        const margin = pair.right.center.y - pair.left.center.y;
        this.samples.push({ time: timestamp, margin });
        this.prune(timestamp);

        const average = this.average();
        const active = this.samples.length >= MIN_SAMPLES;

        return {
            active,
            confidence: active ? clamp(Math.abs(average) / FULL_SWING, 0, 1) : 0,
            value: active ? toValue(average) : 0,
        };
    }

    reset(): void {
        this.samples = [];
    }

    private pair(hands: HandState[]): { left: HandState; right: HandState } | null {
        const left = hands.find((hand) => hand.handedness === 'Left');
        const right = hands.find((hand) => hand.handedness === 'Right');

        return left && right ? { left, right } : null;
    }

    private average(): number {
        if (this.samples.length === 0) {
            return 0;
        }

        const total = this.samples.reduce((sum, sample) => sum + sample.margin, 0);
        return total / this.samples.length;
    }

    private prune(timestamp: number): void {
        const cutoff = timestamp - WINDOW_MS;
        this.samples = this.samples.filter((sample) => sample.time >= cutoff);
    }
}

function toValue(margin: number): number {
    const magnitude = Math.abs(margin);

    if (magnitude <= DEADBAND) {
        return 0;
    }

    const lean = clamp((magnitude - DEADBAND) / (FULL_SWING - DEADBAND), 0, 1);

    return margin > 0 ? -lean : lean;
}