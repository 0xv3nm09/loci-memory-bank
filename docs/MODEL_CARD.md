# Sage — model card

The organizing intelligence inside Loci. Sage is called for exactly one job:
turning a set of thought notes into a structured spatial layout — clusters,
cross-cluster connections, and up to two suggestions.

## Model

| | |
| --- | --- |
| **Model** | `qwen3:14b` (9.3 GB, Ollama) — pinned in `model-client.ts`; falls back to any `qwen*` on the server, then to the first model listed |
| **Hosting** | Developer-owned GPU box, exposed via a Cloudflare Tunnel (`https://ollama.youtubeccanalyzer.com`). No API keys, no third-party processing |
| **Also available on the server** | `gpt-oss:20b`, `qwen3.5:9b`, `qwen3-coder:30b`, `bge-m3` (embedding model, unused by the app today) |
| **Contract** | Ollama `/api/chat` with `format` = JSON schema (`clusters[].{label, noteIds[], confidence}`, `edges[].{a,b,relation}`, `suggestions[].{noteId, kind, text}`) — the model cannot return free text into the UI |
| **Params** | `temperature: 0.2`, `num_ctx: 4096` |

## Measured behavior

| Phase | Latency | Note |
| --- | --- | --- |
| Cold start (weights on disk) | ~36 s | Covered by the boot warmup + thinking beat |
| Warm | **10.6 s** wall / 9.6 s eval for 5–10 notes | The typical visitor path |
| Endpoint health check | ≤8 s timeout | Model list resolution |
| Organize timeout | 30 s | Then the local organizer answers instantly |

**Warmup:** every page load fires a 1-token generate with `keep_alive: 1800`
(30 min) — the model sits resident in VRAM so the visitor's first Organize is
warm. This is why a judge's first snap is the fast path, not the cold one.

## The pipeline around the model

The model is one participant in a deterministic pipeline, never the authority:

1. **Gate first** — the distress trigger list runs on the raw capture before
   Sage ever sees text; flagged captures never reach the model.
2. **Heuristic held ready** — `clusterer.ts` computes a complete layout
   instantly, before the request is even sent.
3. **Schema + sanitize** — the response must parse against the JSON schema;
   unknown note ids are dropped, uncovered notes are swept into a "Loose
   threads" cluster; suggestions are capped (one expand, one challenge) and
   length-trimmed.
4. **Coverage arbitration** — the model result wins only if it covers ≥60% of
   notes; otherwise the heuristic stands.
5. **Retry once** — a 1.5 s pause then a second attempt, to ride out tunnel
   blips; both failures fall back silently.
6. **Visible truth** — the organize orb turns gold (model) or gray (local) and
   stays that way until the next organize.

## What the model contributes (and doesn't)

**Only the model can produce suggestion buds** — the deterministic
`OrganizeResult` has no suggestions field, so every green + / amber ? bud on
screen is evidence of model contribution. Its clustering is also measurably
sharper on mixed-topic sets (it separated biology from physics prep where the
token-overlap heuristic merged them).

**The model cannot:** move a user-placed card (`userPlaced` is enforced after
any grab), decide the verdict on distress (a deterministic trigger list owns
that), see anything but the current note set (no history, no identity, no
cross-user data), or return unstructured text into the UI (schema-enforced).

## Privacy

Note texts are sent to the developer's own server for the duration of one
organize call and not persisted there (Ollama keeps no chat history). Nothing
is shared with third parties. Palaces live entirely in the visitor's browser.

## Known limits (documented, not hidden)

- **Server dependency** — if the tunnel is down, organize runs locally
  (lower-quality clustering, no suggestion buds). The status line says so
  honestly.
- **Cold start** — ~36 s if the model was evicted; mitigated by the warmup and
  the thinking beat, but the first organize on a cold server can be slow.
- **Single-language tuning** — prompts and truncation lengths are tuned for
  English captures.
- **One-shot context** — Sage sees the current note set plus the layout
  contract; it has no conversation memory by design (the palace itself is the
  memory).
