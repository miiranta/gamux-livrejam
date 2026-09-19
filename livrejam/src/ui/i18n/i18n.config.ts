import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

export const DEFAULT_LANG = 'en-us';
export const FALLBACK_LANG = 'en-us';
export const SUPPORTED_LANGS = ['en-us', 'pt-br'] as const;

export type AppLang = (typeof SUPPORTED_LANGS)[number];

export function isAppLang(value: unknown): value is AppLang {
    return typeof value === 'string' && (SUPPORTED_LANGS as readonly string[]).includes(value);
}

export const LANGUAGE_STORAGE_KEY = 'livrejam.language';

export function detectInitialLang(): AppLang {
    const stored = readStoredLang();
    if (stored) {
        return stored;
    }

    const browser = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : '';
    return browser.startsWith('pt') ? 'pt-br' : DEFAULT_LANG;
}

function readStoredLang(): AppLang | null {
    try {
        const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        return isAppLang(raw) ? raw : null;
    } catch {
        return null;
    }
}

export function persistLang(lang: AppLang): void {
    try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
        // Storage can be unavailable (private mode); language simply won't persist.
    }
}

export function provideTranslate(lang: AppLang = detectInitialLang()) {
    return [
        provideHttpClient(),
        provideTranslateService({
            lang,
            fallbackLang: FALLBACK_LANG,
            loader: provideTranslateHttpLoader({ prefix: 'i18n/', suffix: '.json' }),
        }),
    ];
}
