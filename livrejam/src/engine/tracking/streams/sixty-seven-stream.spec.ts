import type { HandState } from '../types';
import { SixtySevenStream } from './sixty-seven-stream';

const FRAME_MS = 1000 / 60;

function hand(x: number, y: number): HandState {
    return {
        handedness: 'Left',
        score: 1,
        landmarks: [],
        worldLandmarks: [],
        center: { x, y },
    };
}

function pair(leftY: number, rightY: number): HandState[] {
    return [hand(0.3, leftY), hand(0.7, rightY)];
}

function alternate(
    stream: SixtySevenStream,
    cycles: number,
    startTime: number,
    stepMs = FRAME_MS,
    amplitude = 0.15,
): { time: number; level: number } {
    let time = startTime;
    let level = 0;

    for (let cycle = 0; cycle < cycles; cycle++) {
        level = stream.update(pair(0.5 - amplitude, 0.5 + amplitude), time).level;
        time += stepMs;
        level = stream.update(pair(0.5 + amplitude, 0.5 - amplitude), time).level;
        time += stepMs;
    }

    return { time, level };
}

describe('SixtySevenStream', () => {
    it('stays idle without two hands', () => {
        const stream = new SixtySevenStream();
        const observation = stream.update([hand(0.3, 0.4)], 0);

        expect(observation.active).toBe(false);
        expect(observation.level).toBe(0);
    });

    it('stays idle when both hands overlap horizontally', () => {
        const stream = new SixtySevenStream();
        const observation = stream.update([hand(0.5, 0.3), hand(0.5, 0.7)], 0);

        expect(observation.level).toBe(0);
    });

    it('accumulates level while alternating', () => {
        const stream = new SixtySevenStream();
        const { level } = alternate(stream, 4, 0);

        expect(level).toBeGreaterThan(0.3);
    });

    it('reaches full level under sustained alternation', () => {
        const stream = new SixtySevenStream();
        const { level } = alternate(stream, 10, 0);

        expect(level).toBe(1);
    });

    it('marks the gesture active once the level rises', () => {
        const stream = new SixtySevenStream();
        const { level } = alternate(stream, 2, 0);

        expect(level).toBeGreaterThan(0.15);
    });

    it('detects alternation performed as fast as possible', () => {
        const stream = new SixtySevenStream();
        const { level } = alternate(stream, 6, 0, 16);

        expect(level).toBeGreaterThan(0.3);
    });

    it('reports a frequency that grows with the alternation rate', () => {
        const slow = new SixtySevenStream();
        const slowResult = alternate(slow, 6, 0, 200);
        const fast = new SixtySevenStream();
        const fastResult = alternate(fast, 6, 0, 40);

        expect(slow.update([], slowResult.time).frequency).toBeGreaterThan(0);
        expect(fast.update([], fastResult.time).frequency).toBeGreaterThan(
            slow.update([], slowResult.time).frequency,
        );
    });

    it('ignores jitter below the amplitude floor', () => {
        const stream = new SixtySevenStream();
        const { level } = alternate(stream, 8, 0, FRAME_MS, 0.001);

        expect(level).toBe(0);
    });

    it('decays the level when the gesture stops', () => {
        const stream = new SixtySevenStream();
        const { time } = alternate(stream, 10, 0);

        const observation = stream.update([], time + 3000);

        expect(observation.level).toBeLessThan(0.15);
        expect(observation.active).toBe(false);
    });

    it('keeps the level up through a brief pause', () => {
        const stream = new SixtySevenStream();
        const { time } = alternate(stream, 10, 0);

        const observation = stream.update([], time + 100);

        expect(observation.active).toBe(true);
    });

    it('resets every accumulated value', () => {
        const stream = new SixtySevenStream();
        alternate(stream, 10, 0);
        stream.reset();

        const observation = stream.update([], 5000);

        expect(observation.level).toBe(0);
        expect(observation.alternations).toBe(0);
        expect(observation.frequency).toBe(0);
    });
});
