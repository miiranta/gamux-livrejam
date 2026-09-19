import type { HandState } from '../types';
import type { SixtySevenObservation, Stream } from './types';

const MIN_HANDS = 2;
const MIN_HORIZONTAL_GAP = 0.05;
const WINDOW_MS = 1000;
const MIN_SWING = 0.05;
const REFERENCE_SWING = 0.5;
const REFERENCE_SPEED = 15;
const IMPULSE_PER_SECOND = 6;
const DECAY_PER_SECOND = 4;
const MAX_LEVEL = 1;
const MIN_LEVEL = 0.15;
const CROSSING_DEADBAND = 0.01;
const GRACE_MS = 200;

interface DeltaSample {
    time: number;
    value: number;
}

export class SixtySevenStream implements Stream<HandState[], SixtySevenObservation> {
    private samples: DeltaSample[] = [];
    private crossings: number[] = [];
    private lastSign = 0;
    private alternations = 0;
    private level = 0;
    private lastTimestamp: number | null = null;
    private lastSeen: number | null = null;

    update(hands: HandState[], timestamp: number): SixtySevenObservation {
        const dt = this.elapsed(timestamp);
        this.decay(dt);
        this.prune(timestamp);

        const delta = this.relativeHeight(hands);

        if (delta === null) {
            if (this.lastSeen === null || timestamp - this.lastSeen > GRACE_MS) {
                this.lastSign = 0;
            }

            return this.observation(timestamp);
        }

        this.lastSeen = timestamp;
        this.samples.push({ time: timestamp, value: delta });
        this.countCrossing(delta, timestamp);
        this.accumulate(dt);

        return this.observation(timestamp);
    }

    reset(): void {
        this.samples = [];
        this.crossings = [];
        this.lastSign = 0;
        this.alternations = 0;
        this.level = 0;
        this.lastTimestamp = null;
        this.lastSeen = null;
    }

    private accumulate(dt: number): void {
        if (dt <= 0 || this.samples.length < 2) {
            return;
        }

        const swing = this.swing();

        if (swing < MIN_SWING) {
            return;
        }

        const intensity =
            Math.min(1, this.meanSpeed() / REFERENCE_SPEED) * Math.min(1, swing / REFERENCE_SWING);

        this.level = Math.min(MAX_LEVEL, this.level + IMPULSE_PER_SECOND * intensity * dt);
    }

    private swing(): number {
        let high = Number.NEGATIVE_INFINITY;
        let low = Number.POSITIVE_INFINITY;

        for (const sample of this.samples) {
            high = Math.max(high, sample.value);
            low = Math.min(low, sample.value);
        }

        return high - low;
    }

    private meanSpeed(): number {
        let path = 0;

        for (let index = 1; index < this.samples.length; index++) {
            path += Math.abs(this.samples[index].value - this.samples[index - 1].value);
        }

        const span = (this.samples[this.samples.length - 1].time - this.samples[0].time) / 1000;
        return span > 0 ? path / span : 0;
    }

    private countCrossing(delta: number, timestamp: number): void {
        const sign = delta > CROSSING_DEADBAND ? 1 : delta < -CROSSING_DEADBAND ? -1 : 0;

        if (sign !== 0 && this.lastSign !== 0 && sign !== this.lastSign) {
            this.alternations++;
            this.crossings.push(timestamp);
        }

        if (sign !== 0) {
            this.lastSign = sign;
        }
    }

    private prune(timestamp: number): void {
        const cutoff = timestamp - WINDOW_MS;
        this.samples = this.samples.filter((sample) => sample.time >= cutoff);
        this.crossings = this.crossings.filter((time) => time >= cutoff);
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
        if (this.crossings.length < 2) {
            return 0;
        }

        const span = (timestamp - this.crossings[0]) / 1000;
        return span > 0 ? (this.crossings.length - 1) / span : 0;
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

    private observation(timestamp: number): SixtySevenObservation {
        return {
            active: this.level >= MIN_LEVEL,
            confidence: this.level,
            level: this.level,
            frequency: this.frequency(timestamp),
            alternations: this.alternations,
        };
    }
}
