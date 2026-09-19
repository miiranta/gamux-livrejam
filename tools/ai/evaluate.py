"""Avaliacao do modelo exportado, com linha de base aleatoria."""

import argparse
import json

import torch

import config as cfg
from model import batched_forward, load_policy, stack_policies
from sim import DungeonDropSim


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="livrejam/public/models/dodger-policy.json")
    parser.add_argument("--episodes", type=int, default=512)
    parser.add_argument("--steps", type=int, default=1800)
    parser.add_argument("--seed", type=int, default=1234)
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    return parser.parse_args()


def run(sim, actions_fn, steps, population, envs):
    observation = sim.reset()
    survived = torch.zeros(population * envs, device=sim.device)
    score = torch.zeros(population * envs, device=sim.device)
    hits = torch.zeros(population * envs, device=sim.device)

    for _ in range(steps):
        actions = actions_fn(observation)
        observation = sim.step(actions)
        metrics = sim.metrics()
        survived = survived + metrics["alive"].to(torch.float32)
        score = score + metrics["score"]
        hits = hits + metrics["hits"]

    return {
        "survived": survived.mean().item() * cfg.DT,
        "score": score.mean().item(),
        "hits": hits.mean().item(),
        "survived_per_env": survived.view(population, envs).mean(dim=1) * cfg.DT,
    }


def main():
    args = parse_args()
    device = torch.device(args.device)
    torch.manual_seed(args.seed)

    policy, sizes = load_policy(args.model, device=args.device)
    stacked = stack_policies([policy])

    trained = DungeonDropSim(args.episodes, device=args.device, seed=args.seed)
    trained_result = run(
        trained,
        lambda observation: torch.argmax(
            batched_forward(observation, stacked, sizes, 1, args.episodes), dim=1
        ),
        args.steps,
        1,
        args.episodes,
    )

    random_sim = DungeonDropSim(args.episodes, device=args.device, seed=args.seed)
    generator = torch.Generator(device="cpu").manual_seed(args.seed)
    random_result = run(
        random_sim,
        lambda observation: torch.randint(
            0, cfg.ACTION_COUNT, (observation.shape[0],), generator=generator
        ).to(device),
        args.steps,
        1,
        args.episodes,
    )

    frozen = DungeonDropSim(args.episodes, device=args.device, seed=args.seed)
    frozen_result = run(
        frozen,
        lambda observation: torch.zeros(
            observation.shape[0], dtype=torch.long, device=device
        ),
        args.steps,
        1,
        args.episodes,
    )

    survived = trained_result["survived_per_env"]
    report = {
        "model": args.model,
        "episodes": args.episodes,
        "steps": args.steps,
        "horizon_seconds": args.steps * cfg.DT,
        "trained": {
            "survived_seconds": trained_result["survived"],
            "score": trained_result["score"],
            "hits": trained_result["hits"],
            "min": survived.min().item(),
            "max": survived.max().item(),
            "median": survived.median().item(),
            "hit_free_ratio": (survived >= args.steps * cfg.DT - cfg.DT).to(torch.float32).mean().item(),
        },
        "random": {
            "survived_seconds": random_result["survived"],
            "score": random_result["score"],
            "hits": random_result["hits"],
        },
        "idle": {
            "survived_seconds": frozen_result["survived"],
            "score": frozen_result["score"],
            "hits": frozen_result["hits"],
        },
    }

    print(json.dumps(report, indent=2))

    out = args.model.replace(".json", ".eval.json")
    with open(out, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)
    print(f"saved {out}")


if __name__ == "__main__":
    main()
