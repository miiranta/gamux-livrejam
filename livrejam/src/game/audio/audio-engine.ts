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

import { isDevMode } from "@angular/core";

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
    /**
     * Seconds of overlap between two passes of a looping track. A looping
     * MP3 cannot be seamless on its own (encoder padding leaves a small gap),
     * so the track is played as overlapping passes that fade into each other.
     * `0` falls back to the browser's own gapless loop.
     */
    crossfadeSeconds?: number;
}

/** A track currently on the music channel, with its own way of stopping. */
interface MusicHandle {
    url: string;
    /** Fades the track out over `fadeSeconds` and releases it. */
    stop: (fadeSeconds: number) => void;
}

/** One overlapping pass of a crossfaded loop. */
interface LoopSegment {
    source: AudioBufferSourceNode;
    /** Audio-clock time at which this pass is silent again. */
    end: number;
}

const MASTER_GAIN = 0.9;
/** Long enough to avoid clicks, short enough to feel instant. */
const MUSIC_FADE_SECONDS = 0.4;
/** How far ahead the loop scheduler queues passes, in seconds. */
const LOOP_LOOKAHEAD_SECONDS = 1;
/** How often the loop scheduler tops up, in milliseconds. */
const LOOP_TICK_MS = 250;
/** Points used to approximate an equal-power fade curve. */
const CROSSFADE_STEPS = 16;
const HALF_PI = Math.PI / 2;

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
    /** True while the app is unfocused and we suspended the context ourselves. */
    private suspendedByUs = false;

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
        // A gesture means the app is in use again, so any suspension we applied
        // for being unfocused no longer applies.
        this.suspendedByUs = false;
        this.flushPendingMusic();
        return this.unlocked;
    }

    /**
     * Freezes all output without losing playback position.
     *
     * Suspending the context stops the audio clock, so every scheduled source
     * (including the queued passes of a crossfaded loop) simply pauses and
     * carries on from the same point when {@link resume} is called. That is
     * what makes "stop while unfocused, continue when focused" work without
     * restarting the music.
     */
    async suspend(): Promise<void> {
        const context = this.context;
        if (!context || context.state !== 'running') {
            return;
        }

        this.suspendedByUs = true;

        try {
            await context.suspend();
        } catch {
            // Already suspended/closed, or the browser refused; nothing to do.
            this.suspendedByUs = false;
        }
    }

    /** Resumes output after {@link suspend}. */
    async resume(): Promise<void> {
        const context = this.context;
        if (!context || context.state !== 'suspended') {
            this.suspendedByUs = false;
            return;
        }

        this.suspendedByUs = false;

        try {
            await context.resume();
        } catch {
            // The context was closed meanwhile; nothing to resume.
        }
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

        // Only nudge a context the browser left suspended. When *we* suspended
        // it (app unfocused) the sound is scheduled anyway and stays silent
        // until focus returns, instead of leaking audio from a hidden tab.
        if (context.state === 'suspended' && !this.suspendedByUs) {
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

    /** Starts a track on the music channel, replacing whatever was playing. */
    startMusic(url: string, options: MusicOptions = {}): void {
        if (this.music?.url === url) {
            return;
        }

        const context = this.context;
        const output = this.channels.get('music');
        const buffer = this.buffers.get(url);

        if (!context || !output || !buffer) {
            // Unlock/preload may still be pending; retried once they finish.
            this.pendingMusic = { url, options };
            void this.load(url);
            return;
        }

        this.pendingMusic = null;
        this.stopMusic(0);

        const fade = Math.max(options.fadeSeconds ?? MUSIC_FADE_SECONDS, 0);
        const crossfade = Math.max(options.crossfadeSeconds ?? 0, 0);
        const gain = context.createGain();
        gain.gain.value = fade > 0 ? 0 : 1;
        if (fade > 0) {
            gain.gain.linearRampToValueAtTime(1, context.currentTime + fade);
        }
        gain.connect(output);

        if (!(options.loop ?? true)) {
            this.music = this.playOnce(url, context, buffer, gain);
        } else if (crossfade > 0) {
            this.music = this.playCrossfadeLoop(url, context, buffer, gain, crossfade);
        } else {
            this.music = this.playGaplessLoop(url, context, buffer, gain);
        }
    }

    /** A track that plays through once and then releases itself. */
    private playOnce(
        url: string,
        context: AudioContext,
        buffer: AudioBuffer,
        gain: GainNode,
    ): MusicHandle {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(gain);

        const handle: MusicHandle = {
            url,
            stop: (fadeSeconds) => {
                fadeOut(context, gain, [source], fadeSeconds);
            },
        };

        // Once it ends on its own, the channel is free again — which is what
        // lets the same track be replayed on a later visit to the screen.
        source.onended = () => {
            disconnect(source, gain);
            if (this.music === handle) {
                this.music = null;
            }
        };

        source.start();
        return handle;
    }

    /** The browser's own gapless loop: no scheduling, no overlap. */
    private playGaplessLoop(
        url: string,
        context: AudioContext,
        buffer: AudioBuffer,
        gain: GainNode,
    ): MusicHandle {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(gain);
        source.start();

        return {
            url,
            stop: (fadeSeconds) => fadeOut(context, gain, [source], fadeSeconds),
        };
    }

    /**
     * Seamless loop built from overlapping passes.
     *
     * Each pass plays the whole file; the next one starts `crossfade` seconds
     * before the current one ends, and the two fade into each other. Because
     * the passes overlap, the loop period is `duration - crossfade`, so the
     * seam never lines up with the (gap-prone) start/end of the file.
     *
     * Passes are queued on the audio clock with a coarse lookahead timer: the
     * timer only decides *what* to queue, while the audio thread decides
     * *when* it sounds, so a busy main thread cannot make the loop stutter.
     */
    private playCrossfadeLoop(
        url: string,
        context: AudioContext,
        buffer: AudioBuffer,
        gain: GainNode,
        crossfadeSeconds: number,
    ): MusicHandle {
        const duration = buffer.duration;
        // A crossfade longer than half the file would leave nothing to hear.
        const crossfade = Math.min(crossfadeSeconds, duration / 2);
        const period = Math.max(duration - crossfade, 0.01);
        const segments: LoopSegment[] = [];

        let nextStart = context.currentTime;
        let stopped = false;
        let timer: ReturnType<typeof setInterval> | null = null;

        const spawn = (start: number): void => {
            const source = context.createBufferSource();
            const segmentGain = context.createGain();
            const end = start + duration;
            const fadeFrom = end - crossfade;

            // Equal-power (sine/cosine) fades rather than linear ones: the two
            // passes are uncorrelated, so linear ramps would dip ~3 dB in the
            // middle of the overlap and be heard as a pulse on every loop.
            segmentGain.gain.setValueAtTime(0, start);
            rampGainCurve(segmentGain.gain, start, crossfade, (progress) =>
                Math.sin(progress * HALF_PI),
            );

            segmentGain.gain.setValueAtTime(1, fadeFrom);
            rampGainCurve(segmentGain.gain, fadeFrom, crossfade, (progress) =>
                Math.cos(progress * HALF_PI),
            );

            source.buffer = buffer;
            source.connect(segmentGain).connect(gain);
            source.start(start, 0);
            source.stop(end + 0.02);

            segments.push({ source, end });
        };

        const tick = (): void => {
            if (stopped) {
                return;
            }

            // Keep a full period queued ahead, so a throttled timer (background
            // tab) still has the next pass scheduled before it is needed.
            const horizon = context.currentTime + LOOP_LOOKAHEAD_SECONDS + period;
            while (nextStart < horizon) {
                spawn(nextStart);
                nextStart += period;
            }

            // Drop passes that already finished, so the list cannot grow.
            for (let index = segments.length - 1; index >= 0; index--) {
                if (segments[index].end < context.currentTime) {
                    segments.splice(index, 1);
                }
            }
        };

        tick();
        timer = setInterval(tick, LOOP_TICK_MS);

        return {
            url,
            stop: (fadeSeconds) => {
                stopped = true;
                if (timer !== null) {
                    clearInterval(timer);
                    timer = null;
                }

                const sources = segments.map((segment) => segment.source);
                segments.length = 0;
                fadeOut(context, gain, sources, fadeSeconds);
            },
        };
    }

    /** Stops the current track (with a short fade by default). */
    stopMusic(fadeSeconds: number = MUSIC_FADE_SECONDS): void {
        this.pendingMusic = null;

        const handle = this.music;
        if (!handle) {
            return;
        }

        this.music = null;
        handle.stop(fadeSeconds);
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
            const response = await fetch(this.resolve(url), { cache: isDevMode() ? 'reload' : 'force-cache' });
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

/**
 * Fades a music bus down and releases its sources. `fadeSeconds` of 0 stops
 * immediately; the sources are always stopped so they cannot outlive the call.
 */
function fadeOut(
    context: AudioContext,
    gain: GainNode,
    sources: readonly AudioBufferSourceNode[],
    fadeSeconds: number,
): void {
    const fade = Math.max(fadeSeconds, 0);
    const now = context.currentTime;
    const end = now + fade;

    try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, end);
    } catch {
        // A detached context (closed meanwhile); the stop below is enough.
    }

    for (const source of sources) {
        try {
            source.stop(end + 0.02);
        } catch {
            // Already stopped; nothing to release.
        }
    }

    // Give the ramp time to finish before the nodes are detached.
    if (fade > 0) {
        setTimeout(() => disconnect(gain, ...sources), (fade + 0.1) * 1000);
    } else {
        disconnect(gain, ...sources);
    }
}

function disconnect(...nodes: readonly (AudioNode | null | undefined)[]): void {
    for (const node of nodes) {
        try {
            node?.disconnect();
        } catch {
            // Already disconnected; nothing to do.
        }
    }
}

/**
 * Approximates a fade curve with piecewise-linear ramps: Web Audio has no
 * built-in curve automation, and a plain linear ramp has the wrong shape.
 * `shape` maps progress (0..1) to a gain (0..1).
 */
function rampGainCurve(
    gain: AudioParam,
    start: number,
    duration: number,
    shape: (progress: number) => number,
): void {
    for (let step = 1; step <= CROSSFADE_STEPS; step++) {
        const progress = step / CROSSFADE_STEPS;
        gain.linearRampToValueAtTime(shape(progress), start + duration * progress);
    }
}

function clamp01(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.min(1, Math.max(0, value));
}
