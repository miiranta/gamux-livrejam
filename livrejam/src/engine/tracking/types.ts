export interface Point2D {
    x: number;
    y: number;
}

export interface Point3D extends Point2D {
    z: number;
}

export type EyeState = 'open' | 'closed';

export type MouthState = 'open' | 'closed';

export type Handedness = 'Left' | 'Right' | 'Unknown';

export interface FaceScores {
    leftEyeBlink: number;
    rightEyeBlink: number;
    jawOpen: number;
}

export interface FaceState {
    leftEye: EyeState;
    rightEye: EyeState;
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
