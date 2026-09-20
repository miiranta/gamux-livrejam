import { Injectable, signal } from '@angular/core';

import type { TrackingFrame } from '../../engine/tracking';

/**
 * Carries the latest tracking frame from the camera to the game.
 *
 * `Camera` owns the worker and `GameCanvas` owns the game, so neither can see
 * the other. This service is the hand-off point: the camera publishes every
 * processed frame, the game reads the current one while it simulates.
 */
@Injectable({ providedIn: 'root' })
export class TrackingFrameService {
    private readonly state = signal<TrackingFrame | null>(null);

    readonly frame = this.state.asReadonly();

    publish(frame: TrackingFrame): void {
        this.state.set(frame);
    }

    clear(): void {
        this.state.set(null);
    }
}
