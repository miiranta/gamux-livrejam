"""Constantes da simulacao. Espelham src/game/config/face-smashing.config.ts.

Os itens arremessaveis NAO ficam aqui: eles vem de `items.py`, que le o catalogo
TypeScript gerado por `tools/assets/build_item_catalog.py`. Assim dano, tamanho e
giro tem uma unica fonte de verdade.
"""

import items as items_catalog

TILE_SOURCE = 16
TILE_SCALE = 2
TILE = TILE_SOURCE * TILE_SCALE

COLUMNS = 20
ROWS = 12
WALL_THICKNESS = 2
FLOOR_THICKNESS = 1

WIDTH = COLUMNS * TILE
HEIGHT = ROWS * TILE
FLOOR_ROW = ROWS - FLOOR_THICKNESS
FLOOR_TOP = FLOOR_ROW * TILE
PLAY_LEFT = WALL_THICKNESS * TILE
PLAY_RIGHT = (COLUMNS - WALL_THICKNESS) * TILE

SPAWN_Y = 88
DESPAWN_Y = HEIGHT + 32

DT = 1.0 / 60.0
GRAVITY = 900.0

DODGER_BOX = (24.0, 26.0)
DODGER_MAX_SPEED_START = 220.0
DODGER_MAX_SPEED_END = 150.0
DODGER_JUMP_START = 588.0
DODGER_JUMP_END = 320.0
DODGER_ACCELERATION = 2898.0
DODGER_DRAG = 6.0
DODGER_MAX_FALL = 900.0
DODGER_GROUND_FRICTION = 0.82

DASH_SPEED_START = 1000.0
DASH_SPEED_END = 400.0
DASH_SECONDS = 0.16
DASH_COOLDOWN = 2.5

DAMAGE_LEVELS = 8
DAMAGE_PER_LEVEL = 500.0
DAMAGE_CEILING = DAMAGE_LEVELS * DAMAGE_PER_LEVEL

ITEM_GRAVITY = 900.0
ITEM_MAX_FALL = 520.0
ITEM_SPAWN_MARGIN = 40.0
ITEM_LATERAL = 20.0
ITEM_GROUND_FRICTION = 2.4
ITEM_RESTITUTION = 0.35
ITEM_SPIN_TRANSFER = 0.55
ITEM_SETTLE = 1.2
ITEM_REFERENCE_SPEED = 240.0
ITEM_SPIN_DAMAGE_BONUS = 0.4
ITEM_SPEED_FACTOR_MIN = 0.6
ITEM_SPEED_FACTOR_MAX = 1.8

DROP_BASE_SPEED = 140.0
DROP_MAX_SPEED = 500.0
DROP_SPEED_STEP = 40.0
DROP_BASE_INTERVAL = 1.05
DROP_MIN_INTERVAL = 0.4
DROP_HORIZONTAL = 200.0
DROP_FAST_FALL = 700.0
DROP_RAMP_SECONDS = 3.0
DROP_AIM_JITTER = 20.0
DROP_SCATTER = 0.05
DROP_MAX_LEAD = 0.9
DROP_AIM_SPEED = 260.0

ROUND_SECONDS = 60.0
ROUND_RESTART_DELAY = 1.4

REACTION_KNOCKBACK_BASE = 130.0
REACTION_KNOCKBACK_PER_DAMAGE = 4.2
REACTION_KNOCKBACK_MAX = 620.0
REACTION_POP = 190.0
REACTION_STUN = 0.28
REACTION_INVULNERABLE = 0.5

OBSERVATION_SIZE = 77
GLOBAL_FEATURES = 13
ITEM_FEATURES = 8
ITEM_SLOTS = (OBSERVATION_SIZE - GLOBAL_FEATURES) // ITEM_FEATURES
MAX_ITEM_SLOTS = 8
OBSERVE_RADIUS = 576.0
SENSOR_REACH = 192.0

ACTION_NONE = 0
ACTION_LEFT = 1
ACTION_RIGHT = 2
ACTION_JUMP = 3
ACTION_JUMP_LEFT = 4
ACTION_JUMP_RIGHT = 5
ACTION_DASH_LEFT = 6
ACTION_DASH_RIGHT = 7
ACTION_COUNT = 8

HIDDEN_SIZES = (96, 96)
NETWORK_SIZES = (OBSERVATION_SIZE, *HIDDEN_SIZES, ACTION_COUNT)

MAX_DAMAGE_ITEM = items_catalog.MAX_DAMAGE
MIN_DAMAGE_ITEM = items_catalog.MIN_DAMAGE
MAX_ITEM_EXTENT = items_catalog.MAX_EXTENT
MAX_ITEM_SPIN = items_catalog.MAX_SPIN

SCORE_SURVIVED_PER_SECOND = 10.0
SCORE_DODGE = 5.0
SCORE_NEAR_MISS = 1.0
DODGE_DISTANCE = 24.0
NEAR_MISS_DISTANCE = 12.0

SPAWN_SPREAD = 0.85


def damage_level(damage):
    return min(int(damage / DAMAGE_PER_LEVEL), DAMAGE_LEVELS - 1)


def damage_scale(level, start, end):
    ratio = min(max(level, 0), DAMAGE_LEVELS - 1) / (DAMAGE_LEVELS - 1)
    return start + (end - start) * ratio


def blockers():
    solid = set()
    for row in range(ROWS):
        for column in range(COLUMNS):
            is_wall = column < WALL_THICKNESS or column >= COLUMNS - WALL_THICKNESS
            if is_wall or row >= FLOOR_ROW:
                solid.add((column, row))

    boxes = []
    for row in range(ROWS):
        run_start = -1
        for column in range(COLUMNS + 1):
            is_solid = column < COLUMNS and (column, row) in solid
            if is_solid and run_start == -1:
                run_start = column
            elif not is_solid and run_start != -1:
                boxes.append(
                    (
                        run_start * TILE,
                        row * TILE,
                        (column - run_start) * TILE,
                        TILE,
                    )
                )
                run_start = -1
    return boxes


def spawn_interval(speed):
    return max(DROP_MIN_INTERVAL, (DROP_BASE_INTERVAL * DROP_BASE_SPEED) / speed)


def drop_speed(elapsed):
    steps = int(elapsed / DROP_RAMP_SECONDS)
    return min(DROP_BASE_SPEED + steps * DROP_SPEED_STEP, DROP_MAX_SPEED)

