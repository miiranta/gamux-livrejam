"""Gera os efeitos de impacto em pixel art desenhada pixel a pixel.

Os packs de efeito da web ou sao 100x100+ por quadro (nao conversam com tiles de
16 px nem com o personagem LPC) ou estao presos atras de login no itch.io. Em vez
de importar arte estranha, os efeitos sao desenhados aqui usando as MESMAS cores
do personagem, amostradas de `assets/character/damage_0/walk.png`.

Duas regras para o resultado parecer parte do jogo:

1. Nada de ruido por pixel. A versao anterior jitterizava cada pixel, o que
   produzia manchas irregulares que mudavam de quadro para quadro e ficavam
   visivelmente aleatorias na tela. Todo sprite aqui e uma forma desenhada de
   proposito, identica em todo quadro em que aparece.
2. Intervalos fixos por cor, sem gradiente. Cada paleta define em que faixa de
   intensidade cada cor comeca, entao duas formas iguais saem iguais.

Tres animacoes, 16x16 por quadro, 6 quadros cada:
  impact.png  estouro de 8 facas com nucleo quente
  slash.png   crescente de corte
  dust.png    baforada de poeira

Paleta do personagem (contagem de pixels no walk.png):
  #fff7e8  branco quente      #e5e6c7  creme
  #c4b59f  areia              #958080  areia escura
  #ff8a00  laranja claro      #e55600  laranja
  #bf4000  laranja escuro     #a42600  vermelho
  #6a1108  sangue             #281820  contorno
"""

import math
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "livrejam", "public", "assets", "effects")

SIZE = 16
FRAMES = 6

HOT = (
    (0.66, (255, 247, 232)),
    (0.50, (229, 230, 199)),
    (0.38, (255, 138, 0)),
    (0.26, (229, 86, 0)),
    (0.14, (191, 64, 0)),
    (0.00, (164, 38, 0)),
)
DUST = (
    (0.55, (229, 230, 199)),
    (0.34, (196, 181, 159)),
    (0.16, (149, 128, 128)),
)

SPARK_ANGLES = (0.0, 0.79, 1.57, 2.36, 3.14, 3.93, 4.71, 5.50)
SPARK_LENGTHS = (6.2, 5.0, 6.6, 5.2, 6.2, 5.0, 6.6, 5.2)


def blank():
    return [[None for _ in range(SIZE)] for _ in range(SIZE)]


def painter(palette):
    """Devolve uma funcao que mapeia intensidade -> cor, por faixas fixas."""
    def paint(surface, x, y, value):
        if value <= 0.0 or not (0 <= x < SIZE and 0 <= y < SIZE):
            return
        for threshold, colour in palette:
            if value >= threshold:
                surface[y][x] = colour
                return
    return paint


def center():
    return (SIZE - 1) / 2


def angle_gap(a, b):
    return abs(((a - b + math.pi) % (2 * math.pi)) - math.pi)


def impact_frame(index):
    """Estouro: nucleo quente curto e oito facas afiadas saindo do centro."""
    surface = blank()
    paint = painter(HOT)
    c = center()
    progress = index / (FRAMES - 1)
    fade = 1.0 - progress
    radius = 1.1 + progress * 1.1

    for y in range(SIZE):
        for x in range(SIZE):
            offset_x = x - c
            offset_y = y - c
            distance = math.hypot(offset_x, offset_y)
            paint(surface, x, y, fade * 1.3 * max(0.0, 1.0 - distance / radius))

    for spark in range(len(SPARK_ANGLES)):
        angle = SPARK_ANGLES[spark]
        length = SPARK_LENGTHS[spark] * fade + 0.4
        if length <= 0.6:
            continue
        direction_x = math.cos(angle)
        direction_y = math.sin(angle)

        for step in range(int(length * 2) + 1):
            distance = step / 2
            if distance > length:
                break
            fade_along = 1.0 - distance / length
            head_x = c + direction_x * distance
            head_y = c + direction_y * distance
            half = 0.0 if fade_along < 0.5 else 0.5

            for offset_x in (-half, 0.0, half):
                for offset_y in (-half, 0.0, half):
                    paint(surface, round(head_x + offset_x), round(head_y + offset_y), fade_along)

    return surface


def slash_frame(index):
    """Crescente de corte varrendo de baixo para cima a esquerda."""
    surface = blank()
    paint = painter(HOT)
    c = center()
    progress = index / (FRAMES - 1)
    sweep = math.radians(-155 + progress * 150)
    window = math.radians(80)
    radius = 5.2
    fade = 1.0 - progress * 0.45

    for y in range(SIZE):
        for x in range(SIZE):
            offset_x = x - c
            offset_y = y - c
            distance = math.hypot(offset_x, offset_y)
            gap = angle_gap(math.atan2(offset_y, offset_x), sweep)
            if gap >= window:
                continue

            arc = math.cos(gap / window * math.pi / 2)
            band = 1.0 - abs(distance - radius) / 1.7
            if band <= 0.0:
                continue
            leading = 1.0 + 0.8 * (1.0 - gap / window)
            paint(surface, x, y, arc * band * leading * fade * 1.35)

    return surface


def dust_frame(index):
    """Baforada de poeira: bola cheia que cresce e some, com dois torroes."""
    surface = blank()
    paint = painter(DUST)
    c = center()
    progress = index / (FRAMES - 1)
    radius = 1.8 + progress * 4.6
    fade = math.sin(min(1.0, 0.42 + progress * 0.58) * math.pi)
    puffs = ((0.0, 0.0, 1.0), (2.4, 1.1, 0.55), (-2.6, 0.9, 0.5))

    for y in range(SIZE):
        for x in range(SIZE):
            strongest = 0.0
            for offset_x, offset_y, scale in puffs:
                cx = c + offset_x * progress
                cy = c + offset_y * progress
                distance = math.hypot(x - cx, (y - cy) * 1.4)
                reach = radius * scale
                if distance < reach:
                    strongest = max(strongest, 1.0 - distance / reach)
            paint(surface, x, y, strongest * fade * 1.3)

    return surface


def render(name, builder):
    sheet = Image.new("RGBA", (SIZE * FRAMES, SIZE), (0, 0, 0, 0))
    for index in range(FRAMES):
        pixels = builder(index)
        frame = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        for y in range(SIZE):
            for x in range(SIZE):
                if pixels[y][x] is not None:
                    frame.putpixel((x, y), (*pixels[y][x], 255))
        sheet.alpha_composite(frame, (index * SIZE, 0))
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{name}.png")
    sheet.save(path)
    return path, sheet


def preview(builders):
    scale = 6
    gap = 10
    width = SIZE * FRAMES * scale
    height = (SIZE * scale + gap) * len(builders) + gap
    canvas = Image.new("RGBA", (width, height), (18, 20, 28, 255))
    offset = gap
    for name, builder in builders:
        for index in range(FRAMES):
            pixels = builder(index)
            frame = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
            for y in range(SIZE):
                for x in range(SIZE):
                    if pixels[y][x] is not None:
                        frame.putpixel((x, y), (*pixels[y][x], 255))
            canvas.alpha_composite(
                frame.resize((SIZE * scale, SIZE * scale), Image.NEAREST),
                (index * SIZE * scale, offset),
            )
        offset += SIZE * scale + gap
    path = "/tmp/effects-preview.png"
    canvas.save(path)
    return path


if __name__ == "__main__":
    builders = (
        ("impact", impact_frame),
        ("slash", slash_frame),
        ("dust", dust_frame),
    )
    for name, builder in builders:
        path, sheet = render(name, builder)
        print(f"{name} -> {path}  {sheet.width}x{sheet.height}")
    print(f"preview -> {preview(builders)}")
