/**
 * Layout helpers for curved (path-following) map labels.
 */

import type { Coordinate } from "./geometry";

export interface CharacterPlacement {
  char: string;
  x: number;
  y: number;
  /** Rotation in radians, tangent to path. */
  rotation: number;
}

function segmentLength(a: Coordinate, b: Coordinate): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/** Total polyline length in normalised coordinates. */
export function pathLength(points: Coordinate[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += segmentLength(points[i]!, points[i + 1]!);
  }
  return total;
}

/** Point and tangent angle at distance `d` along the polyline (clamped). */
export function pointAtDistance(
  points: Coordinate[],
  d: number,
): { point: Coordinate; rotation: number } {
  if (points.length === 0) {
    return { point: [0, 0], rotation: 0 };
  }
  if (points.length === 1) {
    return { point: points[0]!, rotation: 0 };
  }

  const total = pathLength(points);
  if (total <= 0) {
    return { point: points[0]!, rotation: 0 };
  }

  const clamped = Math.max(0, Math.min(d, total));
  let walked = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const len = segmentLength(a, b);
    if (walked + len >= clamped) {
      const t = len > 0 ? (clamped - walked) / len : 0;
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      const rotation = Math.atan2(b[1] - a[1], b[0] - a[0]);
      return { point: [x, y], rotation };
    }
    walked += len;
  }

  const last = points[points.length - 1]!;
  const prev = points[points.length - 2]!;
  return {
    point: last,
    rotation: Math.atan2(last[1] - prev[1], last[0] - prev[0]),
  };
}

/**
 * Place uppercase characters evenly along a polyline path.
 * `letterSpacing` is in normalised coordinate units (typical 0.008–0.02).
 */
export function layoutCharactersOnPath(
  text: string,
  path: Coordinate[],
  letterSpacing = 0.012,
  reverse = false,
): CharacterPlacement[] {
  const points = reverse ? [...path].reverse() : path;
  const chars = [...text.toUpperCase().replace(/\s+/g, " ")];
  if (chars.length === 0 || points.length < 2) return [];

  const total = pathLength(points);
  const blockWidth = Math.max(letterSpacing, (chars.length - 1) * letterSpacing);
  const start = Math.max(0, (total - blockWidth) / 2);

  return chars.map((char, index) => {
    const { point, rotation } = pointAtDistance(points, start + index * letterSpacing);
    return { char, x: point[0], y: point[1], rotation };
  });
}
