import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AudioEngine, type AudioChannel } from '../../game/audio';
import { AudioService, SOUND_EFFECTS } from './audio.service';
import { GameFlowService } from './game-flow.service';
import { GameSettingsService } from './game-settings.service';

const CATALOG = {
    soundtrack: { tracks: ['assets/audio/soundtrack/soundtrack-p1.mp3'] },
    voices: {
        sets: [
            { key: 'set_a', files: ['assets/audio/voices/set_a/a.ogg'] },
            { key: 'set_b', files: ['assets/audio/voices/set_b/b.ogg'] },
        ],
    },
    soundEffects: {
        groups: [
            {
                key: SOUND_EFFECTS.buttonHover,
                files: ['assets/audio/sound_effects/button_hover/1.wav'],
            },
        ],
    },
};

describe('AudioService', () => {
    let service: AudioService;
    let settings: GameSettingsService;
    let flow: GameFlowService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(AudioService);
        settings = TestBed.inject(GameSettingsService);
        flow = TestBed.inject(GameFlowService);
        service.useCatalog(CATALOG);
    });

    it('exposes the voice sets from the catalog', () => {
        expect(service.voiceSets().map((set) => set.key)).toEqual(['set_a', 'set_b']);
        expect(service.hasVoiceSets()).toBe(true);
    });

    it('routes each setting to its own mixer channel', () => {
        const setVolume = vi.spyOn(AudioEngine.prototype, 'setVolume');

        settings.setMusicVolume(0.3);
        settings.setSfxVolume(0.4);
        settings.setVoiceVolume(0.5);
        TestBed.tick();

        const calls = new Map(setVolume.mock.calls as [AudioChannel, number][]);
        expect(calls.get('music')).toBe(0.3);
        expect(calls.get('soundEffect')).toBe(0.4);
        expect(calls.get('voice')).toBe(0.5);

        setVolume.mockRestore();
    });

    it('keeps the voice volume independent from the sound effects', () => {
        const setVolume = vi.spyOn(AudioEngine.prototype, 'setVolume');

        settings.setSfxVolume(1);
        settings.setVoiceVolume(0.1);
        TestBed.tick();

        const calls = setVolume.mock.calls as [AudioChannel, number][];
        const voice = calls.filter(([channel]) => channel === 'voice').at(-1);
        const sfx = calls.filter(([channel]) => channel === 'soundEffect').at(-1);

        expect(voice?.[1]).toBe(0.1);
        expect(sfx?.[1]).toBe(1);

        setVolume.mockRestore();
    });

    it('plays the soundtrack only while a match is running', () => {
        const startMusic = vi.spyOn(AudioEngine.prototype, 'startMusic');
        const stopMusic = vi.spyOn(AudioEngine.prototype, 'stopMusic');

        flow.startMatch();
        TestBed.tick();
        expect(startMusic).toHaveBeenCalled();

        startMusic.mockClear();
        flow.pause();
        TestBed.tick();
        expect(stopMusic).toHaveBeenCalled();
        expect(startMusic).not.toHaveBeenCalled();

        stopMusic.mockClear();
        flow.resume();
        TestBed.tick();
        expect(startMusic).toHaveBeenCalled();

        startMusic.mockClear();
        flow.endMatch({ score: 0, best: 0, survived: 1, dodges: 0, nearMisses: 0 });
        TestBed.tick();
        expect(startMusic).not.toHaveBeenCalled();

        startMusic.mockClear();
        flow.abandon();
        TestBed.tick();
        expect(startMusic).not.toHaveBeenCalled();

        startMusic.mockRestore();
        stopMusic.mockRestore();
    });

    it('never starts the soundtrack while sitting on the menu', () => {
        const startMusic = vi.spyOn(AudioEngine.prototype, 'startMusic');

        TestBed.tick();

        expect(startMusic).not.toHaveBeenCalled();
        startMusic.mockRestore();
    });

    it('plays a random variant of the hover sound', () => {
        const playRandom = vi.spyOn(AudioEngine.prototype, 'playRandom').mockReturnValue(true);

        expect(service.playButtonHover()).toBe(true);
        expect(playRandom).toHaveBeenCalledWith(
            'soundEffect',
            ['assets/audio/sound_effects/button_hover/1.wav'],
            expect.any(Function),
            expect.objectContaining({ volume: expect.any(Number) }),
        );

        playRandom.mockRestore();
    });

    it('rate-limits the hover sound so sweeping the mouse stays pleasant', () => {
        const playRandom = vi.spyOn(AudioEngine.prototype, 'playRandom').mockReturnValue(true);

        const results = [
            service.playButtonHover(),
            service.playButtonHover(),
            service.playButtonHover(),
        ];

        expect(results.filter(Boolean)).toHaveLength(1);
        playRandom.mockRestore();
    });

    it('resolves the stored voice set, falling back to the first one', () => {
        settings.setVoiceSet('set_b');
        expect(service.voiceFiles(settings.voiceSet())).toEqual([
            'assets/audio/voices/set_b/b.ogg',
        ]);

        expect(service.voiceFiles('deleted_set')).toEqual(['assets/audio/voices/set_a/a.ogg']);
    });

    it('plays a voice preview on the voice channel', () => {
        const play = vi.spyOn(AudioEngine.prototype, 'play').mockReturnValue(true);

        expect(service.playVoicePreview('set_a')).toBe(true);
        expect(play).toHaveBeenCalledWith('voice', 'assets/audio/voices/set_a/a.ogg');

        play.mockRestore();
    });

    it('returns false instead of throwing when the catalog has no sound', () => {
        service.useCatalog({
            soundtrack: { tracks: [] },
            voices: { sets: [] },
            soundEffects: { groups: [] },
        });

        expect(service.playButtonHover()).toBe(false);
        expect(service.playVoicePreview('set_a')).toBe(false);
    });
});
