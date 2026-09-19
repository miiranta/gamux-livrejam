import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { type AppLang, isAppLang, persistLang } from '../i18n';

export interface LanguageOption {
    code: AppLang;
    /** Translation key used for the visible label. */
    labelKey: string;
}

/** Selectable languages, in display order. Labels live in the i18n files. */
export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
    { code: 'en-us', labelKey: 'language.en-us' },
    { code: 'pt-br', labelKey: 'language.pt-br' },
];

/**
 * Thin wrapper around ngx-translate: exposes the active language as a signal
 * and remembers the player's choice between sessions.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
    private readonly translate = inject(TranslateService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly current = signal<AppLang>(this.resolveCurrent());

    readonly options = LANGUAGE_OPTIONS;
    readonly lang = this.current.asReadonly();
    /** True while ngx-translate is still fetching the selected language. */
    readonly isLoading = this.translate.isLoading;

    constructor() {
        // Keep the signal in sync when the language changes elsewhere.
        const subscription = this.translate.onLangChange.subscribe((event) => {
            if (isAppLang(event.lang)) {
                this.current.set(event.lang);
            }
        });

        this.destroyRef.onDestroy(() => subscription.unsubscribe());
    }

    use(lang: AppLang): void {
        if (!isAppLang(lang)) {
            return;
        }

        this.current.set(lang);
        persistLang(lang);
        this.translate.use(lang).subscribe();
    }

    toggle(): void {
        const index = LANGUAGE_OPTIONS.findIndex((option) => option.code === this.current());
        const next = LANGUAGE_OPTIONS[(index + 1) % LANGUAGE_OPTIONS.length];
        if (next) {
            this.use(next.code);
        }
    }

    private resolveCurrent(): AppLang {
        const active = this.translate.getCurrentLang();
        return isAppLang(active) ? active : 'en-us';
    }
}
