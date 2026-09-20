# LivreJam

Dungeon Drop: uma masmorra em pixel art onde caixas e barris caem do teto. Um
personagem LPC (controlado por uma politica neural treinada) desvia deles.

## Requisitos

- Node.js 22+ e npm.
- Python 3.12+ apenas para treinar a IA (o jogo nao precisa de Python).

## Rodando o jogo

```bash
cd livrejam
npm install --legacy-peer-deps
npx ng serve
```

O `--legacy-peer-deps` e necessario por um bug do arborist com uma peer
dependency opcional do `jsdom`.

## Modos de jogo

O modo e escolhido na **tela inicial**: em vez de um "Jogar" generico, cada
modo tem seu proprio botao, porque e ele que decide quem controla o
personagem. A escolha vale para a partida que comeca em seguida.

### 1 Jogador

O modo original da jam: a politica neural pilota o personagem e o humano cuida
dos objetos que caem. O teclado nao controla o personagem.

### 2 Jogadores

O jogador 2 pilota o personagem no teclado **ou** num controle (os dois podem
ser usados ao mesmo tempo, inclusive por duas pessoas).

| acao | teclado | controle (layout padrao) |
| --- | --- | --- |
| esquerda / direita | `<-` `->` ou `A` `D` | analógico esquerdo (so horizontal), d-pad |
| pular | `^`, `W` ou `Espaco` | botao de baixo ("A" no Xbox), botao de cima ("Y") |
| correr | `Ctrl` (qualquer) ou `E` | botao da esquerda ("X" no Xbox) |
| avanco (dash) | `Shift` (qualquer) | botao da direita ("B" no Xbox) |
| queda rapida | `S` ou `v` | d-pad para baixo |
| soltar | `Enter` | Start, Back, gatilhos |

Soltar uma direcao da um passo; segurar `Ctrl` (ou "X") corre na velocidade
maxima. Os botoes do controle sao lidos pela **posicao** (padrao W3C), entao
funcionam igual em controles de Xbox, PlayStation e Nintendo.

O analógico esquerdo so move na horizontal: empurrar para cima **nao** pula,
senao um analógico gasto (que nao volta ao centro) pularia sozinho.

## Menus no controle

Os menus tambem funcionam no controle: o d-pad (ou o analógico esquerdo) anda
pelo foco, o botao de baixo ("A") confirma e o botao da direita ("B") volta
(fecha um painel, sai da pausa, sai da tela de fim de jogo).

Num controle de volume (as barras de audio nas opcoes), esquerda e direita
mudam o valor em vez de sair dele; cima e baixo continuam andando pelo foco.

A tela de fim de jogo ignora "A" e "B" por ~1,8s depois de abrir. A partida
acaba sozinha, entao quem estava pulando ("A") reiniciaria a rodada antes de
ler o placar (`holdActions` em `gamepad-navigation.service.ts`).

O anel de foco usa `:focus` **e** `:focus-visible` de proposito (mixin
`focus-ring` em `src/ui/styles/_ornaments.scss`). O navegador so liga
`:focus-visible` depois de teclado ou mouse, e o controle foca o elemento via
codigo — com `:focus-visible` sozinho, a navegacao no controle parece nao
fazer nada porque nada fica destacado.

## Testes

```bash
cd livrejam
npx ng test --watch=false
```

## Arquitetura

```
livrejam/src/
  engine/            codigo reutilizavel, sem nada especifico deste jogo
    assets/          carregamento de imagens
    ai/              rede neural (inferencia) + worker
    entities/        Character, clips de animacao, direcoes
    input/           mapa de teclas -> acoes, leitura de eixo
    level/           TileGrid
    loop/            GameLoop com passo fixo
    math/            Point2D/Point3D, helpers
    physics/         Body, AABB, PhysicsWorld
    render/          Camera, CanvasRenderer, sprite sheets
    tracking/        captura de rosto/maos (MediaPipe) + workers
  game/              regras especificas deste jogo
    ai/              observacao (24 floats) + politicas
    assets/          sprites da masmorra e do personagem
    audio/           mixer (Web Audio) + catalogo de sons
    config/          todas as constantes de gameplay
    entities/        Dodger (o personagem), Item (os objetos que caem)
    level/           layout da sala + colisores
    render/          desenho da cena
    systems/         spawner, guinada do item e deteccao de impacto/pontuacao
  face-smashing.ts   orquestrador
  ui/components/     componentes Angular (canvas, camera)
tools/
  assets/            download/geracao dos assets
  ai/                treino da politica neural
```

## A IA

A politica e um MLP `77 -> 96 -> 96 -> 8` treinado com Evolution Strategies.
Ela recebe posicao/velocidade do personagem, a velocidade maxima da rodada
(que varia a cada partida), os sensores de colisao e os objetos mais
ameacadores proximos.

Detalhes de treino, avaliacao e o formato da observacao estao em
[`tools/ai/README.md`](tools/ai/README.md).

O modelo treinado fica em `livrejam/public/models/dodger-policy.json` e e
carregado em um Web Worker, entao a inferencia nao bloqueia a renderizacao.

## Licencas

Assets de terceiros e suas licencas estao em
`livrejam/public/assets/CREDITS.md` e nos arquivos `License.txt` de cada pack.

# More things we used

https://ansimuz.itch.io/explosion-animations-pack
https://pixelfrog-assets.itch.io/treasure-hunters

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

## Train the AI

cd /home/lucas-miranda/Desktop/LivreJam && .venv/bin/python -u tools/ai/train.py --generations 600 --population 64 --envs 1536 --episode-steps 3660 --sigma 0.05 --learning-rate 0.06 --worst-weight 0.5 --dodge-weight 0.1 --curriculum 1 --eval-every 10 --seed 71 --checkpoint-every 5 2>&1 | tee /tmp/train.log

cd /home/lucas-miranda/Desktop/LivreJam && .venv/bin/python -u tools/ai/train.py --generations 600 --population 64 --envs 1536 --episode-steps 3660 --sigma 0.05 --learning-rate 0.06 --worst-weight 0.5 --worst-quantile 0.1 --dodge-weight 0.1 --curriculum 1 --eval-every 10 --seed 71 --checkpoint-every 5 2>&1 | tee /tmp/train.log
