"""Politica do oponente que solta os objetos durante o treino.

Imita um jogador humano: mira onde o desviador *vai estar* quando o objeto
chegar ao chao, com erro de mira. Tambem joga objetos aleatorios para que a
politica aprenda a lidar com objetos que ela nao previu.

Deve espelhar `face-smashing.ts:aimPoint()` e `FallerSpawner.spawn()`.
"""

import torch

import config as cfg


class DropperPolicy:
    def __init__(self, jitter=cfg.DROP_AIM_JITTER, scatter=cfg.DROP_SCATTER, seed=0):
        self.jitter = jitter
        self.scatter = scatter
        self.seed = seed
        self.device = None
        self.generator = None

    def _ensure(self, device):
        if self.device == device:
            return
        self.device = device
        self.generator = torch.Generator(device=device)
        self.generator.manual_seed(self.seed)

    def sample(self, shape, device):
        self._ensure(device)
        return torch.rand(shape, generator=self.generator, device=device)

    def __call__(self, state):
        pos_x = state["pos_x"]
        vel_x = state["vel_x"]
        fall_speed = state["fall_speed"]
        grounded = state["grounded"]

        device = pos_x.device
        count = pos_x.shape[0]
        size = cfg.MAX_ITEM_EXTENT

        dodger_x = pos_x + cfg.DODGER_BOX[0] / 2
        dodger_vx = torch.where(grounded, vel_x, vel_x * 0.5)

        drop_height = cfg.FLOOR_TOP - (cfg.SPAWN_Y - size / 2)
        lead = torch.clamp(drop_height / torch.clamp(fall_speed, min=1.0), max=cfg.DROP_MAX_LEAD)

        predicted = torch.clamp(
            dodger_x + dodger_vx * lead, cfg.PLAY_LEFT, cfg.PLAY_RIGHT - size
        )

        jitter = (self.sample((count,), device) * 2 - 1) * self.jitter
        scatter = cfg.ITEM_SPAWN_MARGIN + self.sample((count,), device) * (
            cfg.WIDTH - cfg.ITEM_SPAWN_MARGIN * 2 - size
        )

        roll = self.sample((count,), device)
        aim = predicted + jitter

        return torch.where(roll < self.scatter, scatter, aim)
