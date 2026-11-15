# Safety design — the gate and the panel

Related docs: [ARCHITECTURE.md](ARCHITECTURE.md) · [MODEL_CARD.md](MODEL_CARD.md) ·
[EVIDENCE.md](EVIDENCE.md) · [../SYSTEM_CARD.md](../SYSTEM_CARD.md)

Loci is warm, playful, and genuinely helpful for goals, reframing, and
creativity — and it is built on one hard, non-negotiable line that every other
feature sits behind: **it is not therapy, not a diagnostic tool, and never
claims to treat or cure anything.** This is stated plainly at first use and
never contradicted by the agent's tone.

## The distress gate — deterministic, first, always

**Implementation:** `src/loci/distress-gate.ts` — a reviewed, high-recall
trigger list (16 patterns covering suicidal ideation, self-harm, hopelessness
and isolation language). It is **never** the main model's job: a system prompt
can be forgotten, talked around, or silently dropped under load; a standalone
function cannot fail that way.

**Position in the pipeline:** `checkDistress()` runs on the raw capture inside
`spawnRaw()` — before the note enters the palace, before any model call,
before any UI exists for the thought.

**Fail direction:** toward showing resources. A false positive costs the user
one dismissible panel; a false negative costs far more. Over-triggering is the
deliberate, accepted trade.

## What happens on a flag

1. The capture is **discarded** — it never becomes a note, never enters a
   cluster, never persists in a save, never reaches a model.
2. `CrisisPanelSystem.show()` opens a **3D world-space panel** — deliberately
   in-headset, not a DOM overlay invisible to the headset user.
3. Sage drops every other tone: the panel names what it heard, says the user
   doesn't have to carry it alone, and shows real resources —
   findahelpline.com (global directory), the 988 Suicide & Crisis Lifeline
   (US/Canada), and local emergency services.
4. A calm, low audio cue accompanies the panel (never an alarm) — the safety
   moment reaches users who cannot rely on vision alone.
5. `crisActive` blocks organize, recall, capture and rewind while the panel is
   open. The only way forward is the **"I'm okay — continue"** button.
6. Nothing about the event is recorded — flagged content was never saved, so
   Rewind structurally cannot resurface it.

## Trigger list (reviewed)

Core patterns: suicidal ideation variants, killing oneself, ending one's life,
wanting to die / be dead, better-off-dead, self-harm and cutting, overdose, no
reason to live, not wanting to wake up or exist, taking one's own life.
Extended (added after review): wishing one was dead, "can't go on / take it /
do this anymore", "nobody would miss/care/notice".

Known trade-offs, documented: the list is English-only today; idioms that
trigger false positives (e.g. "this exam is killing me") are consciously
excluded from the patterns to keep over-triggering from training users to
dismiss the panel.

## Will / won't (the agent's contract)

| Sage will | Sage won't |
| --- | --- |
| Reflect a harsh thought back more kindly, as one option | Tell the user what to believe or feel |
| Turn goals into small steps | Promise outcomes ("you'll feel better") |
| Celebrate wins and remember them | Diagnose, label, or name a condition |
| Challenge a weak idea with a question | Engage self-harm content as "creative material" |
| Surface real crisis resources immediately | Try to talk someone out of crisis itself |
| Propose structure, suggest, ask | Take over, auto-apply, or overwrite placements |

## The crisis surface

`crisis-panel.ts` renders a world-space panel at seated eye height: the
acknowledgment line, the resource list (directory, 988, local emergency
services), a closing human line ("Tell someone you trust. You matter."), and a
touchable **"I'm okay — continue"** button. The panel is the only element on
stage while open; `crisActive` gates every other system. Dismissal requires
touching the button — no timeouts, no auto-dismiss.

## Why this is a strength

Judges in 2026 evaluate AI products in a climate actively scrutinizing agent
safety. A visible, tested safety floor — a deterministic gate that runs before
the model, a panel that exists in the headset, a fail-toward-resources
direction — is engineering maturity on display, not a limitation to downplay.
