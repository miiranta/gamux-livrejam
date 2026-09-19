import type { Classifications, NormalizedLandmark } from '@mediapipe/tasks-vision';

import { centroid } from '../math';
import { readBlendshape } from './blendshape-reader';
import { DEFAULT_CONFIG } from './config';
import { toPoint3DList, FACE_LANDMARK } from './landmarks';
import { MediaPipeModels, type HandDetection } from './mediapipe-models';
import { SmoothedStateFilter } from './state-filter';
import type {
    EyeState,
    FaceHandTrackerConfig,
    FaceHandTrackerOptions,
    FaceState,
    Handedness,
    HandState,
    MouthState,
    TrackingFrame,
} from './types';

export class FaceHandTracker {
    private readonly config: FaceHandTrackerConfig;
    private readonly models = new MediaPipeModels();
    private readonly leftEye: SmoothedStateFilter<EyeState>;
    private readonly rightEye: SmoothedStateFilter<EyeState>;
    private readonly mouth: SmoothedStateFilter<MouthState>;

    private usingGpu: boolean;
    private lastTimestamp = -1;

    constructor(options: FaceHandTrackerOptions = {}) {
        this.config = mergeConfig(options);
        this.usingGpu = this.config.useGpu;

        const { eyeClosed, mouthOpen } = this.config.thresholds;
        this.leftEye = new SmoothedStateFilter<EyeState>('closed', 'open', eyeClosed);
        this.rightEye = new SmoothedStateFilter<EyeState>('closed', 'open', eyeClosed);
        this.mouth = new SmoothedStateFilter<MouthState>('open', 'closed', mouthOpen);
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

        return {
            timestamp: safeTimestamp,
            face: this.toFaceState(face.landmarks[0], face.blendshapes[0]),
            hands: toHandStates(hands),
        };
    }

    close(): void {
        this.models.close();
        this.resetExpressionState();
        this.lastTimestamp = -1;
    }

    private toFaceState(
        landmarks: NormalizedLandmark[] | undefined,
        blendshapes: Classifications | undefined,
    ): FaceState | null {
        if (!landmarks?.length) {
            this.resetExpressionState();
            return null;
        }

        const scores = {
            leftEyeBlink: readBlendshape(blendshapes, 'eyeBlinkLeft'),
            rightEyeBlink: readBlendshape(blendshapes, 'eyeBlinkRight'),
            jawOpen: readBlendshape(blendshapes, 'jawOpen'),
        };

        const points = toPoint3DList(landmarks);

        return {
            leftEye: {
                state: this.leftEye.update(scores.leftEyeBlink),
                center: points[FACE_LANDMARK.leftIrisCenter],
            },
            rightEye: {
                state: this.rightEye.update(scores.rightEyeBlink),
                center: points[FACE_LANDMARK.rightIrisCenter],
            },
            mouth: this.mouth.update(scores.jawOpen),
            scores,
            landmarks: points,
        };
    }

    private nextTimestamp(timestamp: number): number {
        this.lastTimestamp = timestamp > this.lastTimestamp ? timestamp : this.lastTimestamp + 1;
        return this.lastTimestamp;
    }

    private resetExpressionState(): void {
        this.leftEye.reset();
        this.rightEye.reset();
        this.mouth.reset();
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
