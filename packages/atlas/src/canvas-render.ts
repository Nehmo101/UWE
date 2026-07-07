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

/**
 * Adjust the saturation/depth of a `#rrggbb` colour by an intensity factor.
 * `1` = unchanged, `<1` = paler/washed-out, `>1` = more saturated & slightly
 * deeper. Non-hex inputs are returned unchanged. Drives the per-biome
 * "Untergrund-Intensität" control.
 */
export function applyColorIntensity(color: string, factor: number): string {
  if (factor === 1 || !/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  const n = parseInt(color.slice(1), 16);
  const r = ((n >> 16) & 255) / 255,
    g = ((n >> 8) & 255) / 255,
    b = (n & 255) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    l = (max + min) / 2;
  let h = 0,
    s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  const s2 = Math.max(0, Math.min(1, s * factor));
  const l2 = Math.max(0, Math.min(1, l - (factor - 1) * 0.06));
  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l2 < 0.5 ? l2 * (1 + s2) : l2 + s2 - l2 * s2;
  const p = 2 * l2 - q;
  const to = (t: number) => Math.round(hue2rgb(p, q, t) * 255);
  return `rgb(${to(h + 1 / 3)},${to(h)},${to(h - 1 / 3)})`;
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
  /** Canvas-space width of soft biome-border blends. Default 0 keeps hard borders. */
  blendWidth?: number;
  /** Optional per-biome intensity factor (1 = unchanged). */
  intensityFor?: (biome: string) => number;
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
  const { cols, rows, getCell, tileRect, fillFor, radiusRatio = 0.4, intensityFor } = opts;
  const blendWidth =
    typeof opts.blendWidth === "number" && Number.isFinite(opts.blendWidth)
      ? Math.max(0, opts.blendWidth)
      : 0;
  const fillForBiome = (biome: string): string =>
    intensityFor ? applyColorIntensity(fillFor(biome), intensityFor(biome)) : fillFor(biome);

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const biome = getCell(c, r);
      if (!biome) continue;
      const { x, y, w, h } = tileRect(c, r);
      const radius = Math.min(w, h) * radiusRatio;
      ctx.fillStyle = fillForBiome(biome);

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

  if (blendWidth <= 0) return;

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const biome = getCell(c, r);
      if (!biome) continue;
      const { x, y, w, h } = tileRect(c, r);
      const from = fillForBiome(biome);

      const rightBiome = getCell(c + 1, r);
      if (rightBiome && rightBiome !== biome) {
        const edgeWidth = Math.min(blendWidth, w);
        if (edgeWidth > 0) {
          const half = edgeWidth / 2;
          const gradient = ctx.createLinearGradient(x + w - half, y, x + w + half, y);
          gradient.addColorStop(0, from);
          gradient.addColorStop(1, fillForBiome(rightBiome));
          ctx.fillStyle = gradient;
          ctx.fillRect(x + w - half, y, edgeWidth, h);
        }
      }

      const bottomBiome = getCell(c, r + 1);
      if (bottomBiome && bottomBiome !== biome) {
        const edgeHeight = Math.min(blendWidth, h);
        if (edgeHeight > 0) {
          const half = edgeHeight / 2;
          const gradient = ctx.createLinearGradient(x, y + h - half, x, y + h + half);
          gradient.addColorStop(0, from);
          gradient.addColorStop(1, fillForBiome(bottomBiome));
          ctx.fillStyle = gradient;
          ctx.fillRect(x, y + h - half, w, edgeHeight);
        }
      }
    }
  }
}

/**
 * Turn a hillshade RGBA buffer (from `buildHillshadeRGBA`, grid resolution)
 * into a tiny offscreen canvas. Renderers draw it stretched over the map rect
 * with image smoothing enabled, letting the browser's bilinear filter turn the
 * per-cell shading into a smooth overlay:
 *
 *   const shade = createHillshadeCanvas(rgba, cols, rows);   // cacheable
 *   ctx.imageSmoothingEnabled = true;
 *   ctx.drawImage(shade, x, y, w, h);                        // whole-map rect
 *
 * The returned canvas only changes when the height field changes, so callers
 * should cache it across pan/zoom frames.
 */
export function createHillshadeCanvas(
  rgba: Uint8ClampedArray,
  cols: number,
  rows: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, cols);
  canvas.height = Math.max(1, rows);
  const ctx = canvas.getContext("2d");
  if (ctx && cols > 0 && rows > 0 && rgba.length === cols * rows * 4) {
    ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), cols, rows), 0, 0);
  }
  return canvas;
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
  /**
   * Gouache mode: paint the trunk as a filled tapered ribbon with a darker
   * pigment edge and put leaf blobs on the tendril tips — the map's painted
   * Canvas-of-Kings look. When set, `trunk`/`coil`/`outline` become the
   * fallback stroke colours for coil/tendril lines only.
   */
  fill?: {
    /** Trunk body fill (e.g. "#6f9a4d"). */
    trunk: string;
    /** Trunk pigment edge (e.g. "#33531f"). */
    trunkEdge: string;
    /** Leaf blob fill on tendril tips. */
    leaf: string;
    /** Leaf pigment edge. */
    leafEdge: string;
  };
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

  // Gouache mode: filled tapered ribbon trunk + leaf blobs on tendril tips.
  if (opts.fill) {
    const f = opts.fill;
    // Build the ribbon polygon: spine ± half-width along the local normal.
    const left: Coordinate[] = [];
    const right: Coordinate[] = [];
    const n = spinePts.length;
    for (let i = 0; i < n; i++) {
      const prev = spinePts[Math.max(0, i - 1)]!;
      const next = spinePts[Math.min(n - 1, i + 1)]!;
      const tx = next[0] - prev[0];
      const ty = next[1] - prev[1];
      const len = Math.hypot(tx, ty) || 1;
      const nx = -ty / len;
      const ny = tx / len;
      const half = Math.max(0.5, (widths[i] ?? 0.2) * base) / 2;
      left.push([spinePts[i]![0] + nx * half, spinePts[i]![1] + ny * half]);
      right.push([spinePts[i]![0] - nx * half, spinePts[i]![1] - ny * half]);
    }
    ctx.beginPath();
    ctx.moveTo(left[0]![0], left[0]![1]);
    for (let i = 1; i < n; i++) ctx.lineTo(left[i]![0], left[i]![1]);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i]![0], right[i]![1]);
    ctx.closePath();
    ctx.fillStyle = f.trunk;
    ctx.fill();
    ctx.strokeStyle = selected ? "#c2622b" : f.trunkEdge;
    ctx.lineWidth = Math.max(0.8, 1.3 * zoom);
    ctx.stroke();

    // Highlight streak along the left flank — painted-light feel.
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(0.8, base * 0.14);
    strokePolyline(ctx, left.filter((_, i) => i % 2 === 0));
    ctx.restore();

    // Coil helix over the trunk (darker accent), tendrils + leaf blobs.
    ctx.strokeStyle = f.trunkEdge;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(0.8, 1.2 * zoom);
    strokePolyline(ctx, p(coil));
    ctx.globalAlpha = 1;
    ctx.strokeStyle = f.leafEdge;
    ctx.lineWidth = Math.max(0.8, 1.2 * zoom);
    for (const t of tendrils) {
      const tp = p(t);
      strokePolyline(ctx, tp);
      const tip = tp[tp.length - 1];
      if (tip) {
        const r = Math.max(1.6, base * 0.34);
        ctx.beginPath();
        ctx.ellipse(tip[0], tip[1], r, r * 0.62, 0.5, 0, Math.PI * 2);
        ctx.fillStyle = f.leaf;
        ctx.fill();
        ctx.stroke();
      }
    }

    // Tip aura — same faint rings as the stroke mode.
    const cA = project(aura.center);
    const eA = project([aura.center[0] + aura.radius, aura.center[1]]);
    const prA = Math.hypot(eA[0] - cA[0], eA[1] - cA[1]);
    if (prA > 1) {
      ctx.strokeStyle = f.leafEdge;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = Math.max(0.6, 1 * zoom);
      for (const fr of [1, 0.66]) {
        ctx.beginPath();
        ctx.arc(cA[0], cA[1], prA * fr, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
    return;
  }

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
