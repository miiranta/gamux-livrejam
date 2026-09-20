export interface GradientStop {
    readonly luminance: number;
    readonly color: readonly [number, number, number];
}

export type GradientRamp = readonly GradientStop[];

const LUMINANCE_RED = 0.299;
const LUMINANCE_GREEN = 0.587;
const LUMINANCE_BLUE = 0.114;

export function luminanceOf(red: number, green: number, blue: number): number {
    return (LUMINANCE_RED * red + LUMINANCE_GREEN * green + LUMINANCE_BLUE * blue) / 255;
}

export function sampleRamp(ramp: GradientRamp, luminance: number): [number, number, number] {
    const clamped = Math.min(1, Math.max(0, luminance));
    let lower = ramp[0];
    let upper = ramp[ramp.length - 1];

    for (let index = 0; index < ramp.length - 1; index++) {
        if (clamped >= ramp[index].luminance && clamped <= ramp[index + 1].luminance) {
            lower = ramp[index];
            upper = ramp[index + 1];
            break;
        }
    }

    const span = Math.max(1e-6, upper.luminance - lower.luminance);
    const amount = (clamped - lower.luminance) / span;

    return [
        Math.round(lower.color[0] + (upper.color[0] - lower.color[0]) * amount),
        Math.round(lower.color[1] + (upper.color[1] - lower.color[1]) * amount),
        Math.round(lower.color[2] + (upper.color[2] - lower.color[2]) * amount),
    ];
}

export function toCss(red: number, green: number, blue: number, alpha = 1): string {
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function createRampLookup(ramp: GradientRamp): Uint8ClampedArray {
    const lookup = new Uint8ClampedArray(256 * 3);

    for (let level = 0; level < 256; level++) {
        const [red, green, blue] = sampleRamp(ramp, level / 255);
        lookup[level * 3] = red;
        lookup[level * 3 + 1] = green;
        lookup[level * 3 + 2] = blue;
    }

    return lookup;
}

export function applyRamp(
    image: HTMLImageElement | HTMLCanvasElement,
    ramp: GradientRamp,
): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return canvas;
    }

    ctx.drawImage(image, 0, 0);

    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = frame.data;
    const lookup = createRampLookup(ramp);

    for (let index = 0; index < data.length; index += 4) {
        if (data[index + 3] === 0) {
            continue;
        }

        const luminance =
            LUMINANCE_RED * data[index] +
            LUMINANCE_GREEN * data[index + 1] +
            LUMINANCE_BLUE * data[index + 2];
        const level = Math.min(255, Math.max(0, Math.round(luminance)));

        data[index] = lookup[level * 3];
        data[index + 1] = lookup[level * 3 + 1];
        data[index + 2] = lookup[level * 3 + 2];
    }

    ctx.putImageData(frame, 0, 0);
    return canvas;
}