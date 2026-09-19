import { clamp } from '../../engine/math';

const LEVELS = 8;
const PER_LEVEL = 500;
const CEILING = LEVELS * PER_LEVEL;

export function damageLevel(damage: number): number {
    return clamp(Math.floor(damage / PER_LEVEL), 0, LEVELS - 1);
}

export function damageProgress(damage: number): number {
    return clamp((damage % PER_LEVEL) / PER_LEVEL, 0, 1);
}

export function nextTierDamage(damage: number): number {
    const level = damageLevel(damage);
    return Math.min((level + 1) * PER_LEVEL, CEILING);
}

export function damageScale(level: number, start: number, end: number): number {
    const ratio = clamp(level, 0, LEVELS - 1) / (LEVELS - 1);
    return start + (end - start) * ratio;
}

export const DAMAGE_LEVELS = LEVELS;
export const DAMAGE_PER_LEVEL = PER_LEVEL;
export const DAMAGE_CEILING = CEILING;
export const TIER_LAST = LEVELS - 1;
