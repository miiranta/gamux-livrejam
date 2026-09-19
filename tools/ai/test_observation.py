"""Verifica que a observacao do Python bate com a do TypeScript.

O vetor de referencia e produzido pelo jogo real: `fixture-harness.ts` monta uma
cena fixa, chama `writeObservation` (src/game/ai/observation.ts) e grava o
resultado em `fixtures/observation_fixture.json`. O simulador de treino precisa
reproduzir exatamente os mesmos 39 valores para a politica treinada funcionar no
navegador.

Para regerar a fixture depois de mudar observacao ou fisica:

    cd livrejam && ./node_modules/.bin/esbuild fixture-harness.ts \
        --bundle --platform=node --format=cjs --outfile=/tmp/fixture-harness.cjs
    node /tmp/fixture-harness.cjs > ../tools/ai/fixtures/observation_fixture.json
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


def scalar(value, sim):
    return torch.tensor([value], dtype=sim.dtype, device=sim.device)


def build_sim(fixture, device="cpu"):
    sim = FaceSmashingSim(1, device=device, seed=0)
    sim.reset()

    dodger = fixture["dodger"]
    sim.pos_x = scalar(dodger["feetX"] - cfg.DODGER_BOX[0] / 2, sim)
    sim.pos_y = scalar(cfg.FLOOR_TOP - cfg.DODGER_BOX[1], sim)
    sim.vel_x = scalar(dodger["velocityX"], sim)
    sim.vel_y = scalar(0.0, sim)
    sim.grounded = torch.zeros(1, dtype=torch.bool, device=sim.device)
    sim.damage = scalar(dodger["damage"], sim)
    sim.level = torch.tensor(
        [cfg.damage_level(dodger["damage"])], dtype=torch.long, device=sim.device
    )
    sim.dash_cooldown = scalar(dodger.get("dashCooldown", 0.0), sim)

    measured_speed = sim.current_max_speed().item()
    assert abs(measured_speed - dodger["maxSpeedX"]) < 1e-3, (
        f"maxSpeed do fixture {dodger['maxSpeedX']} != escala por nivel {measured_speed}"
    )

    sim.obstacle_active.zero_()
    for index, item in enumerate(fixture["items"]):
        sim.obstacle_x[0, index] = item["x"]
        sim.obstacle_y[0, index] = item["y"]
        sim.obstacle_vx[0, index] = item["vx"]
        sim.obstacle_vy[0, index] = item["vy"]
        sim.obstacle_spin[0, index] = item["spin"]
        sim.obstacle_item[0, index] = item["index"]
        sim.obstacle_roll[0, index] = item["roll"]
        sim.obstacle_active[0, index] = True

    return sim


def test_observation_matches_typescript():
    fixture = load_fixture()
    expected = torch.tensor(fixture["observation"], dtype=torch.float32)

    assert expected.shape[0] == cfg.OBSERVATION_SIZE, (
        f"fixture tem {expected.shape[0]} valores, config espera {cfg.OBSERVATION_SIZE}"
    )

    actual = build_sim(fixture).observation()[0]

    assert actual.shape == expected.shape, f"shape {tuple(actual.shape)} != {tuple(expected.shape)}"
    difference = (actual - expected).abs().max().item()
    assert difference < 1e-5, (
        f"diferenca maxima {difference} > 1e-5 na posicao "
        f"{(actual - expected).abs().argmax().item()}"
    )


if __name__ == "__main__":
    test_observation_matches_typescript()
    print(f"observation contract OK ({cfg.OBSERVATION_SIZE} valores)")