import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    numberAttribute,
} from '@angular/core';

interface CrackBranch {
    /** SVG path data, in a 100x100 viewBox. */
    path: string;
    /** Stroke width in viewBox units. */
    width: number;
    /** Animation delay, in seconds. */
    delay: number;
    /** Animation duration, in seconds. */
    duration: number;
}

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
 * Jagged cracks radiating from the centre, drawn as SVG so they stay crisp at
 * any size. Each branch animates in on its own delay, which reads as the
 * surface fracturing progressively after an impact.
 */
@Component({
    selector: 'app-crack-overlay',
    templateUrl: './crack-overlay.html',
    styleUrl: './crack-overlay.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrackOverlay {
    /** Number of main branches radiating from the centre. */
    readonly branches = input(7, { transform: numberAttribute });
    /** Seed so a given impact always produces the same fracture. */
    readonly seed = input(1, { transform: numberAttribute });
    /** Delay before the first crack appears, in seconds. */
    readonly delay = input(0, { transform: numberAttribute });

    protected readonly cracks = computed<CrackBranch[]>(() => {
        const random = createRandom(this.seed());
        const count = Math.max(0, this.branches());

        return Array.from({ length: count }, (_, index) => {
            const angle = (index / count) * 360 + (random() - 0.5) * 22;
            const radians = (angle * Math.PI) / 180;
            const length = 26 + random() * 22;

            // Walk outwards in a few segments, jittering sideways so the line
            // looks like a fracture instead of a spoke.
            const segments = 3 + Math.floor(random() * 3);
            let x = 50;
            let y = 50;
            let path = `M ${x.toFixed(2)} ${y.toFixed(2)}`;

            for (let step = 1; step <= segments; step += 1) {
                const progress = step / segments;
                const drift = (random() - 0.5) * 9 * progress;
                const px =
                    50 +
                    Math.cos(radians) * length * progress +
                    Math.cos(radians + Math.PI / 2) * drift;
                const py =
                    50 +
                    Math.sin(radians) * length * progress +
                    Math.sin(radians + Math.PI / 2) * drift;
                path += ` L ${px.toFixed(2)} ${py.toFixed(2)}`;
                x = px;
                y = py;
            }

            return {
                path,
                width: 0.9 + random() * 0.9,
                delay: this.delay() + random() * 0.18,
                duration: 0.3 + random() * 0.25,
            };
        });
    });
}
