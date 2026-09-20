import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import type { GameMode } from '../../../game/config';
import { MenuView } from '../../components/menu-view/menu-view';
import { GameFlowService, GameSettingsService } from '../../services';

/**
 * Screen shown at game start: one button per game mode, then Configuration /
 * Credits / Language, plus the fullscreen toggle in the top-right corner.
 */
@Component({
    selector: 'app-main-menu',
    imports: [MenuView],
    templateUrl: './main-menu.html',
    styleUrl: './main-menu.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainMenu {
    private readonly flow = inject(GameFlowService);
    private readonly settings = inject(GameSettingsService);

    /**
     * The mode is picked here, not in the settings: it decides who controls
     * the character, so it belongs next to the button that starts the match.
     */
    protected start(mode: GameMode): void {
        this.settings.setGameMode(mode);
        this.flow.startMatch();
    }
}
