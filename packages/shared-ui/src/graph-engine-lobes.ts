// Structure-aware lobe split for oversized communities (Wiki-Graph AAA).
//
// Replaces the Round-5 mechanical id-sort bipartition: when a community has
// more than COMMUNITY_LOBE_SPLIT_THRESHOLD members, we partition using the
// induced subgraph (connected components → Louvain-lite label-prop → short
// local layout + PCA median), falling back to id-sort only when there are no
// induced edges. Deterministic — same nodes/edges → same lobe membership.

import { detectCommunities } from "./graph-communities";
import type { SimNode } from "./graph-engine-dataset";

/** Ab dieser Mitgliederzahl wird eine Community in zwei Loben geteilt. */
export const COMMUNITY_LOBE_SPLIT_THRESHOLD = 12;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const LOCAL_LAYOUT_STEPS = 36;
const LOCAL_SPRING = 0.08;
const LOCAL_REP = 120;
const LOCAL_DAMP = 0.75;

type EdgeRef = { sourceId: string; targetId: string };

function idSortBipartition(members: SimNode[]): Map<string, 0 | 1> {
  const sorted = [...members].sort((a, b) => a.id.localeCompare(b.id));
  const mid = Math.ceil(sorted.length / 2);
  const out = new Map<string, 0 | 1>();
  sorted.forEach((m, i) => out.set(m.id, i < mid ? 0 : 1));
  return out;
}

/** Induced adjacency among `memberIds` (undirected). */
function inducedAdj(
  memberIds: Set<string>,
  edges: readonly EdgeRef[],
): { adj: Record<string, Set<string>>; edgeCount: number } {
  const adj: Record<string, Set<string>> = {};
  for (const id of memberIds) adj[id] = new Set();
  let edgeCount = 0;
  for (const e of edges) {
    if (!memberIds.has(e.sourceId) || !memberIds.has(e.targetId)) continue;
    if (e.sourceId === e.targetId) continue;
    if (!adj[e.sourceId].has(e.targetId)) {
      adj[e.sourceId].add(e.targetId);
      adj[e.targetId].add(e.sourceId);
      edgeCount += 1;
    }
  }
  return { adj, edgeCount };
}

function connectedComponents(
  ids: string[],
  adj: Record<string, Set<string>>,
): string[][] {
  const seen = new Set<string>();
  const comps: string[][] = [];
  const ordered = [...ids].sort((a, b) => a.localeCompare(b));
  for (const start of ordered) {
    if (seen.has(start)) continue;
    const stack = [start];
    const comp: string[] = [];
    seen.add(start);
    while (stack.length) {
      const id = stack.pop() as string;
      comp.push(id);
      for (const nb of adj[id] ?? []) {
        if (seen.has(nb)) continue;
        seen.add(nb);
        stack.push(nb);
      }
    }
    comps.push(comp.sort((a, b) => a.localeCompare(b)));
  }
  return comps;
}

/**
 * Pack labeled subgroups into exactly two lobes, balancing membership size.
 * Larger subgroups are placed first; ties break toward the smaller lobe, then
 * lobe 0 (deterministic).
 */
function packSubgroupsIntoTwoLobes(subgroups: string[][]): Map<string, 0 | 1> {
  const ranked = [...subgroups].sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return (a[0] ?? "").localeCompare(b[0] ?? "");
  });
  const lobeSizes = [0, 0];
  const out = new Map<string, 0 | 1>();
  for (const g of ranked) {
    const target: 0 | 1 = lobeSizes[0] <= lobeSizes[1] ? 0 : 1;
    for (const id of g) out.set(id, target);
    lobeSizes[target] += g.length;
  }
  // Degenerate: everything landed in one lobe (e.g. one giant CC) — split the
  // largest subgroup by id-sort so we still emit two packs.
  if (lobeSizes[0] === 0 || lobeSizes[1] === 0) {
    const all = ranked.flat();
    const mid = Math.ceil(all.length / 2);
    out.clear();
    all.forEach((id, i) => out.set(id, i < mid ? 0 : 1));
  }
  return out;
}

function packLabelsIntoTwoLobes(
  ids: string[],
  labels: Map<string, number>,
): Map<string, 0 | 1> {
  const byLabel = new Map<number, string[]>();
  for (const id of ids) {
    const l = labels.get(id) ?? 0;
    const list = byLabel.get(l);
    if (list) list.push(id);
    else byLabel.set(l, [id]);
  }
  for (const list of byLabel.values()) list.sort((a, b) => a.localeCompare(b));
  return packSubgroupsIntoTwoLobes([...byLabel.values()]);
}

/** Short deterministic spring layout on induced edges, then PCA-axis median cut. */
function axisMedianBipartition(
  members: SimNode[],
  adj: Record<string, Set<string>>,
): Map<string, 0 | 1> {
  const sorted = [...members].sort((a, b) => a.id.localeCompare(b.id));
  const n = sorted.length;
  const pos = new Map<string, { x: number; y: number; vx: number; vy: number }>();
  sorted.forEach((m, i) => {
    const ang = i * GOLDEN_ANGLE;
    const rad = Math.sqrt((i + 0.5) / n) * 48;
    pos.set(m.id, {
      x: Math.cos(ang) * rad,
      y: Math.sin(ang) * rad,
      vx: 0,
      vy: 0,
    });
  });

  for (let step = 0; step < LOCAL_LAYOUT_STEPS; step++) {
    for (const m of sorted) {
      const p = pos.get(m.id)!;
      let fx = -p.x * 0.01;
      let fy = -p.y * 0.01;
      for (const other of sorted) {
        if (other.id === m.id) continue;
        const q = pos.get(other.id)!;
        let dx = p.x - q.x;
        let dy = p.y - q.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1e-6) {
          dx = 0.01;
          dy = 0;
          d2 = 1e-4;
        }
        const inv = LOCAL_REP / d2;
        fx += dx * inv;
        fy += dy * inv;
      }
      for (const nb of adj[m.id] ?? []) {
        const q = pos.get(nb)!;
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        fx += dx * LOCAL_SPRING;
        fy += dy * LOCAL_SPRING;
      }
      p.vx = (p.vx + fx) * LOCAL_DAMP;
      p.vy = (p.vy + fy) * LOCAL_DAMP;
    }
    for (const m of sorted) {
      const p = pos.get(m.id)!;
      p.x += p.vx;
      p.y += p.vy;
    }
  }

  let mx = 0;
  let my = 0;
  for (const m of sorted) {
    const p = pos.get(m.id)!;
    mx += p.x;
    my += p.y;
  }
  mx /= n;
  my /= n;

  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const m of sorted) {
    const p = pos.get(m.id)!;
    const dx = p.x - mx;
    const dy = p.y - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }

  // Principal axis of the 2×2 covariance (analytic).
  const trace = sxx + syy;
  const det = sxx * syy - sxy * sxy;
  const gap = Math.sqrt(Math.max(0, (trace * trace) / 4 - det));
  const lambda = trace / 2 + gap;
  let ax = sxy;
  let ay = lambda - sxx;
  if (ax * ax + ay * ay < 1e-12) {
    ax = lambda - syy;
    ay = sxy;
  }
  if (ax * ax + ay * ay < 1e-12) {
    ax = 1;
    ay = 0;
  }
  const invLen = 1 / Math.hypot(ax, ay);
  ax *= invLen;
  ay *= invLen;

  const projected = sorted.map((m) => {
    const p = pos.get(m.id)!;
    return { id: m.id, t: (p.x - mx) * ax + (p.y - my) * ay };
  });
  projected.sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));
  const mid = Math.ceil(projected.length / 2);
  const out = new Map<string, 0 | 1>();
  projected.forEach((p, i) => out.set(p.id, i < mid ? 0 : 1));
  return out;
}

function bipartitionMembers(
  members: SimNode[],
  edges: readonly EdgeRef[],
): Map<string, 0 | 1> {
  const ids = members.map((m) => m.id);
  const memberIds = new Set(ids);
  const { adj, edgeCount } = inducedAdj(memberIds, edges);
  if (edgeCount === 0) return idSortBipartition(members);

  const comps = connectedComponents(ids, adj);
  if (comps.length >= 2) return packSubgroupsIntoTwoLobes(comps);

  const labels = detectCommunities(
    [...ids].sort((a, b) => a.localeCompare(b)),
    adj,
  );
  const distinct = new Set(labels.values());
  if (distinct.size >= 2) return packLabelsIntoTwoLobes(ids, labels);

  return axisMedianBipartition(members, adj);
}

/**
 * Communities with more than {@link COMMUNITY_LOBE_SPLIT_THRESHOLD} members are
 * split into two under-packs (new `group` IDs) so pack force + inter-community
 * moat keep them apart. Prefer structure of induced edges over id-sort.
 */
export function splitOversizedCommunityLobes(
  nodes: SimNode[],
  edges: readonly EdgeRef[] = [],
): void {
  const byGroup = new Map<number, SimNode[]>();
  nodes.forEach((nd) => {
    const list = byGroup.get(nd.group);
    if (list) list.push(nd);
    else byGroup.set(nd.group, [nd]);
  });
  let nextGroup = 0;
  for (const g of byGroup.keys()) nextGroup = Math.max(nextGroup, g + 1);
  for (const members of byGroup.values()) {
    if (members.length <= COMMUNITY_LOBE_SPLIT_THRESHOLD) continue;
    const assignment = bipartitionMembers(members, edges);
    const lobeB = nextGroup++;
    for (const m of members) {
      if (assignment.get(m.id) === 1) m.group = lobeB;
    }
  }
}

/** Intra-lobe vs cross-lobe undirected edge counts for a bipartition (test helper). */
export function lobeEdgeCutStats(
  nodes: SimNode[],
  edges: readonly EdgeRef[],
): { intra: number; cross: number; lobeSizes: number[] } {
  const groupOf = new Map(nodes.map((n) => [n.id, n.group]));
  const sizeMap = new Map<number, number>();
  for (const n of nodes) sizeMap.set(n.group, (sizeMap.get(n.group) ?? 0) + 1);
  let intra = 0;
  let cross = 0;
  const seen = new Set<string>();
  for (const e of edges) {
    const a = groupOf.get(e.sourceId);
    const b = groupOf.get(e.targetId);
    if (a == null || b == null) continue;
    const key = e.sourceId < e.targetId ? `${e.sourceId}|${e.targetId}` : `${e.targetId}|${e.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (a === b) intra += 1;
    else cross += 1;
  }
  return { intra, cross, lobeSizes: [...sizeMap.values()].sort((x, y) => y - x) };
}
