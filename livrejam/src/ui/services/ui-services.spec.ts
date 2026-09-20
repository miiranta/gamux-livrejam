import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_VOICE_SET } from '../../game/audio';
import { GameFlowService } from './game-flow.service';
import { GameSettingsService, formatDuration, parseDuration } from './game-settings.service';
import { LanguageService } from './language.service';
import { provideTestTranslate, useTestTranslations } from '../testing/i18n-testing';

describe('GameSettingsService', () => {
    it('starts with sane defaults', () => {
        TestBed.configureTestingModule({});
        const settings = TestBed.inject(GameSettingsService);

        expect(settings.musicVolume()).toBeGreaterThan(0);
        expect(settings.sfxVolume()).toBeGreaterThan(0);
        expect(settings.voiceVolume()).toBeGreaterThan(0);
        expect(settings.voiceSet()).toBe(DEFAULT_VOICE_SET);
        expect(settings.matchTimeSeconds()).toBeGreaterThan(0);
    });

    it('clamps volumes into the 0..1 range', () => {
        TestBed.configureTestingModule({});
        const settings = TestBed.inject(GameSettingsService);

        settings.setMusicVolume(4);
        settings.setSfxVolume(-2);
        settings.setVoiceVolume(9);

        expect(settings.musicVolume()).toBe(1);
        expect(settings.sfxVolume()).toBe(0);
        expect(settings.voiceVolume()).toBe(1);
    });

    it('keeps the voice volume separate from the sound effects', () => {
        TestBed.configureTestingModule({});
        const settings = TestBed.inject(GameSettingsService);

        settings.setSfxVolume(0.2);
        settings.setVoiceVolume(0.8);

        expect(settings.sfxVolume()).toBe(0.2);
        expect(settings.voiceVolume()).toBe(0.8);
    });

    it('stores the selected voice set and ignores empty keys', () => {
        TestBed.configureTestingModule({});
        const settings = TestBed.inject(GameSettingsService);

        settings.setVoiceSet('set_b');
        expect(settings.voiceSet()).toBe('set_b');

        settings.setVoiceSet('');
        expect(settings.voiceSet()).toBe('set_b');
    });

    it('clamps the match time into the configured limits', () => {
        TestBed.configureTestingModule({});
        const settings = TestBed.inject(GameSettingsService);
        const { minMatchTimeSeconds, maxMatchTimeSeconds } = settings.limits();

        settings.setMatchTimeSeconds(1);
        expect(settings.matchTimeSeconds()).toBe(minMatchTimeSeconds);

        settings.setMatchTimeSeconds(9999);
        expect(settings.matchTimeSeconds()).toBe(maxMatchTimeSeconds);
    });

    it('formats the match time as minutes:seconds', () => {
        TestBed.configureTestingModule({});
        const settings = TestBed.inject(GameSettingsService);

        settings.setMatchTimeSeconds(90);

        expect(settings.matchTimeLabel()).toBe('1:30');
    });
});

describe('parseDuration', () => {
    it('reads clock notation', () => {
        expect(parseDuration('1:30')).toBe(90);
        expect(parseDuration('0:45')).toBe(45);
        expect(parseDuration('2:05')).toBe(125);
    });

    it('reads bare numbers as seconds', () => {
        expect(parseDuration('90')).toBe(90);
        expect(parseDuration(' 45 ')).toBe(45);
    });

    it('reads explicit minute and second suffixes', () => {
        expect(parseDuration('2m')).toBe(120);
        expect(parseDuration('90s')).toBe(90);
        expect(parseDuration('1min')).toBe(60);
    });

    it('rejects text it cannot understand', () => {
        expect(parseDuration('')).toBeNull();
        expect(parseDuration('abc')).toBeNull();
        expect(parseDuration('1:99')).toBeNull();
    });

    it('round-trips through formatDuration', () => {
        for (const seconds of [5, 45, 60, 90, 300]) {
            expect(parseDuration(formatDuration(seconds))).toBe(seconds);
        }
    });
});

describe('GameFlowService', () => {
    function createFlow(): GameFlowService {
        TestBed.configureTestingModule({});
        return TestBed.inject(GameFlowService);
    }

    it('starts on the menu screen', () => {
        const flow = createFlow();

        expect(flow.screen()).toBe('menu');
        expect(flow.isMenu()).toBe(true);
    });

    it('moves through play -> pause -> resume', () => {
        const flow = createFlow();

        flow.startMatch();
        expect(flow.isPlaying()).toBe(true);
        expect(flow.isRunning()).toBe(true);

        flow.pause();
        expect(flow.isPaused()).toBe(true);
        expect(flow.isMatchVisible()).toBe(true);
        // Paused matches must stop simulating but keep rendering.
        expect(flow.isRunning()).toBe(false);

        flow.resume();
        expect(flow.isPlaying()).toBe(true);
    });

    it('ignores pause while on the menu', () => {
        const flow = createFlow();

        flow.pause();

        expect(flow.screen()).toBe('menu');
    });

    it('restart keeps the match on screen and bumps the restart token', () => {
        const flow = createFlow();
        flow.startMatch();
        const before = flow.restartToken();

        flow.restartMatch();

        expect(flow.isPlaying()).toBe(true);
        expect(flow.restartToken()).toBe(before + 1);
    });

    it('stores the result when the match ends', () => {
        const flow = createFlow();
        flow.startMatch();

        flow.endMatch({ score: 42, best: 42, survived: 12, dodges: 3, nearMisses: 1 });

        expect(flow.isGameOver()).toBe(true);
        expect(flow.result().score).toBe(42);
    });

    it('clears the result when abandoning', () => {
        const flow = createFlow();
        flow.startMatch();
        flow.endMatch({ score: 42, best: 42, survived: 12, dodges: 3, nearMisses: 1 });

        flow.abandon();

        expect(flow.isMenu()).toBe(true);
        expect(flow.result().score).toBe(0);
    });

    it('toggles between playing and paused', () => {
        const flow = createFlow();
        flow.startMatch();

        flow.togglePause();
        expect(flow.isPaused()).toBe(true);

        flow.togglePause();
        expect(flow.isPlaying()).toBe(true);
    });
});

describe('LanguageService', () => {
    function createService(): { service: LanguageService; translate: TranslateService } {
        TestBed.configureTestingModule({ providers: provideTestTranslate() });
        const translate = TestBed.inject(TranslateService);
        useTestTranslations(translate);

        return { service: TestBed.inject(LanguageService), translate };
    }

    it('exposes both supported languages', () => {
        const { service } = createService();

        expect(service.options.map((option) => option.code)).toEqual(['en-us', 'pt-br']);
    });

    it('switches the active language', () => {
        const { service, translate } = createService();

        service.use('pt-br');

        expect(service.lang()).toBe('pt-br');
        expect(translate.getCurrentLang()).toBe('pt-br');
    });

    it('ignores unsupported languages', () => {
        const { service } = createService();
        const initial = service.lang();

        service.use('de-de' as never);

        expect(service.lang()).toBe(initial);
    });

    it('cycles languages on toggle', () => {
        const { service } = createService();

        service.use('en-us');
        service.toggle();

        expect(service.lang()).toBe('pt-br');
    });

    it('persists the selection', () => {
        const { service } = createService();
        const setItem = vi.spyOn(Storage.prototype, 'setItem');

        service.use('pt-br');

        expect(setItem).toHaveBeenCalledWith('livrejam.language', 'pt-br');
    });
});
