/**
 * Atlas plot-fill engine — deterministic object scattering inside a polygon.
 *
 * A `plot` feature is the editable source area; this helper produces regular
 * Atlas objects that can be reviewed, moved, saved, and rendered like manually
 * placed stamps. The helper is pure and framework-agnostic.
 */

import type { Polygon } from "./geometry";
import { mulberry32 } from "./prng";
import type { ScatterExclusion } from "./terrain";

export interface PlotFillAssetChoice {
  /** Gouache asset key persisted in `AtlasObject.style.gouache`. */
  gouacheKey: string;
  /** Relative selection weight. Defaults to 1. */
  weight?: number;
  /** Per-object scale range. Defaults to 0.78..1.22. */
  scaleMin?: number;
  scaleMax?: number;
  /** Per-object rotation range in degrees. Defaults to -12..12. */
  rotateMin?: number;
  rotateMax?: number;
  /** Optional default edge weight carried into object style. */
  lineWidth?: number;
  /** Optional default blur carried into object style. */
  blur?: number;
}

export interface PlotFillOptions {
  /** Palette item used as the FK carrier. In Studio this may be a client glyph key before save. */
  paletteItemId: string;
  /** Candidate gouache assets for the scatter. */
  assets: readonly PlotFillAssetChoice[];
  /** Density multiplier. 1 = natural density for the polygon area. */
  density?: number;
  /** Deterministic seed. */
  seed?: number;
  /** Optional corridors to keep clear (roads, rivers, vines). */
  exclusions?: readonly ScatterExclusion[];
  /** Stable prefix for generated object ids. */
  idPrefix?: string;
  /** Draw layer for generated objects. Defaults to 50. */
  layer?: number;
  /** Visibility copied onto generated objects. Defaults to dm_only. */
  visibility?: string;
}

export interface PlotFillObject {
  id: string;
  paletteItemId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  layer: number;
  visibility: string;
  style: {
    gouache: string;
    lineWidth?: number;
    blur?: number;
  };
}

const BASE_PLOT_DENSITY = 42;

function ringBbox(ring: [number, number][]): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

function ringArea(ring: [number, number][]): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j]![0] + ring[i]![0]) * (ring[j]![1] - ring[i]![1]);
  }
  return Math.abs(area / 2);
}

function pointInRing(px: number, py: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function inExclusion(x: number, y: number, exclusions: readonly ScatterExclusion[]): boolean {
  for (const ex of exclusions) {
    const half = ex.width / 2;
    if (half <= 0) continue;
    for (let i = 0; i < ex.path.length - 1; i++) {
      const [ax, ay] = ex.path[i]!;
      const [bx, by] = ex.path[i + 1]!;
      if (distToSegment(x, y, ax, ay, bx, by) < half) return true;
    }
  }
  return false;
}

function pickAsset(assets: readonly PlotFillAssetChoice[], roll: number): PlotFillAssetChoice {
  const weights = assets.map((asset) => Math.max(0, asset.weight ?? 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return assets[0]!;
  let cursor = roll * total;
  for (let i = 0; i < assets.length; i++) {
    cursor -= weights[i]!;
    if (cursor <= 0) return assets[i]!;
  }
  return assets[assets.length - 1]!;
}

function polygonArea(rings: readonly [number, number][][]): number {
  const outer = rings[0];
  if (!outer) return 0;
  const holes = rings.slice(1).reduce((sum, ring) => sum + ringArea(ring), 0);
  return Math.max(0, ringArea(outer) - holes);
}

/**
 * Fill a polygon with regular gouache Atlas objects.
 */
export function fillPlotWithGouacheAssets(
  polygon: Polygon,
  options: PlotFillOptions,
): PlotFillObject[] {
  const assets = options.assets.filter((asset) => asset.gouacheKey && (asset.weight ?? 1) > 0);
  const density = options.density ?? 1;
  if (assets.length === 0 || density <= 0) return [];

  const outer = polygon.rings[0] as [number, number][] | undefined;
  if (!outer || outer.length < 3) return [];

  const holes = polygon.rings.slice(1) as [number, number][][];
  const area = polygonArea(polygon.rings as [number, number][][]);
  if (area <= 0) return [];

  const seed = options.seed ?? 1337;
  const rng = mulberry32(seed);
  const [minX, minY, maxX, maxY] = ringBbox(outer);
  const targetCount = Math.max(1, Math.round(BASE_PLOT_DENSITY * density * area));
  const maxAttempts = targetCount * 10;
  const results: PlotFillObject[] = [];
  let attempts = 0;

  while (results.length < targetCount && attempts < maxAttempts) {
    attempts++;
    const x = minX + rng() * (maxX - minX);
    const y = minY + rng() * (maxY - minY);
    if (!pointInRing(x, y, outer)) continue;
    if (holes.some((ring) => pointInRing(x, y, ring))) continue;
    if (options.exclusions?.length && inExclusion(x, y, options.exclusions)) continue;

    const asset = pickAsset(assets, rng());
    const scaleMin = asset.scaleMin ?? 0.78;
    const scaleMax = asset.scaleMax ?? 1.22;
    const rotateMin = asset.rotateMin ?? -12;
    const rotateMax = asset.rotateMax ?? 12;
    const style: PlotFillObject["style"] = { gouache: asset.gouacheKey };
    if (asset.lineWidth != null) style.lineWidth = asset.lineWidth;
    if (asset.blur != null) style.blur = asset.blur;

    results.push({
      id: `${options.idPrefix ?? `plot-${seed}`}-${results.length}`,
      paletteItemId: options.paletteItemId,
      x,
      y,
      scale: scaleMin + rng() * (scaleMax - scaleMin),
      rotation: rotateMin + rng() * (rotateMax - rotateMin),
      layer: options.layer ?? 50,
      visibility: options.visibility ?? "dm_only",
      style,
    });
  }

  return results;
}
