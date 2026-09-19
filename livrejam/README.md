# Livrejam

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.2.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Face and hand tracking

Tracking runs fully on-device using [MediaPipe Tasks Vision](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker) (`@mediapipe/tasks-vision`).

| Asset | Path | Size |
| --- | --- | --- |
| Face Landmarker bundle | `public/models/face_landmarker.task` | 3.6 MB |
| Hand Landmarker bundle | `public/models/hand_landmarker.task` | 7.5 MB |
| WASM runtime | `public/wasm/` | ~34 MB (one variant downloaded per browser) |

### Model licenses

All models and the runtime are licensed under the **Apache License 2.0**.

| Component | Contents | License |
| --- | --- | --- |
| `@mediapipe/tasks-vision` | WASM runtime and JS API | Apache-2.0 |
| `face_landmarker.task` | BlazeFace short-range detector, FaceMesh-V2, blendshape model | Apache-2.0 |
| `hand_landmarker.task` | Palm detector, hand landmark model | Apache-2.0 |

- License text: <https://www.apache.org/licenses/LICENSE-2.0>
- Source: <https://github.com/google-ai-edge/mediapipe>
- Model download host: `https://storage.googleapis.com/mediapipe-models/`

`face_landmarker.task` contains `face_detector.tflite`, `face_landmarks_detector.tflite`,
`face_blendshapes.tflite`, and `geometry_pipeline_metadata_landmarks.binarypb`.
`hand_landmarker.task` contains `hand_detector.tflite` and `hand_landmarks_detector.tflite`.

### Privacy

Inference happens entirely on the device; camera frames are never uploaded. MediaPipe
Tasks does send anonymous performance metrics to Google, which is described in the
[MediaPipe Privacy Notice](https://github.com/google-ai-edge/mediapipe#privacy-notice).
