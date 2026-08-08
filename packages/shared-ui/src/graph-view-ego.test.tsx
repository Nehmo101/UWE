// Nachbarschaft / ego-toggle + engine ego-rebuild regressions (Wiki-Graph AAA chrome).

import test from "node:test";
import assert from "node:assert/strict";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { GraphEdge, GraphNode } from "@uwe/database/graph-types";
import { buildDataset } from "./graph-engine-dataset";
import { GraphEngine } from "./graph-engine";
import { GraphViewControls } from "./GraphViewControls";
import { resolveNeighborhoodFocus, stepNeighborhoodDepth } from "./graph-view-ego";

function node(id: string, category: GraphNode["category"] = "npc"): GraphNode {
  return {
    id,
    title: id,
    slug: id,
    type: category,
    category,
    tags: [],
    href: `/${id}`,
    campaignId: null,
  };
}

function edge(id: string, sourceId: string, targetId: string): GraphEdge {
  return { id, sourceId, targetId, kind: "wiki", relationType: "wiki", label: "" };
}

function makeMockCtx(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => {} };
  return {
    filter: "none",
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: "butt",
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    setTransform: () => {},
    save: () => {},
    restore: () => {},
    clearRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    arcTo: () => {},
    quadraticCurveTo: () => {},
    fill: () => {},
    stroke: () => {},
    setLineDash: () => {},
    measureText: (t: string) => ({ width: t.length * 6 }),
    fillText: () => {},
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
  } as unknown as CanvasRenderingContext2D;
}

function makeCanvas(): HTMLCanvasElement {
  const canvas = {
    style: {} as Record<string, string>,
    width: 800,
    height: 600,
    getContext: () => makeMockCtx(),
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
  };
  return canvas as unknown as HTMLCanvasElement;
}

/** Line graph: hub — a — b — c — d (depth filters the ego net). */
function lineGraph() {
  const nodes = [node("hub"), node("a"), node("b"), node("c"), node("d"), node("orphan")];
  const edges = [
    edge("e1", "hub", "a"),
    edge("e2", "a", "b"),
    edge("e3", "b", "c"),
    edge("e4", "c", "d"),
  ];
  return { nodes, edges };
}

test("resolveNeighborhoodFocus: toggle off → full graph; on + selection → ego focus", () => {
  const ids = ["hub", "a", "b"];
  const off = resolveNeighborhoodFocus({
    compact: false,
    localMode: false,
    selectedId: "hub",
    focusPageId: undefined,
    nodeIds: ids,
  });
  assert.equal(off.canGoLocal, true);
  assert.equal(off.effectiveFocusId, null);

  const on = resolveNeighborhoodFocus({
    compact: false,
    localMode: true,
    selectedId: "hub",
    focusPageId: undefined,
    nodeIds: ids,
  });
  assert.equal(on.effectiveFocusId, "hub");

  const noAnchor = resolveNeighborhoodFocus({
    compact: false,
    localMode: true,
    selectedId: null,
    focusPageId: undefined,
    nodeIds: ids,
  });
  assert.equal(noAnchor.canGoLocal, false);
  assert.equal(noAnchor.effectiveFocusId, null);

  const compact = resolveNeighborhoodFocus({
    compact: true,
    localMode: true,
    selectedId: "hub",
    focusPageId: undefined,
    nodeIds: ids,
  });
  assert.equal(compact.canGoLocal, false);
  assert.equal(compact.effectiveFocusId, null);

  const stale = resolveNeighborhoodFocus({
    compact: false,
    localMode: true,
    selectedId: "gone",
    focusPageId: "hub",
    nodeIds: ids,
  });
  // Selected wins as anchor even when missing → cannot go local / no effective focus.
  assert.equal(stale.localAnchorId, "gone");
  assert.equal(stale.localAnchorExists, false);
  assert.equal(stale.effectiveFocusId, null);

  const focusFallback = resolveNeighborhoodFocus({
    compact: false,
    localMode: true,
    selectedId: null,
    focusPageId: "hub",
    nodeIds: ids,
  });
  assert.equal(focusFallback.effectiveFocusId, "hub");
});

test("stepNeighborhoodDepth clamps Tiefe stepper 1–4", () => {
  assert.equal(stepNeighborhoodDepth(2, 1, 1, 4), 3);
  assert.equal(stepNeighborhoodDepth(4, 1, 1, 4), 4);
  assert.equal(stepNeighborhoodDepth(1, -1, 1, 4), 1);
  assert.equal(stepNeighborhoodDepth(2, -1, 1, 4), 1);
});

test("buildDataset ego rebuild: depth shrinks the neighborhood", () => {
  const { nodes, edges } = lineGraph();
  const full = buildDataset(nodes, edges);
  assert.equal(full.nodes.length, 6);

  const d1 = buildDataset(nodes, edges, "hub", 1);
  const d1Ids = new Set(d1.nodes.map((n) => n.id));
  assert.deepEqual([...d1Ids].sort(), ["a", "hub"]);

  const d2 = buildDataset(nodes, edges, "hub", 2);
  const d2Ids = new Set(d2.nodes.map((n) => n.id));
  assert.deepEqual([...d2Ids].sort(), ["a", "b", "hub"]);
  assert.ok(d2.nodes.length < full.nodes.length);
  assert.ok(d2.nodes.length > d1.nodes.length);

  const d3 = buildDataset(nodes, edges, "hub", 3);
  assert.ok(d3.nodes.some((n) => n.id === "c"));
  assert.ok(!d3.nodes.some((n) => n.id === "orphan"));
});

test("GraphEngine ego rebuild mirrors Nachbarschaft focusId/egoDepth", () => {
  const { nodes, edges } = lineGraph();
  const full = new GraphEngine(makeCanvas(), { nodes, edges });
  assert.equal(full.nodeCount, 6);

  const ego = new GraphEngine(makeCanvas(), {
    nodes,
    edges,
    focusId: "hub",
    egoDepth: 2,
  });
  assert.equal(ego.nodeCount, 3);
  assert.equal(ego.edgeCount, 2);
  const counts = ego.categoryCounts();
  assert.equal(counts.npc, 3);
});

function controlsProps(
  overrides: Partial<ComponentProps<typeof GraphViewControls>> = {},
): ComponentProps<typeof GraphViewControls> {
  return {
    query: "",
    onSearch: () => {},
    categories: ["npc"],
    categoryCounts: { npc: 3 },
    hidden: new Set(),
    onToggleCategory: () => {},
    stats: { totalNodes: 6, visibleNodes: 6, totalEdges: 4, visibleEdges: 4 },
    neighborhoodActive: false,
    canGoNeighborhood: true,
    neighborhoodAnchorTitle: null,
    depth: 2,
    minDepth: 1,
    maxDepth: 4,
    onToggleNeighborhood: () => {},
    onChangeDepth: () => {},
    hideOrphans: false,
    orphanCount: 1,
    onToggleOrphans: () => {},
    ...overrides,
  };
}

test("GraphViewControls shows Nachbarschaft toggle + Tiefe when active", () => {
  const htmlOff = renderToStaticMarkup(<GraphViewControls {...controlsProps()} />);
  assert.match(htmlOff, /Nachbarschaft/);
  assert.match(htmlOff, /Isolierte/);
  assert.match(htmlOff, /Filter: Kategorien und Nachbarschaftstiefe/);
  assert.doesNotMatch(htmlOff, /Tiefe der Nachbarschaft/);

  const htmlOn = renderToStaticMarkup(
    <GraphViewControls
      {...controlsProps({
        stats: { totalNodes: 3, visibleNodes: 3, totalEdges: 2, visibleEdges: 2 },
        neighborhoodActive: true,
        neighborhoodAnchorTitle: "Hub 1.0",
      })}
    />,
  );
  assert.match(htmlOn, /Nachbarschaft: Hub 1\.0/);
  assert.match(htmlOn, /Tiefe der Nachbarschaft/);
  assert.match(htmlOn, /Tiefe verringern/);
  assert.match(htmlOn, /Tiefe erhöhen/);
  assert.match(htmlOn, />2</);
});

test("GraphEngine hideOrphans fades deg-0 nodes from visible count", () => {
  const { nodes, edges } = lineGraph();
  const engine = new GraphEngine(makeCanvas(), { nodes, edges });
  assert.equal(engine.orphanCount(), 1);
  assert.equal(engine.visibleNodeCount(), 6);
  engine.setHideOrphans(true);
  assert.equal(engine.visibleNodeCount(), 5);
  engine.destroy();
});
