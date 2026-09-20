import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PixelButton } from '../components/pixel-button/pixel-button';
import { PixelSlider } from '../components/pixel-slider/pixel-slider';
import { PixelStepper } from '../components/pixel-stepper/pixel-stepper';
import { provideTestTranslate, useTestTranslations } from '../testing/i18n-testing';
import { useReadyCamera } from '../testing/camera-testing';
import { AudioService, GameFlowService, GameSettingsService, SOUND_EFFECTS } from '../services';
import { EndGame } from './end-game/end-game';
import { MainMenu } from './main-menu/main-menu';
import { PauseMenu } from './pause-menu/pause-menu';

@Component({
    template: `
        <app-pixel-button (pressed)="presses = presses + 1">Go</app-pixel-button>
        <app-pixel-button
            variant="danger"
            [disabled]="disabled()"
            (pressed)="presses = presses + 1"
        >
            Stop
        </app-pixel-button>
    `,
    imports: [PixelButton],
})
class ButtonHost {
    presses = 0;
    readonly disabled = signal(false);
}

@Component({
    template: `<app-pixel-stepper
        labelKey="settings.matchTime"
        [value]="value()"
        [min]="30"
        [max]="60"
        [step]="15"
        (valueChange)="value.set($event)"
    />`,
    imports: [PixelStepper],
})
class StepperHost {
    readonly value = signal(30);
}

@Component({
    template: `<app-pixel-slider
        labelKey="settings.music"
        [value]="value()"
        (valueChange)="value.set($event)"
    />`,
    imports: [PixelSlider],
})
class SliderHost {
    readonly value = signal(0.5);
}
function text(fixture: ComponentFixture<unknown>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('PixelButton', () => {
    let fixture: ComponentFixture<ButtonHost>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [ButtonHost] }).compileComponents();
        fixture = TestBed.createComponent(ButtonHost);
        fixture.detectChanges();
    });

    it('emits `pressed` when clicked', () => {
        const button = (fixture.nativeElement as HTMLElement).querySelector('button');

        button?.click();
        fixture.detectChanges();

        expect(fixture.componentInstance.presses).toBe(1);
    });

    it('does not emit while disabled', () => {
        fixture.componentInstance.disabled.set(true);
        fixture.detectChanges();

        const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
        buttons[1]?.click();
        fixture.detectChanges();

        expect(fixture.componentInstance.presses).toBe(0);
    });
});

describe('PixelStepper', () => {
    let fixture: ComponentFixture<StepperHost>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [StepperHost],
            providers: provideTestTranslate(),
        }).compileComponents();
        useTestTranslations(TestBed.inject(TranslateService));

        fixture = TestBed.createComponent(StepperHost);
        fixture.detectChanges();
    });

    it('shows the translated label', () => {
        expect(text(fixture)).toContain('Match time');
    });

    it('steps up to the maximum and stops there', () => {
        const [, plus] = (fixture.nativeElement as HTMLElement).querySelectorAll('button');

        plus?.click();
        fixture.detectChanges();
        expect(fixture.componentInstance.value()).toBe(45);

        plus?.click();
        fixture.detectChanges();
        expect(fixture.componentInstance.value()).toBe(60);

        // Already at max: the control must be disabled and not emit again.
        plus?.click();
        fixture.detectChanges();
        expect(fixture.componentInstance.value()).toBe(60);
    });

    it('steps down to the minimum and stops there', () => {
        const [minus] = (fixture.nativeElement as HTMLElement).querySelectorAll('button');

        minus?.click();
        fixture.detectChanges();

        expect(fixture.componentInstance.value()).toBe(30);
        expect((minus as HTMLButtonElement).disabled).toBe(true);
    });

    it('shows the step size, not the current value', () => {
        const head = (fixture.nativeElement as HTMLElement).querySelector('.pixel-stepper__value');

        expect(head?.textContent?.trim()).toBe('+15');
    });

    it('accepts a typed value and clamps it to the range', () => {
        const readout = (fixture.nativeElement as HTMLElement).querySelector(
            '.pixel-stepper__readout',
        ) as HTMLInputElement;

        readout.value = '50';
        readout.dispatchEvent(new Event('input'));
        readout.dispatchEvent(new Event('blur'));
        fixture.detectChanges();

        expect(fixture.componentInstance.value()).toBe(50);
    });

    it('ignores unparseable text and restores the display', () => {
        const readout = (fixture.nativeElement as HTMLElement).querySelector(
            '.pixel-stepper__readout',
        ) as HTMLInputElement;

        readout.value = 'nonsense';
        readout.dispatchEvent(new Event('input'));
        readout.dispatchEvent(new Event('blur'));
        fixture.detectChanges();

        expect(fixture.componentInstance.value()).toBe(30);
        expect(readout.value).toBe('30');
    });
});

describe('PixelSlider', () => {
    it('emits the new value when the range input changes', async () => {
        await TestBed.configureTestingModule({
            imports: [SliderHost],
            providers: provideTestTranslate(),
        }).compileComponents();
        useTestTranslations(TestBed.inject(TranslateService));

        const fixture = TestBed.createComponent(SliderHost);
        fixture.detectChanges();

        const input = (fixture.nativeElement as HTMLElement).querySelector(
            'input',
        ) as HTMLInputElement;
        input.value = '0.25';
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();

        expect(fixture.componentInstance.value()).toBe(0.25);
        expect(text(fixture)).toContain('25%');
    });
});

describe('MainMenu', () => {
    let fixture: ComponentFixture<MainMenu>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [MainMenu],
            providers: provideTestTranslate(),
        }).compileComponents();
        useTestTranslations(TestBed.inject(TranslateService));

        useReadyCamera();

        fixture = TestBed.createComponent(MainMenu);
        fixture.detectChanges();
    });

    it('offers one button per game mode instead of a generic Play', () => {
        const labels = buttonLabels(fixture);

        expect(labels).toContain('1 Player');
        expect(labels).toContain('2 Players');
        // A bare "Play" would not say who controls the character.
        expect(labels).not.toContain('Play');
        expect(labels).toContain('Configuration');
        expect(labels).toContain('Credits');
        expect(labels).toContain('Language');
    });

    it('renders the fullscreen toggle in the top-right', () => {
        const toggle = (fixture.nativeElement as HTMLElement).querySelector(
            'app-fullscreen-toggle',
        );

        expect(toggle).not.toBeNull();
    });

    it('does not offer Restart/Abandon', () => {
        expect(text(fixture)).not.toContain('Restart');
        expect(text(fixture)).not.toContain('Abandon');
    });

    it('starts a 1-player match from the first mode button', () => {
        const flow = TestBed.inject(GameFlowService);
        const settings = TestBed.inject(GameSettingsService);

        clickButton(fixture, '1 Player');

        expect(flow.isPlaying()).toBe(true);
        expect(settings.gameMode()).toBe('single');
    });

    it('starts a 2-player match from the second mode button', () => {
        const flow = TestBed.inject(GameFlowService);
        const settings = TestBed.inject(GameSettingsService);

        clickButton(fixture, '2 Players');

        expect(flow.isPlaying()).toBe(true);
        expect(settings.gameMode()).toBe('two');
    });

    it('opens the configuration panel with every audio slider and the match time', () => {
        clickButton(fixture, 'Configuration');

        const content = text(fixture);
        expect(content).toContain('Music');
        expect(content).toContain('Sound effects');
        expect(content).toContain('Voice');
        expect(content).toContain('Match time');
        expect(content).toContain('Back');
    });

    it('does not offer the game mode in the configuration panel', () => {
        clickButton(fixture, 'Configuration');

        const content = text(fixture);
        expect(content).not.toContain('1 Player');
        expect(content).not.toContain('2 Players');
    });

    it('opens the credits panel with both authors and the guest', () => {
        clickButton(fixture, 'Credits');

        const content = text(fixture);
        expect(content).toContain('Lucas Miranda');
        expect(content).toContain('Ângelo Pilotto');
        expect(content).toContain('Special participation');
        expect(content).toContain('Teresa Pilotto');
        expect(content).toContain('Backing voice on the end-game song');
    });

    it('links each author to GitHub by handle, opening in a new tab', () => {
        clickButton(fixture, 'Credits');

        const links = Array.from(
            (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>(
                '.credits__github',
            ),
        );

        expect(links.map((link) => link.textContent?.trim())).toEqual(['miiranta', 'angelopra']);
        expect(links.map((link) => link.href)).toEqual([
            'https://github.com/miiranta',
            'https://github.com/angelopra',
        ]);

        for (const link of links) {
            expect(link.target).toBe('_blank');
            // `noopener` keeps the opened tab from touching this window.
            expect(link.rel).toContain('noopener');
        }
    });

    it('opens the language panel with both languages', () => {
        clickButton(fixture, 'Language');

        const content = text(fixture);
        expect(content).toContain('English (US)');
        expect(content).toContain('Português (BR)');
    });
});

describe('PauseMenu', () => {
    let fixture: ComponentFixture<PauseMenu>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PauseMenu],
            providers: provideTestTranslate(),
        }).compileComponents();
        useTestTranslations(TestBed.inject(TranslateService));

        useReadyCamera();

        const flow = TestBed.inject(GameFlowService);
        flow.startMatch();
        flow.pause();

        fixture = TestBed.createComponent(PauseMenu);
        fixture.detectChanges();
    });

    it('offers Resume, Restart and Abandon', () => {
        const content = text(fixture);

        expect(content).toContain('Resume');
        expect(content).toContain('Restart');
        expect(content).toContain('Abandon');
    });

    it('does not offer Play', () => {
        expect(text(fixture)).not.toContain('Play');
    });

    it('hides the match-time setting but keeps the audio sliders', () => {
        clickButton(fixture, 'Configuration');

        const content = text(fixture);
        expect(content).toContain('Music');
        expect(content).toContain('Sound effects');
        expect(content).not.toContain('Match time');
    });

    it('resumes the match', () => {
        clickButton(fixture, 'Resume');

        expect(TestBed.inject(GameFlowService).isPlaying()).toBe(true);
    });

    it('restarts the match', () => {
        const flow = TestBed.inject(GameFlowService);
        const before = flow.restartToken();

        clickButton(fixture, 'Restart');

        expect(flow.isPlaying()).toBe(true);
        expect(flow.restartToken()).toBe(before + 1);
    });

    it('abandons back to the main menu', () => {
        clickButton(fixture, 'Abandon');

        expect(TestBed.inject(GameFlowService).isMenu()).toBe(true);
    });
});

describe('EndGame', () => {
    let fixture: ComponentFixture<EndGame>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [EndGame],
            providers: provideTestTranslate(),
        }).compileComponents();
        useTestTranslations(TestBed.inject(TranslateService));

        useReadyCamera();

        const flow = TestBed.inject(GameFlowService);
        flow.startMatch();
        flow.endMatch({ score: 1234, best: 1234, survived: 90, dodges: 12, nearMisses: 4 });

        fixture = TestBed.createComponent(EndGame);
        fixture.detectChanges();
    });

    it('shows the fixed title and subtitle', () => {
        const content = text(fixture);

        expect(content).toContain("It's over...");
        expect(content).toContain('Não sobra nada');
    });

    it('shows the score', () => {
        expect(text(fixture)).toContain('1234');
    });

    it('offers retry and exit', () => {
        const content = text(fixture);

        expect(content).toContain('Retry');
        expect(content).toContain('Exit');
    });

    it('retries into a fresh match', () => {
        clickButton(fixture, 'Retry');

        const flow = TestBed.inject(GameFlowService);
        expect(flow.isPlaying()).toBe(true);
        expect(flow.result().score).toBe(0);
    });

    it('exits back to the main menu', () => {
        clickButton(fixture, 'Exit');

        expect(TestBed.inject(GameFlowService).isMenu()).toBe(true);
    });

    it('keeps the content inside the shake layer', () => {
        const host = fixture.nativeElement as HTMLElement;
        const shake = host.querySelector('.end-game__shake');

        // The shake layer is absolutely positioned, so it replaces the host as
        // the stack's layout parent. If it stops centering, the whole screen
        // snaps to the top-left corner.
        expect(shake).not.toBeNull();
        expect(shake?.querySelector('.end-game__stack')).not.toBeNull();
        expect(host.querySelector(':scope > .end-game__stack')).toBeNull();
    });

    it('fires two different explosions, one per impact', () => {
        const audio = TestBed.inject(AudioService);
        const sequence = vi.spyOn(audio, 'playSoundEffectSequence').mockReturnValue(true);

        TestBed.createComponent(EndGame).detectChanges();

        expect(sequence).toHaveBeenCalledTimes(1);
        const [name, count, delays] = sequence.mock.calls[0] as [string, number, number[]];
        expect(name).toBe(SOUND_EFFECTS.strongExplosion);
        expect(count).toBe(2);
        // One explosion per card, at the moment each one hits the screen.
        expect(delays).toHaveLength(2);
        expect(delays[0]).toBeLessThan(delays[1]);

        sequence.mockRestore();
    });
});

/** Clicks the first button whose label matches `label`. */
function clickButton(fixture: ComponentFixture<unknown>, label: string): void {
    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));

    const match = buttons.find((button) => (button.textContent ?? '').trim() === label);
    if (!match) {
        throw new Error(
            `No button labelled "${label}". Found: ${buttons.map((b) => b.textContent?.trim()).join(', ')}`,
        );
    }

    match.click();
    fixture.detectChanges();
}

/** Trimmed labels of every button in the fixture. */
function buttonLabels(fixture: ComponentFixture<unknown>): string[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).map(
        (button) => (button.textContent ?? '').trim(),
    );
}
