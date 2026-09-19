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
 * Numeric field with pixel-art "-" / "+" buttons. Pass a `formatter` to show
 * a friendlier representation (e.g. "1:30" instead of "90").
 */
@Component({
    selector: 'app-pixel-stepper',
    imports: [TranslatePipe],
    templateUrl: './pixel-stepper.html',
    styleUrl: './pixel-stepper.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PixelStepper {
    /** Translation key rendered above the control. */
    readonly labelKey = input.required<string>();
    /** Optional translation key for a helper line under the control. */
    readonly hintKey = input<string | null>(null);

    readonly value = input(0, { transform: numberAttribute });
    readonly min = input(0, { transform: numberAttribute });
    readonly max = input(100, { transform: numberAttribute });
    readonly step = input(1, { transform: numberAttribute });
    /** Render the raw value with a custom format (defaults to the number). */
    readonly formatter = input<(value: number) => string>((value) => String(value));

    readonly valueChange = output<number>();

    protected readonly canDecrease = computed(() => this.value() > this.min());
    protected readonly canIncrease = computed(() => this.value() < this.max());
    protected readonly display = computed(() => this.formatter()(this.value()));

    protected adjust(direction: 1 | -1): void {
        const next = this.value() + direction * this.step();
        this.valueChange.emit(Math.min(this.max(), Math.max(this.min(), next)));
    }
}
