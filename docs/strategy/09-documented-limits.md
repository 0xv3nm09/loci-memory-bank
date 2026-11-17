# 9. Documented limits

Every accepted trade, stated openly — judges reward honesty that checks
out. Each limit names why it's accepted and what covers for it.

| Limit | Why it's accepted | What covers for it |
| --- | --- | --- |
| **Voice capture desktop-only** | Quest browsers have no Web Speech API — a platform gap, not an omission | Spatial QWERTY keyboard is the equal first-class path on Quest; seed cards capture without any input at all; mic orb auto-hides there |
| **Streaks rejected** | Conflicts with the no-guilt design principle (Concept doc) — a streak punishes rest | Recall scheduling does the motivating: weakest-first `pickOrder`, strength 0–5, misses resurface first |
| **Web companion not auto-deployed** | Repo-only context for now; the Quest app is the submission surface | Companion runs locally (`bun run dev` in `web/`); screenshots committed as proof ([README](../../README.md#web-companion--one-palace-two-screens)); 16/16 tests |
| **Foveation 0.8** | Peripheral softness is the performance trade for a steady 72 fps | Central vision (where gaze focus works) stays sharp; judged criterion is min 60 fps seated |
| **Model is a cloud call** | Serverless inference needs no VRAM, no warmup, no user setup | Heuristic organizer is instant and always available — the product never stalls; on-device WebLLM is roadmap |
| **Rewind depth = 30 snapshots** | Storage stays bounded; older grain is rarely what you scrub for | JSON export keeps full data locally; month-level grain is roadmap |
| **English in-scene text** | Canvas-rendered type ships one bundled OFL font | Layout, glyphs, and audio cues are language-neutral; localization is roadmap |
| **Single palace per mode** | Think / Grow / Imagine isolate storage keys; multiple palaces per mode is roadmap | JSON export + clear-palace give clean session boundaries |
| **AI key on the VM** | Keyless browser bundle calls the same-origin `/sage` proxy; key is root-only server-side | Deploy gate refuses keyed bundles; Origin check blocks non-browser calls; key rotation documented in [DEPLOY-VULTR.md](../DEPLOY-VULTR.md) |

## The pattern

Each limit is (a) a platform reality or a deliberate design position,
(b) paired with a shipped alternative, and (c) written down where a judge
can find it — [FEEDBACK.md](../FEEDBACK.md) carries the same philosophy for
build-time issues.
