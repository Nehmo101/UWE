/* ========================================================================== 
   Waldsaeulen-Formensprache fuer die 42 historischen Umweltpools

   Der Pass uebertraegt die ausgewaehlte Kandidatenrichtung A auf den gesamten
   Umweltvertrag: geschlossene Volumen, sichtbare Konstruktion, Bodenkontakt
   und drei klar lesbare Farbwerte. Alle Teile werden in die Quellgeometrie
   gebacken; Pool-ID, Instancing und Draw-Call-Vertrag bleiben unveraendert.
   ========================================================================== */
import * as THREE from 'three';
import { M, mergeGeos, part, laubTon } from './geometrie-hilfen.js';
import { UMWELT_VERFEINERTE_POOLS } from './umwelt-geometrie.js';

export var UMWELT_FORMSPRACHE_POOLS = UMWELT_VERFEINERTE_POOLS;

var BAUM = new Set([
  'baum', 'baum2', 'nadelbaum', 'zypresse', 'sumpfbaum', 'bluetenbaum', 'obstbaum'
]);
var BODEN = new Set(['busch', 'gras', 'blume', 'farn', 'moos']);
var FELS = new Set(['fels', 'findling', 'geroell', 'felsnadel', 'basaltsaeulen', 'eisfels']);
var FELD = new Set(['feldreihe', 'ackerscholle']);
var ZAUN = new Set(['pfosten', 'lattenzaun', 'palisade', 'pferch']);
var UFER = new Set(['steg', 'anleger', 'kaimauer', 'kaitreppe', 'uferdamm', 'moorsteg']);
var GEBAEUDE = new Set([
  'haus', 'hausA', 'hausB', 'hausC', 'haus2', 'scheune', 'villa', 'langhaus',
  'grubenhaus', 'turmhaus', 'giebelhaus', 'laubenhaus'
]);

var CY6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1, false);
var CO5 = new THREE.ConeGeometry(0.5, 1, 5, 1, false);
var IC0 = new THREE.IcosahedronGeometry(0.5, 0);
var BOX = new THREE.BoxGeometry(1, 1, 1);
/* Halm: dreikantig, nach oben spitz zulaufend, ohne Deckel.
   Gemessen an der Beispielkarte war `gras` mit 450 Dreiecken je Bueschel der
   mit Abstand teuerste Pool der ganzen Szene (143 Instanzen = 64.350
   Dreiecke, ein Viertel der Karte) — und das fuer etwas, das aus zwei Metern
   Entfernung ein paar Pixel gross ist. Der Grund war der Baustein: jeder Halm
   war ein SECHSKANTIGER Zylinder mit zwei Deckeln (24 Dreiecke) plus ein
   Kegel obendrauf (10). Ein Grashalm ist aber weder ein Rohr noch hat er
   einen Boden- und einen Deckelkreis.
   Dieser Baustein leistet dasselbe mit 6 Dreiecken: die Verjuengung ersetzt
   den Kegel, die offenen Enden sind bei einem Halm nie sichtbar. Was hier
   frei wird, geht in Kronen, Unterbewuchs und Feldreihen zurueck. */
var HALM = new THREE.CylinderGeometry(0.055, 0.5, 1, 3, 1, true);

function hash(name) {
  var wert = 2166136261;
  for (var i = 0; i < name.length; i++) {
    wert ^= name.charCodeAt(i);
    wert = Math.imul(wert, 16777619);
  }
  return wert >>> 0;
}

function grenzen(geo) {
  if (!geo.boundingBox) geo.computeBoundingBox();
  var b = geo.boundingBox;
  return {
    minY: b.min.y, maxY: b.max.y,
    cx: (b.min.x + b.max.x) * 0.5,
    cz: (b.min.z + b.max.z) * 0.5,
    sx: Math.max(0.3, b.max.x - b.min.x),
    sy: Math.max(0.3, b.max.y - b.min.y),
    sz: Math.max(0.3, b.max.z - b.min.z)
  };
}

function teil(basis, matrix, farbe, wind) {
  var geo = part(basis, matrix, farbe);
  if (wind !== undefined) {
    var uv = geo.attributes.uv.array;
    for (var i = 0; i < geo.attributes.uv.count; i++) {
      uv[i * 2] = 0.5;
      uv[i * 2 + 1] = wind;
    }
  }
  return geo;
}

function stab(x, y, z, rx, ry, rz, sx, sy, sz, farbe, wind) {
  return teil(CY6, M(x, y, z, rx, ry, rz, sx, sy, sz), farbe, wind);
}

function halm(x, y, z, rx, ry, rz, sx, sy, sz, farbe, wind) {
  return teil(HALM, M(x, y, z, rx, ry, rz, sx, sy, sz), farbe, wind);
}

function spitze(x, y, z, rx, ry, rz, sx, sy, sz, farbe, wind) {
  return teil(CO5, M(x, y, z, rx, ry, rz, sx, sy, sz), farbe, wind);
}

function knolle(x, y, z, rx, ry, rz, sx, sy, sz, farbe, wind) {
  return teil(IC0, M(x, y, z, rx, ry, rz, sx, sy, sz), farbe, wind);
}

function kasten(x, y, z, rx, ry, rz, sx, sy, sz, farbe) {
  return teil(BOX, M(x, y, z, rx, ry, rz, sx, sy, sz), farbe, 0.008);
}

/* --- Kronenaufbau -------------------------------------------------------
   Vorher stand hier ein Ring aus acht gleich grossen Ballen auf einem Kreis,
   deren Farbe ueber `i % 3` zwischen drei Werten sprang. Das ergab genau das,
   was im Nahblick als Billigmacher auffiel: eine gleichmaessige Kugel mit
   Farbsprenkeln. In den Vorlagen (mononoke-010, totoro-025, totoro-019) ist
   eine Krone das Gegenteil davon:

     1. FORMENHIERARCHIE — zwei, drei tragende Lappen, dazwischen kleinere,
        obenauf ein paar Buescheln. Keine zwei Lappen sind gleich gross.
     2. DUNKLER KERN — die Masse ist unten und innen fast schwarzgruen und
        wird nach oben aussen hin warm und hell. Der Wert folgt der LAGE,
        nicht dem Zaehlindex.
     3. UNSYMMETRIE — die Masse haengt schief.

   Punkt 3 ist der eigentliche Hebel gegen den Stempeleindruck: alle Instanzen
   eines Pools teilen sich DIESE EINE Geometrie und unterscheiden sich nur
   durch Gierwinkel, Skalierung und Tint. Bei einer rotationssymmetrischen
   Krone ist der Gierwinkel unsichtbar — 25 gedrehte Kugeln sehen aus wie 25
   Kopien. Haengt die Masse dagegen zur Seite, macht derselbe, laengst
   gezogene Zufallswinkel aus jedem Baum eine andere Silhouette. Das kostet
   kein Dreieck und keine Instanz.

   Lappentafel: [ax, az, hoehe, breite, dicke, ton]. ax/az in Vielfachen von
   sx/sz (Versatz aus der Stammachse), hoehe in Vielfachen von sy ueber dem
   Fuss, breite/dicke als Skalierung, ton 0 = Kernschatten .. 1 = Streiflicht.
   Acht Eintraege — exakt so viele Ballen wie vorher, das Dreiecksbudget der
   Laubbaeume bleibt unangetastet. */
var LAUB_LAPPEN = [
  // Der breite, flache Unterkoerper: die dunkle Schuerze unter der Krone.
  [0.03, -0.05, 0.635, 0.52, 0.19, 0.00],
  // Zwei tragende Hauptlappen, deutlich verschieden gross und versetzt.
  [-0.19, 0.11, 0.775, 0.42, 0.21, 0.34],
  [0.21, -0.07, 0.845, 0.35, 0.18, 0.56],
  // Nebenlappen: einer im Schatten der Hauptlappen, einer nach aussen.
  [0.04, 0.25, 0.745, 0.26, 0.15, 0.16],
  [-0.27, -0.17, 0.855, 0.24, 0.14, 0.44],
  // Buescheln am Licht — klein, hoch, warm.
  [0.29, 0.15, 0.905, 0.20, 0.12, 0.86],
  [-0.05, -0.02, 0.955, 0.17, 0.11, 1.00],
  // Ein tief haengendes Randbueschel bricht die runde Kontur unten auf.
  [0.34, 0.04, 0.700, 0.15, 0.10, 0.10]
];

var LAUB_STUFEN = {
  standard:    { kern: 0x1d3527, mitte: 0x4f7d48, licht: 0xa3bd66 },
  sumpfbaum:   { kern: 0x22322b, mitte: 0x58715a, licht: 0x95a976 },
  bluetenbaum: { kern: 0x6a5560, mitte: 0xd9a5ae, licht: 0xf6e2e4 },
  nadel:       { kern: 0x142619, mitte: 0x3f6443, licht: 0x86a25c }
};
// Halme trocknen von unten nach oben aus: Fuss kuehl und dunkel, Spitze
// warm und strohig. Moos bleibt kuehler und satter als Gras.
var HALM_STUFEN = { kern: 0x2f4a2c, mitte: 0x5d7c40, licht: 0xbcb663 };
var MOOS_STUFEN = { kern: 0x2b4429, mitte: 0x557d48, licht: 0x9fb469 };
// Getreide: gruener Fuss, reifende Mitte, ausgeblichene Aehre. Die Spanne ist
// absichtlich weit — Reifeunterschiede innerhalb EINER Reihe sind das, was
// einen Acker von einem gestempelten Balken unterscheidet.
var FELD_STUFEN = { kern: 0x5a7038, mitte: 0x93a057, licht: 0xd9c47e };

/* Nadelkronen: statt 13 Ballen auf drei Ebenen jetzt neun in drei Quirlen.
   Vier Ballen weniger je Pool sind ~80 Dreiecke weniger — das bezahlt die
   Formenhierarchie der Laubkronen mit ueber. Ein Quirl ist absichtlich nach
   aussen versetzt (`schief`), damit auch der Nadelbaum eine Wetterseite hat. */
function nadelLappen(b, seed, stufen) {
  var parts = [];
  var schief = 0.09 + (seed % 5) * 0.012;
  for (var q = 0; q < 3; q++) {
    for (var j = 0; j < 3; j++) {
      var a = q * 1.9 + j * 2.094 + seed * 0.0011;
      var hoehe = 0.44 + q * 0.155;
      var weite = 0.30 - q * 0.072;
      // Unterseite eines Quirls dunkel, Oberkante hell: dieselbe Rampe wie
      // beim Laubbaum, nur ueber die Etagen statt ueber die Lappen.
      var ton = (q * 0.34 + (j === 0 ? 0.20 : 0)) * 0.92;
      parts.push(knolle(
        b.cx + Math.cos(a) * b.sx * (weite * 0.72) + b.sx * schief,
        b.minY + b.sy * hoehe,
        b.cz + Math.sin(a) * b.sz * (weite * 0.64),
        a * 0.06, a, -a * 0.05,
        b.sx * (weite + 0.05), b.sy * (0.105 - q * 0.014), b.sz * (weite * 0.62 + 0.04),
        laubTon(stufen, ton), 0.62 + ton * 0.10));
    }
  }
  return parts;
}

function baumForm(name, b, seed) {
  var nadel = name === 'nadelbaum' || name === 'zypresse';
  var stufen = LAUB_STUFEN[name] || (nadel ? LAUB_STUFEN.nadel : LAUB_STUFEN.standard);
  var parts;
  if (nadel) {
    parts = nadelLappen(b, seed, stufen);
  } else {
    parts = [];
    // Wetterseite: eine feste, aber je Pool andere Richtung, in die die ganze
    // Kronenmasse haengt. Sie liegt IN der Geometrie, nicht in der Instanz —
    // deshalb wirkt der Gierwinkel jeder Instanz darauf wie ein Umblicken.
    var wa = seed * 0.0007;
    var wx = Math.cos(wa) * 0.075, wz = Math.sin(wa) * 0.075;
    for (var i = 0; i < LAUB_LAPPEN.length; i++) {
      var L = LAUB_LAPPEN[i];
      var dreh = i * 2.399 + seed * 0.0017;
      parts.push(knolle(
        b.cx + (L[0] + wx) * b.sx, b.minY + L[2] * b.sy, b.cz + (L[1] + wz) * b.sz,
        dreh * 0.09, dreh, -dreh * 0.06,
        b.sx * L[3], b.sy * L[4], b.sz * L[3] * 0.9,
        laubTon(stufen, L[5]),
        // uv.y ist Windgewicht UND Texturkoordinate: die Werte bleiben im
        // erprobten opaken Band der Kronenkarten (0.34..0.72). Tiefe Lappen
        // schwingen weniger als die Buescheln obenauf — das ist auch das
        // richtige Verhalten, die Masse am Stamm steht naeher am Holz.
        0.62 + L[5] * 0.10));
    }
  }
  parts.push(knolle(b.cx + b.sx * 0.13, b.minY + b.sy * 0.31, b.cz - b.sz * 0.18,
    0.2, seed * 0.01, 0, b.sx * 0.12, b.sy * 0.09, b.sz * 0.09, 0x6b4a32, 0.008));
  return parts;
}

/* --- Bodenbewuchs -------------------------------------------------------
   Dieselbe Diagnose wie bei den Kronen, eine Groessenordnung kleiner: alle
   Halme standen auf EINEM Kreis um die Mitte, in gleichem Abstand, gleicher
   Hoehenstaffelung, mit abwechselnden Farben. Aus zwei Metern Entfernung ist
   das ein Igel, kein Bueschel.

   In anno-05 (Wiese mit Nahdetail) sitzt Gras in HORSTEN: zwei, drei dichte
   Nester dicht beieinander, dazwischen kahler Boden, und aus jedem Horst
   ragen ein, zwei einzelne Samenstaende deutlich heraus. Genau das baut
   `horst()` — die Position kommt nicht mehr aus einem Kreis, sondern aus
   einem der zwei/drei Nester, und die Hoehe aus einer schiefen Verteilung
   (viele kurze, wenige lange) statt aus einer Treppe.

   `wuerfel` ist der ortsstabile Hash dieses Moduls: eine reine Funktion aus
   Index und Pool-Seed, kein Zufallsstrom. Gleicher Pool -> gleiche Form. */
function wuerfel(i, k, seed) {
  var h = Math.imul(i * 374761393 + k * 668265263 + seed, 1274126177);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return ((h >>> 0) % 100000) / 100000;
}

/** Position im n-ten Nest eines Horsts (Nestmitten selbst deterministisch). */
function horst(b, basis, seed, i, nester) {
  var n = i % nester;
  var na = n * 2.399 + seed * 0.011;
  var nx = b.cx + Math.cos(na) * basis * (0.10 + n * 0.055);
  var nz = b.cz + Math.sin(na) * basis * (0.10 + n * 0.055);
  var sa = wuerfel(i, 1, seed) * 6.283;
  var sd = basis * 0.13 * Math.sqrt(wuerfel(i, 2, seed));
  return { x: nx + Math.cos(sa) * sd, z: nz + Math.sin(sa) * sd };
}

function bodenForm(name, b, seed) {
  var parts = [];
  var basis = Math.max(0.32, Math.max(b.sx, b.sz));
  if (name === 'moos') {
    /* Moospolster: ein dunkles, breites Grundpolster, darauf kleinere,
       hellere Buckel — dieselbe Werthierarchie wie in der Krone. Vorher
       lagen zehn gleich grosse Flecken in einer Spirale. */
    for (var m = 0; m < 10; m++) {
      var mt = wuerfel(m, 3, seed);
      var ma = m * 2.399 + seed * 0.01;
      var md = basis * (0.05 + mt * 0.24);
      var mg = m === 0 ? 1.55 : (0.42 + mt * 0.62);
      parts.push(knolle(b.cx + Math.cos(ma) * md, b.minY + basis * 0.02 * mg,
        b.cz + Math.sin(ma) * md, ma * 0.08, ma, 0,
        basis * 0.16 * mg, basis * 0.055 * mg, basis * 0.13 * mg,
        laubTon(MOOS_STUFEN, m === 0 ? 0.05 : 0.18 + mt * 0.82), 0.34));
    }
    return parts;
  }
  if (name === 'busch') {
    /* Busch als Waldrandpflanze (mononoke-010, totoro-025): unten ein
       breiter, fast schwarzgruener Schatten, darueber zwei ungleiche
       Hauptlappen und ein paar helle Triebe, die seitlich herausstehen.
       Neun Ballen wie bisher — nur nicht mehr neun gleiche. */
    for (var k = 0; k < 9; k++) {
      var kt = wuerfel(k, 5, seed);
      var ka = k * 2.399 + seed * 0.004;
      var gross = k < 3;
      var kg = gross ? 0.40 + kt * 0.16 : 0.19 + kt * 0.15;
      var kd = basis * (gross ? 0.05 + kt * 0.09 : 0.16 + kt * 0.16);
      var ky = gross ? 0.16 + kt * 0.16 : 0.24 + kt * 0.30;
      parts.push(knolle(b.cx + Math.cos(ka) * kd, b.minY + basis * ky,
        b.cz + Math.sin(ka) * kd, ka * 0.11, ka, -ka * 0.06,
        basis * kg, basis * kg * 0.78, basis * kg * 0.92,
        // Wert nach Lage: was tief und innen sitzt, ist Kern; was hoch und
        // aussen steht, faengt Licht.
        laubTon(LAUB_STUFEN.standard, Math.min(1, ky * 1.35 + kt * 0.25)), 0.7));
    }
    return parts;
  }
  var anzahl = name === 'gras' ? 11 : (name === 'farn' ? 9 : 6);
  var nester = name === 'blume' ? 2 : 3;
  for (var i = 0; i < anzahl; i++) {
    var t = wuerfel(i, 7, seed);
    var p = horst(b, basis, seed, i, nester);
    var a = wuerfel(i, 11, seed) * 6.283;
    // Schiefe Hoehenverteilung: t^2 haelt die Mehrheit kurz und laesst
    // einzelne Samenstaende deutlich herausragen. Vorher: (i % 5) — eine
    // Treppe mit fuenf Stufen, in der kein Halm herausstach.
    var h = basis * (name === 'farn' ? 0.44 : 0.30) * (0.55 + t * t * 1.25);
    var neig = 0.10 + wuerfel(i, 13, seed) * 0.22;
    var x = p.x, z = p.z;
    parts.push(halm(x, b.minY + h * 0.48, z, Math.sin(a) * neig, a,
      Math.cos(a) * neig, basis * 0.032, h, basis * 0.032,
      laubTon(HALM_STUFEN, 0.15 + t * 0.7), 0.55));
    if (name === 'blume') {
      var bluete = i % 3 === 0 ? 0xf3d47b : (i % 2 ? 0xe99cab : 0xf1eee0);
      parts.push(knolle(x + Math.sin(a) * neig * h, b.minY + h, z + Math.cos(a) * neig * h,
        a, a * 0.4, 0, basis * 0.13, basis * 0.07, basis * 0.13, bluete, 0.82));
    } else if (name === 'farn') {
      // Wedel: haengt vom Halm weg nach aussen, Unterseite dunkler.
      parts.push(spitze(x + Math.cos(a) * h * 0.22, b.minY + h * 0.80,
        z + Math.sin(a) * h * 0.22, 0, a, -0.52 - t * 0.24,
        basis * 0.20, h * (0.52 + t * 0.2), basis * 0.075,
        laubTon(LAUB_STUFEN.standard, 0.24 + t * 0.62), 0.78));
    }
  }
  return parts;
}

function felsForm(name, b, seed) {
  var parts = [];
  var basis = Math.max(b.sx, b.sz);
  var eis = name === 'eisfels';
  for (var i = 0; i < 7; i++) {
    var a = i * 2.399 + seed * 0.002;
    var d = basis * (0.32 + (i % 3) * 0.09);
    var r = basis * (0.11 + (i % 4) * 0.025);
    parts.push(knolle(b.cx + Math.cos(a) * d, b.minY + r * 0.36,
      b.cz + Math.sin(a) * d, a * 0.13, a, -a * 0.08,
      r * 1.4, r * 0.65, r,
      eis ? (i % 2 ? 0xc8e1e7 : 0x8fb9c8) : (i % 2 ? 0x87847b : 0xa29d90), 0.008));
  }
  parts.push(kasten(b.cx, b.minY + b.sy * 0.28, b.cz + b.sz * 0.48,
    0.08, seed * 0.002, -0.05, b.sx * 0.72, b.sy * 0.035, b.sz * 0.06,
    eis ? 0xe0eef0 : 0x696861));
  return parts;
}

/* Feldreihe: vorher ein 4x3-Raster aus zwoelf gleich hohen Kegeln. Da die
   Flaechenstreuung in areas.js jede Instanz mit demselben Gierwinkel und
   demselben Rasterabstand setzt, war das der sichtbarste Stempel der ganzen
   Karte — ein exakt orthogonales Gitter identischer Balken (siehe
   weite-morgen).
   In anno-08 hat ein Acker drei Merkmale, die hier fehlten: die Halme stehen
   in ZEILEN (nicht im Karo), die Zeile hat eine UNRUHIGE Oberkante, und im
   Bestand steht immer etwas anderes mit — Unkraut, Nachzuegler, eine zweite
   Frucht. Alle drei sind in der Poolgeometrie unterzubringen; nur die
   Parzellierung selbst braucht die Flaeche und steht in `gemeinsameBitte`.
   Kosten: 12 Kegel (120 Dreiecke) raus, 11 Halme (66) plus 2 Kegel (20)
   rein — die Reihe wird dabei billiger, nicht teurer. */
function feldForm(_name, b, seed) {
  var parts = [];
  var i, t, x, z, h;
  // Der Fuss steckt IM Bestandsbalken der Basisgeometrie; nur die obere
  // Haelfte der Halme steht darueber und macht die Oberkante unruhig.
  var fuss = b.minY + b.sy * 0.26;
  for (i = 0; i < 11; i++) {
    t = wuerfel(i, 17, seed);
    // Zwei enge Zeilen laengs z statt eines Karos: die Reihe bekommt eine
    // Richtung, quer dazu eine Gasse.
    x = b.cx + ((i % 2) - 0.5) * b.sx * 0.30 + (t - 0.5) * b.sx * 0.10;
    z = b.cz + (Math.floor(i / 2) / 2.5 - 1) * b.sz * 0.46 + (t - 0.5) * b.sz * 0.12;
    h = b.sy * (0.40 + t * t * 0.58);
    parts.push(halm(x, fuss + h * 0.5, z, (t - 0.5) * 0.22, t * 6.283,
      (t - 0.5) * 0.3, b.sx * 0.085, h, b.sz * 0.085,
      laubTon(FELD_STUFEN, 0.2 + t * 0.72), 0.74));
  }
  // Zweite Fruchtart im Bestand: zwei breitblaettrige Nachzuegler in einem
  // deutlich anderen, satteren Gruen. Sie brechen die Monokultur der Reihe.
  for (i = 0; i < 2; i++) {
    t = wuerfel(i, 19, seed);
    parts.push(spitze(b.cx + (t - 0.5) * b.sx * 0.5, b.minY + b.sy * 0.44,
      b.cz + (i - 0.5) * b.sz * 0.62, 0, t * 6.283, (t - 0.5) * 0.4,
      b.sx * 0.19, b.sy * 0.62, b.sz * 0.14, i ? 0x5c7a3c : 0x71914a, 0.7));
  }
  return parts;
}

function zaunForm(_name, b, seed) {
  var holz = seed % 2 ? 0x6d513a : 0x7d5c3e;
  return [
    kasten(b.cx, b.minY + b.sy * 0.52, b.cz + b.sz * 0.18,
      0, seed * 0.001, -0.38, b.sx * 0.82, b.sy * 0.07, b.sz * 0.07, holz),
    kasten(b.cx, b.minY + b.sy * 0.34, b.cz - b.sz * 0.15,
      0, -seed * 0.001, 0.31, b.sx * 0.72, b.sy * 0.06, b.sz * 0.06, 0x8a6845),
    knolle(b.cx - b.sx * 0.46, b.minY + b.sy * 0.035, b.cz + b.sz * 0.2,
      0.1, 0.4, 0, b.sx * 0.16, b.sy * 0.08, b.sz * 0.18, 0x8d887c, 0.008),
    knolle(b.cx + b.sx * 0.43, b.minY + b.sy * 0.03, b.cz - b.sz * 0.18,
      -0.1, -0.3, 0, b.sx * 0.13, b.sy * 0.07, b.sz * 0.15, 0xa09a8d, 0.008)
  ];
}

function uferForm(name, b, seed) {
  var parts = [];
  for (var i = 0; i < 6; i++) {
    var x = b.cx + (i - 2.5) * b.sx * 0.12;
    var h = b.sy * (0.28 + (i % 3) * 0.08);
    parts.push(stab(x, b.minY + h * 0.5, b.cz + b.sz * 0.4,
      0.04, 0, (i % 2 ? 1 : -1) * 0.1, b.sx * 0.018, h, b.sz * 0.018,
      i % 2 ? 0x6f8451 : 0x506b45, 0.76));
  }
  parts.push(knolle(b.cx + b.sx * 0.38, b.minY + b.sy * 0.03, b.cz - b.sz * 0.35,
    0.1, seed * 0.01, 0, b.sx * 0.2, b.sy * 0.08, b.sz * 0.18,
    name === 'moorsteg' ? 0x554c40 : 0x88867e, 0.008));
  return parts;
}

function gebaeudeForm(name, b, seed) {
  var stein = name === 'villa' ? 0xb5aa91 : 0x938772;
  var parts = [];
  for (var i = 0; i < 5; i++) {
    var x = b.cx + (i - 2) * b.sx * 0.19;
    parts.push(knolle(x, b.minY + b.sy * 0.025, b.cz + b.sz * 0.48,
      0.1 * i, seed * 0.002 + i, 0,
      b.sx * 0.15, b.sy * 0.06, b.sz * 0.13,
      i % 2 ? stein : 0x746d61, 0.008));
  }
  var seite = seed % 2 ? 1 : -1;
  parts.push(stab(b.cx + seite * b.sx * 0.42, b.minY + b.sy * 0.42,
    b.cz + b.sz * 0.5, 0.08, 0, seite * 0.1,
    b.sx * 0.025, b.sy * 0.52, b.sz * 0.025, 0x516e43, 0.55));
  parts.push(knolle(b.cx + seite * b.sx * 0.4, b.minY + b.sy * 0.69,
    b.cz + b.sz * 0.5, 0, seed * 0.01, 0,
    b.sx * 0.15, b.sy * 0.08, b.sz * 0.13, 0x7f9a56, 0.74));
  return parts;
}

export function veredleUmweltFormensprache(name, geo) {
  if (!UMWELT_FORMSPRACHE_POOLS.includes(name)) return geo;
  var b = grenzen(geo);
  var seed = hash(name);
  var details;
  if (BAUM.has(name)) details = baumForm(name, b, seed);
  else if (BODEN.has(name)) details = bodenForm(name, b, seed);
  else if (FELS.has(name)) details = felsForm(name, b, seed);
  else if (FELD.has(name)) details = feldForm(name, b, seed);
  else if (ZAUN.has(name)) details = zaunForm(name, b, seed);
  else if (UFER.has(name)) details = uferForm(name, b, seed);
  else if (GEBAEUDE.has(name)) details = gebaeudeForm(name, b, seed);
  else throw new Error('Umwelt-Formensprache ohne Familie: ' + name);
  var ergebnis = mergeGeos([geo].concat(details));
  ergebnis.userData.umweltFormensprache = 'waldsaeule-a';
  ergebnis.userData.umweltFormDetails = details.length;
  return ergebnis;
}
