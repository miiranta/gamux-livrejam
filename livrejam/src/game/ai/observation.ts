import { clamp } from '../../engine/math';
import type { SolidBox } from '../../engine/physics';
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
    dashLeft: 6,
    dashRight: 7,
    fall: 8,
    fallLeft: 9,
    fallRight: 10,
} as const;

export type DodgerAction = (typeof DODGER_ACTIONS)[keyof typeof DODGER_ACTIONS];

export interface ActionIntent {
    axis: number;
    jump: boolean;
    dash: boolean;
    fastFall: boolean;
    facing: number;
}

export function decodeAction(action: number): ActionIntent {
    switch (action) {
        case DODGER_ACTIONS.left:
            return { axis: -1, jump: false, dash: false, fastFall: false, facing: -1 };
        case DODGER_ACTIONS.right:
            return { axis: 1, jump: false, dash: false, fastFall: false, facing: 1 };
        case DODGER_ACTIONS.jump:
            return { axis: 0, jump: true, dash: false, fastFall: false, facing: 0 };
        case DODGER_ACTIONS.jumpLeft:
            return { axis: -1, jump: true, dash: false, fastFall: false, facing: -1 };
        case DODGER_ACTIONS.jumpRight:
            return { axis: 1, jump: true, dash: false, fastFall: false, facing: 1 };
        case DODGER_ACTIONS.dashLeft:
            return { axis: -1, jump: false, dash: true, fastFall: false, facing: -1 };
        case DODGER_ACTIONS.dashRight:
            return { axis: 1, jump: false, dash: true, fastFall: false, facing: 1 };
        case DODGER_ACTIONS.fall:
            return { axis: 0, jump: false, dash: false, fastFall: true, facing: 0 };
        case DODGER_ACTIONS.fallLeft:
            return { axis: -1, jump: false, dash: false, fastFall: true, facing: -1 };
        case DODGER_ACTIONS.fallRight:
            return { axis: 1, jump: false, dash: false, fastFall: true, facing: 1 };
        default:
            return { axis: 0, jump: false, dash: false, fastFall: false, facing: 0 };
    }
}

const OBSERVATION_SIZE = FACE_SMASHING.ai.observationSize;
const GLOBAL_FEATURES = 13;
const ITEM_FEATURES = 8;
const ITEM_SLOTS = (OBSERVATION_SIZE - GLOBAL_FEATURES) / ITEM_FEATURES;
const SENSOR_REACH = FACE_SMASHING.ai.sensorReach;

export function createObservationBuffer(): Float32Array {
    return new Float32Array(OBSERVATION_SIZE);
}

export interface ObservationContext {
    level: DungeonLevel;
    dodger: Dodger;
    items: readonly Item[];
    blockers?: readonly SolidBox[];
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
    target[7] = 1 - dodger.dashCooldownRatio;
    target[8] = clamp(dodger.stun / config.reaction.stunSeconds, 0, 1);

    const sensors = senseCollisions(context.blockers ?? level.colliders, gapBox(dodger));
    for (let index = 0; index < SENSOR_FEATURES.length; index++) {
        target[9 + index] = Math.min(sensors[SENSOR_FEATURES[index]] / SENSOR_REACH, 1);
    }

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
        target[base + 3] = item.physics.body.velocity.x / config.drop.steerSpeed;
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
        .filter((item) => !item.expired && item.state !== 'settled')
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

interface GapBox {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

type SensorName = (typeof SENSOR_FEATURES)[number];

const SENSOR_FEATURES = ['wallLeft', 'wallRight', 'ceiling', 'ground'] as const;

function gapBox(dodger: Dodger): GapBox {
    const { position } = dodger.physics.body;
    return {
        left: position.x,
        right: position.x + dodger.size.width,
        top: position.y,
        bottom: position.y + dodger.size.height,
    };
}

function senseCollisions(
    blockers: readonly SolidBox[],
    box: GapBox,
): Record<SensorName, number> {
    const result: Record<SensorName, number> = {
        wallLeft: SENSOR_REACH,
        wallRight: SENSOR_REACH,
        ceiling: SENSOR_REACH,
        ground: SENSOR_REACH,
    };

    const overlapVertical = (blocker: SolidBox): boolean =>
        box.top < blocker.y + blocker.height && box.bottom > blocker.y;
    const overlapHorizontal = (blocker: SolidBox): boolean =>
        box.left < blocker.x + blocker.width && box.right > blocker.x;

    for (const blocker of blockers) {
        const right = blocker.x + blocker.width;
        const bottom = blocker.y + blocker.height;

        if (overlapVertical(blocker)) {
            if (right <= box.left) {
                result.wallLeft = Math.min(result.wallLeft, box.left - right);
            }

            if (blocker.x >= box.right) {
                result.wallRight = Math.min(result.wallRight, blocker.x - box.right);
            }
        }

        if (overlapHorizontal(blocker)) {
            if (bottom <= box.top) {
                result.ceiling = Math.min(result.ceiling, box.top - bottom);
            }

            if (blocker.y >= box.bottom) {
                result.ground = Math.min(result.ground, blocker.y - box.bottom);
            }
        }
    }

    return result;
}
