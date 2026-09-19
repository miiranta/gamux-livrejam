import type { Point2D, Point3D } from '../math';
import type {
    EyeObservation,
    EyeState,
    GestureObservations,
    MouthObservation,
    MouthState,
} from './streams/types';

export type { EyeObservation, EyeState, GestureObservations, MouthState, Point2D, Point3D };

export type Handedness = 'Left' | 'Right' | 'Unknown';

export interface FaceScores {
    leftEyeBlink: number;
    rightEyeBlink: number;
    jawOpen: number;
    browInnerUp: number;
    browOuterUpLeft: number;
    browOuterUpRight: number;
    eyeSquintLeft: number;
    eyeSquintRight: number;
    mouthSmileLeft: number;
    mouthSmileRight: number;
    mouthPressLeft: number;
    mouthPressRight: number;
}

export interface FaceState {
    leftEye: EyeObservation;
    rightEye: EyeObservation;
    mouth: MouthObservation;
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
    gestures: GestureObservations;
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

export interface FaceHandTrackerConfig {
    numHands: number;
    useGpu: boolean;
    thresholds: TrackingThresholds;
    handModel: HandModelOptions;
}

export type FaceHandTrackerOptions = Partial<{
    [K in keyof FaceHandTrackerConfig]: Partial<FaceHandTrackerConfig[K]>;
}>;
