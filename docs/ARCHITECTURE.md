# Loci — architecture & data flow

Technical reference for the Quest app. Everything runs client-side in the
headset's browser (IWSDK = Meta's Three.js + ECS framework); the only network
dependency is the Sage model endpoint.

## System inventory

All systems are registered in `src/index.ts`. Priorities follow IWSDK's
input → simulation → visual pipeline.

| System | File | Responsibility |
| --- | --- | --- |
| `CaptureSystem` | `capture-system.ts` | Four capture paths, seed sets, HUD wiring, help overlay, auto-organize scheduling |
| `OrganizeSystem` | `organize-system.ts` | Model-first arbitration, declump relaxation, cluster labels, suggestion buds, panel hide |
| `SnapSystem` | `snap-system.ts` | Flight animation, particle trails, connection-line growth |
| `GrabWatchSystem` | `snap-system.ts` | Marks hand-released notes `userPlaced` (agent never moves them again) |
| `AmbientSystem` | `ambient-system.ts` | Starfield, hover/grab feedback, spawn animation, breathing, orb float |
| `MouseDragSystem` | `mouse-drag-system.ts` | Desktop drag-arranging on a camera-facing plane |
| `RecallSystem` | `recall-system.ts` | Quiz generation, panel UI, voice answering, spaced-repetition grading |
| `RewindSystem` | `rewind-system.ts` | Spatial dial, snapshot scrubbing, history apply |
| `CrisisPanelSystem` | `crisis-panel.ts` | 3D safety surface; blocks organize/recall/capture while open |
| `KeyboardSystem` | `capture-keyboard.ts` | Spatial QWERTY for in-headset typed capture |
| `AmbientSystem` (audio) | `audio.ts` | Synthesized cues: snap chord, connect ping, place click, miss tone, calm tone, spawn shimmer |
| `PanelSystem` | `panel.ts` | Welcome panel lifecycle; hides itself after the first organize |
| `WebcamHandSystem` | `webcam-hand-system.ts` | MediaPipe hand tracking → synthetic pointer events (desktop only) |
| `status3d` | `status3d.ts` | In-world status label + desktop DOM mirror (single message funnel) |

Cross-system communication goes through one shared bus on `world.globals`
(`LociGlobals`): request functions (`requestOrganize`, `requestRecall`,
`requestKeyboard`, `requestRewindToggle`, `requestRewindToggle`) and state
flags (`recallActive`, `rewindActive`, `crisActive`) that mutually gate every
entry point. No circular imports.

## Entity-component inventory

| Component | Attached to | Notes |
| --- | --- | --- |
| `Note` | thought cards | id, text, cluster, hue, state (`raw/snapping/settled`), `userPlaced` |
| `SnapAnimation` | moving cards | start/target/elapsed; removed on completion; skipped for `Grabbed` entities |
| `SpawnAnimation` | freshly captured cards | scale overshoot + opacity fade + glow bloom |
| `ConnectionLine` | cluster edges | grows between note positions; opacity tracks progress |
| `ClusterLabel` | above clusters | generated label, cluster hue |
| `SuggestionBud` | next to notes | expand (+) / challenge (?); press-to-read bubble; model-exclusive |
| `SeedCard`, `OrganizeOrb`, `RecallOrb`, `TypeOrb`, `TextScaleOrb`, `MicOrb` | affordances | all `RayInteractable`; orbs float via ambient loop |
| `AnswerCard`, `QuizDone` | recall panel | quiz option bars and done button |
| `CrisisDismiss` | crisis panel button | the only dismissal control |
| `RewindHandle`, `RewindNow` | rewind dial | `OneHandGrabbable` constrained to the track's X axis |
| `KeyboardKey` | keyboard keys | char payload; press handler owns the buffer |

All components are registered in `src/components.ts` via `defineComponents`.
Entity teardown uses a **deferred trash pattern**: entities are never destroyed
inside an input-event callback (that mutates the query mid-iteration and
silently fails in elics) — they are parked in a `trash[]` queue and reaped on
the next tick with `object3D.removeFromParent()` + `entity.dispose()` (dispose,
not destroy: it frees GPU resources — canvas-texture labels carry unique
textures).

## Data flow — one organize

```
capture (any path)
  └─ distress-gate.checkDistress(text)     ← reviewed trigger list, runs FIRST
       ├─ flagged → CrisisPanelSystem.show()  (calm tone; organize/recall/capture blocked)
       └─ clear  → spawnRaw(): SpawnAnimation + note card lands
                    └─ scheduleAutoOrganize() (2.2s) or manual orb/button
                         └─ OrganizeSystem.organize()
                              ├─ heuristic organizer computed instantly (held ready)
                              ├─ model-client.organizeWithModel()
                              │    ├─ resolveModel() — prefers qwen3:14b on /api/tags
                              │    ├─ POST /api/chat, format = JSON schema
                              │    ├─ retry once after 1.5s
                              │    └─ sanitize: unknown ids dropped, leftovers swept
                              ├─ accept model result if it covers ≥60% of notes
                              ├─ tintOrb: GOLD (model) / GRAY (local)
                              ├─ declump relaxation (5 passes, ≥0.185m separation,
                              │   user-placed cards = immovable obstacles)
                              ├─ SnapAnimation flights + connection lines + chord
                              └─ schedulePalaceSave(1800ms)
```

Measured on the built app (desktop, GPU box warm): boot to interactive
**1.5 s**; capture to auto-organize **2.2 s**; snap **<1 s** local, **6–11 s**
with Sage warm (~36 s cold — the boot warmup preloads the model so visitors
rarely hit it); recall panel open **1.1 s**.

## Save schema (versioned)

`localStorage["loci.palace.v1"]` — one JSON document:

```jsonc
{
  "version": 1,
  "savedAt": "2026-11-12T20:08:48.877Z",
  "nextCounter": 13,
  "notes": [{ "id": "n3", "text": "…", "cluster": 0, "hue": 0.537,
              "userPlaced": false, "position": [x, y, z] }],
  "edges": [{ "a": "n1", "b": "n4" }],
  "clusterLabels": [{ "index": 0, "label": "Biology", "hue": 0.537 }],
  "recall": { "n3": { "strength": 2, "seen": 3 } },   // spaced repetition
  "history": [ /* ≤30 snapshots: { at, notes, edges, clusterLabels } */ ]
}
```

Writes are debounced (600 ms min, 1.8 s after organize so flights land), flushed
synchronously on `beforeunload` (suppressed after Clear), and skipped entirely
during a Rewind scrub (scrubs are never recorded as history). `beforeunload`
uses the same synchronous writer. Export writes the same document to a
downloaded JSON file.

## Rendering & performance

- **Type**: every label is a canvas texture (`text-label.ts`) at 1536 px/meter
  with fit-to-width wrapping, faux-bold stroking, and a dynamic `redraw()`
  closure for live text (keyboard field, status line). No DOM in VR.
- **Quest targets**: `updateTargetFrameRate(72)` + `setFoveation(0.8)` on
  session start (`src/index.ts`).
- **Code splitting**: MediaPipe (`@mediapipe/tasks-vision`) is dynamically
  imported and lazy-chunked; the main bundle is unchanged by it. WASM + the
  hand-landmarker model load from pinned CDN at runtime.
- **Audio**: fully synthesized (WebAudio oscillators + gain envelopes) — zero
  audio files, zero licensing, stereo panning where supported.
- **Hot paths**: no per-frame allocations in system loops except a bounded
  `Array.from` snapshot where a query may be mutated mid-iteration (the elics
  safe-iteration pattern); scratch vectors are reused.

## The two-organizer contract

Both organizers return the same `OrganizeResult` shape
(`clusters[].noteIds`, `edges[]`, optional `suggestions[]`), which is the whole
integration contract:

- **Heuristic** (`clusterer.ts`): token overlap coefficient + union-find;
  deterministic; also labels clusters from shared tokens.
- **Model** (`model-client.ts`): Ollama `/api/chat` with `format` = JSON schema;
  system prompt fixes cluster count, id discipline and the suggestion tone;
  response sanitized (unknown ids dropped, uncovered notes swept into
  "Loose threads").

Arbitration rule: the model result wins only if it covers ≥60% of notes.
Suggestion buds are produced **only** by the model — they are the visible
proof of agency. The organize orb's emissive tint (gold vs gray) records which
organizer shaped the current layout.
