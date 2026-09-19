# Creditos dos assets de cenario e armas

Assets usados para montar o cenario (sala) e as armas do jogo. Os tiles atuais da
sala vem do pacote **Kenney Tiny Dungeon**, que e **CC0** (uso livre, sem
obrigacao de credito) — o credito abaixo e cortesia.

## Cenario — tiles

| pasta | pacote | autor | licenca | fonte |
|---|---|---|---|---|
| `tiles/kenney-tiny-dungeon/` | Tiny Dungeon | Kenney (kenney.nl) | **CC0 1.0** | https://kenney.nl/assets/tiny-dungeon |
| `tiles/kenney-tiny-town/` | Tiny Town | Kenney | CC0 1.0 | https://kenney.nl/assets/tiny-town |
| `tiles/kenney-micro-roguelike/` | Micro Roguelike | Kenney | CC0 1.0 | https://kenney.nl/assets/micro-roguelike |
| `tiles/kenney-roguelike-rpg-pack/` | Roguelike/RPG pack | Kenney, Lynn Evers | CC0 1.0 | https://kenney.nl/assets/roguelike-rpg-pack |
| `tiles/kenney-roguelike-caves-dungeons/` | Roguelike Caves & Dungeons | Kenney | CC0 1.0 | https://kenney.nl/assets/roguelike-caves-dungeons |

> Kenney pede apenas, se possivel: *"Credit (Kenney or www.kenney.nl) would be
> nice but is not mandatory."*

## Armas

| pasta | pacote | autor | licenca |
|---|---|---|---|
| `weapons/pixel-weapons/` | Pixel Weapons | GabeChHe | CC0 1.0 (ver nota) |
| `weapons/cc0-ranged-icons/` | CC0 Ranged Icons | AntumDeluge | **CC0 1.0** |
| `weapons/cc0-firearm-icons/` | CC0 Firearm Icons | AntumDeluge | **CC0 1.0** |
| `weapons/crossbow-arbalest/` | Crossbow / Arbalest | onlyjb | **CC0 1.0** |
| `weapons/2d-guns/` | 2D Guns | Kay Lousberg | **CC0 1.0** |
| `weapons/dark-fantasy-items/` | Dark Fantasy item sprites | ETTiNGRiNDER | **CC0 1.0** |
| `weapons/lpc-more-weapons/` | [LPC] More Weapons | bluecarrot16 | CC-BY 4.0 |
| `weapons/lpc-short-sword/` | [LPC] Short Sword | William.Thompsonj | CC-BY 3.0 / 4.0 |
| `weapons/lpc-smash-weapons/` | [LPC] Smash Weapons | Pierre Vigier, Tuomo Untinen | CC-BY 4.0 |
| `weapons/weapons-kit-pixel-art/` | Weapons Kit Pixel Art | Luca Pixel | CC-BY 4.0 |
| `weapons/axes-pixel-art/` | Axes - pixel art | Rod_Praet | CC-BY 4.0 |

Notas:

- **`pixel-weapons`**: a pagina lista CC0, mas o aviso do autor diz *"If used
  commercially, credit Gabe Hess and leave a link to
  https://gabech.itch.io/super-pixel-weapons-pack"*. A licenca efetiva e CC0, mas
  para uso comercial **credite** para respeitar o pedido.
- As armas **LPC** sao as que combinam com o personagem (mesmo estilo pixel art
  64x64, com camadas `_fg` e `_bg` para desenhar atras/na frente do corpo).
- **CC0** nao exige credito; **CC-BY** exige. Se for publicar o jogo, inclua pelo
  menos as entradas CC-BY.

## Texto pronto para a tela de creditos

```
Cenario (tiles): Kenney (kenney.nl) - CC0
Personagem: Universal LPC Spritesheet Character Generator - CC-BY-SA 3.0
Armas:
  GabeChHe (Pixel Weapons), AntumDeluge (Ranged/Firearm Icons), onlyjb (Crossbow),
  Kay Lousberg (2D Guns), ETTiNGRiNDER (Dark Fantasy Items) - CC0
  bluecarrot16, William.Thompsonj, Pierre Vigier & Tuomo Untinen,
  Luca Pixel, Rod_Praet - CC-BY
```

## Como os assets foram obtidos

O script `tools/fetch_assets.py` baixa tudo de novo de forma reproduzivel:

```bash
python3 tools/fetch_assets.py livrejam/public/assets
```

Os metadados coletados (pacote, licenca, contagem de arquivos) ficam em
`tools/assets_sources.json`.