import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { CrackOverlay } from '../../components/crack-overlay/crack-overlay';
import { ParticleBurst } from '../../components/particle-burst/particle-burst';
import { PixelButton } from '../../components/pixel-button/pixel-button';
import { PixelPanel } from '../../components/pixel-panel/pixel-panel';
import { GamepadMenu, HoverSound } from '../../directives';
import { AudioService, GameFlowService, GamepadNavigation, SOUND_EFFECTS } from '../../services';

/**
 * When each element "hits" the screen, in seconds. These mirror the CSS
 * animation delays in `end-game.scss` and the `delay` inputs of the shard
 * bursts, so the explosion lands exactly on the impact.
 */
const TITLE_IMPACT_SECONDS = 0.42;
const SCORE_IMPACT_SECONDS = 0.95;

/**
 * How long the pad's buttons are ignored once the screen opens. The match
 * ends on its own, so the player is usually still hammering the jump button
 * ("A", the same button that confirms here) when the score lands — without
 * this the round restarts before they get to read it.
 */
const PAD_HOLD_SECONDS = SCORE_IMPACT_SECONDS + 0.85;

/**
 * Result screen shown when the match timer runs out. Elements slam in one
 * after another — title, score, then the actions — each impact throwing
 * shards, with the score card cracking the backdrop behind it.
 */
@Component({
    selector: 'app-end-game',
    imports: [
        CrackOverlay,
        GamepadMenu,
        HoverSound,
        ParticleBurst,
        PixelButton,
        PixelPanel,
        TranslatePipe,
    ],
    templateUrl: './end-game.html',
    styleUrl: './end-game.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EndGame {
    private readonly flow = inject(GameFlowService);
    private readonly audio = inject(AudioService);
    private readonly gamepad = inject(GamepadNavigation);

    /** Placeholder scoring — the real formula lands when gameplay is wired. */
    protected readonly score = computed(() => this.flow.result().score);

    constructor() {
        // Two impacts, two different explosion samples, each scheduled on the
        // audio thread so it stays in sync with the animation.
        this.audio.playSoundEffectSequence(SOUND_EFFECTS.strongExplosion, 2, [
            TITLE_IMPACT_SECONDS,
            SCORE_IMPACT_SECONDS,
        ]);

        this.gamepad.holdActions(PAD_HOLD_SECONDS);
    }

    protected retry(): void {
        this.flow.restartMatch();
    }

    protected exit(): void {
        this.flow.abandon();
    }
}
