import { describe, expect, it } from 'vitest';

import { createCharacter } from '../entities/character';
import { CELL_SIZE, createRoom } from '../level/room';
import { PhysicsWorld } from './world';

function buildScene() {
    const room = createRoom({
        columns: 20,
        rows: 12,
        wallThickness: 2,
        floorThickness: 1,
    });
    const world = new PhysicsWorld();
    for (const collider of room.colliders) {
        world.addBlocker(collider);
    }
    const character = createCharacter({
        feet: { x: room.width / 2, y: room.floorTop },
        gravity: 900,
    });
    character.physics.body.velocity.x = 0;
    return { room, world, character };
}

function feetY(character: ReturnType<typeof createCharacter>): number {
    return character.physics.body.position.y + character.physics.size.height;
}

describe('colisao do personagem com a sala', () => {
    it('o chao comeca na ultima linha, com uma linha de espessura', () => {
        const room = createRoom({
            columns: 20,
            rows: 12,
            wallThickness: 2,
            floorThickness: 1,
        });
        expect(room.floorTop).toBe(11 * CELL_SIZE);
        expect(room.height - room.floorTop).toBe(CELL_SIZE);
    });

    it('cai e pousa no chao, ficando apoiado', () => {
        const { room, world, character } = buildScene();

        let grounded = false;
        for (let step = 0; step < 120; step++) {
            grounded = world.step(character.physics, 1 / 60).grounded;
        }

        expect(grounded).toBe(true);
        expect(feetY(character)).toBeCloseTo(room.floorTop, 4);
    });

    it('nao atravessa a parede da direita ao andar contra ela', () => {
        const { room, world, character } = buildScene();
        for (let step = 0; step < 120; step++) {
            world.step(character.physics, 1 / 60);
        }

        const rightEdge = room.width - room.layout.wallThickness * CELL_SIZE;
        for (let step = 0; step < 300; step++) {
            character.physics.body.velocity.x = 190;
            const result = world.step(character.physics, 1 / 60);
            if (result.hitWall === 'right') {
                break;
            }
        }

        const bodyRight = character.physics.body.position.x + character.physics.size.width;
        expect(bodyRight).toBeLessThanOrEqual(rightEdge + 0.001);
        expect(feetY(character)).toBeCloseTo(room.floorTop, 4);
    });

    it('nao atravessa a parede da esquerda', () => {
        const { room, world, character } = buildScene();
        for (let step = 0; step < 120; step++) {
            world.step(character.physics, 1 / 60);
        }

        const leftEdge = room.layout.wallThickness * CELL_SIZE;
        for (let step = 0; step < 300; step++) {
            character.physics.body.velocity.x = -190;
            const result = world.step(character.physics, 1 / 60);
            if (result.hitWall === 'left') {
                break;
            }
        }

        expect(character.physics.body.position.x).toBeGreaterThanOrEqual(leftEdge - 0.001);
    });
});