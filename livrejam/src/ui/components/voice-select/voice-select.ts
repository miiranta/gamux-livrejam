import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { voiceSetLabelKey } from '../../../game/audio';
import { HoverSound } from '../../directives';
import { AudioService, GameSettingsService } from '../../services';

/**
 * Picks the character voice set.
 *
 * The list starts collapsed (there may be many sets) and each option carries a
 * "play" button that previews a random clip of that set. The folder name is the
 * translation key of the label, so adding a set is folder + JSON entry.
 */
@Component({
    selector: 'app-voice-select',
    imports: [HoverSound, TranslatePipe],
    templateUrl: './voice-select.html',
    styleUrl: './voice-select.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceSelect {
    private readonly audio = inject(AudioService);
    protected readonly settings = inject(GameSettingsService);

    protected readonly expanded = signal(false);
    protected readonly voiceSetLabelKey = voiceSetLabelKey;

    protected readonly options = computed(() => this.audio.voiceSets());
    protected readonly currentLabelKey = computed(() => voiceSetLabelKey(this.settings.voiceSet()));
    /** Index of the highlighted option, used to animate it in with a delay. */
    protected readonly activeIndex = computed(() =>
        this.options().findIndex((option) => option.key === this.settings.voiceSet()),
    );

    protected toggle(): void {
        this.expanded.update((open) => !open);
    }

    protected select(key: string): void {
        this.settings.setVoiceSet(key);
    }

    /** Previews a random clip of the given set, without changing the choice. */
    protected preview(event: Event, key: string): void {
        // The play button sits inside the option: don't select it as a side effect.
        event.stopPropagation();
        this.audio.playVoicePreview(key);
    }
}
