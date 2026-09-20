# Livrejam

Projeto gerado com o [Angular CLI](https://github.com/angular/angular-cli)
versão 22.1.2.

## Áudio

Sons ficam em `public/assets/audio/`, divididos por pasta — a pasta define qual
controle de volume manda no som:

| pasta | volume |
|---|---|
| `soundtrack/` | Música |
| `voices/<set>/` | Voz (set escolhido na configuração) |
| `sound_effects/<evento>/` | Efeitos sonoros |

O `manifest.json` é gerado (não edite na mão):

```bash
python3 ../tools/build_audio_manifest.py
```

Detalhes de como adicionar música, set de voz ou efeito sonoro:
[`public/assets/audio/README.md`](public/assets/audio/README.md).

## Servidor de desenvolvimento

Para subir um servidor local:

```bash
ng serve
```

Com o servidor no ar, abra `http://localhost:4200/` no navegador. A aplicação
recarrega sozinha sempre que algum arquivo fonte é modificado.

## Geração de código

O Angular CLI traz ferramentas de scaffolding. Para gerar um componente novo:

```bash
ng generate component nome-do-componente
```

Para a lista completa de schematics disponíveis (como `components`,
`directives` ou `pipes`):

```bash
ng generate --help
```

## Build

Para compilar o projeto:

```bash
ng build
```

Os artefatos do build ficam em `dist/`. Por padrão, o build de produção otimiza
a aplicação para desempenho.

## Testes unitários

Para rodar os testes unitários com o [Vitest](https://vitest.dev/):

```bash
ng test
```

## Testes ponta a ponta

Para testes ponta a ponta (e2e):

```bash
ng e2e
```

O Angular CLI não vem com um framework de e2e por padrão; escolha o que fizer
mais sentido para o projeto.

## Mais recursos

Para mais informações sobre o Angular CLI, incluindo a referência completa dos
comandos, veja a página
[Angular CLI Overview and Command Reference](https://angular.dev/tools/cli).

## Captura de rosto e mãos

A captura roda inteiramente no dispositivo, com o
[MediaPipe Tasks Vision](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker)
(`@mediapipe/tasks-vision`).

| Asset | Caminho | Tamanho |
| --- | --- | --- |
| Bundle do Face Landmarker | `public/models/face_landmarker.task` | 3,6 MB |
| Bundle do Hand Landmarker | `public/models/hand_landmarker.task` | 7,5 MB |
| Runtime WASM | `public/wasm/` | ~34 MB (uma variante baixada por navegador) |

### Licenças dos modelos

Todos os modelos e o runtime estão sob a **Apache License 2.0**.

| Componente | Conteúdo | Licença |
| --- | --- | --- |
| `@mediapipe/tasks-vision` | Runtime WASM e API JS | Apache-2.0 |
| `face_landmarker.task` | Detector BlazeFace short-range, FaceMesh-V2, modelo de blendshapes | Apache-2.0 |
| `hand_landmarker.task` | Detector de palma, modelo de landmarks da mão | Apache-2.0 |

- Texto da licença: <https://www.apache.org/licenses/LICENSE-2.0>
- Código fonte: <https://github.com/google-ai-edge/mediapipe>
- Host de download dos modelos: `https://storage.googleapis.com/mediapipe-models/`

`face_landmarker.task` contém `face_detector.tflite`,
`face_landmarks_detector.tflite`, `face_blendshapes.tflite` e
`geometry_pipeline_metadata_landmarks.binarypb`.
`hand_landmarker.task` contém `hand_detector.tflite` e
`hand_landmarks_detector.tflite`.

### Privacidade

A inferência acontece inteiramente no dispositivo; os quadros da câmera nunca
são enviados para lugar nenhum. O MediaPipe Tasks envia métricas anônimas de
desempenho para o Google, como descrito no
[aviso de privacidade do MediaPipe](https://github.com/google-ai-edge/mediapipe#privacy-notice).
