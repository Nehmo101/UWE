// Aenderungs-Orchestrierung: Elemente (neu) erzeugen, Terrain/Korridore
// nachziehen, geaenderte Pools packen.
import { S, clearElement, dropElement } from './store.js';
import { markDirty, flushPack } from './pools.js';
import { rivers, corridor, stampCorridor, stampWear, clearWear, baseHeightAt,
  refreshTerrainFull } from '../world/terrain.js';
import { pathSamples, genStrasse, genMauer, genFluss, genHecke } from '../generators/paths.js';
import { genFlaeche, districtStreets, inPoly } from '../generators/areas.js';
import { genObjekt } from '../generators/objects.js';
import { genRanke } from '../generators/vines.js';
import { defaultsFor } from '../editor/tools.js';

function genElement(el) {
  clearElement(el);
  // Fehlende Parameter aus dem Schema ergänzen — hält geladene Karten robust
  var def = defaultsFor(el.kind, el.variant);
  for (var dk in def) if (el.params[dk] === undefined) el.params[dk] = def[dk];
  if (el.kind === "pfad") {
    if (el.points.length < 2) return;
    if (el.variant === "strasse") genStrasse(el);
    else if (el.variant === "mauer") genMauer(el);
    else if (el.variant === "fluss") genFluss(el);
    else if (el.variant === "hecke") genHecke(el);
  } else if (el.kind === "flaeche") genFlaeche(el);
  else if (el.kind === "objekt") genObjekt(el);
  else if (el.kind === "ranke") genRanke(el);
}

/** Erzeugt ein Element neu und merkt sich nur die betroffenen Pools. */
function regenElement(el) {
  var names = Object.keys(el.inst);
  genElement(el);
  var after = Object.keys(el.inst);
  for (var i = 0; i < after.length; i++) names.push(after[i]);
  markDirty(names);
}

/** Sammelt alle Flussverläufe (Basis für das Einschneiden des Terrains). */
function rebuildRivers() {
  rivers.length = 0;
  for (var i = 0; i < S.elements.length; i++) {
    var el = S.elements[i];
    if (el.kind !== "pfad" || el.variant !== "fluss" || el.points.length < 2) continue;
    var sm = pathSamples(el.points, 1.6);
    if (!sm.length) continue;
    var prof = [];
    for (var k = 0; k < sm.length; k++) prof.push(baseHeightAt(sm[k].x, sm[k].z));
    for (var pass = 0; pass < 8; pass++) {
      var cp = prof.slice();
      for (var m = 1; m < prof.length - 1; m++) prof[m] = (cp[m - 1] + cp[m] * 2 + cp[m + 1]) * 0.25;
    }
    var samples = [];
    for (var s = 0; s < sm.length; s++) samples.push({ x: sm[s].x, z: sm[s].z, y: prof[s] });
    rivers.push({ samples: samples, radius: el.params.breite * 0.62 + 2.2, depth: el.params.tiefe });
  }
}

/** Baut die Sperrmaske für Straßen, Flüsse, Mauern und Viertel-Gassen neu auf. */
function rebuildCorridors() {
  corridor.fill(0);
  clearWear();
  for (var i = 0; i < S.elements.length; i++) {
    var el = S.elements[i], k, sm;
    if (el.kind === "pfad" && el.points.length >= 2) {
      if (el.variant === "strasse") {
        sm = pathSamples(el.points, 1.4);
        for (k = 0; k < sm.length; k++) {
          stampCorridor(sm[k].x, sm[k].z, el.params.breite * 0.5 + 1.6);
          stampWear(sm[k].x, sm[k].z, el.params.breite * 0.5 + 2.1);
        }
      } else if (el.variant === "fluss") {
        sm = pathSamples(el.points, 1.4);
        for (k = 0; k < sm.length; k++) stampCorridor(sm[k].x, sm[k].z, el.params.breite * 0.6 + 2.2);
      } else if (el.variant === "mauer") {
        sm = pathSamples(el.points, 1.6);
        for (k = 0; k < sm.length; k++) stampCorridor(sm[k].x, sm[k].z, el.params.dicke * 0.6 + 1.2);
      }
    } else if (el.kind === "flaeche" && el.variant === "viertel" && el.points.length >= 3) {
      el.streets = districtStreets(el);
      for (var s = 0; s < el.streets.length; s++) {
        var ln = el.streets[s];
        for (k = 0; k < ln.length; k++) {
          if (inPoly(el.points, ln[k].x, ln[k].z)) stampCorridor(ln[k].x, ln[k].z, el.params.gasse * 0.5 + 1.2);
        }
      }
    }
  }
}

/** Vollständiger Neuaufbau (Laden, Undo, Seed-Wechsel). */
function rebuildAll() {
  rebuildRivers();
  rebuildCorridors();
  refreshTerrainFull();
  for (var i = 0; i < S.elements.length; i++) genElement(S.elements[i]);
  markDirty();
}

/** Regeneriert alle Elemente auf dem aktuellen Terrain — einmalig nach einem
 *  Pinselstrich (pointerup), damit Bäume/Häuser samt Kontaktschatten auf der
 *  neuen Höhe sitzen. Der Terrain-Pinsel ist die begründete Ausnahme vom
 *  Ein-Element-Dirty-Tracking, weil er die Grundlage ALLER Elemente ändert.
 *  Bewusst OHNE refreshTerrainFull: applyBrush hat das Gitter bereits
 *  bereichsweise aktualisiert. Ebenso OHNE rebuildRivers/rebuildCorridors:
 *  der Pinsel ändert nur `base` (nie die Sperrmaske), und applyBrush ruft
 *  recomputeHeights auf, das die vorhandenen Flussstempel idempotent erneut
 *  einschneidet — Flusseinschnitte gehen beim Pinseln also nicht verloren. */
function regenAlleElemente() {
  for (var i = 0; i < S.elements.length; i++) genElement(S.elements[i]);
  markDirty();
}

/** Änderung an einem Element übernehmen. heavy = Terrain/Korridore betroffen. */
function commit(el, heavy) {
  if (heavy) {
    rebuildRivers();
    rebuildCorridors();
    refreshTerrainFull();
    for (var i = 0; i < S.elements.length; i++) genElement(S.elements[i]);
    markDirty();
  } else if (el) {
    regenElement(el);
  }
}

/** Ändert ein Element das Terrain oder die Sperrflächen? */
function isHeavy(el) {
  return (el.kind === "pfad" && (el.variant === "strasse" || el.variant === "fluss" || el.variant === "mauer")) ||
         (el.kind === "flaeche" && el.variant === "viertel");
}


/** Loeschen mit Dirty-Meldung der betroffenen Pools. */
function deleteElement(el) {
  markDirty(Object.keys(el.inst));
  dropElement(el);
}

export { genElement, regenElement, regenAlleElemente, rebuildRivers, rebuildCorridors,
  rebuildAll, commit, isHeavy, deleteElement, markDirty, flushPack };
