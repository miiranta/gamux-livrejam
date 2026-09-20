"""Simulacao vetorizada do jogo, espelhando src/game/face-smashing.ts.

Tudo roda no GPU com passo fixo de 1/60 s, com uma copia do jogo por ambiente.

Regras (mecanicas versao 2):
  - O desviador nao morre. A rodada dura ROUND_SECONDS e o objetivo e terminar
    com o minimo de dano possivel.
  - Cada item tem dano sorteado dentro da faixa do proprio item, escalado pela
    velocidade de impacto e pelo giro no momento de encostar.
  - O dano acumula sem teto; os 8 niveis visuais sao faixas de DAMAGE_PER_LEVEL.
  - Cada nivel enfraquece a velocidade maxima e o pulo do desviador.

Cada ambiente roda uma rodada e reinicia sozinho no fim, entao o treino nunca
desperdica passos.

Mantido em sincronia com:
  - src/game/face-smashing.ts     (ordem do loop, fim de rodada, pontuacao)
  - src/game/entities/*.ts       (movimento, colisao, dano, giro)
  - src/game/ai/observation.ts   (vetor de observacao)
  - src/game/damage/*.ts         (faixas e escala por nivel)
  - src/game/config/items.ts     (catalogo lido por items.py)
"""

import torch

import config as cfg
import items as items_catalog

HALF_TURN = 6.283185307179586

SENSOR_ORDER = ("wallLeft", "wallRight", "ceiling", "ground")


def tensor_minimum(values):
    return values.min(dim=1).values


class FaceSmashingSim:
    def __init__(self, envs, device="cpu", seed=0):
        self.envs = envs
        self.device = torch.device(device)
        self.seed = seed
        self.dtype = torch.float32
        self.slots = cfg.MAX_ITEM_SLOTS
        self.generator = torch.Generator(device="cpu").manual_seed(seed)
        self.item_generator = None
        self.drop_cap = cfg.DROP_MAX_SPEED

        boxes = torch.tensor(cfg.blockers(), dtype=self.dtype, device=self.device)
        self.blocker_x = boxes[:, 0]
        self.blocker_y = boxes[:, 1]
        self.blocker_right = boxes[:, 0] + boxes[:, 2]
        self.blocker_bottom = boxes[:, 1] + boxes[:, 3]

        self.item_half_width = self._column([item.half_width for item in items_catalog.ITEMS])
        self.item_half_height = self._column([item.half_height for item in items_catalog.ITEMS])
        self.item_damage_min = self._column([item.damage_min for item in items_catalog.ITEMS])
        self.item_damage_max = self._column([item.damage_max for item in items_catalog.ITEMS])
        self.item_spin_min = self._column([item.spin_min for item in items_catalog.ITEMS])
        self.item_spin_max = self._column([item.spin_max for item in items_catalog.ITEMS])
        weights = self._column([item.weight for item in items_catalog.ITEMS])
        self.item_cumulative = torch.cumsum(weights / weights.sum(), dim=0)
        self.item_count = items_catalog.COUNT

        self.inf = float("inf")
        self.neg_inf = float("-inf")
        self.gravity_step = cfg.GRAVITY * cfg.DT
        self.item_gravity_step = cfg.ITEM_GRAVITY * cfg.DT
        self.speed_decay = float(torch.exp(torch.tensor(-cfg.DODGER_DRAG * cfg.DT)))
        self.slide_decay = float(torch.exp(torch.tensor(-cfg.ITEM_GROUND_FRICTION * cfg.DT)))
        self.spin_decay = float(torch.exp(torch.tensor(-cfg.ITEM_GROUND_FRICTION * cfg.DT)))

        self.reset()

    def _column(self, values):
        return torch.tensor(values, dtype=self.dtype, device=self.device)

    def draw(self, shape):
        return torch.rand(shape, generator=self.generator).to(self.device)

    def sample_spawn_x(self, count):
        span = cfg.PLAY_RIGHT - cfg.PLAY_LEFT
        half = span / 2
        return cfg.PLAY_LEFT + half + (self.draw((count,)) * 2 - 1) * cfg.SPAWN_SPREAD * half

    def level_scale(self, start, end):
        levels = self.level.to(self.dtype)
        ratio = levels / (cfg.DAMAGE_LEVELS - 1)
        return start + (end - start) * ratio

    def current_max_speed(self):
        return self.level_scale(cfg.DODGER_MAX_SPEED_START, cfg.DODGER_MAX_SPEED_END)

    def current_jump(self):
        return self.level_scale(cfg.DODGER_JUMP_START, cfg.DODGER_JUMP_END)

    def current_dash(self):
        return self.level_scale(cfg.DASH_SPEED_START, cfg.DASH_SPEED_END)

    def reset(self):
        envs = self.envs
        device = self.device

        self.obstacle_x = torch.zeros((envs, self.slots), dtype=self.dtype, device=device)
        self.obstacle_y = torch.zeros((envs, self.slots), dtype=self.dtype, device=device)
        self.obstacle_vx = torch.zeros((envs, self.slots), dtype=self.dtype, device=device)
        self.obstacle_vy = torch.zeros((envs, self.slots), dtype=self.dtype, device=device)
        self.obstacle_angle = torch.zeros((envs, self.slots), dtype=self.dtype, device=device)
        self.obstacle_spin = torch.zeros((envs, self.slots), dtype=self.dtype, device=device)
        self.obstacle_item = torch.zeros((envs, self.slots), dtype=torch.long, device=device)
        self.obstacle_roll = torch.zeros((envs, self.slots), dtype=self.dtype, device=device)
        self.obstacle_active = torch.zeros((envs, self.slots), dtype=torch.bool, device=device)
        self.obstacle_settle = torch.zeros((envs, self.slots), dtype=self.dtype, device=device)
        self.obstacle_scored = torch.zeros((envs, self.slots), dtype=torch.bool, device=device)
        self.obstacle_hit = torch.zeros((envs, self.slots), dtype=torch.bool, device=device)
        self.obstacle_cursor = torch.zeros(envs, dtype=torch.long, device=device)

        self.pos_x = self.sample_spawn_x(envs)
        self.pos_y = torch.full(
            (envs,), cfg.FLOOR_TOP - cfg.DODGER_BOX[1], dtype=self.dtype, device=device
        )
        self.vel_x = torch.zeros(envs, dtype=self.dtype, device=device)
        self.vel_y = torch.zeros(envs, dtype=self.dtype, device=device)
        self.grounded = torch.ones(envs, dtype=torch.bool, device=device)
        self.jump_latch = torch.zeros(envs, dtype=torch.bool, device=device)
        self.stun = torch.zeros(envs, dtype=self.dtype, device=device)
        self.invulnerable = torch.zeros(envs, dtype=self.dtype, device=device)
        self.dash_timer = torch.zeros(envs, dtype=self.dtype, device=device)
        self.dash_cooldown = torch.zeros(envs, dtype=self.dtype, device=device)

        self.damage = torch.zeros(envs, dtype=self.dtype, device=device)
        self.level = torch.zeros(envs, dtype=torch.long, device=device)

        self.drop_timer = torch.zeros(envs, dtype=self.dtype, device=device)
        self.drop_speed = torch.full((envs,), cfg.DROP_BASE_SPEED, dtype=self.dtype, device=device)
        self.drop_ramp = torch.zeros(envs, dtype=self.dtype, device=device)

        self.round_elapsed = torch.zeros(envs, dtype=self.dtype, device=device)
        self.episodes = torch.zeros(envs, dtype=self.dtype, device=device)
        self.damage_sum = torch.zeros(envs, dtype=self.dtype, device=device)
        self.damage_worst = torch.zeros(envs, dtype=self.dtype, device=device)
        self.final_level = torch.zeros(envs, dtype=self.dtype, device=device)
        self.dodges = torch.zeros(envs, dtype=self.dtype, device=device)
        self.near_misses = torch.zeros(envs, dtype=self.dtype, device=device)
        self.hits = torch.zeros(envs, dtype=self.dtype, device=device)
        self.score = torch.zeros(envs, dtype=self.dtype, device=device)

        return self.observation()

    def finish_rounds(self, done):
        envs = self.envs
        device = self.device
        mask = done.to(self.dtype)

        self.episodes = self.episodes + mask
        self.damage_sum = self.damage_sum + self.damage * mask
        self.damage_worst = torch.where(
            done, torch.maximum(self.damage_worst, self.damage), self.damage_worst
        )
        self.final_level = torch.where(done, self.level.to(self.dtype), self.final_level)

        keep = ~done
        self.obstacle_active = self.obstacle_active & keep[:, None]
        for field in (
            "obstacle_x",
            "obstacle_y",
            "obstacle_vx",
            "obstacle_vy",
            "obstacle_angle",
            "obstacle_spin",
            "obstacle_roll",
            "obstacle_settle",
        ):
            current = getattr(self, field)
            setattr(self, field, torch.where(keep[:, None], current, torch.zeros_like(current)))
        self.obstacle_cursor = torch.where(
            done, torch.zeros_like(self.obstacle_cursor), self.obstacle_cursor
        )
        self.obstacle_item = torch.where(
            done[:, None], torch.zeros_like(self.obstacle_item), self.obstacle_item
        )
        for field in ("obstacle_scored", "obstacle_hit"):
            setattr(self, field, getattr(self, field) & keep[:, None])

        self.pos_x = torch.where(done, self.sample_spawn_x(envs), self.pos_x)
        self.pos_y = torch.where(
            done,
            torch.full(
                (envs,), cfg.FLOOR_TOP - cfg.DODGER_BOX[1], dtype=self.dtype, device=device
            ),
            self.pos_y,
        )
        for field in (
            "vel_x",
            "vel_y",
            "damage",
            "drop_timer",
            "drop_ramp",
            "round_elapsed",
            "stun",
            "invulnerable",
            "dash_timer",
            "dash_cooldown",
        ):
            current = getattr(self, field)
            setattr(self, field, torch.where(done, torch.zeros_like(current), current))
        self.grounded = torch.where(done, torch.ones_like(self.grounded), self.grounded)
        self.jump_latch = torch.where(done, torch.zeros_like(self.jump_latch), self.jump_latch)
        self.level = torch.where(done, torch.zeros_like(self.level), self.level)
        self.drop_speed = torch.where(
            done, torch.full_like(self.drop_speed, cfg.DROP_BASE_SPEED), self.drop_speed
        )

    def sense_collisions(self):
        left = self.pos_x
        right = self.pos_x + cfg.DODGER_BOX[0]
        top = self.pos_y
        bottom = self.pos_y + cfg.DODGER_BOX[1]

        reach = torch.full_like(self.pos_x, cfg.SENSOR_REACH)
        sensors = {
            "wallLeft": reach.clone(),
            "wallRight": reach.clone(),
            "ceiling": reach.clone(),
            "ground": reach.clone(),
        }

        vertical = (top[:, None] < self.blocker_bottom) & (bottom[:, None] > self.blocker_y)
        horizontal = (left[:, None] < self.blocker_right) & (right[:, None] > self.blocker_x)
        big = torch.full_like(self.pos_x, cfg.SENSOR_REACH * 4.0)[:, None]

        wall_left = torch.where(
            vertical & (self.blocker_right <= left[:, None]),
            left[:, None] - self.blocker_right,
            big,
        )
        wall_right = torch.where(
            vertical & (self.blocker_x >= right[:, None]),
            self.blocker_x - right[:, None],
            big,
        )
        ceiling = torch.where(
            horizontal & (self.blocker_bottom <= top[:, None]),
            top[:, None] - self.blocker_bottom,
            big,
        )
        ground = torch.where(
            horizontal & (self.blocker_y >= bottom[:, None]),
            self.blocker_y - bottom[:, None],
            big,
        )

        sensors["wallLeft"] = tensor_minimum(wall_left)
        sensors["wallRight"] = tensor_minimum(wall_right)
        sensors["ceiling"] = tensor_minimum(ceiling)
        sensors["ground"] = tensor_minimum(ground)
        return sensors

    def observation(self):
        half = (cfg.PLAY_RIGHT - cfg.PLAY_LEFT) / 2
        center = cfg.PLAY_LEFT + half
        dodger_x = self.pos_x + cfg.DODGER_BOX[0] / 2
        dodger_y = self.pos_y
        max_speed = self.current_max_speed()

        observation = torch.zeros(
            (self.envs, cfg.OBSERVATION_SIZE), dtype=self.dtype, device=self.device
        )
        observation[:, 0] = (dodger_x - center) / half
        observation[:, 1] = self.vel_x / torch.clamp(max_speed, min=1.0)
        observation[:, 2] = max_speed / cfg.DODGER_MAX_SPEED_START
        observation[:, 3] = self.grounded.to(self.dtype)
        observation[:, 4] = self.vel_y / cfg.DODGER_MAX_FALL
        observation[:, 5] = self.damage / cfg.DAMAGE_CEILING
        observation[:, 6] = self.level.to(self.dtype) / (cfg.DAMAGE_LEVELS - 1)
        observation[:, 7] = 1.0 - torch.clamp(
            self.dash_cooldown / cfg.DASH_COOLDOWN, min=0.0, max=1.0
        )
        observation[:, 8] = torch.clamp(self.stun / cfg.REACTION_STUN, min=0.0, max=1.0)

        sensors = self.sense_collisions()
        for index, name in enumerate(SENSOR_ORDER):
            observation[:, 9 + index] = torch.clamp(sensors[name], min=0.0, max=cfg.SENSOR_REACH) / cfg.SENSOR_REACH

        half_width = self.item_half_width[self.obstacle_item]
        half_height = self.item_half_height[self.obstacle_item]
        dx = self.obstacle_x + half_width - dodger_x[:, None]
        dy = self.obstacle_y + half_height - dodger_y[:, None]
        distance = dx.abs() + torch.clamp(dy, min=0.0)
        ranked = torch.where(self.obstacle_active, distance, torch.full_like(distance, self.inf))

        order = torch.argsort(ranked, dim=1)[:, : cfg.ITEM_SLOTS]
        valid = self.obstacle_active.gather(1, order) & (
            ranked.gather(1, order) < cfg.OBSERVE_RADIUS
        )
        gdx = dx.gather(1, order)
        gdy = dy.gather(1, order)
        gvx = self.obstacle_vx.gather(1, order)
        gvy = self.obstacle_vy.gather(1, order)
        gitem = self.obstacle_item.gather(1, order)
        groll = self.obstacle_roll.gather(1, order)
        landed = gvy <= 0

        extent = torch.maximum(half_width, half_height).gather(1, order)
        base_damage = self.item_damage_min[gitem] + (
            self.item_damage_max[gitem] - self.item_damage_min[gitem]
        ) * groll

        for slot in range(cfg.ITEM_SLOTS):
            base = cfg.GLOBAL_FEATURES + slot * cfg.ITEM_FEATURES
            mask = valid[:, slot]
            observation[:, base] = mask.to(self.dtype)
            observation[:, base + 1] = torch.where(mask, gdx[:, slot] / cfg.OBSERVE_RADIUS, 0.0)
            observation[:, base + 2] = torch.where(mask, gdy[:, slot] / cfg.OBSERVE_RADIUS, 0.0)
            observation[:, base + 3] = torch.where(mask, gvx[:, slot] / cfg.ITEM_LATERAL, 0.0)
            observation[:, base + 4] = torch.where(mask, gvy[:, slot] / cfg.ITEM_MAX_FALL, 0.0)
            observation[:, base + 5] = torch.where(mask, landed[:, slot].to(self.dtype), 0.0)
            observation[:, base + 6] = torch.where(mask, extent[:, slot] / cfg.TILE, 0.0)
            observation[:, base + 7] = torch.where(
                mask, base_damage[:, slot] / cfg.MAX_DAMAGE_ITEM, 0.0
            )

        return observation

    def resolve_axis(self, axis):
        width, height = cfg.DODGER_BOX
        overlaps = (
            (self.pos_x[:, None] < self.blocker_right)
            & (self.pos_x[:, None] + width > self.blocker_x)
            & (self.pos_y[:, None] < self.blocker_bottom)
            & (self.pos_y[:, None] + height > self.blocker_y)
        )

        if axis == 0:
            right = torch.where(
                overlaps & (self.vel_x[:, None] > 0), self.blocker_x - width, self.inf
            )
            left = torch.where(
                overlaps & (self.vel_x[:, None] < 0), self.blocker_right, self.neg_inf
            )
            push = overlaps.any(dim=1) & (self.vel_x != 0)
            self.pos_x = torch.where(push & (self.vel_x > 0), right.min(dim=1).values, self.pos_x)
            self.pos_x = torch.where(push & (self.vel_x < 0), left.max(dim=1).values, self.pos_x)
            self.vel_x = torch.where(push, torch.zeros_like(self.vel_x), self.vel_x)
            return

        down = torch.where(
            overlaps & (self.vel_y[:, None] > 0), self.blocker_y - height, self.inf
        )
        up = torch.where(overlaps & (self.vel_y[:, None] < 0), self.blocker_bottom, self.neg_inf)
        push = overlaps.any(dim=1) & (self.vel_y != 0)
        landed = overlaps.any(dim=1) & (self.vel_y > 0)
        self.pos_y = torch.where(push & (self.vel_y > 0), down.min(dim=1).values, self.pos_y)
        self.pos_y = torch.where(push & (self.vel_y < 0), up.max(dim=1).values, self.pos_y)
        self.vel_y = torch.where(push, torch.zeros_like(self.vel_y), self.vel_y)
        self.grounded = self.grounded | landed

    def step_dodger(self, actions):
        axis = torch.zeros(self.envs, dtype=self.dtype, device=self.device)
        axis = torch.where(actions == cfg.ACTION_LEFT, torch.full_like(axis, -1.0), axis)
        axis = torch.where(actions == cfg.ACTION_RIGHT, torch.full_like(axis, 1.0), axis)
        axis = torch.where(actions == cfg.ACTION_JUMP_LEFT, torch.full_like(axis, -1.0), axis)
        axis = torch.where(actions == cfg.ACTION_JUMP_RIGHT, torch.full_like(axis, 1.0), axis)
        axis = torch.where(actions == cfg.ACTION_DASH_LEFT, torch.full_like(axis, -1.0), axis)
        axis = torch.where(actions == cfg.ACTION_DASH_RIGHT, torch.full_like(axis, 1.0), axis)
        jumping = (
            (actions == cfg.ACTION_JUMP)
            | (actions == cfg.ACTION_JUMP_LEFT)
            | (actions == cfg.ACTION_JUMP_RIGHT)
        )
        dashing = (actions == cfg.ACTION_DASH_LEFT) | (actions == cfg.ACTION_DASH_RIGHT)

        max_speed = self.current_max_speed()
        moving = axis != 0
        control = self.stun <= 0.0

        self.stun = torch.clamp(self.stun - cfg.DT, min=0.0)
        self.invulnerable = torch.clamp(self.invulnerable - cfg.DT, min=0.0)
        self.dash_timer = torch.clamp(self.dash_timer - cfg.DT, min=0.0)
        self.dash_cooldown = torch.clamp(self.dash_cooldown - cfg.DT, min=0.0)

        dashing_now = self.dash_timer > 0.0
        self.vel_x = torch.where(
            self.grounded & ~dashing_now,
            self.vel_x * cfg.DODGER_GROUND_FRICTION,
            self.vel_x,
        )
        accelerated = torch.clamp(
            self.vel_x + axis * cfg.DODGER_ACCELERATION * cfg.DT, -max_speed, max_speed
        )
        self.vel_x = torch.where(
            dashing_now,
            self.vel_x,
            torch.where(moving & control, accelerated, self.vel_x * self.speed_decay),
        )

        dash_ready = (self.dash_cooldown <= 0.0) & ~dashing_now
        dash_now = dashing & dash_ready & control
        self.vel_x = torch.where(dash_now, axis * self.current_dash(), self.vel_x)
        self.dash_timer = torch.where(
            dash_now, torch.full_like(self.dash_timer, cfg.DASH_SECONDS), self.dash_timer
        )
        self.dash_cooldown = torch.where(
            dash_now, torch.full_like(self.dash_cooldown, cfg.DASH_COOLDOWN), self.dash_cooldown
        )

        was_grounded = self.grounded
        self.grounded = torch.zeros_like(self.grounded)
        speed_limit = torch.where(dashing_now | dash_now, self.current_dash(), max_speed)
        self.vel_x = torch.clamp(self.vel_x, -speed_limit, speed_limit)
        self.pos_x = self.pos_x + self.vel_x * cfg.DT
        self.resolve_axis(0)

        self.vel_y = torch.clamp(self.vel_y, -cfg.DODGER_MAX_FALL, cfg.DODGER_MAX_FALL)
        self.vel_y = self.vel_y + self.gravity_step
        self.pos_y = self.pos_y + self.vel_y * cfg.DT
        self.resolve_axis(1)

        jump_now = jumping & ~self.jump_latch & was_grounded
        self.vel_y = torch.where(jump_now, -self.current_jump(), self.vel_y)
        self.jump_latch = jumping
        self.pos_x = torch.clamp(self.pos_x, 0.0, cfg.WIDTH - cfg.DODGER_BOX[0])

    def set_drop_cap(self, cap):
        self.drop_cap = min(max(cap, cfg.DROP_BASE_SPEED), cfg.DROP_MAX_SPEED)

    def step_dropper(self):
        self.drop_ramp = self.drop_ramp + cfg.DT
        ramp = self.drop_ramp >= cfg.DROP_RAMP_SECONDS
        self.drop_speed = torch.where(
            ramp,
            torch.clamp(self.drop_speed + cfg.DROP_SPEED_STEP, max=self.drop_cap),
            self.drop_speed,
        )
        self.drop_ramp = torch.where(ramp, self.drop_ramp - cfg.DROP_RAMP_SECONDS, self.drop_ramp)

        self.drop_timer = self.drop_timer + cfg.DT
        ready = self.drop_timer >= cfg.DROP_INTERVAL

        self.spawn_item(ready)
        self.steer_items()

    def steer_items(self):
        """Os itens seguem o desviador enquanto caem.

        O item nasce no centro do teto, mas nao cai reto: ele persegue a
        posicao horizontal do desviador, entao a chuva continua caindo em cima
        dele como antes. A perseguicao e limitada por `DROP_STEER_SPEED`, o
        mesmo numero que o jogo usa para a guinada do jogador, entao a
        dificuldade e a mesma das duas partes.
        """
        falling = self.obstacle_active & (self.obstacle_vy > 0)
        half_width = self.item_half_width[self.obstacle_item]
        item_center = self.obstacle_x + half_width
        dodger_center = self.pos_x + cfg.DODGER_BOX[0] / 2
        delta = dodger_center[:, None] - item_center
        step = torch.clamp(delta, min=-cfg.DROP_STEER_SPEED * cfg.DT, max=cfg.DROP_STEER_SPEED * cfg.DT)

        self.obstacle_vx = torch.where(falling, step / cfg.DT, self.obstacle_vx)

    def spawn_item(self, ready):
        rows = torch.arange(self.envs, device=self.device)
        index = self.obstacle_cursor % self.slots

        if self.item_generator is None:
            self.item_generator = torch.Generator(device=self.device)
            self.item_generator.manual_seed(self.seed + 7919)

        def draw():
            return torch.rand(ready.shape, generator=self.item_generator, device=self.device)

        picked = torch.searchsorted(self.item_cumulative, draw()).clamp(max=self.item_count - 1)
        half_width = self.item_half_width[picked]
        half_height = self.item_half_height[picked]

        center = cfg.WIDTH / 2 - half_width
        spin = self.item_spin_min[picked] + draw() * (
            self.item_spin_max[picked] - self.item_spin_min[picked]
        )
        direction = torch.where(draw() < 0.5, -1.0, 1.0)
        roll = draw()
        angle = draw() * HALF_TURN

        self.obstacle_item[rows, index] = torch.where(ready, picked, self.obstacle_item[rows, index])
        self.obstacle_x[rows, index] = torch.where(ready, center, self.obstacle_x[rows, index])
        self.obstacle_y[rows, index] = torch.where(
            ready, cfg.SPAWN_Y - half_height * 2, self.obstacle_y[rows, index]
        )
        self.obstacle_vx[rows, index] = torch.where(
            ready, torch.zeros_like(center), self.obstacle_vx[rows, index]
        )
        self.obstacle_vy[rows, index] = torch.where(
            ready, self.drop_speed, self.obstacle_vy[rows, index]
        )
        self.obstacle_angle[rows, index] = torch.where(
            ready, angle, self.obstacle_angle[rows, index]
        )
        self.obstacle_spin[rows, index] = torch.where(
            ready, spin * direction, self.obstacle_spin[rows, index]
        )
        self.obstacle_roll[rows, index] = torch.where(ready, roll, self.obstacle_roll[rows, index])
        self.obstacle_active[rows, index] = self.obstacle_active[rows, index] | ready
        self.obstacle_settle[rows, index] = torch.where(
            ready, torch.zeros_like(center), self.obstacle_settle[rows, index]
        )
        self.obstacle_scored[rows, index] = self.obstacle_scored[rows, index] & ~ready
        self.obstacle_hit[rows, index] = self.obstacle_hit[rows, index] & ~ready
        self.obstacle_cursor = self.obstacle_cursor + ready.to(torch.long)
        self.drop_timer = torch.where(ready, self.drop_timer - cfg.DROP_INTERVAL, self.drop_timer)

    def step_items(self):
        falling = self.obstacle_active & (self.obstacle_vy > 0)
        half_width = self.item_half_width[self.obstacle_item]
        half_height = self.item_half_height[self.obstacle_item]

        # A queda e o `integrateAxis` do jogo: capacidade terminal -> empurrao
        # proprio do item -> gravidade, nesta ordem. A ordem importa perto do
        # teto de velocidade.
        self.obstacle_vy = torch.where(
            falling,
            torch.clamp(self.obstacle_vy, max=cfg.ITEM_MAX_FALL),
            self.obstacle_vy,
        )
        self.obstacle_vy = torch.where(
            falling,
            torch.clamp(
                self.obstacle_vy + cfg.DROPPED_ACCELERATION * cfg.DT, max=cfg.DROP_MAX_SPEED
            ),
            self.obstacle_vy,
        )
        self.obstacle_vy = torch.where(
            falling,
            torch.clamp(self.obstacle_vy + self.item_gravity_step, max=cfg.ITEM_MAX_FALL),
            self.obstacle_vy,
        )

        new_x = self.obstacle_x + self.obstacle_vx * cfg.DT
        hit_left = falling & (new_x < 0)
        hit_right = falling & (new_x + half_width * 2 > cfg.WIDTH)
        new_x = torch.where(hit_left, torch.zeros_like(new_x), new_x)
        new_x = torch.where(hit_right, cfg.WIDTH - half_width * 2, new_x)
        self.obstacle_vx = torch.where(
            hit_left | hit_right, -self.obstacle_vx * cfg.ITEM_RESTITUTION, self.obstacle_vx
        )

        new_y = self.obstacle_y + self.obstacle_vy * cfg.DT
        landing = falling & (new_y + half_height * 2 >= cfg.FLOOR_TOP)
        new_y = torch.where(landing, cfg.FLOOR_TOP - half_height * 2, new_y)
        self.obstacle_vy = torch.where(landing, torch.zeros_like(self.obstacle_vy), self.obstacle_vy)

        self.obstacle_x = torch.where(falling, new_x, self.obstacle_x)
        self.obstacle_y = torch.where(falling, new_y, self.obstacle_y)
        self.obstacle_angle = self.obstacle_angle + self.obstacle_spin * cfg.DT

        landed = self.obstacle_active & (self.obstacle_vy <= 0)
        self.obstacle_spin = torch.where(
            landed, self.obstacle_spin * self.spin_decay, self.obstacle_spin
        )
        self.obstacle_vx = torch.where(landed, self.obstacle_vx * self.slide_decay, self.obstacle_vx)
        self.obstacle_x = torch.where(
            landed, self.obstacle_x + self.obstacle_vx * cfg.DT, self.obstacle_x
        )
        self.obstacle_settle = torch.where(
            landed, self.obstacle_settle + cfg.DT, self.obstacle_settle
        )
        self.obstacle_active = self.obstacle_active & ~(
            landed & (self.obstacle_settle >= cfg.ITEM_SETTLE)
        )

    def dodger_bounds(self):
        width, height = cfg.DODGER_BOX
        center_x = self.pos_x + width / 2
        center_y = self.pos_y + height / 2
        return center_x, center_y, width / 2, height / 2

    def overlap_depth(self, axis_x, axis_y):
        """Separating-axis overlap do item (OBB) contra o desviador (AABB).

        Espelha `overlapOnAxis` em engine/physics/oriented-box.ts. Cada eixo
        recebe as quatro componentes do SAT: as duas do item (rotacionadas) e as
        duas do mundo, que sao as normais do retangulo alinhado do desviador.
        """
        half_width = self.item_half_width[self.obstacle_item]
        half_height = self.item_half_height[self.obstacle_item]
        cos = torch.cos(self.obstacle_angle)
        sin = torch.sin(self.obstacle_angle)

        item_center_x = self.obstacle_x + half_width
        item_center_y = self.obstacle_y + half_height
        other_x, other_y, other_half_w, other_half_h = self.dodger_bounds()

        item_radius = half_width * (cos * axis_x + sin * axis_y).abs() + half_height * (
            -sin * axis_x + cos * axis_y
        ).abs()
        other_radius = other_half_w * axis_x.abs() + other_half_h * axis_y.abs()
        distance = (
            (item_center_x - other_x[:, None]) * axis_x
            + (item_center_y - other_y[:, None]) * axis_y
        ).abs()

        return item_radius + other_radius - distance

    def detect_hits(self):
        cos = torch.cos(self.obstacle_angle)
        sin = torch.sin(self.obstacle_angle)
        ones = torch.ones_like(cos)
        zeros = torch.zeros_like(cos)

        axes = (
            (cos, sin),
            (-sin, cos),
            (ones, zeros),
            (zeros, ones),
        )

        separated = torch.zeros((self.envs, self.slots), dtype=torch.bool, device=self.device)
        for axis_x, axis_y in axes:
            separated = separated | (self.overlap_depth(axis_x, axis_y) < 0)

        shielded = self.invulnerable > 0.0
        return self.obstacle_active & ~self.obstacle_hit & ~separated & ~shielded[:, None]

    def apply_impacts(self):
        hits = self.detect_hits()
        impact_speed = torch.sqrt(self.obstacle_vx**2 + self.obstacle_vy**2)
        spin_max = torch.clamp(self.item_spin_max[self.obstacle_item], min=1e-6)
        speed_factor = torch.clamp(
            impact_speed / cfg.ITEM_REFERENCE_SPEED,
            cfg.ITEM_SPEED_FACTOR_MIN,
            cfg.ITEM_SPEED_FACTOR_MAX,
        )
        spin_factor = 1.0 + cfg.ITEM_SPIN_DAMAGE_BONUS * torch.clamp(
            self.obstacle_spin.abs() / spin_max, 0, 1
        )
        base_damage = self.item_damage_min[self.obstacle_item] + (
            self.item_damage_max[self.obstacle_item] - self.item_damage_min[self.obstacle_item]
        ) * self.obstacle_roll
        damage = base_damage * speed_factor * spin_factor

        applied = torch.where(hits, damage, torch.zeros_like(damage))
        round_damage = applied.sum(dim=1)
        self.damage = self.damage + round_damage
        self.score = self.score + round_damage
        self.hits = self.hits + hits.sum(dim=1).to(self.dtype)
        self.obstacle_hit = self.obstacle_hit | hits
        self.obstacle_vy = torch.where(hits, torch.zeros_like(self.obstacle_vy), self.obstacle_vy)

        self.level = torch.clamp(
            (self.damage / cfg.DAMAGE_PER_LEVEL).to(torch.long), max=cfg.DAMAGE_LEVELS - 1
        )

        self.react(applied, hits, round_damage)

    def react(self, applied, hits, round_damage):
        """Empurrao e travamento apos o golpe, espelhando Dodger.react().

        A direcao e a media ponderada pelo dano de cada item que encostou: o
        item mais pesado decide para onde o desviador e jogado, como no jogo,
        onde o contato de maior dano define o empurrao.
        """
        hit_any = round_damage > 0
        if not bool(hit_any.any()):
            self.stun = torch.clamp(self.stun - cfg.DT, min=0.0)
            return

        half_width = self.item_half_width[self.obstacle_item]
        item_center_x = self.obstacle_x + half_width
        dodger_center = self.pos_x + cfg.DODGER_BOX[0] / 2
        towards = torch.where(item_center_x < dodger_center[:, None], -1.0, 1.0)

        weighted = torch.where(hits, towards * applied, torch.zeros_like(towards)).sum(dim=1)
        direction = torch.sign(weighted)
        direction = torch.where(direction == 0, torch.ones_like(direction), direction)

        magnitude = torch.clamp(
            cfg.REACTION_KNOCKBACK_BASE + round_damage * cfg.REACTION_KNOCKBACK_PER_DAMAGE,
            max=cfg.REACTION_KNOCKBACK_MAX,
        )

        self.apply_knockback(direction, magnitude, hit_any)
        self.stun = torch.where(
            hit_any,
            torch.full_like(self.stun, cfg.REACTION_STUN),
            torch.clamp(self.stun - cfg.DT, min=0.0),
        )
        self.invulnerable = torch.where(
            hit_any,
            torch.full_like(self.invulnerable, cfg.REACTION_INVULNERABLE),
            torch.clamp(self.invulnerable - cfg.DT, min=0.0),
        )

    def apply_knockback(self, direction, magnitude, hit_any):
        max_speed = self.current_max_speed()
        self.vel_x = torch.where(
            hit_any,
            direction * torch.minimum(magnitude, max_speed),
            self.vel_x,
        )
        self.vel_y = torch.where(hit_any, -cfg.REACTION_POP, self.vel_y)

    def detect_dodges(self):
        landed = self.obstacle_active & ~self.obstacle_scored & (self.obstacle_vy <= 0)
        half_width = self.item_half_width[self.obstacle_item]
        dodger_x = self.pos_x + cfg.DODGER_BOX[0] / 2
        gap = (self.obstacle_x + half_width - dodger_x[:, None]).abs()
        reach = half_width + cfg.DODGER_BOX[0] / 2
        dodge = landed & ~self.obstacle_hit & (gap <= reach + cfg.DODGE_DISTANCE)
        near = dodge & (gap <= reach + cfg.NEAR_MISS_DISTANCE)
        self.obstacle_scored = self.obstacle_scored | dodge
        return dodge.any(dim=1), near.any(dim=1)

    def step(self, actions):
        self.round_elapsed = self.round_elapsed + cfg.DT
        self.step_dodger(actions)
        self.step_items()
        self.apply_impacts()
        dodge, near = self.detect_dodges()
        self.dodges = self.dodges + dodge.to(self.dtype)
        self.near_misses = self.near_misses + near.to(self.dtype)
        self.step_dropper()
        self.finish_rounds(self.round_elapsed >= cfg.ROUND_SECONDS)
        return self.observation()

    def metrics(self):
        episodes = self.episodes
        return {
            "episodes": episodes,
            "damage_mean": self.damage_sum / torch.clamp(episodes, min=1.0),
            "damage_worst": self.damage_worst,
            "final_level": self.final_level,
            "dodges": self.dodges,
            "near_misses": self.near_misses,
            "hits": self.hits,
            "score": self.score,
            "damage": self.damage,
            "level": self.level,
        }
