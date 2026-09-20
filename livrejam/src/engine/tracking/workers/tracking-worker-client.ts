import type { FaceHandTrackerOptions, TrackingFrame } from '..';
import type { WorkerRequest, WorkerResponse } from './protocol';

export interface TrackingWorkerClientOptions {
    options?: FaceHandTrackerOptions;
    onFrame: (frame: TrackingFrame) => void;
    onError: (message: string) => void;
    onReady?: (usingGpu: boolean) => void;
}

export class TrackingWorkerClient {
    private worker: Worker | null = null;
    private busy = false;
    private gpu = false;

    constructor(private readonly callbacks: TrackingWorkerClientOptions) {}

    async start(): Promise<void> {
        if (this.worker) {
            return;
        }

        const worker = new Worker(new URL('./tracking.worker', import.meta.url), {
            type: 'module',
        });

        await this.waitForReady(worker);

        worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
            this.busy = false;

            if (event.data.type === 'frame') {
                this.callbacks.onFrame(event.data.frame);
            } else if (event.data.type === 'error') {
                this.callbacks.onError(event.data.message);
            }
        });

        this.worker = worker;
    }

    get isBusy(): boolean {
        return this.busy;
    }

    get isReady(): boolean {
        return this.worker !== null;
    }

    get isUsingGpu(): boolean {
        return this.gpu;
    }

    detect(bitmap: ImageBitmap, timestamp: number): void {
        if (!this.worker || this.busy) {
            bitmap.close();
            return;
        }

        this.busy = true;
        this.worker.postMessage({ type: 'detect', bitmap, timestamp } satisfies WorkerRequest, [
            bitmap,
        ]);
    }

    stop(): void {
        if (!this.worker) {
            return;
        }

        const request: WorkerRequest = { type: 'dispose' };
        this.worker.postMessage(request);
        this.worker.terminate();
        this.worker = null;
        this.busy = false;
    }

    private waitForReady(worker: Worker): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const onMessage = (event: MessageEvent<WorkerResponse>) => {
                if (event.data.type === 'ready') {
                    worker.removeEventListener('message', onMessage);
                    this.gpu = event.data.usingGpu;
                    this.callbacks.onReady?.(this.gpu);
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

            const request: WorkerRequest = {
                type: 'init',
                baseUrl: document.baseURI,
                options: this.callbacks.options ?? {},
            };
            worker.postMessage(request);
        });
    }
}
