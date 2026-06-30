/**
 * Atlas path-attachment engine — place glyph objects along a polyline, offset
 * to one or both sides of the centre line.  This powers "Canvas of Kings"-style
 * map tools where objects are auto-placed along a path: trees lining a road,
 * houses along a street, watch-towers along a wall.
 *
 * All functions are pure and framework-agnostic.  No DOM, no Canvas APIs.
 * Placement is deterministic for a given seed (mulberry32 PRNG) and mirrors the
 * segment-walking / perpendicular-offset technique in `terrain.ts`
 * (`scatterGlyphsAlongPath`), so output is stable across re-renders and tests.
 */

import type { Coordinate, Path } from "./geometry";

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) — same style as terrain.ts
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
// Public types
// ---------------------------------------------------------------------------

/** Kind of object to line a path with. */
export type PathAttachmentKind = "trees" | "houses" | "towers";

/** Which side(s) of the path centre line to populate. */
export type PathAttachmentSide = "both" | "left" | "right";

export interface PathAttachmentOptions {
  kind: PathAttachmentKind;
  /** normalised spacing between placements along the path (e.g. 0.05). Must be > 0. */
  spacing: number;
  /** which side(s) of the path to populate (default "both"). */
  side?: PathAttachmentSide;
  /** perpendicular offset distance from the path centre line (default 0.02). */
  offset?: number;
  /** random positional jitter as a fraction of spacing (default 0.25). */
  jitter?: number;
  /** PRNG seed for deterministic output (default 7). */
  seed?: number;
}

export interface PathAttachmentPlacement {
  /** builtin glyph key */
  glyphKey: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

// ---------------------------------------------------------------------------
// Kind → builtin glyph mapping
// ---------------------------------------------------------------------------

/** Maps an attachment kind to a builtin editor glyph key. */
const KIND_GLYPH: Record<PathAttachmentKind, string> = {
  trees: "tree",
  houses: "village",
  towers: "castle",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a value to the normalised canvas range [0, 1]. */
function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/** Normalise either a Path or a raw coordinate list to a coordinate array. */
function toCoordinates(path: Path | Coordinate[]): Coordinate[] {
  return Array.isArray(path) ? path : path.coordinates;
}

// ---------------------------------------------------------------------------
// generatePathAttachments
// ---------------------------------------------------------------------------

/**
 * Generate glyph placements lining a polyline path, spaced along the centre
 * line and offset perpendicular to one or both sides.
 *
 * The path is walked segment-by-segment; at each `spacing` step the point on the
 * centre line and the perpendicular unit vector are computed.  A small
 * along-path jitter (a fraction of `spacing`) is applied via the seeded PRNG so
 * placements look organic while remaining deterministic.  For side `"both"` one
 * placement is emitted on each side (`+offset` and `-offset`); for `"left"` /
 * `"right"` a single placement is emitted per step.
 *
 * @param path    - Source polyline (a `Path` or a raw `Coordinate[]`).
 * @param options - Attachment kind, spacing, side, offset, jitter, and seed.
 * @returns         Glyph placements, or `[]` for < 2 points or `spacing <= 0`.
 */
export function generatePathAttachments(
  path: Path | Coordinate[],
  options: PathAttachmentOptions,
): PathAttachmentPlacement[] {
  const { kind, spacing } = options;
  const side: PathAttachmentSide = options.side ?? "both";
  const offset = options.offset ?? 0.02;
  const jitter = options.jitter ?? 0.25;
  const seed = options.seed ?? 7;

  if (spacing <= 0) return [];

  const coords = toCoordinates(path);
  if (coords.length < 2) return [];

  const glyphKey = KIND_GLYPH[kind];
  const rng = makePrng(seed);

  // right → +perpendicular, left → -perpendicular, both → emit each side.
  const signs: number[] =
    side === "both" ? [1, -1] : side === "right" ? [1] : [-1];

  // Towers stand upright; trees/houses get a touch more rotational variety.
  const rotationRange = kind === "towers" ? 5 : 12;

  const results: PathAttachmentPlacement[] = [];

  // Walk each segment and sample positions at `spacing` intervals,
  // carrying the leftover distance across segment boundaries.
  let accumulated = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const [ax, ay] = coords[i]!;
    const [bx, by] = coords[i + 1]!;
    const segLen = Math.hypot(bx - ax, by - ay);
    if (segLen === 0) continue;

    const ux = (bx - ax) / segLen;
    const uy = (by - ay) / segLen;
    // Perpendicular unit vector for the side offset.
    const px = -uy;
    const py = ux;

    let d = accumulated === 0 ? spacing / 2 : spacing - accumulated;
    while (d <= segLen) {
      // Along-path jitter shared by both sides at this step.
      const along = (rng() - 0.5) * spacing * jitter;
      const cx = ax + ux * (d + along);
      const cy = ay + uy * (d + along);

      for (const sign of signs) {
        const scale = 0.8 + rng() * 0.4; // [0.8, 1.2]
        const rotation = (rng() - 0.5) * 2 * rotationRange; // ±rotationRange
        const x = clamp01(cx + px * offset * sign);
        const y = clamp01(cy + py * offset * sign);

        results.push({ glyphKey, x, y, scale, rotation });
      }

      d += spacing;
    }

    // Track leftover distance from this segment for the next one.
    accumulated = segLen - (d - spacing);
  }

  return results;
}
