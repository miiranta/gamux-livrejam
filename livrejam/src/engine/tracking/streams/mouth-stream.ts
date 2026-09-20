import { SmoothedStateFilter } from '../state-filter';
import type { MouthObservation, MouthState, Stream } from './types';

export class MouthStream implements Stream<number, MouthObservation> {
    private readonly filter: SmoothedStateFilter<MouthState>;

    constructor(threshold: number) {
        this.filter = new SmoothedStateFilter<MouthState>('open', 'closed', threshold);
    }

    update(openness: number): MouthObservation {
        return {
            state: this.filter.update(openness),
            openness,
        };
    }

    reset(): void {
        this.filter.reset();
    }
}
