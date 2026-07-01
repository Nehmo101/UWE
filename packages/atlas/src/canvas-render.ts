/**
 * Canvas 2D rendering helpers for the Atlas runtime.
 *
 * These are the only Atlas engine functions coupled to a `CanvasRenderingContext2D`.
 * They contain no DOM access at module load (only function bodies touch `ctx`),
 * so importing this module in Node is safe; the functions are exercised in the
 * browser (and the M1 `atlas.html` runtime), not in the Node test suite.
 */

/**
 * Trace a rounded rectangle sub-path (compatible with browsers lacking
 * `ctx.roundRect`). The caller is responsible for `fill`/`stroke`.
 */
export function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Options for {@link paintTerrainBlobs}. */
export interface PaintTerrainBlobsOptions {
  /** Number of tile columns. */
  cols: number;
  /** Number of tile rows. */
  rows: number;
  /** Biome kind at a cell, or a falsy value for an empty cell. */
  getCell: (col: number, row: number) => string | undefined | null;
  /** Canvas-space rectangle for a cell. */
  tileRect: (col: number, row: number) => { x: number; y: number; w: number; h: number };
  /** CSS fill colour for a biome kind. */
  fillFor: (biome: string) => string;
  /** Corner radius relative to the tile edge (0..0.5, default 0.4). */
  radiusRatio?: number;
}

/**
 * Paint the whole tile layer with flowing, rounded edges (Canvas of Kings
 * style): each tile is a rounded rect; same-biome neighbours to the right and
 * below are bridged so equal tiles merge into organic areas while real biome
 * borders stay rounded.
 */
export function paintTerrainBlobs(
  ctx: CanvasRenderingContext2D,
  opts: PaintTerrainBlobsOptions,
): void {
  const { cols, rows, getCell, tileRect, fillFor, radiusRatio = 0.4 } = opts;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const biome = getCell(c, r);
      if (!biome) continue;
      const { x, y, w, h } = tileRect(c, r);
      const radius = Math.min(w, h) * radiusRatio;
      ctx.fillStyle = fillFor(biome);

      roundedRectPath(ctx, x, y, w, h, radius);
      ctx.fill();

      const rightSame = getCell(c + 1, r) === biome;
      const bottomSame = getCell(c, r + 1) === biome;
      const diagSame = getCell(c + 1, r + 1) === biome;

      if (rightSame) ctx.fillRect(x + w - radius, y, radius * 2, h);
      if (bottomSame) ctx.fillRect(x, y + h - radius, w, radius * 2);
      // Only close the inner corner when right, bottom AND diagonal share the
      // biome — otherwise the concave rounding stays visible, which is exactly
      // what makes borders between different biomes read as flowing, not blocky.
      if (rightSame && bottomSame && diagSame) {
        ctx.fillRect(x + w - radius, y + h - radius, radius * 2, radius * 2);
      }
    }
  }
}

/**
 * Draw an SVG path string onto a Canvas 2D context. Minimal parser supporting
 * only absolute `M L H V Z Q C` commands — the exact subset every
 * `BUILTIN_GLYPHS.pathData` uses. The caller sets up `beginPath`/stroke style
 * and strokes/fills afterwards.
 */
export function drawSvgPath(ctx: CanvasRenderingContext2D, d: string): void {
  const cmds = d.match(/[MLHVZQC][^MLHVZQC]*/gi) || [];
  let x = 0;
  let y = 0;
  for (const cmd of cmds) {
    const op = cmd[0]!.toUpperCase();
    const a = cmd.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);
    switch (op) {
      case "M":
        x = a[0]!;
        y = a[1]!;
        ctx.moveTo(x, y);
        break;
      case "L":
        x = a[0]!;
        y = a[1]!;
        ctx.lineTo(x, y);
        break;
      case "H":
        x = a[0]!;
        ctx.lineTo(x, y);
        break;
      case "V":
        y = a[0]!;
        ctx.lineTo(x, y);
        break;
      case "Z":
        ctx.closePath();
        break;
      case "Q":
        ctx.quadraticCurveTo(a[0]!, a[1]!, a[2]!, a[3]!);
        x = a[2]!;
        y = a[3]!;
        break;
      case "C":
        ctx.bezierCurveTo(a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!);
        x = a[4]!;
        y = a[5]!;
        break;
      default:
        break;
    }
  }
}
