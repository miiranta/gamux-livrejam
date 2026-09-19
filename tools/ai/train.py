"""Treino da politica do desviador por Evolution Strategies.

Nao usa gradiente da simulacao: amostra perturbacoes, avalia em lote no GPU e
atualiza a media. Robusto para recompensas nao diferenciaveis (colisoes, saltos).
"""

import argparse
import json
import os
import time

import torch

import config as cfg
from model import batched_forward, export_json, initial_policy, stack_policies
from sim import DungeonDropSim


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--generations", type=int, default=600)
    parser.add_argument("--population", type=int, default=64)
    parser.add_argument("--envs", type=int, default=48)
    parser.add_argument("--episode-steps", type=int, default=900)
    parser.add_argument("--sigma", type=float, default=0.06)
    parser.add_argument("--learning-rate", type=float, default=0.05)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--out", default="livrejam/public/models/dodger-policy.json")
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    return parser.parse_args()


def rank_weights(scores):
    population = scores.shape[0]
    order = torch.argsort(scores)
    ranks = torch.empty_like(order, dtype=torch.float32)
    ranks[order] = torch.arange(population, dtype=torch.float32)
    centered = ranks / (population - 1) - 0.5
    return centered / (population - 1)


def evaluate(theta, perturbations, args):
    sizes = cfg.NETWORK_SIZES
    population = perturbations.shape[0]
    candidates = theta[None, :] + args.sigma * perturbations

    policies = []
    for index in range(population):
        policy = []
        offset = 0
        for layer in range(len(sizes) - 1):
            fan_in = sizes[layer]
            fan_out = sizes[layer + 1]
            count = fan_out * fan_in
            policy.append(candidates[index, offset : offset + count].view(fan_out, fan_in))
            offset += count
            policy.append(candidates[index, offset : offset + fan_out])
            offset += fan_out
        policies.append(policy)

    stacked = stack_policies(policies)
    sim = DungeonDropSim(population * args.envs, device=args.device, seed=args.seed + 1000)
    observation = sim.reset()

    totals = torch.zeros(population * args.envs, device=args.device)
    survived = torch.zeros(population * args.envs, device=args.device)

    for _ in range(args.episode_steps):
        with torch.no_grad():
            logits = batched_forward(observation, stacked, sizes, population, args.envs)
            actions = torch.argmax(logits, dim=1)
            observation = sim.step(actions)
            totals = totals + sim.metrics()["score"]
            survived = survived + sim.metrics()["alive"].to(torch.float32)

    totals = totals.view(population, args.envs)
    survived = survived.view(population, args.envs)

    fitness = survived.mean(dim=1) + 0.01 * totals.mean(dim=1)
    return fitness, survived.mean(), totals.mean()


def main():
    args = parse_args()
    torch.manual_seed(args.seed)

    device = torch.device(args.device)
    policy = initial_policy(cfg.NETWORK_SIZES, device=args.device, seed=args.seed)
    theta = torch.cat([tensor.reshape(-1) for tensor in policy]).to(torch.float32)
    parameters = theta.numel()

    best_theta = theta.clone()
    best_fitness = float("-inf")
    history = []

    print(f"device={device} parameters={parameters} population={args.population} envs={args.envs}")
    started = time.time()

    for generation in range(1, args.generations + 1):
        perturbations = torch.randn(
            (args.population, parameters), device=device, dtype=torch.float32
        )
        fitness, mean_survived, mean_score = evaluate(theta, perturbations, args)
        weights = rank_weights(fitness)

        gradient = (perturbations * weights[:, None]).sum(dim=0) / (args.population * args.sigma)
        theta = theta + args.learning_rate * gradient

        top = fitness.max().item()
        if top > best_fitness:
            best_fitness = top
            best_theta = theta.clone()

        entry = {
            "generation": generation,
            "mean_fitness": fitness.mean().item(),
            "top_fitness": top,
            "mean_survived": mean_survived.item(),
            "mean_score": mean_score.item(),
            "elapsed": time.time() - started,
        }
        history.append(entry)

        if generation % 10 == 0 or generation == 1:
            print(
                f"gen {generation:4d} | fitness {entry['mean_fitness']:8.3f} "
                f"top {top:8.3f} | survived {entry['mean_survived']:6.2f}s "
                f"| score {entry['mean_score']:8.1f} | {entry['elapsed']:6.1f}s"
            )

    final = []
    offset = 0
    sizes = cfg.NETWORK_SIZES
    for layer in range(len(sizes) - 1):
        fan_in = sizes[layer]
        fan_out = sizes[layer + 1]
        count = fan_out * fan_in
        final.append(best_theta[offset : offset + count].view(fan_out, fan_in).cpu())
        offset += count
        final.append(best_theta[offset : offset + fan_out].cpu())
        offset += fan_out

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    payload = export_json(final, args.out, sizes)

    report = {
        "generations": args.generations,
        "population": args.population,
        "envs": args.envs,
        "episode_steps": args.episode_steps,
        "sigma": args.sigma,
        "learning_rate": args.learning_rate,
        "seed": args.seed,
        "best_fitness": best_fitness,
        "parameters": parameters,
        "weights": len(payload["weights"]),
        "biases": len(payload["biases"]),
        "history": history,
    }
    report_path = os.path.splitext(args.out)[0] + ".train.json"
    with open(report_path, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)

    print(f"saved {args.out} and {report_path}")


if __name__ == "__main__":
    main()
