/**
 * WFC-Siedlungs-Generator — echtes Wave Function Collapse als Vollausbau des
 * Constraint-Generators (settlement3d).
 *
 * Ablauf: irreguläres Ringraster (~55 Zellen, Hash-Jitter) → Superposition
 * aller Tile-Zustände je Zelle → AC-3-artige Constraint-Propagation über eine
 * explizite Adjazenz-Matrix → wiederholtes Kollabieren der Zelle minimaler
 * Entropie (Hash aus Seed+Zellindex wählt gewichtet) → propagieren. Bei
 * Widerspruch deterministischer Restart mit seed+attempt (max. 8 Versuche),
 * danach Fallback: nur Seeds gesetzt, Rest "leer" — niemals eine Exception.
 *
 * Strikt deterministisch: gleicher Klickpunkt + Seed → gleiche Siedlung
 * (hash01 wie in scatter.ts, kein Math.random/Date).
 */

import type { DocFeatureState, DocObjectState } from "./scene-objects";
import type { Settlement3DResult } from "./settlement3d";

export type WfcTileKind =
  | "platz"
  | "gasse"
  | "haus"
  | "markt"
  | "garten"
  | "turm"
  | "mauer"
  | "leer";

export const WFC_TILES: readonly WfcTileKind[] = [
  "platz",
  "gasse",
  "haus",
  "markt",
  "garten",
  "turm",
  "mauer",
  "leer",
];

/**
 * Explizite Adjazenz-Matrix (symmetrisch): welche Tiles dürfen benachbart sein.
 * Kernregeln: haus↔gasse ja; markt nur an platz/gasse; garten nicht an markt;
 * mauer nie an platz (und via Domänen-Beschränkung nur im Außenring);
 * gasse ist mit allem verträglich (Wege dürfen überall entlanglaufen).
 */
const WFC_ALLOWED: Record<WfcTileKind, readonly WfcTileKind[]> = {
  platz: ["platz", "gasse", "haus", "markt", "garten", "turm"],
  gasse: ["platz", "gasse", "haus", "markt", "garten", "turm", "mauer", "leer"],
  haus: ["platz", "gasse", "haus", "garten", "turm", "mauer", "leer"],
  markt: ["platz", "gasse"],
  garten: ["platz", "gasse", "haus", "garten", "mauer", "leer"],
  turm: ["platz", "gasse", "haus", "turm", "mauer", "leer"],
  mauer: ["gasse", "haus", "garten", "turm", "mauer", "leer"],
  leer: ["gasse", "haus", "garten", "turm", "mauer", "leer"],
};

/** Dürfen die beiden Tile-Zustände direkt benachbart sein? */
export function wfcTilesCompatible(a: WfcTileKind, b: WfcTileKind): boolean {
  return WFC_ALLOWED[a].includes(b);
}

/** Gewichte für die Kollaps-Wahl — Häuser dominieren, Türme bleiben selten. */
const WFC_WEIGHTS: Record<WfcTileKind, number> = {
  platz: 0.7,
  gasse: 1.6,
  haus: 2.2,
  markt: 0.5,
  garten: 0.9,
  turm: 0.3,
  mauer: 0.6,
  leer: 0.8,
};

export interface SettlementWFCOptions {
  center: { x: number; z: number };
  seed: number;
  /** Fußabdruck-Radius in Karteneinheiten (Default wie settlement3d: 0.42). */
  radius?: number;
  /** Präfix für generierte localIds (Aufrufer liefert seine Sequenzbasis). */
  idPrefix: string;
  /** Constraint-Seeding: Außenring vorbelegt mit mauer/turm (+ ein Tor). */
  walls?: boolean;
  /** Constraint-Seeding: Zentrum wird turm (Zitadelle). */
  citadel?: boolean;
  /** Constraint-Seeding: ein platz+markt-Kern nahe dem Zentrum. */
  market?: boolean;
}

export interface WfcCell {
  index: number;
  x: number;
  z: number;
  /** Ring 0 = Zentrum; höchster Ring = Außenring. */
  ring: number;
  outer: boolean;
  /** Nachbar-Zellindizes (symmetrisch, aufsteigend sortiert). */
  neighbors: number[];
  state: WfcTileKind;
}

export interface WfcGridResult {
  cells: WfcCell[];
  /** Anzahl verbrauchter Versuche (1 = erster Lauf ohne Widerspruch). */
  attempts: number;
  /** true nur, wenn alle Versuche scheiterten und der leer-Fallback griff. */
  fallback: boolean;
}

const DEFAULT_RADIUS = 0.42;
/** Ringraster 1+6+11+16+21 = 55 Zellen (~40-70 laut Spezifikation). */
const RING_COUNTS = [1, 6, 11, 16, 21] as const;
/** Distanzschwelle der k-nächste-Nachbarn-Kante bei DEFAULT_RADIUS. */
const NEIGHBOR_DISTANCE = 0.16;
const NEIGHBOR_K = 6;
const MAX_ATTEMPTS = 8;

/** Deterministischer Hash → [0,1) — identisch zu scatter.ts/settlement3d. */
function hash01(a: number, b: number, seed: number): number {
  let n = Math.imul(a * 1597 + b * 51749 + seed * 7919, 2654435761);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

interface GridCell {
  index: number;
  x: number;
  z: number;
  ring: number;
  ringPos: number;
  outer: boolean;
  neighbors: number[];
}

/** Gejittertes Polar-/Ringraster + Nachbarschaft (kNN mit Distanzschwelle). */
function buildGrid(center: { x: number; z: number }, radius: number, seed: number): GridCell[] {
  const cells: GridCell[] = [];
  const outerRing = RING_COUNTS.length - 1;
  const ringSpacing = radius / outerRing;
  let index = 0;
  for (let ring = 0; ring < RING_COUNTS.length; ring++) {
    const count = RING_COUNTS[ring];
    for (let j = 0; j < count; j++) {
      let x = center.x;
      let z = center.z;
      if (ring > 0) {
        const step = (Math.PI * 2) / count;
        const angle = j * step + ring * 0.37 + (hash01(index, 11, seed) - 0.5) * step * 0.5;
        const rr = ring * ringSpacing + (hash01(index, 12, seed) - 0.5) * ringSpacing * 0.4;
        x = center.x + Math.cos(angle) * rr;
        z = center.z + Math.sin(angle) * rr;
      }
      cells.push({ index, x, z, ring, ringPos: j, outer: ring === outerRing, neighbors: [] });
      index++;
    }
  }
  // Delaunay-Näherung: k nächste Nachbarn innerhalb der (skalierten) Schwelle
  const threshold = (NEIGHBOR_DISTANCE / DEFAULT_RADIUS) * radius;
  const edges = new Set<number>();
  for (const cell of cells) {
    const ranked = cells
      .filter((other) => other.index !== cell.index)
      .map((other) => ({ index: other.index, d: Math.hypot(other.x - cell.x, other.z - cell.z) }))
      .filter((entry) => entry.d <= threshold)
      .sort((a, b) => a.d - b.d || a.index - b.index)
      .slice(0, NEIGHBOR_K);
    for (const entry of ranked) {
      const a = Math.min(cell.index, entry.index);
      const b = Math.max(cell.index, entry.index);
      edges.add(a * cells.length + b);
    }
  }
  for (const key of edges) {
    const a = Math.floor(key / cells.length);
    const b = key % cells.length;
    cells[a].neighbors.push(b);
    cells[b].neighbors.push(a);
  }
  for (const cell of cells) cell.neighbors.sort((a, b) => a - b);
  return cells;
}

/** Constraint-Seeding (walls/citadel/market) als feste Zell-Zuweisungen. */
function computeSeeds(cells: GridCell[], options: SettlementWFCOptions): Map<number, WfcTileKind> {
  const seeds = new Map<number, WfcTileKind>();
  if (options.walls) {
    const outer = cells.filter((cell) => cell.outer);
    const gate = Math.floor(hash01(3, 17, options.seed) * outer.length) % outer.length;
    for (const cell of outer) {
      seeds.set(cell.index, cell.ringPos === gate ? "gasse" : cell.ringPos % 5 === 2 ? "turm" : "mauer");
    }
  }
  if (options.citadel) seeds.set(0, "turm");
  if (options.market) {
    // platz-Kern: Zentrum, bei Zitadelle die erste Ring-1-Zelle daneben
    const platzIndex = options.citadel ? 1 : 0;
    if (!seeds.has(platzIndex) || seeds.get(platzIndex) === "platz") {
      seeds.set(platzIndex, "platz");
      // markt daneben — nur wo alle bereits gesetzten Nachbarn markt-verträglich sind
      const candidates = cells[platzIndex].neighbors.filter((candidate) => {
        if (seeds.has(candidate) || cells[candidate].outer) return false;
        return cells[candidate].neighbors.every((neighbor) => {
          const seeded = seeds.get(neighbor);
          return seeded === undefined || wfcTilesCompatible("markt", seeded);
        });
      });
      if (candidates.length > 0) {
        const pick = Math.floor(hash01(5, 23, options.seed) * candidates.length) % candidates.length;
        seeds.set(candidates[pick], "markt");
      }
    }
  }
  return seeds;
}

/**
 * AC-3-artige Propagation: entfernt aus Nachbar-Domänen alle Zustände ohne
 * Stütze in der Quell-Domäne. false = Widerspruch (leere Domäne).
 */
function propagate(cells: GridCell[], domains: Set<WfcTileKind>[], queue: number[]): boolean {
  while (queue.length > 0) {
    const index = queue.pop()!;
    const domain = domains[index];
    for (const neighbor of cells[index].neighbors) {
      const target = domains[neighbor];
      let changed = false;
      for (const state of [...target]) {
        let supported = false;
        for (const source of domain) {
          if (wfcTilesCompatible(source, state)) {
            supported = true;
            break;
          }
        }
        if (!supported) {
          target.delete(state);
          changed = true;
        }
      }
      if (target.size === 0) return false;
      if (changed) queue.push(neighbor);
    }
  }
  return true;
}

/** Shannon-Entropie der gewichteten Rest-Zustände einer Zelle. */
function entropyOf(domain: Set<WfcTileKind>): number {
  let total = 0;
  let acc = 0;
  for (const state of domain) {
    const weight = WFC_WEIGHTS[state];
    total += weight;
    acc += weight * Math.log(weight);
  }
  return Math.log(total) - acc / total;
}

/** Gewichtete Wahl aus der Domäne über einen Hash-Wurf in [0,1). */
function weightedPick(domain: Set<WfcTileKind>, roll: number): WfcTileKind {
  let total = 0;
  for (const state of domain) total += WFC_WEIGHTS[state];
  let rest = roll * total;
  let last: WfcTileKind = "leer";
  for (const state of domain) {
    rest -= WFC_WEIGHTS[state];
    last = state;
    if (rest <= 0) return state;
  }
  return last;
}

/** Ein WFC-Durchlauf; null bei Widerspruch (Aufrufer startet neu). */
function solveAttempt(
  cells: GridCell[],
  seeds: Map<number, WfcTileKind>,
  seed: number,
  attempt: number,
): WfcTileKind[] | null {
  const domains = cells.map((cell) => {
    const domain = new Set<WfcTileKind>(WFC_TILES);
    if (!cell.outer) domain.delete("mauer"); // mauer nur im Außenring
    return domain;
  });
  const queue: number[] = [];
  for (const [index, state] of seeds) {
    domains[index] = new Set([state]);
    queue.push(index);
  }
  if (!propagate(cells, domains, queue)) return null;
  for (;;) {
    let best = -1;
    let bestEntropy = Infinity;
    for (let i = 0; i < domains.length; i++) {
      if (domains[i].size <= 1) continue;
      // winziges Hash-Rauschen bricht Entropie-Gleichstände deterministisch
      const entropy = entropyOf(domains[i]) + hash01(i, 91, seed + attempt) * 1e-4;
      if (entropy < bestEntropy) {
        bestEntropy = entropy;
        best = i;
      }
    }
    if (best < 0) break; // alles kollabiert
    const pick = weightedPick(domains[best], hash01(best, 40 + attempt, seed));
    domains[best] = new Set([pick]);
    if (!propagate(cells, domains, [best])) return null;
  }
  return domains.map((domain) => [...domain][0]);
}

/**
 * WFC auf Rasterebene — liefert Zellen samt kollabiertem Zustand. Nie eine
 * Exception: nach MAX_ATTEMPTS Widersprüchen greift der leer-Fallback.
 */
export function runSettlementWFC(options: SettlementWFCOptions): WfcGridResult {
  const radius = options.radius ?? DEFAULT_RADIUS;
  const cells = buildGrid(options.center, radius, options.seed);
  const seeds = computeSeeds(cells, options);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const states = solveAttempt(cells, seeds, options.seed, attempt);
    if (states) {
      return {
        cells: cells.map((cell) => ({ ...cell, state: states[cell.index] })),
        attempts: attempt + 1,
        fallback: false,
      };
    }
  }
  // Fallback: Seeds bleiben gesetzt, alle übrigen Zellen werden "leer"
  return {
    cells: cells.map((cell) => ({ ...cell, state: seeds.get(cell.index) ?? "leer" })),
    attempts: MAX_ATTEMPTS,
    fallback: true,
  };
}

/** Gassen-Zellen zu Pfadketten verbinden (Kanten zwischen Nachbar-Gassen). */
function laneChains(cells: WfcCell[]): number[][] {
  const lanes = new Set(cells.filter((cell) => cell.state === "gasse").map((cell) => cell.index));
  const adjacency = new Map<number, number[]>();
  for (const index of lanes) {
    adjacency.set(index, cells[index].neighbors.filter((neighbor) => lanes.has(neighbor)));
  }
  const edgeKey = (a: number, b: number) => (a < b ? a * cells.length + b : b * cells.length + a);
  const visited = new Set<number>();
  const chains: number[][] = [];
  // Enden (Grad 1) zuerst, damit Ketten an Sackgassen beginnen
  const starts = [...lanes].sort(
    (a, b) => adjacency.get(a)!.length - adjacency.get(b)!.length || a - b,
  );
  for (const start of starts) {
    for (;;) {
      let current = start;
      let next = adjacency.get(current)!.find((n) => !visited.has(edgeKey(current, n)));
      if (next === undefined) break;
      const path = [current];
      while (next !== undefined) {
        visited.add(edgeKey(current, next));
        path.push(next);
        current = next;
        next = adjacency.get(current)!.find((n) => !visited.has(edgeKey(current, n)));
      }
      chains.push(path);
    }
  }
  return chains;
}

/**
 * WFC-Siedlung im Ausgabeformat von generateSettlement3D: haus/markt/turm/
 * garten als Objekte, Gassen als road-Features (Pfadketten), Mauer-Zellen des
 * Außenrings als geschlossene road-Linie.
 */
export function generateSettlementWFC(options: SettlementWFCOptions): Settlement3DResult {
  const { center, seed, idPrefix } = options;
  const { cells } = runSettlementWFC(options);
  const objects: DocObjectState[] = [];
  let localSeq = 0;
  const nextId = () => `${idPrefix}-${localSeq++}`;
  for (const cell of cells) {
    const { index, x, z, state } = cell;
    const facing = Math.atan2(center.x - x, center.z - z); // zum Zentrum drehen
    if (state === "haus") {
      objects.push({
        localId: nextId(),
        assetKind: "house",
        tint: "terra",
        position: { x, z },
        scale: 0.75 + hash01(index, 3, seed) * 0.3,
        rotation: facing,
      });
    } else if (state === "markt") {
      // Marktstände: house in terra mit bewusst kleinerer Scale-Streuung
      objects.push({
        localId: nextId(),
        assetKind: "house",
        tint: "terra",
        position: { x, z },
        scale: 0.68 + hash01(index, 4, seed) * 0.12,
        rotation: facing,
      });
    } else if (state === "turm") {
      const citadel = cell.ring === 0;
      objects.push({
        localId: nextId(),
        assetKind: "tower",
        tint: citadel ? "sepia" : "paper",
        position: { x, z },
        scale: citadel ? 1.5 : cell.outer ? 0.7 : 0.85,
        rotation: 0,
      });
    } else if (state === "garten") {
      objects.push({
        localId: nextId(),
        assetKind: hash01(index, 5, seed) < 0.5 ? "busch" : "tree",
        tint: "teal",
        position: { x, z },
        scale: 0.8 + hash01(index, 6, seed) * 0.35,
        rotation: 0,
      });
    }
  }
  const features: DocFeatureState[] = [];
  // Gassen: benachbarte gasse-Zellen als Wegzüge
  laneChains(cells).forEach((chain, chainIndex) => {
    features.push({
      localId: `${idPrefix}-gasse-${chainIndex}`,
      kind: "road",
      points: chain.map((index) => ({ x: cells[index].x, z: cells[index].z })),
    });
  });
  // Mauer: Außenring-Zellen (mauer/turm) nach Winkel sortiert, Linie geschlossen
  const wallCells = cells
    .filter((cell) => cell.outer && (cell.state === "mauer" || cell.state === "turm"))
    .sort(
      (a, b) =>
        Math.atan2(a.z - center.z, a.x - center.x) - Math.atan2(b.z - center.z, b.x - center.x),
    );
  if (wallCells.length >= 3) {
    const points = wallCells.map((cell) => ({ x: cell.x, z: cell.z }));
    points.push({ ...points[0] });
    features.push({ localId: `${idPrefix}-mauer`, kind: "road", points });
  }
  return { objects, features };
}
