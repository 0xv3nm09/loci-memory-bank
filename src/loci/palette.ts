/**
 * Loci's design tokens — the single source of visual truth.
 * Research basis: dark glass surfaces (visionOS/Material dark), desaturated
 * bodies with restrained accents, colorblind-safe cluster hues.
 */

/** Card surfaces — dark glass, never tinted by cluster color. */
export const GLASS = {
  body: 0x1b2238,
  ink: '#EDF1FA',
  inkDim: '#B9C2DB',
  rawRim: 0x6b6152,
  rawRimIntensity: 0.26,
  clusteredRimIntensity: 0.28,
};

/**
 * Cluster accents — curated, colorblind-safe spacing (Okabe-Ito hue
 * positions), controlled saturation. Note.hue maps to the nearest entry.
 */
export const CLUSTER_ACCENTS: Array<{ hue: number; color: number }> = [
  { hue: 0.55, color: 0x4fb8f0 }, // sky blue
  { hue: 0.44, color: 0x43d9a3 }, // mint green
  { hue: 0.1, color: 0xf0b24f }, // warm amber
  { hue: 0.73, color: 0xa78bfa }, // violet
  { hue: 0.94, color: 0xf27e9d }, // rose
  { hue: 0.62, color: 0x7a9bf5 }, // slate blue
];

/** Nearest curated accent for a stored hue (circular hue distance). */
export function accentForHue(hue: number): number {
  let best = CLUSTER_ACCENTS[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const entry of CLUSTER_ACCENTS) {
    const distance = Math.min(
      Math.abs(entry.hue - hue),
      1 - Math.abs(entry.hue - hue),
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = entry;
    }
  }
  return best.color;
}

/** Semantic colors (stable across themes). */
export const SEMANTIC = {
  connection: 0x46c8e8, // lines: slightly desaturated cyan
  expand: 0x43d9a3,
  challenge: 0xf0b24f,
};
