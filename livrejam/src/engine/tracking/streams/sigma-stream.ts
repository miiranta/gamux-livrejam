import { clamp, distance } from '../../math';
import type { Point2D, Point3D } from '../../math';
import { HAND_LANDMARK } from '../landmarks';
import type { HandState } from '../types';
import type { SigmaObservation, Stream } from './types';

export interface SigmaStreamInput {
    hand: HandState | null;
    mouth: Point2D | null;
}

const PROXIMITY_PALMS = 0.9;
const EXTENSION_PALMS = 0.6;
const ACTIVE_THRESHOLD = 0.5;
const SMOOTHING_ALPHA = 0.5;
const HYSTERESIS = 0.07;
const MIN_LANDMARKS = 21;

const CURLED_WEIGHT = 0.5;
const EXTENSION_WEIGHT = 0.3;
const VERTICAL_WEIGHT = 0.2;

export class SigmaStream implements Stream<SigmaStreamInput, SigmaObservation> {
    private smoothed: number | null = null;
    private active = false;

    update(input: SigmaStreamInput): SigmaObservation {
        const score = input.hand && input.mouth ? this.rawScore(input.hand, input.mouth) : 0;
        this.smoothed =
            this.smoothed === null
                ? score
                : this.smoothed + (score - this.smoothed) * SMOOTHING_ALPHA;

        this.active = this.active
            ? this.smoothed > ACTIVE_THRESHOLD - HYSTERESIS
            : this.smoothed > ACTIVE_THRESHOLD + HYSTERESIS;

        return { active: this.active, confidence: this.smoothed, score: this.smoothed };
    }

    reset(): void {
        this.smoothed = null;
        this.active = false;
    }

    private rawScore(hand: HandState, mouth: Point2D): number {
        const points = hand.landmarks;

        if (points.length < MIN_LANDMARKS) {
            return 0;
        }

        const wrist = points[HAND_LANDMARK.wrist];
        const palm = distance(wrist, points[HAND_LANDMARK.middleMcp]);

        if (palm <= 0) {
            return 0;
        }

        const indexTip = points[HAND_LANDMARK.indexTip];
        const indexPip = points[HAND_LANDMARK.indexPip];

        const proximity = clamp(1 - distance(indexTip, mouth) / (palm * PROXIMITY_PALMS), 0, 1);
        const extension = clamp(
            (distance(wrist, indexTip) - distance(wrist, indexPip)) / (palm * EXTENSION_PALMS),
            0,
            1,
        );
        const curled = this.curledRatio(points, wrist);
        const vertical = this.verticality(points[HAND_LANDMARK.indexMcp], indexTip);
        const shape =
            curled * CURLED_WEIGHT + extension * EXTENSION_WEIGHT + vertical * VERTICAL_WEIGHT;

        return proximity * shape;
    }

    private curledRatio(points: Point3D[], wrist: Point3D): number {
        const fingers = [
            [HAND_LANDMARK.middlePip, HAND_LANDMARK.middleTip],
            [HAND_LANDMARK.ringPip, HAND_LANDMARK.ringTip],
            [HAND_LANDMARK.pinkyPip, HAND_LANDMARK.pinkyTip],
        ];

        const curled = fingers.filter(
            ([pip, tip]) => distance(wrist, points[tip]) < distance(wrist, points[pip]),
        ).length;

        return curled / fingers.length;
    }

    private verticality(base: Point3D, tip: Point3D): number {
        const dx = tip.x - base.x;
        const dy = tip.y - base.y;
        const length = Math.hypot(dx, dy);

        if (length === 0 || dy >= 0) {
            return 0;
        }

        return clamp(Math.abs(dy) / length, 0, 1);
    }
}
