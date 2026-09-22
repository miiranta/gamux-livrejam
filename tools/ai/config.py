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
ROWS = 15
WALL_THICKNESS = 2
FLOOR_THICKNESS = 1
CEILING_ROWS = 3

WIDTH = COLUMNS * TILE
HEIGHT = ROWS * TILE
FLOOR_ROW = ROWS - FLOOR_THICKNESS
FLOOR_TOP = FLOOR_ROW * TILE
PLAY_LEFT = WALL_THICKNESS * TILE
PLAY_RIGHT = (COLUMNS - WALL_THICKNESS) * TILE

SPAWN_HEIGHT = 24.0
SPAWN_Y = CEILING_ROWS * TILE + SPAWN_HEIGHT
DESPAWN_Y = HEIGHT + 32

DT = 1.0 / 60.0
GRAVITY = 900.0

DODGER_BOX = (24.0, 26.0)
DODGER_MAX_SPEED_START = 146.0
DODGER_MAX_SPEED_END = 104.0
DODGER_JUMP_START = 588.0
DODGER_JUMP_END = 320.0
DODGER_ACCELERATION = 2898.0
DODGER_DRAG = 6.0
DODGER_MAX_FALL = 900.0
DODGER_GROUND_FRICTION = 0.82
JUMP_CUT_MULTIPLIER = 0.5
FAST_FALL_SPEED = 1600.0
FAST_FALL_BOOST = 2400.0

DASH_SPEED_START = 1000.0
DASH_SPEED_END = 400.0
DASH_SECONDS = 0.16
DASH_COOLDOWN = 2.5

DAMAGE_LEVELS = 8
DAMAGE_PER_LEVEL = 100.0
DAMAGE_CEILING = DAMAGE_LEVELS * DAMAGE_PER_LEVEL

ITEM_GRAVITY = 417.0
ITEM_MAX_FALL = 250.0
ITEM_LATERAL = 270.0
ITEM_GROUND_FRICTION = 2.4
ITEM_RESTITUTION = 0.35
ITEM_SPIN_TRANSFER = 0.55
ITEM_SETTLE = 0.6
ITEM_CHASE_SECONDS = 1.2
ITEM_CHASE_SPEED = 200.0
ITEM_CHASE_ACCELERATION = 900.0
ITEM_REFERENCE_SPEED = 143.0
ITEM_SPIN_DAMAGE_BONUS = 0.4
ITEM_SPEED_FACTOR_MIN = 0.6
ITEM_SPEED_FACTOR_MAX = 1.8

DROP_BASE_SPEED = 71.0
DROP_MAX_SPEED = 238.0
DROP_SPEED_STEP = 21.0
DROP_RAMP_SECONDS = 3.0
DROP_STEER_SPEED = 270.0
STEER_LATENCY_MIN = 0.25
STEER_LATENCY_MAX = 0.45
STEER_LEAD_MIN = 0.0
STEER_LEAD_MAX = 1.0
STEER_VELOCITY_WINDOW = 0.1
STEER_SMOOTH = True
STEER_GAIN = 5.0
STEER_ACCEL = 1100.0

ITEM_DASH_SPEED = 620.0
ITEM_DASH_SECONDS = 0.28
ITEM_DASH_SPIN_BOOST = 1.6
ITEM_DASH_CHANCE_MIN = 0.0
ITEM_DASH_CHANCE_MAX = 0.7
ITEM_DASH_HEIGHT_MIN = 60.0
ITEM_DASH_HEIGHT_MAX = 220.0

CHAOS_MAX = 1.0
CHAOS_AMPLITUDE = 150.0
CHAOS_FADE_DISTANCE = 120.0
CHAOS_FREQ_MIN = 0.012
CHAOS_FREQ_MAX = 0.04
CHAOS_WEIGHTS = (0.5, 0.3, 0.2)

RANDOM_ITEM_MAX = 0.5
RANDOM_DRIFT_THETA = 1.5
RANDOM_DRIFT_SIGMA = 260.0

FALL_SCALE_MIN = 0.7
FALL_SCALE_MAX = 1.3
DROP_INTERVAL = 1.05

ROUND_SECONDS = 60.0
ROUND_RESTART_DELAY = 1.4

REACTION_KNOCKBACK_BASE = 130.0
REACTION_KNOCKBACK_PER_DAMAGE = 4.2
REACTION_KNOCKBACK_MAX = 620.0
REACTION_POP = 190.0
REACTION_STUN = 0.28
REACTION_INVULNERABLE = 0.75

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
ACTION_FALL = 8
ACTION_FALL_LEFT = 9
ACTION_FALL_RIGHT = 10
ACTION_COUNT = 11

FRAMES = 3
HIDDEN_SIZES = (96, 96)
NETWORK_SIZES = (OBSERVATION_SIZE * FRAMES, *HIDDEN_SIZES, ACTION_COUNT)

MAX_DAMAGE_ITEM = items_catalog.MAX_DAMAGE
MIN_DAMAGE_ITEM = items_catalog.MIN_DAMAGE
MAX_ITEM_EXTENT = items_catalog.MAX_EXTENT
MAX_ITEM_SPIN = items_catalog.MAX_SPIN

DODGE_DISTANCE = 24.0
NEAR_MISS_DISTANCE = 12.0

SPAWN_SPREAD = 0.85

# Re-derived from the game's dropped-item thrust; it is a steering helper, not
# gravity, and scales with the item speeds.
DROPPED_ACCELERATION = 238.0


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


def drop_speed(elapsed):
    steps = int(elapsed / DROP_RAMP_SECONDS)
    return min(DROP_BASE_SPEED + steps * DROP_SPEED_STEP, DROP_MAX_SPEED)

