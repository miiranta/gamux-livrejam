import torch

import config as cfg
from dropper import DropperPolicy
from sim import FaceSmashingSim

POLICIES = {
    "always none": cfg.ACTION_NONE,
    "always right": cfg.ACTION_RIGHT,
    "always left": cfg.ACTION_LEFT,
    "always jumpRight": cfg.ACTION_JUMP_RIGHT,
}


def evaluate(action, envs, steps, seed):
    sim = FaceSmashingSim(envs, device="cpu", seed=seed)
    sim.reset()
    dropper = DropperPolicy(seed=seed + 500)
    actions = torch.full((envs,), action, dtype=torch.long)

    for _ in range(steps):
        sim.step(actions, dropper)

    metrics = sim.metrics()
    damage = metrics["damage_mean"]
    return {
        "damage": damage.mean().item(),
        "worst": damage.max().item(),
        "hits": metrics["hits"].mean().item(),
        "dodges": metrics["dodges"].mean().item(),
    }


def main():
    envs = 2048
    steps = 3660

    print(f"envs={envs} steps={steps} ({steps * cfg.DT:.0f}s per env, round={cfg.ROUND_SECONDS:.0f}s)")
    print()
    print(f"{'policy':18s} {'damage':>9s} {'worst':>9s} {'hits':>8s} {'dodges':>8s}")

    for name, action in POLICIES.items():
        result = evaluate(action, envs, steps, seed=4242)
        print(
            f"{name:18s} {result['damage']:9.1f} {result['worst']:9.1f} "
            f"{result['hits']:8.1f} {result['dodges']:8.1f}"
        )


if __name__ == "__main__":
    main()
