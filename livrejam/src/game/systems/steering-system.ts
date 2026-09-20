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

/** Fraction of the raised hand's travel that is ignored, so "level" reads exact. */
const LEVEL = 0.1;

const ARENA_MARGIN = 0.06;

/**
 * Turns a tracking frame into a steering direction for the falling item.
 *
 * The direction is continuous and it is the very same number that rotates the
 * aim marker, so the item always flies exactly where the arrow points. Bringing
 * the hands level, or opening both eyes, settles it back to a straight drop.
 */export class SteeringSystem {
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
 * Proportional steering from how far apart the hands are held. The stream
 * reports 0 with both hands level and -1/1 with one hand fully raised, so the
 * item drops perfectly straight when the hands are level instead of snapping
 * sideways the moment the sign of the jitter flips. The bow returns the level
 * point to exact zero, keeping small raises away from the direction reversal.
 */
function steerWithHands(frame: TrackingFrame): SteeringIntent {
    const observation = frame.gestures.topHand;

    if (!observation.active) {
        return NEUTRAL;
    }

    const lean = bow(Math.abs(observation.value));
    const axis = lean === 0 ? 0 : Math.sign(observation.value) * lean;

    return { axis, active: true };
}

function bow(lean: number): number {
    return clamp((lean - LEVEL) / (1 - LEVEL), 0, 1);
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
