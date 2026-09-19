#!/usr/bin/env python3
"""Gera CREDITS.md, credits.csv e README.md a partir de credits_raw.json + manifest.json."""
import csv, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]
creds = json.load(open(os.path.join(HERE, "credits_raw.json")))
man = json.load(open(os.path.join(OUT, "manifest.json")))

LAYER_PT = {
    "body": "corpo", "legs": "calca", "boots": "botas", "shirt": "camisa",
    "head": "cabeca", "hair": "cabelo", "bandages": "bandagens (dano)",
    "mouth": "ferida: boca", "eye_right": "ferida: olho direito",
    "eye_left": "ferida: olho esquerdo", "arm": "ferida: braco",
    "ribs": "ferida: costelas expostas", "brain": "ferida: cranio aberto",
}

rows = sorted(creds.items())

# ---------------- credits.csv ----------------
with open(os.path.join(OUT, "credits.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["filename", "layer", "notes", "authors", "licenses", "urls"])
    for path, e in rows:
        w.writerow([path, ", ".join(LAYER_PT.get(l, l) for l in e["layers"]),
                    e["notes"], ", ".join(e["authors"]),
                    ", ".join(e["licenses"]), ", ".join(e["urls"])])

# ---------------- CREDITS.md ----------------
all_authors = []
for _, e in rows:
    for a in e["authors"]:
        if a not in all_authors:
            all_authors.append(a)
all_authors.sort(key=str.lower)

# licenca resultante: interseccao das licencas de todas as camadas
inter = set(rows[0][1]["licenses"])
for _, e in rows[1:]:
    inter &= set(e["licenses"])

L = []
L.append("# Creditos dos assets do personagem\n")
L.append("Sprites montados a partir do **Universal LPC Spritesheet Character Generator** "
         "(Liberated Pixel Cup), camada por camada.\n")
L.append(f"- Gerador: {man['generator_url']}")
L.append(f"- Repositorio das camadas: {man['source_url']}\n")

L.append("## Licenca da obra derivada\n")
L.append("Cada camada esta disponivel sob mais de uma licenca. As licencas comuns a "
         "**todas** as camadas usadas aqui sao:\n")
for lic in sorted(inter):
    L.append(f"- **{lic}**")
L.append("")
restritivas = [p for p, e in rows if "OGA-BY 3.0" not in e["licenses"]]
L.append("Ou seja, o personagem montado (e qualquer edicao dele) deve ser distribuido sob "
         "**CC-BY-SA 3.0** ou **GPL 3.0**. As camadas que restringem o conjunto (as unicas "
         "sem opcao OGA-BY) sao: " + ", ".join(f"`{p}`" for p in restritivas) +
         " — as feridas vem do [LPC] Zombie. Trocando o cabelo por um com OGA-BY e tirando "
         "as feridas, o resto do personagem poderia ser usado so com credito, sem share-alike.\n")
L.append("O que isso exige na pratica:\n")
L.append("1. Creditar os autores listados abaixo (uma tela de creditos no jogo, o README "
         "ou a pagina do jogo na jam servem).")
L.append("2. Distribuir os arquivos de arte modificados sob a mesma licenca (share-alike).")
L.append("3. O **codigo do jogo nao e afetado** se voce escolher CC-BY-SA 3.0 para a arte. "
         "Escolher GPL 3.0 para a arte e que traria obrigacoes de codigo — nao precisa.\n")

L.append("## Texto pronto para a tela de creditos\n")
L.append("```")
L.append("Sprites do personagem: Universal LPC Spritesheet Character Generator")
L.append("(Liberated Pixel Cup), licenciados sob CC-BY-SA 3.0.")
L.append("Autores: " + ", ".join(all_authors) + ".")
L.append("https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator")
L.append("```\n")

L.append("## Camada por camada\n")
for path, e in rows:
    layers = ", ".join(LAYER_PT.get(l, l) for l in e["layers"])
    L.append(f"### `{path}` — {layers}\n")
    L.append(f"- **Autores:** {', '.join(e['authors'])}")
    L.append(f"- **Licencas disponiveis:** {', '.join(e['licenses'])}")
    if e["notes"]:
        L.append(f"- **Notas:** {e['notes']}")
    L.append("- **Fontes:**")
    for u in e["urls"]:
        L.append(f"  - {u}")
    L.append("")

open(os.path.join(OUT, "CREDITS.md"), "w").write("\n".join(L))

# ---------------- README.md ----------------
def anim_table(setinfo):
    out = ["| animacao | frames por direcao | tamanho do sheet |",
           "|---|---|---|"]
    for a, m in setinfo["animations"].items():
        out.append(f"| `{a}` | {m['columns']} | {m['width']}x{m['height']} |")
    return "\n".join(out)

def tier_table(setinfo):
    out = ["| nivel | o que aparece | animacoes |", "|---|---|---|"]
    for t in setinfo["tiers"]:
        anims = ", ".join(f"`{a}`" for a in t["animations"])
        out.append(f"| `{t['key']}` | {t['label']} | {anims} |")
    return "\n".join(out)

c = man["character"]
TIER_TABLE = tier_table(c)
ANIM_TABLE = anim_table(c)
R = f"""# Personagem com niveis de dano (LPC)

Personagem top-down de 4 direcoes montado camada a camada a partir do
[Universal LPC Spritesheet Character Generator]({man['generator_url']}),
com as camadas de ferimento do projeto LPC empilhadas para formar 8 niveis de dano
progressivos do **mesmo** personagem.

![previa dos niveis](preview.png)

Licenca: **CC-BY-SA 3.0** (veja [CREDITS.md](CREDITS.md) — creditar e obrigatorio).

## Formato

- Corpo `{man['body_type']}`, frame de **{man['frame_size']}x{man['frame_size']}** px.
- Cada PNG e um sheet de uma animacao: colunas = frames, linhas = direcao.
- Ordem das linhas: **{', '.join(man['row_order'])}** (cima, esquerda, baixo, direita).
- `hurt` (morte/queda) tem uma linha so.
- `manifest.json` tem colunas/linhas/tamanho de cada animacao, pronto para ler no codigo.

## Niveis de dano

Cada pasta `damage_N/` tem o personagem com as feridas acumuladas ate aquele nivel.
O nivel 4 em diante inclui **bandagens no torso**, que no LPC existem apenas nas
animacoes classicas — por isso `run` e `jump` so aparecem nos niveis 0-3.

{TIER_TABLE}

## Animacoes

{ANIM_TABLE}

## Detalhes de montagem

- No gerador, as feridas de **braco** e **costelas** tem `zPos` 15, ou seja ficam
  *debaixo* da roupa e nao apareceriam. Aqui foram subidas para 112 para o ferimento
  ficar visivel sobre a camisa.
- A ferida de **cranio aberto** tem `zPos` 115, abaixo do cabelo (120); foi subida
  para 125 para aparecer.
- As bandagens ficam em 110, abaixo das feridas, entao as costelas expostas aparecem
  "sangrando atraves" da bandagem.
- `run` e `jump` dos niveis 0-3 sao identicos aos que o gerador produz para o corpo
  base: as feridas usadas nesses niveis existem para essas animacoes.

## Regerar / customizar

O script `tools/build_lpc_character.py` (na raiz do repo) baixa tudo de novo e
remonta os sheets. Para trocar roupa, cabelo, tipo de corpo ou a escada de niveis,
edite as constantes `DEFS`, `BASE`, `TIERS` e `MAX_TIER_MOBILE` no topo do arquivo e rode:

```bash
python3 tools/build_lpc_character.py livrejam/public/assets/character
```

Depois regenere creditos e README:

```bash
python3 tools/gen_lpc_credits.py livrejam/public/assets/character
```

Para explorar outras pecas (armaduras, capas, chapeus, proteses, tapa-olho), use o
gerador no navegador e procure o caminho da peca em `sheet_definitions/` do repo do LPC.
Peças brancas/cinza (capas, por exemplo) precisam ser recoloridas pelo gerador —
os PNGs crus vem na paleta neutra.
"""
open(os.path.join(OUT, "README.md"), "w").write(R)
print("CREDITS.md, credits.csv e README.md gerados em", OUT)
print("autores unicos:", len(all_authors))
print("licenca comum:", sorted(inter))
