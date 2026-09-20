import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { HoverSound } from '../../directives';
import { WelcomeService } from '../../services';

/**
 * Info button shown in the top-left corner of the menus, mirroring the
 * fullscreen toggle on the opposite side. It reopens the welcome screen.
 */
@Component({
    selector: 'app-welcome-toggle',
    imports: [HoverSound, TranslatePipe],
    templateUrl: './welcome-toggle.html',
    styleUrl: './welcome-toggle.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomeToggle {
    private readonly welcome = inject(WelcomeService);

    protected open(): void {
        this.welcome.open();
    }
}
