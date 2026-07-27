/* ==========================================================================
   Binnenseen (Runde H) — die Wasserflaeche, die der Senkenfueller schon kennt

   Terras Karten haben grosse geschlossene Wannen. `senkenFuellen`
   (world/erosion.js) rechnet sie ohnehin aus, und die DIFFERENZ
   `gefuellt - hoehe` ist buchstaeblich die Seenkarte — sie stand bisher nur
   nirgends im Bild. Ein Fluss, der in einem Becken endete, endete an nichts.

   Diese Datei ist beide Haelften der Antwort, und sie stehen bewusst
   nebeneinander in EINER Datei:

     1. ABLEITUNG (`seenAusFuellung`) — rein, ohne store, ohne three, ohne
        terrain. Rechnet auf uebergebenen Feldern und liefert Polygone. Genau
        wie `biomeVorschlagen` in world/biomfeld.js: aus einer Rastermaske
        wird ein GEBIET, aus dem Gebiet ein POLYGON, und ab da ist es ein ganz
        gewoehnliches Element.
     2. DARSTELLUNG (`genSee`) — der Elementgenerator. Er bekommt nichts als
        Punkte, Parameter und Seed; woher die Punkte stammen, weiss er nicht
        und darf es nicht wissen.

   ---------------------------------------------------------------------------
   IST EIN SEE EIN ELEMENT ODER EINE ABLEITUNG?

   Beides, in dieser Reihenfolge — und das ist keine Ausweichantwort, sondern
   die Regel, die Runde I2 fuer die Biomflaechen aufgestellt hat: die Ableitung
   erzeugt POLYGONE, und Polygone sind Elemente. Danach gibt es keine zweite
   Wahrheit mehr. Der See kennt seine Senke nicht, er kennt seine Punkte; er
   laesst sich verschieben, umformen, loeschen und von Hand zeichnen wie jeder
   Wald.

   Damit das Verschieben nicht zu einem schwebenden oder vergrabenen
   Wasserblatt fuehrt, ist der WASSERSPIEGEL keine gespeicherte Absoluthoehe,
   sondern wird bei jeder Erzeugung aus dem Ufer abgelesen (siehe seeSpiegel).
   Ein verschobener See fuellt also seine neue Mulde statt seine alte Hoehe
   mitzunehmen. `params.stau` hebt oder senkt ihn dagegen — das ist der Regler,
   den ein Bearbeiter wirklich will ("etwas hoeher aufstauen"), und er bleibt
   ueber jede Verschiebung sinnvoll.

   ---------------------------------------------------------------------------
   WIE WIRD EIN SEE GEZEICHNET?

   NICHT ueber die vorhandene Wasserebene aus world/water.js. Die liegt auf
   einer festen Hoehe (dem Meeresspiegel), ist kartenfuellend und traegt eine
   CPU-Wogenrechnung ueber 2000 Einheiten Kantenlaenge — sie kann genau EINE
   Hoehe. Ein Bergsee auf 40 Einheiten braeuchte eine zweite Ebene, ein zweiter
   Bergsee auf 55 eine dritte. Ausserdem muesste jede davon ausserhalb ihres
   Ufers verschwinden, also eine Maske bekommen (wie die Bruchmaske). Das ist
   der teure Weg fuer ein Problem, das der billige loest:

   Ein See ist ein FLACHES POLYGON auf seiner Spiegelhoehe. Es entsteht per
   Ohrenschnitt aus den Elementpunkten, ist also genau so gross wie der See und
   braucht keine Maske. Das Material ist dasselbe Rezept wie das Flusswasser in
   paths.js (durchscheinend, ohne Tiefenschreiben) — und genau daher kommt der
   Tiefeneindruck geschenkt: durch durchscheinendes Wasser sieht man den Boden,
   und der faellt zur Mitte hin ab. Der See ist am Ufer hell und in der Mitte
   dunkel, ohne dass eine einzige Zeile das ausrechnet.

   ---------------------------------------------------------------------------
   UFER

   Ein See ohne Uferlinie sieht aus wie ein Loch — das ist der Grund, warum
   dieser Abschnitt existiert. Zwei Mittel, beide OHNE eine Zeile in
   terrain.js:

     * Ein SAUMBAND laengs der Uferlinie: ein schmaler Streifen aus demselben
       Mesh-Vorrat, weiss-tuerkis, nach innen ausgeblendet und mit `fractal`
       ausgefranst. Das ist die Brandung, die `terrainColor` fuer die KUESTE
       malt — nur dass sie dort an WATER haengt und deshalb fuer einen Bergsee
       nicht zu haben ist.
     * UFERBEWUCHS aus den Pools, die `objekt:ufer2` und `objekt:wasserflora`
       ohnehin benutzen (Schilf, Wollgras, Muschelbank, Treibholz, Seerose).
       Nicht ueber die Objektstreuung — die braeuchte ein zweites Element —,
       sondern direkt ueber `emit`, wie der Fluss seine Uferbestueckung setzt.

   ---------------------------------------------------------------------------
   DETERMINISMUS

   Kein Math.random, kein fortlaufender Elementstrom. Die Flaechenfarbe zieht
   `fractal` in WELTkoordinaten, der Uferbewuchs `rngOf(hashi(...))` mit einem
   Schluessel aus (Bogenlaengenindex, Rolle, Seed) — dasselbe Muster wie in
   paths.js. Zweimal erzeugt ergibt zweimal dasselbe, und das Verschieben eines
   Griffs wuerfelt nur seine Umgebung um.
   ========================================================================== */
import * as THREE from 'three';
import { clamp, hashi, fractal, rngOf, rr, wpick } from '../core/rng.js';
import { S, WATER, groupOf } from '../core/store.js';
import { emit, tintOf } from '../core/pools.js';
import { heightAt } from '../world/terrain.js';
// selbstSchnitt ist die Pruefung, an der die Vereinfachung in I2 haengt; sie
// steht in biomfeld.js und wird von dort exportiert. biomfeld.js haengt nur an
// core/ — der Weg ist zyklusfrei (areas.js nimmt denselben).
import { selbstSchnitt } from '../world/biomfeld.js';
// Douglas-Peucker mit Punktdeckel. Dieselbe Funktion, die auch die Strassen
// der Wegsuche und die Flusslaeufe des Weltgenerators eindampft.
import { vereinfache } from './wegsuche.js';
import { newOcc, tryPlace } from './objects.js';
import { alsKoerper, alsZeichen, linienZeichen } from './zeichen.js';
import { terraMat, tintedMats } from '../render/materials.js';


/* ==========================================================================
   1 — Ableitung: aus der Fuellung werden Polygone

   Drei Stufen, wortgleich zum Vorgehen in world/biomfeld.js (Abschnitt 11):
   Zusammenhangskomponenten, Randverfolgung entlang der Zellkanten, Douglas-
   Peucker mit wachsender Toleranz. Die Verfahren sind dort ausfuehrlich
   begruendet; hier steht nur, was ANDERS ist.

   ANDERS IST DAS RASTER. biomfeld.js rechnet auf dem Terraingitter (eine Zelle
   je Welteinheit), der Weltgenerator auf seinem Analyseraster (jede vierte).
   Deshalb sind Zellweite und Kartenmitte hier Parameter und keine Konstanten —
   und deshalb steht der Code hier und nicht dort. (Waeren `komponenten` und
   `randVerfolgen` in biomfeld.js exportiert, koennte diese Datei sie
   uebernehmen; die noetige Zeile steht im Bericht.)

   ANDERS SIND ZWEI SCHWELLEN STATT EINER, und das ist der eigentliche Punkt
   dieses Abschnitts:

     KERNTIEFE (0.6) entscheidet, ob ueberhaupt ein See vorliegt. Sie stammt
       unveraendert aus dem Flussabschnitt in welt.js und ist dort gemessen:
       auf einer 256er Wiese liegen rund 10 % der Rasterzellen ueber 0.6
       Einheiten Auffuellung, verteilt auf Dutzende winziger Mulden — die sind
       Bodenwellen, keine Seen. Zusammen mit der Mindestflaeche bleiben davon
       die echten Becken uebrig.
     SAUMTIEFE (0.05) entscheidet, WO DAS UFER LIEGT. Ein Polygon entlang der
       Kerntiefe laege 0.6 Einheiten UNTER Wasser — die Wasserflaeche endete
       dann sichtbar vor ihrem eigenen Ufer und liesse einen Ring nassen
       Bodens frei. Deshalb wird die Kontur auf der Wasserlinie verfolgt und
       nur die ZUGEHOERIGKEIT ueber die Kerntiefe entschieden.
   ========================================================================== */

export const SEE_KERN_TIEFE = 0.6;
export const SEE_SAUM_TIEFE = 0.05;
/* Mindestflaeche als Anteil des Rasters (ein Tausendstel), damit auf jeder
   Kartengroesse dasselbe VERHAELTNIS von See zu Karte gilt: 65 x 65 -> 10
   Zellen, 257 x 257 -> 66. Beides aus welt.js uebernommen. */
export const SEE_ANTEIL = 0.001;
export const SEE_MIN_ZELLEN = 10;
/* Griffe je See. Zwischen den Waeldern des Weltgenerators (8 bis 12) und den
   Biomregionen (32): ein See ist verwinkelter als ein Waldfleck und einfacher
   als eine Klimaregion. */
export const SEE_ZIEL_PUNKTE = 20;

/** Komponenten der gesetzten Maskenzellen, 4-Nachbarschaft, iterativ.
 *  `label` ist -1 ausserhalb der Maske. */
function komponenten(maske, nx, label) {
  var n = nx * nx, stapel = new Int32Array(n), groessen = [], id = 0;
  label.fill(-1);
  for (var start = 0; start < n; start++) {
    if (!maske[start] || label[start] >= 0) continue;
    var sp = 0, zahl = 0;
    stapel[sp++] = start; label[start] = id;
    while (sp > 0) {
      var k = stapel[--sp]; zahl++;
      var i = k % nx, j = (k - i) / nx;
      if (i > 0 && label[k - 1] < 0 && maske[k - 1]) { label[k - 1] = id; stapel[sp++] = k - 1; }
      if (i < nx - 1 && label[k + 1] < 0 && maske[k + 1]) { label[k + 1] = id; stapel[sp++] = k + 1; }
      if (j > 0 && label[k - nx] < 0 && maske[k - nx]) { label[k - nx] = id; stapel[sp++] = k - nx; }
      if (j < nx - 1 && label[k + nx] < 0 && maske[k + nx]) { label[k + nx] = id; stapel[sp++] = k + nx; }
    }
    groessen.push(zahl); id++;
  }
  return groessen;
}

/**
 * Randverfolgung ENTLANG DER ZELLKANTEN ("crack following"), nicht ueber die
 * Randzellen. Die Abbildung (Ecke, Richtung) -> (Ecke, Richtung) ist eine
 * Permutation der gerichteten Kanten und damit umkehrbar: wer von einem
 * Zustand losgeht, kommt zu ihm zurueck. Laufzeit O(Umfang).
 *
 * `startK` muss die ERSTE Zelle der Komponente in Zeilenordnung sein — dann
 * ist die Zelle darueber garantiert aussen, und der Startzustand stimmt.
 * Rueckgabe: Eckindizes cz * (nx+1) + cx.
 */
function randVerfolgen(label, nx, id, startK, maxSchritte) {
  var si = startK % nx, sj = (startK - si) / nx;
  var CW = nx + 1;
  function drin(i, j) {
    return i >= 0 && j >= 0 && i < nx && j < nx && label[j * nx + i] === id;
  }
  var cx = si, cz = sj, d = 0;
  var sx = cx, sz = cz, sd = d;
  var out = [];
  for (var schritt = 0; schritt < maxSchritte; schritt++) {
    out.push(cz * CW + cx);
    if (d === 0) cx++; else if (d === 1) cz++; else if (d === 2) cx--; else cz--;
    var UL = drin(cx - 1, cz - 1), UR = drin(cx, cz - 1);
    var DL = drin(cx - 1, cz), DR = drin(cx, cz);
    if (d === 0) d = UR ? 3 : (DR ? 0 : 1);
    else if (d === 1) d = DR ? 0 : (DL ? 1 : 2);
    else if (d === 2) d = DL ? 1 : (UL ? 2 : 3);
    else d = UL ? 2 : (UR ? 3 : 0);
    if (cx === sx && cz === sz && d === sd) break;
  }
  return out;
}

/** Gleitender Mittelwert ueber einen GESCHLOSSENEN Zug. Ohne ihn treppt die
 *  Kontur in 90°-Stufen, und Douglas-Peucker behaelt jede Stufe, die weiter
 *  als die Toleranz aussen liegt (dieselbe Beobachtung wie randGlaetten in
 *  world/biomfeld.js und glaetteZug in welt.js). */
function ringGlaetten(pts, w) {
  var n = pts.length;
  if (n < 8 || w < 1) return pts;
  var out = new Array(n), inv = 1 / (2 * w + 1);
  for (var i = 0; i < n; i++) {
    var sx = 0, sz = 0;
    for (var k = -w; k <= w; k++) {
      var p = pts[((i + k) % n + n) % n];
      sx += p.x; sz += p.z;
    }
    out[i] = { x: sx * inv, z: sz * inv };
  }
  return out;
}

/** Eckenkette -> Weltpolygon. Ecke (i,j) ist die linke obere Ecke der Zelle
 *  (i,j); Zellmitte (i,j) liegt auf i*raster - half. */
function zuPolygon(rand, nx, raster, half, ziel) {
  var CW = nx + 1, pts = [], k;
  for (k = 0; k < rand.length; k++) {
    var i = rand[k] % CW, j = (rand[k] - i) / CW;
    pts.push({ x: (i - 0.5) * raster - half, z: (j - 0.5) * raster - half });
  }
  while (pts.length > 1 && pts[pts.length - 1].x === pts[0].x
    && pts[pts.length - 1].z === pts[0].z) pts.pop();
  if (pts.length < 3) return null;
  pts = ringGlaetten(pts, clamp(Math.round(pts.length / 24), 1, 24));
  /* Aufsteigende Toleranz, bis die Punktzahl passt. Behalten wird der
     schnittfreie Stand mit den WENIGSTEN Punkten — nicht der letzte: bei
     zerfransten Ufern schneidet sich der Rand ab einer gewissen Toleranz
     wieder, und der letzte schnittfreie Stand haette dann die meisten. */
  var bester = null;
  for (var tol = raster * 0.35, versuch = 0; versuch < 14; versuch++, tol *= 1.6) {
    var v = vereinfache(pts, tol, 4096);
    if (v.length < 3) break;
    if (selbstSchnitt(v)) continue;
    if (!bester || v.length < bester.length) bester = v;
    if (v.length <= ziel) { bester = v; break; }
  }
  if (!bester || bester.length < 3) return null;
  for (k = 0; k < bester.length; k++) {
    bester[k] = { x: Math.round(bester[k].x * 10) / 10, z: Math.round(bester[k].z * 10) / 10 };
  }
  return bester;
}

/** Doppelte Flaeche mit Vorzeichen. > 0 heisst: die Punkte laufen so herum,
 *  dass (-tz, tx) nach INNEN zeigt. */
function flaecheZweifach(pts) {
  var s = 0, n = pts.length;
  for (var i = 0, j = n - 1; i < n; j = i++) s += pts[j].x * pts[i].z - pts[i].x * pts[j].z;
  return s;
}

/**
 * Binnenseen aus einem gefuellten Hoehenfeld.
 *
 * Rein: kein store, kein terrain, kein three. Damit ist die Ableitung ohne
 * Editor pruefbar und laesst sich auf jedes Gitter anwenden.
 *
 * @param hoehe    Float32Array, nx*nx, Zeilen-Major (das UNVERAENDERTE Gelaende)
 * @param gefuellt Float32Array, nx*nx — Ergebnis von senkenFuellen/abflussNetz
 * @param nx       Kantenlaenge des Gitters
 * @param opt      { raster, half, minZellen, zielPunkte, maxSeen,
 *                   kernTiefe, saumTiefe }
 *                 `raster` ist die Zellweite in Welteinheiten (Vorgabe 1),
 *                 `half` die halbe Kartenkante (Vorgabe (nx-1)*raster/2).
 * @returns { maske, seen }
 *   maske  Uint8Array, nx*nx — 1 auf jeder Zelle, die zu einem ANERKANNTEN
 *          See gehoert, bis hinaus zur Wasserlinie. Genau die Maske, an der
 *          die Flussverfolgung enden soll.
 *   seen   [{ points, spiegel, tiefe, zellen, mitte }] — groesster zuerst.
 *          `points` ist ein einfaches (schnittfreies) Polygon in
 *          Weltkoordinaten, `spiegel` die Fuellhoehe, `tiefe` die groesste
 *          Wassertiefe.
 */
export function seenAusFuellung(hoehe, gefuellt, nx, opt) {
  var o = opt || {};
  var raster = o.raster > 0 ? o.raster : 1;
  var half = Number.isFinite(o.half) ? o.half : (nx - 1) * raster * 0.5;
  var kernT = Number.isFinite(o.kernTiefe) ? o.kernTiefe : SEE_KERN_TIEFE;
  var saumT = Number.isFinite(o.saumTiefe) ? o.saumTiefe : SEE_SAUM_TIEFE;
  var ziel = o.zielPunkte > 2 ? o.zielPunkte : SEE_ZIEL_PUNKTE;
  var n = nx * nx;
  var maske = new Uint8Array(n);
  var leer = { maske: maske, seen: [] };
  if (!hoehe || !gefuellt || hoehe.length !== n || gefuellt.length !== n) return leer;
  var minZellen = Number.isFinite(o.minZellen) ? o.minZellen
    : Math.max(SEE_MIN_ZELLEN, Math.round(n * SEE_ANTEIL));

  // Kern (tief genug, um ueberhaupt ein See zu sein) und Saum (Wasserlinie).
  var kern = new Uint8Array(n), voll = new Uint8Array(n), id;
  var etwas = false;
  for (id = 0; id < n; id++) {
    var t = gefuellt[id] - hoehe[id];
    if (t > kernT) { kern[id] = 1; etwas = true; }
    if (t > saumT) voll[id] = 1;
  }
  if (!etwas) return leer;

  var kl = new Int32Array(n), kg = komponenten(kern, nx, kl);
  var vl = new Int32Array(n), vg = komponenten(voll, nx, vl);
  /* Ein Saumgebiet gilt, wenn es einen Kern TRAEGT, der gross genug ist. Zwei
     Becken, deren Saeume zusammenhaengen, sind damit EIN See — und das ist
     richtig: ihre Wasserflaechen beruehren sich ja auch. */
  var gilt = new Uint8Array(vg.length);
  for (id = 0; id < n; id++) {
    if (!kern[id] || vl[id] < 0) continue;
    if (kg[kl[id]] >= minZellen) gilt[vl[id]] = 1;
  }

  // Startzelle je Saumgebiet = erste in Zeilenordnung (Bedingung von randVerfolgen).
  var start = new Int32Array(vg.length).fill(-1);
  for (id = 0; id < n; id++) { var L = vl[id]; if (L >= 0 && start[L] < 0) start[L] = id; }

  var roh = [];
  for (var g = 0; g < vg.length; g++) {
    if (!gilt[g]) continue;
    roh.push({ g: g, zellen: vg[g] });
  }
  // Groesster zuerst; Gleichstand ueber die Startzelle, damit die Reihenfolge
  // total und ortsunabhaengig ist.
  roh.sort(function (a, b) { return (b.zellen - a.zellen) || (start[a.g] - start[b.g]); });
  if (o.maxSeen > 0 && roh.length > o.maxSeen) roh.length = o.maxSeen;

  var seen = [];
  for (var r = 0; r < roh.length; r++) {
    var gi = roh[r].g;
    // Der Umfang einer Komponente aus A Zellen liegt unter 2A + 4 Kanten;
    // 4A + 16 ist eine Reissleine, keine erwartete Groesse.
    var rand = randVerfolgen(vl, nx, gi, start[gi], vg[gi] * 4 + 16);
    if (rand.length < 4) continue;
    var poly = zuPolygon(rand, nx, raster, half, ziel);
    if (!poly) continue;
    if (flaecheZweifach(poly) < 0) poly.reverse();
    // Spiegel und groesste Tiefe des Gebiets. Die Fuellung ist ueber der
    // Wanne bis auf das eps der Senkenfuellung konstant; das Maximum ist die
    // Ueberlaufhoehe und damit der Spiegel.
    var spiegel = -1e9, tiefe = 0, zahl = 0, mx = 0, mz = 0;
    for (id = 0; id < n; id++) {
      if (vl[id] !== gi) continue;
      maske[id] = 1;
      zahl++;
      if (gefuellt[id] > spiegel) spiegel = gefuellt[id];
      var d = gefuellt[id] - hoehe[id];
      if (d > tiefe) tiefe = d;
      var ii = id % nx;
      mx += ii * raster - half;
      mz += ((id - ii) / nx) * raster - half;
    }
    seen.push({
      points: poly, spiegel: spiegel, tiefe: tiefe, zellen: zahl,
      mitte: { x: mx / zahl, z: mz / zahl }
    });
  }
  return { maske: maske, seen: seen };
}


/* ==========================================================================
   2 — Ohrenschnitt

   Ein See ist selten konvex; ein Faecher vom Schwerpunkt aus wuerde bei jeder
   Bucht ueber Land laufen. Ohrenschnitt ist das einfachste Verfahren, das ein
   beliebiges einfaches Polygon korrekt zerlegt, kommt ohne Bibliothek aus (der
   THREE-Ersatz der Pruefungen hat keine ShapeUtils) und ist bei zwanzig Ecken
   mit O(n²) unbezahlbar billig. Kein Zufall, keine Reihenfolgeabhaengigkeit.
   ========================================================================== */

function inDreieck(ax, az, bx, bz, cx, cz, px, pz) {
  var d1 = (px - bx) * (az - bz) - (ax - bx) * (pz - bz);
  var d2 = (px - cx) * (bz - cz) - (bx - cx) * (pz - cz);
  var d3 = (px - ax) * (cz - az) - (cx - ax) * (pz - az);
  var neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  var pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(neg && pos);
}

/**
 * Dreiecksindizes eines einfachen Polygons. Erwartet die Punkte in der
 * Reihenfolge mit POSITIVER Flaeche (flaecheZweifach > 0); die gelieferten
 * Tripel sind so gedreht, dass ihre Normale nach +y zeigt.
 */
function ohren(pts) {
  var n = pts.length, out = [], i;
  if (n < 3) return out;
  var v = [];
  for (i = 0; i < n; i++) v.push(i);
  var schutz = n * n + 8;
  while (v.length > 3 && schutz-- > 0) {
    var geschnitten = false;
    for (var k = 0; k < v.length; k++) {
      var m = v.length;
      var i0 = v[(k + m - 1) % m], i1 = v[k], i2 = v[(k + 1) % m];
      var A = pts[i0], B = pts[i1], C = pts[i2];
      // Konvexe Ecke bei positiver Umlaufrichtung?
      if ((B.x - A.x) * (C.z - B.z) - (B.z - A.z) * (C.x - B.x) <= 0) continue;
      var frei = true;
      for (var q = 0; q < m; q++) {
        var iq = v[q];
        if (iq === i0 || iq === i1 || iq === i2) continue;
        if (inDreieck(A.x, A.z, B.x, B.z, C.x, C.z, pts[iq].x, pts[iq].z)) { frei = false; break; }
      }
      if (!frei) continue;
      out.push(i0, i2, i1);          // gedreht: Normale nach +y
      v.splice(k, 1);
      geschnitten = true;
      break;
    }
    // Entartetes Polygon (Doppelpunkte, Selbstberuehrung): Rest als Faecher.
    if (!geschnitten) break;
  }
  if (v.length === 3) out.push(v[0], v[2], v[1]);
  else if (v.length > 3) for (i = 1; i < v.length - 1; i++) out.push(v[0], v[i + 1], v[i]);
  return out;
}


/* ==========================================================================
   3 — Der Elementgenerator
   ========================================================================== */

/* Wasserfarben. Zwei, nicht eine — und das ist die halbe Miete des Bildes:

   Ein durchscheinendes Blatt in EINER Farbe ueber einer Wanne liest sich als
   ueberschwemmte Wiese, nicht als See. Das Auge erkennt einen See daran, dass
   er zum Ufer hin AUFHELLT. Der Durchblick auf den Beckenboden allein leistet
   das nicht: die Wanne ist am Ufer nur wenige Zehntel tief, aber auch in der
   Mitte selten mehr als drei Einheiten — der Unterschied im Bild ist winzig.

   Deshalb traegt die Flaeche den Verlauf selbst (siehe wasserFlaeche): ein
   Aussenring in `SEE_FLACH`, ein Innenring in `SEE_TIEF`. Die Farben liegen
   zwischen dem Meer (0x3f93ad, water.js) und dem Flusswasser (0x6fb5c4,
   paths.js) — ein Binnensee ist tiefer als ein Bach und ruhiger als das Meer. */
var SEE_TIEF = [0.20, 0.45, 0.58];
var SEE_FLACH = [0.38, 0.68, 0.74];
var SAUM_FARBE = [0.86, 0.95, 0.97];

/* Geteiltes Modul-Material, Muster von flussMat in paths.js: EIN Material fuer
   alle See-Elemente, sonst leckt jede Regenerierung eines. Kein
   userData.eigenesMaterial an den Meshes, damit clearElement (store.js) es
   nicht disposed. Ueber tintedMats macht es den Tageszeit-Grundton mit. */
var seeMat = terraMat({
  vertexColors: true, transparent: true, opacity: 0.82,
  depthWrite: false, side: THREE.DoubleSide
});
tintedMats.push(seeMat);

/* Das Saumband traegt seine Verblassung im ALPHAKANAL der Vertexfarbe (vier
   Komponenten; three schaltet USE_COLOR_ALPHA daran fest). `opacity` bleibt
   deshalb 1 — die Deckung kommt komplett aus der Farbe. */
var saumMat = terraMat({
  vertexColors: true, transparent: true, opacity: 1,
  depthWrite: false, side: THREE.DoubleSide
});
tintedMats.push(saumMat);

/** Ortsstabiler Zufallsstrom — Muster aus paths.js/areas.js. */
function ortsRng(a, b, s) { return rngOf((hashi(a, b, s) * 4294967296) | 0); }

/**
 * Wasserspiegel eines See-Elements.
 *
 * Abgelesen am UFER, nicht gespeichert: der Median der Gelaendehoehe entlang
 * des Polygonrandes. Warum der Median und nicht das Minimum oder das Maximum —
 * beide waeren die naheliegenden Kandidaten und beide sind falsch:
 *   * das MINIMUM faellt auf jede einzelne Kerbe herein, die die
 *     Randvereinfachung angeschnitten hat, und legt den Spiegel zu tief; der
 *     See zeigte dann einen Ring trockenen Beckens;
 *   * das MAXIMUM faellt auf jede Nase herein und legte ihn zu hoch; der See
 *     liefe ueber sein Ufer.
 * Der Median ist gegen beides unempfindlich und liegt bei einer Kontur, die
 * ohnehin auf der Wasserlinie verfolgt wurde, genau auf der Fuellhoehe.
 *
 * `params.stau` hebt oder senkt ihn danach — das ist der Regler, und er bleibt
 * beim Verschieben des Sees sinnvoll, weil er RELATIV ist.
 *
 * Gelesen wird `heightAt` (das gespeicherte Gelaende), niemals ein Laufzeit-
 * Messfeld der Erosion.
 */
export function seeSpiegel(el) {
  var pts = el.points, n = pts && pts.length ? pts.length : 0;
  if (n < 3) return WATER;
  var hs = [];
  for (var i = 0; i < n; i++) {
    var a = pts[i], b = pts[(i + 1) % n];
    var L = Math.hypot(b.x - a.x, b.z - a.z);
    var m = Math.max(1, Math.round(L / 3));
    for (var k = 0; k < m; k++) {
      var t = k / m;
      hs.push(heightAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t));
    }
  }
  hs.sort(function (p, q) { return p - q; });
  var basis = hs[hs.length >> 1];
  var stau = Number.isFinite(el.params && el.params.stau) ? el.params.stau : 0;
  // Nie unter den Meeresspiegel: dort uebernaehme die kartenfuellende
  // Wasserebene aus world/water.js, und zwei Flaechen auf derselben Hoehe
  // flimmerten gegeneinander.
  return Math.max(WATER + 0.05, basis + stau);
}

/* ==========================================================================
   Vom Griffpolygon zum Ufer

   Die Elementpunkte sind GRIFFE, nicht das Ufer — genau wie bei jedem Pfad.
   Wer sie direkt zeichnet, bekommt bei einem grossen See ein glaubwuerdiges
   Bild (zwanzig Ecken auf zweihundert Einheiten sieht niemand) und bei einem
   kleinen Bergsee ein blaues Vieleck, das wie aufgeklebt aussieht. Genau das
   war im ersten Bilddurchgang zu sehen und der Grund fuer diesen Abschnitt.

   Also derselbe Weg wie in paths.js: durch die Griffe laeuft eine
   Catmull-Rom-Kurve (Spannung 0.5, wortgleich zu `pathCurve`), nur
   GESCHLOSSEN. Gezeichnet wird die Kurve, angefasst werden die Griffe.

   Eigene Rechnung statt THREE.CatmullRomCurve3: die geschlossene Variante
   liefe ueber den Ersatz-THREE der Pruefungen, und zehn Zeilen Polynom sind
   billiger als die Zusage, dass zwei Kurvenimplementierungen dasselbe tun.

   SICHERUNG: eine Catmull-Rom-Kurve kann an einer spitzen Ecke ueber das
   Polygon hinausschwingen und sich selbst schneiden — dann waere der
   Ohrenschnitt sinnlos und das Ufer haette einen Knoten. In dem Fall bleibt es
   beim Griffpolygon; ein See mit einer solchen Ecke ist ohnehin von Hand
   gezeichnet und meint sie vielleicht so.
   ========================================================================== */

/** Ein Punkt der geschlossenen Catmull-Rom-Kurve (Spannung 0.5). */
function crPunkt(p0, p1, p2, p3, u, out) {
  var u2 = u * u, u3 = u2 * u;
  out.x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * u
    + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2
    + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3);
  out.z = 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * u
    + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * u2
    + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * u3);
  return out;
}

/** Dichter, geschlossener Uferzug aus den Griffen. Schrittweite in
 *  Welteinheiten; die Punktzahl ist gedeckelt, damit der Ohrenschnitt eines
 *  kartengrossen Sees nicht davonlaeuft. */
function uferZug(pts, schritt) {
  var n = pts.length;
  if (n < 3) return pts.slice();
  var umfang = 0, i;
  for (i = 0; i < n; i++) {
    umfang += Math.hypot(pts[(i + 1) % n].x - pts[i].x, pts[(i + 1) % n].z - pts[i].z);
  }
  if (!(umfang > 1e-4)) return pts.slice();
  // Hoechstens 160 Stuetzpunkte: darueber sieht man nichts mehr und der
  // Ohrenschnitt (O(n²)) wird spuerbar.
  var proSeg = clamp(Math.round(umfang / schritt / n), 1, Math.max(1, Math.floor(160 / n)));
  if (proSeg <= 1) return pts.slice();
  var out = [], q = { x: 0, z: 0 };
  for (i = 0; i < n; i++) {
    var p0 = pts[(i + n - 1) % n], p1 = pts[i];
    var p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (var k = 0; k < proSeg; k++) {
      crPunkt(p0, p1, p2, p3, k / proSeg, q);
      out.push({ x: q.x, z: q.z });
    }
  }
  // Ueberschwinger an spitzen Ecken: dann lieber die Griffe selbst.
  if (selbstSchnitt(out)) return pts.slice();
  return out;
}

/**
 * Der Uferzug eines See-Elements: geglaettet, mit fester Umlaufrichtung
 * (positive Flaeche, damit (-tz, tx) nach innen zeigt). Exportiert, weil die
 * Pruefungen genau das messen wollen, was gezeichnet wird — und nicht das
 * Griffpolygon, das nur die Vorlage dafuer ist.
 */
export function seeUmriss(el) {
  var pts = [], i;
  var quelle = (el && el.points) || [];
  for (i = 0; i < quelle.length; i++) pts.push({ x: quelle[i].x, z: quelle[i].z });
  if (pts.length < 3) return pts;
  if (flaecheZweifach(pts) < 0) pts.reverse();
  var zug = uferZug(pts, 3.2);
  if (flaecheZweifach(zug) < 0) zug.reverse();
  return zug;
}

/** Tangente, Innennormale und Bogenlaenge je Punkt eines geschlossenen Zuges.
 *  Positive Umlaufrichtung vorausgesetzt: (-tz, tx) zeigt ins Polygon. */
function ringPunkte(pts) {
  var n = pts.length, out = [], s = 0, i;
  if (n < 3) return out;
  for (i = 0; i < n; i++) {
    var a = pts[(i + n - 1) % n], b = pts[i], c = pts[(i + 1) % n];
    var dx = c.x - a.x, dz = c.z - a.z;
    var d = Math.hypot(dx, dz) || 1;
    out.push({ x: b.x, z: b.z, tx: dx / d, tz: dz / d, nx: -dz / d, nz: dx / d, s: s });
    s += Math.hypot(c.x - b.x, c.z - b.z);
  }
  out.len = s;
  return out;
}

/* Uferbewuchs. Genau die Pools, die `objekt:ufer2` und `objekt:wasserflora`
   im Objektkatalog fuehren — ein Seeufer ist dieselbe Sache wie ein
   Meeresufer, nur kleiner, und eine zweite Artenliste dafuer waere eine
   zweite Pflegestelle. */
var UFER_LAND = [["schilf", 6], ["wollgras", 4], ["gras", 5], ["fels", 3],
  ["treibholz", 2], ["muschelbank", 2], ["busch", 3]];
var UFER_WASSER = [["seerose", 6], ["schilf", 4], ["seetang", 2]];

/* ==========================================================================
   Der See als Sperrflaeche

   `tryPlace` (generators/objects.js) — DIE gemeinsame Bodenregel — kennt genau
   EIN Gewaesser: das Meer (`h < WATER + 0.35`). Ein Bergsee auf Hoehe 20
   besteht diese Pruefung mit fliegenden Fahnen. Solange man ihn nicht sah, war
   das folgenlos; jetzt stuenden Baeume und Haeuser sichtbar im Wasser.

   Der Weltgenerator haelt sich seine eigenen Flaechen mit `festAmSee` vom Leib
   (generators/welt.js). Fuer HANDGEZEICHNETE Elemente gibt es dafuer genau ein
   Mittel, das ohne eine Zeile in terrain.js auskommt: die KORRIDORMASKE, mit
   der schon Strassen, Fluesse und Viertel ihre Flaeche sperren. Diese Funktion
   liefert die Stempel dafuer; gesetzt werden sie von core/dirty.js
   (rebuildCorridors) — die noetigen Zeilen stehen im Bericht.

   Warum ein Punktraster und keine Kette am Ufer: ein See sperrt seine FLAECHE,
   nicht seinen Rand. Die Schrittweite 4 mit Radius 3 ueberdeckt lueckenlos
   (halbe Diagonale 2.83 < 3), und der Deckel haelt eine kartenfuellende
   Fehleingabe von der Bildrate fern.
   ========================================================================== */
var KORRIDOR_SCHRITT = 4;
var KORRIDOR_MAX = 6000;

/** Punkt im Polygon (Strahlverfahren). */
function inRing(pts, x, z) {
  var drin = false;
  for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    var a = pts[i], b = pts[j];
    if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) drin = !drin;
  }
  return drin;
}

/**
 * Korridorstempel eines Sees: [{x, z, r}] ueber seiner Wasserflaeche.
 * Leer, wenn das Element (noch) kein Polygon hat.
 */
export function seeKorridore(el) {
  var pts = seeUmriss(el), out = [];
  if (pts.length < 3) return out;
  var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, i;
  for (i = 0; i < pts.length; i++) {
    if (pts[i].x < minX) minX = pts[i].x;
    if (pts[i].x > maxX) maxX = pts[i].x;
    if (pts[i].z < minZ) minZ = pts[i].z;
    if (pts[i].z > maxZ) maxZ = pts[i].z;
  }
  var s = KORRIDOR_SCHRITT, r = s * 0.75;
  // Raster an WELTkoordinaten ausgerichtet, nicht an der Huellbox: sonst
  // wanderten die Stempel beim Verschieben des Sees durch ihn hindurch.
  var i0 = Math.floor(minX / s), i1 = Math.ceil(maxX / s);
  var j0 = Math.floor(minZ / s), j1 = Math.ceil(maxZ / s);
  for (var j = j0; j <= j1 && out.length < KORRIDOR_MAX; j++) {
    for (i = i0; i <= i1 && out.length < KORRIDOR_MAX; i++) {
      var x = i * s, z = j * s;
      if (inRing(pts, x, z)) out.push({ x: x, z: z, r: r });
    }
  }
  return out;
}

/**
 * See: Wasserflaeche, Saumband, Uferbewuchs.
 *
 * Kein Eingriff ins Hoehenfeld — die Wanne ist bereits da (der See wurde ja
 * aus ihr abgeleitet), und ein handgezeichneter See soll das Gelaende nicht
 * umgraben, sondern es fluten. Deshalb ist `flaeche:see` auch KEIN schweres
 * Element im Sinne von core/dirty.js: es aendert weder Terrain noch Korridore.
 */
export function genSee(el) {
  var p = el.params || {};
  if (!el.points || el.points.length < 3) return;
  // Der geglaettete Uferzug — nicht die Griffe. Feste Umlaufrichtung, weil
  // Ohrenschnitt und Innennormale beide daran haengen.
  var pts = seeUmriss(el);
  if (pts.length < 3) return;
  var y = seeSpiegel(el);

  /* I1 — auf Kartenmassstab braucht ein See KEIN eigenes Zeichen: seine
     Wasserflaeche IST das Kartenzeichen (eine blaue Flaeche ist auf jeder
     Karte ein Gewaesser). Was ihm fehlt, ist die Uferlinie — und die fuehrt
     der Katalog bereits als `sig_kueste` unter der Sache „Gewaesser". Deshalb
     bleibt die Flaeche auf jedem Massstab stehen, und darueber kommt ab der
     Uebergabe der Kuestenstrich. */
  var mSig = S.einheitMeter;
  wasserFlaeche(el, pts, y);
  if (alsZeichen(mSig)) {
    var ring = pts.slice();
    ring.push({ x: pts[0].x, z: pts[0].z });
    linienZeichen(el, "gewaesser", ring, null, { art: "sig_kueste" });
  }
  if (!alsKoerper(mSig)) return;

  var saum = clamp(Number.isFinite(p.saum) ? p.saum : 5, 0, 20);
  var rand = ringPunkte(pts);
  if (rand.length >= 8 && saum > 0.2) saumBand(el, rand, y, saum);
  if (p.ufer !== false) uferBewuchs(el, rand, y, p);
}

/**
 * Ein nach innen versetzter Zwilling des Polygons — die Trennlinie zwischen
 * flachem und tiefem Wasser.
 *
 * Versetzt wird entlang der Winkelhalbierenden, OHNE die uebliche 1/sin-
 * Korrektur: sie laesst den Versatz an spitzen Ecken ins Unendliche laufen und
 * ist damit genau dort gefaehrlich, wo ein See eine Bucht hat. Ein
 * gleichmaessiger Versatz macht die Kante an spitzen Ecken etwas schmaler —
 * das sieht niemand, eine ausgerissene Ecke sieht jeder.
 *
 * Liefert null, wenn der Versatz das Polygon zerstoert (schmaler Tuempel,
 * Selbstschnitt, Umlaufrichtung gekippt). Dann bleibt es beim einfachen Ring;
 * ein kleiner See braucht ohnehin keinen Tiefenverlauf.
 */
function innenRing(pts, d) {
  var n = pts.length, aussen = flaecheZweifach(pts), innen = [];
  if (!(d > 0.1) || n < 3) return null;
  for (var i = 0; i < n; i++) {
    var a = pts[(i + n - 1) % n], b = pts[i], c = pts[(i + 1) % n];
    var tx = c.x - a.x, tz = c.z - a.z;
    var l = Math.hypot(tx, tz);
    if (!(l > 1e-6)) return null;
    innen.push({ x: b.x - tz / l * d, z: b.z + tx / l * d });
  }
  var f = flaecheZweifach(innen);
  // Mindestens ein Fuenftel der Flaeche muss uebrig bleiben, sonst ist der
  // "Innenring" nur noch ein Knoten in der Mitte.
  if (!(f > 0) || f < aussen * 0.2) return null;
  if (selbstSchnitt(innen)) return null;
  return innen;
}

/**
 * Die Wasserflaeche: ein flaches Polygon auf Spiegelhoehe, aussen hell und
 * innen dunkel.
 *
 * Gebaut wird sie aus zwei Ringen — einem Streifen zwischen Ufer und
 * Innenring, dazu dem ohrengeschnittenen Innenring. Beide zusammen decken
 * exakt das Polygon; die Pruefung in 16-seen misst genau das (Summe der
 * Dreiecksflaechen gegen die Polygonflaeche).
 */
function wasserFlaeche(el, pts, y) {
  var n = pts.length, i;
  /* Versatztiefe an der GROESSE des Sees: der Radius eines flaechengleichen
     Kreises, davon ein knappes Drittel. Ein fester Wert waere auf einem
     Weiher der ganze See und auf einem Bergsee ein Strich. */
  var flaeche = Math.abs(flaecheZweifach(pts)) * 0.5;
  var innen = innenRing(pts, clamp(Math.sqrt(flaeche / Math.PI) * 0.38, 2, 30));

  var pos = [], col = [], idx = [];
  function punkt(q, farbe) {
    pos.push(q.x, y, q.z);
    /* Malerische Tonschwankung in WELTkoordinaten: sie wandert damit nicht
       durch die Flaeche, wenn ein Griff bewegt wird. */
    var v = 0.90 + fractal(q.x * 0.02, q.z * 0.02, el.seed + 401) * 0.20;
    col.push(farbe[0] * v, farbe[1] * v, farbe[2] * v);
  }

  if (innen) {
    for (i = 0; i < n; i++) punkt(pts[i], SEE_FLACH);
    for (i = 0; i < n; i++) punkt(innen[i], SEE_TIEF);
    // Streifen zwischen den Ringen. Umlaufsinn wie beim Ohrenschnitt gedreht,
    // damit die Normale nach +y zeigt.
    for (i = 0; i < n; i++) {
      var a = i, b = (i + 1) % n, ai = n + i, bi = n + ((i + 1) % n);
      idx.push(a, ai, b, b, ai, bi);
    }
    var tri = ohren(innen);
    for (i = 0; i < tri.length; i++) idx.push(n + tri[i]);
  } else {
    for (i = 0; i < n; i++) punkt(pts[i], SEE_TIEF);
    idx = ohren(pts);
  }
  if (!idx.length) return;

  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  var mesh = new THREE.Mesh(g, seeMat);
  mesh.userData.el = el;
  // Wie das Flusswasser: ueber der Wasserebene (4), unter den Kartenzeichen (6).
  mesh.renderOrder = 5;
  groupOf(el).add(mesh);
}

/**
 * Saumband — die Brandung, die `terrainColor` nur am Meeresspiegel malt.
 *
 * Ein Streifen von der Uferlinie nach INNEN, weiss-tuerkis, mit einer
 * ausgefransten Innenkante und nach innen ausgeblendet. Die Ausfransung zieht
 * `fractal` in Weltkoordinaten: eine gleichmaessig breite Borte saehe aus wie
 * ein Gummiring, und genau das ist der Unterschied zwischen einem See und
 * einem Schwimmbecken.
 *
 * Liegt UEBER der Wasserflaeche (renderOrder 6) und schreibt keine Tiefe —
 * beide Flaechen liegen auf derselben Hoehe, eine Staffelung ueber y waere ein
 * Ratespiel gegen die Tiefenpufferaufloesung.
 */
function saumBand(el, rand, y, saum) {
  var m = rand.length;
  var pos = [], col = [], idx = [];
  for (var i = 0; i < m; i++) {
    var r = rand[i];
    var breit = saum * (0.55 + fractal(r.x * 0.09, r.z * 0.09, el.seed + 409) * 0.9);
    /* Deckung des Saums. Gemessen im Bild und zweimal zurueckgenommen: bei
       0.42..0.77 wirkte der ganze See milchig, weil das Band bei einem
       kleinen See ein Drittel der Flaeche bedeckt. Eine Brandung ist eine
       ANDEUTUNG, kein Anstrich. */
    var deck = 0.22 + fractal(r.z * 0.06, r.x * 0.06, el.seed + 411) * 0.28;
    // Aussenkante: exakt auf der Uferlinie, volle Deckung.
    pos.push(r.x, y, r.z);
    col.push(SAUM_FARBE[0], SAUM_FARBE[1], SAUM_FARBE[2], deck);
    // Innenkante: um `breit` ins Wasser hinein, ausgeblendet.
    pos.push(r.x + r.nx * breit, y, r.z + r.nz * breit);
    col.push(SAUM_FARBE[0], SAUM_FARBE[1], SAUM_FARBE[2], 0);
    var a = i * 2, b = ((i + 1) % m) * 2;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(col), 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  var mesh = new THREE.Mesh(g, saumMat);
  mesh.userData.el = el;
  mesh.renderOrder = 6;
  groupOf(el).add(mesh);
}

/**
 * Uferbewuchs: Schilf, Wollgras und Treibholz auf dem Land, Seerosen auf dem
 * Wasser. Zufalls-Schluessel ortsstabil ueber (Bogenlaengenindex, Rolle,
 * seed+N) — dasselbe Muster, mit dem paths.js seine Uferbestueckung setzt; ein
 * verschobener Griff wuerfelt damit nur seine Umgebung um.
 *
 * Die Landpflanzen laufen ueber `tryPlace` und damit ueber DIE gemeinsame
 * Bodenregel (Kartenrand, Meer, 40°-Hang). `ignoreCorridor` wie beim Fluss:
 * ein See liegt oft an einer Strasse, und der Uferbewuchs soll dort nicht
 * ersatzlos ausfallen.
 */
function uferBewuchs(el, rand, y, p) {
  var m = rand.length;
  if (!m) return;
  var dichte = clamp(Number.isFinite(p.dichte) ? p.dichte : 1, 0, 3);
  var occ = newOcc(2.2);
  for (var i = 0; i < m; i++) {
    var r = rand[i];
    /* Schluessel aus der BOGENLAENGE, nicht aus dem Schleifenindex: die
       Punktzahl des Uferzuges haengt an der Griffzahl, und ein
       hinzugefuegter Griff wuerde sonst den ganzen Bewuchs umwuerfeln. Die
       Rasterung auf 3 Einheiten ist gerade grob genug, dass benachbarte
       Stuetzpunkte gelegentlich denselben Schluessel teilen — genau das
       verhindert eine gleichmaessige Perlenkette am Ufer. */
    var idx = Math.round(r.s / 3);
    // --- Landseite: nach AUSSEN, ueber der Wasserlinie -------------------
    var rl = ortsRng(idx, 0, el.seed + 421);
    if (rl() < 0.42 * dichte) {
      var dl = rr(rl, 0.4, 4.2);
      var lx = r.x - r.nx * dl, lz = r.z - r.nz * dl;
      var h = tryPlace(occ, lx, lz, 0.6, { ignoreCorridor: true });
      // Nur, was wirklich ueber dem Spiegel liegt — sonst stuende das Schilf
      // im See statt an ihm.
      if (h !== null && h >= y - 0.35) {
        var art = wpick(rl, UFER_LAND);
        var sc = rr(rl, 0.8, 1.5);
        emit(el, art, lx, h, lz, rl() * 6.28, sc, sc * rr(rl, 0.9, 1.6), sc, tintOf(rl));
      }
    }
    // --- Wasserseite: nach INNEN, auf dem Spiegel ------------------------
    var rw = ortsRng(idx, 1, el.seed + 423);
    if (rw() < 0.24 * dichte) {
      var dw = rr(rw, 1.2, 6.5);
      var wx = r.x + r.nx * dw, wz = r.z + r.nz * dw;
      // Nur dort, wo unter dem Spiegel wirklich Wasser steht.
      if (heightAt(wx, wz) < y - 0.15) {
        var wart = wpick(rw, UFER_WASSER);
        var ws = rr(rw, 0.7, 1.3);
        emit(el, wart, wx, y + 0.02, wz, rw() * 6.28, ws, ws, ws, tintOf(rw, 0.06));
      }
    }
  }
}
