import type { FaceHandTrackerOptions, TrackingFrame } from '../tracking';

export interface WorkerInitRequest {
    type: 'init';
    baseUrl: string;
    options: FaceHandTrackerOptions;
}

export interface WorkerDetectRequest {
    type: 'detect';
    bitmap: ImageBitmap;
    timestamp: number;
}

export interface WorkerDisposeRequest {
    type: 'dispose';
}

export type WorkerRequest = WorkerInitRequest | WorkerDetectRequest | WorkerDisposeRequest;

export interface WorkerReadyResponse {
    type: 'ready';
    usingGpu: boolean;
}

export interface WorkerFrameResponse {
    type: 'frame';
    frame: TrackingFrame;
}

export interface WorkerErrorResponse {
    type: 'error';
    message: string;
}

export type WorkerResponse = WorkerReadyResponse | WorkerFrameResponse | WorkerErrorResponse;
