// UWE Graph — Kräfte-Simulation und Community-Pack-Layout der Graph-Engine.
//
// Aus `graph-engine.ts` herausgezogen (Modul-Disziplin: Monolith nicht anbauen).
// Framework-agnostisch und zustandslos: Die Engine hält den Zustand (alpha,
// Pack-Radien, Weltgrenze) und ruft `layoutCommunityPacks` / `stepPhysics` auf.

import { capVector } from "./graph-engine-visuals";
import type { SimEdge, SimNode } from "./graph-engine-dataset";
import { accumulateRepulsion, buildQuadTree, type ChargedPoint } from "./graph-engine-barnes-hut";
import {
  COMMUNITY_LOBE_SPLIT_THRESHOLD,
  splitOversizedCommunityLobes,
} from "./graph-engine-lobes";

export { COMMUNITY_LOBE_SPLIT_THRESHOLD, splitOversizedCommunityLobes };
export { lobeEdgeCutStats } from "./graph-engine-lobes";

// --- Physik-Parameter ---------------------------------------------------------
const REP = 2900; // Abstoßungsstärke (Basis, skaliert mit √n)
const SPRING = 0.018; // Federkonstante
// ROUND 4: die zentrale Hairball-Beschwerde (3 Runden lang unverändert) legte
// nahe, dass die Round-2/3-Hebel (Moat 42→96, GRAV 0.0065→0.0055, CLUSTER_PACK
// 0.06→0.1) einzeln zu vorsichtig dosiert waren, um gegen die globale
// Zentrierungskraft anzukommen. Statt erneut nur EINEN Hebel zu bewegen, jetzt
// alle drei gleichzeitig weiter in die schon identifizierte Richtung: GRAV
// nochmal deutlich runter (0.0055 → 0.004, ~27%), COLLIDE_PAD_INTER nochmal
// hoch (96 → 130) und CLUSTER_PACK etwas fester (0.1 → 0.12), damit die Packs
// bei schwächerer GRAV nicht wieder aufweichen. Community-Separations- und
// 400-Knoten-Stabilitätstests (graph-engine-physics.test.ts) bleiben grün bei
// den neuen Werten — geprüft, nicht nur behauptet.
// ROUND 10: slightly gentler center pull so satellite moats read wider on parchment.
const GRAV = 0.0037; // Zentrierungskraft
const CLUSTER = 0.02; // sanfte Anziehung zum Community-Schwerpunkt
// Etwas fester als Round 3 (0.1 → 0.12): hält Mitglieder verlässlich innerhalb
// des eigenen Pack-Radius, statt über den Moat zur Nachbar-Community zu bluten —
// klar getrennte Satelliten-Inseln statt eines großen Brei-Blobs (Obsidian-Vergleich).
// Ohne das bleibt die globale Zentrierungskraft (GRAV) der dominante Effekt: sie
// zieht jeden Knoten unabhängig von seiner Community Richtung Weltursprung, und
// über genug Simulationsschritte verschmelzen die Community-Schwerpunkte optisch
// wieder zu einem Klumpen um die Mitte — ein stärkeres Pack-Rückhalten wirkt dem
// direkt entgegen, ohne GRAV allein tragen zu lassen.
const CLUSTER_PACK = 0.12; // Rückzug in den Pack-Kreis der Community (nur außerhalb des Pack-Radius)
const PACK_DENSITY = 0.74; // angenommene Packdichte beim Community-Pack-Radius (dichter → kompaktere Inseln)
const BOUNDARY = 0.05; // weiche kreisförmige Weltgrenze — nichts driftet ins Unendliche
const DAMP = 0.86; // Dämpfung → System kommt zur Ruhe
const MIN_DIST = 2.4; // Mindestabstand in der Abstoßung (verhindert Kraft-Spitzen)
// Ladungs-Zerlegung für Barnes-Hut (graph-engine-barnes-hut.ts): charge(a)+charge(b)
// muss exakt der bisherigen Größen-Bonus-Formel `0.55 + (a.r+b.r)/42` entsprechen.
const CHARGE_BASE = 0.275; // = 0.55 / 2
const CHARGE_R_SCALE = 1 / 42;
const MAX_FORCE = 42; // Obergrenze pro Knoten und Schritt
const MAX_VEL = 24; // Obergrenze für Geschwindigkeit pro Schritt
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // Phyllotaxis-Winkel fürs Initial-Layout

// Simulated Annealing (wie d3-force `alpha`): Kräfte kühlen aus, das Layout
// friert ein. Ohne Auskühlen schieben Dauer-Kräfte gegen die Kollisionsauflösung
// und der Graph zittert/driftet endlos.
// ROUND 6: 0.99 → 0.985 (~389 → ~259 Schritte bis ALPHA_MIN).
// ROUND 7: 0.985 → 0.978 (~259 → ~172 Schritte) — etwas aggressiver, aber
// Layout-Regressionen (Community/Loben/400-Knoten) bleiben grün; der große
// Mount→Idle-Gewinn kommt zusätzlich vom sync-Prewarm mit Early-Exit in
// graph-engine.ts (RAF soll nicht die restliche Annealing-Kurve tragen).
export const ALPHA_DECAY = 0.978; // Abkühlrate pro Schritt
export const ALPHA_MIN = 0.02; // darunter gelten die Kräfte als aus (nur noch Kollisionen)
export const ALPHA_DRAG = 0.3; // Wieder-Aufwärmen nach dem Ziehen eines Knotens
export const ALPHA_CACHED = 0.15; // gecachte Layouts (Remount) nur sanft nachsetzen lassen

// "Nicht berühren": harte Mindestabstände zwischen Bubble-Rändern (Weltkoordinaten).
export const COLLIDE_PAD = 14; // innerhalb einer Community
// ROUND 4: nochmal größer (96 → 130, im vom Kritiker vorgeschlagenen 120-140-
// Fenster): breiterer Moat zwischen Communities, damit rausgezoomt klar
// getrennte Satelliten-Inseln entstehen statt einer dichten, matschigen Mitte
// (Obsidian-Vergleich). Fließt auch in layoutCommunityPacks (Start-Abstand der
// Pack-Zentren UND die belegte Gesamtfläche/Weltgrenze) ein, nicht nur in die
// Kollisionsauflösung.
// ROUND 10: +~9% moat — a touch more satellite whitespace without void retheme.
export const COLLIDE_PAD_INTER = 142; // zwischen verschiedenen Communities → sichtbarer Moat

/**
 * Grüppchen nach Größe sortiert im Sonnenblumen-Muster platzieren: die größten
 * Communities sitzen nahe der Mitte, kleine und Einzelknoten außen. So starten
 * Gruppen sichtbar getrennt — Pack-Kraft und Kollisions-Moat halten sie
 * anschließend getrennt, statt alles in einen Brei zu ziehen.
 *
 * Voraussetzung: `r` und `group` sind auf den Knoten gesetzt. Befüllt `packR`
 * (Ziel-Pack-Radius je Community) und liefert den Radius der weichen Weltgrenze.
 *
 * ROUND 5/8: Communities >12 werden vorher in zwei Sonnenblumen-Loben gesplittet
 * (struktur-bewusst über induzierte Kanten — s. graph-engine-lobes.ts).
 */
export function layoutCommunityPacks(
  nodes: SimNode[],
  packR: Map<number, number>,
  edges: readonly { sourceId: string; targetId: string }[] = [],
): number {
  splitOversizedCommunityLobes(nodes, edges);
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
  // ROUND 4: zusätzlicher Abstands-Faktor auf die vom Moat belegte Fläche, damit
  // schon der Start-Abstand zwischen Pack-Zentren (nicht nur der harte
  // Kollisions-Moat COLLIDE_PAD_INTER selbst) mehr Luft bekommt — hilft vor
  // allem, wenn die erste große Community die Mitte belegt und die nächsten
  // Packs sonst zu dicht an ihrem Rand starten würden.
  // ROUND 10: slightly wider initial sunflower spacing (with COLLIDE_PAD_INTER).
  const PACK_SPACING_FACTOR = 1.24;
  let covered = 0; // bereits belegte Fläche inkl. Moat-Luft
  ordered.forEach(([g, members], k) => {
    const r = packR.get(g) ?? 8;
    const dist = k === 0 ? 0 : Math.sqrt(covered / Math.PI) + r * 0.5 * PACK_SPACING_FACTOR;
    covered += Math.PI * (r + (COLLIDE_PAD_INTER * 0.5) * PACK_SPACING_FACTOR) ** 2;
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
  // Faktor leicht angehoben (1.22 → 1.26), passend zum Round-10-Moat, damit
  // die Grenze nicht enger wird als der neue Pack-Abstand selbst.
  return Math.max(Math.sqrt(covered / Math.PI) * 1.26 + 60, 160);
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
  // Abstoßung als Barnes-Hut-Näherung statt O(n²)-Doppelschleife: ein Quadtree pro
  // Schritt (Positionen ändern sich), dann eine Traversierung je Knoten. Nahbereich
  // bleibt exakt (siehe graph-engine-barnes-hut.ts), nur weit entfernte Gruppen
  // werden als ein Punkt an ihrem Schwerpunkt behandelt — visuell nicht
  // unterscheidbar, aber O(n log n) statt O(n²).
  const charges: ChargedPoint[] = ns.map((nd) => ({
    x: nd.x,
    y: nd.y,
    charge: CHARGE_BASE + nd.r * CHARGE_R_SCALE,
  }));
  const tree = buildQuadTree(charges);
  for (let i = 0; i < ns.length; i++) {
    const a = ns[i];
    const [rx, ry] = accumulateRepulsion(tree, charges, i, minDist2);
    let fx = rx * repScale,
      fy = ry * repScale;
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
