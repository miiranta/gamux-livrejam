import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Ornamented pixel-art frame used by every screen (menus, dialogs, end card).
 * The decorative trim/studs are rendered as spans so they survive the
 * `clip-path` silhouette.
 */
@Component({
    selector: 'app-pixel-panel',
    imports: [TranslatePipe],
    templateUrl: './pixel-panel.html',
    styleUrl: './pixel-panel.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PixelPanel {
    /** Translation key for the optional heading. */
    readonly titleKey = input<string | null>(null);
    /** Drop the background/frame and keep only the layout box. */
    readonly bare = input(false, { transform: booleanAttribute });
}
