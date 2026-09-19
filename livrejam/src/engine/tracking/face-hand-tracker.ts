import {
    FaceLandmarker,
    FilesetResolver,
    HandLandmarker,
    type Classifications,
    type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

import { BLENDSHAPE_INDEX, type BlendshapeName } from './blendshapes';
import type {
    FaceState,
    HandState,
    Handedness,
    MouthState,
    EyeState,
    Point2D,
    Point3D,
    TrackingFrame,
    TrackingThresholds,
} from './types';

export const DEFAULT_THRESHOLDS: TrackingThresholds = {
    eyeClosed: 0.5,
    mouthOpen: 0.35,
};

const HYSTERESIS = 0.08;

function assetUrl(path: string): string {
    return new URL(path, document.baseURI).href;
}

function toPoint3D(landmark: NormalizedLandmark): Point3D {
    return { x: landmark.x, y: landmark.y, z: landmark.z };
}

function centroid(landmarks: Point3D[]): Point2D {
    if (landmarks.length === 0) {
        return { x: 0, y: 0 };
    }
    let x = 0;
    let y = 0;
    for (const point of landmarks) {
        x += point.x;
        y += point.y;
    }
    return { x: x / landmarks.length, y: y / landmarks.length };
}

function readScore(blendshapes: Classifications | undefined, name: BlendshapeName): number {
    const categories = blendshapes?.categories;
    if (!categories) {
        return 0;
    }

    const byName = categories.find((entry) => entry.categoryName === name);
    if (byName) {
        return byName.score;
    }

    const index = BLENDSHAPE_INDEX[name];
    return categories.find((entry) => entry.index === index)?.score ?? 0;
}

function toHandedness(name: string | undefined): Handedness {
    return name === 'Left' || name === 'Right' ? name : 'Unknown';
}

class BinaryStateFilter<TState extends string> {
    private state: TState;

    constructor(
        private readonly onState: TState,
        private readonly offState: TState,
        private readonly onThreshold: number,
    ) {
        this.state = offState;
    }

    update(score: number): TState {
        const isOn = this.state === this.onState;
        this.state = isOn
            ? score < this.onThreshold - HYSTERESIS
                ? this.offState
                : this.onState
            : score > this.onThreshold + HYSTERESIS
              ? this.onState
              : this.offState;
        return this.state;
    }

    reset(): void {
        this.state = this.offState;
    }
}

export interface FaceHandTrackerOptions {
    thresholds?: TrackingThresholds;
    numHands?: number;
    useGpu?: boolean;
}

export class FaceHandTracker {
    private faceLandmarker: FaceLandmarker | null = null;
    private handLandmarker: HandLandmarker | null = null;
    private lastTimestamp = -1;

    private readonly leftEyeFilter: BinaryStateFilter<EyeState>;
    private readonly rightEyeFilter: BinaryStateFilter<EyeState>;
    private readonly mouthFilter: BinaryStateFilter<MouthState>;

    private readonly thresholds: TrackingThresholds;
    private readonly numHands: number;
    private readonly useGpu: boolean;

    constructor(options: FaceHandTrackerOptions = {}) {
        this.thresholds = options.thresholds ?? DEFAULT_THRESHOLDS;
        this.numHands = options.numHands ?? 2;
        this.useGpu = options.useGpu ?? true;

        this.leftEyeFilter = new BinaryStateFilter<EyeState>(
            'closed',
            'open',
            this.thresholds.eyeClosed,
        );
        this.rightEyeFilter = new BinaryStateFilter<EyeState>(
            'closed',
            'open',
            this.thresholds.eyeClosed,
        );
        this.mouthFilter = new BinaryStateFilter<MouthState>(
            'open',
            'closed',
            this.thresholds.mouthOpen,
        );
    }

    get isReady(): boolean {
        return this.faceLandmarker !== null && this.handLandmarker !== null;
    }

    async init(): Promise<void> {
        if (this.isReady) {
            return;
        }

        const vision = await FilesetResolver.forVisionTasks(assetUrl('wasm'));

        const buildFace = (delegate: 'GPU' | 'CPU') =>
            FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: assetUrl('models/face_landmarker.task'),
                    delegate,
                },
                runningMode: 'VIDEO',
                numFaces: 1,
                outputFaceBlendshapes: true,
            });

        const buildHand = (delegate: 'GPU' | 'CPU') =>
            HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: assetUrl('models/hand_landmarker.task'),
                    delegate,
                },
                runningMode: 'VIDEO',
                numHands: this.numHands,
            });

        try {
            const delegate = this.useGpu ? 'GPU' : 'CPU';
            [this.faceLandmarker, this.handLandmarker] = await Promise.all([
                buildFace(delegate),
                buildHand(delegate),
            ]);
        } catch (error) {
            if (!this.useGpu) {
                throw error;
            }

            console.warn('FaceHandTracker: GPU delegate failed, retrying on CPU.', error);
            [this.faceLandmarker, this.handLandmarker] = await Promise.all([
                buildFace('CPU'),
                buildHand('CPU'),
            ]);
        }
    }

    process(video: HTMLVideoElement, timestamp: number): TrackingFrame {
        if (!this.faceLandmarker || !this.handLandmarker) {
            throw new Error('FaceHandTracker.process() called before init().');
        }

        const safeTimestamp = timestamp > this.lastTimestamp ? timestamp : this.lastTimestamp + 1;
        this.lastTimestamp = safeTimestamp;

        const faceResult = this.faceLandmarker.detectForVideo(video, safeTimestamp);
        const handResult = this.handLandmarker.detectForVideo(video, safeTimestamp);

        return {
            timestamp: safeTimestamp,
            face: this.toFaceState(faceResult.faceLandmarks[0], faceResult.faceBlendshapes[0]),
            hands: handResult.landmarks.map((landmarks, index) => {
                const category = handResult.handedness[index]?.[0];
                return this.toHandState(
                    landmarks,
                    handResult.worldLandmarks[index] ?? [],
                    category?.categoryName,
                    category?.score ?? 0,
                );
            }),
        };
    }

    close(): void {
        this.faceLandmarker?.close();
        this.handLandmarker?.close();
        this.faceLandmarker = null;
        this.handLandmarker = null;
        this.lastTimestamp = -1;
        this.leftEyeFilter.reset();
        this.rightEyeFilter.reset();
        this.mouthFilter.reset();
    }

    private toFaceState(
        landmarks: NormalizedLandmark[] | undefined,
        blendshapes: Classifications | undefined,
    ): FaceState | null {
        if (!landmarks || landmarks.length === 0) {
            return null;
        }

        const leftEyeBlink = readScore(blendshapes, 'eyeBlinkLeft');
        const rightEyeBlink = readScore(blendshapes, 'eyeBlinkRight');
        const jawOpen = readScore(blendshapes, 'jawOpen');

        return {
            leftEye: this.leftEyeFilter.update(leftEyeBlink),
            rightEye: this.rightEyeFilter.update(rightEyeBlink),
            mouth: this.mouthFilter.update(jawOpen),
            scores: { leftEyeBlink, rightEyeBlink, jawOpen },
            landmarks: landmarks.map(toPoint3D),
        };
    }

    private toHandState(
        landmarks: NormalizedLandmark[],
        worldLandmarks: NormalizedLandmark[],
        handednessName: string | undefined,
        score: number,
    ): HandState {
        const points = landmarks.map(toPoint3D);
        return {
            handedness: toHandedness(handednessName),
            score,
            landmarks: points,
            worldLandmarks: worldLandmarks.map(toPoint3D),
            center: centroid(points),
        };
    }
}
