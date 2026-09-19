"""Rede neural da politica e serializacao do modelo."""

import json

import torch

from config import NETWORK_SIZES


def initial_policy(sizes=NETWORK_SIZES, device="cpu", seed=0):
    generator = torch.Generator(device="cpu").manual_seed(seed)
    parameters = []
    for index in range(len(sizes) - 1):
        fan_in = sizes[index]
        fan_out = sizes[index + 1]
        limit = (6.0 / (fan_in + fan_out)) ** 0.5
        weight = (torch.rand(fan_out, fan_in, generator=generator) * 2 - 1) * limit
        bias = torch.zeros(fan_out)
        parameters.append(weight.to(device).requires_grad_(False))
        parameters.append(bias.to(device).requires_grad_(False))
    return parameters


def stack_policies(policies):
    stacked = []
    for index in range(len(policies[0])):
        stacked.append(torch.stack([policy[index] for policy in policies]))
    return stacked


def batched_forward(inputs, stacked, sizes, population, envs):
    batch = inputs.view(population, envs, sizes[0])
    activation = batch

    for layer in range(len(sizes) - 1):
        weight = stacked[layer * 2]
        bias = stacked[layer * 2 + 1]
        activation = torch.einsum("pni,pij->pnj", activation, weight) + bias[:, None, :]
        if layer < len(sizes) - 2:
            activation = torch.tanh(activation)

    return activation.reshape(population * envs, sizes[-1])


def flatten_policy(policy):
    return torch.cat([tensor.reshape(-1) for tensor in policy])


def unflatten_policy(vector, sizes):
    policy = []
    offset = 0
    for index in range(len(sizes) - 1):
        fan_in = sizes[index]
        fan_out = sizes[index + 1]
        count = fan_out * fan_in
        policy.append(vector[offset : offset + count].view(fan_out, fan_in))
        offset += count
        policy.append(vector[offset : offset + fan_out])
        offset += fan_out
    return policy


def export_json(policy, path, sizes=NETWORK_SIZES):
    weights = []
    biases = []
    for index in range(0, len(policy), 2):
        weights.extend(policy[index].reshape(-1).tolist())
        biases.extend(policy[index + 1].reshape(-1).tolist())

    payload = {
        "format": "livrejam.mlp.v1",
        "sizes": list(sizes),
        "weights": weights,
        "biases": biases,
    }

    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, separators=(",", ":"))
    return payload


def load_policy(path, device="cpu"):
    with open(path, encoding="utf-8") as handle:
        payload = json.load(handle)

    sizes = payload["sizes"]
    weights = torch.tensor(payload["weights"], dtype=torch.float32)
    biases = torch.tensor(payload["biases"], dtype=torch.float32)

    policy = []
    weight_offset = 0
    bias_offset = 0
    for index in range(len(sizes) - 1):
        fan_in = sizes[index]
        fan_out = sizes[index + 1]
        count = fan_out * fan_in
        policy.append(weights[weight_offset : weight_offset + count].view(fan_out, fan_in))
        weight_offset += count
        policy.append(biases[bias_offset : bias_offset + fan_out])
        bias_offset += fan_out

    return [tensor.to(device) for tensor in policy], sizes
