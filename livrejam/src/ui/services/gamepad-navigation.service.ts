import { DestroyRef, Injectable, inject } from '@angular/core';
import { GAMEPAD_BUTTON } from '../../engine/input';

/** A menu action the pad can trigger, matching the common non-Xbox labels. */
export type GamepadMenuAction = 'confirm' | 'back';

/**
 * Menu navigation plate for a gamepad.
 *
 * The pad cannot be read event-driven like the keyboard — `navigator
 * .getGamepads()` only reports *state*, so the buttons have to be polled. This
 * service polls once per animation frame and acts on rising edges only, so a
 * held button never repeats.
 *
 * Navigation itself is delegated to the browser: the menus are real buttons,
 * so the d-pad is translated into a synthetic `keydown` and the browser's own
 * focus handling moves between controls. That keeps a single source of truth
 * for "what is focused" and works in every screen without extra wiring.
 */
@Injectable({ providedIn: 'root' })
export class GamepadNavigation {
    private readonly destroyRef = inject(DestroyRef);
    private buttons: boolean[] = [];
    private frameId: number | null = null;

    /**
     * Registered by the screen that owns the visible layer: the pad's back
     * button closes panels, leaves the pause menu and so on.
     */
    onBack: (() => void) | null = null;

    constructor() {
        if (typeof window === 'undefined') {
            return;
        }

        this.frameId = requestAnimationFrame(this.poll);
        this.destroyRef.onDestroy(() => this.stop());
    }

    private stop(): void {
        if (this.frameId !== null) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
    }

    private readonly poll = (): void => {
        this.frameId = requestAnimationFrame(this.poll);
        const pad = firstConnectedPad();

        if (!pad) {
            this.buttons = [];
            return;
        }

        const pressed = pad.buttons.map((button) => button.pressed);
        const previous = this.buttons;
        this.buttons = pressed;

        // The first poll only records the state: without a baseline every
        // already-held button would look like a fresh press.
        if (previous.length === 0) {
            return;
        }

        for (const [index, action] of PAD_ACTIONS) {
            if (pressed[index] && !previous[index]) {
                this.trigger(action);
                return;
            }
        }

        this.readDirections(pad);
    };

    private trigger(action: GamepadMenuAction): void {
        if (action === 'confirm') {
            confirmFocused();
            return;
        }

        if (this.onBack) {
            this.onBack();
        }
    }

    /** D-pad and left stick nudge the browser's focus ring around. */
    private readDirections(pad: Gamepad): void {
        const dx = axisDirection(pad.axes[0]);
        const dy = axisDirection(pad.axes[1]);
        const up = pad.buttons[GAMEPAD_BUTTON.dpadUp]?.pressed === true;
        const down = pad.buttons[GAMEPAD_BUTTON.dpadDown]?.pressed === true;
        const left = pad.buttons[GAMEPAD_BUTTON.dpadLeft]?.pressed === true;
        const right = pad.buttons[GAMEPAD_BUTTON.dpadRight]?.pressed === true;

        if (this.edge('up', up || dy < 0)) {
            moveFocus('up');
        } else if (this.edge('down', down || dy > 0)) {
            moveFocus('down');
        } else if (this.edge('left', left || dx < 0)) {
            moveFocus('left');
        } else if (this.edge('right', right || dx > 0)) {
            moveFocus('right');
        }
    }

    /**
     * True once per push. The repeat delay makes holding a direction walk the
     * focus ring at a readable pace instead of jumping to the last button.
     */
    private edge(direction: Direction, active: boolean): boolean {
        const now = performance.now();
        const state = this.directions[direction];

        if (!active) {
            state.held = false;
            return false;
        }

        if (!state.held) {
            state.held = true;
            state.since = now;
            return true;
        }

        const elapsed = now - state.since;
        if (elapsed > FOCUS_REPEAT_DELAY) {
            state.since = now - FOCUS_REPEAT_INTERVAL;
            return true;
        }

        return false;
    }

    private readonly directions: Record<Direction, { held: boolean; since: number }> = {
        up: { held: false, since: 0 },
        down: { held: false, since: 0 },
        left: { held: false, since: 0 },
        right: { held: false, since: 0 },
    };
}

type Direction = 'up' | 'down' | 'left' | 'right';

const FOCUS_REPEAT_DELAY = 350;
const FOCUS_REPEAT_INTERVAL = 130;
const STICK_DEAD_ZONE = 0.5;

/** Moves focus to the next control in the given direction, wrapping around. */
export function moveFocus(direction: Direction): void {
    const items = focusableItems();
    if (items.length === 0) {
        return;
    }

    const current = document.activeElement as HTMLElement | null;
    const index = current ? items.indexOf(current) : -1;
    const step = direction === 'up' || direction === 'left' ? -1 : 1;
    const next = index === -1 ? 0 : (index + step + items.length) % items.length;

    items[next].focus();
}

/** Runs the focused control, or focuses the first one if nothing is. */
export function confirmFocused(): void {
    const active = document.activeElement as HTMLElement | null;
    const confirmable = active?.closest?.(CONFIRMABLE);

    if (confirmable) {
        (confirmable as HTMLElement).click();
        return;
    }

    focusFirst();
}

/** Focuses the first control of the topmost menu layer. */
export function focusFirst(): void {
    firstFocusable()?.focus();
}

export function firstFocusable(): HTMLElement | null {
    const layer = topLayer();
    if (!layer) {
        return null;
    }

    // A screen can name the control the pad should start on; without it the
    // first focusable might be a corner toggle rather than the main action.
    const preferred = layer.querySelector<HTMLElement>(`[data-gamepad-first] ${FOCUSABLE}`);
    if (preferred) {
        return preferred;
    }

    return layer.querySelector<HTMLElement>(FOCUSABLE);
}

/**
 * Every control the pad can reach, in document order. The pad walks this list
 * itself: arrow keys do not move focus in a browser, so the traversal has to
 * be explicit.
 */
export function focusableItems(): HTMLElement[] {
    const layer = topLayer();
    return layer ? Array.from(layer.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
}

/** The last opened layer, which is the one the pad is "inside". */
function topLayer(): HTMLElement | null {
    const layers = document.querySelectorAll<HTMLElement>(
        'app-main-menu, app-pause-menu, app-end-game, app-camera-gate',
    );

    return layers[layers.length - 1] ?? null;
}

const FOCUSABLE =
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** What a pad "confirm" press can activate. */
const CONFIRMABLE = 'button:not([disabled]), [role="radio"], a[href], input[type="range"]';

function axisDirection(value: number | undefined): number {
    if (value === undefined || Number.isNaN(value)) {
        return 0;
    }

    if (value <= -STICK_DEAD_ZONE) {
        return -1;
    }

    return value >= STICK_DEAD_ZONE ? 1 : 0;
}

function firstConnectedPad(): Gamepad | null {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
        return null;
    }

    for (const pad of navigator.getGamepads()) {
        if (pad?.connected) {
            return pad;
        }
    }

    return null;
}

/**
 * Pad buttons that drive menus, by position on a standard-layout pad. The
 * bottom button confirms and the right button cancels, which matches the
 * pad's usual "advance/back" layout.
 */
const PAD_ACTIONS: ReadonlyArray<readonly [number, GamepadMenuAction]> = [
    [GAMEPAD_BUTTON.bottom, 'confirm'],
    [GAMEPAD_BUTTON.right, 'back'],
];
