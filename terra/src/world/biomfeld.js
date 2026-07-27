/* ==========================================================================
   Biomflaechen (I2) — Biome als FLAECHEN statt als Karteneigenschaft.

   Bis hierher trug eine Karte genau ein Biom (`S.biom`), und `terrainColor`
   loeste daraus EINE Palette auf. Dieses Modul macht daraus ein Feld: Moor,
   Wiese und Karst duerfen nebeneinander liegen.

   Warum ein eigenes Modul und keine Erweiterung von terrain.js:
   terrain.js haengt an THREE, an den Patches und am globalen Zustand — und
   genau deshalb ist dort nichts einzeln pruefbar. Alles, was hier steht, ist
   reine Rechnung auf typisierten Arrays. Hoehe, Hang, Wassernaehe und Abfluss
   kommen als ARGUMENT herein, nie als Import.

   Modulgraph (bewusst flach, gleiche Begruendung wie im Kopf von
   generators/strukturen.js): erlaubt sind core/rng.js und core/store.js.
   NICHT importiert werden terrain.js, dirty.js, areas.js, strukturen.js und
   erosion.js — terrain.js wird dieses Modul importieren, jeder Rueckimport
   waere also ein Zyklus. `inPoly`/`polyBBox` stehen deshalb weiter unten als
   wortgleiche Kopie aus strukturen.js; drei Zeilen Doppelung sind billiger
   als ein Ladezyklus (siehe Runde H, Absturz beim Modulstart).

   Determinismus: kein Math.random. Aller Zufall kommt aus hashi/fractal mit
   dem Weltseed. Die Biomabfrage an einer Position ist eine reine Funktion der
   Position — genWald fragt sie pro Kandidat ab, und die Bestueckung muss
   reproduzierbar bleiben.
   ========================================================================== */
import { clamp, lerp, sstep, DEG, hashi, fractal } from '../core/rng.js';
import { BIOME, WATER } from '../core/store.js';

/* ==========================================================================
   1. Biomindex — stabile Reihenfolge ueber BIOME
   ========================================================================== */

/* Die Reihenfolge ist die Einfuegereihenfolge von BIOME (bei String-
   Schluesseln von der Sprache garantiert). Der Index ist ein LAUFZEITWERT:
   gespeichert wird in Elementen und Karten immer der NAME (`params.biom`).
   Ein neues Biom in der Mitte der Registry verschiebt also Indizes im
   Speicher, aber keine einzige gespeicherte Karte. */
export const BIOM_NAMEN = Object.keys(BIOME);
export const BIOM_ANZAHL = BIOM_NAMEN.length;

/* 255 statt 0: 0 waere `wiese` und damit von "hier liegt eine Wiesenflaeche"
   nicht zu unterscheiden. Ein eigener Wert macht das leere Feld lesbar, auch
   wenn `gewicht === 0` dieselbe Aussage traegt. */
export const BIOM_KEINS = 255;

var _index = (function () {
  var m = Object.create(null);
  for (var i = 0; i < BIOM_NAMEN.length; i++) m[BIOM_NAMEN[i]] = i;
  return m;
})();

/** Name -> Index. Unbekannte Namen ergeben BIOM_KEINS (nie undefined). */
export function biomIndex(name) {
  var i = _index[name];
  return i === undefined ? BIOM_KEINS : i;
}

/** Index -> Name. Ausserhalb des Bereichs: null. */
export function biomName(index) {
  return (index >= 0 && index < BIOM_ANZAHL) ? BIOM_NAMEN[index] : null;
}

/* ==========================================================================
   2. Klimaachse

   Terra hat keinen Breitengrad. Statt einen zu erfinden, wird er zur
   einstellbaren Karteneigenschaft: eine Richtung, in die es kaelter wird,
   und wie stark. Ohne diese Achse liefert die Ableitung konzentrische
   Hoehenringe — huebsch, aber kein Land.
   ========================================================================== */
export const KLIMA_STANDARD = {
  richtung: 0,      // Grad; 0 = "nach Norden (-z) wird es kaelter", 90 = nach Osten
  staerke: 0.5,     // 0..1 Temperaturhub ueber die Kartendiagonale
  grund: 0.5,       // 0..1 Temperatur in der Kartenmitte auf Hoehe 0
  hoeheKuehl: 0.012 // Temperaturabfall je Welteinheit Hoehe (30 Einheiten ~ -0.36)
};

function klimaAufloesen(k) {
  var out = {};
  for (var q in KLIMA_STANDARD) out[q] = KLIMA_STANDARD[q];
  if (k) for (var p in KLIMA_STANDARD) {
    if (typeof k[p] === 'number' && isFinite(k[p])) out[p] = k[p];
  }
  return out;
}

/* ==========================================================================
   3. Polygonwerkzeug (wortgleiche Kopie aus generators/strukturen.js)
   ========================================================================== */

function polyBBox(pts) {
  var b = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  for (var i = 0; i < pts.length; i++) {
    if (pts[i].x < b.x0) b.x0 = pts[i].x;
    if (pts[i].x > b.x1) b.x1 = pts[i].x;
    if (pts[i].z < b.z0) b.z0 = pts[i].z;
    if (pts[i].z > b.z1) b.z1 = pts[i].z;
  }
  return b;
}


/* Bewusst NICHT exportiert: `inPoly` gibt es schon in generators/areas.js,
   und zwei Bezugsquellen fuer dieselbe Funktion sind eine Fehlerquelle. Wer
   sie braucht, holt sie weiter von dort. */

/* ==========================================================================
   4. Ausfransung

   Exakt die Stoeroktave aus terrainColor (world/terrain.js, "Zonengrenzen:
   staerker gestoert"): dieselben Frequenzen 0.09 / 0.22, dieselben
   Seedversaetze 606 / 607, dieselben Gewichte 2.6 / 0.9. Kein zusaetzliches
   Rauschen — die Biomgrenze soll sich genau so brechen wie die Sand- und
   Felsgrenze daneben, sonst liest man zwei verschiedene Handschriften im
   selben Bild.

   Wertebereich: fractal liefert 0..1, also liegt die Summe in [-1.75, +1.75].
   Diese Schranke wird unten gebraucht, um die teure Rauschauswertung auf das
   Grenzband zu beschraenken.
   ========================================================================== */
var STOER_MAX = 2.6 * 0.5 + 0.9 * 0.5;   // 1.75

function stoerung(x, z, seed) {
  return (fractal(x * 0.09, z * 0.09, seed + 606) - 0.5) * 2.6
       + (fractal(x * 0.22, z * 0.22, seed + 607) - 0.5) * 0.9;
}

/* Wie weit die Grenze gegenueber der Polygonkante wandern darf, als Anteil
   von `weich`. 0.30 heisst: bei weich = 8 franst die Kante um bis zu +-4.2
   Welteinheiten aus — deutlich mehr als das Uebergangsband selbst breit ist,
   damit die Polygonkante als GERADE nirgends mehr abzulesen ist. */
var FRANSEN = 0.30;

/* ==========================================================================
   5. Chamfer-Distanztransformation

   Gleiches Verfahren wie die Wasserabstands-Rechnung im Weltgenerator
   (generators/welt.js): zwei Durchgaenge, Gewichte 1 / 1.41421. Der Fehler
   gegenueber der echten euklidischen Distanz liegt unter 4 % — hinter der
   Ausfransung ist davon nichts zu sehen, und es ist O(Zellen) statt
   O(Zellen x Kanten).
   ========================================================================== */
var DIAG = 1.4142135623730951;

/** Abstand jeder Zelle zur naechsten Zelle mit maske[k] === ziel. */
function chamfer(maske, ziel, w, h, out) {
  var i, j, k, d, gross = w + h + 1;
  for (k = 0; k < w * h; k++) out[k] = maske[k] === ziel ? 0 : gross;
  for (j = 0; j < h; j++) {
    for (i = 0; i < w; i++) {
      k = j * w + i; d = out[k];
      if (d === 0) continue;
      if (i > 0 && out[k - 1] + 1 < d) d = out[k - 1] + 1;
      if (j > 0) {
        if (out[k - w] + 1 < d) d = out[k - w] + 1;
        if (i > 0 && out[k - w - 1] + DIAG < d) d = out[k - w - 1] + DIAG;
        if (i < w - 1 && out[k - w + 1] + DIAG < d) d = out[k - w + 1] + DIAG;
      }
      out[k] = d;
    }
  }
  for (j = h - 1; j >= 0; j--) {
    for (i = w - 1; i >= 0; i--) {
      k = j * w + i; d = out[k];
      if (d === 0) continue;
      if (i < w - 1 && out[k + 1] + 1 < d) d = out[k + 1] + 1;
      if (j < h - 1) {
        if (out[k + w] + 1 < d) d = out[k + w] + 1;
        if (i > 0 && out[k + w - 1] + DIAG < d) d = out[k + w - 1] + DIAG;
        if (i < w - 1 && out[k + w + 1] + DIAG < d) d = out[k + w + 1] + DIAG;
      }
      out[k] = d;
    }
  }
  return out;
}

/* ==========================================================================
   6. Rasterung eines Polygons

   Scanline mit GENAU dem Kreuzungskriterium von inPoly — sonst laege die
   abgeleitete Maske anders als die Punktprobe, die genWald/genWiese je
   Kandidat zieht, und ein Baum stuende in einem Biom, dessen Farbe unter ihm
   nicht liegt. Die Scanline spart gegenueber "inPoly je Zelle" den Faktor
   Kantenzahl (bei 1025er Karte und 12 Ecken rund 12 Mio. Rechnungen).
   ========================================================================== */
function rasterePolygon(pts, maske, bi0, bj0, bw, bh, half) {
  var m = pts.length, kreuz = new Float64Array(m), i, j, e, n;
  for (j = 0; j < bh; j++) {
    var z = (bj0 + j) - half;
    n = 0;
    for (e = 0; e < m; e++) {
      var a = pts[e], b = pts[(e + m - 1) % m];
      if ((a.z > z) !== (b.z > z)) kreuz[n++] = (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x;
    }
    if (n < 2) continue;
    // Einfuegesortierung: n ist die Zahl der Kantenschnitte einer Zeile,
    // in aller Regel 2 bis 6. Ein Array.sort je Zeile waere hier reine Allokation.
    for (e = 1; e < n; e++) {
      var v = kreuz[e], q = e - 1;
      while (q >= 0 && kreuz[q] > v) { kreuz[q + 1] = kreuz[q]; q--; }
      kreuz[q + 1] = v;
    }
    var row = j * bw;
    for (e = 0; e + 1 < n; e += 2) {
      // x = i - half, drin ist [kreuz[e], kreuz[e+1])
      var iA = Math.ceil(kreuz[e] + half) - bi0;
      var iB = Math.ceil(kreuz[e + 1] + half) - bi0 - 1;
      if (iA < 0) iA = 0;
      if (iB > bw - 1) iB = bw - 1;
      for (i = iA; i <= iB; i++) maske[row + i] = 1;
    }
  }
}

/* ==========================================================================
   7. Biomfeld ableiten

   Zwei Uint8-Felder statt eines Splat-Blobs:
     feld    Index des dominanten Bioms je Gitterzelle (BIOM_KEINS = keins)
     gewicht 0..255, wie stark das Flaechenbiom gegen das Basisbiom durchschlaegt

   UEBERLAGERUNGSREGEL (dokumentiert, weil sie sichtbar ist):
   Die Flaechen werden in Elementreihenfolge gestempelt, und je Zelle gilt
   `neu >= alt  ->  uebernehmen`. Das ist genau die Regel von stampWear in
   world/terrain.js (dort `if (w > wear[id])`, also Maximum), nur mit >= statt
   >. Folge:
     - Im Kern zweier ueberlappender Flaechen (beide 255) gewinnt die ZULETZT
       gezeichnete — so, wie der Plan es fuer Flaechen vorsieht.
     - Im weichen Saum gewinnt die STAERKERE Deckung. Ohne das wuerde eine
       spaeter gezeichnete, weit entfernte Flaeche mit Gewicht 3 den Kern einer
       frueheren ueberschreiben, sobald ihr Rand darueber streift.
   Das Gewicht ist damit monoton wachsend ueber die Elementliste, wie wear.
   ========================================================================== */

/** Randzugabe in Zellen, die eine Flaeche ueber ihre Bounding-Box hinaus faerbt. */
function randZugabe(weich) {
  return Math.ceil(weich * (0.5 + FRANSEN * STOER_MAX) + 2);
}

/**
 * Beruehrte Gitterbox einer Biomflaeche — fuer den bereichsweisen Neuaufbau.
 * Liefert {i0,i1,j0,j1} in Gitterkoordinaten, bereits auf die Karte geklemmt;
 * i1 < i0 bedeutet "beruehrt die Karte nicht".
 */
export function biomBox(flaeche, VW, MAP) {
  var pts = flaeche.points;
  if (!pts || pts.length < 3) return { i0: 1, i1: 0, j0: 1, j1: 0 };
  var half = MAP * 0.5;
  var r = randZugabe(weichVon(flaeche));
  var bb = polyBBox(pts);
  return {
    i0: clamp(Math.floor(bb.x0 + half) - r, 0, VW - 1),
    i1: clamp(Math.ceil(bb.x1 + half) + r, 0, VW - 1),
    j0: clamp(Math.floor(bb.z0 + half) - r, 0, VW - 1),
    j1: clamp(Math.ceil(bb.z1 + half) + r, 0, VW - 1)
  };
}

function weichVon(fl) {
  var p = fl.params || fl;
  var w = p.weich;
  // 0 ist erlaubt und heisst "Kante ohne Uebergang"; wie randBreite in
  // core/store.js wird daraus ein Winzigwert, damit sstep nicht durch 0 teilt.
  return (typeof w === 'number' && isFinite(w) && w > 0.25) ? w : 0.25;
}

function biomVon(fl) {
  var p = fl.params || fl;
  return biomIndex(p.biom);
}

/**
 * Leitet aus Biomflaechen-Elementen die beiden Gitterfelder ab.
 *
 * @param flaechen  [{ points:[{x,z}], params:{ biom, weich } }] in Zeichenreihenfolge
 * @param VW, MAP   Gittergroesse (VW = MAP + 1) und Kartenkante
 * @param opt       { seed, feld, gewicht, box } — `feld`/`gewicht` werden
 *                  wiederverwendet statt neu belegt; `box` beschraenkt
 *                  Ruecksetzen UND Stempeln auf {i0,i1,j0,j1} (Teilaufbau).
 * @returns { feld, gewicht }
 */
export function biomFeldBauen(flaechen, VW, MAP, opt) {
  opt = opt || {};
  var n = VW * VW;
  var feld = opt.feld && opt.feld.length === n ? opt.feld : new Uint8Array(n);
  var gewicht = opt.gewicht && opt.gewicht.length === n ? opt.gewicht : new Uint8Array(n);
  var seed = (opt.seed | 0);
  var box = opt.box;
  var i0 = box ? clamp(box.i0 | 0, 0, VW - 1) : 0;
  var i1 = box ? clamp(box.i1 | 0, 0, VW - 1) : VW - 1;
  var j0 = box ? clamp(box.j0 | 0, 0, VW - 1) : 0;
  var j1 = box ? clamp(box.j1 | 0, 0, VW - 1) : VW - 1;
  var i, j;
  if (!box) {
    feld.fill(BIOM_KEINS); gewicht.fill(0);
  } else {
    for (j = j0; j <= j1; j++) {
      var r = j * VW;
      for (i = i0; i <= i1; i++) { feld[r + i] = BIOM_KEINS; gewicht[r + i] = 0; }
    }
  }
  if (!flaechen) return { feld: feld, gewicht: gewicht };
  for (var e = 0; e < flaechen.length; e++) {
    var fl = flaechen[e];
    if (!fl || !fl.points || fl.points.length < 3) continue;
    if (fl.kind !== undefined && fl.kind !== 'flaeche') continue;
    if (fl.variant !== undefined && fl.variant !== 'biom') continue;
    var bi = biomVon(fl);
    if (bi === BIOM_KEINS) continue;          // unbekanntes Biom still ueberlesen
    stempleFlaeche(feld, gewicht, VW, MAP, fl.points, bi, weichVon(fl), seed,
      i0, i1, j0, j1);
  }
  return { feld: feld, gewicht: gewicht };
}

function stempleFlaeche(feld, gewicht, VW, MAP, pts, bi, weich, seed, ci0, ci1, cj0, cj1) {
  var half = MAP * 0.5;
  var rand = randZugabe(weich);
  var bb = polyBBox(pts);
  /* Die Arbeitsbox umfasst IMMER das ganze Polygon plus Randzugabe, auch beim
     Teilaufbau. Sie auf die Commit-Box zu beschneiden waere der naheliegende,
     aber falsche Spargedanke: die Distanztransformation misst dann bis zum
     Boxrand statt bis zur Polygonkante, und eine Zelle tief im Inneren bekaeme
     am Boxrand ploetzlich Gewicht 0. Gespart wird stattdessen am SCHREIBEN
     (Fenster unten) und daran, dass eine Flaeche ohne Schnitt mit der
     Commit-Box gar nicht erst gestempelt wird. */
  var bi0 = clamp(Math.floor(bb.x0 + half) - rand, 0, VW - 1);
  var bi1 = clamp(Math.ceil(bb.x1 + half) + rand, 0, VW - 1);
  var bj0 = clamp(Math.floor(bb.z0 + half) - rand, 0, VW - 1);
  var bj1 = clamp(Math.ceil(bb.z1 + half) + rand, 0, VW - 1);
  if (bi1 < bi0 || bj1 < bj0) return;
  if (bi1 < ci0 || bi0 > ci1 || bj1 < cj0 || bj0 > cj1) return;
  var bw = bi1 - bi0 + 1, bh = bj1 - bj0 + 1;

  var maske = new Uint8Array(bw * bh);
  rasterePolygon(pts, maske, bi0, bj0, bw, bh, half);

  // Vorzeichenbehaftete Distanz: innen positiv. Zwei Transformationen, weil
  // eine einzelne nur den Abstand zur Menge kennt, nicht die Seite.
  var dIn = new Float32Array(bw * bh), dOut = new Float32Array(bw * bh);
  chamfer(maske, 0, bw, bh, dIn);    // Abstand zur naechsten Aussenzelle
  chamfer(maske, 1, bw, bh, dOut);   // Abstand zur naechsten Innenzelle

  var hw = weich * 0.5;
  var band = hw + weich * FRANSEN * STOER_MAX;   // ausserhalb ist das Ergebnis konstant
  var wi0 = Math.max(ci0, bi0), wi1 = Math.min(ci1, bi1);
  var wj0 = Math.max(cj0, bj0), wj1 = Math.min(cj1, bj1);
  for (var j = wj0; j <= wj1; j++) {
    var lz = (j - bj0) * bw, gz = j * VW, z = j - half;
    for (var i = wi0; i <= wi1; i++) {
      var lk = lz + (i - bi0);
      var d = maske[lk] ? dIn[lk] : -dOut[lk];
      var g;
      // Der Rauschterm ist der teuerste Teil (2 x fractal = 32 Hashes). Weit
      // innen und weit aussen kann er das Ergebnis nicht mehr kippen — dort
      // wird er gar nicht erst gezogen. Das macht die Ableitung O(Umfang)
      // statt O(Flaeche); bei einer kartengrossen Flaeche ist das der
      // Unterschied zwischen 40 ms und einer halben Sekunde.
      if (d >= band) g = 255;
      else if (d <= -band) continue;
      else {
        var dd = d + stoerung(i - half, z, seed) * weich * FRANSEN;
        g = Math.round(sstep(-hw, hw, dd) * 255);
        if (g === 0) continue;
      }
      var id = gz + i;
      if (g >= gewicht[id]) { gewicht[id] = g; feld[id] = bi; }
    }
  }
}

/* ==========================================================================
   8. Abfrage — reine Funktionen der Position

   Naechster Gitterpunkt, exakt wie wearAt in world/terrain.js. Bewusst KEINE
   bilineare Interpolation: das Feld ist eine Klassenzuordnung, zwischen
   Biom 3 und Biom 17 liegt nicht Biom 10.
   ========================================================================== */

function zellIndex(VW, MAP, x, z) {
  var half = MAP * 0.5;
  var i = clamp(Math.round(x + half), 0, VW - 1) | 0;
  var j = clamp(Math.round(z + half), 0, VW - 1) | 0;
  return j * VW + i;
}

/**
 * Biom an einer Weltposition. `out` ist optional und wird beschrieben statt
 * neu belegt — die Vegetationsgeneratoren rufen das je Kandidat auf.
 * @returns { biom:String|null, index:Number, gewicht:Number 0..1 }
 */
export function biomAn(feld, gewicht, VW, MAP, x, z, out) {
  var id = zellIndex(VW, MAP, x, z);
  var g = gewicht ? gewicht[id] : 0;
  var idx = feld ? feld[id] : BIOM_KEINS;
  if (g === 0 || idx === BIOM_KEINS) { idx = BIOM_KEINS; g = 0; }
  if (!out) out = { biom: null, index: BIOM_KEINS, gewicht: 0 };
  out.index = idx;
  out.biom = idx === BIOM_KEINS ? null : BIOM_NAMEN[idx];
  out.gewicht = g / 255;
  return out;
}

/** Nur der Index — allokationsfrei fuer innere Schleifen. */
export function biomIndexAn(feld, VW, MAP, x, z) {
  return feld ? feld[zellIndex(VW, MAP, x, z)] : BIOM_KEINS;
}

/** Nur das Gewicht, 0..255 — allokationsfrei. */
export function biomGewichtAn(gewicht, VW, MAP, x, z) {
  return gewicht ? gewicht[zellIndex(VW, MAP, x, z)] : 0;
}

/**
 * HARTE Entscheidung fuer die Vegetation. Ein halb verschneiter Bluetenbaum
 * ergibt kein Bild — der Kandidat gehoert entweder zum Flaechenbiom oder zum
 * Basisbiom. Der Saum wird deshalb nicht gemischt, sondern ortsstabil
 * gerastert: `hashi(i, j, seed)` gegen das Gewicht. Das ergibt am Rand eine
 * Streuung statt einer Kante und bleibt eine reine Funktion der Position —
 * genau die Zusage, an der genWald haengt.
 */
export function biomHartAn(feld, gewicht, VW, MAP, x, z, basis, seed) {
  var half = MAP * 0.5;
  var i = clamp(Math.round(x + half), 0, VW - 1) | 0;
  var j = clamp(Math.round(z + half), 0, VW - 1) | 0;
  var id = j * VW + i;
  var g = gewicht ? gewicht[id] : 0;
  var idx = feld ? feld[id] : BIOM_KEINS;
  if (g === 0 || idx === BIOM_KEINS) return basis;
  if (g === 255) return BIOM_NAMEN[idx];
  return hashi(i, j, (seed | 0) + 1301) * 255 < g ? BIOM_NAMEN[idx] : basis;
}

/* ==========================================================================
   9. Mischpalette mit Stufencache

   terrainColor loest heute EINE Palette auf (`BIOME[S.biom].terrain`) und
   liest daraus rund 20 Werte je Vertex. Zwei Paletten je Vertex aufzuloesen
   und Ton fuer Ton zu mischen waere der teuerste Posten der ganzen
   Einfaerbung. Stattdessen: 16 fertige Zwischenpaletten je Biompaar, einmal
   gebaut, danach nur noch nachgeschlagen.

   Warum 16 reichen: das Gewicht liegt auf dem Gitter, und das Gitter hat
   genau EINEN Vertex je Welteinheit. Ein Uebergang der Breite `weich = 8`
   wird also von hoechstens 8 Vertices abgetastet — die Stufung der POSITION
   ist gruober als die der Palette. Dazu kommt die Ausfransung, die den
   Uebergang ohnehin in Zungen und Inseln aufloest. Erst jenseits von
   weich ~ 32 koennte die Stufung theoretisch sichtbar werden; dann ist
   MISCH_STUFEN die einzige Zahl, die zu aendern ist.
   ========================================================================== */
export const MISCH_STUFEN = 16;

/* Werte, die terrainColor einsetzt, wenn ein Biom das Feld nicht traegt
   (siehe Brandungssaum in terrainColor). Sie muessen hier stehen, damit eine
   gemischte Palette VOLLSTAENDIG ist: ein `undefined` in einer Rampe war in
   Runde G schon einmal die Fehlerursache. */
var PALETTE_STANDARD = { brandungA: 0.8, brandungB: 0.3, brandungStaerke: 0.5 };

/* Vereinigung aller Palettenschluessel ueber die gesamte Registry. Ueber die
   Vereinigung und nicht ueber ein einzelnes Biom, damit auch Schluessel
   mitkommen, die nur klippenmeer oder kueste tragen. */
var PALETTE_SCHLUESSEL = (function () {
  var seen = Object.create(null), out = [], i, k;
  for (i = 0; i < BIOM_NAMEN.length; i++) {
    var t = BIOME[BIOM_NAMEN[i]].terrain;
    for (k in t) if (!seen[k]) { seen[k] = 1; out.push(k); }
  }
  for (k in PALETTE_STANDARD) if (!seen[k]) { seen[k] = 1; out.push(k); }
  return out;
})();

function istFarbe(v) {
  return !!v && typeof v.r === 'number' && typeof v.lerp === 'function';
}

function palettenWert(terrain, k) {
  var v = terrain[k];
  if (v !== undefined) return v;
  v = PALETTE_STANDARD[k];
  return v === undefined ? null : v;
}

/**
 * Eine Zwischenpalette. t = 0 ist die Basis, t = 1 die Flaeche.
 *
 * Sonderfaelle, die auftreten UND aussehen muessen:
 *  - oaseFarbe ist in den meisten Biomen `null`. Traegt nur eine Seite eine
 *    Farbe, wird sie unveraendert uebernommen — die Staerke `oase` faehrt von
 *    0 hoch bzw. runter und blendet sie damit ohnehin ein und aus. Ein Lerp
 *    gegen "keine Farbe" gaebe es nicht.
 *  - Fehlende Zahlenfelder (brandungA/B/Staerke) kommen aus PALETTE_STANDARD;
 *    das ist derselbe Wert, den terrainColor heute einsetzt.
 * Ergebnis: jeder Schluessel traegt eine Farbe, eine Zahl oder null — nie
 * undefined.
 */
function baueMischung(bi, fi, t) {
  var A = BIOME[BIOM_NAMEN[bi]].terrain;
  var B = BIOME[BIOM_NAMEN[fi]].terrain;
  var out = {};
  for (var q = 0; q < PALETTE_SCHLUESSEL.length; q++) {
    var k = PALETTE_SCHLUESSEL[q];
    var a = palettenWert(A, k), b = palettenWert(B, k);
    var fa = istFarbe(a), fb = istFarbe(b);
    /* Die Endstufen werden KOPIERT, nicht gemischt. `a + (b - a) * 1` ist in
       Gleitkomma nicht zwangslaeufig b (gemessen: sandB 0.2 wurde zu
       0.19999999999999996). Stufe 0 muss aber bitgenau die Basispalette sein,
       sonst waere die Faerbung ohne jede Biomflaeche nicht mehr identisch mit
       der von heute — und genau das ist die Zusage, an der die
       Byteidentitaet des wiese-Pfads haengt. */
    if (fa && fb) out[k] = t === 0 ? a.clone() : (t === 1 ? b.clone() : a.clone().lerp(b, t));
    else if (fa) out[k] = a.clone();
    else if (fb) out[k] = b.clone();
    else if (typeof a === 'number' && typeof b === 'number') {
      out[k] = t === 0 ? a : (t === 1 ? b : lerp(a, b, t));
    } else if (typeof a === 'number') out[k] = a;
    else if (typeof b === 'number') out[k] = b;
    else out[k] = null;
  }
  return out;
}

var _mischCache = new Map();
var _mischZahl = 0;

/**
 * Gemischte Palette. `basis` und `flaeche` duerfen Name oder Index sein,
 * `stufe` ist 0..MISCH_STUFEN-1 (0 = reine Basis, 15 = reine Flaeche).
 * Das Ergebnis ist ein GETEILTES Objekt — nur lesen, nie schreiben.
 */
export function mischPalette(basis, flaeche, stufe) {
  var bi = typeof basis === 'number' ? basis : biomIndex(basis);
  var fi = typeof flaeche === 'number' ? flaeche : biomIndex(flaeche);
  if (bi === BIOM_KEINS) bi = biomIndex('wiese');
  if (fi === BIOM_KEINS) fi = bi;
  var st = stufe < 0 ? 0 : (stufe > MISCH_STUFEN - 1 ? MISCH_STUFEN - 1 : stufe | 0);
  var key = bi * 256 + fi;
  var reihe = _mischCache.get(key);
  if (reihe === undefined) { reihe = new Array(MISCH_STUFEN); _mischCache.set(key, reihe); }
  var p = reihe[st];
  if (p !== undefined) return p;
  p = baueMischung(bi, fi, st / (MISCH_STUFEN - 1));
  reihe[st] = p; _mischZahl++;
  return p;
}

/** Gewicht 0..255 -> Mischstufe 0..15. */
export function mischStufe(g) {
  return (g * (MISCH_STUFEN - 1) / 255 + 0.5) | 0;
}

/**
 * Cache verwerfen. Pflicht bei jedem Commit, der Biomflaechen beruehrt, und
 * bei jedem Biomwechsel der Karte — die Paletten selbst sind zwar konstant,
 * aber der Cache waechst sonst ueber alle je benutzten Paare (25 x 25 x 16 =
 * 10 000 Objekte) und haelt Farben aus geloeschten Flaechen fest.
 */
export function cacheLeeren() { _mischCache.clear(); _mischZahl = 0; }

/** Zahl der gebauten Zwischenpaletten — nur fuer Messungen und Pruefungen. */
export function mischCacheGroesse() { return _mischZahl; }

/* ==========================================================================
   10. Biom-Ableitung: Vorschlag statt Vorschrift

   Eingaben sind Felder, keine Importe: Hoehe zwingend, Hang / Wasserabstand /
   Abfluss optional. Fehlt der Abfluss (erosion.js liegt in anderer Hand),
   wird die Feuchte aus Wassernaehe, Tieflage und einer sehr langsamen
   Rauschoktave geschaetzt.

   Die Oktave ist ausdruecklich KEIN Widerspruch zur Regel "kein zusaetzliches
   Rauschen" — die galt der Ausfransung der Grenzen. Hier ersetzt sie Luv und
   Lee, die Terra nicht kennt; ohne sie zerfaellt die Karte in konzentrische
   Hoehenringe.
   ========================================================================== */

/* Steilhang-Schwellen als cos der Neigung, in derselben Schreibweise wie
   COS50/COS58 in terrainColor. */
var COS45 = Math.cos(45 * DEG);
var COS22 = Math.cos(22 * DEG);

/* Bewusst NICHT vorgeschlagen: vulkan, aschebrache und pilzwald. Die drei
   folgen keinem Klima — ein Aschekegel steht dort, wo die Kunstrichtung ihn
   hinsetzt. Sie aus Feuchte und Temperatur "abzuleiten" waere eine Erfindung,
   die der Bearbeiter danach ueberall wieder wegraeumen muesste. Sie bleiben
   von Hand zu malen. */

/**
 * Zuordnung Feuchte x Temperatur x Relief auf Terras Registry.
 * h = Hoehe, ny = cos der Hangneigung, f = Feuchte 0..1, t = Temperatur 0..1,
 * kn = Kuestennaehe 0..1.
 */
function klassifiziere(h, ny, f, t, kn) {
  /* --- unter und an der Wasserlinie ------------------------------------
     Der Seegrund traegt eine eigene Palette; ihn ohne Biom zu lassen hiesse,
     die halbe Karte dem Basisbiom zu ueberlassen. */
  if (h < WATER - 5) return 'meer';
  if (h < WATER + 0.5) {
    if (t > 0.68 && f > 0.35) return 'korallenbank';
    if (t > 0.50 && f > 0.60) return 'mangrove';
    return 'kueste';
  }
  /* --- Steilhang: das Gestein schlaegt das Klima ------------------------
     Aber nicht die Kaelte — eine Wand auf 25 Einheiten Hoehe im kalten Norden
     ist vereist, nicht verkarstet. */
  if (ny < COS45) {
    if (t < 0.20) return 'eis';
    if (t < 0.36) return 'hochland';
    if (kn > 0.5) return t > 0.55 ? 'kreide' : 'klippenmeer';
    if (f > 0.66) return 'nebelwald';
    return 'karst';
  }
  /* --- kaltes Land ----------------------------------------------------- */
  if (t < 0.16) return 'eis';
  if (t < 0.30) return f > 0.55 ? 'moor' : 'tundra';
  if (t < 0.42) return f > 0.70 ? 'moor' : (f > 0.45 ? 'schnee' : 'hochland');
  /* --- gemaessigt bis heiss, nach Feuchte -------------------------------
     Die Reihenfolge nass -> trocken ist Absicht: Feuchte entscheidet in
     Terras Palettensatz staerker ueber das Bild als Waerme. */
  if (f > 0.80) return t > 0.70 ? 'regenwald' : 'sumpf';
  if (f > 0.62) return t > 0.72 ? 'bambuswald' : (h > 12 ? 'nebelwald' : 'bluetental');
  if (f > 0.42) {
    if (t > 0.78) return 'bambuswald';
    return ny < COS22 ? 'terrassen' : 'wiese';   // gestufte Haenge = bebaut
  }
  if (f > 0.24) return t > 0.72 ? 'steppe' : 'wiese';
  if (t > 0.62) return h < WATER + 3 ? 'salzwueste' : 'wueste';
  return 'steppe';
}

/** Hangfeld (cos der Neigung) aus dem Hoehenfeld — wie slopeAt, aber am Stueck. */
function hangAus(hoehe, VW, out) {
  for (var j = 0; j < VW; j++) {
    var jm = (j > 0 ? j - 1 : 0) * VW, jp = (j < VW - 1 ? j + 1 : VW - 1) * VW, jr = j * VW;
    for (var i = 0; i < VW; i++) {
      var im = i > 0 ? i - 1 : 0, ip = i < VW - 1 ? i + 1 : VW - 1;
      var nx = (hoehe[jr + im] - hoehe[jr + ip]) * 0.5;
      var nz = (hoehe[jm + i] - hoehe[jp + i]) * 0.5;
      out[jr + i] = 1 / Math.sqrt(nx * nx + 1 + nz * nz);
    }
  }
  return out;
}

/** Wasserabstand in Welteinheiten, falls der Aufrufer keinen mitbringt. */
function wasserAbstandAus(hoehe, VW, out) {
  var n = VW * VW, m = new Uint8Array(n);
  for (var k = 0; k < n; k++) m[k] = hoehe[k] < WATER ? 1 : 0;
  return chamfer(m, 1, VW, VW, out);
}

/**
 * Mehrheitsfilter 3x3, mehrfach. Ohne ihn liefert die Klassifikation
 * Tausende einzelner Sprenkel an jeder Schwelle, und die Randverfolgung
 * danach ebenso viele Polygone. Der Filter ist die eigentliche Ursache
 * dafuer, dass am Ende Dutzende und nicht Zehntausende Gebiete stehen.
 */
function mehrheit(klass, VW, durchgaenge, tmp) {
  var zaehl = new Uint16Array(256);
  for (var d = 0; d < durchgaenge; d++) {
    for (var j = 0; j < VW; j++) {
      var jm = (j > 0 ? j - 1 : 0) * VW, jp = (j < VW - 1 ? j + 1 : VW - 1) * VW, jr = j * VW;
      for (var i = 0; i < VW; i++) {
        var im = i > 0 ? i - 1 : 0, ip = i < VW - 1 ? i + 1 : VW - 1;
        var a0 = klass[jm + im], a1 = klass[jm + i], a2 = klass[jm + ip];
        var a3 = klass[jr + im], a4 = klass[jr + i], a5 = klass[jr + ip];
        var a6 = klass[jp + im], a7 = klass[jp + i], a8 = klass[jp + ip];
        zaehl[a0]++; zaehl[a1]++; zaehl[a2]++; zaehl[a3]++; zaehl[a4]++;
        zaehl[a5]++; zaehl[a6]++; zaehl[a7]++; zaehl[a8]++;
        // Gleichstand geht an die Mittelzelle — sonst wandern Grenzen mit
        // jedem Durchgang in die Richtung des kleineren Index.
        var best = a4, bz = zaehl[a4];
        if (zaehl[a0] > bz) { best = a0; bz = zaehl[a0]; }
        if (zaehl[a1] > bz) { best = a1; bz = zaehl[a1]; }
        if (zaehl[a2] > bz) { best = a2; bz = zaehl[a2]; }
        if (zaehl[a3] > bz) { best = a3; bz = zaehl[a3]; }
        if (zaehl[a5] > bz) { best = a5; bz = zaehl[a5]; }
        if (zaehl[a6] > bz) { best = a6; bz = zaehl[a6]; }
        if (zaehl[a7] > bz) { best = a7; bz = zaehl[a7]; }
        if (zaehl[a8] > bz) { best = a8; bz = zaehl[a8]; }
        tmp[jr + i] = best;
        zaehl[a0] = 0; zaehl[a1] = 0; zaehl[a2] = 0; zaehl[a3] = 0; zaehl[a4] = 0;
        zaehl[a5] = 0; zaehl[a6] = 0; zaehl[a7] = 0; zaehl[a8] = 0;
      }
    }
    klass.set(tmp);
  }
  return klass;
}

/* ==========================================================================
   11. Raster -> Gebiet -> Polygon

   Der anspruchsvollste Schritt. Das Ergebnis der Ableitung darf keine
   Pixelmaske sein, sondern muss ein ganz normales Element sein, das man
   verschieben, verkleinern und umfaerben kann. Drei Stufen:

     a) Zusammenhangskomponenten (4-Nachbarschaft, iterativer Flood-Fill).
        Zu kleine Gebiete fallen weg — sie waeren als Element unbrauchbar.
     b) Randverfolgung (Moore-Nachbarschaft mit Jacobs Abbruchkriterium)
        liefert den geschlossenen Rand in Zellkoordinaten.
     c) Douglas-Peucker mit wachsender Toleranz, bis die Punktzahl unter
        ZIEL_PUNKTE liegt UND der Rand sich nicht selbst schneidet.

   ZIEL_PUNKTE = 32. Begruendung: der Weltgenerator (generators/welt.js,
   `umriss(..., ri(rs, 8, 12), ...)`) legt seine Waelder und Viertel mit 6 bis
   12 Punkten an — das ist die Hausgroesse, die der Editor als bearbeitbar
   vorfuehrt. Eine Biomregion ist verzweigter als ein Waldfleck, deshalb das
   knapp Dreifache. Nach oben begrenzen zwei harte Gruende: jeder Punkt ist im
   Editor ein Griff (jenseits von ~50 ueberlappen sie sich bei ueblicher
   Zoomstufe), und inPoly ist O(Punkte) und laeuft in genWald je Kandidat —
   bei 10^4 bis 10^5 Kandidaten sind 32 Kanten bezahlbar, 4000 nicht.
   ========================================================================== */
export const ZIEL_PUNKTE = 32;

/** Komponenten gleicher Klasse, 4-Nachbarschaft. Liefert Label + Groessen. */
function komponenten(klass, VW, label) {
  var n = VW * VW, stapel = new Int32Array(n), groessen = [], id = 0;
  label.fill(-1);
  for (var start = 0; start < n; start++) {
    if (label[start] >= 0) continue;
    var kl = klass[start], sp = 0, zahl = 0;
    stapel[sp++] = start; label[start] = id;
    while (sp > 0) {
      var k = stapel[--sp]; zahl++;
      var i = k % VW, j = (k - i) / VW;
      if (i > 0 && label[k - 1] < 0 && klass[k - 1] === kl) { label[k - 1] = id; stapel[sp++] = k - 1; }
      if (i < VW - 1 && label[k + 1] < 0 && klass[k + 1] === kl) { label[k + 1] = id; stapel[sp++] = k + 1; }
      if (j > 0 && label[k - VW] < 0 && klass[k - VW] === kl) { label[k - VW] = id; stapel[sp++] = k - VW; }
      if (j < VW - 1 && label[k + VW] < 0 && klass[k + VW] === kl) { label[k + VW] = id; stapel[sp++] = k + VW; }
    }
    groessen.push(zahl); id++;
  }
  return groessen;
}

/**
 * Randverfolgung einer Komponente ENTLANG DER ZELLKANTEN ("crack following"),
 * nicht ueber die Randzellen selbst.
 *
 * Warum nicht Moore-Nachbarschaft: die ist zwar in drei Zeilen geschrieben,
 * terminiert aber nicht zuverlaessig. Gemessen an einer 43 000 Zellen grossen
 * Kuestenregion (1025er Karte) lief sie in den Notausstieg bei 350 000
 * Schritten — Jacobs Kriterium wurde nie erreicht, weil die Verfolgung in
 * einen Zyklus geriet, der die Startzelle nicht enthaelt. Das war der teuerste
 * Posten der ganzen Ableitung (3,3 s von 3,5 s).
 *
 * Die Kantenverfolgung hat das Problem prinzipiell nicht: die Abbildung
 * (Ecke, Richtung) -> (Ecke, Richtung) ist eine Permutation der gerichteten
 * Kanten, also umkehrbar. Wer von einem Zustand losgeht, MUSS zu ihm
 * zurueckkommen, und zwar ohne Umweg. Laufzeit O(Umfang), nicht O(Flaeche).
 *
 * Konvention: das Gebiet liegt rechts, der Umlauf ist im Bildsinn
 * (x rechts, z nach unten) rechtsherum. Bei der Diagonalen wird nach links
 * abgebogen — das entspricht 4-Nachbarschaft im Gebiet, genau der, mit der
 * komponenten() gelabelt hat.
 *
 * Ergebnis: Eckkoordinaten (cx, cz), kodiert als cz * (VW+1) + cx. Loecher
 * werden nicht verfolgt — Terra-Elemente kennen keine Loecher; ein
 * eingeschlossenes anderes Biom wird als eigenes Element DARUEBER gezeichnet,
 * was dank der Ueberlagerungsregel dasselbe Bild ergibt.
 */
function randVerfolgen(label, VW, id, startK, maxSchritte) {
  var si = startK % VW, sj = (startK - si) / VW;
  var CW = VW + 1;                       // Ecken je Zeile
  function drin(i, j) {
    return i >= 0 && j >= 0 && i < VW && j < VW && label[j * VW + i] === id;
  }
  /* Startzustand: die Startzelle ist die erste ihrer Komponente in
     Zeilenordnung, also ist die Zelle darueber aussen. Die Kante von (si,sj)
     nach rechts hat damit das Gebiet unter sich — Richtung 0. */
  var cx = si, cz = sj, d = 0;
  var sx = cx, sz = cz, sd = d;
  var out = [];
  for (var schritt = 0; schritt < maxSchritte; schritt++) {
    out.push(cz * CW + cx);
    if (d === 0) cx++; else if (d === 1) cz++; else if (d === 2) cx--; else cz--;
    // Die vier Zellen um die erreichte Ecke.
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

/** Abstand Punkt->Strecke, quadriert. */
function distSeg2(px, pz, ax, az, bx, bz) {
  var dx = bx - ax, dz = bz - az;
  var l2 = dx * dx + dz * dz;
  var t = l2 > 0 ? clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1) : 0;
  var qx = ax + dx * t - px, qz = az + dz * t - pz;
  return qx * qx + qz * qz;
}

/** Douglas-Peucker auf einem offenen Zug, iterativ (kein Rekursionslimit). */
function dpZug(pts, a, b, tol2, behalten) {
  var stapel = [a, b];
  while (stapel.length) {
    var e = stapel.pop(), s = stapel.pop();
    if (e - s < 2) continue;
    var ax = pts[s].x, az = pts[s].z, bx = pts[e].x, bz = pts[e].z;
    var best = -1, bd = tol2;
    for (var i = s + 1; i < e; i++) {
      var d = distSeg2(pts[i].x, pts[i].z, ax, az, bx, bz);
      if (d > bd) { bd = d; best = i; }
    }
    if (best < 0) continue;
    behalten[best] = 1;
    stapel.push(s, best, best, e);
  }
}

/** Douglas-Peucker auf einem GESCHLOSSENEN Rand. */
function vereinfache(pts, tol) {
  var n = pts.length;
  if (n < 4) return pts.slice();
  // Zwei Anker: Punkt 0 und der von ihm entfernteste. Ohne den zweiten Anker
  // wuerde der Zug 0..0 sofort kollabieren.
  var fern = 0, fd = -1;
  for (var i = 1; i < n; i++) {
    var dx = pts[i].x - pts[0].x, dz = pts[i].z - pts[0].z;
    var d = dx * dx + dz * dz;
    if (d > fd) { fd = d; fern = i; }
  }
  var behalten = new Uint8Array(n);
  behalten[0] = 1; behalten[fern] = 1;
  var tol2 = tol * tol;
  dpZug(pts, 0, fern, tol2, behalten);
  // zweiter Halbbogen: fern..n-1..0 — als offener Zug mit angehaengtem Punkt 0
  var zwei = pts.slice(fern).concat([pts[0]]);
  var b2 = new Uint8Array(zwei.length);
  b2[0] = 1; b2[zwei.length - 1] = 1;
  dpZug(zwei, 0, zwei.length - 1, tol2, b2);
  for (i = 1; i < zwei.length - 1; i++) if (b2[i]) behalten[fern + i] = 1;
  var out = [];
  for (i = 0; i < n; i++) if (behalten[i]) out.push(pts[i]);
  return out;
}

function segSchnitt(a, b, c, d) {
  function kreuz(o, p, q) { return (p.x - o.x) * (q.z - o.z) - (p.z - o.z) * (q.x - o.x); }
  var d1 = kreuz(c, d, a), d2 = kreuz(c, d, b), d3 = kreuz(a, b, c), d4 = kreuz(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
         ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** Echter Selbstschnitt (nicht: gemeinsamer Endpunkt benachbarter Kanten). */
export function selbstSchnitt(pts) {
  var n = pts.length;
  for (var i = 0; i < n; i++) {
    var a = pts[i], b = pts[(i + 1) % n];
    for (var j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segSchnitt(a, b, pts[j], pts[(j + 1) % n])) return true;
    }
  }
  return false;
}

/**
 * Rand -> bearbeitbares Polygon. Die Toleranz waechst, bis die Punktzahl
 * passt und der Rand schnittfrei ist; der letzte schnittfreie Stand wird
 * behalten. Warum ueberhaupt gesucht wird: Douglas-Peucker kann aus einem
 * schnittfreien Rand einen sich kreuzenden machen (zwei Zungen, die dicht
 * aneinander liegen, werden zu zwei Sehnen), und ein sich selbst schneidendes
 * Polygon macht inPoly zur Loterie.
 */
/**
 * Gleitender Mittelwert ueber den geschlossenen Rand. Er rundet die Fjorde
 * weg, die die Rasterklassifikation an jeder Schwelle hinterlaesst.
 *
 * Nicht Kosmetik, sondern die Voraussetzung dafuer, dass Douglas-Peucker
 * ueberhaupt grob werden darf: zwei fast beruehrende Zungen werden bei
 * wachsender Toleranz zu zwei sich kreuzenden Sehnen, die Vereinfachung
 * bricht dort ab und liefert ein Polygon mit dreistelliger Punktzahl
 * (gemessen: 80 statt 24). Nach der Glaettung sind die Zungen weg, bevor die
 * Toleranz sie erreicht.
 */
function randGlaetten(pts, w) {
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

function zuPolygon(rand, VW, half, ziel) {
  var CW = VW + 1, pts = [], k;
  for (k = 0; k < rand.length; k++) {
    var i = rand[k] % CW, j = (rand[k] - i) / CW;
    // Ecke (i,j) liegt zwischen den Zellmitten, daher der halbe Zellversatz.
    pts.push({ x: i - half - 0.5, z: j - half - 0.5 });
  }
  while (pts.length > 1 && pts[pts.length - 1].x === pts[0].x && pts[pts.length - 1].z === pts[0].z) pts.pop();
  if (pts.length < 3) return null;
  /* Fensterbreite am Umfang bemessen, nicht an der Kartengroesse: ein grosses
     Gebiet vertraegt (und braucht) mehr Glaettung als ein kleines, und der
     Unterschied zwischen beiden ist ihre Randlaenge. Der Deckel von 64 ist
     der Wert, der die Messung gedreht hat — mit 24 blieb auf der 1025er Karte
     ein Kuestengebiet bei 75 Punkten haengen, mit 64 sind es 35. */
  pts = randGlaetten(pts, clamp(Math.round(pts.length / 40), 2, 64));
  /* Aufsteigende Toleranz, bis die Punktzahl passt. Behalten wird der
     schnittfreie Stand mit den WENIGSTEN Punkten — nicht einfach der letzte:
     bei zerfransten Kuestenregionen schneidet sich der Rand ab einer gewissen
     Toleranz wieder, und der letzte schnittfreie Stand ist dann der mit den
     meisten Punkten (gemessen: 112 statt 24). */
  var bester = null;
  for (var tol = 1.0, versuch = 0; versuch < 16; versuch++, tol *= 1.6) {
    var v = vereinfache(pts, tol);
    if (v.length < 3) break;
    if (selbstSchnitt(v)) continue;
    if (!bester || v.length < bester.length) bester = v;
    if (v.length <= ziel) return v;
  }
  return bester;
}

/**
 * Erzeugt Biomflaechen-Vorschlaege aus dem Gelaende.
 *
 * @param felder { hoehe:Float32Array (Pflicht), hang?, wasserAbstand?, abfluss? }
 *               Alle in Gitterordnung, Laenge VW*VW. `abfluss` kommt aus
 *               world/erosion.js, ist aber optional — fehlt er, wird die
 *               Feuchte geschaetzt.
 * @param opt    { seed, klima, minFlaeche, zielPunkte, glaetten, maxGebiete }
 * @returns [{ biom:String, points:[{x,z}], zellen:Number }] — fertige
 *          Elementbaeuche; der Aufrufer haengt kind/variant/params/seed an.
 */
export function biomeVorschlagen(felder, VW, MAP, opt) {
  opt = opt || {};
  var hoehe = felder.hoehe;
  if (!hoehe || hoehe.length !== VW * VW) return [];
  var n = VW * VW, half = MAP * 0.5, seed = opt.seed | 0;
  var klima = klimaAufloesen(opt.klima);
  var ziel = opt.zielPunkte || ZIEL_PUNKTE;
  // 0.4 % der Karte: bei 257 rund 16x16 Zellen, bei 1025 rund 65x65. Kleiner
  // waere als Element nicht mehr sinnvoll zu greifen.
  var minFlaeche = opt.minFlaeche || Math.max(64, Math.round(n * 0.004));
  var glaetten = opt.glaetten === undefined ? 2 : (opt.glaetten | 0);

  var hang = felder.hang && felder.hang.length === n ? felder.hang : hangAus(hoehe, VW, new Float32Array(n));
  var wass = felder.wasserAbstand && felder.wasserAbstand.length === n
    ? felder.wasserAbstand : wasserAbstandAus(hoehe, VW, new Float32Array(n));

  // Abflussnormierung: die Verteilung ist extrem schief (ein Hauptlauf traegt
  // Groessenordnungen mehr als jede Hangrinne), deshalb logarithmisch gegen
  // das gemessene Maximum. Ohne Abfluss faellt der Term ganz weg.
  var abfluss = felder.abfluss && felder.abfluss.length === n ? felder.abfluss : null;
  var logRef = 1;
  if (abfluss) {
    var amax = 0;
    for (var q = 0; q < n; q++) if (abfluss[q] > amax) amax = abfluss[q];
    logRef = Math.log(1 + amax) || 1;
  }

  var a = klima.richtung * DEG;
  var ax = Math.sin(a), az = -Math.cos(a);       // Einheitsvektor "Richtung kaelter"
  var diag = MAP * 0.7071 || 1;

  var klass = new Uint8Array(n);
  for (var j = 0; j < VW; j++) {
    var z = j - half, jr = j * VW;
    for (var i = 0; i < VW; i++) {
      var id = jr + i, x = i - half;
      var h = hoehe[id];
      // Feuchte: Wassernaehe + Tieflage + Luv/Lee-Oktave, dazu der Abfluss,
      // wenn die Erosion einen liefert.
      var wn = 1 - sstep(0, 60, wass[id]);
      var f = wn * 0.45 + sstep(16, 0, h) * 0.30
            + (fractal(x * 0.006, z * 0.006, seed + 1201) - 0.5) * 0.55 + 0.20;
      if (abfluss) f = f * 0.55 + clamp(Math.log(1 + abfluss[id]) / logRef, 0, 1) * 0.45;
      f = clamp(f, 0, 1);
      // Temperatur: Grundwert, Klimaachse, Hoehenabnahme.
      var proj = (x * ax + z * az) / diag;
      var t = clamp(klima.grund - proj * klima.staerke * 0.5
        - Math.max(0, h) * klima.hoeheKuehl, 0, 1);
      var kn = 1 - sstep(0, 12, wass[id]);
      klass[id] = biomIndex(klassifiziere(h, hang[id], f, t, kn));
    }
  }

  if (glaetten > 0) mehrheit(klass, VW, glaetten, new Uint8Array(n));

  var label = new Int32Array(n);
  var groessen = komponenten(klass, VW, label);
  // Startzelle je Komponente = erste in Zeilenordnung. Genau die braucht die
  // Randverfolgung (links davon liegt garantiert Hintergrund).
  var start = new Int32Array(groessen.length).fill(-1);
  for (var k = 0; k < n; k++) { var L = label[k]; if (start[L] < 0) start[L] = k; }

  var out = [];
  for (var g = 0; g < groessen.length; g++) {
    if (groessen[g] < minFlaeche) continue;
    // Der Umfang einer Komponente aus A Zellen liegt unter 2A + 4 Kanten;
    // 4A + 16 ist eine Reissleine, keine erwartete Groesse.
    var rand = randVerfolgen(label, VW, g, start[g], groessen[g] * 4 + 16);
    if (rand.length < 4) continue;
    var poly = zuPolygon(rand, VW, half, ziel);
    if (!poly || poly.length < 3) continue;
    out.push({ biom: BIOM_NAMEN[klass[start[g]]], points: poly, zellen: groessen[g] });
  }
  // Groesste zuerst: die Ueberlagerungsregel laesst die spaeter gezeichnete
  // gewinnen, also gehoeren die kleinen, spezielleren Gebiete nach hinten.
  out.sort(function (p, r) { return r.zellen - p.zellen; });
  if (opt.maxGebiete && out.length > opt.maxGebiete) out.length = opt.maxGebiete;
  return out;
}

/* ==========================================================================
   12. Biom-LUT fuer Schnee und Partikel

   Heute sind Schneeauflage, Kuehle, Bruch und Partikelstaerke globale
   Uniforms (render/materials.js: uSchneeAuflage, uSchneeKuehle, uSchneeBruch).
   Mit Biomflaechen muessen sie ortsabhaengig werden. Statt vier weiterer
   Texturen: EINE kleine Nachschlagetabelle, Zeile = Biomindex.

   Format (Standard, spalten = 4):
     Float32Array der Laenge BIOM_ANZAHL * 4, Zeile r beginnt bei r*4.
       [0] schneeAuflage   0..1   (BIOME[x].schnee.auflage, sonst 0)
       [1] kuehle          0..1   (schnee.kuehle, sonst 0)
       [2] bruch           0..1   (schnee.bruch, sonst 0)
       [3] partikelStaerke 0..1   (vfx.dichte, sonst 0)
     Als Textur: THREE.DataTexture(daten, 1, BIOM_ANZAHL, RGBAFormat,
     FloatType), NearestFilter, keine Mipmaps, colorSpace NoColorSpace.
     Nachschlagen im Shader: texture2D(uBiomLut, vec2(0.5, (index+0.5)/N)).

   Erweiterung (spalten = 8, zwei RGBA-Texel je Zeile, Breite 2):
       [4] schneeKanteA    (schnee.kante[0], sonst 0.20)
       [5] schneeKanteB    (schnee.kante[1], sonst 0.70)
       [6] schneeHoeheA    (schnee.hoehe[0], sonst -99)
       [7] schneeHoeheB    (schnee.hoehe[1], sonst -98)
     Die Standardwerte sind exakt die Uniform-Vorgaben aus materials.js — der
     Schnee-Patch liest damit fuer ein Biom ohne `schnee`-Block dieselben
     Zahlen wie heute.

   Nicht enthalten: schnee.farbe und vfx.farbe. Beide sind Farben, keine
   Staerken; sie gehoerten in eine zweite LUT oder in dieselbe mit acht
   weiteren Spalten. Bewusst offen gelassen, weil der Shader-Eingriff nicht
   mein Auftrag ist und die Zeile sonst Werte traegt, die niemand liest.
   ========================================================================== */
export function biomLutDaten(opt) {
  var spalten = (opt && opt.spalten === 8) ? 8 : 4;
  var out = new Float32Array(BIOM_ANZAHL * spalten);
  for (var i = 0; i < BIOM_ANZAHL; i++) {
    var b = BIOME[BIOM_NAMEN[i]];
    var sn = b.schnee || null, vf = b.vfx || null;
    var r = i * spalten;
    out[r] = sn && typeof sn.auflage === 'number' ? sn.auflage : 0;
    out[r + 1] = sn && typeof sn.kuehle === 'number' ? sn.kuehle : 0;
    out[r + 2] = sn && typeof sn.bruch === 'number' ? sn.bruch : 0;
    out[r + 3] = vf && typeof vf.dichte === 'number' ? vf.dichte : 0;
    if (spalten === 8) {
      out[r + 4] = sn && sn.kante ? sn.kante[0] : 0.20;
      out[r + 5] = sn && sn.kante ? sn.kante[1] : 0.70;
      out[r + 6] = sn && sn.hoehe ? sn.hoehe[0] : -99;
      out[r + 7] = sn && sn.hoehe ? sn.hoehe[1] : -98;
    }
  }
  return out;
}

/** Beschreibung der LUT fuer den, der die DataTexture baut. */
export function biomLutFormat(opt) {
  var spalten = (opt && opt.spalten === 8) ? 8 : 4;
  return {
    zeilen: BIOM_ANZAHL,
    spalten: spalten,
    breite: spalten / 4,              // RGBA-Texel je Zeile
    hoehe: BIOM_ANZAHL,
    namen: spalten === 8
      ? ['schneeAuflage', 'kuehle', 'bruch', 'partikelStaerke',
         'schneeKanteA', 'schneeKanteB', 'schneeHoeheA', 'schneeHoeheB']
      : ['schneeAuflage', 'kuehle', 'bruch', 'partikelStaerke'],
    reihenfolge: BIOM_NAMEN
  };
}
