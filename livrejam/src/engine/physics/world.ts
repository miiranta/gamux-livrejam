import type { Aabb } from './aabb';
import { overlaps } from './aabb';
import type { Body } from './body';
import { integrate, integrateAxis } from './body';

/** Um corpo com a sua caixa de colisao, pronto para participar da simulacao. */
export interface PhysicsBody {
    body: Body;
    /** Tamanho da caixa de colisao, em unidades de mundo. */
    size: { width: number; height: number };
    /** Quando falso, o corpo atravessa tudo (ex.: durante um ataque). */
    solid: boolean;
}

/** Resultado da resolucao de um corpo contra o cenario. */
export interface CollisionResult {
    /** Encostou em algo solido abaixo e parou de cair. */
    grounded: boolean;
    /** Encostou em uma parede a esquerda ou a direita. */
    hitWall: 'left' | 'right' | null;
    /** Encostou no teto e teve a subida cancelada. */
    hitCeiling: boolean;
}

/** Extrai a AABB de colisao a partir da posicao atual do corpo. */
export function bodyBox(entry: PhysicsBody): Aabb {
    return {
        x: entry.body.position.x,
        y: entry.body.position.y,
        width: entry.size.width,
        height: entry.size.height,
    };
}

export class PhysicsWorld {
    private readonly blockers: Aabb[] = [];

    /** Adiciona uma caixa solida do cenario (parede, chao, obstaculo). */
    addBlocker(box: Aabb): void {
        this.blockers.push(box);
    }

    get blockerCount(): number {
        return this.blockers.length;
    }

    /**
     * Integra e resolve a colisao de um corpo contra o cenario.
     *
     * Cada eixo e integrado e resolvido separadamente (X e depois Y). Isso evita
     * que o corpo "grude" nas quinas e garante que o apoio no chao nao seja
     * confundido com uma parede lateral quando os dois eixos se movem no mesmo frame.
     */
    step(entry: PhysicsBody, dt: number): CollisionResult {
        const result: CollisionResult = { grounded: false, hitWall: null, hitCeiling: false };

        if (entry.solid) {
            integrateAxis(entry.body, 'x', dt);
            this.resolveAxis(entry, 'x', result);

            integrateAxis(entry.body, 'y', dt);
            this.resolveAxis(entry, 'y', result);
        } else {
            integrate(entry.body, dt);
        }

        entry.body.grounded = result.grounded;

        if (result.grounded) {
            // atrito no apoio: desacelera o corpo sem zera-lo de imediato
            entry.body.velocity.x *= entry.body.friction;
        }

        return result;
    }

    /** Empurra o corpo para fora de qualquer bloqueador que ele esteja invadindo. */
    private resolveAxis(
        entry: PhysicsBody,
        axis: 'x' | 'y',
        result: CollisionResult,
    ): void {
        for (const blocker of this.blockers) {
            // a caixa e recalculada a cada teste: resolver um bloqueador pode
            // empurrar o corpo para dentro de outro.
            const box = bodyBox(entry);

            if (!overlaps(box, blocker)) {
                continue;
            }

            if (axis === 'x') {
                if (entry.body.velocity.x > 0) {
                    entry.body.position.x = blocker.x - box.width;
                    result.hitWall = 'right';
                } else if (entry.body.velocity.x < 0) {
                    entry.body.position.x = blocker.x + blocker.width;
                    result.hitWall = 'left';
                } else {
                    continue;
                }
                entry.body.velocity.x = 0;
            } else {
                if (entry.body.velocity.y > 0) {
                    entry.body.position.y = blocker.y - box.height;
                    result.grounded = true;
                } else if (entry.body.velocity.y < 0) {
                    entry.body.position.y = blocker.y + blocker.height;
                    result.hitCeiling = true;
                } else {
                    continue;
                }
                entry.body.velocity.y = 0;
            }
        }
    }
}