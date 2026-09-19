import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    numberAttribute,
} from '@angular/core';

interface AmbientParticle {
    /** Horizontal position, in percent. */
    left: number;
    /** Vertical position, in percent. */
    top: number;
    /** Particle edge length, in `em`. */
    size: number;
    /** Animation delay, in seconds. */
    delay: number;
    /** Animation duration, in seconds. */
    duration: number;
    /** Horizontal drift, in `em`. */
    drift: number;
    /** Palette slot, resolved to a colour in CSS. */
    tone: number;
}

const TONES = 3;

/**
 * Fraction of the drift animation where a mote is at full opacity.
 * These mirror the `6%` / `85%` stops in `particle-field.scss` and must be
 * kept in sync with them.
 */
export const MOTE_VISIBLE_FROM = 0.06;
export const MOTE_VISIBLE_TO = 0.85;

/** How far into its cycle a mote may start, as a fraction of its duration. */
const MAX_START_PHASE = 0.8;

function createRandom(seed: number): () => number {
    let state = seed >>> 0 || 1;
    return () => {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return ((state >>> 0) % 100000) / 100000;
    };
}

/**
 * Slow, looping motes drifting upwards behind the menus. Decorative only —
 * `aria-hidden` and non-interactive.
 */
@Component({
    selector: 'app-particle-field',
    templateUrl: './particle-field.html',
    styleUrl: './particle-field.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParticleField {
    /** How many motes to scatter. */
    readonly count = input(34, { transform: numberAttribute });
    /** Seed so the field is stable across renders. */
    readonly seed = input(7, { transform: numberAttribute });

    protected readonly particles = computed<AmbientParticle[]>(() => {
        const random = createRandom(this.seed());
        const count = Math.max(0, this.count());

        return Array.from({ length: count }, () => {
            const duration = 7 + random() * 9;
            const phase = random() * MAX_START_PHASE;

            return {
                left: random() * 100,
                top: random() * 100,
                size: 0.16 + random() * 0.26,
                /*
                 * Negative delay = the mote starts already part-way through
                 * its cycle, so the field is populated on the very first
                 * frame instead of trickling in one mote at a time.
                 */
                delay: -phase * duration,
                duration,
                drift: (random() - 0.5) * 5,
                tone: Math.floor(random() * TONES),
            };
        });
    });
}
