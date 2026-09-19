import type { Classifications, NormalizedLandmark } from '@mediapipe/tasks-vision';

import { centroid } from '../math';
import { readBlendshape } from './blendshape-reader';
import { DEFAULT_CONFIG } from './config';
import { HandStabilizer } from './hand-stabilizer';
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
    private readonly handStabilizer: HandStabilizer;

    private readonly leftEye: SmoothedStateFilter<EyeState>;
    private readonly rightEye: SmoothedStateFilter<EyeState>;
    private readonly mouth: SmoothedStateFilter<MouthState>;

    private lastTimestamp = -1;

    constructor(options: FaceHandTrackerOptions = {}) {
        this.config = mergeConfig(options);

        const { eyeClosed, mouthOpen } = this.config.thresholds;
        this.leftEye = new SmoothedStateFilter<EyeState>('closed', 'open', eyeClosed);
        this.rightEye = new SmoothedStateFilter<EyeState>('closed', 'open', eyeClosed);
        this.mouth = new SmoothedStateFilter<MouthState>('open', 'closed', mouthOpen);

        this.handStabilizer = new HandStabilizer(this.config.handStability);
    }

    get isReady(): boolean {
        return this.models.isReady;
    }

    async init(): Promise<void> {
        await this.models.init(this.config);
    }

    process(video: HTMLVideoElement, timestamp: number): TrackingFrame {
        if (!this.models.isReady) {
            throw new Error('FaceHandTracker.process() called before init().');
        }

        const safeTimestamp = this.nextTimestamp(timestamp);
        const face = this.models.detectFace(video, safeTimestamp);
        const hands = this.models.detectHands(video, safeTimestamp);

        return {
            timestamp: safeTimestamp,
            face: this.toFaceState(face.landmarks[0], face.blendshapes[0]),
            hands: this.handStabilizer.resolve(toHandStates(hands), safeTimestamp),
        };
    }

    close(): void {
        this.models.close();
        this.handStabilizer.reset();
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
        handStability: { ...DEFAULT_CONFIG.handStability, ...options.handStability },
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
