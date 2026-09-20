import { NeuralNetwork } from './neural-network';

export interface SerializedNetwork {
    format: string;
    sizes: number[];
    weights: number[];
    biases: number[];
}

export function parseNetwork(data: unknown): NeuralNetwork {
    const serialized = data as SerializedNetwork | null;

    if (!serialized || !Array.isArray(serialized.sizes) || serialized.sizes.length < 2) {
        throw new Error('Modelo invalido: metadados ausentes.');
    }

    const expected = countParameters(serialized.sizes);
    if (
        serialized.weights?.length !== expected.weights ||
        serialized.biases?.length !== expected.biases
    ) {
        throw new Error('Modelo invalido: tamanho dos parametros nao confere com as camadas.');
    }

    return new NeuralNetwork({
        sizes: serialized.sizes,
        weights: Float32Array.from(serialized.weights),
        biases: Float32Array.from(serialized.biases),
    });
}

export function countParameters(sizes: readonly number[]): {
    weights: number;
    biases: number;
} {
    let weights = 0;
    let biases = 0;

    for (let layer = 1; layer < sizes.length; layer++) {
        weights += sizes[layer] * sizes[layer - 1];
        biases += sizes[layer];
    }

    return { weights, biases };
}
