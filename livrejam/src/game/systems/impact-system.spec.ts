import { describe, expect, it } from 'vitest';

import { FACE_SMASHING } from '../config';
import { Dodger, Faller } from '../entities';
import { createDungeonLevel } from '../level';
import { ImpactSystem } from './impact-system';

const FALLER_SIZE = FACE_SMASHING.impact.fallerHalfWidth * 2;
const CONTACT_GAP = FACE_SMASHING.impact.fallerHalfWidth + FACE_SMASHING.impact.dodgerHalfWidth;

function buildDodger(feetX = 300): Dodger {
    const level = createDungeonLevel();
    return new Dodger({ feetX, feetY: level.floorTop, maxSpeedX: 200 });
}

function landAtGap(dodger: Dodger, gap: number, side = 1): Faller {
    const faller = new Faller({
        x: dodger.feet.x + side * gap - FALLER_SIZE / 2,
        y: 320,
        velocityX: 0,
        velocityY: 0,
        sprite: 'smallCrate',
        size: FALLER_SIZE,
    });

    faller.applyCollision({ grounded: true, hitWall: null, hitCeiling: false, layer: 2 });
    return faller;
}

describe('ImpactSystem', () => {
    it('reports a hit when the faller overlaps the dodger', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();

        expect(impacts.evaluate([landAtGap(dodger, 0)], dodger).hit).toBe(true);
    });

    it('does not report a hit for a faller far from the dodger', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();

        expect(impacts.evaluate([landAtGap(dodger, 300)], dodger).hit).toBe(false);
    });

    it('does not score a dodge beyond the dodge radius', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();
        const far = CONTACT_GAP + FACE_SMASHING.score.dodgeDistance + 40;

        const outcome = impacts.evaluate([landAtGap(dodger, far)], dodger);

        expect(outcome.hit).toBe(false);
        expect(outcome.dodges).toBe(0);
    });

    it('scores a dodge once per faller', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();
        const faller = landAtGap(dodger, CONTACT_GAP + 10);

        expect(impacts.evaluate([faller], dodger).dodges).toBe(1);
        expect(impacts.evaluate([faller], dodger).dodges).toBe(0);
    });

    it('flags a near miss when the landing point is close', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();
        const faller = landAtGap(dodger, CONTACT_GAP + 2);

        const outcome = impacts.evaluate([faller], dodger);

        expect(outcome.dodges).toBe(1);
        expect(outcome.nearMisses).toBe(1);
    });

    it('does not flag a near miss for a wide margin', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();
        const gap = CONTACT_GAP + FACE_SMASHING.impact.nearMissDistance + 6;

        const outcome = impacts.evaluate([landAtGap(dodger, gap)], dodger);

        expect(outcome.dodges).toBe(1);
        expect(outcome.nearMisses).toBe(0);
    });

    it('counts a dodge on either side of the dodger', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();
        const gap = CONTACT_GAP + 6;

        expect(impacts.evaluate([landAtGap(dodger, gap, 1)], dodger).dodges).toBe(1);
        expect(impacts.evaluate([landAtGap(dodger, gap, -1)], dodger).dodges).toBe(1);
    });

    it('ignores fallers that are still airborne', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();
        const airborne = new Faller({
            x: dodger.feet.x + CONTACT_GAP + 10 - FALLER_SIZE / 2,
            y: 100,
            velocityX: 0,
            velocityY: 200,
            sprite: 'smallCrate',
            size: FALLER_SIZE,
        });

        const outcome = impacts.evaluate([airborne], dodger);

        expect(outcome.dodges).toBe(0);
        expect(outcome.hit).toBe(false);
    });

    it('forgets scored fallers after a reset', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();
        const faller = landAtGap(dodger, CONTACT_GAP + 10);

        impacts.evaluate([faller], dodger);
        impacts.reset();

        expect(impacts.evaluate([faller], dodger).dodges).toBe(1);
    });

    it('keeps the dodge radius wider than the near miss radius', () => {
        expect(FACE_SMASHING.score.dodgeDistance).toBeGreaterThan(
            FACE_SMASHING.impact.nearMissDistance,
        );
    });
});
