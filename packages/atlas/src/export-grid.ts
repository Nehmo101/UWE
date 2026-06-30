/**
 * Atlas export-grid engine — grid overlay geometry for map export.
 *
 * Computes the line segments of a grid overlay (square or hexagonal) clipped
 * to a rectangular export area, in pixel space.  Part of the "Canvas of
 * Kings"-style map export: export a definable area, with or without a grid.
 *
 * All functions are pure, deterministic, and framework-agnostic.  No DOM, no
 * Canvas APIs, no Node or external dependencies — the renderer (Canvas2D)
 * strokes the returned segments.
 *
 * Hexagons use a pointy-top orientation (a vertex points straight up), tiled
 * in offset rows; segment endpoints are clamped to the export rect so every
 * emitted point lies within its bounds.
 */

/** Which kind of grid to overlay. */
export type GridKind = "square" | "hex";

/** A rectangular export area in pixel space. */
export interface ExportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Describes the grid to build over an {@link ExportRect}. */
export interface GridSpec {
  kind: GridKind;
  /**
   * Cell size in the same units as the rect (pixels). For square: the cell
   * edge length. For hex: the hex size (centre-to-vertex radius). Must be > 0.
   */
  cellSize: number;
}

/** A single grid line segment with endpoints in pixel space. */
export interface GridLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Tolerance for treating a floating-point value as an exact cell boundary. */
const EPSILON = 1e-9;

/** Clamp `value` into the inclusive range `[lo, hi]`. */
function clamp(value: number, lo: number, hi: number): number {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

/**
 * Build the grid line segments overlaying `rect`.
 *
 * @param rect - Rectangular export area in pixel space.
 * @param spec - Grid kind and cell size.
 * @returns Line segments to stroke. Returns `[]` if `cellSize <= 0` or the
 *          rect has non-positive area.
 */
export function buildGridLines(rect: ExportRect, spec: GridSpec): GridLine[] {
  if (spec.cellSize <= 0) return [];
  if (rect.width <= 0 || rect.height <= 0) return [];

  return spec.kind === "hex"
    ? buildHexLines(rect, spec.cellSize)
    : buildSquareLines(rect, spec.cellSize);
}

// ---------------------------------------------------------------------------
// Square grid
// ---------------------------------------------------------------------------

/**
 * Build a square grid: vertical lines at `x = rect.x + k*cellSize` spanning the
 * full rect height, plus horizontal lines at `y = rect.y + k*cellSize` spanning
 * the full rect width. Boundary lines (k = 0 and the final multiple within the
 * rect) are included; all endpoints are clamped to the rect bounds.
 */
function buildSquareLines(rect: ExportRect, cellSize: number): GridLine[] {
  const minX = rect.x;
  const minY = rect.y;
  const maxX = rect.x + rect.width;
  const maxY = rect.y + rect.height;

  const lines: GridLine[] = [];

  const colCount = Math.floor(rect.width / cellSize + EPSILON);
  for (let k = 0; k <= colCount; k++) {
    const x = clamp(minX + k * cellSize, minX, maxX);
    lines.push({ x1: x, y1: minY, x2: x, y2: maxY });
  }

  const rowCount = Math.floor(rect.height / cellSize + EPSILON);
  for (let k = 0; k <= rowCount; k++) {
    const y = clamp(minY + k * cellSize, minY, maxY);
    lines.push({ x1: minX, y1: y, x2: maxX, y2: y });
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Hex grid (pointy-top)
// ---------------------------------------------------------------------------

/**
 * Build a pointy-top hexagonal grid tiled across `rect`.
 *
 * For hex size `s` (centre-to-vertex radius): hex width is `√3·s`, hex height
 * is `2·s`, rows are spaced `1.5·s` apart vertically, and odd rows are offset
 * horizontally by half a hex width. Whole hexes whose centre lies within (or
 * just outside) the rect are emitted as 6 edges each, with every endpoint
 * clamped to the rect bounds. Edges that collapse to a single clamped point
 * are dropped so no zero-length segments are returned.
 */
function buildHexLines(rect: ExportRect, size: number): GridLine[] {
  const minX = rect.x;
  const minY = rect.y;
  const maxX = rect.x + rect.width;
  const maxY = rect.y + rect.height;

  const hexWidth = Math.sqrt(3) * size;
  const vStep = 1.5 * size;

  const lines: GridLine[] = [];

  // One extra ring of hexes on every side guarantees full coverage of the
  // rect after clamping, regardless of where cell boundaries fall.
  const rowCount = Math.ceil(rect.height / vStep) + 2;
  const colCount = Math.ceil(rect.width / hexWidth) + 2;

  for (let r = -1; r <= rowCount; r++) {
    const cy = minY + r * vStep;
    // Skip rows whose hexes cannot intersect the rect at all.
    if (cy + size < minY || cy - size > maxY) continue;

    const rowOffset = (r & 1) === 0 ? 0 : hexWidth / 2;

    for (let c = -1; c <= colCount; c++) {
      const cx = minX + c * hexWidth + rowOffset;
      if (cx + hexWidth / 2 < minX || cx - hexWidth / 2 > maxX) continue;

      appendHex(lines, cx, cy, size, minX, minY, maxX, maxY);
    }
  }

  return lines;
}

/**
 * Append the 6 clamped edges of a single pointy-top hex centred at
 * `(cx, cy)` to `lines`, skipping any edge that collapses to a point.
 */
function appendHex(
  lines: GridLine[],
  cx: number,
  cy: number,
  size: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): void {
  const xs: number[] = [];
  const ys: number[] = [];

  for (let i = 0; i < 6; i++) {
    // Pointy-top: first vertex points straight up (90°), then every 60°.
    const angle = (Math.PI / 180) * (90 + 60 * i);
    xs.push(clamp(cx + size * Math.cos(angle), minX, maxX));
    ys.push(clamp(cy + size * Math.sin(angle), minY, maxY));
  }

  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6;
    const x1 = xs[i]!;
    const y1 = ys[i]!;
    const x2 = xs[j]!;
    const y2 = ys[j]!;
    if (x1 === x2 && y1 === y2) continue;
    lines.push({ x1, y1, x2, y2 });
  }
}
