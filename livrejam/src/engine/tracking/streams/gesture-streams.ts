import type { Point2D } from '../../math';
import { FACE_LANDMARK, HAND_LANDMARK } from '../landmarks';
import type { FaceState, HandState } from '../types';
import { SigmaStream, type SigmaStreamInput } from './sigma-stream';
import { SixtySevenStream } from './sixty-seven-stream';
import type { GestureObservations } from './types';

export interface GestureStreamsInput {
    face: FaceState | null;
    hands: HandState[];
    timestamp: number;
}

export class GestureStreams {
    private readonly sixtySeven = new SixtySevenStream();
    private readonly sigma = new SigmaStream();

    update(input: GestureStreamsInput): GestureObservations {
        return {
            sixtySeven: this.sixtySeven.update(input.hands, input.timestamp),
            sigma: this.sigma.update(toSigmaInput(input.face, input.hands)),
        };
    }

    reset(): void {
        this.sixtySeven.reset();
        this.sigma.reset();
    }
}

function toSigmaInput(face: FaceState | null, hands: HandState[]): SigmaStreamInput {
    const mouth = face ? mouthCenter(face) : null;

    if (!mouth || hands.length === 0) {
        return { hand: null, mouth: null };
    }

    return { hand: nearestHand(hands, mouth), mouth };
}

function mouthCenter(face: FaceState): Point2D | null {
    const upper = face.landmarks[FACE_LANDMARK.upperLipInner];
    const lower = face.landmarks[FACE_LANDMARK.lowerLipInner];

    if (!upper || !lower) {
        return null;
    }

    return { x: (upper.x + lower.x) / 2, y: (upper.y + lower.y) / 2 };
}

function nearestHand(hands: HandState[], mouth: Point2D): HandState {
    return hands.reduce((closest, hand) =>
        tipDistance(hand, mouth) < tipDistance(closest, mouth) ? hand : closest,
    );
}

function tipDistance(hand: HandState, mouth: Point2D): number {
    const tip = hand.landmarks[HAND_LANDMARK.indexTip];

    if (!tip) {
        return Number.POSITIVE_INFINITY;
    }

    return Math.hypot(tip.x - mouth.x, tip.y - mouth.y);
}
