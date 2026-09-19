import { Character, type CharacterOptions } from '../../engine/entities';
import { DUNGEON_DROP } from '../config';

export interface DodgerOptions {
    feetX: number;
    feetY: number;
    maxSpeedX: number;
}

export class Dodger extends Character {
    jumpQueued = false;

    constructor(options: DodgerOptions) {
        const config = DUNGEON_DROP.dodger;
        const characterOptions: CharacterOptions = {
            feet: { x: options.feetX, y: options.feetY },
            box: config.box,
            animation: 'walk',
            gravity: DUNGEON_DROP.physics.gravity,
            maxSpeedX: options.maxSpeedX,
            accelerationX: config.accelerationX,
            dragX: config.dragX,
            jumpSpeed: config.jumpSpeed,
            maxFallSpeed: config.maxFallSpeed,
            friction: DUNGEON_DROP.physics.friction,
        };

        super(characterOptions);
    }

    requestJump(): void {
        this.jumpQueued = true;
    }

    consumeJump(): void {
        if (this.jumpQueued && this.jump()) {
            this.jumpQueued = false;
        }
    }

    resolveAnimation(): void {
        const grounded = this.physics.body.grounded;

        if (!grounded) {
            this.setAnimation('jump');
            return;
        }

        this.setAnimation(this.horizontalSpeed > 1 ? 'run' : 'walk');
    }
}

export function randomMaxSpeed(random: () => number): number {
    const { maxSpeedMin, maxSpeedMax } = DUNGEON_DROP.dodger;
    return maxSpeedMin + random() * (maxSpeedMax - maxSpeedMin);
}
