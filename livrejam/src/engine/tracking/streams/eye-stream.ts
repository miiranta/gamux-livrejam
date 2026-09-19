import type { Point3D } from '../../math';
import { SmoothedStateFilter } from '../state-filter';
import type { EyeState, EyesObservation, Stream } from './types';

export interface EyeStreamInput {
    leftBlink: number;
    rightBlink: number;
    leftIris: Point3D;
    rightIris: Point3D;
}

export class EyeStream implements Stream<EyeStreamInput, EyesObservation> {
    private readonly left: SmoothedStateFilter<EyeState>;
    private readonly right: SmoothedStateFilter<EyeState>;

    constructor(threshold: number) {
        this.left = new SmoothedStateFilter<EyeState>('closed', 'open', threshold);
        this.right = new SmoothedStateFilter<EyeState>('closed', 'open', threshold);
    }

    update(input: EyeStreamInput): EyesObservation {
        return {
            left: {
                state: this.left.update(input.leftBlink),
                center: input.leftIris,
            },
            right: {
                state: this.right.update(input.rightBlink),
                center: input.rightIris,
            },
        };
    }

    reset(): void {
        this.left.reset();
        this.right.reset();
    }
}
