import { TestBed } from '@angular/core/testing';

import { CameraStatusService } from '../services';

/**
 * Marks the camera as ready so `GameFlowService` lets a match start.
 *
 * Real matches require a working camera, so any test that drives the flow must
 * grant it first — otherwise the start is deferred and the camera popup takes
 * over instead.
 */
export function useReadyCamera(): CameraStatusService {
    const camera = TestBed.inject(CameraStatusService);
    camera.markReady();

    return camera;
}
