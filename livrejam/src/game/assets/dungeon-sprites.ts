import { loadImage, type SpriteSheet } from '../../engine/render';
import { FACE_SMASHING, ITEMS } from '../config';

export type PropSpriteKey = 'torch' | 'bracket';
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

export interface DungeonSprites {
    wallFace: HTMLImageElement;
    floorFace: HTMLImageElement;
    props: Record<PropSpriteKey, HTMLImageElement>;
    items: Map<string, HTMLImageElement>;
    character: CharacterTierSprites[];
    effects: Record<EffectKey, LoadedSpriteSheet>;
}

const TILE_DIR = 'assets/tiles/kenney-tiny-dungeon/Tiles';

function tilePath(index: number): string {
    return `${TILE_DIR}/tile_${index.toString().padStart(4, '0')}.png`;
}

const WALL_FACE_TILE = 42;
const FLOOR_FACE_TILE = 49;

const PROP_PATHS: Record<PropSpriteKey, string> = {
    torch: tilePath(29),
    bracket: tilePath(26),
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
    const propEntries = Object.entries(PROP_PATHS) as [PropSpriteKey, string][];
    const effectEntries = Object.entries(EFFECT_PATHS) as [EffectKey, string][];

    return Promise.all([loadManifest(), loadTerrain(propEntries, effectEntries)]).then(
        ([manifest, terrain]) =>
            Promise.all(
                manifest.character.tiers.map((tier) => loadTier(tier.path, tier.animations)),
            ).then((character) => ({ ...terrain, character })),
    );
}

interface TerrainSprites {
    wallFace: HTMLImageElement;
    floorFace: HTMLImageElement;
    props: Record<PropSpriteKey, HTMLImageElement>;
    items: Map<string, HTMLImageElement>;
    effects: Record<EffectKey, LoadedSpriteSheet>;
}

function loadTerrain(
    propEntries: readonly [PropSpriteKey, string][],
    effectEntries: readonly [EffectKey, string][],
): Promise<TerrainSprites> {
    return Promise.all([
        loadImage(tilePath(WALL_FACE_TILE)),
        loadImage(tilePath(FLOOR_FACE_TILE)),
        Promise.all(
            propEntries.map(([key, url]) => loadImage(url).then((image) => [key, image] as const)),
        ),
        Promise.all(
            ITEMS.map((item) =>
                loadImage(item.sprite).then((image) => [item.key, image] as const),
            ),
        ),
        Promise.all(
            effectEntries.map(([key, url]) =>
                loadImage(url).then(
                    (image) =>
                        [
                            key,
                            {
                                image,
                                frameSize: EFFECT_FRAME_SIZE,
                                frames: FACE_SMASHING.effects[key].frames,
                            },
                        ] as const,
                ),
            ),
        ),
    ]).then(([wallFace, floorFace, props, items, effects]) => ({
        wallFace,
        floorFace,
        props: Object.fromEntries(props) as Record<PropSpriteKey, HTMLImageElement>,
        items: new Map(items),
        effects: Object.fromEntries(effects) as Record<EffectKey, LoadedSpriteSheet>,
    }));
}
