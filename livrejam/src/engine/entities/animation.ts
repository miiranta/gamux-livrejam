import type { Facing } from './facing';
import { facingRow } from './facing';

export interface AnimationClip {
    frames: number;
    rows: number;
    frameDuration: number;
    holdLastFrame?: boolean;
    strideDistance?: number;
}

export type AnimationSet = Record<string, AnimationClip>;

export interface AnimationStep {
    frame: number;
    elapsed: number;
    finished: boolean;
}

export function clipRow(clip: AnimationClip, facing: Facing): number {
    return clip.rows === 1 ? 0 : facingRow(facing);
}

export function clampFrame(clip: AnimationClip, frame: number): number {
    return Math.min(Math.max(frame, 0), clip.frames - 1);
}

export function clipCycleSeconds(clip: AnimationClip): number {
    return clip.frames * clip.frameDuration;
}

export function clipAdvance(clip: AnimationClip, dt: number, distance: number): number {
    if (clip.strideDistance === undefined || clip.strideDistance <= 0) {
        return dt;
    }

    return (Math.abs(distance) / clip.strideDistance) * clipCycleSeconds(clip);
}

export function advanceClip(
    clip: AnimationClip,
    frame: number,
    elapsed: number,
    dt: number,
): AnimationStep {
    let nextElapsed = elapsed + dt;
    let nextFrame = frame;

    while (nextElapsed >= clip.frameDuration) {
        nextElapsed -= clip.frameDuration;
        nextFrame += 1;

        if (nextFrame < clip.frames) {
            continue;
        }

        if (clip.holdLastFrame) {
            return { frame: clip.frames - 1, elapsed: 0, finished: true };
        }

        nextFrame = 0;
    }

    return { frame: nextFrame, elapsed: nextElapsed, finished: false };
}
