import type { Dodger, Item } from '../entities';
import type { DungeonLevel } from '../level';
import { FACE_SMASHING, ITEM_MAX_DAMAGE } from '../config';
import { DAMAGE_CEILING, TIER_LAST } from '../damage';

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
const GLOBAL_FEATURES = 7;
const ITEM_FEATURES = 8;
const ITEM_SLOTS = (OBSERVATION_SIZE - GLOBAL_FEATURES) / ITEM_FEATURES;

export function createObservationBuffer(): Float32Array {
    return new Float32Array(OBSERVATION_SIZE);
}

export interface ObservationContext {
    level: DungeonLevel;
    dodger: Dodger;
    items: readonly Item[];
}

export function writeObservation(target: Float32Array, context: ObservationContext): Float32Array {
    const { level, dodger, items } = context;
    const { grid } = level;
    const { body } = dodger.physics;
    const config = FACE_SMASHING;
    const span = level.playRight - level.playLeft;
    const radius = config.ai.observeRadius;
    const halfSpan = span / 2;
    const centerX = level.playLeft + halfSpan;
    const dodgerX = body.position.x + dodger.size.width / 2;
    const dodgerTop = body.position.y;

    target[0] = (dodgerX - centerX) / halfSpan;
    target[1] = body.velocity.x / Math.max(dodger.maxSpeedX, 1);
    target[2] = dodger.maxSpeedX / config.dodger.maxSpeedStart;
    target[3] = body.grounded ? 1 : 0;
    target[4] = body.velocity.y / config.dodger.maxFallSpeed;
    target[5] = dodger.damage / DAMAGE_CEILING;
    target[6] = dodger.level / TIER_LAST;

    const selected = selectThreats(items, dodgerX, dodgerTop, ITEM_SLOTS);

    for (let slot = 0; slot < ITEM_SLOTS; slot++) {
        const base = GLOBAL_FEATURES + slot * ITEM_FEATURES;
        const item = selected[slot];

        if (!item) {
            for (let feature = 0; feature < ITEM_FEATURES; feature++) {
                target[base + feature] = 0;
            }
            continue;
        }

        target[base] = 1;
        target[base + 1] = (item.centerX - dodgerX) / radius;
        target[base + 2] = (item.centerY - dodgerTop) / radius;
        target[base + 3] = item.physics.body.velocity.x / config.item.lateralSpeed;
        target[base + 4] = item.physics.body.velocity.y / config.item.maxFallSpeed;
        target[base + 5] = item.state === 'falling' ? 0 : 1;
        target[base + 6] =
            Math.max(item.definition.half.width, item.definition.half.height) / grid.tileSize;
        target[base + 7] = item.baseDamage / ITEM_MAX_DAMAGE;
    }

    return target;
}

function selectThreats(items: readonly Item[], x: number, y: number, limit: number): Item[] {
    const ranked = items
        .filter((item) => !item.expired)
        .map((item) => ({ item, score: itemThreat(item, x, y) }))
        .filter((entry) => entry.score < FACE_SMASHING.ai.observeRadius)
        .sort((a, b) => a.score - b.score);

    return ranked.slice(0, limit).map((entry) => entry.item);
}

function itemThreat(item: Item, x: number, y: number): number {
    const horizontal = Math.abs(item.centerX - x);
    const below = item.centerY - y;
    return horizontal + Math.max(below, 0);
}
