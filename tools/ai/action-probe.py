import torch

import config as cfg
from dropper import DropperPolicy
from model import batched_forward, load_policy, stack_policies
from sim import FaceSmashingSim


def main():
    policy, sizes = load_policy("../../livrejam/public/models/dodger-policy.json")
    sim = FaceSmashingSim(512, device="cpu", seed=11)
    sim.reset()
    dropper = DropperPolicy(seed=31)

    stacked = stack_policies([policy])
    counts = torch.zeros(cfg.ACTION_COUNT, dtype=torch.long)
    total = 0
    previous = None
    switches = 0
    comparisons = 0
    idle_when_safe = 0
    safe_steps = 0

    for _ in range(900):
        observation = sim.observation()
        scores = batched_forward(observation, stacked, sizes, 1, 512)
        actions = torch.argmax(scores, dim=1)
        counts += torch.bincount(actions, minlength=cfg.ACTION_COUNT)
        total += actions.numel()

        if previous is not None:
            switches += int((actions != previous).sum().item())
            comparisons += actions.numel()

        threats = observation[:, cfg.GLOBAL_FEATURES :: cfg.ITEM_FEATURES]
        no_threat = threats.sum(dim=1) <= 0
        safe_steps += int(no_threat.sum().item())
        idle_when_safe += int((no_threat & (actions == cfg.ACTION_NONE)).sum().item())

        previous = actions
        sim.step(actions, dropper)

    names = [
        "none",
        "left",
        "right",
        "jump",
        "jumpLeft",
        "jumpRight",
        "dashLeft",
        "dashRight",
    ]

    print(f"steps={total}")
    for index, name in enumerate(names):
        share = counts[index].item() / total * 100
        print(f"  {index} {name:10s} {counts[index].item():8d}  {share:5.2f}%")

    print()
    print(f"action switches: {switches / comparisons * 100:.2f}% of steps")
    print(f"steps with no visible threat: {safe_steps / total * 100:.2f}%")
    print(f"  of those, chose none: {idle_when_safe / max(safe_steps, 1) * 100:.2f}%")


if __name__ == "__main__":
    main()
