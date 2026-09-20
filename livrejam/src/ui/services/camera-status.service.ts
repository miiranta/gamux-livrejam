import { Injectable, computed, signal } from '@angular/core';

/** Outcome of the camera permission/hardware handshake. */
export type CameraDeviceStatus = 'idle' | 'starting' | 'ready' | 'blocked';

/** Why the camera is unavailable, mapped to a `camera.gate.reason.*` key. */
export type CameraFailureReason = 'blocked' | 'missing' | 'busy' | 'unsupported' | 'unknown';

export interface CameraFailure {
    reason: CameraFailureReason;
    detail: string;
}

const FAILURE_NAMES: Record<string, CameraFailureReason> = {
    NotAllowedError: 'blocked',
    SecurityError: 'blocked',
    NotFoundError: 'missing',
    OverconstrainedError: 'unsupported',
    NotReadableError: 'busy',
    AbortError: 'busy',
};

export function cameraFailureReason(error: unknown): CameraFailureReason {
    if (error instanceof DOMException) {
        return FAILURE_NAMES[error.name] ?? 'unknown';
    }
    return 'unknown';
}

/**
 * Single source of truth for whether the camera is usable.
 *
 * The match needs face tracking, so {@link GameFlowService} refuses to start a
 * match until this reports `ready`. {@link Camera} owns the actual
 * `getUserMedia` call and reports the outcome here, which lets the permission
 * popup react without duplicating camera setup.
 */
@Injectable({ providedIn: 'root' })
export class CameraStatusService {
    private readonly state = signal<CameraDeviceStatus>('idle');
    private readonly failureState = signal<CameraFailure | null>(null);
    private readonly retryTokenState = signal(0);

    readonly status = this.state.asReadonly();
    readonly failure = this.failureState.asReadonly();
    /** Bumped when a consumer asks {@link Camera} to reopen the device. */
    readonly retryToken = this.retryTokenState.asReadonly();

    /** True once a stream is live and frames can be tracked. */
    readonly isReady = computed(() => this.state() === 'ready');

    /** True while the match must not start because the camera is unusable. */
    readonly isBlocked = computed(() => this.state() === 'blocked');

    readonly reason = computed(() => this.failureState()?.reason ?? 'unknown');

    markStarting(): void {
        this.failureState.set(null);
        this.state.set('starting');
    }

    markReady(): void {
        this.failureState.set(null);
        this.state.set('ready');
    }

    markBlocked(reason: CameraFailureReason, detail: string): void {
        this.failureState.set({ reason, detail });
        this.state.set('blocked');
    }

    /** Asks the camera owner to attempt the handshake again. */
    requestRetry(): void {
        this.retryTokenState.update((token) => token + 1);
    }
}
