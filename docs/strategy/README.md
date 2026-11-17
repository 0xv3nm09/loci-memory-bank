# Loci — Competition Strategy

Meta VR Start Developer Competition 2026 · Entry: **Best New Productivity
Experience** (track) · **New Experience** (division). One entry, judged on
four equally weighted criteria, eligible for every special award below.

Each award gets its own file: what the judges reward (official wording),
how Loci covers it in detail, the implementation map, evidence you can
verify on the built app, the diagrams, and demo talking points. All listed
features are **implemented and shipped** — verified live at
`https://139-84-174-127.sslip.io`. Companion maps:
[EVIDENCE.md](../EVIDENCE.md) (criterion → proof) ·
[CAPABILITIES.md](../CAPABILITIES.md) (per-feature detail) ·
[ARCHITECTURE.md](../ARCHITECTURE.md) (system inventory).

## The four judging criteria (apply to everything)

1. **Innovation & Creativity** — originality, creative ambition, relevance to the chosen track.
2. **Experience Design** — design quality, mechanics, user journey; emphasis on seated, hands-first, context-specific use.
3. **Technical Implementation** — technical expertise, reliability, and smart use of platform tools: hand tracking, **gaze**, passthrough, spatial anchoring, **FoV-aware design**.
4. **Polish & Presentation** — UI/UX, art direction, sound design.

Loci's platform-tool coverage for criterion 3 is deliberate: hands-first end
to end (`RayInteractable`/`DistanceGrabbable` everywhere), **gaze-assisted
card focus** (~14° cone, zero per-frame allocation), and a **comfortable-FoV
clamp** (±30° cone, seated 1.05–1.45 m band) — see
[CAPABILITIES.md](../CAPABILITIES.md#gaze--field-of-view-comfort).

## Award coverage

| # | Award | File | One-line coverage |
| --- | --- | --- | --- |
| 1 | **Best New Productivity Experience** (our track) | [01-productivity-track.md](01-productivity-track.md) | A daily thinking ritual — capture → snap → arrange → recall — built for how memory works |
| 2 | **Best Agentic Interaction** | [02-agentic-interaction.md](02-agentic-interaction.md) | Sage: schema-constrained agent whose agency is visible (gold/gray orb) and honest (retry-then-fallback) |
| 3 | **Best First Five Minutes** | [03-first-five-minutes.md](03-first-five-minutes.md) | Boot 1.5 s → first capture on touch → snap payoff before minute two |
| 4 | **Best Reason to Come Back** | [04-reason-to-come-back.md](04-reason-to-come-back.md) | Mechanics, not notifications: per-note memory strength + a palace that persists and grows |
| 5 | **Best Accessibility Forward Experience** | [05-accessibility-forward.md](05-accessibility-forward.md) | CVD-verified palette, every input/output channel redundant, one hand seated |
| 6 | **Boldest Original Concept** | [06-boldest-original-concept.md](06-boldest-original-concept.md) | Falls apart off-platform: thoughts have a place, history has a dial |
| 7 | **Judge's Choice** | [07-judges-choice.md](07-judges-choice.md) | The wildcard: cognitive science + ethical AI + craft |

## Deliberately not targeted

[08-not-targeted.md](08-not-targeted.md) — Best Social & Multiplayer
Experience and the Adapted/Updated track variants, with the honest reasons.

## Documented limits

[09-documented-limits.md](09-documented-limits.md) — every accepted trade,
stated openly (voice desktop-only, foveation 0.8, …). Documented, not hidden.

## How the entry maps to Devpost

- **Track:** Productivity → file 1 is the track pitch; files 2–7 are the
  special-award pitches (Devpost lets one entry be considered across awards).
- **Division:** New Experience — no pre-existing codebase; first commit
  inside the build window (`git log --reverse`).
- The four judging criteria above are scored for every award, so every file
  below also cites its criterion-3 (platform tools) and criterion-4 (polish)
  evidence where relevant.
