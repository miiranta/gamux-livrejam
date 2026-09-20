import type { TrackingFrame } from '../../engine/tracking';
import type { DungeonLevel } from '../level';

/** How the player steers the falling item. */
export type SteeringMode = '67' | 'rizz';

export interface SteeringIntent {
    /** -1 steers fully left, 0 drops straight down, 1 steers fully right. */
    axis: number;
    active: boolean;
}

const NEUTRAL: SteeringIntent = { axis: 0, active: false };

/** Hand offset that rotates the marker to full deflection, in normalized units. */
const AIM_RANGE = 0.15;

const ARENA_MARGIN = 0.06;

/**
 * Turns a tracking frame into a steering direction for the falling item.
 *
 * The direction is continuous and it is the very same number that rotates the
 * aim marker, so the item always flies exactly where the arrow points. Bringing
 * the hands level, or opening both eyes, settles it back to a straight drop.
 */
export class SteeringSystem {
    private frame: TrackingFrame | null = null;

    constructor(private readonly level: DungeonLevel) {}

    update(frame: TrackingFrame | null): void {
        this.frame = frame;
    }

    reset(): void {
        this.frame = null;
    }

    /**
     * Direction for the falling item, -1 (hard left) through 0 (straight down)
     * to 1 (hard right), blanked when it would pin the item against a wall.
     */
    intent(mode: SteeringMode, itemX: number): SteeringIntent {
        const frame = this.frame;

        if (!frame) {
            return NEUTRAL;
        }

        return this.keepInsideArena(direction(mode, frame), itemX);
    }

    /**
     * The unguarded direction, which rotates the aim marker. It is the same
     * value the item is steered by, so the arrow never lies about the flight
     * path.
     */
    aim(mode: SteeringMode): number {
        const frame = this.frame;

        return frame ? direction(mode, frame).axis : 0;
    }

    /**
     * Drops a direction that would pin the item against a wall for the whole
     * fall: the item is heavy and already bounces off the walls on its own.
     */
    private keepInsideArena(intent: SteeringIntent, itemX: number): SteeringIntent {
        if (intent.axis === 0) {
            return intent;
        }

        const margin = (this.level.playRight - this.level.playLeft) * ARENA_MARGIN;

        if (intent.axis < 0 && itemX <= this.level.playLeft + margin) {
            return NEUTRAL;
        }

        if (intent.axis > 0 && itemX >= this.level.playRight - margin) {
            return NEUTRAL;
        }

        return intent;
    }
}

function direction(mode: SteeringMode, frame: TrackingFrame): SteeringIntent {
    return mode === 'rizz' ? steerWithEyes(frame) : steerWithHands(frame);
}

/**
 * Scales with how far the hands are held apart, so a level pair drops the item
 * straight while a raised hand pulls it that way. Left/right is the player's
 * own hand: the camera preview is mirrored but MediaPipe's handedness is not.
 *
 * The SIDE comes from the stream's hysteresis and the LEAN from the raw margin.
 * Reading the sign off the margin instead makes the arrow flicker: near level
 * the margin's sign is pure noise, so it flips the direction every frame while
 * the stabilized side stays put.
 */
function steerWithHands(frame: TrackingFrame): SteeringIntent {
    const observation = frame.gestures.topHand;

    if (!observation.active || observation.side === null) {
        return NEUTRAL;
    }

    const lean = clamp(Math.abs(observation.margin) / AIM_RANGE, 0, 1);
    const axis = lean === 0 ? 0 : observation.side === 'left' ? -lean : lean;

    return { axis, active: true };
}

/** Closing one eye steers that way; both open lets the item drop straight. */
function steerWithEyes(frame: TrackingFrame): SteeringIntent {
    const face = frame.face;

    if (!face) {
        return NEUTRAL;
    }

    const left = face.leftEye.state === 'closed';
    const right = face.rightEye.state === 'closed';

    if (left === right) {
        return NEUTRAL;
    }

    return { axis: left ? -1 : 1, active: true };
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}
