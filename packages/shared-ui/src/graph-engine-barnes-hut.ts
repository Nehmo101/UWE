// UWE Graph — Barnes-Hut-Näherung für die Abstoßungskraft (O(n log n) statt O(n²)).
//
// Aus `graph-engine-physics.ts` herausgezogen (Modul-Disziplin: Physik-Datei nicht
// anbauen). Framework-agnostisch und zustandslos: pro Simulationsschritt wird ein
// Quadtree aus den aktuellen Knoten-Positionen gebaut und für jeden Knoten einmal
// traversiert.
//
// Herleitung der "Ladung": Die ursprüngliche paarweise Abstoßung war
//   f(a,b) = repScale/d² · (0.55 + (a.r + b.r) / 42)
// Das lässt sich exakt in zwei additive Anteile je Knoten zerlegen:
//   charge(x) = 0.275 + x.r / 42   ⇒   charge(a) + charge(b) === 0.55 + (a.r+b.r)/42
// Ein weit entfernter Teilbaum wird wie ein einzelner Punkt an seinem (ladungs-
// gewichteten) Schwerpunkt behandelt, der Anzahl UND Ladungssumme der enthaltenen
// Knoten trägt — direkte Nachbarn (in Reichweite der Öffnungs-Schwelle `theta`)
// werden weiterhin exakt Paar für Paar berechnet, denn dort zählt die Genauigkeit
// am meisten.

export interface ChargedPoint {
  x: number;
  y: number;
  charge: number;
}

interface QuadNode {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Anzahl Punkte im Teilbaum (inkl. dieser Ebene). */
  count: number;
  /** Summe der Ladungen im Teilbaum. */
  chargeSum: number;
  /** Ladungsgewichteter Schwerpunkt des Teilbaums. */
  cx: number;
  cy: number;
  /** NW, NE, SW, SE — null bei einem Blatt. */
  children: [QuadNode, QuadNode, QuadNode, QuadNode] | null;
  /** Punkt-Indizes an diesem Blatt (>1 nur bei deckungsgleichen Punkten / Tiefenlimit). */
  bucket: number[] | null;
}

// Öffnungs-Schwelle (wie klassisches Barnes-Hut): kleinere Werte = genauer, aber
// langsamer. 0.85 ist ein für Graph-Layouts (keine Physik-Simulation im engeren
// Sinn, Sichtbarkeit zählt mehr als Präzision) guter Kompromiss.
export const BH_THETA = 0.85;
// Verhindert endlose Unterteilung bei deckungsgleichen/sehr nahen Punkten.
const MAX_DEPTH = 24;

function makeNode(x0: number, y0: number, x1: number, y1: number): QuadNode {
  return { x0, y0, x1, y1, count: 0, chargeSum: 0, cx: 0, cy: 0, children: null, bucket: null };
}

function subdivide(node: QuadNode): void {
  const mx = (node.x0 + node.x1) / 2;
  const my = (node.y0 + node.y1) / 2;
  node.children = [
    makeNode(node.x0, node.y0, mx, my), // NW
    makeNode(mx, node.y0, node.x1, my), // NE
    makeNode(node.x0, my, mx, node.y1), // SW
    makeNode(mx, my, node.x1, node.y1), // SE
  ];
}

function childFor(node: QuadNode, x: number, y: number): QuadNode {
  const mx = (node.x0 + node.x1) / 2;
  const my = (node.y0 + node.y1) / 2;
  const east = x >= mx ? 1 : 0;
  const south = y >= my ? 1 : 0;
  return node.children![south * 2 + east];
}

function addToAggregate(node: QuadNode, p: ChargedPoint): void {
  const newChargeSum = node.chargeSum + p.charge;
  if (newChargeSum > 0) {
    node.cx = (node.cx * node.chargeSum + p.x * p.charge) / newChargeSum;
    node.cy = (node.cy * node.chargeSum + p.y * p.charge) / newChargeSum;
  }
  node.chargeSum = newChargeSum;
  node.count += 1;
}

function insert(node: QuadNode, points: ChargedPoint[], idx: number, depth: number): void {
  const p = points[idx];
  addToAggregate(node, p);
  if (node.children) {
    insert(childFor(node, p.x, p.y), points, idx, depth + 1);
    return;
  }
  if (node.bucket === null) {
    node.bucket = [idx];
    return;
  }
  if (depth >= MAX_DEPTH) {
    // Deckungsgleiche/extrem nahe Punkte: einfach im Blatt sammeln statt endlos
    // zu unterteilen (die Kraftberechnung summiert das Blatt exakt Paar für Paar).
    node.bucket.push(idx);
    return;
  }
  const existing = node.bucket;
  node.bucket = null;
  subdivide(node);
  existing.forEach((existingIdx) => {
    const ep = points[existingIdx];
    insert(childFor(node, ep.x, ep.y), points, existingIdx, depth + 1);
  });
  insert(childFor(node, p.x, p.y), points, idx, depth + 1);
}

/** Baut den Barnes-Hut-Quadtree für den aktuellen Simulationsschritt (jeden Schritt neu, Positionen ändern sich). */
export function buildQuadTree(points: ChargedPoint[]): QuadNode | null {
  if (points.length === 0) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  // Quadratische Bounding-Box (konsistente Größen-Metrik für das Öffnungskriterium),
  // mit Polster gegen entartete Boxen (ein einzelner Punkt, exakt kollineare Punkte).
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const half = Math.max((maxX - minX) / 2, (maxY - minY) / 2, 1) + 1;
  const root = makeNode(cx - half, cy - half, cx + half, cy + half);
  points.forEach((_, i) => insert(root, points, i, 0));
  return root;
}

/**
 * Abstoßungskraft auf den Punkt `points[selfIndex]` von allen anderen Punkten,
 * ohne die `repScale`-Skalierung (die multipliziert der Aufrufer einmal auf das
 * Ergebnis). Nahbereich exakt, Fernbereich als Quadtree-Schwerpunkt-Näherung.
 */
export function accumulateRepulsion(
  root: QuadNode | null,
  points: ChargedPoint[],
  selfIndex: number,
  minDist2: number,
  theta: number = BH_THETA,
): [number, number] {
  if (!root) return [0, 0];
  const a = points[selfIndex];
  let fx = 0,
    fy = 0;
  const stack: QuadNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.count === 0) continue;
    const dx = a.x - node.cx;
    const dy = a.y - node.cy;
    const d2 = dx * dx + dy * dy;
    if (!node.children) {
      // Blatt: exakte paarweise Summe (in der Regel genau 1 Punkt).
      for (const idx of node.bucket ?? []) {
        if (idx === selfIndex) continue;
        const b = points[idx];
        let bdx = a.x - b.x,
          bdy = a.y - b.y;
        let bd2 = bdx * bdx + bdy * bdy;
        if (bd2 < minDist2) {
          if (bd2 < 1e-9) {
            bdx = Math.random() - 0.5;
            bdy = Math.random() - 0.5;
          }
          bd2 = minDist2;
        }
        const bd = Math.sqrt(bd2);
        const f = (a.charge + b.charge) / bd2;
        fx += (bdx / bd) * f;
        fy += (bdy / bd) * f;
      }
      continue;
    }
    const size = node.x1 - node.x0;
    if (size * size < theta * theta * d2) {
      // Weit genug entfernt: ganzer Teilbaum ≈ ein Punkt an seinem Schwerpunkt.
      const clamped2 = d2 < minDist2 ? minDist2 : d2;
      const d = Math.sqrt(clamped2);
      const f = (a.charge * node.count + node.chargeSum) / clamped2;
      fx += (dx / d) * f;
      fy += (dy / d) * f;
    } else {
      // Zu nah relativ zur Zellgröße: verfeinern statt annähern.
      for (const child of node.children) {
        if (child.count > 0) stack.push(child);
      }
    }
  }
  return [fx, fy];
}
