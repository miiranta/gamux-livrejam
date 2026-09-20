import { describe, expect, it, vi } from 'vitest';

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
