"""Le o catalogo de itens do TypeScript.

`src/game/config/items.ts` e gerado por `tools/assets/build_item_catalog.py` e e
a unica fonte de verdade sobre dano, tamanho e giro dos itens. Em vez de repetir
os numeros aqui (e arriscar divergencia silenciosa), este modulo faz o parse do
modulo TypeScript e monta a tabela equivalente em Python.

Os itens tambem precisam estar em ordem de sorteio estavel, porque a simulacao
sorteia por peso exatamente como `pickItem` faz no jogo.
"""

import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CATALOG = os.path.join(ROOT, "livrejam", "src", "game", "config", "items.ts")

BLOCK = re.compile(r"\{\s*key: '([^']+)',.*?\n    \},", re.S)
FIELD = re.compile(r"(\w+):\s*(-?[\d.]+)")
NESTED = re.compile(r"(\w+):\s*\{\s*([^}]+)\}")


class Item:
    __slots__ = (
        "key",
        "sprite",
        "damage_min",
        "damage_max",
        "weight",
        "half_width",
        "half_height",
        "spin_min",
        "spin_max",
        "restitution",
        "angular_damping",
        "linear_damping",
    )

    def __init__(self, key, sprite, values):
        self.key = key
        self.sprite = sprite
        self.damage_min = values["damage.min"]
        self.damage_max = values["damage.max"]
        self.weight = values["weight"]
        self.half_width = values["half.width"]
        self.half_height = values["half.height"]
        self.spin_min = values["spin.min"]
        self.spin_max = values["spin.max"]
        self.restitution = values["restitution"]
        self.angular_damping = values["angularDamping"]
        self.linear_damping = values["linearDamping"]

    def __repr__(self):
        return (
            f"Item({self.key!r}, dmg {self.damage_min}-{self.damage_max}, "
            f"half {self.half_width}x{self.half_height}, spin {self.spin_min}-{self.spin_max})"
        )


def _entries():
    with open(CATALOG, encoding="utf-8") as handle:
        source = handle.read()

    start = source.index("export const ITEMS")
    end = source.index("export type ItemKey")
    body = source[start:end]

    items = []
    for match in BLOCK.finditer(body):
        key = match.group(1)
        chunk = match.group(0)
        sprite = re.search(r"sprite: '([^']+)'", chunk).group(1)

        values = {}
        for nested in NESTED.finditer(chunk):
            for field, raw in FIELD.findall(nested.group(2)):
                values[f"{nested.group(1)}.{field}"] = float(raw)
        for field, raw in FIELD.findall(re.sub(NESTED, "", chunk)):
            values[field] = float(raw)

        items.append(Item(key, sprite, values))

    if not items:
        raise RuntimeError(f"nenhum item encontrado em {CATALOG}")
    return items


ITEMS = _entries()
KEYS = [item.key for item in ITEMS]
WEIGHT_TOTAL = sum(item.weight for item in ITEMS)
MAX_DAMAGE = max(item.damage_max for item in ITEMS)
MIN_DAMAGE = min(item.damage_min for item in ITEMS)
MAX_EXTENT = max(max(item.half_width, item.half_height) for item in ITEMS)
MAX_SPIN = max(item.spin_max for item in ITEMS)
COUNT = len(ITEMS)
