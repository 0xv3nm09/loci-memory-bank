# Loci — web version

The **Lovable-designed** phone and desktop web companion to the Quest app:
the opening story, per-mode palaces, the safety gate, Recall, Rewind,
settings and synthesized audio — the same capture → organize → arrange →
recall loop on a flat screen.

The Quest / IWSDK app at the repository root is the primary experience and
is unchanged by this folder. See the [root README](../README.md) for the
full picture.

## Run

Requires [Bun](https://bun.sh) (or Node with npm):

```sh
bun install
bun run dev
```

Palaces are stored only in the current browser. Microphone input requires
browser support, permission and HTTPS (or localhost).

## Build and test

```sh
bun run build     # production build (Nitro output)
bun run test      # vitest suite
```

The design originates from [Lovable](https://lovable.dev); this repository
holds a synced snapshot of it and is the source of truth going forward.
