import { Directive, inject, output } from '@angular/core';

import { AudioService } from '../services/audio.service';

/**
 * Plays a random hover blip when the pointer enters the host.
 *
 * Put it on every clickable control (`app-pixel-button`, list options, the
 * voice play buttons...) so hovering *any* button makes the same sound.
 *
 * ```html
 * <app-pixel-button appHoverSound (pressed)="play()">Play</app-pixel-button>
 * ```
 */
@Directive({
    selector: '[appHoverSound]',
    host: {
        '(pointerenter)': 'onPointerEnter($event)',
        '(focusin)': 'onFocusIn()',
    },
})
export class HoverSound {
    private readonly audio = inject(AudioService);

    /** Emitted alongside the sound, for callers that want to react too. */
    readonly hovered = output<void>();

    protected onPointerEnter(event: PointerEvent): void {
        // Touch "hover" is really the tap that presses the button; stay quiet.
        if (event.pointerType === 'touch') {
            return;
        }

        this.play();
    }

    /** Keyboard navigation gets the same feedback as the mouse. */
    protected onFocusIn(): void {
        this.play();
    }

    private play(): void {
        this.audio.playButtonHover();
        this.hovered.emit();
    }
}
