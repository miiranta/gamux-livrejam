import { Item, pickItem } from '../entities';
import type { DungeonLevel } from '../level';
import type { ItemDefinition } from '../config';
import { FACE_SMASHING } from '../config';

export interface SpawnerOptions {
    level: DungeonLevel;
    random: () => number;
}

export class ItemSpawner {
    private timer = 0;
    private current = FACE_SMASHING.drop.baseSpeed;
    private ramp = 0;

    constructor(private readonly options: SpawnerOptions) {}

    get speed(): number {
        return this.current;
    }

    get interval(): number {
        return Math.max(
            FACE_SMASHING.drop.minInterval,
            (FACE_SMASHING.drop.baseInterval * FACE_SMASHING.drop.baseSpeed) / this.current,
        );
    }

    reset(): void {
        this.timer = 0;
        this.current = FACE_SMASHING.drop.baseSpeed;
        this.ramp = 0;
    }

    accelerate(): void {
        this.current = Math.min(
            this.current + FACE_SMASHING.drop.speedStep,
            FACE_SMASHING.drop.maxSpeed,
        );
    }

    update(dt: number, aim?: number): Item | null {
        this.ramp += dt;
        if (this.ramp >= FACE_SMASHING.drop.rampSeconds) {
            this.ramp -= FACE_SMASHING.drop.rampSeconds;
            this.accelerate();
        }

        this.timer += dt;

        if (this.timer < this.interval) {
            return null;
        }

        this.timer -= this.interval;
        return this.spawn(aim);
    }

    spawn(aim?: number): Item {
        return this.spawnItem(pickItem(this.options.random), aim);
    }

    spawnItem(definition: ItemDefinition, aim?: number): Item {
        const { grid } = this.options.level;
        const config = FACE_SMASHING;
        const width = definition.half.width * 2;
        const height = definition.half.height * 2;
        const margin = config.item.spawnMargin;
        const usable = Math.max(grid.width - margin * 2 - width, 1);
        const jitter = (this.options.random() * 2 - 1) * config.drop.aimJitter;
        const scatter = this.options.random() < config.drop.scatter;

        const randomX = margin + this.options.random() * usable;
        const aimedX = aim !== undefined && !scatter ? aim + jitter - width / 2 : randomX;
        const x = grid.left + Math.min(Math.max(aimedX, margin), margin + usable);
        const drift = (this.options.random() * 2 - 1) * config.item.lateralSpeed;
        const spinSpan = definition.spin.max - definition.spin.min;
        const spin = definition.spin.min + this.options.random() * spinSpan;
        const direction = this.options.random() < 0.5 ? -1 : 1;

        return new Item({
            x,
            y: this.options.level.spawnY - height,
            velocityX: drift,
            velocityY: this.current,
            definition,
            spin: spin * direction,
            damageRoll: this.options.random(),
        });
    }
}
