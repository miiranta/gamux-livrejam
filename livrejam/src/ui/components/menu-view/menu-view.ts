import {
    ChangeDetectionStrategy,
    Component,
    afterNextRender,
    booleanAttribute,
    computed,
    input,
    output,
    signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { HoverSound, GamepadMenu } from '../../directives';
import { GAME_MODES, gameModeLabelKey, type GameMode } from '../../../game/config';
import { focusFirst } from '../../services';
import { CreditsPanel } from '../credits-panel/credits-panel';
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
 * thin and this component owns the navigation. Both are fully drivable by
 * keyboard and gamepad through {@link GamepadNavigation}.
 */
@Component({
    selector: 'app-menu-view',
    imports: [
        CreditsPanel,
        FullscreenToggle,
        GamepadMenu,
        HoverSound,
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
    /**
     * Translation key of the single primary action. The main menu leaves it
     * unset because it offers one button per game mode instead of a generic
     * "Play", which would not say who controls the character.
     */
    readonly primaryKey = input<string | null>(null);
    /** Show Restart/Abandon and hide the match-time setting. */
    readonly isPause = input(false, { transform: booleanAttribute });

    readonly primary = output<void>();
    /** Start a match in the chosen mode (main menu only). */
    readonly mode = output<GameMode>();
    readonly restart = output<void>();
    readonly abandon = output<void>();

    protected readonly modes = GAME_MODES;
    protected readonly modeLabelKey = gameModeLabelKey;

    protected readonly panel = signal<MenuPanelId>('none');

    protected readonly panelTitleKey = computed(() => {
        const id = this.panel();
        return id === 'none' ? null : PANEL_TITLE_KEYS[id];
    });

    constructor() {
        // Give the pad (and the keyboard) a starting point as soon as the
        // menu appears, so "confirm" always has something to press.
        afterNextRender(() => focusFirst());
    }

    protected startMode(mode: GameMode): void {
        this.mode.emit(mode);
    }

    protected open(id: Exclude<MenuPanelId, 'none'>): void {
        this.panel.set(id);
        this.focusSoon();
    }

    protected close(): void {
        this.panel.set('none');
        this.focusSoon();
    }

    /**
     * Moves focus into the layer that just appeared. The DOM is only updated
     * after change detection, so this waits one frame before looking for the
     * first control.
     */
    private focusSoon(): void {
        requestAnimationFrame(() => focusFirst());
    }

    /**
     * The pad's back button: it closes an open panel, and otherwise leaves the
     * menu (resume when paused, nothing on the main menu, where there is no
     * screen behind it).
     */
    protected back(): void {
        if (this.panel() !== 'none') {
            this.close();
            return;
        }

        if (this.isPause()) {
            this.primary.emit();
        }
    }
}
