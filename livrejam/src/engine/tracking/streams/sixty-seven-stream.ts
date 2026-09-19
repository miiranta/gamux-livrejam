import type { HandState } from '../types';
import type { SixtySevenObservation, Stream } from './types';

const MIN_HANDS = 2;
const MIN_HORIZONTAL_GAP = 0.05;
const MIN_AMPLITUDE = 0.012;
const IMPULSE = 0.35;
const DECAY_PER_SECOND = 0.8;
const MAX_LEVEL = 1;
const MIN_LEVEL = 0.15;
const WINDOW_MS = 2000;

export class SixtySevenStream implements Stream<HandState[], SixtySevenObservation> {
    private flips: number[] = [];
    private lastSign = 0;
    private peakHigh = 0;
    private peakLow = 0;
    private alternations = 0;
    private level = 0;
    private lastTimestamp: number | null = null;

    update(hands: HandState[], timestamp: number): SixtySevenObservation {
        this.decay(this.elapsed(timestamp));
        this.track(hands, timestamp);

        return {
            active: this.level >= MIN_LEVEL,
            confidence: this.level,
            level: this.level,
            frequency: this.frequency(timestamp),
            alternations: this.alternations,
        };
    }

    reset(): void {
        this.flips = [];
        this.lastSign = 0;
        this.peakHigh = 0;
        this.peakLow = 0;
        this.alternations = 0;
        this.level = 0;
        this.lastTimestamp = null;
    }

    private track(hands: HandState[], timestamp: number): void {
        const pair = this.orderedPair(hands);

        if (!pair) {
            this.lastSign = 0;
            return;
        }

        const [first, second] = pair;
        const delta = second.center.y - first.center.y;
        this.peakHigh = Math.max(this.peakHigh, delta);
        this.peakLow = Math.min(this.peakLow, delta);

        const sign = Math.sign(delta);
        if (sign !== 0 && this.lastSign !== 0 && sign !== this.lastSign) {
            this.registerFlip(timestamp);
        }

        if (sign !== 0) {
            this.lastSign = sign;
        }
    }

    private registerFlip(timestamp: number): void {
        const amplitude = this.peakHigh - this.peakLow;
        this.peakHigh = 0;
        this.peakLow = 0;

        if (amplitude < MIN_AMPLITUDE) {
            return;
        }

        this.alternations++;
        this.flips.push(timestamp);

        const vigour = Math.min(1, amplitude / (MIN_AMPLITUDE * 6));
        this.level = Math.min(MAX_LEVEL, this.level + IMPULSE * (0.5 + 0.5 * vigour));
    }

    private decay(dt: number): void {
        if (dt <= 0) {
            return;
        }

        this.level *= Math.exp(-DECAY_PER_SECOND * dt);

        if (this.level < 0.001) {
            this.level = 0;
        }
    }

    private elapsed(timestamp: number): number {
        const previous = this.lastTimestamp;
        this.lastTimestamp = timestamp;

        if (previous === null) {
            return 0;
        }

        const dt = (timestamp - previous) / 1000;
        return Number.isFinite(dt) && dt > 0 ? dt : 0;
    }

    private frequency(timestamp: number): number {
        this.flips = this.flips.filter((time) => timestamp - time <= WINDOW_MS);

        if (this.flips.length < 2) {
            return 0;
        }

        const span = (timestamp - this.flips[0]) / 1000;
        return span > 0 ? (this.flips.length - 1) / span : 0;
    }

    private orderedPair(hands: HandState[]): [HandState, HandState] | null {
        if (hands.length < MIN_HANDS) {
            return null;
        }

        const sorted = [...hands].sort((a, b) => a.center.x - b.center.x);
        const first = sorted[0];
        const second = sorted[sorted.length - 1];

        if (Math.abs(second.center.x - first.center.x) < MIN_HORIZONTAL_GAP) {
            return null;
        }

        return [first, second];
    }
}
