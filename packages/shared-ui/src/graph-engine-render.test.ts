// Tests für den Canvas-Renderer der Graph-Engine (graph-engine-render.ts):
// reine Geometrie (konvexe Hülle) plus ein Rauch-Test, der die komplette Szene
// gegen einen aufzeichnenden Canvas-Mock zeichnet — ohne echtes DOM/Canvas.

import test from "node:test";
import assert from "node:assert/strict";
import type { GraphNodeCategory } from "@uwe/database/graph-types";
import { GRAPH_CATEGORY_COLORS } from "./graph-engine-visuals";
import type { SimEdge, SimNode } from "./graph-engine-dataset";
import {
  convexHull,
  EDGE_OVERVIEW_MEDIAN_SKIP_MUL,
  medianSorted,
  overviewDimEdgeSkipLength,
  renderGraphMinimap,
  renderGraphScene,
} from "./graph-engine-render";

test("medianSorted / overviewDimEdgeSkipLength gate long bridges", () => {
  assert.equal(medianSorted([]), 0);
  assert.equal(medianSorted([10]), 10);
  assert.equal(medianSorted([2, 4, 6]), 4);
  assert.equal(medianSorted([2, 4, 6, 8]), 5);
  assert.equal(overviewDimEdgeSkipLength(100), 100 * EDGE_OVERVIEW_MEDIAN_SKIP_MUL);
  assert.equal(overviewDimEdgeSkipLength(0), Infinity);
});

test("convexHull liefert für ein Quadrat genau die vier Ecken", () => {
  const pts = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
    { x: 5, y: 5 }, // innenliegender Punkt — darf nicht Teil der Hülle sein
  ];
  const hull = convexHull(pts);
  assert.equal(hull.length, 4);
  assert.ok(!hull.some((p) => p.x === 5 && p.y === 5));
});

test("convexHull gibt Eingaben mit ≤2 Punkten unverändert zurück", () => {
  const pts = [{ x: 1, y: 1 }, { x: 2, y: 2 }];
  assert.deepEqual(convexHull(pts), pts);
  assert.deepEqual(convexHull([]), []);
});

// --- Aufzeichnender Canvas-2D-Mock (kein DOM nötig) --------------------------
function makeMockCtx() {
  const calls: string[] = [];
  const gradient = { addColorStop: () => {} };
  const ctx = {
    filter: "none",
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: "butt",
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    clearRect: () => calls.push("clearRect"),
    fillRect: () => calls.push("fillRect"),
    strokeRect: () => calls.push("strokeRect"),
    beginPath: () => calls.push("beginPath"),
    closePath: () => calls.push("closePath"),
    moveTo: () => {},
    lineTo: () => {},
    arc: () => calls.push("arc"),
    arcTo: () => {},
    quadraticCurveTo: () => {},
    fill: () => calls.push("fill"),
    stroke: () => calls.push("stroke"),
    setLineDash: () => {},
    measureText: (t: string) => ({ width: t.length * 6 }),
    fillText: () => calls.push("fillText"),
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

function makeNode(id: string, x: number, y: number, category: GraphNodeCategory, group = 0): SimNode {
  return {
    id,
    title: `Knoten ${id}`,
    slug: id,
    type: "npc",
    category,
    tags: [],
    href: `/${id}`,
    campaignId: null,
    x,
    y,
    vx: 0,
    vy: 0,
    fixed: false,
    hl: 1,
    deg: 2,
    r: 10,
    group,
    _fx: 0,
    _fy: 0,
  };
}

function makeEdge(id: string, sourceId: string, targetId: string, kind: SimEdge["kind"]): SimEdge {
  return { id, sourceId, targetId, kind, relationType: kind, label: kind, hl: 1, weight: 1 };
}

test("renderGraphScene zeichnet eine gemischte Szene ohne zu werfen (alle Kantenarten, Hülle, Fokus)", () => {
  const nodes = [
    makeNode("a", 0, 0, "npc", 0),
    makeNode("b", 40, 0, "location", 0),
    makeNode("c", 200, 200, "faction", 1),
  ];
  nodes[2].hl = 0.1; // gedimmter Knoten außerhalb des Fokus
  const edges = [
    makeEdge("e1", "a", "b", "wiki"),
    makeEdge("e2", "a", "b", "relation"),
    makeEdge("e3", "b", "c", "hierarchy"),
  ];
  edges[2].hl = 0.05;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const { ctx } = makeMockCtx();

  assert.doesNotThrow(() => {
    renderGraphScene({
      ctx,
      width: 400,
      height: 300,
      nodes,
      edges,
      byId: (id) => byId.get(id),
      zoom: 1,
      tx: 100,
      ty: 100,
      nodeScale: 1,
      chrome: {
        ground: "#f1e8d4",
        ring: "#f1e8d4",
        ink: "#211d17",
        labelText: "#3d3832",
        labelHalo: "rgba(241,232,212,0.82)",
        accent: "#c2622b",
        dmOnly: "#c2622b",
        grid: "rgba(33,29,23,0.08)",
      },
      catColors: GRAPH_CATEGORY_COLORS,
      hoverId: "a",
      selectedId: null,
      focus: new Set(["a", "b"]),
      dotGrid: true,
    });
  });
});

test("renderGraphScene übersteht einen leeren Graphen (keine Knoten/Kanten)", () => {
  const { ctx } = makeMockCtx();
  assert.doesNotThrow(() => {
    renderGraphScene({
      ctx,
      width: 200,
      height: 200,
      nodes: [],
      edges: [],
      byId: () => undefined,
      zoom: 1,
      tx: 0,
      ty: 0,
      nodeScale: 1,
      chrome: {
        ground: "#f1e8d4",
        ring: "#f1e8d4",
        ink: "#211d17",
        labelText: "#3d3832",
        labelHalo: "rgba(241,232,212,0.82)",
        accent: "#c2622b",
        dmOnly: "#c2622b",
        grid: "rgba(33,29,23,0.08)",
      },
      catColors: GRAPH_CATEGORY_COLORS,
      hoverId: null,
      selectedId: null,
      focus: null,
      dotGrid: false,
    });
  });
});

test("overview (zoom≤1, no focus) skips long bridges even when idle hl=1", () => {
  const chrome = {
    ground: "#f1e8d4",
    ring: "#f1e8d4",
    ink: "#211d17",
    labelText: "#3d3832",
    labelHalo: "rgba(241,232,212,0.82)",
    accent: "#c2622b",
    dmOnly: "#c2622b",
    grid: "rgba(33,29,23,0.08)",
  };
  // Idle overview keeps hl=1 on every edge — the skip gate must still fire.
  const nodes = [
    makeNode("a", 0, 0, "npc"),
    makeNode("b", 40, 0, "location"),
    makeNode("c", 0, 40, "faction"),
    makeNode("d", 40, 40, "session"),
    makeNode("e", 400, 0, "npc"),
  ];
  for (const n of nodes) n.hl = 1;
  const edges = [
    makeEdge("s1", "a", "b", "wiki"),
    makeEdge("s2", "a", "c", "wiki"),
    makeEdge("s3", "b", "d", "wiki"),
    makeEdge("long", "a", "e", "wiki"),
  ];
  for (const e of edges) e.hl = 1;
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const overview = makeMockCtx();
  renderGraphScene({
    ctx: overview.ctx,
    width: 640,
    height: 400,
    nodes,
    edges,
    byId: (id) => byId.get(id),
    zoom: 0.6,
    tx: 80,
    ty: 80,
    nodeScale: 1,
    chrome,
    catColors: GRAPH_CATEGORY_COLORS,
    hoverId: null,
    selectedId: null,
    focus: null,
    dotGrid: false,
  });
  const overviewStrokes = overview.calls.filter((c) => c === "stroke").length;

  // Focused neighborhood keeps the long bridge vivid (not length-skipped).
  for (const n of nodes) n.hl = n.id === "a" || n.id === "e" ? 1 : 0.08;
  for (const e of edges) e.hl = e.id === "long" ? 1 : 0.08;
  const focused = makeMockCtx();
  renderGraphScene({
    ctx: focused.ctx,
    width: 640,
    height: 400,
    nodes,
    edges,
    byId: (id) => byId.get(id),
    zoom: 0.6,
    tx: 80,
    ty: 80,
    nodeScale: 1,
    chrome,
    catColors: GRAPH_CATEGORY_COLORS,
    hoverId: "a",
    selectedId: null,
    focus: new Set(["a", "e"]),
    dotGrid: false,
  });
  const focusStrokes = focused.calls.filter((c) => c === "stroke").length;
  assert.ok(
    overviewStrokes < focusStrokes,
    `expected overview skip fewer strokes (${overviewStrokes}) than focus (${focusStrokes})`,
  );
});

test("renderGraphMinimap zeichnet Knoten/Kanten/Viewport ohne zu werfen", () => {
  const nodes = [makeNode("a", 0, 0, "npc"), makeNode("b", 100, 50, "location")];
  const edges = [makeEdge("e1", "a", "b", "wiki")];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const { ctx } = makeMockCtx();

  assert.doesNotThrow(() => {
    renderGraphMinimap({
      ctx,
      width: 220,
      height: 150,
      nodes,
      edges,
      byId: (id) => byId.get(id),
      chrome: {
        ground: "#f1e8d4",
        ring: "#f1e8d4",
        ink: "#211d17",
        labelText: "#3d3832",
        labelHalo: "rgba(241,232,212,0.82)",
        accent: "#c2622b",
        dmOnly: "#c2622b",
        grid: "rgba(33,29,23,0.08)",
      },
      catColors: GRAPH_CATEGORY_COLORS,
      hidden: new Set<GraphNodeCategory>(["faction"]),
      viewport: { tx: 0, ty: 0, zoom: 1, rectW: 400, rectH: 300 },
    });
  });
});
