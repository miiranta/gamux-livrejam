import { Faller, pickFallerSprite } from '../entities';
import type { DungeonLevel } from '../level';
import { DUNGEON_DROP } from '../config';
import { fallerSpriteSize } from '../assets';

export interface SpawnerOptions {
    level: DungeonLevel;
    random: () => number;
}

export class FallerSpawner {
    private timer = 0;
    private current = DUNGEON_DROP.drop.baseSpeed;

    constructor(private readonly options: SpawnerOptions) {}

    get speed(): number {
        return this.current;
    }

    get interval(): number {
        return Math.max(
            DUNGEON_DROP.drop.minInterval,
            (DUNGEON_DROP.drop.baseInterval * DUNGEON_DROP.drop.baseSpeed) / this.current,
        );
    }

    reset(): void {
        this.timer = 0;
        this.current = DUNGEON_DROP.drop.baseSpeed;
    }

    accelerate(): void {
        this.current = Math.min(
            this.current + DUNGEON_DROP.drop.speedStep,
            DUNGEON_DROP.drop.maxSpeed,
        );
    }

    update(dt: number): Faller | null {
        this.timer += dt;

        if (this.timer < this.interval) {
            return null;
        }

        this.timer -= this.interval;
        return this.spawn();
    }

    spawn(): Faller {
        const { grid } = this.options.level;
        const size = fallerSpriteSize();
        const margin = DUNGEON_DROP.faller.spawnMargin;
        const usable = Math.max(grid.width - margin * 2 - size, 1);
        const x = grid.left + margin + this.options.random() * usable;
        const drift = (this.options.random() * 2 - 1) * DUNGEON_DROP.faller.lateralSpeed;

        return new Faller({
            x,
            y: this.options.level.spawnY - size,
            velocityX: drift,
            velocityY: this.current,
            sprite: pickFallerSprite(this.options.random),
            size,
        });
    }
}