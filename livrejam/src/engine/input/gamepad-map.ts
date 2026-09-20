/**
 * Standard-gamepad support (W3C "standard" mapping): the button/axis indices
 * every modern pad reports, plus a sampler that turns a set of bindings into
 * the same `isDown` view {@link KeyboardActionMap} exposes.
 *
 * The pad list comes from a {@link GamepadProvider} that defaults to
 * `navigator.getGamepads()`, so tests inject a fake instead of stubbing the
 * global.
 */

/**
 * Button indices of the W3C standard mapping, named by position on the pad
 * rather than by vendor letter, because the letters swap between layouts.
 */
export const GAMEPAD_BUTTON = {
    /** Bottom of the right-hand diamond — "A" on Xbox, "B" on Nintendo. */
    bottom: 0,
    /** Right of the diamond — "B" on Xbox, "A" on Nintendo. */
    right: 1,
    /** Left of the diamond — "X" on Xbox, "Y" on Nintendo. */
    left: 2,
    /** Top of the diamond — "Y" on Xbox, "X" on Nintendo. */
    top: 3,
    leftBumper: 4,
    rightBumper: 5,
    leftTrigger: 6,
    rightTrigger: 7,
    back: 8,
    start: 9,
    leftStick: 10,
    rightStick: 11,
    dpadUp: 12,
    dpadDown: 13,
    dpadLeft: 14,
    dpadRight: 15,
} as const;

/** Axis indices of the W3C standard mapping. */
export const GAMEPAD_AXIS = {
    leftX: 0,
    leftY: 1,
    rightX: 2,
    rightY: 3,
} as const;

export interface GamepadButtonSnapshot {
    readonly pressed: boolean;
    readonly value: number;
}

/** The slice of `Gamepad` this module needs, so tests can build plain objects. */
export interface GamepadSnapshot {
    readonly connected?: boolean;
    readonly axes: readonly number[];
    readonly buttons: readonly GamepadButtonSnapshot[];
}

export type GamepadProvider = () => readonly (GamepadSnapshot | null)[];

/** `[negative, positive]` actions for one axis; `null` leaves a direction free. */
export type GamepadAxisBinding<TAction extends string> = readonly [TAction | null, TAction | null];

export interface GamepadStickBinding<TAction extends string> {
    axisX: number;
    axisY: number;
    x: GamepadAxisBinding<TAction>;
    /**
     * Optional: leave it out for a stick that must not trigger anything when
     * pushed up or down, so far-off-centre sticks never fire a stray action.
     */
    y?: GamepadAxisBinding<TAction>;
}

/** `[buttonIndex, action]` for one d-pad direction. */
export type GamepadDpadDirection<TAction extends string> = readonly [number, TAction | null];

export interface GamepadDpadBinding<TAction extends string> {
    x: { negative: GamepadDpadDirection<TAction>; positive: GamepadDpadDirection<TAction> };
    y: { negative: GamepadDpadDirection<TAction>; positive: GamepadDpadDirection<TAction> };
}

export interface GamepadBindings<TAction extends string> {
    sticks?: readonly GamepadStickBinding<TAction>[];
    dpads?: readonly GamepadDpadBinding<TAction>[];
    /** Button index -> action. */
    buttons?: Readonly<Record<number, TAction>>;
}

const PRESS_THRESHOLD = 0.5;
const DEFAULT_DEAD_ZONE = 0.5;

/**
 * Reads every connected pad and exposes the actions they are holding, with
 * the same edge detection (`pressed`) as a fresh key press.
 *
 * Games are frame-driven, so {@link sample} must be called once per frame
 * before reading; `isDown`/`pressed` only ever answer for the last sample.
 */
export class Gamepads<TAction extends string> {
    private readonly down = new Set<TAction>();
    private readonly previous = new Set<TAction>();

    constructor(
        private readonly bindings: GamepadBindings<TAction>,
        private readonly provider: GamepadProvider = browserGamepadProvider,
        private readonly deadZone: number = DEFAULT_DEAD_ZONE,
    ) {}

    /** True when at least one pad is connected, whatever it is bound to. */
    get connected(): boolean {
        return this.provider().some((pad) => pad !== null && pad.connected !== false);
    }

    sample(): void {
        this.previous.clear();
        for (const action of this.down) {
            this.previous.add(action);
        }
        this.down.clear();

        for (const pad of this.provider()) {
            if (!pad || pad.connected === false) {
                continue;
            }

            this.readSticks(pad);
            this.readDpads(pad);
            this.readButtons(pad);
        }
    }

    isDown(action: TAction): boolean {
        return this.down.has(action);
    }

    /** True only on the first sample after the action went down. */
    pressed(action: TAction): boolean {
        return this.down.has(action) && !this.previous.has(action);
    }

    clear(): void {
        this.down.clear();
        this.previous.clear();
    }

    private readSticks(pad: GamepadSnapshot): void {
        for (const stick of this.bindings.sticks ?? []) {
            this.applyDirection(readAxis(pad.axes[stick.axisX], this.deadZone), stick.x);

            if (stick.y) {
                this.applyDirection(readAxis(pad.axes[stick.axisY], this.deadZone), stick.y);
            }
        }
    }

    private readDpads(pad: GamepadSnapshot): void {
        for (const dpad of this.bindings.dpads ?? []) {
            this.applyDpadDirection(pad, dpad.x.negative);
            this.applyDpadDirection(pad, dpad.x.positive);
            this.applyDpadDirection(pad, dpad.y.negative);
            this.applyDpadDirection(pad, dpad.y.positive);
        }
    }

    private readButtons(pad: GamepadSnapshot): void {
        for (const [index, action] of Object.entries(this.bindings.buttons ?? {})) {
            if (action && isDown(pad.buttons[Number(index)])) {
                this.down.add(action);
            }
        }
    }

    private applyDirection(sign: number, binding: GamepadAxisBinding<TAction>): void {
        if (sign === 0) {
            return;
        }

        const action = sign < 0 ? binding[0] : binding[1];
        if (action) {
            this.down.add(action);
        }
    }

    private applyDpadDirection(
        pad: GamepadSnapshot,
        direction: GamepadDpadDirection<TAction>,
    ): void {
        const [index, action] = direction;
        if (action && isDown(pad.buttons[index])) {
            this.down.add(action);
        }
    }
}

export function browserGamepadProvider(): readonly (GamepadSnapshot | null)[] {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
        return [];
    }

    return navigator.getGamepads();
}

function isDown(button: GamepadButtonSnapshot | undefined): boolean {
    if (!button) {
        return false;
    }

    // Analog triggers report `pressed` late on some browsers, so the value wins.
    return button.pressed || button.value > PRESS_THRESHOLD;
}

function readAxis(value: number | undefined, deadZone: number): number {
    if (value === undefined || Number.isNaN(value)) {
        return 0;
    }

    if (value <= -deadZone) {
        return -1;
    }

    return value >= deadZone ? 1 : 0;
}
