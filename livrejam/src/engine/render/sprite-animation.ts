export interface SpriteTimeline {
    frames: number;
    frameDuration: number;
}

export interface TimelineStep {
    frame: number;
    finished: boolean;
}

export function durationOf(timeline: SpriteTimeline): number {
    return timeline.frames * timeline.frameDuration;
}

export function frameAt(timeline: SpriteTimeline, elapsed: number): number {
    const step = timeline.frameDuration > 0 ? timeline.frameDuration : Infinity;
    const last = Math.max(timeline.frames - 1, 0);
    return Math.min(Math.floor(elapsed / step), last);
}

export function stepOnce(timeline: SpriteTimeline, elapsed: number, dt: number): TimelineStep {
    const next = elapsed + dt;
    return {
        frame: frameAt(timeline, next),
        finished: next >= durationOf(timeline),
    };
}
