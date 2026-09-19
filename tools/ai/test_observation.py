"""Verifica que a observacao do Python bate com a do TypeScript.

O vetor de referencia foi produzido por `writeObservation`
(src/game/ai/observation.ts) e esta fixado em `fixtures/observation_fixture.json`.
"""

import json
import os

import torch

import config as cfg
from sim import FaceSmashingSim

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURE = os.path.join(HERE, "fixtures", "observation_fixture.json")


def load_fixture():
    with open(FIXTURE, encoding="utf-8") as handle:
        return json.load(handle)


def build_sim(fixture, device="cpu"):
    sim = FaceSmashingSim(1, device=device, seed=0)
    sim.reset()

    dodger = fixture["dodger"]
    sim.max_speed = torch.tensor([dodger["maxSpeedX"]], dtype=sim.dtype, device=sim.device)
    sim.pos_x = torch.tensor(
        [dodger["feetX"] - cfg.DODGER_BOX[0] / 2], dtype=sim.dtype, device=sim.device
    )
    sim.pos_y = torch.tensor(
        [cfg.FLOOR_TOP - cfg.DODGER_BOX[1]], dtype=sim.dtype, device=sim.device
    )
    sim.vel_x = torch.tensor([dodger["velocityX"]], dtype=sim.dtype, device=sim.device)

    sim.obstacle_active.zero_()
    for index, faller in enumerate(fixture["fallers"]):
        sim.obstacle_x[0, index] = faller["x"]
        sim.obstacle_y[0, index] = faller["y"]
        sim.obstacle_vx[0, index] = faller["velocityX"]
        sim.obstacle_vy[0, index] = faller["velocityY"]
        sim.obstacle_active[0, index] = True

    return sim


def test_observation_matches_typescript():
    fixture = load_fixture()
    expected = torch.tensor(fixture["observation"], dtype=torch.float32)

    actual = build_sim(fixture).observation()[0]

    assert actual.shape == expected.shape, f"shape {tuple(actual.shape)} != {tuple(expected.shape)}"
    difference = (actual - expected).abs().max().item()
    assert difference < 1e-5, f"max difference {difference} > 1e-5"


if __name__ == "__main__":
    test_observation_matches_typescript()
    print("observation contract OK")