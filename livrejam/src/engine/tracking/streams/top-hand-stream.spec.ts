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
): { time: number; side: string | null } {
    let time = startTime;
    let side: string | null = null;

    for (let index = 0; index < frames; index++) {
        side = stream.update(hands, time).side;
        time += STEP_MS;
    }

    return { time, side };
}

describe('TopHandStream', () => {
    it('reports the left hand when it is higher in the frame', () => {
        const stream = new TopHandStream();
        const { side } = settle(stream, pair(0.3, 0.5));

        expect(side).toBe('left');
    });

    it('reports the right hand when it is higher in the frame', () => {
        const stream = new TopHandStream();
        const { side } = settle(stream, pair(0.5, 0.3));

        expect(side).toBe('right');
    });

    it('reports nothing when the hands are level', () => {
        const stream = new TopHandStream();
        const { side } = settle(stream, pair(0.4, 0.4));

        expect(side).toBeNull();
    });

    it('reports nothing when only one hand is in frame', () => {
        const stream = new TopHandStream();
        const { side } = settle(stream, [hand('Left', 0.2)]);

        expect(side).toBeNull();
    });

    it('reports nothing when no hands are in frame', () => {
        const stream = new TopHandStream();
        const { side } = settle(stream, []);

        expect(side).toBeNull();
    });

    it('reports nothing when a handedness is unknown', () => {
        const stream = new TopHandStream();
        const { side } = settle(stream, [hand('Left', 0.2), hand('Unknown', 0.6)]);

        expect(side).toBeNull();
    });

    it('reports nothing before enough samples accumulate', () => {
        const stream = new TopHandStream();
        const observation = stream.update(pair(0.3, 0.5), 0);

        expect(observation.side).toBeNull();
        expect(observation.active).toBe(false);
    });

    it('keeps the current side through a brief crossing', () => {
        const stream = new TopHandStream();
        const { time } = settle(stream, pair(0.3, 0.5));
        const { side } = settle(stream, pair(0.47, 0.5), 2, time);

        expect(side).toBe('left');
    });

    it('switches once the other hand stays higher', () => {
        const stream = new TopHandStream();
        const { time } = settle(stream, pair(0.3, 0.5));
        const { side } = settle(stream, pair(0.5, 0.3), 5, time);

        expect(side).toBe('right');
    });

    it('drops the side when a hand leaves the frame', () => {
        const stream = new TopHandStream();
        const { time } = settle(stream, pair(0.3, 0.5));
        const { side } = settle(stream, [hand('Left', 0.3)], 5, time);

        expect(side).toBeNull();
    });

    it('reports confidence from the height margin', () => {
        const stream = new TopHandStream();
        const { time } = settle(stream, pair(0.3, 0.5));
        const observation = stream.update(pair(0.3, 0.5), time);

        expect(observation.confidence).toBe(1);
        expect(observation.margin).toBeGreaterThan(0);
    });

    it('resets every accumulated value', () => {
        const stream = new TopHandStream();
        settle(stream, pair(0.3, 0.5));
        stream.reset();

        const observation = stream.update(pair(0.3, 0.5), 0);

        expect(observation.side).toBeNull();
        expect(observation.active).toBe(false);
        expect(observation.confidence).toBe(0);
    });
});