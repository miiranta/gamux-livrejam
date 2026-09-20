export interface NeuralNetworkOptions {
    sizes: number[];
    weights: Float32Array;
    biases: Float32Array;
}

export class NeuralNetwork {
    readonly sizes: readonly number[];
    readonly inputSize: number;
    readonly outputSize: number;

    private readonly weights: Float32Array;
    private readonly biases: Float32Array;
    private readonly activations: Float32Array[];
    constructor(options: NeuralNetworkOptions) {
        this.sizes = [...options.sizes];
        this.inputSize = options.sizes[0];
        this.outputSize = options.sizes[options.sizes.length - 1];
        this.weights = options.weights;
        this.biases = options.biases;
        this.activations = options.sizes.map((size) => new Float32Array(size));
    }

    forward(input: Float32Array | readonly number[], output: Float32Array): Float32Array {
        const first = this.activations[0];
        for (let index = 0; index < this.inputSize; index++) {
            first[index] = input[index];
        }

        let weightOffset = 0;
        let biasOffset = 0;

        for (let layer = 1; layer < this.sizes.length; layer++) {
            const previous = this.activations[layer - 1];
            const current = this.activations[layer];
            const currentSize = this.sizes[layer];
            const previousSize = this.sizes[layer - 1];
            const isOutput = layer === this.sizes.length - 1;

            for (let unit = 0; unit < currentSize; unit++) {
                let sum = this.biases[biasOffset + unit];

                for (let source = 0; source < previousSize; source++) {
                    sum += previous[source] * this.weights[weightOffset + source];
                }

                current[unit] = isOutput ? sum : Math.tanh(sum);
                weightOffset += previousSize;
            }

            biasOffset += currentSize;
        }

        output.set(this.activations[this.sizes.length - 1]);
        return output;
    }

    argmax(output: Float32Array): number {
        let best = 0;
        for (let index = 1; index < output.length; index++) {
            if (output[index] > output[best]) {
                best = index;
            }
        }
        return best;
    }
}
