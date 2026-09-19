export interface GameLoopOptions {
    update: (dt: number) => void;
    render: () => void;
    maxDeltaSeconds?: number;
    maxUpdatesPerFrame?: number;
    fixedTimeStep?: number;
}

export class GameLoop {
    private readonly maxDeltaSeconds: number;
    private readonly maxUpdatesPerFrame: number;
    private readonly fixedTimeStep: number;
    private frameId: number | null = null;
    private lastTimestamp = 0;
    private accumulator = 0;

    constructor(private readonly options: GameLoopOptions) {
        this.maxDeltaSeconds = options.maxDeltaSeconds ?? 0.25;
        this.maxUpdatesPerFrame = options.maxUpdatesPerFrame ?? 8;
        this.fixedTimeStep = options.fixedTimeStep ?? 1 / 60;
    }

    get isRunning(): boolean {
        return this.frameId !== null;
    }

    start(): void {
        if (this.frameId !== null) {
            return;
        }
        this.lastTimestamp = performance.now();
        this.accumulator = 0;
        this.frameId = requestAnimationFrame(this.tick);
    }

    stop(): void {
        if (this.frameId === null) {
            return;
        }
        cancelAnimationFrame(this.frameId);
        this.frameId = null;
        this.accumulator = 0;
    }

    private readonly tick = (timestamp: number): void => {
        this.frameId = requestAnimationFrame(this.tick);

        const delta = Math.min((timestamp - this.lastTimestamp) / 1000, this.maxDeltaSeconds);
        this.lastTimestamp = timestamp;
        this.accumulator += delta;

        let updates = 0;
        while (this.accumulator >= this.fixedTimeStep && updates < this.maxUpdatesPerFrame) {
            this.accumulator -= this.fixedTimeStep;
            updates++;
            this.options.update(this.fixedTimeStep);
        }

        if (updates >= this.maxUpdatesPerFrame) {
            this.accumulator = 0;
        }

        this.options.render();
    };
}
