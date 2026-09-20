import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { GamepadMenu, HoverSound } from '../../directives';
import { WelcomeService } from '../../services';
import { PixelButton } from '../pixel-button/pixel-button';
import { PixelPanel } from '../pixel-panel/pixel-panel';

/** Paragraphs of the introduction, in reading order. */
const INTRO_KEYS: readonly string[] = [
    'welcome.intro.p1',
    'welcome.intro.p2',
    'welcome.intro.p3',
    'welcome.intro.p4',
];

/**
 * Jam achievements, in the order the team wants them read. Each id resolves to
 * a `welcome.achievements.<id>.title` / `.body` pair.
 */
const ACHIEVEMENT_IDS: readonly string[] = [
    'tony',
    'speedruim',
    'kompetitivo',
    'oneUp',
    'youCanPlay',
    'helpOther',
    'oneManBand',
    'altControl',
    'onesAndZeros',
    'libre',
    'libreSquared',
    'libreCubed',
    'joymaxxing',
];

/** Repository behind the "libreSquared" achievement. */
const REPO_URL = 'https://github.com/miiranta/gamux-livrejam';

/**
 * Welcome screen: it introduces the project and lists the jam achievements.
 * It opens on the first visit and from the info button in the menu, and it
 * closes back to whatever screen was underneath.
 */
@Component({
    selector: 'app-welcome-screen',
    imports: [GamepadMenu, HoverSound, PixelButton, PixelPanel, TranslatePipe],
    templateUrl: './welcome-screen.html',
    styleUrl: './welcome-screen.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomeScreen {
    private readonly welcome = inject(WelcomeService);

    protected readonly introKeys = INTRO_KEYS;
    protected readonly achievements = ACHIEVEMENT_IDS;
    protected readonly repoUrl = REPO_URL;

    protected titleKey(id: string): string {
        return `welcome.achievements.${id}.title`;
    }

    protected bodyKey(id: string): string {
        return `welcome.achievements.${id}.body`;
    }

    protected close(): void {
        this.welcome.close();
    }
}
