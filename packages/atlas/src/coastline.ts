/**
 * Wonderdraft-style "Küstensaum & Wasser-Look" for the shared tile painter.
 *
 * Pure Canvas 2D helpers that decorate a single *water* cell after its base
 * blob fill has been drawn: a paler shallow-water rim on the edges facing land,
 * or 0–2 deterministic ripple arcs on open water. Splitting these helpers out of
 * `canvas-render.ts` keeps that module under its size budget; the coast feature
 * is fully additive — omit `coast` on {@link PaintTerrainBlobsOptions} and no
 * function here runs.
 *
 * Framework-agnostic beyond the `ctx` argument: no DOM access at module load.
 */

import { mulberry32 } from "./prng";

/** Coast styling knobs for the tile painter. All optional; absent ⇒ feature off. */
export interface CoastStyleOptions {
  /** Biome kinds treated as water. Default `["coast", "water"]`. */
  waterKinds?: string[];
  /** Explicit rim colour; when omitted the caller supplies a paler tint of the fill. */
  rimColor?: string;
  /** Rim band thickness as a fraction of the tile edge. Default `0.22`. */
  rimWidthRatio?: number;
  /** Ripple stroke colour. Default `"rgba(255,255,255,0.35)"`. */
  rippleColor?: string;
  /** Per-cell ripple seed base. Default `7`. */
  rippleSeed?: number;
  /** Multiplier on the number of ripple arcs. Default `1`. */
  rippleDensity?: number;
}

/** {@link CoastStyleOptions} with every default resolved (rimColor stays optional). */
export interface ResolvedCoastStyle {
  waterKinds: Set<string>;
  rimColor?: string;
  rimWidthRatio: number;
  rippleColor: string;
  rippleSeed: number;
  rippleDensity: number;
}

/** Canonical coast defaults — the values used when a knob is absent. */
export const COAST_DEFAULTS = {
  waterKinds: ["coast", "water"] as readonly string[],
  rimWidthRatio: 0.22,
  rippleColor: "rgba(255,255,255,0.35)",
  rippleSeed: 7,
  rippleDensity: 1,
} as const;

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Apply {@link COAST_DEFAULTS} to raw {@link CoastStyleOptions}. */
export function resolveCoastStyle(opts: CoastStyleOptions): ResolvedCoastStyle {
  const kinds =
    Array.isArray(opts.waterKinds) && opts.waterKinds.length > 0
      ? opts.waterKinds
      : COAST_DEFAULTS.waterKinds;
  return {
    waterKinds: new Set(kinds),
    rimColor: opts.rimColor,
    rimWidthRatio: finite(opts.rimWidthRatio)
      ? Math.max(0, Math.min(0.5, opts.rimWidthRatio))
      : COAST_DEFAULTS.rimWidthRatio,
    rippleColor: opts.rippleColor ?? COAST_DEFAULTS.rippleColor,
    rippleSeed: finite(opts.rippleSeed) ? opts.rippleSeed : COAST_DEFAULTS.rippleSeed,
    rippleDensity: finite(opts.rippleDensity)
      ? Math.max(0, opts.rippleDensity)
      : COAST_DEFAULTS.rippleDensity,
  };
}

/** Per-cell geometry + resolved rim colour handed to {@link paintCoastCell}. */
export interface CoastCellContext {
  col: number;
  row: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Concrete rim colour for this cell (caller applies its own default). */
  rimColor: string;
  /** True when the given neighbour cell holds a painted non-water biome. */
  isLand: (col: number, row: number) => boolean;
}

/** Opacity of the shallow-water rim band (applied via `globalAlpha`). */
const RIM_ALPHA = 0.55;
/** Ripple probability gate — cells whose first `rng()` is below this stay clear. */
const RIPPLE_GATE = 0.55;
/** Ripple stroke width as a fraction of the shorter tile edge. */
const RIPPLE_LINE_RATIO = 0.03;

/**
 * Decorate a single water cell. The caller guarantees the cell's biome is one
 * of {@link ResolvedCoastStyle.waterKinds} and that the base blob fill for this
 * cell has already been drawn (rims/ripples paint on top).
 *
 * - Land-facing edges (≥1 painted non-water 4-neighbour) get a paler rim band.
 * - Otherwise the cell is open water: 0–2 deterministic ripple arcs.
 */
export function paintCoastCell(
  ctx: CanvasRenderingContext2D,
  style: ResolvedCoastStyle,
  cell: CoastCellContext,
): void {
  const { col, row, x, y, w, h, rimColor, isLand } = cell;
  const left = isLand(col - 1, row);
  const right = isLand(col + 1, row);
  const top = isLand(col, row - 1);
  const bottom = isLand(col, row + 1);

  if (left || right || top || bottom) {
    const bandW = style.rimWidthRatio * w;
    const bandH = style.rimWidthRatio * h;
    ctx.save();
    ctx.globalAlpha = RIM_ALPHA;
    ctx.fillStyle = rimColor;
    if (left) ctx.fillRect(x, y, bandW, h);
    if (right) ctx.fillRect(x + w - bandW, y, bandW, h);
    if (top) ctx.fillRect(x, y, w, bandH);
    if (bottom) ctx.fillRect(x, y + h - bandH, w, bandH);
    ctx.restore();
    return;
  }

  paintRipples(ctx, style, cell);
}

/**
 * Draw the open-water ripple arcs for a cell. Deterministically seeded per cell
 * so the same inputs always yield the same draw calls; most cells draw nothing,
 * keeping the look sparse.
 */
function paintRipples(
  ctx: CanvasRenderingContext2D,
  style: ResolvedCoastStyle,
  cell: CoastCellContext,
): void {
  const { col, row, x, y, w, h } = cell;
  const rng = mulberry32(style.rippleSeed + col * 73856093 + row * 19349663);
  if (rng() < RIPPLE_GATE) return; // sparse: most open-water cells stay clear
  const baseArcs = rng() < 0.5 ? 1 : 2;
  const count = Math.max(0, Math.min(3, Math.round(baseArcs * style.rippleDensity)));
  if (count <= 0) return;

  ctx.save();
  ctx.strokeStyle = style.rippleColor;
  ctx.lineWidth = Math.min(w, h) * RIPPLE_LINE_RATIO;
  for (let i = 0; i < count; i++) {
    const len = w * (0.4 + rng() * 0.2); // 40–60% of the tile width
    const ax = x + rng() * Math.max(0, w - len);
    const ay = y + h * (0.2 + rng() * 0.6);
    const midX = ax + len / 2;
    const midY = ay - h * 0.12; // gentle upward bow
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(midX, midY, ax + len, ay);
    ctx.stroke();
  }
  ctx.restore();
}
