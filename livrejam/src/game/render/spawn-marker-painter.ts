import type { Camera } from '../../engine/render';
import { FACE_SMASHING } from '../config';
import type { DungeonLevel } from '../level';

const ARROW: readonly string[] = [
    '.............',
    '.............',
    '###.......###',
    '.###.....###.',
    '.###.....###.',
    '..###...###..',
    '..#########..',
    '...#######...',
    '...#######...',
    '....#####....',
    '....#####....',
    '.....###.....',
    '.....###.....',
    '......#......',
    '......#......',
];

const SPAN = ARROW.length;
const PAD = 1;
const GRID = SPAN + PAD * 2;
const CENTER = (GRID - 1) / 2;

let sprite: HTMLCanvasElement | null = null;

/**
 * Draws the aim pointer above the spawn point: a pixel-art navigation arrow
 * that eases towards the gesture direction instead of snapping, so hand
 * jitter is absorbed and the marker reads as a smooth dial.
 */
export class SpawnMarkerPainter {
    private angle = 0;

    reset(): void {
        this.angle = 0;
    }

    paint(
        ctx: CanvasRenderingContext2D,
        level: DungeonLevel,
        camera: Camera,
        aim: number,
        dt: number,
    ): void {
        const config = FACE_SMASHING.spawnMarker;
        const clamped = Math.max(-1, Math.min(1, aim));
        const blend = 1 - Math.exp(-dt / config.smoothingSeconds);

        this.angle += (clamped * config.maxAngle - this.angle) * blend;

        const centerX = level.grid.left + level.grid.width / 2;
        const x = camera.toScreenX(centerX);
        const y = camera.toScreenY(level.spawnY - level.grid.tileSize * 0.5);
        const distance = camera.toScreenLength(config.distance);
        const pixel = distance / SPAN;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.angle);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            arrowSprite(),
            -CENTER * pixel,
            distance - SPAN * pixel,
            GRID * pixel,
            GRID * pixel,
        );
        ctx.restore();
    }
}

function arrowSprite(): HTMLCanvasElement {
    if (sprite) {
        return sprite;
    }

    const canvas = document.createElement('canvas');
    canvas.width = GRID;
    canvas.height = GRID;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return canvas;
    }

    const config = FACE_SMASHING.spawnMarker;

    for (let row = 0; row < SPAN; row++) {
        for (let col = 0; col < SPAN; col++) {
            const x = col + PAD;
            const y = row + PAD;

            if (solid(row, col)) {
                if (!solid(row - 1, col)) {
                    ctx.fillStyle = config.highlight;
                } else if (!solid(row + 1, col)) {
                    ctx.fillStyle = config.shade;
                } else {
                    ctx.fillStyle = config.color;
                }

                ctx.fillRect(x, y, 1, 1);
                continue;
            }

            if (
                solid(row - 1, col) ||
                solid(row + 1, col) ||
                solid(row, col - 1) ||
                solid(row, col + 1)
            ) {
                ctx.fillStyle = config.outline;
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }

    sprite = canvas;
    return canvas;
}

function solid(row: number, col: number): boolean {
    return row >= 0 && row < SPAN && col >= 0 && col < SPAN && ARROW[row][col] === '#';
}
