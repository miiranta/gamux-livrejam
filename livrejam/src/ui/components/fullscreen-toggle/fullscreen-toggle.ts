import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { HoverSound } from '../../directives';
import { FullscreenService } from '../../services';

/**
 * Fullscreen toggle shown in the top-right corner of the menus.
 * The glyph and the label follow the current fullscreen state.
 */
@Component({
    selector: 'app-fullscreen-toggle',
    imports: [HoverSound, TranslatePipe],
    templateUrl: './fullscreen-toggle.html',
    styleUrl: './fullscreen-toggle.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FullscreenToggle {
    protected readonly fullscreen = inject(FullscreenService);

    protected readonly labelKey = computed(() =>
        this.fullscreen.isFullscreen() ? 'fullscreen.exit' : 'fullscreen.enter',
    );

    protected toggle(): void {
        void this.fullscreen.toggle();
    }
}
