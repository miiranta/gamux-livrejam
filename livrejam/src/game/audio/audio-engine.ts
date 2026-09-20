/**
 * Web Audio mixer for the game.
 *
 * Every sound is fetched once, decoded into an `AudioBuffer` and kept in
 * memory. Playing then just schedules a `BufferSource` on the audio thread, so
 * there is no load/decode delay between the trigger and what the player hears
 * — which matters because the sounds are tied to on-screen events (hovers,
 * hits, damage tiers).
 *
 * Files live in `public/assets/`, so the manifest already stores web-root
 * relative URLs such as `assets/audio/voices/set_a/normal-1.mp3`.
 *
 * Three channels mirror the configuration screen:
 * `music` (soundtrack folder), `voice` (voices folder) and `soundEffect`
 * (sound_effects folder).
 */

/** Optional prefix prepended to relative URLs; empty = served from the root. */
export const AUDIO_SOURCE_ROOT = '';

export type AudioChannel = 'music' | 'voice' | 'soundEffect';

export const AUDIO_CHANNELS: readonly AudioChannel[] = ['music', 'voice', 'soundEffect'];

export interface PlayOptions {
    /** 0..1 multiplier on top of the channel volume. */
    volume?: number;
    loop?: boolean;
    playbackRate?: number;
    /** Seconds into the buffer to start at. */
    offset?: number;
    /**
     * Seconds to wait before the sound starts. Scheduled on the audio thread,
     * so it stays sample-accurate even if the main thread is busy — used to
     * land a sound exactly on the animation it belongs to.
     */
    delay?: number;
}

export interface MusicOptions {
    loop?: boolean;
    fadeSeconds?: number;
}

interface MusicHandle {
    url: string;
    source: AudioBufferSourceNode;
    gain: GainNode;
}

const MASTER_GAIN = 0.9;
/** Long enough to avoid clicks, short enough to feel instant. */
const MUSIC_FADE_SECONDS = 0.4;

export class AudioEngine {
    private context: AudioContext | null = null;
    private master: GainNode | null = null;
    private readonly channels = new Map<AudioChannel, GainNode>();
    private readonly buffers = new Map<string, AudioBuffer>();
    private readonly raw = new Map<string, ArrayBuffer>();
    private readonly failed = new Set<string>();
    private readonly volumes: Record<AudioChannel, number> = {
        music: 0.7,
        voice: 1,
        soundEffect: 1,
    };

    private music: MusicHandle | null = null;
    /** Music requested before the context/buffers were ready. */
    private pendingMusic: { url: string; options: MusicOptions } | null = null;
    private inFlight = new Set<Promise<unknown>>();
    private unlocked = false;
    private disposed = false;

    constructor(private readonly root: string = AUDIO_SOURCE_ROOT) {}

    /** True once a user gesture allowed the browser to output sound. */
    get isUnlocked(): boolean {
        return this.unlocked;
    }

    get isMusicPlaying(): boolean {
        return this.music !== null;
    }

    /** True when the file was decoded and can be played without delay. */
    isReady(url: string): boolean {
        return this.buffers.has(url);
    }

    /**
     * Creates/resumes the audio context. Must be called from a user gesture the
     * first time; browsers keep the context suspended otherwise.
     */
    async unlock(): Promise<boolean> {
        const context = this.ensureContext();
        if (!context) {
            return false;
        }

        try {
            if (context.state === 'suspended') {
                await context.resume();
            }
        } catch {
            return false;
        }

        this.unlocked = context.state !== 'closed';
        this.flushPendingMusic();
        return this.unlocked;
    }

    setVolume(channel: AudioChannel, value: number): void {
        const level = clamp01(value);
        this.volumes[channel] = level;

        const node = this.channels.get(channel);
        const context = this.context;
        if (!node || !context) {
            return;
        }

        // A short ramp instead of a jump: changing the volume mid-music would
        // otherwise be audible as a click.
        node.gain.cancelScheduledValues(context.currentTime);
        node.gain.setValueAtTime(node.gain.value, context.currentTime);
        node.gain.linearRampToValueAtTime(level, context.currentTime + 0.05);
    }

    /** Fetches + decodes every URL, so the first play has no delay. */
    async preload(urls: readonly string[]): Promise<void> {
        await Promise.all(urls.map((url) => this.load(url)));
    }

    /** Fetches + decodes one file. Failures are cached so we never retry. */
    async load(url: string): Promise<AudioBuffer | null> {
        const decoded = this.buffers.get(url);
        if (decoded) {
            return decoded;
        }

        if (this.failed.has(url) || this.disposed) {
            return null;
        }

        const bytes = await this.fetchBytes(url);
        const context = this.context ?? this.ensureContext();
        if (!bytes || !context || this.disposed) {
            return null;
        }

        const request = this.decode(context, url, bytes);
        this.inFlight.add(request);

        try {
            return await request;
        } finally {
            this.inFlight.delete(request);
        }
    }

    /** Plays one decoded file. Returns false when it is not ready yet. */
    play(channel: AudioChannel, url: string, options: PlayOptions = {}): boolean {
        const context = this.context;
        const output = this.channels.get(channel);
        const buffer = this.buffers.get(url);

        if (!context || !output || !buffer || context.state === 'closed') {
            // Not preloaded (or not unlocked yet): warm it up for next time.
            void this.load(url);
            return false;
        }

        if (context.state === 'suspended') {
            void context.resume().catch(() => undefined);
        }

        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = options.loop ?? false;
        if (options.playbackRate) {
            source.playbackRate.value = options.playbackRate;
        }

        const gain = context.createGain();
        gain.gain.value = clamp01(options.volume ?? 1);
        source.connect(gain).connect(output);

        const release = () => {
            try {
                source.disconnect();
                gain.disconnect();
            } catch {
                // Already disconnected; nothing to do.
            }
        };

        source.onended = release;
        source.start(context.currentTime + Math.max(options.delay ?? 0, 0), options.offset ?? 0);
        return true;
    }

    /** Plays a random entry of `urls`; silently does nothing when empty. */
    playRandom(
        channel: AudioChannel,
        urls: readonly string[],
        random: () => number = Math.random,
        options: PlayOptions = {},
    ): boolean {
        if (urls.length === 0) {
            return false;
        }

        const index = Math.min(urls.length - 1, Math.floor(random() * urls.length));
        return this.play(channel, urls[index] ?? urls[0], options);
    }

    /** Starts a track on the music channel, fading in and looping by default. */
    startMusic(url: string, options: MusicOptions = {}): void {
        const context = this.context;
        const output = this.channels.get('music');
        const buffer = this.buffers.get(url);

        if (this.music?.url === url) {
            return;
        }

        if (!context || !output || !buffer) {
            // Unlock/preload may still be pending; retried once they finish.
            this.pendingMusic = { url, options };
            void this.load(url);
            return;
        }

        this.pendingMusic = null;
        this.stopMusic(0);

        const fade = Math.max(options.fadeSeconds ?? MUSIC_FADE_SECONDS, 0);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = options.loop ?? true;

        const gain = context.createGain();
        gain.gain.value = fade > 0 ? 0 : 1;
        if (fade > 0) {
            gain.gain.linearRampToValueAtTime(1, context.currentTime + fade);
        }

        source.connect(gain).connect(output);
        source.start();

        this.music = { url, source, gain };
    }

    /** Stops the current track (with a short fade by default). */
    stopMusic(fadeSeconds: number = MUSIC_FADE_SECONDS): void {
        this.pendingMusic = null;

        const handle = this.music;
        const context = this.context;
        if (!handle || !context) {
            return;
        }

        this.music = null;
        const fade = Math.max(fadeSeconds, 0);
        const now = context.currentTime;

        try {
            handle.gain.gain.cancelScheduledValues(now);
            handle.gain.gain.setValueAtTime(handle.gain.gain.value, now);
            handle.gain.gain.linearRampToValueAtTime(0, now + fade);
            handle.source.stop(now + fade + 0.02);
        } catch {
            // The source was already stopped; nothing to release.
        }
    }

    /** Stops everything and releases the audio context. */
    dispose(): void {
        this.disposed = true;
        this.pendingMusic = null;
        this.stopMusic(0);
        this.buffers.clear();
        this.raw.clear();
        this.failed.clear();
        this.inFlight.clear();

        const context = this.context;
        this.context = null;
        this.master = null;
        this.channels.clear();
        this.unlocked = false;

        if (context && context.state !== 'closed') {
            void context.close().catch(() => undefined);
        }
    }

    private async decode(
        context: AudioContext,
        url: string,
        bytes: ArrayBuffer,
    ): Promise<AudioBuffer | null> {
        try {
            const buffer = await context.decodeAudioData(bytes);
            if (this.disposed) {
                return null;
            }

            this.buffers.set(url, buffer);
            return buffer;
        } catch {
            this.failed.add(url);
            return null;
        }
    }

    /**
     * Downloads one file (cached by URL). Kept separate from decoding so the
     * bytes are ready as soon as an audio context exists.
     */
    private async fetchBytes(url: string): Promise<ArrayBuffer | null> {
        const cached = this.raw.get(url);
        if (cached) {
            return cached;
        }

        if (this.failed.has(url) || this.disposed) {
            return null;
        }

        try {
            const response = await fetch(this.resolve(url), { cache: 'force-cache' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const bytes = await response.arrayBuffer();
            if (!this.disposed) {
                this.raw.set(url, bytes);
            }

            return bytes;
        } catch {
            this.failed.add(url);
            return null;
        }
    }

    private flushPendingMusic(): void {
        const pending = this.pendingMusic;
        if (!pending || !this.unlocked) {
            return;
        }

        this.startMusic(pending.url, pending.options);
    }

    private ensureContext(): AudioContext | null {
        if (this.disposed) {
            return null;
        }

        if (this.context) {
            return this.context;
        }

        const ctor = audioContextCtor();
        if (!ctor) {
            return null;
        }

        try {
            const context = new ctor();
            const master = context.createGain();
            master.gain.value = MASTER_GAIN;
            master.connect(context.destination);

            for (const channel of AUDIO_CHANNELS) {
                const gain = context.createGain();
                gain.gain.value = this.volumes[channel];
                gain.connect(master);
                this.channels.set(channel, gain);
            }

            this.context = context;
            this.master = master;
            return context;
        } catch {
            return null;
        }
    }

    /** Manifest URLs are already root-relative; absolute URLs pass through. */
    private resolve(url: string): string {
        if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('/')) {
            return url;
        }

        return this.root ? `${this.root}/${url}` : url;
    }
}

function audioContextCtor(): typeof AudioContext | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const candidate = window as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
    };

    return candidate.AudioContext ?? candidate.webkitAudioContext ?? null;
}

function clamp01(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.min(1, Math.max(0, value));
}
