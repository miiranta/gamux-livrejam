import { describe, expect, it } from 'vitest';

import { FACE_SMASHING, ITEMS } from '../config';
import { DAMAGE_PER_LEVEL, TIER_LAST } from '../damage';
import { Dodger, Item } from '../entities';
import { createDungeonLevel } from '../level';
import { ImpactSystem } from './impact-system';

function buildDodger(feetX = 300): Dodger {
    const level = createDungeonLevel();
    return new Dodger({ feetX, feetY: level.floorTop });
}

function placeItem(dodger: Dodger, gap: number, side = 1, index = 0): Item {
    const definition = ITEMS[index];
    const item = new Item({
        x: dodger.feet.x + side * gap - definition.half.width,
        y: dodger.feet.y - definition.half.height * 2,
        velocityX: 0,
        velocityY: 0,
        definition,
        spin: 0,
        damageRoll: 0.5,
    });

    item.applyCollision({ grounded: true, hitWall: null, hitCeiling: false, layer: 2 });
    return item;
}

function reach(dodger: Dodger, index = 0): number {
    return ITEMS[index].half.width + dodger.size.width / 2;
}

function midDodgeGap(dodger: Dodger, index = 0): number {
    const { dodgeDistance, nearMissDistance } = FACE_SMASHING.impact;
    return reach(dodger, index) + (dodgeDistance + nearMissDistance) / 2;
}

describe('ImpactSystem', () => {
    it('deals damage when an item overlaps the dodger', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();
        const item = placeItem(dodger, 0);

        const outcome = impacts.evaluate([item], dodger);

        expect(outcome.hits).toBe(1);
        expect(outcome.damage).toBeCloseTo(item.damage, 6);
        expect(dodger.damage).toBeCloseTo(item.damage, 6);
    });

    it('does not damage the dodger for a distant item', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();

        expect(impacts.evaluate([placeItem(dodger, 400)], dodger).damage).toBe(0);
        expect(dodger.damage).toBe(0);
    });

    it('reports the tier change when a hit crosses a threshold', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();
        const heavy = ITEMS.length - 1;
        let outcome = impacts.evaluate([placeItem(dodger, 0, 1, heavy)], dodger);

        for (let hit = 0; hit < 40 && outcome.tierChange === 0; hit++) {
            dodger.advanceReaction(FACE_SMASHING.reaction.invulnerableSeconds + 0.01);
            outcome = impacts.evaluate([placeItem(dodger, 0, 1, heavy)], dodger);
        }

        expect(outcome.tierChange).toBeGreaterThan(0);
        expect(dodger.level).toBeGreaterThan(0);
    });

    it('scores a dodge once per item', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();
        const item = placeItem(dodger, midDodgeGap(dodger));

        expect(impacts.evaluate([item], dodger).dodges).toBe(1);
        expect(impacts.evaluate([item], dodger).dodges).toBe(0);
    });

    it('does not score a dodge beyond the dodge radius', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();
        const gap = reach(dodger) + FACE_SMASHING.impact.dodgeDistance + 40;

        expect(impacts.evaluate([placeItem(dodger, gap)], dodger).dodges).toBe(0);
    });

    it('flags a near miss when the landing point is close', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();
        const gap = reach(dodger) + FACE_SMASHING.impact.nearMissDistance / 2;
        const outcome = impacts.evaluate([placeItem(dodger, gap)], dodger);

        expect(outcome.dodges).toBe(1);
        expect(outcome.nearMisses).toBe(1);
    });

    it('does not flag a near miss with a wide margin', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();
        const gap = reach(dodger) + FACE_SMASHING.impact.nearMissDistance + 6;
        const outcome = impacts.evaluate([placeItem(dodger, gap)], dodger);

        expect(outcome.dodges).toBe(1);
        expect(outcome.nearMisses).toBe(0);
    });

    it('counts a dodge on either side of the dodger', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();
        const gap = midDodgeGap(dodger);

        expect(impacts.evaluate([placeItem(dodger, gap, 1)], dodger).dodges).toBe(1);
        expect(impacts.evaluate([placeItem(dodger, gap, -1)], dodger).dodges).toBe(1);
    });

    it('ignores items that are still airborne', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();
        const definition = ITEMS[0];
        const airborne = new Item({
            x: dodger.feet.x + midDodgeGap(dodger) - definition.half.width,
            y: 60,
            velocityX: 0,
            velocityY: 200,
            definition,
            spin: 0,
        });

        const outcome = impacts.evaluate([airborne], dodger);

        expect(outcome.dodges).toBe(0);
        expect(outcome.hits).toBe(0);
    });

    it('stops hurting once the item has settled and is fading out', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();
        const item = placeItem(dodger, 0);

        expect(impacts.evaluate([item], dodger).hits).toBe(1);

        dodger.advanceReaction(FACE_SMASHING.reaction.invulnerableSeconds + 0.01);
        item.state = 'settled';

        const outcome = impacts.evaluate([item], dodger);

        expect(outcome.hits).toBe(0);
        expect(outcome.damage).toBe(0);
    });

    it('forgets scored items after a reset', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();
        const item = placeItem(dodger, midDodgeGap(dodger));

        impacts.evaluate([item], dodger);
        impacts.reset();

        expect(impacts.evaluate([item], dodger).dodges).toBe(1);
    });

    it('never weakens past the last tier', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();
        const heavy = ITEMS.length - 1;

        for (let hit = 0; hit < 200; hit++) {
            dodger.advanceReaction(FACE_SMASHING.reaction.invulnerableSeconds + 0.01);
            impacts.evaluate([placeItem(dodger, 0, 1, heavy)], dodger);
        }

        expect(dodger.level).toBe(TIER_LAST);
        expect(dodger.damage).toBeGreaterThan(DAMAGE_PER_LEVEL * TIER_LAST);
    });

    it('keeps the dodge radius wider than the near miss radius', () => {
        expect(FACE_SMASHING.impact.dodgeDistance).toBeGreaterThan(
            FACE_SMASHING.impact.nearMissDistance,
        );
    });

    it('grants invulnerability right after a hit', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();

        expect(dodger.isInvulnerable).toBe(false);
        impacts.evaluate([placeItem(dodger, 0)], dodger);
        expect(dodger.isInvulnerable).toBe(true);
        expect(dodger.invulnerable).toBeCloseTo(
            FACE_SMASHING.reaction.invulnerableSeconds,
            6,
        );
    });

    it('ignores further hits while invulnerable', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();
        const heavy = ITEMS.length - 1;

        const first = impacts.evaluate([placeItem(dodger, 0, 1, heavy)], dodger);
        const second = impacts.evaluate([placeItem(dodger, 0, 1, heavy)], dodger);

        expect(first.hits).toBe(1);
        expect(second.hits).toBe(0);
        expect(second.damage).toBe(0);
        expect(dodger.damage).toBeCloseTo(first.damage, 6);
    });

    it('accepts damage again once the window expires', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();

        impacts.evaluate([placeItem(dodger, 0)], dodger);
        dodger.advanceReaction(FACE_SMASHING.reaction.invulnerableSeconds + 0.01);

        expect(dodger.isInvulnerable).toBe(false);
        expect(impacts.evaluate([placeItem(dodger, 0)], dodger).hits).toBe(1);
    });

    it('applies knockback away from the impact', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();
        const heavy = ITEMS.length - 1;

        impacts.evaluate([placeItem(dodger, 0, 1, heavy)], dodger);
        dodger.react(1, 200);

        expect(dodger.physics.body.velocity.x).toBeGreaterThan(0);
        expect(dodger.physics.body.velocity.y).toBeLessThan(0);
        expect(dodger.stunned).toBe(true);
    });

    it('caps knockback at the dodger own max speed', () => {
        const impacts = new ImpactSystem();
        const dodger = buildDodger();
        const heavy = ITEMS.length - 1;

        impacts.evaluate([placeItem(dodger, 0, 1, heavy)], dodger);

        expect(Math.abs(dodger.physics.body.velocity.x)).toBeLessThanOrEqual(
            dodger.maxSpeedX + 1e-6,
        );
    });
});
