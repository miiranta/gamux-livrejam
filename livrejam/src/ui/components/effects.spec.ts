import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { CrackOverlay } from './crack-overlay/crack-overlay';
import { ParticleBurst } from './particle-burst/particle-burst';
import { MOTE_VISIBLE_FROM, MOTE_VISIBLE_TO, ParticleField } from './particle-field/particle-field';

async function render<T>(component: Type<T>): Promise<HTMLElement> {
    await TestBed.configureTestingModule({ imports: [component] }).compileComponents();
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
}

describe('ParticleBurst', () => {
    it('renders one shard per requested particle', async () => {
        const host = await render(ParticleBurst);

        // The default burst is 18 shards.
        expect(host.querySelectorAll('.particle-burst__shard').length).toBe(18);
    });

    it('is decorative only', async () => {
        const host = await render(ParticleBurst);

        expect(host.querySelector('.particle-burst')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('produces the same burst for the same seed', async () => {
        await TestBed.configureTestingModule({ imports: [ParticleBurst] }).compileComponents();

        const anglesFor = (): string[] => {
            const fixture = TestBed.createComponent(ParticleBurst);
            fixture.detectChanges();
            return Array.from(
                (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
                    '.particle-burst__shard',
                ),
            ).map((shard) => shard.style.getPropertyValue('--lj-angle'));
        };

        expect(anglesFor()).toEqual(anglesFor());
    });

    it('scatters the shards around the full circle', async () => {
        const host = await render(ParticleBurst);

        const shards = Array.from(host.querySelectorAll<HTMLElement>('.particle-burst__shard'));
        // Shards must not all point the same way.
        const angles = new Set(shards.map((shard) => shard.style.getPropertyValue('--lj-angle')));

        expect(angles.size).toBeGreaterThan(4);
    });
});

describe('ParticleField', () => {
    it('renders the default number of motes', async () => {
        const host = await render(ParticleField);

        expect(host.querySelectorAll('.particle-field__mote').length).toBe(34);
    });

    it('keeps the motes inside the viewport', async () => {
        const host = await render(ParticleField);

        const motes = Array.from(host.querySelectorAll<HTMLElement>('.particle-field__mote'));
        const positions = motes.map((mote) => mote.style.left);

        for (const left of positions) {
            const value = Number.parseFloat(left);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(100);
        }
    });

    it('is decorative only', async () => {
        const host = await render(ParticleField);

        expect(host.querySelector('.particle-field')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('starts every mote mid-drift, so the field is populated immediately', async () => {
        const host = await render(ParticleField);

        const motes = Array.from(host.querySelectorAll<HTMLElement>('.particle-field__mote'));

        for (const mote of motes) {
            const delay = Number.parseFloat(mote.style.animationDelay);
            const duration = Number.parseFloat(mote.style.animationDuration);

            // A negative delay means the animation begins already in progress.
            expect(delay).toBeLessThanOrEqual(0);
            // ...and never past the point where the mote has faded out again.
            expect(-delay).toBeLessThan(duration * MOTE_VISIBLE_TO);
        }

        // Most motes should be in their visible window from the first frame.
        const visibleAtStart = motes.filter((mote) => {
            const phase =
                -Number.parseFloat(mote.style.animationDelay) /
                Number.parseFloat(mote.style.animationDuration);
            return phase >= MOTE_VISIBLE_FROM && phase <= MOTE_VISIBLE_TO;
        });
        expect(visibleAtStart.length).toBeGreaterThan(20);
    });
});

describe('CrackOverlay', () => {
    it('renders one path per branch', async () => {
        const host = await render(CrackOverlay);

        expect(host.querySelectorAll('.crack-overlay__line').length).toBe(7);
    });

    it('normalises each path length so the draw-on works', async () => {
        const host = await render(CrackOverlay);

        const paths = Array.from(host.querySelectorAll('.crack-overlay__line'));
        for (const path of paths) {
            expect(path.getAttribute('pathLength')).toBe('1');
        }
    });

    it('starts every branch at the centre of the card', async () => {
        const host = await render(CrackOverlay);

        const paths = Array.from(host.querySelectorAll('.crack-overlay__line'));
        for (const path of paths) {
            // All fractures originate from 50,50 in the 100x100 viewBox.
            expect(path.getAttribute('d')?.startsWith('M 50.00 50.00')).toBe(true);
        }
    });

    it('is decorative only', async () => {
        const host = await render(CrackOverlay);

        expect(host.querySelector('.crack-overlay')?.getAttribute('aria-hidden')).toBe('true');
    });
});
