/// <reference lib="webworker" />

import { FaceHandTracker } from '../tracking';
import type { WorkerRequest, WorkerResponse } from './protocol';

let tracker: FaceHandTracker | null = null;

function respond(message: WorkerResponse): void {
    self.postMessage(message);
}

async function handleInit(request: Extract<WorkerRequest, { type: 'init' }>): Promise<void> {
    tracker?.close();
    tracker = new FaceHandTracker(request.options);
    await tracker.init(request.baseUrl);
    respond({ type: 'ready', usingGpu: tracker.isUsingGpu });
}

function handleDetect(request: Extract<WorkerRequest, { type: 'detect' }>): void {
    const bitmap = request.bitmap;

    try {
        if (!tracker) {
            throw new Error('Worker received a frame before init.');
        }

        const frame = tracker.process(bitmap, request.timestamp);
        respond({ type: 'frame', frame });
    } catch (error) {
        respond({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    } finally {
        bitmap.close();
    }
}

function handleDispose(): void {
    tracker?.close();
    tracker = null;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    const request = event.data;

    try {
        switch (request.type) {
            case 'init':
                await handleInit(request);
                break;
            case 'detect':
                handleDetect(request);
                break;
            case 'dispose':
                handleDispose();
                break;
        }
    } catch (error) {
        respond({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    }
};
