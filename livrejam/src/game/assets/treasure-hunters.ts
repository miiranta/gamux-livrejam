import type { AutotileSet } from '../../engine/level';

export const TREASURE_HUNTERS_SHEET = 'assets/tiles/treasure-hunters/ship-terrain.png';

export const TREASURE_HUNTERS_TILE = 32;

const SHEET_COLUMNS = 19;

const cell = (row: number, column: number): number => row * SHEET_COLUMNS + column;

export const TREASURE_HUNTERS_AUTOTILE: AutotileSet = {
    columns: SHEET_COLUMNS,
    rows: 13,
    maskToIndex: {
        15: cell(2, 3),
        7: cell(2, 1),
        13: cell(2, 5),
        14: cell(1, 2),
        11: cell(3, 2),
        10: cell(5, 2),
        6: cell(1, 1),
        12: cell(1, 3),
        3: cell(3, 1),
        9: cell(3, 3),
        0: cell(2, 3),
    },
};

export const TREASURE_HUNTERS_PLATFORMS = 'assets/tiles/treasure-hunters/ship-platforms.png';

export const TREASURE_HUNTERS_PROP_BASE = 'assets/tiles/treasure-hunters/props';

export type PropSpriteKey =
    | 'barrel'
    | 'crate'
    | 'chest'
    | 'anchor'
    | 'sail'
    | 'bottles'
    | 'candle'
    | 'candleGlow'
    | 'chainBig'
    | 'chainSmall'
    | 'door'
    | 'porthole'
    | 'cannon'
    | 'spike'
    | 'coin'
    | 'skull'
    | 'dust'
    | 'dustFall'
    | 'coinFx'
    | 'diamondFx';

export interface PropSprite {
    path: string;
    width: number;
    height: number;
}

export const PROP_SPRITES: Record<PropSpriteKey, PropSprite> = {
    barrel: { path: `${TREASURE_HUNTERS_PROP_BASE}/barrel.png`, width: 26, height: 30 },
    crate: { path: `${TREASURE_HUNTERS_PROP_BASE}/crate.png`, width: 28, height: 22 },
    chest: { path: `${TREASURE_HUNTERS_PROP_BASE}/chest.png`, width: 32, height: 32 },
    anchor: { path: `${TREASURE_HUNTERS_PROP_BASE}/anchor.png`, width: 19, height: 18 },
    sail: { path: `${TREASURE_HUNTERS_PROP_BASE}/sail.png`, width: 28, height: 50 },
    bottles: { path: `${TREASURE_HUNTERS_PROP_BASE}/bottles.png`, width: 32, height: 32 },
    candle: { path: `${TREASURE_HUNTERS_PROP_BASE}/candle.png`, width: 32, height: 32 },
    candleGlow: { path: `${TREASURE_HUNTERS_PROP_BASE}/candleGlow.png`, width: 32, height: 32 },
    chainBig: { path: `${TREASURE_HUNTERS_PROP_BASE}/chainBig.png`, width: 32, height: 64 },
    chainSmall: { path: `${TREASURE_HUNTERS_PROP_BASE}/chainSmall.png`, width: 32, height: 32 },
    door: { path: `${TREASURE_HUNTERS_PROP_BASE}/door.png`, width: 64, height: 64 },
    porthole: { path: `${TREASURE_HUNTERS_PROP_BASE}/porthole.png`, width: 32, height: 32 },
    cannon: { path: `${TREASURE_HUNTERS_PROP_BASE}/cannon.png`, width: 40, height: 26 },
    spike: { path: `${TREASURE_HUNTERS_PROP_BASE}/spike.png`, width: 16, height: 16 },
    coin: { path: `${TREASURE_HUNTERS_PROP_BASE}/coin.png`, width: 16, height: 16 },
    skull: { path: `${TREASURE_HUNTERS_PROP_BASE}/skull.png`, width: 24, height: 28 },
    dust: { path: `${TREASURE_HUNTERS_PROP_BASE}/dust.png`, width: 52, height: 20 },
    dustFall: { path: `${TREASURE_HUNTERS_PROP_BASE}/dustFall.png`, width: 52, height: 20 },
    coinFx: { path: `${TREASURE_HUNTERS_PROP_BASE}/coinFx.png`, width: 16, height: 16 },
    diamondFx: { path: `${TREASURE_HUNTERS_PROP_BASE}/diamondFx.png`, width: 24, height: 24 },
};
