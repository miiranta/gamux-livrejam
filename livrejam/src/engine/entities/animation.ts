import type { AnimationName } from './character';
import { ANIMATION_FRAMES } from './character';

/** Informa como o personagem foi controlado neste frame. */
export interface Intent {
    /** Direcao horizontal pedida: -1 (esquerda), 0 ou 1 (direita). */
    moveX: number;
    /** Pediu para correr. */
    run: boolean;
    /** Pediu para pular (apenas no instante do toque). */
    jump: boolean;
}

export const IDLE_INTENT: Intent = { moveX: 0, run: false, jump: false };

/** Duracao de um frame de cada animacao, em segundos. */
const FRAME_DURATION: Record<AnimationName, number> = {
    walk: 0.11,
    run: 0.07,
    jump: 0.09,
    hurt: 0.12,
};

/** Animacoes tocadas uma vez e que seguram no ultimo frame. */
const HOLD_LAST_FRAME: ReadonlySet<AnimationName> = new Set<AnimationName>(['hurt', 'jump']);

export function frameDuration(animation: AnimationName): number {
    return FRAME_DURATION[animation];
}

export function frameCount(animation: AnimationName): number {
    return ANIMATION_FRAMES[animation];
}

/**
 * Escolhe a animacao coerente com o estado fisico e o intent do jogador.
 *
 * - `hurt` prende o personagem ate a animacao terminar;
 * - no ar, sempre `jump`;
 * - parado no chao, a caminhada fica congelada no primeiro frame (pose de idle);
 * - em movimento, `run` ou `walk` conforme o intent.
 */
export function resolveAnimation(
    current: AnimationName,
    intent: Intent,
    grounded: boolean,
    moving: boolean,
): AnimationName {
    if (current === 'hurt') {
        return 'hurt';
    }

    if (!grounded) {
        return 'jump';
    }

    if (!moving) {
        return 'walk';
    }

    return intent.run ? 'run' : 'walk';
}

/**
 * Avanca o tempo da animacao. Animacoes que seguram o ultimo frame param nele
 * (`finished` vira true); as demais ciclam.
 */
export function advance(
    animation: AnimationName,
    frame: number,
    elapsed: number,
    dt: number,
): { frame: number; elapsed: number; finished: boolean } {
    const total = frameCount(animation);
    const duration = frameDuration(animation);
    const holds = HOLD_LAST_FRAME.has(animation);

    let nextElapsed = elapsed + dt;
    let nextFrame = frame;
    let finished = false;

    while (nextElapsed >= duration) {
        nextElapsed -= duration;
        nextFrame += 1;

        if (nextFrame >= total) {
            if (holds) {
                nextFrame = total - 1;
                finished = true;
                break;
            }
            nextFrame = 0;
        }
    }

    return { frame: nextFrame, elapsed: finished ? 0 : nextElapsed, finished };
}