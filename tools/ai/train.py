"""Treino da politica do desviador por Evolution Strategies (OpenAI-ES).

Por que ES e nao gradiente: a recompensa nao e diferenciavel (colisoes, saltos,
respawn) e ES paraleliza trivialmente no GPU.

Orcamento: cada passo da simulacao custa ~2 ms independente do numero de
ambientes, entao o custo esta no lancamento dos kernels. Por isso a simulacao
roda com lotes enormes: 64 politicas x 512 ambientes = 32768 ambientes num
unico tensor, o que da ~12 milhoes de passos-ambiente por segundo.

Fitness (por candidato):
    1 - dano_medio/teto - worst_weight * cauda/teto + dodge_weight * esquivas
A cauda e a media dos `worst_quantile` piores ambientes do candidato (CVaR), nao o
pior ambiente isolado: e ela que empurra a politica para "funciona em qualquer
situacao" sem deixar um unico ambiente azarado dominar o sinal.
"""

import argparse
import json
import os
import time

import torch

import config as cfg
from model import batched_forward, export_json, initial_policy, stack_policies, unflatten_policy
from plot import render_graph
from sim import FaceSmashingSim


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--generations", type=int, default=300)
    parser.add_argument("--population", type=int, default=64)
    parser.add_argument("--envs", type=int, default=512)
    parser.add_argument("--episode-steps", type=int, default=0)
    parser.add_argument("--round-seconds", type=float, default=cfg.ROUND_SECONDS)
    parser.add_argument("--sigma", type=float, default=0.05)
    parser.add_argument("--learning-rate", type=float, default=0.06)
    parser.add_argument("--worst-weight", type=float, default=0.5)
    parser.add_argument("--worst-quantile", type=float, default=0.1)
    parser.add_argument("--mirrored", type=int, default=1, choices=(0, 1))
    parser.add_argument("--dodge-weight", type=float, default=0.1)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--out", default="livrejam/public/models/dodger-policy.json")
    parser.add_argument("--best-out", default="livrejam/public/models/dodger-policy.best.json")
    parser.add_argument("--graph", default="livrejam/public/models/dodger-policy.graph.png")
    parser.add_argument("--checkpoint-every", type=int, default=10)
    parser.add_argument("--curriculum", type=int, default=1, choices=(0, 1))
    parser.add_argument("--curriculum-target", type=float, default=0.18)
    parser.add_argument("--curriculum-step", type=float, default=40.0)
    parser.add_argument("--eval-every", type=int, default=10)
    parser.add_argument("--eval-envs", type=int, default=2048)
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    return parser.parse_args()


def round_steps(seconds):
    return int(seconds / cfg.DT) + 60


def rank_weights(fitness):
    population = fitness.shape[0]
    order = torch.argsort(fitness)
    ranks = torch.empty_like(order, dtype=torch.float32)
    ranks[order] = torch.arange(population, dtype=torch.float32, device=fitness.device)
    return ranks / (population - 1) - 0.5


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


def evaluate(theta, perturbations, args, generation, drop_cap=None):
    sizes = cfg.NETWORK_SIZES
    population = perturbations.shape[0]
    total = population * args.envs
    candidates = theta[None, :] + args.sigma * perturbations

    stacked = stack_policies(expand_candidates(candidates, sizes))
    sim = FaceSmashingSim(
        total,
        device=args.device,
        seed=args.seed + 1000 + generation * 7919,
        round_seconds=args.round_seconds,
    )
    if drop_cap is not None:
        sim.set_drop_cap(drop_cap)
    observation = sim.reset()

    for _ in range(args.episode_steps):
        with torch.no_grad():
            scores = batched_forward(observation, stacked, sizes, population, args.envs)
            observation = sim.step(torch.argmax(scores, dim=1))

    metrics = sim.metrics()
    damage = metrics["damage_mean"].view(population, args.envs)
    dodges = metrics["dodges"].view(population, args.envs)
    hits = metrics["hits"].view(population, args.envs)

    ceiling = cfg.DAMAGE_CEILING

    tail = max(1, int(round(args.worst_quantile * args.envs)))
    by_env = damage.mean(dim=1)
    worst_env = damage.topk(tail, dim=1).values.mean(dim=1)

    fitness = (
        1.0
        - by_env / ceiling
        - args.worst_weight * worst_env / ceiling
        + args.dodge_weight * (dodges.mean(dim=1) / (args.round_seconds * 2))
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


def held_out(theta, args, seed):
    sizes = cfg.NETWORK_SIZES
    sim = FaceSmashingSim(args.eval_envs, device=args.device, seed=seed)
    if args.curriculum:
        sim.set_drop_cap(cfg.DROP_MAX_SPEED)
    stacked = stack_policies([unflatten_policy(theta, sizes)])
    observation = sim.reset()

    for _ in range(round_steps(cfg.ROUND_SECONDS)):
        with torch.no_grad():
            scores = batched_forward(observation, stacked, sizes, 1, args.eval_envs)
            observation = sim.step(torch.argmax(scores, dim=1))

    damage = sim.metrics()["damage_mean"]
    return {
        "damage": damage.mean().item(),
        "p90": damage.quantile(0.9).item(),
        "best_env": damage.min().item(),
    }


def save_model(theta, sizes, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return export_json(to_layers(theta, sizes), path, sizes)


def write_report(path, extra, payload):
    record = dict(extra)
    record["weights"] = len(payload["weights"])
    record["biases"] = len(payload["biases"])

    with open(os.path.splitext(path)[0] + ".train.json", "w", encoding="utf-8") as handle:
        json.dump(record, handle, indent=2)


def report_payload(args, best_fitness, best_generation, parameters, history, checkpoint):
    return {
        "checkpoint": checkpoint,
        "generation": history[-1]["generation"] if history else 0,
        "best_fitness": best_fitness,
        "best_generation": best_generation,
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
    }


def main():
    args = parse_args()
    torch.manual_seed(args.seed)
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True

    if args.episode_steps <= 0:
        args.episode_steps = round_steps(args.round_seconds)
    elif args.episode_steps < round_steps(args.round_seconds) - 59:
        raise SystemExit(
            f"--episode-steps {args.episode_steps} nao cobre uma rodada de "
            f"{args.round_seconds:.0f}s ({round_steps(args.round_seconds)} passos): "
            "nenhuma rodada termina e o dano medio sai zerado"
        )

    if args.mirrored and args.population % 2 != 0:
        raise SystemExit("--population precisa ser par quando --mirrored 1")

    device = torch.device(args.device)
    sizes = cfg.NETWORK_SIZES
    theta = torch.cat(
        [tensor.reshape(-1) for tensor in initial_policy(sizes, device=args.device, seed=args.seed)]
    ).to(torch.float32)
    parameters = theta.numel()

    best_theta = theta.clone()
    best_fitness = float("-inf")
    best_generation = 0
    history = []

    print(
        f"device={device} parameters={parameters} population={args.population} "
        f"envs={args.envs} total={args.population * args.envs} steps={args.episode_steps}",
        flush=True,
    )
    if args.curriculum:
        drop_cap = cfg.DROP_BASE_SPEED
        print(
            f"curriculo ligado: rampa comeca com teto {drop_cap:.0f} px/s e sobe "
            f"{args.curriculum_step:.0f} quando o dano do campeao cair abaixo de "
            f"{args.curriculum_target * 100:.0f}% do teto",
            flush=True,
        )
    else:
        drop_cap = cfg.DROP_MAX_SPEED

    started = time.time()

    for generation in range(1, args.generations + 1):
        if args.mirrored:
            half = args.population // 2
            noise = torch.randn((half, parameters), device=device, dtype=torch.float32)
            perturbations = torch.cat([noise, -noise], dim=0)
        else:
            perturbations = torch.randn(
                (args.population, parameters), device=device, dtype=torch.float32
            )
        fitness, mean_damage, worst_damage, best_damage, hits, dodges, champion_damage, champion_worst = (
            evaluate(theta, perturbations, args, generation, drop_cap)
        )
        weights = rank_weights(fitness)

        gradient = (perturbations * weights[:, None]).sum(dim=0) / (args.population * args.sigma)
        centre_fitness = fitness.mean().item()
        theta = theta + args.learning_rate * gradient

        top = fitness.max().item()
        if centre_fitness > best_fitness:
            best_fitness = centre_fitness
            best_theta = theta.clone()
            best_generation = generation

        promoted = False
        if (
            args.curriculum
            and drop_cap < cfg.DROP_MAX_SPEED
            and mean_damage < args.curriculum_target * cfg.DAMAGE_CEILING
        ):
            drop_cap = min(drop_cap + args.curriculum_step, cfg.DROP_MAX_SPEED)
            promoted = True

        probe = None
        if args.eval_every > 0 and generation % args.eval_every == 0:
            probe = held_out(best_theta, args, args.seed + 90000 + generation)

        entry = {
            "generation": generation,
            "mean_fitness": centre_fitness,
            "top_fitness": top,
            "mean_damage": mean_damage,
            "worst_damage": worst_damage,
            "best_damage": best_damage,
            "hits": hits,
            "dodges": dodges,
            "champion_damage": champion_damage,
            "champion_worst_damage": champion_worst,
            "drop_cap": drop_cap,
            "held_out_damage": probe["damage"] if probe else None,
            "held_out_p90": probe["p90"] if probe else None,
            "elapsed": time.time() - started,
        }
        history.append(entry)
        render_graph(history, args.graph, {
            "generations": args.generations,
            "drop_cap": drop_cap,
            "max_drop": cfg.DROP_MAX_SPEED,
        })

        live = save_model(theta, sizes, args.out)
        save_model(best_theta, sizes, args.best_out)
        write_report(args.out, report_payload(
            args, best_fitness, best_generation, parameters, history, True
        ), live)

        if generation % 5 == 0 or generation == 1:
            held = f" held {probe['damage']:7.1f}" if probe else ""
            print(
                f"gen {generation:4d} | fit {entry['mean_fitness']:7.4f} top {top:7.4f} "
                f"| dmg {mean_damage:7.1f} best {champion_damage:7.1f} worst {worst_damage:7.1f}"
                f"{held} | cap {drop_cap:5.0f} | hits {hits:5.1f} dodges {dodges:5.1f} "
                f"| {entry['elapsed']:7.1f}s",
                flush=True,
            )

        if promoted:
            print(f"  curriculo: teto agora {drop_cap:.0f} px/s", flush=True)

        if args.checkpoint_every > 0 and generation % args.checkpoint_every == 0:
            print(
                f"  checkpoint saved at generation {generation} "
                f"(melhor: geracao {best_generation})",
                flush=True,
            )

    final = save_model(theta, sizes, args.out)
    save_model(best_theta, sizes, args.best_out)
    write_report(args.out, report_payload(
        args, best_fitness, best_generation, parameters, history, False
    ), final)

    print(f"saved {args.out} (ultima geracao) e {args.best_out} (melhor fitness)")


if __name__ == "__main__":
    main()