import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { HoverSound } from '../../directives';

/** Public GitHub profile linked from the credits. */
export interface GithubProfile {
    /** Handle shown in the UI — never the full URL. */
    readonly handle: string;
    /** Absolute profile URL, opened in a new tab. */
    readonly url: string;
}

/** One person credited on the game. */
export interface CreditEntry {
    /** Proper noun: names are never translated. */
    readonly name: string;
    /** Translation key describing what the person worked on. */
    readonly roleKey: string;
    /** Optional profile, rendered as a small link beside the name. */
    readonly github?: GithubProfile;
}

/** The two authors, in the order they appear on the card. */
export const CREDITS: readonly CreditEntry[] = [
    {
        name: 'Lucas Miranda',
        roleKey: 'credits.roles.lucas',
        github: { handle: 'miiranta', url: 'https://github.com/miiranta' },
    },
    {
        name: 'Ângelo Pilotto',
        roleKey: 'credits.roles.angelo',
        github: { handle: 'angelopra', url: 'https://github.com/angelopra' },
    },
];

/** Guests who lent a hand (or a voice) to the project. */
export const SPECIAL_CREDITS: readonly CreditEntry[] = [
    { name: 'Teresa Pilotto', roleKey: 'credits.roles.teresa' },
];

/**
 * Credits card shown inside the menu panel. Names are proper nouns and stay
 * literal; only the role descriptions come from the translation files.
 */
@Component({
    selector: 'app-credits-panel',
    imports: [HoverSound, TranslatePipe],
    templateUrl: './credits-panel.html',
    styleUrl: './credits-panel.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreditsPanel {
    protected readonly credits = CREDITS;
    protected readonly special = SPECIAL_CREDITS;

    /** First letters of the name, shown inside the pixel avatar chip. */
    protected initials(name: string): string {
        return name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join('');
    }
}
