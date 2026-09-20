import type { HandState } from '../types';
import type { SixtySevenObservation, Stream } from './types';

const MIN_HANDS = 2;
const MIN_HORIZONTAL_GAP = 0.05;
const WINDOW_MS = 400;
const MIN_SWING = 0.1;
const REFERENCE_SWING = 0.35;
const REFERENCE_SPEED = 12;
const IMPULSE_PER_SECOND = 8;
const DECAY_PER_SECOND = 3;
const MAX_LEVEL = 1;
const MIN_LEVEL = 0.2;
const CROSSING_DEADBAND = 0.01;
const FREQUENCY_SMOOTHING = 0.4;
const GAP_RESET_MS = 250;

interface DeltaSample {
    time: number;
    value: number;
}

export class SixtySevenStream implements Stream<HandState[], SixtySevenObservation> {
    private samples: DeltaSample[] = [];
    private level = 0;
    private alternations = 0;
    private lastSign = 0;
    private lastReversal: number | null = null;
    private halfPeriod = 0;
    private lastSampleTime: number | null = null;
    private lastTimestamp: number | null = null;

    constructor() {
        this.reset();
    }

    update(hands: HandState[], timestamp: number): SixtySevenObservation {
        const dt = this.elapsed(timestamp);
        this.decay(dt);
        this.prune(timestamp);

        const delta = this.relativeHeight(hands);

        if (delta !== null) {
            this.record(delta, timestamp);
            this.accumulate();
        }

        return this.observation();
    }

    reset(): void {
        this.samples = [];
        this.level = 0;
        this.alternations = 0;
        this.lastSign = 0;
        this.lastReversal = null;
        this.halfPeriod = 0;
        this.lastSampleTime = null;
        this.lastTimestamp = null;
    }

    private record(delta: number, timestamp: number): void {
        if (this.lastSampleTime !== null && timestamp - this.lastSampleTime > GAP_RESET_MS) {
            this.lastSign = 0;
        }

        this.samples.push({ time: timestamp, value: delta });
        this.lastSampleTime = timestamp;
        this.trackCrossing(delta, timestamp);
    }

    private accumulate(): void {
        const current = this.samples[this.samples.length - 1];
        const previous = this.samples[this.samples.length - 2];

        if (!previous) {
            return;
        }

        const span = (current.time - previous.time) / 1000;
        const swing = this.swing();

        if (span <= 0 || swing < MIN_SWING) {
            return;
        }

        const speed = Math.abs(current.value - previous.value) / span;
        const amplitude = Math.min(1, swing / REFERENCE_SWING);
        const velocity = Math.min(1, speed / REFERENCE_SPEED);
        const impulse = IMPULSE_PER_SECOND * amplitude * velocity * span;

        this.level = Math.min(MAX_LEVEL, this.level + impulse);
    }

    private swing(): number {
        let high = Number.NEGATIVE_INFINITY;
        let low = Number.POSITIVE_INFINITY;

        for (const sample of this.samples) {
            high = Math.max(high, sample.value);
            low = Math.min(low, sample.value);
        }

        const current = Math.abs(this.samples[this.samples.length - 1].value);
        return Math.max(high - low, 2 * current);
    }

    private trackCrossing(delta: number, timestamp: number): void {
        const sign = delta > CROSSING_DEADBAND ? 1 : delta < -CROSSING_DEADBAND ? -1 : 0;

        if (sign === 0) {
            return;
        }

        if (this.lastSign !== 0 && sign !== this.lastSign) {
            this.alternations++;
            this.measureHalfPeriod(timestamp);
        }

        this.lastSign = sign;
    }

    private measureHalfPeriod(timestamp: number): void {
        const previous = this.lastReversal;
        this.lastReversal = timestamp;

        if (previous === null) {
            return;
        }

        const interval = (timestamp - previous) / 1000;

        if (interval <= 0) {
            return;
        }

        this.halfPeriod =
            this.halfPeriod === 0
                ? interval
                : this.halfPeriod * (1 - FREQUENCY_SMOOTHING) + interval * FREQUENCY_SMOOTHING;
    }

    private prune(timestamp: number): void {
        const cutoff = timestamp - WINDOW_MS;
        this.samples = this.samples.filter((sample) => sample.time >= cutoff);
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

    private frequency(): number {
        return this.halfPeriod > 0 ? 1 / this.halfPeriod : 0;
    }

    private relativeHeight(hands: HandState[]): number | null {
        const pair = this.orderedPair(hands);
        return pair ? pair[1].center.y - pair[0].center.y : null;
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

    private observation(): SixtySevenObservation {
        return {
            active: this.level >= MIN_LEVEL,
            confidence: this.level,
            level: this.level,
            frequency: this.frequency(),
            alternations: this.alternations,
        };
    }
}
