import { describe, expect, it } from 'vitest';

import { valueNoise, weightedPick } from './noise';

describe('valueNoise', () => {
    it('stays within the unit range', () => {
        for (let column = 0; column < 20; column++) {
            for (let row = 0; row < 20; row++) {
                const noise = valueNoise(column, row);
                expect(noise).toBeGreaterThanOrEqual(0);
                expect(noise).toBeLessThan(1);
            }
        }
    });

    it('is deterministic for the same inputs', () => {
        expect(valueNoise(3, 7)).toBe(valueNoise(3, 7));
        expect(valueNoise(3, 7, 42)).toBe(valueNoise(3, 7, 42));
    });

    it('decorrelates neighbouring cells', () => {
        const samples = new Set<number>();

        for (let column = 0; column < 40; column++) {
            samples.add(valueNoise(column, 2));
        }

        expect(samples.size).toBeGreaterThan(35);
    });

    it('produces different fields for different seeds', () => {
        expect(valueNoise(5, 5, 1)).not.toBe(valueNoise(5, 5, 2));
    });
});

describe('weightedPick', () => {
    it('favours the heavily weighted option', () => {
        const counts = [0, 0, 0];

        for (let step = 0; step < 300; step++) {
            counts[weightedPick(step / 300, [8, 1, 1])]++;
        }

        expect(counts[0]).toBeGreaterThan(counts[1] + counts[2]);
    });

    it('always reaches the last bucket as noise approaches one', () => {
        expect(weightedPick(0.999, [8, 1, 1])).toBe(2);
    });

    it('falls back to the first option without weights', () => {
        expect(weightedPick(0.5, [0, 0])).toBe(0);
    });
});