/// <reference lib="webworker" />

import { parseNetwork } from '../model-format';
import type { NeuralNetwork } from '../neural-network';
import type { InferenceRequest, InferenceResponse } from './protocol';

let network: NeuralNetwork | null = null;
let output = new Float32Array(0);

function respond(message: InferenceResponse): void {
    self.postMessage(message);
}

async function handleInit(request: Extract<InferenceRequest, { type: 'init' }>): Promise<void> {
    const response = await fetch(request.url);
    if (!response.ok) {
        throw new Error(`Falha ao carregar o modelo: ${response.status}`);
    }

    network = parseNetwork(await response.json());

    if (network.inputSize !== request.expectedInputSize) {
        throw new Error(
            `Modelo incompativel: espera ${request.expectedInputSize} entradas, ` +
                `o arquivo tem ${network.inputSize}. Retreine com tools/ai/train.py.`,
        );
    }

    if (network.outputSize !== request.expectedOutputSize) {
        throw new Error(
            `Modelo incompativel: espera ${request.expectedOutputSize} saidas, ` +
                `o arquivo tem ${network.outputSize}.`,
        );
    }

    output = new Float32Array(network.outputSize);
    respond({
        type: 'ready',
        inputSize: network.inputSize,
        outputSize: network.outputSize,
    });
}

function handleObserve(request: Extract<InferenceRequest, { type: 'observe' }>): void {
    if (!network) {
        throw new Error('Inferencia recebida antes da inicializacao.');
    }

    const scores = network.forward(request.observation, output);
    respond({ type: 'action', id: request.id, action: network.argmax(scores) });
}

function handleDispose(): void {
    network = null;
}

self.onmessage = async (event: MessageEvent<InferenceRequest>) => {
    const request = event.data;

    try {
        switch (request.type) {
            case 'init':
                await handleInit(request);
                break;
            case 'observe':
                handleObserve(request);
                break;
            case 'dispose':
                handleDispose();
                break;
        }
    } catch (error) {
        respond({
            type: 'error',
            message: error instanceof Error ? error.message : String(error),
        });
    }
};
