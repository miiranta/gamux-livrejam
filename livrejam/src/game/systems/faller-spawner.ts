import { Faller, pickFallerSprite } from '../entities';
import type { DungeonLevel } from '../level';
import { FACE_SMASHING } from '../config';
import { fallerSpriteSize } from '../assets';

export interface SpawnerOptions {
    level: DungeonLevel;
    random: () => number;
}

export class FallerSpawner {
    private timer = 0;
    private current = FACE_SMASHING.drop.baseSpeed;

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
    }

    accelerate(): void {
        this.current = Math.min(
            this.current + FACE_SMASHING.drop.speedStep,
            FACE_SMASHING.drop.maxSpeed,
        );
    }

    update(dt: number, aim?: number): Faller | null {
        this.timer += dt;

        if (this.timer < this.interval) {
            return null;
        }

        this.timer -= this.interval;
        return this.spawn(aim);
    }

    spawn(aim?: number): Faller {
        const { grid } = this.options.level;
        const size = fallerSpriteSize();
        const margin = FACE_SMASHING.faller.spawnMargin;
        const usable = Math.max(grid.width - margin * 2 - size, 1);
        const jitter = (this.options.random() * 2 - 1) * FACE_SMASHING.drop.aimJitter;

        const randomX = margin + this.options.random() * usable;
        const aimedX = aim !== undefined ? aim + jitter - size / 2 : randomX;
        const x = grid.left + Math.min(Math.max(aimedX, margin), margin + usable);
        const drift = (this.options.random() * 2 - 1) * FACE_SMASHING.faller.lateralSpeed;

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
