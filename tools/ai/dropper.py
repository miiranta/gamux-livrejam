"""Politica do jogador que solta os objetos. Usada so no treino."""

import torch

import config as cfg


class DropperPolicy:
    def __init__(self, jitter=60.0, lead_scale=1.0, seed=0):
        self.jitter = jitter
        self.lead_scale = lead_scale
        self.generator = torch.Generator(device="cpu").manual_seed(seed)

    def sample(self, count, device):
        return torch.rand(count, generator=self.generator).to(device)

    def __call__(self, state):
        pos_x = state["pos_x"]
        vel_x = state["vel_x"]
        obstacle_x = state["obstacle_x"]
        obstacle_y = state["obstacle_y"]
        obstacle_active = state["obstacle_active"]

        device = pos_x.device
        count = pos_x.shape[0]
        size = cfg.FALLER_SIZE

        dodger_x = pos_x + cfg.DODGER_BOX[0] / 2
        faller_center_x = obstacle_x + size / 2
        faller_center_y = obstacle_y + size / 2

        falling = obstacle_active & (faller_center_y < cfg.FLOOR_TOP)
        lead = torch.clamp(
            (cfg.FLOOR_TOP - faller_center_y) / cfg.FALLER_MAX_FALL * self.lead_scale, 0.0, 0.9
        )

        dodger_ahead = dodger_x[:, None] + vel_x[:, None] * lead
        gap = torch.where(
            falling,
            (faller_center_x - dodger_ahead).abs(),
            torch.full_like(faller_center_x, float("inf")),
        )

        best = torch.argmin(gap, dim=1)
        rows = torch.arange(count, device=device)
        target = faller_center_x[rows, best]
        covered = torch.isfinite(gap[rows, best])

        noise = (self.sample(count, device) * 2 - 1) * self.jitter
        aim = target + noise
        fallback = cfg.FALLER_SPAWN_MARGIN + self.sample(count, device) * (
            cfg.WIDTH - cfg.FALLER_SPAWN_MARGIN * 2 - size
        )

        return torch.where(covered, aim, fallback)
