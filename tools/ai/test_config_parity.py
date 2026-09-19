"""Verifica que config.py e face-smashing.config.ts declaram os mesmos valores.

A simulacao e o jogo sao duas implementacoes do mesmo jogo. Se um numero
divergir, a politica treinada ve uma normalizacao diferente da que recebe em
jogo e se comporta mal sem nenhum erro visivel: foi exatamente o que
aconteceu com `lateralSpeed`, que normaliza a velocidade lateral do objeto na
observacao e tambem define a deriva real do objeto.

O teste le os dois arquivos como texto e compara os campos que precisam
bater. `test_observation.py` trava o vetor de observacao; este aqui trava as
constantes que alimentam esse vetor.
"""

import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
TS_CONFIG = os.path.join(ROOT, "livrejam", "src", "game", "config", "face-smashing.config.ts")

import config as cfg

PAIRS = (
    ("tile.size", cfg.TILE_SOURCE, "tile.size"),
    ("dodger.maxSpeedStart", cfg.DODGER_MAX_SPEED_START, "dodger.maxSpeedStart"),
    ("dodger.maxSpeedEnd", cfg.DODGER_MAX_SPEED_END, "dodger.maxSpeedEnd"),
    ("dodger.jumpStart", cfg.DODGER_JUMP_START, "dodger.jumpStart"),
    ("dodger.jumpEnd", cfg.DODGER_JUMP_END, "dodger.jumpEnd"),
    ("dodger.accelerationX", cfg.DODGER_ACCELERATION, "dodger.accelerationX"),
    ("dodger.dragX", cfg.DODGER_DRAG, "dodger.dragX"),
    ("dodger.maxFallSpeed", cfg.DODGER_MAX_FALL, "dodger.maxFallSpeed"),
    ("damage.levels", cfg.DAMAGE_LEVELS, "damage.levels"),
    ("damage.perLevel", cfg.DAMAGE_PER_LEVEL, "damage.perLevel"),
    ("reaction.knockbackBase", cfg.REACTION_KNOCKBACK_BASE, "reaction.knockbackBase"),
    (
        "reaction.knockbackPerDamage",
        cfg.REACTION_KNOCKBACK_PER_DAMAGE,
        "reaction.knockbackPerDamage",
    ),
    ("reaction.knockbackMax", cfg.REACTION_KNOCKBACK_MAX, "reaction.knockbackMax"),
    ("reaction.pop", cfg.REACTION_POP, "reaction.pop"),
    ("reaction.stunSeconds", cfg.REACTION_STUN, "reaction.stunSeconds"),
    (
        "reaction.invulnerableSeconds",
        cfg.REACTION_INVULNERABLE,
        "reaction.invulnerableSeconds",
    ),
    ("item.maxFallSpeed", cfg.ITEM_MAX_FALL, "item.maxFallSpeed"),
    ("item.spawnMargin", cfg.ITEM_SPAWN_MARGIN, "item.spawnMargin"),
    ("item.lateralSpeed", cfg.ITEM_LATERAL, "item.lateralSpeed"),
    ("item.groundFriction", cfg.ITEM_GROUND_FRICTION, "item.groundFriction"),
    ("item.restitution", cfg.ITEM_RESTITUTION, "item.restitution"),
    ("item.spinTransfer", cfg.ITEM_SPIN_TRANSFER, "item.spinTransfer"),
    ("item.settleSeconds", cfg.ITEM_SETTLE, "item.settleSeconds"),
    ("item.referenceSpeed", cfg.ITEM_REFERENCE_SPEED, "item.referenceSpeed"),
    ("item.spinDamageBonus", cfg.ITEM_SPIN_DAMAGE_BONUS, "item.spinDamageBonus"),
    ("item.speedFactorMin", cfg.ITEM_SPEED_FACTOR_MIN, "item.speedFactorMin"),
    ("item.speedFactorMax", cfg.ITEM_SPEED_FACTOR_MAX, "item.speedFactorMax"),
    ("drop.baseSpeed", cfg.DROP_BASE_SPEED, "drop.baseSpeed"),
    ("drop.maxSpeed", cfg.DROP_MAX_SPEED, "drop.maxSpeed"),
    ("drop.speedStep", cfg.DROP_SPEED_STEP, "drop.speedStep"),
    ("drop.baseInterval", cfg.DROP_BASE_INTERVAL, "drop.baseInterval"),
    ("drop.minInterval", cfg.DROP_MIN_INTERVAL, "drop.minInterval"),
    ("drop.rampSeconds", cfg.DROP_RAMP_SECONDS, "drop.rampSeconds"),
    ("drop.aimSpeed", cfg.DROP_AIM_SPEED, "drop.aimSpeed"),
    ("drop.aimJitter", cfg.DROP_AIM_JITTER, "drop.aimJitter"),
    ("drop.maxLead", cfg.DROP_MAX_LEAD, "drop.maxLead"),
    ("drop.scatter", cfg.DROP_SCATTER, "drop.scatter"),
    ("round.seconds", cfg.ROUND_SECONDS, "round.seconds"),
    ("ai.observeRadius", cfg.OBSERVE_RADIUS, "ai.observeRadius"),
    ("ai.observationSize", cfg.OBSERVATION_SIZE, "ai.observationSize"),
    ("ai.actionCount", cfg.ACTION_COUNT, "ai.actionCount"),
    ("dash.speedStart", cfg.DASH_SPEED_START, "dash.speedStart"),
    ("dash.speedEnd", cfg.DASH_SPEED_END, "dash.speedEnd"),
    ("dash.seconds", cfg.DASH_SECONDS, "dash.seconds"),
    ("dash.cooldownSeconds", cfg.DASH_COOLDOWN, "dash.cooldownSeconds"),
    ("impact.dodgeDistance", cfg.DODGE_DISTANCE, "impact.dodgeDistance"),
    ("impact.nearMissDistance", cfg.NEAR_MISS_DISTANCE, "impact.nearMissDistance"),
)


def read_ts_config():
    with open(TS_CONFIG, encoding="utf-8") as handle:
        return handle.read()


def section_of(source, name):
    match = re.search(rf"^\s*{name}: \{{", source, re.M)
    assert match is not None, f"secao {name} nao encontrada em face-smashing.config.ts"
    depth = 1
    cursor = match.end()
    while cursor < len(source) and depth > 0:
        if source[cursor] == "{":
            depth += 1
        elif source[cursor] == "}":
            depth -= 1
        cursor += 1
    return source[match.end() : cursor - 1]


def number_for(source, path):
    name, key = path.split(".", 1)
    block = section_of(source, name)
    match = re.search(rf"\b{key}:\s*(-?[\d.]+)", block)
    assert match is not None, f"campo {path} nao encontrado em face-smashing.config.ts"
    return float(match.group(1))


def test_config_parity():
    source = read_ts_config()
    mismatches = []
    for label, python_value, path in PAIRS:
        ts_value = number_for(source, path)
        if abs(ts_value - float(python_value)) > 1e-9:
            mismatches.append(f"{label}: python={python_value} ts={ts_value}")
    assert not mismatches, "configuracoes divergentes:\n  " + "\n  ".join(mismatches)


def test_lateral_speed_is_learnable():
    """A deriva lateral precisa manter o pouso correlacionado com a mira.

    O objeto cai de `SPAWN_Y` ate o chao em `SPAWN_Y / DROP_BASE_SPEED`
    segundos. Uma deriva de `v` desloca o ponto de pouso em `fall * v` px. Se
    esse deslocamento chega perto da meia-largura da arena, o pouso vira
    uniforme, a mira do oponente deixa de significar qualquer coisa, ficar
    parado passa a ser tao bom quanto desviar e o treino converge para uma
    politica constante que nao faz nada.

    Medido com 2048 ambientes (semente 999, 30 s), usando uma heuristica
    reativa simples como referencia:

    | lateralSpeed | vida parado | vida com heuristica |
    | --- | --- | --- |
    | 20  | 3.86 s | 4.84 s |
    | 60  | 5.41 s | 6.66 s |
    | 80  | 6.08 s | 7.56 s |
    | 160 | 8.07 s | 6.18 s (desviar atrapalha) |
    """
    half_arena = (cfg.PLAY_RIGHT - cfg.PLAY_LEFT) / 2
    fall_seconds = (cfg.FLOOR_TOP - cfg.SPAWN_Y) / cfg.DROP_BASE_SPEED
    drift = fall_seconds * cfg.ITEM_LATERAL
    assert drift < half_arena, (
        f"deriva lateral de {drift:.0f}px por queda >= meia arena {half_arena:.0f}px: "
        "os objetos pousam ao acaso e o treino fica degenerado"
    )


if __name__ == "__main__":
    test_config_parity()
    test_lateral_speed_is_learnable()
    print(f"config parity OK ({len(PAIRS)} campos; deriva lateral dentro da faixa treinavel)")
