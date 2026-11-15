# Third-party notices

All bundled open-source components and their licenses.

## Runtime dependencies

| Package | Version | License | Use in Loci |
| --- | --- | --- | --- |
| [`@iwsdk/core`](https://developers.meta.com/vr/documentation/iwsdk/guides/overview) | 1.0.1 | Meta Platforms SDK License | ECS runtime, hand tracking, XR session, grab system |
| [`super-three`](https://github.com/nickcoutsos/super-three) (aliased as `three`) | 0.181.0 | MIT | 3D rendering, geometry, materials, camera |
| [`@mediapipe/tasks-vision`](https://developers.google.com/mediapipe) | ^1.1.1 | Apache-2.0 | Webcam hand tracking (desktop only, dynamically imported) |
| [`@pmndrs/uikit`](https://github.com/pmndrs/uikit) | ^1.0.74 | MIT | Spatial UI panels |
| [`@pmndrs/uikit-horizon`](https://github.com/pmndrs/uikit) | ^1.0.74 | MIT | Horizon-style UI components |
| [`@pmndrs/uikit-lucide`](https://github.com/pmndrs/uikit) | ^1.0.74 | MIT | Icon set for spatial UI |

## Dev dependencies

| Package | Version | License | Role |
| --- | --- | --- | --- |
| [`@iwsdk/cli`](https://developers.meta.com/vr/documentation/iwsdk/guides/overview) | 1.0.1 | Meta Platforms SDK License | Dev server, scene tools, XR emulation |
| [`@iwsdk/reference`](https://developers.meta.com/vr/documentation/iwsdk/guides/overview) | 1.0.1 | Meta Platforms SDK License | API reference lookups |
| [`@iwsdk/vite-plugin-dev`](https://developers.meta.com/vr/documentation/iwsdk/guides/overview) | 1.0.1 | Meta Platforms SDK License | Vite integration for IWSDK |
| [`@meta-quest/metavr`](https://www.npmjs.com/package/@meta-quest/metavr) | ^1.8.1 | Meta Platforms SDK License | Quest device types |
| [`typescript`](https://www.typescriptlang.org/) | ^5.5.0 | Apache-2.0 | Type checking |
| [`vite`](https://vite.dev/) | ^7.1.4 | MIT | Build tooling |
| [`vitest`](https://vitest.dev/) | ^3.2.7 | MIT | Test runner |
| [`@types/three`](https://github.com/DefinitelyTyped/DefinitelyTyped) | ^0.181.0 | MIT | Three.js type definitions |

## Bundled assets

| Asset | License | Location |
| --- | --- | --- |
| [Inter font](https://rsms.me/inter/) | SIL Open Font License 1.1 | `public/fonts/` |
| [MediaPipe Hand Landmarker](https://developers.google.com/mediapipe) | Apache-2.0 | `public/mediapipe/` (WASM + model) |

## Runtime services

| Service | Role | Data sent |
| --- | --- | --- |
| [Vultr Serverless Inference](https://www.vultr.com/products/serverless-inference/) | Sage organizer (`qwen3.8-flash-next`) | Note texts for one organize call; nothing stored server-side |

No AI-generated imagery, video, or audio anywhere in the submission. All sound
is synthesized in code (WebAudio oscillators); all diagrams are generated SVGs
from committed scripts.
