# Loci — Technical Implementation Guide

What's already built (with exact file/function references), what needs adding (with code), and how each maps to competition categories. Read this, implement the gaps, commit.

---

## 1. Best New Productivity Experience ($70K) — Primary Target

### Already Implemented

**Full cognitive loop: Capture → Organize → Arrange → Recall → Rewind → Persist.**

**Capture pipeline** — `src/loci/capture-system.ts`
- `spawnRaw(text)` (line 279): Trims input, runs distress gate (`checkDistress`), creates note entity via `createNote()`, plays spawn tone
- Three input paths: text input (DOM `#note-input`), voice (Web Speech API via `speech.ts`), spatial keyboard (`capture-keyboard.ts`)
- `scheduleAutoOrganize()` (line 269): After capture, waits 2200ms then triggers organize automatically — user doesn't have to manually hit Organize every time
- `setupBrowserHud()` (line 315): Wires all DOM buttons (Add, Organize, Recall, Rewind, Help, Voice, Clear, Export) with cleanup

**AI-powered organize** — `src/loci/organize-system.ts`
- `organize()` (line 73): Guards against modal conflicts, collects movable notes, runs heuristic instantly, then fires AI async
- `applyBest()` (line 102): Calls `organizeWithModel()` from `model-client.ts`, checks if AI covers ≥60% of notes. If yes, uses AI result. If not (or if AI fails), uses heuristic fallback
- `applyResult()` (line 166): 5-pass declumping relaxation (lines 200+), creates cluster labels, connection lines, suggestion buds, schedules palace save after snap animations complete
- Heuristic fallback — `src/loci/clusterer.ts`: Token overlap coefficient + greedy union-find. Stopword filtering, naive stemming. MERGE_THRESHOLD=0.2, MAX_EDGES=6

**Spatial arrangement** — `src/loci/layout.ts`
- `clusterCenter()`: Arc placement (spread 20-64° based on count, radius 1.40m, alternating Y offset)
- `noteOffset()`: Centered grid within cluster (SPACING_X=0.29, SPACING_Y=0.19)
- Manual drag: `mouse-drag-system.ts` (desktop), `OneHandGrabbable` (VR)
- `GrabWatchSystem` in `snap-system.ts`: Marks user-placed notes so Sage never overwrites them

**Spaced-repetition recall** — `src/loci/recall-system.ts` (630 lines)
- Two question types: Type A (cluster membership — "which thread did this join?"), Type B (association — "which thought was closest?")
- Strength tracking: 0-5 scale, +1 correct, reset to 0 on wrong
- Voice answering via Web Speech API with word overlap scoring
- MAX_QUESTIONS=5 per session

**Rewind history** — `src/loci/rewind-system.ts`
- Spatial dial at (0, 0.68, -0.95) with grabbable knob on a track
- Scrubs through up to 30 saved snapshots
- `apply(index)`: O(1) lookup via `savedById` Map, animates notes to historical positions via SnapAnimation

**Palace persistence** — `src/loci/palace-store.ts`
- `writePalaceSave()` (line 136): Synchronous write for beforeunload. Saves notes, edges, labels, recall state, appends history snapshot (capped at 30)
- `schedulePalaceSave()` (line 197): Debounced (600ms min) autosave
- Session cache (`cachedDoc`) invalidated on write and cross-tab `storage` event
- Mode-specific storage keys: `loci.palace.v1`, `loci.palace.v1.grow`, `loci.palace.v1.imagine`
- QuotaExceededError graceful handling (line 184)
- Export as JSON download via `exportPalace()` (line 111)

**Three cognitive modes** — `src/loci/modes.ts`
- Think (◇), Grow (+), Imagine (✧) with mode-specific seed sets
- Stored in `localStorage('loci.quest.mode')`, mode switch triggers page reload
- Each mode has its own palace storage key so thoughts don't mix

### What to Add

**PWA manifest + service worker** — Required for Quest home screen install.

Create `public/manifest.json`:
```json
{
  "name": "Loci — Spatial Memory Palace",
  "short_name": "Loci",
  "description": "Capture, organize, and recall your thoughts in an immersive memory palace.",
  "start_url": "/",
  "display": "standalone",
  "orientation": "landscape",
  "background_color": "#0a0e1a",
  "theme_color": "#182335",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "categories": ["productivity", "education"]
}
```

Add to `index.html` `<head>`:
```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#182335">
```

Create `public/sw.js` (minimal cache-first):
```js
const CACHE = 'loci-v1';
const PRECACHE = ['/', '/src/index.ts'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE))));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
```

Register in `src/index.ts` after boot:
```typescript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
```

Generate icons: Use any tool to create 192x192 and 512x512 PNG icons with the Loci ✧ symbol on dark background (#0a0e1a). Place in `public/icons/`.

---

## 2. Best Agentic Interaction ($25K) — Strong Target

### Already Implemented

**Sage AI agent** — `src/loci/model-client.ts` (308 lines)
- `organizeWithModel(notes)`: Sends notes to AI with structured system prompt, parses response, validates note IDs, sweeps leftovers into "Loose threads"
- `resolveModel()`: Discovers available model on Ollama (prefers qwen3:14b)
- `warmupModel()`: Pre-loads model into VRAM at boot for fast first organize
- Retry logic: One retry with 1500ms delay on first failure
- SYSTEM_PROMPT instructs Sage to: cluster into 2-4 groups, label with 1-2 words, draw up to 4 cross-cluster edges, offer up to 2 suggestions (expand/challenge)

**Transparent agent feedback** — `src/loci/organize-system.ts`
- `tintOrb()` (line 129): Orb glows gold (`SEMANTIC.sage = 0xe8b879`) after real AI organize, gray (`SEMANTIC.muted = 0x8a93a8`) after heuristic fallback
- Status messages: "Sage organized your thoughts." vs "Sage couldn't reach the model — organized locally instead."

**Suggestion buds** — `src/loci/note-factory.ts`
- `createSuggestionBud()`: Small orbs near notes with hover-reveal text bubbles
- Two kinds: "expand" (green, offers to deepen a thin note) and "challenge" (amber, questions a weak/contradictory note)
- Created by `OrganizeSystem.applyResult()` when AI returns suggestions

**Heuristic fallback** — `src/loci/clusterer.ts`
- Runs instantly (synchronous), covers AI failures transparently
- Token overlap with Jaccard coefficient, greedy union-find clustering
- Labels derived from longest shared tokens

### What to Add

**"Sage is thinking..." visible status during AI call.**

In `src/loci/organize-system.ts`, the status is already set at line 96:
```typescript
this.setStatus('Sage is reading your thoughts…');
```

But there's no visual animation on the orb during the thinking phase. Add a pulsing glow to the organize orb while `this.thinking` is true.

Add to `OrganizeSystem.update()` (currently just does trash cleanup):
```typescript
update(): void {
  // Deferred disposal (existing code)
  if (this.trash.length > 0) {
    const doomed = this.trash;
    this.trash = [];
    for (const entity of doomed) {
      try {
        if (entity.object3D != null) {
          disposeLabelTextures(entity.object3D);
          entity.object3D.removeFromParent();
        }
      } catch {}
      try { entity.dispose(); } catch {}
    }
  }

  // NEW: Thinking pulse on organize orb
  if (this.thinking) {
    const orb = this.queries.orbs.entities.values().next().value;
    const card = orb?.object3D?.getObjectByName('card') as Mesh | undefined;
    if (card != null) {
      const mat = card.material as MeshStandardMaterial;
      const t = performance.now() * 0.003;
      mat.emissiveIntensity = 0.06 + Math.sin(t) * 0.06;
    }
  }
}
```

This makes the orb visually pulse while Sage is working — judges see the agent is actively processing.

**Proactive recall suggestion.** When returning users have ≥3 notes due for recall, Sage should suggest starting a recall quiz. This is already partially done — `restorePalace()` in `capture-system.ts` (line 242-251) shows "X thoughts due for Recall" on return. To make it more agentic, add a timed prompt 10 seconds after restore:

```typescript
// In restorePalace(), after the welcome-back status (line 251):
if (due >= 3) {
  setTimeout(() => {
    setAppStatus(`Sage suggests: ${due} thoughts are fading — try a quick Recall.`);
  }, 10000);
}
```

---

## 3. Best First Five Minutes ($25K) — Strong Target

### Already Implemented

**4-phase narrative intro** — `src/loci/experience-system.ts`
- `openIntro()` builds a spatial panel at (0, 1.55, -1.15) with animated phases:
  - Phase 0: "Let it all out" — floating example thought cards appear
  - Phase 1: "Find the threads" — cards animate into clusters, connection lines draw between them
  - Phase 2: "Scattered thoughts..." — title with Sage reference
  - Phase 3: "Your palace is waiting" — dismiss button, transition to live app
- Each phase timed with smooth transitions, reduced-motion support
- `markOnboarded()` called on dismiss, `shouldOnboard()` checked on boot

**First-launch discovery pulse** — `src/loci/ambient-system.ts` (line 249-270)
- For 8 seconds after first launch, type and mic orbs pulse with warm color-cycling glow
- `loci.firstLaunch` flag set true initially, cleared after 8s or if palace has saved data
- Guides users to their first interaction without a tutorial overlay

**Seed cards for instant demo** — `src/loci/capture-system.ts` (line 38-68)
- Three seed sets visible at (-0.74, varied Y, -1.50): Exam, Grow, Kingdom
- One click dumps 5 themed notes, triggers auto-organize after 2200ms
- User sees full capture → organize → connections flow within 30 seconds

**Welcome-back status** — `src/loci/capture-system.ts` (line 240-251)
- `restorePalace()` shows "Welcome back — last here X ago. Y thoughts due for Recall."
- Palace rebuilds instantly from localStorage (skipSpawn: true for restored notes)

### What to Add

**Auto-demo on first launch.** If user hasn't interacted after 15 seconds on first launch, auto-dump one seed set so they see the magic without having to discover the seed cards:

```typescript
// In CaptureSystem.init(), after restorePalace() — only for first launch:
if (getLoci(this.globals).firstLaunch) {
  setTimeout(() => {
    const loci = getLoci(this.globals);
    if (loci.noteById.size === 0 && !loci.introActive) {
      this.dumpSeed('exam');
    }
  }, 15000);
}
```

---

## 4. Best Reason to Come Back ($25K) — Strong Target

### Already Implemented

**Spaced-repetition recall** creates natural return cadence — notes decay in strength, health indicator shows "X due for review." Full quiz system with voice answering.

**Palace persistence** — data survives browser close, grows over sessions.

**Welcome-back message** — already shows "Welcome back — last here X ago. Y thoughts due for Recall." (capture-system.ts line 248).

**Three modes** give variety — switch between Think/Grow/Imagine for different cognitive needs.

**Rewind** — revisit your thinking history, see how your palace evolved.

**Health indicator** — `src/loci/palace-health.ts` (line 14-57)
- DOM pill at `#palace-health`, refreshes every 30s
- Shows total notes and due-for-review count
- Visible at a glance whether you need to come back

### What to Add

**Streak tracking.** Track consecutive days the user opened their palace:

In `palace-store.ts`, add to `SavedPalace` interface:
```typescript
export interface SavedPalace {
  // ... existing fields
  streakDays?: number;
  lastVisitDate?: string; // YYYY-MM-DD
}
```

In `capture-system.ts` `restorePalace()`, after loading saved data:
```typescript
const today = new Date().toISOString().slice(0, 10);
const lastVisit = saved.lastVisitDate;
if (lastVisit) {
  const daysBetween = Math.floor((Date.now() - new Date(lastVisit).getTime()) / 86400000);
  if (daysBetween === 1) {
    saved.streakDays = (saved.streakDays ?? 1) + 1;
  } else if (daysBetween > 1) {
    saved.streakDays = 1;
  }
}
saved.lastVisitDate = today;
// Save immediately to record today's visit
writePalaceSave(loci);
```

Show streak in welcome-back: `"Welcome back — ${saved.streakDays}-day streak! X thoughts due."`.

---

## 5. Best Accessibility Forward ($25K) — Strong Target

### Already Implemented

**Colorblind-safe palette** — `src/loci/palette.ts` (line 43-51)
- 6 cluster accents verified under deuteranopia, protanopia, and tritanopia simulation
- Minimum pairwise perceptual distance 72 (threshold for distinct: ~60)
- Luminance stagger does heavy lifting for red-green blindness
- `accentForHue()` (line 54): Maps stored hue values to nearest curated accent using circular hue distance

**Text scaling** — `src/loci/text-label.ts`
- 3 sizes: 100% → 125% → 150%, cycled via text-scale orb
- `getTextScale()` / `setTextScale()`: Global scale applied to all labels
- Live scene traversal updates existing labels immediately (capture-system.ts line 134)
- New labels pick up current scale at creation

**Prefers-reduced-motion** — `src/loci/media-queries.ts`
- Cached `MediaQueryList` checked in hot paths
- `AmbientSystem.update()`: Skips starfield rotation, note drift when enabled
- `SnapSystem.update()`: Animations jump to final state (t=1)
- `ExperienceSystem`: Intro skips to final phase

**Voice-first capture** — `src/loci/speech.ts`
- Web Speech API with webkit prefix detection
- `createRecognizer()`: Uses `navigator.language` default, continuous mode
- Primary input path — no typing required

**Webcam hand tracking** — `src/loci/webcam-hand-system.ts`
- MediaPipe HandLandmarker with deferred camera prompt (privacy-respecting)
- Self-hosted WASM + model files (no CDN dependency)
- Pinch gesture with hysteresis (PINCH_THRESHOLD=0.055, PINCH_RELEASE=0.078)
- Synthetic PointerEvents bridge webcam to existing interaction system

**Spatial keyboard** — `src/loci/capture-keyboard.ts`
- Full QWERTY for Quest (no browser speech recognition on Quest)
- Gaze/pinch input, 120-char buffer

**Crisis resources** — `src/loci/crisis-panel.ts`
- Real helpline numbers (988, findahelpline.com)
- Blocks all other modals while open
- Calm tone accompaniment

### What to Add

**High-contrast mode toggle.**

Add a button in the header and a body class:
```html
<!-- In index.html, inside .header-tools -->
<button id="contrast-toggle" title="High contrast">HC</button>
```

In `src/styles.css`:
```css
body.high-contrast #scene-container { filter: contrast(1.4) saturate(0.8); }
body.high-contrast .loci-header,
body.high-contrast .loci-bottom { background: #000; border-color: #fff; }
body.high-contrast button { border: 2px solid #fff !important; }
```

Wire in `capture-system.ts` `setupBrowserHud()`:
```typescript
const contrastBtn = document.getElementById('contrast-toggle');
const toggleContrast = () => {
  document.body.classList.toggle('high-contrast');
  contrastBtn?.setAttribute('aria-pressed',
    String(document.body.classList.contains('high-contrast')));
};
contrastBtn?.addEventListener('click', toggleContrast);
this.cleanupFuncs.push(() => contrastBtn?.removeEventListener('click', toggleContrast));
```

---

## 6. Best Agentic Interaction — Sage Reasoning Labels

### What to Add

Make Sage's reasoning visible by showing WHY notes were grouped together. The AI already returns `relation` strings on edges. Display them on hover.

In `src/loci/note-factory.ts`, `createLine()` already creates connection line entities. The `ConnectionLine` component has `fromId` and `toId`. Add a relation label:

After line creation in `organize-system.ts` `applyResult()`, where edges are created:
```typescript
// Where edges are iterated (around line 220+):
for (const edge of result.edges ?? []) {
  createLine(this.world, edge.a, edge.b, delay);
  // NEW: If edge has a relation label, create a floating tag
  if ('relation' in edge && edge.relation) {
    const fromEntity = loci.noteById.get(edge.a);
    const toEntity = loci.noteById.get(edge.b);
    if (fromEntity?.object3D && toEntity?.object3D) {
      const mid = fromEntity.object3D.position.clone()
        .add(toEntity.object3D.position).multiplyScalar(0.5);
      mid.y += 0.06;
      const tag = createLabel(edge.relation, 0.012, SEMANTIC.hintText, 0.20);
      tag.position.copy(mid);
      tag.lookAt(mid.x, mid.y, 0.001);
      tag.name = 'edge-tag';
      this.world.createTransformEntity(tag);
    }
  }
}
```

---

## 7. Boldest Original Concept ($25K)

### Already Implemented — The Concept Itself

No code changes needed. The submission narrative should emphasize:
- Ancient method of loci (spatial memory technique used since 80 BC) meets modern AI
- VR is the natural medium for spatial memory — 2D apps can't do this
- Distress gate shows responsible innovation — the app handles real human vulnerability
- Three cognitive modes map to real learning theories (reflection, growth, creativity)
- Spaced repetition is backed by >100 years of memory research (Ebbinghaus)

---

## 8. Judge's Choice ($20K x2)

### What Makes Judges Notice

No specific code changes — this is about presentation. But these existing technical details are judge-worthy:

- **Zero runtime dependencies** beyond framework: No React, no UI library, no animation library. Everything is hand-built Three.js + WebAudio + Canvas
- **Synthesized audio**: Binaural beat at 55/55.5Hz creates ~0.5Hz beat frequency — research suggests this aids focus
- **Error boundary pattern**: One system crash never takes down the app (index.ts line 87-100)
- **Deterministic heuristic**: `clusterer.ts` gives identical results for identical input — no randomness in the fallback
- **Session cache with cross-tab invalidation**: `palace-store.ts` uses `storage` event listener so two tabs don't corrupt each other

---

## Implementation Priority Order

For the 5 days remaining (Nov 13-18):

| Priority | Task | Time | Category Impact |
|---|---|---|---|
| 1 | PWA manifest + icons | 1 hr | Productivity, Quest install |
| 2 | Thinking pulse on organize orb | 30 min | Agentic |
| 3 | Proactive recall suggestion | 30 min | Agentic, Come Back |
| 4 | High-contrast toggle | 1 hr | Accessibility |
| 5 | Edge relation labels | 1 hr | Agentic |
| 6 | Streak tracking | 1 hr | Come Back |
| 7 | Demo video recording | 2 hr | All categories |
| 8 | Submission write-up | 2 hr | All categories |

Total: ~9 hours of work to meaningfully strengthen 6 category positions.

---

## File Change Summary

| File | Change | New/Modified |
|---|---|---|
| `public/manifest.json` | PWA manifest | New |
| `public/sw.js` | Service worker | New |
| `public/icons/icon-192.png` | App icon | New |
| `public/icons/icon-512.png` | App icon | New |
| `index.html` | Add manifest link, theme-color meta | Modified |
| `src/index.ts` | Register service worker | Modified |
| `src/loci/organize-system.ts` | Thinking pulse in update(), edge relation labels | Modified |
| `src/loci/capture-system.ts` | Proactive recall suggestion, streak tracking, contrast toggle | Modified |
| `src/loci/palace-store.ts` | streakDays/lastVisitDate fields | Modified |
| `src/styles.css` | High-contrast mode styles | Modified |

No new systems, no new components, no architectural changes. All additions are localized to existing files.
