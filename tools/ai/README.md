# Dodger AI

Politica neural que controla o personagem no `DungeonDrop` (desviar dos objetos
que caem). Treinada com Evolution Strategies em PyTorch/CUDA.

## Estrutura

| arquivo | papel |
| --- | --- |
| `config.py` | constantes da simulacao, espelho de `src/game/config/dungeon-drop.config.ts` |
| `sim.py` | simulacao vetorizada (uma copia do jogo por ambiente, tudo no GPU) |
| `dropper.py` | politica do "jogador" que solta os objetos durante o treino |
| `model.py` | rede MLP, forward em lote e serializacao JSON |
| `train.py` | treino ES |
| `plot.py` | grafico do treino em PNG, reescrito a cada geracao |
| `curriculum` | teto de dificuldade que sobe conforme o campeao melhora |
| `evaluate.py` | avaliacao do modelo exportado contra baselines |
| `test_observation.py` | garante que a observacao do Python bate com a do TypeScript |
| `fixture-harness.ts` | gera a cena de referencia (`fixtures/observation_fixture.json`) |
| `test_config_parity.py` | garante que `config.py` e o config do TypeScript tem os mesmos numeros |
| `fixtures/` | vetor de referencia compartilhado entre as duas implementacoes |

## Setup

```bash
python3 -m venv .venv
.venv/bin/pip install -r tools/ai/requirements.txt
```

Para CUDA:

```bash
.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cu129
```

## Treino

```bash
.venv/bin/python tools/ai/train.py \
    --generations 300 --population 64 --envs 512 --episode-steps 3660 \
    --sigma 0.05 --learning-rate 0.06 --worst-weight 0.5 --dodge-weight 0.1 \
    --seed 21 --checkpoint-every 5
```

Saidas:

- `livrejam/public/models/dodger-policy.json` — pesos carregados pelo jogo.
- `livrejam/public/models/dodger-policy.train.json` — historico do treino.
- `livrejam/public/models/dodger-policy.graph.png` — grafico, reescrito a cada
  geracao (veja abaixo).

O checkpoint e escrito a cada `--checkpoint-every` geracoes, entao o jogo tem
sempre um modelo valido para carregar durante o treino. O `--seed` fixa a
alatoriedade: troque-o para reproduzir ou variar a rodada.

### Grafico ao vivo

O treino desenha `dodger-policy.graph.png` **a cada geracao**, entao da para
acompanhar com a imagem aberta ao lado do terminal (no VS Code, abra o arquivo:
ele recarrega sozinho quando muda). Sem matplotlib de proposito: o Pillow ja e
dependencia dos scripts de asset.

| serie | o que e |
| --- | --- |
| melhor candidato (media) | dano medio do candidato de melhor fitness; e ele que vira checkpoint |
| avaliacao limpa (semente nova) | o mesmo candidato medido em sementes que o treino nunca viu |
| pior ambiente do candidato | o pior ambiente dele, o caso que o `--worst-weight` pune |
| media da populacao | media de todos os candidatos, para ver a populacao como um todo |

A **avaliacao limpa** e o unico numero honesto de generalizacao do log: o fitness e
o que esta sendo otimizado, entao ele nao consegue dizer se a politica decorou
aquele conjunto de partidas. Se ela subir e a curva limpa ficar parada, esta
havendo overfitting; se as duas descerem juntas, o aprendizado e real.

Para redesenhar a partir de um treino ja salvo:

```bash
.venv/bin/python tools/ai/plot.py --train-json livrejam/public/models/dodger-policy.train.json
```

### Curriculo de dificuldade

O oponente normal comeca lento (140 px/s) e acelera ate 500 px/s em ~27 s, o que
significa que a maior parte da rodada acontece com 5 itens no ar ao mesmo tempo
(cadencia de 0.4 s). Comecar do zero nesse regime da pouquissimo sinal: a politica
leva dano de qualquer jeito e nao consegue associar acao e consequencia.

Com `--curriculum 1` a rampa ganha um **teto** que sobe sozinho:

- comeca em `drop.baseSpeed` (140 px/s);
- quando o dano do campeao cai abaixo de `--curriculum-target` do teto de dano
  (padrao 18%), o teto sobe `--curriculum-step` px/s;
- o teto nunca passa de `drop.maxSpeed`.

Como a cadencia e proporcional a velocidade da queda, limitar a velocidade limita
tambem quantos itens ficam no ar. O teto atual aparece no log (`cap`) e no rodape
do grafico, entao da para ver a dificuldade subindo junto com o aprendizado. Use
`--curriculum 0` para treinar direto no regime final.

### Desempenho

O gargalo da simulacao e o **lancamento de kernels**, nao o trabalho: um passo
custa praticamente o mesmo com 1.536 ou 49.152 ambientes (medido numa RTX 4070).
Por isso `--envs` deve ser grande: a configuracao usada e
64 politicas x 512 ambientes = 32.768 ambientes num unico tensor.

Numeros reais da rodada atual (32.768 ambientes, 3.660 passos por geracao,
`--population 64`):

| metrica | valor |
| --- | --- |
| tempo por geracao | ~16-17 s |
| passos-ambiente por geracao | 119,9 M |
| passos-ambiente por segundo | ~7,5 M |

Cada geracao avalia 64 politicas x 512 rodadas completas de 60 s, ou seja ~1,5 M
rodadas do jogo por hora de treino. Uma rodada de 300 geracoes leva ~85 min.

Atencao: a simulacao ficou mais pesada na v2 (rotacao com OBB, catalogo de itens
e 8 slots de observacao). Numeros antigos de ~5 s por geracao sao da v1 e nao
valem mais.

O que deixava lento (e foi corrigido):

- `bool(tensor.any())` dentro do laco de colisao sincronizava GPU->CPU **por
  bloqueador por eixo**. A resolucao agora e totalmente vetorizada:
  `overlaps.all/any` calcula tudo de uma vez e `min/max` escolhem o plano de
  contato, sem nenhuma ida ao host.
- O gerador de numeros aleatorios do oponente rodava na CPU e era copiado para
  a GPU a cada passo. Agora e um `torch.Generator` no proprio device.
- Constantes de decaimento eram construidas com `torch.exp` dentro do passo.

### Fitness: terminar a rodada com o minimo de dano

O desviador nao morre. A rodada dura `ROUND_SECONDS` (60 s) e o objetivo e
chegar ao fim levando o menor dano possivel, o que tambem vale a pena porque o
dano vai enfraquecendo o personagem nivel a nivel.

A recompensa por candidato e:

```
1 - dano_medio/teto - worst_weight * pior_ambiente/teto + dodge_weight * esquivas/(60*2)
```

- `dano_medio`: quanto o candidato levou por rodada, em media.
- `pior_ambiente`: o pior ambiente do candidato. E o termo que evita uma
  politica que so otimiza a media (ex.: "correr para o canto funciona quase
  sempre"). Aumente `--worst-weight` para forcar mais robustez, ao custo da
  media. Ele e o pior **ambiente**, nao a pior rodada de um ambiente: cada
  ambiente roda ~1 rodada por geracao, entao a pior rodada de um ambiente
  coincide com a media dele e o termo nao faria nada.
- `esquivas`: reforco pequeno e positivo para o candidato nao ficar parado; sem
  ele a politica pode preferir nao se mexer quando o dano esperado for igual.

Cada ambiente roda uma rodada e reinicia sozinho no fim, entao nenhum passo e
desperdicado.

### Resultado

Veja `livrejam/public/models/dodger-policy.eval.json`, gerado por
`evaluate.py`, para os numeros da rodada mais recente. O baseline util de
comparacao e "ficar parado": se a politica treinada nao levar menos dano do que
ficar parado, ela nao aprendeu nada — foi exatamente o sintoma de um bug de
mecanica (deriva lateral grande demais), ver a secao sobre deriva lateral.

## Avaliacao

```bash
.venv/bin/python tools/ai/evaluate.py
```

Compara a politica treinada com acoes aleatorias e com "nao fazer nada", em
4096 ambientes e uma rodada completa. O relatorio traz `mean_damage` (media),
`damage_p10` (o decil melhor: o que a politica faz quando da certo),
`worst_episode_damage` (a pior rodada de cada ambiente), `hits`, `dodges` e
`final_tier_mean` (em que nivel de dano ela costuma terminar).

## Contrato de observacao

O jogo e o treino precisam produzir exatamente o mesmo vetor, senao a politica
treinada nao se comporta como esperado em jogo. O teste abaixo trava isso:

```bash
.venv/bin/python tools/ai/test_observation.py
```

Alem dele, a cena de referencia e gerada pelo jogo real: `fixture-harness.ts`
monta um estado fixo, chama `writeObservation` e grava os 71 valores em
`fixtures/observation_fixture.json`. Ao mudar `observation.ts` ou
`sim.py:observation()`, regere a fixture e rode o teste de novo:

```bash
cd livrejam
./node_modules/.bin/esbuild ../tools/ai/fixture-harness.ts \
    --bundle --platform=node --format=cjs --outfile=/tmp/fixture-harness.cjs
node /tmp/fixture-harness.cjs > ../tools/ai/fixtures/observation_fixture.json
cd .. && .venv/bin/python tools/ai/test_observation.py
```

## Oponente de treino

O `DropperPolicy` imita o jogador humano: mira onde o desviador **vai estar**
quando o objeto chegar ao chao (antecipando a velocidade dele), com erro de
mira. Em 5% dos lancamentos ele joga aleatorio, para a politica aprender a
lidar com objetos que ela nao previu.

Isso e um espelho de `dungeon-drop.ts:aimPoint()` + `ItemSpawner.spawn()`. Se
mudar um lado, mude o outro — senao o jogo cobra situacoes que o treino nunca
mostrou.

A dificuldade sobe sozinha: a cada `DROP_RAMP_SECONDS` a velocidade dos objetos
aumenta `DROP_SPEED_STEP`, o que tambem encurta o intervalo entre eles. Os dois
lados fazem isso automaticamente (`ItemSpawner.update` no jogo,
`step_dropper` na simulacao), entao uma partida longa fica realmente dificil.

## Contrato de sincronia (leia antes de mexer)

Tres coisas precisam bater entre `src/game` e `tools/ai`, senao a politica
treinada se comporta mal em jogo sem nenhum erro visivel:

| o que | no jogo | na simulacao |
| --- | --- | --- |
| vetor de observacao | `ai/observation.ts` | `sim.py:observation()` |
| mira do oponente | `face-smashing.ts:aimPoint()` | `dropper.py` |
| rampa de dificuldade | `systems/item-spawner.ts` | `sim.py:step_dropper()` |
| deriva lateral do objeto | `systems/item-spawner.ts` | `sim.py:spawn_item()` |
| atrito no chao | `engine/physics/world.ts` | `sim.py:step_dodger()` |
| sensores de colisao | `ai/observation.ts:senseCollisions()` | `sim.py:sense_collisions()` |

O primeiro e travado por teste (`test_observation.py`); os outros dependem de
disciplina e de leitura cruzada dos dois arquivos.

### O atrito no chao e mais forte do que parece

`physics.friction` = 0.82 nao e decoracao: o atrito e aplicado **antes** da
aceleracao, todo quadro em que o desviador esta no chao. Com o atrito na frente,
a aceleracao continua empurrando e o limite de projeto e alcancavel:

```
v_terminal = maxSpeed = 314 px/s (nivel 0) e 150 px/s (nivel 7)
```

O que **nao** funciona e aplicar o atrito depois de limitar a velocidade: nesse
caso o teto real vira `maxSpeed * f` (257 px/s), a velocidade maxima do nivel deixa
de ser alcancavel e a observacao passa a mentir sobre a propria capacidade. A
aceleracao de 4136 foi escolhida para vencer o atrito e ainda chegar aos 314.

O avanco (dash) ignora o atrito e o limite de velocidade: e um pico de 0,16 s que
chega a 1000 px/s no nivel 0, com 2,5 s de recarga. Ele exige o chao e e recusado
durante o tremor, entao nao e uma saida livre de qualquer situacao. A recarga longa
importa: com 1 s o avanco cobria 16% do tempo e a politica degenerava para avancar
sem parar, ja que a recarga terminava antes do desvio seguinte valer a pena.

O tremor (0.28 s sem controle) continua valendo e agora e **visivel** na
observacao (indice 8), senao a politica nao tinha como saber quando perdeu o
controle nem quando ele volta.

Os numeros em si sao travados por `test_config_parity.py`, que le os dois
arquivos e compara os 40 campos que precisam bater. Ele tambem recusa uma
`lateralSpeed` grande demais: uma deriva que desloca o pouso por mais de meia
arena descaracteriza a mira do oponente e degenera o treino (ver abaixo).

### A deriva lateral e um teto de dificuldade

`item.lateralSpeed` nao e so um enfeite visual: ela define se desviar vale a
pena, porque e ela que carrega a informacao de onde o oponente mirou.

O objeto cai de `SPAWN_Y` (24 px) ate o chao (352 px) com gravidade
`ITEM_GRAVITY` = 900 px/s², partindo de `DROP_BASE_SPEED` = 140 px/s. A queda
leva `t = (-v0 + sqrt(v0² + 2gh)) / g` ate a velocidade terminal
(`ITEM_MAX_FALL` = 520 px/s) e depois segue reta: **0,82 s** partindo de 140 px/s
e **0,67 s** no teto de 500 px/s. E esse tempo que a mira usa para antecipar o
desviador, nao `dropHeight / speed`, que ignora a gravidade e erra para cima em
ate 0,19 s.

Uma deriva lateral de `v` desloca o ponto de pouso em `t * v` px, o que hoje da
16 px com `v = 20` — folgado diante da meia arena de 256 px.

O teste continua guardando o caso extremo: se uma deriva futura passar de meia
arena, o pouso vira uniforme, a mira do oponente deixa de significar qualquer
coisa e ficar parado passa a ser tao bom quanto desviar. Nesse regime o treino
converge para uma politica constante que nao faz nada — foi o que aconteceu com a
`lateralSpeed` de 160 na v1, quando a queda durava 2,34 s (375 px de deriva).

Na v2 a dificuldade vem de outro lugar: o objeto **pousa e fica no chao**
girando (`settleSeconds`), entao desviar deixou de ser so acertar a trajetoria
de queda — a politica precisa escolher onde ficar entre varios objetos ja
parados na arena.

`DROP_AIM_JITTER` e `DROP_SCATTER` tambem corroem a mira e devem ficar
pequenos (20 e 0.05). Se a politica treinada empacar perto da linha de base
"parado", meça esses valores antes de mexer na rede ou no otimizador.

O tamanho da observacao tambem e validado em tempo de execucao: o worker recusa
um modelo cujo `inputSize` nao bata com `FACE_SMASHING.ai.observationSize` e
mostra o erro no HUD, em vez de inferir lixo silenciosamente.

## Aleatoriedade do treino (generalizacao)

Para a politica ir bem em qualquer partida, cada ambiente sorteia:

- a rota mais longa, `maxSpeed` e `jump` ja vem do nivel de dano (ver abaixo);
- posicao inicial espalhada por 85% da arena;
- deriva lateral do objeto (-20 a 20), como no jogo;
- item sorteado por peso (arma leve, arma pesada ou um dos props antigos);
- dano sorteado dentro da faixa do item, mais velocidade e giro no impacto;
- cadencia e velocidade da chuva de objetos, que aumentam com o tempo.

## Limitacoes conhecidas

- A fisica do Python e uma reimplementacao vetorizada da do jogo. O vetor de
  observacao e travado por teste (`test_observation.py`), mas a dinamica nao tem
  teste equivalente — quando ela diverge, o sintoma aparece so na politica final.
- O jogo nunca passa de 5 itens simultaneos (medido), e o treino reserva 8
  slots de observacao, entao nenhum item fica invisivel em nenhum dos dois lados.
- O empurrao do impacto reduz a velocidade a `maxSpeed` do nivel atual, entao
  um nivel alto amortece o proprio empurrao. E o mesmo comportamento do jogo,
  mas nao tem teste dedicado.

## Dano, niveis e reacao

O dano nao tem teto. O nivel visual e a faixa:

```
nivel = clamp(floor(dano / 500), 0, 7)
```

Cada nivel enfraquece a mobilidade de forma linear, do nivel 0 ao 7:

| nivel | velocidade maxima | pulo (px de subida) | arrancada do avanco |
| --- | --- | --- | --- |
| 0 | 314 | 192 | 1000 |
| 3 | 244 | 124 | 657 |
| 7 | 150 | 57 | 400 |

A subida vem de `v^2 / 2g`, nao do valor cru do pulo. No nivel 0 ela e de 192 px,
que e exatamente metade da altura do mapa (12 linhas x 32 px = 384 px): o pulo
nao chega ao teto e nao da para escapar da chuva de itens por cima.

A **arrancada** (dash) tambem cai com o dano: e um pico de velocidade de 0.16 s
que ignora o limite de velocidade do nivel, e o alcance util e proporcional a ela.
O avanco cobre `1000 * 0.16 = 160 px` no nivel 0 e `400 * 0.16 = 64 px` no nivel 7,
com recarga de 2,5 s. E o movimento mais rapido do jogo e a unica forma de sair de
uma situacao ja perdida, por isso o custo de 2,5 s importa.

Ao encostar num item o desviador recebe:

- **dano** = dano_base * fator_de_velocidade * fator_de_giro, onde
  `dano_base` e sorteado na faixa do item e os fatores usam a velocidade e o
  giro no momento do contato;
- **empurrao**: `130 + dano * 4.2`, limitado pela velocidade maxima do nivel
  atual, sempre para o lado oposto ao impacto;
- **tremor**: 0.28 s sem controle horizontal (e o que torna o empurrao real);
- **invencibilidade**: 0.5 s ignorando novos contatos.

`takeDamage` e quem arma a invencibilidade; `react` cuida so do empurrao. A
invencibilidade tem que decair todo passo — se ela nao decair (bug ja visto), o
desviador fica imune para sempre depois do primeiro toque.

## Observacao (77 valores)

O desviador ve **todos** os itens da tela, sempre. A arena tem 512 px de largura
(`playLeft` 64 a `playRight` 576) e o teto do placar de ameaca chega a ~569 px
(medido em 192 ambientes x 60 s), entao o `observeRadius` de 576 px cobre a arena
inteira com folga e o filtro nunca descarta um item real.

| indice | significado |
| --- | --- |
| 0 | posicao horizontal do desviador, normalizada pelo meio da arena |
| 1 | velocidade horizontal / velocidade maxima do nivel atual |
| 2 | velocidade maxima do nivel atual / velocidade maxima do nivel 0 |
| 3 | esta no chao (1) ou no ar (0) |
| 4 | velocidade vertical / velocidade maxima de queda |
| 5 | dano acumulado / teto dos 8 niveis |
| 6 | nivel atual / 7 |
| 7 | avanco pronto (1 = sem recarga, 0 = acabou de usar) |
| 8 | tremor restante / `reaction.stunSeconds` (1 = sem controle) |
| 9 | distancia livre ate a parede a esquerda / `sensorReach` |
| 10 | distancia livre ate a parede a direita / `sensorReach` |
| 11 | distancia livre ate o teto / `sensorReach` |
| 12 | distancia livre ate o chao / `sensorReach` |
| 13 + 8k | item k presente |
| 14 + 8k | delta X ate o item / raio de observacao |
| 15 + 8k | delta Y ate o item / raio de observacao |
| 16 + 8k | velocidade X do item |
| 17 + 8k | velocidade Y do item |
| 18 + 8k | item ja pousou |
| 19 + 8k | maior lado do item / lado do tile |
| 20 + 8k | dano base do item / maior dano do catalogo |

O indice 7 e o que faz a arrancada ser aprendivel. Sem ele a politica nao sabe se
pode usar o avanco, tenta em todo passo e desperdica a recarga de 2,5 s; com ele o
valor cai linearmente de 1 a 0 e a rede consegue escolher o momento.

O indice 8 faz o mesmo para o tremor. O tremor e uma restricao real (0,28 s sem
controle horizontal), entao a politica precisa saber que perdeu o controle para
nao gastar decisoes tentando andar, e precisa ver o instante em que ele volta.

Os indices 9 a 12 sao os **sensores de colisao**. Eles sao calculados a partir da
lista de bloqueadores da fase, nao de coordenadas escritas no codigo: a distancia
ate a parede mais proxima e medida com a mesma caixa que colide (corpo inteiro, nao
o centro) e limitada a `sensorReach` = 192 px. Se o mapa mudar de forma, de buracos
ou ganhar plataformas, a observacao continua descrevendo o mapa certo sem
re-treinar por causa do formato — so a dinamica muda.

Sao **8 slots** de 8 valores, ordenados por ameaca (distancia horizontal somada a
altura, ignorando o que esta abaixo do desviador). O jogo nunca passa de 5 itens
simultaneos (medido: 5 itens em 35,7% dos passos, 4 em 43,8%), entao os 8 slots
sao folga de proposito — mesmo se o spawner ficar mais agressivo, nenhum item sai
da observacao. O penultimo valor de cada slot da a **forma** do item e o ultimo diz
**quanto ele machuca**, que e o que permite decidir entre encostar numa faca ou num
machado.

## Acoes (8)

`0` parado, `1` esquerda, `2` direita, `3` pular, `4` pular+esquerda,
`5` pular+direita, `6` avanco a esquerda, `7` avanco a direita.

Pular so funciona no chao; o pedido e descartado se o desviador estiver no ar. O
avanco tambem exige o chao (e nao tem recarga util no ar) e e recusado durante o
tremor.

As acoes sao **teclas paralelas**, nao uma lista de sequencias: o avanco nao
substitui o pulo. Como a rede escolhe uma acao por passo (60 por segundo), ela
alcanca combinacoes que nao existem como rotulo — avancar num passo e pular no
seguinte sai do mesmo jeito que um "avancar + pular" dedicado, sem gastar uma
terceira saida. Por isso sao 8 acoes e nao 10: rotulos extras so diluiriam a
probidade de cada uma.
