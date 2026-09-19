import type { HandState } from '../types';
import { SixtySevenStream } from './sixty-seven-stream';

const FRAME_MS = 1000 / 60;
const WIDE = 0.6;
const NARROW = 0.1;

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

function strokeFor(
    stream: SixtySevenStream,
    durationMs: number,
    frequency: number,
    swing: number,
    startTime = 0,
    stepMs = FRAME_MS,
): { time: number; level: number } {
    let time = startTime;
    let level = 0;
    const quarter = swing / 4;

    for (let elapsed = 0; elapsed < durationMs; elapsed += stepMs) {
        const phase = Math.cos(2 * Math.PI * frequency * (elapsed / 1000));
        level = stream.update(pair(0.5 - quarter * phase, 0.5 + quarter * phase), time).level;
        time += stepMs;
    }

    return { time, level };
}

function alternateFor(
    stream: SixtySevenStream,
    durationMs: number,
    startTime: number,
    stepMs = FRAME_MS,
    swing = WIDE,
): { time: number; level: number } {
    return strokeFor(stream, durationMs, 1000 / (2 * stepMs), swing, startTime, stepMs);
}

function alternate(
    stream: SixtySevenStream,
    cycles: number,
    startTime: number,
    stepMs = FRAME_MS,
    swing = WIDE,
): { time: number; level: number } {
    return alternateFor(stream, cycles * 2 * stepMs, startTime, stepMs, swing);
}

function hold(stream: SixtySevenStream, time: number, durationMs: number): number {
    return stream.update([], time + durationMs).level;
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

    it('detects fast alternation at the frame rate limit', () => {
        const stream = new SixtySevenStream();
        const { level } = alternateFor(stream, 500, 0, FRAME_MS);

        expect(level).toBe(1);
    });

    it('accelerates more the faster the movement is', () => {
        const slow = new SixtySevenStream();
        const slowLevel = alternateFor(slow, 400, 0, 120).level;
        const fast = new SixtySevenStream();
        const fastLevel = alternateFor(fast, 400, 0, 20).level;

        expect(fastLevel).toBeGreaterThan(slowLevel);
    });

    it('accelerates more the higher the amplitude is', () => {
        const narrow = new SixtySevenStream();
        const narrowLevel = alternateFor(narrow, 400, 0, FRAME_MS, NARROW).level;
        const wide = new SixtySevenStream();
        const wideLevel = alternateFor(wide, 400, 0, FRAME_MS, WIDE).level;

        expect(wideLevel).toBeGreaterThan(narrowLevel);
    });

    it('rises faster as the alternation rate increases', () => {
        const slow = new SixtySevenStream();
        const fast = new SixtySevenStream();
        const slowRise = alternateFor(slow, 150, 0, 60).level;
        const fastRise = alternateFor(fast, 150, 0, 20).level;

        expect(fastRise).toBeGreaterThan(slowRise);
    });

    it('barely accelerates on small low amplitude movement', () => {
        const stream = new SixtySevenStream();
        const { level } = alternateFor(stream, 400, 0, FRAME_MS, 0.06);

        expect(level).toBeLessThan(0.4);
    });

    it('stays inactive on tiny movement', () => {
        const stream = new SixtySevenStream();
        const { level } = alternateFor(stream, 400, 0, FRAME_MS, 0.03);

        expect(level).toBe(0);
    });

    it('accumulates during fast movement even without full reversals', () => {
        const stream = new SixtySevenStream();
        const { level } = alternateFor(stream, 300, 0, 16, 0.35);

        expect(level).toBeGreaterThan(0.4);
    });

    it('reports a frequency that grows with the alternation rate', () => {
        const slow = new SixtySevenStream();
        const slowResult = alternateFor(slow, 800, 0, 60);
        const fast = new SixtySevenStream();
        const fastResult = alternateFor(fast, 800, 0, 20);

        expect(slow.update([], slowResult.time).frequency).toBeGreaterThan(0);
        expect(fast.update([], fastResult.time).frequency).toBeGreaterThan(
            slow.update([], slowResult.time).frequency,
        );
    });

    it('counts alternations', () => {
        const stream = new SixtySevenStream();
        const { time } = alternate(stream, 4, 0);

        expect(stream.update([], time).alternations).toBe(7);
    });

    it('marks the gesture active while moving', () => {
        const stream = new SixtySevenStream();
        const { time } = alternate(stream, 8, 0);

        expect(stream.update([], time).active).toBe(true);
    });

    it('decays fast once the gesture stops', () => {
        const stream = new SixtySevenStream();
        const { time } = alternate(stream, 10, 0);

        expect(hold(stream, time, 1000)).toBeLessThan(0.1);
    });

    it('starts decaying immediately after the last movement', () => {
        const stream = new SixtySevenStream();
        const { time, level } = alternate(stream, 10, 0);

        expect(hold(stream, time, 300)).toBeLessThan(level / 2);
    });

    it('keeps the level up through a brief pause', () => {
        const stream = new SixtySevenStream();
        const { time } = alternate(stream, 10, 0);

        expect(stream.update([], time + 100).active).toBe(true);
    });

    it('goes inactive once the gesture stops for long', () => {
        const stream = new SixtySevenStream();
        const { time } = alternate(stream, 10, 0);

        const observation = stream.update([], time + 3000);

        expect(observation.level).toBeLessThan(0.15);
        expect(observation.active).toBe(false);
    });

    it('ignores jitter below the swing floor', () => {
        const stream = new SixtySevenStream();
        const { level } = alternateFor(stream, 400, 0, FRAME_MS, 0.002);

        expect(level).toBe(0);
    });

    it('detects fast movement at a realistic hand separation', () => {
        const stream = new SixtySevenStream();
        const { time, level } = strokeFor(stream, 600, 4, 0.3);

        expect(level).toBeGreaterThan(0.2);
        expect(stream.update([], time).active).toBe(true);
    });

    it('scales with stroke frequency', () => {
        const slow = new SixtySevenStream();
        const fast = new SixtySevenStream();
        const slowLevel = strokeFor(slow, 300, 2, 0.25).level;
        const fastLevel = strokeFor(fast, 300, 4, 0.25).level;

        expect(fastLevel).toBeGreaterThan(slowLevel * 2);
    });

    it('scales with stroke amplitude', () => {
        const small = new SixtySevenStream();
        const large = new SixtySevenStream();
        const smallLevel = strokeFor(small, 600, 4, 0.15).level;
        const largeLevel = strokeFor(large, 600, 4, 0.3).level;

        expect(largeLevel).toBeGreaterThan(smallLevel * 1.5);
    });

    it('is insensitive to the sampling rate', () => {
        const dense = new SixtySevenStream();
        const sparse = new SixtySevenStream();
        const denseLevel = strokeFor(dense, 500, 4, 0.3).level;
        const sparseLevel = strokeFor(sparse, 500, 4, 0.3, 0, 50).level;

        expect(sparseLevel).toBeGreaterThan(denseLevel * 0.6);
        expect(sparseLevel).toBeLessThan(denseLevel * 1.4);
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
