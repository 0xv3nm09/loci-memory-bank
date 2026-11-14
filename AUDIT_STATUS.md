# Audit Fix Verification — Nov 15, 2026

## FIXED (10 items)

| Finding | Status | What was done |
|---------|--------|---------------|
| **C-1** Notes/Rewind can't be grabbed in VR | **FIXED** | `OneHandGrabbable` → `DistanceGrabbable` with `MoveAtSource` in both `note-factory.ts` and `rewind-system.ts` |
| **C-3** Private thoughts to third-party server | **FIXED** | Switched from Ollama personal domain to Vultr Serverless Inference. URL override param removed |
| **H-1** Recall cancel resurrects dead panel | **FIXED** | `waitingFeedback = false` and `feedbackTimer = 0` added to both `cancel()` and `finish()` |
| **H-3** Corrupt localStorage bricks app | **FIXED** | `loadPalace()` now sanitizes notes, positions, edges, history, recall. Corrupt blob moved to `loci.palace.corrupt` |
| **H-4** Tab close mid-Rewind saves wrong state | **FIXED** | `flushOnExit` now checks `!getLoci(this.globals).rewindActive` |
| **H-6** ExperienceSystem per-frame scene traversals | **PARTIALLY FIXED** | Scene traverse now gated by `modal !== this.uiModal` (only on change). `getObjectByName('experience-xr')` still runs per-frame |
| **M-3** Raw-note Y drift fights grab | **FIXED** | `if (entity.hasComponent(Grabbed)) { continue; }` added before drift code |
| **M-7** Clear undone by pending debounced save | **FIXED** | `clearPalace()` now cancels `saveTimer` |
| **M-20** Per-frame `Array.from()` allocation | **FIXED** | `_spawnScratch` reusable array replaces `Array.from(this.queries.spawning.entities)` |
| **M-21** Font load blocks boot with no timeout | **FIXED** | `Promise.race([loadLociFont(), new Promise(r => setTimeout(r, 3000))]` |

## NEW ITEMS ADDED (from implementation guide)

- **PWA manifest** (`public/manifest.json`, icons) — installability
- **High-contrast toggle** (`#contrast-btn`) — accessibility
- **Vultr Serverless Inference** — always-on AI, no cold starts

## BUGS INTRODUCED BY FIXES (2 — must fix before submission)

### BUG-1: Trail particles silently broken
`snap-system.ts:165` — `spawnTrailParticle()` returns a particle but the return value is discarded. It's never pushed to `trailParticles[]`. The ring buffer exists but nothing ever enters it. The organize snap animation has **no trail effect at all** now.

**Fix:** Change line 165 to:
```ts
trailParticles.push(spawnTrailParticle(object.position.x, object.position.y, object.position.z));
```
Also cap at `TRAIL_BUFFER_SIZE` so it doesn't grow unbounded:
```ts
if (trailParticles.length < TRAIL_BUFFER_SIZE) {
  trailParticles.push(spawnTrailParticle(...));
}
```
Remove unused `trailWriteIdx` (line 51).

### BUG-2: Vultr API key hardcoded in public GitHub repo
`model-client.ts:35` — `VULTR_KEY = 'GHLQ6JMVJXDO5EO3WGKLPFAVOV3W6YJFGXUQ'` is committed in plaintext. Anyone can see and use this key. Vultr charges per request.

**Fix:** Move to environment variable:
```ts
const VULTR_KEY = import.meta.env.VITE_VULTR_KEY ?? '';
```
Add to `.env` (gitignored): `VITE_VULTR_KEY=GHLQ6JMVJXDO5EO3WGKLPFAVOV3W6YJFGXUQ`
**Immediately rotate this key on Vultr** — the old one is in git history.

## STILL OPEN (should fix for submission)

| Priority | Finding | Effort | Impact |
|----------|---------|--------|--------|
| **HIGH** | **H-2** Spaced repetition has no spacing (no timestamps) | ~30 min | "Come back tomorrow" is a lie — strength never decays |
| **HIGH** | **H-5** Mode switch reloads page, ends VR session | ~45 min | Judges switching modes in headset get ejected |
| **HIGH** | **H-7** Organize ignores state changes during model call | ~20 min | Snaps notes user grabbed during the 30s AI call |
| **MED** | **M-2** Stale cluster indices → wrong quiz answers | ~15 min | Quiz shows wrong "correct" answer after re-organize |
| **MED** | **M-4** Reduced-motion users get permanent glow | ~10 min | Accessibility issue |
| **MED** | **M-10** Distress gate has gaps (curly quotes, missing phrases) | ~15 min | Safety-critical for competition narrative |
| **MED** | **M-13** Per-label canvas waste, high draw-call count | ~1 hr | Quest performance with 50+ notes |
| **MED** | **M-14** Keyboard rebuilds 45 keys every open | ~20 min | VR hitch on keyboard open |
| **MED** | **M-17** Audio never pauses on headset remove | ~15 min | Meta store policy violation |
| **LOW** | **L-2** Dead code (unused imports, unreachable branches) | ~15 min | Clean submission |
| **LOW** | **L-10** CSS font URL bundles duplicate 876KB font | ~2 min | Bundle size |

## REMAINING UNUSED IMPORT

`note-factory.ts:22` still imports `OneHandGrabbable` — no longer used anywhere. Remove it.

## SUBMISSION READINESS CHECKLIST

- [x] Distance grab works in VR (C-1)
- [x] Trail particles ring buffer (C-2 structure) — **but particles aren't spawning (BUG-1)**
- [x] Privacy: no more personal Ollama endpoint (C-3)
- [ ] **API key not exposed** (BUG-2 — must fix)
- [x] Recall cancel fixed (H-1)
- [x] Storage sanitization (H-3)
- [x] Rewind save guard (H-4)
- [ ] Spaced repetition actually spaces (H-2) — or soften the "come back tomorrow" copy
- [ ] Mode switch doesn't eject from VR (H-5) — or hide mode buttons in XR
- [x] PWA manifest + icons
- [x] High-contrast toggle
- [ ] Distress gate curly-apostrophe fix (M-10)
- [ ] Audio pause on headset remove (M-17)
- [x] README rewrite
- [ ] Demo video (not started)
- [ ] Submission form/materials (not started)
