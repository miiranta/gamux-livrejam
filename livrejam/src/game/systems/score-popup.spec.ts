import { describe, expect, it } from 'vitest';

import { FACE_SMASHING } from '../config';
import { ScorePopupSystem, hitPoints, scorePopupPose } from './score-popup';

describe('hitPoints', () => {
    it('pays one point per point of damage by default', () => {
        expect(hitPoints(12)).toBe(12);
        expect(hitPoints(4.4)).toBe(4);
    });

    it('always pays at least one point for a hit', () => {
        expect(hitPoints(0.1)).toBe(1);
        expect(hitPoints(0)).toBe(1);
    });
});

describe('scorePopupPose', () => {
    it('starts grown and fully opaque, at the anchor', () => {
        const pose = scorePopupPose(0);

        expect(pose.rise).toBe(0);
        expect(pose.alpha).toBe(1);
        expect(pose.scale).toBe(1);
    });

    it('rises monotonically and stops at the configured height', () => {
        const heights = [0, 0.25, 0.5, 0.75, 1].map((p) => scorePopupPose(p).rise);

        for (let index = 1; index < heights.length; index++) {
            expect(heights[index]).toBeGreaterThanOrEqual(heights[index - 1]);
        }
        expect(heights.at(-1)).toBeCloseTo(FACE_SMASHING.scorePopup.rise, 6);
    });

    it('pops larger than its resting size shortly after spawning', () => {
        expect(scorePopupPose(0.15).scale).toBeGreaterThan(1);
        expect(scorePopupPose(0.6).scale).toBeCloseTo(1, 6);
    });

    it('fades only over the last third', () => {
        expect(scorePopupPose(0.69).alpha).toBe(1);
        expect(scorePopupPose(0.85).alpha).toBeCloseTo(0.5, 5);
        expect(scorePopupPose(1).alpha).toBe(0);
    });
});

describe('ScorePopupSystem', () => {
    it('starts empty', () => {
        expect(new ScorePopupSystem().active).toHaveLength(0);
    });

    it('spawns a popup carrying the awarded points', () => {
        const popups = new ScorePopupSystem();
        popups.spawn(120, 40, 7);

        expect(popups.active).toHaveLength(1);
        expect(popups.active[0]).toMatchObject({ x: 120, y: 40, amount: 7 });
    });

    it('ignores non-positive awards', () => {
        const popups = new ScorePopupSystem();
        popups.spawn(0, 0, 0);
        popups.spawn(0, 0, -3);

        expect(popups.active).toHaveLength(0);
    });

    it('expires a popup once its duration elapses', () => {
        const popups = new ScorePopupSystem();
        popups.spawn(0, 0, 5);

        popups.update(FACE_SMASHING.scorePopup.duration / 2);
        expect(popups.active).toHaveLength(1);

        popups.update(FACE_SMASHING.scorePopup.duration);
        expect(popups.active).toHaveLength(0);
    });

    it('drops the oldest popup when the capacity is exceeded', () => {
        const popups = new ScorePopupSystem();
        const { capacity } = FACE_SMASHING.scorePopup;

        for (let index = 0; index < capacity + 4; index++) {
            popups.spawn(index, 0, index + 1);
        }

        expect(popups.active).toHaveLength(capacity);
        expect(popups.active[0].amount).toBe(5);
    });

    it('clears every popup on reset', () => {
        const popups = new ScorePopupSystem();
        popups.spawn(0, 0, 1);
        popups.clear();

        expect(popups.active).toHaveLength(0);
    });
});