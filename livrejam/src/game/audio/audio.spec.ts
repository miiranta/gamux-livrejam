import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AudioEngine } from './audio-engine';
import {
    AUDIO_MANIFEST_URL,
    EMPTY_AUDIO_MANIFEST,
    audioUrl,
    manifestUrls,
    parseAudioManifest,
    soundtrackTrack,
} from './audio-manifest';
import {
    DEFAULT_VOICE_SET,
    pickRandom,
    pickRandomDistinct,
    resolveVoiceSet,
    voiceSetLabelKey,
} from './audio-selection';

const RAW_MANIFEST = {
    soundtrack: {
        roles: [
            { key: 'match', files: ['soundtrack/match/soundtrack-p1.mp3'] },
            { key: 'menu', files: ['soundtrack/menu/wind.mp3'] },
            { key: 'end-game', files: ['soundtrack/end-game/end-game.mp3'] },
        ],
    },
    voices: {
        sets: [
            { key: 'set_a', files: ['voices/set_a/normal-1.ogg', 'voices/set_a/normal-2.ogg'] },
            { key: 'set_b', files: ['voices/set_b/rouco-1.ogg'] },
        ],
    },
    soundEffects: {
        groups: [
            {
                key: 'button_hover',
                files: ['sound_effects/button_hover/estalo1.wav'],
            },
        ],
    },
};

describe('parseAudioManifest', () => {
    it('resolves every path under the audio folder', () => {
        const manifest = parseAudioManifest(RAW_MANIFEST);

        expect(manifest.soundtrack.roles[0]?.files).toEqual([
            'assets/audio/soundtrack/match/soundtrack-p1.mp3',
        ]);
        expect(manifest.voices.sets[0]?.files[0]).toBe('assets/audio/voices/set_a/normal-1.ogg');
        expect(manifest.soundEffects.groups[0]?.files[0]).toBe(
            'assets/audio/sound_effects/button_hover/estalo1.wav',
        );
    });

    it('exposes one track per screen role', () => {
        const manifest = parseAudioManifest(RAW_MANIFEST);

        expect(soundtrackTrack(manifest, 'match')).toBe(
            'assets/audio/soundtrack/match/soundtrack-p1.mp3',
        );
        expect(soundtrackTrack(manifest, 'menu')).toBe('assets/audio/soundtrack/menu/wind.mp3');
        expect(soundtrackTrack(manifest, 'end-game')).toBe(
            'assets/audio/soundtrack/end-game/end-game.mp3',
        );
    });

    it('returns null for a role with no track configured', () => {
        const manifest = parseAudioManifest({ soundtrack: { roles: [] } });

        expect(soundtrackTrack(manifest, 'menu')).toBeNull();
    });

    it('drops unknown soundtrack folders, so a stray folder cannot break boot', () => {
        const manifest = parseAudioManifest({
            soundtrack: {
                roles: [
                    { key: 'match', files: ['soundtrack/match/a.mp3'] },
                    { key: 'boss-fight', files: ['soundtrack/boss-fight/b.mp3'] },
                ],
            },
        });

        expect(manifest.soundtrack.roles.map((role) => role.key)).toEqual(['match']);
    });

    it('keeps the voice set folder name as the key', () => {
        const manifest = parseAudioManifest(RAW_MANIFEST);

        expect(manifest.voices.sets.map((set) => set.key)).toEqual(['set_a', 'set_b']);
    });

    it('drops malformed entries instead of throwing', () => {
        const manifest = parseAudioManifest({
            soundtrack: { roles: [{ files: ['a.mp3'] }, { key: 'menu', files: 'nope' }] },
            voices: { sets: [{ files: ['a.ogg'] }, { key: 'set_a', files: 'nope' }] },
            soundEffects: { groups: null },
        });

        expect(manifest.soundtrack.roles).toEqual([{ key: 'menu', files: [] }]);
        expect(manifest.voices.sets).toEqual([{ key: 'set_a', files: [] }]);
        expect(manifest.soundEffects.groups).toEqual([]);
    });

    it('falls back to an empty catalog for junk input', () => {
        expect(parseAudioManifest(null)).toEqual(EMPTY_AUDIO_MANIFEST);
        expect(parseAudioManifest('nope')).toEqual(EMPTY_AUDIO_MANIFEST);
    });

    it('lists every file once, for preloading', () => {
        const urls = manifestUrls(parseAudioManifest(RAW_MANIFEST));

        expect(urls).toHaveLength(7);
        expect(new Set(urls).size).toBe(urls.length);
    });

    it('points the manifest fetch at the audio folder', () => {
        expect(AUDIO_MANIFEST_URL).toBe('assets/audio/manifest.json');
        expect(audioUrl('voices/set_a/a.ogg')).toBe('assets/audio/voices/set_a/a.ogg');
    });
});

describe('audio selection', () => {
    it('prefers the stored voice set when it still exists', () => {
        const sets = parseAudioManifest(RAW_MANIFEST).voices.sets;

        expect(resolveVoiceSet(sets, 'set_b')?.key).toBe('set_b');
        expect(resolveVoiceSet(sets, 'gone')?.key).toBe('set_a');
        expect(resolveVoiceSet([], 'set_a')).toBeNull();
    });

    it('picks entries within range, even for a random() of 1', () => {
        const items = ['a', 'b', 'c'];

        expect(pickRandom(items, () => 0)).toBe('a');
        expect(pickRandom(items, () => 0.5)).toBe('b');
        expect(pickRandom(items, () => 1)).toBe('c');
        expect(pickRandom([], () => 0.5)).toBeNull();
    });

    it('derives the label key from the folder name', () => {
        expect(voiceSetLabelKey('set_a')).toBe('settings.voiceSet.set_a');
        expect(DEFAULT_VOICE_SET).toBe('set_a');
    });
});

describe('pickRandomDistinct', () => {
    const items = ['a', 'b', 'c'];

    it('never repeats a sample', () => {
        // Sweep the whole random range: the two picks must always differ.
        for (let step = 0; step <= 20; step++) {
            const random = () => step / 20;
            const picked = pickRandomDistinct(items, 2, random);

            expect(picked).toHaveLength(2);
            expect(new Set(picked).size).toBe(2);
        }
    });

    it('returns every entry when asked for the whole pool', () => {
        const picked = pickRandomDistinct(items, 3, () => 0.5);

        expect([...picked].sort()).toEqual(['a', 'b', 'c']);
    });

    it('caps the result at the pool size', () => {
        expect(pickRandomDistinct(items, 99, () => 0.5)).toHaveLength(3);
        expect(pickRandomDistinct([], 2, () => 0.5)).toEqual([]);
        expect(pickRandomDistinct(items, 0, () => 0.5)).toEqual([]);
    });

    it('does not mutate the source list', () => {
        const source = [...items];

        pickRandomDistinct(source, 2, () => 0.5);

        expect(source).toEqual(items);
    });
});

describe('AudioEngine', () => {
    it('reports nothing as ready before any load', () => {
        const engine = new AudioEngine();

        expect(engine.isReady('assets/audio/voices/set_a/a.ogg')).toBe(false);
        expect(engine.isMusicPlaying).toBe(false);
    });

    it('does not throw when playing an unknown file', () => {
        const engine = new AudioEngine();

        expect(engine.play('voice', 'assets/audio/voices/set_a/missing.ogg')).toBe(false);
        expect(engine.playRandom('soundEffect', [], Math.random)).toBe(false);
    });

    it('keeps asking for the same file only until it is known to be broken', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

        const engine = new AudioEngine();
        await engine.load('assets/audio/x.ogg');
        await engine.load('assets/audio/x.ogg');

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        fetchSpy.mockRestore();
        engine.dispose();
    });
});

/**
 * Minimal stand-in for the Web Audio API, enough to observe what the engine
 * schedules. jsdom has no `AudioContext` at all, so this is the only way to
 * assert on start times.
 */
class FakeAudioContext {
    static instances: FakeAudioContext[] = [];

    readonly started: {
        when: number;
        offset: number;
        loop: boolean;
        duration: number;
    }[] = [];
    readonly stopped: number[] = [];
    /** One entry per gain node created, with its own automation points. */
    readonly gainNodes: { id: number; ramps: { value: number; at: number }[] }[] = [];
    currentTime = 10;
    state: AudioContextState = 'running';
    destination = {};

    constructor() {
        FakeAudioContext.instances.push(this);
    }

    createGain() {
        const node = { id: this.gainNodes.length, ramps: [] as { value: number; at: number }[] };
        this.gainNodes.push(node);

        const record = (value: number, at: number) => {
            node.ramps.push({ value, at });
        };

        return {
            gain: {
                value: 1,
                cancelScheduledValues: () => undefined,
                setValueAtTime: record,
                linearRampToValueAtTime: record,
            },
            connect: () => undefined,
            disconnect: () => undefined,
        };
    }

    createBufferSource() {
        const context = this;
        const node = {
            buffer: null as unknown,
            loop: false,
            playbackRate: { value: 1 },
            onended: null as (() => void) | null,
            connect: () => node,
            disconnect: () => undefined,
            start: (when: number, offset: number) => {
                const buffer = node.buffer as { duration?: number } | null;
                context.started.push({
                    when,
                    offset,
                    loop: node.loop,
                    duration: buffer?.duration ?? 0,
                });
            },
            stop: (when: number) => {
                context.stopped.push(when);
            },
        };

        return node;
    }

    decodeAudioData() {
        return Promise.resolve({ duration: this.bufferDuration });
    }

    resume() {
        this.state = 'running';
        return Promise.resolve();
    }

    suspend() {
        this.state = 'suspended';
        return Promise.resolve();
    }

    close() {
        this.state = 'closed';
        return Promise.resolve();
    }

    /** Duration every decoded buffer reports; set per test. */
    bufferDuration = 1;
}

describe('AudioEngine scheduling', () => {
    const original = (globalThis as { AudioContext?: unknown }).AudioContext;

    beforeEach(() => {
        FakeAudioContext.instances = [];
        (globalThis as { AudioContext?: unknown }).AudioContext = FakeAudioContext;
    });

    afterEach(() => {
        (globalThis as { AudioContext?: unknown }).AudioContext = original;
    });

    /** Loads one file into the engine so it can be played. */
    async function engineWith(url: string): Promise<AudioEngine> {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            arrayBuffer: async () => new ArrayBuffer(8),
        } as Response);

        const engine = new AudioEngine();
        await engine.load(url);
        fetchSpy.mockRestore();
        return engine;
    }

    it('starts a sound immediately by default', async () => {
        const engine = await engineWith('assets/audio/a.wav');

        expect(engine.play('soundEffect', 'assets/audio/a.wav')).toBe(true);

        const context = FakeAudioContext.instances[0];
        expect(context.started).toHaveLength(1);
        expect(context.started[0].when).toBe(context.currentTime);
    });

    it('schedules a delayed sound on the audio clock, not with a timer', async () => {
        const engine = await engineWith('assets/audio/a.wav');

        engine.play('soundEffect', 'assets/audio/a.wav', { delay: 0.95 });

        const context = FakeAudioContext.instances[0];
        // 10 (currentTime) + 0.95: sample-accurate, independent of the main thread.
        expect(context.started[0].when).toBeCloseTo(10.95, 5);
    });

    it('treats a negative delay as "now"', async () => {
        const engine = await engineWith('assets/audio/a.wav');

        engine.play('soundEffect', 'assets/audio/a.wav', { delay: -5 });

        const context = FakeAudioContext.instances[0];
        expect(context.started[0].when).toBe(context.currentTime);
    });

    it('schedules two impacts at their own times', async () => {
        const engine = await engineWith('assets/audio/a.wav');

        engine.play('soundEffect', 'assets/audio/a.wav', { delay: 0.42 });
        engine.play('soundEffect', 'assets/audio/a.wav', { delay: 0.95 });

        const context = FakeAudioContext.instances[0];
        expect(context.started.map((entry) => entry.when)).toEqual([10.42, 10.95]);
    });
});

describe('AudioEngine music', () => {
    const original = (globalThis as { AudioContext?: unknown }).AudioContext;

    beforeEach(() => {
        FakeAudioContext.instances = [];
        (globalThis as { AudioContext?: unknown }).AudioContext = FakeAudioContext;
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        (globalThis as { AudioContext?: unknown }).AudioContext = original;
    });

    /** Loads one file (with a chosen duration) so it can be played as music. */
    async function engineWith(url: string, duration = 30): Promise<AudioEngine> {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            arrayBuffer: async () => new ArrayBuffer(8),
        } as Response);

        const engine = new AudioEngine();
        FakeAudioContext.prototype.decodeAudioData = () => Promise.resolve({ duration });
        await engine.load(url);
        fetchSpy.mockRestore();
        return engine;
    }

    it('plays a once-only track without looping', async () => {
        const engine = await engineWith('assets/audio/end-game.mp3');
        const context = FakeAudioContext.instances[0];

        engine.startMusic('assets/audio/end-game.mp3', { loop: false });

        expect(context.started).toHaveLength(1);
        expect(context.started[0].loop).toBe(false);
    });

    it('releases the channel when a once-only track ends, so it can replay', async () => {
        const engine = await engineWith('assets/audio/end-game.mp3');

        engine.startMusic('assets/audio/end-game.mp3', { loop: false });
        expect(engine.isMusicPlaying).toBe(true);

        engine.stopMusic(0);
        expect(engine.isMusicPlaying).toBe(false);

        // Starting it again must actually start a new source.
        const before = FakeAudioContext.instances[0].started.length;
        engine.startMusic('assets/audio/end-game.mp3', { loop: false });
        expect(FakeAudioContext.instances[0].started.length).toBe(before + 1);
    });

    it('does not restart a track that is already playing', async () => {
        const engine = await engineWith('assets/audio/wind.mp3');
        const context = FakeAudioContext.instances[0];

        engine.startMusic('assets/audio/wind.mp3', { loop: true });
        engine.startMusic('assets/audio/wind.mp3', { loop: true });

        expect(context.started).toHaveLength(1);
    });

    it('loops with the browser when no crossfade is asked for', async () => {
        const engine = await engineWith('assets/audio/wind.mp3');
        const context = FakeAudioContext.instances[0];

        engine.startMusic('assets/audio/wind.mp3', { loop: true, crossfadeSeconds: 0 });

        expect(context.started).toHaveLength(1);
        expect(context.started[0].loop).toBe(true);
    });

    it('crossfades a looping track instead of using the gapless loop', async () => {
        const engine = await engineWith('assets/audio/wind.mp3', 10);
        const context = FakeAudioContext.instances[0];

        engine.startMusic('assets/audio/wind.mp3', { loop: true, crossfadeSeconds: 2 });

        // The first pass starts right away; a second one is queued within the
        // lookahead window, overlapping the first by the crossfade length.
        expect(context.started.length).toBeGreaterThanOrEqual(2);
        expect(context.started.every((entry) => entry.loop === false)).toBe(true);

        const [first, second] = context.started;
        expect(first.when).toBe(context.currentTime);
        // Period = duration - crossfade = 8s.
        expect(second.when).toBeCloseTo(context.currentTime + 8, 5);
    });

    it('fades a pass in and out so the seam is inaudible', async () => {
        const engine = await engineWith('assets/audio/wind.mp3', 10);
        const context = FakeAudioContext.instances[0];

        engine.startMusic('assets/audio/wind.mp3', { loop: true, crossfadeSeconds: 2 });

        // The first pass's own gain node: silence at 10, full by 12, silent at 20.
        const pass = context.gainNodes.find((node) =>
            node.ramps.some((ramp) => ramp.at === 10 && ramp.value === 0),
        );
        expect(pass).toBeDefined();
        expect(gainAt(pass!.ramps, 10)).toBe(0);
        expect(gainAt(pass!.ramps, 12)).toBeCloseTo(1, 5);
        expect(gainAt(pass!.ramps, 20)).toBeCloseTo(0, 5);
    });

    it('keeps the loudness flat across the overlap (equal power)', async () => {
        const engine = await engineWith('assets/audio/wind.mp3', 10);
        const context = FakeAudioContext.instances[0];

        engine.startMusic('assets/audio/wind.mp3', { loop: true, crossfadeSeconds: 2 });

        const first = context.gainNodes.find((node) =>
            node.ramps.some((ramp) => ramp.at === 10 && ramp.value === 0),
        );
        const second = context.gainNodes.find((node) =>
            node.ramps.some((ramp) => ramp.at === 18 && ramp.value === 0),
        );
        expect(first && second).toBeTruthy();

        // The overlap runs from 18 (second pass starts) to 20 (first ends).
        // The passes are uncorrelated, so their powers must sum to 1 — which is
        // what keeps the wind from pulsing on every loop.
        for (const at of [18.5, 19, 19.5, 19.9]) {
            const fadingOut = gainAt(first!.ramps, at);
            const fadingIn = gainAt(second!.ramps, at);
            expect(fadingOut ** 2 + fadingIn ** 2).toBeCloseTo(1, 1);
        }
    });

    it('overlaps consecutive passes so the seam falls mid-fade', async () => {
        const engine = await engineWith('assets/audio/wind.mp3', 10);
        const context = FakeAudioContext.instances[0];

        engine.startMusic('assets/audio/wind.mp3', { loop: true, crossfadeSeconds: 2 });

        const [first, second] = context.started;
        // The second pass is already queued and starts 2s before the first ends.
        expect(first.when + 10 - second.when).toBeCloseTo(2, 5);
    });

    it('caps the crossfade so it can never swallow the whole track', async () => {
        const engine = await engineWith('assets/audio/wind.mp3', 4);
        const context = FakeAudioContext.instances[0];

        // Asking for a 10s crossfade on a 4s track must clamp to 2s.
        engine.startMusic('assets/audio/wind.mp3', { loop: true, crossfadeSeconds: 10 });

        const [, second] = context.started;
        expect(second.when).toBeCloseTo(context.currentTime + 2, 5);
    });

    it('keeps queueing passes as time advances', async () => {
        const engine = await engineWith('assets/audio/wind.mp3', 10);
        const context = FakeAudioContext.instances[0];

        engine.startMusic('assets/audio/wind.mp3', { loop: true, crossfadeSeconds: 2 });
        const queued = context.started.length;

        // Advance the audio clock and let the scheduler top up.
        context.currentTime += 20;
        vi.advanceTimersByTime(1000);

        expect(context.started.length).toBeGreaterThan(queued);
    });

    it('stops every queued pass when the music is stopped', async () => {
        const engine = await engineWith('assets/audio/wind.mp3', 10);
        const context = FakeAudioContext.instances[0];

        engine.startMusic('assets/audio/wind.mp3', { loop: true, crossfadeSeconds: 2 });
        engine.stopMusic(0);

        expect(context.stopped.length).toBeGreaterThanOrEqual(context.started.length);
        expect(engine.isMusicPlaying).toBe(false);
    });

    it('does not queue more passes after being stopped', async () => {
        const engine = await engineWith('assets/audio/wind.mp3', 10);
        const context = FakeAudioContext.instances[0];

        engine.startMusic('assets/audio/wind.mp3', { loop: true, crossfadeSeconds: 2 });
        engine.stopMusic(0);
        const afterStop = context.started.length;

        context.currentTime += 30;
        vi.advanceTimersByTime(2000);

        expect(context.started.length).toBe(afterStop);
    });
});

describe('AudioEngine focus handling', () => {
    const original = (globalThis as { AudioContext?: unknown }).AudioContext;

    beforeEach(() => {
        FakeAudioContext.instances = [];
        (globalThis as { AudioContext?: unknown }).AudioContext = FakeAudioContext;
    });

    afterEach(() => {
        (globalThis as { AudioContext?: unknown }).AudioContext = original;
    });

    async function engineWith(url: string): Promise<AudioEngine> {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            arrayBuffer: async () => new ArrayBuffer(8),
        } as Response);

        const engine = new AudioEngine();
        await engine.load(url);
        fetchSpy.mockRestore();
        return engine;
    }

    it('suspends the context when the app loses focus', async () => {
        const engine = await engineWith('assets/audio/wind.mp3');
        await engine.unlock();
        const context = FakeAudioContext.instances[0];

        await engine.suspend();

        expect(context.state).toBe('suspended');
    });

    it('resumes the context when focus returns', async () => {
        const engine = await engineWith('assets/audio/wind.mp3');
        await engine.unlock();
        const context = FakeAudioContext.instances[0];

        await engine.suspend();
        await engine.resume();

        expect(context.state).toBe('running');
    });

    it('keeps the music playing across a suspend, so it continues in place', async () => {
        const engine = await engineWith('assets/audio/wind.mp3');
        await engine.unlock();

        engine.startMusic('assets/audio/wind.mp3', { loop: true });
        await engine.suspend();
        await engine.resume();

        // Suspending freezes the clock; the track is never torn down.
        expect(engine.isMusicPlaying).toBe(true);
    });

    it('does not auto-resume a context we suspended ourselves', async () => {
        const engine = await engineWith('assets/audio/a.wav');
        await engine.unlock();
        const context = FakeAudioContext.instances[0];

        await engine.suspend();
        // A sound triggered while unfocused must stay silent, not leak audio.
        engine.play('soundEffect', 'assets/audio/a.wav');

        expect(context.state).toBe('suspended');
    });

    it('still auto-resumes a context the browser suspended on its own', async () => {
        const engine = await engineWith('assets/audio/a.wav');
        await engine.unlock();
        const context = FakeAudioContext.instances[0];

        // Simulate the browser suspending us (autoplay policy), not our own call.
        context.state = 'suspended';
        engine.play('soundEffect', 'assets/audio/a.wav');

        expect(context.state).toBe('running');
    });

    it('ignores suspend/resume when there is no context yet', async () => {
        const engine = new AudioEngine();

        await expect(engine.suspend()).resolves.toBeUndefined();
        await expect(engine.resume()).resolves.toBeUndefined();
    });
});

/** Gain value in effect at `at`, from the ramp points scheduled so far. */
function gainAt(ramps: readonly { value: number; at: number }[], at: number): number {
    let value = 0;

    for (const ramp of ramps) {
        if (ramp.at <= at) {
            value = ramp.value;
        }
    }

    return value;
}
