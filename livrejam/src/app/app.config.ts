import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';

import { provideTranslate } from '../ui/i18n';

export const appConfig: ApplicationConfig = {
    providers: [provideBrowserGlobalErrorListeners(), ...provideTranslate()],
};
