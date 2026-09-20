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
            topHand: { active: false, confidence: 0, value: 0 },
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

function handFrame(value: number, active = true): TrackingFrame {
    return frame({
        hands: [hand('Left', 0.4), hand('Right', 0.5)],
        gestures: {
            sixtySeven: { active: false, confidence: 0, level: 0, frequency: 0, alternations: 0 },
            sigma: { active: false, confidence: 0, score: 0 },
            topHand: { active, confidence: active ? 1 : 0, value },
        },
    });
}

function mouthFrame(open: boolean): TrackingFrame {
    const base = eyeFrame(false, false);
    const face = base.face as NonNullable<TrackingFrame['face']>;

    return {
        ...base,
        face: {
            ...face,
            mouth: { state: open ? 'open' : 'closed', openness: open ? 1 : 0 },
        },
    };
}

describe('SteeringSystem', () => {
    it('stays neutral until a tracking frame arrives', () => {
        const steering = new SteeringSystem(createLevel());

        expect(steering.intent('67', centerX())).toEqual({ axis: 0, active: false });
        expect(steering.intent('rizz', centerX())).toEqual({ axis: 0, active: false });
    });

    it('steers towards the raised hand in 67 mode', () => {
        const steering = new SteeringSystem(createLevel());
        steering.update(handFrame(-1));
        expect(steering.intent('67', centerX()).axis).toBeLessThan(0);

        steering.update(handFrame(1));
        expect(steering.intent('67', centerX()).axis).toBeGreaterThan(0);
    });

    it('scales the direction with how far apart the hands are held', () => {
        const steering = new SteeringSystem(createLevel());
        steering.update(handFrame(-0.4));
        const partial = steering.intent('67', centerX()).axis;

        steering.update(handFrame(-1));
        const full = steering.intent('67', centerX()).axis;

        expect(partial).toBeLessThan(0);
        expect(partial).toBeGreaterThan(-1);
        expect(full).toBe(-1);
        expect(partial).toBeGreaterThan(full);
    });

    it('drops straight while the hands are held level', () => {
        const steering = new SteeringSystem(createLevel());
        steering.update(handFrame(0));

        expect(steering.intent('67', centerX()).axis).toBe(0);
    });

    it('keeps a small raise from flipping the direction', () => {
        const steering = new SteeringSystem(createLevel());

        steering.update(handFrame(-0.05));
        expect(steering.intent('67', centerX()).axis).toBe(0);

        steering.update(handFrame(0.05));
        expect(steering.intent('67', centerX()).axis).toBe(0);
    });

    it('drops straight when the hands are not being tracked', () => {
        const steering = new SteeringSystem(createLevel());
        steering.update(handFrame(-1, false));

        expect(steering.intent('67', centerX())).toEqual({ axis: 0, active: false });
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
        steering.update(handFrame(-1));

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
        steering.update(handFrame(-1));

        expect(steering.intent('67', level.playLeft).axis).toBe(0);
        expect(steering.intent('67', centerX()).axis).toBeLessThan(0);
    });

    it('refuses to push the item into the right wall', () => {
        const level = createLevel();
        const steering = new SteeringSystem(level);
        steering.update(handFrame(1));

        expect(steering.intent('67', level.playRight).axis).toBe(0);
        expect(steering.intent('67', centerX()).axis).toBeGreaterThan(0);
    });

    it('forgets the frame on reset', () => {
        const steering = new SteeringSystem(createLevel());
        steering.update(handFrame(-1));
        steering.reset();

        expect(steering.intent('67', centerX())).toEqual({ axis: 0, active: false });
    });
});

describe('SteeringSystem aim', () => {
    it('is centred without a frame', () => {
        const steering = new SteeringSystem(createLevel());

        expect(steering.aim('67')).toBe(0);
        expect(steering.aim('rizz')).toBe(0);
    });

    it('leans towards the raised hand and stays within -1..1', () => {
        const steering = new SteeringSystem(createLevel());

        steering.update(handFrame(-1));
        expect(steering.aim('67')).toBeLessThan(0);

        steering.update(handFrame(1));
        expect(steering.aim('67')).toBeGreaterThan(0);
    });

    it('points the marker exactly where the item will fly', () => {
        const steering = new SteeringSystem(createLevel());

        for (const value of [-1, -0.6, -0.2, 0, 0.2, 0.6, 1]) {
            steering.update(handFrame(value));
            expect(steering.aim('67')).toBe(steering.intent('67', centerX()).axis);
        }
    });

    it('clamps a value beyond a full swing', () => {
        const steering = new SteeringSystem(createLevel());
        steering.update(handFrame(-5));

        expect(steering.aim('67')).toBe(-1);
    });

    it('swings fully to the winked side in rizz mode', () => {
        const steering = new SteeringSystem(createLevel());

        steering.update(eyeFrame(true, false));
        expect(steering.aim('rizz')).toBe(-1);

        steering.update(eyeFrame(false, true));
        expect(steering.aim('rizz')).toBe(1);
    });

    it('points the marker where a wink steers the item', () => {
        const steering = new SteeringSystem(createLevel());

        steering.update(eyeFrame(true, false));
        expect(steering.aim('rizz')).toBe(steering.intent('rizz', centerX()).axis);

        steering.update(eyeFrame(false, true));
        expect(steering.aim('rizz')).toBe(steering.intent('rizz', centerX()).axis);
    });

    it('is centred when both eyes are open', () => {
        const steering = new SteeringSystem(createLevel());
        steering.update(eyeFrame(false, false));

        expect(steering.aim('rizz')).toBe(0);
    });

    it('never asks for a dash without a tracking frame', () => {
        const steering = new SteeringSystem(createLevel());

        expect(steering.consumeMouthDash()).toBe(false);
    });

    it('asks for a dash once per mouth opening', () => {
        const steering = new SteeringSystem(createLevel());

        steering.update(mouthFrame(true));
        expect(steering.consumeMouthDash()).toBe(true);
        expect(steering.consumeMouthDash()).toBe(false);

        steering.update(mouthFrame(true));
        expect(steering.consumeMouthDash()).toBe(false);

        steering.update(mouthFrame(false));
        expect(steering.consumeMouthDash()).toBe(false);

        steering.update(mouthFrame(true));
        expect(steering.consumeMouthDash()).toBe(true);
    });

    it('forgets a held mouth on reset', () => {
        const steering = new SteeringSystem(createLevel());
        steering.update(mouthFrame(true));

        expect(steering.consumeMouthDash()).toBe(true);

        steering.reset();
        steering.update(mouthFrame(true));

        expect(steering.consumeMouthDash()).toBe(true);
    });
});
