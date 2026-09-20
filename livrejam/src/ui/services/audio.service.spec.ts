import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AudioEngine, type AudioChannel, type AudioManifest } from '../../game/audio';
import type { TrackingFrame } from '../../engine/tracking';
import { useReadyCamera } from '../testing/camera-testing';
import { AudioService, SOUND_EFFECTS } from './audio.service';
import { GameFlowService } from './game-flow.service';
import { GameSettingsService } from './game-settings.service';
import { TrackingFrameService } from './tracking-frame.service';

const CATALOG: AudioManifest = {
    soundtrack: {
        roles: [
            { key: 'match', files: ['assets/audio/soundtrack/match/song.mp3'] },
            { key: 'match-sigma', files: ['assets/audio/soundtrack/match-sigma/sigma.mp3'] },
            { key: 'menu', files: ['assets/audio/soundtrack/menu/wind.mp3'] },
            { key: 'end-game', files: ['assets/audio/soundtrack/end-game/end.mp3'] },
        ],
    },
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
            {
                key: SOUND_EFFECTS.strongExplosion,
                files: [
                    'assets/audio/sound_effects/strong_explosions/explosion1.wav',
                    'assets/audio/sound_effects/strong_explosions/explosion2.wav',
                    'assets/audio/sound_effects/strong_explosions/explosion3.wav',
                ],
            },
        ],
    },
};

const MATCH_SONG = 'assets/audio/soundtrack/match/song.mp3';
const SIGMA_SONG = 'assets/audio/soundtrack/match-sigma/sigma.mp3';

/** A tracking frame whose only meaningful bit is the sigma gesture. */
function sigmaFrame(active: boolean): TrackingFrame {
    return {
        timestamp: 0,
        face: null,
        hands: [],
        gestures: {
            sixtySeven: { active: false, confidence: 0, level: 0, frequency: 0, alternations: 0 },
            sigma: { active, confidence: active ? 1 : 0, score: active ? 1 : 0 },
            topHand: { active: false, confidence: 0, side: null, margin: 0 },
        },
    };
}

describe('AudioService', () => {
    let service: AudioService;
    let settings: GameSettingsService;
    let flow: GameFlowService;
    let frames: TrackingFrameService;

    /** One full sigma gesture: it becomes active, then is released. */
    const doSigma = () => {
        frames.publish(sigmaFrame(true));
        TestBed.tick();
        frames.publish(sigmaFrame(false));
        TestBed.tick();
    };

    beforeEach(() => {
        TestBed.configureTestingModule({});
        useReadyCamera();
        service = TestBed.inject(AudioService);
        settings = TestBed.inject(GameSettingsService);
        flow = TestBed.inject(GameFlowService);
        frames = TestBed.inject(TrackingFrameService);
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

    it('plays the match song while playing, and only then', () => {
        const startMusic = vi.spyOn(AudioEngine.prototype, 'startMusic');
        const stopMusic = vi.spyOn(AudioEngine.prototype, 'stopMusic');

        flow.startMatch();
        TestBed.tick();
        expect(startMusic).toHaveBeenCalledWith(
            'assets/audio/soundtrack/match/song.mp3',
            expect.objectContaining({ loop: true }),
        );

        startMusic.mockClear();
        flow.pause();
        TestBed.tick();
        expect(stopMusic).toHaveBeenCalled();
        expect(startMusic).not.toHaveBeenCalled();

        stopMusic.mockClear();
        flow.resume();
        TestBed.tick();
        expect(startMusic).toHaveBeenCalledWith(
            'assets/audio/soundtrack/match/song.mp3',
            expect.objectContaining({ loop: true }),
        );

        startMusic.mockRestore();
        stopMusic.mockRestore();
    });

    it('swaps the match song for the sigma one, and back, on each sigma gesture', () => {
        const startMusic = vi.spyOn(AudioEngine.prototype, 'startMusic');

        flow.startMatch();
        TestBed.tick();
        startMusic.mockClear();

        doSigma();
        expect(startMusic).toHaveBeenCalledWith(SIGMA_SONG, expect.objectContaining({ loop: true }));

        startMusic.mockClear();
        doSigma();
        expect(startMusic).toHaveBeenCalledWith(MATCH_SONG, expect.objectContaining({ loop: true }));

        startMusic.mockRestore();
    });

    it('swaps once while the gesture is held, not on every frame', () => {
        const startMusic = vi.spyOn(AudioEngine.prototype, 'startMusic');

        flow.startMatch();
        TestBed.tick();
        startMusic.mockClear();

        // The gesture stays active for many frames; only the first one counts.
        for (let frame = 0; frame < 5; frame++) {
            frames.publish(sigmaFrame(true));
            TestBed.tick();
        }

        expect(startMusic.mock.calls.map(([url]) => url)).toEqual([SIGMA_SONG]);
        startMusic.mockRestore();
    });

    it('ignores the sigma gesture outside a running match', () => {
        const startMusic = vi.spyOn(AudioEngine.prototype, 'startMusic');

        doSigma();
        flow.startMatch();
        TestBed.tick();

        expect(startMusic).toHaveBeenCalledWith(MATCH_SONG, expect.objectContaining({ loop: true }));
        expect(startMusic.mock.calls.map(([url]) => url)).not.toContain(SIGMA_SONG);
        startMusic.mockRestore();
    });

    it('keeps the sigma song across a pause, since the match carries on', () => {
        const startMusic = vi.spyOn(AudioEngine.prototype, 'startMusic');

        flow.startMatch();
        TestBed.tick();
        doSigma();

        flow.pause();
        TestBed.tick();
        startMusic.mockClear();
        flow.resume();
        TestBed.tick();

        expect(startMusic).toHaveBeenCalledWith(SIGMA_SONG, expect.objectContaining({ loop: true }));
        startMusic.mockRestore();
    });

    it('brings the match song back for the next match', () => {
        const startMusic = vi.spyOn(AudioEngine.prototype, 'startMusic');

        flow.startMatch();
        TestBed.tick();
        doSigma();

        flow.endMatch({ score: 0, best: 0, survived: 1, dodges: 0, nearMisses: 0 });
        TestBed.tick();
        startMusic.mockClear();
        flow.startMatch();
        TestBed.tick();

        expect(startMusic).toHaveBeenCalledWith(MATCH_SONG, expect.objectContaining({ loop: true }));
        startMusic.mockRestore();
    });

    it('brings the match song back when the match is restarted', () => {
        const startMusic = vi.spyOn(AudioEngine.prototype, 'startMusic');

        flow.startMatch();
        TestBed.tick();
        doSigma();
        startMusic.mockClear();

        flow.restartMatch();
        TestBed.tick();

        expect(startMusic).toHaveBeenCalledWith(MATCH_SONG, expect.objectContaining({ loop: true }));
        startMusic.mockRestore();
    });

    it('plays the end-game song exactly once (no loop)', () => {
        const startMusic = vi.spyOn(AudioEngine.prototype, 'startMusic');

        flow.startMatch();
        TestBed.tick();
        startMusic.mockClear();

        flow.endMatch({ score: 0, best: 0, survived: 1, dodges: 0, nearMisses: 0 });
        TestBed.tick();

        expect(startMusic).toHaveBeenCalledTimes(1);
        expect(startMusic).toHaveBeenCalledWith('assets/audio/soundtrack/end-game/end.mp3', {
            loop: false,
        });

        startMusic.mockRestore();
    });

    it('loops the menu ambience with a crossfade', () => {
        const startMusic = vi.spyOn(AudioEngine.prototype, 'startMusic');

        flow.startMatch();
        TestBed.tick();
        startMusic.mockClear();

        flow.abandon();
        TestBed.tick();

        expect(startMusic).toHaveBeenCalledWith(
            'assets/audio/soundtrack/menu/wind.mp3',
            expect.objectContaining({ loop: true, crossfadeSeconds: expect.any(Number) }),
        );
        const options = startMusic.mock.calls[0]?.[1] as { crossfadeSeconds: number };
        expect(options.crossfadeSeconds).toBeGreaterThan(0);

        startMusic.mockRestore();
    });

    it('starts the menu ambience on boot, since the game opens on the menu', () => {
        const startMusic = vi.spyOn(AudioEngine.prototype, 'startMusic');

        TestBed.tick();

        expect(startMusic).toHaveBeenCalledWith(
            'assets/audio/soundtrack/menu/wind.mp3',
            expect.objectContaining({ loop: true }),
        );
        startMusic.mockRestore();
    });

    it('keeps the pause menu silent', () => {
        const startMusic = vi.spyOn(AudioEngine.prototype, 'startMusic');

        flow.startMatch();
        flow.pause();
        TestBed.tick();

        const roles = startMusic.mock.calls.map(([url]) => url);
        expect(roles).not.toContain('assets/audio/soundtrack/menu/wind.mp3');
        expect(roles).not.toContain('assets/audio/soundtrack/end-game/end.mp3');

        startMusic.mockRestore();
    });

    it('stays silent when a role has no track configured', () => {
        service.useCatalog({
            soundtrack: { roles: [] },
            voices: { sets: [] },
            soundEffects: { groups: [] },
        });
        const startMusic = vi.spyOn(AudioEngine.prototype, 'startMusic');

        flow.startMatch();
        TestBed.tick();

        expect(startMusic).not.toHaveBeenCalled();
        startMusic.mockRestore();
    });

    it('suspends the mixer when the window loses focus', () => {
        const suspend = vi.spyOn(AudioEngine.prototype, 'suspend').mockResolvedValue();

        window.dispatchEvent(new Event('blur'));

        expect(suspend).toHaveBeenCalledTimes(1);
        suspend.mockRestore();
    });

    it('resumes the mixer when the window regains focus', () => {
        const resume = vi.spyOn(AudioEngine.prototype, 'resume').mockResolvedValue();

        window.dispatchEvent(new Event('focus'));

        expect(resume).toHaveBeenCalledTimes(1);
        resume.mockRestore();
    });

    it('suspends while the tab is hidden and resumes when it is shown again', () => {
        const suspend = vi.spyOn(AudioEngine.prototype, 'suspend').mockResolvedValue();
        const resume = vi.spyOn(AudioEngine.prototype, 'resume').mockResolvedValue();

        const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        document.dispatchEvent(new Event('visibilitychange'));
        expect(suspend).toHaveBeenCalledTimes(1);
        expect(resume).not.toHaveBeenCalled();

        hidden.mockReturnValue(false);
        document.dispatchEvent(new Event('visibilitychange'));
        expect(resume).toHaveBeenCalledTimes(1);

        hidden.mockRestore();
        suspend.mockRestore();
        resume.mockRestore();
    });

    it('stops listening for focus changes once destroyed', () => {
        const suspend = vi.spyOn(AudioEngine.prototype, 'suspend').mockResolvedValue();
        TestBed.resetTestingModule();

        window.dispatchEvent(new Event('blur'));

        expect(suspend).not.toHaveBeenCalled();
        suspend.mockRestore();
    });

    it('never unlocks audio while the tab is hidden', () => {
        const unlock = vi.spyOn(AudioEngine.prototype, 'unlock').mockResolvedValue(true);
        const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);

        window.dispatchEvent(new PointerEvent('pointerdown'));

        expect(unlock).not.toHaveBeenCalled();

        hidden.mockReturnValue(false);
        window.dispatchEvent(new PointerEvent('pointerdown'));
        expect(unlock).toHaveBeenCalledTimes(1);

        hidden.mockRestore();
        unlock.mockRestore();
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
            soundtrack: { roles: [] },
            voices: { sets: [] },
            soundEffects: { groups: [] },
        });

        expect(service.playButtonHover()).toBe(false);
        expect(service.playVoicePreview('set_a')).toBe(false);
    });

    it('plays two different explosions, each at its own impact time', () => {
        const play = vi.spyOn(AudioEngine.prototype, 'play').mockReturnValue(true);

        expect(
            service.playSoundEffectSequence(SOUND_EFFECTS.strongExplosion, 2, [0.42, 0.95]),
        ).toBe(true);

        const calls = play.mock.calls as [string, string, { delay: number }][];
        expect(calls).toHaveLength(2);

        const [firstUrl, secondUrl] = calls.map(([, url]) => url);
        expect(firstUrl).not.toBe(secondUrl);
        expect(calls.map(([, , options]) => options.delay)).toEqual([0.42, 0.95]);
        expect(calls.every(([channel]) => channel === 'soundEffect')).toBe(true);

        play.mockRestore();
    });

    it('never repeats an explosion sample, whatever the random draw', () => {
        const play = vi.spyOn(AudioEngine.prototype, 'play').mockReturnValue(true);

        for (let step = 0; step <= 20; step++) {
            play.mockClear();
            service.playSoundEffectSequence(
                SOUND_EFFECTS.strongExplosion,
                2,
                [0, 0],
                () => step / 20,
            );

            const urls = (play.mock.calls as [string, string][]).map(([, url]) => url);
            expect(new Set(urls).size).toBe(2);
        }

        play.mockRestore();
    });

    it('plays a single explosion when the pool has only one sample', () => {
        service.useCatalog({
            soundtrack: { roles: [] },
            voices: { sets: [] },
            soundEffects: {
                groups: [
                    {
                        key: SOUND_EFFECTS.strongExplosion,
                        files: ['assets/audio/sound_effects/strong_explosions/only.wav'],
                    },
                ],
            },
        });
        const play = vi.spyOn(AudioEngine.prototype, 'play').mockReturnValue(true);

        service.playSoundEffectSequence(SOUND_EFFECTS.strongExplosion, 2, [0.42, 0.95]);

        expect(play).toHaveBeenCalledTimes(1);
        play.mockRestore();
    });

    it('returns false when the explosion group is missing', () => {
        service.useCatalog({
            soundtrack: { roles: [] },
            voices: { sets: [] },
            soundEffects: { groups: [] },
        });

        expect(service.playSoundEffectSequence(SOUND_EFFECTS.strongExplosion, 2, [0, 1])).toBe(
            false,
        );
    });
});
