import { GAMEPAD_AXIS, GAMEPAD_BUTTON, type GamepadBindings } from '../../engine/input';
import { FACE_SMASHING } from './face-smashing.config';

/** Who drives the character. */
export type GameMode = 'single' | 'two';

export const DEFAULT_GAME_MODE: GameMode = 'single';

/** True for any value coming from storage, the UI or a URL. */
export function isGameMode(value: unknown): value is GameMode {
    return value === 'single' || value === 'two';
}

/** Every mode, in menu order. */
export const GAME_MODES: readonly GameMode[] = ['single', 'two'];

/** Translation key of a mode's label; the UI never hardcodes text. */
export function gameModeLabelKey(mode: GameMode): string {
    return `mode.${mode}`;
}

/**
 * Which entity the human holds in each mode.
 *
 * `single` is the original jam build: the character is piloted by the trained
 * policy, so no keyboard key reaches it. `two` hands the character to the
 * player, which is where {@link PLAYER_BINDINGS} applies.
 */
export const PLAYER_ENTITY_BY_MODE: Record<GameMode, 'none' | 'character'> = {
    single: 'none',
    two: 'character',
};

/**
 * Actions the player can trigger on the character in 2-player mode. Left/right
 * are read as an axis so opposite inputs cancel instead of fighting; every
 * other action is a plain hold.
 */
export type PlayerAction = 'left' | 'right' | 'fastFall' | 'jump' | 'dash' | 'run' | 'drop';

/**
 * Player 2 keyboard bindings (`KeyboardEvent.code`, layout-independent).
 *
 * Both hands work: the arrows mirror WASD so the character can be driven from
 * one side alone, and a gamepad is bound to the same actions, so pad and
 * keyboard can be mixed freely.
 *
 * | action | keyboard | pad (standard layout) |
 * | --- | --- | --- |
 * | left / right | left/right arrows or A D | left stick (horizontal), d-pad |
 * | jump | up arrow, W, Space | bottom face button ("A"), top face button ("Y") |
 * | dash | Shift (either) | right face button ("B") |
 * | run | Ctrl (either), E | left face button ("X") |
 * | fast fall | down arrow, S | d-pad down |
 * | drop | Enter | Start, Back, triggers |
 *
 * Sticks are horizontal only: a stick pushed up must not jump.
 */
export const PLAYER_BINDINGS: Record<string, PlayerAction> = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ArrowUp: 'jump',
    KeyW: 'jump',
    Space: 'jump',
    ShiftLeft: 'dash',
    ShiftRight: 'dash',
    ControlLeft: 'run',
    ControlRight: 'run',
    KeyE: 'run',
    ArrowDown: 'fastFall',
    KeyS: 'fastFall',
    Enter: 'drop',
};

/**
 * Gamepad bindings, by *position* on a standard-layout pad rather than by
 * vendor letter, which swaps between Xbox and Nintendo pads.
 */
export const PLAYER_GAMEPAD_BINDINGS: GamepadBindings<PlayerAction> = {
    sticks: [
        {
            // Horizontal only: pushing a stick up would otherwise jump, and a
            // worn stick drifting off-centre would jump on its own.
            axisX: GAMEPAD_AXIS.leftX,
            axisY: GAMEPAD_AXIS.leftY,
            x: ['left', 'right'],
        },
        {
            axisX: GAMEPAD_AXIS.rightX,
            axisY: GAMEPAD_AXIS.rightY,
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
                positive: [GAMEPAD_BUTTON.dpadDown, 'fastFall'],
            },
        },
    ],
    buttons: {
        [GAMEPAD_BUTTON.bottom]: 'jump',
        [GAMEPAD_BUTTON.right]: 'dash',
        [GAMEPAD_BUTTON.left]: 'run',
        [GAMEPAD_BUTTON.top]: 'jump',
        [GAMEPAD_BUTTON.start]: 'drop',
        [GAMEPAD_BUTTON.back]: 'drop',
        [GAMEPAD_BUTTON.leftTrigger]: 'drop',
        [GAMEPAD_BUTTON.rightTrigger]: 'drop',
    },
};

/** Anything exposing held actions; the keyboard map and the pads both qualify. */
export interface ActionSource<TAction extends string> {
    isDown(action: TAction): boolean;
}

export interface PlayerIntent {
    /** -1, 0 or 1, with opposite inputs cancelling out. */
    axis: number;
    jump: boolean;
    dash: boolean;
    /** Hold to sprint; tapping a direction moves at walking speed instead. */
    run: boolean;
    fastFall: boolean;
}

/**
 * Turns every controller's held actions into one {@link PlayerIntent}, so the
 * same movement code drives the character whether the policy or a human
 * decided.
 *
 * Directions are summed across sources, so holding left and right (on either
 * controller) cancels out instead of fighting.
 */
export function readPlayerIntent(sources: readonly ActionSource<PlayerAction>[]): PlayerIntent {
    let axis = 0;
    let jump = false;
    let dash = false;
    let run = false;
    let fastFall = false;

    for (const source of sources) {
        axis += Number(source.isDown('right')) - Number(source.isDown('left'));
        jump = jump || source.isDown('jump');
        dash = dash || source.isDown('dash');
        run = run || source.isDown('run');
        fastFall = fastFall || source.isDown('fastFall');
    }

    return { axis: Math.sign(axis), jump, dash, run, fastFall };
}

/** Movement speed as a fraction of the character's damaged-tier maximum. */
export function speedFactorFor(run: boolean): number {
    const config = FACE_SMASHING.player;
    return run ? config.runSpeedFactor : config.walkSpeedFactor;
}
