import { ApplicationRef, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GAMEPAD_BUTTON } from '../../engine/input';
import { GamepadMenu } from './gamepad-menu';
import { GamepadNavigation } from '../services/gamepad-navigation.service';

interface FakePad {
    connected: boolean;
    axes: number[];
    buttons: { pressed: boolean; value: number }[];
}

@Component({
    // The selector matters: `focusFirst` looks for the known screen layers.
    selector: 'app-end-game',
    imports: [GamepadMenu],
    template: `
        <div appGamepadMenu (back)="backs = backs + 1">
            <div class="actions" data-gamepad-first>
                <button class="retry">Retry</button>
                <button class="exit">Exit</button>
            </div>
        </div>
    `,
})
class FakeEndGame {
    backs = 0;
}

describe('GamepadMenu', () => {
    let pad: FakePad;
    let frames: FrameRequestCallback[];

    beforeEach(() => {
        pad = {
            connected: true,
            axes: [0, 0, 0, 0],
            buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
        };
        frames = [];
        vi.useFakeTimers();

        // Queue frame callbacks so the test decides when a frame happens.
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

    /** Mounts the screen and lets `afterNextRender` + the poll run. */
    function mount(): FakeEndGame {
        TestBed.configureTestingModule({ imports: [FakeEndGame] });
        const fixture = TestBed.createComponent(FakeEndGame);

        // `focusFirst` finds screens by their host tag, and TestBed's host is a
        // plain element, so wrap it in the real layer before the first pass.
        const layer = document.createElement('app-end-game');
        layer.append(fixture.nativeElement);
        document.body.append(layer);

        fixture.detectChanges();
        TestBed.inject(GamepadNavigation);
        // `afterNextRender` only runs on a real change-detection pass.
        TestBed.inject(ApplicationRef).tick();
        runFrames(4);

        return fixture.componentInstance;
    }

    it('focuses the marked control as soon as the screen appears', () => {
        mount();

        expect(document.activeElement?.className).toBe('retry');
    });

    it('emits `back` from the pad back button', () => {
        const component = mount();

        pad.buttons[GAMEPAD_BUTTON.right].pressed = true;
        runFrames(2);

        expect(component.backs).toBe(1);
    });
});
