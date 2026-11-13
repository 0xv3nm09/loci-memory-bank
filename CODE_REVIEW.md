# Loci — Code Review

Full codebase review covering architecture, strengths, issues, and actionable suggestions.

---

## Architecture Overview

Loci is built on IWSDK's ECS framework with 12 registered systems, 18 custom components, and a shared globals bus. The entry point (`index.ts`) boots the World, registers all systems, wraps each in an error boundary, and initializes the 3D status label and AI warmup.

**Data flow**: User input (voice/text/keyboard) → `CaptureSystem` → distress gate check → note entity created → `OrganizeSystem` (heuristic instant + AI async) → `SnapSystem` (animated flights) → `AmbientSystem` (hover/float/starfield) → `palace-store` (localStorage persistence).

**Cross-system communication** uses `world.globals.loci` — a shared object (`LociGlobals`) carrying the `noteById` map, modal flags, request callbacks, and transient state like `lastEdges`/`lastLabels`. Systems read/write it directly; no event bus.

---

## Strengths

**Safety-first design.** The distress gate runs 15 regex patterns on every single capture before it enters the palace. If flagged, the crisis panel blocks all other modals and shows real resources (988 Lifeline, findahelpline.com). This is baked into the architecture, not bolted on.

**Graceful degradation everywhere.** AI organizer fails? Heuristic clusterer takes over instantly. GPU off? Vultr guide ready. No speech recognition? Spatial keyboard. No VR headset? Webcam hand tracking with MediaPipe. Font fails to load? System font fallback. Every feature has a plan B.

**Zero-asset audio.** The entire soundscape — ambient drone, 10+ interaction cues — is synthesized with WebAudio. No licensing, no loading, no CDN dependency. The binaural beat (55/55.5Hz) is a thoughtful touch for a focus app.

**ECS error boundary.** `index.ts` wraps every system's `update()` in try-catch with first-error-per-system logging. One broken system never freezes the whole app.

**Colorblind-safe palette.** The 6 cluster accents were verified under deuteranopia/protanopia/tritanopia simulation with minimum pairwise distance 72. This is documented in code comments with the methodology.

**Clean separation of concerns.** Components are declaration-only (`components.ts`), globals are typed (`globals.ts`), factories are pure (`note-factory.ts`, `layout.ts`), and systems own behavior. No barrel files, no circular imports.

**Prefers-reduced-motion support.** Cached MediaQueryList, checked in hot paths. Animations skip to final state when enabled.

---

## Issues & Suggestions

### High Priority (Competition Impact)

**1. `capture-system.ts` is 501 lines — too many responsibilities.**
It owns: browser HUD wiring, seed dumps, voice capture, text scaling, palace restoration, mode switching, auto-organize timing, beforeunload flushing, distress gate invocation, and affordance placement. Split into `hud-system.ts` (DOM button wiring), `voice-system.ts` (Web Speech API), and keep CaptureSystem focused on the capture → distress gate → note creation pipeline. This reduces cognitive load for judges reviewing code.

**2. API key exposed in client-side code.**
`model-client.ts` sends the Ollama/Vultr API key from the browser. For the competition demo this is acceptable, but the Vultr guide's `getApiKey()` falls back to a hardcoded key. At minimum, proxy through a lightweight server endpoint so the key never ships to the client.

**3. New `CylinderGeometry` per connection line.**
`createLine()` in `note-factory.ts` creates a new `CylinderGeometry(0.003, 0.003, 1, 6)` for every connection. With 6+ edges per organize, this adds up. Create one shared geometry and reuse it across all lines.

**4. Measurement canvas created per text label.**
`createTextLabel()` creates a temporary canvas context for `measureText()` on every call. Cache a single offscreen measurement canvas at module scope.

**5. No loading/progress indicator for AI organize.**
When the user hits Organize, the orb glows but there's no progress feedback during the 5-30 second AI call. Add a pulsing animation or "Sage is thinking..." status message immediately on click, not just after completion.

### Medium Priority (Code Quality)

**6. Empty `catch` blocks should log in development.**
Several catch blocks silently swallow errors (e.g., `mouse-drag-system.ts:100`, `capture-keyboard.ts:63`, `index.ts:33`). Add `console.debug` in these so debugging isn't a guessing game.

**7. `setTimeout` accumulation in webcam cursor trail.**
`webcam-hand-system.ts` creates 8 trail dot meshes with `setTimeout` callbacks for each. If the hand moves fast enough, these accumulate. Use a fixed ring buffer of trail points updated each frame instead.

**8. Module-level `trailClouds` array in `snap-system.ts`.**
The trail particle pool is a module-level mutable array rather than a system instance property. This breaks if two Worlds ever exist (unlikely but architecturally unclean). Move it into `SnapSystem` as an instance field.

**9. `restY` map in `AmbientSystem` never prunes destroyed entities.**
The `WeakMap` pattern would be ideal here, but since IWSDK entities are object-keyed, a periodic prune or using `disqualify` subscription to clean up would prevent memory growth.

**10. Hard-coded positions throughout.**
Panel positions like `new Vector3(0, 1.42, -0.78)` (keyboard), `new Vector3(0, 0.68, -0.95)` (rewind dial), and comfort arc angles are scattered across files. Consolidate spatial layout constants into a `layout-constants.ts` file so tuning doesn't require grep.

### Low Priority (Future Work)

**11. localStorage is unencrypted.**
Palace data including user thoughts are stored in plain localStorage. For a memory/productivity app, consider encrypting the stored JSON with a user-derived key. Not blocking for competition but worth noting for post-competition.

**12. Limited test coverage.**
Only two test files exist (`interaction-state.test.ts`, `modes.test.ts`). The distress gate, clusterer, and palace-store are pure functions that are highly testable. Adding tests for these would catch regressions and demonstrate engineering rigor.

**13. No service worker / PWA support.**
A `manifest.json` and basic service worker would enable install-to-home-screen and offline support on Quest. This is a Meta competition judging point.

**14. No i18n infrastructure.**
All user-facing strings are hardcoded in English. For a productivity tool, even a basic string table would show forethought.

**15. `agoLabel()` edge case.**
The time formatting skips from "X days ago" to "X weeks ago" to "X months ago" but never shows years. If a palace is opened after a year, it shows "12 months ago" indefinitely.

---

## Per-System Notes

| System | Lines | Notes |
|---|---|---|
| CaptureSystem | 501 | Needs splitting (see #1). Otherwise solid capture pipeline |
| OrganizeSystem | 309 | Clean AI-then-heuristic flow. 5-pass declumping is clever |
| RecallSystem | 630 | Largest system but justified — quiz logic is complex. Entity trash queue pattern (never destroy mid-iteration) is correct |
| AmbientSystem | 347 | Well-structured. `float()` helper reused cleanly across 5 entity types |
| ExperienceSystem | 276 | 4-phase intro is polished. Modal visibility management in update() is tidy |
| SnapSystem | 254 | Trail particle pool with dead-cloud reuse is good. Module-level state is the only concern |
| MouseDragSystem | 173 | Clean desktop fallback. Correctly uses `setPointerCapture` |
| RewindSystem | 244 | O(1) lookup via `savedById` Map is correct optimization |
| KeyboardSystem | 202 | Shared `keyGeometry` for same-size keys is good. `RayInteractable` on every key works for both gaze and ray |
| WebcamHandSystem | 448 | Deferred camera prompt is privacy-respecting. Pinch hysteresis prevents flicker |
| CrisisPanelSystem | 117 | Correctly blocks all other modals. Calm tone accompaniment is thoughtful |
| GrabWatchSystem | 13 | Tiny, correct. `disqualify` subscription fires on release |

---

## Dependency Health

- **Three.js**: Pinned via `npm:super-three@0.181.0` with override — correct pattern, shared single instance
- **IWSDK**: Framework-managed, no version concerns
- **MediaPipe**: Self-hosted WASM + model files — no CDN dependency, good for offline
- **No other runtime dependencies** — the entire app is framework + Three + MediaPipe

---

## Summary

The codebase is solid for a competition entry. The safety architecture (distress gate + crisis panel), graceful degradation, accessibility features, and zero-asset audio demonstrate engineering maturity. The main improvements are splitting `CaptureSystem`, sharing geometry/canvas instances for performance, and adding a loading state for AI organize. None of these are blockers for submission.
