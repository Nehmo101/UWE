/**
 * Reiseplaner (Roadmap W3 #15) — pure route planning over a clicked route:
 * total distance in leagues (map width = `scaleLeagues`, matching the
 * editor's measure tool), terrain-weighted travel effort, resulting days,
 * and camp (rest) points placed after each full travel day.
 *
 * Deterministic, no PRNG. Encounter rolls per leg belong to the dnd package
 * and run through the Studio bridge (Proposal → Review), not here.
 */

import type { AtlasTileLayer } from "./doc";
import type { Coordinate } from "./geometry";

/** Terrain slows travel: effort multiplier per biome (missing cell = 1). */
export const TERRAIN_TRAVEL_FACTOR: Record<string, number> = {
  grassland: 1,
  hills: 1.3,
  forest: 1.35,
  desert: 1.4,
  snow: 1.6,
  swamp: 1.8,
  mountains: 2,
  // Wasser ohne Boot: Umweg/Fähre — bewusst teuer.
  coast: 2.5,
};

export interface TravelOptions {
  /** Terrain grid for effort weighting; omit for flat factor 1. */
  layer?: Pick<AtlasTileLayer, "cols" | "rows" | "cells"> | null;
  /** Travel budget per day in leagues. Default 8. */
  leaguesPerDay?: number;
  /** Map width in leagues (editor measure convention). Default 100. */
  scaleLeagues?: number;
  /** Samples per segment for terrain weighting. Default 8. */
  samplesPerSegment?: number;
}

export interface TravelSegment {
  /** Geometric length in leagues. */
  leagues: number;
  /** Terrain-weighted effort in leagues. */
  effortLeagues: number;
  /** Average terrain factor along the segment. */
  factor: number;
}

export interface TravelPlan {
  totalLeagues: number;
  effortLeagues: number;
  /** Travel days (effort / per-day budget), rounded up to 0.1. */
  days: number;
  /** Camp positions after each FULL travel day along the route. */
  camps: Coordinate[];
  segments: TravelSegment[];
}

function biomeFactorAt(
  layer: TravelOptions["layer"],
  x: number,
  y: number,
): number {
  if (!layer || !layer.cells || !(layer.cols > 0) || !(layer.rows > 0)) return 1;
  const c = Math.min(layer.cols - 1, Math.max(0, Math.floor(x * layer.cols)));
  const r = Math.min(layer.rows - 1, Math.max(0, Math.floor(y * layer.rows)));
  const biome = layer.cells[`${c},${r}`];
  return (biome && TERRAIN_TRAVEL_FACTOR[biome]) || 1;
}

/** Plans a travel route over ≥2 clicked points. Empty plan for shorter input. */
export function planTravelRoute(
  points: readonly Coordinate[],
  options: TravelOptions = {},
): TravelPlan {
  const empty: TravelPlan = { totalLeagues: 0, effortLeagues: 0, days: 0, camps: [], segments: [] };
  if (points.length < 2) return empty;
  const perDay = options.leaguesPerDay && options.leaguesPerDay > 0 ? options.leaguesPerDay : 8;
  const scale = options.scaleLeagues && options.scaleLeagues > 0 ? options.scaleLeagues : 100;
  const samples = Math.max(1, Math.floor(options.samplesPerSegment ?? 8));

  const segments: TravelSegment[] = [];
  let totalLeagues = 0;
  let effortLeagues = 0;
  const camps: Coordinate[] = [];
  let effortSinceCamp = 0;

  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1]!;
    const [bx, by] = points[i]!;
    const leagues = Math.hypot(bx - ax, by - ay) * scale;
    // Average the terrain factor over sample midpoints along the segment.
    let factorSum = 0;
    for (let k = 0; k < samples; k++) {
      const t = (k + 0.5) / samples;
      factorSum += biomeFactorAt(options.layer, ax + (bx - ax) * t, ay + (by - ay) * t);
    }
    const factor = factorSum / samples;
    const effort = leagues * factor;
    segments.push({ leagues, effortLeagues: effort, factor });
    totalLeagues += leagues;

    // Place a camp each time a full day's effort is consumed inside this leg.
    let remaining = effort;
    let tStart = 0;
    while (effortSinceCamp + remaining >= perDay && effort > 0) {
      const needed = perDay - effortSinceCamp;
      const tCamp = tStart + (needed / effort) * (1 - 0); // fraction of THIS segment's effort
      const t = Math.min(1, tCamp);
      camps.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
      remaining -= needed;
      tStart = t;
      effortSinceCamp = 0;
    }
    effortSinceCamp += remaining;
    effortLeagues += effort;
  }

  // Kein Rastpunkt am Ziel selbst — der letzte Camp fällt weg, wenn er
  // praktisch auf dem Endpunkt liegt.
  const last = points[points.length - 1]!;
  while (camps.length && Math.hypot(camps[camps.length - 1]![0] - last[0], camps[camps.length - 1]![1] - last[1]) < 1e-9) {
    camps.pop();
  }

  const days = Math.ceil((effortLeagues / perDay) * 10) / 10;
  return { totalLeagues, effortLeagues, days, camps, segments };
}
