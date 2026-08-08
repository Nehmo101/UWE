// Regressions- und Perf-Tests für die Physik-Simulation (graph-engine-physics.ts)
// und ihre Barnes-Hut-Abstoßung (graph-engine-barnes-hut.ts), isoliert von der
// Canvas-Engine getestet (kein DOM/Canvas nötig — reine Datenstrukturen).

import test from "node:test";
import assert from "node:assert/strict";
import type { GraphEdge } from "@uwe/database/graph-types";
import { accumulateRepulsion, buildQuadTree, type ChargedPoint } from "./graph-engine-barnes-hut";
import type { SimEdge, SimNode } from "./graph-engine-dataset";
import {
  ALPHA_MIN,
  COMMUNITY_LOBE_SPLIT_THRESHOLD,
  layoutCommunityPacks,
  lobeEdgeCutStats,
  splitOversizedCommunityLobes,
  stepPhysics,
  type PhysicsState,
} from "./graph-engine-physics";

function makeNode(id: string, x: number, y: number, group = 0, r = 8): SimNode {
  return {
    id,
    title: id,
    slug: id,
    type: "npc",
    category: "npc",
    tags: [],
    href: `/${id}`,
    campaignId: null,
    x,
    y,
    vx: 0,
    vy: 0,
    fixed: false,
    hl: 1,
    deg: 0,
    r,
    group,
    _fx: 0,
    _fy: 0,
  };
}

function makeEdge(id: string, sourceId: string, targetId: string): SimEdge {
  const e: GraphEdge = { id, sourceId, targetId, kind: "wiki", relationType: "wiki", label: "" };
  return { ...e, hl: 1 };
}

/** Grüppchen-Graph: `groups` Communities à `perGroup` Knoten, je eine Dreieckskette + eine Brücke zur nächsten Gruppe. */
function makeCommunityGraph(
  groups: number,
  perGroup: number,
): { nodes: SimNode[]; edges: SimEdge[] } {
  const nodes: SimNode[] = [];
  const edges: SimEdge[] = [];
  // Deterministisches Sonnenblumen-Muster statt Zufall — reproduzierbare Tests.
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let g = 0; g < groups; g++) {
    for (let i = 0; i < perGroup; i++) {
      const idx = g * perGroup + i;
      const angle = idx * golden;
      const rad = Math.sqrt(idx + 0.5) * 6;
      nodes.push(makeNode(`n${g}-${i}`, Math.cos(angle) * rad, Math.sin(angle) * rad, g));
    }
    for (let i = 0; i < perGroup; i++) {
      const j = (i + 1) % perGroup;
      edges.push(makeEdge(`e${g}-${i}`, `n${g}-${i}`, `n${g}-${j}`));
    }
    if (g > 0) edges.push(makeEdge(`bridge${g}`, `n${g - 1}-0`, `n${g}-0`));
  }
  return { nodes, edges };
}

function runSteps(nodes: SimNode[], edges: SimEdge[], steps: number): PhysicsState {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const packR = new Map<number, number>();
  const boundR = layoutCommunityPacks(nodes, packR, edges);
  const state: PhysicsState = {
    nodes,
    edges,
    byId: (id) => byId.get(id),
    L: 70,
    alpha: 1,
    packR,
    boundR,
  };
  for (let i = 0; i < steps; i++) {
    const { alpha } = stepPhysics(state);
    state.alpha = alpha;
  }
  return state;
}

/** Referenz-Implementierung der alten O(n²)-Abstoßung, nur für den Perf-Vergleich im Test. */
function naiveRepulsion(ns: SimNode[], repScale: number, minDist2: number): void {
  for (let i = 0; i < ns.length; i++) {
    const a = ns[i];
    let fx = 0,
      fy = 0;
    for (let j = 0; j < ns.length; j++) {
      if (i === j) continue;
      const b = ns[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < minDist2) d2 = minDist2;
      const d = Math.sqrt(d2);
      const f = (repScale * (0.55 + (a.r + b.r) / 42)) / d2;
      fx += (dx / d) * f;
      fy += (dy / d) * f;
    }
    a._fx = fx;
    a._fy = fy;
  }
}

test("Barnes-Hut-Abstoßung nähert die exakte O(n²)-Kraft für ein Grüppchen gut an", () => {
  // Kleiner, dichter Cluster: Barnes-Hut sollte hier ohnehin fast nur exakte
  // Blatt-Paare berechnen (wenig Fernfeld-Näherung nötig) → enge Übereinstimmung.
  const { nodes } = makeCommunityGraph(1, 24);
  const repScale = 2900 / Math.sqrt(nodes.length);
  const minDist2 = 2.4 * 2.4;

  const exactFx: number[] = [];
  const exactFy: number[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    let fx = 0,
      fy = 0;
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const b = nodes[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d2 = Math.max(dx * dx + dy * dy, minDist2);
      const d = Math.sqrt(d2);
      const f = (repScale * (0.55 + (a.r + b.r) / 42)) / d2;
      fx += (dx / d) * f;
      fy += (dy / d) * f;
    }
    exactFx.push(fx);
    exactFy.push(fy);
  }

  const charges: ChargedPoint[] = nodes.map((n) => ({ x: n.x, y: n.y, charge: 0.275 + n.r / 42 }));
  const tree = buildQuadTree(charges);
  // Nahe Ruhepunkten (Kräfte heben sich fast auf) wird die *relative* Abweichung
  // durch den winzigen Nenner beliebig groß, obwohl der absolute Fehler klein
  // bleibt — daher nur Knoten mit spürbarer Nettokraft einzeln prüfen und
  // zusätzlich den Mittelwert über alle Knoten als Gesamtmaß nehmen.
  const maxExactMag = Math.max(...exactFx.map((fx, i) => Math.hypot(fx, exactFy[i])));
  let sumRelErr = 0;
  let counted = 0;
  for (let i = 0; i < nodes.length; i++) {
    const [rx, ry] = accumulateRepulsion(tree, charges, i, minDist2);
    const bhFx = rx * repScale;
    const bhFy = ry * repScale;
    const exactMag = Math.hypot(exactFx[i], exactFy[i]);
    const errMag = Math.hypot(bhFx - exactFx[i], bhFy - exactFy[i]);
    if (exactMag > maxExactMag * 0.3) {
      assert.ok(
        errMag / exactMag < 0.3,
        `Knoten ${i}: relative Abweichung zu groß (${((errMag / exactMag) * 100).toFixed(1)}%)`,
      );
    }
    sumRelErr += errMag / (exactMag || 1);
    counted += 1;
  }
  assert.ok(
    sumRelErr / counted < 0.15,
    `mittlere relative Abweichung zu groß (${((sumRelErr / counted) * 100).toFixed(1)}%)`,
  );
});

test("stepPhysics für ~400 Knoten ist deutlich schneller als die naive O(n²)-Abstoßung", () => {
  const { nodes, edges } = makeCommunityGraph(10, 40); // 400 Knoten, 10 Communities
  const repScale = 2900 / Math.sqrt(nodes.length);
  const minDist2 = 2.4 * 2.4;

  // Naive O(n²)-Referenz (gleiche Knotenzahl/Positionen, mehrere Durchläufe).
  const naiveNodes = nodes.map((n) => ({ ...n }));
  const naiveStart = process.hrtime.bigint();
  for (let s = 0; s < 20; s++) naiveRepulsion(naiveNodes, repScale, minDist2);
  const naiveMs = Number(process.hrtime.bigint() - naiveStart) / 1e6;

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const packR = new Map<number, number>();
  const boundR = layoutCommunityPacks(nodes, packR, edges);
  const state: PhysicsState = {
    nodes,
    edges,
    byId: (id) => byId.get(id),
    L: 70,
    alpha: 1,
    packR,
    boundR,
  };
  const bhStart = process.hrtime.bigint();
  for (let s = 0; s < 20; s++) {
    const { alpha } = stepPhysics(state);
    state.alpha = Math.max(alpha, 0.5); // alpha oben halten: volle Abstoßung bleibt aktiv für den Vergleich
  }
  const bhMs = Number(process.hrtime.bigint() - bhStart) / 1e6;

  // Generöses Budget (CI-Rechner variieren stark) — Kern der Aussage ist der
  // Faktor gegenüber der naiven Referenz, nicht eine absolute Millisekundenzahl.
  assert.ok(bhMs < 800, `Barnes-Hut-Schritte für 400 Knoten zu langsam: ${bhMs.toFixed(1)}ms`);
  assert.ok(
    bhMs < naiveMs,
    `Barnes-Hut (${bhMs.toFixed(1)}ms) sollte schneller sein als naives O(n²) (${naiveMs.toFixed(1)}ms) bei 400 Knoten`,
  );
});

test("Layout kühlt aus (Annealing) statt endlos zu zittern", () => {
  const { nodes, edges } = makeCommunityGraph(4, 20);
  const state = runSteps(nodes, edges, 400);
  assert.ok(state.alpha < ALPHA_MIN, `alpha sollte ausgekühlt sein (alpha=${state.alpha})`);

  // Nach dem Auskühlen bricht die Restgeschwindigkeit weiter ab (kein Dauer-Zittern).
  const keBefore = nodes.reduce((sum, n) => sum + n.vx * n.vx + n.vy * n.vy, 0);
  for (let i = 0; i < 20; i++) {
    const { alpha } = stepPhysics(state);
    state.alpha = alpha;
  }
  const keAfter = nodes.reduce((sum, n) => sum + n.vx * n.vx + n.vy * n.vy, 0);
  assert.ok(
    keAfter <= keBefore + 1e-6,
    `Restgeschwindigkeit muss abklingen statt zu wachsen (vor=${keBefore.toFixed(4)}, nach=${keAfter.toFixed(4)})`,
  );
});

test("Communities bleiben nach der Simulation kompakt getrennt (kein Verschmelzen)", () => {
  const { nodes, edges } = makeCommunityGraph(5, 16);
  runSteps(nodes, edges, 350);
  const byGroup = new Map<number, SimNode[]>();
  nodes.forEach((n) => {
    const list = byGroup.get(n.group);
    if (list) list.push(n);
    else byGroup.set(n.group, [n]);
  });
  const centroidOf = (members: SimNode[]) => {
    const cx = members.reduce((s, m) => s + m.x, 0) / members.length;
    const cy = members.reduce((s, m) => s + m.y, 0) / members.length;
    return { cx, cy };
  };
  const spreadOf = (members: SimNode[], cx: number, cy: number) =>
    Math.max(...members.map((m) => Math.hypot(m.x - cx, m.y - cy)));

  const centroids = [...byGroup.values()].map((members) => {
    const { cx, cy } = centroidOf(members);
    return { cx, cy, spread: spreadOf(members, cx, cy) };
  });
  // Jede Gruppe liegt kompakt um ihren eigenen Schwerpunkt ...
  for (const c of centroids) {
    assert.ok(c.spread < 120, `Community zu weit gestreut (spread=${c.spread.toFixed(1)})`);
  }
  // ... und die Schwerpunkte verschiedener Gruppen sind klar voneinander getrennt.
  for (let i = 0; i < centroids.length; i++) {
    for (let j = i + 1; j < centroids.length; j++) {
      const d = Math.hypot(centroids[i].cx - centroids[j].cx, centroids[i].cy - centroids[j].cy);
      assert.ok(
        d > Math.max(centroids[i].spread, centroids[j].spread) * 0.5,
        `Communities ${i} und ${j} liegen zu nah beieinander (d=${d.toFixed(1)})`,
      );
    }
  }
});

test("Physik bleibt bei 400 Knoten stabil (kein Explodieren)", () => {
  const { nodes, edges } = makeCommunityGraph(10, 40);
  const state = runSteps(nodes, edges, 200);
  let maxCoord = 0;
  for (const n of state.nodes) {
    maxCoord = Math.max(maxCoord, Math.abs(n.x), Math.abs(n.y));
  }
  assert.ok(maxCoord < 6000, `400-Knoten-Graph explodierte (maxCoord=${maxCoord.toFixed(1)})`);
});

test("Communities >12 werden in genau zwei Sonnenblumen-Loben gesplittet", () => {
  const oversized = Array.from({ length: COMMUNITY_LOBE_SPLIT_THRESHOLD + 13 }, (_, i) =>
    makeNode(`big-${i}`, i * 3, 0, 0),
  );
  const small = Array.from({ length: COMMUNITY_LOBE_SPLIT_THRESHOLD }, (_, i) =>
    makeNode(`small-${i}`, i * 3, 40, 1),
  );
  const nodes = [...oversized, ...small];
  splitOversizedCommunityLobes(nodes);

  const byGroup = new Map<number, SimNode[]>();
  nodes.forEach((n) => {
    const list = byGroup.get(n.group);
    if (list) list.push(n);
    else byGroup.set(n.group, [n]);
  });
  // Die große Community (25) → 2 Loben; die 12er-Community bleibt ungesplittet.
  assert.equal(byGroup.size, 3, `erwartet 3 Packs nach Split, got ${byGroup.size}`);
  for (const members of byGroup.values()) {
    assert.ok(
      members.length <= COMMUNITY_LOBE_SPLIT_THRESHOLD + 1,
      `Lobe zu groß (${members.length} > ${COMMUNITY_LOBE_SPLIT_THRESHOLD + 1})`,
    );
  }
  // Determinismus: gleicher Input → gleiche Loben-Zugehörigkeit (Membership),
  // unabhängig von absoluten group-IDs (die hängen vom max(group)+1-Kontext ab).
  const again = oversized.map((n) => makeNode(n.id, n.x, n.y, 0));
  splitOversizedCommunityLobes(again);
  const membership = (list: SimNode[]) => {
    const key = new Map<number, number>();
    let n = 0;
    return list.map((node) => {
      const g = node.group;
      if (!key.has(g)) key.set(g, n++);
      return key.get(g) as number;
    });
  };
  assert.deepEqual(membership(again), membership(oversized));
});

test("größte Community-Loben halten nach Simulation getrennte Schwerpunkte (kein Hairball)", () => {
  // Eine einzige dichte Community mit 24 Knoten — ohne Loben-Split wäre das der
  // zentrale Hairball. Nach Split + Physik müssen die zwei Loben-Schwerpunkte
  // klar getrennt sein und der mittlere Next-Neighbor-Abstand im Inneren
  // über einem Floor liegen (quantitativ, nicht nur visuell).
  const { nodes, edges } = makeCommunityGraph(1, 24);
  runSteps(nodes, edges, 350);
  const byGroup = new Map<number, SimNode[]>();
  nodes.forEach((n) => {
    const list = byGroup.get(n.group);
    if (list) list.push(n);
    else byGroup.set(n.group, [n]);
  });
  assert.equal(byGroup.size, 2, "24er-Community muss in genau zwei Loben landen");
  const lobes = [...byGroup.values()];
  const centroidOf = (members: SimNode[]) => ({
    cx: members.reduce((s, m) => s + m.x, 0) / members.length,
    cy: members.reduce((s, m) => s + m.y, 0) / members.length,
  });
  const a = centroidOf(lobes[0]);
  const b = centroidOf(lobes[1]);
  const lobeDist = Math.hypot(a.cx - b.cx, a.cy - b.cy);
  assert.ok(lobeDist > 40, `Loben-Schwerpunkte zu nah (d=${lobeDist.toFixed(1)})`);

  // Mittlerer Abstand zum nächsten Nachbarn über alle 24 Knoten — gegen
  // vollständiges Übereinanderstapeln im Kern.
  const nn: number[] = [];
  for (let i = 0; i < nodes.length; i++) {
    let best = Infinity;
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      best = Math.min(best, Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y));
    }
    nn.push(best);
  }
  const meanNn = nn.reduce((s, v) => s + v, 0) / nn.length;
  assert.ok(meanNn > 18, `mittlerer Next-Neighbor-Abstand zu klein (mean=${meanNn.toFixed(1)})`);
});

test("struktur-bewusster Loben-Split trennt Module dichter als ID-Sort-Bipartition", () => {
  // Zwei Cliquen à 13, durch genau eine Brücke verbunden — IDs absichtlich
  // interleaved (n00a/n00b/…), damit eine id-sortierte Halbierung den schlechtesten
  // Cut erzeugt. Struktur-Split muss jede Clique einem Lobe zuordnen.
  const nodes: SimNode[] = [];
  const edges: SimEdge[] = [];
  const per = 13;
  for (let i = 0; i < per; i++) {
    const pad = String(i).padStart(2, "0");
    nodes.push(makeNode(`n${pad}a`, i * 3, 0, 0));
    nodes.push(makeNode(`n${pad}b`, i * 3, 40, 0));
  }
  for (let i = 0; i < per; i++) {
    for (let j = i + 1; j < per; j++) {
      const pi = String(i).padStart(2, "0");
      const pj = String(j).padStart(2, "0");
      edges.push(makeEdge(`ea-${pi}-${pj}`, `n${pi}a`, `n${pj}a`));
      edges.push(makeEdge(`eb-${pi}-${pj}`, `n${pi}b`, `n${pj}b`));
    }
  }
  edges.push(makeEdge("bridge", "n00a", "n00b"));

  const structured = nodes.map((n) => makeNode(n.id, n.x, n.y, 0));
  splitOversizedCommunityLobes(structured, edges);
  const structStats = lobeEdgeCutStats(structured, edges);
  assert.equal(structStats.lobeSizes.length, 2, "erwartet genau zwei Loben");
  assert.ok(
    structStats.intra > structStats.cross * 8,
    `Intra-Lobe-Kanten müssen dichter sein als Cross (intra=${structStats.intra}, cross=${structStats.cross})`,
  );
  // Jede Clique sollte geschlossen in einem Lobe landen (Brücke = einziger Cut).
  assert.equal(structStats.cross, 1, `erwarteter Cut = 1 Brücke, got ${structStats.cross}`);

  // ID-Sort-Referenz (keine Edges → Fallback): deutlich schlechterer Cut.
  const idSorted = nodes.map((n) => makeNode(n.id, n.x, n.y, 0));
  splitOversizedCommunityLobes(idSorted, []);
  const idStats = lobeEdgeCutStats(idSorted, edges);
  assert.ok(
    structStats.cross < idStats.cross,
    `Struktur-Cut (${structStats.cross}) muss besser sein als ID-Sort-Cut (${idStats.cross})`,
  );
  assert.ok(
    structStats.intra > idStats.intra,
    `Struktur-Intra (${structStats.intra}) muss dichter sein als ID-Sort-Intra (${idStats.intra})`,
  );
});

test("stepPhysics ist deterministisch für nicht-deckungsgleiche Startpositionen", () => {
  // `layoutCommunityPacks` selbst jittert die Startpositionen bewusst per
  // Math.random() (bestehendes Verhalten, unverändert) — dieser Test prüft daher
  // gezielt nur den Simulationsschritt `stepPhysics` selbst: fester Startzustand
  // rein, zwei unabhängige Läufe müssen bitgenau übereinstimmen.
  const runOnce = () => {
    const { nodes, edges } = makeCommunityGraph(3, 12);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const packR = new Map<number, number>();
    // Pack-Radien/Weltgrenze aus einer Wegwerf-Kopie ziehen, ohne die
    // deterministischen Startpositionen der echten Knoten zu verändern.
    const boundR = layoutCommunityPacks(
      nodes.map((n) => ({ ...n })),
      packR,
      edges,
    );
    const state: PhysicsState = { nodes, edges, byId: (id) => byId.get(id), L: 70, alpha: 1, packR, boundR };
    for (let i = 0; i < 60; i++) {
      const { alpha } = stepPhysics(state);
      state.alpha = alpha;
    }
    return state;
  };
  const a = runOnce();
  const b = runOnce();
  for (let i = 0; i < a.nodes.length; i++) {
    assert.equal(a.nodes[i].x, b.nodes[i].x, `Knoten ${i}: x weicht zwischen zwei Läufen ab`);
    assert.equal(a.nodes[i].y, b.nodes[i].y, `Knoten ${i}: y weicht zwischen zwei Läufen ab`);
  }
});
