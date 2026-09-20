import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { Camera } from '../camera/camera';
import { PixelButton } from '../pixel-button/pixel-button';
import { PixelPanel } from '../pixel-panel/pixel-panel';
import { HoverSound } from '../../directives';
import { CameraStatusService, GameFlowService } from '../../services';

/**
 * Blocking popup shown when a match cannot start because the camera is
 * unusable. The only ways out are granting access (via `Try again`) or going
 * back to the menu — a match cannot run without face tracking.
 *
 * The live preview reuses {@link Camera}, so the player sees the exact feed
 * the tracker will consume as soon as the browser grants permission.
 */
@Component({
    selector: 'app-camera-gate',
    imports: [Camera, HoverSound, PixelButton, PixelPanel, TranslatePipe],
    templateUrl: './camera-gate.html',
    styleUrl: './camera-gate.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CameraGate {
    protected readonly flow = inject(GameFlowService);
    protected readonly camera = inject(CameraStatusService);

    protected readonly reasonKey = computed(() => `camera.gate.reason.${this.camera.reason()}`);

    protected readonly retrying = computed(() => this.camera.status() === 'starting');

    /**
     * The raw browser message is only useful when the translated reason cannot
     * explain the failure, since otherwise it repeats the same sentence in
     * English only.
     */
    protected readonly showDetail = computed(() => this.camera.reason() === 'unknown');

    protected retry(): void {
        if (this.retrying()) {
            return;
        }

        this.camera.requestRetry();
    }

    protected back(): void {
        this.flow.abandon();
    }
}
