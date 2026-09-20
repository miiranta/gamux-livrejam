import { describe, expect, it } from 'vitest';

import type { HandState, TrackingFrame } from '../../engine/tracking';
import { createDungeonLevel } from '../level';
import { SteeringSystem } from './steering-system';

function createLevel() {
    return createDungeonLevel();
}

function centerX(): number {
    const level = createLevel();
    return level.grid.left + level.grid.width / 2;
}

function hand(handedness: HandState['handedness'], y: number): HandState {
    return {
        handedness,
        score: 1,
        landmarks: [],
        worldLandmarks: [],
        center: { x: 0.5, y },
    };
}

function frame(overrides: Partial<TrackingFrame> = {}): TrackingFrame {
    return {
        timestamp: 0,
        face: null,
        hands: [],
        gestures: {
            sixtySeven: { active: false, confidence: 0, level: 0, frequency: 0, alternations: 0 },
            sigma: { active: false, confidence: 0, score: 0 },
            topHand: { active: false, confidence: 0, side: null, margin: 0 },
        },
        ...overrides,
    };
}

function eyeFrame(leftClosed: boolean, rightClosed: boolean): TrackingFrame {
    const eye = (closed: boolean) => ({
        state: closed ? ('closed' as const) : ('open' as const),
        center: { x: 0, y: 0 },
    });

    return frame({
        face: {
            leftEye: eye(leftClosed),
            rightEye: eye(rightClosed),
            mouth: { state: 'closed', openness: 0 },
            scores: {
                leftEyeBlink: 0,
                rightEyeBlink: 0,
                jawOpen: 0,
                browInnerUp: 0,
                browOuterUpLeft: 0,
                browOuterUpRight: 0,
                eyeSquintLeft: 0,
                eyeSquintRight: 0,
                mouthSmileLeft: 0,
                mouthSmileRight: 0,
                mouthPressLeft: 0,
                mouthPressRight: 0,
            },
            landmarks: [],
        },
    });
}

function handFrame(side: 'left' | 'right' | null): TrackingFrame {
    return frame({
        hands: [hand('Left', 0.4), hand('Right', 0.5)],
        gestures: {
            sixtySeven: { active: false, confidence: 0, level: 0, frequency: 0, alternations: 0 },
            sigma: { active: false, confidence: 0, score: 0 },
            topHand: {
                active: side !== null,
                confidence: side ? 1 : 0,
                side,
                margin: side === 'left' ? 0.1 : -0.1,
            },
        },
    });
}

describe('SteeringSystem', () => {
    it('stays neutral until a tracking frame arrives', () => {
        const steering = new SteeringSystem(createLevel());

        expect(steering.intent('67', centerX())).toEqual({ axis: 0, active: false });
        expect(steering.intent('rizz', centerX())).toEqual({ axis: 0, active: false });
    });

    it('steers with the higher hand in 67 mode', () => {
        const steering = new SteeringSystem(createLevel());
        steering.update(handFrame('left'));
        expect(steering.intent('67', centerX()).axis).toBe(-1);

        steering.update(handFrame('right'));
        expect(steering.intent('67', centerX()).axis).toBe(1);
    });

    it('ignores the eyes in 67 mode', () => {
        const steering = new SteeringSystem(createLevel());
        steering.update(eyeFrame(true, false));

        expect(steering.intent('67', centerX()).axis).toBe(0);
    });

    it('steers with a wink in rizz mode', () => {
        const steering = new SteeringSystem(createLevel());
        steering.update(eyeFrame(true, false));
        expect(steering.intent('rizz', centerX()).axis).toBe(-1);

        steering.update(eyeFrame(false, true));
        expect(steering.intent('rizz', centerX()).axis).toBe(1);
    });

    it('ignores the hands in rizz mode', () => {
        const steering = new SteeringSystem(createLevel());
        steering.update(handFrame('left'));

        expect(steering.intent('rizz', centerX()).axis).toBe(0);
    });

    it('drops straight when both eyes are open', () => {
        const steering = new SteeringSystem(createLevel());
        steering.update(eyeFrame(false, false));

        expect(steering.intent('rizz', centerX())).toEqual({ axis: 0, active: false });
    });

    it('drops straight when both eyes are closed', () => {
        const steering = new SteeringSystem(createLevel());
        steering.update(eyeFrame(true, true));

        expect(steering.intent('rizz', centerX())).toEqual({ axis: 0, active: false });
    });

    it('drops straight without a face', () => {
        const steering = new SteeringSystem(createLevel());
        steering.update(frame());

        expect(steering.intent('rizz', centerX())).toEqual({ axis: 0, active: false });
    });

    it('refuses to push the item into the left wall', () => {
        const level = createLevel();
        const steering = new SteeringSystem(level);
        steering.update(handFrame('left'));

        expect(steering.intent('67', level.playLeft).axis).toBe(0);
        expect(steering.intent('67', centerX()).axis).toBe(-1);
    });

    it('refuses to push the item into the right wall', () => {
        const level = createLevel();
        const steering = new SteeringSystem(level);
        steering.update(handFrame('right'));

        expect(steering.intent('67', level.playRight).axis).toBe(0);
        expect(steering.intent('67', centerX()).axis).toBe(1);
    });

    it('forgets the frame on reset', () => {
        const steering = new SteeringSystem(createLevel());
        steering.update(handFrame('left'));
        steering.reset();

        expect(steering.intent('67', centerX())).toEqual({ axis: 0, active: false });
    });
});
