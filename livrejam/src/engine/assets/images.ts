export type ImageMap<T extends string> = Record<T, HTMLImageElement>;

export function loadImages<T extends string>(paths: Record<T, string>): Promise<ImageMap<T>> {
    const entries = Object.entries(paths) as [T, string][];

    return Promise.all(
        entries.map(
            ([key, url]) =>
                new Promise<[T, HTMLImageElement]>((resolve, reject) => {
                    const image = new Image();
                    image.onload = () => resolve([key, image]);
                    image.onerror = () => reject(new Error(`Falha ao carregar imagem: ${url}`));
                    image.src = url;
                }),
        ),
    ).then((pairs) => Object.fromEntries(pairs) as ImageMap<T>);
}

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
