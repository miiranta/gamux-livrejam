import {
    ChangeDetectionStrategy,
    Component,
    booleanAttribute,
    computed,
    input,
    output,
    signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { FullscreenToggle } from '../fullscreen-toggle/fullscreen-toggle';
import { LanguageSelect } from '../language-select/language-select';
import { ParticleField } from '../particle-field/particle-field';
import { PixelButton } from '../pixel-button/pixel-button';
import { PixelPanel } from '../pixel-panel/pixel-panel';
import { SettingsPanel } from '../settings-panel/settings-panel';

/** Sub-screen opened from the menu list. */
export type MenuPanelId = 'none' | 'configuration' | 'credits' | 'language';

const PANEL_TITLE_KEYS: Record<Exclude<MenuPanelId, 'none'>, string> = {
    configuration: 'menu.configuration',
    credits: 'credits.title',
    language: 'language.title',
};

/**
 * Shared layout for the initial menu and the pause menu: title, action list
 * and the slide-in panels (configuration / credits / language).
 *
 * The two menus only differ by their label set, so the page components stay
 * thin and this component owns the navigation.
 */
@Component({
    selector: 'app-menu-view',
    imports: [
        FullscreenToggle,
        LanguageSelect,
        ParticleField,
        PixelButton,
        PixelPanel,
        SettingsPanel,
        TranslatePipe,
    ],
    templateUrl: './menu-view.html',
    styleUrl: './menu-view.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuView {
    /** Translation key of the primary action ("Play" / "Resume"). */
    readonly primaryKey = input.required<string>();
    /** Show Restart/Abandon and hide the match-time setting. */
    readonly isPause = input(false, { transform: booleanAttribute });

    readonly primary = output<void>();
    readonly restart = output<void>();
    readonly abandon = output<void>();

    protected readonly panel = signal<MenuPanelId>('none');

    protected readonly panelTitleKey = computed(() => {
        const id = this.panel();
        return id === 'none' ? null : PANEL_TITLE_KEYS[id];
    });

    protected open(id: Exclude<MenuPanelId, 'none'>): void {
        this.panel.set(id);
    }

    protected close(): void {
        this.panel.set('none');
    }
}
