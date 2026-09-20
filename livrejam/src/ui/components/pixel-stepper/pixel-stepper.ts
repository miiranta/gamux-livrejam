import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    numberAttribute,
    output,
    signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { HoverSound } from '../../directives';

/**
 * Numeric field with pixel-art "-" / "+" buttons. Pass a `formatter` to show
 * a friendlier representation (e.g. "1:30" instead of "90") and a matching
 * `parser` so the value can also be typed straight into the readout.
 */
@Component({
    selector: 'app-pixel-stepper',
    imports: [HoverSound, TranslatePipe],
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
    /** Parse a typed value back into a number; `null` rejects the input. */
    readonly parser = input<(text: string) => number | null>((text) => {
        const parsed = Number.parseFloat(text);
        return Number.isFinite(parsed) ? parsed : null;
    });

    readonly valueChange = output<number>();

    protected readonly canDecrease = computed(() => this.value() > this.min());
    protected readonly canIncrease = computed(() => this.value() < this.max());
    protected readonly display = computed(() => this.formatter()(this.value()));
    /** The increment applied by the buttons, shown next to the label. */
    protected readonly stepLabel = computed(() => `+${this.formatter()(this.step())}`);

    private readonly draft = signal<string | null>(null);

    protected adjust(direction: 1 | -1): void {
        // A half-typed value wins over the last committed one, so clicking
        // "+" right after typing steps from what the player just entered.
        const base = this.pendingValue() ?? this.value();
        this.draft.set(null);
        this.valueChange.emit(this.clamp(base + direction * this.step()));
    }

    protected beginEdit(input: HTMLInputElement): void {
        this.draft.set(this.display());
        queueMicrotask(() => input.select());
    }

    protected updateDraft(event: Event): void {
        this.draft.set((event.target as HTMLInputElement).value);
    }

    protected commit(input: HTMLInputElement): void {
        const parsed = this.pendingValue();
        this.draft.set(null);

        if (parsed === null) {
            input.value = this.display();
            return;
        }

        const next = this.clamp(parsed);
        input.value = this.formatter()(next);
        this.valueChange.emit(next);
    }

    protected cancel(input: HTMLInputElement): void {
        this.draft.set(null);
        input.value = this.display();
    }

    private pendingValue(): number | null {
        const raw = this.draft();
        return raw === null ? null : this.parser()(raw.trim());
    }

    private clamp(value: number): number {
        return Math.min(this.max(), Math.max(this.min(), value));
    }
}
