import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { PixelButton } from '../../components/pixel-button/pixel-button';
import { PixelPanel } from '../../components/pixel-panel/pixel-panel';
import { GameFlowService } from '../../services';

/**
 * Result screen shown when the match timer runs out. Elements reveal one
 * after another: title, score, then the actions.
 */
@Component({
    selector: 'app-end-game',
    imports: [PixelButton, PixelPanel, TranslatePipe],
    templateUrl: './end-game.html',
    styleUrl: './end-game.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EndGame {
    private readonly flow = inject(GameFlowService);

    /** Placeholder scoring — the real formula lands when gameplay is wired. */
    protected readonly score = computed(() => this.flow.result().score);

    protected retry(): void {
        this.flow.restartMatch();
    }

    protected exit(): void {
        this.flow.abandon();
    }
}
