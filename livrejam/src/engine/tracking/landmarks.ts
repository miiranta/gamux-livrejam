import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

import type { Point3D } from '../math';

export const FACE_LANDMARK = {
    leftIrisCenter: 473,
    rightIrisCenter: 468,
    upperLipInner: 13,
    lowerLipInner: 14,
} as const;

export const HAND_LANDMARK = {
    wrist: 0,
    indexMcp: 5,
    indexPip: 6,
    indexTip: 8,
    middleMcp: 9,
    middlePip: 10,
    middleTip: 12,
    ringPip: 14,
    ringTip: 16,
    pinkyPip: 18,
    pinkyTip: 20,
} as const;

export const FACE_OVAL = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152,
    148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
] as const;

export function toPoint3D(landmark: NormalizedLandmark): Point3D {
    return { x: landmark.x, y: landmark.y, z: landmark.z };
}

export function toPoint3DList(landmarks: NormalizedLandmark[]): Point3D[] {
    return landmarks.map(toPoint3D);
}
