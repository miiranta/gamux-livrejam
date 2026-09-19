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

    get isReady(): boolean {
        return this.face !== null && this.hand !== null;
    }

    async init(config: FaceHandTrackerConfig): Promise<void> {
        if (this.isReady) {
            return;
        }

        const vision = await FilesetResolver.forVisionTasks(assetUrl(MODEL_PATHS.wasm));

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

    detectFace(video: HTMLVideoElement, timestamp: number): FaceDetection {
        if (!this.face) {
            throw new Error('Face model not initialised.');
        }

        const result = this.face.detectForVideo(video, timestamp);
        return { landmarks: result.faceLandmarks, blendshapes: result.faceBlendshapes };
    }

    detectHands(video: HTMLVideoElement, timestamp: number): HandDetection {
        if (!this.hand) {
            throw new Error('Hand model not initialised.');
        }

        const result = this.hand.detectForVideo(video, timestamp);
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
    }

    private async load(
        vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
        config: FaceHandTrackerConfig,
        delegate: Delegate,
    ): Promise<void> {
        const [face, hand] = await Promise.all([
            FaceLandmarker.createFromOptions(vision, {
                baseOptions: { modelAssetPath: assetUrl(MODEL_PATHS.face), delegate },
                runningMode: 'VIDEO',
                numFaces: 1,
                outputFaceBlendshapes: true,
            }),
            HandLandmarker.createFromOptions(vision, {
                baseOptions: { modelAssetPath: assetUrl(MODEL_PATHS.hand), delegate },
                runningMode: 'VIDEO',
                numHands: config.numHands,
                ...config.handModel,
            }),
        ]);

        this.face = face;
        this.hand = hand;
    }
}

function assetUrl(path: string): string {
    return new URL(path, document.baseURI).href;
}
