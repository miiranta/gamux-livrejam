import { describe, expect, it } from 'vitest';

import {
    IDENTITY_FX,
    createFxState,
    decay,
    flashColorOf,
    outlineColorOf,
    shakeOffset,
    springTo,
    waveOffset,
    wobble,
} from './sprite-fx';

describe('createFxState', () => {
    it('starts at the identity transform', () => {
        expect(createFxState()).toEqual(IDENTITY_FX);
    });

    it('returns a fresh object each time', () => {
        const first = createFxState();
        const second = createFxState();

        first.scaleX = 2;

        expect(second.scaleX).toBe(1);
    });
});

describe('decay', () => {
    it('falls linearly and clamps at zero', () => {
        expect(decay(1, 2, 0.25)).toBeCloseTo(0.5, 6);
        expect(decay(0.1, 2, 1)).toBe(0);
    });
});

describe('springTo', () => {
    it('converges on the target without overshooting forever', () => {
        let value = 0;
        let velocity = 0;

        for (let step = 0; step < 600; step++) {
            const next = springTo(value, 1, velocity, 120, 14, 1 / 60);

            value = next.value;
            velocity = next.velocity;
        }

        expect(value).toBeCloseTo(1, 2);
    });

    it('moves toward the target on the first step', () => {
        const next = springTo(0, 1, 0, 120, 14, 1 / 60);

        expect(next.value).toBeGreaterThan(0);
    });
});

describe('wobble', () => {
    it('is zero at phase zero and bounded by the amplitude', () => {
        expect(wobble(3, 2, 0)).toBeCloseTo(0, 6);

        for (let step = 0; step < 100; step++) {
            expect(Math.abs(wobble(3, 2, step / 60))).toBeLessThanOrEqual(3 + 1e-9);
        }
    });
});

describe('waveOffset', () => {
    it('varies along the position axis', () => {
        const head = waveOffset(4, 1, 0.25, 0);
        const tail = waveOffset(4, 1, 0.25, 0.5);

        expect(head).not.toBeCloseTo(tail, 3);
    });
});

describe('shakeOffset', () => {
    it('stays inside the amplitude box', () => {
        for (let step = 0; step < 200; step++) {
            const offset = shakeOffset(5, 30, step / 60, 7);

            expect(Math.abs(offset.x)).toBeLessThanOrEqual(5);
            expect(Math.abs(offset.y)).toBeLessThanOrEqual(5);
        }
    });

    it('is deterministic for the same time and seed', () => {
        expect(shakeOffset(5, 30, 0.5, 7)).toEqual(shakeOffset(5, 30, 0.5, 7));
    });

    it('changes between shake steps', () => {
        expect(shakeOffset(5, 30, 0.5, 7)).not.toEqual(shakeOffset(5, 30, 0.6, 7));
    });
});

describe('flash and outline colours', () => {
    it('are inert at zero strength', () => {
        const state = createFxState();

        expect(flashColorOf(state, {})).toBeNull();
        expect(outlineColorOf(state, {})).toBeNull();
    });

    it('use the configured colour when active', () => {
        const state = createFxState();
        state.flash = 1;
        state.outline = 1;

        expect(flashColorOf(state, { flashColor: '#ff0000' })).toBe('#ff0000');
        expect(outlineColorOf(state, { outlineColor: '#00ff00' })).toBe('#00ff00');
    });
});