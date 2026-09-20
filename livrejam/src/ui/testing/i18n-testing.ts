import { Provider } from '@angular/core';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

/**
 * Minimal English dictionary for component tests. Deliberately independent
 * from `public/i18n/*.json` so a missing key in the real files still shows up
 * as a broken assertion instead of silently falling back.
 */
export const TEST_EN = {
    app: { title: 'Face Smashing', subtitle: 'LivreJam' },
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
    mode: {
        single: '1 Player',
        two: '2 Players',
    },
    settings: {
        audio: 'Audio',
        music: 'Music',
        sfx: 'Sound effects',
        voice: 'Voice',
        voicePreview: 'Listen to a sample',
        voiceSet: { set_a: 'Normal', set_b: 'Hoarse' },
        match: 'Match',
        matchTime: 'Match time',
        matchTimeHint: 'How long each match lasts.',
    },
    credits: {
        title: 'Credits',
        special: 'Special participation',
        footer: 'Made with love for LivreJam 2026',
        githubLabel: "Open {{handle}}'s GitHub profile",
        roles: {
            lucas: 'AI training, face recognition and controls, level design, and much more',
            angelo: 'Full audio track, UI components and animations, game modes and much more',
            teresa: 'Backing voice on the end-game song',
        },
    },
    language: {
        title: 'Language',
        'en-us': 'English (US)',
        'pt-br': 'Português (BR)',
    },
    fullscreen: { enter: 'Enter fullscreen', exit: 'Exit fullscreen' },
    camera: {
        gate: {
            title: 'Camera needed',
            hint: 'Face Smashing controls the character with your face.',
            retry: 'Check again',
            checking: 'Checking…',
            back: 'Back to menu',
            reason: {
                blocked: 'Camera access is blocked.',
                missing: 'No camera was found on this device.',
                busy: 'The camera is busy in another app or tab.',
                unsupported: 'The camera does not support the settings the game needs.',
                unknown: 'The camera could not be started.',
            },
        },
    },
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
        hintPlayer: 'move the character',
        mode: 'Mode',
        player: 'Player',
        gamepad: 'Gamepad',
        connected: 'connected',
        disconnected: 'none',
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
