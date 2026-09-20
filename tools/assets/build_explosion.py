"""Empacota o pack `explosion-1-g` num spritesheet alinhado ao jogo.

A arte vem em quadros soltos de 48x48 (`Sprites/frame1..7.png`). O jogo desenha
efeitos a partir de um unico canvas horizontal e recorta por `frameSize`, entao
o trabalho aqui e so concatenar na ordem correta e descartar o resto do pack.

O pack original traz sete variantes de explosao (a..g). A variante `g` e a unica
que termina em brasa/fumaca, que e o que queremos no impacto de dano: as outras
terminam em anel de choque e somem rapido demais para ler como "levou porrada".

Nada e recolorido. O ramp laranja quente ja e o ponto de maior saturacao da cena
e e o que faz o impacto se destacar contra a nevoa dessaturada.
"""

import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SOURCE = os.path.join(
    ROOT,
    "livrejam",
    "public",
    "assets",
    "effects",
    "explosion pack 1",
    "Explosions pack",
    "explosion-1-g",
    "Sprites",
)
OUT = os.path.join(ROOT, "livrejam", "public", "assets", "effects", "explosion.png")

FRAME = 48
FRAMES = 7
TRIM_ALPHA = 8


def load_frames():
    frames = []

    for index in range(1, FRAMES + 1):
        path = os.path.join(SOURCE, f"frame{index}.png")
        image = Image.open(path).convert("RGBA")

        if image.size != (FRAME, FRAME):
            raise SystemExit(f"{path} tem {image.size}, esperado {(FRAME, FRAME)}")

        frames.append(image)

    return frames


def union_bbox(frames):
    boxes = [frame.getbbox() for frame in frames]
    present = [box for box in boxes if box is not None]

    if not present:
        raise SystemExit("nenhum quadro tem pixels opacos")

    left = min(box[0] for box in present)
    top = min(box[1] for box in present)
    right = max(box[2] for box in present)
    bottom = max(box[3] for box in present)

    return left, top, right, bottom


def trim(frames):
    """Corta o vazio comum a todos os quadros.

    O pack reserva bastante margem transparente (a explosao nunca enche os 48px).
    Recortar aqui deixa `frameSize` igual ao tamanho real, que evita o efeito
    sumir antes da hora e mantem o desenho nitido na escala do jogo.
    """
    left, top, right, bottom = union_bbox(frames)
    width = right - left
    height = bottom - top
    side = max(width, height)
    pad_x = (side - width) // 2
    pad_y = (side - height) // 2

    cropped = []

    for frame in frames:
        square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        square.paste(frame.crop((left, top, right, bottom)), (pad_x, pad_y))
        cropped.append(square)

    return cropped, side


def pack(frames, size):
    sheet = Image.new("RGBA", (size * len(frames), size), (0, 0, 0, 0))

    for index, frame in enumerate(frames):
        sheet.paste(frame, (index * size, 0))

    return sheet


def main():
    frames = load_frames()
    frames, size = trim(frames)
    sheet = pack(frames, size)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sheet.save(OUT)
    print(f"explosion.png  {sheet.size}  frame {size}x{size}  quadros {len(frames)}")


if __name__ == "__main__":
    main()