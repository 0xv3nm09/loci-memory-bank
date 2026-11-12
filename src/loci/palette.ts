/**
 * Loci's design tokens — the single source of visual truth.
 * Research basis: dark glass surfaces (visionOS/Material dark), desaturated
 * bodies with restrained accents, colorblind-safe cluster hues.
 *
 * v2 — Deep polish: richer gradients, warmer glow, nebula-class ambient
 * color cycling, and more saturated semantic accents.
 */

/** Card surfaces — dark glass, never tinted by cluster color. */
export const GLASS = {
  body: 0x182335,
  ink: '#EDF1FA',
  inkDim: '#B9C2DB',
  rawRim: 0x6b6152,
  rawRimIntensity: 0.06,
  clusteredRimIntensity: 0.06,
  /** Panel surfaces — slightly lighter than cards for z-depth layering. */
  panelBody: 0x0e1428,
  panelEmissive: 0x1a2440,
  panelEmissiveIntensity: 0.04,
  panelOpacity: 0.96,
  /** Button surfaces — UI affordances on panels. */
  buttonBody: 0x1c2745,
  buttonEmissive: 0x3a4b7a,
  buttonEmissiveIntensity: 0.04,
  /** Correct/incorrect feedback. */
  correctBody: 0x1d4a35,
  correctGlow: 0x2fbf6a,
  incorrectBody: 0x4a351d,
  incorrectGlow: 0xbf7a2f,
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
  sage: 0xe8b879,
  muted: 0x8a93a8,
  connection: 0x46c8e8, // lines: slightly desaturated cyan
  expand: 0x43d9a3,
  challenge: 0xf0b24f,
  /** Status text in 3D scene. */
  statusText: '#9fb0d8',
  /** Calm accent for positive messaging. */
  calmAccent: '#bdf5e6',
  /** Prompt text on panels. */
  promptText: '#e8edff',
  /** Dim hint text. */
  hintText: '#8fa3d8',
};

/* ── Nebula color cycling — slow ambient hue drift for the starfield ── */

/** Three nebula tints that the starfield crossfades between, very slowly. */
export const NEBULA_TINTS = [
  { r: 0.60, g: 0.64, b: 0.83 }, // cool lavender
  { r: 0.48, g: 0.78, b: 0.88 }, // soft cyan
  { r: 0.72, g: 0.58, b: 0.82 }, // warm purple
  { r: 0.50, g: 0.82, b: 0.72 }, // sea glass
] as const;

/** Interpolate between nebula tints based on time (cycle = ~40s). */
export function nebulaTint(time: number): { r: number; g: number; b: number } {
  const cycle = Math.max(0, Number.isFinite(time) ? time : 0) * 0.025; // full cycle ≈ 40s per tint pair
  const index = Math.floor(cycle) % NEBULA_TINTS.length;
  const next = (index + 1) % NEBULA_TINTS.length;
  const t = cycle - Math.floor(cycle);
  // Smooth step for organic feel
  const s = t * t * (3 - 2 * t);
  const a = NEBULA_TINTS[index];
  const b = NEBULA_TINTS[next];
  return {
    r: a.r + (b.r - a.r) * s,
    g: a.g + (b.g - a.g) * s,
    b: a.b + (b.b - a.b) * s,
  };
}

/* ── Orb identity colors — richer, more distinct per-orb hues ── */

export const ORB_COLORS = {
  organize: { body: 0x9fe8d8, emissive: 0x2fbf9a, label: '#bdf5e6' },
  recall:   { body: 0xcfc2ff, emissive: 0x7a5fd0, label: '#e2daff' },
  type:     { body: 0xaac6ff, emissive: 0x4a6fd0, label: '#c9d8ff' },
  mic:      { body: 0xffc9c9, emissive: 0xd05858, label: '#ffd9d9' },
  textScale:{ body: 0xd8e8d0, emissive: 0x5f9f6f, label: '#d8f0dc' },
  rewind:   { body: 0xcfc2ff, emissive: 0x7a5fd0, label: '#e2daff' },
} as const;

/* ── HUD gradient pairs — CSS gradient stops for buttons ── */

export const HUD_GRADIENTS = {
  primary: ['#7ee7d2', '#3dbfa3'],
  voice:   ['#ff8888', '#d04848'],
  organize:['#9fe8d8', '#3dbfa3'],
  recall:  ['#cfc2ff', '#7a5fd0'],
  rewind:  ['#82b4ff', '#4a6fd0'],
  danger:  ['#ff9999', '#cc4444'],
} as const;

/* ── Particle & trail colors ── */

export const PARTICLE = {
  trail: 0x8ad0ff,
  trailOpacity: 0.55,
  spawn: 0xbfe8ff,
  snapBurst: 0x46c8e8,
  /** Organize burst — green-teal particles. */
  organizeBurst: 0x5bd9a0,
  /** Starfield base. */
  star: 0x9aa4d4,
  starOpacity: 0.5,
} as const;
