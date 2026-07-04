import test from "node:test";
import assert from "node:assert/strict";
import type { GraphEdge, GraphNode } from "@uwe/database/graph-types";
import { GraphEngine } from "./graph-engine";

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
    visibility: "dm_only",
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
