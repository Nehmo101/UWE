/**
 * Atlas settlement building distribution.
 *
 * Extracted from `settlement.ts`: deterministic dart-throwing placement with
 * corridor/plaza/wall clearances, keep-out rings (e.g. the waterfront water
 * strip), and a best-candidate (blue-noise) pick so houses spread evenly
 * instead of clustering. Pure and framework-agnostic; all randomness comes
 * from the caller-supplied seeded RNG.
 */

import type { Coordinate } from "./geometry";
import { distToSegment } from "./geometry";
// Type-only — erased at compile time, so this does not create a runtime
// circular dependency with settlement.ts (which imports values from here).
import type { SettlementFeature, SettlementObject } from "./settlement";

/** Fraction of the polygon span kept clear between buildings and the wall ring. */
export const WALL_CLEARANCE_FACTOR = 0.03;
/** Fraction of the polygon span kept clear between any two placed objects. */
export const OBJECT_SPACING_FACTOR = 0.04;
/** Fraction of the polygon span kept clear around road/pier center lines. */
export const ROAD_CLEARANCE_FACTOR = 0.035;
/** Fraction of the polygon span kept clear around the plaza/center. */
export const PLAZA_CLEARANCE_FACTOR = 0.08;

/** Valid candidates gathered per building before the most isolated one wins. */
const BEST_CANDIDATE_SAMPLES = 4;

export interface BuildingPlacement {
  point: Coordinate;
  rotation: number;
  scale: number;
}

export interface PlaceBuildingsInput {
  /** Number of buildings to place. */
  count: number;
  /** Outer-ring bounding box `[minX, minY, maxX, maxY]`. */
  bbox: readonly [number, number, number, number];
  /** Settlement center (plaza anchor). */
  center: Coordinate;
  /** Min of bbox width/height; all clearances scale with it. */
  span: number;
  /** Seeded RNG stream shared with the settlement generator. */
  rng: () => number;
  /** True when a point lies inside the buildable polygon (holes excluded). */
  isInterior: (point: Coordinate) => boolean;
  /** Already-placed object positions (keep, market, well, gates, towers, dock). */
  occupied: readonly Coordinate[];
  /** Road and pier center lines to keep clear. */
  roadPaths: readonly Coordinate[][];
  /** Closed wall ring; when present buildings keep WALL_CLEARANCE_FACTOR away. */
  wallRing?: readonly Coordinate[];
  /** Additional forbidden regions, e.g. the waterfront water strip. */
  keepOutRings?: readonly (readonly Coordinate[])[];
}

export function rotationToward(from: Coordinate, to: Coordinate): number {
  return (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;
}

export function distanceToPaths(point: Coordinate, paths: readonly (readonly Coordinate[])[]): number {
  let nearest = Infinity;
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      nearest = Math.min(nearest, distToSegment(point, path[i]!, path[i + 1]!));
    }
  }
  return nearest;
}

export function tooClose(
  point: Coordinate,
  occupied: readonly Coordinate[],
  minDistance: number,
): boolean {
  return occupied.some(([x, y]) => Math.hypot(point[0] - x, point[1] - y) < minDistance);
}

function nearestOccupiedDistance(point: Coordinate, occupied: readonly Coordinate[]): number {
  let nearest = Infinity;
  for (const [x, y] of occupied) {
    nearest = Math.min(nearest, Math.hypot(point[0] - x, point[1] - y));
  }
  return nearest;
}

function pointInRing(point: Coordinate, ring: readonly Coordinate[]): boolean {
  const [px, py] = point;
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

/**
 * Place `count` buildings deterministically inside the settlement polygon.
 *
 * Each building consumes darts from a shared attempt budget; a dart is valid
 * when it is interior, outside the plaza clearance, clear of roads/piers, the
 * wall ring, and every keep-out ring, and not too close to occupied points.
 * Among up to BEST_CANDIDATE_SAMPLES valid darts the one farthest from all
 * previously placed objects wins (Mitchell best-candidate), which yields an
 * even, blue-noise-like distribution instead of first-fit clusters.
 */
export function placeSettlementBuildings(input: PlaceBuildingsInput): BuildingPlacement[] {
  const placements: BuildingPlacement[] = [];
  if (input.count <= 0) return placements;

  const [minX, minY, maxX, maxY] = input.bbox;
  const roadClearance = input.span * ROAD_CLEARANCE_FACTOR;
  const plazaClearance = input.span * PLAZA_CLEARANCE_FACTOR;
  const spacing = input.span * OBJECT_SPACING_FACTOR;
  const wallClearance = input.wallRing ? input.span * WALL_CLEARANCE_FACTOR : 0;
  const wallPaths = input.wallRing ? [input.wallRing] : [];
  const blocked: Coordinate[] = [...input.occupied];
  const budget = input.count * 90 + 100;
  let attempts = 0;

  while (placements.length < input.count && attempts < budget) {
    let best: Coordinate | undefined;
    let bestScore = -Infinity;
    let found = 0;

    while (found < BEST_CANDIDATE_SAMPLES && attempts < budget) {
      attempts++;
      const point: Coordinate = [minX + input.rng() * (maxX - minX), minY + input.rng() * (maxY - minY)];
      if (!input.isInterior(point)) continue;
      if (Math.hypot(point[0] - input.center[0], point[1] - input.center[1]) < plazaClearance) continue;
      if (input.roadPaths.length > 0 && distanceToPaths(point, input.roadPaths) < roadClearance) continue;
      if (wallClearance > 0 && distanceToPaths(point, wallPaths) < wallClearance) continue;
      if (input.keepOutRings?.some((ring) => pointInRing(point, ring))) continue;
      if (tooClose(point, blocked, spacing)) continue;

      found++;
      const score = nearestOccupiedDistance(point, blocked);
      if (score > bestScore) {
        bestScore = score;
        best = point;
      }
    }

    if (!best) continue;
    blocked.push(best);
    placements.push({
      point: best,
      rotation: rotationToward(input.center, best) + 90 + (input.rng() - 0.5) * 16,
      scale: 0.78 + input.rng() * 0.36,
    });
  }

  return placements;
}

// ---------------------------------------------------------------------------
// Settlement condition (Verfallsgrad) — deterministic decay/occupation post-pass
// ---------------------------------------------------------------------------

/** Deterioration/occupation state for a generated settlement. */
export type SettlementCondition = "thriving" | "besieged" | "abandoned" | "ruined";

/**
 * Post-process an already-generated layout for a decay/occupation state. Purely
 * index-based — draws no extra values from `rng` — so it stays deterministic
 * independent of the shared PRNG stream used for the base layout, and repeated
 * calls with identical inputs are deep-equal. Callers must skip invoking this
 * for "thriving" (the default): returning the original arrays untouched is what
 * keeps the golden/default settlement output byte-identical.
 *
 * - besieged: tags every feature/object `style.condition`; every 5th house
 *   (index 0, 5, 10, …, ~20%) becomes a siege tent (`style.gouache = "g_tent"`).
 * - abandoned: drops houses at an even index that is not also a multiple of 5
 *   (an "every 2nd, minus every 5th" cull, ~40% of houses); every remaining
 *   feature/object is tagged.
 * - ruined: the first 3 of every 5 houses (index-based, ~60%) become rubble
 *   (`style.gouache = "g_ruin"`); every 2nd wall tower (by index, 0-based) is
 *   dropped; everything remaining is tagged.
 */
export function applySettlementCondition(
  features: readonly SettlementFeature[],
  objects: readonly SettlementObject[],
  condition: SettlementCondition,
): { features: SettlementFeature[]; objects: SettlementObject[] } {
  const tagStyle = <S extends { condition?: SettlementCondition }>(style: S): S => ({
    ...style,
    condition,
  });

  let houseIndex = -1;
  let towerIndex = -1;
  const nextObjects: SettlementObject[] = [];
  for (const object of objects) {
    if (object.kind === "building") {
      houseIndex++;
      if (condition === "abandoned" && houseIndex % 2 === 0 && houseIndex % 5 !== 0) continue;
      if (condition === "ruined" && houseIndex % 5 < 3) {
        nextObjects.push({ ...object, style: { ...tagStyle(object.style), gouache: "g_ruin" } });
        continue;
      }
      if (condition === "besieged" && houseIndex % 5 === 0) {
        nextObjects.push({ ...object, style: { ...tagStyle(object.style), gouache: "g_tent" } });
        continue;
      }
    } else if (object.kind === "tower") {
      towerIndex++;
      if (condition === "ruined" && towerIndex % 2 === 0) continue;
    }
    nextObjects.push({ ...object, style: tagStyle(object.style) });
  }

  return {
    features: features.map((feature) => ({ ...feature, style: tagStyle(feature.style) })),
    objects: nextObjects,
  };
}
