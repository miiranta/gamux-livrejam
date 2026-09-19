import type { Dodger } from '../entities';
import type { Faller } from '../entities';
import type { DungeonLevel } from '../level';
import { FACE_SMASHING } from '../config';

export const DODGER_ACTIONS = {
    none: 0,
    left: 1,
    right: 2,
    jump: 3,
    jumpLeft: 4,
    jumpRight: 5,
} as const;

export type DodgerAction = (typeof DODGER_ACTIONS)[keyof typeof DODGER_ACTIONS];

export interface ActionIntent {
    axis: number;
    jump: boolean;
}

export function decodeAction(action: number): ActionIntent {
    switch (action) {
        case DODGER_ACTIONS.left:
            return { axis: -1, jump: false };
        case DODGER_ACTIONS.right:
            return { axis: 1, jump: false };
        case DODGER_ACTIONS.jump:
            return { axis: 0, jump: true };
        case DODGER_ACTIONS.jumpLeft:
            return { axis: -1, jump: true };
        case DODGER_ACTIONS.jumpRight:
            return { axis: 1, jump: true };
        default:
            return { axis: 0, jump: false };
    }
}

const OBSERVATION_SIZE = FACE_SMASHING.ai.observationSize;
const FALLER_FEATURES = 7;
const GLOBAL_FEATURES = 3;

export function createObservationBuffer(): Float32Array {
    return new Float32Array(OBSERVATION_SIZE);
}

export interface ObservationContext {
    level: DungeonLevel;
    dodger: Dodger;
    fallers: readonly Faller[];
}

export function writeObservation(target: Float32Array, context: ObservationContext): Float32Array {
    const { level, dodger, fallers } = context;
    const { grid } = level;
    const { body } = dodger.physics;
    const span = level.playRight - level.playLeft;
    const radius = FACE_SMASHING.ai.observeRadius;
    const maxSpeed = Math.max(dodger.maxSpeedX, 1);

    const halfSpan = span / 2;
    const centerX = level.playLeft + halfSpan;

    target[0] = (body.position.x + dodger.size.width / 2 - centerX) / halfSpan;
    target[1] = body.velocity.x / maxSpeed;
    target[2] = dodger.maxSpeedX / FACE_SMASHING.dodger.maxSpeedMax;

    const slots = (OBSERVATION_SIZE - GLOBAL_FEATURES) / FALLER_FEATURES;
    const dodgerX = body.position.x + dodger.size.width / 2;
    const dodgerTop = body.position.y;
    const selected = selectNearest(fallers, dodgerX, dodgerTop, slots);

    for (let slot = 0; slot < slots; slot++) {
        const base = GLOBAL_FEATURES + slot * FALLER_FEATURES;
        const faller = selected[slot];

        if (!faller) {
            for (let feature = 0; feature < FALLER_FEATURES; feature++) {
                target[base + feature] = 0;
            }
            continue;
        }

        const dx = faller.centerX - dodgerX;
        const dy = faller.centerY - dodgerTop;

        target[base] = 1;
        target[base + 1] = dx / radius;
        target[base + 2] = dy / radius;
        target[base + 3] = faller.physics.body.velocity.x / FACE_SMASHING.faller.lateralSpeed;
        target[base + 4] = faller.physics.body.velocity.y / FACE_SMASHING.faller.maxFallSpeed;
        target[base + 5] = faller.state === 'falling' ? 0 : 1;
        target[base + 6] = faller.size / grid.tileSize;
    }

    return target;
}

function selectNearest(fallers: readonly Faller[], x: number, y: number, limit: number): Faller[] {
    const ranked = fallers
        .filter((faller) => !faller.expired)
        .map((faller) => ({
            faller,
            score: fallerThreat(faller, x, y),
        }))
        .filter((entry) => entry.score < FACE_SMASHING.ai.observeRadius)
        .sort((a, b) => a.score - b.score);

    return ranked.slice(0, limit).map((entry) => entry.faller);
}

function fallerThreat(faller: Faller, x: number, y: number): number {
    const horizontal = Math.abs(faller.centerX - x);
    const below = faller.centerY - y;
    return horizontal + Math.max(below, 0);
}
