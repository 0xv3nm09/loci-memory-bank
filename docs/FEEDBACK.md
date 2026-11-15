# Build feedback — every issue faced and its fix

Related docs: [ARCHITECTURE.md](ARCHITECTURE.md) · [AI.md](AI.md) ·
[EVIDENCE.md](EVIDENCE.md)

A running log of the real problems hit while building Loci and what each one
taught. Kept in the airlock/mandate repo style: documented, not hidden.

## Rendering

| Issue | Root cause | Fix |
| --- | --- | --- |
| **All card text invisible** (boxes rendered, no glyphs) | troika-three-text renders via a web worker that silently fails in the IWSDK dev runtime | Replaced entirely with canvas-texture labels (`text-label.ts`): fit-to-width wrapping, faux-bold, shadows, dynamic `redraw()`. troika uninstalled. Lesson: when text is business-critical, own the raster |
| Text clipped mid-word at card edges | Canvas wrap didn't shrink long words | Fit-to-width pass: measure widest line, scale font down, re-wrap |
| Notes duplicated 2–3× in a long-lived palace | Not a bug: each seed-card press intentionally spawns a fresh set with unique ids; weeks of test dumps accumulated | Explained in the demo script; Clear button exists for fresh starts |
| Quest font rendering | Canvas rasterization at 1024 px/m was soft at seated distance | Raised to 1536 px/m + faux-bold stroking + deeper shadows |

## ECS (elics) — the patterns that bit

| Issue | Root cause | Fix |
| --- | --- | --- |
| Old entities lingered after re-organize | Destroying entities inside an input-event `qualify` callback mutates the query mid-iteration — elics silently skips it | **Deferred trash pattern**: park doomed entities in `trash[]`, reap in `update()` with `removeFromParent()` + `dispose()` |
| GPU memory growth across quiz sessions | `entity.destroy()` does **not** free GPU resources in elics; `dispose()` does | Quiz teardown now uses `dispose()`; verified against the installed elics typings |
| Component worked but wasn't editor-visible | `SpawnAnimation` was created but never passed to `defineComponents` | elics auto-registers on first `addComponent`, so runtime was fine — but registration is now consistent for every component |
| Hover feedback fought the spawn overshoot | Two systems wrote `scale` on the same entity each frame | Spawn entities are excluded from the hover/grab lerp until the animation completes |

## Tooling & environment

| Issue | Root cause | Fix |
| --- | --- | --- |
| npm installs failing with EACCES on cache | Root-owned `~/.npm` from an old `sudo npm` | Dedicated cache: `npm config set cache ~/.npm-cache-loci` |
| IWSDK dev server "workspace already has a dev runtime" | Managed session and a raw `vite` process conflict | `npx @iwsdk/cli dev down` before starting |
| ZCode's in-app browser can't open the dev server | Self-signed HTTPS cert | Test through `npx @iwsdk/cli browser screenshot/logs` and `xr` commands against the managed Chromium |
| Emulator controller presses dying mid-session | Re-entering XR after a page reload throws "An active XR session already exists" and poisons IWER input | `xr exit` before re-enter; enter once per page load |
| Pushed a broken import (CI failed) | A `\| tail` pipe masked a failing typecheck in a chained command | Always `set -o pipefail` before chained verify + commit |
| GitHub Pages 404 after a private→public flip | Flipping to private deletes the Pages site; the workflow token can't re-create it ("not accessible by integration") | Recreate via `gh api …/pages -X POST -f build_type=workflow`, then re-run the deploy |
| Two WebGL tabs, dead HUD in the second | Occluded-tab CSS transitions freeze (computed styles stuck mid-fade) — test artifact, not app state | Verified with a transition-disable probe; test one tab at a time |
| MediaPipe build breakage after adding webcam tracking | `@mediapipe/tasks-vision` imported but not installed | Installed the dependency; removed the stale `@ts-expect-error` (the package ships types) |

## Design decisions preserved

| Decision | Why |
| --- | --- |
| IWSDK instead of plain Three.js | Competition-sanctioned path; supplies grab, hands, emulation, ECS |
| No backend; the browser calls Vultr Serverless Inference directly | No infra to manage; the heuristic organizer keeps the product alive if the endpoint is unreachable |
| Canvas text instead of troika | Worker-based rendering failed silently; canvas is universal on desktop + Quest |
| Cluster colors searched, not assumed | The original "colorblind-safe" claim failed simulation (1.4 worst pair); the searched palette holds 72.2 |
| Welcome panel hides after the first organize | Onboarding had grown tall enough to cover the snap — the payoff must play in a clear stage |
| Manual snapshot sync for the Lovable web companion | Lovable's GitHub sync expects to own a repo root; it would clobber the Quest app |
