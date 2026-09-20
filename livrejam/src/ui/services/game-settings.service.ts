import { Injectable, computed, signal } from '@angular/core';

import { DEFAULT_VOICE_SET, isVoiceSetKey } from '../../game/audio';
import { DEFAULT_GAME_MODE, FACE_SMASHING, isGameMode, type GameMode } from '../../game/config';
import type { SteeringMode } from '../../game/systems';

export interface GameSettings {
    musicVolume: number;
    sfxVolume: number;
    voiceVolume: number;
    voiceSet: string;
    matchTimeSeconds: number;
    steeringMode: SteeringMode;
    /** Who controls the character: the policy (1P) or the player (2P). */
    gameMode: GameMode;
}

export interface GameSettingsLimits {
    minMatchTimeSeconds: number;
    maxMatchTimeSeconds: number;
    matchTimeStepSeconds: number;
}

export const GAME_SETTINGS_STORAGE_KEY = 'livrejam.settings';

export const STEERING_MODES: readonly SteeringMode[] = ['67', 'rizz'];

export const DEFAULT_STEERING_MODE: SteeringMode = '67';

export function isSteeringMode(value: unknown): value is SteeringMode {
    return STEERING_MODES.includes(value as SteeringMode);
}

export function steeringModeLabelKey(mode: SteeringMode): string {
    return `settings.steering.${mode}`;
}

function settingsLimits(): GameSettingsLimits {
    return {
        minMatchTimeSeconds: FACE_SMASHING.match.minDurationSeconds,
        maxMatchTimeSeconds: FACE_SMASHING.match.maxDurationSeconds,
        matchTimeStepSeconds: FACE_SMASHING.match.durationStepSeconds,
    };
}

function defaultSettings(): GameSettings {
    return {
        musicVolume: 0.7,
        sfxVolume: 0.9,
        voiceVolume: 0.9,
        voiceSet: DEFAULT_VOICE_SET,
        matchTimeSeconds: FACE_SMASHING.match.defaultDurationSeconds,
        steeringMode: DEFAULT_STEERING_MODE,
        gameMode: DEFAULT_GAME_MODE,
    };
}

/**
 * Single source of truth for player-facing options (audio levels, voice set,
 * match length). `AudioService` mirrors the values into the mixer, so every
 * screen just reads and writes them here and they survive navigation/reloads.
 */
@Injectable({ providedIn: 'root' })
export class GameSettingsService {
    private readonly state = signal<GameSettings>(loadSettings());

    readonly settings = this.state.asReadonly();
    readonly limits = computed(settingsLimits);

    readonly musicVolume = computed(() => this.state().musicVolume);
    readonly sfxVolume = computed(() => this.state().sfxVolume);
    readonly voiceVolume = computed(() => this.state().voiceVolume);
    readonly voiceSet = computed(() => this.state().voiceSet);
    readonly matchTimeSeconds = computed(() => this.state().matchTimeSeconds);
    readonly steeringMode = computed(() => this.state().steeringMode);
    readonly gameMode = computed(() => this.state().gameMode);
    /** Human-friendly match length, e.g. "1:30". */
    readonly matchTimeLabel = computed(() => formatDuration(this.state().matchTimeSeconds));

    setMusicVolume(value: number): void {
        this.patch({ musicVolume: clamp01(value) });
    }

    setSfxVolume(value: number): void {
        this.patch({ sfxVolume: clamp01(value) });
    }

    setVoiceVolume(value: number): void {
        this.patch({ voiceVolume: clamp01(value) });
    }

    setVoiceSet(key: string): void {
        if (!isVoiceSetKey(key)) {
            return;
        }

        this.patch({ voiceSet: key });
    }

    setMatchTimeSeconds(value: number): void {
        const { minMatchTimeSeconds, maxMatchTimeSeconds } = this.limits();
        this.patch({
            matchTimeSeconds: Math.round(clamp(value, minMatchTimeSeconds, maxMatchTimeSeconds)),
        });
    }

    setSteeringMode(mode: SteeringMode): void {
        if (!isSteeringMode(mode)) {
            return;
        }

        this.patch({ steeringMode: mode });
    }

    setGameMode(mode: GameMode): void {
        if (!isGameMode(mode)) {
            return;
        }

        this.patch({ gameMode: mode });
    }

    reset(): void {
        this.state.set(defaultSettings());
        persistSettings(this.state());
    }

    private patch(partial: Partial<GameSettings>): void {
        this.state.update((current) => ({ ...current, ...partial }));
        persistSettings(this.state());
    }
}

export function formatDuration(totalSeconds: number): string {
    const safe = Math.max(0, Math.round(totalSeconds));
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Inverse of `formatDuration`. Accepts "1:30", "90", "1m30", "90s" and
 * "1:30.5"; returns `null` when the text cannot be understood.
 */
export function parseDuration(text: string): number | null {
    const trimmed = text.trim().toLowerCase();
    if (!trimmed) {
        return null;
    }

    const clock = /^(\d+):([0-5]?\d(?:\.\d+)?)$/.exec(trimmed);
    if (clock) {
        return Number(clock[1]) * 60 + Number(clock[2]);
    }

    const minutes = /^(\d+(?:\.\d+)?)\s*m(?:in)?s?$/.exec(trimmed);
    if (minutes) {
        return Number(minutes[1]) * 60;
    }

    const seconds = /^(\d+(?:\.\d+)?)\s*s(?:ec)?s?$/.exec(trimmed);
    if (seconds) {
        return Number(seconds[1]);
    }

    const plain = /^\d+(?:\.\d+)?$/.exec(trimmed);
    return plain ? Number(plain[0]) : null;
}

function clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
        return min;
    }
    return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
    return Math.round(clamp(value, 0, 1) * 100) / 100;
}

function loadSettings(): GameSettings {
    const fallback = defaultSettings();
    let raw: string | null = null;

    try {
        raw = localStorage.getItem(GAME_SETTINGS_STORAGE_KEY);
    } catch {
        return fallback;
    }

    if (!raw) {
        return fallback;
    }

    try {
        const parsed = JSON.parse(raw) as Partial<GameSettings>;
        return {
            musicVolume: clamp01(parsed.musicVolume ?? fallback.musicVolume),
            sfxVolume: clamp01(parsed.sfxVolume ?? fallback.sfxVolume),
            voiceVolume: clamp01(parsed.voiceVolume ?? fallback.voiceVolume),
            voiceSet: isVoiceSetKey(parsed.voiceSet) ? parsed.voiceSet : fallback.voiceSet,
            matchTimeSeconds: clamp(
                parsed.matchTimeSeconds ?? fallback.matchTimeSeconds,
                settingsLimits().minMatchTimeSeconds,
                settingsLimits().maxMatchTimeSeconds,
            ),
            steeringMode: isSteeringMode(parsed.steeringMode)
                ? parsed.steeringMode
                : fallback.steeringMode,
            gameMode: isGameMode(parsed.gameMode) ? parsed.gameMode : fallback.gameMode,
        };
    } catch {
        return fallback;
    }
}

function persistSettings(settings: GameSettings): void {
    try {
        localStorage.setItem(GAME_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
        // Storage can be unavailable (private mode); settings simply won't persist.
    }
}
