/**
 * Straßen-Autorouting — deterministic A* road pathfinding over the Atlas tile
 * layer and its shared 2.5D elevation field.
 *
 * {@link routeRoad} takes two normalised [0, 1]² points and returns a road
 * polyline (also normalised) from start to goal that avoids impassable biomes
 * (water / coast), penalises steep slopes and costly biomes (mountains, swamp),
 * and prefers flat, cheap terrain. Pure engine module: no DOM, no React, and —
 * unlike the procedural generators — no randomness (see `prng.ts`, unused here).
 *
 * Grid: the tile layer's `cols × rows` cells; normalised coordinates map to cell
 * centres (`(col + 0.5) / cols`, `(row + 0.5) / rows`). The search uses an
 * 8-neighbourhood with diagonal step cost √2. Unpainted cells are passable at
 * base cost 1 (grassland-like); cells whose biome is in `blocked` are excluded.
 *
 * Cost to *enter* neighbour `b` from `a`:
 *   stepDistance · biomeFactor(b)  +  slopeCost · |elev(b) − elev(a)|
 * `biomeFactor` is 1 for unpainted / unlisted biomes and the per-biome value
 * otherwise; `elev` comes from the height field via {@link cellElevation}
 * (0 when the layer carries no elevation → flat, slope term vanishes).
 *
 * Determinism: the open set is a binary min-heap ordered first by f-score and,
 * when f-scores are equal, by the lower cell index (`row * cols + col`) — so
 * ties always resolve the same way and identical inputs yield deepEqual output.
 * The heuristic is octile distance scaled by the cheapest per-step terrain
 * factor: a lower bound that is admissible *and* consistent (it is the exact
 * shortest path on a relaxed uniform grid), so the first time the goal is
 * popped its cost is optimal and closed cells never need re-opening.
 */

import type { AtlasTileLayer } from "./doc";
import { cellElevation } from "./elevation";

const SQRT2 = Math.SQRT2;

/** Biome kinds treated as impassable unless overridden. */
const DEFAULT_BLOCKED = ["coast", "water"];

/** Per-biome step-cost multipliers (1 = grassland baseline) unless overridden. */
const DEFAULT_BIOME_COST: Record<string, number> = {
  mountains: 3,
  swamp: 4,
  hills: 1.5,
  forest: 1.2,
};

/** Default multiplier applied to |Δelevation| between neighbouring cells. */
const DEFAULT_SLOPE_COST = 40;

/** Chebyshev radius searched when snapping a start/goal off a blocked cell. */
const SNAP_RADIUS = 3;

/** 8-neighbourhood offsets (order is irrelevant — ties break on cell index). */
const NEIGHBORS: readonly [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

export interface RouteOptions {
  /** Biome kinds treated as impassable (default `["coast", "water"]`). */
  blocked?: string[];
  /** Per-biome extra step cost (default `{ mountains: 3, swamp: 4, hills: 1.5, forest: 1.2 }`). */
  biomeCost?: Record<string, number>;
  /** Multiplier for |Δelevation| between neighbouring cells (default `40`). */
  slopeCost?: number;
  /** Max explored-node safeguard (default `cols * rows * 8`). */
  maxExpansions?: number;
}

export interface RouteResult {
  /** Normalised [0, 1] coordinates, start→goal, simplified; `[]` when unreachable. */
  points: [number, number][];
  reachable: boolean;
  /** Total accumulated path cost (0 when unreachable or start === goal). */
  cost: number;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Octile distance between two cell offsets (orthogonal = 1, diagonal = √2). */
function octile(dx: number, dy: number): number {
  const a = Math.abs(dx);
  const b = Math.abs(dy);
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return hi - lo + SQRT2 * lo;
}

/**
 * Drop points that are collinear with their retained neighbours, preserving the
 * exact piecewise-linear geometry (dropped points lay on the kept segment, so
 * the polyline still only touches the passable cells the search walked).
 */
function simplify(pts: [number, number][]): [number, number][] {
  if (pts.length <= 2) return pts;
  const out: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(cross) > 1e-9) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

interface HeapEntry {
  f: number;
  i: number;
}

/** True when `a` sorts before `b`: lower f, then lower cell index (tie-break). */
function before(a: HeapEntry, b: HeapEntry): boolean {
  return a.f < b.f || (a.f === b.f && a.i < b.i);
}

/** Minimal binary min-heap over {@link HeapEntry} (no decrease-key; lazy dupes). */
class MinHeap {
  private readonly data: HeapEntry[] = [];

  get size(): number {
    return this.data.length;
  }

  push(entry: HeapEntry): void {
    const d = this.data;
    d.push(entry);
    let c = d.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (!before(d[c], d[p])) break;
      [d[c], d[p]] = [d[p], d[c]];
      c = p;
    }
  }

  pop(): HeapEntry {
    const d = this.data;
    const top = d[0];
    const last = d.pop() as HeapEntry;
    if (d.length > 0) {
      d[0] = last;
      let p = 0;
      for (;;) {
        const l = p * 2 + 1;
        const r = l + 1;
        let s = p;
        if (l < d.length && before(d[l], d[s])) s = l;
        if (r < d.length && before(d[r], d[s])) s = r;
        if (s === p) break;
        [d[p], d[s]] = [d[s], d[p]];
        p = s;
      }
    }
    return top;
  }
}

/**
 * Compute a deterministic least-cost road polyline between two normalised
 * points over the tile layer's biome + elevation grid.
 *
 * @param tileLayer - The Atlas terrain grid (`cols × rows`, sparse `cells`,
 *                    optional sparse `elevation`).
 * @param start     - Normalised [0, 1]² start position.
 * @param goal      - Normalised [0, 1]² goal position.
 * @param options   - Optional cost/passability overrides ({@link RouteOptions}).
 * @returns           A {@link RouteResult}; `reachable: false` / `points: []`
 *                    when no route exists (fully walled off, both endpoints
 *                    blocked with no passable cell within {@link SNAP_RADIUS},
 *                    or the expansion safeguard trips).
 */
export function routeRoad(
  tileLayer: AtlasTileLayer,
  start: [number, number],
  goal: [number, number],
  options: RouteOptions = {},
): RouteResult {
  const cols = tileLayer.cols | 0;
  const rows = tileLayer.rows | 0;
  const unreachable: RouteResult = { points: [], reachable: false, cost: 0 };
  if (cols <= 0 || rows <= 0) return unreachable;

  const blocked = new Set(options.blocked ?? DEFAULT_BLOCKED);
  const biomeCost = options.biomeCost ?? DEFAULT_BIOME_COST;
  const slopeCost = options.slopeCost ?? DEFAULT_SLOPE_COST;
  const maxExpansions = options.maxExpansions ?? cols * rows * 8;

  // Cheapest per-step terrain factor → keeps the octile heuristic a lower bound.
  let minFactor = 1;
  for (const v of Object.values(biomeCost)) if (v < minFactor) minFactor = v;
  if (minFactor < 0) minFactor = 0;

  const clampStart: [number, number] = [clamp01(start[0]), clamp01(start[1])];
  const clampGoal: [number, number] = [clamp01(goal[0]), clamp01(goal[1])];

  const idx = (c: number, r: number): number => r * cols + c;
  const colOf = (i: number): number => i % cols;
  const rowOf = (i: number): number => (i - (i % cols)) / cols;
  const inBounds = (c: number, r: number): boolean => c >= 0 && c < cols && r >= 0 && r < rows;
  const biomeAt = (c: number, r: number): string | undefined => tileLayer.cells?.[`${c},${r}`];
  const passable = (c: number, r: number): boolean => {
    if (!inBounds(c, r)) return false;
    const b = biomeAt(c, r);
    return b === undefined || !blocked.has(b);
  };
  const biomeFactor = (c: number, r: number): number => {
    const b = biomeAt(c, r);
    return b === undefined ? 1 : biomeCost[b] ?? 1;
  };

  const toCol = (n: number): number => Math.min(cols - 1, Math.max(0, Math.floor(n * cols)));
  const toRow = (n: number): number => Math.min(rows - 1, Math.max(0, Math.floor(n * rows)));

  // Snap an endpoint off a blocked cell to the nearest passable cell within
  // SNAP_RADIUS; within the nearest ring, the lowest cell index wins (deterministic).
  const snap = (c0: number, r0: number): number => {
    if (passable(c0, r0)) return idx(c0, r0);
    for (let rad = 1; rad <= SNAP_RADIUS; rad++) {
      let best = -1;
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
          const c = c0 + dc;
          const r = r0 + dr;
          if (!passable(c, r)) continue;
          const id = idx(c, r);
          if (best === -1 || id < best) best = id;
        }
      }
      if (best !== -1) return best;
    }
    return -1;
  };

  const startIdx = snap(toCol(clampStart[0]), toRow(clampStart[1]));
  const goalIdx = snap(toCol(clampGoal[0]), toRow(clampGoal[1]));
  if (startIdx < 0 || goalIdx < 0) return unreachable;

  const gc = colOf(goalIdx);
  const gr = rowOf(goalIdx);
  const heuristic = (i: number): number => minFactor * octile(gc - colOf(i), gr - rowOf(i));

  const n = cols * rows;
  const g = new Float64Array(n).fill(Infinity);
  const from = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const open = new MinHeap();
  g[startIdx] = 0;
  open.push({ f: heuristic(startIdx), i: startIdx });

  let expansions = 0;
  let found = false;
  while (open.size > 0 && expansions < maxExpansions) {
    const cur = open.pop().i;
    if (closed[cur]) continue;
    if (cur === goalIdx) {
      found = true;
      break;
    }
    closed[cur] = 1;
    expansions++;
    const cc = colOf(cur);
    const cr = rowOf(cur);
    const elevCur = cellElevation(tileLayer, cc, cr);
    for (const [dc, dr] of NEIGHBORS) {
      const nc = cc + dc;
      const nr = cr + dr;
      if (!passable(nc, nr)) continue;
      const ni = idx(nc, nr);
      if (closed[ni]) continue;
      const stepDist = dc !== 0 && dr !== 0 ? SQRT2 : 1;
      const step =
        stepDist * biomeFactor(nc, nr) +
        slopeCost * Math.abs(cellElevation(tileLayer, nc, nr) - elevCur);
      const tentative = g[cur] + step;
      if (tentative < g[ni]) {
        g[ni] = tentative;
        from[ni] = cur;
        open.push({ f: tentative + heuristic(ni), i: ni });
      }
    }
  }

  if (!found) return unreachable;

  // Reconstruct start→goal cell chain, convert to centres, pin exact endpoints.
  const cells: number[] = [];
  for (let cur = goalIdx; cur !== -1; cur = from[cur]) cells.push(cur);
  cells.reverse();
  const center = (i: number): [number, number] => [
    (colOf(i) + 0.5) / cols,
    (rowOf(i) + 0.5) / rows,
  ];

  let pts: [number, number][];
  if (cells.length <= 1) {
    pts = [clampStart, clampGoal];
  } else {
    pts = cells.map(center);
    pts[0] = clampStart;
    pts[pts.length - 1] = clampGoal;
  }

  return { points: simplify(pts), reachable: true, cost: g[goalIdx] };
}
