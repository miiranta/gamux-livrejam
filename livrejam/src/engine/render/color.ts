export function withAlpha(color: string, alpha: number): string {
    const channels = color.match(/[\d.]+/g);
    if (!channels || channels.length < 3) {
        return color;
    }

    return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
}

export function scaleAlpha(color: string, factor: number): string {
    const channels = color.match(/[\d.]+/g);
    if (!channels || channels.length < 3) {
        return color;
    }

    const alpha = channels.length > 3 ? Number(channels[3]) : 1;
    return withAlpha(color, Math.min(1, Math.max(0, alpha * factor)));
}

const SHADE_CACHE = new Map<string, HTMLCanvasElement>();

export function tintedSilhouette(
    image: HTMLImageElement | HTMLCanvasElement,
    color: string,
): HTMLCanvasElement {
    const key = `${image.width}x${image.height}:${color}:${cacheKey(image)}`;
    const cached = SHADE_CACHE.get(key);

    if (cached) {
        return cached;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, image.width);
    canvas.height = Math.max(1, image.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return canvas;
    }

    ctx.drawImage(image, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    SHADE_CACHE.set(key, canvas);
    return canvas;
}

let imageSequence = 0;
const IMAGE_KEYS = new WeakMap<object, string>();

function cacheKey(image: HTMLImageElement | HTMLCanvasElement): string {
    const existing = IMAGE_KEYS.get(image);
    if (existing) {
        return existing;
    }

    imageSequence += 1;
    const generated = `img${imageSequence}`;
    IMAGE_KEYS.set(image, generated);
    return generated;
}

export function mirrorVertically(
    image: HTMLImageElement | HTMLCanvasElement,
): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, image.width);
    canvas.height = Math.max(1, image.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return canvas;
    }

    ctx.translate(0, canvas.height);
    ctx.scale(1, -1);
    ctx.drawImage(image, 0, 0);
    return canvas;
}