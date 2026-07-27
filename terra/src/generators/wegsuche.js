// Wegfindung (A2): aus zwei Punkten wird ein Weg, der gewachsen aussieht.
//
// A*-Suche auf dem Hoehenfeld. Der Weg entsteht NICHT als Geometrie, sondern
// als Punktliste — genau das, was ein Pfad-Element als `points` braucht. Die
// Bandgeometrie samt Bruecken baut danach bandAusLinie (paths.js) von selbst.
//
// Alles hier ist rein lesend: heightAt/inCorridor (world/terrain.js) und die
// Konstanten aus core/store.js. Kein Math.random — die Suche ist ohnehin
// vollstaendig determiniert (gleiches Hoehenfeld + gleiche Endpunkte + gleiche
// Optionen ⇒ gleicher Weg), es wird kein einziger Zufallswert gezogen.
import { clamp } from '../core/rng.js';
// KARTE statt MAP/HALF: die Kartengroesse ist seit H1b ein Laufzeitwert und
// darf nie beim Modulstart in eine eigene Konstante kopiert werden.
import { KARTE, WATER, COS40 } from '../core/store.js';
import { heightAt, inCorridor } from '../world/terrain.js';

/* ==========================================================================
   Kostenmodell

   Grundkosten sind die zurueckgelegte Strecke in Welteinheiten. Alles andere
   ist ein FAKTOR darauf, damit die Heuristik zulaessig bleibt (siehe unten):

     Steigung    quadratisch in tan(Winkel), normiert auf die 40°-Grenze, die
                 auch tryPlace/rankePlatzierbar als "unbebaubar" ziehen (COS40
                 in core/store.js — TAN40 unten ist daraus abgeleitet, damit
                 die Grenze mit ihr wandert, falls sie je bewegt wird).
                 Bei 15° liegt der Aufschlag bei rund 10 % von `steigung`
                 (0.268/0.839)² = 0.102 — spuerbar, aber begehbar; bei 40° beim
                 vollen Wert, darueber kommt `sperre` dazu und der Weg macht
                 lieber einen weiten Bogen. Bewusst kein hartes Infinity:
                 eine Karte kann einen Sattel haben, der NUR ueber 40° zu
                 erreichen ist — dann soll die Suche ihn nehmen und nicht
                 scheitern.

                 Gemessen wird die Steigung ENTLANG DER KANTE, nicht die
                 Hangneigung am Ort (slopeAt). Genau daraus entstehen
                 Serpentinen: quer zum Hang ist die Kante flach und billig,
                 gerade bergauf teuer — der Weg legt sich von selbst in die
                 Hoehenlinie.

     Wasser      teuer, aber moeglich. Eine Querung bleibt eine Querung: der
                 Aufschlag gilt je Laengeneinheit, ein breiter Fluss kostet
                 also mehr als ein schmaler. Die Steigungsstrafe entfaellt im
                 Wasser — unter dem Spiegel beschreibt das Gefaelle die
                 Beckenwand, keine Fahrbahn (gleiche Begruendung wie in
                 tryPlaceWasser, objects.js).

     Korridor    vorhandene Wege sind billiger, Wege buendeln sich. Gelesen
                 wird die Korridormaske aus terrain.js (inCorridor). WICHTIG:
                 sie wird erst beim Commit gefuellt — wer waehrend einer
                 Erzeugung mehrere Wege hintereinander sucht (generators/
                 welt.js), reicht seine eigene, vorlaeufige Maske als
                 `opt.bonus` herein.

     Rand        gesperrt: der Kartenrand faellt bei jedem Biom ab, ein Weg
                 dorthin endet im Nichts.
   ========================================================================== */

// tan(40°) aus COS40 abgeleitet statt neu hingeschrieben — eine Grenze, eine
// Quelle. sin = sqrt(1 - cos²) ist hier gefahrlos, COS40 liegt weit von 0/1.
var TAN40 = Math.sqrt(1 - COS40 * COS40) / COS40;

var WEG_STANDARD = {
  schritt: 2,          // Gitterweite der Knoten in Welteinheiten
  steigung: 9,         // Faktor der quadratischen Steigungsstrafe bei genau 40°
  sperre: 260,         // zusaetzlicher Faktor jenseits von 40° ("praktisch gesperrt")
  wasser: 24,          // Aufschlag je Laengeneinheit Wasserquerung
  korridor: 0.55,      // Kostenfaktor auf vorhandenen Wegen (< 1 = billiger)
  korridorAn: true,    // Korridormaske ueberhaupt lesen?
  bonus: null,         // Funktion(x,z) -> 0..1: eigener, vorlaeufiger Wegrabatt
  rand: 3,             // gesperrter Saum am Kartenrand in Welteinheiten
  maxKnoten: 0,        // Deckel der ausgebauten Knoten; 0 = automatisch
  toleranz: 1.1,       // Douglas-Peucker-Toleranz in Welteinheiten
  maxPunkte: 24        // Obergrenze der Stuetzpunkte des Ergebnisses
};

/** Optionen ueber die Standardwerte legen (undefined zaehlt als "nicht gesetzt"). */
function optionen(opt) {
  var o = {}, k;
  for (k in WEG_STANDARD) o[k] = WEG_STANDARD[k];
  if (opt) for (k in WEG_STANDARD) if (opt[k] !== undefined) o[k] = opt[k];
  return o;
}

/* --- Arbeitsspeicher ------------------------------------------------------
   Eine 1024er Karte ergibt bei Schrittweite 2 rund 263 000 Knoten. Die Felder
   dafuer werden EINMAL angelegt und ueber Laeufe hinweg wiederverwendet;
   geloescht wird nicht, sondern ueber eine Laufmarke entwertet:

     marke[id] ===  lauf   Knoten ist in diesem Lauf offen
     marke[id] === -lauf   Knoten ist in diesem Lauf abgeschlossen
     alles andere          Knoten wurde in diesem Lauf noch nicht beruehrt

   Das kostet ein Int32-Feld und spart ein vollstaendiges fill() je Suche.
   Determinismus bleibt unberuehrt: kein Wert aus einem frueheren Lauf kann
   gelesen werden, ohne dass die Marke stimmt. */
var P = { n: 0, g: null, von: null, marke: null, hoehe: null, hMarke: null, lauf: 0 };

function puffer(n) {
  if (P.n !== n) {
    P.n = n;
    P.g = new Float64Array(n);
    P.von = new Int32Array(n);
    P.marke = new Int32Array(n);
    P.hoehe = new Float32Array(n);
    P.hMarke = new Int32Array(n);
    P.lauf = 0;
  }
  P.lauf++;
  // Ueberlauf der Laufmarke (nach ~2 Mrd. Suchen) sauber abfangen: einmal
  // loeschen ist billiger als eine Sonderbehandlung in der inneren Schleife.
  if (P.lauf > 2000000000) { P.marke.fill(0); P.hMarke.fill(0); P.lauf = 1; }
  return P;
}

/* --- Binaerhaufen ---------------------------------------------------------
   Offene Liste mit traeger Loeschung: ein Knoten darf mehrfach drinliegen,
   veraltete Eintraege werden beim Entnehmen an der Marke erkannt und
   uebersprungen. Das ist billiger als ein Haufen mit Positionsindex. */
var H = { n: 0, id: new Int32Array(4096), f: new Float64Array(4096) };

function haufenLeeren() { H.n = 0; }

function haufenWachsen() {
  var idNeu = new Int32Array(H.id.length * 2);
  var fNeu = new Float64Array(H.f.length * 2);
  idNeu.set(H.id); fNeu.set(H.f);
  H.id = idNeu; H.f = fNeu;
}

function haufenEin(id, f) {
  if (H.n >= H.id.length) haufenWachsen();
  var i = H.n++;
  H.id[i] = id; H.f[i] = f;
  while (i > 0) {
    var e = (i - 1) >> 1;
    if (H.f[e] <= H.f[i]) break;
    var ti = H.id[e], tf = H.f[e];
    H.id[e] = H.id[i]; H.f[e] = H.f[i];
    H.id[i] = ti; H.f[i] = tf;
    i = e;
  }
}

function haufenRaus() {
  var kopf = H.id[0];
  H.n--;
  if (H.n > 0) {
    H.id[0] = H.id[H.n]; H.f[0] = H.f[H.n];
    var i = 0;
    for (;;) {
      var l = i * 2 + 1, r = l + 1, m = i;
      if (l < H.n && H.f[l] < H.f[m]) m = l;
      if (r < H.n && H.f[r] < H.f[m]) m = r;
      if (m === i) break;
      var ti = H.id[m], tf = H.f[m];
      H.id[m] = H.id[i]; H.f[m] = H.f[i];
      H.id[i] = ti; H.f[i] = tf;
      i = m;
    }
  }
  return kopf;
}

/** Wegrabatt an einem Weltpunkt: vorhandener Korridor oder eigene Vormerkung. */
function rabattBei(x, z, o) {
  if (o.korridorAn && inCorridor(x, z)) return o.korridor;
  if (o.bonus) {
    var b = o.bonus(x, z);
    if (b > 0) return 1 + (o.korridor - 1) * clamp(b, 0, 1);
  }
  return 1;
}

/**
 * Kosten einer Kante zwischen zwei Knoten. `d` ist die reine Strecke; der
 * Rueckgabewert ist immer >= d * minFaktor(o) — genau die Schranke, auf der
 * die Zulaessigkeit der Heuristik beruht.
 */
function kantenKosten(ax, az, ah, bx, bz, bh, d, o) {
  // Mittelpunkt mitmessen: bei Schrittweite 2 kann sonst ein schmaler Grat
  // oder ein schmaler Fluss zwischen zwei Knoten schlicht uebersehen werden.
  var mx = (ax + bx) * 0.5, mz = (az + bz) * 0.5;
  var mh = heightAt(mx, mz);
  var faktor;
  if (ah < WATER + 0.15 || bh < WATER + 0.15 || mh < WATER + 0.15) {
    faktor = 1 + o.wasser;
  } else {
    // Steilste der beiden Haelften — eine Stufe in der Mitte darf sich nicht
    // gegen die Gesamtdifferenz wegmitteln.
    var h2 = d * 0.5;
    var g1 = Math.abs(mh - ah) / h2, g2 = Math.abs(bh - mh) / h2;
    var t = (g1 > g2 ? g1 : g2) / TAN40;
    var s = o.steigung * t * t;
    if (t > 1) s += o.sperre * (t * t - 1);
    faktor = 1 + s;
  }
  return d * faktor * rabattBei(bx, bz, o);
}

/** Kleinstmoeglicher Kostenfaktor je Laengeneinheit — Basis der Heuristik. */
function minFaktor(o) {
  var m = 1;
  if (o.korridorAn && o.korridor < m) m = o.korridor;
  if (o.bonus && o.korridor < m) m = o.korridor;
  return m > 0 ? m : 0.0001;
}

/* --- Vereinfachung --------------------------------------------------------
   Der Rohweg folgt dem Gitter und besteht aus hunderten Achtelschritten.
   Douglas-Peucker reduziert ihn auf die Stuetzpunkte, an denen sich die
   Richtung wirklich aendert — den Rest uebernimmt die Catmull-Rom-Kurve in
   pathSamples (paths.js), die aus wenigen Punkten ohnehin eine weiche Linie
   macht. Iterativ statt rekursiv, damit ein 3000-Punkte-Weg keinen Stapel
   sprengt. */
function douglasPeucker(pts, eps) {
  var n = pts.length;
  if (n < 3) return pts.slice();
  var behalten = new Uint8Array(n);
  behalten[0] = 1; behalten[n - 1] = 1;
  var stapel = [0, n - 1];
  while (stapel.length) {
    var b = stapel.pop(), a = stapel.pop();
    if (b - a < 2) continue;
    var ax = pts[a].x, az = pts[a].z;
    var dx = pts[b].x - ax, dz = pts[b].z - az;
    var l2 = dx * dx + dz * dz;
    var best = -1, bestD = eps;
    for (var i = a + 1; i < b; i++) {
      var px = pts[i].x - ax, pz = pts[i].z - az;
      var t = l2 > 0 ? clamp((px * dx + pz * dz) / l2, 0, 1) : 0;
      var qx = px - dx * t, qz = pz - dz * t;
      var d = Math.sqrt(qx * qx + qz * qz);
      if (d > bestD) { bestD = d; best = i; }
    }
    if (best < 0) continue;
    behalten[best] = 1;
    stapel.push(a, best, best, b);
  }
  var out = [];
  for (var k = 0; k < n; k++) if (behalten[k]) out.push({ x: pts[k].x, z: pts[k].z });
  return out;
}

/**
 * Punktliste auf wenige Stuetzpunkte eindampfen. Die Toleranz waechst so lange,
 * bis hoechstens `maxPunkte` uebrig sind — ein Pfad mit 300 Griffen waere im
 * Editor unbenutzbar. Auch von generators/welt.js fuer die Flusslaeufe genutzt.
 */
function vereinfache(pts, toleranz, maxPunkte) {
  if (!pts || pts.length < 3) return (pts || []).slice();
  var eps = toleranz > 0 ? toleranz : 1;
  var max = maxPunkte > 2 ? maxPunkte : 24;
  var out = douglasPeucker(pts, eps);
  // Hoechstens 12 Verdopplungen: eps waechst dabei um Faktor 4096, jede
  // denkbare Karte ist damit auf zwei Punkte reduziert — die Schleife kann
  // also nicht haengen bleiben.
  for (var i = 0; i < 12 && out.length > max; i++) {
    eps *= 2;
    out = douglasPeucker(pts, eps);
  }
  return out;
}

/**
 * Sucht einen Weg von `vonPunkt` nach `nachPunkt` ({x,z} in Weltkoordinaten).
 *
 * Rueckgabe ist die geglaettete Punktliste, direkt als `points` eines
 * Pfad-Elements verwendbar. Zusatzangaben haengen als Eigenschaften daran
 * (Muster: pathSamples in paths.js setzt ebenso `out.len`):
 *   .vollstaendig  false = der Deckel griff, es ist der beste TEILWEG
 *   .kosten        Wegkosten des gefundenen Weges
 *   .laenge        Streckenlaenge in Welteinheiten
 *   .knoten        ausgebaute Knoten (Laufzeitmass)
 *   .ms            gemessene Dauer
 * Bei unbrauchbarer Eingabe kommt eine leere Liste zurueck — nie null, damit
 * der Aufrufer nicht auf zwei Faelle pruefen muss.
 */
function sucheWeg(vonPunkt, nachPunkt, opt) {
  var t0 = jetzt();
  var o = optionen(opt);
  var leer = [];
  leer.vollstaendig = false; leer.kosten = 0; leer.laenge = 0; leer.knoten = 0; leer.ms = 0;
  if (!vonPunkt || !nachPunkt) return leer;

  var map = KARTE.map, half = KARTE.half;
  var schritt = o.schritt > 0 ? o.schritt : 2;
  var NW = Math.floor(map / schritt) + 1;          // Knoten je Achse
  var n = NW * NW;
  // Gesperrter Randsaum in Knoten: mindestens einer, damit heightAt nie auf
  // dem geklemmten Kartenrand rechnet.
  var randK = Math.max(1, Math.ceil(o.rand / schritt));
  var lo = randK, hi = NW - 1 - randK;
  if (hi <= lo) return leer;

  function gx(i) { return i * schritt - half; }
  function knoten(x, z) {
    var i = clamp(Math.round((x + half) / schritt), lo, hi);
    var j = clamp(Math.round((z + half) / schritt), lo, hi);
    return j * NW + i;
  }

  var startId = knoten(vonPunkt.x, vonPunkt.z);
  var zielId = knoten(nachPunkt.x, nachPunkt.z);
  if (startId === zielId) {
    var kurz = [{ x: vonPunkt.x, z: vonPunkt.z }, { x: nachPunkt.x, z: nachPunkt.z }];
    kurz.vollstaendig = true; kurz.kosten = 0; kurz.knoten = 0;
    kurz.laenge = Math.hypot(nachPunkt.x - vonPunkt.x, nachPunkt.z - vonPunkt.z);
    kurz.ms = jetzt() - t0;
    return kurz;
  }

  var B = puffer(n), lauf = B.lauf;
  var g = B.g, von = B.von, marke = B.marke, hoehe = B.hoehe, hMarke = B.hMarke;
  function hoeheVon(id, x, z) {
    if (hMarke[id] === lauf) return hoehe[id];
    hMarke[id] = lauf;
    var h = heightAt(x, z);
    hoehe[id] = h;
    return h;
  }

  var mf = minFaktor(o);
  var zx = gx(zielId % NW), zz = gx((zielId / NW) | 0);
  function schaetzung(x, z) {
    var dx = zx - x, dz = zz - z;
    return Math.sqrt(dx * dx + dz * dz) * mf;
  }

  var deckel = o.maxKnoten > 0 ? o.maxKnoten : Math.max(20000, n >> 1);

  haufenLeeren();
  g[startId] = 0; von[startId] = -1; marke[startId] = lauf;
  haufenEin(startId, schaetzung(gx(startId % NW), gx((startId / NW) | 0)));

  // Bester Teilweg: der Knoten, der dem Ziel am naechsten kam. Er ist die
  // Antwort, wenn der Deckel greift oder das Ziel unerreichbar ist — der
  // Editor darf bei einer unloesbaren Aufgabe nicht einfrieren und auch nicht
  // mit leeren Haenden dastehen.
  var bestId = startId, bestH = schaetzung(gx(startId % NW), gx((startId / NW) | 0));
  var ausgebaut = 0, gefunden = false;

  // Nachbarversatz: 8er-Nachbarschaft, Diagonalen mit sqrt(2).
  var DI = [1, 1, 0, -1, -1, -1, 0, 1];
  var DJ = [0, 1, 1, 1, 0, -1, -1, -1];

  while (H.n > 0) {
    var id = haufenRaus();
    if (marke[id] !== lauf) continue;      // veralteter Haufeneintrag
    if (id === zielId) { gefunden = true; break; }
    marke[id] = -lauf;                     // abgeschlossen
    ausgebaut++;

    var i = id % NW, j = (id / NW) | 0;
    var ax = gx(i), az = gx(j);
    var ah = hoeheVon(id, ax, az);
    var gg = g[id];

    for (var k = 0; k < 8; k++) {
      var ni = i + DI[k], nj = j + DJ[k];
      if (ni < lo || ni > hi || nj < lo || nj > hi) continue;
      var nid = nj * NW + ni;
      if (marke[nid] === -lauf) continue;
      var bx = gx(ni), bz = gx(nj);
      var bh = hoeheVon(nid, bx, bz);
      var d = (DI[k] !== 0 && DJ[k] !== 0) ? schritt * 1.4142135623730951 : schritt;
      var ng = gg + kantenKosten(ax, az, ah, bx, bz, bh, d, o);
      if (marke[nid] === lauf && ng >= g[nid]) continue;
      g[nid] = ng; von[nid] = id; marke[nid] = lauf;
      var hRest = schaetzung(bx, bz);
      if (hRest < bestH) { bestH = hRest; bestId = nid; }
      haufenEin(nid, ng + hRest);
    }
    if (ausgebaut >= deckel) break;
  }

  var endId = gefunden ? zielId : bestId;
  // Rohweg rueckwaerts einsammeln und umdrehen.
  var roh = [];
  for (var q = endId; q >= 0; q = von[q]) {
    roh.push({ x: gx(q % NW), z: gx((q / NW) | 0) });
    if (roh.length > n) break;             // Schutz gegen einen Zyklus, der
  }                                        // nur durch einen Fehler entstehen kann
  roh.reverse();
  // Echte Endpunkte statt der gerasterten: der Weg soll den geklickten bzw.
  // uebergebenen Punkt wirklich treffen. Der erste/letzte Gitterpunkt bleibt
  // dabei nicht liegen — er wird ersetzt, sonst entstuende ein Zacken.
  if (roh.length) {
    roh[0] = { x: vonPunkt.x, z: vonPunkt.z };
    if (gefunden) roh[roh.length - 1] = { x: nachPunkt.x, z: nachPunkt.z };
  }

  var out = vereinfache(roh, o.toleranz, o.maxPunkte);
  if (out.length === 1) out.push({ x: out[0].x, z: out[0].z });
  var laenge = 0;
  for (var m = 1; m < out.length; m++) {
    laenge += Math.hypot(out[m].x - out[m - 1].x, out[m].z - out[m - 1].z);
  }
  out.vollstaendig = gefunden;
  // g[endId] ist gueltig: endId ist entweder das Ziel oder ein Knoten, den
  // dieser Lauf selbst geoeffnet hat (bestId wird nur dort gesetzt).
  out.kosten = g[endId];
  out.laenge = laenge;
  out.knoten = ausgebaut;
  out.ms = jetzt() - t0;
  return out;
}

/** Zeitmessung, die im Browser wie unter Node funktioniert. */
function jetzt() {
  return (typeof performance !== "undefined" && performance.now)
    ? performance.now() : Date.now();
}

export { sucheWeg, vereinfache, WEG_STANDARD, TAN40 };
