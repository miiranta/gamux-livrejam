import type { Point3D } from '../../math';
import { HAND_LANDMARK } from '../landmarks';
import type { HandState } from '../types';
import { SigmaStream, type SigmaStreamInput } from './sigma-stream';

const MOUTH = { x: 0.5, y: 0.55 };
const LANDMARK_COUNT = 21;

function points(): Point3D[] {
    return Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0.5, y: 0.8, z: 0 }));
}

function set(list: Point3D[], index: number, x: number, y: number): void {
    list[index] = { x, y, z: 0 };
}

function shhHand(): HandState {
    const list = points();
    set(list, HAND_LANDMARK.wrist, 0.5, 0.8);
    set(list, HAND_LANDMARK.middleMcp, 0.5, 0.7);
    set(list, HAND_LANDMARK.indexMcp, 0.5, 0.68);
    set(list, HAND_LANDMARK.indexPip, 0.5, 0.65);
    set(list, HAND_LANDMARK.indexTip, MOUTH.x, MOUTH.y);
    set(list, HAND_LANDMARK.middlePip, 0.5, 0.66);
    set(list, HAND_LANDMARK.middleTip, 0.5, 0.72);
    set(list, HAND_LANDMARK.ringPip, 0.55, 0.66);
    set(list, HAND_LANDMARK.ringTip, 0.55, 0.72);
    set(list, HAND_LANDMARK.pinkyPip, 0.6, 0.66);
    set(list, HAND_LANDMARK.pinkyTip, 0.6, 0.72);

    return {
        handedness: 'Left',
        score: 1,
        landmarks: list,
        worldLandmarks: [],
        center: { x: 0.5, y: 0.75 },
    };
}

function openHand(): HandState {
    const list = points();
    set(list, HAND_LANDMARK.wrist, 0.5, 0.8);
    set(list, HAND_LANDMARK.middleMcp, 0.5, 0.7);
    set(list, HAND_LANDMARK.indexMcp, 0.5, 0.68);
    set(list, HAND_LANDMARK.indexPip, 0.5, 0.63);
    set(list, HAND_LANDMARK.indexTip, MOUTH.x, MOUTH.y);
    set(list, HAND_LANDMARK.middlePip, 0.52, 0.62);
    set(list, HAND_LANDMARK.middleTip, 0.52, 0.55);
    set(list, HAND_LANDMARK.ringPip, 0.55, 0.62);
    set(list, HAND_LANDMARK.ringTip, 0.55, 0.55);
    set(list, HAND_LANDMARK.pinkyPip, 0.58, 0.62);
    set(list, HAND_LANDMARK.pinkyTip, 0.58, 0.55);

    return {
        handedness: 'Left',
        score: 1,
        landmarks: list,
        worldLandmarks: [],
        center: { x: 0.5, y: 0.75 },
    };
}

function farHand(): HandState {
    const hand = shhHand();
    set(hand.landmarks, HAND_LANDMARK.indexTip, 0.95, 0.95);
    return hand;
}

function input(hand: HandState | null, mouth = MOUTH): SigmaStreamInput {
    return { hand, mouth: hand ? mouth : null };
}

function settle(stream: SigmaStream, value: SigmaStreamInput, times = 8) {
    let observation = stream.update(value);

    for (let index = 1; index < times; index++) {
        observation = stream.update(value);
    }

    return observation;
}

describe('SigmaStream', () => {
    it('activates on an index finger held to the lips with the other fingers curled', () => {
        const stream = new SigmaStream();
        const observation = settle(stream, input(shhHand()));

        expect(observation.active).toBe(true);
        expect(observation.score).toBeGreaterThan(0.9);
    });

    it('stays inactive without a hand', () => {
        const stream = new SigmaStream();
        const observation = settle(stream, input(null));

        expect(observation.active).toBe(false);
        expect(observation.score).toBe(0);
    });

    it('stays inactive when the finger is far from the mouth', () => {
        const stream = new SigmaStream();
        const observation = settle(stream, input(farHand()));

        expect(observation.active).toBe(false);
        expect(observation.score).toBe(0);
    });

    it('scores an open hand below the shh shape', () => {
        const shh = settle(new SigmaStream(), input(shhHand()));
        const open = settle(new SigmaStream(), input(openHand()));

        expect(open.score).toBeLessThan(shh.score);
    });

    it('stays inactive without a face', () => {
        const stream = new SigmaStream();
        const observation = settle(stream, { hand: shhHand(), mouth: null });

        expect(observation.active).toBe(false);
    });

    it('deactivates once the hand leaves', () => {
        const stream = new SigmaStream();
        settle(stream, input(shhHand()));

        const observation = settle(stream, input(null));

        expect(observation.active).toBe(false);
        expect(observation.score).toBeLessThan(0.5);
    });

    it('resets every accumulated value', () => {
        const stream = new SigmaStream();
        settle(stream, input(shhHand()));
        stream.reset();

        const observation = stream.update(input(null));

        expect(observation.active).toBe(false);
        expect(observation.score).toBe(0);
    });
});
