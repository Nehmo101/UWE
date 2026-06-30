/**
 * Atlas procedural draft generator.
 *
 * Produces a seeded, deterministic map draft comprising:
 *   - a coastline polygon (outer silhouette)
 *   - Voronoi-like region polygons (simple seed-point Voronoi approximation)
 *   - mountain ridge paths
 *   - forest biome polygons
 *   - river paths
 *   - city point features
 *
 * All coordinates are in normalised canvas space [0.0, 1.0].
 * The generator is fully deterministic for a given seed — identical output
 * every call, suitable for stable previews and undo-safe rerolls.
 */

import type { Coordinate, Point, Path, Polygon } from "./geometry";
import type { AtlasFeatureKind } from "./constants";
import { BiomeKind } from "./constants";

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32 — same as terrain.ts for consistency)
// ---------------------------------------------------------------------------

function makePrng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

/** Returns an integer in [0, max). */
function randInt(rng: () => number, max: number): number {
  return Math.floor(rng() * max);
}

/** Lerp between a and b by t. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ---------------------------------------------------------------------------
// Draft types
// ---------------------------------------------------------------------------

/** Semantic kind of a procedurally generated draft feature. */
export type DraftFeatureKind =
  | "coastline"
  | "region"
  | "mountain"
  | "forest"
  | "river"
  | "city";

/** Optional thematic hints that bias generation (from the user's prompt). */
export interface ProceduralPromptHints {
  /** Preferred biome theme. */
  biome?: BiomeKind;
  /** Number of major regions to generate (1–8, clamped). */
  regionCount?: number;
  /** Number of river paths (0–5, clamped). */
  riverCount?: number;
  /** Number of city points (0–8, clamped). */
  cityCount?: number;
  /** Name hint used later for AI naming calls. */
  nameHint?: string;
}

/** Bounds within which to generate the draft (defaults to full canvas). */
export interface ProceduralBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const DEFAULT_BOUNDS: ProceduralBounds = { minX: 0.05, minY: 0.05, maxX: 0.95, maxY: 0.95 };

/** A single feature within a draft. */
export interface DraftFeature {
  /** Client-local stable id — based on seed + index, deterministic. */
  id: string;
  kind: DraftFeatureKind;
  /** Maps to AtlasFeatureKind for DB persistence. */
  atlasKind: AtlasFeatureKind;
  geometry: Point | Path | Polygon;
  /** Display label hint (empty until AI naming is applied). */
  labelHint: string;
  /** Optional biome annotation for biome-typed features. */
  biome?: BiomeKind;
  /** Whether this feature is locked during a reroll. */
  locked?: boolean;
  /** Metadata for UI or AI naming context. */
  meta?: Record<string, unknown>;
}

/** The complete procedural draft returned by generateDraft / rerollDraft. */
export interface AtlasDraft {
  /** The seed used to generate this draft. */
  seed: number;
  /** All generated features in layer order. */
  features: DraftFeature[];
  /** Optional prompt hints used. */
  promptHints?: ProceduralPromptHints;
  /** Generation bounds used. */
  bounds: ProceduralBounds;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Clamp a value to [lo, hi]. */
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Map a normalised rng value into [lo, hi]. */
function inRange(rng: () => number, lo: number, hi: number): number {
  return lo + rng() * (hi - lo);
}

/**
 * Build a blob polygon by jittering points around a circle.
 * The centre and approximate radius are provided; the result uses `steps`
 * angular samples with radius jitter for an organic silhouette.
 */
function makeBlobPolygon(
  cx: number,
  cy: number,
  baseRadius: number,
  jitter: number,
  steps: number,
  rng: () => number,
): Polygon {
  const coords: Coordinate[] = [];
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const r = baseRadius + (rng() - 0.5) * 2 * jitter;
    coords.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }
  coords.push(coords[0]!); // close ring
  return { type: "Polygon", rings: [coords] };
}

/**
 * Build a winding river path from a start point toward an edge or the coast.
 */
function makeRiverPath(
  startX: number,
  startY: number,
  rng: () => number,
  bounds: ProceduralBounds,
): Path {
  const steps = 5 + randInt(rng, 4); // 5–8 segments
  const coords: Coordinate[] = [[startX, startY]];
  let x = startX;
  let y = startY;
  const dirX = (rng() - 0.5) * 0.1;
  const dirY = 0.06 + rng() * 0.06; // flows generally downward

  for (let i = 0; i < steps; i++) {
    x = clamp(x + dirX + (rng() - 0.5) * 0.06, bounds.minX, bounds.maxX);
    y = clamp(y + dirY + (rng() - 0.5) * 0.03, bounds.minY, bounds.maxY);
    coords.push([x, y]);
  }
  return { type: "Path", coordinates: coords };
}

// ---------------------------------------------------------------------------
// Voronoi-like region subdivision
// ---------------------------------------------------------------------------

/**
 * Builds a simplified Voronoi-like region polygon for a seed point by finding
 * the convex hull of the nearest-subgrid sample points around it.
 *
 * This is an approximate Voronoi — not a true clipped Voronoi dual — but
 * produces reasonable-looking region polygons for a map draft without a
 * heavy geometry library.
 */
function buildVoronoiApprox(
  seedPoints: Coordinate[],
  pointIdx: number,
  bounds: ProceduralBounds,
  gridN: number,
  rng: () => number,
): Polygon {
  const [cx, cy] = seedPoints[pointIdx]!;

  // Sample a fine grid within bounds and collect points belonging to this cell.
  const owned: Coordinate[] = [];
  const step = (bounds.maxX - bounds.minX) / gridN;
  for (let gi = 0; gi <= gridN; gi++) {
    for (let gj = 0; gj <= gridN; gj++) {
      const gx = bounds.minX + gi * step;
      const gy = bounds.minY + gj * step;
      // Find nearest seed point
      let nearest = 0;
      let nearestDist = Infinity;
      for (let k = 0; k < seedPoints.length; k++) {
        const [sx, sy] = seedPoints[k]!;
        const d = (gx - sx) ** 2 + (gy - sy) ** 2;
        if (d < nearestDist) {
          nearestDist = d;
          nearest = k;
        }
      }
      if (nearest === pointIdx) {
        owned.push([gx, gy]);
      }
    }
  }

  if (owned.length < 3) {
    // Fallback: small blob around the seed point
    const jitter = (rng() * 0.05 + 0.06) * (bounds.maxX - bounds.minX);
    return makeBlobPolygon(cx, cy, jitter, jitter * 0.3, 8, rng);
  }

  // Compute convex hull of owned points (gift-wrapping / Jarvis march)
  const hull = convexHull(owned);
  if (hull.length < 3) {
    const jitter = 0.07 * (bounds.maxX - bounds.minX);
    return makeBlobPolygon(cx, cy, jitter, jitter * 0.3, 8, rng);
  }
  hull.push(hull[0]!); // close ring
  return { type: "Polygon", rings: [hull] };
}

/** Jarvis-march convex hull. Returns vertices in CCW order. */
function convexHull(points: Coordinate[]): Coordinate[] {
  if (points.length < 3) return [...points];
  // Find leftmost point
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i]![0] < points[start]![0]) start = i;
  }
  const hull: Coordinate[] = [];
  let cur = start;
  do {
    hull.push(points[cur]!);
    let next = (cur + 1) % points.length;
    for (let i = 0; i < points.length; i++) {
      if (cross2d(points[cur]!, points[next]!, points[i]!) < 0) {
        next = i;
      }
    }
    cur = next;
  } while (cur !== start && hull.length <= points.length + 1);
  return hull;
}

/** Cross product of vectors CA and CB (sign indicates turn direction). */
function cross2d(c: Coordinate, a: Coordinate, b: Coordinate): number {
  return (a[0] - c[0]) * (b[1] - c[1]) - (a[1] - c[1]) * (b[0] - c[0]);
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

/**
 * Generate a procedural map draft deterministically from `seed`.
 *
 * @param seed        - Integer seed value. Same seed → identical output.
 * @param promptHints - Optional thematic hints (biome, region/river/city count, name).
 * @param bounds      - Canvas-normalised generation region (defaults to 0.05–0.95).
 */
export function generateDraft(
  seed: number,
  promptHints?: ProceduralPromptHints,
  bounds?: ProceduralBounds,
): AtlasDraft {
  const b = bounds ?? DEFAULT_BOUNDS;
  const bw = b.maxX - b.minX;
  const bh = b.maxY - b.minY;

  const rng = makePrng(seed);

  const regionCount = clamp(promptHints?.regionCount ?? 3 + randInt(rng, 3), 1, 8);
  const riverCount = clamp(promptHints?.riverCount ?? 1 + randInt(rng, 3), 0, 5);
  const cityCount = clamp(promptHints?.cityCount ?? 2 + randInt(rng, 4), 0, 8);

  const features: DraftFeature[] = [];
  let idx = 0;
  function nextId(kind: DraftFeatureKind): string {
    return `draft-${seed}-${kind}-${idx++}`;
  }

  // ---- Coastline / silhouette ----------------------------------------
  const coastSteps = 20 + randInt(rng, 12);
  const coastCx = lerp(b.minX, b.maxX, 0.48 + (rng() - 0.5) * 0.08);
  const coastCy = lerp(b.minY, b.maxY, 0.48 + (rng() - 0.5) * 0.08);
  const coastRadius = (bw * 0.38 + rng() * bw * 0.06);
  const coastJitter = coastRadius * 0.18;
  const coastPoly = makeBlobPolygon(coastCx, coastCy, coastRadius, coastJitter, coastSteps, rng);

  features.push({
    id: nextId("coastline"),
    kind: "coastline",
    atlasKind: "region",
    geometry: coastPoly,
    labelHint: "",
    biome: promptHints?.biome ?? BiomeKind.coast,
  });

  // ---- Region seed points (within bounds) ----------------------------
  const seedPoints: Coordinate[] = [];
  for (let i = 0; i < regionCount; i++) {
    seedPoints.push([
      inRange(rng, b.minX + bw * 0.1, b.maxX - bw * 0.1),
      inRange(rng, b.minY + bh * 0.1, b.maxY - bh * 0.1),
    ]);
  }

  // ---- Region polygons (Voronoi approx) ------------------------------
  // Use a coarser grid for speed; fine enough for visual draft quality.
  const gridN = 18;
  const rngForRegions = makePrng(seed + 1);
  for (let i = 0; i < regionCount; i++) {
    const poly = buildVoronoiApprox(seedPoints, i, b, gridN, rngForRegions);
    features.push({
      id: nextId("region"),
      kind: "region",
      atlasKind: "region",
      geometry: poly,
      labelHint: `Region ${i + 1}`,
      meta: { seedPointIndex: i },
    });
  }

  // ---- Mountain ridge paths ------------------------------------------
  const ridgeCount = 1 + randInt(rng, 3);
  for (let r = 0; r < ridgeCount; r++) {
    const sx = inRange(rng, b.minX + bw * 0.15, b.maxX - bw * 0.15);
    const sy = inRange(rng, b.minY + bh * 0.1, b.maxY - bh * 0.5);
    const steps = 3 + randInt(rng, 4);
    const coords: Coordinate[] = [[sx, sy]];
    let x = sx;
    let y = sy;
    for (let s = 0; s < steps; s++) {
      x = clamp(x + (rng() - 0.5) * 0.14, b.minX, b.maxX);
      y = clamp(y + rng() * 0.1 + 0.02, b.minY, b.maxY);
      coords.push([x, y]);
    }
    features.push({
      id: nextId("mountain"),
      kind: "mountain",
      atlasKind: "relief",
      geometry: { type: "Path", coordinates: coords },
      labelHint: `Gebirgskamm ${r + 1}`,
      biome: BiomeKind.mountains,
    });
  }

  // ---- Forest biome polygons -----------------------------------------
  const forestCount = 1 + randInt(rng, 3);
  for (let f = 0; f < forestCount; f++) {
    const fcx = inRange(rng, b.minX + bw * 0.1, b.maxX - bw * 0.1);
    const fcy = inRange(rng, b.minY + bh * 0.1, b.maxY - bh * 0.1);
    const fr = inRange(rng, bw * 0.06, bw * 0.14);
    const fsteps = 10 + randInt(rng, 6);
    const fpoly = makeBlobPolygon(fcx, fcy, fr, fr * 0.25, fsteps, rng);
    features.push({
      id: nextId("forest"),
      kind: "forest",
      atlasKind: "biome",
      geometry: fpoly,
      labelHint: `Wald ${f + 1}`,
      biome: BiomeKind.forest,
    });
  }

  // ---- River paths ---------------------------------------------------
  const rngRivers = makePrng(seed + 2);
  for (let rv = 0; rv < riverCount; rv++) {
    const rx = inRange(rngRivers, b.minX + bw * 0.15, b.maxX - bw * 0.15);
    const ry = inRange(rngRivers, b.minY + bh * 0.05, b.minY + bh * 0.4);
    features.push({
      id: nextId("river"),
      kind: "river",
      atlasKind: "river",
      geometry: makeRiverPath(rx, ry, rngRivers, b),
      labelHint: `Fluss ${rv + 1}`,
    });
  }

  // ---- City points ---------------------------------------------------
  const rngCities = makePrng(seed + 3);
  for (let c = 0; c < cityCount; c++) {
    const cx2 = inRange(rngCities, b.minX + bw * 0.1, b.maxX - bw * 0.1);
    const cy2 = inRange(rngCities, b.minY + bh * 0.1, b.maxY - bh * 0.1);
    features.push({
      id: nextId("city"),
      kind: "city",
      atlasKind: "pin",
      geometry: { type: "Point", coordinates: [cx2, cy2] },
      labelHint: `Ort ${c + 1}`,
    });
  }

  return {
    seed,
    features,
    promptHints,
    bounds: b,
  };
}

// ---------------------------------------------------------------------------
// Reroll with locked features
// ---------------------------------------------------------------------------

/**
 * Re-generate a draft from a new seed while preserving any locked features.
 *
 * Features listed in `lockedFeatureIds` are carried over from the previous
 * draft unchanged; all other features are regenerated from `newSeed`.
 *
 * @param previous          - The previous draft (source of locked features).
 * @param newSeed           - New seed for non-locked features.
 * @param lockedFeatureIds  - Set of `DraftFeature.id` values to preserve.
 */
export function rerollDraft(
  previous: AtlasDraft,
  newSeed: number,
  lockedFeatureIds?: string[],
): AtlasDraft {
  const lockedSet = new Set(lockedFeatureIds ?? []);
  const lockedFeatures = previous.features.filter((f) => lockedSet.has(f.id));

  // Generate a fresh draft (new seed, same hints/bounds).
  const fresh = generateDraft(newSeed, previous.promptHints, previous.bounds);

  // Merge: keep locked features from previous, take all others from fresh draft.
  // Locked features appear first to preserve their layer order.
  const freshFiltered = fresh.features.filter((f) => {
    // Drop features from the same kind-slot if that slot is already locked.
    // For simplicity: only deduplicate on kind if a locked feature has the same
    // slot index as the fresh one.  We keep all fresh non-locked features as-is.
    return !lockedSet.has(f.id);
  });

  const merged: DraftFeature[] = [
    ...lockedFeatures.map((f) => ({ ...f, locked: true })),
    ...freshFiltered,
  ];

  return {
    seed: newSeed,
    features: merged,
    promptHints: previous.promptHints,
    bounds: previous.bounds,
  };
}
