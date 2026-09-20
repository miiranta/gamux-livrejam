import { valueNoise } from '../../engine/math';
import type { Camera } from '../../engine/render';
import type { DungeonLevel, ParticleEmitter, ParticleKind } from '../level';
import type { DungeonSprites } from '../assets';
import type { PropSpriteKey } from '../assets';

interface Particle {
    kind: ParticleKind;
    sprite: PropSpriteKey;
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    life: number;
    maxLife: number;
    scale: number;
    phase: number;
    spin: number;
}

const PARTICLE_SEED = 0x9e3779b1;
const CAPACITY = 180;
const TILE_PIXELS = 32;

const SPRITE: Record<ParticleKind, PropSpriteKey> = {
    dust: 'dust',
    sparkle: 'diamondFx',
    ember: 'coinFx',
};

const LIFETIME: Record<ParticleKind, number> = {
    dust: 3.6,
    sparkle: 1.8,
    ember: 1.4,
};

const SCALE: Record<ParticleKind, number> = {
    dust: 0.9,
    sparkle: 0.7,
    ember: 0.6,
};

const GRAVITY: Record<ParticleKind, number> = {
    dust: 6,
    sparkle: -14,
    ember: -20,
};

export class ParticleSystem {
    private readonly particles: Particle[] = [];
    private readonly accumulators = new Map<number, number>();
    private elapsed = 0;

    constructor(private readonly sprites: DungeonSprites) {}

    get active(): readonly Particle[] {
        return this.particles;
    }

    clear(): void {
        this.particles.length = 0;
        this.accumulators.clear();
    }

    update(level: DungeonLevel, dt: number): void {
        this.elapsed += dt;
        this.emit(level, dt);
        this.integrate(dt);
    }

    private emit(level: DungeonLevel, dt: number): void {
        for (let index = 0; index < level.decorations.emitters.length; index++) {
            const emitter = level.decorations.emitters[index];
            const pending = (this.accumulators.get(index) ?? 0) + emitter.rate * dt;
            const count = Math.floor(pending);

            this.accumulators.set(index, pending - count);

            for (let spawn = 0; spawn < count; spawn++) {
                if (this.particles.length >= CAPACITY) {
                    this.particles.shift();
                }

                this.particles.push(this.create(emitter, index, spawn));
            }
        }
    }

    private create(emitter: ParticleEmitter, emitterIndex: number, spawn: number): Particle {
        const seed = PARTICLE_SEED + emitterIndex * 977 + spawn * 131;
        const jitter = valueNoise(emitterIndex, spawn, seed) - 0.5;
        const life = LIFETIME[emitter.kind] * (0.7 + valueNoise(spawn, emitterIndex, seed) * 0.6);

        return {
            kind: emitter.kind,
            sprite: SPRITE[emitter.kind],
            x: emitter.x + jitter * emitter.spread,
            y: emitter.y + (valueNoise(spawn, 1, seed) - 0.5) * emitter.spread,
            velocityX: jitter * 18,
            velocityY: -emitter.rise * (10 + valueNoise(spawn, 3, seed) * 16),
            life,
            maxLife: life,
            scale: SCALE[emitter.kind] * (0.7 + valueNoise(spawn, 4, seed) * 0.7),
            phase: valueNoise(spawn, 5, seed) * Math.PI * 2,
            spin: (valueNoise(spawn, 6, seed) - 0.5) * 1.2,
        };
    }

    private integrate(dt: number): void {
        for (let index = this.particles.length - 1; index >= 0; index--) {
            const particle = this.particles[index];

            particle.life -= dt;

            if (particle.life <= 0) {
                this.particles.splice(index, 1);
                continue;
            }

            particle.velocityY += GRAVITY[particle.kind] * dt;
            particle.x += (particle.velocityX + Math.sin(this.elapsed * 2 + particle.phase) * 8) * dt;
            particle.y += particle.velocityY * dt;
        }
    }

    paint(ctx: CanvasRenderingContext2D, level: DungeonLevel, camera: Camera): void {
        const pixel = camera.toScreenLength(level.grid.tileSize) / TILE_PIXELS;

        for (const particle of this.particles) {
            const image = this.sprites.props.get(particle.sprite);

            if (!image) {
                continue;
            }

            const fade = Math.min(1, particle.life / Math.max(particle.maxLife * 0.4, 1e-3));
            const width = image.naturalWidth * pixel * particle.scale;
            const height = image.naturalHeight * pixel * particle.scale;

            ctx.save();
            ctx.translate(
                camera.toScreenX(particle.x),
                camera.toScreenY(particle.y),
            );
            ctx.rotate(Math.sin(this.elapsed + particle.phase) * particle.spin);
            ctx.globalAlpha = fade;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(image, -width / 2, -height / 2, width, height);
            ctx.restore();
        }
    }
}
