import { PhysicsWorld } from '../../livrejam/src/engine/physics';
import { FACE_SMASHING } from '../../livrejam/src/game/config';
import { Dodger } from '../../livrejam/src/game/entities';
import { DODGER_ACTIONS, decodeAction } from '../../livrejam/src/game/ai';
import { createDungeonLevel } from '../../livrejam/src/game/level';

const DT = 1 / 60;

function run(level: number, actionPlan: number[], totalSteps: number) {
    const world = new PhysicsWorld();
    const dungeon = createDungeonLevel();
    world.addBlockers(dungeon.colliders);
    const dodger = new Dodger({ feetX: 320, feetY: dungeon.floorTop, facing: 'right' });

    dodger.damage = FACE_SMASHING.damage.perLevel * level;
    dodger.applyTier();

    const trace: number[] = [];

    for (let step = 0; step < totalSteps; step++) {
        const action = decodeAction(actionPlan[step] ?? DODGER_ACTIONS.none);

        dodger.advanceReaction(DT);
        dodger.move(action.axis, DT);

        if (action.dash) {
            dodger.dash(action.facing);
        }

        if (action.jump) {
            dodger.requestJump();
        }

        world.step(dodger.physics, DT);
        if (action.jump) {
            dodger.consumeJump();
        }
        trace.push(Number(dodger.physics.body.position.x.toFixed(4)));
    }

    return { dashSpeed: dodger.dashSpeed, maxSpeed: dodger.maxSpeedX, trace };
}

const plan = (steps: number, action: number, total: number): number[] =>
    Array.from({ length: total }, (_, index) => (index < steps ? action : DODGER_ACTIONS.none));

const results: Record<string, unknown> = { dt: DT };

for (const level of [0, 3, 7]) {
    results[`burst_l${level}`] = run(level, plan(30, DODGER_ACTIONS.dashRight, 10), 10);
    results[`hold_l${level}`] = run(level, plan(40, DODGER_ACTIONS.dashRight, 40), 40);
    results[`cooldown_l${level}`] = run(level, plan(1, DODGER_ACTIONS.dashRight, 90), 90);
}

results.mixed = run(0, plan(1, DODGER_ACTIONS.dashLeft, 1).concat(plan(20, DODGER_ACTIONS.right, 20)), 21);

process.stdout.write(JSON.stringify(results));
