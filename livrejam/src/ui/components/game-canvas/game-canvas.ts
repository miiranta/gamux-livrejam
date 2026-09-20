import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    afterNextRender,
    computed,
    effect,
    inject,
    signal,
    viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { InferenceWorkerClient } from '../../../engine/ai';
import { IdlePolicy, RemoteDodgerPolicy, type PolicyLike } from '../../../game/ai';
import { FACE_SMASHING } from '../../../game/config';
import { FaceSmashing, type MatchStats } from '../../../game/face-smashing';
import { HoverSound } from '../../directives';
import {
    AudioService,
    DebugModeService,
    formatDuration,
    GameFlowService,
    GameSettingsService,
    type GameScreen,
} from '../../services';

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
    dropSpeed: 0,
    dashReady: 1,
    timeLeft: 0,
    matchDuration: FACE_SMASHING.match.defaultDurationSeconds,
};

@Component({
    selector: 'app-game-canvas',
    imports: [HoverSound, TranslatePipe],
    templateUrl: './game-canvas.html',
    styleUrl: './game-canvas.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameCanvas {
    private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
    private readonly destroyRef = inject(DestroyRef);
    private readonly flow = inject(GameFlowService);
    private readonly settings = inject(GameSettingsService);
    private readonly audio = inject(AudioService);
    private readonly debug = inject(DebugModeService);
    private readonly inference = new InferenceWorkerClient({
        url: FACE_SMASHING.ai.modelUrl,
        expectedInputSize: FACE_SMASHING.ai.observationSize,
        expectedOutputSize: FACE_SMASHING.ai.actionCount,
        onError: (message) => this.failModel(message),
    });

    private game: FaceSmashing | null = null;
    private policy: PolicyLike = new IdlePolicy();
    private lastScreen: GameScreen = 'menu';
    private lastRestartToken = 0;

    protected readonly status = signal<CanvasStatus>('loading');
    protected readonly errorMessage = signal('');
    protected readonly modelStatus = signal<ModelStatus>('idle');
    protected readonly modelMessage = signal('');
    protected readonly stats = signal<MatchStats>(INITIAL_STATS);
    protected readonly debugMode = this.debug.isEnabled;
    private readonly matchReady = signal(false);

    protected readonly showHud = computed(
        () => this.status() === 'ready' && this.flow.isMatchVisible(),
    );

    protected readonly timeLeft = computed(() => formatDuration(this.stats().timeLeft));

    constructor() {
        afterNextRender(() => void this.start());

        effect(() => {
            const screen = this.flow.screen();
            const token = this.flow.restartToken();
            if (!this.matchReady()) {
                return;
            }
            this.syncMatch(screen, token);
        });

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
                matchDuration: this.settings.matchTimeSeconds(),
                callbacks: {
                    onStats: (next) => this.stats.set(next),
                    onMatchEnd: (result) =>
                        this.flow.endMatch({
                            score: result.score,
                            best: result.best,
                            survived: result.survived,
                            dodges: result.dodges,
                            nearMisses: result.nearMisses,
                        }),
                    onHit: () => this.audio.playVoice(this.settings.voiceSet()),
                },
            });

            this.game = game;
            await game.start();
            this.status.set('ready');
            this.lastRestartToken = this.flow.restartToken();
            this.lastScreen = this.flow.screen();
            this.matchReady.set(true);
            this.syncMatch(this.lastScreen, this.lastRestartToken);
            await this.loadModel(game);
        } catch (error) {
            this.status.set('error');
            this.errorMessage.set(error instanceof Error ? error.message : String(error));
        }
    }

    protected stop(): void {
        this.game?.stop();
        this.game = null;
        this.matchReady.set(false);
        this.inference.stop();
    }

    protected pause = (): void => {
        this.flow.pause();
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

    protected formatDash(readiness: number): string {
        return readiness >= 1 ? 'ready' : `${Math.round(readiness * 100)}%`;
    }

    private syncMatch(screen: GameScreen, token: number): void {
        const game = this.game;
        if (!game) {
            return;
        }

        const restarting = token !== this.lastRestartToken;
        const startingMatch =
            screen === 'playing' && (this.lastScreen === 'menu' || this.lastScreen === 'game-over');
        this.lastRestartToken = token;
        this.lastScreen = screen;

        if (screen !== 'playing') {
            game.pause();
            return;
        }

        if (restarting || startingMatch) {
            game.setMatchDuration(this.settings.matchTimeSeconds());
        }

        game.resume();
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
