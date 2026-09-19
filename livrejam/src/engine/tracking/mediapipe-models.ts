import {
    FaceLandmarker,
    FilesetResolver,
    HandLandmarker,
    type Category,
    type Classifications,
    type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

import { MODEL_PATHS } from './config';
import type { FaceHandTrackerConfig } from './types';

type Delegate = 'GPU' | 'CPU';

export interface FaceDetection {
    landmarks: NormalizedLandmark[][];
    blendshapes: Classifications[];
}

export interface HandDetection {
    landmarks: NormalizedLandmark[][];
    worldLandmarks: NormalizedLandmark[][];
    handedness: Category[][];
}

export class MediaPipeModels {
    private face: FaceLandmarker | null = null;
    private hand: HandLandmarker | null = null;
    private baseUrl = '';
    private delegate: Delegate = 'CPU';

    get isReady(): boolean {
        return this.face !== null && this.hand !== null;
    }

    get isUsingGpu(): boolean {
        return this.delegate === 'GPU';
    }

    async init(config: FaceHandTrackerConfig, baseUrl: string): Promise<void> {
        if (this.isReady) {
            return;
        }

        this.baseUrl = baseUrl;
        const vision = await FilesetResolver.forVisionTasks(
            this.assetUrl(MODEL_PATHS.wasm),
            isWorkerContext(),
        );

        try {
            await this.load(vision, config, config.useGpu ? 'GPU' : 'CPU');
        } catch (error) {
            if (!config.useGpu) {
                throw error;
            }

            console.warn('MediaPipeModels: GPU delegate failed, retrying on CPU.', error);
            await this.load(vision, config, 'CPU');
        }
    }

    detectFace(image: ImageBitmap, timestamp: number): FaceDetection {
        if (!this.face) {
            throw new Error('Face model not initialised.');
        }

        const result = this.face.detectForVideo(image, timestamp);
        return { landmarks: result.faceLandmarks, blendshapes: result.faceBlendshapes };
    }

    detectHands(image: ImageBitmap, timestamp: number): HandDetection {
        if (!this.hand) {
            throw new Error('Hand model not initialised.');
        }

        const result = this.hand.detectForVideo(image, timestamp);
        return {
            landmarks: result.landmarks,
            worldLandmarks: result.worldLandmarks,
            handedness: result.handedness,
        };
    }

    close(): void {
        this.face?.close();
        this.hand?.close();
        this.face = null;
        this.hand = null;
        this.delegate = 'CPU';
    }

    private async load(
        vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
        config: FaceHandTrackerConfig,
        delegate: Delegate,
    ): Promise<void> {
        const [face, hand] = await Promise.all([
            FaceLandmarker.createFromOptions(vision, {
                baseOptions: { modelAssetPath: this.assetUrl(MODEL_PATHS.face), delegate },
                runningMode: 'VIDEO',
                numFaces: 1,
                outputFaceBlendshapes: true,
            }),
            HandLandmarker.createFromOptions(vision, {
                baseOptions: { modelAssetPath: this.assetUrl(MODEL_PATHS.hand), delegate },
                runningMode: 'VIDEO',
                numHands: config.numHands,
                ...config.handModel,
            }),
        ]);

        this.face = face;
        this.hand = hand;
        this.delegate = delegate;
    }

    private assetUrl(path: string): string {
        return new URL(path, this.baseUrl).href;
    }
}

function isWorkerContext(): boolean {
    return typeof window === 'undefined';
}
