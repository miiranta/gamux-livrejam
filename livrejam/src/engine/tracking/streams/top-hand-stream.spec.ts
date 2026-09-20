import type { Handedness, HandState } from '../types';
import { TopHandStream } from './top-hand-stream';

const STEP_MS = 100;

function hand(handedness: Handedness, y: number): HandState {
    return {
        handedness,
        score: 1,
        landmarks: [],
        worldLandmarks: [],
        center: { x: handedness === 'Left' ? 0.3 : 0.7, y },
    };
}

function pair(leftY: number, rightY: number): HandState[] {
    return [hand('Left', leftY), hand('Right', rightY)];
}

function settle(
    stream: TopHandStream,
    hands: HandState[],
    frames = 5,
    startTime = 0,
): { time: number; value: number } {
    let time = startTime;
    let value = 0;

    for (let index = 0; index < frames; index++) {
        value = stream.update(hands, time).value;
        time += STEP_MS;
    }

    return { time, value };
}

describe('TopHandStream', () => {
    it('goes negative when the left hand is higher in the frame', () => {
        const stream = new TopHandStream();
        const { value } = settle(stream, pair(0.3, 0.5));

        expect(value).toBeLessThan(0);
    });

    it('goes positive when the right hand is higher in the frame', () => {
        const stream = new TopHandStream();
        const { value } = settle(stream, pair(0.5, 0.3));

        expect(value).toBeGreaterThan(0);
    });

    it('scales continuously with how far apart the hands are held', () => {
        const stream = new TopHandStream();
        const shallow = settle(new TopHandStream(), pair(0.38, 0.5)).value;
        const deep = settle(stream, pair(0.3, 0.5)).value;

        expect(shallow).toBeLessThan(0);
        expect(deep).toBeLessThan(shallow);
        expect(deep).toBeGreaterThanOrEqual(-1);
    });

    it('reaches -1 and 1 at a full swing', () => {
        expect(settle(new TopHandStream(), pair(0.25, 0.6)).value).toBe(-1);
        expect(settle(new TopHandStream(), pair(0.6, 0.25)).value).toBe(1);
    });

    it('reads exactly 0 when the hands are level', () => {
        const stream = new TopHandStream();
        const { value } = settle(stream, pair(0.4, 0.4));

        expect(value).toBe(0);
    });

    it('reads 0 through landmark jitter around level', () => {
        const stream = new TopHandStream();
        const { value } = settle(stream, pair(0.4, 0.41));

        expect(value).toBe(0);
    });

    it('is inactive when only one hand is in frame', () => {
        const stream = new TopHandStream();
        const { value } = settle(stream, [hand('Left', 0.2)]);

        expect(value).toBe(0);
        expect(stream.update([hand('Left', 0.2)], 999).active).toBe(false);
    });

    it('is inactive when no hands are in frame', () => {
        const stream = new TopHandStream();
        const observation = stream.update([], 0);

        expect(observation.value).toBe(0);
        expect(observation.active).toBe(false);
        expect(observation.confidence).toBe(0);
    });

    it('is inactive when a handedness is unknown', () => {
        const stream = new TopHandStream();
        const observation = stream.update([hand('Left', 0.2), hand('Unknown', 0.6)], 0);

        expect(observation.active).toBe(false);
        expect(observation.value).toBe(0);
    });

    it('is inactive before enough samples accumulate', () => {
        const stream = new TopHandStream();
        const observation = stream.update(pair(0.3, 0.5), 0);

        expect(observation.active).toBe(false);
        expect(observation.value).toBe(0);
    });

    it('follows a brief crossing instead of sticking to the old side', () => {
        const stream = new TopHandStream();
        const { time } = settle(stream, pair(0.3, 0.5));
        const { value } = settle(stream, pair(0.47, 0.5), 5, time);

        expect(value).toBeGreaterThan(0);
    });

    it('tracks the other direction once the hands swap', () => {
        const stream = new TopHandStream();
        const { time } = settle(stream, pair(0.3, 0.5));
        const { value } = settle(stream, pair(0.5, 0.3), 5, time);

        expect(value).toBeGreaterThan(0);
    });

    it('drops the reading when a hand leaves the frame', () => {
        const stream = new TopHandStream();
        const { time } = settle(stream, pair(0.3, 0.5));
        const { value } = settle(stream, [hand('Left', 0.3)], 5, time);

        expect(value).toBe(0);
    });

    it('reports confidence from how far the hands are held apart', () => {
        const stream = new TopHandStream();
        const { time } = settle(stream, pair(0.3, 0.5));
        const observation = stream.update(pair(0.3, 0.5), time);

        expect(observation.confidence).toBe(1);

        const level = new TopHandStream();
        expect(settle(level, pair(0.4, 0.4)).value).toBe(0);
        expect(level.update(pair(0.4, 0.4), 999).confidence).toBe(0);
    });

    it('resets every accumulated value', () => {
        const stream = new TopHandStream();
        settle(stream, pair(0.3, 0.5));
        stream.reset();

        const observation = stream.update(pair(0.3, 0.5), 0);

        expect(observation.value).toBe(0);
        expect(observation.active).toBe(false);
        expect(observation.confidence).toBe(0);
    });
});