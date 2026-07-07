/**
 * Atlas elevation engine — height-field sampling, hillshade, contour lines,
 * and parallax/shadow offsets for the 2.5D height simulation.
 *
 * The height field rides on the terrain tile layer: a sparse `"col,row"` →
 * elevation `[0, 1]` map at the same grid resolution as the biome cells
 * (`0` = sea level, missing cells are `0`). All functions are pure and
 * framework-agnostic — no DOM, no Canvas APIs (the matching Canvas helper
 * lives in `canvas-render.ts`).
 *
 * Owner decisions (fixed):
 * - Light direction is FIXED northwest (azimuth 315°, altitude 45°),
 *   consistent with the existing biome relief shading (`buildReliefShading`).
 * - Parallax strength is a per-map setting (`AtlasTileLayer.parallaxStrength`).
 * - Contour lines are a per-map toggle (`AtlasTileLayer.contoursEnabled`).
 */

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

/**
 * The minimal grid shape the elevation engine needs. `AtlasTileLayer` is
 * structurally assignable, so renderers can pass the tile layer directly.
 */
export interface ElevationGrid {
  cols: number;
  rows: number;
  /** Sparse `"col,row"` → elevation [0, 1]; missing cells are 0 (sea level). */
  elevation?: Record<string, number> | null;
}

/** A single contour polyline in normalised world coordinates. */
export interface ContourLine {
  /** Elevation level of this isoline [0, 1]. */
  level: number;
  /** Every {@link CONTOUR_MAJOR_EVERY}-th line renders bolder (classic map style). */
  major: boolean;
  /** Polyline points in normalised [0, 1] world space. */
  points: [number, number][];
}

/** Default per-map parallax strength (0 disables, 1 = maximum). Deliberately subtle. */
export const DEFAULT_PARALLAX_STRENGTH = 0.35;

/** Default number of contour steps between elevation 0 and 1. */
export const DEFAULT_CONTOUR_STEPS = 5;

/** Every n-th contour line is drawn bolder ("Zähllinie"). */
export const CONTOUR_MAJOR_EVERY = 5;

/** Vertical exaggeration applied when deriving slopes from the [0,1] field. */
const VERTICAL_SCALE = 6;

/** Global multiplier converting elevation×strength into a parallax fraction. */
const PARALLAX_FACTOR = 0.08;

/** Fixed NW light: unit vector towards the light at 45° altitude. */
const LIGHT_X = -0.5;
const LIGHT_Y = -0.5;
const LIGHT_Z = Math.SQRT1_2;

/** Hillshade overlay tuning: contrast gain and maximum overlay alpha. */
const HILLSHADE_GAIN = 1.35;
const HILLSHADE_MAX_ALPHA = 0.42;

/** Highlight / shadow overlay colours (parchment-friendly warm tones). */
const HIGHLIGHT_RGB: [number, number, number] = [255, 250, 235];
const SHADOW_RGB: [number, number, number] = [45, 35, 20];

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// ---------------------------------------------------------------------------
// Sampling
// ---------------------------------------------------------------------------

/**
 * Elevation of a single cell; out-of-range indices clamp to the edge so
 * gradients stay well-defined at the map border.
 */
export function cellElevation(grid: ElevationGrid, col: number, row: number): number {
  const { cols, rows, elevation } = grid;
  if (!elevation || cols <= 0 || rows <= 0) return 0;
  const c = col < 0 ? 0 : col >= cols ? cols - 1 : col;
  const r = row < 0 ? 0 : row >= rows ? rows - 1 : row;
  const v = elevation[`${c},${r}`];
  return typeof v === "number" && Number.isFinite(v) ? clamp01(v) : 0;
}

/** True when the grid carries any elevation above sea level. */
export function hasElevation(grid: ElevationGrid): boolean {
  const { elevation } = grid;
  if (!elevation) return false;
  for (const key of Object.keys(elevation)) {
    const v = elevation[key];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return true;
  }
  return false;
}

/**
 * Bilinearly interpolated elevation at a normalised world position [0, 1]².
 * Samples are anchored at cell centres, so values vary smoothly across cells.
 */
export function sampleElevation(grid: ElevationGrid, nx: number, ny: number): number {
  const { cols, rows } = grid;
  if (!grid.elevation || cols <= 0 || rows <= 0) return 0;
  // Position in cell-centre space
  const gx = clamp01(nx) * cols - 0.5;
  const gy = clamp01(ny) * rows - 0.5;
  const c0 = Math.floor(gx);
  const r0 = Math.floor(gy);
  const tx = gx - c0;
  const ty = gy - r0;
  const v00 = cellElevation(grid, c0, r0);
  const v10 = cellElevation(grid, c0 + 1, r0);
  const v01 = cellElevation(grid, c0, r0 + 1);
  const v11 = cellElevation(grid, c0 + 1, r0 + 1);
  const top = v00 + (v10 - v00) * tx;
  const bottom = v01 + (v11 - v01) * tx;
  return top + (bottom - top) * ty;
}

/**
 * Sample the height field at each vertex of a path — plugs directly into
 * `scatterGlyphsAlongPath(path, biome, spacing, heightMetadata, seed)` so
 * ridge glyphs grow where the map is high.
 */
export function sampleElevationAlongPath(
  grid: ElevationGrid,
  coords: readonly [number, number][],
): number[] {
  return coords.map(([x, y]) => sampleElevation(grid, x, y));
}

// ---------------------------------------------------------------------------
// Hillshade
// ---------------------------------------------------------------------------

/**
 * Compute a hillshade overlay as an RGBA buffer at grid resolution
 * (`cols × rows × 4`). Flat terrain is fully transparent; NW-facing slopes get
 * a warm highlight, SE-facing slopes a soft shadow (fixed NW light, matching
 * the existing biome relief shading). Renderers put this into a tiny offscreen
 * canvas and draw it stretched over the map with image smoothing enabled —
 * the browser's bilinear filter turns the cell grid into smooth shading
 * (see `createHillshadeCanvas` in `canvas-render.ts`).
 */
export function buildHillshadeRGBA(grid: ElevationGrid): Uint8ClampedArray {
  const { cols, rows } = grid;
  const out = new Uint8ClampedArray(Math.max(0, cols) * Math.max(0, rows) * 4);
  if (!grid.elevation || cols <= 0 || rows <= 0) return out;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Central differences (edge-clamped) → surface normal.
      const dzdx = ((cellElevation(grid, c + 1, r) - cellElevation(grid, c - 1, r)) / 2) * VERTICAL_SCALE;
      const dzdy = ((cellElevation(grid, c, r + 1) - cellElevation(grid, c, r - 1)) / 2) * VERTICAL_SCALE;
      if (dzdx === 0 && dzdy === 0) continue;
      const invLen = 1 / Math.hypot(dzdx, dzdy, 1);
      // Lambert against the fixed NW light; flat ground scores LIGHT_Z.
      const shade =
        (-dzdx * LIGHT_X - dzdy * LIGHT_Y + LIGHT_Z) * invLen;
      const delta = shade - LIGHT_Z;
      if (delta === 0) continue;
      const alpha = Math.min(1, Math.abs(delta) * HILLSHADE_GAIN) * HILLSHADE_MAX_ALPHA;
      const [cr, cg, cb] = delta > 0 ? HIGHLIGHT_RGB : SHADOW_RGB;
      const i = (r * cols + c) * 4;
      out[i] = cr;
      out[i + 1] = cg;
      out[i + 2] = cb;
      out[i + 3] = Math.round(alpha * 255);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Contour lines (marching squares over cell-centre samples)
// ---------------------------------------------------------------------------

type Pt = [number, number];

/** Quantised endpoint key so segments chain into polylines. */
function ptKey(p: Pt): string {
  return `${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)}`;
}

/** Chain unordered segments into polylines (open or closed). */
function chainSegments(segments: [Pt, Pt][]): Pt[][] {
  const adj = new Map<string, { pt: Pt; segs: number[] }>();
  const used = new Array<boolean>(segments.length).fill(false);
  segments.forEach((seg, i) => {
    for (const pt of seg) {
      const key = ptKey(pt);
      const entry = adj.get(key);
      if (entry) entry.segs.push(i);
      else adj.set(key, { pt, segs: [i] });
    }
  });

  const lines: Pt[][] = [];
  for (let start = 0; start < segments.length; start++) {
    if (used[start]) continue;
    used[start] = true;
    const line: Pt[] = [segments[start]![0], segments[start]![1]];
    // Extend forwards then backwards.
    for (const dir of [1, -1] as const) {
      for (;;) {
        const tip = dir === 1 ? line[line.length - 1]! : line[0]!;
        const entry = adj.get(ptKey(tip));
        const nextIdx = entry?.segs.find((i) => !used[i]);
        if (nextIdx === undefined) break;
        used[nextIdx] = true;
        const [a, b] = segments[nextIdx]!;
        const next = ptKey(a) === ptKey(tip) ? b : a;
        if (dir === 1) line.push(next);
        else line.unshift(next);
      }
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Extract smoothed-ready contour polylines from the height field via marching
 * squares over cell-centre samples. Levels are evenly spaced between 0 and 1
 * (`steps` intervals → `steps − 1` isolines); every
 * {@link CONTOUR_MAJOR_EVERY}-th line is flagged `major`.
 */
export function buildContourLines(
  grid: ElevationGrid,
  steps: number = DEFAULT_CONTOUR_STEPS,
): ContourLine[] {
  const { cols, rows } = grid;
  const n = Math.max(2, Math.min(24, Math.round(steps)));
  if (!grid.elevation || cols < 2 || rows < 2 || !hasElevation(grid)) return [];

  // Node position of a cell-centre sample in normalised world space.
  const nodeX = (c: number) => (c + 0.5) / cols;
  const nodeY = (r: number) => (r + 0.5) / rows;

  const result: ContourLine[] = [];
  for (let li = 1; li < n; li++) {
    const level = li / n;
    const segments: [Pt, Pt][] = [];

    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const tl = cellElevation(grid, c, r);
        const tr = cellElevation(grid, c + 1, r);
        const br = cellElevation(grid, c + 1, r + 1);
        const bl = cellElevation(grid, c, r + 1);
        const idx =
          (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0);
        if (idx === 0 || idx === 15) continue;

        // Interpolated crossing points on the four square edges.
        const lerp = (a: number, b: number) => (level - a) / (b - a);
        const top: Pt = [nodeX(c) + lerp(tl, tr) / cols, nodeY(r)];
        const right: Pt = [nodeX(c + 1), nodeY(r) + lerp(tr, br) / rows];
        const bottom: Pt = [nodeX(c) + lerp(bl, br) / cols, nodeY(r + 1)];
        const left: Pt = [nodeX(c), nodeY(r) + lerp(tl, bl) / rows];

        const push = (a: Pt, b: Pt) => segments.push([a, b]);
        switch (idx) {
          case 1: push(left, bottom); break;
          case 2: push(bottom, right); break;
          case 3: push(left, right); break;
          case 4: push(top, right); break;
          case 5: { // saddle TR+BL
            const centerAbove = (tl + tr + br + bl) / 4 > level;
            if (centerAbove) { push(top, left); push(bottom, right); }
            else { push(top, right); push(left, bottom); }
            break;
          }
          case 6: push(top, bottom); break;
          case 7: push(top, left); break;
          case 8: push(top, left); break;
          case 9: push(top, bottom); break;
          case 10: { // saddle TL+BR
            const centerAbove = (tl + tr + br + bl) / 4 > level;
            if (centerAbove) { push(top, right); push(left, bottom); }
            else { push(top, left); push(bottom, right); }
            break;
          }
          case 11: push(top, right); break;
          case 12: push(left, right); break;
          case 13: push(bottom, right); break;
          case 14: push(left, bottom); break;
        }
      }
    }

    if (!segments.length) continue;
    const major = li % CONTOUR_MAJOR_EVERY === 0;
    for (const points of chainSegments(segments)) {
      if (points.length >= 2) result.push({ level, major, points });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Parallax & shadow offsets
// ---------------------------------------------------------------------------

/**
 * View-dependent parallax offset (canvas pixels) for content at elevation `e`.
 * Elevated content shifts away from the viewport centre, so panning makes
 * mountains and towers visibly "stand up" over the plain. Purely visual —
 * hit-testing stays at the ground position (tactical anchor).
 *
 * @param e        - Elevation [0, 1].
 * @param canvasX  - Content x in canvas pixels.
 * @param canvasY  - Content y in canvas pixels.
 * @param centerX  - Viewport centre x in canvas pixels.
 * @param centerY  - Viewport centre y in canvas pixels.
 * @param strength - Per-map parallax strength [0, 1] (0 disables).
 */
export function parallaxCanvasOffset(
  e: number,
  canvasX: number,
  canvasY: number,
  centerX: number,
  centerY: number,
  strength: number,
): [number, number] {
  if (!(e > 0) || !(strength > 0)) return [0, 0];
  const k = clamp01(e) * clamp01(strength) * PARALLAX_FACTOR;
  return [(canvasX - centerX) * k, (canvasY - centerY) * k];
}

/**
 * Ground-shadow offset (canvas pixels) for content at elevation `e` — cast
 * towards the southeast because the light is fixed northwest.
 */
export function elevationShadowOffset(e: number, zoom: number): [number, number] {
  const d = clamp01(e) * zoom;
  return [d * 10, d * 7];
}

// ---------------------------------------------------------------------------
// Normalisation (doc migration support)
// ---------------------------------------------------------------------------

/**
 * Normalise a raw `elevation` value from a persisted document: keeps only
 * `"col,row"`-keyed finite numbers, clamps to [0, 1], drops zero/invalid
 * entries. Returns `undefined` when nothing remains (keeps docs sparse).
 */
export function normalizeElevationCells(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const out: Record<string, number> = {};
  let any = false;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d+,\d+$/.test(key)) continue;
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) continue;
    out[key] = clamp01(raw);
    any = true;
  }
  return any ? out : undefined;
}

/** Clamp a raw per-map parallax strength to [0, 1]; invalid → default. */
export function normalizeParallaxStrength(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_PARALLAX_STRENGTH;
  return clamp01(value);
}

/** Clamp a raw contour step count to a sane integer range [2, 24]. */
export function normalizeContourSteps(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_CONTOUR_STEPS;
  return Math.max(2, Math.min(24, Math.round(value)));
}
