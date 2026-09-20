import type { FaceHandTrackerConfig } from './types';

export const DEFAULT_CONFIG: FaceHandTrackerConfig = {
    numHands: 2,
    useGpu: true,
    thresholds: {
        eyeClosed: 0.35,
        mouthOpen: 0.35,
    },
    handModel: {
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
    },
};

export const MODEL_PATHS = {
    wasm: 'wasm',
    face: 'models/face_landmarker.task',
    hand: 'models/hand_landmarker.task',
} as const;
