import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';

import { Camera } from '../ui/components/camera/camera';
import { CameraGate } from '../ui/components/camera-gate/camera-gate';
import { Countdown } from '../ui/components/countdown/countdown';
import { GameCanvas } from '../ui/components/game-canvas/game-canvas';
import { WelcomeScreen } from '../ui/components/welcome-screen/welcome-screen';
import { EndGame } from '../ui/pages/end-game/end-game';
import { MainMenu } from '../ui/pages/main-menu/main-menu';
import { PauseMenu } from '../ui/pages/pause-menu/pause-menu';
import { GameFlowService, WelcomeService } from '../ui/services';

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
    private readonly destroyRef = inject(DestroyRef);

    constructor() {
        window.addEventListener('keydown', this.onKeyDown);
        this.destroyRef.onDestroy(() => window.removeEventListener('keydown', this.onKeyDown));
    }

    /** Esc pauses a running match, and leaves the pause menu when already there. */
    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.key !== 'Escape') {
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
