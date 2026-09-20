import { describe, expect, it } from 'vitest';

import {
    GAMEPAD_AXIS,
    GAMEPAD_BUTTON,
    Gamepads,
    type GamepadBindings,
    type GamepadSnapshot,
} from './gamepad-map';

type Action = 'left' | 'right' | 'jump' | 'dash';

const BINDINGS: GamepadBindings<Action> = {
    sticks: [
        {
            axisX: GAMEPAD_AXIS.leftX,
            axisY: GAMEPAD_AXIS.leftY,
            x: ['left', 'right'],
        },
    ],
    dpads: [
        {
            x: {
                negative: [GAMEPAD_BUTTON.dpadLeft, 'left'],
                positive: [GAMEPAD_BUTTON.dpadRight, 'right'],
            },
            y: {
                negative: [GAMEPAD_BUTTON.dpadUp, 'jump'],
                positive: [GAMEPAD_BUTTON.dpadDown, null],
            },
        },
    ],
    buttons: {
        [GAMEPAD_BUTTON.right]: 'dash',
        [GAMEPAD_BUTTON.bottom]: 'left',
    },
};

function pad(overrides: Partial<GamepadSnapshot> = {}): GamepadSnapshot {
    return {
        connected: true,
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
        ...overrides,
    };
}

function withButton(index: number, value = 1): GamepadSnapshot {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
    buttons[index] = { pressed: true, value };
    return pad({ buttons });
}

function makeGamepads(pads: readonly (GamepadSnapshot | null)[]): Gamepads<Action> {
    return new Gamepads<Action>(BINDINGS, () => pads);
}

describe('Gamepads', () => {
    it('reads a stick push as the matching direction', () => {
        const gamepads = makeGamepads([pad({ axes: [-1, 0, 0, 0] })]);

        gamepads.sample();

        expect(gamepads.isDown('left')).toBe(true);
        expect(gamepads.isDown('right')).toBe(false);
    });

    it('ignores a stick inside the dead zone', () => {
        const gamepads = makeGamepads([pad({ axes: [0.3, -0.3, 0, 0] })]);

        gamepads.sample();

        expect(gamepads.isDown('left')).toBe(false);
        expect(gamepads.isDown('right')).toBe(false);
    });

    it('ignores the vertical axis of a stick bound horizontally only', () => {
        const gamepads = makeGamepads([pad({ axes: [0, -1, 0, 0] })]);

        gamepads.sample();

        expect(gamepads.isDown('jump')).toBe(false);
        expect(gamepads.isDown('left')).toBe(false);
    });

    it('reads the d-pad as well as the stick', () => {
        const gamepads = makeGamepads([withButton(GAMEPAD_BUTTON.dpadRight)]);

        gamepads.sample();

        expect(gamepads.isDown('right')).toBe(true);
    });

    it('reads face buttons', () => {
        const gamepads = makeGamepads([withButton(GAMEPAD_BUTTON.right)]);

        gamepads.sample();

        expect(gamepads.isDown('dash')).toBe(true);
    });

    it('reports `pressed` only on the first sample the action is held', () => {
        const gamepads = makeGamepads([withButton(GAMEPAD_BUTTON.right)]);

        gamepads.sample();
        expect(gamepads.pressed('dash')).toBe(true);

        gamepads.sample();
        expect(gamepads.isDown('dash')).toBe(true);
        expect(gamepads.pressed('dash')).toBe(false);
    });

    it('reads the pad again after the button is released', () => {
        const gamepads = makeGamepads([withButton(GAMEPAD_BUTTON.right)]);
        gamepads.sample();

        gamepads.sample();
        // A released pad is a fresh press the next time the button goes down.
        const released = makeGamepads([pad()]);
        released.sample();

        expect(released.isDown('dash')).toBe(false);
    });

    it('ignores disconnected slots and pads', () => {
        const gamepads = makeGamepads([null, pad({ connected: false })]);

        gamepads.sample();

        expect(gamepads.connected).toBe(false);
        expect(gamepads.isDown('dash')).toBe(false);
    });

    it('merges every connected pad into one action set', () => {
        const gamepads = makeGamepads([
            pad({ axes: [1, 0, 0, 0] }),
            withButton(GAMEPAD_BUTTON.right),
        ]);

        gamepads.sample();

        expect(gamepads.connected).toBe(true);
        expect(gamepads.isDown('right')).toBe(true);
        expect(gamepads.isDown('dash')).toBe(true);
    });

    it('treats a half-pulled trigger as pressed', () => {
        const gamepads = makeGamepads([withButton(GAMEPAD_BUTTON.right, 0.7)]);

        gamepads.sample();

        expect(gamepads.isDown('dash')).toBe(true);
    });

    it('clears every held action', () => {
        const gamepads = makeGamepads([withButton(GAMEPAD_BUTTON.right)]);
        gamepads.sample();

        gamepads.clear();

        expect(gamepads.isDown('dash')).toBe(false);
        expect(gamepads.pressed('dash')).toBe(false);
    });
});
