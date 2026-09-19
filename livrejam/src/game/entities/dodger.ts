import { Character, type CharacterOptions } from '../../engine/entities';
import { FACE_SMASHING } from '../config';

export interface DodgerOptions {
    feetX: number;
    feetY: number;
    maxSpeedX: number;
}

export class Dodger extends Character {
    jumpQueued = false;

    constructor(options: DodgerOptions) {
        const config = FACE_SMASHING.dodger;
        const characterOptions: CharacterOptions = {
            feet: { x: options.feetX, y: options.feetY },
            box: config.box,
            animation: 'walk',
            gravity: FACE_SMASHING.physics.gravity,
            maxSpeedX: options.maxSpeedX,
            accelerationX: config.accelerationX,
            dragX: config.dragX,
            jumpSpeed: config.jumpSpeed,
            maxFallSpeed: config.maxFallSpeed,
            friction: FACE_SMASHING.physics.friction,
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
    const { maxSpeedMin, maxSpeedMax } = FACE_SMASHING.dodger;
    return maxSpeedMin + random() * (maxSpeedMax - maxSpeedMin);
}
