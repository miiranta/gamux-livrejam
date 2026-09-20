import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';

import { GameFlowService } from '../../services';

const COUNT_FROM = 3;
const STEP_MS = 700;

@Component({
    selector: 'app-countdown',
    templateUrl: './countdown.html',
    styleUrl: './countdown.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Countdown {
    private readonly flow = inject(GameFlowService);
    private readonly destroyRef = inject(DestroyRef);
    private timer: ReturnType<typeof setInterval> | null = null;

    protected readonly count = signal(COUNT_FROM);

    constructor() {
        this.timer = setInterval(() => this.tick(), STEP_MS);
        this.destroyRef.onDestroy(() => this.clear());
    }

    private tick(): void {
        const next = this.count() - 1;

        if (next <= 0) {
            this.clear();
            this.flow.finishCountdown();
            return;
        }

        this.count.set(next);
    }

    private clear(): void {
        if (this.timer === null) {
            return;
        }

        clearInterval(this.timer);
        this.timer = null;
    }
}
