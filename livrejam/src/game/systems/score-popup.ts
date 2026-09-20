import { clamp } from '../../engine/math';
import { FACE_SMASHING } from '../config';

/**
 * Points paid for a hit that dealt `damage`. Landing a hit is the goal, so
 * even a graze is worth at least one point.
 */
export function hitPoints(damage: number): number {
    return Math.max(1, Math.round(damage * FACE_SMASHING.score.hitPerDamage));
}

export interface ScorePopupPose {
    /** How far the label has floated up, in world units. */
    rise: number;
    /** Multiplier applied to the label size (it pops on spawn). */
    scale: number;
    /** Fade-out opacity in the 0..1 range. */
    alpha: number;
}

/**
 * Visual pose of a popup at `progress` (0 = just spawned, 1 = gone): a quick
 * scale pop-up, a steady rise and a fade over the final third.
 */
export function scorePopupPose(progress: number): ScorePopupPose {
    const clamped = clamp(progress, 0, 1);
    const grow = Math.min(clamped * 3, 1);

    return {
        rise: FACE_SMASHING.scorePopup.rise * clamped,
        scale: 1 + 0.35 * Math.sin(grow * Math.PI),
        alpha: clamped < 0.7 ? 1 : clamp(1 - (clamped - 0.7) / 0.3, 0, 1),
    };
}

export interface ScorePopup {
    /** World-space anchor (the point on the character that was hit). */
    x: number;
    y: number;
    /** Points awarded by this hit. */
    amount: number;
    elapsed: number;
    finished: boolean;
}

/**
 * Floating "+N" labels shown where the dodger was hit. Purely cosmetic: the
 * score itself is added by the orchestrator, this only tracks the animation.
 */
export class ScorePopupSystem {
    private readonly popups: ScorePopup[] = [];

    get active(): readonly ScorePopup[] {
        return this.popups;
    }

    clear(): void {
        this.popups.length = 0;
    }

    spawn(x: number, y: number, amount: number): void {
        if (amount <= 0) {
            return;
        }

        const { capacity } = FACE_SMASHING.scorePopup;
        if (this.popups.length >= capacity) {
            this.popups.shift();
        }

        this.popups.push({ x, y, amount, elapsed: 0, finished: false });
    }

    update(dt: number): void {
        const { duration } = FACE_SMASHING.scorePopup;

        for (const popup of this.popups) {
            popup.elapsed += dt;
            popup.finished = popup.elapsed >= duration;
        }

        for (let index = this.popups.length - 1; index >= 0; index--) {
            if (this.popups[index].finished) {
                this.popups.splice(index, 1);
            }
        }
    }
}