import { describe, expect, it } from 'vitest';

import { NeuralNetwork } from './neural-network';
import { countParameters, parseNetwork } from './model-format';

function identityNetwork(): NeuralNetwork {
    return new NeuralNetwork({
        sizes: [2, 2],
        weights: Float32Array.from([1, 0, 0, 1]),
        biases: Float32Array.from([0, 0]),
    });
}

describe('NeuralNetwork', () => {
    it('applies weights and biases on the output layer without squashing', () => {
        const network = new NeuralNetwork({
            sizes: [2, 1],
            weights: Float32Array.from([2, -1]),
            biases: Float32Array.from([0.5]),
        });

        const output = network.forward(Float32Array.from([1, 1]), new Float32Array(1));

        expect(output[0]).toBeCloseTo(1.5, 6);
    });

    it('squashes hidden layers with tanh', () => {
        const network = new NeuralNetwork({
            sizes: [1, 1, 1],
            weights: Float32Array.from([100, 1]),
            biases: Float32Array.from([0, 0]),
        });

        const output = network.forward(Float32Array.from([1]), new Float32Array(1));

        expect(output[0]).toBeCloseTo(1, 5);
    });

    it('picks the highest scoring action', () => {
        const network = identityNetwork();
        const scores = network.forward(Float32Array.from([0.2, 0.9]), new Float32Array(2));

        expect(network.argmax(scores)).toBe(1);
    });

    it('reuses the output buffer across calls', () => {
        const network = identityNetwork();
        const buffer = new Float32Array(2);

        const first = network.forward(Float32Array.from([1, 0]), buffer);
        const second = network.forward(Float32Array.from([0, 1]), buffer);

        expect(first).toBe(second);
        expect(Array.from(second)).toEqual([0, 1]);
    });
});

describe('parseNetwork', () => {
    it('rebuilds a network from a serialized payload', () => {
        const network = parseNetwork({
            format: 'livrejam.mlp.v1',
            sizes: [2, 2, 1],
            weights: [1, 0, 0, 1, 1, 1],
            biases: [0, 0, 0],
        });

        expect(network.inputSize).toBe(2);
        expect(network.outputSize).toBe(1);
    });

    it('rejects a payload whose parameter count does not match', () => {
        expect(() =>
            parseNetwork({
                format: 'livrejam.mlp.v1',
                sizes: [2, 3],
                weights: [1, 2],
                biases: [0, 0, 0],
            }),
        ).toThrow();
    });

    it('counts parameters from the layer sizes', () => {
        expect(countParameters([24, 64, 64, 6])).toEqual({ weights: 6016, biases: 134 });
    });
});
