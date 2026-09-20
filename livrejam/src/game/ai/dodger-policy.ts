import { NeuralNetwork, type InferenceWorkerClient } from '../../engine/ai';
import { DODGER_ACTIONS, decodeAction, type ActionIntent } from './observation';

export interface PolicyLike {
    readonly ready: boolean;
    decide(observation: Float32Array): number;
}

export class DodgerPolicy implements PolicyLike {
    private readonly scores: Float32Array<ArrayBuffer>;

    constructor(private readonly network: NeuralNetwork) {
        this.scores = new Float32Array(
            new ArrayBuffer(network.outputSize * Float32Array.BYTES_PER_ELEMENT),
        );
    }

    get ready(): boolean {
        return true;
    }

    decide(observation: Float32Array): number {
        this.network.forward(observation, this.scores);
        return this.network.argmax(this.scores);
    }
}

export class IdlePolicy implements PolicyLike {
    get ready(): boolean {
        return true;
    }

    decide(): number {
        return DODGER_ACTIONS.none;
    }
}

export class RemoteDodgerPolicy implements PolicyLike {
    private action: number = DODGER_ACTIONS.none;
    private pending = false;

    constructor(private readonly client: InferenceWorkerClient) {}

    get ready(): boolean {
        return this.client.isReady;
    }

    decide(observation: Float32Array): number {
        if (this.pending) {
            return this.action;
        }

        this.pending = true;
        this.client
            .predict(observation)
            .then((action) => {
                this.action = action;
            })
            .catch(() => undefined)
            .finally(() => {
                this.pending = false;
            });

        return this.action;
    }
}

export function intentFor(action: number): ActionIntent {
    return decodeAction(action);
}
