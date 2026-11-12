# Loci — a spatial memory bank

Dump your scattered thoughts into a calm 3D void; watch them **snap** into
organized, connected clusters you can grab and rearrange with your hands.
Come back later: the space persists as a *memory palace*, and Recall quizzes
you with spaced repetition so the ideas actually stick.

Built with the [Immersive Web SDK](https://developers.meta.com/vr/documentation/iwsdk/guides/overview)
(Three.js + ECS) for Meta Quest browsers and desktop. Hands-first and
mouse-friendly, seated, under ten minutes a session.

## Two surfaces, one idea

| Surface | What it is | Where |
| --- | --- | --- |
| **Quest app** (primary) | The full hands-first VR experience — this repository's root, deployed to GitHub Pages | this folder |
| **Web companion** | The phone/desktop **Lovable-designed** web version: opening story, per-mode palaces, Recall, Rewind, safety gate — same loop, flat screen | [`web/`](web/README.md) |

The web companion was designed in [Lovable](https://lovable.dev) and lives in
[`web/`](web/README.md) — see its README to run it (Bun) and
[`web/WEB_VERSION.md`](web/WEB_VERSION.md) for how it relates to the Quest app.

## The loop

1. **Capture** — type a thought, speak it, or press a seed card to spill a curated set.
2. **Organize** — tap the orb and Sage (a small model running on a dedicated
   GPU server via Ollama) clusters your notes and draws connections. If Sage
   is unreachable, a heuristic fallback organizes locally — no internet required.
3. **Arrange** — grab any card; your placements are always respected.
4. **Recall** — the palace quizzes your weakest notes first; spaced repetition
   schedules the next visit.

## Development

```bash
npm install
npm run dev        # IWSDK dev server + in-browser XR emulation
npm run build      # production build → dist/
npm run typecheck
```

Deployed to GitHub Pages on every push to `main` (see
`.github/workflows/deploy.yml`).

## Accessibility

Every action — capture, organize, arrange, recall, rewind — is reachable
one-handed and seated. Cluster colors are **verified** colorblind-safe
(simulated under deuteranopia/protanopia/tritanopia; see `src/loci/palette.ts`),
meaning is never carried by color alone (every state also has a glyph or
shape), and the green **Aa orb** cycles global text size (100/125/150%).
The crisis safety surface has its own calm audio cue.

## Prize targeting

`prizes/` documents, per competition category we are targeting, what judges
reward, what is built (with file references), and the exact demo flow.

## Privacy note

Thoughts you capture are processed on your device and, for AI organizing, by a
small language model running on the developer's own server (Ollama). Nothing
is stored server-side, nothing is shared with third parties, and the palace
lives only in your browser (export it anytime with the Export button).

## License

MIT for app code; bundled Inter font under the SIL OFL (see `public/fonts`).
