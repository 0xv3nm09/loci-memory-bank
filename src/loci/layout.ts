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

/** Distinct hues for cluster identity (cyan, green, amber, violet, rose, blue). */
export const CLUSTER_HUES = [0.53, 0.33, 0.09, 0.72, 0.9, 0.6, 0.45];

const SPACING_X = 0.19;
const SPACING_Y = 0.135;

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
  const spreadDegrees = Math.min(110, 24 + count * 26);
  const t = count === 1 ? 0.5 : index / (count - 1);
  const angle = ((-spreadDegrees / 2 + spreadDegrees * t) * Math.PI) / 180;
  // Larger clusters sit a little further back so their grid stays in view.
  const radius = 1.18 - Math.min(0.45, count * 0.02);
  return {
    x: Math.sin(angle) * radius,
    y: 1.28 + (index % 2 === 0 ? 0.06 : -0.03),
    z: -Math.cos(angle) * radius,
  };
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
