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
    /** Spin applied while flying, in degrees. */
    spin: number;
    /** How far past its own size the shard stretches while flying. */
    stretch: number;
}

const TONES = 4;

/** Ring spacing as a fraction of the full spread. */
const RING_SCALES = [0.55, 0.8, 1];

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
 * A one-shot explosion of pixel debris, meant to be fired the moment a panel
 * "hits" the screen. Shards leave in three staggered rings — a fast, tight
 * core, a mid wave and a slow, wide scatter — which reads as an explosion
 * rather than a single expanding circle.
 *
 * Purely decorative: it is `aria-hidden` and never intercepts pointer events.
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
    /** Long streaks that shoot out ahead of the shards. */
    readonly sparks = input(0, { transform: numberAttribute });

    protected readonly particles = computed<BurstParticle[]>(() => {
        const random = createRandom(this.seed());
        const count = Math.max(0, this.count());

        return Array.from({ length: count }, (_, index) => {
            // Spread the shards around the circle, with a little jitter so the
            // ring never looks mechanical.
            const base = (index / count) * 360;
            const angle = base + (random() - 0.5) * (360 / count) * 1.6;

            // Deal the shards across the rings so every wave gets some.
            const ring = RING_SCALES[index % RING_SCALES.length] ?? 1;
            // Outer rings are slower, which makes the blast feel like it has
            // mass instead of being a single uniform puff.
            const ringDelay = (RING_SCALES.length - 1 - (index % RING_SCALES.length)) * 0.03;

            return {
                angle,
                distance: (0.5 + random() * 0.7) * ring,
                size: 0.16 + random() * 0.26,
                delay: this.delay() + ringDelay + random() * 0.05,
                duration: 0.45 + random() * 0.45,
                tone: Math.floor(random() * TONES),
                spin: (random() - 0.5) * 900,
                stretch: 1 + random() * 1.6,
            };
        });
    });

    protected readonly sparkParticles = computed(() => {
        const random = createRandom(this.seed() + 977);
        const count = Math.max(0, this.sparks());

        return Array.from({ length: count }, (_, index) => {
            const base = (index / count) * 360;
            return {
                angle: base + (random() - 0.5) * 30,
                distance: 0.7 + random() * 0.6,
                delay: this.delay() + random() * 0.04,
                duration: 0.28 + random() * 0.22,
                length: 1.4 + random() * 1.8,
                tone: Math.floor(random() * TONES),
            };
        });
    });

    protected readonly style = computed(() => ({
        '--lj-burst-spread': `${this.spread()}em`,
    }));
}
