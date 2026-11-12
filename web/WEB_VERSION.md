# Loci web version

This folder contains the phone and desktop web app from Lovable, including the opening story, per-mode palaces, safety gate, recall, rewind, settings and synthesized audio.

The Quest / IWSDK app at the repository root is unchanged.

## Run

Install Bun, then run these commands from this folder:

```sh
bun install
bun run dev
```

The app stores palaces only in the current browser. Microphone input requires browser support, permission and HTTPS (or localhost).

The source uses TanStack Start and the Lovable Vite configuration. Repository upload does not publish or deploy it, and does not create ongoing Lovable Git sync.
