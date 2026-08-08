/**
 * Shared ~100-node fixture for Wiki-Graph AAA harnesses (engine + React).
 * Kept free of DOM side-effects so both harness-entry and react-chrome-entry
 * can import it safely.
 */

import type { GraphEdge, GraphEdgeKind, GraphNode, GraphNodeCategory } from "@uwe/database/graph-types";

const CATEGORIES: GraphNodeCategory[] = [
  "npc",
  "location",
  "faction",
  "session",
  "dungeon",
  "item",
  "lore",
  "quest",
  "handout",
];

const PAGE_TYPES = [
  "npc",
  "location",
  "faction",
  "session",
  "dungeon",
  "item",
  "lore",
  "quest",
  "handout",
] as const;

const EDGE_KINDS: GraphEdgeKind[] = ["wiki", "relation", "hierarchy"];

/** Deterministic PRNG so baselines stay stable across captures. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export interface FixtureGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** ~100-node fixture with several communities and mixed edge kinds. */
export function buildFixture(opts?: { nodeCount?: number; communities?: number }): FixtureGraph {
  const rand = mulberry32(0x57494b49); // "WIKI"
  const nodeCount = opts?.nodeCount ?? 100;
  const communities = opts?.communities ?? 6;

  const nodes: GraphNode[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const community = i % communities;
    const cat = CATEGORIES[i % CATEGORIES.length];
    const type = PAGE_TYPES[CATEGORIES.indexOf(cat)] ?? "lore";
    const hubs = community * Math.ceil(nodeCount / communities);
    const isHub = i === hubs || (i > hubs && (i - hubs) % 11 === 0);
    nodes.push({
      id: `n${i}`,
      title: isHub ? `Hub ${community + 1}.${Math.floor(i / communities)}` : `Node ${i}`,
      slug: `node-${i}`,
      type: type as GraphNode["type"],
      category: cat,
      tags: [`c${community}`, cat],
      href: `/w/node-${i}`,
      campaignId: null,
      isFocus: i === 0,
    });
  }

  const edges: GraphEdge[] = [];
  let edgeSeq = 0;
  const pushEdge = (sourceId: string, targetId: string, kind: GraphEdgeKind, label: string) => {
    if (sourceId === targetId) return;
    edges.push({
      id: `e${edgeSeq++}`,
      sourceId,
      targetId,
      kind,
      relationType: kind,
      label,
    });
  };

  for (let c = 0; c < communities; c++) {
    const members = nodes.filter((_, i) => i % communities === c);
    const hub = members[0];
    for (let i = 1; i < members.length; i++) {
      const parent = members[Math.floor((i - 1) / 2)] ?? hub;
      const kind: GraphEdgeKind = i % 4 === 0 ? "hierarchy" : "wiki";
      pushEdge(parent.id, members[i].id, kind, kind === "hierarchy" ? "child" : "link");
    }
    for (let i = 0; i < Math.min(8, members.length - 1); i++) {
      const a = members[1 + Math.floor(rand() * (members.length - 1))];
      const b = members[1 + Math.floor(rand() * (members.length - 1))];
      pushEdge(a.id, b.id, EDGE_KINDS[Math.floor(rand() * EDGE_KINDS.length)], "see also");
    }
  }

  for (let c = 0; c < communities; c++) {
    const next = (c + 1) % communities;
    const a = nodes[c];
    const b = nodes[next];
    pushEdge(a.id, b.id, "relation", "allied");
    const a2 = nodes[c + communities * 2] ?? a;
    const b2 = nodes[next + communities * 3] ?? b;
    pushEdge(a2.id, b2.id, "wiki", "cross");
  }

  for (let i = 0; i < 12; i++) {
    const a = nodes[Math.floor(rand() * nodes.length)];
    const b = nodes[Math.floor(rand() * nodes.length)];
    pushEdge(a.id, b.id, "wiki", "distant");
  }

  return { nodes, edges };
}
