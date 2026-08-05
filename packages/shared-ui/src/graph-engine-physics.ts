// UWE Graph — Kräfte-Simulation und Community-Pack-Layout der Graph-Engine.
//
// Aus `graph-engine.ts` herausgezogen (Modul-Disziplin: Monolith nicht anbauen).
// Framework-agnostisch und zustandslos: Die Engine hält den Zustand (alpha,
// Pack-Radien, Weltgrenze) und ruft `layoutCommunityPacks` / `stepPhysics` auf.

import { capVector } from "./graph-engine-visuals";
import type { SimEdge, SimNode } from "./graph-engine-dataset";

// --- Physik-Parameter ---------------------------------------------------------
const REP = 2900; // Abstoßungsstärke (Basis, skaliert mit √n)
const SPRING = 0.018; // Federkonstante
const GRAV = 0.0065; // Zentrierungskraft
const CLUSTER = 0.02; // sanfte Anziehung zum Community-Schwerpunkt
const CLUSTER_PACK = 0.06; // Rückzug in den Pack-Kreis der Community (nur außerhalb des Pack-Radius)
const PACK_DENSITY = 0.6; // angenommene Packdichte beim Community-Pack-Radius
const BOUNDARY = 0.05; // weiche kreisförmige Weltgrenze — nichts driftet ins Unendliche
const DAMP = 0.86; // Dämpfung → System kommt zur Ruhe
const MIN_DIST = 2.4; // Mindestabstand in der Abstoßung (verhindert Kraft-Spitzen)
const MAX_FORCE = 42; // Obergrenze pro Knoten und Schritt
const MAX_VEL = 24; // Obergrenze für Geschwindigkeit pro Schritt
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // Phyllotaxis-Winkel fürs Initial-Layout

// Simulated Annealing (wie d3-force `alpha`): Kräfte kühlen aus, das Layout
// friert ein. Ohne Auskühlen schieben Dauer-Kräfte gegen die Kollisionsauflösung
// und der Graph zittert/driftet endlos.
export const ALPHA_DECAY = 0.99; // Abkühlrate pro Schritt
export const ALPHA_MIN = 0.02; // darunter gelten die Kräfte als aus (nur noch Kollisionen)
export const ALPHA_DRAG = 0.3; // Wieder-Aufwärmen nach dem Ziehen eines Knotens
export const ALPHA_CACHED = 0.15; // gecachte Layouts (Remount) nur sanft nachsetzen lassen

// "Nicht berühren": harte Mindestabstände zwischen Bubble-Rändern (Weltkoordinaten).
export const COLLIDE_PAD = 14; // innerhalb einer Community
export const COLLIDE_PAD_INTER = 42; // zwischen verschiedenen Communities → sichtbarer Moat

/**
 * Grüppchen nach Größe sortiert im Sonnenblumen-Muster platzieren: die größten
 * Communities sitzen nahe der Mitte, kleine und Einzelknoten außen. So starten
 * Gruppen sichtbar getrennt — Pack-Kraft und Kollisions-Moat halten sie
 * anschließend getrennt, statt alles in einen Brei zu ziehen.
 *
 * Voraussetzung: `r` und `group` sind auf den Knoten gesetzt. Befüllt `packR`
 * (Ziel-Pack-Radius je Community) und liefert den Radius der weichen Weltgrenze.
 */
export function layoutCommunityPacks(nodes: SimNode[], packR: Map<number, number>): number {
  const byGroup = new Map<number, SimNode[]>();
  nodes.forEach((nd) => {
    const list = byGroup.get(nd.group);
    if (list) list.push(nd);
    else byGroup.set(nd.group, [nd]);
  });
  packR.clear();
  byGroup.forEach((members, g) => {
    // Pack-Radius aus der Summe der Bubble-Flächen (inkl. halbem Abstands-Pad).
    const area = members.reduce((sum, m) => sum + (m.r + COLLIDE_PAD * 0.5) ** 2, 0);
    packR.set(g, Math.sqrt(area / PACK_DENSITY));
  });
  const ordered = [...byGroup.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0] - b[0],
  );
  let covered = 0; // bereits belegte Fläche inkl. Moat-Luft
  ordered.forEach(([g, members], k) => {
    const r = packR.get(g) ?? 8;
    const dist = k === 0 ? 0 : Math.sqrt(covered / Math.PI) + r * 0.5;
    covered += Math.PI * (r + COLLIDE_PAD_INTER * 0.5) ** 2;
    const angle = k * GOLDEN_ANGLE;
    const cx = Math.cos(angle) * dist;
    const cy = Math.sin(angle) * dist;
    members.forEach((m, i) => {
      const ma = i * GOLDEN_ANGLE;
      const mr = r * Math.sqrt((i + 0.5) / members.length);
      m.x = cx + Math.cos(ma) * mr + (Math.random() - 0.5) * 6;
      m.y = cy + Math.sin(ma) * mr + (Math.random() - 0.5) * 6;
    });
  });
  // Weiche Weltgrenze aus der belegten Gesamtfläche: hält lose Grüppchen und
  // Einzelknoten in Sichtweite, statt sie ins Unendliche driften zu lassen.
  return Math.max(Math.sqrt(covered / Math.PI) * 1.15 + 60, 160);
}

export interface PhysicsState {
  nodes: SimNode[];
  edges: SimEdge[];
  byId: (id: string) => SimNode | undefined;
  /** Ruhelänge der Kanten-Federn (ohne Knotenradien). */
  L: number;
  /** Simulations-"Temperatur": Kräfte × alpha. */
  alpha: number;
  /** Ziel-Pack-Radius je Community (aus `layoutCommunityPacks`). */
  packR: Map<number, number>;
  /** Radius der weichen Weltgrenze. */
  boundR: number;
}

/**
 * Ein Simulationsschritt: Abstoßung + Zentrierung + Cluster-/Pack-Kraft +
 * Weltgrenze + Kanten-Federn, dann Integration mit Dämpfung. Kräfte werden mit
 * `alpha` skaliert; unterhalb `ALPHA_MIN` läuft nur noch der Geschwindigkeits-
 * Abbau (die Kollisionsauflösung übernimmt die Engine).
 *
 * Rückgabe: kinetische Energie (pro Knoten normiert) und das neue alpha.
 */
export function stepPhysics(state: PhysicsState): { ke: number; alpha: number } {
  const ns = state.nodes;
  const n = Math.max(ns.length, 1);
  // Ausgekühlte Simulation: Kräfte sind aus — nur noch Restgeschwindigkeit
  // abbauen. Das Layout bleibt stehen (kein Drift).
  if (state.alpha < ALPHA_MIN) {
    let ke = 0;
    ns.forEach((a) => {
      if (a.fixed) {
        a.vx = 0;
        a.vy = 0;
        return;
      }
      a.vx *= DAMP;
      a.vy *= DAMP;
      a.x += a.vx;
      a.y += a.vy;
      ke += a.vx * a.vx + a.vy * a.vy;
    });
    return { ke: ke / n, alpha: state.alpha };
  }
  const minDist2 = MIN_DIST * MIN_DIST;
  const repScale = REP / Math.sqrt(n);
  // Community-Schwerpunkte für die Cluster-Anziehung (Grüppchen-Bildung).
  const centroids = new Map<number, { x: number; y: number; n: number }>();
  ns.forEach((nd) => {
    const e = centroids.get(nd.group);
    if (e) {
      e.x += nd.x;
      e.y += nd.y;
      e.n += 1;
    } else {
      centroids.set(nd.group, { x: nd.x, y: nd.y, n: 1 });
    }
  });
  for (let i = 0; i < ns.length; i++) {
    const a = ns[i];
    let fx = 0,
      fy = 0;
    for (let j = 0; j < ns.length; j++) {
      if (i === j) continue;
      const b = ns[j];
      let dx = a.x - b.x,
        dy = a.y - b.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < minDist2) {
        if (d2 < 1e-6) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
        }
        d2 = minDist2;
      }
      const d = Math.sqrt(d2);
      // größere Knoten stoßen stärker ab → mehr Platz für Hubs
      const f = (repScale * (0.55 + (a.r + b.r) / 42)) / d2;
      fx += (dx / d) * f;
      fy += (dy / d) * f;
    }
    fx -= a.x * GRAV;
    fy -= a.y * GRAV;
    // Zug zum eigenen Community-Schwerpunkt: hält stark verbundene Grüppchen
    // zusammen, ohne die Abstoßung/Kollision auszuhebeln. Außerhalb des
    // Pack-Radius zieht zusätzlich die Pack-Kraft zurück in den Kreis —
    // so entstehen die dichten, runden Grüppchen-Packungen.
    const cen = centroids.get(a.group);
    if (cen && cen.n > 1) {
      const cx = cen.x / cen.n - a.x,
        cy = cen.y / cen.n - a.y;
      fx += cx * CLUSTER;
      fy += cy * CLUSTER;
      const cd = Math.hypot(cx, cy);
      const packR = state.packR.get(a.group) ?? 0;
      if (cd > packR && cd > 1e-6) {
        const f = ((cd - packR) * CLUSTER_PACK) / cd;
        fx += cx * f;
        fy += cy * f;
      }
    }
    // Weiche Weltgrenze: jenseits von boundR wächst eine Rückholkraft —
    // abgekoppelte Grüppchen driften nicht mehr ins Unendliche.
    const rd = Math.hypot(a.x, a.y);
    if (rd > state.boundR) {
      const f = ((rd - state.boundR) * BOUNDARY) / rd;
      fx -= a.x * f;
      fy -= a.y * f;
    }
    [a._fx, a._fy] = capVector(fx, fy, MAX_FORCE);
  }
  state.edges.forEach((e) => {
    const s = state.byId(e.sourceId),
      t = state.byId(e.targetId);
    if (!s || !t) return;
    const dx = t.x - s.x,
      dy = t.y - s.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    // Ruhelänge inkl. Knotenradien, damit dicke Knoten nicht überlappen
    const rest = state.L + s.r + t.r;
    const f = SPRING * (d - rest);
    const ux = dx / d,
      uy = dy / d;
    s._fx += ux * f;
    s._fy += uy * f;
    t._fx -= ux * f;
    t._fy -= uy * f;
  });
  let ke = 0;
  ns.forEach((a) => {
    if (a.fixed) {
      a.vx = 0;
      a.vy = 0;
      return;
    }
    a.vx = (a.vx + a._fx * state.alpha) * DAMP;
    a.vy = (a.vy + a._fy * state.alpha) * DAMP;
    [a.vx, a.vy] = capVector(a.vx, a.vy, MAX_VEL);
    a.x += a.vx;
    a.y += a.vy;
    ke += a.vx * a.vx + a.vy * a.vy;
  });
  return { ke: ke / n, alpha: state.alpha * ALPHA_DECAY };
}
