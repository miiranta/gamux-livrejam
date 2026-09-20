import { DestroyRef, Injectable, inject, signal } from '@angular/core';

const TOGGLE_KEY = 'l';

/**
 * Single source of truth for the developer overlay (extra HUD chips, tracking
 * markers, dev buttons). Disabled by default and toggled with the `L` key from
 * anywhere in the shell, so every component reads the same flag.
 */
@Injectable({ providedIn: 'root' })
export class DebugModeService {
    private readonly destroyRef = inject(DestroyRef);
    private readonly enabled = signal(false);

    readonly isEnabled = this.enabled.asReadonly();

    constructor() {
        if (typeof window === 'undefined') {
            return;
        }

        window.addEventListener('keydown', this.onKeyDown);
        this.destroyRef.onDestroy(() => window.removeEventListener('keydown', this.onKeyDown));
    }

    toggle(): void {
        this.enabled.update((value) => !value);
    }

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }

        if (event.key.toLowerCase() !== TOGGLE_KEY || isTextEntry(event.target)) {
            return;
        }

        this.toggle();
    };
}

function isTextEntry(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    if (!element) {
        return false;
    }

    if (element.isContentEditable) {
        return true;
    }

    return (
        element.tagName === 'INPUT' ||
        element.tagName === 'TEXTAREA' ||
        element.tagName === 'SELECT'
    );
}
