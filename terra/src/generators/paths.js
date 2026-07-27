// Pfad-Werkzeug: Strasse, Mauer, Fluss, Hecke/Zaun.
import * as THREE from 'three';
import { clamp, lerp, sstep, hashi, fractal, rngOf, rr, ri, wpick } from '../core/rng.js';
// VW/HALF sind LEBENDE Bindungen (H1b) — sie duerfen nie beim Modulstart in
// eine eigene Variable kopiert werden, nur innerhalb von Funktionen gelesen.
import { S, WATER, COS40, VW, HALF, groupOf } from '../core/store.js';
import { POOLS, emit, tintOf, rauchAus } from '../core/pools.js';
import { heightAt, baseHeightAt, slopeAt } from '../world/terrain.js';
import { newOcc, tryPlace, KULTUR, emitFensterlicht } from './objects.js';
import { terraMat, tintedMats } from '../render/materials.js';
// I1: Kartenzeichen. zeichen.js haengt an core/, world/terrain.js und render/ —
// nie an generators/, der Weg ist also zyklusfrei (dieselbe Richtung, die
// areas.js zu signaturen.js nimmt).
import { alsKoerper, alsZeichen, linienZeichen, punktZeichen } from './zeichen.js';
// Seit der Bruchkanten-Drift (B4) besteht ein Zyklus: geometry.js importiert
// paths.js als Namensraum, um materials.js die Bruchmasken-Uniforms zu
// reichen (setBruchQuelle). Er ist harmlos, weil auf beiden Seiten nur
// Funktionen und lebende Namensraum-Bindungen gelesen werden — nie ein Wert
// beim Modulstart kopiert. Ein direkter Import von paths.js in materials.js
// waere dagegen toedlich (Einstieg main -> pipeline -> materials liegt vor
// paths, FAMILIEN waere dann noch nicht initialisiert).
import { mergeGeos, tubeGeo } from './geometry.js';

/* Ortsstabiler Zufallsstrom: bindet alle Draws EINER Platzierungsentscheidung
   an einen stabilen Schluessel statt an die Zugriffsreihenfolge. Ein
   sequentieller Elementstrom wuerde bei jeder Aenderung der Sample-Anzahl
   (Punkt verschoben, Parameter geaendert) die komplette Bestueckung umwuerfeln;
   mit Schluessel-Stroemen aendert sich nur die betroffene Stelle (Vorbild:
   Rasterzellen-Hash in genWald/genWiese). */
function ortsRng(a, b, s) { return rngOf((hashi(a, b, s) * 4294967296) | 0); }

function pathCurve(points) {
  var v = [];
  for (var i = 0; i < points.length; i++) v.push(new THREE.Vector3(points[i].x, 0, points[i].z));
  if (v.length < 2) return null;
  return new THREE.CatmullRomCurve3(v, false, "catmullrom", 0.5);
}

/** Gleichmäßige Abtastung mit Tangenten; s = Bogenlänge. */
function pathSamples(points, step) {
  var curve = pathCurve(points);
  if (!curve) return [];
  var len = curve.getLength();
  if (!(len > 0.01)) return [];
  var n = Math.max(1, Math.ceil(len / step));
  var out = [];
  for (var i = 0; i <= n; i++) {
    var t = i / n;
    var p = curve.getPointAt(t), tg = curve.getTangentAt(t);
    var tl = Math.sqrt(tg.x * tg.x + tg.z * tg.z) || 1;
    out.push({ x: p.x, z: p.z, tx: tg.x / tl, tz: tg.z / tl, s: t * len });
  }
  out.len = len;
  return out;
}


/* ==========================================================================
   Durchgehendes Wegband: folgt der Terrainhoehe, franst an den Raendern
   unregelmaessig aus und sinkt leicht in den Boden ein — keine Plattennaehte.
   Erkennt Wasserquerungen und errichtet dort automatisch eine Bruecke.

   Kern liefert nur die GEOMETRIE: so kann genViertel alle Gassenzuege zu
   einem einzigen Mesh mergen (1 Draw Call statt einem pro Zug), waehrend
   genStrasse ueber den Wrapper bandAusLinie beim Ein-Mesh-Pfad bleibt.
   Die Brueckenausstattung (Pfaehle, Gelaender) laeuft ueber emit() in die
   Instanz-Pools — sie haengt nicht am Mesh und bleibt vom Merge unberuehrt.
   ========================================================================== */
function bandGeoAusLinie(el, linie, halbBreite, grundFarbe, seed, opts) {
  opts = opts || {};
  var einsinken = opts.einsinken === undefined ? 0.12 : opts.einsinken;
  var pos = [], col = [], idx = [];
  var n = linie.length;
  if (n < 2) return null;
  var holz = [0.58, 0.47, 0.35];
  var istBruecke = new Array(n);
  var deckHoehe = new Array(n);
  // 1) Wasserquerungen finden und Deckhoehe der Bruecke bestimmen
  var i;
  for (i = 0; i < n; i++) {
    var q = linie[i];
    var h = heightAt(q.x, q.z);
    istBruecke[i] = h < WATER + 0.25;
    deckHoehe[i] = Math.max(h, WATER + 0.15) + 0.1;
  }
  for (i = 0; i < n; i++) {
    if (!istBruecke[i]) continue;
    // Ufersuche links/rechts, Deck spannt zwischen den Ufern
    var a = i; while (a > 0 && istBruecke[a - 1]) a--;
    var b = i; while (b < n - 1 && istBruecke[b + 1]) b++;
    var ha = deckHoehe[Math.max(0, a - 1)], hb = deckHoehe[Math.min(n - 1, b + 1)];
    var t = (i - a + 1) / (b - a + 2);
    deckHoehe[i] = Math.max(lerp(ha, hb, t), WATER + 1.0) +
      Math.sin(t * Math.PI) * 0.35;                     // leichter Bogen
  }
  // 2) Band bauen
  for (i = 0; i < n; i++) {
    var q2 = linie[i];
    var vor = linie[Math.min(n - 1, i + 1)], zur = linie[Math.max(0, i - 1)];
    var tx = vor.x - zur.x, tz = vor.z - zur.z;
    var tl = Math.sqrt(tx * tx + tz * tz) || 1;
    var nx = -tz / tl, nz = tx / tl;
    // ausgefranste Raender: Halbbreite je Seite vom Rauschen moduliert
    var fL = halbBreite * (1 + (fractal(q2.x * 0.3 + 9, q2.z * 0.3, seed) - 0.5) * 0.7);
    var fR = halbBreite * (1 + (fractal(q2.x * 0.3, q2.z * 0.3 + 9, seed + 3) - 0.5) * 0.7);
    var y = deckHoehe[i];
    var yL = istBruecke[i] ? y : heightAt(q2.x + nx * fL, q2.z + nz * fL) + 0.1 - einsinken;
    var yR = istBruecke[i] ? y : heightAt(q2.x - nx * fR, q2.z - nz * fR) + 0.1 - einsinken;
    var f = istBruecke[i] ? holz : grundFarbe;
    var vv = 0.92 + hashi(i, 3, seed) * 0.14;
    pos.push(q2.x + nx * fL, yL, q2.z + nz * fL);
    col.push(f[0] * vv * 0.92, f[1] * vv * 0.92, f[2] * vv * 0.92);
    pos.push(q2.x, y + (istBruecke[i] ? 0 : 0.045), q2.z);
    col.push(f[0] * vv, f[1] * vv, f[2] * vv);
    pos.push(q2.x - nx * fR, yR, q2.z - nz * fR);
    col.push(f[0] * vv * 0.92, f[1] * vv * 0.92, f[2] * vv * 0.92);
    if (i > 0) {
      var A = (i - 1) * 3, B = i * 3;
      idx.push(A, B, A + 1, A + 1, B, B + 1);
      idx.push(A + 1, B + 1, A + 2, A + 2, B + 1, B + 2);
    }
    // 3) Brueckenausstattung: Pfaehle und Gelaender
    if (istBruecke[i] && (i % 3 === 1)) {
      emit(el, "pfosten", q2.x + nx * (halbBreite + 0.2), y + 0.15, q2.z + nz * (halbBreite + 0.2),
        Math.atan2(tx, tz), 1, 1.2, 1, [0.9, 0.86, 0.8]);
      emit(el, "pfosten", q2.x - nx * (halbBreite + 0.2), y + 0.15, q2.z - nz * (halbBreite + 0.2),
        Math.atan2(tx, tz), 1, 1.2, 1, [0.9, 0.86, 0.8]);
      emit(el, "mauer", q2.x + nx * halbBreite * 0.7, y - 1.1, q2.z + nz * halbBreite * 0.7,
        Math.atan2(tx, tz), 0.35, 1.1, 0.35, [0.6, 0.52, 0.42]);
    }
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  // Normalen schon hier pro Teilband: mergeGeos kopiert sie nur um, dadurch
  // bleibt das Schattierungsergebnis exakt das der frueheren Einzelmeshes.
  g.computeVertexNormals();
  return g;
}

/** Wrapper fuer Einzelbaender (Strasse): ein Element = ein Band = ein Mesh. */
function bandAusLinie(el, linie, halbBreite, grundFarbe, seed, opts) {
  var g = bandGeoAusLinie(el, linie, halbBreite, grundFarbe, seed, opts);
  if (!g) return null;
  var mesh = new THREE.Mesh(g, wegBandMat);
  mesh.userData.el = el;
  groupOf(el).add(mesh);
  return mesh;
}

/** Mehrere Bandgeometrien (die Gassenzuege eines Viertels) zu EINEM Mesh
    vereinen. Das uv-Attribut, das mergeGeos auffuellt, bleibt ungenutzt:
    wegBandMat hat weder Textur-Map noch Wind, die Malschicht sampelt in
    Weltkoordinaten — das Rendering aendert sich also nicht. */
function bandMeshAusGeos(el, geos) {
  if (!geos.length) return null;
  var mesh = new THREE.Mesh(mergeGeos(geos), wegBandMat);
  mesh.userData.el = el;
  groupOf(el).add(mesh);
  return mesh;
}
var wegBandMat = terraMat({ vertexColors: true, familie: 'erde' });

// Geteiltes Flusswasser-Material: frueher erzeugte genFluss bei JEDER
// Regenerierung ein neues Material (Leck beim Ziehen des Breite-Sliders).
// Eigenschaften exakt wie zuvor pro Aufruf; alle Fluss-Meshes teilen es.
// Ueber tintedMats macht es den Tageszeit-Grundton (welt) mit — die
// Hauptwasserflaeche haengt separat am wasser-Preset (waterMat.color in
// atmosphere.js); eine exakte Kopplung daran braeuchte dort eine Zeile.
var flussMat = terraMat({
  vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide
});
tintedMats.push(flussMat);

var BELAG = { erde: [1.02, 0.98, 0.9], stein: [0.9, 0.92, 0.95], pflaster: [0.82, 0.84, 0.86] };

/* ==========================================================================
   I1 — Die Kennzahl der Pfade

   Der Katalog verlangt fuer das Zusammenzeichnen eine Kennzahl, die auf
   ORTSMASSSTAB entsteht und mit dem Element gespeichert wird — nie eine, die
   auf Kartenmassstab geschaetzt wird, weil die Signatur sonst davon abhinge,
   mit welchem Massstab man die Karte zuletzt geoeffnet hat.

   Ein Pfad hat diese Kennzahl schon: seine PARAMETER. Breite und Belag
   stehen im Element, sind vom Massstab unabhaengig und beschreiben genau
   das, was die drei Wegzeichen unterscheiden. Es waere ein Fehler, dafuer
   noch etwas zu zaehlen — gezaehlt wird nur da, wo der Generator sein
   Ergebnis nicht schon in der Hand haelt (siehe genViertel in areas.js).
   ========================================================================== */

/** Welcher Weg ist das? Sechs Einheiten sind zwei Fuhrwerke nebeneinander,
 *  unter drei passt keines mehr durch. Pflaster hebt jeden Weg zur
 *  Handelsstrasse — gepflastert wird, was Fracht traegt.
 *
 *  Die 6 ist nicht gegriffen, sondern der Vorgabewert des Strassenwerkzeugs.
 *  Das ist Absicht: nur die Handelsstrasse ueberlebt bis 4000 m/Zelle, und
 *  eine Kontinentkarte, auf der jede voreingestellte Strasse verschwindet,
 *  waere keine Generalisierung, sondern ein leeres Blatt. Wer einen Landweg
 *  will, zieht den Regler herunter — dann faellt der Weg ueber sein Band bei
 *  1200 weg, und GENAU DAS ist die Generalisierung des Katalogs. */
function strassenZeichen(p) {
  var b = Number.isFinite(p.breite) ? p.breite : 6;
  if (b >= 6 || p.belag === "pflaster") return "sig_handelsstrasse";
  return b >= 3 ? "sig_landweg" : "sig_saumpfad";
}

/* Flussbreite auf Kartenmassstab.

   Der Katalog will die Breite nach dem ABFLUSS (I3) gestuft haben, und das
   ist die richtige Groesse: ein Fluss wird breit, weil viel Wasser durch ihn
   laeuft. `abfluss` ist aber ein LAUFZEITfeld der Erosion — nach dem Laden
   einer Karte steht es auf null, und eine Signatur, die davon abhinge, waere
   nach dem Laden eine andere als vor dem Speichern. Genau die Sorte
   versteckter Zustand, die dieses Projekt schon einmal einen Tag gekostet
   hat.

   Also `params.breite`, und zwar unter der Wurzel: die Flaeche eines
   Querschnitts waechst quadratisch mit der Breite, die STRICHSTAERKE auf
   einer Karte soll das nicht tun. Was ein spaeterer Anschluss an den Abfluss
   braeuchte, steht im Bericht. */
function flussBreite(p) {
  var b = Number.isFinite(p.breite) ? p.breite : 9;
  return clamp(Math.sqrt(b / 9), 0.55, 2.4);
}

/**
 * I1 — Flussuebergaenge als Zeichen.
 *
 * Eine Bruecke ist in Terra kein Element: bandGeoAusLinie baut sie von
 * selbst, wo ein Weg durchs Wasser laeuft. Genau diese Erkennung wird hier
 * noch einmal gefahren — mit derselben Schwelle (WATER + 0.25), damit
 * Zeichen und Bauwerk nie an verschiedenen Stellen sitzen.
 *
 * Bruecke oder Furt entscheidet die TIEFE der Querung, und das ist die
 * ehrliche Ableitung: knietief watet man durch, darunter braucht es ein
 * Bauwerk. Der Katalog fuehrt die Furt deshalb als Q = A (abgeleitet) und
 * die Bruecke als Q = E.
 *
 * Gedreht wird um einen rechten Winkel zur Fahrbahn: das Brueckenzeichen
 * sind zwei Querstriche UEBER der Linie. Laegen sie laengs, waere es eine
 * doppelte Strasse.
 */
function uebergangsZeichen(el, sm) {
  var n = sm.length, i = 0, gesetzt = 0;
  while (i < n) {
    if (heightAt(sm[i].x, sm[i].z) >= WATER + 0.25) { i++; continue; }
    var a = i, tief = Infinity;
    while (i < n && heightAt(sm[i].x, sm[i].z) < WATER + 0.25) {
      tief = Math.min(tief, heightAt(sm[i].x, sm[i].z));
      i++;
    }
    var s = sm[(a + i - 1) >> 1];
    gesetzt += punktZeichen(el, "uebergang", null, s.x, s.z, {
      art: tief > WATER - 0.9 ? "sig_furt" : "sig_bruecke",
      dreh: Math.atan2(-s.tz, s.tx) + Math.PI / 2
    });
  }
  return gesetzt;
}

function genStrasse(el) {
  var p = el.params, rng = rngOf(el.seed);
  var w = p.breite, sm = pathSamples(el.points, 1.6);
  if (!sm.length) return;
  /* I1 — ueber der Uebergabe wird die Strasse zur Linie. Im Ueberblendbereich
     laeuft beides: das Band blendet ueber den Alphakanal ein, waehrend die
     Fahrbahn bis zum oberen Rand stehen bleibt. Die Haeuser am Weg brauchen
     hier nichts — ihr Pool traegt sein Band, und emit setzt es durch. */
  var mSig = S.einheitMeter;
  if (alsZeichen(mSig)) {
    linienZeichen(el, "strasse", sm, null, { art: strassenZeichen(p) });
    uebergangsZeichen(el, sm);
  }
  if (!alsKoerper(mSig)) return;
  var belag = BELAG[p.belag] || BELAG.erde;
  var i, s;
  // Fahrbahn als durchgehendes Band (mit automatischen Bruecken ueber Wasser)
  var bandFarbe = [0.60 * belag[0], 0.545 * belag[1], 0.45 * belag[2]];
  bandAusLinie(el, sm, w * 0.5, bandFarbe, el.seed, { einsinken: 0.12 });
  if (!p.haeuser) return;
  // Bebauung beidseitig, zur Straße ausgerichtet.
  // Zufalls-Schluessel je Haus samt Begleitbusch: (rund(s/1.6), Seite, seed+11)
  // — der Bogenlaengen-Index ist entlang eines unveraenderten Teilstuecks
  // stabil, das Verschieben eines Punkts wuerfelt also nur dessen Umgebung um.
  // Grenze: die Bogenlaenge zaehlt ab Pfadanfang; Aenderungen dort verschieben
  // die Indizes des gesamten Rests (akzeptiert — ein Weltkoordinaten-Hash
  // waere stattdessen gegen die Kurvenglaettung instabil).
  // Elementweit bleibt NUR der Startabstand je Seite: genau ein Draw pro
  // Seite, unabhaengig von Sample-Anzahl und Parametern, daher unschaedlich.
  var occ = newOcc(4);
  var half = w * 0.5;
  for (var side = -1; side <= 1; side += 2) {
    var seite = side < 0 ? 0 : 1;
    var next = rr(rng, 2, p.abstand);
    for (i = 0; i < sm.length; i++) {
      s = sm[i];
      if (s.s < next) continue;
      var rs = ortsRng(Math.round(s.s / 1.6), seite, el.seed + 11);
      next = s.s + p.abstand * rr(rs, 0.7, 1.35);
      var nx = -s.tz, nz = s.tx;
      var off = half + 2.6 + rr(rs, 0, p.streuung);
      var x = s.x + nx * off * side + s.tx * rr(rs, -p.streuung, p.streuung);
      var z = s.z + nz * off * side + s.tz * rr(rs, -p.streuung, p.streuung);
      var kind = wpick(rs, KULTUR[p.stil] || KULTUR.dorf);
      var h = tryPlace(occ, x, z, POOLS[kind].radius, null);
      if (h === null) continue;
      var sc = rr(rs, 0.85, 1.2);
      var syaw = Math.atan2(s.tx, s.tz) + rr(rs, -0.14, 0.14);
      emit(el, kind, x, h - 0.15, z, syaw, sc, sc * rr(rs, 0.9, 1.15), sc, tintOf(rs));
      rauchAus(el, kind, x, h, z, sc);
      emitFensterlicht(el, rs, kind, x, h - 0.15, z, syaw, sc);
      if (rs() < 0.35) {
        var bx = x + nx * side * rr(rs, 2.2, 3.6), bz = z + nz * side * rr(rs, 2.2, 3.6);
        var bh = tryPlace(occ, bx, bz, 0.9, null);
        if (bh !== null) emit(el, "busch", bx, bh, bz, rs() * 6.28,
          rr(rs, 0.8, 1.3), rr(rs, 0.8, 1.3), rr(rs, 0.8, 1.3), tintOf(rs));
      }
    }
  }
}

function genMauer(el) {
  var p = el.params;
  var sm = pathSamples(el.points, 2.0);
  if (!sm.length) return;
  /* I1 — eine Mauer ist auf Kartenmassstab eine GRENZLINIE. Das Perlband ist
     das einzige Linienzeichen des Katalogs, das eine gezogene Trennung meint
     und kein Gewaesser und keinen Weg; die Stufentabelle fuehrt „Grenze" von
     Grenzsteinen ueber die Steinreihe genau dorthin. Ein Zackenkranz
     (sig_stadtmauer) waere die Alternative, aber der gehoert um eine
     Ortssignatur herum und nicht an einen freien Pfad. */
  var mSig = S.einheitMeter;
  if (alsZeichen(mSig)) linienZeichen(el, "grenze", sm, null, { art: "sig_grenze" });
  if (!alsKoerper(mSig)) return;
  // Zufalls-Schluessel: Segment-Tint (rund(s/2.0), 0, seed+5), Turm-Drehung/
  // Tint (rund(s/2.0), 0, seed+6), Tortuerme (Torindex, Seite, seed+7).
  // Tor- und Turm-POSITIONEN sind reine Rechnung ohne Zufall und daher
  // ohnehin ortsstabil; ein elementweiter Strom bleibt nicht uebrig.
  // Grenze wie bei allen Pfaden: Bogenlaenge zaehlt ab Pfadanfang, dortige
  // Aenderungen verschieben die Indizes des Rests.
  var gates = [];
  if (p.torAbstand > 0) {
    for (var g = p.torAbstand; g < sm.len; g += p.torAbstand) gates.push(g);
  }
  var nextTurm = p.turmAbstand;
  for (var i = 0; i < sm.length; i++) {
    var s = sm[i];
    var idx = Math.round(s.s / 2.0);
    var y = Math.max(heightAt(s.x, s.z), WATER + 0.2);
    var yaw = Math.atan2(s.tx, s.tz);
    var atGate = false;
    for (var k = 0; k < gates.length; k++) if (Math.abs(s.s - gates[k]) < 3.4) atGate = true;
    if (!atGate) {
      var rw = ortsRng(idx, 0, el.seed + 5);
      var t = tintOf(rw, 0.05);
      emit(el, "mauer", s.x, y - 0.35, s.z, yaw, p.dicke, 2.6 * p.hoehe, 2.2, t);
    }
    if (s.s >= nextTurm) {
      nextTurm += p.turmAbstand;
      var th = heightAt(s.x, s.z);
      var rt = ortsRng(idx, 0, el.seed + 6);
      emit(el, "turm", s.x, th - 0.4, s.z, rt() * 6.28,
        p.dicke * 0.85, p.hoehe * 1.05, p.dicke * 0.85, tintOf(rt, 0.04));
    }
  }
  // Tortürme flankierend
  for (var q = 0; q < gates.length; q++) {
    for (var side = -1; side <= 1; side += 2) {
      var rq = ortsRng(q, side < 0 ? 0 : 1, el.seed + 7);
      var target = gates[q] + side * 3.8, best = null;
      for (var m = 0; m < sm.length; m++) if (!best || Math.abs(sm[m].s - target) < Math.abs(best.s - target)) best = sm[m];
      if (!best) continue;
      emit(el, "turm", best.x, heightAt(best.x, best.z) - 0.4, best.z, rq() * 6.28,
        p.dicke * 0.8, p.hoehe * 1.15, p.dicke * 0.8, tintOf(rq, 0.04));
    }
  }
}

function genFluss(el) {
  var p = el.params;
  var sm = pathSamples(el.points, 2.2);
  if (sm.length < 2) return;
  // I1: ueber der Uebergabe traegt die Linie den Fluss, nicht die
  // Wasserflaeche. Der Einschnitt ins Hoehenfeld bleibt davon unberuehrt —
  // den legt dirty.js/rebuildRivers, und er ist Gelaende, keine Darstellung.
  var mSig = S.einheitMeter;
  if (alsZeichen(mSig)) linienZeichen(el, "gewaesser", sm, null,
    { art: "sig_fluss", breite: flussBreite(p) });
  if (!alsKoerper(mSig)) return;
  // Höhenprofil der Sohle glätten, damit das Wasser nicht bergauf fließt
  var prof = [];
  for (var i = 0; i < sm.length; i++) prof.push(baseHeightAt(sm[i].x, sm[i].z));
  for (var pass = 0; pass < 8; pass++) {
    var cp = prof.slice();
    for (var k = 1; k < prof.length - 1; k++) prof[k] = (cp[k - 1] + cp[k] * 2 + cp[k + 1]) * 0.25;
  }
  var pos = [], col = [], idx = [];
  var wc = new THREE.Color(0x6fb5c4), tmp = new THREE.Color();
  var wSurf = [];
  for (i = 0; i < sm.length; i++) {
    var s = sm[i];
    var y = prof[i] - p.tiefe * 0.42;
    wSurf.push(y);
    var nx = -s.tz, nz = s.tx, hw = p.breite * 0.5;
    tmp.copy(wc).multiplyScalar(0.95 + hashi(i, el.seed, 3) * 0.1);
    pos.push(s.x + nx * hw, y, s.z + nz * hw);
    col.push(tmp.r, tmp.g, tmp.b);
    pos.push(s.x - nx * hw, y, s.z - nz * hw);
    col.push(tmp.r, tmp.g, tmp.b);
    if (i > 0) {
      var a = (i - 1) * 2, b = a + 1, c = i * 2, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  var mesh = new THREE.Mesh(g, flussMat);
  mesh.renderOrder = 5;
  groupOf(el).add(mesh);
  // Schilf und Steine am Ufer.
  // Zufalls-Schluessel: (rund(s/2.2), Seite, seed+13) — das Bandprofil selbst
  // zieht seine Varianz schon aus hashi und bleibt unberuehrt; elementweiter
  // Strom entfaellt damit vollstaendig. Grenze: Bogenlaenge ab Pfadanfang.
  var occ = newOcc(2.2);
  for (i = 0; i < sm.length; i += 2) {
    var ss = sm[i];
    var idx = Math.round(ss.s / 2.2);
    for (var side = -1; side <= 1; side += 2) {
      var ru = ortsRng(idx, side < 0 ? 0 : 1, el.seed + 13);
      if (ru() > 0.55) continue;
      var ox = -ss.tz * side, oz = ss.tx * side;
      var d = p.breite * 0.5 + rr(ru, 0.6, 3.2);
      var x = ss.x + ox * d, z = ss.z + oz * d;
      var h = tryPlace(occ, x, z, 0.5, { ignoreCorridor: true });
      if (h === null) continue;
      var what = ru() < 0.72 ? "gras" : "fels";
      var sc = rr(ru, 0.8, 1.6);
      emit(el, what, x, h, z, ru() * 6.28, sc, sc * rr(ru, 1, 1.6), sc, tintOf(ru));
    }
  }
}

function genHecke(el) {
  var p = el.params;
  var step = p.stil === "zaun" ? 2.0 : 1.15;
  var sm = pathSamples(el.points, step);
  if (!sm.length) return;
  /* I1 — Hecke und Zaun sind dieselbe Sache wie die Mauer, nur leiser: die
     Stufentabelle des Katalogs nennt fuer „Grenze" auf Ortsmassstab
     ausdruecklich GRENZSTEINE, und genau die setzt der zaun-Zweig hier als
     Pfosten. Auf Kartenmassstab bleibt davon das Perlband. */
  var mSig = S.einheitMeter;
  if (alsZeichen(mSig)) linienZeichen(el, "grenze", sm, null, { art: "sig_grenze" });
  if (!alsKoerper(mSig)) return;
  // Zufalls-Schluessel: (rund(s/step), 0, seed+17) je Pfosten/Busch; kein
  // elementweiter Strom noetig. Ein Stilwechsel (zaun<->hecke) aendert die
  // Schrittweite und wuerfelt damit neu — das tut die andere Objektart aber
  // ohnehin. Grenze: Bogenlaenge ab Pfadanfang.
  for (var i = 0; i < sm.length; i++) {
    var s = sm[i];
    var rh = ortsRng(Math.round(s.s / step), 0, el.seed + 17);
    var nx = -s.tz, nz = s.tx;
    var j = rr(rh, -0.3, 0.3);
    var x = s.x + nx * j, z = s.z + nz * j;
    var h = heightAt(x, z);
    if (h < WATER + 0.25 || slopeAt(x, z) < COS40) continue;
    var yaw = Math.atan2(s.tx, s.tz);
    if (p.stil === "zaun") {
      emit(el, "pfosten", x, h, z, yaw + Math.PI / 2, 1, rr(rh, 0.9, 1.1) * p.hoehe, 1, tintOf(rh));
    } else {
      var sc = rr(rh, 0.85, 1.3);
      emit(el, "busch", x, h, z, rh() * 6.28, sc * 1.1, sc * p.hoehe, sc * 0.95, tintOf(rh, 0.08));
    }
  }
}


/* ==========================================================================
   Bruchkante (H6) — die Form des zerbissenen Planeten

   Kanon: Terra ist auseinandergerissen, Arbor haelt die Stuecke zusammen. Ein
   Bruch ist eine gezeichnete Linie, an der das Terrain EINSEITIG abreisst —
   die eine Seite bleibt stehen, die andere faellt ueber `tiefe` ins Nichts.

   Hoehenwirkung OHNE eine Zeile in terrain.js: recomputeHeights wendet die
   Eintraege aus `rivers` als KREISSTEMPEL je Sample an
   (w = sstep(R, 0.3R, d), ziel = lerp(base, y - depth, w), Minimum-Regel).
   Ein einzelner Kreis ist symmetrisch — eine KETTE von Kreisen, deren
   Mittelpunkte ausschliesslich auf der Abgrundseite liegen, ist es nicht:

       gezeichnete Linie ───────────────────────   d = R  ⇒ w = 0
                          ( o ) ( o ) ( o ) ( o )  1. Reihe: Kantenrampe (0.7R)
                         ( o ) ( o ) ( o ) ( o )   Innenreihen: Abgrundsohle
                          ( o ) ( o ) ( o ) ( o )

   Weil die erste Reihe genau R von der Linie entfernt liegt, ist das Gewicht
   AN der Linie exakt 0: die stehende Seite bleibt unangetastet, waehrend das
   Terrain zur anderen Seite hin ueber `breite` auf `tiefe` abfaellt. Damit ist
   der Bruch genau das, was der Plan beschreibt — „dieselbe Mechanik wie der
   Flusseinschnitt, nur asymmetrisch".

   `brueche` haelt die Stempel in exakt der rivers-Form ({samples, radius,
   depth}); angewandt werden sie NICHT hier, sondern von recomputeHeights,
   nachdem dirty.js/rebuildBrueche sie an `rivers` angehaengt hat.
   ========================================================================== */

var BRUCH_SCHRITT = 1.4;      // Abtastung entlang der Kante

var brueche = [];             // {el, samples:[{x,z,y}], radius, depth, …}

/**
 * Alle abgeleiteten Masse eines Bruchs an EINER Stelle — Generator und
 * dirty.js/stempelRadius lesen dieselbe Rechnung (sonst wird die Einfluss-Box
 * zu klein und es bleiben Restloecher stehen).
 */
function bruchMasse(p) {
  p = p || {};
  var breite = clamp(p.breite === undefined ? 6 : p.breite, 2, 20);
  var tiefe = clamp(p.tiefe === undefined ? 90 : p.tiefe, 40, 200);
  var zack = clamp(p.zackigkeit === undefined ? 0.5 : p.zackigkeit, 0, 1);
  // sstep(R, 0.3R, d) laeuft von 0 (d = R) auf 1 (d = 0.3R) — die Rampe misst
  // 0.7*R. Soll sie `breite` breit sein, ist R = breite / 0.7.
  var R = breite / 0.7;
  // Reihenabstand: in der Mitte zwischen zwei Mittelpunkten ist d = 0.275*R,
  // dort ist w bereits 1 — die Sohle bleibt also luecken- und wellenfrei.
  var schritt = R * 0.55;
  var abgrund = clamp(tiefe * 0.55, 20, 70);   // Weite der Abrisszone
  var reihen = Math.max(2, Math.ceil(abgrund / schritt));
  var maxOff = R * (1 + zack * 0.6);           // ausgefranste erste Reihe
  return {
    R: R, tiefe: tiefe, breite: breite, zack: zack,
    schritt: schritt, abgrund: abgrund, reihen: reihen,
    // Reichweite ab der Linie. Bewusst symmetrisch gedacht: die ausgefranste
    // erste Reihe greift bis R*0.6*zack auf die STEHENDE Seite ueber, und
    // elementBox legt ohnehin eine quadratische Box um den Pfad.
    reichweite: maxOff + (reihen - 1) * schritt + R
  };
}

/** Ein Innenreihen-Stempel; die Sohle wird dabei leicht gebrochen. */
function bruchInnen(samples, k, dist, M, seed) {
  var x = k.x + k.nx * (k.off + dist), z = k.z + k.nz * (k.off + dist);
  var y = k.y + (fractal(x * 0.05, z * 0.05, seed + 607) - 0.5) * M.tiefe * 0.06 * M.zack;
  samples.push({ x: x, z: z, y: y });
}

/**
 * Kantenverlauf (Grundlage der Ausstattung) und Stempelkette (Grundlage der
 * Hoehenwirkung) aus EINER Rechnung — so koennen Wurzelvorhaenge und Saum
 * gar nicht neben der Klippe liegen. Rein deterministisch: ortsstabile
 * fractal-Aufrufe in Weltkoordinaten, kein sequentieller Elementstrom.
 */
function bruchDaten(el) {
  var p = el.params || {};
  var sm = pathSamples(el.points, BRUCH_SCHRITT);
  if (sm.length < 2) return null;
  var M = bruchMasse(p);
  // Der Select liefert Strings ("1" / "-1"); fehlt der Parameter, zeigt die
  // Normale wie bei allen Pfaden nach rechts.
  var seite = Number(p.seite) < 0 ? -1 : 1;
  var i;
  // Hoehenprofil der Kante glaetten wie beim Fluss — die Sohle soll nicht
  // jeder Bodenwelle folgen. Die stehende Seite bleibt davon unberuehrt
  // (dort ist w = 0); das Profil setzt ausschliesslich die Abgrundtiefe.
  var prof = [];
  for (i = 0; i < sm.length; i++) prof.push(baseHeightAt(sm[i].x, sm[i].z));
  for (var pass = 0; pass < 8; pass++) {
    var cp = prof.slice();
    for (var k = 1; k < prof.length - 1; k++) prof[k] = (cp[k - 1] + cp[k] * 2 + cp[k + 1]) * 0.25;
  }
  // Ausgefranste Kante: der Versatz der ERSTEN Stempelreihe wandert per
  // fractal um R herum. Zwei Oktaven — die grobe reisst Buchten und Nasen in
  // den Verlauf, die feine nimmt der Silhouette den Zug einer Linie. Bei
  // zackigkeit = 0 bleibt off = R und die Kante laeuft exakt am Pfad.
  var kante = [];
  for (i = 0; i < sm.length; i++) {
    var s = sm[i];
    var grob = fractal(s.x * 0.075, s.z * 0.075, el.seed + 601) - 0.5;
    var fein = fractal(s.x * 0.23, s.z * 0.23, el.seed + 603) - 0.5;
    kante.push({
      x: s.x, z: s.z, tx: s.tx, tz: s.tz,
      nx: -s.tz * seite, nz: s.tx * seite,
      off: M.R * (1 + (grob * 1.4 + fein * 0.6) * M.zack * 0.6),
      y: prof[i], s: s.s
    });
  }
  // Stempelkette: erste Reihe fein abgetastet (sie zeichnet die Silhouette),
  // Innenreihen grob — sie fuellen nur die Sohle und ueberlappen ohnehin.
  var samples = [];
  for (i = 0; i < kante.length; i++) {
    var k0 = kante[i];
    samples.push({ x: k0.x + k0.nx * k0.off, z: k0.z + k0.nz * k0.off, y: k0.y });
  }
  // Schrittweite der Innenreihen ENTLANG der Kante: dieselben 0.55*R wie quer
  // dazu — der halbe Abstand (0.275*R) liegt unter 0.3*R, dort ist w bereits
  // 1. Damit ist die Sohle luecken- und wellenfrei ueberdeckt.
  var jeder = Math.max(1, Math.round(M.schritt / BRUCH_SCHRITT));
  var letzt = kante.length - 1;
  for (var r = 1; r < M.reihen; r++) {
    var dist = M.schritt * r;
    for (i = 0; i < kante.length; i += jeder) bruchInnen(samples, kante[i], dist, M, el.seed);
    // Der letzte Punkt muss dabei sein, sonst endet die Sohle vor dem Pfadende.
    if (letzt % jeder !== 0) bruchInnen(samples, kante[letzt], dist, M, el.seed);
  }
  return { el: el, samples: samples, radius: M.R, depth: M.tiefe,
    kante: kante, masse: M, seite: seite };
}

/**
 * Legt den Stempel EINES Bruch-Elements in `brueche` ab (bzw. ersetzt ihn).
 * genBruch schreibt bewusst NICHT selbst ins Hoehenfeld — das darf nur
 * recomputeHeights (terrain.js). dirty.js/rebuildBrueche leert `brueche`,
 * sammelt neu und haengt die Eintraege an `rivers` an.
 */
function merkeBruch(d) {
  for (var i = 0; i < brueche.length; i++) {
    if (brueche[i].el === d.el) { brueche[i] = d; return d; }
  }
  brueche.push(d);
  return d;
}

/* ==========================================================================
   Bruchmaske (H6) — wo faellt die Karte ins Nichts?

   Problem: world/water.js legt EINE kartenfuellende Wasserebene bei y = 0 und
   einen opaken Meeresboden-Teller bei y = -24 ueber die gesamte Karte. Ein
   Abgrund wird davon ueberzogen und bei -24 abgeschnitten — er liest sich als
   tiefer See statt als Klippe ins Nichts, und Wurzelvorhaenge wie schwebende
   Truemmer unterhalb -24 verschwinden hinter dem Teller.

   Loesung ohne eine Zeile in terrain.js: eine Rastermaske in Gitteraufloesung
   (VW x VW, eine Zelle je Terrainvertex, also 1 Welteinheit je Texel), die
   dieselben Stempel rasterisiert, die recomputeHeights ins Hoehenfeld schneidet.
   water.js sampelt sie als DataTexture in Weltkoordinaten und blendet
   Wasserebene und Teller dort aus.

   AUFWEITUNG gegenueber dem Hoehenstempel: der Hoehenstempel wirkt mit
   w = sstep(R, 0.3R, d), die Maske laeuft von 0 bei 1.45*R auf 1 bei 0.55*R.
   Grund: das Terrain faellt am Bruch praktisch senkrecht — schon bei winzigem
   Stempelgewicht liegt es unter dem Wasserspiegel. Waere die Maske
   deckungsgleich mit dem Hoehenstempel, muesste das Wasser innerhalb von
   Zehntelmetern verschwinden und die Kante treppte. Mit der Aufweitung liegt
   der 0.5-Wert genau auf der ausgefransten Kante (die erste Stempelreihe hat
   den Abstand off ~ R zum Pfad) und der weiche Rand von rund +-0.45*R liegt
   auf der STEHENDEN Seite — dort verdeckt das unveraenderte Terrain die
   Wasserebene ohnehin, der Uebergang ist also unsichtbar weich.
   Bekannte Grenze: wird eine Bruchkante mitten ins Meer gezeichnet (stehende
   Seite unter y = 0), reisst dieser Saum ein rund 0.45*R breites Loch ins
   Wasser der stehenden Seite. Fuer die Kanonlage (Land reisst auf) irrelevant.
   ========================================================================== */

var BRUCH_MASKE_AUSSEN = 1.45;   // Faktor auf R: hier ist die Maske 0
var BRUCH_MASKE_INNEN = 0.55;    // Faktor auf R: hier ist die Maske 1

var bruchMaske = null;           // Uint8Array(VW*VW), 0 = Land, 255 = Abgrund
var bruchMaskeTex = null;        // DataTexture darauf (nur Rotkanal)
var bruchMaskeVW = 0;            // Gitterweite, fuer die sie angelegt wurde
var bruchMaskeAktiv = false;     // traegt die Maske ueberhaupt Marken?
var bruchMaskeSchmutzig = false; // CPU-Feld seit dem letzten Upload geaendert?

// 1x1-Platzhalter: solange keine Bruchkante existiert, zeigt das Uniform
// hierauf und es wird KEIN VW*VW-Feld angelegt (bei 1024er Karten immerhin
// ein Megabyte samt GPU-Upload). unpackAlignment 1, weil eine Bytezeile der
// Rotkanal-Textur nicht durch 4 teilbar sein muss.
var BRUCH_LEER = new THREE.DataTexture(new Uint8Array(1), 1, 1,
  THREE.RedFormat, THREE.UnsignedByteType);
BRUCH_LEER.unpackAlignment = 1;
BRUCH_LEER.needsUpdate = true;

/**
 * Uniform-Buendel der Bruchmaske — dasselbe Muster wie terraUniforms in
 * render/materials.js: die Objekte sind stabil, nur ihre `.value` wechseln.
 * Verbraucher (world/water.js) haengen sie einmal beim Kompilieren an ihren
 * Shader und muessen danach nie wieder etwas nachziehen.
 *   uBruchStaerke = 0  schaltet den kompletten Fragmentzweig ab (Normalfall).
 *   uBruchAbb = vec2( 1/VW, (HALF+0.5)/VW )  bildet Welt-XZ auf uv ab:
 *     uv = weltXZ * x + y — Texel (i,j) liegt auf Weltpunkt (i-HALF, j-HALF),
 *     sein Mittelpunkt also bei uv = (i+0.5)/VW.
 */
var bruchMaskeUniforms = {
  uBruchMaske: { value: BRUCH_LEER },
  uBruchAbb: { value: new THREE.Vector2(1 / 257, 128.5 / 257) },
  uBruchStaerke: { value: 0 }
};

/**
 * Legt Maske und Textur an — und legt sie bei ABWEICHENDER Gitterweite NEU an.
 * Bewusst nicht wie die Hoehenfelder in terrain.js "nur wachsend": die Textur
 * traegt ihre Groesse selbst, und die Weltabbildung uBruchAbb haengt an genau
 * dieser Groesse. Ein zu grosses Feld waere hier also nicht harmlos, sondern
 * verschoebe die Maske gegen die Karte. Deshalb: Laenge != VW*VW -> alles neu.
 * Die alte Textur wird disposed; die Maske selbst haelt keine Historie (anders
 * als base/hgt), ein Undo ueber den Groessenwechsel hinweg baut sie ohnehin
 * ueber rebuildAll -> rebuildBrueche neu auf.
 */
function bruchMaskeSichern() {
  if (bruchMaske && bruchMaskeVW === VW && bruchMaske.length === VW * VW) return;
  if (bruchMaskeTex) bruchMaskeTex.dispose();
  bruchMaskeVW = VW;
  bruchMaske = new Uint8Array(VW * VW);
  var t = new THREE.DataTexture(bruchMaske, VW, VW, THREE.RedFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;      // ohne Mipmaps, sonst braeuchte es
  t.generateMipmaps = false;             // eine Pyramide je Neuaufbau
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.unpackAlignment = 1;                 // 257 Byte je Zeile, nicht 4-teilbar
  t.needsUpdate = true;
  bruchMaskeTex = t;
  bruchMaskeUniforms.uBruchMaske.value = t;
  bruchMaskeUniforms.uBruchAbb.value.set(1 / VW, (HALF + 0.5) / VW);
  bruchMaskeAktiv = false;
  bruchMaskeSchmutzig = false;
}

/** Beginn eines Neuaufbaus: Marken loeschen. Ohne vorherige Marken passiert
 *  gar nichts — auf einer Karte ohne Bruchkante wird nie ein Feld angelegt
 *  und nie eine Textur hochgeladen. */
function bruchMaskeLeeren() {
  if (bruchMaskeAktiv && bruchMaske) { bruchMaske.fill(0); bruchMaskeSchmutzig = true; }
  bruchMaskeAktiv = false;
}

/**
 * Rasterisiert EINEN Bruch (Rueckgabe von bruchDaten) in die Maske. Grundlage
 * sind genau die Stempel, die auch das Hoehenfeld einschneiden — die Maske
 * kann dadurch gar nicht neben der Klippe liegen. Ueberlappende Stempel werden
 * per Maximum verrechnet (wie die Minimum-Regel des Hoehenfelds: der tiefste
 * Stempel gewinnt).
 */
function bruchMaskeStempeln(d) {
  if (!d || !d.samples || !d.samples.length) return;
  bruchMaskeSichern();
  var sm = d.samples, m = bruchMaske, n = bruchMaskeVW;
  var aussen = d.radius * BRUCH_MASKE_AUSSEN, innen = d.radius * BRUCH_MASKE_INNEN;
  var aussen2 = aussen * aussen;
  for (var k = 0; k < sm.length; k++) {
    // Gitterkoordinaten: Zelle (i,j) liegt auf Weltpunkt (i-HALF, j-HALF).
    var ci = sm[k].x + HALF, cj = sm[k].z + HALF;
    var i0 = Math.floor(ci - aussen), i1 = Math.ceil(ci + aussen);
    var j0 = Math.floor(cj - aussen), j1 = Math.ceil(cj + aussen);
    if (i0 < 0) i0 = 0;
    if (j0 < 0) j0 = 0;
    if (i1 > n - 1) i1 = n - 1;
    if (j1 > n - 1) j1 = n - 1;
    for (var j = j0; j <= j1; j++) {
      var dz = j - cj, zz = dz * dz, reihe = j * n;
      for (var i = i0; i <= i1; i++) {
        var dx = i - ci, dd2 = dx * dx + zz;
        if (dd2 >= aussen2) continue;              // Kreis statt Kachel: spart
        var v = sstep(aussen, innen, Math.sqrt(dd2)) * 255;   // ~21 % der Wurzeln
        if (v > m[reihe + i]) m[reihe + i] = v;
      }
    }
  }
  bruchMaskeAktiv = true;
  bruchMaskeSchmutzig = true;
}

/**
 * Abschluss des Neuaufbaus: Textur hochladen (nur wenn sich wirklich etwas
 * geaendert hat) und den Shaderzweig scharf schalten. Ohne Bruchkante bleibt
 * uBruchStaerke auf 0 — der Zweig in water.js faellt uniform-kohaerent weg und
 * das Bild ist identisch zu einer Fassung ohne diese Maske.
 */
function bruchMaskeFertig() {
  if (bruchMaskeSchmutzig && bruchMaskeTex) {
    bruchMaskeTex.needsUpdate = true;
    bruchMaskeSchmutzig = false;
  }
  bruchMaskeUniforms.uBruchStaerke.value = bruchMaskeAktiv ? 1 : 0;
}

/** Maskenwert 0..1 an einem Weltpunkt — fuer Tests und Werkzeuge, die wissen
 *  muessen, ob ein Punkt ueber dem Abgrund liegt (nearest, ohne Filterung). */
function bruchMaskeAt(x, z) {
  if (!bruchMaskeAktiv || !bruchMaske) return 0;
  var i = Math.round(x + HALF), j = Math.round(z + HALF), n = bruchMaskeVW;
  if (i < 0 || j < 0 || i > n - 1 || j > n - 1) return 0;
  return bruchMaske[j * n + i] / 255;
}


// Geteiltes Material der Wurzelvorhaenge — Muster von flussMat: EIN
// Modul-Material fuer alle Bruch-Elemente, sonst leckt jede Regenerierung
// eines. Kein userData.eigenesMaterial an den Meshes, damit clearElement
// (store.js) es nicht disposed.
var wurzelMat = terraMat({ vertexColors: true, familie: 'holz' });
tintedMats.push(wurzelMat);

/**
 * Bruchkante: Hoehenstempel ablegen und die sichtbare Ausstattung setzen —
 * haengende Wurzelvorhaenge, Felsbrocken am Saum, schwebende Truemmer.
 * Zufalls-Schluessel wie bei allen Pfaden ortsstabil ueber (rund(s/3.2), Rolle,
 * seed+N); es bleibt kein elementweiter Strom uebrig.
 */
function genBruch(el) {
  var p = el.params || {};
  var d = bruchDaten(el);
  if (!d) return;
  merkeBruch(d);
  /* I1 — die Bruchkante ist der einzige Pfad mit einem ARBOR-Zeichen: sie
     gehoert zur Gruppe, die leuchtet, weil sie erzaehlt, wo die Welt
     auseinandergerissen ist. Ihr Zeichen ist kein Streifen, sondern ein Quad
     (doppelte Bruchlinie mit Schattenseite) — linienZeichen legt es deshalb
     als Kette und nicht als Band.

     Gezeichnet wird entlang der AUSGEFRANSTEN Kante (d.kante), nicht entlang
     des gezeichneten Pfades: die Klippe liegt dort, wo die Stempel liegen,
     und eine Signatur, die daneben laege, waere schlimmer als keine.

     merkeBruch steht bewusst DAVOR: der Hoehenstempel ist Gelaende und darf
     nicht davon abhaengen, mit welchem Massstab man hinsieht. */
  var mSig = S.einheitMeter;
  if (alsZeichen(mSig)) linienZeichen(el, "bruch", d.kante, null, null);
  if (!alsKoerper(mSig)) return;
  var kante = d.kante, M = d.masse;
  var geos = [], occ = newOcc(2.6), i;
  var schritt = Math.max(1, Math.round(3.2 / BRUCH_SCHRITT));
  for (i = 0; i < kante.length; i += schritt) {
    var k = kante[i];
    var idx = Math.round(k.s / 3.2);
    // --- Wurzelvorhaenge: Arbor greift ueber die Bruchkante und haelt die
    //     Stuecke zusammen. Geometrie im Element-Mesh (tubeGeo), nicht als
    //     Pool: jeder Vorhang haengt anders und wuerde als Instanz auffallen.
    if (p.wurzeln !== false) {
      var rw = ortsRng(idx, 0, el.seed + 613);
      if (rw() < 0.72) {
        var nS = ri(rw, 2, 4);
        for (var st = 0; st < nS; st++) {
          var rs = ortsRng(idx, 10 + st, el.seed + 613);
          var laengs = rr(rs, -1.5, 1.5);
          var quer = M.R * rr(rs, 0.10, 0.30);         // knapp ueber die Lippe
          var ax = k.x + k.tx * laengs + k.nx * quer;
          var az = k.z + k.tz * laengs + k.nz * quer;
          var top = heightAt(ax, az) + 0.1;
          var laenge = clamp(rr(rs, 0.30, 0.75) * M.tiefe, 6, 80);
          var dick = rr(rs, 0.10, 0.22);
          var ph = rr(rs, 0, 6.283);
          var pts = [];
          for (var q = 0; q <= 9; q++) {
            var t = q / 9;
            pts.push(new THREE.Vector3(
              ax + (fractal(t * 1.7 + ph, idx * 0.9 + st * 2.3, el.seed + 619) - 0.5) * 3 * t
                 + k.nx * t * t * 1.6,
              top - t * laenge,
              az + (fractal(idx * 0.9 + st * 2.3, t * 1.7 + ph, el.seed + 621) - 0.5) * 3 * t
                 + k.nz * t * t * 1.6));
          }
          geos.push(tubeGeo(pts,
            function (qv) { return dick * (1 - qv * 0.8); }, 4,
            function (qv, ii, col) {
              // oben erdig-dunkel, zum frei haengenden Ende hin fahl
              col.setRGB(lerp(0.33, 0.74, qv), lerp(0.28, 0.71, qv), lerp(0.21, 0.60, qv));
            }));
        }
      }
    }
    // --- Felsbrocken am Saum, auf der STEHENDEN Seite: sie stehen auf dem
    //     Boden und bekommen ueber emit ganz normal ihren Kontaktschatten.
    var rf = ortsRng(idx, 1, el.seed + 617);
    if (rf() < 0.55) {
      var bd = rr(rf, 0.8, 4.2);
      var bx = k.x - k.nx * bd, bz = k.z - k.nz * bd;
      var bh = tryPlace(occ, bx, bz, 1.1, { ignoreCorridor: true });
      if (bh !== null) {
        var bs = rr(rf, 0.6, 1.7);
        emit(el, "fels", bx, bh - 0.2, bz, rf() * 6.28,
          bs, bs * rr(rf, 0.7, 1.5), bs, tintOf(rf, 0.07));
      }
    }
  }
  // --- Schwebende Truemmer knapp unterhalb des Saums.
  //     Kontaktschatten: emit (pools.js) legt ihn nur bei |y - heightAt| <=
  //     2.2 ab. Ueber dem Abgrund liegt die Sohle mindestens 0.7 * tiefe
  //     (>= 28 Einheiten) unter dem Truemmerstueck — der Bodenschatten
  //     entfaellt also von selbst, wie bei den Schwebeinseln. Der Guard unten
  //     faengt den einzigen Sonderfall ab: ein Stueck, das durch den Versatz
  //     entlang der Kante ueber dem STEHENDEN Land landen wuerde.
  var proTr = clamp(Math.round(p.truemmer === undefined ? 2 : p.truemmer), 0, 6);
  if (proTr > 0 && kante.length > 1) {
    var gesamt = kante[kante.length - 1].s;
    var nTr = Math.max(1, Math.round(gesamt / (34 / proTr)));
    for (var tr = 0; tr < nTr; tr++) {
      var rt = ortsRng(tr, 3, el.seed + 623);
      var kk = kante[clamp(Math.round((tr + 0.5) / nTr * (kante.length - 1)),
        0, kante.length - 1)];
      var weit = kk.off + rr(rt, 1.5, M.abgrund * 0.75);
      var tx = kk.x + kk.nx * weit + kk.tx * rr(rt, -6, 6);
      var tz = kk.z + kk.nz * weit + kk.tz * rr(rt, -6, 6);
      var ty = heightAt(kk.x, kk.z) - rr(rt, 4, M.tiefe * 0.3);
      if (Math.abs(ty - heightAt(tx, tz)) <= 2.2) continue;   // stuende auf Land
      var ts = rr(rt, 0.9, 2.6);
      emit(el, "fels", tx, ty, tz, rt() * 6.28,
        ts, ts * rr(rt, 0.6, 1.2), ts, tintOf(rt, 0.06));
    }
  }
  if (geos.length) {
    var mesh = new THREE.Mesh(mergeGeos(geos), wurzelMat);
    mesh.userData.el = el;
    groupOf(el).add(mesh);
  }
}


export { pathCurve, pathSamples, BELAG, bandGeoAusLinie, bandAusLinie, bandMeshAusGeos,
  strassenZeichen, flussBreite, uebergangsZeichen,
  genStrasse, genMauer, genFluss, genHecke,
  brueche, bruchMasse, bruchDaten, genBruch,
  bruchMaskeUniforms, bruchMaskeLeeren, bruchMaskeStempeln, bruchMaskeFertig, bruchMaskeAt };
