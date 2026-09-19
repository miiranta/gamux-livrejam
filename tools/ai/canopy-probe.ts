import { valueNoise } from '../../livrejam/src/engine/math';
import { FACE_SMASHING } from '../../livrejam/src/game/config';

const MASS_SEGMENTS = 26;
const MASS_IRREGULARITY = 0.32;
const OVERSCAN = 90;
const GATHER_X = 1.7;
const GATHER_Y = 0.85;
const width = 1440;
const height = 864;

function probe(depth: number, depths: number, count: number, seed0: number) {
    const ratio = depths <= 1 ? 0 : depth / (depths - 1);
    const topFraction = 0.34 - ratio * 0.24;
    const sizeMin = 70 - ratio * 30;
    const sizeMax = 170 - ratio * 65;
    const seed = seed0 + depth * 977;
    let minY = Infinity;
    let maxY = -Infinity;
    let minX = Infinity;
    let maxX = -Infinity;

    for (let index = 0; index < count; index++) {
        const centerX = (valueNoise(index, 1, seed) * (width + OVERSCAN * 2) - OVERSCAN) * GATHER_X - width * 0.35;
        const centerY = valueNoise(index, 2, seed) * height * topFraction * GATHER_Y - height * 0.18;
        const s = valueNoise(index, 3, seed);
        const radiusX = sizeMin + s * (sizeMax - sizeMin);
        const radiusY = radiusX * (0.5 + valueNoise(index, 4, seed) * 0.35);

        for (let segment = 0; segment < MASS_SEGMENTS; segment++) {
            const angle = (Math.PI * 2 * segment) / MASS_SEGMENTS;
            const jitter = 1 + (valueNoise(index * 31 + segment, 5, seed) - 0.5) * MASS_IRREGULARITY * 2;
            minX = Math.min(minX, centerX + Math.cos(angle) * radiusX * jitter);
            maxX = Math.max(maxX, centerX + Math.cos(angle) * radiusX * jitter);
            minY = Math.min(minY, centerY + Math.sin(angle) * radiusY * jitter);
            maxY = Math.max(maxY, centerY + Math.sin(angle) * radiusY * jitter);
        }
    }
    return { depth, seed: seed0, box: [Math.round(minX), Math.round(minY), Math.round(maxX), Math.round(maxY)], bottomFraction: (maxY / height).toFixed(2) };
}

const cfg = FACE_SMASHING.backdrop;
const depths = cfg.canopyDepths;
const out = [];
for (let d = 0; d < depths; d++) {
    out.push(probe(d, depths, cfg.canopyMassCount[Math.min(d, cfg.canopyMassCount.length - 1)], cfg.canopySeed));
}
process.stdout.write(JSON.stringify({ viewport: { width, height }, masses: out }, null, 2));
