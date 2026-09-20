import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type PixelIconName =
    | 'hand'
    | 'eye'
    | 'mouth'
    | 'move'
    | 'jump'
    | 'dash'
    | 'run'
    | 'fastFall';

@Component({
    selector: 'app-pixel-icon',
    templateUrl: './pixel-icon.html',
    styleUrl: './pixel-icon.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PixelIcon {
    readonly name = input.required<PixelIconName>();
}
