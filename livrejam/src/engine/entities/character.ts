import type { PhysicsBody } from '../physics';
import { createBody } from '../physics';

/** Lado do frame no sheet do personagem (LPC). */
export const FRAME_SIZE = 64;

/** Linhas do sheet, na ordem em que foram geradas. */
export const ROW = { up: 0, left: 1, down: 2, right: 3 } as const;

export type Facing = keyof typeof ROW;

/** Animacoes disponiveis e a quantidade de frames de cada uma. */
export const ANIMATION_FRAMES = {
    walk: 9,
    run: 8,
    jump: 5,
    hurt: 6,
} as const;

/**
 * Quantidade de linhas (direcoes) de cada sheet.
 * `hurt` e a queda/morte e so tem uma linha, independente da direcao.
 */
export const ANIMATION_ROWS = {
    walk: 4,
    run: 4,
    jump: 4,
    hurt: 1,
} as const;

export type AnimationName = keyof typeof ANIMATION_FRAMES;

/** Linha do sheet a usar para a direcao atual. */
export function animationRow(animation: AnimationName, facing: Facing): number {
    return ANIMATION_ROWS[animation] === 1 ? 0 : ROW[facing];
}

/** Caminho do sheet de cada animacao, no nivel de dano escolhido. */
export function animationSheet(damageTier: number, animation: AnimationName): string {
    return `assets/character/damage_${damageTier}/${animation}.png`;
}

/**
 * Caixa de colisao do personagem, em pixels do frame.
 * O sprite tem 64x64, mas o corpo ocupa so a parte de baixo e o centro,
 * entao a caixa e bem menor que o frame (os pes ficam em `FOOT_OFFSET`).
 */
export const BODY_BOX = { width: 24, height: 26 } as const;

/** Distancia do topo do frame ate os pes do sprite. */
export const FOOT_OFFSET = 62;

/** Deslocamento horizontal do frame ate o centro do corpo. */
export const BODY_CENTER_X = FRAME_SIZE / 2;

export interface CharacterOptions {
    /** Posicao dos pes (base da caixa de colisao), em unidades do mundo. */
    feet: { x: number; y: number };
    gravity: number;
    walkSpeed?: number;
    runSpeed?: number;
    jumpSpeed?: number;
    friction?: number;
}

export interface Character {
    /** Corpo da fisica. A posicao representa o canto superior esquerdo da caixa. */
    physics: PhysicsBody;
    facing: Facing;
    animation: AnimationName;
    /** Indice do frame atual da animacao. */
    frame: number;
    /** Tempo acumulado na animacao atual, em segundos. */
    elapsed: number;
    walkSpeed: number;
    runSpeed: number;
    jumpSpeed: number;
}

export function createCharacter(options: CharacterOptions): Character {
    const {
        feet,
        gravity,
        walkSpeed = 110,
        runSpeed = 190,
        jumpSpeed = 300,
        friction = 0.82,
    } = options;

    const physics: PhysicsBody = {
        body: createBody(
            {
                x: feet.x - BODY_BOX.width / 2,
                y: feet.y - BODY_BOX.height,
            },
            { gravity, initialVelocity: { x: 0, y: 0 } },
        ),
        size: { width: BODY_BOX.width, height: BODY_BOX.height },
        solid: true,
    };

    physics.body.friction = friction;

    return {
        physics,
        facing: 'down',
        animation: 'walk',
        frame: 0,
        elapsed: 0,
        walkSpeed,
        runSpeed,
        jumpSpeed,
    };
}

/**
 * Posicao (em unidades do mundo) onde o frame do sprite deve ser desenhado.
 * O frame e maior que a caixa de colisao, entao o desenho e ancorado pelos pes.
 */
export function spriteOrigin(character: Character): { x: number; y: number } {
    const { x, y } = character.physics.body.position;
    return {
        x: x + character.physics.size.width / 2 - BODY_CENTER_X,
        y: y + character.physics.size.height - FOOT_OFFSET,
    };
}