import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/**
 * Tracks the browser fullscreen state and exposes a toggle for the menu
 * button in the top-right corner.
 */
@Injectable({ providedIn: 'root' })
export class FullscreenService {
    private readonly destroyRef = inject(DestroyRef);
    private readonly active = signal(isFullscreenActive());
    private readonly supported = signal(isFullscreenSupported());

    readonly isFullscreen = this.active.asReadonly();
    readonly isSupported = this.supported.asReadonly();

    constructor() {
        const onChange = (): void => this.active.set(isFullscreenActive());
        document.addEventListener('fullscreenchange', onChange);
        this.destroyRef.onDestroy(() => document.removeEventListener('fullscreenchange', onChange));
    }

    async toggle(): Promise<void> {
        try {
            if (isFullscreenActive()) {
                await document.exitFullscreen();
            } else {
                await document.documentElement.requestFullscreen();
            }
        } catch {
            // Browsers reject fullscreen outside a user gesture; ignore.
        } finally {
            this.active.set(isFullscreenActive());
            this.supported.set(isFullscreenSupported());
        }
    }
}

function isFullscreenActive(): boolean {
    return typeof document !== 'undefined' && document.fullscreenElement !== null;
}

function isFullscreenSupported(): boolean {
    return (
        typeof document !== 'undefined' &&
        typeof document.documentElement.requestFullscreen === 'function'
    );
}
