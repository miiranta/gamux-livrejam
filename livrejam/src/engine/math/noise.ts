const DEFAULT_SEED = 0x9e3779b9;

export function valueNoise(column: number, row: number, seed = DEFAULT_SEED): number {
    let value = (column * 374761393 + row * 668265263) ^ seed;
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

export function weightedPick(noise: number, weights: readonly number[]): number {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total <= 0) {
        return 0;
    }

    let threshold = noise * total;

    for (let index = 0; index < weights.length; index++) {
        threshold -= weights[index];
        if (threshold <= 0) {
            return index;
        }
    }

    return weights.length - 1;
}