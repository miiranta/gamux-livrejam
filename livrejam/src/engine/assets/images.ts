export type ImageMap<T extends string> = Record<T, HTMLImageElement>;

export function drawSprite(
    ctx: CanvasRenderingContext2D,
    sheet: HTMLImageElement,
    column: number,
    row: number,
    frameSize: number,
    originX: number,
    originY: number,
): void {
    ctx.drawImage(
        sheet,
        column * frameSize,
        row * frameSize,
        frameSize,
        frameSize,
        Math.round(originX),
        Math.round(originY),
        frameSize,
        frameSize,
    );
}
