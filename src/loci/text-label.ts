import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  LinearFilter, LinearMipmapLinearFilter,
} from 'three';
import { GLASS } from './palette.js';

const PX_PER_METER = 2048;
const LINE_HEIGHT = 1.26;

// Global text scale (accessibility). Module-level: the toggle orb updates it
// and re-scales every live label mesh via a scene traversal.
let textScale = 1;
export function getTextScale(): number {
  return textScale;
}
export function setTextScale(next: number): void {
  textScale = next;
}

let fontReady = false;

/** Register the bundled Inter as a canvas-readable font (graceful fallback). */
export async function loadLociFont(): Promise<void> {
  if (fontReady || typeof document === 'undefined') {
    return;
  }
  try {
    const face = new FontFace(
      'InterLoci',
      `url(${import.meta.env.BASE_URL}fonts/Inter-Regular.ttf)`,
    );
    await face.load();
    document.fonts.add(face);
    fontReady = true;
  } catch {
    // System sans-serif fallback is perfectly readable.
  }
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidthPx: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (ctx.measureText(candidate).width <= maxWidthPx || current === '') {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== '') {
    lines.push(current);
  }
  return lines;
}

/** Truncate to maxLines with an ellipsis on the last visible line. */
function fitLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidthPx: number,
  maxLines: number,
): string[] {
  let lines = wrapLines(ctx, text, maxWidthPx);
  if (lines.length <= maxLines) {
    return lines;
  }
  lines = lines.slice(0, maxLines);
  let last = lines[maxLines - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidthPx) {
    last = last.slice(0, -1);
  }
  lines[maxLines - 1] = `${last}…`;
  return lines;
}

export interface TextLabelOptions {
  /** Max width of the text block, in world meters. */
  maxWidth: number;
  /** Max visible lines before ellipsis (default 4). */
  maxLines?: number;
  /** Text color (default near-white). */
  color?: string;
  align?: 'center' | 'left';
  /** CSS font-weight (default 500; 600 for card labels, 700 for titles). */
  fontWeight?: number;
  /** Soft dark shadow under the glyphs for depth (default true). */
  shadow?: boolean;
}

const fontSpec = (px: number, weight: number): string =>
  `${weight} ${px}px InterLoci, sans-serif`;

/**
 * Canvas-texture text: zero workers, zero async, renders everywhere —
 * Quest browser included. Returns a flat mesh sized in world meters.
 */
export function createTextLabel(
  text: string,
  fontSize: number,
  options: TextLabelOptions,
): Mesh {
  const { maxWidth, maxLines = 4, color = GLASS.ink, align = 'center' } = options;
  const px = Math.max(12, Math.round(fontSize * PX_PER_METER));
  const weight = options.fontWeight ?? 500;
  const useShadow = options.shadow === true;
  const maxWidthPx = Math.round(maxWidth * PX_PER_METER);
  const usablePx = maxWidthPx - 24;

  const measure = document.createElement('canvas');
  const mctx = measure.getContext('2d');
  if (mctx == null) throw new Error('Text canvas unavailable');
  mctx.font = fontSpec(px, weight);
  const lines = fitLines(mctx, text, usablePx, maxLines);

  // Shrink to fit: whatever the canvas font metrics say, the drawn text
  // must never be wider than the card (no mid-word clipping).
  let drawPx = px;
  const widest = Math.max(1, ...lines.map((line) => mctx.measureText(line).width));
  if (widest > usablePx) {
    drawPx = Math.max(9, Math.floor((px * usablePx) / widest));
  }
  const lineHeightPx = Math.round(drawPx * LINE_HEIGHT);

  const canvasWidth = maxWidthPx;
  const canvasHeight = Math.max(lineHeightPx, maxLines * lineHeightPx);
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (ctx == null) throw new Error('Text canvas unavailable');
  ctx.font = fontSpec(drawPx, weight);
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = align === 'center' ? 'center' : 'left';
  if (useShadow) {
    ctx.shadowColor = 'rgba(2, 4, 12, 0.6)';
    ctx.shadowBlur = drawPx * 0.22;
    ctx.shadowOffsetY = drawPx * 0.06;
  }
  // Faux-bold: stroke behind fill thickens glyphs when only Regular weight is
  // loaded.  The stroke width scales with requested weight so 500 is neutral
  // and 600–700 adds visible heft.
  const fauxBold = false;
  if (fauxBold) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.5, drawPx * (weight - 400) / 600);
    ctx.lineJoin = 'round';
  }
  lines.forEach((line, index) => {
    const y = (canvasHeight - lines.length * lineHeightPx) / 2 + lineHeightPx * (index + 0.5);
    const x = align === 'center' ? canvasWidth / 2 : 12;
    if (fauxBold) { ctx.strokeText(line, x, y); }
    ctx.fillText(line, x, y);
  });

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;

  const worldW = maxWidth;
  const worldH = canvasHeight / PX_PER_METER;
  const mesh = new Mesh(
    new PlaneGeometry(worldW, worldH),
    new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  mesh.renderOrder = 5;
  mesh.userData.labelText = text;
  mesh.userData.isLociLabel = true;
  mesh.scale.setScalar(getTextScale());
  // Dynamic labels (e.g. the keyboard input field) redraw in place.
  mesh.userData.redraw = (newText: string): void => {
    mesh.userData.labelText = newText;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.font = fontSpec(drawPx, weight);
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = align === 'center' ? 'center' : 'left';
    if (useShadow) {
      ctx.shadowColor = 'rgba(2, 4, 12, 0.6)';
      ctx.shadowBlur = drawPx * 0.22;
      ctx.shadowOffsetY = drawPx * 0.06;
    }
    if (fauxBold) {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(0.5, drawPx * (weight - 400) / 600);
      ctx.lineJoin = 'round';
    }
    const redrawnLines = fitLines(ctx, newText, usablePx, maxLines);
    redrawnLines.forEach((line, index) => {
      const y = (canvasHeight - redrawnLines.length * lineHeightPx) / 2 + lineHeightPx * (index + 0.5);
      const x = align === 'center' ? canvasWidth / 2 : 12;
      if (fauxBold) { ctx.strokeText(line, x, y); }
      ctx.fillText(line, x, y);
    });
    texture.needsUpdate = true;
  };
  return mesh;
}
