# Loci — web version

A phone and desktop web companion to the Quest app: the opening story,
per-mode palaces, the safety gate, Recall, Rewind, settings and synthesized
audio. The Quest / IWSDK app at the repository root is the primary
experience and is unchanged by this folder.

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
