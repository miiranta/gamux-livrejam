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

    it('does nothing while no pad is connected', () => {
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
        const navigation = create();
        const back = vi.fn();
        navigation.onBack = back;

        runFrames(2);
        pad.buttons[GAMEPAD_BUTTON.right].pressed = true;
        runFrames(2);

        expect(back).toHaveBeenCalledTimes(1);
    });

    it('does not repeat while the back button stays held', () => {
        const navigation = create();
        const back = vi.fn();
        navigation.onBack = back;

        runFrames(2);
        pad.buttons[GAMEPAD_BUTTON.right].pressed = true;
        runFrames(5);

        expect(back).toHaveBeenCalledTimes(1);
    });

    it('fires again after the button is released and pressed anew', () => {
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
        pad.buttons[GAMEPAD_BUTTON.right].pressed = true;
        const navigation = create();
        const back = vi.fn();
        navigation.onBack = back;

        runFrames(4);

        expect(back).not.toHaveBeenCalled();
    });

    it('clicks the focused control on the bottom face button', () => {
        const button = document.createElement('button');
        const clicked = vi.fn();
        button.addEventListener('click', clicked);
        document.body.append(button);
        button.focus();

        const navigation = create();
        runFrames(2);
        pad.buttons[GAMEPAD_BUTTON.bottom].pressed = true;
        runFrames(2);

        expect(clicked).toHaveBeenCalledTimes(1);
        expect(navigation).toBeTruthy();
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

    it('returns null when no menu layer is on screen', () => {
        document.body.innerHTML = '<div><button>Loose</button></div>';

        expect(firstFocusable()).toBeNull();
    });
});
