import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';

import {
    AudioEngine,
    EMPTY_AUDIO_MANIFEST,
    type AudioManifest,
    type MusicRole,
    loadAudioManifest,
    manifestUrls,
    pickRandom,
    pickRandomDistinct,
    resolveVoiceSet,
    soundtrackTrack,
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
 * Seconds of overlap used when looping the menu ambience. The wind is quiet
 * and continuous, so a long crossfade is what makes the seam inaudible.
 */
const MENU_CROSSFADE_SECONDS = 1.5;

/**
 * Owns the mixer and the loaded audio catalog.
 *
 * - The manifest (`assets/audio/manifest.json`) is fetched and every file is
 *   decoded into memory at boot, so playback has no delay.
 * - The mixer channels follow the settings service (music / sound effects /
 *   voice), including the selected voice set.
 * - Which track plays is driven by the game-flow state: the menu ambience on
 *   the main menu, the match song while playing, and the end-game song once.
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
        // A hidden tab must never unlock, or a stray event could start audio
        // while the app is in the background.
        const unlock = () => {
            if (!document.hidden) {
                void this.unlock();
            }
        };
        window.addEventListener('pointerdown', unlock, { passive: true });
        window.addEventListener('keydown', unlock, { passive: true });

        // Silence everything while the app is in the background, and pick up
        // exactly where it stopped when it comes back.
        const onBlur = () => void this.suspend();
        const onFocus = () => void this.resume();
        window.addEventListener('blur', onBlur);
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', this.onVisibilityChange);

        this.destroyRef.onDestroy(() => {
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
            window.removeEventListener('blur', onBlur);
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', this.onVisibilityChange);
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

        // The music follows the screen: menu ambience, match song, end-game
        // song. The pause menu deliberately keeps the match song silent.
        effect(() => {
            const role = this.currentMusicRole();
            if (role) {
                this.playMusic(role);
            } else {
                this.stopMusic();
            }
        });
    }

    /** Which track the current screen should play; `null` for silence. */
    private currentMusicRole(): MusicRole | null {
        if (this.flow.isPlaying()) {
            return 'match';
        }

        if (this.flow.isGameOver()) {
            return 'end-game';
        }

        // Only the *initial* menu has ambience; the pause menu is silent.
        return this.flow.isMenu() ? 'menu' : null;
    }

    /**
     * Stops all output while the app is unfocused. The audio clock freezes, so
     * music resumes from the same point instead of restarting.
     */
    async suspend(): Promise<void> {
        await this.engine.suspend();
    }

    /** Resumes output after {@link suspend}. */
    async resume(): Promise<void> {
        await this.engine.resume();
    }

    /** Background tabs also count as unfocused, even without a blur event. */
    private readonly onVisibilityChange = (): void => {
        if (document.hidden) {
            void this.suspend();
        } else {
            void this.resume();
        }
    };

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

    /**
     * Plays the track configured for a screen.
     *
     * The match and menu tracks loop (the menu one with a crossfade, so its
     * seam is inaudible); the end-game track plays through exactly once and
     * then releases the channel, which is what allows replaying it on a later
     * visit to the screen.
     */
    playMusic(role: MusicRole): void {
        const track = soundtrackTrack(this.manifest(), role);
        if (!track) {
            return;
        }

        if (role === 'end-game') {
            this.engine.startMusic(track, { loop: false });
            return;
        }

        this.engine.startMusic(track, {
            loop: true,
            crossfadeSeconds: role === 'menu' ? MENU_CROSSFADE_SECONDS : 0,
        });
    }

    /** Fades the current track out (pause, end of match, back to the menu). */
    stopMusic(): void {
        this.engine.stopMusic();
    }
}
