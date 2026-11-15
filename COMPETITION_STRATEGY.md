# Loci — Competition Strategy & Technical Architecture

Meta VR Start Developer Competition 2026. Track: **Productivity** ·
Division: **New Experience**. One entry, judged on four equally weighted
criteria (Innovation & Creativity, Experience Design, Technical
Implementation, Polish & Presentation) and eligible for the special awards
below.

Each category documents: what the judges reward, how Loci is built for it
(with implementation references), the full system flow, and its diagram.
All listed features are **implemented and shipped** — verified on the built
app at `https://139-84-174-127.sslip.io`.

---

## Table of Contents

- [1. Best New Productivity Experience](#1-best-new-productivity-experience)
- [2. Best Agentic Interaction](#2-best-agentic-interaction)
- [3. Best First Five Minutes](#3-best-first-five-minutes)
- [4. Best Reason to Come Back](#4-best-reason-to-come-back)
- [5. Best Accessibility Forward Experience](#5-best-accessibility-forward-experience)
- [6. Boldest Original Concept](#6-boldest-original-concept)
- [7. Judge's Choice](#7-judges-choice)
- [8. Documented Limits](#8-documented-limits)

---

## 1. Best New Productivity Experience

**What the category rewards:** tools designed around a recurring daily
moment — task management, creative tools, habits tied to a recurring
context. Hands-first implementation required.

**How Loci covers it:** the entire experience is a recurring ritual — dump
scattered thoughts, watch Sage snap them into a constellation, arrange by
hand, return the next day for Recall. Not a task list ported to VR: a
thinking environment designed around how memory actually works (method of
loci, spaced repetition).

**Implementation:** capture pipeline (`capture-system.ts` — typed, voice,
spatial keyboard, seed sets) · model-first organize with instant fallback
(`organize-system.ts`, `model-client.ts`, `clusterer.ts`) · snap with
particle trails (`snap-system.ts`) · hand arranging (`mouse-drag-system.ts`,
`DistanceGrabbable`) · persistence + export (`palace-store.ts`).

### System flow — full pipeline

```mermaid
flowchart TB
  subgraph BOOT["App Bootstrap"]
    B1["Font preload (Inter OFL)"] --> B2["World.create — IWSDK runtime"]
    B2 --> B3["Register 12 systems on globals bus"]
    B3 --> B4["initStatus3D — in-scene status line"]
    B4 --> B5["warmupModel — preload Vultr inference"]
    B5 --> B6["Splash fade → startHealthIndicator (30s pill)"]
  end

  subgraph CAPTURE["Capture Layer — 4 equal paths"]
    direction LR
    C1["Typed input — Enter key"] --> C4
    C2["Mic orb — Web Speech API"] --> C4
    C3["Seed cards — curated 5-note sets"] --> C4
    C4["spawnRaw → distress gate → SpawnAnimation component"]
  end

  subgraph ORGANIZE["Organize Pipeline — dual-intelligence arbitration"]
    direction TB
    D1["capture-system: scheduleAutoOrganize 2.2s"] --> D2["organize-system: organize()"]
    D2 --> D3["clusterer.ts: deterministic heuristic — instant"]
    D2 --> D4["model-client.ts: POST /chat/completions → qwen3.8-flash-next"]
    D4 --> D5{"coverage ≥ 60%?"}
    D5 -- "yes" --> D6["use model result — orb GOLD"]
    D5 -- "no / timeout / error" --> D7["use heuristic — orb GRAY"]
    D6 --> D8["applyResult: declump → labels → edges → buds"]
    D7 --> D8
    D8 --> D9["schedulePalaceSave 1.8s"]
  end

  subgraph SNAP["Snap Animation"]
    S1["SnapAnimation component: eased arcs"] --> S2["particle trails (additive blending)"]
    S2 --> S3["connection lines draw in"]
    S3 --> S4["chord resolves (WebAudio)"]
  end

  subgraph ARRANGE["Human Authority Layer"]
    A1["DistanceGrabbable (VR ray grab)"] --> A2["MouseDragSystem (desktop drag)"]
    A2 --> A3["GrabWatchSystem: userPlaced = true on release"]
  end

  subgraph PERSIST["Palace Store — loci.palace.v1"]
    P1["notes[] · edges[] · clusterLabels[]"]
    P2["recall: {id: {strength 0-5, seen}}"]
    P3["history: ≤30 snapshots"]
    P4["beforeunload flush · JSON export"]
  end

  BOOT --> CAPTURE
  CAPTURE --> ORGANIZE
  ORGANIZE --> SNAP
  SNAP --> ARRANGE
  ARRANGE --> PERSIST
```

### Return-visit loop

```mermaid
sequenceDiagram
  participant U as User (Quest / desktop)
  participant App as Loci runtime
  participant Store as Palace localStorage
  participant Sage as Sage (qwen3.8-flash-next)
  U->>App: open the link
  App->>Store: loadPalace() — restore notes, clusters, strengths
  App-->>U: welcome back — last here 3 hr ago, 4 thoughts due
  U->>App: dump 3 more thoughts (voice)
  App->>Sage: schema-bound organize (existing notes + 3 new)
  Sage-->>App: declumped cluster layout
  App-->>U: snap — all 8 cards reorganize
  U->>App: Recall quiz — weakest 2 first
  App-->>U: correct: strength+1 — miss: reset to 0
  App->>Store: writePalaceSave — strengths + layout + snapshot
```

---

## 2. Best Agentic Interaction

**What the category rewards:** AI as a core part of the experience —
context-aware assistance, autonomous analysis, transparent agent behavior.

**How Loci covers it:**

- Sage is a schema-constrained model call (qwen3.8-flash-next via Vultr) — clusters,
  cross-cluster edges, and expand/challenge suggestions
- **Model-exclusive evidence:** suggestion buds can only come from the model
  (the fallback organizer has no suggestions field), so every bud on screen
  is visible proof of agency
- **The gold/gray orb** records which intelligence organized the current
  layout — gold = model, gray = local fallback
- **Retry-then-fallback:** heuristic result is held ready before the request;
  the model must cover ≥60% of notes to win — the product never stumbles
- **Voice answering** in Recall (`answerByVoice()`)

**Implementation:** `model-client.ts` (schema + retry + sanitization),
`organize-system.ts` (`applyBest`, `tintOrb`), `recall-system.ts`
(`answerByVoice`).

### Dual-path arbitration — full sequence

```mermaid
sequenceDiagram
  participant P as Player
  participant OS as OrganizeSystem
  participant HB as Heuristic (clusterer.ts)
  participant MC as ModelClient
  participant OLL as Vultr qwen3.8-flash-next
  participant ST as PalaceStore

  P->>OS: dump 5 thoughts (any capture path)
  OS->>HB: organize() — token overlap + union-find — instant
  HB-->>OS: heuristic result (held ready)
  OS->>MC: organizeWithModel(notes[])
  MC->>OLL: POST /chat/completions { format: JSON_schema, temp: 0.2 }

  alt model answers — covers ≥ 60%
    OLL-->>MC: clusters + edges + suggestions
    MC->>MC: sanitize — unknown ids dropped, leftovers → "Loose threads"
    MC-->>OS: validated ModelOrganizeResult
    OS->>P: SNAP — orb GOLD — suggestion buds appear
    OS->>ST: schedulePalaceSave 1800ms
  else model fails or times out (30s)
    OS->>P: SNAP with heuristic result — orb GRAY
    Note over OS: product never stumbles — same experience
  end

  P->>OS: grabs one card by pinch
  Note over OS: GrabWatchSystem: userPlaced = true — agent never reorganizes
  OS->>ST: schedulePalaceSave — placement recorded
```

### Agentic decision tree

```mermaid
flowchart TD
  START["Organize triggered — orb press / auto / voice"] --> GUARD{"recallActive?
  rewindActive?
  crisActive?
  thinking?"}
  GUARD -- "any true" --> SKIP["return — blocked"]
  GUARD -- "all clear" --> COLLECT["collect movable notes
  (userPlaced excluded)"]
  COLLECT --> HEUR["Heuristic: token overlap coefficient
  + union-find — MERGE 0.2, MAX_EDGES 6"]
  COLLECT --> MODEL["ModelClient: POST /chat/completions
  format: JSON schema · retry ×1"]
  MODEL --> VALIDATE{"JSON parses?
  clusters non-empty?"}
  VALIDATE -- "no" --> USE_H
  VALIDATE -- "yes" --> SANITIZE["drop unknown ids · sweep leftovers"]
  SANITIZE --> COVERAGE{"covers ≥ 60%?"}
  COVERAGE -- "yes" --> TINT_GOLD["tintOrb GOLD · suggestions → buds"]
  COVERAGE -- "no" --> USE_H
  USE_H["use heuristic result · tintOrb GRAY"]
  TINT_GOLD --> APPLY
  USE_H --> APPLY
  APPLY["applyResult: declump 5-pass → flights → lines → labels → save"]
```

---

## 3. Best First Five Minutes

**What the category rewards:** how fast the experience explains itself,
teaches interaction without a wall of text, and delivers a payoff.

**How Loci covers it:** narrative intro (four phases, not a tutorial),
first capture within one touch of landing, auto-organize 2.2 s after
capture, snap completes in under a second locally (6–11 s with Sage warm,
covered by the thinking beat). Measured on the built app: boot to
interactive **1.5 s**, recall panel open **1.1 s**.

**Implementation:** `experience-system.ts` (spatial intro), `capture-system.ts`
(seed sets + auto-organize), `recall-system.ts` (quiz panel), `layout.ts`
(declump so nothing overlaps).

### Timed opening sequence

```mermaid
flowchart LR
  A["0.0s: open the link"] --> B["1.5s: interactive — guide + orbs + seeds"]
  B --> C["First touch: seed card spills 5 thoughts"]
  C --> D["2.2s: auto-organize fires"]
  D --> E["THE SNAP — payoff before minute two"]
  E --> F["Grab a card — zero instructions"]
  F --> G["Violet orb — quiz opens in 1.1s"]
```

### Discovery mechanics

```mermaid
flowchart TD
  subgraph FIRST_LAUNCH["First launch — palace empty"]
    FL1["ExperienceSystem: 4-phase spatial intro"] --> FL2
    FL2["AmbientSystem: type + mic orbs pulse
    warm glow for 8 seconds"] --> FL3["Seed cards visible with labels"]
  end
  subgraph RETURNING["Returning visit — palace restored"]
    R1["restorePalace: notes + clusters + greeting"] --> R2["health pill: N notes · M due"]
  end
  FIRST_LAUNCH -->|"first interaction"| RETURNING
```

---

## 4. Best Reason to Come Back

**What the category rewards:** visible growth between sessions and a loop
that pulls the user back tomorrow.

**How Loci covers it:** per-note memory strength (0–5) persisted in the
palace; Recall serves the weakest first; misses resurface first — the
schedule is built from performance, not guilt. The palace itself grows, and
Rewind scrubs that growth backward through physical space.

**Implementation:** `palace-store.ts` (`RecallState`, 30-snapshot history),
`recall-system.ts` (`pickOrder`, grading), `rewind-system.ts` (spatial dial).

### Cross-session retention loop

```mermaid
sequenceDiagram
  participant U as You
  participant L as Loci
  participant K as Palace storage
  Note over U,K: Session N — dump, organize, arrange
  U->>L: close the app
  Note over U,K: time passes — nothing nags
  U->>L: reopen
  L-->>U: welcome back — N thoughts due for Recall
  L->>U: Recall quiz — weakest notes first
  U->>L: answer by touch or voice
  alt correct
    L-->>U: strength +1 — returns less often
  else miss
    L-->>U: strength reset — resurfaces first
  end
  L->>K: strengths saved — next visit scheduled
```

### Retention state machine

```mermaid
stateDiagram-v2
  [*] --> NeverSeen: note created
  NeverSeen --> Due: first Recall session
  Due --> Strong: correct answer (strength +1)
  Due --> Weak: wrong answer (strength = 0)
  Strong --> Stronger: correct again (up to 5)
  Stronger --> Weak: miss (reset to 0)
  Weak --> Due: next session — pickOrder sorts weakest first
```

---

## 5. Best Accessibility Forward Experience

**What the category rewards:** voice alternatives for hands, high-contrast
modes, or experiences inclusive by default.

**How Loci covers it:**

- **Colorblind-safe palette — verified, not claimed:** the six accents were
  searched under Viénot deutan/protan/tritan simulation (worst pair
  distance 72.2; the original palette collapsed to 1.4 under protanopia)
- **Text scaling, live:** the Aa orb cycles 100/125/150% across every label
  in the scene
- **Reduced motion respected:** animations skip when the OS asks
- **Voice alternative to hands:** mic orb + spoken quiz answers
- **Hands alternative to voice:** spatial keyboard — works everywhere,
  including Quest browsers (which lack speech recognition — documented)
- **Safety that reaches everyone:** the crisis panel pairs its message with
  a calm audio tone
- **High-contrast mode:** HC button switches HUD and overlays to
  pure black/white
- **One hand, seated:** all affordances within a two-foot arc, no locomotion

**Implementation:** `palette.ts` (verified accents), `media-queries.ts`
(reduced motion), `speech.ts` + `capture-keyboard.ts` (voice/typed),
`crisis-panel.ts` (calm tone), `styles.css` (HC styles).

### Accessibility input/output matrix

```mermaid
flowchart LR
  subgraph INPUTS["Input — every channel works alone"]
    I1["Voice: mic orb (desktop)"]
    I2["Hands: pinch-grab (Quest)"]
    I3["Typed: type orb → spatial keyboard"]
    I4["One finger: seed cards + orbs"]
    I5["Mouse: drag + click (desktop)"]
  end
  INPUTS --> GATE["Distress gate → Organize pipeline"]
  GATE --> OUTPUTS
  subgraph OUTPUTS["Output — every signal redundant"]
    O1["Color: CVD-verified palette"]
    O2["Glyphs: + and ? marks on buds"]
    O3["Audio: chord, ping, calm tone"]
    O4["Text scale: Aa orb 100-150%"]
    O5["HC mode: pure black/white"]
  end
  OUTPUTS --> USER["Same experience regardless of
  which channel or ability"]
```

---

## 6. Boldest Original Concept

**What the category rewards:** an idea whose core loop depends on presence,
spatial depth, or hands — one that would fall apart on any other platform.

**The claim, drawn:**

```mermaid
flowchart LR
  subgraph FLAT["On a flat screen — what every rival is"]
    direction LR
    N1["Notes app
    = a list"] --> N2["Anki
    = a schedule"]
    N2 --> N3["Mind map
    = a diagram"]
    N3 --> N4["History
    = a changelog"]
  end
  subgraph VR["Loci in VR — what only presence enables"]
    direction LR
    L1["Thoughts have a PLACE
    around you in 3D"] --> L2["Understanding is PHYSICAL:
    grab and move meaning"]
    L2 --> L3["Memory has a ROOM:
    the palace persists and grows"]
    L3 --> L4["History has a DIAL:
    scrub your mind's past"]
  end
  FLAT -.->|"no presence · no depth · no body"| VR
```

The method of loci is a 2,000-year-old memory technique that always needed
an imagined place. VR is the first medium where the place is real — and the
Rewind dial (scrubbing your own mind's history through physical space) is
the beat no flat screen can imitate.

---

## 7. Judge's Choice

The wildcard. Loci's angle: genuine cognitive science (method of loci,
spaced repetition), ethical AI (distress gate, transparent gold/gray agent
status), and craft (zero-asset synthesized audio, canvas-rendered type,
hand-built Three.js). No specific changes — polish is the vehicle.

---

## 8. Documented Limits

| Limit | Why it's accepted |
| --- | --- |
| Voice capture desktop-only | Quest browsers have no Web Speech API; the spatial keyboard is the equal path there |
| Streaks rejected | Conflicts with the no-guilt design principle — Recall scheduling does the work instead |
| Web companion not deployed | Repo-only context for now; the Quest app is the submission |
| Foveation 0.8 | Peripheral softness is the performance trade for 72fps |
