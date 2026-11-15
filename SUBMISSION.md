# Loci — Submission Form Materials

Copy-paste ready for the Devpost submission form.

**Track:** Productivity · **Division:** New Experience
**Deadline:** November 18, 2026, 12:00 PM PST

---

## Tagline (140 characters max)

A memory palace you build with your hands — capture thoughts, let AI find their structure, then recall what sticks.

(134 chars)

---

## Description (~500 words)

Loci is a spatial memory bank for Meta Quest. You dump scattered thoughts into a calm 3D void — typed, spoken, or tapped from curated seed sets — and an AI organizer called Sage snaps them into connected clusters you can grab, rearrange, and walk through. Come back tomorrow: the palace persists exactly as you left it, and Recall quizzes your weakest notes with spaced repetition so ideas actually stick.

The concept draws on the method of loci, a 2,500-year-old memory technique where you anchor information to physical locations. VR makes this literal: your notes float in front of you, cluster by meaning, and stay where your hands placed them. Flat screens can show lists; only spatial computing can give thoughts a place.

**What makes it different.** Most VR productivity tools port a flat workflow into 3D — a Kanban board, a timer, a to-do list. Loci starts from what VR does uniquely: spatial memory, hand presence, and embodied interaction. There is no menu-heavy onboarding; you capture a thought within seconds and the environment responds immediately. Sage organizes using a dual-intelligence pipeline — a local heuristic runs instantly while the AI model works, and the better result wins. If the model is slow or unreachable, the experience never stalls.

**Hands-first design.** Every interaction works through hand rays and triggers: capture via voice or spatial keyboard, grab and reposition notes with DistanceGrabbable, scrub through your mind's 30-snapshot history with a physical Rewind dial, and tap the Recall orb to start a quiz. No controllers required beyond what Quest hands already provide.

**Safety as a core feature.** A distress gate runs before any other processing on every captured thought, checking against a reviewed trigger list. If a note signals emotional distress, the app halts capture, organize, and recall immediately, surfaces a calm 3D panel with real crisis resources (988 Lifeline, Crisis Text Line), and resumes only after explicit dismissal. This is not a settings toggle — it is a non-removable pipeline stage.

**Technical stack.** Built entirely with the Immersive Web SDK (IWSDK) — Meta's Three.js + ECS framework. The app runs client-side in the headset's browser with one external dependency: Vultr Serverless Inference for the Sage model (qwen3.8-flash-next). No backend server, no cloud platform to manage. Persistence uses localStorage with versioned schemas, debounced saves, and synchronous beforeunload flush. Audio is fully synthesized from WebAudio oscillators — zero audio files, zero licensing.

**Accessibility.** The CVD-safe palette (verified WCAG ratio 72.2) uses hue ranges visible under protanopia, deuteranopia, and tritanopia. A text-scale orb lets users resize all labels live. Every feature works seated.

**What it is not.** Loci does not treat, diagnose, or manage mental health conditions. It does not replace professional care, medical advice, or therapy. It is a thinking tool with a safety net — nothing more, nothing less.

(~460 words)

---

## Hand Interaction Details

All interactions use hand tracking with ray-based pointing and trigger activation:

- **Capture:** tap the Mic orb to start voice capture (Web Speech API), or press the Type orb to open a spatial QWERTY keyboard — both respond to ray + trigger
- **Organize:** tap the Organize orb to trigger Sage clustering; auto-organizes 2.2s after capture if untouched
- **Arrange:** DistanceGrabbable on every note card — ray + trigger to grab, move at source, release to place; user-placed cards are never moved by the AI again
- **Recall:** tap the Recall orb to start a spaced-repetition quiz; answer by tapping option bars or speaking
- **Rewind:** grab the Rewind dial handle (DistanceGrabbable, X-constrained) and slide to scrub through up to 30 historical snapshots of your thought layout
- **Text Scale:** grab the scale orb to resize all labels live
- **Seed Cards:** tap pre-written prompt cards to quick-start with curated 5-note sets
- **Crisis Panel:** dismiss button is the only exit — no gesture shortcut bypasses the safety surface

No controller buttons beyond trigger are required. The experience works fully seated.

---

## Playable Build

IWSDK (WebXR) hosted link: **https://139-84-174-127.sslip.io**

Backup: GitHub Pages at `https://0xv3nm09.github.io/loci-memory-bank/` (auto-deployed on push via `.github/workflows/deploy.yml`).

---

## Demo Video

Under 3 minutes, YouTube or Vimeo. *(Link TBD — already recorded.)*

---

## Inspiration / How It Was Built / Future Plans

*(For the description text box — weave into the ~500 word description above.)*

**Inspiration:** The method of loci is a 2,500-year-old memory technique that always needed an imagined place. VR is the first medium where the place is real.

**How it was built:** IWSDK (Meta's Three.js + ECS framework), 15 registered systems, ~6,300 lines of TypeScript. AI organizing via Vultr Serverless Inference. Built with AI coding agents under human direction — every line machine-written, every scope decision human. Three independent code audits.

**Future plans:** On-device model (WebLLM) so Sage needs no server; cloud palace sync across devices; Voice SDK integration for Quest capture; shared palaces for collaborative thinking; cross-mode connections.
