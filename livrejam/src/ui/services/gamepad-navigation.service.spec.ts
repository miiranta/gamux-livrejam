import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GAMEPAD_BUTTON } from '../../engine/input';
import { GamepadNavigation, firstFocusable, focusFirst } from './gamepad-navigation.service';

interface FakePad {
    connected: boolean;
    axes: number[];
    buttons: { pressed: boolean; value: number }[];
}

function makePad(): FakePad {
    return {
        connected: true,
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
    };
}

/** Runs the service's animation-frame poll once. */
function tick(): void {
    vi.advanceTimersByTime(16);
}

describe('GamepadNavigation', () => {
    let pad: FakePad;
    let frames: FrameRequestCallback[];

    beforeEach(() => {
        pad = makePad();
        frames = [];
        vi.useFakeTimers();

        // The service polls with `requestAnimationFrame`; queue the callbacks
        // so the test decides when a frame happens.
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            frames.push(callback);
            return frames.length;
        });
        vi.stubGlobal('cancelAnimationFrame', () => undefined);
        vi.stubGlobal('navigator', { getGamepads: () => [pad] });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    function runFrames(count: number): void {
        for (let index = 0; index < count; index++) {
            const pending = frames;
            frames = [];
            for (const callback of pending) {
                callback(performance.now());
            }
        }
    }

    function create(): GamepadNavigation {
        TestBed.configureTestingModule({});
        return TestBed.inject(GamepadNavigation);
    }

    /**
     * Puts a menu layer on screen. Confirm and back only act while one is
     * visible, so every test about them needs it.
     */
    function withLayer(): void {
        document.body.innerHTML = '<app-main-menu><button id="one">One</button></app-main-menu>';
    }

    it('does nothing while no pad is connected', () => {
        withLayer();
        pad.connected = false;
        const navigation = create();
        const back = vi.fn();
        navigation.onBack = back;

        runFrames(3);
        pad.buttons[GAMEPAD_BUTTON.right].pressed = true;
        runFrames(3);

        expect(back).not.toHaveBeenCalled();
    });

    it('calls the back handler on the right face button', () => {
        withLayer();
        const navigation = create();
        const back = vi.fn();
        navigation.onBack = back;

        runFrames(2);
        pad.buttons[GAMEPAD_BUTTON.right].pressed = true;
        runFrames(2);

        expect(back).toHaveBeenCalledTimes(1);
    });

    it('does not repeat while the back button stays held', () => {
        withLayer();
        const navigation = create();
        const back = vi.fn();
        navigation.onBack = back;

        runFrames(2);
        pad.buttons[GAMEPAD_BUTTON.right].pressed = true;
        runFrames(5);

        expect(back).toHaveBeenCalledTimes(1);
    });

    it('fires again after the button is released and pressed anew', () => {
        withLayer();
        const navigation = create();
        const back = vi.fn();
        navigation.onBack = back;

        runFrames(2);
        pad.buttons[GAMEPAD_BUTTON.right].pressed = true;
        runFrames(2);
        pad.buttons[GAMEPAD_BUTTON.right].pressed = false;
        runFrames(2);
        pad.buttons[GAMEPAD_BUTTON.right].pressed = true;
        runFrames(2);

        expect(back).toHaveBeenCalledTimes(2);
    });

    it('ignores a button that is already held when the pad is first seen', () => {
        withLayer();
        pad.buttons[GAMEPAD_BUTTON.right].pressed = true;
        const navigation = create();
        const back = vi.fn();
        navigation.onBack = back;

        runFrames(4);

        expect(back).not.toHaveBeenCalled();
    });

    /** A menu layer with one button in it, focused, and its click spy. */
    function withButton(): ReturnType<typeof vi.fn> {
        document.body.innerHTML = '<app-main-menu><button id="one">One</button></app-main-menu>';
        const clicked = vi.fn();
        const button = document.getElementById('one') as HTMLButtonElement;
        button.addEventListener('click', clicked);
        button.focus();
        return clicked;
    }

    it('clicks the focused control on the bottom face button', () => {
        const clicked = withButton();

        const navigation = create();
        runFrames(2);
        pad.buttons[GAMEPAD_BUTTON.bottom].pressed = true;
        runFrames(2);

        expect(clicked).toHaveBeenCalledTimes(1);
        expect(navigation).toBeTruthy();
    });

    it('ignores confirm and back while the actions are held', () => {
        const clicked = withButton();

        // The hold is measured against `performance.now()`, which the fake
        // timers leave alone, so the clock is driven by hand here.
        let now = 0;
        vi.spyOn(performance, 'now').mockImplementation(() => now);

        const navigation = create();
        navigation.holdActions(1);
        runFrames(2);
        pad.buttons[GAMEPAD_BUTTON.bottom].pressed = true;
        runFrames(2);

        expect(clicked).not.toHaveBeenCalled();

        // Still held when the window closes: it must not fire late.
        now = 1100;
        runFrames(2);
        expect(clicked).not.toHaveBeenCalled();

        pad.buttons[GAMEPAD_BUTTON.bottom].pressed = false;
        runFrames(2);
        pad.buttons[GAMEPAD_BUTTON.bottom].pressed = true;
        runFrames(2);

        expect(clicked).toHaveBeenCalledTimes(1);
    });

    it('leaves the menu buttons alone while a match is on screen', () => {
        // No menu layer: the same buttons are jump and dash, and a control
        // left focused behind the HUD must not answer them.
        const button = document.createElement('button');
        const clicked = vi.fn();
        button.addEventListener('click', clicked);
        document.body.append(button);
        button.focus();

        const navigation = create();
        const back = vi.fn();
        navigation.onBack = back;

        runFrames(2);
        pad.buttons[GAMEPAD_BUTTON.bottom].pressed = true;
        pad.buttons[GAMEPAD_BUTTON.right].pressed = true;
        runFrames(2);

        expect(clicked).not.toHaveBeenCalled();
        expect(back).not.toHaveBeenCalled();
    });

    it('calls the pause handler on start, with or without a menu', () => {
        const navigation = create();
        const pause = vi.fn();
        navigation.onPause = pause;

        runFrames(2);
        pad.buttons[GAMEPAD_BUTTON.start].pressed = true;
        runFrames(2);

        expect(pause).toHaveBeenCalledTimes(1);
    });

    it('brings the ring back when the focused control disappears', () => {
        document.body.innerHTML = `
            <app-main-menu>
                <nav data-gamepad-first>
                    <button id="one">1 Player</button>
                    <button id="two">2 Players</button>
                </nav>
            </app-main-menu>
        `;
        focusFirst();

        create();
        runFrames(2);

        // What the menu does when a panel replaces the button list.
        document.getElementById('one')?.remove();
        expect(document.activeElement).toBe(document.body);

        runFrames(1);

        expect(document.activeElement?.id).toBe('two');
    });

    it('does not move the ring while the focus is inside the layer', () => {
        document.body.innerHTML = `
            <app-main-menu>
                <nav data-gamepad-first>
                    <button id="one">1 Player</button>
                    <button id="two">2 Players</button>
                </nav>
            </app-main-menu>
        `;
        document.getElementById('two')?.focus();

        create();
        runFrames(3);

        expect(document.activeElement?.id).toBe('two');
    });

    it('keeps the ring where it is when the press runs nothing', () => {
        document.body.innerHTML = `
            <app-main-menu>
                <div data-gamepad-first>
                    <button id="one">One</button>
                    <input id="readout" type="text" />
                </div>
            </app-main-menu>
        `;
        document.getElementById('readout')?.focus();

        create();
        runFrames(2);
        pad.buttons[GAMEPAD_BUTTON.bottom].pressed = true;
        runFrames(2);

        expect(document.activeElement?.id).toBe('readout');
    });

    it('walks past fields the pad cannot type into', () => {
        document.body.innerHTML = `
            <app-main-menu>
                <div data-gamepad-first>
                    <button id="minus">-</button>
                    <input id="readout" type="text" />
                    <button id="plus">+</button>
                </div>
            </app-main-menu>
        `;
        document.getElementById('minus')?.focus();

        create();
        runFrames(2);
        pad.buttons[GAMEPAD_BUTTON.dpadDown].pressed = true;
        runFrames(2);

        expect(document.activeElement?.id).toBe('plus');
    });

    function withSlider(): HTMLInputElement {
        document.body.innerHTML = `
            <app-main-menu>
                <div data-gamepad-first>
                    <input id="volume" type="range" min="0" max="1" step="0.05" value="0.5" />
                    <button id="after">After</button>
                </div>
            </app-main-menu>
        `;
        focusFirst();
        return document.getElementById('volume') as HTMLInputElement;
    }

    it('drags a focused slider sideways instead of moving the focus', () => {
        const slider = withSlider();
        const input = vi.fn();
        slider.addEventListener('input', input);

        create();
        runFrames(2);
        pad.buttons[GAMEPAD_BUTTON.dpadRight].pressed = true;
        runFrames(2);

        expect(slider.value).toBe('0.55');
        expect(input).toHaveBeenCalledTimes(1);
        expect(document.activeElement?.id).toBe('volume');
    });

    it('keeps the slider focused at the end of its track', () => {
        const slider = withSlider();
        slider.value = '0';

        create();
        runFrames(2);
        pad.buttons[GAMEPAD_BUTTON.dpadLeft].pressed = true;
        runFrames(2);

        expect(slider.value).toBe('0');
        expect(document.activeElement?.id).toBe('volume');
    });

    it('still leaves a slider with up and down', () => {
        const slider = withSlider();

        create();
        runFrames(2);
        pad.buttons[GAMEPAD_BUTTON.dpadDown].pressed = true;
        runFrames(2);

        expect(slider.value).toBe('0.5');
        expect(document.activeElement?.id).toBe('after');
    });

    it('moves focus with the d-pad', () => {
        document.body.innerHTML = `
            <app-main-menu>
                <nav data-gamepad-first>
                    <button id="one">1 Player</button>
                    <button id="two">2 Players</button>
                </nav>
            </app-main-menu>
        `;
        focusFirst();

        create();
        runFrames(2);
        pad.buttons[GAMEPAD_BUTTON.dpadDown].pressed = true;
        runFrames(2);

        expect(document.activeElement?.id).toBe('two');
    });

    it('wraps around when moving past the last control', () => {
        document.body.innerHTML = `
            <app-main-menu>
                <nav data-gamepad-first>
                    <button id="one">1 Player</button>
                    <button id="two">2 Players</button>
                </nav>
            </app-main-menu>
        `;
        focusFirst();

        create();
        runFrames(2);
        pad.buttons[GAMEPAD_BUTTON.dpadDown].pressed = true;
        runFrames(2);
        pad.buttons[GAMEPAD_BUTTON.dpadDown].pressed = false;
        runFrames(2);
        pad.buttons[GAMEPAD_BUTTON.dpadDown].pressed = true;
        runFrames(2);

        expect(document.activeElement?.id).toBe('one');
    });

    it('moves focus with the left stick', () => {
        document.body.innerHTML = `
            <app-main-menu>
                <nav data-gamepad-first>
                    <button id="one">1 Player</button>
                    <button id="two">2 Players</button>
                </nav>
            </app-main-menu>
        `;
        focusFirst();

        create();
        runFrames(2);
        pad.axes[1] = 1;
        runFrames(2);

        expect(document.activeElement?.id).toBe('two');
    });

    it('ignores a stick inside the dead zone', () => {
        document.body.innerHTML = `
            <app-main-menu>
                <nav data-gamepad-first>
                    <button id="one">1 Player</button>
                    <button id="two">2 Players</button>
                </nav>
            </app-main-menu>
        `;
        focusFirst();

        create();
        runFrames(2);
        pad.axes[1] = 0.3;
        runFrames(3);

        expect(document.activeElement?.id).toBe('one');
    });

    /** Sends a key to the window, and reports whether it kept its default. */
    function press(key: string): boolean {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        window.dispatchEvent(event);
        return !event.defaultPrevented;
    }

    it('walks the focus ring with the keyboard arrows', () => {
        document.body.innerHTML = `
            <app-main-menu>
                <button id="one">One</button>
                <button id="two">Two</button>
            </app-main-menu>
        `;
        create();
        (document.getElementById('one') as HTMLButtonElement).focus();

        press('ArrowDown');
        expect(document.activeElement?.id).toBe('two');

        press('ArrowUp');
        expect(document.activeElement?.id).toBe('one');

        // Sideways walks the same list, and the ends wrap around.
        press('ArrowLeft');
        expect(document.activeElement?.id).toBe('two');
    });

    it('leaves the arrows to the match while no menu is on screen', () => {
        document.body.innerHTML = '<div><button id="one">One</button></div>';
        create();
        (document.getElementById('one') as HTMLButtonElement).focus();

        expect(press('ArrowDown')).toBe(true);
        expect(document.activeElement?.id).toBe('one');
    });

    it('steps a focused slider sideways, and leaves it with up or down', () => {
        document.body.innerHTML = `
            <app-main-menu>
                <input id="volume" type="range" min="0" max="1" step="0.05" value="0.5" />
                <button id="one">One</button>
            </app-main-menu>
        `;
        create();
        const volume = document.getElementById('volume') as HTMLInputElement;
        const changed = vi.fn();
        volume.addEventListener('input', changed);
        volume.focus();

        press('ArrowRight');
        expect(volume.value).toBe('0.55');
        expect(changed).toHaveBeenCalledTimes(1);
        expect(document.activeElement?.id).toBe('volume');

        press('ArrowLeft');
        expect(volume.value).toBe('0.5');

        // Only the slider's own axis is its: the ring still gets off it.
        press('ArrowDown');
        expect(document.activeElement?.id).toBe('one');
    });

    it('leaves the arrows to a field being typed into', () => {
        document.body.innerHTML = `
            <app-main-menu>
                <input id="readout" type="text" />
                <button id="one">One</button>
            </app-main-menu>
        `;
        create();
        (document.getElementById('readout') as HTMLInputElement).focus();

        expect(press('ArrowDown')).toBe(true);
        expect(document.activeElement?.id).toBe('readout');
    });

    it('confirms the focused control on Enter, exactly once', () => {
        const clicked = withButton();
        create();

        // The default is taken over, so the browser cannot also run the
        // button and click it a second time.
        expect(press('Enter')).toBe(false);
        expect(clicked).toHaveBeenCalledTimes(1);
    });

    it('lands the ring on the first control when Enter finds nothing focused', () => {
        withLayer();
        create();
        (document.activeElement as HTMLElement | null)?.blur();

        press('Enter');

        expect(document.activeElement?.id).toBe('one');
    });

    it('ignores Enter while the actions are held', () => {
        const clicked = withButton();
        let now = 0;
        vi.spyOn(performance, 'now').mockImplementation(() => now);

        const navigation = create();
        navigation.holdActions(1);
        press('Enter');
        expect(clicked).not.toHaveBeenCalled();

        now = 1100;
        press('Enter');
        expect(clicked).toHaveBeenCalledTimes(1);
    });

    it.each(['Escape', 'Backspace'])('goes back on %s', (key) => {
        withLayer();
        const navigation = create();
        const back = vi.fn();
        navigation.onBack = back;

        // Backspace must not reach the browser's history either.
        expect(press(key)).toBe(false);
        expect(back).toHaveBeenCalledTimes(1);
    });

    it('leaves Esc to the shell while a match is on screen', () => {
        document.body.innerHTML = '<div><button id="one">One</button></div>';
        const navigation = create();
        const back = vi.fn();
        navigation.onBack = back;

        // No layer: Esc is the shell's, and it pauses the match.
        expect(press('Escape')).toBe(true);
        expect(back).not.toHaveBeenCalled();
    });

    it('ignores back while the actions are held', () => {
        withLayer();
        let now = 0;
        vi.spyOn(performance, 'now').mockImplementation(() => now);

        const navigation = create();
        const back = vi.fn();
        navigation.onBack = back;
        navigation.holdActions(1);
        press('Escape');
        expect(back).not.toHaveBeenCalled();

        now = 1100;
        press('Escape');
        expect(back).toHaveBeenCalledTimes(1);
    });

    it('leaves Enter to a field being typed into', () => {
        document.body.innerHTML =
            '<app-main-menu><input id="readout" type="text" /></app-main-menu>';
        create();
        (document.getElementById('readout') as HTMLInputElement).focus();

        expect(press('Enter')).toBe(true);
    });
});

describe('focusFirst', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('focuses the first control of the topmost menu layer', () => {
        document.body.innerHTML = `
            <app-main-menu><button id="menu">Menu</button></app-main-menu>
            <app-pause-menu><button id="pause">Pause</button></app-pause-menu>
        `;

        focusFirst();

        expect(document.activeElement?.id).toBe('pause');
    });

    it('skips disabled controls', () => {
        document.body.innerHTML = `
            <app-main-menu>
                <button id="off" disabled>Off</button>
                <button id="on">On</button>
            </app-main-menu>
        `;

        focusFirst();

        expect(document.activeElement?.id).toBe('on');
    });

    it('prefers the control the screen marked as its starting point', () => {
        document.body.innerHTML = `
            <app-main-menu>
                <button id="corner">Fullscreen</button>
                <nav data-gamepad-first><button id="main">1 Player</button></nav>
            </app-main-menu>
        `;

        focusFirst();

        // Without the marker this would land on the corner toggle.
        expect(document.activeElement?.id).toBe('main');
    });

    it('keeps the starting point inside the marked container', () => {
        document.body.innerHTML = `
            <app-main-menu>
                <input id="loose" type="range" />
                <nav data-gamepad-first><button id="main">1 Player</button></nav>
            </app-main-menu>
        `;

        focusFirst();

        // The marker has to bind every kind of control, not only the buttons.
        expect(document.activeElement?.id).toBe('main');
    });

    it('skips a field the pad cannot type into', () => {
        document.body.innerHTML = `
            <app-main-menu>
                <input id="readout" type="text" />
                <button id="on">On</button>
            </app-main-menu>
        `;

        focusFirst();

        expect(document.activeElement?.id).toBe('on');
    });

    it('returns null when no menu layer is on screen', () => {
        document.body.innerHTML = '<div><button>Loose</button></div>';

        expect(firstFocusable()).toBeNull();
    });
});
