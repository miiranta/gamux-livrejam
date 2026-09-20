# Audio

Todos os audios do jogo ficam aqui. A pasta decide **qual controle de volume**
manda no som:

| pasta | volume | quem usa |
|---|---|---|
| `soundtrack/<tela>/` | **Music** | musica de cada tela (ver abaixo) |
| `voices/<set>/` | **Voice** | falas do personagem (o set e escolhido na configuracao) |
| `sound_effects/<evento>/` | **Sound effects** | efeitos de UI e do jogo |

## Soundtrack

Cada tela tem a sua pasta dentro de `soundtrack/`:

| pasta | quando toca | como |
|---|---|---|
| `match/` | durante a partida | em loop |
| `menu/` | so no menu inicial (na pausa fica em silencio) | em loop, com crossfade |
| `end-game/` | na tela de fim de jogo | **uma vez so**, sem loop |

O menu e a partida usam loop; o de menu usa crossfade (ver abaixo) para o
loop nao ter emenda audivel.

## Manifest

`manifest.json` e **gerado**, nao edite na mao:

```bash
python3 tools/build_audio_manifest.py
```

Ele varre as pastas e escreve a lista de arquivos. O jogo le esse manifest
no boot e **decodifica tudo em memoria** (Web Audio), entao tocar um som nao tem
atraso entre o gatilho e o audio — importante porque os sons acompanham eventos
visuais (hover, impacto, mudanca de nivel de dano).

Formatos aceitos: `mp3`, `ogg`, `wav`, `m4a`, `aac`, `flac`, `opus`.

## Como adicionar audio

### Uma musica

Solte o arquivo na pasta da tela (`soundtrack/match/`, `soundtrack/menu/` ou
`soundtrack/end-game/`) e rode o script. Se houver mais de um arquivo na pasta,
o primeiro (ordem natural) e o que toca. Pastas com nome desconhecido sao
ignoradas, entao uma pasta nova sozinha nao quebra o jogo.

### Um set de voz

1. Crie `voices/<nome_do_set>/` e coloque os arquivos dentro.
2. Adicione a traducao do nome da pasta em `public/i18n/*.json`, na chave
   `settings.voiceSet.<nome_do_set>` (o nome da pasta **e** a chave).
3. Rode o script.

A lista na configuracao se ajusta sozinha (ela comeca recolhida justamente para
aguentar muitos sets) e cada opcao tem um botao "play" que toca uma fala
aleatoria do set.

### Um efeito sonoro

1. Crie `sound_effects/<nome_do_evento>/` e coloque os arquivos dentro.
2. Registre o evento em `src/ui/services/audio.service.ts` (`SOUND_EFFECTS`) e
   toque com `playSoundEffect('<nome_do_evento>')`.
3. Rode o script.

Se a pasta tiver varios arquivos, um deles e sorteado a cada toque — e o caso do
`button_hover`, que toca em qualquer botao da interface.

Para varios sons do mesmo evento que **nao podem repetir** (como as duas
explosoes da tela de fim de jogo), use
`playSoundEffectSequence('<evento>', quantidade, [atrasos])`: ele sorteia sem
reposicao e agenda cada som no relogio de audio, entao o som cai exatamente no
frame da animacao correspondente.

## Sincronia com a animacao

`playSoundEffectSequence` recebe os atrasos em segundos e usa
`AudioBufferSourceNode.start(when)`, ou seja, o agendamento acontece na thread
de audio. Um `setTimeout` no JS atrasaria junto com a thread principal (que
tambem esta rodando o jogo), e o som sairia fora de sincronia.

Os atrasos ficam em `src/ui/pages/end-game/end-game.ts` e espelham os delays do
CSS (`end-game.scss`) e dos `app-particle-burst`.

## Loop sem emenda (crossfade)

Um MP3 nao da loop perfeito: o encoder deixa um pequeno silencio no comeco e no
fim do arquivo, e o `loop = true` do navegador toca esse silencio a cada volta
(um "buraco" audivel).

Para o som de menu, o engine toca o arquivo em **passadas sobrepostas**: a
passada seguinte comeca `crossfadeSeconds` antes da atual terminar, e as duas
se misturam. Como as passadas se sobrepoem, o periodo do loop e
`duracao - crossfade`, entao a emenda nunca cai no comeco/fim do arquivo.

As curvas de fade sao **equal-power** (seno/cosseno), nao lineares: as duas
passadas sao sinais nao correlacionados, entao um fade linear comum daria uma
queda de ~3 dB no meio da sobreposicao, ouvida como um pulso a cada loop.

O agendamento usa `start(when)` (thread de audio) com um timer so decidindo o
que enfileirar; assim uma thread principal ocupada nao faz o loop engasgar.

## App sem foco

Quando a janela perde o foco (ou a aba fica em segundo plano), o `AudioContext`
e **suspenso**: todo o audio para. Ao voltar o foco, ele e retomado.

Suspender o contexto congela o relogio de audio, entao a musica **continua de
onde parou** em vez de reiniciar — inclusive as passadas ja agendadas do loop
com crossfade. Nada e recriado.

Enquanto o app esta sem foco, um som disparado nao resume o contexto (fica
agendado e silencioso), e um gesto nao "destrava" o audio com a aba escondida.

## Créditos

Os arquivos atuais e suas licencas estao em `CREDITS.md`.
