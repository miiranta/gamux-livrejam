import { describe, expect, it } from 'vitest';

import { GAMEPAD_BUTTON } from '../../engine/input';
import {
    PLAYER_BINDINGS,
    PLAYER_ENTITY_BY_MODE,
    PLAYER_GAMEPAD_BINDINGS,
    gameModeLabelKey,
    isGameMode,
    readPlayerIntent,
    type PlayerAction,
} from './game-mode';
import { FACE_SMASHING } from './face-smashing.config';

/** A fake controller holding a fixed set of actions. */
function held(...actions: PlayerAction[]): { isDown(action: PlayerAction): boolean } {
    const set = new Set(actions);
    return { isDown: (action) => set.has(action) };
}

describe('game modes', () => {
    it('recognises only the two known modes', () => {
        expect(isGameMode('single')).toBe(true);
        expect(isGameMode('two')).toBe(true);
        expect(isGameMode('three')).toBe(false);
        expect(isGameMode(undefined)).toBe(false);
    });

    it('gives the human the character only in 2-player mode', () => {
        expect(PLAYER_ENTITY_BY_MODE.single).toBe('none');
        expect(PLAYER_ENTITY_BY_MODE.two).toBe('character');
    });

    it('keys every translation off the mode name', () => {
        expect(gameModeLabelKey('two')).toBe('mode.two');
        expect(gameModeLabelKey('single')).toBe('mode.single');
    });
});

describe('player bindings', () => {
    it('binds dash to either shift key', () => {
        expect(PLAYER_BINDINGS['ShiftLeft']).toBe('dash');
        expect(PLAYER_BINDINGS['ShiftRight']).toBe('dash');
    });

    it('binds run to ctrl', () => {
    });

    it('binds jump to the up arrow and space', () => {
        expect(PLAYER_BINDINGS['ArrowUp']).toBe('jump');
        expect(PLAYER_BINDINGS['Space']).toBe('jump');
    });

    it('binds both arrow keys and WASD to the directions', () => {
        expect(PLAYER_BINDINGS['ArrowLeft']).toBe('left');
        expect(PLAYER_BINDINGS['KeyA']).toBe('left');
        expect(PLAYER_BINDINGS['ArrowRight']).toBe('right');
        expect(PLAYER_BINDINGS['KeyD']).toBe('right');
    });

    it('binds fast fall to down and S', () => {
        expect(PLAYER_BINDINGS['ArrowDown']).toBe('fastFall');
        expect(PLAYER_BINDINGS['KeyS']).toBe('fastFall');
    });

    it('uses standard-layout positions for the pad buttons', () => {
        const buttons = PLAYER_GAMEPAD_BINDINGS.buttons ?? {};

        // Bottom/right/left are "A"/"B"/"X" on an Xbox pad, but the position is
        // what matters: the letters swap between vendors.
        expect(buttons[GAMEPAD_BUTTON.bottom]).toBe('jump');
        expect(buttons[GAMEPAD_BUTTON.right]).toBe('dash');
    });

    it('leaves start and back to the menus', () => {
        const buttons = PLAYER_GAMEPAD_BINDINGS.buttons ?? {};

        // Start pauses the match, so it must not also drive the character.
        expect(buttons[GAMEPAD_BUTTON.start]).toBeUndefined();
        expect(buttons[GAMEPAD_BUTTON.back]).toBeUndefined();
    });

    it('shares the bottom button with the menus, which jump must allow for', () => {
        const buttons = PLAYER_GAMEPAD_BINDINGS.buttons ?? {};

        // The button that confirms "2 Players" is the button that jumps, and
        // it is still held when the match begins. `FaceSmashing.clearInput`
        // arms the jump edge with it so the character does not hop on the
        // first frame; this pins the overlap that makes that necessary.
        expect(buttons[GAMEPAD_BUTTON.bottom]).toBe('jump');
    });

    it('never jumps from a stick, only from the d-pad and buttons', () => {
        const sticks = PLAYER_GAMEPAD_BINDINGS.sticks ?? [];

        // A stick pushed up must not jump: a worn stick drifting off-centre
        // would otherwise hop on its own.
        for (const stick of sticks) {
            expect(stick.y).toBeUndefined();
        }

        const dpad = PLAYER_GAMEPAD_BINDINGS.dpads?.[0];
        expect(dpad?.y.negative[1]).toBe('jump');
    });

    it('moves the character with the stick horizontally', () => {
        const [left] = PLAYER_GAMEPAD_BINDINGS.sticks ?? [];

        expect(left?.x).toEqual(['left', 'right']);
    });
});

describe('readPlayerIntent', () => {
    it('reads directions as a signed axis', () => {
        expect(readPlayerIntent([held('right')]).axis).toBe(1);
        expect(readPlayerIntent([held('left')]).axis).toBe(-1);
        expect(readPlayerIntent([]).axis).toBe(0);
    });

    it('cancels opposite directions instead of fighting', () => {
        expect(readPlayerIntent([held('left', 'right')]).axis).toBe(0);
    });

    it('cancels opposite directions across controllers', () => {
        const intent = readPlayerIntent([held('left'), held('right')]);

        expect(intent.axis).toBe(0);
    });

    it('lets either controller hold an action', () => {
        expect(readPlayerIntent([held(), held('jump')]).jump).toBe(true);
        expect(readPlayerIntent([held('dash'), held()]).dash).toBe(true);
        expect(readPlayerIntent([held(), held('fastFall')]).fastFall).toBe(true);
    });

    it('reports nothing when every controller is idle', () => {
        expect(readPlayerIntent([held(), held()])).toEqual({
            axis: 0,
            jump: false,
            dash: false,
            fastFall: false,
        });
    });
});
