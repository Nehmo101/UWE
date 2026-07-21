/**
 * Path routing on a flat terrain — the A* assistant for rivers and roads.
 *
 * Deterministic grid A* over sampled terrain heights. Roads pay for slope,
 * rivers pay for flowing UPHILL (water prefers descending) and both avoid the
 * area outside the silhouette. Result is a smoothed polyline of map points
 * that the editor renders as a ribbon following the terrain.
 */

import type { TerrainField } from "./terrain-field";

export type PathKind = "river" | "road";

export interface FindPathOptions {
  kind: PathKind;
  /** Grid resolution across the map extent. */
  resolution?: number;
}

export interface PathPoint {
  x: number;
  z: number;
}

function key(ix: number, iz: number): number {
  return iz * 4096 + ix;
}

/**
 * A* from `from` to `to` (map coordinates). Returns the routed polyline
 * including both endpoints, or null when no route exists.
 */
export function findTerrainPath(
  field: TerrainField,
  from: PathPoint,
  to: PathPoint,
  options: FindPathOptions,
): PathPoint[] | null {
  const size = field.options.size;
  const n = options.resolution ?? 56;
  const cell = (size * 2) / n;

  const toIndex = (v: number) => Math.min(n - 1, Math.max(0, Math.round((v + size) / cell)));
  const toCoord = (i: number) => i * cell - size;

  const heights = new Float32Array(n * n);
  const blocked = new Uint8Array(n * n);
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const x = toCoord(ix);
      const z = toCoord(iz);
      heights[iz * n + ix] = field.height(x, z);
      // outside the locked silhouette is off-limits for routing
      if (field.silhouetteDistance(x, z) > cell) blocked[iz * n + ix] = 1;
    }
  }

  const start = { ix: toIndex(from.x), iz: toIndex(from.z) };
  const goal = { ix: toIndex(to.x), iz: toIndex(to.z) };
  if (blocked[start.iz * n + start.ix] || blocked[goal.iz * n + goal.ix]) return null;

  const stepCost = (fromH: number, toH: number, distance: number): number => {
    const rise = toH - fromH;
    const slope = Math.abs(rise) / distance;
    if (options.kind === "road") {
      return distance * (1 + slope * slope * 40);
    }
    // river: going downhill is nearly free, uphill is expensive
    const uphill = Math.max(0, rise) / distance;
    return distance * (0.4 + uphill * uphill * 120 + Math.max(0, -rise) * 0);
  };

  const heuristic = (ix: number, iz: number) => Math.hypot(ix - goal.ix, iz - goal.iz) * cell * 0.4;

  const open = new Map<number, { ix: number; iz: number; g: number; f: number }>();
  const cameFrom = new Map<number, number>();
  const gScore = new Map<number, number>();
  const startKey = key(start.ix, start.iz);
  gScore.set(startKey, 0);
  open.set(startKey, { ...start, g: 0, f: heuristic(start.ix, start.iz) });

  const NEIGHBORS = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ] as const;

  let guard = n * n * 12;
  while (open.size > 0 && guard-- > 0) {
    // smallest f (deterministic tie-break by key)
    let currentKey = -1;
    let best = Infinity;
    for (const [k, node] of open) {
      if (node.f < best - 1e-12 || (Math.abs(node.f - best) <= 1e-12 && k < currentKey)) {
        best = node.f;
        currentKey = k;
      }
    }
    const current = open.get(currentKey);
    if (!current) break;
    open.delete(currentKey);

    if (current.ix === goal.ix && current.iz === goal.iz) {
      const path: PathPoint[] = [];
      let walk = currentKey;
      while (cameFrom.has(walk)) {
        path.unshift({ x: toCoord(walk % 4096), z: toCoord(Math.floor(walk / 4096)) });
        walk = cameFrom.get(walk) as number;
      }
      path.unshift({ x: toCoord(start.ix), z: toCoord(start.iz) });
      path[0] = { ...from };
      path[path.length - 1] = { ...to };
      return simplifyPath(path, cell * 0.6);
    }

    const currentHeight = heights[current.iz * n + current.ix];
    for (const [dx, dz] of NEIGHBORS) {
      const nx = current.ix + dx;
      const nz = current.iz + dz;
      if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
      if (blocked[nz * n + nx]) continue;
      const distance = Math.hypot(dx, dz) * cell;
      const tentative = current.g + stepCost(currentHeight, heights[nz * n + nx], distance);
      const neighborKey = key(nx, nz);
      if (tentative < (gScore.get(neighborKey) ?? Infinity)) {
        gScore.set(neighborKey, tentative);
        cameFrom.set(neighborKey, currentKey);
        open.set(neighborKey, { ix: nx, iz: nz, g: tentative, f: tentative + heuristic(nx, nz) });
      }
    }
  }
  return null;
}

/** Ramer–Douglas–Peucker simplification to keep stored geometry lean. */
export function simplifyPath(points: readonly PathPoint[], tolerance: number): PathPoint[] {
  if (points.length <= 2) return [...points];
  const first = points[0];
  const last = points[points.length - 1];
  let maxDistance = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = pointToSegment(points[i], first, last);
    if (d > maxDistance) {
      maxDistance = d;
      index = i;
    }
  }
  if (maxDistance <= tolerance) return [first, last];
  const left = simplifyPath(points.slice(0, index + 1), tolerance);
  const right = simplifyPath(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

function pointToSegment(p: PathPoint, a: PathPoint, b: PathPoint): number {
  const ex = b.x - a.x;
  const ez = b.z - a.z;
  const len2 = ex * ex + ez * ez;
  const t = len2 > 0 ? Math.min(1, Math.max(0, ((p.x - a.x) * ex + (p.z - a.z) * ez) / len2)) : 0;
  return Math.hypot(p.x - (a.x + ex * t), p.z - (a.z + ez * t));
}
