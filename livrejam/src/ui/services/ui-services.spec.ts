import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_VOICE_SET } from '../../game/audio';
import { useReadyCamera } from '../testing/camera-testing';
import { CameraStatusService, cameraFailureReason } from './camera-status.service';
import { DebugModeService } from './debug-mode.service';
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
        const camera = useReadyCamera();
        expect(camera.isReady()).toBe(true);

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

    it('refuses to start a match when the camera is blocked', () => {
        TestBed.configureTestingModule({});
        const camera = TestBed.inject(CameraStatusService);
        camera.markBlocked('blocked', 'denied');
        const flow = TestBed.inject(GameFlowService);

        flow.startMatch();

        expect(flow.isPlaying()).toBe(false);
        expect(flow.isMenu()).toBe(true);
        expect(flow.cameraGate()).toBe(true);
    });

    it('starts the match once the camera becomes ready', () => {
        TestBed.configureTestingModule({});
        const camera = TestBed.inject(CameraStatusService);
        const flow = TestBed.inject(GameFlowService);

        flow.startMatch();
        expect(flow.isPlaying()).toBe(false);
        expect(flow.cameraGate()).toBe(false);

        camera.markReady();
        TestBed.tick();

        expect(flow.isPlaying()).toBe(true);
    });

    it('shows the gate instead of starting when the camera fails while warming up', () => {
        TestBed.configureTestingModule({});
        const camera = TestBed.inject(CameraStatusService);
        const flow = TestBed.inject(GameFlowService);

        camera.markStarting();
        flow.startMatch();
        expect(flow.isPlaying()).toBe(false);

        camera.markBlocked('busy', 'busy');
        TestBed.tick();

        expect(flow.cameraGate()).toBe(true);
        expect(flow.isPlaying()).toBe(false);
    });

    it('closes the gate and returns to the menu when the camera recovers', () => {
        TestBed.configureTestingModule({});
        const camera = TestBed.inject(CameraStatusService);
        camera.markBlocked('blocked', 'denied');
        const flow = TestBed.inject(GameFlowService);
        flow.startMatch();
        expect(flow.cameraGate()).toBe(true);

        camera.markStarting();
        expect(flow.cameraGate()).toBe(true);

        camera.markReady();
        TestBed.tick();

        expect(flow.cameraGate()).toBe(false);
        expect(flow.isMenu()).toBe(true);
    });

    it('starts a match on the next Play once the camera recovered', () => {
        TestBed.configureTestingModule({});
        const camera = TestBed.inject(CameraStatusService);
        camera.markBlocked('blocked', 'denied');
        const flow = TestBed.inject(GameFlowService);
        flow.startMatch();
        camera.markReady();
        TestBed.tick();

        flow.startMatch();

        expect(flow.cameraGate()).toBe(false);
        expect(flow.isPlaying()).toBe(true);
    });

    it('closes the gate when the player goes back to the menu', () => {
        TestBed.configureTestingModule({});
        const camera = TestBed.inject(CameraStatusService);
        camera.markBlocked('missing', 'no device');
        const flow = TestBed.inject(GameFlowService);
        flow.startMatch();

        flow.abandon();

        expect(flow.cameraGate()).toBe(false);
        expect(flow.isMenu()).toBe(true);
    });

    it('skips the camera gate in debug mode', () => {
        TestBed.configureTestingModule({});
        const camera = TestBed.inject(CameraStatusService);
        camera.markBlocked('blocked', 'denied');
        TestBed.inject(DebugModeService).toggle();
        const flow = TestBed.inject(GameFlowService);

        flow.startMatch();

        expect(flow.cameraGate()).toBe(false);
        expect(flow.isPlaying()).toBe(true);
    });

    it('starts a match straight away in debug mode, before the camera is ready', () => {
        TestBed.configureTestingModule({});
        TestBed.inject(DebugModeService).toggle();
        const flow = TestBed.inject(GameFlowService);

        flow.startMatch();

        expect(flow.cameraGate()).toBe(false);
        expect(flow.isPlaying()).toBe(true);
    });

    it('opens the match when debug mode is switched on while the gate is open', () => {
        TestBed.configureTestingModule({});
        const camera = TestBed.inject(CameraStatusService);
        camera.markBlocked('blocked', 'denied');
        const flow = TestBed.inject(GameFlowService);
        flow.startMatch();
        expect(flow.cameraGate()).toBe(true);

        TestBed.inject(DebugModeService).toggle();
        TestBed.tick();

        expect(flow.cameraGate()).toBe(false);
        expect(flow.isPlaying()).toBe(true);
    });
});

describe('CameraStatusService', () => {
    function createService(): CameraStatusService {
        TestBed.configureTestingModule({});
        return TestBed.inject(CameraStatusService);
    }

    it('starts idle and neither ready nor blocked', () => {
        const camera = createService();

        expect(camera.status()).toBe('idle');
        expect(camera.isReady()).toBe(false);
        expect(camera.isBlocked()).toBe(false);
    });

    it('maps DOMException names to failure reasons', () => {
        const camera = createService();

        camera.markBlocked('busy', 'busy');

        expect(camera.reason()).toBe('busy');
        expect(camera.failure()?.detail).toBe('busy');
    });

    it('clears the failure once the camera is ready', () => {
        const camera = createService();
        camera.markBlocked('blocked', 'denied');

        camera.markReady();

        expect(camera.failure()).toBeNull();
        expect(camera.isReady()).toBe(true);
    });

    it('reports a new starting attempt before the retry token moves', () => {
        const camera = createService();
        camera.markBlocked('blocked', 'denied');
        const before = camera.retryToken();

        camera.requestRetry();

        expect(camera.retryToken()).toBe(before + 1);
        expect(camera.status()).toBe('blocked');

        camera.markStarting();

        expect(camera.status()).toBe('starting');
        expect(camera.failure()).toBeNull();
    });
});

describe('cameraFailureReason', () => {
    it('maps the errors browsers raise for camera access', () => {
        expect(cameraFailureReason(new DOMException('', 'NotAllowedError'))).toBe('blocked');
        expect(cameraFailureReason(new DOMException('', 'SecurityError'))).toBe('blocked');
        expect(cameraFailureReason(new DOMException('', 'NotFoundError'))).toBe('missing');
        expect(cameraFailureReason(new DOMException('', 'NotReadableError'))).toBe('busy');
        expect(cameraFailureReason(new DOMException('', 'AbortError'))).toBe('busy');
        expect(cameraFailureReason(new DOMException('', 'OverconstrainedError'))).toBe(
            'unsupported',
        );
    });

    it('falls back to unknown for anything else', () => {
        expect(cameraFailureReason(new Error('nope'))).toBe('unknown');
        expect(cameraFailureReason(undefined)).toBe('unknown');
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

describe('DebugModeService', () => {
    function createService(): DebugModeService {
        TestBed.configureTestingModule({});
        return TestBed.inject(DebugModeService);
    }

    it('is disabled by default', () => {
        expect(createService().isEnabled()).toBe(false);
    });

    it('toggles when the L key is pressed', () => {
        const service = createService();

        pressKey('l');
        expect(service.isEnabled()).toBe(true);

        pressKey('L');
        expect(service.isEnabled()).toBe(false);
    });

    it('ignores other keys and key repeats', () => {
        const service = createService();

        pressKey('k');
        pressKey('l', { repeat: true });
        expect(service.isEnabled()).toBe(false);
    });

    it('toggles from anywhere, including inside an element', () => {
        const service = createService();
        const button = attachElement(document.createElement('button'));

        button.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', bubbles: true }));

        expect(service.isEnabled()).toBe(true);
    });

    it('ignores the key while typing in a text field', () => {
        const service = createService();
        const input = attachElement(document.createElement('input'));

        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', bubbles: true }));

        expect(service.isEnabled()).toBe(false);
    });

    it('stops listening once destroyed', () => {
        TestBed.configureTestingModule({});
        TestBed.inject(DebugModeService);

        TestBed.resetTestingModule();
        pressKey('l');

        expect(TestBed.inject(DebugModeService).isEnabled()).toBe(false);
    });
});

function pressKey(key: string, options: KeyboardEventInit = {}): void {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, ...options }));
}

function attachElement<T extends HTMLElement>(element: T): T {
    document.body.append(element);
    return element;
}
