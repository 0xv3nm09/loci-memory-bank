# Capability matrix — full detail

Every capability, how it works, which files implement it, and what makes it
notable. This is the depth a judge should find when they open the source.
The [README](../README.md) carries the one-line version; this file is the
per-feature reference.

Related: [ARCHITECTURE.md](ARCHITECTURE.md) (system inventory, data flow,
save schema) · [SAFETY.md](SAFETY.md) (distress gate design) ·
[MODEL_CARD.md](MODEL_CARD.md) (Sage contract and limits)

## Capture

| | Detail |
| --- | --- |
| **Typed** | Desktop bar → `keydown` listener → `spawnRaw(text)` → distress gate → note entity + spawn animation. Works everywhere. |
| **Voice** | Mic orb → Web Speech API (Webkit-prefixed) → final transcript → `spawnRaw(text)`. Desktop-only (Quest browsers have no speech recognition — the mic orb auto-hides). |
| **Seed cards** | Three curated sets (Exam, Thesis, Kingdom) as 3D grabbable cards. One press spills 5 themed notes and triggers auto-organize after 2.2s. |
| **Spatial keyboard** | QWERTY panel at seated eye height (works on Quest where speech is unavailable). Number row, punctuation, backspace, done. |
| **Safety gate** | All four paths pass through `checkDistress()` before `spawnRaw()` creates anything. Flagged captures are discarded — they never enter the palace, the save, or the model. |

## Organize

| | Detail |
| --- | --- |
| **Heuristic (Path A)** | `clusterer.ts`: token overlap coefficient + greedy union-find. Stopword filtering, naive stemming. Deterministic — same input always produces the same clusters. Instant, no network. |
| **Model (Path B)** | `model-client.ts`: POST to the same-origin `/sage` proxy (Caddy on the VM injects the Authorization header server-side — the browser bundle never holds a key) → Vultr Serverless Inference (`qwen3.8-flash-next`) with `response_format: json_object`. Schema-enforced, sanitised, retried ×1 @1.5s. |
| **Arbitration** | Model result wins only if it covers ≥60% of notes. Otherwise the heuristic result stands. The organize orb turns **gold** (model) or **gray** (local) so you always know which ran. |
| **Suggestion buds** | Model-exclusive — the heuristic structurally cannot produce them. Up to 2 per organize: one **expand** (green +, inviting question) and one **challenge** (amber ?, honest question). Press to read the bubble. |
| **Declump** | 5-pass relaxation: movable targets separate to ≥0.185m from each other AND from user-placed cards (treated as immovable obstacles). Grid + relaxation keeps cards readable at any count. |

## Snap animation

| | Detail |
| --- | --- |
| **Flights** | Eased arcs (0.65s) from current position to target, with scale overshoot and per-card stagger (0.045s apart). |
| **Particle trails** | 6 particles per flight (additive blending, 0.7s life, pooled cloud — no per-flight allocation). |
| **Connection lines** | Cylinder geometry between cluster-crossing pairs, opacity tracks progress. |
| **Chord** | Synthesized 4-note resolving chord (A major). No audio files. |

## Arrange

| | Detail |
| --- | --- |
| **VR** | `DistanceGrabbable` — ray-based grab via trigger, moves at source. `GrabWatchSystem` marks `userPlaced = true` on release; `organize()` excludes user-placed cards from reorganization. |
| **Desktop** | `MouseDragSystem` — camera-facing plane drag with offset preservation. |
| **Spawn animation** | Scale 0→1 with overshoot, opacity fade, glow bloom — skipped for restored notes (they appear settled). |

## Gaze & field-of-view comfort

| | Detail |
| --- | --- |
| **Gaze-assisted focus** | `ambient-system.ts` measures the angle between head-forward and each card every frame (dot product of camera direction vs. to-card vector, scratch vectors — zero per-frame allocation). A card within ~14° of center view gets a subtle 1.04× lift and a whisper of extra glow, signaling it is ready to pinch. Works identically on desktop (mouse-look) and in XR (head pose). |
| **Feedback hierarchy** | Scale/glow tiers never fight: grab (1.12×) > hover (1.08×) > gaze (1.04×) > resting. Settled-note breathing pauses while a card is gaze-focused, so the lift reads cleanly. |
| **Gaze lock tick** | An ultra-soft 880 Hz tick (peak 0.015, throttled to 250 ms) marks the moment gaze locks onto a new card — multi-sensory feedback without chatter. `audio.ts playGazeFocusTick()`. |
| **Comfortable FoV clamp** | `layout.ts clampToComfortableFoV()` bounds the horizontal spread to ±30° (a 60° cone around straight-ahead — inside every Quest device's narrower FoV) and clamps height to the seated eye-height band 1.05–1.45 m. Applied to cluster centers and to raw-note spawns; restored palaces keep the user's own placements untouched. |
| **Why it matters** | The FoV differs between Quest devices — essential UI and interactions bounded inside a comfortable narrower cone read well on all of them and eliminate neck strain. |

## Recall

| | Detail |
| --- | --- |
| **Quiz panel** | Dark backdrop + question + 3 wide answer bars. Generated from real palace data, weakest notes first. |
| **Question types** | Type A: "which thread did this join?" (cluster membership). Type B: "which thought was closest?" (association via edges or same-cluster peers). |
| **Voice answering** | Spoken transcript fuzzy-matched to closest option bar (substring + word-overlap scoring). Desktop only. |
| **Grading** | Correct → green bar, strength +1 (cap 5), rising ping. Wrong → amber bar, strength → 0, soft tone. No failure buzz. |
| **Scheduling** | `pickOrder()` sorts weakest / never-seen first. Strength 0–5; correct +1; miss → 0. Persisted in the palace save. |

## Rewind

| | Detail |
| --- | --- |
| **Dial** | Grabbable knob on a track at the void's edge (DistanceGrabbable, X-constrained). "Now" button returns to latest. |
| **Snapshots** | ≤30 in the save. Each scrub re-positions cards to historical layout with snap animation. |
| **Scrubs never recorded** | `schedulePalaceSave` refuses during `rewindActive` — scrubbing is never mistaken for a real save. |

## Safety

| | Detail |
| --- | --- |
| **Gate** | `distress-gate.ts`: 16 reviewed trigger patterns. Runs on every capture before anything else. |
| **Panel** | 3D world-space crisis panel: acknowledgment, real resources (findahelpline.com, 988, local emergency), closing human line, "I'm okay — continue" button. |
| **Blocks** | `crisActive` gates organize, recall, capture, and rewind while open. |
| **Fail direction** | Toward resources. False positive = one dismissible panel. False negative = unacceptable. |

## Persistence

| | Detail |
| --- | --- |
| **Save schema** | Versioned `loci.palace.v1`: notes, edges, cluster labels, recall state, ≤30 history snapshots. |
| **Debounce** | 600ms min (1.8s after organize so flights land before the snapshot). |
| **Beforeunload** | Synchronous flush — typed-but-unorganized thoughts survive tab close. |
| **Clear** | Suppresses the beforeunload flush, wipes storage, reloads. |
| **Export** | JSON download of the entire palace from the ? menu. |

## Accessibility

| Feature | Implementation |
| --- | --- |
| CVD-verified palette | 6 accents searched under Viénot deutan/protan/tritan simulation (worst pair 72.2) |
| Never color-only | Every state carries a glyph, shape, or label |
| Global text scale | Aa orb: 100/125/150%, applied live via scene traversal |
| Reduced motion | `prefersReducedMotion()` cached in `media-queries.ts` |
| High-contrast mode | HC button: HUD + overlay → pure black/white |
| Crisis panel audio | Calm tone (low, slow — presence, not alarm) |
| One hand, seated | All affordances within a two-foot arc; no locomotion |
| Spatial keyboard | Works on Quest (no speech API there) — full QWERTY |
