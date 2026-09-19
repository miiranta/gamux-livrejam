export interface ItemDamageRange {
    readonly min: number;
    readonly max: number;
}

export interface ItemExtent {
    readonly width: number;
    readonly height: number;
}

export interface ItemSpinRange {
    readonly min: number;
    readonly max: number;
}

export interface ItemDefinition {
    readonly key: string;
    readonly sprite: string;
    readonly damage: ItemDamageRange;
    readonly weight: number;
    readonly half: ItemExtent;
    readonly spin: ItemSpinRange;
    readonly restitution: number;
    readonly angularDamping: number;
    readonly linearDamping: number;
}

export const ITEMS: readonly ItemDefinition[] = [
    {
        key: 'dagger',
        sprite: 'assets/items/kit-12.png',
        damage: { min: 4.0, max: 12.0 },
        weight: 12.0,
        half: { width: 8.5, height: 8.5 },
        spin: { min: 9.0, max: 17.0 },
        restitution: 0.42,
        angularDamping: 3.4,
        linearDamping: 3.0,
    },
    {
        key: 'shuriken',
        sprite: 'assets/items/kit-13.png',
        damage: { min: 4.0, max: 11.0 },
        weight: 10.0,
        half: { width: 8.5, height: 8.93 },
        spin: { min: 12.0, max: 21.0 },
        restitution: 0.46,
        angularDamping: 2.6,
        linearDamping: 2.2,
    },
    {
        key: 'dart',
        sprite: 'assets/items/kit-25.png',
        damage: { min: 4.0, max: 10.0 },
        weight: 10.0,
        half: { width: 9.35, height: 8.92 },
        spin: { min: 11.0, max: 19.0 },
        restitution: 0.44,
        angularDamping: 3.0,
        linearDamping: 2.4,
    },
    {
        key: 'knife',
        sprite: 'assets/items/kit-23.png',
        damage: { min: 5.0, max: 14.0 },
        weight: 11.0,
        half: { width: 8.93, height: 8.93 },
        spin: { min: 8.0, max: 15.0 },
        restitution: 0.4,
        angularDamping: 3.6,
        linearDamping: 3.2,
    },
    {
        key: 'arrow',
        sprite: 'assets/items/kit-26.png',
        damage: { min: 4.0, max: 11.0 },
        weight: 9.0,
        half: { width: 13.18, height: 12.75 },
        spin: { min: 10.0, max: 18.0 },
        restitution: 0.38,
        angularDamping: 3.2,
        linearDamping: 2.8,
    },
    {
        key: 'bucket',
        sprite: 'assets/items/tile-0074.png',
        damage: { min: 6.0, max: 15.0 },
        weight: 10.0,
        half: { width: 8.5, height: 8.5 },
        spin: { min: 14.0, max: 24.0 },
        restitution: 0.5,
        angularDamping: 3.0,
        linearDamping: 2.6,
    },
    {
        key: 'torchThrow',
        sprite: 'assets/items/tile-0029.png',
        damage: { min: 7.0, max: 16.0 },
        weight: 10.0,
        half: { width: 8.5, height: 8.5 },
        spin: { min: 12.0, max: 22.0 },
        restitution: 0.44,
        angularDamping: 3.4,
        linearDamping: 3.0,
    },
    {
        key: 'hatchet',
        sprite: 'assets/items/axes-00.png',
        damage: { min: 8.0, max: 20.0 },
        weight: 9.0,
        half: { width: 6.38, height: 10.62 },
        spin: { min: 6.0, max: 12.0 },
        restitution: 0.34,
        angularDamping: 4.4,
        linearDamping: 4.0,
    },
    {
        key: 'orb',
        sprite: 'assets/items/tile-0102.png',
        damage: { min: 9.0, max: 21.0 },
        weight: 9.0,
        half: { width: 8.5, height: 8.5 },
        spin: { min: 8.0, max: 15.0 },
        restitution: 0.55,
        angularDamping: 2.4,
        linearDamping: 2.0,
    },
    {
        key: 'runeStone',
        sprite: 'assets/items/tile-0103.png',
        damage: { min: 10.0, max: 22.0 },
        weight: 9.0,
        half: { width: 8.5, height: 8.5 },
        spin: { min: 7.0, max: 13.0 },
        restitution: 0.48,
        angularDamping: 2.6,
        linearDamping: 2.2,
    },
    {
        key: 'crateSmall',
        sprite: 'assets/items/tile-0073.png',
        damage: { min: 12.0, max: 25.0 },
        weight: 10.0,
        half: { width: 8.5, height: 8.5 },
        spin: { min: 5.0, max: 10.0 },
        restitution: 0.38,
        angularDamping: 4.6,
        linearDamping: 4.2,
    },
    {
        key: 'barrel',
        sprite: 'assets/items/tile-0082.png',
        damage: { min: 14.0, max: 28.0 },
        weight: 9.0,
        half: { width: 8.5, height: 8.5 },
        spin: { min: 4.5, max: 9.0 },
        restitution: 0.34,
        angularDamping: 4.8,
        linearDamping: 4.4,
    },
    {
        key: 'crateBig',
        sprite: 'assets/items/tile-0089.png',
        damage: { min: 16.0, max: 32.0 },
        weight: 8.0,
        half: { width: 8.5, height: 8.5 },
        spin: { min: 4.0, max: 8.0 },
        restitution: 0.3,
        angularDamping: 5.0,
        linearDamping: 4.6,
    },
    {
        key: 'shelf',
        sprite: 'assets/items/tile-0094.png',
        damage: { min: 18.0, max: 34.0 },
        weight: 7.0,
        half: { width: 8.5, height: 8.5 },
        spin: { min: 3.6, max: 7.5 },
        restitution: 0.28,
        angularDamping: 5.2,
        linearDamping: 4.8,
    },
    {
        key: 'hammer',
        sprite: 'assets/items/kit-00.png',
        damage: { min: 11.0, max: 28.0 },
        weight: 9.0,
        half: { width: 11.9, height: 12.32 },
        spin: { min: 6.0, max: 11.0 },
        restitution: 0.3,
        angularDamping: 4.8,
        linearDamping: 4.4,
    },
    {
        key: 'club',
        sprite: 'assets/items/kit-02.png',
        damage: { min: 9.0, max: 22.0 },
        weight: 8.0,
        half: { width: 13.6, height: 11.05 },
        spin: { min: 5.0, max: 10.0 },
        restitution: 0.28,
        angularDamping: 4.6,
        linearDamping: 4.2,
    },
    {
        key: 'sword',
        sprite: 'assets/items/kit-14.png',
        damage: { min: 10.0, max: 26.0 },
        weight: 8.0,
        half: { width: 14.45, height: 14.03 },
        spin: { min: 5.0, max: 10.0 },
        restitution: 0.26,
        angularDamping: 4.0,
        linearDamping: 3.6,
    },
    {
        key: 'scimitar',
        sprite: 'assets/items/kit-16.png',
        damage: { min: 9.0, max: 24.0 },
        weight: 7.0,
        half: { width: 12.75, height: 15.3 },
        spin: { min: 4.5, max: 9.0 },
        restitution: 0.24,
        angularDamping: 4.2,
        linearDamping: 3.8,
    },
    {
        key: 'spear',
        sprite: 'assets/items/kit-17.png',
        damage: { min: 11.0, max: 27.0 },
        weight: 7.0,
        half: { width: 13.18, height: 13.18 },
        spin: { min: 4.0, max: 8.0 },
        restitution: 0.22,
        angularDamping: 4.6,
        linearDamping: 4.2,
    },
    {
        key: 'longsword',
        sprite: 'assets/items/kit-24.png',
        damage: { min: 14.0, max: 34.0 },
        weight: 6.0,
        half: { width: 15.3, height: 15.3 },
        spin: { min: 3.6, max: 7.5 },
        restitution: 0.22,
        angularDamping: 4.4,
        linearDamping: 4.0,
    },
    {
        key: 'battleaxe',
        sprite: 'assets/items/kit-08.png',
        damage: { min: 16.0, max: 40.0 },
        weight: 6.0,
        half: { width: 12.32, height: 12.75 },
        spin: { min: 3.2, max: 7.0 },
        restitution: 0.2,
        angularDamping: 5.0,
        linearDamping: 4.6,
    },
    {
        key: 'axe',
        sprite: 'assets/items/kit-05.png',
        damage: { min: 18.0, max: 44.0 },
        weight: 5.0,
        half: { width: 14.88, height: 13.17 },
        spin: { min: 3.0, max: 6.5 },
        restitution: 0.18,
        angularDamping: 5.2,
        linearDamping: 4.8,
    },
    {
        key: 'labrys',
        sprite: 'assets/items/axes-05.png',
        damage: { min: 22.0, max: 52.0 },
        weight: 4.0,
        half: { width: 11.48, height: 14.03 },
        spin: { min: 2.6, max: 5.5 },
        restitution: 0.16,
        angularDamping: 5.4,
        linearDamping: 5.0,
    },
    {
        key: 'greatAxe',
        sprite: 'assets/items/kit-04.png',
        damage: { min: 26.0, max: 62.0 },
        weight: 4.0,
        half: { width: 19.5, height: 19.08 },
        spin: { min: 2.2, max: 5.0 },
        restitution: 0.14,
        angularDamping: 5.8,
        linearDamping: 5.4,
    },
    {
        key: 'warHammer',
        sprite: 'assets/items/kit-10.png',
        damage: { min: 30.0, max: 70.0 },
        weight: 3.0,
        half: { width: 18.27, height: 18.27 },
        spin: { min: 1.8, max: 4.4 },
        restitution: 0.12,
        angularDamping: 6.2,
        linearDamping: 5.8,
    },
];

export type ItemKey = (typeof ITEMS)[number]['key'];

export const ITEM_WEIGHT_TOTAL = ITEMS.reduce((total, item) => total + item.weight, 0);

export const ITEM_MAX_DAMAGE = ITEMS.reduce(
    (highest, item) => Math.max(highest, item.damage.max),
    0,
);

export const ITEM_MIN_DAMAGE = ITEMS.reduce(
    (lowest, item) => Math.min(lowest, item.damage.min),
    Infinity,
);

export const ITEM_MAX_EXTENT = ITEMS.reduce(
    (largest, item) => Math.max(largest, item.half.width, item.half.height),
    0,
);

export const ITEM_MAX_SPIN = ITEMS.reduce(
    (highest, item) => Math.max(highest, item.spin.max),
    0,
);
