"""Avaliacao do modelo exportado contra linhas de base."""

import argparse
import json

import torch

import config as cfg
from dropper import DropperPolicy
from model import batched_forward, load_policy, stack_policies
from sim import FaceSmashingSim


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="livrejam/public/models/dodger-policy.json")
    parser.add_argument("--envs", type=int, default=4096)
    parser.add_argument("--steps", type=int, default=3660)
    parser.add_argument("--seed", type=int, default=1234)
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    parser.add_argument("--skip-baselines", action="store_true")
    return parser.parse_args()


def run(actions_fn, args, seed_offset=0):
    sim = FaceSmashingSim(args.envs, device=args.device, seed=args.seed + seed_offset)
    dropper = DropperPolicy(seed=args.seed + 500 + seed_offset)
    observation = sim.reset()

    for _ in range(args.steps):
        with torch.no_grad():
            observation = sim.step(actions_fn(observation), dropper)

    metrics = sim.metrics()
    damage = metrics["damage_mean"]
    worst = metrics["damage_worst"]

    return {
        "mean_damage": damage.mean().item(),
        "damage_p10": damage.quantile(0.1).item(),
        "damage_p90": damage.quantile(0.9).item(),
        "worst_episode_damage": worst.mean().item(),
        "worst_episode_max": worst.max().item(),
        "final_tier_mean": metrics["final_level"].mean().item(),
        "rounds": metrics["episodes"].mean().item(),
        "hits": metrics["hits"].mean().item(),
        "dodges": metrics["dodges"].mean().item(),
        "score": metrics["score"].mean().item(),
    }


def main():
    args = parse_args()
    device = torch.device(args.device)
    torch.manual_seed(args.seed)

    policy, sizes = load_policy(args.model, device=args.device)
    stacked = stack_policies([policy])

    trained = run(
        lambda observation: torch.argmax(
            batched_forward(observation, stacked, sizes, 1, args.envs), dim=1
        ),
        args,
    )

    report = {
        "model": args.model,
        "envs": args.envs,
        "steps": args.steps,
        "horizon_seconds": args.steps * cfg.DT,
        "trained": trained,
    }

    if not args.skip_baselines:
        generator = torch.Generator(device="cpu").manual_seed(args.seed)
        report["random"] = run(
            lambda observation: torch.randint(
                0, cfg.ACTION_COUNT, (observation.shape[0],), generator=generator
            ).to(device),
            args,
            seed_offset=1,
        )
        report["idle"] = run(
            lambda observation: torch.zeros(
                observation.shape[0], dtype=torch.long, device=device
            ),
            args,
            seed_offset=2,
        )

    print(json.dumps(report, indent=2))

    out = args.model.replace(".json", ".eval.json")
    with open(out, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)
    print(f"saved {out}")


if __name__ == "__main__":
    main()
