// Datensatz-Aufbau (Ego-Netz oder ganzer Graph) und Simulations-Typen der
// Nachbarschafts-Graph-Engine.
//
// Aus `graph-engine.ts` herausgezogen (Modul-Disziplin: Monolith nicht anbauen).
// Verhalten unverändert.

import type { GraphEdge, GraphEdgeKind, GraphNode } from "@uwe/database/graph-types";

/**
 * Sicht-Gewicht je Kantenart (Linienbreite/Deckkraft-Multiplikator beim Rendern).
 * `relation` sind explizit benannte Beziehungen und wiegen am schwersten,
 * `hierarchy` ist strukturell und bewusst zurückhaltender (Strichelung trägt
 * dort die Betonung), `wiki`-Erwähnungen bleiben die leiseste Kantenart.
 */
const EDGE_KIND_WEIGHT: Record<GraphEdgeKind, number> = {
  wiki: 1,
  relation: 1.4,
  hierarchy: 0.75,
};

export interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fixed: boolean;
  hl: number;
  deg: number;
  r: number;
  /** Community-Index (Grüppchen) — steuert Cluster-Kraft und Kollisions-Moat. */
  group: number;
  _fx: number;
  _fy: number;
}

export interface SimEdge extends GraphEdge {
  hl: number;
  /**
   * Vorab bestimmtes Sicht-Gewicht je Kantenart (s. `EDGE_KIND_WEIGHT`,
   * Linienbreite/Deckkraft-Multiplikator beim Rendern). Optional, damit
   * händisch gebaute Test-Fixtures ohne das Feld weiter kompilieren — die
   * Engine füllt es beim regulären `buildDataset` immer.
   */
  weight?: number;
}

// Ego-Netz um focusId (Tiefe egoDepth) oder ganzer Graph.
export function buildDataset(
  nodes: GraphNode[],
  edges: GraphEdge[],
  focusId?: string | null,
  egoDepth?: number,
): { nodes: SimNode[]; edges: SimEdge[]; adj: Record<string, Set<string>> } {
  const adjAll: Record<string, Set<string>> = {};
  edges.forEach((e) => {
    (adjAll[e.sourceId] || (adjAll[e.sourceId] = new Set())).add(e.targetId);
    (adjAll[e.targetId] || (adjAll[e.targetId] = new Set())).add(e.sourceId);
  });
  let keep: Set<string>;
  if (focusId && egoDepth) {
    keep = new Set([focusId]);
    let frontier = [focusId];
    for (let d = 0; d < egoDepth; d++) {
      const next: string[] = [];
      frontier.forEach((id) =>
        (adjAll[id] || new Set()).forEach((nb) => {
          if (!keep.has(nb)) {
            keep.add(nb);
            next.push(nb);
          }
        }),
      );
      frontier = next;
    }
  } else {
    keep = new Set(nodes.map((n) => n.id));
  }
  const outNodes: SimNode[] = nodes
    .filter((n) => keep.has(n.id))
    .map((n) => ({
      ...n,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      fixed: false,
      hl: 1,
      deg: 0,
      r: 8,
      group: 0,
      _fx: 0,
      _fy: 0,
    }));
  const outEdges: SimEdge[] = edges
    .filter((e) => keep.has(e.sourceId) && keep.has(e.targetId))
    .map((e) => ({ ...e, hl: 1, weight: EDGE_KIND_WEIGHT[e.kind] ?? 1 }));
  const adj: Record<string, Set<string>> = {};
  outEdges.forEach((e) => {
    (adj[e.sourceId] || (adj[e.sourceId] = new Set())).add(e.targetId);
    (adj[e.targetId] || (adj[e.targetId] = new Set())).add(e.sourceId);
  });
  outNodes.forEach((n) => {
    if (!adj[n.id]) adj[n.id] = new Set();
  });
  return { nodes: outNodes, edges: outEdges, adj };
}
