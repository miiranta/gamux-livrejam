import { Item, pickItem } from '../entities';
import type { DungeonLevel } from '../level';
import type { ItemDefinition } from '../config';
import { FACE_SMASHING } from '../config';

export interface SpawnerOptions {
    level: DungeonLevel;
    random: () => number;
}

export class ItemSpawner {
    private current = FACE_SMASHING.drop.baseSpeed;
    private ramp = 0;

    constructor(private readonly options: SpawnerOptions) {}

    get speed(): number {
        return this.current;
    }

    reset(): void {
        this.current = FACE_SMASHING.drop.baseSpeed;
        this.ramp = 0;
    }

    /** Raises the fall speed on a fixed cadence, independent of the drops. */
    advance(dt: number): void {
        this.ramp += dt;

        while (this.ramp >= FACE_SMASHING.drop.rampSeconds) {
            this.ramp -= FACE_SMASHING.drop.rampSeconds;
            this.accelerate();
        }
    }

    accelerate(): void {
        this.current = Math.min(
            this.current + FACE_SMASHING.drop.speedStep,
            FACE_SMASHING.drop.maxSpeed,
        );
    }

    spawn(): Item {
        return this.spawnItem(pickItem(this.options.random));
    }

    spawnItem(definition: ItemDefinition): Item {
        const { grid } = this.options.level;
        const width = definition.half.width * 2;
        const height = definition.half.height * 2;
        const center = grid.left + grid.width / 2;
        const spinSpan = definition.spin.max - definition.spin.min;
        const spin = definition.spin.min + this.options.random() * spinSpan;
        const direction = this.options.random() < 0.5 ? -1 : 1;

        return new Item({
            x: center - width / 2,
            y: this.options.level.spawnY - height,
            velocityX: 0,
            velocityY: this.current,
            definition,
            spin: spin * direction,
            damageRoll: this.options.random(),
        });
    }
}
