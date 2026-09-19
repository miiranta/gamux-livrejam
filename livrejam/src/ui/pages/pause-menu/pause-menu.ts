import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MenuView } from '../../components/menu-view/menu-view';
import { GameFlowService } from '../../services';

/**
 * Screen shown while a match is paused: Resume / Restart / Abandon,
 * configuration (without the match-time field), credits and language.
 */
@Component({
    selector: 'app-pause-menu',
    imports: [MenuView],
    templateUrl: './pause-menu.html',
    styleUrl: './pause-menu.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PauseMenu {
    private readonly flow = inject(GameFlowService);

    protected resume(): void {
        this.flow.resume();
    }

    protected restart(): void {
        this.flow.restartMatch();
    }

    protected abandon(): void {
        this.flow.abandon();
    }
}
