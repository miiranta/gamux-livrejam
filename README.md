# Face Smashing (LivreJam)

Uma masmorra em pixel art onde caixas e barris caem do teto. Um personagem LPC
(controlado por uma politica neural treinada) desvia deles.

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
| Esc | pausar / retomar a partida |

O personagem no chao e pilotado pela IA — nao ha controle manual dele.

## Telas

- **Menu inicial** — Jogar, Configuracao, Creditos, Idioma e o botao de tela
  cheia no canto superior direito.
- **Menu de pausa** — aberto pelo botao no canto superior direito do canvas ou
  pelo `Esc`. Traz Continuar, Reiniciar e Abandonar, e nao permite mexer no
  tempo de partida (so no menu inicial).
- **Tela de fim de jogo** — aparece quando o tempo da partida acaba, com
  pontuacao e os botoes de tentar de novo / sair. O titulo e a pontuacao
  entram com um "impacto" (animacao lenta com overshoot), soltando
  particulas, e o cartao de pontuacao rachadura o fundo ao bater.

## Efeitos (pixel art)

Os ornamentos e animacoes compartilhadas ficam em
`src/ui/styles/_ornaments.scss`:

| mixin | efeito |
| --- | --- |
| `octagon` / `studs` | cantos chanfrados + rebites de canto |
| `punch-in` | entrada rapida com overshoot (menus) |
| `impact-in` | entrada lenta e pesada, com overshoot forte (fim de jogo) |
| `fade-in` | aparecimento simples |

Componentes de efeito (todos puramente decorativos, `aria-hidden`):

- `app-particle-burst` — estilhacos que saem do centro no momento do impacto.
- `app-crack-overlay` — rachaduras em SVG que se desenham progressivamente.
- `app-particle-field` — poeira flutuando devagar no fundo do menu.

Todos usam gerador pseudo-aleatorio com semente (`seed`), entao o mesmo efeito
sai igual em todo render — e nos testes.

## Idioma (i18n)

Textos ficam em `public/i18n/en-us.json` e `public/i18n/pt-br.json` e sao
servidos pela `@ngx-translate/core`. **Toda string de UI deve vir de la** — nao
escreva texto direto no template. O idioma escolhido fica salvo no
`localStorage`.

Para adicionar um idioma: crie o JSON, registre o codigo em
`SUPPORTED_LANGS` e adicione a entrada em `LANGUAGE_OPTIONS`
(`src/ui/i18n/i18n.config.ts` e `src/ui/services/language.service.ts`).

## Configuracoes

`GameSettingsService` (`src/ui/services/game-settings.service.ts`) guarda
volume de musica, volume de efeitos e tempo de partida, persistidos no
`localStorage`. Os volumes ainda nao alimentam nenhum audio; o tempo de partida
ja e aplicado ao `FaceSmashing` no inicio de cada partida.

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
    entities/        Dodger (o personagem), Faller (o objeto que cai)
    level/           layout da sala + colisores
    render/          desenho da cena
    systems/         spawner e deteccao de impacto/pontuacao
    face-smashing.ts  orquestrador (pausa, cronometro da partida)
  ui/
    i18n/            configuracao do ngx-translate
    styles/          mixins de ornamentos pixel art (_ornaments.scss)
    services/        estado da UI (fluxo de telas, settings, idioma, fullscreen)
    components/      botoes/paineis/controles + canvas e camera
      menu-view/     layout compartilhado pelo menu inicial e de pausa
      pixel-*/       button, panel, slider, stepper, language-select
      particle-*/    efeitos: burst (impacto) e field (fundo)
      crack-overlay/ rachaduras animadas do fim de jogo
    pages/           main-menu, pause-menu, end-game
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