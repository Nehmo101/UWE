/**
 * Atlas terrain helpers — biome scatter engine and relief shading.
 *
 * All functions are pure and framework-agnostic.  No DOM, no Canvas APIs.
 * Scatter functions accept an optional numeric seed for deterministic output
 * (useful for tests and stable re-renders without React state churn).
 */

import type { Polygon, Path } from "./geometry";
import type { BiomeKind } from "./constants";

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32)
// ---------------------------------------------------------------------------

/** Returns a seeded PRNG producing values in [0, 1). */
function makePrng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

// ---------------------------------------------------------------------------
// ScatteredGlyphItem
// ---------------------------------------------------------------------------

/**
 * A single glyph instance produced by a scatter function.
 * Coordinates are in normalised canvas space [0, 1].
 */
export interface ScatteredGlyphItem {
  /** Unique id within the scatter set (stable across calls with same seed). */
  id: string;
  /** Builtin glyph key (matches BuiltinGlyph.key in the editor). */
  glyphKey: string;
  /** Normalised x position [0, 1]. */
  x: number;
  /** Normalised y position [0, 1]. */
  y: number;
  /** Scale multiplier relative to base glyph size. */
  scale: number;
  /** Rotation in degrees. */
  rotation: number;
}

// ---------------------------------------------------------------------------
// ScatterExclusion
// ---------------------------------------------------------------------------

/**
 * A corridor the scatter must keep clear of — typically a road or river
 * crossing the biome polygon (Canvas-of-Kings behaviour: a forest plot
 * respects the roads running through it).
 */
export interface ScatterExclusion {
  /** Polyline of the corridor centreline in normalised canvas space. */
  path: [number, number][];
  /** Full corridor width in normalised canvas units (glyphs stay width/2 away). */
  width: number;
}

/** Shortest distance from a point to a segment (endpoints clamped). */
function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** True when the point lies inside any exclusion corridor. */
function inExclusion(x: number, y: number, exclusions: ScatterExclusion[]): boolean {
  for (const ex of exclusions) {
    const half = ex.width / 2;
    if (half <= 0) continue;
    const pts = ex.path;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i]!;
      const [bx, by] = pts[i + 1]!;
      if (distToSegment(x, y, ax, ay, bx, by) < half) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// ReliefShadingDescriptor
// ---------------------------------------------------------------------------

/**
 * Describes a gradient overlay that simulates hillshade / schummerung for
 * a biome polygon.  The renderer interprets this as a linear gradient from
 * the top-left (highlight) to the bottom-right (shadow).
 */
export interface ReliefShadingDescriptor {
  /** Bounding box of the source polygon [minX, minY, maxX, maxY]. */
  bbox: [number, number, number, number];
  /** Biome kind that drove the shading. */
  biomeKind: BiomeKind;
  /** RGBA highlight colour (northwest / light-source side). */
  highlightColor: string;
  /** RGBA shadow colour (southeast / downslope side). */
  shadowColor: string;
  /** Overlay opacity [0, 1]. */
  opacity: number;
}

// ---------------------------------------------------------------------------
// Biome → glyph mapping
// ---------------------------------------------------------------------------

/** The builtin glyph key used when scattering inside a biome, or null for no glyph. */
const BIOME_GLYPH: Record<BiomeKind, string | null> = {
  forest: "tree",
  mountains: "mountain",
  hills: "mountain",
  grassland: null,
  desert: null,
  swamp: "tree",
  coast: "water",
  snow: "mountain_snow",
};

/** Approximate glyphs per unit² of canvas-normalised area at density=1. */
const BASE_DENSITY = 80;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Compute the bounding box of a ring of coordinates. */
function ringBbox(ring: [number, number][]): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

/** Point-in-polygon test (ray casting). */
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

/** Approximate signed area of a ring (shoelace formula). */
function ringArea(ring: [number, number][]): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j]![0] + ring[i]![0]) * (ring[j]![1] - ring[i]![1]);
  }
  return Math.abs(area / 2);
}

// ---------------------------------------------------------------------------
// scatterGlyphsInPolygon
// ---------------------------------------------------------------------------

/**
 * Place tree / mountain glyphs with density jitter inside a biome polygon.
 *
 * @param polygon  - Source polygon (outer ring drives placement; holes clip).
 * @param biomeKind - Biome type determining which glyph key to use.
 * @param density   - Multiplier for glyph count (1.0 = natural density).
 * @param seed      - PRNG seed for deterministic output (default: 1337).
 * @param exclusions - Optional corridors (roads/rivers) the scatter keeps clear of.
 *                     Rejection happens before any further PRNG draw, so a call
 *                     without exclusions stays bit-identical to previous output.
 * @returns         Array of glyph placement descriptors.
 */
export function scatterGlyphsInPolygon(
  polygon: Polygon,
  biomeKind: BiomeKind,
  density: number,
  seed = 1337,
  exclusions?: ScatterExclusion[],
): ScatteredGlyphItem[] {
  const glyphKey = BIOME_GLYPH[biomeKind];
  if (!glyphKey || density <= 0) return [];

  const outerRing = polygon.rings[0];
  if (!outerRing || outerRing.length < 3) return [];

  const holeRings = polygon.rings.slice(1);
  const rng = makePrng(seed);
  const [minX, minY, maxX, maxY] = ringBbox(outerRing as [number, number][]);
  const area = ringArea(outerRing as [number, number][]);
  const targetCount = Math.max(1, Math.round(BASE_DENSITY * density * area));

  const results: ScatteredGlyphItem[] = [];
  // Attempt up to 8× oversampling to fill targetCount via rejection sampling.
  const maxAttempts = targetCount * 8;
  let attempts = 0;

  while (results.length < targetCount && attempts < maxAttempts) {
    attempts++;
    const x = minX + rng() * (maxX - minX);
    const y = minY + rng() * (maxY - minY);

    if (!pointInRing(x, y, outerRing as [number, number][])) continue;
    const inHole = holeRings.some((hr) =>
      pointInRing(x, y, hr as [number, number][]),
    );
    if (inHole) continue;
    if (exclusions && exclusions.length && inExclusion(x, y, exclusions)) continue;

    const scale = 0.55 + rng() * 0.6; // [0.55, 1.15]
    const rotation = (rng() - 0.5) * 20; // ±10 degrees

    results.push({
      id: `sg-${seed}-${results.length}`,
      glyphKey,
      x,
      y,
      scale,
      rotation,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// scatterGlyphsAlongPath
// ---------------------------------------------------------------------------

/**
 * Place mountain glyphs along a ridge path, optionally scaled by elevation metadata.
 *
 * @param path           - Source polyline path.
 * @param biomeKind      - Biome type (typically "mountains" or "hills").
 * @param spacing        - Approximate normalised-canvas spacing between glyphs.
 * @param heightMetadata - Optional per-vertex height values [0, 1] used to scale glyphs.
 * @param seed           - PRNG seed for deterministic jitter (default: 42).
 * @returns              Array of glyph placement descriptors.
 */
export function scatterGlyphsAlongPath(
  path: Path,
  biomeKind: BiomeKind,
  spacing: number,
  heightMetadata?: number[],
  seed = 42,
): ScatteredGlyphItem[] {
  const glyphKey = BIOME_GLYPH[biomeKind];
  if (!glyphKey || spacing <= 0) return [];

  const coords = path.coordinates as [number, number][];
  if (coords.length < 2) return [];

  const rng = makePrng(seed);
  const results: ScatteredGlyphItem[] = [];

  // Walk each segment and sample positions at `spacing` intervals.
  let accumulated = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const [ax, ay] = coords[i]!;
    const [bx, by] = coords[i + 1]!;
    const segLen = Math.hypot(bx - ax, by - ay);
    if (segLen === 0) continue;

    const ux = (bx - ax) / segLen;
    const uy = (by - ay) / segLen;
    // Perpendicular unit vector (for jitter offset)
    const px = -uy;
    const py = ux;

    let d = accumulated === 0 ? spacing / 2 : spacing - accumulated;
    while (d <= segLen) {
      const t = d / segLen;
      // Interpolate height between vertices
      const h0 = heightMetadata?.[i] ?? 0.5;
      const h1 = heightMetadata?.[i + 1] ?? 0.5;
      const height = h0 + (h1 - h0) * t;

      const jitter = (rng() - 0.5) * spacing * 0.4;
      const x = ax + ux * d + px * jitter;
      const y = ay + uy * d + py * jitter;
      const scale = 0.5 + height * 0.8 + rng() * 0.2; // height drives scale
      const rotation = (rng() - 0.5) * 15;

      results.push({
        id: `sp-${seed}-${results.length}`,
        glyphKey,
        x,
        y,
        scale,
        rotation,
      });
      d += spacing;
    }

    // Track leftover distance from this segment for next
    accumulated = segLen - (d - spacing);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Relief shading colours per biome
// ---------------------------------------------------------------------------

interface BiomeShadingColors {
  highlight: string;
  shadow: string;
  opacity: number;
}

const BIOME_SHADING: Record<BiomeKind, BiomeShadingColors> = {
  mountains: {
    highlight: "rgba(255,248,230,0.55)",
    shadow: "rgba(60,45,20,0.40)",
    opacity: 0.45,
  },
  hills: {
    highlight: "rgba(245,240,210,0.40)",
    shadow: "rgba(80,65,35,0.30)",
    opacity: 0.32,
  },
  forest: {
    highlight: "rgba(200,230,180,0.20)",
    shadow: "rgba(30,60,20,0.25)",
    opacity: 0.22,
  },
  swamp: {
    highlight: "rgba(180,210,160,0.20)",
    shadow: "rgba(20,50,30,0.35)",
    opacity: 0.28,
  },
  grassland: {
    highlight: "rgba(220,245,200,0.18)",
    shadow: "rgba(50,80,30,0.18)",
    opacity: 0.18,
  },
  desert: {
    highlight: "rgba(255,240,180,0.30)",
    shadow: "rgba(160,120,40,0.28)",
    opacity: 0.28,
  },
  coast: {
    highlight: "rgba(200,230,255,0.30)",
    shadow: "rgba(30,80,120,0.28)",
    opacity: 0.26,
  },
  snow: {
    highlight: "rgba(240,248,255,0.50)",
    shadow: "rgba(100,130,170,0.35)",
    opacity: 0.38,
  },
};

// ---------------------------------------------------------------------------
// buildReliefShading
// ---------------------------------------------------------------------------

/**
 * Build a hillshade / schummerung gradient descriptor for a biome polygon.
 *
 * The returned descriptor encodes a northwest-lit linear gradient overlay
 * that the Canvas renderer can apply with `createLinearGradient`.
 *
 * @param polygon   - Source polygon whose bounding box anchors the gradient.
 * @param biomeKind - Biome type driving the shading colours.
 * @returns         A `ReliefShadingDescriptor` ready for the renderer.
 */
export function buildReliefShading(
  polygon: Polygon,
  biomeKind: BiomeKind,
): ReliefShadingDescriptor {
  const outerRing = polygon.rings[0] ?? [];
  const [minX, minY, maxX, maxY] = ringBbox(outerRing as [number, number][]);

  const colors = BIOME_SHADING[biomeKind];

  return {
    bbox: [minX, minY, maxX, maxY],
    biomeKind,
    highlightColor: colors.highlight,
    shadowColor: colors.shadow,
    opacity: colors.opacity,
  };
}
