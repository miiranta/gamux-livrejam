import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';

export type PixelButtonVariant = 'default' | 'ghost' | 'danger';

/**
 * Chunky pixel-art button with notched corners and corner studs.
 * Pass the translated label via content projection.
 *
 * ```html
 * <app-pixel-button variant="danger" (pressed)="abandon()">
 *     {{ 'menu.abandon' | translate }}
 * </app-pixel-button>
 * ```
 */
@Component({
    selector: 'app-pixel-button',
    templateUrl: './pixel-button.html',
    styleUrl: './pixel-button.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '[class.pixel-button-host--block]': 'block()',
        '[class.pixel-button-host--ghost]': 'variant() === "ghost"',
        '[class.pixel-button-host--danger]': 'variant() === "danger"',
    },
})
export class PixelButton {
    readonly variant = input<PixelButtonVariant>('default');
    readonly disabled = input(false, { transform: booleanAttribute });
    /** Stretch the button to the full width of its container. */
    readonly block = input(false, { transform: booleanAttribute });

    readonly pressed = output<void>();

    protected handleClick(event: MouseEvent): void {
        if (this.disabled()) {
            event.stopPropagation();
            return;
        }

        this.pressed.emit();
    }
}
