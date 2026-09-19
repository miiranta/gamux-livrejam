import { loadImage, type SpriteSheet } from '../../engine/render';
import { FACE_SMASHING } from '../config';

export type TileSpriteKey = 'wall' | 'floor';
export type FallerSpriteKey = 'smallCrate' | 'barrel' | 'bigCrate' | 'bucket' | 'orb' | 'shelf';
export type CharacterAnimationKey = 'walk' | 'run' | 'jump' | 'hurt';

export interface LoadedSpriteSheet extends SpriteSheet {
    frames: number;
}

export interface DungeonSprites {
    tiles: Record<TileSpriteKey, HTMLImageElement>;
    fallers: Record<FallerSpriteKey, HTMLImageElement>;
    character: Record<CharacterAnimationKey, LoadedSpriteSheet>;
}

const TILE_PATHS: Record<TileSpriteKey, string> = {
    wall: 'assets/tiles/kenney-tiny-dungeon/Tiles/tile_0057.png',
    floor: 'assets/tiles/kenney-tiny-dungeon/Tiles/tile_0048.png',
};

const FALLER_PATHS: Record<FallerSpriteKey, string> = {
    smallCrate: 'assets/tiles/kenney-tiny-dungeon/Tiles/tile_0073.png',
    barrel: 'assets/tiles/kenney-tiny-dungeon/Tiles/tile_0082.png',
    bigCrate: 'assets/tiles/kenney-tiny-dungeon/Tiles/tile_0089.png',
    bucket: 'assets/tiles/kenney-tiny-dungeon/Tiles/tile_0074.png',
    orb: 'assets/tiles/kenney-tiny-dungeon/Tiles/tile_0102.png',
    shelf: 'assets/tiles/kenney-tiny-dungeon/Tiles/tile_0075.png',
};

const CHARACTER_ANIMATIONS: Record<CharacterAnimationKey, number> = {
    walk: 9,
    run: 8,
    jump: 5,
    hurt: 6,
};

const CHARACTER_FRAME_SIZE = 64;

export const DAMAGE_TIER = 0;

export const FALLER_KEYS = Object.keys(FALLER_PATHS) as FallerSpriteKey[];

export const CHARACTER_CLIPS: Record<
    CharacterAnimationKey,
    { frames: number; rows: number; frameDuration: number; holdLastFrame?: boolean }
> = {
    walk: { frames: CHARACTER_ANIMATIONS.walk, rows: 4, frameDuration: 0.11 },
    run: { frames: CHARACTER_ANIMATIONS.run, rows: 4, frameDuration: 0.07 },
    jump: { frames: CHARACTER_ANIMATIONS.jump, rows: 4, frameDuration: 0.09, holdLastFrame: true },
    hurt: { frames: CHARACTER_ANIMATIONS.hurt, rows: 1, frameDuration: 0.12, holdLastFrame: true },
};

export function fallerSpriteSize(): number {
    return FACE_SMASHING.tile.size * FACE_SMASHING.tile.scale;
}

export function loadDungeonSprites(): Promise<DungeonSprites> {
    const tileEntries = Object.entries(TILE_PATHS) as [TileSpriteKey, string][];
    const fallerEntries = Object.entries(FALLER_PATHS) as [FallerSpriteKey, string][];
    const characterEntries = Object.entries(CHARACTER_ANIMATIONS) as [
        CharacterAnimationKey,
        number,
    ][];

    return Promise.all([
        Promise.all(
            tileEntries.map(([key, url]) => loadImage(url).then((image) => [key, image] as const)),
        ),
        Promise.all(
            fallerEntries.map(([key, url]) =>
                loadImage(url).then((image) => [key, image] as const),
            ),
        ),
        Promise.all(
            characterEntries.map(([key, frames]) =>
                loadImage(`assets/character/damage_${DAMAGE_TIER}/${key}.png`).then(
                    (image) => [key, { image, frameSize: CHARACTER_FRAME_SIZE, frames }] as const,
                ),
            ),
        ),
    ]).then(([tiles, fallers, character]) => ({
        tiles: Object.fromEntries(tiles) as Record<TileSpriteKey, HTMLImageElement>,
        fallers: Object.fromEntries(fallers) as Record<FallerSpriteKey, HTMLImageElement>,
        character: Object.fromEntries(character) as Record<
            CharacterAnimationKey,
            LoadedSpriteSheet
        >,
    }));
}
