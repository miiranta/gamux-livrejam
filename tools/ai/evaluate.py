"""Avaliacao do modelo exportado contra linhas de base."""

import argparse
import json

import torch

import config as cfg
from dropper import DropperPolicy
from model import batched_forward, load_policy, stack_policies
from sim import DungeonDropSim


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="livrejam/public/models/dodger-policy.json")
    parser.add_argument("--episodes", type=int, default=1024)
    parser.add_argument("--steps", type=int, default=3600)
    parser.add_argument("--seed", type=int, default=1234)
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    return parser.parse_args()


def run(actions_fn, args, seed_offset=0):
    sim = DungeonDropSim(args.episodes, device=args.device, seed=args.seed + seed_offset)
    dropper = DropperPolicy(seed=args.seed + 500 + seed_offset)
    observation = sim.reset()

    survived = torch.zeros(args.episodes, device=args.device)
    episodes = torch.zeros(args.episodes, device=args.device)

    for _ in range(args.steps):
        with torch.no_grad():
            observation = sim.step(actions_fn(observation), dropper)
            metrics = sim.metrics()
            alive = metrics["alive"].to(torch.float32)
            survived = survived + alive
            episodes = metrics["episodes"]

    average_life = survived / torch.clamp(episodes, min=1.0) * cfg.DT
    return {
        "average_life_seconds": average_life.mean().item(),
        "median_life_seconds": average_life.median().item(),
        "min_life_seconds": average_life.min().item(),
        "max_life_seconds": average_life.max().item(),
        "deaths": episodes.mean().item(),
        "alive_ratio": (survived / args.steps).mean().item(),
        "score": sim.metrics()["score"].mean().item(),
    }


def main():
    args = parse_args()
    device = torch.device(args.device)
    torch.manual_seed(args.seed)

    policy, sizes = load_policy(args.model, device=args.device)
    stacked = stack_policies([policy])

    trained = run(
        lambda observation: torch.argmax(
            batched_forward(observation, stacked, sizes, 1, args.episodes), dim=1
        ),
        args,
    )

    generator = torch.Generator(device="cpu").manual_seed(args.seed)
    random_actions = run(
        lambda observation: torch.randint(
            0, cfg.ACTION_COUNT, (observation.shape[0],), generator=generator
        ).to(device),
        args,
        seed_offset=1,
    )

    idle = run(
        lambda observation: torch.zeros(observation.shape[0], dtype=torch.long, device=device),
        args,
        seed_offset=2,
    )

    report = {
        "model": args.model,
        "episodes": args.episodes,
        "steps": args.steps,
        "horizon_seconds": args.steps * cfg.DT,
        "trained": trained,
        "random": random_actions,
        "idle": idle,
    }

    print(json.dumps(report, indent=2))

    out = args.model.replace(".json", ".eval.json")
    with open(out, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)
    print(f"saved {out}")


if __name__ == "__main__":
    main()
