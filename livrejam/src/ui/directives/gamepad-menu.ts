import { Directive, inject, output } from '@angular/core';

import { GamepadNavigation } from '../services/gamepad-navigation.service';

/**
 * Opts a screen into gamepad navigation: while the host is on screen, the
 * pad's "back" button emits {@link back}.
 *
 * Put it on every layer the pad can be "inside" (`app-main-menu`,
 * `app-pause-menu`, `app-end-game`, `app-camera-gate`). Focus movement and
 * "confirm" need no wiring — they act on whatever the browser has focused.
 *
 * ```html
 * <div class="menu-view" appGamepadMenu (back)="close()">
 * ```
 */
@Directive({
    selector: '[appGamepadMenu]',
    host: {
        '(focusin)': 'onFocusIn()',
    },
})
export class GamepadMenu {
    private readonly navigation = inject(GamepadNavigation);

    /** Emitted when the pad's "back" button is pressed. */
    readonly back = output<void>();

    constructor() {
        this.navigation.onBack = () => this.back.emit();
    }

    /**
     * The layer that was focused last owns the back button, so a panel opened
     * on top of a menu takes over and hands it back when it closes.
     */
    protected onFocusIn(): void {
        this.navigation.onBack = () => this.back.emit();
    }
}
