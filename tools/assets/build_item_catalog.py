"""Extrai os sprites de itens arremessaveis dos sheets de armas e gera o catalogo.

Os sprites ficam em `public/assets/items/` e o catalogo vira um modulo
TypeScript (`src/game/config/items.ts`), que e a unica fonte de verdade sobre
tamanho, dano e giro de cada item. A simulacao de treino le o mesmo modulo
atraves do espelho em `tools/ai/config.py`, entao os dois lados nao podem
divergir sem o teste `test_config_parity.py` acusar.
"""

import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
PUBLIC = os.path.join(ROOT, "livrejam", "public")
STAGE = os.path.join(PUBLIC, "assets", "items")
CATALOG = os.path.join(ROOT, "livrejam", "src", "game", "config", "items.ts")

SHEETS = (
    ("kit", "assets/weapons/weapons-kit-pixel-art/Weapons-Kit/Weapons Kit/Armi no border.png"),
    ("axes", "assets/weapons/axes-pixel-art/all_27.png"),
)

TILE_DIR = "assets/tiles/kenney-tiny-dungeon/Tiles"

SHORT_SIDE, LONG_SIDE = 0.85, 0.85
MIN_LONG, MAX_LONG = 17.0, 39.0

ITEMS = (
    ("dagger", "kit", 12, 4, 12, 12, 9.0, 17.0, 0.42, 3.4, 3.0),
    ("shuriken", "kit", 13, 4, 11, 10, 12.0, 21.0, 0.46, 2.6, 2.2),
    ("dart", "kit", 25, 4, 10, 10, 11.0, 19.0, 0.44, 3.0, 2.4),
    ("knife", "kit", 23, 5, 14, 11, 8.0, 15.0, 0.40, 3.6, 3.2),
    ("arrow", "kit", 26, 4, 11, 9, 10.0, 18.0, 0.38, 3.2, 2.8),
    ("bucket", "tile", 74, 6, 15, 10, 14.0, 24.0, 0.5, 3.0, 2.6),
    ("torchThrow", "tile", 29, 7, 16, 10, 12.0, 22.0, 0.44, 3.4, 3.0),
    ("hatchet", "axes", 0, 8, 20, 9, 6.0, 12.0, 0.34, 4.4, 4.0),
    ("orb", "tile", 102, 9, 21, 9, 8.0, 15.0, 0.55, 2.4, 2.0),
    ("runeStone", "tile", 103, 10, 22, 9, 7.0, 13.0, 0.48, 2.6, 2.2),
    ("crateSmall", "tile", 73, 12, 25, 10, 5.0, 10.0, 0.38, 4.6, 4.2),
    ("barrel", "tile", 82, 14, 28, 9, 4.5, 9.0, 0.34, 4.8, 4.4),
    ("crateBig", "tile", 89, 16, 32, 8, 4.0, 8.0, 0.30, 5.0, 4.6),
    ("shelf", "tile", 94, 18, 34, 7, 3.6, 7.5, 0.28, 5.2, 4.8),
    ("hammer", "kit", 0, 11, 28, 9, 6.0, 11.0, 0.30, 4.8, 4.4),
    ("club", "kit", 2, 9, 22, 8, 5.0, 10.0, 0.28, 4.6, 4.2),
    ("sword", "kit", 14, 10, 26, 8, 5.0, 10.0, 0.26, 4.0, 3.6),
    ("scimitar", "kit", 16, 9, 24, 7, 4.5, 9.0, 0.24, 4.2, 3.8),
    ("spear", "kit", 17, 11, 27, 7, 4.0, 8.0, 0.22, 4.6, 4.2),
    ("longsword", "kit", 24, 14, 34, 6, 3.6, 7.5, 0.22, 4.4, 4.0),
    ("battleaxe", "kit", 8, 16, 40, 6, 3.2, 7.0, 0.20, 5.0, 4.6),
    ("axe", "kit", 5, 18, 44, 5, 3.0, 6.5, 0.18, 5.2, 4.8),
    ("labrys", "axes", 5, 22, 52, 4, 2.6, 5.5, 0.16, 5.4, 5.0),
    ("greatAxe", "kit", 4, 26, 62, 4, 2.2, 5.0, 0.14, 5.8, 5.4),
    ("warHammer", "kit", 10, 30, 70, 3, 1.8, 4.4, 0.12, 6.2, 5.8),
)


def load(relative):
    return Image.open(os.path.join(PUBLIC, relative)).convert("RGBA")


def components(image, min_area=30):
    width, height = image.size
    pixels = image.load()
    seen = bytearray(width * height)
    found = []
    for y in range(height):
        for x in range(width):
            index = y * width + x
            if seen[index]:
                continue
            seen[index] = 1
            if pixels[x, y][3] <= 16:
                continue
            stack = [(x, y)]
            min_x = max_x = x
            min_y = max_y = y
            area = 0
            while stack:
                current_x, current_y = stack.pop()
                area += 1
                min_x = min(min_x, current_x)
                max_x = max(max_x, current_x)
                min_y = min(min_y, current_y)
                max_y = max(max_y, current_y)
                for offset_x in (-1, 0, 1):
                    for offset_y in (-1, 0, 1):
                        next_x = current_x + offset_x
                        next_y = current_y + offset_y
                        if 0 <= next_x < width and 0 <= next_y < height:
                            next_index = next_y * width + next_x
                            if not seen[next_index] and pixels[next_x, next_y][3] > 16:
                                seen[next_index] = 1
                                stack.append((next_x, next_y))
            if area >= min_area:
                found.append((min_x, min_y, max_x + 1, max_y + 1, area))
    return found


def group_rows(boxes, height):
    rows = []
    for box in sorted(boxes, key=lambda entry: entry[1]):
        center = (box[1] + box[3]) / 2
        for row in rows:
            if abs(row["center"] - center) < height / 3:
                row["boxes"].append(box)
                row["center"] = sum(
                    (item[1] + item[3]) / 2 for item in row["boxes"]
                ) / len(row["boxes"])
                break
        else:
            rows.append({"center": center, "boxes": [box]})
    for row in rows:
        row["boxes"].sort(key=lambda entry: entry[0])
    rows.sort(key=lambda row: row["center"])
    return [box for row in rows for box in row["boxes"]]


def crop(image, box, pad=1):
    min_x, min_y, max_x, max_y, _ = box
    return image.crop(
        (
            max(0, min_x - pad),
            max(0, min_y - pad),
            min(image.width, max_x + pad),
            min(image.height, max_y + pad),
        )
    )


def tile_path(index):
    return f"{TILE_DIR}/tile_{index:04d}.png"


def extract():
    """Devolve {sheet: {index: sprite}} tanto para atlas quanto para tiles soltos.

    Os itens antigos (barril, caixote, balde...) sao tiles avulsos do pacote
    Kenney, entao entram pelo mesmo caminho dos recortes de arma e o catalogo
    fica com uma unica tabela.
    """
    os.makedirs(STAGE, exist_ok=True)
    sprites = {}

    for name, relative in SHEETS:
        image = load(relative)
        boxes = group_rows(components(image), image.height)
        sprites[name] = {}
        wanted = {entry[2] for entry in ITEMS if entry[1] == name}
        for index, box in enumerate(boxes):
            if index not in wanted:
                continue
            sprite = crop(image, box)
            sprite.save(os.path.join(STAGE, f"{name}-{index:02d}.png"))
            sprites[name][index] = sprite

    wanted_tiles = {entry[2] for entry in ITEMS if entry[1] == "tile"}
    sprites["tile"] = {}
    for index in sorted(wanted_tiles):
        sprite = load(tile_path(index))
        sprite.save(os.path.join(STAGE, f"tile-{index:04d}.png"))
        sprites["tile"][index] = sprite

    return sprites


def sprite_path(sheet, index):
    if sheet == "tile":
        return f"assets/items/tile-{index:04d}.png"
    return f"assets/items/{sheet}-{index:02d}.png"


def world_size(sprite):
    longest = max(sprite.width, sprite.height)
    scaled = longest * LONG_SIDE
    if scaled < MIN_LONG:
        return MIN_LONG
    if scaled > MAX_LONG:
        return MAX_LONG
    return round(scaled, 2)


def definition(item):
    key, sheet, index, damage_min, damage_max, weight, spin_min, spin_max, restitution, angular, linear = item
    sprite = SPRITES[sheet][index]
    longest = world_size(sprite)
    ratio = sprite.width / sprite.height
    if ratio >= 1:
        width, height = longest, longest / ratio
    else:
        width, height = longest * ratio, longest
    return {
        "key": key,
        "sprite": sprite_path(sheet, index),
        "damage": (float(damage_min), float(damage_max)),
        "weight": float(weight),
        "half": (round(width / 2, 2), round(height / 2, 2)),
        "spin": (float(spin_min), float(spin_max)),
        "restitution": float(restitution),
        "angularDamping": float(angular),
        "linearDamping": float(linear),
    }


def emit(definitions):
    lines = [
        "export interface ItemDamageRange {",
        "    readonly min: number;",
        "    readonly max: number;",
        "}",
        "",
        "export interface ItemExtent {",
        "    readonly width: number;",
        "    readonly height: number;",
        "}",
        "",
        "export interface ItemSpinRange {",
        "    readonly min: number;",
        "    readonly max: number;",
        "}",
        "",
        "export interface ItemDefinition {",
        "    readonly key: string;",
        "    readonly sprite: string;",
        "    readonly damage: ItemDamageRange;",
        "    readonly weight: number;",
        "    readonly half: ItemExtent;",
        "    readonly spin: ItemSpinRange;",
        "    readonly restitution: number;",
        "    readonly angularDamping: number;",
        "    readonly linearDamping: number;",
        "}",
        "",
        "export const ITEMS: readonly ItemDefinition[] = [",
    ]
    for entry in definitions:
        lines.append("    {")
        lines.append(f"        key: '{entry['key']}',")
        lines.append(f"        sprite: '{entry['sprite']}',")
        lines.append(
            f"        damage: {{ min: {entry['damage'][0]}, max: {entry['damage'][1]} }},"
        )
        lines.append(f"        weight: {entry['weight']},")
        lines.append(
            f"        half: {{ width: {entry['half'][0]}, height: {entry['half'][1]} }},"
        )
        lines.append(
            f"        spin: {{ min: {entry['spin'][0]}, max: {entry['spin'][1]} }},"
        )
        lines.append(f"        restitution: {entry['restitution']},")
        lines.append(f"        angularDamping: {entry['angularDamping']},")
        lines.append(f"        linearDamping: {entry['linearDamping']},")
        lines.append("    },")
    lines.append("];")
    lines.append("")
    lines.append("export type ItemKey = (typeof ITEMS)[number]['key'];")
    lines.append("")
    lines.append("export const ITEM_WEIGHT_TOTAL = ITEMS.reduce((total, item) => total + item.weight, 0);")
    lines.append("")
    lines.append("export const ITEM_MAX_DAMAGE = ITEMS.reduce(")
    lines.append("    (highest, item) => Math.max(highest, item.damage.max),")
    lines.append("    0,")
    lines.append(");")
    lines.append("")
    lines.append("export const ITEM_MIN_DAMAGE = ITEMS.reduce(")
    lines.append("    (lowest, item) => Math.min(lowest, item.damage.min),")
    lines.append("    Infinity,")
    lines.append(");")
    lines.append("")
    lines.append("export const ITEM_MAX_EXTENT = ITEMS.reduce(")
    lines.append("    (largest, item) => Math.max(largest, item.half.width, item.half.height),")
    lines.append("    0,")
    lines.append(");")
    lines.append("")
    lines.append("export const ITEM_MAX_SPIN = ITEMS.reduce(")
    lines.append("    (highest, item) => Math.max(highest, item.spin.max),")
    lines.append("    0,")
    lines.append(");")
    lines.append("")
    with open(CATALOG, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))


def contact_sheet(definitions):
    cell = 64
    columns = 9
    rows = (len(definitions) + columns - 1) // columns
    sheet = Image.new("RGBA", (columns * cell, rows * (cell + 12)), (24, 26, 34, 255))
    draw = ImageDraw.Draw(sheet)
    for position, entry in enumerate(definitions):
        column = position % columns
        row = position // columns
        sprite = SPRITES[entry["sheet"]][entry["index"]]
        origin_x = column * cell + (cell - sprite.width) // 2
        origin_y = row * (cell + 12) + (cell - sprite.height) // 2
        sheet.alpha_composite(sprite, (max(origin_x, 0), max(origin_y, 0)))
        draw.text(
            (column * cell + 2, row * (cell + 12) + cell),
            entry["key"][:9],
            fill=(230, 230, 120, 255),
        )
    path = "/tmp/item-catalog.png"
    sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST).save(path)
    return path


if __name__ == "__main__":
    SPRITES = extract()
    DEFINITIONS = []
    for item in ITEMS:
        entry = definition(item)
        entry["sheet"] = item[1]
        entry["index"] = item[2]
        DEFINITIONS.append(entry)
    emit(DEFINITIONS)
    print(f"{len(DEFINITIONS)} itens -> {CATALOG}")
    print(f"preview -> {contact_sheet(DEFINITIONS)}")

