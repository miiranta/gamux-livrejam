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

O checkpoint e escrito a cada `--checkpoint-every` geracoes, entao o jogo tem
sempre um modelo valido para carregar durante o treino. O `--seed` fixa a
aleatoriedade: troque-o para reproduzir ou variar a rodada.

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
1 - dano_medio/teto - worst_weight * pior_dano/teto + dodge_weight * esquivas/(60*2)
```

- `dano_medio`: quanto o candidato levou por rodada, em media.
- `pior_dano`: a pior rodada daquele candidato. E o termo que evita uma
  politica que so otimiza a media (ex.: "correr para o canto funciona quase
  sempre"). Aumente `--worst-weight` para forcar mais robustez, ao custo da
  media.
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
| mira do oponente | `dungeon-drop.ts:aimPoint()` | `dropper.py` |
| rampa de dificuldade | `systems/item-spawner.ts` | `sim.py:step_dropper()` |
| deriva lateral do objeto | `systems/item-spawner.ts` | `sim.py:spawn_item()` |

O primeiro e travado por teste (`test_observation.py`); os outros dependem de
disciplina e de leitura cruzada dos dois arquivos.

Os numeros em si sao travados por `test_config_parity.py`, que le os dois
arquivos e compara os 40 campos que precisam bater. Ele tambem recusa uma
`lateralSpeed` grande demais: uma deriva que desloca o pouso por mais de meia
arena descaracteriza a mira do oponente e degenera o treino (ver abaixo).

### A deriva lateral e um teto de dificuldade

`item.lateralSpeed` nao e so um enfeite visual: ela define se desviar vale a
pena, porque e ela que carrega a informacao de onde o oponente mirou.

O objeto cai de `SPAWN_Y` (24 px) ate o chao (352 px) com gravidade
`ITEM_GRAVITY` = 900 px/s², partindo de `DROP_BASE_SPEED` = 140 px/s. A queda
de 328 px leva `t = (-v0 + sqrt(v0² + 2gh)) / g` = **0,71 s** (contra 2,34 s da
v1, que caia a velocidade constante). Uma deriva lateral de `v` desloca o ponto
de pouso em `0,71 * v` px, o que hoje da 14 px com `v = 20` — folgado diante da
meia arena de 256 px.

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

| nivel | velocidade maxima | pulo (px de subida) |
| --- | --- | --- |
| 0 | 560 | 192 |
| 3 | 384 | 124 |
| 7 | 150 | 57 |

A subida vem de `v^2 / 2g`, nao do valor cru do pulo. No nivel 0 ela e de 192 px,
que e exatamente metade da altura do mapa (12 linhas x 32 px = 384 px): o pulo
nao chega ao teto e nao da para escapar da chuva de itens por cima.

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

## Observacao (71 valores)

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
| 7 + 8k | item k presente |
| 8 + 8k | delta X ate o item / raio de observacao |
| 9 + 8k | delta Y ate o item / raio de observacao |
| 10 + 8k | velocidade X do item |
| 11 + 8k | velocidade Y do item |
| 12 + 8k | item ja pousou |
| 13 + 8k | maior lado do item / lado do tile |
| 14 + 8k | dano base do item / maior dano do catalogo |

Sao **8 slots** de 8 valores, ordenados por ameaca (distancia horizontal somada a
altura, ignorando o que esta abaixo do desviador). O jogo nunca passa de 5 itens
simultaneos (medido: 5 itens em 35,7% dos passos, 4 em 43,8%), entao os 8 slots
sao folga de proposito — mesmo se o spawner ficar mais agressivo, nenhum item sai
da observacao. O penultimo valor de cada slot da a **forma** do item e o ultimo diz
**quanto ele machuca**, que e o que permite decidir entre encostar numa faca ou num
machado.

## Acoes (6)

`0` parado, `1` esquerda, `2` direita, `3` pular, `4` pular+esquerda, `5` pular+direita.

Pular so funciona no chao; o pedido e descartado se o desviador estiver no ar.
