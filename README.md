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

## Controles

| tecla | acao |
| --- | --- |
| A / ← | mover o objeto que cai para a esquerda |
| D / → | mover o objeto que cai para a direita |
| S / ↓ | acelerar a queda |
| Espaco | soltar o objeto |

O personagem no chao e pilotado pela IA — nao ha controle manual dele.

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
    config/          todas as constantes de gameplay
    entities/        Dodger (o personagem), Item (os objetos que caem)
    level/           layout da sala + colisores
    render/          desenho da cena
    systems/         spawner e deteccao de impacto/pontuacao
    dungeon-drop.ts  orquestrador
  ui/components/     componentes Angular (canvas, camera)
tools/
  assets/            download/geracao dos assets
  ai/                treino da politica neural
```

## A IA

A politica e um MLP `24 -> 64 -> 64 -> 6` treinado com Evolution Strategies.
Ela recebe posicao/velocidade do personagem, a velocidade maxima da rodada
(que varia a cada partida) e os tres objetos mais ameacadores proximos.

Detalhes de treino, avaliacao e o formato da observacao estao em
[`tools/ai/README.md`](tools/ai/README.md).

O modelo treinado fica em `livrejam/public/models/dodger-policy.json` e e
carregado em um Web Worker, entao a inferencia nao bloqueia a renderizacao.

## Licencas

Assets de terceiros e suas licencas estao em
`livrejam/public/assets/CREDITS.md` e nos arquivos `License.txt` de cada pack.