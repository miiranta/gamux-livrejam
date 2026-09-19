import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Camera } from '../ui/components/camera/camera';
import { GameCanvas } from '../ui/components/game-canvas/game-canvas';
import { EndGame } from '../ui/pages/end-game/end-game';
import { MainMenu } from '../ui/pages/main-menu/main-menu';
import { PauseMenu } from '../ui/pages/pause-menu/pause-menu';
import { GameFlowService } from '../ui/services';

@Component({
    selector: 'app-root',
    imports: [Camera, EndGame, GameCanvas, MainMenu, PauseMenu, RouterOutlet],
    templateUrl: './app.html',
    styleUrl: './app.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
    protected readonly flow = inject(GameFlowService);
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

        if (this.flow.isPlaying() || this.flow.isPaused()) {
            event.preventDefault();
            this.flow.togglePause();
        }
    };
}
