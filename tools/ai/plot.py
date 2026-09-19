"""Grafico do treino, atualizado a cada geracao.

O treino salva `history` no `.train.json`, mas ninguem olha esse arquivo durante
a rodada. Este modulo desenha um PNG a partir do historico e reescreve o arquivo
a cada geracao, entao da para acompanhar a evolucao com a imagem aberta.

O numero que importa e o dano do **campeao** (o candidato de melhor fitness),
porque e o campeao que vira checkpoint. O `best_damage` do historico antigo era
outra coisa: `mean_damage.max()`, o PIOR candidato da populacao. Por isso o
grafico plota `champion_damage` quando existe e ignora `best_damage`, que so
continua no arquivo para nao quebrar historicos ja gravados.

Sem matplotlib de proposito: o Pillow ja e dependencia dos scripts de asset, e um
grafico de linhas com eixo e legenda nao precisa de mais que isso.
"""

import json
import os

from PIL import Image, ImageDraw

WIDTH = 1100
HEIGHT = 640
PAD_LEFT = 84
PAD_RIGHT = 26
PAD_TOP = 104
PAD_BOTTOM = 62

BACKGROUND = (14, 16, 22)
PANEL = (20, 24, 32)
GRID = (38, 44, 56)
AXIS = (86, 96, 112)
TEXT = (206, 214, 230)
MUTED = (138, 150, 168)

SERIES = (
    ("champion_damage", "melhor candidato (media)", (125, 200, 255), 3),
    ("champion_worst_damage", "melhor candidato (pior rodada)", (255, 138, 138), 2),
    ("mean_damage", "media da populacao", (255, 210, 90), 2),
)

FONT = None


def _font(size):
    from PIL import ImageFont

    global FONT
    if FONT is None:
        for path in (
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        ):
            if os.path.exists(path):
                FONT = path
                break

    if FONT is None:
        return ImageFont.load_default()

    return ImageFont.truetype(FONT, size)


def _nice_step(span, target_lines=6):
    if span <= 0:
        return 1.0

    raw = span / target_lines
    magnitude = 10 ** int(_floor_log10(raw))
    for multiplier in (1, 2, 2.5, 5, 10):
        if raw <= magnitude * multiplier:
            return magnitude * multiplier
    return magnitude * 10


def _floor_log10(value):
    import math

    return math.floor(math.log10(value)) if value > 0 else 0


def _series_points(history, key, x_of, y0, y1, y_max):
    points = []
    for entry in history:
        value = entry.get(key)
        if value is None:
            continue
        points.append((x_of(entry["generation"]), y0 + (y1 - y0) * (1 - min(value / y_max, 1))))
    return points


def render_graph(history, path, meta=None):
    """Desenha o historico em um PNG. Nunca levanta excecao para o treino parar."""
    try:
        _render(history, path, meta)
    except Exception as error:  # pragma: no cover - o treino nao pode morrer por um grafico
        print(f"  (grafo falhou: {error})", flush=True)


def _render(history, path, meta):
    if not history:
        return

    generations = [entry["generation"] for entry in history]
    x_min, x_max = min(generations), max(generations)
    if x_max == x_min:
        x_max = x_min + 1

    values = [
        entry.get(key)
        for entry in history
        for key, _, _, _ in SERIES
        if entry.get(key) is not None
    ]
    y_max = max(values) if values else 1.0
    step = _nice_step(y_max)
    y_max = step * (int(y_max / step) + 1)

    image = Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND)
    draw = ImageDraw.Draw(image)

    x0, y0 = PAD_LEFT, PAD_TOP
    x1, y1 = WIDTH - PAD_RIGHT, HEIGHT - PAD_BOTTOM

    def x_of(generation):
        return x0 + (x1 - x0) * (generation - x_min) / (x_max - x_min)

    draw.rounded_rectangle((x0 - 12, y0 - 12, x1 + 12, y1 + 12), radius=8, fill=PANEL)

    grid_y = 0.0
    while grid_y <= y_max + 1e-9:
        y = y0 + (y1 - y0) * (1 - grid_y / y_max)
        draw.line((x0, y, x1, y), fill=GRID, width=1)
        draw.text((x0 - 12, y), f"{grid_y:,.0f}", fill=MUTED, font=_font(15), anchor="rm")
        grid_y += step

    draw.line((x0, y0, x0, y1), fill=AXIS, width=2)
    draw.line((x0, y1, x1, y1), fill=AXIS, width=2)

    x_step = max(1, int((x_max - x_min) / 10) or 1)
    generation = x_min
    while generation <= x_max:
        x = x_of(generation)
        draw.line((x, y1, x, y1 + 6), fill=AXIS, width=1)
        draw.text((x, y1 + 12), str(generation), fill=MUTED, font=_font(15), anchor="mt")
        generation += x_step

    for key, label, color, width in SERIES:
        points = _series_points(history, key, x_of, y0, y1, y_max)
        if len(points) > 1:
            draw.line(points, fill=color, width=width, joint="curve")

        if points:
            px, py = points[-1]
            draw.ellipse((px - 5, py - 5, px + 5, py + 5), fill=color)

    latest = history[-1]
    draw.text((x0, 16), "Face Smashing - treino do desviador", fill=TEXT, font=_font(25))
    draw.text((x0, 50), "dano sofrido por rodada (menor e melhor)", fill=MUTED, font=_font(16))

    legend_x = x0 + 470
    for index, (key, label, color, _) in enumerate(SERIES):
        value = latest.get(key)
        y = 16 + index * 24
        draw.line((legend_x, y + 8, legend_x + 26, y + 8), fill=color, width=3)
        shown = f"{value:,.0f}" if value is not None else "sem dado"
        draw.text((legend_x + 34, y), f"{label}: {shown}", fill=TEXT, font=_font(15))

    draw.text(
        (x0, y1 + 32),
        f"geracao {latest['generation']} de {meta.get('generations', '?') if meta else '?'}",
        fill=MUTED,
        font=_font(15),
    )
    draw.text((x1, y1 + 32), "geracao", fill=MUTED, font=_font(15), anchor="ra")

    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    image.save(path)


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Desenha o grafico de um treino ja salvo.")
    parser.add_argument("--train-json", default="livrejam/public/models/dodger-policy.train.json")
    parser.add_argument("--out", default="livrejam/public/models/dodger-policy.graph.png")
    args = parser.parse_args()

    with open(args.train_json, encoding="utf-8") as handle:
        report = json.load(handle)

    render_graph(report["history"], args.out, report)
    print(f"grafo salvo em {args.out}")


if __name__ == "__main__":
    main()
