import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';

import { Camera } from '../ui/components/camera/camera';
import { CameraGate } from '../ui/components/camera-gate/camera-gate';
import { Countdown } from '../ui/components/countdown/countdown';
import { GameCanvas } from '../ui/components/game-canvas/game-canvas';
import { WelcomeScreen } from '../ui/components/welcome-screen/welcome-screen';
import { EndGame } from '../ui/pages/end-game/end-game';
import { MainMenu } from '../ui/pages/main-menu/main-menu';
import { PauseMenu } from '../ui/pages/pause-menu/pause-menu';
import { GameFlowService, GamepadNavigation, WelcomeService } from '../ui/services';

/**
 * Single-route shell: it owns the layout for every screen and swaps the
 * visible layer based on {@link GameFlowService}.
 *
 * The match layer (camera + canvas) is hidden with `visibility` rather than
 * removed, so the canvas keeps a measurable size and never has to re-layout
 * when returning from a menu.
 */
@Component({
    selector: 'app-root',
    imports: [
        Camera,
        CameraGate,
        Countdown,
        EndGame,
        GameCanvas,
        MainMenu,
        PauseMenu,
        WelcomeScreen,
    ],
    templateUrl: './app.html',
    styleUrl: './app.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
    protected readonly flow = inject(GameFlowService);
    protected readonly welcome = inject(WelcomeService);
    private readonly gamepad = inject(GamepadNavigation);
    private readonly destroyRef = inject(DestroyRef);

    constructor() {
        window.addEventListener('keydown', this.onKeyDown);
        this.destroyRef.onDestroy(() => window.removeEventListener('keydown', this.onKeyDown));

        // The shell owns the pad's start button, not a menu: it has to work
        // during the match, when no menu layer is on screen to claim it.
        this.gamepad.onPause = () => this.togglePause();
        this.destroyRef.onDestroy(() => (this.gamepad.onPause = null));
    }

    /** Start on the pad, like Esc: pauses a match and leaves the pause menu. */
    private togglePause(): void {
        if (this.flow.isPlaying() || this.flow.isPaused()) {
            this.flow.togglePause();
        }
    }

    /** Esc pauses a running match, and leaves the pause menu when already there. */
    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.key !== 'Escape') {
            return;
        }

        // A menu on screen answers Esc itself, as its own "back" — closing an
        // open panel rather than pausing behind it. `GamepadNavigation` is
        // injected above, so it listens first and marks those presses.
        if (event.defaultPrevented) {
            return;
        }

        if (this.flow.isPlaying() || this.flow.isCountdown() || this.flow.isPaused()) {
            event.preventDefault();
            this.flow.togglePause();
            return;
        }

        if (this.flow.isGameOver()) {
            event.preventDefault();
            this.flow.abandon();
        }
    };
}
