import { loadImage, type SpriteSheet } from '../../engine/render';
import { FACE_SMASHING, ITEMS } from '../config';

export type PropSpriteKey = 'torch' | 'bracket';
export type PropDecorKey = 'banner' | 'crate' | 'rubble' | 'barrel';
export type CharacterAnimationKey = 'walk' | 'run' | 'jump' | 'hurt';
export type EffectKey = 'impact' | 'slash' | 'dust';
import { DAMAGE_LEVELS } from '../damage';

export interface LoadedSpriteSheet extends SpriteSheet {
    frames: number;
}

export interface CharacterTierSprites {
    walk: LoadedSpriteSheet;
    hurt: LoadedSpriteSheet;
    run?: LoadedSpriteSheet;
    jump?: LoadedSpriteSheet;
}

export type GroundKey = 'stone' | 'grate' | 'plate' | 'rubble' | 'cobble';

export type CeilingKey = 'panel' | 'slab' | 'lattice' | 'girder';

export type StrutKey = 'pillar' | 'segment' | 'capital' | 'pier';

export interface TerrainSprites {
    ground: Record<GroundKey, HTMLImageElement>;
    ceiling: Record<CeilingKey, HTMLImageElement>;
    strut: Record<StrutKey, HTMLImageElement>;
    propDecor: Record<PropDecorKey, HTMLImageElement>;
}

export interface DungeonSprites extends TerrainSprites {
    props: Record<PropSpriteKey, HTMLImageElement>;
    items: Map<string, HTMLImageElement>;
    character: CharacterTierSprites[];
    effects: Record<EffectKey, LoadedSpriteSheet>;
}

const DUNGEON_TILE_DIR = 'assets/tiles/kenney-tiny-dungeon/Tiles';
const TOWN_TILE_DIR = 'assets/tiles/kenney-tiny-town/Tiles';

function dungeonTile(index: number): string {
    return `${DUNGEON_TILE_DIR}/tile_${index.toString().padStart(4, '0')}.png`;
}

function townTile(index: number): string {
    return `${TOWN_TILE_DIR}/tile_${index.toString().padStart(4, '0')}.png`;
}

const GROUND_TILE_PATHS: Record<GroundKey, string> = {
    stone: dungeonTile(37),
    grate: townTile(97),
    plate: dungeonTile(39),
    rubble: dungeonTile(40),
    cobble: townTile(121),
};

const CEILING_TILE_PATHS: Record<CeilingKey, string> = {
    panel: dungeonTile(36),
    slab: townTile(96),
    lattice: townTile(120),
    girder: dungeonTile(38),
};

const STRUT_TILE_PATHS: Record<StrutKey, string> = {
    pillar: dungeonTile(58),
    segment: dungeonTile(56),
    capital: dungeonTile(41),
    pier: townTile(110),
};

const PROP_PATHS: Record<PropSpriteKey, string> = {
    torch: dungeonTile(29),
    bracket: dungeonTile(26),
};

const PROP_DECOR_PATHS: Record<PropDecorKey, string> = {
    banner: dungeonTile(75),
    crate: dungeonTile(88),
    rubble: townTile(81),
    barrel: dungeonTile(86),
};

const CHARACTER_ANIMATIONS: Record<CharacterAnimationKey, number> = {
    walk: 9,
    run: 8,
    jump: 5,
    hurt: 6,
};

const OPTIONAL_ANIMATIONS: readonly CharacterAnimationKey[] = ['run', 'jump'];

const CHARACTER_MANIFEST = 'assets/character/manifest.json';

interface CharacterTierManifest {
    key: string;
    path: string;
    animations: readonly string[];
}

interface CharacterManifest {
    frame_size: number;
    character: { tiers: readonly CharacterTierManifest[] };
}

const EFFECT_PATHS: Record<EffectKey, string> = {
    impact: 'assets/effects/impact.png',
    slash: 'assets/effects/slash.png',
    dust: 'assets/effects/dust.png',
};

const EFFECT_FRAME_SIZE = 16;

const CHARACTER_FRAME_SIZE = 64;

export const FALLBACK_ANIMATION: CharacterAnimationKey = 'walk';

export const CHARACTER_CLIPS: Record<
    CharacterAnimationKey,
    { frames: number; rows: number; frameDuration: number; holdLastFrame?: boolean }
> = {
    walk: { frames: CHARACTER_ANIMATIONS.walk, rows: 4, frameDuration: 0.11 },
    run: { frames: CHARACTER_ANIMATIONS.run, rows: 4, frameDuration: 0.07 },
    jump: { frames: CHARACTER_ANIMATIONS.jump, rows: 4, frameDuration: 0.09, holdLastFrame: true },
    hurt: { frames: CHARACTER_ANIMATIONS.hurt, rows: 1, frameDuration: 0.12, holdLastFrame: true },
};

export function dropSpriteSize(): number {
    return FACE_SMASHING.tile.size * FACE_SMASHING.tile.scale;
}

function loadTier(folder: string, available: readonly string[]): Promise<CharacterTierSprites> {
    const base = `assets/character/${folder}`;
    const wanted = OPTIONAL_ANIMATIONS.filter((animation) => available.includes(animation));

    return Promise.all([
        loadImage(`${base}/walk.png`),
        loadImage(`${base}/hurt.png`),
        ...wanted.map((animation) =>
            loadImage(`${base}/${animation}.png`).then((image) => [animation, image] as const),
        ),
    ]).then(([walk, hurt, ...optional]) => {
        const tier_sprites: CharacterTierSprites = {
            walk: { image: walk, frameSize: CHARACTER_FRAME_SIZE, frames: CHARACTER_ANIMATIONS.walk },
            hurt: { image: hurt, frameSize: CHARACTER_FRAME_SIZE, frames: CHARACTER_ANIMATIONS.hurt },
        };

        for (const [animation, image] of optional as [CharacterAnimationKey, HTMLImageElement][]) {
            tier_sprites[animation] = {
                image,
                frameSize: CHARACTER_FRAME_SIZE,
                frames: CHARACTER_ANIMATIONS[animation],
            };
        }

        return tier_sprites;
    });
}

function loadManifest(): Promise<CharacterManifest> {
    return fetch(CHARACTER_MANIFEST).then((response) => {
        if (!response.ok) {
            throw new Error(`falha ao carregar ${CHARACTER_MANIFEST}`);
        }
        return response.json() as Promise<CharacterManifest>;
    });
}

export function loadDungeonSprites(): Promise<DungeonSprites> {
    return Promise.all([loadManifest(), loadTerrain(), loadEffects()]).then(([manifest, terrain, effects]) =>
        Promise.all(
            manifest.character.tiers.map((tier) => loadTier(tier.path, tier.animations)),
        ).then((character) => ({ ...terrain, effects, character })),
    );
}

interface LoadedTerrain extends TerrainSprites {
    props: Record<PropSpriteKey, HTMLImageElement>;
    items: Map<string, HTMLImageElement>;
}

function loadGroup<TKey extends string>(
    paths: Record<TKey, string>,
): Promise<Record<TKey, HTMLImageElement>> {
    const entries = Object.entries(paths) as [TKey, string][];

    return Promise.all(
        entries.map(([key, url]) => loadImage(url).then((image) => [key, image] as const)),
    ).then((loaded) => Object.fromEntries(loaded) as Record<TKey, HTMLImageElement>);
}

function loadTerrain(): Promise<LoadedTerrain> {
    return Promise.all([
        loadGroup(GROUND_TILE_PATHS),
        loadGroup(CEILING_TILE_PATHS),
        loadGroup(STRUT_TILE_PATHS),
        loadGroup(PROP_DECOR_PATHS),
        loadGroup(PROP_PATHS),
        Promise.all(
            ITEMS.map((item) => loadImage(item.sprite).then((image) => [item.key, image] as const)),
        ),
    ]).then(([ground, ceiling, strut, decor, props, items]) => ({
        ground,
        ceiling,
        strut,
        propDecor: decor,
        props,
        items: new Map(items),
    }));
}

function loadEffects(): Promise<Record<EffectKey, LoadedSpriteSheet>> {
    return loadGroup(EFFECT_PATHS).then((effects) =>
        Object.fromEntries(
            Object.entries(effects).map(([key, image]) => [
                key,
                {
                    image,
                    frameSize: EFFECT_FRAME_SIZE,
                    frames: FACE_SMASHING.effects[key as EffectKey].frames,
                },
            ]),
        ) as Record<EffectKey, LoadedSpriteSheet>,
    );
}
