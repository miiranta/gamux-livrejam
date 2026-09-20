import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { HoverSound } from '../../directives';
import { GameSettingsService, STEERING_MODES, steeringModeLabelKey } from '../../services';
import type { SteeringMode } from '../../../game/systems';

/**
 * Picks how the falling item is steered. `67` reads the higher hand, `rizz`
 * reads a wink; each option carries a pixel icon of its gesture so the choice
 * is readable without the label.
 */
@Component({
    selector: 'app-steering-select',
    imports: [HoverSound, TranslatePipe],
    templateUrl: './steering-select.html',
    styleUrl: './steering-select.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SteeringSelect {
    protected readonly settings = inject(GameSettingsService);
    protected readonly modes = STEERING_MODES;
    protected readonly steeringModeLabelKey = steeringModeLabelKey;

    protected select(mode: SteeringMode): void {
        this.settings.setSteeringMode(mode);
    }
}
