/**
 * Atlas path-smoothing helpers — Catmull-Rom curve densification and
 * variable-width sampling for "Canvas of Kings"-style map tools (rivers,
 * roads, coastlines drawn as hand-clicked polylines).
 *
 * All functions are pure and framework-agnostic.  No DOM, no Canvas APIs,
 * no external dependencies.  Coordinates are in normalised canvas space
 * [0.0, 1.0] (see ./geometry).
 */

import type { Coordinate } from "./geometry";

// ---------------------------------------------------------------------------
// SmoothPathOptions
// ---------------------------------------------------------------------------

export interface SmoothPathOptions {
  /** subdivisions per segment (default 8, clamped to [1, 64]) */
  segments?: number;
  /** Catmull-Rom tension 0..1 (default 0.5) */
  tension?: number;
  /** treat path as a closed loop (default false) */
  closed?: boolean;
}

const DEFAULT_SEGMENTS = 8;
const MIN_SEGMENTS = 1;
const MAX_SEGMENTS = 64;
const DEFAULT_TENSION = 0.5;

/** Clamp a value into the inclusive range [lo, hi]. */
function clamp(value: number, lo: number, hi: number): number {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

/**
 * Resolve a control point by (possibly out-of-range) index.
 *
 * For closed paths indices wrap around modulo `n`.  For open paths the ends
 * are extended with reflected phantom points so the spline has well-defined
 * tangents at the first and last vertices.
 */
function controlPoint(
  points: Coordinate[],
  index: number,
  closed: boolean,
): Coordinate {
  const n = points.length;

  if (closed) {
    return points[((index % n) + n) % n]!;
  }

  if (index < 0) {
    const p0 = points[0]!;
    const p1 = points[1]!;
    return [2 * p0[0] - p1[0], 2 * p0[1] - p1[1]];
  }

  if (index > n - 1) {
    const pn = points[n - 1]!;
    const pn1 = points[n - 2]!;
    return [2 * pn[0] - pn1[0], 2 * pn[1] - pn1[1]];
  }

  return points[index]!;
}

// ---------------------------------------------------------------------------
// smoothPath
// ---------------------------------------------------------------------------

/**
 * Catmull-Rom spline densification of a polyline into a smooth curve.
 *
 * The resulting curve interpolates every input vertex exactly (so an open
 * path's first and last coordinates are preserved), with `tension`
 * controlling the magnitude of the per-vertex tangents (0.5 = classic
 * uniform Catmull-Rom).  Fewer than three input points are returned as a
 * shallow copy, unchanged.
 *
 * @param points  - Ordered polyline vertices in normalised canvas space.
 * @param options - Subdivision, tension, and open/closed configuration.
 * @returns         The densified, smoothed coordinate list.
 */
export function smoothPath(
  points: Coordinate[],
  options: SmoothPathOptions = {},
): Coordinate[] {
  if (points.length < 3) {
    return points.map((p): Coordinate => [p[0], p[1]]);
  }

  const segments = clamp(
    Math.round(options.segments ?? DEFAULT_SEGMENTS),
    MIN_SEGMENTS,
    MAX_SEGMENTS,
  );
  const tension = clamp(options.tension ?? DEFAULT_TENSION, 0, 1);
  const closed = options.closed ?? false;

  const n = points.length;
  const segmentCount = closed ? n : n - 1;
  const result: Coordinate[] = [];

  for (let i = 0; i < segmentCount; i++) {
    const p0 = controlPoint(points, i - 1, closed);
    const p1 = controlPoint(points, i, closed);
    const p2 = controlPoint(points, i + 1, closed);
    const p3 = controlPoint(points, i + 2, closed);

    // Hermite tangents scaled by tension (Catmull-Rom: tension 0.5).
    const m1x = tension * (p2[0] - p0[0]);
    const m1y = tension * (p2[1] - p0[1]);
    const m2x = tension * (p3[0] - p1[0]);
    const m2y = tension * (p3[1] - p1[1]);

    // Emit the segment's leading vertex only for the first segment; every
    // subsequent segment shares its start with the previous segment's end.
    const startJ = i === 0 ? 0 : 1;

    for (let j = startJ; j <= segments; j++) {
      const t = j / segments;
      const t2 = t * t;
      const t3 = t2 * t;

      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;

      const x = h00 * p1[0] + h10 * m1x + h01 * p2[0] + h11 * m2x;
      const y = h00 * p1[1] + h10 * m1y + h01 * p2[1] + h11 * m2y;

      result.push([x, y]);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// sampleTaperedWidths
// ---------------------------------------------------------------------------

/**
 * Linear taper of widths from `startWidth` (first point) to `endWidth`
 * (last point).  Produces one width per input vertex so a renderer can
 * stroke a variable-width path (e.g. a river that narrows towards its
 * source).
 *
 * @param points     - Polyline vertices the widths correspond to.
 * @param startWidth - Width at the first vertex.
 * @param endWidth   - Width at the last vertex.
 * @returns            Array of widths with `length === points.length`.
 */
export function sampleTaperedWidths(
  points: Coordinate[],
  startWidth: number,
  endWidth: number,
): number[] {
  const n = points.length;
  if (n === 0) return [];
  if (n === 1) return [startWidth];

  const widths: number[] = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    widths[i] = startWidth + (endWidth - startWidth) * t;
  }
  return widths;
}
