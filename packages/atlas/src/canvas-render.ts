/**
 * Canvas 2D rendering helpers for the Atlas runtime.
 *
 * These are the only Atlas engine functions coupled to a `CanvasRenderingContext2D`.
 * They contain no DOM access at module load (only function bodies touch `ctx`),
 * so importing this module in Node is safe; the functions are exercised in the
 * browser (and the M1 `atlas.html` runtime), not in the Node test suite.
 */

import type { Coordinate } from "./geometry";
import type { VineLayout } from "./vine";

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

/** Options for {@link drawCompassRose}. */
export interface CompassRoseOptions {
  /** Centre x in canvas pixels. */
  x: number;
  /** Centre y in canvas pixels. */
  y: number;
  /** Outer radius in canvas pixels. */
  radius: number;
  /** Main ink colour (disc outline, north/ordinal points, "N" letter). */
  ink: string;
  /** Accent colour for the south point (tolkien-ink red). */
  accent: string;
  /** Disc fill colour (parchment). */
  parchment: string;
}

/**
 * Draw an eight-point compass rose (long cardinal points, short ordinal
 * points, "N" letter above the north tip). Pure Canvas 2D — used by the map
 * runtime overlay and baked into PNG exports.
 */
export function drawCompassRose(ctx: CanvasRenderingContext2D, opts: CompassRoseOptions): void {
  const { x, y, radius: r, ink, accent, parchment } = opts;
  if (r <= 0) return;

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = parchment;
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1, r * 0.045);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, r * 0.62, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(0.5, r * 0.02);
  ctx.stroke();

  // Eight points starting at north, clockwise. Cardinals are long, ordinals short.
  for (let i = 0; i < 8; i++) {
    const cardinal = i % 2 === 0;
    const len = cardinal ? r * 0.9 : r * 0.5;
    const half = cardinal ? r * 0.14 : r * 0.09;
    const a = -Math.PI / 2 + (i * Math.PI) / 4;
    const tipX = x + Math.cos(a) * len;
    const tipY = y + Math.sin(a) * len;
    const lx = x + Math.cos(a - Math.PI / 2) * half;
    const ly = y + Math.sin(a - Math.PI / 2) * half;
    const rx = x + Math.cos(a + Math.PI / 2) * half;
    const ry = y + Math.sin(a + Math.PI / 2) * half;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(lx, ly);
    ctx.lineTo(rx, ry);
    ctx.closePath();
    ctx.fillStyle = i === 4 ? accent : ink;
    ctx.fill();
  }

  ctx.fillStyle = ink;
  ctx.font = `bold ${Math.max(8, Math.round(r * 0.3))}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("N", x, y - r * 0.98);
}

/** Options for {@link drawScaleBar}. */
export interface ScaleBarOptions {
  /** Left edge in canvas pixels. */
  x: number;
  /** Top edge in canvas pixels. */
  y: number;
  /** Bar width in canvas pixels. */
  width: number;
  /** Bar height in canvas pixels. */
  height: number;
  /** Number of alternating segments (default 4). */
  segments?: number;
  /** Ink colour (dark segments, outline, label). */
  ink: string;
  /** Parchment colour (light segments). */
  parchment: string;
  /** Optional label rendered centred below the bar (e.g. "0 — 100 leagues"). */
  label?: string;
  /** Optional CSS font for the label. */
  font?: string;
}

/**
 * Draw a classic alternating-segment map scale bar with an optional unit
 * label below. Pure Canvas 2D — used by the runtime and PNG exports.
 */
export function drawScaleBar(ctx: CanvasRenderingContext2D, opts: ScaleBarOptions): void {
  const { x, y, width, height, segments = 4, ink, parchment, label, font } = opts;
  if (width <= 0 || height <= 0 || segments < 1) return;

  const segW = width / segments;
  for (let i = 0; i < segments; i++) {
    ctx.fillStyle = i % 2 === 0 ? ink : parchment;
    ctx.fillRect(x + i * segW, y, segW, height);
  }
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1, height * 0.12);
  ctx.strokeRect(x, y, width, height);

  if (label) {
    ctx.fillStyle = ink;
    ctx.font = font ?? `${Math.max(8, Math.round(height * 1.4))}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(label, x + width / 2, y + height + Math.max(2, height * 0.4));
  }
}

/** Options for {@link drawVine}. */
export interface DrawVineOptions {
  /** Project a normalised [0,1] coordinate to canvas pixels (caller's pan/zoom). */
  project: (c: Coordinate) => Coordinate;
  /** Current zoom — scales trunk width to pixels. */
  zoom: number;
  /** Trunk stroke colour (bark ink). */
  trunk: string;
  /** Coil + tendril stroke colour (lighter green). */
  coil: string;
  /** Cast-shadow colour (semi-transparent ink, e.g. "rgba(26,16,8,0.18)"). */
  shadow: string;
  /**
   * Outline stroked beneath trunk/coil/tendrils, in a wider width — keeps a
   * light trunk colour (e.g. white) legible over parchment and biome fills.
   * Omitted for no outline.
   */
  outline?: string;
  /** Relative multiplier applied to the base trunk width. Default 1. */
  thickness?: number;
  /** Draw a heavier trunk + highlight when selected. */
  selected?: boolean;
}

/** Base trunk width in pixels at relative width 1.0 (before zoom, before thickness). */
const VINE_TRUNK_BASE_PX = 9;
/** Extra pixels added to the outline pass width, before zoom. */
const VINE_OUTLINE_PX = 2.6;

/** Stroke a polyline of already-projected canvas points. */
function strokePolyline(ctx: CanvasRenderingContext2D, pts: Coordinate[]): void {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
  ctx.stroke();
}

/** Stroke each spine segment with its own tapered width (+ optional extra px). */
function strokeTaperedTrunk(
  ctx: CanvasRenderingContext2D,
  pts: Coordinate[],
  widths: number[],
  base: number,
  extraPx: number,
): void {
  for (let i = 0; i < pts.length - 1; i++) {
    ctx.lineWidth = Math.max(0.6, widths[i]! * base) + extraPx;
    ctx.beginPath();
    ctx.moveTo(pts[i]![0], pts[i]![1]);
    ctx.lineTo(pts[i + 1]![0], pts[i + 1]![1]);
    ctx.stroke();
  }
}

/**
 * Draw a giant vine/root ({@link VineLayout}) as static pseudo-3D: cast shadow,
 * tapered coiling trunk (variable per-segment width, thick base → thin tip),
 * side tendrils, and faint tip-aura rings. The tip cloud glyphs in
 * `layout.aura.clouds` are drawn by the caller via the glyph pipeline so every
 * renderer shares one glyph path. Pure Canvas 2D — no DOM beyond `ctx`.
 */
export function drawVine(
  ctx: CanvasRenderingContext2D,
  layout: VineLayout,
  opts: DrawVineOptions,
): void {
  const { spine, widths, coil, tendrils, shadow, aura } = layout;
  if (spine.length < 2) return;
  const { project, zoom, selected } = opts;
  const p = (pts: Coordinate[]): Coordinate[] => pts.map(project);
  const base = VINE_TRUNK_BASE_PX * (opts.thickness ?? 1) * zoom * (selected ? 1.15 : 1);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // 1) Cast shadow — one soft stroke roughly trunk-width.
  const shadowPts = p(shadow);
  ctx.strokeStyle = opts.shadow;
  ctx.lineWidth = Math.max(1, base * 0.75);
  strokePolyline(ctx, shadowPts);

  const spinePts = p(spine);

  // 2) Optional outline pass — wider stroke beneath trunk/coil/tendrils, keeps
  // a light trunk colour (e.g. white) legible over parchment and biome fills.
  if (opts.outline) {
    const outlinePx = VINE_OUTLINE_PX * zoom;
    ctx.strokeStyle = opts.outline;
    strokeTaperedTrunk(ctx, spinePts, widths, base, outlinePx);
    ctx.lineWidth = Math.max(0.8, 1.4 * zoom) + outlinePx;
    strokePolyline(ctx, p(coil));
    for (const t of tendrils) strokePolyline(ctx, p(t));
  }

  // 3) Trunk — per-segment taper (thick base → thin tip), like the river taper.
  ctx.strokeStyle = opts.trunk;
  strokeTaperedTrunk(ctx, spinePts, widths, base, 0);

  // 4) Coil helix + tendrils — thin accent strokes.
  ctx.strokeStyle = opts.coil;
  ctx.lineWidth = Math.max(0.8, 1.4 * zoom);
  strokePolyline(ctx, p(coil));
  for (const t of tendrils) strokePolyline(ctx, p(t));

  // 5) Tip aura — a couple of faint concentric rings.
  const c = project(aura.center);
  const edge = project([aura.center[0] + aura.radius, aura.center[1]]);
  const pr = Math.hypot(edge[0] - c[0], edge[1] - c[1]);
  if (pr > 1) {
    ctx.strokeStyle = opts.coil;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = Math.max(0.6, 1 * zoom);
    for (const f of [1, 0.66]) {
      ctx.beginPath();
      ctx.arc(c[0], c[1], pr * f, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
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
