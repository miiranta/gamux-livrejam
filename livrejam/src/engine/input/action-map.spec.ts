import { beforeEach, describe, expect, it } from 'vitest';

import { KeyboardActionMap } from './action-map';

type Action = 'left' | 'jump';

const BINDINGS: Record<string, Action> = {
    KeyA: 'left',
    ArrowLeft: 'left',
    KeyW: 'jump',
    Space: 'jump',
};

describe('KeyboardActionMap', () => {
    let listeners: Record<string, EventListener>;
    let map: KeyboardActionMap<Action>;
    let prevented: number;

    const send = (type: string, code: string, repeat = false): void => {
        listeners[type]({
            code,
            repeat,
            preventDefault: () => {
                prevented += 1;
            },
        } as unknown as Event);
    };

    beforeEach(() => {
        listeners = {};
        prevented = 0;
        const target = {
            addEventListener: (type: string, fn: EventListener) => {
                listeners[type] = fn;
            },
            removeEventListener: () => {},
        } as unknown as Window;

        map = new KeyboardActionMap(BINDINGS, target);
    });

    it('keeps an action held while any of its keys is still down', () => {
        send('keydown', 'KeyA');
        send('keydown', 'ArrowLeft');
        send('keyup', 'ArrowLeft');

        expect(map.isDown('left')).toBe(true);

        send('keyup', 'KeyA');
        expect(map.isDown('left')).toBe(false);
    });

    it('releases the action once the last key comes up', () => {
        send('keydown', 'Space');
        send('keydown', 'KeyW');
        send('keyup', 'KeyW');
        send('keyup', 'Space');

        expect(map.isDown('jump')).toBe(false);
    });

    it('swallows the browser default on auto-repeat, so Space cannot scroll', () => {
        send('keydown', 'Space');
        const before = prevented;
        send('keydown', 'Space', true);

        expect(prevented).toBe(before + 1);
        expect(map.isDown('jump')).toBe(true);
    });

    it('ignores keys it has no binding for', () => {
        send('keydown', 'KeyZ');
        expect(map.isDown('left')).toBe(false);
        expect(map.isDown('jump')).toBe(false);
    });

    it('drops every key when the window loses focus', () => {
        send('keydown', 'KeyA');
        listeners['blur'](new Event('blur'));

        expect(map.isDown('left')).toBe(false);
    });
});
