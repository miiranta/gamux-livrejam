import { describe, expect, it } from 'vitest';

import { parseNetwork } from '../../engine/ai';
import { DUNGEON_DROP } from '../config';
import { IdlePolicy, intentFor, type PolicyLike } from './dodger-policy';
import { DODGER_ACTIONS, createObservationBuffer } from './observation';

class FixedPolicy implements PolicyLike {
    readonly ready = true;

    constructor(private readonly action: number) {}

    decide(): number {
        return this.action;
    }
}

describe('policy contract', () => {
    it('exposes the observation size the model expects', () => {
        expect(DUNGEON_DROP.ai.observationSize).toBe(24);
        expect(DUNGEON_DROP.ai.actionCount).toBe(6);
    });

    it('keeps the model URL under the served assets root', () => {
        expect(DUNGEON_DROP.ai.modelUrl.startsWith('models/')).toBe(true);
    });

    it('sizes the observation buffer to the configured size', () => {
        expect(createObservationBuffer().length).toBe(DUNGEON_DROP.ai.observationSize);
    });

    it('maps policy output into an action intent', () => {
        expect(intentFor(DODGER_ACTIONS.left)).toEqual({ axis: -1, jump: false });
        expect(intentFor(DODGER_ACTIONS.jumpRight)).toEqual({ axis: 1, jump: true });
    });

    it('lets any policy drive the dodger through the shared interface', () => {
        const policy = new FixedPolicy(DODGER_ACTIONS.jump);

        expect(policy.ready).toBe(true);
        expect(policy.decide()).toBe(DODGER_ACTIONS.jump);
    });

    it('keeps the idle policy neutral and ready', () => {
        const policy = new IdlePolicy();

        expect(policy.ready).toBe(true);
        expect(policy.decide()).toBe(DODGER_ACTIONS.none);
    });

    it('rejects a serialized model whose layer sizes do not match its parameters', () => {
        expect(() =>
            parseNetwork({ format: 'livrejam.mlp.v1', sizes: [24, 6], weights: [1], biases: [0] }),
        ).toThrow();
    });
});
