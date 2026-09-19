# Dodger AI

Politica neural que controla o personagem no `FaceSmashing` (desviar dos objetos
que caem). Treinada com Evolution Strategies em PyTorch/CUDA.

## Estrutura

| arquivo | papel |
| --- | --- |
| `config.py` | constantes da simulacao, espelho de `src/game/config/face-smashing.config.ts` |
| `sim.py` | simulacao vetorizada (uma copia do jogo por ambiente, tudo no GPU) |
| `dropper.py` | politica do "jogador" que solta os objetos durante o treino |
| `model.py` | rede MLP, forward em lote e serializacao JSON |
| `train.py` | treino ES |
| `evaluate.py` | avaliacao do modelo exportado contra baselines |
| `test_observation.py` | garante que a observacao do Python bate com a do TypeScript |
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
.venv/bin/python tools/ai/train.py --generations 400
```

Saidas:

- `livrejam/public/models/dodger-policy.json` — pesos carregados pelo jogo.
- `livrejam/public/models/dodger-policy.train.json` — historico do treino.

## Avaliacao

```bash
.venv/bin/python tools/ai/evaluate.py
```

Compara a politica treinada com acoes aleatorias e com "nao fazer nada".

## Contrato de observacao

O jogo e o treino precisam produzir exatamente o mesmo vetor, senao a politica
treinada nao se comporta como esperado em jogo. O teste abaixo trava isso:

```bash
.venv/bin/python tools/ai/test_observation.py
```

Alem dele, um spec do lado do TypeScript
(`src/game/ai/observation-contract.spec.ts`) verifica o mesmo vetor de
`fixtures/observation_fixture.json`. Ao mudar `observation.ts` ou
`sim.py:observation()`, os dois lados precisam ser atualizados juntos.

## Oponente de treino

O `DropperPolicy` imita o jogador humano: mira onde o desviador **vai estar**
quando o objeto chegar ao chao (antecipando a velocidade dele), com um jitter
que torna o alvo imperfeito — do mesmo modo que o jogo faz em
`face-smashing.ts:aimPoint()`.

Isso importa: um oponente que sempre acerta o alvo exato tornaria o jogo
impossivel e ensinaria a politica a apenas fugir para o canto. Por isso a
recompensa usa a **vida media** (segundos por episodio) e nao o tempo total.

## Observacao (24 valores)

| indice | significado |
| --- | --- |
| 0 | posicao horizontal do desviador, normalizada pelo meio da arena |
| 1 | velocidade horizontal / velocidade maxima da rodada |
| 2 | velocidade maxima da rodada / 300 (o teto e variavel a cada rodada) |
| 3 + 7k | objeto k presente |
| 4 + 7k | delta X ate o objeto / raio de observacao |
| 5 + 7k | delta Y ate o objeto / raio de observacao |
| 6 + 7k | velocidade X do objeto |
| 7 + 7k | velocidade Y do objeto |
| 8 + 7k | objeto ja pousou |
| 9 + 7k | meia-largura do objeto |

Sao 3 slots, escolhidos por ameaca (distancia ponderada pela altura).

## Acoes (6)

`0` parado, `1` esquerda, `2` direita, `3` pular, `4` pular+esquerda, `5` pular+direita.
