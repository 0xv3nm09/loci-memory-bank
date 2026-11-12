// Colorblind-safe cluster accents from the Loci repo (palette.ts).
export const CLUSTER_ACCENTS = ["#5bd9fd", "#2fe880", "#f0b24f", "#a8683a", "#2b3fa8", "#ea1a16"];
export const NEBULA_TINTS = [
  { r: 0.6, g: 0.64, b: 0.83 },
  { r: 0.48, g: 0.78, b: 0.88 },
  { r: 0.72, g: 0.58, b: 0.82 },
  { r: 0.5, g: 0.82, b: 0.72 },
] as const;
export function nebulaTint(time: number) {
  const cycle = Math.max(0, Number.isFinite(time) ? time : 0) * 0.025;
  const i = Math.floor(cycle) % NEBULA_TINTS.length;
  const n = (i + 1) % NEBULA_TINTS.length;
  const t = cycle - Math.floor(cycle);
  const s = t * t * (3 - 2 * t);
  const a = NEBULA_TINTS[i] ?? NEBULA_TINTS[0], b = NEBULA_TINTS[n] ?? NEBULA_TINTS[0];
  return { r: a.r + (b.r - a.r) * s, g: a.g + (b.g - a.g) * s, b: a.b + (b.b - a.b) * s };
}
