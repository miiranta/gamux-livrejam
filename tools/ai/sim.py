"""Simulacao vetorizada do jogo, espelhando src/game/dungeon-drop.ts."""

import torch

import config as cfg


class DungeonDropSim:
    def __init__(self, envs, device="cpu", seed=0):
        self.envs = envs
        self.device = torch.device(device)
        self.seed = seed
        self.dtype = torch.float32
        self.blockers = [tuple(box) for box in cfg.blockers()]
        self.slots = cfg.MAX_FALLER_SLOTS
        self.generator = torch.Generator(device="cpu").manual_seed(seed)
        self.reset()

    def sample_max_speed(self):
        weights = torch.tensor(cfg.SPEED_WEIGHTS, dtype=self.dtype)
        picks = torch.randint(0, len(cfg.SPEED_WEIGHTS), (self.envs,), generator=self.generator)
        return weights[picks].to(self.device)

    def reset(self):
        return self.reset_mask(torch.ones(self.envs, dtype=torch.bool))

    def reset_mask(self, mask):
        envs = self.envs
        device = self.device
        rows = torch.arange(envs, device=device)[mask]

        self.max_speed = self.sample_max_speed()
        self.obstacle_x = torch.zeros((envs, self.slots), dtype=self.dtype, device=device)
        self.obstacle_y = torch.zeros((envs, self.slots), dtype=self.dtype, device=device)
        self.obstacle_vx = torch.zeros((envs, self.slots), dtype=self.dtype, device=device)
        self.obstacle_vy = torch.zeros((envs, self.slots), dtype=self.dtype, device=device)
        self.obstacle_active = torch.zeros((envs, self.slots), dtype=torch.bool, device=device)
        self.obstacle_settle = torch.zeros((envs, self.slots), dtype=self.dtype, device=device)
        self.obstacle_scored = torch.zeros((envs, self.slots), dtype=torch.bool, device=device)
        self.obstacle_cursor = torch.zeros(envs, dtype=torch.long, device=device)

        half = (cfg.PLAY_RIGHT - cfg.PLAY_LEFT) / 2
        self.pos_x = torch.full((envs,), cfg.PLAY_LEFT + half, dtype=self.dtype, device=device)
        self.pos_y = torch.full(
            (envs,), cfg.FLOOR_TOP - cfg.DODGER_BOX[1], dtype=self.dtype, device=device
        )
        self.vel_x = torch.zeros(envs, dtype=self.dtype, device=device)
        self.vel_y = torch.zeros(envs, dtype=self.dtype, device=device)
        self.grounded = torch.ones(envs, dtype=torch.bool, device=device)
        self.jump_latch = torch.zeros(envs, dtype=torch.bool, device=device)

        self.drop_timer = torch.zeros(envs, dtype=self.dtype, device=device)
        self.drop_elapsed = torch.zeros(envs, dtype=self.dtype, device=device)
        self.drop_speed = torch.full(
            (envs,), cfg.DROP_BASE_SPEED, dtype=self.dtype, device=device
        )
        self.drop_ramp = torch.zeros(envs, dtype=self.dtype, device=device)

        self.elapsed = torch.zeros(envs, dtype=self.dtype, device=device)
        self.alive = torch.ones(envs, dtype=torch.bool, device=device)
        self.score = torch.zeros(envs, dtype=self.dtype, device=device)
        self.hits = torch.zeros(envs, dtype=self.dtype, device=device)
        self.episodes = torch.zeros(envs, dtype=self.dtype, device=device)
        self.dodges = torch.zeros(envs, dtype=self.dtype, device=device)
        self.near_misses = torch.zeros(envs, dtype=self.dtype, device=device)
        self.survived = torch.zeros(envs, dtype=self.dtype, device=device)

        del rows
        return self.observation()

    def observation(self):
        half = (cfg.PLAY_RIGHT - cfg.PLAY_LEFT) / 2
        center = cfg.PLAY_LEFT + half
        dodger_x = self.pos_x + cfg.DODGER_BOX[0] / 2
        dodger_y = self.pos_y

        observation = torch.zeros(
            (self.envs, cfg.OBSERVATION_SIZE), dtype=self.dtype, device=self.device
        )
        observation[:, 0] = (dodger_x - center) / half
        observation[:, 1] = self.vel_x / self.max_speed
        observation[:, 2] = self.max_speed / cfg.DODGER_MAX_SPEED_MAX

        obstacle_cx = self.obstacle_x + cfg.FALLER_SIZE / 2
        obstacle_cy = self.obstacle_y + cfg.FALLER_SIZE / 2
        dx = obstacle_cx - dodger_x[:, None]
        dy = obstacle_cy - dodger_y[:, None]
        distance = dx.abs() + torch.clamp(dy, min=0.0)
        ranked = torch.where(
            self.obstacle_active, distance, torch.full_like(distance, float("inf"))
        )

        order = torch.argsort(ranked, dim=1)[:, : cfg.FALLER_SLOTS]
        valid = self.obstacle_active.gather(1, order) & (
            ranked.gather(1, order) < cfg.OBSERVE_RADIUS
        )
        gdx = dx.gather(1, order)
        gdy = dy.gather(1, order)
        gvx = self.obstacle_vx.gather(1, order)
        gvy = self.obstacle_vy.gather(1, order)
        landed = gvy <= 0

        for slot in range(cfg.FALLER_SLOTS):
            base = cfg.GLOBAL_FEATURES + slot * cfg.FALLER_FEATURES
            mask = valid[:, slot]
            observation[:, base] = mask.to(self.dtype)
            observation[:, base + 1] = torch.where(mask, gdx[:, slot] / cfg.OBSERVE_RADIUS, 0.0)
            observation[:, base + 2] = torch.where(mask, gdy[:, slot] / cfg.OBSERVE_RADIUS, 0.0)
            observation[:, base + 3] = torch.where(mask, gvx[:, slot] / cfg.FALLER_LATERAL, 0.0)
            observation[:, base + 4] = torch.where(mask, gvy[:, slot] / cfg.FALLER_MAX_FALL, 0.0)
            observation[:, base + 5] = torch.where(mask, landed[:, slot].to(self.dtype), 0.0)
            observation[:, base + 6] = torch.where(
                mask, torch.full_like(gdx[:, slot], cfg.FALLER_SIZE / cfg.TILE), 0.0
            )

        return observation

    def resolve_axis(self, axis):
        width, height = cfg.DODGER_BOX

        for bx, by, bw, bh in self.blockers:
            overlap = (
                (self.pos_x < bx + bw)
                & (self.pos_x + width > bx)
                & (self.pos_y < by + bh)
                & (self.pos_y + height > by)
            )
            if not bool(overlap.any()):
                continue

            if axis == 0:
                right = overlap & (self.vel_x > 0)
                left = overlap & (self.vel_x < 0)
                self.pos_x = torch.where(
                    right, torch.full_like(self.pos_x, bx - width), self.pos_x
                )
                self.pos_x = torch.where(left, torch.full_like(self.pos_x, bx + bw), self.pos_x)
                self.vel_x = torch.where(right | left, torch.zeros_like(self.vel_x), self.vel_x)
            else:
                down = overlap & (self.vel_y > 0)
                up = overlap & (self.vel_y < 0)
                self.pos_y = torch.where(
                    down, torch.full_like(self.pos_y, by - height), self.pos_y
                )
                self.pos_y = torch.where(up, torch.full_like(self.pos_y, by + bh), self.pos_y)
                self.vel_y = torch.where(down | up, torch.zeros_like(self.vel_y), self.vel_y)
                self.grounded = self.grounded | down

    def step_dodger(self, actions):
        axis = torch.zeros(self.envs, dtype=self.dtype, device=self.device)
        axis = torch.where(actions == cfg.ACTION_LEFT, torch.full_like(axis, -1.0), axis)
        axis = torch.where(actions == cfg.ACTION_RIGHT, torch.full_like(axis, 1.0), axis)
        axis = torch.where(actions == cfg.ACTION_JUMP_LEFT, torch.full_like(axis, -1.0), axis)
        axis = torch.where(actions == cfg.ACTION_JUMP_RIGHT, torch.full_like(axis, 1.0), axis)
        jumping = (
            (actions == cfg.ACTION_JUMP)
            | (actions == cfg.ACTION_JUMP_LEFT)
            | (actions == cfg.ACTION_JUMP_RIGHT)
        )

        moving = axis != 0
        target = axis * cfg.DODGER_ACCELERATION
        decay = torch.exp(torch.tensor(-cfg.DODGER_DRAG * cfg.DT, device=self.device))
        self.vel_x = torch.where(
            moving,
            torch.clamp(self.vel_x + target * cfg.DT, -self.max_speed, self.max_speed),
            self.vel_x * decay,
        )

        self.grounded = torch.zeros_like(self.grounded)

        self.vel_x = torch.clamp(self.vel_x, -self.max_speed, self.max_speed)
        self.pos_x = self.pos_x + self.vel_x * cfg.DT
        self.resolve_axis(0)

        self.vel_y = torch.clamp(self.vel_y, -cfg.DODGER_MAX_FALL, cfg.DODGER_MAX_FALL)
        self.vel_y = self.vel_y + cfg.GRAVITY * cfg.DT
        self.pos_y = self.pos_y + self.vel_y * cfg.DT
        self.resolve_axis(1)

        jump_now = jumping & ~self.jump_latch & self.grounded
        self.vel_y = torch.where(
            jump_now, torch.full_like(self.vel_y, -cfg.DODGER_JUMP), self.vel_y
        )
        self.jump_latch = jumping

        max_x = cfg.WIDTH - cfg.DODGER_BOX[0]
        self.pos_x = torch.clamp(self.pos_x, 0.0, max_x)

    def step_dropper(self, policy):
        self.drop_elapsed = self.drop_elapsed + cfg.DT
        self.drop_ramp = self.drop_ramp + cfg.DT

        ramp = self.drop_ramp >= cfg.DROP_RAMP_SECONDS
        self.drop_speed = torch.where(
            ramp,
            torch.clamp(
                self.drop_speed + cfg.DROP_SPEED_STEP, max=cfg.DROP_MAX_SPEED
            ),
            self.drop_speed,
        )
        self.drop_ramp = torch.where(ramp, self.drop_ramp - cfg.DROP_RAMP_SECONDS, self.drop_ramp)

        interval = torch.clamp(
            (cfg.DROP_BASE_INTERVAL * cfg.DROP_BASE_SPEED) / self.drop_speed,
            min=cfg.DROP_MIN_INTERVAL,
        )
        self.drop_timer = self.drop_timer + cfg.DT
        ready = self.drop_timer >= interval

        if bool(ready.any()):
            target = policy(
                {
                    "pos_x": self.pos_x,
                    "vel_x": self.vel_x,
                    "obstacle_x": self.obstacle_x,
                    "obstacle_y": self.obstacle_y,
                    "obstacle_active": self.obstacle_active,
                }
            )
            self.spawn_faller(target, ready, interval)

        self.step_falling()

    def spawn_faller(self, target_x, ready, interval):
        size = cfg.FALLER_SIZE
        rows = torch.arange(self.envs, device=self.device)
        index = self.obstacle_cursor % self.slots
        clamped = torch.clamp(target_x, 0.0, cfg.WIDTH - size)

        self.obstacle_x[rows, index] = torch.where(
            ready, clamped, self.obstacle_x[rows, index]
        )
        self.obstacle_y[rows, index] = torch.where(
            ready, torch.full_like(clamped, cfg.SPAWN_Y - size), self.obstacle_y[rows, index]
        )
        self.obstacle_vx[rows, index] = torch.where(
            ready, torch.zeros_like(clamped), self.obstacle_vx[rows, index]
        )
        self.obstacle_vy[rows, index] = torch.where(
            ready, self.drop_speed, self.obstacle_vy[rows, index]
        )
        self.obstacle_active[rows, index] = self.obstacle_active[rows, index] | ready
        self.obstacle_settle[rows, index] = torch.where(
            ready, torch.zeros_like(clamped), self.obstacle_settle[rows, index]
        )
        self.obstacle_scored[rows, index] = self.obstacle_scored[rows, index] & ~ready

        self.obstacle_cursor = self.obstacle_cursor + ready.to(torch.long)
        self.drop_timer = torch.where(ready, self.drop_timer - interval, self.drop_timer)

    def step_falling(self):
        size = cfg.FALLER_SIZE
        falling = self.obstacle_active & (self.obstacle_vy > 0)

        new_x = self.obstacle_x + self.obstacle_vx * cfg.DT
        hit_left = falling & (new_x < 0)
        hit_right = falling & (new_x + size > cfg.WIDTH)
        new_x = torch.where(hit_left, torch.zeros_like(new_x), new_x)
        new_x = torch.where(hit_right, torch.full_like(new_x, cfg.WIDTH - size), new_x)
        self.obstacle_vx = torch.where(
            hit_left | hit_right, -self.obstacle_vx * 0.25, self.obstacle_vx
        )

        new_y = self.obstacle_y + self.obstacle_vy * cfg.DT
        landing = falling & (new_y + size >= cfg.FLOOR_TOP)
        new_y = torch.where(landing, torch.full_like(new_y, cfg.FLOOR_TOP - size), new_y)
        self.obstacle_vy = torch.where(landing, torch.zeros_like(self.obstacle_vy), self.obstacle_vy)

        self.obstacle_x = torch.where(falling, new_x, self.obstacle_x)
        self.obstacle_y = torch.where(falling, new_y, self.obstacle_y)

        landed = self.obstacle_active & (self.obstacle_vy <= 0)
        decay = torch.exp(torch.tensor(-cfg.FALLER_SLIDE_DRAG * cfg.DT, device=self.device))
        self.obstacle_vx = torch.where(landed, self.obstacle_vx * decay, self.obstacle_vx)
        self.obstacle_x = torch.where(
            landed, self.obstacle_x + self.obstacle_vx * cfg.DT, self.obstacle_x
        )

        self.obstacle_settle = torch.where(
            landed, self.obstacle_settle + cfg.DT, self.obstacle_settle
        )
        expired = landed & (self.obstacle_settle >= cfg.FALLER_SETTLE)
        self.obstacle_active = self.obstacle_active & ~expired

    def detect_hits(self):
        width, height = cfg.DODGER_BOX
        size = cfg.FALLER_SIZE
        hit = (
            self.obstacle_active
            & (self.pos_x[:, None] < self.obstacle_x + size)
            & (self.pos_x[:, None] + width > self.obstacle_x)
            & (self.pos_y[:, None] < self.obstacle_y + size)
            & (self.pos_y[:, None] + height > self.obstacle_y)
        )
        return hit.any(dim=1)

    def detect_dodges(self):
        landed = self.obstacle_active & ~self.obstacle_scored & (self.obstacle_vy <= 0)
        dodger_x = self.pos_x + cfg.DODGER_BOX[0] / 2
        gap = (self.obstacle_x + cfg.FALLER_SIZE / 2 - dodger_x[:, None]).abs()
        safe = cfg.FALLER_SIZE / 2 + cfg.DODGER_BOX[0] / 2
        dodge = landed & (gap <= safe + cfg.DODGE_DISTANCE)
        near = dodge & (gap <= safe + cfg.NEAR_MISS_DISTANCE)
        self.obstacle_scored = self.obstacle_scored | dodge
        return dodge.any(dim=1), near.any(dim=1)

    def step(self, actions, dropper):
        active = self.alive

        self.step_dodger(actions)
        self.step_dropper(dropper)

        hit = self.detect_hits() & active
        dodge, near = self.detect_dodges()

        self.elapsed = self.elapsed + cfg.DT
        self.survived = torch.where(active, self.survived + cfg.DT, self.survived)
        self.score = self.score + active.to(self.dtype) * cfg.SCORE_SURVIVED_PER_SECOND * cfg.DT
        self.score = self.score + dodge.to(self.dtype) * cfg.SCORE_DODGE
        self.score = self.score + near.to(self.dtype) * cfg.SCORE_NEAR_MISS
        self.score = self.score + hit.to(self.dtype) * cfg.SCORE_HIT

        self.dodges = self.dodges + dodge.to(self.dtype)
        self.near_misses = self.near_misses + near.to(self.dtype)
        self.hits = self.hits + hit.to(self.dtype)
        self.episodes = self.episodes + hit.to(self.dtype)
        self.alive = active & ~hit

        observation = self.observation()
        observation[hit] = 0.0
        return observation

    def metrics(self):
        return {
            "alive": self.alive,
            "score": self.score,
            "hits": self.hits,
            "episodes": self.episodes,
            "survived": self.survived,
            "dodges": self.dodges,
            "near_misses": self.near_misses,
        }
