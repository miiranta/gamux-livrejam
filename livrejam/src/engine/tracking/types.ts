import type { Point2D, Point3D } from '../math';

export type { Point2D, Point3D };

export type EyeState = 'open' | 'closed';

export type MouthState = 'open' | 'closed';

export type Handedness = 'Left' | 'Right' | 'Unknown';

export interface FaceScores {
    leftEyeBlink: number;
    rightEyeBlink: number;
    jawOpen: number;
}

export interface EyeObservation {
    state: EyeState;
    center: Point2D;
}

export interface FaceState {
    leftEye: EyeObservation;
    rightEye: EyeObservation;
    mouth: MouthState;
    scores: FaceScores;
    landmarks: Point3D[];
}

export interface HandState {
    handedness: Handedness;
    score: number;
    landmarks: Point3D[];
    worldLandmarks: Point3D[];
    center: Point2D;
}

export interface TrackingFrame {
    timestamp: number;
    face: FaceState | null;
    hands: HandState[];
}

export interface TrackingThresholds {
    eyeClosed: number;
    mouthOpen: number;
}

export interface HandModelOptions {
    minHandDetectionConfidence: number;
    minHandPresenceConfidence: number;
    minTrackingConfidence: number;
}

export interface HandStabilityOptions {
    holdMs: number;
    matchDistance: number;
    duplicateDistance: number;
}

export interface FaceHandTrackerConfig {
    numHands: number;
    useGpu: boolean;
    thresholds: TrackingThresholds;
    handModel: HandModelOptions;
    handStability: HandStabilityOptions;
}

export type FaceHandTrackerOptions = Partial<{
    [K in keyof FaceHandTrackerConfig]: Partial<FaceHandTrackerConfig[K]>;
}>;
