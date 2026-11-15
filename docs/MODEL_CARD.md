# Sage — model card

The organizing intelligence inside Loci. Sage is called for exactly one job:
turning a set of thought notes into a structured spatial layout — clusters,
cross-cluster connections, and up to two suggestions.

## Model

| | |
| --- | --- |
| **Model** | `qwen3.8-flash-next` — pinned in `model-client.ts` |
| **Hosting** | Vultr Serverless Inference (`https://api.vultrinference.com/v1`). Always-on, no cold starts, no self-hosted hardware. API key via env var (`VITE_VULTR_KEY`) |
| **Contract** | OpenAI-compatible `/chat/completions` with `response_format: json_object` — schema: `clusters[].{label, noteIds[], confidence}`, `edges[].{a,b,relation}`, `suggestions[].{noteId, kind, text}` — the model cannot return free text into the UI |
| **Params** | `temperature: 0.2` |

## Measured behavior

| Phase | Latency | Note |
| --- | --- | --- |
| Warm (serverless, typical) | **2–4 s** for 5–10 notes | Always-on inference — no cold start |
| Endpoint health check | ≤8 s timeout | Model availability check |
| Organize timeout | 30 s | Then the local organizer answers instantly |

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
5. **Retry once** — a 1.5 s pause then a second attempt; both failures fall
   back silently.
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

Note texts are sent to Vultr's inference endpoint for the duration of one
organize call and not persisted. Nothing is shared with third parties beyond
that single API call. Palaces live entirely in the visitor's browser.

## Known limits (documented, not hidden)

- **Server dependency** — if the endpoint is unreachable, organize runs locally
  (lower-quality clustering, no suggestion buds). The status line says so
  honestly.
- **Single-language tuning** — prompts and truncation lengths are tuned for
  English captures.
- **One-shot context** — Sage sees the current note set plus the layout
  contract; it has no conversation memory by design (the palace itself is the
  memory).
