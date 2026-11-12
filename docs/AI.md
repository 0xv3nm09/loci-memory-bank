# How AI was used — in the product and in the build

Two separate answers, kept separate on purpose: the AI **inside Loci** (Sage)
and the AI tools used to **build Loci**. They have different models, different
contracts, and different failure modes.

---

## 1. Sage — the AI inside the product

Full contract and measurements: [MODEL_CARD.md](MODEL_CARD.md). Summary:

| | |
| --- | --- |
| **Model** | `qwen3:14b` via Ollama, on a developer-owned GPU box behind a Cloudflare Tunnel — no third-party API, no keys in the client |
| **One job** | Turn the current set of thought notes into a structured layout: clusters, cross-cluster edges, up to two expand/challenge suggestions |
| **Contract** | Ollama `/api/chat` with `format` = JSON schema — the model structurally cannot return free text into the UI |
| **Guardrails around it** | Deterministic distress gate runs before Sage sees any text; heuristic organizer holds an instant result; model output is sanitized (unknown ids dropped) and only wins if it covers ≥60% of notes; `userPlaced` cards are never touched; the orb's gold/gray glow records which organizer ran |
| **Measured** | Warm 10.6 s, cold ~36 s (boot warmup preloads VRAM for 30 min), 30 s timeout → local fallback |
| **What Sage cannot do** | Move a hand-placed card, decide a safety verdict, see past sessions, identify the user, return unstructured text |

The design principle: **the LLM proposes, deterministic code disposes.** Even
Sage's suggestions are just proposals — every one lands as a dismissible bud.

---

## 2. AI used to build Loci

The project was built **with AI coding agents under human direction** — every
line is machine-written, every scope decision, priority and quality gate is
human. The build ran as a series of directed sessions across three tools:

| Tool | Role in the build |
| --- | --- |
| **ZCode (GLM)** | Primary build + integration: scaffolded the IWSDK project, built the Shape flow, persistence, Recall, Rewind, safety systems, the whole docs suite, deployment pipeline; ran three full audits |
| **Claude (Opus)** | Polish sessions: spawn/particle animation system, webcam hand tracking, the audit that caught dispose-vs-destroy and the camera-prompt-on-load issue |
| **Lovable** | Designed the phone/desktop **web companion** in `web/` (the Quest app was not built with it) |
| **Qwen (in-product)** | Organizes thoughts at runtime — and, by design, makes **no** build or safety decisions |

### How the build was run (the part that mattered)

- **Plan first, code second.** Nine planning documents (strategy, product
  brief, concept, safety, architecture…) were written and agreed before a
  line of code. They are the source of truth the agents were briefed from.
- **One phase at a time.** Agents were never handed the whole plan: Shape flow
  first, then persistence, then Recall, then Rewind, then safety, then docs —
  each phase working and tested before the next was briefed. This is the
  single biggest scope-discipline lever for AI-built software.
- **Fallback-first discipline.** Every AI-dependent feature was required to
  work without its AI (heuristic organizer, graceful model-down status, camera
  denied → typed path). Agents were briefed to build the fallback first, the
  model second.
- **Human in the loop on feel.** The snap, the clutter, the missing text —
  every subjective quality call came from the human testing each build and
  reporting specifics, which were then fixed and re-verified.
- **Three independent audits.** Separate sessions reviewed the full codebase
  for correctness, safety ordering, and integration gaps; their findings were
  triaged, and real issues (GPU-leaking teardown, camera prompt on load, an
  unregistered component) were fixed and re-verified.
- **Deterministic where it counts.** The safety gate, the verdict on what gets
  organized, the layout fallback — all deterministic code. No AI decides
  anything a user would need to trust on a bad day.

### What was human-only

Product concept and naming, the competition strategy and prize targeting, the
planning documents' product decisions, every subjective quality gate (the
snap must "feel magical"), safety tone and copy review, all device testing
and the demo direction.

---

## Disclosure

- Runtime AI: `qwen3:14b` self-hosted via Ollama (see [MODEL_CARD.md](MODEL_CARD.md))
- Build AI: ZCode/GLM, Claude/Opus, Lovable — directed, reviewed and verified
  by a human developer
- No AI-generated imagery, video or audio anywhere in the submission
  (all sound is synthesized in code; all diagrams are generated SVGs from
  committed scripts)
