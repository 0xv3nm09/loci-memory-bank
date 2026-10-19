# Loci — a spatial memory bank

Dump your scattered thoughts into a calm 3D void; watch them **snap** into
organized, connected clusters you can grab and rearrange with your hands.
Come back later: the space persists as a *memory palace*, and Recall quizzes
you with spaced repetition so the ideas actually stick.

Built with the [Immersive Web SDK](https://developers.meta.com/vr/documentation/iwsdk/guides/overview)
(Three.js + ECS) for Meta Quest browsers and desktop. Hands-first and
mouse-friendly, seated, under ten minutes a session.

## The loop

1. **Capture** — type a thought or press a seed card to spill a curated set.
2. **Organize** — the on-device heuristic organizer clusters your notes and
   draws the connections (a small local model slotting in behind the same
   schema is on the roadmap).
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

## License

MIT for app code; bundled Inter font under the SIL OFL (see `public/fonts`).
