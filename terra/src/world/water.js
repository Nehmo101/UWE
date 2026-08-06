// Wasserflaeche mit sanftem Wogen und ein kleiner Meeresboden-Teller.
// In der Distanz uebernimmt der (richtungsabhaengige) Nebel den Uebergang
// zum Himmel — die Kartenkante schneidet nicht mehr ins Bild.
import * as THREE from 'three';
import { KARTE } from '../core/store.js';
import { terraMat, tintedMats, terraUniforms } from '../render/materials.js';
import { cam, camera } from '../editor/camera.js';
// Bruchmaske (H6). Zyklusfrei: generators/paths.js zieht rng/store/pools/
// terrain/objects/materials/geometry — keines davon importiert world/water.js
// (geprueft: water.js wird nur von main.js, editor/io.js und
// world/atmosphere.js importiert).
import { bruchMaskeUniforms } from '../generators/paths.js';
// Seeflaechen (Nachtrag Runde H): see.js exportiert Materialien, Uniforms und
// Anmeldeliste; water.js — der Besitzer der Wogenformel — patcht sie unten.
// Dieselbe Richtung wie bruchMaskeUniforms eine Zeile hoeher, und aus
// demselben Grund zyklusfrei: see.js zieht rng/store/pools/terrain/biomfeld/
// wegsuche/objects/zeichen/materials — keines davon importiert world/water.js.
// Die Gegenrichtung (see.js -> water.js) drehte die Modulreihenfolge von
// main.js um; Pruefung 19 haelt fest, dass sie nicht existiert.
import { seeWogen, seeWogenAufraeumen } from '../generators/see.js';
/* Hoehenfeld fuer das Kuestenfeld (Uferabstand + Tiefe, siehe unten).
   Dieselbe Richtung und derselbe Grund wie die beiden Importe darueber:
   world/terrain.js zieht rng/store/materials/biomfeld/signaturen — keines
   davon importiert world/water.js, main.js wertet terrain.js ohnehin fuenf
   Zeilen vor water.js aus. `hgt` und `hoehenVersion` sind LEBENDE Bindungen
   (felderSichern legt `hgt` bei jedem Groessenwechsel neu an), sie duerfen
   deshalb nicht beim Modulstart in eine lokale Variable kopiert werden. */
import { hgt, hoehenVersion, rivers } from './terrain.js';

/* --- Masse mit der Kartengroesse (H1b) ----------------------------------
   Beide Flaechen muessen die Karte plus Sichtweite ueberdecken, sonst
   schneidet ihre Kante ins Bild.

   Wasser: die Ebene ist auf den Ursprung zentriert, der Kamerafokus laeuft
   bis HALF+40 nach aussen, und ab dort traegt der Nebel (fogFern 860..1150
   in den Presets) den Uebergang. Der bisherige Wert 2000 entspricht genau
   872 Einheiten Rand jenseits der Kartenkante — dieser Rand bleibt
   konstant, denn er haengt am Nebel, nicht an der Karte. 256 -> 2000
   (unveraendert), 512 -> 2256, 1024 -> 2768.
   Die Segmentdichte bleibt ebenfalls konstant (62.5 Einheiten je Segment =
   2000/32), weil updateWater() die Wellen aus Weltkoordinaten rechnet:
   groebere Segmente wuerden die Wellenlaenge (~140 Einheiten) unterabtasten.

   Meeresboden: reiner Teller unter der Karte, der Nebel schluckt seinen
   Rand. Radius waechst proportional (360 deckt die halbe 256er-Diagonale
   von 181 doppelt ab); 256 -> 360 (unveraendert), 512 -> 720, 1024 -> 1440. */
var WASSER_RAND = 872;
function wasserGroesse() { return 2 * (KARTE.half + WASSER_RAND); }
function wasserSegmente() { return Math.round(wasserGroesse() / 62.5); }
function bodenRadius() { return 360 * (KARTE.map / 256); }

function baueWasserGeo() {
  var g = new THREE.PlaneGeometry(wasserGroesse(), wasserGroesse(), wasserSegmente(), wasserSegmente());
  g.rotateX(-Math.PI / 2);
  return g;
}

/* --- Die Wogen: EINE Quelle fuer CPU und Shader (C4) ---------------------
   updateWater() verschiebt die Stuetzpunkte, der Streifen-Patch unten wertet
   dieselbe Funktion pro Fragment aus. Beide Formeln muessen exakt gleich
   bleiben — driften sie auseinander, laegen die gemalten Lichtstreifen neben
   den Wellenkaemmen. Deshalb stehen die neun Konstanten hier und NUR hier;
   die GLSL-Fassung wird daraus erzeugt.
   Die Umschreibung ist wertidentisch zur frueheren Inline-Formel: der
   zweite Term hatte `- t * 0.55` und traegt jetzt w = -0.55 (Vorzeichen-
   wechsel und Subtraktion sind in IEEE-754 dieselbe Operation).            */
var WOGE = [
  { k: 0.045, w:  0.70, amp: 0.32 },   // ueber x
  { k: 0.031, w: -0.55, amp: 0.26 },   // ueber z
  { k: 0.018, w:  0.35, amp: 0.20 }    // diagonal
];

function glslZahl(n) {
  var s = String(n);
  return (s.indexOf('.') < 0 && s.indexOf('e') < 0) ? s + '.0' : s;
}

/** GLSL-Zwilling der Wogenformel aus updateWater(). */
function wogeGLSL() {
  return 'float terraWoge( vec2 p, float t ) {\n' +
    '  return sin( p.x * ' + glslZahl(WOGE[0].k) + ' + t * ' + glslZahl(WOGE[0].w) +
      ' ) * ' + glslZahl(WOGE[0].amp) + '\n' +
    '       + sin( p.y * ' + glslZahl(WOGE[1].k) + ' + t * ' + glslZahl(WOGE[1].w) +
      ' ) * ' + glslZahl(WOGE[1].amp) + '\n' +
    '       + sin( ( p.x + p.y ) * ' + glslZahl(WOGE[2].k) + ' + t * ' + glslZahl(WOGE[2].w) +
      ' ) * ' + glslZahl(WOGE[2].amp) + ';\n' +
    '}\n';
}

/* --- Kraeuselfeld: Wellen NUR fuers Licht (Runde Wasser) ------------------
   Warum ein zweites Feld neben WOGE: die Duenung ist absichtlich flach. Ihre
   groesste Steigung ist k*amp = 0.045*0.32 = 0.014, also 0.8 Grad — eine
   Spiegelflaeche. Genau daran lag der Befund "keine lesbare Welle, kein
   Glanzlicht": auf 0.8 Grad kann kein Glanz wandern, jede Spiegelung ist
   ueberall dieselbe. Die Amplitude der Duenung ANHEBEN ist der falsche Weg —
   sie steht in WOGE, wird auf der CPU in die Stuetzpunkte geschrieben, und
   eine Ebene mit 62.5 Einheiten Segmentweite kann eine kurze Welle gar nicht
   tragen (die Wellenlaenge der Duenung ist mit ~140 Einheiten schon knapp).

   Deshalb ein Feld, das ausschliesslich die NORMALE dreht und die Geometrie
   nicht anfasst: drei schraeg laufende Sinus mit rund 10..40 Einheiten
   Wellenlaenge. Summe der Steigungen 0.069 + 0.070 + 0.071 = 0.21, also gut
   12 Grad — genug, damit die Lichtstrasse zur Sonne in einzelne Striche
   zerfaellt, wenig genug, dass die Flaeche ruhig bleibt.

   Die Richtungen sind bewusst KEINE Achsen (0.92/0.39, -0.34/0.94,
   0.68/-0.73): drei achsparallele Sinus ergaeben ein Karomuster, und genau
   das ist das Kunststoffwasser, das der Auftrag verbietet.

   Die Amplitude wird im Shader mit der Kameradistanz ausgeblendet
   (terraNah). Ohne das flimmerte die Ferne: 10 Einheiten Wellenlaenge sind
   am Horizont weit unter einem Bildpunkt. Nebenbei ist es genau der
   Bildaufbau von marnie-021 — nahe Wellen als einzelne Striche, ferne
   Wasserflaeche glatt und spiegelnd.

   Wie WOGE steht das Rezept HIER und nur hier; die GLSL-Fassung wird daraus
   erzeugt (dieselbe Regel, derselbe Grund: eine Quelle je Formel).         */
var KRAEUSEL = [
  { dx:  0.92, dz:  0.39, k: 0.230, w:  0.95, amp: 0.30 },
  { dx: -0.34, dz:  0.94, k: 0.410, w: -1.30, amp: 0.17 },
  { dx:  0.68, dz: -0.73, k: 0.155, w:  0.62, amp: 0.46 }
];

/** GLSL: liefert vec3( Steigung.x, Steigung.z, Hoehe ) des Kraeuselfeldes.
 *  Hoehe und Ableitung fallen im selben sin/cos-Paar an — getrennt gerechnet
 *  waeren es doppelt so viele Winkelfunktionen. */
function kraeuselGLSL() {
  var s = 'vec3 terraKraeusel( vec2 p, float t ) {\n  vec3 s = vec3( 0.0 );\n';
  for (var i = 0; i < KRAEUSEL.length; i++) {
    var K = KRAEUSEL[i];
    var d = 'vec2( ' + glslZahl(K.dx) + ', ' + glslZahl(K.dz) + ' )';
    s += '  {\n' +
      '    float a = dot( p, ' + d + ' ) * ' + glslZahl(K.k) +
        ' + t * ' + glslZahl(K.w) + ';\n' +
      '    s.z += sin( a ) * ' + glslZahl(K.amp) + ';\n' +
      '    s.xy += cos( a ) * ' + glslZahl(K.amp * K.k) + ' * ' + d + ';\n' +
      '  }\n';
  }
  return s + '  return s;\n}\n';
}

/* ==========================================================================
   Kuestenfeld — woher das Wasser weiss, wo die Kueste ist

   Der Befund: "fast einfarbige Flaeche, harter Farbwechsel an der Uferlinie".
   Beides hat DIESELBE Ursache — die Wasserebene ist ein Rechteck bei y = 0
   und kennt das Gelaende nicht. Sie kann deshalb weder flach von tief
   unterscheiden noch wissen, wo Brandung hingehoert.

   Also dasselbe Muster wie die Bruchmaske in generators/paths.js: EIN
   Rasterbild in Weltkoordinaten, im Fragment abgetastet. Zwei Kanaele:

     R  Uferabstand, 0 an der Wasserlinie, 1 ab UFER_WEITE Einheiten drausssen.
        Gerechnet als echte Distanztransformation (Chamfer, zwei Durchlaeufe)
        vom Land ins Wasser — NICHT aus der Tiefe abgeleitet. Grund: die
        Brandung ist an einer Steilkueste genauso breit wie am Strand
        (anno-03 zeigt genau das: Gischt am Fels, Gischt am Sand). Aus der
        Tiefe abgeleitet waere sie am Fels unsichtbar.

     G  Wassertiefe, 0 am Spiegel, 1 ab TIEFE_REF Einheiten Tiefe. Sie und
        nur sie treibt die FARBE: tuerkis, wo der Grund nah ist (anno-06),
        dunkelblau drausssen. An der Steilkueste steht das dunkle Blau
        richtigerweise direkt am Fels.

   AUFLOESUNG: hoechstens 257 x 257 Texel, egal wie gross die Karte ist. Der
   Schritt waechst mit (256er Karte 1, 512er 2, 1024er 4), das Bild bleibt
   damit bei konstanten 132 kB und die Distanztransformation bei konstant
   rund 66000 Zellen. Feiner braucht es nicht zu sein: der Schaumsaum ist
   Meter breit, und LinearFilter glaettet die Zwischenwerte.

   FRISCHE: `hoehenVersion` (world/terrain.js) zaehlt jeden Schreibzugriff auf
   `base`, `rivers.length` faengt neu gezogene oder geloeschte Fluesse. Beides
   ist ein Zahlenvergleich je Bild. Gedrosselt auf hoechstens fuenf Neubauten
   je Sekunde, damit ein gezogener Pinsel nicht 60 mal je Sekunde eine
   Distanztransformation ausloest; ein Uferstrich haengt dabei bis zu 200 ms
   nach, was waehrend des Ziehens niemand sieht.
   BEKANNTE GRENZE: `recomputeHeights` zaehlt bewusst NICHT mit (Begruendung
   in terrain.js bei hoehenVersion). Ein Flusseinschnitt, der eine Muendung
   unter den Spiegel legt, ohne dass danach `base` angefasst wird, bekommt
   seinen Schaum erst beim naechsten Gelaende-Schreibzugriff — die Zahl der
   Fluesse deckt den haeufigen Fall (Fluss gezogen/geloescht) bereits ab.
   ========================================================================== */
var KUESTE_KANTE = 257;    // Zielkante der Textur in Texeln
var UFER_WEITE = 34;       // Welteinheiten bis "offene See" (Kanal R)
var TIEFE_REF = 15;        // Welteinheiten bis "tief" (Kanal G)
var KUESTE_DROSSEL = 0.20; // Sekunden zwischen zwei Neubauten

// 1x1-Platzhalter wie BRUCH_LEER in paths.js: solange kein Feld steht, zeigt
// das Uniform hierauf und uKuesteAn ist 0 — der ganze Fragmentzweig faellt
// uniform-kohaerent weg und das Wasser ist wieder die offene See von vorher.
var KUESTE_LEER = new THREE.DataTexture(new Uint8Array(2), 1, 1,
  THREE.RGFormat, THREE.UnsignedByteType);
KUESTE_LEER.unpackAlignment = 1;
KUESTE_LEER.needsUpdate = true;

var kuesteRoh = null;      // Uint8Array(n*n*2), verschraenkt: Ufer, Tiefe
var kuesteTex = null;
var kuesteN = 0;           // Kantenlaenge in Texeln
var kuesteDist = null;     // Float32Array(n*n) Arbeitsfeld der Transformation
var kuesteStand = -1;      // zuletzt verarbeitete hoehenVersion
var kuesteFluss = -1;      // zuletzt verarbeitete rivers.length
var kuesteUhr = 0;         // Zeitpunkt des letzten Neubaus (Sekunden)

var kuestenUniforms = {
  uKuesteFeld: { value: KUESTE_LEER },
  uKuesteAbb: { value: new THREE.Vector2(1 / 257, 128.5 / 257) },
  uKuesteAn: { value: 0 },
  /* Tempo der NEUEN Bewegungen (Kraeuselung, Kaustik, atmende Brandung).
     0 bei prefers-reduced-motion. Die Duenung selbst bleibt davon
     unberuehrt — sie lief schon vorher und ihr Verhalten aendert diese
     Runde nicht. */
  uKuestenTempo: { value: 1 },
  /* Tiefenfarbe als FAKTOR auf material.color, nicht als feste Farbe: die
     Tageszeit schreibt `wasser` aus den Presets in waterMat.color
     (world/atmosphere.js, applyTod). Feste Farben haetten das Abendrot und
     die Nacht ueberschrieben. */
  uWasserFlach: { value: new THREE.Vector3(1.72, 1.44, 1.16) },
  uWasserTief: { value: new THREE.Vector3(0.36, 0.55, 0.74) },
  uSpiegel: { value: 0.50 },   // Anteil Himmel bei streifendem Blick
  uGlanz: { value: 0.85 }      // Staerke der Lichtstrasse zur Sonne
};

/** Legt Feld und Textur an — und bei abweichender Kante NEU an (gleicher
 *  Grund wie bei bruchMaskeSichern: die Weltabbildung haengt an der Groesse,
 *  ein zu grosses Feld waere nicht harmlos, sondern verschoben). */
function kuesteSichern(n) {
  if (kuesteRoh && kuesteN === n && kuesteRoh.length === n * n * 2) return;
  if (kuesteTex) kuesteTex.dispose();
  kuesteN = n;
  kuesteRoh = new Uint8Array(n * n * 2);
  kuesteDist = new Float32Array(n * n);
  var t = new THREE.DataTexture(kuesteRoh, n, n, THREE.RGFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;    // ohne Mipmaps wie die Bruchmaske
  t.generateMipmaps = false;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.NoColorSpace;   // Datenkanaele, keine Farbe
  t.unpackAlignment = 1;               // 2*257 Byte je Zeile, nicht 4-teilbar
  kuesteTex = t;
  kuestenUniforms.uKuesteFeld.value = t;
}

/**
 * Baut Uferabstand und Tiefe aus dem Hoehenfeld.
 *
 * Determinismus: liest ausschliesslich `hgt`, kein Zufall, keine Zeit.
 * Gleicher Seed -> gleiches Gelaende -> gleiches Kuestenfeld.
 */
function kuesteBauen() {
  var vw = KARTE.vw, half = KARTE.half;
  if (!hgt || hgt.length < vw * vw) { kuestenUniforms.uKuesteAn.value = 0; return; }
  var schritt = Math.max(1, Math.ceil((vw - 1) / (KUESTE_KANTE - 1)));
  var n = Math.floor((vw - 1) / schritt) + 1;
  kuesteSichern(n);
  var d = kuesteDist, roh = kuesteRoh, land = false;
  var GROSS = 1e9;

  // Saat: Landzellen sind 0, Wasserzellen unendlich weit weg.
  for (var b = 0; b < n; b++) {
    var zeile = (b * schritt) * vw, ab = b * n;
    for (var a = 0; a < n; a++) {
      var h = hgt[zeile + a * schritt];
      if (h > 0) { d[ab + a] = 0; land = true; } else { d[ab + a] = GROSS; }
      var tief = (0 - h) / TIEFE_REF;
      roh[(ab + a) * 2 + 1] = tief <= 0 ? 0 : (tief >= 1 ? 255 : (tief * 255) | 0);
    }
  }

  /* Ohne eine einzige Landzelle gibt es keine Kueste — dann bleibt das Feld
     aus und das Wasser ist wieder gleichfoermige offene See. Wichtig fuer den
     Startzustand: solange genBase noch nicht gelaufen ist, ist `hgt` ueberall
     0 und jede Zelle waere "Wasser ohne Ufer". */
  if (!land) { kuestenUniforms.uKuesteAn.value = 0; return; }

  // Chamfer-Distanz, zwei Durchlaeufe. Zellabstand ist der Weltabstand der
  // Abtastung, die Distanz kommt damit direkt in Welteinheiten heraus.
  var ort = schritt, dia = schritt * 1.4142135623730951;
  for (b = 0; b < n; b++) {
    var r0 = b * n;
    for (a = 0; a < n; a++) {
      var i0 = r0 + a, v = d[i0];
      if (v === 0) continue;
      if (a > 0 && d[i0 - 1] + ort < v) v = d[i0 - 1] + ort;
      if (b > 0) {
        if (d[i0 - n] + ort < v) v = d[i0 - n] + ort;
        if (a > 0 && d[i0 - n - 1] + dia < v) v = d[i0 - n - 1] + dia;
        if (a < n - 1 && d[i0 - n + 1] + dia < v) v = d[i0 - n + 1] + dia;
      }
      d[i0] = v;
    }
  }
  for (b = n - 1; b >= 0; b--) {
    var r1 = b * n;
    for (a = n - 1; a >= 0; a--) {
      var i1 = r1 + a, u = d[i1];
      if (u === 0) { roh[i1 * 2] = 0; continue; }
      if (a < n - 1 && d[i1 + 1] + ort < u) u = d[i1 + 1] + ort;
      if (b < n - 1) {
        if (d[i1 + n] + ort < u) u = d[i1 + n] + ort;
        if (a < n - 1 && d[i1 + n + 1] + dia < u) u = d[i1 + n + 1] + dia;
        if (a > 0 && d[i1 + n - 1] + dia < u) u = d[i1 + n - 1] + dia;
      }
      d[i1] = u;
      var f = u / UFER_WEITE;
      roh[i1 * 2] = f >= 1 ? 255 : (f * 255) | 0;
    }
  }

  /* Texel (a,b) liegt auf Weltpunkt (a*schritt - half, b*schritt - half),
     sein Mittelpunkt also bei uv = (a+0.5)/n. Aufgeloest nach uv(weltXZ):
     uv = weltXZ / (schritt*n) + (half/schritt + 0.5)/n — dieselbe Bauart wie
     uBruchAbb in generators/paths.js. */
  kuestenUniforms.uKuesteAbb.value.set(1 / (schritt * n), (half / schritt + 0.5) / n);
  kuesteTex.needsUpdate = true;
  kuestenUniforms.uKuesteAn.value = 1;
}

/** O(1)-Frischepruefung je Bild, hinter der Drossel. */
function kuestePruefen(jetzt) {
  if (hoehenVersion === kuesteStand && rivers.length === kuesteFluss) return;
  if (jetzt - kuesteUhr < KUESTE_DROSSEL) return;
  kuesteUhr = jetzt;
  kuesteStand = hoehenVersion;
  kuesteFluss = rivers.length;
  kuesteBauen();
}

/* Bewegungsvorgabe des Systems. Wie in world/weltleben.js gelesen und wie
   dort einmal beim Modulstart — Terra kennt keinen Wechsel zur Laufzeit. */
if (typeof window !== 'undefined' && window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  kuestenUniforms.uKuestenTempo.value = 0;
}

/* --- C4: gemalte Himmelsspiegelung ---------------------------------------
   Ghibli-Wasser ist Farbflaeche plus Akzente, keine Spiegelung. Statt eines
   zweiten Renderdurchgangs mit gespiegelter Kamera bekommt das Wasser wenige
   helle Striche, die mit der Woge wandern:

   1. Die Kaemme der Woge (terraWoge in WELTkoordinaten, exakt dieselbe
      Formel wie die CPU-Verschiebung) liefern breite Baender.
   2. Eine zweite, sehr niederfrequente Modulation bricht die Baender in
      einzelne Striche — eine durchgehende Linie ueber die halbe Karte waere
      genau das Streifenmuster, das der Look verbietet.
   3. Die Staerke haengt am Betrachtungswinkel: streifender Blick sieht viel
      Himmel im Wasser, der Blick von oben fast keinen.
   4. Die Farbe ist die Horizontfarbe des Himmels (terraUniforms.uHorizont,
      von setLook aus der Tageszeit gespeist) — die Striche sind morgens
      warm, nachts kuehl, ohne dass hier etwas nachgezogen werden muss.

   Der Beitrag geht additiv auf reflectedLight.indirectDiffuse (Anker
   #include <lights_fragment_end>, wie Rimlight und Arborlicht in
   materials.js): dort ist die Beleuchtung fertig, der Strich wird also NICHT
   noch einmal mit der Diffusfarbe des Wassers multipliziert.               */
var streifUniforms = {
  uWasserZeit: { value: 0 },
  uStreifStaerke: { value: 0.30 },
  uStreifSchwelle: { value: 0.34 },
  /* Saum an der Wasserkante (Runde Bildgrundlage).
     Die Ebene endet bei HALF + WASSER_RAND, und der Nebel bringt sie dort
     NICHT ganz auf Himmelsfarbe: bei fogFern 980 (mittag) und einer Kante
     bei 1000 Einheiten liegt der Nebelfaktor am Rand bei rund 0.85. Die
     restlichen 15 % Wasserfarbe stiessen ungemildert an die Kuppel — genau
     der harte Tonwertsprung, den man in wasser-kueste, wald-nah und
     berg-schnee als messerscharfe Horizontlinie sah (unter ihr dunkles Teal,
     ueber ihr helle Luft, dazwischen nichts).
     Der Saum zieht die letzten Einheiten aktiv in die Horizontfarbe. Die
     Kante ist ein QUADRAT (PlaneGeometry), das Mass ist deshalb
     max(|x|,|z|) und nicht die Laenge — sonst blendete es an den Ecken zu
     frueh und an den Seitenmitten zu spaet.
     Kosten: ein smoothstep und ein mix im vorhandenen Fragment. */
  uWasserSaum: { value: new THREE.Vector2(1, 2) }
};

/** Setzt das Saumband auf die aktuelle Kartengroesse (letzte ~230 Einheiten
 *  vor der Kante; die letzten 15 sind voll Horizontfarbe, damit die
 *  Geometriekante selbst nie sichtbar wird). */
function saumSetzen() {
  var rand = KARTE.half + WASSER_RAND;
  streifUniforms.uWasserSaum.value.set(rand - 245, rand - 15);
}
saumSetzen();

/* ==========================================================================
   Das Meer in vier Bloecken

   Alle vier stehen in main() DESSELBEN Fragmentshaders und laufen in der
   Reihenfolge, in der Three seine Chunks einbindet. Was ein frueherer Block
   deklariert, steht den spaeteren zur Verfuegung — deshalb wird das
   Kuestenfeld genau EINMAL abgetastet und die Kraeuselung genau EINMAL
   gerechnet, obwohl Farbe, Normale, Glanz und Spiegelung sie alle brauchen.

     A  #include <color_fragment>       Tiefenfarbe, Kaustik, Brandungssaum
     B  #include <normal_fragment_maps> Normale aus dem Kraeuselfeld
     C  #include <lights_fragment_end>  Lichtstrasse zur Sonne (additiv)
     D  #include <opaque_fragment>      Himmelsspiegelung (Mischung)

   Warum die Spiegelung eine MISCHUNG ist und keine Addition: die alte Fassung
   addierte Himmelsfarbe auf reflectedLight.indirectDiffuse. Bei streifendem
   Blick — genau dort, wo Spiegelung stark sein muss — landet man damit auf
   Wasserfarbe PLUS Himmelsfarbe und das Meer wird milchig hell. Physikalisch
   ist Fresnel eine Aufteilung: was gespiegelt wird, dringt nicht ein. Hinter
   #include <opaque_fragment> steht die fertige Farbe in gl_FragColor, dort
   ist die Mischung ein Einzeiler und kann per Bauart nicht ueberstrahlen.
   Der Anker liegt VOR <fog_fragment>, die Spiegelung wird also korrekt
   mitvernebelt.

   Der GLANZ dagegen bleibt additiv: eine Lichtstrasse ist gestreutes
   Sonnenlicht obendrauf, keine Umverteilung.
   ========================================================================== */

/* A — Kuestenfeld lesen, daraus Farbe, Kaustik und Schaum.
   Referenzlage: anno-06 (tuerkise Bank mit Kaustik, dunkles Blau drausssen),
   anno-03 (weisser Gischtring, der der Inselform folgt). */
var MEER_A =
  'float terraKZeit = uWasserZeit * uKuestenTempo;\n' +
  // Vorgabe (1,1) = offene, tiefe See. Ohne Kuestenfeld sieht das Meer
  // deshalb aus wie vor dieser Runde, nur mit Spiegelung.
  'vec2 terraKF = vec2( 1.0 );\n' +
  'if ( uKuesteAn > 0.0 ) {\n' +
  '  vec2 terraKUV = vTerraW.xz * uKuesteAbb.x + uKuesteAbb.y;\n' +
  /* Ausserhalb der Karte klemmt ClampToEdge auf die Randtexel. Laeuft der
     Kontinent ueber den Kartenrand hinaus, schmierte sein Randtexel (Ufer 0)
     den Schaumsaum ueber den kompletten 872-Einheiten-Rand der Wasserebene.
     Dieselbe Falle und derselbe Griff wie bei der Bruchmaske weiter unten —
     nur weich statt hart, damit die Kante selbst nicht sichtbar wird. */
  '  vec2 terraKIn = smoothstep( vec2( 0.0 ), vec2( 0.02 ), terraKUV )\n' +
  '    * smoothstep( vec2( 1.0 ), vec2( 0.98 ), terraKUV );\n' +
  '  terraKF = mix( vec2( 1.0 ), texture2D( uKuesteFeld, terraKUV ).rg,\n' +
  '    terraKIn.x * terraKIn.y );\n' +
  '}\n' +
  'float terraUfer = terraKF.x;\n' +      // 0 an der Wasserlinie, 1 offene See
  'float terraTiefe = terraKF.y;\n' +     // 0 am Spiegel, 1 tief
  'vec3 terraKrF = terraKraeusel( vTerraW.xz, terraKZeit );\n' +
  // Tiefenfarbe: zwei Mischungen ueber material.color, damit die Tageszeit
  // (waterMat.color) den Grundton behaelt.
  'vec3 terraWF = mix( diffuse * uWasserFlach, diffuse,\n' +
  '  smoothstep( 0.02, 0.34, terraTiefe ) );\n' +
  'terraWF = mix( terraWF, diffuse * uWasserTief,\n' +
  '  smoothstep( 0.34, 0.90, terraTiefe ) );\n' +
  /* Kaustik: zwei gekreuzte Sinus ergeben das typische Lichtnetz auf dem
     Grund, die Kraeuselung bricht es unregelmaessig auf. Nur auf der Bank —
     ab rund acht Einheiten Tiefe erreicht kein Licht mehr den Boden. */
  'float terraKau = sin( vTerraW.x * 0.255 + vTerraW.z * 0.075 + terraKZeit * 0.55 )\n' +
  '  * sin( vTerraW.z * 0.232 - vTerraW.x * 0.061 - terraKZeit * 0.43 );\n' +
  'terraKau = smoothstep( 0.10, 0.85, terraKau + terraKrF.z * 0.35 )\n' +
  '  * ( 1.0 - smoothstep( 0.05, 0.55, terraTiefe ) );\n' +
  /* Brandung in zwei Lagen: ein schmaler, immer geschlossener Saum direkt an
     der Wasserlinie (rund zwei Einheiten) und eine breitere Zunge bis rund
     sechseinhalb Einheiten, deren Kante mit der Kraeuselung ein- und
     auslaeuft. Die Zunge allein risse an ruhigen Stellen auf und die
     Uferlinie fiele wieder als harte Farbkante auseinander; der schmale Saum
     allein waere ein aufgeklebter Ring. */
  'float terraSchaum = max(\n' +
  '  1.0 - smoothstep( 0.0, 0.055, terraUfer ),\n' +
  '  0.82 * ( 1.0 - smoothstep( 0.03, 0.19, terraUfer + terraKrF.z * 0.055 ) ) );\n' +
  // Schaum ist nicht reinweiss, sondern nimmt die Himmelsfarbe auf: nachts
  // grau-blau, im Abendrot warm. Sonst leuchtete er im Dunkeln.
  'vec3 terraSchaumF = uHorizont * 0.40 + vec3( 0.55 );\n' +
  'diffuseColor.rgb = mix( terraWF + terraSchaumF * ( terraKau * 0.17 ),\n' +
  '  terraSchaumF, terraSchaum );\n' +
  /* Der weiche Uebergang Land/Wasser: im Flachen wird die Ebene fast
     durchsichtig, der nasse Grund traegt die Farbe. Dadurch gibt es an der
     Uferlinie keinen Farbsprung mehr, sondern ein Auslaufen — und darueber
     liegt der Schaum, der fast deckt. */
  'diffuseColor.a = mix( diffuseColor.a\n' +
  '  * mix( 0.28, 1.0, smoothstep( 0.0, 0.40, terraTiefe ) ), 0.96, terraSchaum );\n';

/* B — Normale. Ersetzt die frueher hier abgeleitete Flaechennormale: die
   Wasserebene hat 62.5 Einheiten Segmentweite und traegt die Duenung
   (Wellenlaenge ~140) mit knapp zwei Abtastungen je Welle. Was dFdx daraus
   las, war die Facettennormale des Gitters, nicht die der Welle. Analytisch
   aus dem Kraeuselfeld ist es je Fragment richtig und billiger als der
   Ableitungspaar-Umweg. */
var MEER_B =
  'float terraNah = 1.0 - smoothstep( 70.0, 340.0, length( cameraPosition - vTerraW ) );\n' +
  'vec2 terraStg = terraKrF.xy * terraNah;\n' +
  'vec3 terraNW = normalize( vec3( -terraStg.x, 1.0, -terraStg.y ) );\n' +
  'normal = normalize( ( viewMatrix * vec4( terraNW, 0.0 ) ).xyz );\n';

/* C — Lichtstrasse zur Sonne (marnie-021). Ausgewertet wird die
   Spiegelrichtung gegen uSunDir, nicht ein Phong-Glanzpunkt: dadurch steht
   die Strasse dort, wo die Sonne wirklich steht, und wandert mit der
   Tageszeit. Fern ein breiter, ruhiger Balken, nah in einzelne Striche
   zerlegt — genau die Staffelung der Vorlage, und zugleich das, was das
   Flimmern verhindert (die Kraeuselung ist in der Ferne ausgeblendet, also
   muss dort der Exponent klein sein, sonst bliebe ein harter Punkt).
   Auf dem Schaum wird sie ausgeblendet: Gischt spiegelt nicht. */
var MEER_C =
  'vec3 terraBlickW = normalize( cameraPosition - vTerraW );\n' +
  'float terraFres = pow( 1.0 - clamp( dot( terraBlickW, terraNW ), 0.0, 1.0 ), 3.0 );\n' +
  'float terraSonneA = max( dot( reflect( -terraBlickW, terraNW ), uSunDir ), 0.0 );\n' +
  'float terraGlitzer = pow( terraSonneA, mix( 22.0, 150.0, terraNah ) );\n' +
  // Die Striche sitzen auf den Kaemmen von Duenung UND Kraeuselung — die
  // Duenung liefert die grosse Staffelung, die Kraeuselung das Aufbrechen.
  'float terraKamm = smoothstep( uStreifSchwelle - 0.55, uStreifSchwelle + 0.25,\n' +
  '  terraWoge( vTerraW.xz, uWasserZeit ) + terraKrF.z * 0.55 );\n' +
  'reflectedLight.indirectDiffuse += uHorizont * uGlanz * terraGlitzer\n' +
  '  * ( 0.28 + 0.72 * terraKamm ) * ( 1.0 - terraSchaum );\n';

/* D — Himmelsspiegelung als Naeherung (marnie-009: das Wasser IST der
   Himmel). Kein zweiter Renderdurchgang mit gespiegelter Kamera — der
   kostete eine komplette Szene. Stattdessen ein Zweiton-Himmel: streifend
   die Horizontfarbe (uHorizont, von setLook aus der Tageszeit gespeist),
   steil ein dunkleres, blaueres Zenitgrau daraus abgeleitet. Der Faktor
   bleibt an uHorizont haengen und wandert damit von selbst durch den Tag.
   uStreifStaerke bleibt der Hauptschalter (setStreifen), damit ein Nutzer,
   der die gemalten Akzente abstellt, auch die Spiegelung abstellt. */
var MEER_D =
  'vec3 terraHimmelF = mix( uHorizont * vec3( 0.50, 0.64, 0.90 ), uHorizont, terraFres );\n' +
  'float terraSpM = uSpiegel * ( 0.10 + 0.90 * terraFres ) * ( 1.0 - terraSchaum )\n' +
  '  * step( 0.001, uStreifStaerke );\n' +
  'gl_FragColor.rgb = mix( gl_FragColor.rgb, terraHimmelF, terraSpM );\n' +
  // Spiegelnde Flaechen sind blickdicht: wo viel Himmel steht, darf der
  // Meeresboden nicht mehr durchscheinen.
  'gl_FragColor.a = mix( gl_FragColor.a, 0.94, terraSpM * 0.7 );\n';

/** Leitet die Normale direkt aus der bereits verformten Wasseroberflaeche ab.
 *  Nur noch fuer die Seeflaechen (generators/see.js): dort sind es viele
 *  kleine, dicht unterteilte Netze, deren Flaechennormale die Woge wirklich
 *  traegt. Das Meer geht seit dieser Runde ueber MEER_B (analytisch). */
function patchWasserNormale(shader) {
  var anker = '#include <normal_fragment_maps>';
  if (shader.fragmentShader.indexOf(anker) < 0) {
    console.warn('terra: Shader-Patch "wassernormale" fand seinen Anker nicht.');
    return;
  }
  shader.fragmentShader = shader.fragmentShader.replace(anker, anker +
    '\nvec3 terraWasserN = normalize( cross( dFdx( vViewPosition ), dFdy( vViewPosition ) ) );' +
    '\nif ( dot( terraWasserN, normal ) < 0.0 ) terraWasserN = -terraWasserN;' +
    '\nnormal = normalize( mix( normal, terraWasserN, 0.68 ) );');
}

/**
 * Haengt die vier Meeresbloecke ein.
 *
 * ALLES ODER NICHTS: fehlt ein Anker, wird KEIN Block eingehaengt. Die
 * Bloecke bauen aufeinander auf (B braucht terraKrF aus A, C braucht terraNW
 * aus B, D braucht terraFres aus C) — ein einzelner fehlender Anker
 * hinterliesse sonst einen Shader, der auf undeklarierte Namen zugreift und
 * gar nicht mehr uebersetzt. Lieber das Wasser von vor dieser Runde als ein
 * schwarzes Bild. Deshalb werden erst alle Anker geprueft, dann ersetzt.
 */
function patchMeer(shader) {
  shader.uniforms.uHorizont = terraUniforms.uHorizont;
  shader.uniforms.uWasserZeit = streifUniforms.uWasserZeit;
  shader.uniforms.uStreifStaerke = streifUniforms.uStreifStaerke;
  shader.uniforms.uStreifSchwelle = streifUniforms.uStreifSchwelle;
  shader.uniforms.uWasserSaum = streifUniforms.uWasserSaum;
  shader.uniforms.uKuesteFeld = kuestenUniforms.uKuesteFeld;
  shader.uniforms.uKuesteAbb = kuestenUniforms.uKuesteAbb;
  shader.uniforms.uKuesteAn = kuestenUniforms.uKuesteAn;
  shader.uniforms.uKuestenTempo = kuestenUniforms.uKuestenTempo;
  shader.uniforms.uWasserFlach = kuestenUniforms.uWasserFlach;
  shader.uniforms.uWasserTief = kuestenUniforms.uWasserTief;
  shader.uniforms.uSpiegel = kuestenUniforms.uSpiegel;
  shader.uniforms.uGlanz = kuestenUniforms.uGlanz;
  /* vTerraW liefert Patch (3) von terraPatch (Weltposition als Varying) —
     und mit ihm im selben Kopf uSunDir, das Block C liest. Beides steht oder
     faellt gemeinsam, eine Pruefung reicht. */
  if (shader.fragmentShader.indexOf('varying vec3 vTerraW;') < 0) {
    console.warn('terra: Shader-Patch "meer" findet kein vTerraW — ' +
      'das Wasser bleibt ohne Tiefenfarbe, Schaum und Spiegelung.');
    return;
  }
  var A = '#include <color_fragment>', B = '#include <normal_fragment_maps>';
  var C = '#include <lights_fragment_end>', D = '#include <opaque_fragment>';
  var fehlt = [A, B, C, D].filter(function (a) {
    return shader.fragmentShader.indexOf(a) < 0;
  });
  if (fehlt.length) {
    console.warn('terra: Shader-Patch "meer" fand seinen Anker nicht (' +
      fehlt.join(', ') + ') — das Wasser bleibt ohne Tiefenfarbe, Schaum ' +
      'und Spiegelung.');
    return;
  }
  shader.fragmentShader = 'uniform vec3 uHorizont;\nuniform float uWasserZeit;\n' +
    'uniform float uStreifStaerke;\nuniform float uStreifSchwelle;\n' +
    'uniform vec2 uWasserSaum;\nuniform sampler2D uKuesteFeld;\n' +
    'uniform vec2 uKuesteAbb;\nuniform float uKuesteAn;\n' +
    'uniform float uKuestenTempo;\nuniform vec3 uWasserFlach;\n' +
    'uniform vec3 uWasserTief;\nuniform float uSpiegel;\nuniform float uGlanz;\n' +
    wogeGLSL() + kraeuselGLSL() +
    shader.fragmentShader
      .replace(A, A + '\n' + MEER_A)
      .replace(B, B + '\n' + MEER_B)
      .replace(C, C + '\n' + MEER_C)
      .replace(D, D + '\n' + MEER_D);
  /* Der Saum muss NACH dem Nebel liegen — er ist das letzte Wort ueber die
     Kante. Anker ist deshalb #include <dithering_fragment>: im Phong-
     Fragmentshader steht es hinter <fog_fragment>, und dort ist gl_FragColor
     fertig. (Denselben Anker benutzt render/materials.js schon fuer die
     Kartensichtbarkeit — er ist in phong wie in basic vorhanden.)
     Auch die Deckung wird mitgezogen: das Wasser ist transparent (0.68), an
     der aeussersten Kante soll aber die Horizontfarbe voll stehen, sonst
     schiene die Kuppel durch und der Sprung waere nur verschoben. */
  var dith = '#include <dithering_fragment>';
  if (shader.fragmentShader.indexOf(dith) < 0) {
    console.warn('terra: Shader-Patch "wassersaum" fand seinen Anker nicht — ' +
      'die Wasserkante bleibt hart gegen den Himmel.');
    return;
  }
  shader.fragmentShader = shader.fragmentShader.replace(dith, dith + '\n' +
    'float terraSaum = smoothstep( uWasserSaum.x, uWasserSaum.y,\n' +
    '  max( abs( vTerraW.x ), abs( vTerraW.z ) ) );\n' +
    'gl_FragColor.rgb = mix( gl_FragColor.rgb, uHorizont, terraSaum );\n' +
    'gl_FragColor.a = mix( gl_FragColor.a, 1.0, terraSaum );');
}

/** Umhuellt onBeforeCompile/customProgramCacheKey wie bruchAusschnitt und
 *  koexistiert mit ihm: die Patches haengen an verschiedenen Ankern
 *  (color/normal/lights/opaque bzw. alphatest_fragment) und schreiben jeweils
 *  HINTER ihren Anker, der dabei erhalten bleibt. Die Reihenfolge der
 *  Umhuellung ist deshalb egal. Der Cache-Schluessel muss wie dort mitwachsen. */
function himmelsStreifen(mat) {
  var vorher = mat.onBeforeCompile;
  mat.onBeforeCompile = function (shader) {
    if (vorher) vorher.call(this, shader);
    patchMeer(shader);
  };
  var schluessel = mat.customProgramCacheKey;
  mat.customProgramCacheKey = function () {
    return (schluessel ? schluessel.call(this) : '') + '|streif';
  };
  return mat;
}

/** Staerke der gemalten Wasserakzente (0 = aus, Default 0.30). Schaltet seit
 *  dieser Runde auch die Himmelsspiegelung mit ab (Block D) — beides ist
 *  derselbe Griff, "gemaltes Licht auf dem Wasser". */
function setStreifen(staerke) {
  streifUniforms.uStreifStaerke.value =
    (typeof staerke === 'number' && staerke > 0) ? staerke : 0;
}

/* --- C4b: die Seeflaeche lebt (Nachtrag Runde H) --------------------------
   Die Binnenseen (generators/see.js) standen bisher voellig still: keine
   Wogen, keine Himmelsstreifen. Beides kommt aus DIESEM Modul, denn hier
   stehen die neun Wogenkonstanten, und sie duerfen nur hier stehen (C4).

   Anders als beim Meer laeuft die Bewegung NICHT ueber die CPU: das Meer
   verschiebt je Bild ~1100 Stuetzpunkte und laedt den Puffer neu hoch — fuer
   eine kartenfuellende Ebene mit einem einzigen Mesh ist das der richtige
   Weg. Seen sind viele kleine Meshes (je bis ~320 Punkte), die mit Undo
   kommen und gehen; eine CPU-Schleife darueber muesste eine Liste pflegen
   UND je Bild Puffer hochladen. Stattdessen verschiebt der VERTEXSHADER mit
   exakt derselben Formel (wogeGLSL — die eine Quelle fuer alles, was wogt),
   gedaempft ueber uSeeWoge. Je Bild kostet das nur die Uhr: see.js schreibt
   uSeeZeit pro gerendertem Seemesh in onBeforeRender (siehe dort), ohne See
   laeuft nichts.

   Die Daempfung sitzt NUR in der Verschiebung, nicht in der Kammsuche der
   Streifen: eine gleichmaessig skalierte Woge hat ihre Kaemme an denselben
   Stellen, die Striche sitzen also auch gedaempft exakt auf den Kaemmen.

   Objektraum == Weltraum: see.js baut seine Flaechen in Weltkoordinaten und
   haengt sie in eine unverschobene Elementgruppe — `transformed.xz` IST die
   Weltlage, ohne modelMatrix-Umweg. Die Streifen im Fragment nutzen wie beim
   Meer das Varying vTerraW aus terraPatch (3).

   Der Saum bekommt nur die Verschiebung (gleiche Uhr, gleiche Formel — er
   klebt dadurch auf der Flaeche), die Streifen nur die Flaeche: eine
   Brandungsborte mit Himmelsstrichen darauf waere doppelt gemalt.          */
var SEE_WOGE_ANKER = '#include <begin_vertex>';

var SEE_STREIF_FRAG =
  'float terraSeeH = terraWoge( vTerraW.xz, uSeeZeit );\n' +
  'float terraSeeStreif = smoothstep( uStreifSchwelle, uStreifSchwelle + 0.16, terraSeeH );\n' +
  'float terraSeeL = 0.50 + 0.30 * sin( vTerraW.x * 0.0105 - vTerraW.z * 0.0082\n' +
  '  + uSeeZeit * 0.11 ) + 0.20 * sin( vTerraW.x * 0.021 - vTerraW.z * 0.017\n' +
  '  - uSeeZeit * 0.07 );\n' +
  'terraSeeStreif *= smoothstep( 0.38, 0.82, terraSeeL );\n' +
  'float terraSeeB = 1.0 - abs( dot( normalize( vViewPosition ), normal ) );\n' +
  'terraSeeStreif *= 0.15 + 0.85 * terraSeeB * terraSeeB;\n' +
  'float terraSeeLuft = smoothstep( 0.18, 0.92, terraSeeB );\n' +
  'reflectedLight.indirectDiffuse += uHorizont * uSeeStreif\n' +
  '  * ( terraSeeStreif + terraSeeLuft * 0.045 );\n';

function patchSeeWoge(shader, streifen) {
  shader.uniforms.uSeeZeit = seeWogen.uniforms.uSeeZeit;
  shader.uniforms.uSeeWoge = seeWogen.uniforms.uSeeWoge;
  if (shader.vertexShader.indexOf(SEE_WOGE_ANKER) < 0) {
    console.warn('terra: Shader-Patch "seewoge" fand seinen Anker nicht — ' +
      'die Seeflaeche steht still.');
  } else {
    shader.vertexShader = 'uniform float uSeeZeit;\nuniform float uSeeWoge;\n' + wogeGLSL() +
      shader.vertexShader.replace(SEE_WOGE_ANKER, SEE_WOGE_ANKER +
        '\ntransformed.y += terraWoge( transformed.xz, uSeeZeit ) * uSeeWoge;');
  }
  if (!streifen) return;
  patchWasserNormale(shader);
  shader.uniforms.uHorizont = terraUniforms.uHorizont;
  shader.uniforms.uSeeStreif = seeWogen.uniforms.uSeeStreif;
  shader.uniforms.uStreifSchwelle = streifUniforms.uStreifSchwelle;
  // vTerraW liefert Patch (3) von terraPatch (Weltposition als Varying).
  if (shader.fragmentShader.indexOf('varying vec3 vTerraW;') < 0) {
    console.warn('terra: Shader-Patch "seestreifen" findet kein vTerraW — ' +
      'der See bleibt ohne gemalte Himmelsspiegelung.');
    return;
  }
  var anker = '#include <lights_fragment_end>';
  if (shader.fragmentShader.indexOf(anker) < 0) {
    console.warn('terra: Shader-Patch "seestreifen" fand seinen Anker nicht — ' +
      'der See bleibt ohne gemalte Himmelsspiegelung.');
    return;
  }
  shader.fragmentShader = 'uniform vec3 uHorizont;\nuniform float uSeeZeit;\n' +
    'uniform float uSeeStreif;\nuniform float uStreifSchwelle;\n' + wogeGLSL() +
    shader.fragmentShader.replace(anker, anker + '\n' + SEE_STREIF_FRAG);
}

/** Umhuellt onBeforeCompile/customProgramCacheKey wie himmelsStreifen oben;
 *  der Cache-Schluessel MUSS mitwachsen (Begruendung bei bruchAusschnitt). */
function seeWogenAnbinden(mat, streifen) {
  var vorher = mat.onBeforeCompile;
  mat.onBeforeCompile = function (shader) {
    if (vorher) vorher.call(this, shader);
    patchSeeWoge(shader, streifen);
  };
  var schluessel = mat.customProgramCacheKey;
  mat.customProgramCacheKey = function () {
    return (schluessel ? schluessel.call(this) : '') + '|seewoge' + (streifen ? 's' : '');
  };
  return mat;
}
seeWogenAnbinden(seeWogen.flaecheMat, true);
seeWogenAnbinden(seeWogen.saumMat, false);

/* --- Bruchzonen aussparen (H6) -------------------------------------------
   Kanon: Terra ist auseinandergerissen. Eine Bruchkante (generators/paths.js)
   laesst das Terrain einseitig um 40..200 Einheiten ins Nichts fallen — die
   kartenfuellende Wasserebene bei y = 0 und der opake Meeresboden-Teller bei
   y = -24 wuerden daraus einen tiefen See mit Boden machen und alles darunter
   (Wurzelvorhaenge, schwebende Truemmer) verdecken.

   Beide Flaechen sampeln deshalb die Bruchmaske in WELTkoordinaten und
   verschwinden dort, wo sie hoch steht. Kein neues ShaderMaterial: die
   Materialien bleiben terraMat, ihr onBeforeCompile wird nur umhuellt
   (Projektkonvention: Ankerpruefung + console.warn, siehe terraPatch in
   render/materials.js).

   Zwei Spielarten:
     weich (Wasser)  — transparentes Material, also Alpha weich ausblenden und
                       erst bei voller Wirkung discarden. Die Kante treppt
                       dadurch nicht, obwohl discard binaer ist.
     hart (Teller)   — opakes Material, dort traegt kein Alpha. Der Schnitt
                       liegt bei Maske 0.5 und damit GENAU auf der Bruchkante,
                       wo das Terrain noch auf voller Hoehe steht: die harte
                       Kante des Tellers liegt unter unversehrtem Land und ist
                       von keinem Blickwinkel zu sehen. Zugleich ist das
                       Teller-Loch damit IMMER mindestens so gross wie das
                       Wasserloch (das erst bei 0.5 vollstaendig offen ist) —
                       es gibt keinen Streifen, in dem verblassendes Wasser
                       ueber fehlendem Boden schwebte, und keinen, in dem der
                       Teller durch die Abgrundwand schnitte.
   ------------------------------------------------------------------------- */
var BRUCH_FRAG =
  'if ( uBruchStaerke > 0.0 ) {\n' +
  '  vec2 terraBruchUV = vTerraW.xz * uBruchAbb.x + uBruchAbb.y;\n' +
  // Ausserhalb der Karte klemmt ClampToEdge auf die Randtexel — eine
  // Bruchkante am Kartenrand wuerde ihren Wert sonst ueber den kompletten
  // 872-Einheiten-Saum der Wasserebene schmieren. Deshalb hart auf 0 setzen.
  '  vec2 terraBruchIn = step( vec2( 0.0 ), terraBruchUV ) * step( terraBruchUV, vec2( 1.0 ) );\n' +
  '  float terraBruchM = texture2D( uBruchMaske, terraBruchUV ).r\n' +
  '    * terraBruchIn.x * terraBruchIn.y * uBruchStaerke;\n';

function patchBruchAusschnitt(shader, hart) {
  shader.uniforms.uBruchMaske = bruchMaskeUniforms.uBruchMaske;
  shader.uniforms.uBruchAbb = bruchMaskeUniforms.uBruchAbb;
  shader.uniforms.uBruchStaerke = bruchMaskeUniforms.uBruchStaerke;
  // vTerraW liefert Patch (3) von terraPatch (Weltposition als Varying).
  if (shader.fragmentShader.indexOf('varying vec3 vTerraW;') < 0) {
    console.warn('terra: Shader-Patch "bruchausschnitt" findet kein vTerraW — ' +
      'Wasser und Meeresboden werden an Bruchkanten nicht ausgespart.');
    return;
  }
  var anker = '#include <alphatest_fragment>';
  if (shader.fragmentShader.indexOf(anker) < 0) {
    console.warn('terra: Shader-Patch "bruchausschnitt" fand seinen Anker nicht — ' +
      'Wasser und Meeresboden werden an Bruchkanten nicht ausgespart.');
    return;
  }
  var kern = BRUCH_FRAG + (hart
    ? '  if ( terraBruchM > 0.5 ) discard;\n'
    : '  float terraBruchA = smoothstep( 0.12, 0.50, terraBruchM );\n' +
      '  diffuseColor.a *= 1.0 - terraBruchA;\n' +
      '  if ( terraBruchA >= 1.0 ) discard;\n') + '}\n';
  shader.fragmentShader = 'uniform sampler2D uBruchMaske;\nuniform vec2 uBruchAbb;\n' +
    'uniform float uBruchStaerke;\n' +
    shader.fragmentShader.replace(anker, anker + '\n' + kern);
}

/** Umhuellt onBeforeCompile/customProgramCacheKey eines terraMat-Materials.
 *  Der Cache-Schluessel MUSS mitwachsen: waterMat, das Teller-Material und
 *  z. B. flussMat (paths.js) liefern sonst denselben terraMat-Schluessel und
 *  koennten sich ein Programm teilen — der Ausschnitt landete dann im
 *  falschen Material oder fehlte im richtigen. */
function bruchAusschnitt(mat, hart) {
  var vorher = mat.onBeforeCompile;
  mat.onBeforeCompile = function (shader) {
    if (vorher) vorher.call(this, shader);
    patchBruchAusschnitt(shader, hart);
  };
  var schluessel = mat.customProgramCacheKey;
  mat.customProgramCacheKey = function () {
    return (schluessel ? schluessel.call(this) : '') + '|bruch' + (hart ? 'h' : 'w');
  };
  return mat;
}

/* Ohne Textur (Runde Wasser). Bis hierher lag TEX.foamEdge mit repeat 26
   auf der Ebene — also eine Kachel je 77 Welteinheiten, deren ALPHAkanal
   (0 .. 0.85) die Deckung des Wassers in grossen Flecken zerlegte. Sichtbar
   war davon kein Schaum, sondern eine gleichmaessig ueber das ganze Meer
   verteilte Marmorierung, die mit der Kueste nichts zu tun hatte — sie war
   ein Teil des Befundes "fast einfarbige Flaeche", nicht seine Abhilfe.
   Schaum sitzt seit dieser Runde da, wo Schaum hingehoert: am Ufer, aus dem
   Kuestenfeld (Block A). Der frei gewordene Texturzugriff bezahlt den
   Zugriff auf uKuesteFeld — unter dem Strich dieselbe Zahl an Abtastungen. */
var waterGeo = baueWasserGeo();
var waterMat = himmelsStreifen(bruchAusschnitt(terraMat({
  color: 0x3f93ad, transparent: true, opacity: 0.68, depthWrite: false
}), false));
var water = new THREE.Mesh(waterGeo, waterMat);
/* Empfaenger, aber kein Werfer: eine Klippe soll ihren Schatten aufs Wasser
   legen (anno-03, anno-09 leben davon), das Wasser selbst wirft keinen — es
   ist eine durchsichtige Ebene ohne depthWrite und wuerde die halbe Karte
   verschatten. */
water.receiveShadow = true;
water.position.y = 0;
water.renderOrder = 4;
water.frustumCulled = false;

// Meeresboden nur als Teller unter der Karte, nicht als bildfuellende Lage.
function baueBodenGeo() {
  var g = new THREE.CircleGeometry(bodenRadius(), 48).rotateX(-Math.PI / 2);
  var n = g.attributes.position.count, arr = new Float32Array(n * 3);
  var c = new THREE.Color(0x1f4750);
  for (var i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}
var seabedGeo = baueBodenGeo();
var seabed = new THREE.Mesh(seabedGeo, bruchAusschnitt(terraMat({ vertexColors: true }), true));
seabed.position.y = -24;
seabed.frustumCulled = false;
// Grundfarbe liegt in den Vertexfarben, material.color bleibt weiss und ist
// frei fuer den Tageszeit-Grundton — sonst bliebe der Boden bei Abendrot neutral.
tintedMats.push(seabed.material);

function initWater(scene) {
  scene.add(water);
  scene.add(seabed);
}

var waterBaseXZ = [];
function merkeWasserXZ() {
  waterBaseXZ.length = 0;
  var p = waterGeo.attributes.position;
  for (var i = 0; i < p.count; i++) waterBaseXZ.push(p.getX(i), p.getZ(i));
}
merkeWasserXZ();

/** Kartengroesse hat sich geaendert: beide Geometrien neu bauen. Die MESHES
 *  bleiben dieselben Objekte (main.js haelt eine Referenz auf `water` und
 *  schaltet dessen visible), nur ihre Geometrie wird getauscht. */
function wasserNeuBauen() {
  water.geometry.dispose();
  waterGeo = baueWasserGeo();
  water.geometry = waterGeo;
  saumSetzen();          // die Kante ist gewandert, das Saumband muss mit
  merkeWasserXZ();
  /* Das Kuestenfeld haengt an KARTE.vw/half (Schrittweite und Weltabbildung)
     und muss neu — aber NICHT hier: `hgt` traegt an dieser Stelle noch das
     alte Gelaende. Stattdessen die Frischemarken zuruecksetzen, dann baut es
     der naechste updateWater() mit dem dann gueltigen Hoehenfeld. */
  kuesteStand = -1; kuesteFluss = -1; kuesteUhr = 0;
  seabed.geometry.dispose();
  seabedGeo = baueBodenGeo();
  seabed.geometry = seabedGeo;
}

/** Wogen nur berechnen, wenn die Wasserfläche überhaupt im Bild liegt. */
var _wasserFrustum = new THREE.Frustum(), _wasserM = new THREE.Matrix4();
var _wasserBox = new THREE.Box3();
/** Wogen nur berechnen, wenn die Wasserflaeche ueberhaupt im Bild liegt. */
function wasserSichtbar(fogFar) {
  _wasserM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _wasserFrustum.setFromProjectionMatrix(_wasserM);
  var r = fogFar;
  _wasserBox.min.set(cam.focus.x - r, -1.5, cam.focus.z - r);
  _wasserBox.max.set(cam.focus.x + r, 1.5, cam.focus.z + r);
  return _wasserFrustum.intersectsBox(_wasserBox);
}

function updateWater(t) {
  // Dieselbe Zeit treibt die gemalten Himmelsstreifen im Shader (C4) — nur so
  // sitzen sie auf den Kaemmen, die hier verschoben werden.
  streifUniforms.uWasserZeit.value = t;
  // Kuestenfeld frisch halten. Ohne Gelaendeaenderung kostet das zwei
  // Zahlenvergleiche je Bild (siehe kuestePruefen).
  kuestePruefen(t);
  // See-Anmeldeliste nachfuehren (geloeschte Seeflaechen austragen). Hinter
  // dem Groessen-Vergleich kostet der Zweig ohne Seen genau diesen Vergleich.
  if (seeWogen.aktive.size > 0) seeWogenAufraeumen();
  var p = waterGeo.attributes.position, arr = p.array;
  for (var i = 0; i < p.count; i++) {
    var x = waterBaseXZ[i * 2], z = waterBaseXZ[i * 2 + 1];
    arr[i * 3 + 1] = Math.sin(x * WOGE[0].k + t * WOGE[0].w) * WOGE[0].amp
      + Math.sin(z * WOGE[1].k + t * WOGE[1].w) * WOGE[1].amp
      + Math.sin((x + z) * WOGE[2].k + t * WOGE[2].w) * WOGE[2].amp;
  }
  p.needsUpdate = true;
}

export { water, waterMat, seabed, initWater, wasserSichtbar, updateWater,
  wasserNeuBauen, setStreifen };
