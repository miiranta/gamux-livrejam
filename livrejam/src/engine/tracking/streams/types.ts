import type { Point2D } from '../../math';

export type EyeState = 'open' | 'closed';

export type MouthState = 'open' | 'closed';

export interface Observation {
    active: boolean;
    confidence: number;
}

export interface EyeObservation {
    state: EyeState;
    center: Point2D;
}

export interface EyesObservation {
    left: EyeObservation;
    right: EyeObservation;
}

export interface MouthObservation {
    state: MouthState;
    openness: number;
}

export interface SixtySevenObservation extends Observation {
    level: number;
    frequency: number;
    alternations: number;
}

export interface SigmaObservation extends Observation {
    score: number;
}

export type TopHandSide = 'left' | 'right' | null;

export interface TopHandObservation extends Observation {
    side: TopHandSide;
    margin: number;
}

export interface GestureObservations {
    sixtySeven: SixtySevenObservation;
    sigma: SigmaObservation;
    topHand: TopHandObservation;
}

export interface Stream<TInput, TOutput> {
    update(input: TInput, timestamp: number): TOutput;
    reset(): void;
}
