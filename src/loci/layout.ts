/**
 * Palace layout — pure functions, deterministic.
 * Everything sits in a comfortable seated FoV: a front arc at ~1.2m,
 * height band 1.0–1.6m, within the "airplane seat" radius.
 */

export interface LayoutVec {
  x: number;
  y: number;
  z: number;
}

// ── Comfortable FoV bounds (Meta guidance) ──
// FoV differs between Quest devices; keeping the layout inside a narrower
// cone reads comfortably on all of them and avoids neck strain.
const FOV_HALF_ARC = Math.PI / 6; // ±30° — comfortable 60° total horizontal cone
const FOV_Y_MIN = 1.05; // seated eye-height band, lower bound (m)
const FOV_Y_MAX = 1.45; // seated eye-height band, upper bound (m)

/**
 * Pull a layout position into the comfortable viewing cone: the horizontal
 * angle is clamped to ±30° of straight-ahead (distance preserved), and
 * height is clamped to the seated eye-height band. Pure — mutates and
 * returns the given position.
 */
export function clampToComfortableFoV<T extends LayoutVec>(position: T): T {
  const distance = Math.sqrt(position.x * position.x + position.z * position.z);
  if (distance > 1e-4) {
    const angle = Math.atan2(position.x, -position.z); // relative to forward (-Z)
    if (Math.abs(angle) > FOV_HALF_ARC) {
      const clamped = angle < 0 ? -FOV_HALF_ARC : FOV_HALF_ARC;
      position.x = distance * Math.sin(clamped);
      position.z = -distance * Math.cos(clamped);
    }
  }
  position.y = Math.min(FOV_Y_MAX, Math.max(FOV_Y_MIN, position.y));
  return position;
}

/** Distinct hues for cluster identity (cyan, green, amber, violet, rose, blue). */
/** Hue positions matching palette.ts's verified accents 1:1 (nearest-hue
 * mapping then resolves exactly). Interleaved warm/cool for variety. */
export const CLUSTER_HUES = [0.537, 0.102, 0.406, 0.07, 0.64, 0.003];

const SPACING_X = 0.29;
const SPACING_Y = 0.19;

export function gridDimensions(count: number): {
  cols: number;
  rows: number;
  width: number;
  height: number;
} {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / cols));
  return {
    cols,
    rows,
    width: (cols - 1) * SPACING_X,
    height: (rows - 1) * SPACING_Y,
  };
}

export function clusterCenter(index: number, count: number): LayoutVec {
  const spreadDegrees = Math.min(64, 20 + count * 12);
  const t = count === 1 ? 0.5 : index / (count - 1);
  const angle = ((-spreadDegrees / 2 + spreadDegrees * t) * Math.PI) / 180;
  // Larger clusters sit a little further back so their grid stays in view.
  const radius = 1.40;
  // Clamp into the comfortable cone — the spread formula can exceed ±30°
  // for many clusters, and the seated band bounds height.
  return clampToComfortableFoV({
    x: Math.sin(angle) * radius,
    y: 1.42 + (index % 2 === 0 ? 0.02 : -0.02),
    z: -Math.cos(angle) * radius,
  });
}

/** Cluster members fill a centered grid — no overlap at any count. */
export function noteOffset(index: number, count: number): LayoutVec {
  const { cols, rows, width, height } = gridDimensions(count);
  const col = index % cols;
  const row = Math.floor(index / cols);
  const zJitter = (((index * 37) % 11) - 5) * 0.004;
  return {
    x: col * SPACING_X - width / 2,
    y: height / 2 - row * SPACING_Y,
    z: zJitter,
  };
}

/** Height of a cluster's grid — used to float its label above the cards. */
export function gridHalfHeight(count: number): number {
  return gridDimensions(count).height / 2;
}
