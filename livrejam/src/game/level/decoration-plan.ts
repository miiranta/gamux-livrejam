import { valueNoise } from '../../engine/math';
import { PROP_SPRITES, type PropSpriteKey } from '../assets';
import type { DungeonLevel } from './dungeon-level';

export type PropKind = PropSpriteKey;
export type PropAnchor = 'floor' | 'ceiling' | 'wall';
export type ParticleKind = 'dust' | 'sparkle' | 'ember';

export interface PropPlacement {
    kind: PropKind;
    x: number;
    y: number;
    anchor: PropAnchor;
    scale: number;
    flip: boolean;
    depth: number;
    glow: number;
    sway: number;
}

export interface ParticleEmitter {
    kind: ParticleKind;
    x: number;
    y: number;
    rate: number;
    spread: number;
    rise: number;
}

export interface DecorationPlan {
    props: PropPlacement[];
    emitters: ParticleEmitter[];
}

const PROP_SEED = 0x51ed270b;
const EMITTER_SEED = 0x2545f491;

const FLOOR_KINDS: readonly PropKind[] = ['crate', 'candle', 'bottles'];
const WALL_KINDS: readonly PropKind[] = ['cannon'];
const CEILING_KINDS: readonly PropKind[] = ['chainSmall', 'chainBig', 'chainSmall', 'chainBig'];

const FLOOR_SLOTS = 9;
const WALL_SLOTS = 4;
const CEILING_SLOTS = 7;
const CEILING_INSET = 0.06;

/** Distance from the ceiling row to the visible bottom of the beam plank. */
const BEAM_PLANK_BOTTOM = 11;

export function propSprite(kind: PropKind): { width: number; height: number } {
    const sprite = PROP_SPRITES[kind];

    return { width: sprite.width, height: sprite.height };
}

export function planDecorations(level: DungeonLevel): DecorationPlan {
    const props: PropPlacement[] = [
        ...planFloor(level),
        ...planWalls(level),
        ...planCeiling(level),
    ];

    return { props, emitters: planEmitters(level) };
}

function planFloor(level: DungeonLevel): PropPlacement[] {
    const { grid } = level;
    const tile = grid.tileSize;
    const props: PropPlacement[] = [];
    const leftBandEnd = level.playLeft + (level.playRight - level.playLeft) * 0.32;
    const rightBandStart = level.playLeft + (level.playRight - level.playLeft) * 0.68;

    for (let index = 0; index < FLOOR_SLOTS; index++) {
        const kind = FLOOR_KINDS[index % FLOOR_KINDS.length];
        const onLeft = index % 2 === 0;
        const band = onLeft ? level.playLeft : rightBandStart;
        const bandEnd = onLeft ? leftBandEnd : level.playRight;
        const jitter = valueNoise(index, 1, PROP_SEED);
        const x = band + jitter * (bandEnd - band);
        const scale = 1.05 + valueNoise(index, 2, PROP_SEED) * 0.5;
        const candle = kind === 'candle';

        props.push({
            kind,
            x,
            y: level.floorTop - tile * 0.06,
            anchor: 'floor',
            scale,
            flip: valueNoise(index, 3, PROP_SEED) < 0.5,
            depth: 2,
            glow: candle ? 0.85 : 0,
            sway: 0,
        });
    }

    return props;
}

function planWalls(level: DungeonLevel): PropPlacement[] {
    const { grid } = level;
    const tile = grid.tileSize;
    const props: PropPlacement[] = [];
    const span = level.floorTop - level.ceilingBottom;

    for (let index = 0; index < WALL_SLOTS; index++) {
        const kind = WALL_KINDS[index % WALL_KINDS.length];
        const onLeft = index % 2 === 0;
        const x = onLeft ? level.playLeft - tile * 0.25 : level.playRight + tile * 0.25;
        const slot = valueNoise(index, 4, PROP_SEED);
        const y = level.ceilingBottom + tile + slot * Math.max(span - tile * 2, tile);
        const scale = 1.2 + valueNoise(index, 5, PROP_SEED) * 0.4;

        props.push({
            kind,
            x,
            y,
            anchor: 'wall',
            scale,
            flip: !onLeft,
            depth: 1,
            glow: 0,
            sway: 0,
        });
    }

    return props;
}

function planCeiling(level: DungeonLevel): PropPlacement[] {
    const { grid } = level;
    const props: PropPlacement[] = [];
    const span = level.playRight - level.playLeft;
    const inset = span * CEILING_INSET;
    const hang = level.ceilingBottom - grid.tileSize + BEAM_PLANK_BOTTOM;

    for (let index = 0; index < CEILING_SLOTS; index++) {
        const kind = CEILING_KINDS[index % CEILING_KINDS.length];
        const x = level.playLeft + inset + valueNoise(index, 6, PROP_SEED) * (span - inset * 2);
        const scale = 0.9 + valueNoise(index, 7, PROP_SEED) * 0.7;

        props.push({
            kind,
            x,
            y: hang,
            anchor: 'ceiling',
            scale,
            flip: valueNoise(index, 8, PROP_SEED) < 0.5,
            depth: 0,
            glow: 0,
            sway: 0.5 + valueNoise(index, 9, PROP_SEED) * 0.8,
        });
    }

    return props;
}

function planEmitters(level: DungeonLevel): ParticleEmitter[] {
    const emitters: ParticleEmitter[] = [];

    for (let index = 0; index < 3; index++) {
        emitters.push({
            kind: 'sparkle',
            x: level.playLeft + valueNoise(index, 13, EMITTER_SEED) * (level.playRight - level.playLeft),
            y: level.floorTop - level.grid.tileSize * (1 + valueNoise(index, 14, EMITTER_SEED) * 2),
            rate: 0.3 + valueNoise(index, 15, EMITTER_SEED) * 0.6,
            spread: 26,
            rise: 0.6,
        });
    }

    return emitters;
}
