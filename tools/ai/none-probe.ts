import { DODGER_ACTIONS, decodeAction } from '../../livrejam/src/game/ai/observation';
import { Dodger } from '../../livrejam/src/game/entities';
import { PhysicsWorld } from '../../livrejam/src/engine/physics';
import { createDungeonLevel } from '../../livrejam/src/game/level';

const level = createDungeonLevel();
const dt = 1 / 60;

function run(action: number, startVx: number, steps: number) {
    const world = new PhysicsWorld();
    world.addBlockers(level.colliders);
    const dodger = new Dodger({ feetX: 320, feetY: level.floorTop, facing: 'right' });
    const intent = decodeAction(action);

    for (let step = 0; step < 4; step++) {
        dodger.advanceReaction(dt);
        dodger.move(0, dt);
        world.step(dodger.physics, dt);
        dodger.consumeJump();
    }

    dodger.physics.body.velocity.x = startVx;
    const startX = dodger.feet.x;
    const trace = [];

    for (let step = 0; step < steps; step++) {
        dodger.advanceReaction(dt);
        dodger.move(intent.axis, dt);
        if (intent.jump) {
            dodger.requestJump();
        }
        world.step(dodger.physics, dt);
        dodger.consumeJump();
        dodger.resolveAnimation();

        if (step % 20 === 0 || step === steps - 1) {
            trace.push({
                step,
                x: Number(dodger.feet.x.toFixed(2)),
                vx: Number(dodger.physics.body.velocity.x.toFixed(2)),
                anim: dodger.animation,
            });
        }
    }

    return {
        action,
        name: Object.keys(DODGER_ACTIONS).find(
            (key) => DODGER_ACTIONS[key as keyof typeof DODGER_ACTIONS] === action,
        ),
        intent,
        grounded: dodger.physics.body.grounded,
        startX: Number(startX.toFixed(2)),
        finalX: Number(dodger.feet.x.toFixed(2)),
        finalVx: Number(dodger.physics.body.velocity.x.toFixed(4)),
        drift: Number((dodger.feet.x - startX).toFixed(2)),
        trace,
    };
}

process.stdout.write(`${JSON.stringify({
    none: run(DODGER_ACTIONS.none, 0, 60),
    noneFromSpeed: run(DODGER_ACTIONS.none, 220, 60),
    left: run(DODGER_ACTIONS.left, 0, 60),
}, null, 2)}\n`);
