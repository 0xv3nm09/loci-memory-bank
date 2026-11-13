# Loci — Competition Strategy & Category Coverage

Meta VR Start Developer Competition 2026. Track: **Productivity** ·
Division: **New Experience**. One entry, judged on four equally weighted
criteria (Innovation & Creativity, Experience Design, Technical
Implementation, Polish & Presentation) and eligible for the special awards
below.

Each category documents: what the judges reward, how Loci is built for it
(with implementation references), the on-camera flow, and its diagram. All
listed strengthening features are **implemented and shipped**.

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
`OneHandGrabbable`) · persistence + export (`palace-store.ts`).

**On-camera flow:**

```mermaid
flowchart LR
  A["Sit — the void greets you"] --> B["Dump thoughts (voice/type/seeds)"]
  B --> C["Tap organize — Sage clusters"]
  C --> D["THE SNAP"]
  D --> E["Grab and rearrange"]
  E --> F["Close — palace persists"]
  F --> G["Return — Recall reschedules"]
```

Detailed demo flow: [prizes/productivity-track.md](prizes/productivity-track.md)

---

## 2. Best Agentic Interaction

**What the category rewards:** AI as a core part of the experience —
context-aware assistance, autonomous analysis, transparent agent behavior.

**How Loci covers it:**

- Sage is a schema-constrained model call (qwen3:14b) — clusters,
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

**On-camera flow (including the resilience beat):**

```mermaid
sequenceDiagram
  participant P as Player
  participant C as Loci
  participant S as Sage
  participant HB as Heuristic fallback
  P->>C: dump thoughts
  C->>HB: instant local result (held ready)
  C->>S: schema-bound organize request
  alt Sage answers
    S-->>C: clusters + edges + suggestions
    C->>P: SNAP + GOLD orb + suggestion buds
  else Sage unreachable
    HB-->>C: instant local layout
    C->>P: SNAP + GRAY orb — same experience
  end
  P->>C: grabs a card — userPlaced, agent never reorganizes
```

Detailed demo flow: [prizes/best-agentic-interaction.md](prizes/best-agentic-interaction.md)

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

**On-camera flow:**

```mermaid
flowchart LR
  A["0s: open the link"] --> B["1.5s: interactive"]
  B --> C["One touch: seed card spills 5 thoughts"]
  C --> D["2.2s: auto-organize fires"]
  D --> E["THE SNAP — payoff before minute two"]
  E --> F["Grab a card — zero instructions"]
  F --> G["Violet orb — quiz in 1.1s"]
```

Detailed demo flow: [prizes/best-first-five-minutes.md](prizes/best-first-five-minutes.md)

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

**On-camera flow:**

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

Detailed demo flow: [prizes/best-reason-to-come-back.md](prizes/best-reason-to-come-back.md)

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

Detailed notes: [prizes/best-accessibility-forward.md](prizes/best-accessibility-forward.md)

---

## 6. Boldest Original Concept

**What the category rewards:** an idea whose core loop depends on presence,
spatial depth, or hands — one that would fall apart on any other platform.

**The claim, drawn:**

```mermaid
flowchart LR
  subgraph FLAT["On a flat screen"]
    N1["Notes app = a list"] --> N2["Anki = a schedule"]
    N2 --> N3["Mind map = a diagram"]
    N3 --> N4["History = a changelog"]
  end
  subgraph VR["Loci in VR"]
    L1["Thoughts have a PLACE around you"] --> L2["Understanding is physical: move meaning"]
    L2 --> L3["Memory has a ROOM: the palace persists and grows"]
    L3 --> L4["History has a DIAL: scrub your mind's past"]
  end
  FLAT -.->|"no presence · no depth · no body"| VR
```

The method of loci is a 2,000-year-old memory technique that always needed
an imagined place. VR is the first medium where the place is real — and the
Rewind dial (scrubbing your own mind's history through physical space) is
the beat no flat screen can imitate.

Detailed notes: [prizes/boldest-original-concept.md](prizes/boldest-original-concept.md)

---

## Judge's Choice

The wildcard. Loci's angle: genuine cognitive science (method of loci,
spaced repetition), ethical AI (distress gate, transparent gold/gray agent
status), and craft (zero-asset synthesized audio, canvas-rendered type,
hand-built Three.js). No specific changes — polish is the vehicle.
