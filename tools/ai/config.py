"""Constantes da simulacao. Espelham src/game/config/dungeon-drop.config.ts."""

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

SPAWN_Y = 24
DESPAWN_Y = HEIGHT + 32

DT = 1.0 / 60.0
GRAVITY = 900.0

DODGER_BOX = (24.0, 26.0)
DODGER_MAX_SPEED_MIN = 120.0
DODGER_MAX_SPEED_MAX = 300.0
DODGER_ACCELERATION = 900.0
DODGER_DRAG = 6.0
DODGER_JUMP = 330.0
DODGER_MAX_FALL = 900.0
DODGER_DEATH_DELAY = 0.6

FALLER_SIZE = 32.0
FALLER_MAX_FALL = 520.0
FALLER_SPAWN_MARGIN = 40.0
FALLER_LATERAL = 160.0
FALLER_SLIDE_DRAG = 2.4
FALLER_SETTLE = 1.2

DROP_BASE_SPEED = 140.0
DROP_MAX_SPEED = 500.0
DROP_SPEED_STEP = 40.0
DROP_BASE_INTERVAL = 1.05
DROP_MIN_INTERVAL = 0.4
DROP_HORIZONTAL = 200.0
DROP_FAST_FALL = 700.0
DROP_RAMP_SECONDS = 3.0

OBSERVATION_SIZE = 24
FALLER_SLOTS = 3
FALLER_FEATURES = 7
GLOBAL_FEATURES = 3
OBSERVE_RADIUS = 260.0

ACTION_NONE = 0
ACTION_LEFT = 1
ACTION_RIGHT = 2
ACTION_JUMP = 3
ACTION_JUMP_LEFT = 4
ACTION_JUMP_RIGHT = 5
ACTION_COUNT = 6

HIDDEN_SIZES = (64, 64)
NETWORK_SIZES = (OBSERVATION_SIZE, *HIDDEN_SIZES, ACTION_COUNT)

MAX_FALLER_SLOTS = 8
MAX_SPAWN_EVENTS = 64

SCORE_SURVIVED_PER_SECOND = 10.0
SCORE_DODGE = 5.0
SCORE_NEAR_MISS = 1.0
SCORE_HIT = -1.0

DODGE_DISTANCE = 24.0
NEAR_MISS_DISTANCE = 12.0

SPEED_WEIGHTS = (120.0, 160.0, 200.0, 240.0, 300.0)


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


def dropper_target(pos_x, vel_x, elapsed, obstacle_x, obstacle_y, obstacle_active, grounded, random):
    size = FALLER_SIZE
    dodger_x = pos_x + DODGER_BOX[0] / 2
    faller_cx = obstacle_x + size / 2
    faller_cy = obstacle_y + size / 2

    falling = obstacle_active & (faller_cy < FLOOR_TOP)
    lead = torch.clamp((FLOOR_TOP - faller_cy) / FALLER_MAX_FALL, 0.0, 0.9)
    predicted = faller_cx + obstacle_x * 0 + vel_x * lead
    dodger_predicted = dodger_x + vel_x * lead

    safe = torch.where(falling, (predicted - dodger_predicted).abs(), torch.full_like(predicted, float("inf")))
    best = safe.argmin(dim=1)
    rows = torch.arange(pos_x.shape[0], device=pos_x.device)
    target = predicted[rows, best]
    covered = torch.isfinite(safe[rows, best])

    margin = 60.0
    jitter = (random((pos_x.shape[0],)) * 2 - 1) * margin
    offset = torch.where(grounded, torch.full_like(target, 0.0), torch.full_like(target, 0.0))
    aim = target + jitter + offset
    fallback = margin + random((pos_x.shape[0],)) * (WIDTH - margin * 2 - size)
    return torch.where(covered, aim, fallback)

