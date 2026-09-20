export interface SpriteFxState {
    offsetX: number;
    offsetY: number;
    scaleX: number;
    scaleY: number;
    skewX: number;
    rotation: number;
    flash: number;
    outline: number;
}

export interface SpriteFxOptions {
    flashColor?: string;
    outlineColor?: string;
}

export const IDENTITY_FX: SpriteFxState = {
    offsetX: 0,
    offsetY: 0,
    scaleX: 1,
    scaleY: 1,
    skewX: 0,
    rotation: 0,
    flash: 0,
    outline: 0,
};

const DEFAULT_FLASH = '#ffffff';
const DEFAULT_OUTLINE = '#0a0710';

export function createFxState(): SpriteFxState {
    return { ...IDENTITY_FX };
}

export function resetFx(state: SpriteFxState): void {
    Object.assign(state, IDENTITY_FX);
}

export function applyFx(
    ctx: CanvasRenderingContext2D,
    state: SpriteFxState,
    centerX: number,
    centerY: number,
): void {
    ctx.translate(centerX + state.offsetX, centerY + state.offsetY);
    ctx.rotate(state.rotation);
    ctx.transform(state.scaleX, 0, state.skewX, state.scaleY, 0, 0);
    ctx.translate(-centerX, -centerY);
}

export function flashColorOf(state: SpriteFxState, options: SpriteFxOptions): string | null {
    if (state.flash <= 0) {
        return null;
    }

    return options.flashColor ?? DEFAULT_FLASH;
}

export function outlineColorOf(state: SpriteFxState, options: SpriteFxOptions): string | null {
    if (state.outline <= 0) {
        return null;
    }

    return options.outlineColor ?? DEFAULT_OUTLINE;
}

export function decay(value: number, rate: number, dt: number): number {
    return Math.max(0, value - rate * dt);
}

export function springTo(
    current: number,
    target: number,
    velocity: number,
    stiffness: number,
    damping: number,
    dt: number,
): { value: number; velocity: number } {
    const acceleration = (target - current) * stiffness - velocity * damping;
    const nextVelocity = velocity + acceleration * dt;

    return { value: current + nextVelocity * dt, velocity: nextVelocity };
}

export function wobble(amplitude: number, frequency: number, elapsed: number, phase = 0): number {
    return Math.sin(elapsed * frequency * Math.PI * 2 + phase) * amplitude;
}

export function waveOffset(
    amplitude: number,
    frequency: number,
    elapsed: number,
    position: number,
    phase = 0,
): number {
    return Math.sin(elapsed * frequency * Math.PI * 2 + position * Math.PI * 2 + phase) * amplitude;
}

export function shakeOffset(
    amplitude: number,
    frequency: number,
    elapsed: number,
    seed: number,
): { x: number; y: number } {
    const step = Math.floor(elapsed * frequency);
    const x = hashUnit(step, seed) * 2 - 1;
    const y = hashUnit(step, seed + 0x9e3779b9) * 2 - 1;

    return { x: x * amplitude, y: y * amplitude };
}

function hashUnit(value: number, seed: number): number {
    let mixed = (value * 374761393 + seed) ^ seed;
    mixed = Math.imul(mixed ^ (mixed >>> 13), 1274126177);

    return ((mixed ^ (mixed >>> 16)) >>> 0) / 4294967296;
}