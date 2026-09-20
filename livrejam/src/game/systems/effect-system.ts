import type { SpriteTimeline } from '../../engine/render';
import { stepOnce } from '../../engine/render';

export type EffectKind = 'impact' | 'slash' | 'dust' | 'explosion';

export interface Effect {
    kind: EffectKind;
    x: number;
    y: number;
    size: number;
    angle: number;
    frame: number;
    elapsed: number;
    finished: boolean;
}

export interface EffectSpawn {
    kind: EffectKind;
    x: number;
    y: number;
    size: number;
    angle?: number;
}

export class EffectSystem {
    private readonly effects: Effect[] = [];

    constructor(
        private readonly timelines: Record<EffectKind, SpriteTimeline>,
        private readonly capacity = 64,
    ) {}

    get active(): readonly Effect[] {
        return this.effects;
    }

    clear(): void {
        this.effects.length = 0;
    }

    spawn(entry: EffectSpawn): void {
        if (this.effects.length >= this.capacity) {
            this.effects.shift();
        }

        this.effects.push({
            kind: entry.kind,
            x: entry.x,
            y: entry.y,
            size: entry.size,
            angle: entry.angle ?? 0,
            frame: 0,
            elapsed: 0,
            finished: false,
        });
    }

    update(dt: number): void {
        for (const effect of this.effects) {
            const timeline = this.timelines[effect.kind];
            const step = stepOnce(timeline, effect.elapsed, dt);
            effect.elapsed += dt;
            effect.frame = step.frame;
            effect.finished = step.finished;
        }

        for (let index = this.effects.length - 1; index >= 0; index--) {
            if (this.effects[index].finished) {
                this.effects.splice(index, 1);
            }
        }
    }
}
