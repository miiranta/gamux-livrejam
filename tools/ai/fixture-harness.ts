#!/usr/bin/env node
import { createObservationBuffer, writeObservation } from '../../livrejam/src/game/ai/observation';
import { FACE_SMASHING, ITEMS } from '../../livrejam/src/game/config';
import { Dodger, Item } from '../../livrejam/src/game/entities';
import { createDungeonLevel } from '../../livrejam/src/game/level';

const level = createDungeonLevel();

const dodger = new Dodger({
    feetX: 320,
    feetY: level.floorTop,
    facing: 'right',
});
dodger.maxSpeedX = 300;
dodger.damage = 620;
dodger.applyTier();
dodger.physics.body.velocity.x = 120;
dodger.physics.body.velocity.y = 0;
dodger.physics.body.grounded = false;
dodger.dashCooldown = FACE_SMASHING.dash.cooldownSeconds * 0.25;

const scenario = [
    { index: 0, x: 380, y: 120, vx: 10, vy: 180, spin: 0, roll: 0.25 },
    { index: 6, x: 250, y: 200, vx: -20, vy: 240, spin: 0, roll: 0.75 },
    { index: 21, x: 430, y: 260, vx: 0, vy: 140, spin: 0, roll: 0.5 },
    { index: 3, x: 70, y: 90, vx: 15, vy: 300, spin: 0, roll: 0.4 },
    { index: 13, x: 560, y: 40, vx: -5, vy: 260, spin: 0, roll: 0.9 },
    { index: 18, x: 120, y: 320, vx: 0, vy: 90, spin: 0, roll: 0.1 },
    { index: 9, x: 500, y: 180, vx: 8, vy: 200, spin: 0, roll: 0.6 },
];

const items = scenario.map((entry) => new Item({
    x: entry.x,
    y: entry.y,
    velocityX: entry.vx,
    velocityY: entry.vy,
    definition: ITEMS[entry.index],
    spin: entry.spin,
    damageRoll: entry.roll,
}));

const buffer = createObservationBuffer();
writeObservation(buffer, { level, dodger, items });

process.stdout.write(`${JSON.stringify({
    dodger: {
        feetX: 320,
        velocityX: 120,
        maxSpeedX: dodger.maxSpeedX,
        damage: dodger.damage,
        grounded: false,
        dashCooldown: dodger.dashCooldown,
    },
    items: scenario,
    observation: Array.from(buffer),
}, null, 2)}\n`);
