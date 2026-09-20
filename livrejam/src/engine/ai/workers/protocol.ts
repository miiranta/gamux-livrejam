import type { NeuralNetwork } from '../neural-network';

export interface InferenceInitRequest {
    type: 'init';
    url: string;
    expectedInputSize: number;
    expectedOutputSize: number;
}

export interface InferenceObserveRequest {
    type: 'observe';
    id: number;
    observation: Float32Array;
}

export interface InferenceDisposeRequest {
    type: 'dispose';
}

export type InferenceRequest =
    InferenceInitRequest | InferenceObserveRequest | InferenceDisposeRequest;

export interface InferenceReadyResponse {
    type: 'ready';
    inputSize: number;
    outputSize: number;
}

export interface InferenceActionResponse {
    type: 'action';
    id: number;
    action: number;
}

export interface InferenceErrorResponse {
    type: 'error';
    message: string;
}

export type InferenceResponse =
    InferenceReadyResponse | InferenceActionResponse | InferenceErrorResponse;

export type LoadedNetwork = NeuralNetwork;
