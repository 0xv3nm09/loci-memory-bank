import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  LinearFilter,
} from 'three';

const PX_PER_METER = 1024;
const LINE_HEIGHT = 1.32;

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
  const { maxWidth, maxLines = 4, color = '#eef1ff', align = 'center' } = options;
  const px = Math.max(12, Math.round(fontSize * PX_PER_METER));
  const weight = options.fontWeight ?? 500;
  const useShadow = options.shadow !== false;
  const maxWidthPx = Math.round(maxWidth * PX_PER_METER);
  const usablePx = maxWidthPx - 16;

  const measure = document.createElement('canvas');
  const mctx = measure.getContext('2d')!;
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
  const canvasHeight = Math.max(lineHeightPx, lines.length * lineHeightPx);
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.font = fontSpec(drawPx, weight);
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  if (useShadow) {
    ctx.shadowColor = 'rgba(2, 4, 12, 0.6)';
    ctx.shadowBlur = drawPx * 0.16;
    ctx.shadowOffsetY = drawPx * 0.05;
  }
  lines.forEach((line, index) => {
    const y = lineHeightPx * (index + 0.5);
    const x = align === 'center' ? canvasWidth / 2 : 8;
    ctx.fillText(line, x, y);
  });

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;

  const worldW = maxWidth;
  const worldH = canvasHeight / PX_PER_METER;
  const mesh = new Mesh(
    new PlaneGeometry(worldW, worldH),
    new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }),
  );
  mesh.renderOrder = 5;
  // Dynamic labels (e.g. the keyboard input field) redraw in place.
  mesh.userData.redraw = (newText: string): void => {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.font = fontSpec(drawPx, weight);
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    if (useShadow) {
      ctx.shadowColor = 'rgba(2, 4, 12, 0.6)';
      ctx.shadowBlur = drawPx * 0.16;
      ctx.shadowOffsetY = drawPx * 0.05;
    }
    const redrawnLines = fitLines(ctx, newText, usablePx, maxLines);
    redrawnLines.forEach((line, index) => {
      const y = lineHeightPx * (index + 0.5);
      const x = align === 'center' ? canvasWidth / 2 : 8;
      ctx.fillText(line, x, y);
    });
    texture.needsUpdate = true;
  };
  return mesh;
}
