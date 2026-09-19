"""Treino da politica do desviador por Evolution Strategies (OpenAI-ES).

Por que ES e nao gradiente: a recompensa nao e diferenciavel (colisoes, saltos,
respawn) e ES paraleliza trivialmente no GPU.

Orcamento: cada passo da simulacao custa ~2 ms independente do numero de
ambientes, entao o custo esta no lancamento dos kernels. Por isso a simulacao
roda com lotes enormes: 64 politicas x 512 ambientes = 32768 ambientes num
unico tensor, o que da ~12 milhoes de passos-ambiente por segundo.

Fitness (por candidato):
    1 - dano_medio/teto - worst_weight * pior_ambiente/teto + dodge_weight * esquivas
O termo da pior ambiente e o que empurra a politica para "funciona em qualquer
situacao" em vez de otimizar so a media. O `dano_worst` do simulador conta rodadas,
e cada ambiente roda ~1 rodada por geracao, entao o pior caso que interessa aqui e
o pior **ambiente** do candidato (nao a pior rodada de um ambiente).
"""

import argparse
import json
import os
import time

import torch

import config as cfg
from dropper import DropperPolicy
from model import batched_forward, export_json, initial_policy, stack_policies
from plot import render_graph
from sim import FaceSmashingSim


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--generations", type=int, default=300)
    parser.add_argument("--population", type=int, default=64)
    parser.add_argument("--envs", type=int, default=512)
    parser.add_argument("--episode-steps", type=int, default=3660)
    parser.add_argument("--sigma", type=float, default=0.05)
    parser.add_argument("--learning-rate", type=float, default=0.06)
    parser.add_argument("--worst-weight", type=float, default=0.5)
    parser.add_argument("--dodge-weight", type=float, default=0.1)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--out", default="livrejam/public/models/dodger-policy.json")
    parser.add_argument("--graph", default="livrejam/public/models/dodger-policy.graph.png")
    parser.add_argument("--checkpoint-every", type=int, default=10)
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    return parser.parse_args()


def rank_weights(fitness):
    population = fitness.shape[0]
    order = torch.argsort(fitness)
    ranks = torch.empty_like(order, dtype=torch.float32)
    ranks[order] = torch.arange(population, dtype=torch.float32, device=fitness.device)
    return (ranks / (population - 1) - 0.5) / (population - 1)


def expand_candidates(candidates, sizes):
    policies = []
    for index in range(candidates.shape[0]):
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
    return policies


def to_layers(vector, sizes):
    return expand_candidates(vector[None, :], sizes)[0]


def evaluate(theta, perturbations, args):
    sizes = cfg.NETWORK_SIZES
    population = perturbations.shape[0]
    total = population * args.envs
    candidates = theta[None, :] + args.sigma * perturbations

    stacked = stack_policies(expand_candidates(candidates, sizes))
    sim = FaceSmashingSim(total, device=args.device, seed=args.seed + 1000)
    dropper = DropperPolicy(seed=args.seed + 2000)
    observation = sim.reset()

    for _ in range(args.episode_steps):
        with torch.no_grad():
            scores = batched_forward(observation, stacked, sizes, population, args.envs)
            observation = sim.step(torch.argmax(scores, dim=1), dropper)

    metrics = sim.metrics()
    damage = metrics["damage_mean"].view(population, args.envs)
    dodges = metrics["dodges"].view(population, args.envs)
    hits = metrics["hits"].view(population, args.envs)

    ceiling = cfg.DAMAGE_CEILING

    by_env = damage.mean(dim=1)
    worst_env = damage.max(dim=1).values

    fitness = (
        1.0
        - by_env / ceiling
        - args.worst_weight * worst_env / ceiling
        + args.dodge_weight * (dodges.mean(dim=1) / (cfg.ROUND_SECONDS * 2))
    )

    champion = int(torch.argmax(fitness).item())

    return (
        fitness,
        by_env.mean().item(),
        worst_env.mean().item(),
        damage.max().item(),
        hits.mean().item(),
        dodges.mean().item(),
        by_env[champion].item(),
        worst_env[champion].item(),
    )


def save(theta, sizes, path, extra):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    payload = export_json(to_layers(theta, sizes), path, sizes)

    report = dict(extra)
    report["weights"] = len(payload["weights"])
    report["biases"] = len(payload["biases"])

    with open(os.path.splitext(path)[0] + ".train.json", "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)

    return payload


def main():
    args = parse_args()
    torch.manual_seed(args.seed)

    device = torch.device(args.device)
    sizes = cfg.NETWORK_SIZES
    theta = torch.cat(
        [tensor.reshape(-1) for tensor in initial_policy(sizes, device=args.device, seed=args.seed)]
    ).to(torch.float32)
    parameters = theta.numel()

    best_theta = theta.clone()
    best_fitness = float("-inf")
    history = []

    print(
        f"device={device} parameters={parameters} population={args.population} "
        f"envs={args.envs} total={args.population * args.envs} steps={args.episode_steps}",
        flush=True,
    )
    started = time.time()

    for generation in range(1, args.generations + 1):
        perturbations = torch.randn(
            (args.population, parameters), device=device, dtype=torch.float32
        )
        fitness, mean_damage, worst_damage, best_damage, hits, dodges, champion_damage, champion_worst = (
            evaluate(theta, perturbations, args)
        )
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
            "mean_damage": mean_damage,
            "worst_damage": worst_damage,
            "best_damage": best_damage,
            "hits": hits,
            "dodges": dodges,
            "champion_damage": champion_damage,
            "champion_worst_damage": champion_worst,
            "elapsed": time.time() - started,
        }
        history.append(entry)
        render_graph(history, args.graph)

        if generation % 5 == 0 or generation == 1:
            print(
                f"gen {generation:4d} | fit {entry['mean_fitness']:7.4f} top {top:7.4f} "
                f"| dmg {mean_damage:7.1f} best {champion_damage:7.1f} worst {worst_damage:7.1f} "
                f"| hits {hits:5.1f} dodges {dodges:5.1f} | {entry['elapsed']:7.1f}s",
                flush=True,
            )

        if args.checkpoint_every > 0 and generation % args.checkpoint_every == 0:
            save(
                best_theta,
                sizes,
                args.out,
                {
                    "checkpoint": True,
                    "generation": generation,
                    "best_fitness": best_fitness,
                    "generations": args.generations,
                    "population": args.population,
                    "envs": args.envs,
                    "episode_steps": args.episode_steps,
                    "sigma": args.sigma,
                    "learning_rate": args.learning_rate,
                    "worst_weight": args.worst_weight,
                    "seed": args.seed,
                    "parameters": parameters,
                    "history": history,
                },
            )
            print(f"  checkpoint saved at generation {generation}", flush=True)

    save(
        best_theta,
        sizes,
        args.out,
        {
            "checkpoint": False,
            "generation": args.generations,
            "best_fitness": best_fitness,
            "generations": args.generations,
            "population": args.population,
            "envs": args.envs,
            "episode_steps": args.episode_steps,
            "sigma": args.sigma,
            "learning_rate": args.learning_rate,
            "worst_weight": args.worst_weight,
            "seed": args.seed,
            "parameters": parameters,
            "history": history,
        },
    )

    print(f"saved {args.out}")


if __name__ == "__main__":
    main()