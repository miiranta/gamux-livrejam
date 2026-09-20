import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AudioEngine } from './audio-engine';
import {
    AUDIO_MANIFEST_URL,
    EMPTY_AUDIO_MANIFEST,
    audioUrl,
    manifestUrls,
    parseAudioManifest,
} from './audio-manifest';
import {
    DEFAULT_VOICE_SET,
    pickRandom,
    pickRandomDistinct,
    resolveVoiceSet,
    voiceSetLabelKey,
} from './audio-selection';

const RAW_MANIFEST = {
    soundtrack: { tracks: ['soundtrack/soundtrack-p1.mp3'] },
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

        expect(manifest.soundtrack.tracks).toEqual(['assets/audio/soundtrack/soundtrack-p1.mp3']);
        expect(manifest.voices.sets[0]?.files[0]).toBe('assets/audio/voices/set_a/normal-1.ogg');
        expect(manifest.soundEffects.groups[0]?.files[0]).toBe(
            'assets/audio/sound_effects/button_hover/estalo1.wav',
        );
    });

    it('keeps the voice set folder name as the key', () => {
        const manifest = parseAudioManifest(RAW_MANIFEST);

        expect(manifest.voices.sets.map((set) => set.key)).toEqual(['set_a', 'set_b']);
    });

    it('drops malformed entries instead of throwing', () => {
        const manifest = parseAudioManifest({
            soundtrack: { tracks: [1, 'ok.mp3', ''] },
            voices: { sets: [{ files: ['a.ogg'] }, { key: 'set_a', files: 'nope' }] },
            soundEffects: { groups: null },
        });

        expect(manifest.soundtrack.tracks).toEqual(['assets/audio/ok.mp3']);
        expect(manifest.voices.sets).toEqual([{ key: 'set_a', files: [] }]);
        expect(manifest.soundEffects.groups).toEqual([]);
    });

    it('falls back to an empty catalog for junk input', () => {
        expect(parseAudioManifest(null)).toEqual(EMPTY_AUDIO_MANIFEST);
        expect(parseAudioManifest('nope')).toEqual(EMPTY_AUDIO_MANIFEST);
    });

    it('lists every file once, for preloading', () => {
        const urls = manifestUrls(parseAudioManifest(RAW_MANIFEST));

        expect(urls).toHaveLength(5);
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

    readonly started: { when: number; offset: number; loop: boolean }[] = [];
    readonly gains: number[] = [];
    currentTime = 10;
    state: AudioContextState = 'running';
    destination = {};

    constructor() {
        FakeAudioContext.instances.push(this);
    }

    createGain() {
        const context = this;
        const node = {
            gain: {
                value: 1,
                cancelScheduledValues: () => undefined,
                setValueAtTime: () => undefined,
                linearRampToValueAtTime: (value: number) => {
                    context.gains.push(value);
                },
            },
            connect: () => node,
            disconnect: () => undefined,
        };

        return node;
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
                context.started.push({ when, offset, loop: node.loop });
            },
            stop: () => undefined,
        };

        return node;
    }

    decodeAudioData() {
        return Promise.resolve({ duration: 1 });
    }

    resume() {
        return Promise.resolve();
    }

    close() {
        this.state = 'closed';
        return Promise.resolve();
    }
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
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue({
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
