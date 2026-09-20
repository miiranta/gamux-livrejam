import type { InferenceRequest, InferenceResponse } from './protocol';

export interface InferenceWorkerClientOptions {
    url: string;
    expectedInputSize: number;
    expectedOutputSize: number;
    onReady?: (inputSize: number, outputSize: number) => void;
    onError?: (message: string) => void;
}

interface PendingRequest {
    resolve: (action: number) => void;
    reject: (error: Error) => void;
}

export class InferenceWorkerClient {
    private worker: Worker | null = null;
    private nextId = 1;
    private readonly pending = new Map<number, PendingRequest>();

    constructor(private readonly options: InferenceWorkerClientOptions) {}

    get isReady(): boolean {
        return this.worker !== null;
    }

    async start(): Promise<void> {
        if (this.worker) {
            return;
        }

        const worker = new Worker(new URL('./inference.worker', import.meta.url), {
            type: 'module',
        });

        await this.waitForReady(worker);

        worker.addEventListener('message', (event: MessageEvent<InferenceResponse>) => {
            const message = event.data;

            if (message.type === 'action') {
                const request = this.pending.get(message.id);
                this.pending.delete(message.id);
                request?.resolve(message.action);
            } else if (message.type === 'error') {
                this.rejectAll(new Error(message.message));
                this.options.onError?.(message.message);
            }
        });

        worker.addEventListener('error', (event) => {
            this.rejectAll(new Error(event.message));
            this.options.onError?.(event.message);
        });

        this.worker = worker;
    }

    predict(observation: Float32Array): Promise<number> {
        const worker = this.worker;
        if (!worker) {
            return Promise.reject(new Error('Inferencia nao iniciada.'));
        }

        const id = this.nextId++;
        const request: InferenceRequest = { type: 'observe', id, observation };

        return new Promise<number>((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            worker.postMessage(request);
        });
    }

    stop(): void {
        if (!this.worker) {
            return;
        }

        const request: InferenceRequest = { type: 'dispose' };
        this.worker.postMessage(request);
        this.worker.terminate();
        this.worker = null;
        this.rejectAll(new Error('Inferencia encerrada.'));
    }

    private rejectAll(error: Error): void {
        for (const request of this.pending.values()) {
            request.reject(error);
        }
        this.pending.clear();
    }

    private waitForReady(worker: Worker): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const onMessage = (event: MessageEvent<InferenceResponse>) => {
                if (event.data.type === 'ready') {
                    worker.removeEventListener('message', onMessage);
                    this.options.onReady?.(event.data.inputSize, event.data.outputSize);
                    resolve();
                } else if (event.data.type === 'error') {
                    worker.removeEventListener('message', onMessage);
                    reject(new Error(event.data.message));
                }
            };

            worker.addEventListener('message', onMessage);
            worker.addEventListener('error', (event) => reject(new Error(event.message)), {
                once: true,
            });

            const request: InferenceRequest = {
                type: 'init',
                url: this.options.url,
                expectedInputSize: this.options.expectedInputSize,
                expectedOutputSize: this.options.expectedOutputSize,
            };
            worker.postMessage(request);
        });
    }
}
