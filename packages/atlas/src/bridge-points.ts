/**
 * Atlas bridge-point engine — find where a road polyline crosses a river
 * polyline, so map tools can auto-place a bridge glyph at each crossing
 * ("Canvas of Kings"-style automatic bridge placement).
 *
 * Pure and framework-agnostic: no DOM, no Canvas APIs, no RNG — the result is
 * fully determined by the two input polylines.
 */

/** A single road/river crossing suitable for placing a bridge glyph. */
export interface BridgePoint {
  x: number;
  y: number;
  /** road direction angle in degrees at the crossing */
  angleDeg: number;
}

/** A raw segment-segment intersection before merging near-duplicates. */
interface RawCrossing {
  x: number;
  y: number;
  angleDeg: number;
  /** Cumulative distance along the road polyline, used for ordering + merge. */
  roadDistance: number;
}

/**
 * Standard segment-segment intersection test via the parametric cross-product
 * form: solve `a1 + t*(a2-a1) = b1 + u*(b2-b1)` for `t, u` and require both in
 * `[0, 1]`. Parallel (including collinear) segments — where the cross-product
 * denominator is 0 — are reported as non-intersecting; the bridge-point use
 * case only cares about a road crossing a river, not running along it.
 */
function segmentIntersection(
  a1: readonly [number, number],
  a2: readonly [number, number],
  b1: readonly [number, number],
  b2: readonly [number, number],
): [number, number] | undefined {
  const rX = a2[0] - a1[0];
  const rY = a2[1] - a1[1];
  const sX = b2[0] - b1[0];
  const sY = b2[1] - b1[1];

  const denom = rX * sY - rY * sX;
  if (denom === 0) return undefined;

  const qpX = b1[0] - a1[0];
  const qpY = b1[1] - a1[1];
  const t = (qpX * sY - qpY * sX) / denom;
  const u = (qpX * rY - qpY * rX) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return undefined;

  return [a1[0] + t * rX, a1[1] + t * rY];
}

/**
 * Find where `road` crosses `river`, ordered from the start of `road` to its
 * end. Crossings closer together than `opts.minGap` (default 0.02, normalised
 * canvas units) are merged into one, keeping the earlier (along-road) hit.
 *
 * @param road  - Road polyline as ordered `[x, y]` points.
 * @param river - River polyline as ordered `[x, y]` points.
 * @param opts  - `minGap` — merge distance for near-duplicate crossings.
 * @returns       Bridge points ordered along the road, or `[]` when the
 *                polylines never cross (including when they run parallel).
 */
export function findBridgePoints(
  road: [number, number][],
  river: [number, number][],
  opts?: { minGap?: number },
): BridgePoint[] {
  const minGap = opts?.minGap ?? 0.02;
  if (road.length < 2 || river.length < 2) return [];

  const raw: RawCrossing[] = [];
  let roadWalked = 0;

  for (let i = 0; i < road.length - 1; i++) {
    const a1 = road[i]!;
    const a2 = road[i + 1]!;
    const segLen = Math.hypot(a2[0] - a1[0], a2[1] - a1[1]);
    if (segLen === 0) continue;
    const angleDeg = (Math.atan2(a2[1] - a1[1], a2[0] - a1[0]) * 180) / Math.PI;

    for (let j = 0; j < river.length - 1; j++) {
      const hit = segmentIntersection(a1, a2, river[j]!, river[j + 1]!);
      if (!hit) continue;
      const distAlongSeg = Math.hypot(hit[0] - a1[0], hit[1] - a1[1]);
      raw.push({ x: hit[0], y: hit[1], angleDeg, roadDistance: roadWalked + distAlongSeg });
    }

    roadWalked += segLen;
  }

  raw.sort((a, b) => a.roadDistance - b.roadDistance);

  const merged: BridgePoint[] = [];
  for (const crossing of raw) {
    const last = merged[merged.length - 1];
    if (last && Math.hypot(crossing.x - last.x, crossing.y - last.y) < minGap) continue;
    merged.push({ x: crossing.x, y: crossing.y, angleDeg: crossing.angleDeg });
  }

  return merged;
}
