import test from "node:test";
import assert from "node:assert/strict";
import type { GraphEdge, GraphNode } from "@uwe/database/graph-types";
import { GraphEngine, isGraphPositionCacheValid } from "./graph-engine";

/**
 * Interaktions-Verhalten der Canvas-Engine ohne echtes Rendering: der Konstruktor
 * und die Pointer-Handler laufen ohne `window`/2D-Kontext, sodass wir Auswahl-
 * Logik deterministisch prüfen können (kein `start()` → kein RAF/Zeichnen).
 */
function makeCanvas(): HTMLCanvasElement {
  const canvas = {
    style: {} as Record<string, string>,
    width: 800,
    height: 600,
    getContext: () => ({}) as unknown as CanvasRenderingContext2D,
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

function node(id: string, category: GraphNode["category"]): GraphNode {
  return {
    id,
    title: id.toUpperCase(),
    slug: id,
    type: "npc",
    category,
    tags: [],
    href: `/${id}`,
    campaignId: null,
  };
}

function pointer(canvas: HTMLCanvasElement, kind: "down" | "up", x: number, y: number): void {
  const event = { pointerId: 1, clientX: x, clientY: y } as unknown as PointerEvent;
  if (kind === "down") canvas.onpointerdown?.(event);
  else canvas.onpointerup?.(event);
}

function click(engine: GraphEngine, canvas: HTMLCanvasElement, x: number, y: number): void {
  pointer(canvas, "down", x, y);
  pointer(canvas, "up", x, y);
}

function setup() {
  const nodes: GraphNode[] = [node("a", "npc"), node("b", "location")];
  const edges: GraphEdge[] = [
    { id: "e1", sourceId: "a", targetId: "b", kind: "wiki", relationType: "wiki", label: "" },
  ];
  const selections: (GraphNode | null)[] = [];
  const canvas = makeCanvas();
  const engine = new GraphEngine(canvas, {
    nodes,
    edges,
    onSelect: (n) => selections.push(n),
  });
  // Deterministische Bildschirmpositionen (tx=ty=0, zoom=1 ohne start()).
  engine.nodes[0].x = 0;
  engine.nodes[0].y = 0;
  engine.nodes[1].x = 500;
  engine.nodes[1].y = 0;
  return { engine, canvas, selections };
}

test("Klick auf einen Knoten wählt ihn aus und fixiert ihn (kein Wegdriften)", () => {
  const { engine, canvas, selections } = setup();

  click(engine, canvas, 0, 0);

  assert.equal(engine.selectedId, "a");
  assert.equal(selections.at(-1)?.id, "a");
  const selectedNode = engine.nodes.find((n) => n.id === "a");
  assert.equal(selectedNode?.fixed, true, "Auswahl-Knoten muss fixiert sein");
});

test("Klick ins Leere schließt das Detail-Panel NICHT (Auswahl bleibt bestehen)", () => {
  const { engine, canvas, selections } = setup();

  click(engine, canvas, 0, 0);
  const selectionCountAfterNode = selections.length;

  // Klick weit weg von jedem Knoten.
  click(engine, canvas, 250, 250);

  assert.equal(engine.selectedId, "a", "Auswahl darf durch Leer-Klick nicht verloren gehen");
  assert.equal(
    selections.length,
    selectionCountAfterNode,
    "onSelect(null) darf bei Leer-Klick nicht ausgelöst werden",
  );
});

test("Auswahl eines anderen Knotens gibt den vorherigen wieder frei", () => {
  const { engine, canvas } = setup();

  click(engine, canvas, 0, 0);
  click(engine, canvas, 500, 0);

  assert.equal(engine.selectedId, "b");
  assert.equal(engine.nodes.find((n) => n.id === "a")?.fixed, false, "alter Knoten wieder frei");
  assert.equal(engine.nodes.find((n) => n.id === "b")?.fixed, true, "neuer Knoten fixiert");
});

test("select(null) hebt die Fixierung des Auswahl-Knotens auf", () => {
  const { engine, canvas } = setup();

  click(engine, canvas, 0, 0);
  engine.select(null);

  assert.equal(engine.selectedId, null);
  assert.equal(engine.nodes.find((n) => n.id === "a")?.fixed, false);
});

function makeStressGraph(n: number, mesh = false) {
  const nodes: GraphNode[] = Array.from({ length: n }, (_, i) => ({
    id: `n${i}`,
    title: `Node ${i}`,
    slug: `n${i}`,
    type: "npc",
    category: "npc",
    tags: [],
    href: `/n${i}`,
    campaignId: null,
  }));
  const edges: GraphEdge[] = [];
  if (mesh) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n && j < i + 4; j++) {
        edges.push({
          id: `e${i}-${j}`,
          sourceId: `n${i}`,
          targetId: `n${j}`,
          kind: "wiki",
          relationType: "wiki",
          label: "link",
        });
      }
    }
  } else {
    for (let i = 0; i < n - 1; i++) {
      edges.push({
        id: `e${i}`,
        sourceId: `n${i}`,
        targetId: `n${i + 1}`,
        kind: "wiki",
        relationType: "wiki",
        label: "link",
      });
    }
  }
  return { nodes, edges };
}

function maxCoord(engine: GraphEngine): number {
  let max = 0;
  for (const node of engine.nodes) {
    max = Math.max(max, Math.abs(node.x), Math.abs(node.y));
  }
  return max;
}

test("Physik bleibt bei großen Graphen stabil (Ketten- und Mesh-Layout)", () => {
  for (const [n, mesh] of [
    [120, false],
    [120, true],
    [220, true],
  ] as const) {
    const canvas = makeCanvas();
    const { nodes, edges } = makeStressGraph(n, mesh);
    const engine = new GraphEngine(canvas, { nodes, edges });
    for (let i = 0; i < 140; i++) engine["step"]();
    assert.ok(
      maxCoord(engine) < 4000,
      `Graph n=${n} mesh=${mesh} explodierte (maxCoord=${maxCoord(engine).toFixed(1)})`,
    );
  }
});

function minOverlap(engine: GraphEngine): number {
  // Größte Überlappung zweier Knoten (positiv = sie überdecken sich).
  let worst = 0;
  const ns = engine.nodes;
  for (let i = 0; i < ns.length; i++) {
    for (let j = i + 1; j < ns.length; j++) {
      const dx = ns[i].x - ns[j].x;
      const dy = ns[i].y - ns[j].y;
      const dist = Math.hypot(dx, dy);
      const overlap = ns[i].r + ns[j].r - dist;
      if (overlap > worst) worst = overlap;
    }
  }
  return worst;
}

test("Bubbles überlappen sich nach dem Setzen nicht (Kollisionsauflösung)", () => {
  for (const [n, mesh] of [
    [60, true],
    [120, true],
    [120, false],
  ] as const) {
    const canvas = makeCanvas();
    const { nodes, edges } = makeStressGraph(n, mesh);
    const engine = new GraphEngine(canvas, { nodes, edges });
    for (let i = 0; i < 220; i++) engine["step"]();
    assert.ok(
      minOverlap(engine) <= 0.5,
      `Graph n=${n} mesh=${mesh}: Bubbles überlappen (maxOverlap=${minOverlap(engine).toFixed(2)})`,
    );
  }
});

test("Zeichenradius skaliert beim Rauszoomen mit dem Zoom (keine optische Überlappung)", () => {
  // Regression: früher war die Skala bei 0.6 gedeckelt — Kreise schrumpften beim
  // Rauszoomen langsamer als ihre Abstände und überdeckten sich auf dem Schirm.
  const { engine } = setup();
  for (const zoom of [0.35, 0.5, 1, 1.6]) {
    engine["zoom"] = zoom;
    assert.ok(
      engine["nodeScale"]() <= zoom,
      `nodeScale (${engine["nodeScale"]()}) darf den Zoom (${zoom}) nicht übersteigen`,
    );
  }
  // Oberhalb der Deckelung wächst der Radius langsamer als der Zoom → nur mehr Abstand.
  engine["zoom"] = 3.2;
  assert.equal(engine["nodeScale"](), 1.6);
});

test("Knoten derselben Community rücken zusammen (Cluster-Anziehung)", () => {
  // Zwei Dreiecke mit einer Brücke: nach der Simulation muss der mittlere Abstand
  // innerhalb eines Grüppchens deutlich kleiner sein als zwischen den Grüppchen.
  const mk = (id: string): GraphNode => node(id, "npc");
  const nodes = ["a1", "a2", "a3", "b1", "b2", "b3"].map(mk);
  const edge = (id: string, s: string, t: string): GraphEdge => ({
    id,
    sourceId: s,
    targetId: t,
    kind: "wiki",
    relationType: "wiki",
    label: "",
  });
  const edges = [
    edge("e1", "a1", "a2"),
    edge("e2", "a2", "a3"),
    edge("e3", "a1", "a3"),
    edge("e4", "b1", "b2"),
    edge("e5", "b2", "b3"),
    edge("e6", "b1", "b3"),
    edge("e7", "a1", "b1"),
  ];
  const engine = new GraphEngine(makeCanvas(), { nodes, edges });
  for (let i = 0; i < 300; i++) engine["step"]();
  const pos = new Map(engine.nodes.map((n) => [n.id, n]));
  const dist = (x: string, y: string) => {
    const a = pos.get(x)!;
    const b = pos.get(y)!;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const intra =
    (dist("a1", "a2") + dist("a2", "a3") + dist("b1", "b2") + dist("b2", "b3")) / 4;
  const inter = (dist("a2", "b2") + dist("a3", "b3") + dist("a2", "b3")) / 3;
  assert.ok(
    inter > intra,
    `Grüppchen müssen sich trennen (intra=${intra.toFixed(1)}, inter=${inter.toFixed(1)})`,
  );
});

test("Fixierter (gezogener) Knoten bleibt stehen und schiebt Nachbarn weg", () => {
  const { engine } = setup();
  const [a, b] = engine.nodes;
  // Beide exakt aufeinander legen; a wird fixiert (wie beim Ziehen/Auswahl).
  a.x = 0;
  a.y = 0;
  a.fixed = true;
  b.x = 0;
  b.y = 0;
  b.fixed = false;

  engine["resolveCollisions"]();

  assert.equal(a.x, 0, "fixierter Knoten darf sich nicht bewegen (x)");
  assert.equal(a.y, 0, "fixierter Knoten darf sich nicht bewegen (y)");
  const dist = Math.hypot(a.x - b.x, a.y - b.y);
  assert.ok(dist >= a.r + b.r, `Nachbar muss beiseite geschoben werden (dist=${dist.toFixed(2)})`);
});

test("Remount-Positionscache wird verworfen wenn Koordinaten aus dem Ruder laufen", () => {
  const cache = {
    a: { x: 120, y: 40 },
    b: { x: 9000, y: -3000 },
  };
  assert.equal(isGraphPositionCacheValid(cache, ["a", "b"]), false);
  assert.equal(isGraphPositionCacheValid(cache, ["a"]), true);
});

test("Remount mit frühem Positionscache bleibt stabil", () => {
  const canvas = makeCanvas();
  const { nodes, edges } = makeStressGraph(100, true);
  const first = new GraphEngine(canvas, { nodes, edges });
  for (let i = 0; i < 5; i++) first["step"]();
  const cache = first.capturePositions();
  assert.equal(isGraphPositionCacheValid(cache, nodes.map((node) => node.id)), true);

  const second = new GraphEngine(canvas, { nodes, edges });
  second.applyPositions(cache);
  for (let i = 0; i < 80; i++) second["step"]();
  assert.ok(maxCoord(second) < 4000, `Remount explodierte (maxCoord=${maxCoord(second).toFixed(1)})`);
});
