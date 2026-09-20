import type { TrackingFrame } from '../../engine/tracking';
import type { DungeonLevel } from '../level';

/** How the player steers the falling item. */
export type SteeringMode = '67' | 'rizz';

export interface SteeringIntent {
    /** -1 pushes the item left, 1 pushes it right, 0 lets it drop straight. */
    axis: number;
    active: boolean;
}

const NEUTRAL: SteeringIntent = { axis: 0, active: false };

/** How far the aim marker leans before it is clamped, in normalized units. */
const AIM_RANGE = 0.2;

/**
 * Turns a tracking frame into a left/right intent for the falling item.
 *
 * Both modes are discrete on purpose: the item is heavy and the arena is
 * narrow, so a definite direction reads far better than a proportional push.
 * `67` uses the higher of the two hands, `rizz` uses a wink.
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

    intent(mode: SteeringMode, itemX: number): SteeringIntent {
        const frame = this.frame;

        if (!frame) {
            return NEUTRAL;
        }

        const intent = mode === 'rizz' ? readEyes(frame) : readHands(frame);

        return this.keepInsideArena(intent, itemX);
    }

    /**
     * Continuous version of {@link intent}, from -1 (hard left) to 1 (hard
     * right). Steering stays discrete; this only drives the aim marker, which
     * can follow a hand smoothly instead of snapping between two positions.
     */
    aim(mode: SteeringMode): number {
        const frame = this.frame;

        if (!frame) {
            return 0;
        }

        return mode === 'rizz' ? eyeAim(frame) : handAim(frame);
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

const ARENA_MARGIN = 0.06;

/**
 * Picks the hand that is higher in the frame. Left/right is the player's own
 * hand: the camera preview is mirrored but MediaPipe's handedness is not.
 */
function readHands(frame: TrackingFrame): SteeringIntent {
    const observation = frame.gestures.topHand;

    if (!observation.active || observation.side === null) {
        return NEUTRAL;
    }

    return { axis: observation.side === 'left' ? -1 : 1, active: true };
}

/**
 * Leans towards the higher hand. The marker sits between the two hands, so it
 * already reads as "this is where the item will go".
 */
function handAim(frame: TrackingFrame): number {
    const observation = frame.gestures.topHand;

    if (!observation.active) {
        return 0;
    }

    return clamp(observation.margin / AIM_RANGE, -1, 1);
}

/** Closing one eye pushes the item that way; both open lets it drop. */
function readEyes(frame: TrackingFrame): SteeringIntent {
    const face = frame.face;

    if (!face) {
        return NEUTRAL;
    }

    const left = face.leftEye.state === 'closed';
    const right = face.rightEye.state === 'closed';

    if (left && right) {
        return NEUTRAL;
    }

    if (left) {
        return { axis: -1, active: true };
    }

    if (right) {
        return { axis: 1, active: true };
    }

    return NEUTRAL;
}

/** A wink is binary, so the marker swings to the side being winked. */
function eyeAim(frame: TrackingFrame): number {
    return readEyes(frame).axis;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}
