import { loadImage, type SpriteSheet } from '../../engine/render';
import { FACE_SMASHING, ITEMS } from '../config';
import { DAMAGE_LEVELS } from '../damage';
import {
    PROP_SPRITES,
    TREASURE_HUNTERS_PLATFORMS,
    TREASURE_HUNTERS_SHEET,
    TREASURE_HUNTERS_TILE,
    type PropSpriteKey,
} from './treasure-hunters';

export type CharacterAnimationKey = 'walk' | 'run' | 'jump' | 'hurt';
export type EffectKey = 'impact' | 'slash' | 'dust' | 'explosion';

export interface LoadedSpriteSheet extends SpriteSheet {
    frames: number;
}

export interface CharacterTierSprites {
    walk: LoadedSpriteSheet;
    hurt: LoadedSpriteSheet;
    run?: LoadedSpriteSheet;
    jump?: LoadedSpriteSheet;
}

export interface TerrainSprites {
    autotile: HTMLImageElement;
    platforms: HTMLImageElement;
    tileSize: number;
}

export interface DungeonSprites extends TerrainSprites {
    props: Map<PropSpriteKey, HTMLImageElement>;
    items: Map<string, HTMLImageElement>;
    character: CharacterTierSprites[];
    effects: Record<EffectKey, LoadedSpriteSheet>;
}

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
    explosion: 'assets/effects/explosion.png',
};

const EFFECT_FRAME_SIZE: Record<EffectKey, number> = {
    impact: 16,
    slash: 16,
    dust: 16,
    explosion: 40,
};

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
    return Promise.all([
        loadManifest(),
        loadTerrain(),
        loadProps(),
        loadEffects(),
        loadItems(),
    ]).then(([manifest, terrain, props, effects, items]) =>
        Promise.all(
            manifest.character.tiers.map((tier) => loadTier(tier.path, tier.animations)),
        ).then((character) => ({ ...terrain, props, effects, items, character })),
    );
}

function loadItems(): Promise<Map<string, HTMLImageElement>> {
    return Promise.all(
        ITEMS.map((item) => loadImage(item.sprite).then((image) => [item.key, image] as const)),
    ).then((loaded) => new Map(loaded));
}

function loadProps(): Promise<Map<PropSpriteKey, HTMLImageElement>> {
    const entries = Object.entries(PROP_SPRITES) as [PropSpriteKey, { path: string }][];

    return Promise.all(
        entries.map(([key, sprite]) => loadImage(sprite.path).then((image) => [key, image] as const)),
    ).then((loaded) => new Map(loaded));
}

function loadTerrain(): Promise<TerrainSprites> {
    return Promise.all([
        loadImage(TREASURE_HUNTERS_SHEET),
        loadImage(TREASURE_HUNTERS_PLATFORMS),
    ]).then(([autotile, platforms]) => ({
        autotile,
        platforms,
        tileSize: TREASURE_HUNTERS_TILE,
    }));
}

function loadEffects(): Promise<Record<EffectKey, LoadedSpriteSheet>> {
    const entries = Object.entries(EFFECT_PATHS) as [EffectKey, string][];

    return Promise.all(
        entries.map(([key, url]) =>
            loadImage(url).then(
                (image) =>
                    [
                        key,
                        {
                            image,
                            frameSize: EFFECT_FRAME_SIZE[key],
                            frames: FACE_SMASHING.effects[key].frames,
                        },
                    ] as const,
            ),
        ),
    ).then((loaded) => Object.fromEntries(loaded) as Record<EffectKey, LoadedSpriteSheet>);
}

export function damageTierCount(): number {
    return DAMAGE_LEVELS;
}
