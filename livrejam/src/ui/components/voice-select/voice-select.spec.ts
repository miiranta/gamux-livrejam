import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it } from 'vitest';

import { AudioService } from '../../services/audio.service';
import { GameSettingsService } from '../../services/game-settings.service';
import { provideTestTranslate, useTestTranslations } from '../../testing/i18n-testing';
import { VoiceSelect } from './voice-select';

const CATALOG = {
    soundtrack: { roles: [] },
    voices: {
        sets: [
            { key: 'set_a', files: ['assets/audio/voices/set_a/normal-1.ogg'] },
            { key: 'set_b', files: ['assets/audio/voices/set_b/rouco-1.ogg'] },
        ],
    },
    soundEffects: { groups: [] },
};

@Component({
    template: `<app-voice-select />`,
    imports: [VoiceSelect],
})
class VoiceSelectHost {}

function text(fixture: ComponentFixture<unknown>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

function button(fixture: ComponentFixture<unknown>, selector: string): HTMLButtonElement {
    const found = (fixture.nativeElement as HTMLElement).querySelector(selector);
    if (!found) {
        throw new Error(`button not found: ${selector}`);
    }

    return found as HTMLButtonElement;
}

describe('VoiceSelect', () => {
    let fixture: ComponentFixture<VoiceSelectHost>;
    let settings: GameSettingsService;
    let audio: AudioService;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [VoiceSelectHost],
            providers: provideTestTranslate(),
        }).compileComponents();
        useTestTranslations(TestBed.inject(TranslateService));

        settings = TestBed.inject(GameSettingsService);
        settings.setVoiceSet('set_a');

        audio = TestBed.inject(AudioService);
        audio.useCatalog(CATALOG);

        fixture = TestBed.createComponent(VoiceSelectHost);
        fixture.detectChanges();
    });

    it('starts collapsed, showing only the current voice', () => {
        const content = text(fixture);

        expect(content).toContain('Voice');
        expect(content).toContain('Normal');
        expect(content).not.toContain('Hoarse');
        expect(button(fixture, '.voice-select__head').getAttribute('aria-expanded')).toBe('false');
    });

    it('lists every voice set once expanded', () => {
        button(fixture, '.voice-select__head').click();
        fixture.detectChanges();

        const content = text(fixture);
        expect(content).toContain('Normal');
        expect(content).toContain('Hoarse');
        expect(button(fixture, '.voice-select__head').getAttribute('aria-expanded')).toBe('true');
    });

    it('collapses again on a second press', () => {
        button(fixture, '.voice-select__head').click();
        fixture.detectChanges();
        button(fixture, '.voice-select__head').click();
        fixture.detectChanges();

        expect(text(fixture)).not.toContain('Hoarse');
    });

    it('stores the chosen voice set', () => {
        button(fixture, '.voice-select__head').click();
        fixture.detectChanges();

        const picks = (fixture.nativeElement as HTMLElement).querySelectorAll(
            '.voice-select__pick',
        );
        (picks[1] as HTMLButtonElement).click();
        fixture.detectChanges();

        expect(settings.voiceSet()).toBe('set_b');
    });

    it('offers one play button per option, to preview the voice', () => {
        button(fixture, '.voice-select__head').click();
        fixture.detectChanges();

        const plays = (fixture.nativeElement as HTMLElement).querySelectorAll(
            '.voice-select__play',
        );
        expect(plays).toHaveLength(2);

        // Previewing must not change the selection.
        (plays[1] as HTMLButtonElement).click();
        fixture.detectChanges();

        expect(settings.voiceSet()).toBe('set_a');
    });

    it('renders a play glyph inside each preview button', () => {
        button(fixture, '.voice-select__head').click();
        fixture.detectChanges();

        const glyph = (fixture.nativeElement as HTMLElement).querySelector(
            '.voice-select__play-glyph',
        );
        expect(glyph).not.toBeNull();
    });
});
