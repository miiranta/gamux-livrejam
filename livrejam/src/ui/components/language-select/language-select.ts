import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { HoverSound } from '../../directives';
import { LanguageService } from '../../services';
import { type AppLang } from '../../i18n';

/**
 * Radio list of the supported languages. Selecting one calls
 * ngx-translate's `use()` and persists the choice.
 */
@Component({
    selector: 'app-language-select',
    imports: [HoverSound, TranslatePipe],
    templateUrl: './language-select.html',
    styleUrl: './language-select.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageSelect {
    protected readonly language = inject(LanguageService);

    protected select(code: AppLang): void {
        this.language.use(code);
    }
}
