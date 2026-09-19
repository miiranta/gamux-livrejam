import { smooth } from '../math';

const HYSTERESIS = 0.06;
const SMOOTHING_ALPHA = 0.6;

export class SmoothedStateFilter<TState extends string> {
    private state: TState;
    private smoothed: number | null = null;

    constructor(
        private readonly onState: TState,
        private readonly offState: TState,
        private readonly onThreshold: number,
    ) {
        this.state = offState;
    }

    get value(): TState {
        return this.state;
    }

    update(score: number): TState {
        this.smoothed =
            this.smoothed === null ? score : smooth(this.smoothed, score, SMOOTHING_ALPHA);

        const isOn = this.state === this.onState;
        const crossedOn = this.smoothed > this.onThreshold + HYSTERESIS;
        const crossedOff = this.smoothed < this.onThreshold - HYSTERESIS;

        if (isOn && crossedOff) {
            this.state = this.offState;
        } else if (!isOn && crossedOn) {
            this.state = this.onState;
        }

        return this.state;
    }

    reset(): void {
        this.state = this.offState;
        this.smoothed = null;
    }
}
