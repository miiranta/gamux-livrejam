import { DestroyRef, Injectable, inject } from '@angular/core';
import { GAMEPAD_AXIS, GAMEPAD_BUTTON } from '../../engine/input';

/** A menu action the pad can trigger, matching the common non-Xbox labels. */
export type GamepadMenuAction = 'confirm' | 'back' | 'pause';

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

    /**
     * Registered once by the shell: the pad's start button pauses a running
     * match and leaves the pause menu again. Unlike {@link onBack} it does not
     * belong to a layer — it is what the player reaches for while playing,
     * when no menu is on screen at all.
     */
    onPause: (() => void) | null = null;

    /** While `performance.now()` is below this, the pad's buttons are ignored. */
    private deafUntil = 0;

    /** When the right stick was last read, so scrolling runs at a real speed. */
    private lastScrollAt = 0;

    constructor() {
        if (typeof window === 'undefined') {
            return;
        }

        this.frameId = requestAnimationFrame(this.poll);
        window.addEventListener('keydown', this.onKeyDown);
        this.destroyRef.onDestroy(() => {
            this.stop();
            window.removeEventListener('keydown', this.onKeyDown);
        });
    }

    /**
     * Swallows the button actions for `seconds`. A screen that appears on its
     * own — the result screen at the end of a match — uses it so a press
     * aimed at the match does not fall straight through into it. Focus still
     * moves, so the player can pick a button while they read the score.
     */
    holdActions(seconds: number): void {
        this.deafUntil = Math.max(this.deafUntil, performance.now() + seconds * 1000);
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

        // The button states above are recorded either way, so a button held
        // across the hold window never fires late: it has to be pressed anew.
        if (performance.now() >= this.deafUntil) {
            for (const [index, action] of PAD_ACTIONS) {
                if (pressed[index] && !previous[index]) {
                    this.trigger(action);
                    return;
                }
            }
        }

        this.keepRingOnScreen();
        this.readDirections(pad);
        this.readScroll(pad);
    };

    /**
     * Puts the focus ring back on the visible menu whenever it falls outside
     * of it — the control it was on got replaced (a panel opened), or a click
     * on the backdrop dropped it on `<body>`.
     *
     * Without this the ring simply vanishes and the next d-pad press seems to
     * do nothing, because it only lands the focus back on the first control.
     * It runs from the poll, so it costs nothing until a pad is connected.
     */
    private keepRingOnScreen(): void {
        const layer = topLayer();
        const active = document.activeElement;

        // `<body>` is where the focus lands when its element is removed, and
        // no layer ever contains it.
        if (!layer || (active && layer.contains(active))) {
            return;
        }

        focusFirst();
    }

    private trigger(action: GamepadMenuAction): void {
        if (action === 'pause') {
            this.onPause?.();
            return;
        }

        // Confirm and back belong to the menus. During a match the same
        // buttons are jump and dash, so without a menu on screen they must
        // not reach a control that happens to still hold the focus — the HUD
        // pause button, for one.
        if (!topLayer()) {
            return;
        }

        if (action === 'confirm') {
            confirmFocused();
            return;
        }

        this.onBack?.();
    }

    /**
     * The keyboard's arrows do what the d-pad does: walk the focus ring, and
     * step a focused slider sideways. Everything the pad reaches in a menu is
     * reachable without one.
     *
     * Enter confirms and Esc or Backspace go back, exactly like the pad's
     * bottom and right buttons. Space still runs a focused button natively,
     * and Tab walks the page.
     */
    private readonly onKeyDown = (event: KeyboardEvent): void => {
        const direction = ARROW_KEYS[event.key];

        if (event.key === 'Enter') {
            this.menuKey(event, confirmFocused);
            return;
        }

        if (event.key === 'Escape' || event.key === 'Backspace') {
            this.menuKey(event, () => this.onBack?.());
            return;
        }

        // No menu on screen means the arrows belong to the match, and a
        // shortcut chord is never a navigation press.
        if (!direction || !topLayer() || event.ctrlKey || event.altKey || event.metaKey) {
            return;
        }

        // A field being typed into keeps its arrows: they move the caret, and
        // walking away would drop what was typed. The stepper's readout is
        // left with Enter and Esc, which it already handles.
        if (isTextEntry(document.activeElement)) {
            return;
        }

        // Taken over from the browser, so sideways on a slider steps the
        // value once — the pad's way — instead of also stepping it natively.
        event.preventDefault();

        if (direction === 'left' || direction === 'right') {
            this.horizontal(direction);
            return;
        }

        moveFocus(direction);
    };

    /**
     * Runs a menu action for a key press, under the same rules as the pad:
     * only while a menu layer is on screen, and not during the hold window.
     *
     * The default is taken over whenever the press was the menu's, so Enter
     * cannot also fire the focused button natively (which would run it
     * twice), Backspace cannot walk the browser's history, and Esc does not
     * reach the shell, which would pause on top of the layer's own answer.
     */
    private menuKey(event: KeyboardEvent, action: () => void): void {
        if (!topLayer() || event.ctrlKey || event.altKey || event.metaKey) {
            return;
        }

        // A field being typed into keeps these keys: the readout commits on
        // Enter, reverts on Esc, and Backspace erases what is in it.
        if (isTextEntry(document.activeElement)) {
            return;
        }

        event.preventDefault();

        if (performance.now() >= this.deafUntil) {
            action();
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
            this.horizontal('left');
        } else if (this.edge('right', right || dx > 0)) {
            this.horizontal('right');
        }
    }

    /**
     * The right stick scrolls the panel the focus is inside, at a speed that
     * follows how far it is pushed.
     *
     * Scrolling is kept off the d-pad and the left stick on purpose: those
     * walk the focus ring, and on a screen whose controls are few — the
     * welcome story, with its single button — walking the ring is the only
     * navigation there is, so spending a direction on scrolling would break
     * it. The right stick is free in every menu.
     */
    private readScroll(pad: Gamepad): void {
        const now = performance.now();
        // The first read, and any read after the poll skipped frames (no pad
        // connected, a backgrounded tab), has a long gap behind it; the clamp
        // keeps that one ordinary step instead of a jump to the panel's end.
        const elapsed = Math.min(now - this.lastScrollAt, MAX_SCROLL_FRAME);
        this.lastScrollAt = now;

        const x = stickAmount(pad.axes[GAMEPAD_AXIS.rightX]);
        const y = stickAmount(pad.axes[GAMEPAD_AXIS.rightY]);

        // During a match the right stick belongs to the game, so it only
        // scrolls while a menu layer is on screen.
        if ((x === 0 && y === 0) || !topLayer()) {
            return;
        }

        const area = scrollArea();
        if (!area) {
            return;
        }

        const distance = (SCROLL_SPEED * elapsed) / 1000;
        // Assigned rather than `scrollBy`, so the step lands instantly even
        // where a stylesheet asked for smooth scrolling; the browser clamps
        // both ends for us.
        area.scrollTop += y * distance;
        area.scrollLeft += x * distance;
    }

    /**
     * Sideways is the one axis a slider wants for itself: on the volume
     * sliders it drags the value, everywhere else it walks the focus ring.
     * Up and down still leave the slider, so the pad never gets stuck on one.
     */
    private horizontal(direction: 'left' | 'right'): void {
        if (nudgeFocusedRange(direction === 'left' ? -1 : 1)) {
            return;
        }

        moveFocus(direction);
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

/** Pixels per second the right stick scrolls a panel when pushed all the way. */
const SCROLL_SPEED = 900;
/** Longest frame a single scroll step is allowed to stand for, in ms. */
const MAX_SCROLL_FRAME = 50;
/** The right stick idles further from centre than the left one is read at. */
const SCROLL_DEAD_ZONE = 0.2;

/** Keyboard arrows, mapped onto the directions the focus ring understands. */
const ARROW_KEYS: Readonly<Record<string, Direction | undefined>> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
};

/** True for anything the player types into, where the arrows are the caret's. */
function isTextEntry(element: Element | null): boolean {
    if (
        element instanceof HTMLTextAreaElement ||
        (element as HTMLElement | null)?.isContentEditable
    ) {
        return true;
    }

    return element instanceof HTMLInputElement && !PAD_INPUT_TYPES.has(element.type);
}

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

/**
 * Drags a focused `<input type="range">` one step, and reports whether there
 * was one. The pad cannot grab a slider's thumb, so this is the only way to
 * reach the volume without a mouse or a keyboard.
 *
 * The synthetic `input` event is what the sliders listen to, so the value
 * lands in the settings exactly as a drag would.
 */
export function nudgeFocusedRange(step: number): boolean {
    const active = document.activeElement as HTMLInputElement | null;

    if (!active || active.tagName !== 'INPUT' || active.type !== 'range') {
        return false;
    }

    const size = attribute(active.step, 1);
    const min = attribute(active.min, 0);
    const max = attribute(active.max, 100);
    const value = attribute(active.value, min);
    // Snapped to the step grid, so a slider left off-grid does not drift.
    const steps = Math.round((value - min) / size) + step;
    const next = Math.min(Math.max(min + steps * size, min), max);

    // At either end there is nothing to change, but the press is still the
    // slider's: letting it fall through would jump the focus away instead.
    if (next !== value) {
        active.value = String(round(next));
        active.dispatchEvent(new Event('input', { bubbles: true }));
        active.dispatchEvent(new Event('change', { bubbles: true }));
    }

    return true;
}

/** A numeric input attribute, falling back when it is empty or malformed. */
function attribute(raw: string, fallback: number): number {
    const value = Number(raw);
    return raw === '' || Number.isNaN(value) ? fallback : value;
}

/** Keeps fractional steps (0.05 on the volumes) off binary-float tails. */
function round(value: number): number {
    return Math.round(value * 1e4) / 1e4;
}

/** Runs the focused control, or focuses the first one if nothing is. */
export function confirmFocused(): void {
    const active = document.activeElement as HTMLElement | null;

    if (!active || active === document.body) {
        focusFirst();
        return;
    }

    // Focused but not something a press can run (a readout field, say): the
    // press does nothing. Sending the focus back to the first control instead
    // would throw the player out of the list they were walking.
    const confirmable = active.closest?.(CONFIRMABLE) as HTMLElement | null;
    confirmable?.click();
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
    // The marked container is looked up first and searched on its own: a
    // `[data-gamepad-first] ${FOCUSABLE}` selector would only bind the marker
    // to the first entry of that list, leaving the rest layer-wide.
    const marked = layer.querySelector<HTMLElement>('[data-gamepad-first]');

    return (marked && pick(marked)) ?? pick(layer);
}

/** The first control inside `scope` the pad can actually use. */
function pick(scope: HTMLElement): HTMLElement | null {
    return Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).find(padUsable) ?? null;
}

/**
 * Every control the pad can reach, in document order. The pad walks this list
 * itself: arrow keys do not move focus in a browser, so the traversal has to
 * be explicit.
 */
export function focusableItems(): HTMLElement[] {
    const layer = topLayer();
    if (!layer) {
        return [];
    }

    return Array.from(layer.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(padUsable);
}

/**
 * Fields that need letters or digits typed into them (the match-time readout)
 * are skipped: a pad cannot type, so stopping on one is a dead end. Every such
 * field has buttons next to it that do the same job.
 */
function padUsable(element: HTMLElement): boolean {
    if (element.tagName !== 'INPUT') {
        return true;
    }

    return PAD_INPUT_TYPES.has((element as HTMLInputElement).type);
}

/** Input types a pad can operate on its own. */
const PAD_INPUT_TYPES = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset']);

/** The last opened layer, which is the one the pad is "inside". */
function topLayer(): HTMLElement | null {
    const layers = document.querySelectorAll<HTMLElement>(
        'app-main-menu, app-pause-menu, app-end-game, app-camera-gate, app-welcome-screen',
    );

    return layers[layers.length - 1] ?? null;
}

const FOCUSABLE =
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** What a pad "confirm" press can activate. */
const CONFIRMABLE = 'button:not([disabled]), [role="radio"], a[href], input[type="range"]';

/**
 * How far past its dead zone a stick axis is pushed, from 0 to 1 with the
 * sign of the push. Unlike {@link axisDirection}, which only answers "is it
 * pushed", scrolling wants the analog value: a nudge creeps, a full push
 * flies.
 */
function stickAmount(value: number | undefined): number {
    if (value === undefined || Number.isNaN(value) || Math.abs(value) < SCROLL_DEAD_ZONE) {
        return 0;
    }

    const past = (Math.abs(value) - SCROLL_DEAD_ZONE) / (1 - SCROLL_DEAD_ZONE);

    return Math.sign(value) * Math.min(past, 1);
}

/**
 * The element the right stick scrolls: the scrolling box the focus sits in,
 * or the layer's own one when the focus is somewhere that does not scroll —
 * a footer button below the story, which is exactly where the welcome screen
 * leaves it.
 */
function scrollArea(): HTMLElement | null {
    const layer = topLayer();
    if (!layer) {
        return null;
    }

    const active = document.activeElement as HTMLElement | null;

    if (active && layer.contains(active)) {
        for (let node: HTMLElement | null = active; node; node = node.parentElement) {
            if (scrolls(node)) {
                return node;
            }

            if (node === layer) {
                break;
            }
        }
    }

    // Nothing around the focus scrolls, so the layer's own scrolling area is
    // what the player means. The walk only runs while the stick is pushed,
    // so its cost never shows up on an idle menu.
    return Array.from(layer.querySelectorAll<HTMLElement>('*')).find(scrolls) ?? null;
}

/** True for an element that has somewhere to scroll to, on either axis. */
function scrolls(element: HTMLElement): boolean {
    const style = getComputedStyle(element);

    return (
        (element.scrollHeight > element.clientHeight + 1 && scrollable(style.overflowY)) ||
        (element.scrollWidth > element.clientWidth + 1 && scrollable(style.overflowX))
    );
}

function scrollable(overflow: string): boolean {
    return overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay';
}

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
    [GAMEPAD_BUTTON.start, 'pause'],
];
