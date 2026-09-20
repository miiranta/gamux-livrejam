import { ChangeDetectionStrategy, Component, booleanAttribute, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { GameSettingsService, formatDuration, parseDuration } from '../../services';
import { PixelSlider } from '../pixel-slider/pixel-slider';
import { PixelStepper } from '../pixel-stepper/pixel-stepper';
import { VoiceSelect } from '../voice-select/voice-select';

/**
 * Audio + match options. Shared by the main menu and the pause menu; the
 * pause menu hides the match-time field (length cannot change mid-match).
 */
@Component({
    selector: 'app-settings-panel',
    imports: [PixelSlider, PixelStepper, TranslatePipe, VoiceSelect],
    templateUrl: './settings-panel.html',
    styleUrl: './settings-panel.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPanel {
    protected readonly settings = inject(GameSettingsService);

    /** Hide the match-length group (used by the pause menu). */
    readonly showMatchTime = input(true, { transform: booleanAttribute });

    protected readonly formatDuration = formatDuration;
    protected readonly parseDuration = parseDuration;
}
