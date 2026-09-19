export interface SpriteSheet {
    image: HTMLImageElement;
    frameSize: number;
}

export function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Falha ao carregar imagem: ${url}`));
        image.src = url;
    });
}
