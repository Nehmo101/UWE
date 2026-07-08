/**
 * Fluss-Intelligenz (Roadmap W4 #18) — pure, deterministic helpers:
 *
 *  - `snapPointToWater`: snap a river mouth to the nearest water cell centre
 *    within a max radius, so rivers end cleanly at lakes/coasts.
 *  - `riverFlowsUphill`: sanity check against the elevation grid — flags a
 *    river whose end sits significantly higher than its start. Editor-hint
 *    only, never an auto-correction.
 *
 * Distances are in normalised [0,1] map units (consistent with bridge-points
 * and the editor's hit tests). No PRNG involved.
 */

import type { AtlasTileLayer } from "./doc";
import type { Coordinate } from "./geometry";
import { sampleElevation, type ElevationGrid } from "./elevation";

/** Biome key the terrain layer uses for water tiles. */
export const WATER_BIOME = "coast";

export interface SnapToWaterOptions {
  /** Max snap distance in normalised units. Default 0.04. */
  maxDist?: number;
  /** Biome key treated as water. Default "coast". */
  waterBiome?: string;
}

/**
 * Returns the centre of the nearest water cell within `maxDist`, or `null`
 * when the point already lies in water or no water is in range.
 */
export function snapPointToWater(
  layer: Pick<AtlasTileLayer, "cols" | "rows" | "cells"> | null | undefined,
  point: Coordinate,
  options: SnapToWaterOptions = {},
): Coordinate | null {
  if (!layer || !layer.cells || !(layer.cols > 0) || !(layer.rows > 0)) return null;
  const maxDist = options.maxDist ?? 0.04;
  const water = options.waterBiome ?? WATER_BIOME;
  const [px, py] = point;
  const cols = layer.cols;
  const rows = layer.rows;
  const col = Math.min(cols - 1, Math.max(0, Math.floor(px * cols)));
  const row = Math.min(rows - 1, Math.max(0, Math.floor(py * rows)));
  if (layer.cells[`${col},${row}`] === water) return null; // already in water

  // Scan the cell neighbourhood covered by maxDist (per-axis radius).
  const rx = Math.max(1, Math.ceil(maxDist * cols));
  const ry = Math.max(1, Math.ceil(maxDist * rows));
  let best: Coordinate | null = null;
  let bestDist = maxDist;
  for (let c = Math.max(0, col - rx); c <= Math.min(cols - 1, col + rx); c++) {
    for (let r = Math.max(0, row - ry); r <= Math.min(rows - 1, row + ry); r++) {
      if (layer.cells[`${c},${r}`] !== water) continue;
      const cx = (c + 0.5) / cols;
      const cy = (r + 0.5) / rows;
      const d = Math.hypot(cx - px, cy - py);
      if (d < bestDist) {
        bestDist = d;
        best = [cx, cy];
      }
    }
  }
  return best;
}

export interface UphillCheckOptions {
  /** Minimum elevation gain (0..1 scale) before flagging. Default 0.08. */
  threshold?: number;
}

/**
 * True when the river's end is significantly higher than its start —
 * i.e. water would flow "uphill". Returns false without an elevation grid
 * or for paths with fewer than 2 points.
 */
export function riverFlowsUphill(
  grid: ElevationGrid | null | undefined,
  coords: readonly Coordinate[],
  options: UphillCheckOptions = {},
): boolean {
  if (!grid || !grid.elevation || coords.length < 2) return false;
  const threshold = options.threshold ?? 0.08;
  const first = coords[0]!;
  const last = coords[coords.length - 1]!;
  const start = sampleElevation(grid, first[0], first[1]);
  const end = sampleElevation(grid, last[0], last[1]);
  return end - start > threshold;
}
