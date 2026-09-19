import type { FaceHandTrackerConfig } from './types';

export const DEFAULT_CONFIG: FaceHandTrackerConfig = {
    numHands: 2,
    useGpu: true,
    thresholds: {
        eyeClosed: 0.35,
        mouthOpen: 0.35,
    },
    handModel: {
        minHandDetectionConfidence: 0.25,
        minHandPresenceConfidence: 0.25,
        minTrackingConfidence: 0.25,
    },
    handStability: {
        holdMs: 400,
        matchDistance: 0.3,
        duplicateDistance: 0.18,
    },
};

export const MODEL_PATHS = {
    wasm: 'wasm',
    face: 'models/face_landmarker.task',
    hand: 'models/hand_landmarker.task',
} as const;
