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

const CEILING_KINDS: readonly PropKind[] = ['chainSmall', 'chainBig', 'chainSmall', 'chainBig', 'chainBig'];

const CEILING_SLOTS = 8;
const CEILING_INSET = 0.06;

/** Distance from the ceiling row to the visible bottom of the beam plank. */
const BEAM_PLANK_BOTTOM = 11;

export function propSprite(kind: PropKind): { width: number; height: number } {
    const sprite = PROP_SPRITES[kind];

    return { width: sprite.width, height: sprite.height };
}

export function planDecorations(level: DungeonLevel): DecorationPlan {
    return { props: planCeiling(level), emitters: [] };
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
