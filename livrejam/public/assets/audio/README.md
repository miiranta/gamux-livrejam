# Audio

Todos os audios do jogo ficam aqui. A pasta decide **qual controle de volume**
manda no som:

| pasta | volume | quem usa |
|---|---|---|
| `soundtrack/` | **Music** | musica do jogo (loop durante a partida) |
| `voices/<set>/` | **Voice** | falas do personagem (o set e escolhido na configuracao) |
| `sound_effects/<evento>/` | **Sound effects** | efeitos de UI e do jogo |

## Manifest

`manifest.json` e **gerado**, nao edite na mao:

```bash
python3 tools/build_audio_manifest.py
```

Ele varre as tres pastas e escreve a lista de arquivos. O jogo le esse manifest
no boot e **decodifica tudo em memoria** (Web Audio), entao tocar um som nao tem
atraso entre o gatilho e o audio — importante porque os sons acompanham eventos
visuais (hover, impacto, mudanca de nivel de dano).

Formatos aceitos: `mp3`, `ogg`, `wav`, `m4a`, `aac`, `flac`, `opus`.

## Como adicionar audio

### Uma musica

Solte o arquivo em `soundtrack/` e rode o script. A **primeira** faixa da lista
e a que toca em loop na partida.

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

## Créditos

Os arquivos atuais e suas licencas estao em `CREDITS.md`.
