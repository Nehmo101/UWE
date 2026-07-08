/**
 * Territorien-Vorschlag: deterministic territory suggestion around city /
 * settlement seed points.
 *
 * Samples a grid over normalised canvas space [0,1]^2, assigns each sample
 * to its nearest seed (optionally weighted), then traces the outer boundary
 * of each seed's largest connected sample cluster into a polygon ring. The
 * result is a rough weighted-Voronoi partition, deliberately grid-snapped
 * and dependency-free (no external Voronoi/geometry library), suitable as a
 * starting point for editable `region` features.
 *
 * Rings repeat the first point at the end (`ring[0] === ring[last]`),
 * matching the convention used elsewhere for Atlas region polygons (see
 * `scripts/atlas-cok-demo-seed.ts`).
 */

const DEFAULT_SAMPLES_X = 96;
const DEFAULT_SAMPLES_Y = 60;

export interface TerritorySeed {
  key: string;
  x: number;
  y: number;
  /** Relative pull strength; larger weight claims more area. Default 1. */
  weight?: number;
}

export interface TerritoryOptions {
  /** Grid sample columns across [0,1]. Default 96. */
  samplesX?: number;
  /** Grid sample rows across [0,1]. Default 60. */
  samplesY?: number;
  /** When true for a sample point, that sample belongs to no seed (e.g. water). */
  exclude?: (x: number, y: number) => boolean;
}

export interface TerritoryRegion {
  key: string;
  ring: [number, number][];
  sampleCount: number;
}

type Point = [number, number];

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Suggest territory polygons around seed points via a grid-sampled,
 * weighted nearest-seed assignment. Pure function of its inputs.
 */
export function suggestTerritories(
  seeds: TerritorySeed[],
  options: TerritoryOptions = {},
): TerritoryRegion[] {
  if (!seeds.length) return [];

  const samplesX = Math.max(1, Math.floor(options.samplesX ?? DEFAULT_SAMPLES_X));
  const samplesY = Math.max(1, Math.floor(options.samplesY ?? DEFAULT_SAMPLES_Y));
  const exclude = options.exclude;

  const clamped = seeds.map((s) => ({
    key: s.key,
    x: clamp01(s.x),
    y: clamp01(s.y),
    weight: s.weight && s.weight > 0 ? s.weight : 1,
  }));

  // assignment[j * samplesX + i] holds the winning seed index, or -1 when the
  // sample is excluded (belongs to no seed).
  const assignment = new Int32Array(samplesX * samplesY).fill(-1);

  for (let j = 0; j < samplesY; j++) {
    const cy = (j + 0.5) / samplesY;
    for (let i = 0; i < samplesX; i++) {
      const cx = (i + 0.5) / samplesX;
      if (exclude && exclude(cx, cy)) continue;
      let best = -1;
      let bestDist = Infinity;
      for (let s = 0; s < clamped.length; s++) {
        const seed = clamped[s]!;
        const dist = Math.hypot(cx - seed.x, cy - seed.y) / seed.weight;
        if (dist < bestDist) {
          bestDist = dist;
          best = s;
        }
      }
      assignment[j * samplesX + i] = best;
    }
  }

  const regions: TerritoryRegion[] = [];
  for (let s = 0; s < clamped.length; s++) {
    const component = largestComponent(assignment, samplesX, samplesY, s);
    if (!component || component.size === 0) {
      regions.push({ key: clamped[s]!.key, ring: [], sampleCount: 0 });
      continue;
    }
    const ring = traceBoundary(component, samplesX, samplesY).map(
      ([gx, gy]): Point => [gx / samplesX, gy / samplesY],
    );
    regions.push({ key: clamped[s]!.key, ring, sampleCount: component.size });
  }

  return regions;
}

/** 4-connected flood fill; returns the largest cluster of cells assigned to `seedIndex`. */
function largestComponent(
  assignment: Int32Array,
  samplesX: number,
  samplesY: number,
  seedIndex: number,
): Set<number> | null {
  const total = samplesX * samplesY;
  const visited = new Uint8Array(total);
  let best: number[] | null = null;

  for (let idx = 0; idx < total; idx++) {
    if (assignment[idx] !== seedIndex || visited[idx]) continue;
    const stack = [idx];
    visited[idx] = 1;
    const comp: number[] = [];
    while (stack.length) {
      const cur = stack.pop()!;
      comp.push(cur);
      const ci = cur % samplesX;
      const cj = (cur - ci) / samplesX;
      const neighbors: [number, number][] = [
        [ci - 1, cj],
        [ci + 1, cj],
        [ci, cj - 1],
        [ci, cj + 1],
      ];
      for (const [ni, nj] of neighbors) {
        if (ni < 0 || ni >= samplesX || nj < 0 || nj >= samplesY) continue;
        const nIdx = nj * samplesX + ni;
        if (visited[nIdx] || assignment[nIdx] !== seedIndex) continue;
        visited[nIdx] = 1;
        stack.push(nIdx);
      }
    }
    if (!best || comp.length > best.length) best = comp;
  }

  return best ? new Set(best) : null;
}

interface Edge {
  from: Point;
  to: Point;
}

/**
 * Grid boundary-walk contour trace: for a set of unit cells (identified by
 * `row * samplesX + col`), emits one directed edge per cell side that faces
 * a non-member cell (or the grid border), then chains those edges into
 * closed loops. The loop enclosing the largest area is the outer ring;
 * smaller loops (from excluded holes) are discarded.
 */
function traceBoundary(component: Set<number>, samplesX: number, samplesY: number): Point[] {
  const filled = (ci: number, cj: number): boolean => {
    if (ci < 0 || ci >= samplesX || cj < 0 || cj >= samplesY) return false;
    return component.has(cj * samplesX + ci);
  };

  const edges: Edge[] = [];
  for (const idx of component) {
    const ci = idx % samplesX;
    const cj = (idx - ci) / samplesX;
    const tl: Point = [ci, cj];
    const tr: Point = [ci + 1, cj];
    const br: Point = [ci + 1, cj + 1];
    const bl: Point = [ci, cj + 1];
    if (!filled(ci, cj - 1)) edges.push({ from: tl, to: tr });
    if (!filled(ci + 1, cj)) edges.push({ from: tr, to: br });
    if (!filled(ci, cj + 1)) edges.push({ from: br, to: bl });
    if (!filled(ci - 1, cj)) edges.push({ from: bl, to: tl });
  }

  const key = (p: Point): string => `${p[0]},${p[1]}`;
  const byStart = new Map<string, Edge[]>();
  for (const e of edges) {
    const k = key(e.from);
    const list = byStart.get(k);
    if (list) list.push(e);
    else byStart.set(k, [e]);
  }

  const used = new Set<Edge>();
  const loops: Point[][] = [];
  for (const start of edges) {
    if (used.has(start)) continue;
    const loop: Point[] = [start.from];
    let current: Edge | undefined = start;
    while (current) {
      used.add(current);
      loop.push(current.to);
      if (current.to[0] === loop[0]![0] && current.to[1] === loop[0]![1]) break;
      const candidates: Edge[] = byStart.get(key(current.to)) ?? [];
      current = candidates.find((c: Edge) => !used.has(c));
    }
    loops.push(loop);
  }

  if (!loops.length) return [];

  let outer = loops[0]!;
  let outerArea = 0;
  for (const loop of loops) {
    const area = Math.abs(shoelace(loop));
    if (area > outerArea) {
      outerArea = area;
      outer = loop;
    }
  }

  return simplifyCollinear(outer);
}

function shoelace(ring: Point[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[i + 1]!;
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

/** Drop points collinear with both neighbours; keeps the ring closed (first === last). */
function simplifyCollinear(ring: Point[]): Point[] {
  if (ring.length <= 4) return ring.slice();
  const pts = ring.slice(0, -1);
  const n = pts.length;
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]!;
    const cur = pts[i]!;
    const next = pts[(i + 1) % n]!;
    const cross = (cur[0] - prev[0]) * (next[1] - cur[1]) - (cur[1] - prev[1]) * (next[0] - cur[0]);
    if (cross !== 0) out.push(cur);
  }
  if (!out.length) return ring.slice();
  out.push(out[0]!);
  return out;
}
