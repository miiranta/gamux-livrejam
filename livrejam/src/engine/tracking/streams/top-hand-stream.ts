import { clamp } from '../../math';
import type { HandState } from '../types';
import type { Stream, TopHandObservation, TopHandSide } from './types';

const WINDOW_MS = 100;
const MIN_SAMPLES = 2;
const DEADBAND = 0.012;
const SWITCH_MARGIN = 0.025;

interface Sample {
    time: number;
    margin: number;
}

export class TopHandStream implements Stream<HandState[], TopHandObservation> {
    private samples: Sample[] = [];
    private side: TopHandSide = null;

    update(hands: HandState[], timestamp: number): TopHandObservation {
        const pair = this.pair(hands);

        if (!pair) {
            this.reset();
            return { active: false, confidence: 0, side: null, margin: 0 };
        }

        const margin = pair.right.center.y - pair.left.center.y;
        this.samples.push({ time: timestamp, margin });
        this.prune(timestamp);

        const average = this.average();
        this.side = this.decide(average);

        return {
            active: this.side !== null,
            confidence: this.side === null ? 0 : clamp(Math.abs(average) / SWITCH_MARGIN, 0, 1),
            side: this.side,
            margin: average,
        };
    }

    reset(): void {
        this.samples = [];
        this.side = null;
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

    private decide(margin: number): TopHandSide {
        if (this.samples.length < MIN_SAMPLES) {
            return null;
        }

        if (this.side === 'left') {
            return margin < -SWITCH_MARGIN ? 'right' : 'left';
        }

        if (this.side === 'right') {
            return margin > SWITCH_MARGIN ? 'left' : 'right';
        }

        if (Math.abs(margin) < DEADBAND) {
            return null;
        }

        return margin > 0 ? 'left' : 'right';
    }

    private prune(timestamp: number): void {
        const cutoff = timestamp - WINDOW_MS;
        this.samples = this.samples.filter((sample) => sample.time >= cutoff);
    }
}