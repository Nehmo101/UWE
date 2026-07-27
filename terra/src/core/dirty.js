// Aenderungs-Orchestrierung: Elemente (neu) erzeugen, Terrain/Korridore
// nachziehen, geaenderte Pools packen.
import { S, HALF, VINE_R, clearElement, dropElement } from './store.js';
import { setArborQuellen } from '../render/materials.js';
import { markDirty, flushPack } from './pools.js';
import { rivers, corridor, stampCorridor, stampWear, clearWear, baseHeightAt,
  refreshTerrainFull, recomputeHeights, computeAO, refreshGrid } from '../world/terrain.js';
import { pathSamples, genStrasse, genMauer, genFluss, genHecke,
  genBruch, bruchDaten, bruchMasse, brueche,
  bruchMaskeLeeren, bruchMaskeStempeln, bruchMaskeFertig } from '../generators/paths.js';
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
    // H6: neue Variante am ENDE der Kette — eine aeltere Fassung des Editors
    // faellt durch alle else-if hindurch und erzeugt schlicht nichts, statt
    // abzustuerzen. Das Speicherformat bleibt damit abwaertskompatibel.
    else if (el.variant === "bruch") genBruch(el);
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
  // Bruchkanten benutzen DIESELBE Stempelliste (siehe rebuildBrueche) und
  // muessen daher nach dem rivers.length = 0 oben laufen. Der Aufruf steht
  // bewusst hier statt an jeder Aufrufstelle: so ist jeder Weg, der die
  // Flussstempel erneuert (rebuildAll, commit), automatisch auch fuer die
  // Bruchstempel korrekt.
  rebuildBrueche();
}

/**
 * Sammelt die Bruchkanten-Stempel (H6). Ein Bruch ist ein Flussstempel mit
 * sehr grosser Tiefe und asymmetrischem Profil: die Kreiskette aus
 * bruchDaten() liegt ausschliesslich auf der Abgrundseite, an der
 * gezeichneten Linie selbst ist das Stempelgewicht exakt 0. Deshalb kommt der
 * Bruch OHNE jede Aenderung an terrain.js/recomputeHeights aus — er wird
 * einfach an `rivers` angehaengt und ueber dieselbe Minimum-Regel eingebrannt.
 * `brueche` behaelt die Eintraege zusaetzlich mit Kantenverlauf und Massen,
 * damit Werkzeuge sie ohne Neuberechnung lesen koennen.
 *
 * In DERSELBEN Schleife entsteht die Bruchmaske (paths.js): das Rasterbild der
 * Abgrundzonen, mit dem world/water.js Wasserebene und Meeresboden-Teller
 * aussparen. Sie haengt an genau denselben Stempeln wie die Hoehenwirkung und
 * kann deshalb nicht gegen die Klippe verrutschen. Gibt es keine Bruchkante,
 * bleibt die Maske leer und ihr Shaderzweig abgeschaltet.
 */
function rebuildBrueche() {
  brueche.length = 0;
  bruchMaskeLeeren();
  for (var i = 0; i < S.elements.length; i++) {
    var el = S.elements[i];
    if (el.kind !== "pfad" || el.variant !== "bruch" || el.points.length < 2) continue;
    var d = bruchDaten(el);
    if (!d) continue;
    brueche.push(d);
    rivers.push(d);          // {samples, radius, depth} — genau die rivers-Form
    bruchMaskeStempeln(d);
  }
  bruchMaskeFertig();
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

/* --- Bereichsbeschraenkte Terrain-Updates (D3) --------------------------
   Ein schwerer Commit eines EINZELNEN Elements muss das Terrain nur dort
   neu berechnen, wo dieses Element es beeinflussen kann. Die Stempel-
   Formeln unten sind bewusst dieselben wie in rebuildRivers/
   rebuildCorridors — driftet dort eine Radiusformel, muss sie hier
   mitgezogen werden, sonst wird die Box zu klein. */

/** Groesster Stempelradius des Elements in Weltmetern. */
function stempelRadius(el) {
  var p = el.params;
  if (el.kind === "pfad") {
    // Fluss: der Einschnitt aus rebuildRivers (breite*0.62+2.2) reicht
    // weiter als der Korridorstempel (breite*0.6+2.2) — er bestimmt die Box.
    if (el.variant === "fluss") return p.breite * 0.62 + 2.2;
    // Strasse: der Wear-Stempel faerbt das Gras (breite*0.5+2.1) und reicht
    // weiter als der Korridor (breite*0.5+1.6).
    if (el.variant === "strasse") return p.breite * 0.5 + 2.1;
    if (el.variant === "mauer") return p.dicke * 0.6 + 1.2;
    // Bruch (H6): die Stempelkette reicht bis `reichweite` auf die
    // Abgrundseite. bruchMasse ist DIESELBE Rechnung, die bruchDaten benutzt —
    // hier darf nichts nachgerechnet werden, sonst wird die Box zu klein und
    // es bleiben Reste der alten Klippe stehen.
    if (el.variant === "bruch") return bruchMasse(p).reichweite;
  }
  // Viertel-Gassen stempeln mit gasse*0.5+1.2, per inPoly aufs Polygon geklippt.
  if (el.kind === "flaeche" && el.variant === "viertel") return (p.gasse || 0) * 0.5 + 1.2;
  return 3;   // erreicht isHeavy nie einen anderen Fall, bleibt aber definiert
}

/** Einfluss-Box des Elements in Gitterindizes, inklusive Rand — oder null,
 *  wenn das Element (noch) keine stempelfaehigen Punkte hat. */
function elementBox(el) {
  // Pfade stempeln entlang der Catmull-Rom-Kurve (Tension 0.5), die zwischen
  // den Stuetzpunkten ueberschwingen kann — deshalb die tatsaechlichen
  // Kurven-Samples vermessen statt nur der Punkte. Viertel-Gassen werden per
  // inPoly aufs Polygon geklippt, dort genuegt die Punkt-Box.
  var pts = el.points;
  if (el.kind === "pfad" && el.points.length >= 2) {
    var sm = pathSamples(el.points, 2.5);
    if (sm.length) pts = sm;
  }
  var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (var i = 0; i < pts.length; i++) {
    var q = pts[i];
    if (q.x < minX) minX = q.x;
    if (q.x > maxX) maxX = q.x;
    if (q.z < minZ) minZ = q.z;
    if (q.z > maxZ) maxZ = q.z;
  }
  if (minX > maxX) return null;
  // Rand = Stempelradius + Glaettungsrand: computeAO glaettet ueber einen
  // Nachbarn und erweitert sich intern um 1, die Normalen in refreshGrid
  // lesen einen Nachbarn — +4 deckt das mit Sicherheitsreserve ab (gleiches
  // Muster wie der Pinsel in applyBrush: m = ceil(r)+2 plus AO-Rand).
  var rand = Math.ceil(stempelRadius(el)) + 4;
  return { i0: Math.floor(minX + HALF) - rand, i1: Math.ceil(maxX + HALF) + rand,
           j0: Math.floor(minZ + HALF) - rand, j1: Math.ceil(maxZ + HALF) + rand };
}

/** Terrain nur im Einflussbereich des Elements neu berechnen. Vereinigt die
 *  neue Box mit der beim letzten schweren Commit gemerkten (el._hgtBox):
 *  nach einem Griff-Drag oder einem Schrumpfen der Breite muss auch die ALTE
 *  Lage aufgefrischt werden, sonst bleiben Restloecher (altes Flussbett,
 *  alte Wegfaerbung) im Terrain stehen. Die gemerkte Box stammt aus dem
 *  Commit, der die alte Lage eingebrannt hat — sie deckt sie daher exakt ab. */
function refreshTerrainBereich(el) {
  var neu = elementBox(el);
  var alt = el._hgtBox;
  if (!neu && !alt) { refreshTerrainFull(); return; }   // nichts bekannt → konservativ
  var b = neu && alt
    ? { i0: Math.min(neu.i0, alt.i0), i1: Math.max(neu.i1, alt.i1),
        j0: Math.min(neu.j0, alt.j0), j1: Math.max(neu.j1, alt.j1) }
    : (neu || alt);
  el._hgtBox = neu || alt;   // nicht serialisiert (serializeElements whitelistet)
  // recomputeHeights setzt hgt=base im Bereich und wendet ALLE Flussstempel
  // geklippt an — idempotent, solange die Box alles abdeckt, was sich
  // geaendert hat. AO einen Ring weiter, wie beim Pinsel (applyBrush).
  recomputeHeights(b.i0, b.i1, b.j0, b.j1);
  computeAO(b.i0 - 1, b.i1 + 1, b.j0 - 1, b.j1 + 1);
  refreshGrid(b.i0, b.i1, b.j0, b.j1);
}

/** Vollständiger Neuaufbau (Laden, Undo, Seed-Wechsel). */
function rebuildAll() {
  rebuildRivers();
  rebuildCorridors();
  refreshTerrainFull();
  for (var i = 0; i < S.elements.length; i++) {
    var el = S.elements[i];
    genElement(el);
    // Einfluss-Box vorbelegen: hydrate/Undo erzeugen frische Objekte ohne
    // _hgtBox — der erste Einzel-Commit danach (z. B. nach Griff-Drag) muss
    // die JETZIGE Lage kennen, um sie wieder auffrischen zu koennen.
    if (isHeavy(el)) el._hgtBox = elementBox(el);
  }
  markDirty();
  refreshArborQuellen();
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
    // rebuildRivers/rebuildCorridors bleiben bewusst GLOBAL: rivers[] und die
    // corridor-/wear-Masken sind globale Datenstrukturen, die von allen
    // Elementen gemeinsam beschrieben werden — nur ein kompletter Neuaufbau
    // haelt sie konsistent (ein geloeschter Stempel laesst sich nicht lokal
    // zuruecknehmen). Sie sind gegenueber dem 257²-Terrain billig: reine
    // Array-Stempel entlang der Pfade; keiner von beiden ruft
    // refreshTerrainFull oder refreshGrid auf (geprueft: rebuildRivers liest
    // nur baseHeightAt, rebuildCorridors schreibt nur corridor/wear).
    rebuildRivers();
    rebuildCorridors();
    // Nur beim Commit EINES Elements reicht dessen Einflussbereich; ohne
    // Element (Loeschen — die alte Lage ist hier nicht mehr greifbar) weiter
    // der volle Neuaufbau.
    if (el) refreshTerrainBereich(el);
    else refreshTerrainFull();
    for (var i = 0; i < S.elements.length; i++) genElement(S.elements[i]);
    markDirty();
  } else if (el) {
    regenElement(el);
  }
  // Auch ein leichtes Commit kann das Licht verschieben (Fuss bewegt, dicke
  // oder hoehe geaendert) — deshalb in beiden Zweigen nachziehen.
  refreshArborQuellen();
}

/** Ändert ein Element das Terrain oder die Sperrflächen? */
function isHeavy(el) {
  // "bruch" schneidet ueber die Stempelkette tief ins Hoehenfeld — schwer.
  return (el.kind === "pfad" && (el.variant === "strasse" || el.variant === "fluss" ||
          el.variant === "mauer" || el.variant === "bruch")) ||
         (el.kind === "flaeche" && el.variant === "viertel");
}


/**
 * Meldet die Rankenfuesse als Arbor-Lichtquellen an den Shader (H3).
 * Kanon: Arbor haelt den zerrissenen Planeten zusammen und spendet der Welt
 * Licht — die Ranken muessen ihre Umgebung also wirklich aufhellen, nicht nur
 * selbst hell sein. genRanke darf `el._arbor` setzen (mehrere Fuesse, eigene
 * Radien); fehlt das Feld, genuegt der erste Punkt.
 */
function refreshArborQuellen() {
  var q = [];
  for (var i = 0; i < S.elements.length; i++) {
    var el = S.elements[i];
    if (el.kind !== "ranke" || !el.points.length) continue;
    if (el._arbor && el._arbor.length) { q.push.apply(q, el._arbor); continue; }
    var pr = el.params || {};
    for (var k = 0; k < el.points.length; k++) {
      q.push({
        x: el.points[k].x, z: el.points[k].z,
        radius: VINE_R * (pr.dicke || 1),
        // Hohe Ranken tragen weiter: 220 Einheiten sind die volle Staerke.
        staerke: Math.min(1, (pr.hoehe || 0) / 220)
      });
    }
  }
  setArborQuellen(q);
}

/** Loeschen mit Dirty-Meldung der betroffenen Pools. */
function deleteElement(el) {
  markDirty(Object.keys(el.inst));
  dropElement(el);
  refreshArborQuellen();
}

export { genElement, regenElement, regenAlleElemente, rebuildRivers, rebuildBrueche, rebuildCorridors,
  rebuildAll, commit, isHeavy, deleteElement, refreshArborQuellen,
  markDirty, flushPack };
