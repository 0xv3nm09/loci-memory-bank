# Loci Quest redesign

The standalone IWSDK app has a spatial welcome story, warm Sage presence, dark readable cards with accent edges, restrained snap/connection animation, seated capture/organize/Recall controls, and redesigned keyboard, Recall, help, crisis and Rewind panels. Returning users go directly to their saved palace. Reduced motion disables star drift, snap flights and trails. Webcam hands now require the explicit Hands control rather than opening the camera on the first click.

## Run and test
From the original repository root (or `quest/` inside the Lovable companion checkout):

```sh
npm ci
npm run dev
npm test
npm run build
```

The Quest app stays separate from `web/`. Its existing single-palace browser storage, clustering fallback and strength-based Recall rules are preserved; this redesign does not add the companion's three modes or date-based spaced repetition.

## Verified
- Desktop clicks through Begin, story, capture, local grouping, Recall answers/results, keyboard opening, help/export, text-size controls and reload.
- Card dragging persists the manually placed position.
- Crisis capture is blocked; subsequent ordinary thoughts cannot enter behind the crisis panel.
- Rewind toggles and actual mouse dragging work, including reduced-motion mode.
- Phone opening checked at 390 × 844; returning browser shell checked at 320 × 568, 390 × 844 and 1280 × 900.
- Genuine immersive emulator entry and exit; no old white welcome panel or uncaught page errors.
- Five capture-lock tests, companion regression tests and standalone production compilation pass.

## Still requires external verification
Physical Quest comfort, controller/hand targeting, actual microphone recognition, audible quality and headset performance. Voice uses Web Speech where available, with typing on unsupported Quest browsers. The existing remote model currently falls back to local grouping in the tested browser due to CORS. Hosting/deployment is separate and not repaired by this source update. IWSDK production chunks remain large.
