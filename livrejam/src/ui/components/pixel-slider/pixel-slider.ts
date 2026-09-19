import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    numberAttribute,
    output,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Range slider drawn from scratch so it keeps the pixel-art look.
 * The native `<input type="range">` stays on top (transparent) for
 * keyboard and screen-reader support.
 */
@Component({
    selector: 'app-pixel-slider',
    imports: [TranslatePipe],
    templateUrl: './pixel-slider.html',
    styleUrl: './pixel-slider.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PixelSlider {
    /** Translation key rendered above the track. */
    readonly labelKey = input.required<string>();
    /** Normalised value in the 0..1 range. */
    readonly value = input(0, { transform: numberAttribute });

    readonly valueChange = output<number>();

    protected readonly percent = computed(() =>
        Math.round(Math.min(1, Math.max(0, this.value())) * 100),
    );

    protected handleInput(event: Event): void {
        const target = event.target as HTMLInputElement;
        this.valueChange.emit(Number(target.value));
    }
}
