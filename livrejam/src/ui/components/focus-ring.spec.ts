import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { CreditsPanel } from './credits-panel/credits-panel';
import { FullscreenToggle } from './fullscreen-toggle/fullscreen-toggle';
import { LanguageSelect } from './language-select/language-select';
import { PixelButton } from './pixel-button/pixel-button';
import { PixelSlider } from './pixel-slider/pixel-slider';
import { PixelStepper } from './pixel-stepper/pixel-stepper';
import { SteeringSelect } from './steering-select/steering-select';
import { VoiceSelect } from './voice-select/voice-select';
import { provideTestTranslate, useTestTranslations } from '../testing/i18n-testing';
import { TranslateService } from '@ngx-translate/core';

/**
 * The focus ring must match `:focus`, not only `:focus-visible`.
 *
 * Browsers decide `:focus-visible` from the input modality: it matches after
 * keyboard navigation, but a gamepad moves focus programmatically and the
 * browser never saw a key, so it does not match. A `:focus-visible`-only ring
 * therefore makes controller navigation look like it does nothing.
 *
 * jsdom cannot evaluate `:focus-visible`, so these tests assert on the
 * *compiled* CSS Angular injects into the document: every focus rule that
 * draws a ring has to cover plain `:focus` too.
 */
@Component({
    selector: 'app-focus-probe',
    imports: [
        CreditsPanel,
        FullscreenToggle,
        LanguageSelect,
        PixelButton,
        PixelSlider,
        PixelStepper,
        SteeringSelect,
        VoiceSelect,
    ],
    template: `
        <app-pixel-button>Go</app-pixel-button>
        <app-pixel-slider labelKey="settings.music" [value]="0.5" />
        <app-pixel-stepper labelKey="settings.matchTime" [value]="30" [min]="0" [max]="60" />
        <app-language-select />
        <app-voice-select />
        <app-steering-select />
        <app-credits-panel />
        <app-fullscreen-toggle />
    `,
})
class FocusProbe {}

/** Every CSS rule Angular injected for the probe's components. */
function injectedCss(): string {
    return Array.from(document.querySelectorAll('style'))
        .map((style) => style.textContent ?? '')
        .join('\n');
}

/** Selector lists of the rules that draw a focus ring. */
function focusRingSelectors(css: string): string[] {
    const selectors: string[] = [];

    for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const [, selector, body] = match;
        const drawsRing = body.includes('outline:') || body.includes('box-shadow:');
        if (drawsRing && selector.includes(':focus')) {
            selectors.push(selector.trim());
        }
    }

    return selectors;
}

/**
 * A focus rule is safe when it covers plain `:focus`, either through the
 * shared mixin (`:is(:focus, :focus-visible)`) or an explicit pair.
 */
function coversPlainFocus(selector: string): boolean {
    return selector
        .split(',')
        .some((part) => /:focus(?!-visible)/.test(part) || part.includes(':is(:focus'));
}

describe('focus rings', () => {
    it('draws every focus ring for plain :focus as well as :focus-visible', async () => {
        await TestBed.configureTestingModule({
            imports: [FocusProbe],
            providers: provideTestTranslate(),
        }).compileComponents();
        useTestTranslations(TestBed.inject(TranslateService));

        const fixture = TestBed.createComponent(FocusProbe);
        fixture.detectChanges();

        const selectors = focusRingSelectors(injectedCss());
        expect(selectors.length).toBeGreaterThan(0);

        const offenders = selectors.filter(
            (selector) => selector.includes(':focus-visible') && !coversPlainFocus(selector),
        );

        expect(
            offenders,
            'these rules only match :focus-visible, so a gamepad focus ring is invisible',
        ).toEqual([]);
    });

    it('also covers the ring the shared mixin emits', async () => {
        await TestBed.configureTestingModule({
            imports: [FocusProbe],
            providers: provideTestTranslate(),
        }).compileComponents();
        useTestTranslations(TestBed.inject(TranslateService));

        TestBed.createComponent(FocusProbe).detectChanges();
        const css = injectedCss();

        expect(css).toContain(':is(:focus, :focus-visible)');
    });
});
