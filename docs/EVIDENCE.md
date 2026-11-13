# Evidence map — competition criteria → proof

Every claim a judge could check, mapped to where it lives in the code and how
it was verified. Companion docs: [ARCHITECTURE.md](ARCHITECTURE.md) ·
[MODEL_CARD.md](MODEL_CARD.md) · [SAFETY.md](SAFETY.md).

## Track criteria (Best New Productivity Experience)

| Criterion | Evidence | Verified by |
| --- | --- | --- |
| Designed around a recurring daily moment | Capture → snap → arrange ritual + return greeting + Recall scheduling | `capture-system.ts` (`restorePalace` greeting), `recall-system.ts` (`pickOrder`) |
| Hands-first required | Every interactive entity is `RayInteractable` and/or `OneHandGrabbable`; `useHandPinchForGrab: true` in `iwsdk.config.json`; no two-hand-only interaction anywhere | `grep OneHandGrabbable src/` — single instance pattern |
| Seated, limited movement | No locomotion; all affordances within a seated two-foot arc (y 1.0–1.3 m); `locomotion: false` | `iwsdk.config.json`, `capture-system.ts` positions |
| ≥60 fps on Quest | `updateTargetFrameRate(72)` + `setFoveation(0.8)` on session start; no per-frame allocations on hot paths except the documented elics-safe snapshot | `index.ts` |
| Performance under load | Grid cluster layout scales with note count; declump relaxation keeps ≥0.185 m separation (measured in XR: min pair exactly 0.185) | `layout.ts`, `organize-system.ts` `separate()` |

## Special award evidence

| Award | Claim | Implementation | Proof point |
| --- | --- | --- | --- |
| **Best Agentic Interaction** | Sage is a real agent whose agency is visible and honest | `model-client.ts` (schema-bound call, retry, sanitization), `organize-system.ts` (`applyBest` arbitration, `tintOrb` gold/gray), buds model-exclusive (`clusterer.ts` has no suggestions field) | Press organize → gold orb + buds; kill the GPU box → gray orb, product unbroken |
| **Best Reason to Come Back** | The return loop is mechanics, not notifications | `palace-store.ts` (`RecallState`, 30 snapshots), `recall-system.ts` (`pickOrder` weakest-first), `capture-system.ts` (return greeting with `countDue`) | Two-session test: greeting fires with due count; misses resurface first |
| **Best First Five Minutes** | First touch to snap in seconds | `scheduleAutoOrganize()` (2.2 s), seed cards, generated guide panel | Measured walkthrough: boot 1.5 s, recall open 1.1 s, budget ~1.5 min (see `prizes/best-first-five-minutes.md — see docs/ for the built app reference`) |
| **Best Accessibility Forward** | Inclusive by default, verified | `palette.ts` (CVD-searched accents, worst pair 72.2), `text-label.ts` (Aa scale 100–150% live), `capture-keyboard.ts` (voice alternative), `audio.ts` (`playCalmTone` on crisis) | Palette verified under Viénot deutan/protan/tritan simulation — previous set collapsed to 1.4 under protanopia |
| **Boldest Original Concept** | Falls apart off-platform | Rewind dial (scrub a mind's history), hands-on declump, presence-dependent snap | `rewind-system.ts`, `docs/diagrams/boldest-collapse-flow.svg` |

## Safety evidence (cross-cutting)

| Claim | Implementation | Test |
| --- | --- | --- |
| Gate runs before everything | `checkDistress()` called first in `spawnRaw()` — before palace entry, before any model call | `distress-gate.ts` (16 reviewed trigger patterns) |
| Flagged captures are never organized | `spawnRaw` returns before creating the note; nothing persists | Absent from `notes[]` in the save schema |
| Crisis surface exists in-headset | 3D world-space panel (`crisis-panel.ts`) with calm tone, real resources, dismiss button | Sets `crisActive` → organize/recall/capture all blocked while open |
| Fail toward resources | Any ambiguous pattern match flags (high-recall list); the panel is the only branch a flagged capture can take | Trigger list reviewed; over-trigger accepted by design |

## Web companion evidence

| Claim | Where | Verified |
| --- | --- | --- |
| Same loop on flat screen | `web/src/` (TanStack Start + React) | 16/16 vitest tests pass |
| Safety gate present there too | `web/src/lib/loci/` | Covered by the vitest suite |
| Not auto-deployed; Quest CI unaffected | `web/` excluded from the root Pages workflow | `git diff main origin/main -- src/` empty on the web-import commit |
