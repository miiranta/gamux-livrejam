import { Provider } from '@angular/core';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

/**
 * Minimal English dictionary for component tests. Deliberately independent
 * from `public/i18n/*.json` so a missing key in the real files still shows up
 * as a broken assertion instead of silently falling back.
 */
export const TEST_EN = {
    app: { title: 'LivreJam', subtitle: 'Dungeon Drop' },
    menu: {
        play: 'Play',
        resume: 'Resume',
        restart: 'Restart',
        abandon: 'Abandon',
        configuration: 'Configuration',
        credits: 'Credits',
        language: 'Language',
        back: 'Back',
    },
    settings: {
        audio: 'Audio',
        music: 'Music',
        sfx: 'Sound effects',
        match: 'Match',
        matchTime: 'Match time',
        matchTimeHint: 'How long each match lasts.',
    },
    credits: { title: 'Credits', empty: 'Nothing here yet.' },
    language: {
        title: 'Language',
        'en-us': 'English (US)',
        'pt-br': 'Português (BR)',
    },
    fullscreen: { enter: 'Enter fullscreen', exit: 'Exit fullscreen' },
    hud: {
        score: 'Score',
        best: 'Best',
        survived: 'Survived',
        dodges: 'Dodges',
        nearMisses: 'Near',
        maxSpeed: 'Max speed',
        dropSpeed: 'Drop',
        ai: 'AI',
        policy: 'policy',
        pause: 'Pause',
        loading: 'Loading the dungeon…',
        hint: 'move',
        state: { idle: 'idle', loading: 'loading', error: 'error' },
        dev: { reloadAi: 'Reload AI' },
    },
    end: {
        title: "It's over...",
        subtitle: 'Não sobra nada',
        score: 'Score',
        retry: 'Retry',
        exit: 'Exit',
    },
} as const;

/** Providers for a translation service that never touches the network. */
export function provideTestTranslate(lang = 'en-us'): Provider[] {
    return provideTranslateService({ lang, fallbackLang: 'en-us' });
}

/** Loads {@link TEST_EN} into the injected service so pipes resolve instantly. */
export function useTestTranslations(translate: TranslateService, lang = 'en-us'): void {
    translate.setTranslation(lang, TEST_EN);
    translate.use(lang).subscribe();
}
