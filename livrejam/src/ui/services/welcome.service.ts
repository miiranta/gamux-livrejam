import { Injectable, signal } from '@angular/core';

export const WELCOME_STORAGE_KEY = 'livrejam.welcomeSeen';

/**
 * Owns the welcome screen, which introduces the project and lists the jam
 * achievements. It opens by itself the first time the game is loaded and can
 * be reopened at any moment from the info button in the menu.
 *
 * The "already seen" flag lives in `localStorage`, so a returning player goes
 * straight to the menu. A browser that refuses storage simply shows the screen
 * again on every visit, which is harmless.
 */
@Injectable({ providedIn: 'root' })
export class WelcomeService {
    private readonly openState = signal(!hasSeenWelcome());

    readonly isOpen = this.openState.asReadonly();

    open(): void {
        this.openState.set(true);
    }

    /** Closes the screen and remembers it, wherever it was opened from. */
    close(): void {
        this.openState.set(false);
        markWelcomeSeen();
    }
}

function hasSeenWelcome(): boolean {
    try {
        return localStorage.getItem(WELCOME_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

function markWelcomeSeen(): void {
    try {
        localStorage.setItem(WELCOME_STORAGE_KEY, 'true');
    } catch {
        // Private mode or blocked storage: the screen just shows up again.
    }
}
