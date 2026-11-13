# Loci — Competition Strategy & Category Targeting

Meta VR Start Developer Competition 2026. Submission deadline: Nov 18, 2026.

---

## Best-Fit Categories (Ranked by Win Probability)

### Tier 1 — Primary Targets

**1. Best New Productivity Experience — $70,000**
This is Loci's home category. A spatial memory palace for capturing, organizing, and recalling thoughts is textbook productivity. What we have: voice/text/keyboard capture, AI-powered clustering, spaced-repetition recall, persistent palace across sessions, rewind history, three cognitive modes (Think/Grow/Imagine). What makes us stand out: the entire experience is designed around how memory actually works (method of loci, spaced repetition) rather than being a flat task list ported to VR.

**2. Best Agentic Interaction — $25,000**
Sage is a genuine AI agent, not a chatbot overlay. It analyzes the semantic content of captured thoughts, clusters them into meaningful threads, draws cross-cluster connections, and offers suggestions (expand thin ideas, challenge weak ones). The heuristic fallback ensures the agent experience never breaks. The gold/gray orb glow communicates which intelligence organized — transparent agentic behavior. To strengthen: make Sage's reasoning visible (brief "I grouped these because..." labels), and add a second agentic moment (e.g., Sage proactively suggests recall when notes are aging).

**3. Best First Five Minutes — $25,000**
The 4-phase animated intro ("Let it all out" → "Find the threads" → "Scattered thoughts..." → "Your palace is waiting") is a narrative onboarding, not a tutorial. Users capture their first thought within 30 seconds. The spatial affordances (orbs, seeds) are discoverable through the first-launch pulse animation. Help panel is always one tap away. To strengthen: ensure the demo seeds (exam/thesis/kingdom) immediately showcase organize + recall so the first 5 minutes demonstrate the full loop.

**4. Best Reason to Come Back — $25,000**
Spaced-repetition recall system literally defines "reason to come back" — notes decay in strength and the health indicator shows "X due for review." Palace persistence across sessions means your thought space grows over time. Three modes give variety. Rewind lets you revisit your thinking history. To strengthen: add a "welcome back" moment that shows what changed since last visit and which thoughts need attention.

### Tier 2 — Strong Secondary Targets

**5. Best Accessibility Forward Experience — $25,000**
Already implemented: colorblind-safe palette (verified under 3 CVD simulations), text scaling (3 sizes: 100%/125%/150%), prefers-reduced-motion support, voice input as primary capture, webcam hand tracking for users without controllers, keyboard as fallback, crisis panel with real helpline resources. To strengthen: add high-contrast mode toggle, ensure all interactive elements have sufficient hit targets for hand tracking (IWSDK minimum 44px equivalent).

**6. Boldest Original Concept — $25,000**
A VR memory palace that uses the ancient method of loci — placing ideas in spatial locations to aid recall — combined with AI-powered organization and spaced repetition. No existing VR app does this. The concept maps naturally to VR's spatial strengths rather than porting a 2D paradigm. The distress gate + crisis panel shows the concept addresses real human needs with care.

**7. Judge's Choice — $20,000 x2 winners**
This is the wildcard. Judges pick what impresses them personally. Loci's combination of genuine cognitive science (method of loci, spaced repetition), ethical AI (distress gate, transparent Sage vs heuristic feedback), and polished craft (synthesized audio, particle systems, glass-morphism) could catch a judge's eye.

### Tier 3 — Possible But Not Primary

**8. Best Social & Multiplayer Experience — $25,000**
Not currently implemented. Would require: shared palaces, collaborative organizing, multiplayer recall quizzes. This is a stretch for 5 days but could be a "future work" mention in the submission.

---

## Feature → Category Matrix

| Feature | Productivity | Agentic | First 5 Min | Come Back | Accessibility | Boldest | Judge's |
|---|---|---|---|---|---|---|---|
| Voice/text/keyboard capture | ✓ | | ✓ | | ✓ | | |
| AI clustering (Sage) | ✓ | ✓✓ | | | | ✓ | ✓ |
| Heuristic fallback | ✓ | ✓ | | | | | ✓ |
| Spaced-rep recall | ✓ | | | ✓✓ | | ✓ | |
| Rewind history | ✓ | | | ✓ | | ✓ | |
| 3 cognitive modes | ✓ | | | ✓ | | ✓ | |
| 4-phase intro | | | ✓✓ | | | | ✓ |
| Distress gate + crisis panel | | | | | ✓ | ✓ | ✓✓ |
| Colorblind-safe palette | | | | | ✓✓ | | |
| Text scaling | | | | | ✓ | | |
| Reduced motion | | | | | ✓ | | |
| Webcam hand tracking | | | | | ✓ | ✓ | ✓ |
| Zero-asset audio | | | ✓ | | | | ✓ |
| Palace persistence | ✓ | | | ✓✓ | | | |
| Suggestion buds | ✓ | ✓✓ | | | | | |
| Spatial keyboard | ✓ | | | | ✓ | | |

---

## What to Emphasize in Submission (Per Category)

**Productivity**: Full cognitive loop — capture → organize → arrange → recall → rewind. Not a whiteboard, not a task list: a thinking environment that respects how memory works.

**Agentic**: Sage analyzes content semantically, clusters autonomously, draws cross-cluster connections, and offers expand/challenge suggestions. Gold glow = AI, gray = heuristic — transparent about what the agent did. Heuristic fallback means the agent never breaks the experience.

**First 5 Min**: Narrative opening (not a tutorial), first thought captured in <30s, seeds demonstrate organize+recall immediately, help accessible but not intrusive, onboarding pulse guides without blocking.

**Come Back**: Spaced-repetition decay creates natural return cadence. Health pill shows due count. Welcome-back greeting. Palace grows across sessions. Three modes for different cognitive needs. Rewind lets you revisit evolution.

**Accessibility**: Colorblind-safe (CVD-verified), text scaling, reduced-motion, voice-first capture, webcam hand tracking, spatial keyboard, crisis resources.

**Boldest**: Ancient method of loci + modern AI + VR spatiality. Distress-gate shows responsible innovation. No other VR app does this.

---

## Quick Wins for Last 5 Days

These are small changes that meaningfully strengthen category positioning:

1. **Add a PWA manifest + icons** — Required for Quest distribution, also shows polish. (~1 hour)
2. **"Sage is thinking..." status during AI call** — Agentic category needs visible agent activity. (~30 min)
3. **Welcome-back message** — "You captured 12 thoughts last time. 3 are due for recall." Strengthens Come Back. (~1 hour)
4. **Export palace as shareable JSON** — Already implemented. Make it prominent in the help panel.
5. **Record a 2-minute demo video** — Required for submission. Script: boot → capture 3 thoughts → organize → show connections → recall quiz → rewind → mode switch.
6. **Submission write-up** — Focus on the "why" (cognitive science, ethical AI, accessibility) not just the "what."

---

## Total Prize Potential

If Loci places in its strongest categories:

| Category | Prize | Probability |
|---|---|---|
| Best New Productivity Experience | $70,000 | High — direct fit |
| Best Agentic Interaction | $25,000 | High — Sage is genuine |
| Best First Five Minutes | $25,000 | Medium-High — polished intro |
| Best Reason to Come Back | $25,000 | Medium-High — spaced rep |
| Best Accessibility Forward | $25,000 | Medium — strong features |
| Boldest Original Concept | $25,000 | Medium — unique concept |
| Judge's Choice | $20,000 | Unknown — wildcard |

Runner-up in productivity alone ($35,000) would still be significant. The strategy is: nail Productivity as the anchor, and let Agentic + First 5 Min + Come Back stack on top.
