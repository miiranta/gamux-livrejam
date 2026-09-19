import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    afterNextRender,
    inject,
    signal,
    viewChild,
} from '@angular/core';

import { InferenceWorkerClient } from '../../../engine/ai';
import { IdlePolicy, RemoteDodgerPolicy, type PolicyLike } from '../../../game/ai';
import { FACE_SMASHING } from '../../../game/config';
import { FaceSmashing, type MatchStats } from '../../../game/face-smashing';

type CanvasStatus = 'loading' | 'ready' | 'error';
type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';

const INITIAL_STATS: MatchStats = {
    score: 0,
    best: 0,
    survived: 0,
    dodges: 0,
    nearMisses: 0,
    damage: 0,
    level: 0,
    dodgerSpeed: 0,
    itemSpeed: 0,
    roundTime: 0,
};

@Component({
    selector: 'app-game-canvas',
    templateUrl: './game-canvas.html',
    styleUrl: './game-canvas.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameCanvas {
    private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
    private readonly destroyRef = inject(DestroyRef);
    private readonly inference = new InferenceWorkerClient({
        url: FACE_SMASHING.ai.modelUrl,
        expectedInputSize: FACE_SMASHING.ai.observationSize,
        expectedOutputSize: FACE_SMASHING.ai.actionCount,
        onError: (message) => this.failModel(message),
    });

    private game: FaceSmashing | null = null;
    private policy: PolicyLike = new IdlePolicy();

    protected readonly status = signal<CanvasStatus>('loading');
    protected readonly errorMessage = signal('');
    protected readonly modelStatus = signal<ModelStatus>('idle');
    protected readonly modelMessage = signal('');
    protected readonly stats = signal<MatchStats>(INITIAL_STATS);

    constructor() {
        afterNextRender(() => void this.start());
        this.destroyRef.onDestroy(() => this.stop());
    }

    protected async start(): Promise<void> {
        const canvas = this.canvasRef()?.nativeElement;
        if (!canvas) {
            return;
        }

        try {
            const game = new FaceSmashing({
                canvas,
                callbacks: { onStats: (next) => this.stats.set(next) },
            });

            this.game = game;
            await game.start();
            this.status.set('ready');
            await this.loadModel(game);
        } catch (error) {
            this.status.set('error');
            this.errorMessage.set(error instanceof Error ? error.message : String(error));
        }
    }

    protected stop(): void {
        this.game?.stop();
        this.game = null;
        this.inference.stop();
    }

    protected restart = (): void => {
        this.game?.restart();
    };

    protected accelerate = (): void => {
        this.game?.accelerate();
    };

    protected toggleColliders = (): void => {
        this.game?.toggleColliders();
    };

    protected reloadModel = (): void => {
        const game = this.game;
        if (!game || this.modelStatus() === 'loading') {
            return;
        }

        this.inference.stop();
        void this.loadModel(game);
    };

    protected formatSeconds(seconds: number): string {
        return seconds.toFixed(1);
    }

    protected formatDamage(damage: number): string {
        return Math.round(damage).toString();
    }

    protected formatRound(survived: number, total: number): string {
        return `${Math.max(total - survived, 0).toFixed(1)}s`;
    }

    private async loadModel(game: FaceSmashing): Promise<void> {
        this.modelStatus.set('loading');
        this.modelMessage.set('');

        try {
            await this.inference.start();
            this.policy = new RemoteDodgerPolicy(this.inference);
            game.setPolicy(this.policy);
            this.modelStatus.set('ready');
        } catch (error) {
            this.policy = new IdlePolicy();
            game.setPolicy(this.policy);
            this.modelStatus.set('error');
            this.modelMessage.set(error instanceof Error ? error.message : String(error));
        }
    }

    private failModel(message: string): void {
        this.policy = new IdlePolicy();
        this.game?.setPolicy(this.policy);
        this.modelStatus.set('error');
        this.modelMessage.set(message);
    }
}
