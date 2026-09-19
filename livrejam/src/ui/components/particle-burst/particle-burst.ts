import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    numberAttribute,
} from '@angular/core';

interface BurstParticle {
    /** Angle in degrees, 0 = right, growing clockwise. */
    angle: number;
    /** Distance travelled, in `em` relative to the burst size. */
    distance: number;
    /** Particle edge length, in `em`. */
    size: number;
    /** Animation delay, in seconds. */
    delay: number;
    /** Animation duration, in seconds. */
    duration: number;
    /** Palette slot, resolved to a colour in CSS. */
    tone: number;
}

const TONES = 4;

/**
 * Deterministic pseudo-random generator. Using a seeded generator (instead of
 * `Math.random`) keeps the burst identical between renders and test runs.
 */
function createRandom(seed: number): () => number {
    let state = seed >>> 0 || 1;
    return () => {
        // xorshift32
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return ((state >>> 0) % 100000) / 100000;
    };
}

/**
 * A one-shot burst of pixel shards, meant to be fired the moment a panel
 * "hits" the screen. Purely decorative: it is `aria-hidden` and never
 * intercepts pointer events.
 */
@Component({
    selector: 'app-particle-burst',
    templateUrl: './particle-burst.html',
    styleUrl: './particle-burst.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParticleBurst {
    /** How many shards to throw. */
    readonly count = input(18, { transform: numberAttribute });
    /** Seed so the same burst can be reproduced (and tested). */
    readonly seed = input(1, { transform: numberAttribute });
    /** Delay before the burst starts, in seconds. */
    readonly delay = input(0, { transform: numberAttribute });
    /** Overall size of the burst, in `em`. */
    readonly spread = input(9, { transform: numberAttribute });

    protected readonly particles = computed<BurstParticle[]>(() => {
        const random = createRandom(this.seed());
        const count = Math.max(0, this.count());

        return Array.from({ length: count }, (_, index) => {
            // Spread the shards around the circle, with a little jitter so the
            // ring never looks mechanical.
            const base = (index / count) * 360;
            const angle = base + (random() - 0.5) * (360 / count) * 1.6;

            return {
                angle,
                distance: 0.55 + random() * 0.75,
                size: 0.16 + random() * 0.22,
                delay: this.delay() + random() * 0.06,
                duration: 0.5 + random() * 0.35,
                tone: Math.floor(random() * TONES),
            };
        });
    });

    protected readonly style = computed(() => ({
        '--lj-burst-spread': `${this.spread()}em`,
    }));
}
