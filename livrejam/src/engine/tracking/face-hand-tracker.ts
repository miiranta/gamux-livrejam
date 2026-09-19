import type { Classifications, NormalizedLandmark } from '@mediapipe/tasks-vision';

import { centroid } from '../math';
import { readBlendshape } from './blendshape-reader';
import { DEFAULT_CONFIG } from './config';
import { toPoint3DList, FACE_LANDMARK } from './landmarks';
import { MediaPipeModels, type HandDetection } from './mediapipe-models';
import { EyeStream, GestureStreams, MouthStream } from './streams';
import type {
    FaceHandTrackerConfig,
    FaceHandTrackerOptions,
    FaceScores,
    FaceState,
    Handedness,
    HandState,
    TrackingFrame,
} from './types';

export class FaceHandTracker {
    private readonly config: FaceHandTrackerConfig;
    private readonly models = new MediaPipeModels();

    private readonly eyes: EyeStream;
    private readonly mouth: MouthStream;
    private readonly gestures = new GestureStreams();

    private usingGpu: boolean;
    private lastTimestamp = -1;

    constructor(options: FaceHandTrackerOptions = {}) {
        this.config = mergeConfig(options);
        this.usingGpu = this.config.useGpu;

        const { eyeClosed, mouthOpen } = this.config.thresholds;
        this.eyes = new EyeStream(eyeClosed);
        this.mouth = new MouthStream(mouthOpen);
    }

    get isReady(): boolean {
        return this.models.isReady;
    }

    get isUsingGpu(): boolean {
        return this.usingGpu && this.models.isUsingGpu;
    }

    async init(baseUrl: string): Promise<void> {
        await this.models.init(this.config, baseUrl);
    }

    process(image: ImageBitmap, timestamp: number): TrackingFrame {
        if (!this.models.isReady) {
            throw new Error('FaceHandTracker.process() called before init().');
        }

        const safeTimestamp = this.nextTimestamp(timestamp);
        const face = this.models.detectFace(image, safeTimestamp);
        const hands = this.models.detectHands(image, safeTimestamp);

        const faceState = this.toFaceState(face.landmarks[0], face.blendshapes[0]);
        const handStates = toHandStates(hands);

        return {
            timestamp: safeTimestamp,
            face: faceState,
            hands: handStates,
            gestures: this.gestures.update({
                face: faceState,
                hands: handStates,
                timestamp: safeTimestamp,
            }),
        };
    }

    close(): void {
        this.models.close();
        this.eyes.reset();
        this.mouth.reset();
        this.gestures.reset();
        this.lastTimestamp = -1;
    }

    private toFaceState(
        landmarks: NormalizedLandmark[] | undefined,
        blendshapes: Classifications | undefined,
    ): FaceState | null {
        if (!landmarks?.length) {
            this.eyes.reset();
            this.mouth.reset();
            return null;
        }

        const scores = readScores(blendshapes);
        const points = toPoint3DList(landmarks);
        const eyes = this.eyes.update({
            leftBlink: scores.leftEyeBlink,
            rightBlink: scores.rightEyeBlink,
            leftIris: points[FACE_LANDMARK.leftIrisCenter],
            rightIris: points[FACE_LANDMARK.rightIrisCenter],
        });

        return {
            leftEye: eyes.left,
            rightEye: eyes.right,
            mouth: this.mouth.update(scores.jawOpen),
            scores,
            landmarks: points,
        };
    }

    private nextTimestamp(timestamp: number): number {
        this.lastTimestamp = timestamp > this.lastTimestamp ? timestamp : this.lastTimestamp + 1;
        return this.lastTimestamp;
    }
}

function mergeConfig(options: FaceHandTrackerOptions): FaceHandTrackerConfig {
    return {
        ...DEFAULT_CONFIG,
        ...options,
        thresholds: { ...DEFAULT_CONFIG.thresholds, ...options.thresholds },
        handModel: { ...DEFAULT_CONFIG.handModel, ...options.handModel },
    };
}

function toHandStates(detection: HandDetection): HandState[] {
    return detection.landmarks.map((landmarks, index) => {
        const points = toPoint3DList(landmarks);
        const category = detection.handedness[index]?.[0];

        return {
            handedness: toHandedness(category?.categoryName),
            score: category?.score ?? 0,
            landmarks: points,
            worldLandmarks: toPoint3DList(detection.worldLandmarks[index] ?? []),
            center: centroid(points),
        };
    });
}

function toHandedness(name: string | undefined): Handedness {
    return name === 'Left' || name === 'Right' ? name : 'Unknown';
}

function readScores(blendshapes: Classifications | undefined): FaceScores {
    return {
        leftEyeBlink: readBlendshape(blendshapes, 'eyeBlinkLeft'),
        rightEyeBlink: readBlendshape(blendshapes, 'eyeBlinkRight'),
        jawOpen: readBlendshape(blendshapes, 'jawOpen'),
        browInnerUp: readBlendshape(blendshapes, 'browInnerUp'),
        browOuterUpLeft: readBlendshape(blendshapes, 'browOuterUpLeft'),
        browOuterUpRight: readBlendshape(blendshapes, 'browOuterUpRight'),
        eyeSquintLeft: readBlendshape(blendshapes, 'eyeSquintLeft'),
        eyeSquintRight: readBlendshape(blendshapes, 'eyeSquintRight'),
        mouthSmileLeft: readBlendshape(blendshapes, 'mouthSmileLeft'),
        mouthSmileRight: readBlendshape(blendshapes, 'mouthSmileRight'),
        mouthPressLeft: readBlendshape(blendshapes, 'mouthPressLeft'),
        mouthPressRight: readBlendshape(blendshapes, 'mouthPressRight'),
    };
}
