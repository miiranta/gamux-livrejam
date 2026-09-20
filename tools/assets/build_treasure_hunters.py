"""Copia os sprites do pack Treasure Hunters usados pelo cenario.

O pack original tem milhares de arquivos (personagens, armadilhas, ilha inteira).
O jogo usa o porao de um galeao, entao copiamos apenas o tileset de parede/piso e
os aderecos que combinam com a paleta quente dos menus, com nomes estaveis. Assim
o pack pode ser trocado ou removido sem quebrar o carregamento do jogo.

O tileset e um AUTOTILE: um unico sheet onde cada celula e uma variante de borda
(tijolo quente com filete bege). O jogo escolhe a variante pela mascara de
vizinhos solidos, entao o sheet precisa ficar intacto — nao recortamos nada dele.
"""

import os
import shutil

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SOURCE = os.path.join(ROOT, "livrejam", "public", "assets", "tiles", "Treasure Hunters")
OUT = os.path.join(ROOT, "livrejam", "public", "assets", "tiles", "treasure-hunters")

SHIP = os.path.join(SOURCE, "Pirate Ship", "Sprites")
MERCHANT = os.path.join(SOURCE, "Merchant Ship", "Sprites")
TRAPS = os.path.join(SOURCE, "Shooter Traps", "Sprites")
TREASURE = os.path.join(SOURCE, "Pirate Treasure", "Sprites")
CREW = os.path.join(SOURCE, "The Crusty Crew", "Sprites")

TILESETS = (
    (os.path.join(SHIP, "Tilesets", "Terrain and Back Wall (32x32).png"), "ship-terrain.png"),
    (os.path.join(SHIP, "Tilesets", "Platforms (32x32).png"), "ship-platforms.png"),
)

PROPS = (
    ("barrel", os.path.join(MERCHANT, "Barrel", "Idle", "1.png")),
    ("crate", os.path.join(MERCHANT, "Box", "Idle", "1.png")),
    ("chest", os.path.join(MERCHANT, "Chest", "Idle", "1.png")),
    ("anchor", os.path.join(MERCHANT, "Ship", "Anchor", "1.png")),
    ("sail", os.path.join(MERCHANT, "Ship", "Sail", "Wind", "1.png")),
    ("bottles", os.path.join(SHIP, "Decorations", "Barrels and Bottles", "03.png")),
    ("candle", os.path.join(SHIP, "Decorations", "Candle", "Candle", "01.png")),
    ("candleGlow", os.path.join(SHIP, "Decorations", "Candle", "Candle Light", "01.png")),
    ("chainBig", os.path.join(SHIP, "Decorations", "Chains", "Big", "01.png")),
    ("chainSmall", os.path.join(SHIP, "Decorations", "Chains", "Small", "01.png")),
    ("door", os.path.join(SHIP, "Decorations", "Door", "Closing", "05.png")),
    ("porthole", os.path.join(SHIP, "Decorations", "Window", "Window", "01.png")),
    ("cannon", os.path.join(TRAPS, "Cannon", "Cannon Idle", "1.png")),
    ("spike", os.path.join(TRAPS, "Totems", "Wood Spike", "Idle", "1.png")),
    ("coin", os.path.join(TREASURE, "Gold Coin", "01.png")),
    ("skull", os.path.join(TREASURE, "Golden Skull", "01.png")),
    ("dust", os.path.join(CREW, "Dust Particles", "Run 01.png")),
    ("dustFall", os.path.join(CREW, "Dust Particles", "Fall 01.png")),
    ("coinFx", os.path.join(TREASURE, "Coin Effect", "01.png")),
    ("diamondFx", os.path.join(TREASURE, "Diamond Effect", "01.png")),
)


def clean_output():
    if not os.path.isdir(OUT):
        return

    for entry in os.listdir(OUT):
        path = os.path.join(OUT, entry)

        if os.path.isdir(path):
            shutil.rmtree(path)
        else:
            os.remove(path)


def copy_tilesets():
    for source, name in TILESETS:
        if not os.path.exists(source):
            raise SystemExit(f"faltando: {source}")

        shutil.copyfile(source, os.path.join(OUT, name))
        print(f"  {name}  {Image.open(source).size}")


def copy_props():
    target = os.path.join(OUT, "props")
    os.makedirs(target, exist_ok=True)

    for name, source in PROPS:
        if not os.path.exists(source):
            raise SystemExit(f"faltando: {source}")

        shutil.copyfile(source, os.path.join(target, f"{name}.png"))
        print(f"  props/{name}.png  {Image.open(source).size}")


def main():
    os.makedirs(OUT, exist_ok=True)
    print(f"treasure-hunters -> {OUT}")
    clean_output()
    copy_tilesets()
    copy_props()


if __name__ == "__main__":
    main()