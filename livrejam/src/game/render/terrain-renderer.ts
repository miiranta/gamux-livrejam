import { valueNoise } from '../../engine/math';
import type { Camera } from '../../engine/render';
import { applyRamp } from '../../engine/render';
import type { CeilingKey, DungeonSprites, GroundKey, StrutKey } from '../assets';
import type { DungeonLevel } from '../level';
import { FACE_SMASHING } from '../config';

const VARIATION_SEED = 0x2545f491;
const COURSE_SEED = 0x1b873593;
const DUST_SEED = 0x85ebca6b;
const SPECK_SEED = 0x27d4eb2f;

const STRUT_WIDTH_RATIO = 1.06;

const EMPTY_TOP = 'rgba(20, 15, 26, 0.3)';
const EMPTY_MID = 'rgba(15, 11, 21, 0.52)';
const EMPTY_BOTTOM = 'rgba(9, 7, 13, 0.74)';
const STRUT_LIT = 'rgba(178, 182, 198, 0.22)';
const STRUT_CAP = 'rgba(96, 90, 108, 0.85)';
const STRUT_SHADOW = 'rgba(6, 4, 10, 0.72)';
const GROUND_LIT = 'rgba(178, 176, 190, 0.3)';
const DUST_COLOR = 'rgba(118, 106, 122, 0.42)';
const GROUND_SHADOW = 'rgba(6, 4, 10, 0.5)';
const GROUND_DEPTH = 'rgba(4, 3, 7, 0.66)';
const CEILING_SHADOW = 'rgba(4, 3, 7, 0.86)';
const CEILING_LIT = 'rgba(128, 130, 146, 0.16)';
const SPECK_COLOR = 'rgba(190, 188, 198, 0.42)';

const SPECK_COUNT_MIN = 3;
const SPECK_COUNT_MAX = 9;
const SPECK_HEIGHT_MIN = 1;
const SPECK_HEIGHT_MAX = 4;
const DUST_COUNT_MIN = 4;
const DUST_COUNT_MAX = 11;
const GROUND_INSET_RATIO = 0.16;
const DEBRIS_COUNT = 13;
const SPILL_RATIO = 0.62;

export class TerrainRenderer {
    private readonly ground: Record<GroundKey, HTMLCanvasElement>;
    private readonly ceiling: Record<CeilingKey, HTMLCanvasElement>;
    private readonly strut: Record<StrutKey, HTMLCanvasElement>;

    constructor(sprites: DungeonSprites) {
        this.ground = mapValues(sprites.ground, (image) => applyRamp(image, FACE_SMASHING.palette.floor));
        this.ceiling = mapValues(sprites.ceiling, (image) => applyRamp(image, FACE_SMASHING.palette.ceiling));
        this.strut = mapValues(sprites.strut, (image) => applyRamp(image, FACE_SMASHING.palette.wall));
    }

    paint(ctx: CanvasRenderingContext2D, level: DungeonLevel, camera: Camera): void {
        this.paintEmpty(ctx, camera);
        this.paintCeiling(ctx, level, camera);
        this.paintStruts(ctx, level, camera);
        this.paintGround(ctx, level, camera);
        this.paintGroundDebris(ctx, level, camera);
        this.paintGroundDepth(ctx, level, camera);
        this.paintCeilingDepth(ctx, level, camera);
        this.paintStrutDepth(ctx, level, camera);
    }

    private paintEmpty(ctx: CanvasRenderingContext2D, camera: Camera): void {
        const gradient = ctx.createLinearGradient(0, 0, 0, camera.viewportHeight);

        gradient.addColorStop(0, EMPTY_TOP);
        gradient.addColorStop(0.5, EMPTY_MID);
        gradient.addColorStop(1, EMPTY_BOTTOM);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);
    }

    private paintCeiling(ctx: CanvasRenderingContext2D, level: DungeonLevel, camera: Camera): void {
        const { grid } = level;
        const size = camera.toScreenLength(grid.tileSize);

        for (const piece of level.decorations.ceiling) {
            const x = camera.toScreenX(grid.columnX(piece.column));
            const y = camera.toScreenY(grid.rowY(piece.row));

            ctx.save();
            ctx.globalAlpha = brightness(piece.column, piece.row, FACE_SMASHING.backdrop.wallVariation);
            ctx.drawImage(this.ceiling[piece.kind], x, y, size, size);
            ctx.restore();
            this.paintCourses(ctx, x, y, size, piece.column, piece.row, 4);
        }
    }

    private paintStruts(ctx: CanvasRenderingContext2D, level: DungeonLevel, camera: Camera): void {
        const { grid } = level;
        const size = camera.toScreenLength(grid.tileSize);
        const columns = groupStruts(level.decorations.struts);

        for (const [column, pieces] of columns) {
            const x = camera.toScreenX(grid.columnX(column));
            const width = size * STRUT_WIDTH_RATIO;

            for (const run of contiguousRuns(pieces)) {
                const top = camera.toScreenY(grid.rowY(run[0].row));
                const bottom = camera.toScreenY(grid.rowY(run[run.length - 1].row)) + size;

                for (const piece of run) {
                    const y = camera.toScreenY(grid.rowY(piece.row));

                    ctx.save();
                    ctx.globalAlpha = brightness(column, piece.row, FACE_SMASHING.backdrop.wallVariation);
                    ctx.drawImage(this.strut[run[0].kind], x, y, width, size);
                    ctx.restore();
                    this.paintCourses(ctx, x, y, width, piece.row, column, 2);
                }

                this.paintStrutEdges(ctx, top, bottom, x, width);
                this.paintStrutCap(ctx, top, x, width);
            }
        }
    }

    private paintStrutEdges(
        ctx: CanvasRenderingContext2D,
        top: number,
        bottom: number,
        x: number,
        width: number,
    ): void {
        const litWidth = Math.max(1, width * 0.07);
        const shadeWidth = Math.max(2, width * 0.26);

        ctx.fillStyle = STRUT_LIT;
        ctx.fillRect(x + litWidth, top, litWidth, bottom - top);
        ctx.fillStyle = STRUT_SHADOW;
        ctx.fillRect(x + width - shadeWidth, top, shadeWidth, bottom - top);
    }

    private paintStrutCap(ctx: CanvasRenderingContext2D, top: number, x: number, width: number): void {
        ctx.fillStyle = STRUT_CAP;
        ctx.fillRect(x - width * 0.08, top - 2, width * 1.16, 3);
    }

    private paintGround(ctx: CanvasRenderingContext2D, level: DungeonLevel, camera: Camera): void {
        const { grid } = level;
        const size = camera.toScreenLength(grid.tileSize);

        for (const piece of level.decorations.ground) {
            const x = camera.toScreenX(grid.columnX(piece.column));
            const y = camera.toScreenY(grid.rowY(piece.row));
            const alpha = brightness(piece.column, piece.row, FACE_SMASHING.backdrop.floorVariation);

            ctx.save();
            ctx.globalAlpha = alpha * 0.42;
            ctx.drawImage(this.ground[piece.spill], x, y - size * SPILL_RATIO, size, size * SPILL_RATIO);
            ctx.globalAlpha = alpha;
            ctx.drawImage(this.ground[piece.kind], x, y, size, size);
            ctx.restore();

            this.paintGroundLit(ctx, x, y, size);
            this.paintGroundDust(ctx, x, y, size, piece.column, piece.row);
        }
    }

    private paintGroundLit(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
        const inset = Math.max(1, size * GROUND_INSET_RATIO);

        ctx.fillStyle = GROUND_LIT;
        ctx.fillRect(x + inset, y, size - inset * 2, Math.max(1, size * 0.07));
    }

    private paintGroundDust(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        size: number,
        column: number,
        row: number,
    ): void {
        const count =
            DUST_COUNT_MIN +
            Math.floor(valueNoise(column, row, DUST_SEED) * (DUST_COUNT_MAX - DUST_COUNT_MIN));

        ctx.save();
        ctx.fillStyle = DUST_COLOR;

        for (let index = 0; index < count; index++) {
            const nx = valueNoise(column * 17 + index, row, DUST_SEED);
            const ny = valueNoise(column, row * 19 + index, DUST_SEED);
            const blob = size * (0.05 + valueNoise(column + index, row, SPECK_SEED) * 0.12);

            ctx.fillRect(
                Math.round(x + nx * (size - blob)),
                Math.round(y + ny * (size - blob)),
                Math.max(1, Math.round(blob)),
                Math.max(1, Math.round(blob * 0.6)),
            );
        }

        ctx.restore();
    }

    private paintGroundDebris(
        ctx: CanvasRenderingContext2D,
        level: DungeonLevel,
        camera: Camera,
    ): void {
        const { grid } = level;
        const size = camera.toScreenLength(grid.tileSize);
        const first = grid.columnAt(level.playLeft);
        const last = grid.columnAt(level.playRight);
        const row = grid.rowAt(level.floorTop);
        const span = Math.max(1, last - first);

        ctx.save();
        ctx.fillStyle = DUST_COLOR;

        for (let index = 0; index < DEBRIS_COUNT; index++) {
            const column = first + Math.floor(valueNoise(index, 1, SPECK_SEED) * span);
            const x = camera.toScreenX(grid.columnX(column));
            const y = camera.toScreenY(grid.rowY(row));
            const offsetX = valueNoise(index, 2, SPECK_SEED) * size;
            const offsetY = valueNoise(index, 3, SPECK_SEED) * size * 0.8;
            const width = size * (0.1 + valueNoise(index, 4, SPECK_SEED) * 0.28);

            ctx.fillRect(
                Math.round(x + offsetX),
                Math.round(y + offsetY),
                Math.round(width),
                Math.max(1, Math.round(width * 0.4)),
            );
        }

        ctx.restore();
    }

    private paintGroundDepth(
        ctx: CanvasRenderingContext2D,
        level: DungeonLevel,
        camera: Camera,
    ): void {
        const { grid, floorTop, playLeft, playRight } = level;
        const x = camera.toScreenX(playLeft);
        const width = camera.toScreenLength(playRight - playLeft);
        const y = camera.toScreenY(floorTop);
        const height = camera.toScreenLength(grid.tileSize);
        const edge = Math.max(1, height * 0.08);
        const shade = Math.max(2, height * 0.26);
        const gradient = ctx.createLinearGradient(0, y, 0, y + height);

        gradient.addColorStop(0, 'rgba(255, 250, 236, 0.3)');
        gradient.addColorStop(0.16, 'rgba(255, 240, 214, 0.1)');
        gradient.addColorStop(0.42, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, GROUND_DEPTH);
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, width, height);
        ctx.fillStyle = GROUND_LIT;
        ctx.fillRect(x, y, width, edge);
        ctx.fillStyle = GROUND_SHADOW;
        ctx.fillRect(x, y + height - shade, width, shade);
    }

    private paintCeilingDepth(
        ctx: CanvasRenderingContext2D,
        level: DungeonLevel,
        camera: Camera,
    ): void {
        const { grid, playLeft, playRight } = level;
        const x = camera.toScreenX(playLeft);
        const width = camera.toScreenLength(playRight - playLeft);
        const bottom = camera.toScreenY(level.ceilingBottom);
        const edge = Math.max(2, camera.toScreenLength(grid.tileSize) * 0.1);

        ctx.fillStyle = CEILING_LIT;
        ctx.fillRect(x, bottom, width, Math.max(1, edge * 0.4));
        ctx.fillStyle = CEILING_SHADOW;
        ctx.fillRect(x, bottom + edge * 0.4, width, edge);
    }

    private paintStrutDepth(ctx: CanvasRenderingContext2D, level: DungeonLevel, camera: Camera): void {
        const { grid } = level;
        const left = camera.toScreenX(grid.left);
        const right = camera.toScreenX(grid.right);
        const top = camera.toScreenY(grid.top);
        const height = camera.toScreenLength(grid.height);
        const size = camera.toScreenLength(grid.tileSize);
        const shade = Math.max(3, size * 0.52);
        const count =
            SPECK_COUNT_MIN +
            Math.floor(valueNoise(grid.columns, grid.rows, SPECK_SEED) * (SPECK_COUNT_MAX - SPECK_COUNT_MIN));

        this.paintInnerShade(ctx, left, shade, top, height, 0.55, 1);
        this.paintInnerShade(ctx, right - shade, shade, top, height, 0.55, -1);

        ctx.fillStyle = SPECK_COLOR;
        for (let index = 0; index < count; index++) {
            const y = top + valueNoise(index, 5, SPECK_SEED) * height;
            const side = valueNoise(index, 6, SPECK_SEED) < 0.5 ? left : right - shade;
            const wide = shade * (0.1 + valueNoise(index, 7, SPECK_SEED) * 0.3);
            const tall =
                SPECK_HEIGHT_MIN +
                valueNoise(index, 9, SPECK_SEED) * (SPECK_HEIGHT_MAX - SPECK_HEIGHT_MIN);

            ctx.fillRect(
                Math.round(side + valueNoise(index, 8, SPECK_SEED) * (shade - wide)),
                Math.round(y),
                Math.max(1, Math.round(wide)),
                Math.max(1, Math.round(tall)),
            );
        }
    }

    private paintInnerShade(
        ctx: CanvasRenderingContext2D,
        x: number,
        shade: number,
        top: number,
        height: number,
        strength: number,
        direction: 1 | -1,
    ): void {
        const start = direction === 1 ? x : x + shade;
        const end = direction === 1 ? x + shade : x;
        const gradient = ctx.createLinearGradient(start, 0, end, 0);

        gradient.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 1)');
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = gradient;
        ctx.fillRect(x, top, shade, height);
        ctx.restore();
    }

    private paintCourses(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        size: number,
        column: number,
        row: number,
        courses: number,
    ): void {
        const course = size / courses;
        const offset = valueNoise(column, row, COURSE_SEED) * course;

        ctx.save();
        ctx.strokeStyle = STRUT_SHADOW;
        ctx.lineWidth = 1;

        for (let index = 0; index < courses; index++) {
            const line = Math.round(y + offset + index * course) + 0.5;

            if (line <= y || line >= y + size) {
                continue;
            }

            ctx.beginPath();
            ctx.moveTo(x, line);
            ctx.lineTo(x + size, line);
            ctx.stroke();
        }

        ctx.restore();
    }
}

function mapValues<TKey extends string>(
    source: Record<TKey, HTMLImageElement>,
    transform: (image: HTMLImageElement) => HTMLCanvasElement,
): Record<TKey, HTMLCanvasElement> {
    return Object.fromEntries(
        Object.entries(source).map(([key, image]) => [key, transform(image as HTMLImageElement)]),
    ) as Record<TKey, HTMLCanvasElement>;
}

type StrutPiece = DungeonLevel['decorations']['struts'][number];

function groupStruts(pieces: readonly StrutPiece[]): Map<number, StrutPiece[]> {
    const grouped = new Map<number, StrutPiece[]>();

    for (const piece of pieces) {
        const column = grouped.get(piece.column) ?? [];

        column.push(piece);
        grouped.set(piece.column, column);
    }

    for (const column of grouped.values()) {
        column.sort((a, b) => a.row - b.row);
    }

    return grouped;
}

function contiguousRuns(pieces: readonly StrutPiece[]): StrutPiece[][] {
    const runs: StrutPiece[][] = [];
    let current: StrutPiece[] = [];

    for (const piece of pieces) {
        const previous = current[current.length - 1];

        if (previous && piece.row !== previous.row + 1) {
            runs.push(current);
            current = [];
        }

        current.push(piece);
    }

    if (current.length > 0) {
        runs.push(current);
    }

    return runs;
}

function brightness(column: number, row: number, variation: number): number {
    return 1 - variation / 2 + valueNoise(column, row, VARIATION_SEED) * variation;
}