# Sage — system card

Sage is the AI inside Loci. It organizes thought notes into spatial clusters,
draws connections between them, and offers expand/challenge suggestions. This
card documents what Sage is, what it can and cannot do, and the boundaries that
are enforced in code — not by prompting.

## Identity

| | |
| --- | --- |
| **Name** | Sage |
| **Model** | `qwen3.8-flash-next` via Vultr Serverless Inference |
| **Role** | Organize a set of thought notes into clusters, edges, and suggestions |
| **Contract** | OpenAI-compatible `/chat/completions` with `response_format: json_object` |
| **Temperature** | 0.2 |
| **Context** | Current note set only — no history, no identity, no cross-session data |

## The five hard boundaries

These are enforced by deterministic code, not by system prompts. A system prompt
can be forgotten, talked around, or silently dropped under load. Code cannot.

### 1. Safety gate runs before Sage

`distress-gate.ts` checks every capture against 16 reviewed trigger patterns
**before** `spawnRaw()` creates a note. Flagged text never enters the palace,
never reaches the model, and never persists. The crisis panel shows real
resources (988 Lifeline, findahelpline.com). This is a non-removable pipeline
stage — not a toggle, not a setting.

### 2. Deterministic fallback always ready

`clusterer.ts` computes a complete layout (clusters, edges, labels) instantly
using token-overlap coefficients and union-find, before the model request is
even sent. If the model is slow, down, or returns nonsense, the heuristic result
stands. The product never stumbles.

### 3. Model must earn its result

The model result wins only if it covers ≥60% of notes. Below that threshold,
the deterministic heuristic stands. Unknown note IDs are dropped; uncovered
notes are swept into "Loose threads". Suggestions are capped (one expand, one
challenge) and length-trimmed.

### 4. Human authority preserved

`userPlaced = true` is set on any hand-released card (`GrabWatchSystem`).
`organize()` excludes user-placed cards from reorganization. Sage proposes;
the human decides. Every suggestion is a dismissible bud — press to read,
ignore to decline.

### 5. Visible truth

The organize orb turns **gold** (model organized) or **gray** (local fallback)
and stays that way until the next organize. The user always knows which
intelligence shaped their layout. No hidden AI.

## What Sage will and won't do

| Sage will | Sage won't |
| --- | --- |
| Cluster notes by meaning | Move a hand-placed card |
| Draw connections between clusters | Decide a safety verdict |
| Suggest an expanding question | See past sessions or identify the user |
| Challenge a weak idea with a question | Return unstructured text into the UI |
| Organize honestly (gold/gray truth) | Persist any data server-side |

## Data behavior

- Note texts are sent to Vultr Serverless Inference for the duration of one
  organize call. Nothing is stored server-side.
- The palace (notes, clusters, recall state, history) lives entirely in the
  visitor's browser (`localStorage`).
- No cross-user data. No analytics. No telemetry.
- Webcam hand tracking (optional, desktop) processes frames entirely on-device
  via MediaPipe — never sent anywhere.

## Known limits (documented, not hidden)

- **Server dependency** — if Vultr is unreachable, organize runs locally
  (lower-quality clustering, no suggestion buds). The status line says so.
- **English-only tuning** — prompts and truncation lengths are tuned for English.
- **One-shot context** — Sage sees the current note set only. No conversation
  memory by design (the palace itself is the memory).
- **Voice capture is desktop-only** — Quest browsers have no Web Speech API;
  the spatial keyboard is the equal path.

## Why this matters

A VR productivity tool that processes personal thoughts has a responsibility
to handle them carefully. Sage's boundaries are not limitations to downplay —
they are engineering decisions that make the product trustworthy. The distress
gate, the fallback, the coverage threshold, the visible truth indicator, and the
human authority guarantee are all implemented as code, not promises.
