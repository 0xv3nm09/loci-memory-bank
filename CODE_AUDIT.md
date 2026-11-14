# Loci — Code Audit Report

**Date:** Nov 14, 2026 | **Scope:** All 34 .ts files (~6300 lines), index.html, styles.css, package.json, iwsdk.config.json

---

## CRITICAL (3 — demo-breaking)

**C-1. Notes and Rewind knob can't be grabbed in VR**
`note-factory.ts:144-148`, `rewind-system.ts:91-96` — `OneHandGrabbable` is proximity-based (squeeze/pinch near the object). Notes spawn at 1.2–1.4m radius and the Rewind knob sits at z=-0.95, y=0.68 — neither is within arm's reach of a seated player. The signature arrange-by-hand and Rewind features only work on desktop via `MouseDragSystem`. Judges on a Quest will find them dead.
**Fix:** Switch to `DistanceGrabbable` (`MovementMode.MoveAtSource` for the knob), keep `translateMin/Max` clamps, use `returnToOrigin: false`.

**C-2. Snap trail particles create a new Points object per particle per tick — never freed**
`snap-system.ts:61-88, 143-175` — `getOrCreateTrailCloud` only reuses a cloud whose `particles.length === 0`. Each push makes its cloud non-empty, so the next flight allocates another cloud (`BufferGeometry` + `PointsMaterial` + `Points` + `scene.add`). Clouds are never removed or disposed. With ~14 concurrent flights at 25Hz spawn rate, that's ~240 extra draw calls during the snap moment — the Quest frame-budget killer, and clouds stay in the scene forever.
**Fix:** Use one `Points` with a fixed ring buffer (256 particles), added once in `init()`, disposed in cleanup. Create via `createTransformEntity`, not `scene.add`.

**C-3. Private thoughts go to a third-party server with no consent; URL param redirects them anywhere**
`model-client.ts:34-54, 155-179, 300-307` — `DEFAULT_BASE` is a personal domain. Every note's text is POSTed there automatically (auto-organize fires 2.2s after capture). `warmupModel()` contacts it on every page load. `?ollama=<url>` overrides the endpoint — anyone who sends a crafted link captures every note the visitor types. For a thought journal aimed at distress-adjacent use, this is a privacy defect and competition risk.
**Fix:** Add explicit first-run opt-in, only honor override in `import.meta.env.DEV`, add CSP `connect-src` pinned to model host, skip `warmupModel()` until consent given.

---

## HIGH (7 — functional bugs & perf)

**H-1. Cancelling Recall during feedback window resurrects a dead panel**
`recall-system.ts:118-127, 293-304` — `cancel()`/`finish()` never reset `waitingFeedback` or `feedbackTimer`. If user presses End Recall after answering, `update()` later calls `nextQuestion()` which rebuilds an un-answerable quiz panel. Notes stay dimmed.
**Fix:** Set `this.waitingFeedback = false` in `cancel()` and `finish()`. Guard `nextQuestion()` with `if (!this.sessionActive) return`.

**H-2. Spaced repetition has no spacing**
`palace-store.ts:27-44`, `recall-system.ts:62-68, 544, 605-607` — `RecallRecord` has no timestamp or interval. After a single correct answer a note is never due again. The end card says "come back tomorrow" but strength never decays.
**Fix:** Add `lastSeen`/`dueAt` (Leitner intervals: 1, 2, 4, 8, 16 days by strength). Make `countDue` compare `dueAt <= now`.

**H-3. Corrupt localStorage blob bricks the app permanently**
`palace-store.ts:88-98`, `capture-system.ts:194-252`, `index.ts:58-136` — `loadPalace` validates only `version` and `Array.isArray(notes)`. Any missing/mistyped field throws during system init. `boot()` has no try/catch, so it rejects as an unhandled promise — splash stays up forever, repeats on every reload.
**Fix:** Sanitize in `loadPalace` (check types, clamp positions, default edges/recall/history). Wrap `restorePalace` in try/catch. On failure, move blob to `loci.palace.corrupt` and start empty. Wrap `boot()` in try/catch.

**H-4. Closing tab mid-Rewind saves scrubbed state as "now"**
`capture-system.ts:174-181`, `palace-store.ts:136-189`, `rewind-system.ts:200-238` — `beforeunload` flush calls `writePalaceSave` without checking `rewindActive`. Closing while scrubbed overwrites the palace with historical state.
**Fix:** Add `if (loci.rewindActive) return;` at top of `writePalaceSave`, or call `exit()` first.

**H-5. Mode switch calls `location.reload()`, ending any VR session**
`experience-system.ts:106`, `capture-system.ts:157-162` — Mode buttons reload the page, which ejects the user from immersive mode. With `offer: 'none'` they must re-enter manually.
**Fix:** Swap palaces in place (dispose entities, re-point storage key, call `restorePalace()`). Or hide mode buttons while in XR.

**H-6. ExperienceSystem does ~10 full-scene traversals per frame**
`experience-system.ts:204-237` — Each `update()` calls `scene.getObjectByName` 7+ times (depth-first walk of entire scene), builds template strings, calls `Object.keys(MODES)`, destructures every note in `noteById`, toggles `body.classList` every frame. Scales with note count, pure waste at Quest frame budgets.
**Fix:** Cache object references once after creation. Only touch DOM or visibility when modal/immersive actually changes.

**H-7. Organize ignores state changes during the model call**
`organize-system.ts:73-127` — All guards and `userPlaced` filter run before `await organizeWithModel()` (up to ~61s). When it resolves, `applyResult` snaps notes the user has since grabbed and does so under an open crisis panel/recall/rewind.
**Fix:** Re-check guards and each note's `userPlaced` inside `applyBest` before `applyResult`. Use `AbortController` so modal opening cancels the fetch.

---

## MEDIUM (24 items)

| # | Issue | File(s) | Fix |
|---|-------|---------|-----|
| M-1 | Auto-organize dropped during pending organize | capture-system:269, organize-system:75 | Set `pendingOrganize` flag, rerun after `thinking` clears |
| M-2 | Stale cluster indices → wrong quiz answers | organize-system:80, recall-system:351 | Reset cluster to -1 for excluded notes, skip Type A for mismatched |
| M-3 | Raw-note Y drift fights grab/drag | ambient-system:203-219 | Skip entities with `Grabbed` or being mouse-dragged |
| M-4 | Reduced-motion users get permanent glow | ambient-system:73, 92, 249 | Use real elapsed time for age check independent of time override |
| M-5 | Quota-exceeded save fails silently, poisons cache | palace-store:171-188 | Don't update caches until `setItem` succeeds, show status |
| M-6 | Export has no import path | palace-store:111, guide.ts | Add Import button, flush save before export, delay `revokeObjectURL` |
| M-7 | Clear can be undone by pending debounced save | capture-system:414, palace-store:127 | Cancel `saveTimer` in `clearPalace` |
| M-8 | History eviction makes Rewind useless | palace-store:171-179 | Only snapshot on organize/capture events, not every grab |
| M-9 | Multi-tab writes clobber each other | palace-store:71-76 | Reset `cachedHistory` in storage listener too |
| M-10 | Distress gate has gaps | distress-gate.ts:13-30 | Normalize curly apostrophes, add missed phrasings (kms, hang myself, etc.) |
| M-11 | Labels break at 150% text size | text-label.ts:189 | Scale font size (re-render) instead of mesh scale |
| M-12 | Unused `spatialUI` feature adds dead weight | iwsdk.config.json | Disable feature, drop `@pmndrs/uikit*` deps |
| M-13 | Per-label canvas waste & high draw-call count | text-label.ts:121, note-factory.ts:92 | Share measure canvas, cache geometry, use `MeshBasicMaterial` |
| M-14 | Keyboard builds 45 keys on every open (VR hitch) | capture-keyboard.ts:153-199 | Build once, toggle visibility |
| M-15 | Child entities may leak on parent dispose | capture-keyboard.ts:185, crisis-panel.ts:99 | Verify IWSDK child disposal behavior |
| M-16 | Webcam HandLandmarker never closed, stream leaks | webcam-hand-system.ts:195-236 | Close landmarker, stop stream on failure, fix pointerId 9999 throw |
| M-17 | Audio never pauses (headset removed, tab blurred) | audio.ts:243-386 | Subscribe to `visibilityState`, `ctx.suspend()` on blur/hidden |
| M-18 | Small text for VR (< 1° visual angle) | Various | Raise base font sizes or default text scale higher in XR |
| M-19 | Unverified internal API `world.systems` | index.ts:87 | Use public API or wrap boundary in try/catch |
| M-20 | Per-frame allocations in `update()` | ambient-system, experience-system, palette | Cache queries, skip dead `nebulaTint()` computation |
| M-21 | Font load blocks boot with no timeout | index.ts:29-33 | `Promise.race` with 2-3s timeout, consider woff2 subset |
| M-22 | `updateTargetFrameRate` rejection uncaught | index.ts:124-133 | Add `.catch(() => {})` |
| M-23 | Model retry doubles worst-case latency (~61s) | model-client.ts:300-307 | Cap total time with one `AbortSignal` (~20s), cap notes sent |
| M-24 | Heuristic creates too many clusters, labels overlap | clusterer.ts:142-146, layout.ts:37-48 | Merge singletons into "Loose threads", cap at ~6 clusters |

---

## LOW (14 items)

| # | Issue | Location |
|---|-------|----------|
| L-1 | Boot failure style has stray `;0;`, z-index behind splash | index.ts:48-50 |
| L-2 | Dead code: `createParticleBurst`, `panel.ts`, `GUIDE_TITLE`, `stopHealthIndicator`, `hideWelcome` no-op, unused `PARTICLE` import, unreachable `fauxBold=false` branches, duplicate `#export-btn`/`#clear-btn` handlers for buttons not in HTML | Various |
| L-3 | `tsconfig.json` lacks `noUnusedLocals`/`noUnusedParameters` | tsconfig.json |
| L-4 | `canCapture` ignores `keyboardActive` | interaction-state.ts:2 |
| L-5 | `stopVoice` resets placeholder to generic prompt | capture-system.ts:353 |
| L-6 | `innerHTML` with constants — safe today but fragile | capture-system.ts:476 |
| L-7 | Punctuation-only transcript selects arbitrary quiz option; `no-speech` error permanently disables voice | recall-system.ts:230-268 |
| L-8 | ECS style: entity refs held in arrays instead of tag queries, no `subscribe()` cleanup in `cleanupFuncs`, regex object name matching, shared geometry disposed with first user | Various |
| L-9 | Settled-note breathing overwrites hover-out lerp scale | ambient-system.ts:196-200 |
| L-10 | CSS font URL goes through `../public/` → Vite bundles duplicate 876KB font | styles.css:1 |
| L-11 | Missing `.js` extension in palace-health import; "notes" vs "thoughts" label inconsistency | palace-health.ts:7 |
| L-12 | `setPixelRatio(≥1.5)` costs low-DPI desktops | experience-system.ts:35 |
| L-13 | No CSP, `<noscript>`, or web manifest; ~21MB mediapipe ships in public/ | index.html |
| L-14 | Guide says "answer by touch or voice" but voice unavailable on Quest | guide.ts |

---

## Priority Order for Nov 18 Deadline

1. **C-1 + C-2** — Quest demo works and runs smoothly (distance grab + trail fix)
2. **C-3, H-3, H-1, H-4** — Privacy consent, storage hardening, recall cancel, rewind save (small, high-value)
3. **H-2** — Real spaced-repetition intervals or soften the "come back tomorrow" copy
4. **H-5, H-6** — Mode switch without reload, cache scene traversals (few lines each)
5. **H-7** — Abort organize on modal open
6. **M-3, M-4, M-13, M-17** — Grab drift fix, reduced-motion fix, draw-call reduction, audio pause

Run `tsc` and a Quest device/emulator pass to confirm C-1, C-2, and M-15 once dependencies are installed.
