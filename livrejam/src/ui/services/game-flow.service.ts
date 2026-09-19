import { Injectable, computed, signal } from '@angular/core';

/** Which screen currently owns the viewport. */
export type GameScreen = 'menu' | 'playing' | 'paused' | 'game-over';

/** Final results handed to the end-game screen. */
export interface MatchResult {
    score: number;
    best: number;
    survived: number;
    dodges: number;
    nearMisses: number;
}

export const EMPTY_RESULT: MatchResult = {
    score: 0,
    best: 0,
    survived: 0,
    dodges: 0,
    nearMisses: 0,
};

/**
 * State machine for the game shell: which screen is visible, whether the
 * match canvas should be running, and the last match result.
 *
 * The actual `DungeonDrop` instance is owned by `GameCanvas`; this service
 * only publishes the intent, and `GameCanvas` reacts to it through an effect.
 */
@Injectable({ providedIn: 'root' })
export class GameFlowService {
    private readonly screenState = signal<GameScreen>('menu');
    private readonly resultState = signal<MatchResult>(EMPTY_RESULT);
    private readonly pausedState = signal(false);
    /** Bumped whenever the same screen must be shown again (e.g. "Retry"). */
    private readonly restartTokenState = signal(0);

    readonly screen = this.screenState.asReadonly();
    readonly result = this.resultState.asReadonly();
    readonly paused = this.pausedState.asReadonly();
    readonly restartToken = this.restartTokenState.asReadonly();

    readonly isMenu = computed(() => this.screenState() === 'menu');
    readonly isPlaying = computed(() => this.screenState() === 'playing');
    readonly isPaused = computed(() => this.screenState() === 'paused');
    readonly isGameOver = computed(() => this.screenState() === 'game-over');

    /** True while the match canvas should be rendering and simulating. */
    readonly isMatchVisible = computed(
        () => this.screenState() === 'playing' || this.screenState() === 'paused',
    );

    /** True while the match simulation should advance. */
    readonly isRunning = computed(() => this.screenState() === 'playing');

    startMatch(): void {
        this.resultState.set(EMPTY_RESULT);
        this.pausedState.set(false);
        this.screenState.set('playing');
    }

    pause(): void {
        if (this.screenState() !== 'playing') {
            return;
        }

        this.pausedState.set(true);
        this.screenState.set('paused');
    }

    resume(): void {
        if (this.screenState() !== 'paused') {
            return;
        }

        this.pausedState.set(false);
        this.screenState.set('playing');
    }

    togglePause(): void {
        if (this.screenState() === 'playing') {
            this.pause();
        } else if (this.screenState() === 'paused') {
            this.resume();
        }
    }

    /** Replays the current match from scratch. */
    restartMatch(): void {
        this.resultState.set(EMPTY_RESULT);
        this.pausedState.set(false);
        this.restartTokenState.update((token) => token + 1);
        this.screenState.set('playing');
    }

    endMatch(result: MatchResult): void {
        this.resultState.set(result);
        this.pausedState.set(false);
        this.screenState.set('game-over');
    }

    abandon(): void {
        this.resultState.set(EMPTY_RESULT);
        this.pausedState.set(false);
        this.screenState.set('menu');
    }
}
