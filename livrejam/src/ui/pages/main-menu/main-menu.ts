import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MenuView } from '../../components/menu-view/menu-view';
import { GameFlowService } from '../../services';

/**
 * Screen shown at game start: Play / Configuration / Credits / Language,
 * plus the fullscreen toggle in the top-right corner.
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

    protected play(): void {
        this.flow.startMatch();
    }
}
