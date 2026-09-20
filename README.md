# LivreJam

Dungeon Drop: uma masmorra em pixel art onde caixas e barris caem do teto. Um
personagem LPC (controlado por uma política neural treinada) desvia deles.

## Requisitos

- Node.js 22+ e npm.
- Python 3.12+ apenas para treinar a IA (o jogo não precisa de Python).

## Rodando o jogo

```bash
cd livrejam
npm install --legacy-peer-deps
npx ng serve
```

O `--legacy-peer-deps` é necessário por um bug do arborist com uma peer
dependency opcional do `jsdom`.

## Modos de jogo

O modo é escolhido na **tela inicial**: em vez de um "Jogar" genérico, cada
modo tem seu próprio botão, porque é ele que decide quem controla o
personagem. A escolha vale para a partida que começa em seguida.

### 1 Jogador (desabilitado - em desenvolvimento)

O modo original da jam: a política neural pilota o personagem e o humano cuida
dos objetos que caem. O teclado não controla o personagem.

### 2 Jogadores

O jogador 2 pilota o personagem no teclado **ou** num controle (os dois podem
ser usados ao mesmo tempo, inclusive por duas pessoas).

| ação | teclado | controle (layout padrão) |
| --- | --- | --- |
| esquerda / direita | `<-` `->` ou `A` `D` | analógico esquerdo (só horizontal), d-pad |
| pular | `^`, `W` ou `Espaço` | botão de baixo ("A" no Xbox), botão de cima ("Y") |
| correr | `Ctrl` (qualquer) ou `E` | botão da esquerda ("X" no Xbox) |
| avanço (dash) | `Shift` (qualquer) | botão da direita ("B" no Xbox) |
| queda rápida | `S` ou `v` | d-pad para baixo |
| soltar | `Enter` | gatilhos |

O botão que começa a partida é o mesmo que pula ("A" confirma o menu **e**
está ligado a `jump`), e o controle é lido por **estado**, não por evento:
segurar "A" na hora que a partida começa valeria como um toque novo e o
personagem pulava sozinho. `FaceSmashing.clearInput` arma o detector de borda
com o que está pressionado naquele instante, então o botão só conta depois de
ser solto. Vale ao começar, ao reiniciar e ao sair da pausa.

Start não entra nessa tabela de propósito: ele **pausa** a partida (e sai da
pausa), como o `Esc` do teclado. Vale durante o jogo, quando nenhum menu está
na tela para reivindicar o botão.

Soltar uma direção dá um passo; segurar `Ctrl` (ou "X") corre na velocidade
máxima. Os botões do controle são lidos pela **posição** (padrão W3C), então
funcionam igual em controles de Xbox, PlayStation e Nintendo.

O analógico esquerdo só move na horizontal: empurrar para cima **não** pula,
senão um analógico gasto (que não volta ao centro) pularia sozinho.

## Menus no controle

Os menus também funcionam no controle: o d-pad (ou o analógico esquerdo) anda
pelo foco, o botão de baixo ("A") confirma e o botão da direita ("B") volta
(fecha um painel, sai da pausa, sai da tela de fim de jogo).

Num controle de volume (as barras de áudio nas opções), esquerda e direita
mudam o valor em vez de sair dele; cima e baixo continuam andando pelo foco.
A barra focada mostra setas ao lado da porcentagem para dizer isso.

"A" e "B" só valem enquanto um menu está na tela (`topLayer`): durante a
partida eles são pulo e avanço, e não podem ativar um botão do HUD que ficou
com o foco. O foco também volta sozinho para o menu visível quando o controle
que o tinha some (ao abrir um painel, por exemplo), senão o anel desaparece e
o próximo toque no d-pad parece não fazer nada.

Campos de texto (o de tempo de partida) ficam fora do caminho do controle: o
pad não digita, e os botões "-" e "+" ao lado fazem o mesmo trabalho.

A tela de fim de jogo ignora "A" e "B" por ~1,8s depois de abrir. A partida
acaba sozinha, então quem estava pulando ("A") reiniciaria a rodada antes de
ler o placar (`holdActions` em `gamepad-navigation.service.ts`).

O anel de foco usa `:focus` **e** `:focus-visible` de propósito (mixin
`focus-ring` em `src/ui/styles/_ornaments.scss`). O navegador só liga
`:focus-visible` depois de teclado ou mouse, e o controle foca o elemento via
código — com `:focus-visible` sozinho, a navegação no controle parece não
fazer nada porque nada fica destacado.

Esse anel é um `box-shadow: inset`, não um `outline`. Todo quadro do jogo é
cortado com `clip-path`, e o corte acontece **depois** do outline: o anel
antigo era jogado fora junto com os cantos, então nada ficava destacado em
lugar nenhum. Botões com host próprio (`app-pixel-button` e os dois botões de
canto — tela cheia e info) ganham também um anel externo duro, o mixin
`pixel-ring`, desenhado no host porque um `filter` no elemento cortado some
com ele.

## Testes

```bash
cd livrejam
npx ng test --watch=false
```

## Arquitetura

```
livrejam/src/
  engine/            código reutilizável, sem nada específico deste jogo
    assets/          carregamento de imagens
    ai/              rede neural (inferência) + worker
    entities/        Character, clipes de animação, direções
    input/           mapa de teclas -> ações, leitura de eixo
    level/           TileGrid
    loop/            GameLoop com passo fixo
    math/            Point2D/Point3D, helpers
    physics/         Body, AABB, PhysicsWorld
    render/          Camera, CanvasRenderer, sprite sheets
    tracking/        captura de rosto/mãos (MediaPipe) + workers
  game/              regras específicas deste jogo
    ai/              observação (24 floats) + políticas
    assets/          sprites da masmorra e do personagem
    audio/           mixer (Web Audio) + catálogo de sons
    config/          todas as constantes de gameplay
    entities/        Dodger (o personagem), Item (os objetos que caem)
    level/           layout da sala + colisores
    render/          desenho da cena
    systems/         spawner, guinada do item e detecção de impacto/pontuação
  face-smashing.ts   orquestrador
  ui/components/     componentes Angular (canvas, câmera)
tools/
  assets/            download/geração dos assets
  ai/                treino da política neural
```

## A IA

A política é um MLP `77 -> 96 -> 96 -> 8` treinado com Evolution Strategies.
Ela recebe posição/velocidade do personagem, a velocidade máxima da rodada
(que varia a cada partida), os sensores de colisão e os objetos mais
ameaçadores próximos.

Detalhes de treino, avaliação e o formato da observação estão em
[`tools/ai/README.md`](tools/ai/README.md).

O modelo treinado fica em `livrejam/public/models/dodger-policy.json` e é
carregado em um Web Worker, então a inferência não bloqueia a renderização.

### Treinando a política

```bash
.venv/bin/python -u tools/ai/train.py \
  --generations 600 --population 64 --envs 1536 --episode-steps 3660 \
  --sigma 0.05 --learning-rate 0.06 --worst-weight 0.5 --dodge-weight 0.1 \
  --curriculum 1 --eval-every 10 --seed 71 --checkpoint-every 5 \
  2>&1 | tee /tmp/train.log
```

Variação usada em alguns treinos, com quantil do pior caso:

```bash
.venv/bin/python -u tools/ai/train.py \
  --generations 600 --population 64 --envs 1536 --episode-steps 3660 \
  --sigma 0.05 --learning-rate 0.06 --worst-weight 0.5 --worst-quantile 0.1 \
  --dodge-weight 0.1 --curriculum 1 --eval-every 10 --seed 71 \
  --checkpoint-every 5 2>&1 | tee /tmp/train.log
```

## Licenças

Assets de terceiros e suas licenças estão em
`livrejam/public/assets/CREDITS.md` e nos arquivos `License.txt` de cada pack.

### Outros pacotes usados

- Explosion Animations Pack — <https://ansimuz.itch.io/explosion-animations-pack>
- Treasure Hunters — <https://pixelfrog-assets.itch.io/treasure-hunters>

## Créditos dos assets de cenário e armas

Assets usados para montar o cenário (sala) e as armas do jogo. Os tiles atuais da
sala vêm do pacote **Kenney Tiny Dungeon**, que é **CC0** (uso livre, sem
obrigação de crédito) — o crédito abaixo é cortesia.

### Cenário — tiles

| pasta | pacote | autor | licença | fonte |
|---|---|---|---|---|
| `tiles/kenney-tiny-dungeon/` | Tiny Dungeon | Kenney (kenney.nl) | **CC0 1.0** | https://kenney.nl/assets/tiny-dungeon |
| `tiles/kenney-tiny-town/` | Tiny Town | Kenney | CC0 1.0 | https://kenney.nl/assets/tiny-town |
| `tiles/kenney-micro-roguelike/` | Micro Roguelike | Kenney | CC0 1.0 | https://kenney.nl/assets/micro-roguelike |
| `tiles/kenney-roguelike-rpg-pack/` | Roguelike/RPG pack | Kenney, Lynn Evers | CC0 1.0 | https://kenney.nl/assets/roguelike-rpg-pack |
| `tiles/kenney-roguelike-caves-dungeons/` | Roguelike Caves & Dungeons | Kenney | CC0 1.0 | https://kenney.nl/assets/roguelike-caves-dungeons |

> Kenney pede apenas, se possível: *"Credit (Kenney or www.kenney.nl) would be
> nice but is not mandatory."* ("Um crédito seria bom, mas não é obrigatório.")

### Armas

| pasta | pacote | autor | licença |
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

- **`pixel-weapons`**: a página lista CC0, mas o aviso do autor pede que, em uso
  comercial, se credite Gabe Hess e se deixe um link para
  https://gabech.itch.io/super-pixel-weapons-pack. A licença efetiva é CC0, mas
  para uso comercial **credite** para respeitar o pedido.
- As armas **LPC** são as que combinam com o personagem (mesmo estilo pixel art
  64x64, com camadas `_fg` e `_bg` para desenhar atrás/na frente do corpo).
- **CC0** não exige crédito; **CC-BY** exige. Se for publicar o jogo, inclua pelo
  menos as entradas CC-BY.

### Texto pronto para a tela de créditos

```
Cenário (tiles): Kenney (kenney.nl) - CC0
Personagem: Universal LPC Spritesheet Character Generator - CC-BY-SA 3.0
Armas:
  GabeChHe (Pixel Weapons), AntumDeluge (Ranged/Firearm Icons), onlyjb (Crossbow),
  Kay Lousberg (2D Guns), ETTiNGRiNDER (Dark Fantasy Items) - CC0
  bluecarrot16, William.Thompsonj, Pierre Vigier & Tuomo Untinen,
  Luca Pixel, Rod_Praet - CC-BY
```

### Como os assets foram obtidos

O script `tools/fetch_assets.py` baixa tudo de novo de forma reproduzível:

```bash
python3 tools/fetch_assets.py livrejam/public/assets
```

Os metadados coletados (pacote, licença, contagem de arquivos) ficam em
`tools/assets_sources.json`.
