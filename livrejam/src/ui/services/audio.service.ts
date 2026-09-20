import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';

import {
    AudioEngine,
    EMPTY_AUDIO_MANIFEST,
    type AudioManifest,
    loadAudioManifest,
    manifestUrls,
    pickRandom,
    pickRandomDistinct,
    resolveVoiceSet,
} from '../../game/audio';
import { GameFlowService } from './game-flow.service';
import { GameSettingsService } from './game-settings.service';

/** Sound-effect events the game can trigger; keys are folder names. */
export const SOUND_EFFECTS = {
    buttonHover: 'button_hover',
    strongExplosion: 'strong_explosions',
} as const;

export type SoundEffectName = (typeof SOUND_EFFECTS)[keyof typeof SOUND_EFFECTS];

/** Hover blips are short; keeping them quiet avoids a "machine gun" feel. */
const HOVER_VOLUME = 0.45;

/** Milliseconds between two hover blips. */
const HOVER_COOLDOWN_MS = 60;

/**
 * Owns the mixer and the loaded audio catalog.
 *
 * - The manifest (`assets/audio/manifest.json`) is fetched and every file is
 *   decoded into memory at boot, so playback has no delay.
 * - The mixer channels follow the settings service (music / sound effects /
 *   voice), including the selected voice set.
 * - The soundtrack only plays during a match; menus and the end screen are
 *   silent, which the game-flow service drives.
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
    private readonly engine = new AudioEngine();
    private readonly destroyRef = inject(DestroyRef);
    private readonly settings = inject(GameSettingsService);
    private readonly flow = inject(GameFlowService);
    private readonly manifest = signal<AudioManifest>(EMPTY_AUDIO_MANIFEST);
    private readonly ready = signal(false);
    private readonly unlocked = signal(false);
    private readonly lastHoverAt = signal(0);

    readonly catalog = this.manifest.asReadonly();
    readonly isReady = this.ready.asReadonly();
    readonly isUnlocked = this.unlocked.asReadonly();
    /** Every voice set found on disk, in manifest order. */
    readonly voiceSets = computed(() => this.manifest().voices.sets);
    readonly hasVoiceSets = computed(() => this.voiceSets().length > 0);

    private booted = false;
    private disposed = false;
    /** Bumped when a catalog is installed by hand, cancelling a pending boot. */
    private bootToken = 0;

    constructor() {
        // Browsers only allow audio after a gesture; unlock on the first one.
        const unlock = () => void this.unlock();
        window.addEventListener('pointerdown', unlock, { passive: true });
        window.addEventListener('keydown', unlock, { passive: true });
        this.destroyRef.onDestroy(() => {
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
            this.disposed = true;
            this.engine.dispose();
        });

        void this.boot();

        // The mixer follows the configuration screen.
        effect(() => {
            this.applyVolumes(
                this.settings.musicVolume(),
                this.settings.sfxVolume(),
                this.settings.voiceVolume(),
            );
        });

        // Music only while a match is actually running: silent in the menu, on
        // the pause screen and on the end-game screen.
        effect(() => {
            if (this.flow.isPlaying()) {
                this.startMusic();
            } else {
                this.stopMusic();
            }
        });
    }

    /** Loads the catalog and preloads every sound. Safe to call repeatedly. */
    async boot(): Promise<void> {
        if (this.booted) {
            return;
        }

        this.booted = true;
        const token = this.bootToken;
        const manifest = await loadAudioManifest();

        // A catalog installed meanwhile wins over the fetched one.
        if (this.disposed || token !== this.bootToken) {
            return;
        }

        this.manifest.set(manifest);
        await this.engine.preload(manifestUrls(manifest));
        if (this.disposed || token !== this.bootToken) {
            return;
        }

        this.ready.set(true);
    }

    /** Resumes the audio context; the first call needs a user gesture. */
    async unlock(): Promise<boolean> {
        const unlocked = await this.engine.unlock();
        this.unlocked.set(unlocked);
        return unlocked;
    }

    /**
     * Installs a catalog directly, skipping the fetch (tests and any offline
     * boot path). Files are preloaded in the background.
     */
    useCatalog(manifest: AudioManifest): void {
        this.booted = true;
        this.bootToken += 1;
        this.manifest.set(manifest);
        void this.engine.preload(manifestUrls(manifest)).then(() => this.ready.set(true));
    }

    /** Applies the persisted levels to the mixer. */
    applyVolumes(music: number, soundEffect: number, voice: number): void {
        this.engine.setVolume('music', music);
        this.engine.setVolume('soundEffect', soundEffect);
        this.engine.setVolume('voice', voice);
    }

    /** Plays one of the variants of a sound effect, at random. */
    playSoundEffect(
        name: SoundEffectName,
        random: () => number = Math.random,
        volume = 1,
    ): boolean {
        const urls = this.soundEffectFiles(name);
        if (urls.length === 0) {
            void this.boot();
            return false;
        }

        return this.engine.playRandom('soundEffect', urls, random, { volume });
    }

    /**
     * Picks `count` **different** variants of a sound effect and plays them,
     * each after its own delay. Used by the end-game screen, where two impacts
     * must not repeat the same sample.
     */
    playSoundEffectSequence(
        name: SoundEffectName,
        count: number,
        delays: readonly number[],
        random: () => number = Math.random,
        volume = 1,
    ): boolean {
        const urls = this.soundEffectFiles(name);
        if (urls.length === 0) {
            void this.boot();
            return false;
        }

        const picked = pickRandomDistinct(urls, count, random);
        let played = false;

        picked.forEach((url, index) => {
            played =
                this.engine.play('soundEffect', url, {
                    volume,
                    delay: delays[index] ?? 0,
                }) || played;
        });

        return played;
    }

    /** Hover blip for buttons; rate-limited so sweeping the mouse is pleasant. */
    playButtonHover(random: () => number = Math.random): boolean {
        const now = performance.now();
        if (now - this.lastHoverAt() < HOVER_COOLDOWN_MS) {
            return false;
        }

        this.lastHoverAt.set(now);
        return this.playSoundEffect(SOUND_EFFECTS.buttonHover, random, HOVER_VOLUME);
    }

    /** Plays a random voice of the selected set (used by the preview button). */
    playVoicePreview(voiceSet: string, random: () => number = Math.random): boolean {
        const file = pickRandom(this.voiceFiles(voiceSet), random);
        if (!file) {
            void this.boot();
            return false;
        }

        return this.engine.play('voice', file);
    }

    /** Plays a random voice of the selected set (in-match reaction). */
    playVoice(voiceSet: string, random: () => number = Math.random): boolean {
        const file = pickRandom(this.voiceFiles(voiceSet), random);
        return file ? this.engine.play('voice', file) : false;
    }

    /** Every file of a sound-effect event (all variants). */
    soundEffectFiles(name: SoundEffectName): readonly string[] {
        return this.manifest().soundEffects.groups.find((group) => group.key === name)?.files ?? [];
    }

    /** Every file of a voice set; empty when the set is unknown. */
    voiceFiles(voiceSet: string): readonly string[] {
        return resolveVoiceSet(this.voiceSets(), voiceSet)?.files ?? [];
    }

    /** Starts the match soundtrack (first track), looping. */
    startMusic(): void {
        const track = this.manifest().soundtrack.tracks[0];
        if (track) {
            this.engine.startMusic(track, { loop: true });
        }
    }

    /** Fades the soundtrack out (pause, end of match, back to the menu). */
    stopMusic(): void {
        this.engine.stopMusic();
    }
}
