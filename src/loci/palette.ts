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
 * Cluster accents — VERIFIED colorblind-safe, not just claimed: the six
 * colors were searched under Viénot deuteranopia/protanopia/tritanopia
 * simulation; minimum pairwise distance 72 (anything over ~60 reads
 * distinct; the previous set collapsed to 1.4 under protanopia). Luminance
 * stagger does the heavy lifting for red-green blindness. Note.hue maps to
 * the nearest entry, so old palaces keep working.
 */
export const CLUSTER_ACCENTS: Array<{ hue: number; color: number }> = [
  { hue: 0.537, color: 0x5bd9fd }, // light sky
  { hue: 0.406, color: 0x2fe880 }, // vivid mint
  { hue: 0.102, color: 0xf0b24f }, // light amber
  { hue: 0.07, color: 0xa8683a }, // dark copper
  { hue: 0.64, color: 0x2b3fa8 }, // deep navy
  { hue: 0.003, color: 0xea1a16 }, // signal red
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
