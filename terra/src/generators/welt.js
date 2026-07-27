// Weltgenerator (A1): aus Seed + vorhandenem Hoehenfeld eine ganze Karte.
//
// erzeugeWelt() LIEFERT eine Elementliste und veraendert nichts. Das Einsetzen
// (S.elements leeren, hydrate, rebuildAll, pushUndo) macht der Aufrufer —
// ui/panels.js. Das ist die Trennung, die den Generator testbar haelt: er ist
// eine reine Funktion von (Weltseed, Kartengroesse, Biom, Hoehenfeld, opt) auf
// eine Liste von Elementbeschreibungen.
//
// Elemente sind PUNKTE + PARAMETER + SEED. Hier entsteht keine einzige
// Geometrie und keine einzige Instanz — das tun beim Commit genau dieselben
// Generatoren wie bei handgezeichneten Elementen (paths.js, areas.js,
// vines.js). Damit sieht eine gewuerfelte Welt aus wie eine gebaute, und jedes
// Stueck bleibt danach von Hand veraenderbar.
//
// Determinismus: kein Math.random, kein Zugriff auf S.elementSeedCounter (der
// haengt am Sitzungsverlauf). Alle Zufallsstroeme kommen aus hashi/rngOf mit
// Schluesseln aus (Weltseed, Ort bzw. laufende Nummer); die Element-Seeds
// leitet elementSeed() aus dem Weltseed und der Position in der Ergebnisliste
// ab. Gleicher Weltseed + gleiche Kartengroesse + gleiches Biom (und damit
// gleiches Hoehenfeld) ergeben damit exakt dieselbe Welt.
import { clamp, lerp, sstep, DEG, hashi, fractal, rngOf, rr, ri, wpick } from '../core/rng.js';
// KARTE statt MAP/HALF — Kartengroesse ist seit H1b ein Laufzeitwert (H1b-Regel:
// nie beim Modulstart in eine eigene Konstante kopieren).
import { S, KARTE, WATER } from '../core/store.js';
import { heightAt, slopeAt } from '../world/terrain.js';
// Nur genutzt, nicht veraendert: tryPlace ist DIE gemeinsame Bodenregel
// (Kartenrand, Wasser, 40°-Hang). Der Generator ruft sie ohne Belegungsraster
// und mit ignoreCorridor, weil die Korridormaske zum Erzeugungszeitpunkt noch
// leer ist (siehe "Korridore" weiter unten).
import { tryPlace } from './objects.js';
import { rankePlatzierbar } from './vines.js';
import { sucheWeg, vereinfache } from './wegsuche.js';
/* J3 — Namen. namen.js haengt nur an core/rng, core/store und world/terrain und
   importiert insbesondere NICHT welt.js zurueck; der Import ist also zyklusfrei
   und aendert den Modulgraphen dieser Datei nicht nennenswert. */
import { nameFuer, neueVergabe } from './namen.js';

/* ==========================================================================
   Korridore — warum der Generator eine EIGENE Belegung fuehrt

   Die Korridormaske (corridor in terrain.js) wird erst von rebuildCorridors()
   beim Commit gefuellt, also NACH dem Erzeugen. Waehrend erzeugeWelt() laeuft,
   ist sie leer bzw. zeigt noch die alte Karte. Deshalb:

   1. Der Generator fuehrt eine eigene, grobe Belegungskarte (`bel`) in
      Kartenaufloesung/4. Dort werden Flusslaeufe, Siedlungen, Felder, Strassen
      und Waelder vermerkt, sobald sie beschlossen sind. Alle spaeteren
      Entscheidungen fragen diese Karte statt der Korridormaske.
   2. Die Wegsuche bekommt dieselbe Karte als `opt.bonus` herein — dadurch
      buendeln sich die Strassen schon WAEHREND der Erzeugung, obwohl noch kein
      Korridor gestempelt ist.
   3. Die Bestueckung selbst (Baeume auf der Strasse, Haeuser im Flussbett)
      braucht hier gar keine Vorsorge: tryPlace prueft die Korridormaske beim
      Erzeugen der Instanzen, und das passiert erst nach dem Commit, wenn die
      Maske steht. Der Generator haelt nur die MITTELPUNKTE frei, damit nicht
      ein Wald mitten auf dem Marktplatz anfaengt.
   ========================================================================== */

// Hangschwellen als Kosinus der y-Normalen (slopeAt liefert genau die). Kleiner
// Kosinus = steiler. Bewusst hier und nicht in store.js: es sind Schwellen
// DIESES Generators, nicht der Platzierungsregeln.
var COS5 = Math.cos(5 * DEG), COS7 = Math.cos(7 * DEG), COS12 = Math.cos(12 * DEG),
    COS22 = Math.cos(22 * DEG), COS25 = Math.cos(25 * DEG), COS38 = Math.cos(38 * DEG);

var RASTER = 4;              // Analyseraster in Welteinheiten (kartengroessenunabhaengig:
                             // die Landschaftsformen sind es auch — fractal laeuft in
                             // genBaseIn mit fester Frequenz 0.006)

var WELT_STANDARD = {
  siedlungen: 1,     // Dichtefaktor der Siedlungen (0 = keine)
  waldanteil: 1,     // Faktor auf Anzahl und Groesse der Waelder
  wiesen: 1,         // Faktor auf die Wiesen
  fluesse: 1,        // Faktor auf die Anzahl der Flusslaeufe
  ranken: 3,         // Anzahl der Arbor-Ranken (wird auf 2..5 geklemmt)
  strassen: true,    // Strassennetz zwischen den Siedlungen bauen?
  stil: null,        // Baustil; null = aus dem Biom ableiten
  /* J3 — Namen. `namen: false` liefert eine Welt ohne einen einzigen Namen
     (fuer Tests, die auf Byteidentitaet mit dem Stand vor dieser Runde
     pruefen). `sprachfamilie: null` heisst "die der Karte" — S.sprachfamilie
     bzw. das Biom. */
  namen: true,
  sprachfamilie: null
};

/* Baustil je Biom. Kein Anspruch auf Weltgeschichte — eine Zuordnung, die dem
   Bild dient: karge Hochlagen zwergisch, ueppige Waelder elfisch, Asche und
   Salz werklich/ruinoes, der Rest doerflich. Ueber opt.stil ueberstimmbar. */
var BIOM_STIL = {
  wiese: "dorf", kueste: "dorf", steppe: "dorf", moor: "dorf", sumpf: "dorf",
  meer: "dorf", mangrove: "dorf", kreide: "dorf", tundra: "dorf", schnee: "dorf",
  hochland: "zwergisch", karst: "zwergisch", eis: "zwergisch", terrassen: "zwergisch",
  regenwald: "elfisch", bambuswald: "elfisch", bluetental: "elfisch",
  nebelwald: "elfisch", pilzwald: "elfisch",
  vulkan: "werk", salzwueste: "werk", aschebrache: "ruine",
  wueste: "klassisch"
};

/** Ortsstabiler Zufallsstrom — Muster aus paths.js/areas.js/vines.js. */
function strom(a, b, s) { return rngOf((hashi(a, b, s) * 4294967296) | 0); }

/**
 * Element-Seed aus Weltseed und Listenposition. BEWUSST nicht nextSeed():
 * dessen Zaehler haengt am Sitzungsverlauf, dieselbe Welt saehe beim zweiten
 * Wuerfeln in derselben Sitzung anders bestueckt aus.
 */
function elementSeed(seed, nr) { return (seed + Math.imul(nr + 1, 0x9e3779b9)) | 0; }

function optionen(opt) {
  var o = {}, k;
  for (k in WELT_STANDARD) o[k] = WELT_STANDARD[k];
  if (opt) for (k in WELT_STANDARD) if (opt[k] !== undefined) o[k] = opt[k];
  return o;
}

/** Faktor gegenueber der 256er-Karte (Laengenmass, nicht Flaechenmass). */
function skala() { return KARTE.map / 256; }

/** Liegt der Punkt weit genug im Land, um ueberhaupt etwas zu tragen? */
function fest(x, z) { return tryPlace(null, x, z, 0, { ignoreCorridor: true }) !== null; }


/* ==========================================================================
   1. Analyse des Hoehenfelds

   Ein Raster ueber die ganze Karte mit Hoehe und Hangneigung, daraus:
   Wasser/Land, Abstand zum Wasser (Chamfer-Distanztransformation), Kueste,
   Senken (kuenftige Seen), Gipfel (Flussquellen) und Paesse (Siedlungsgunst).
   Rein aus heightAt/slopeAt — keine Elemente, keine Masken.
   ========================================================================== */

function analysiere(seed) {
  var half = KARTE.half;
  var nx = Math.floor(KARTE.map / RASTER) + 1;
  var n = nx * nx;
  var h = new Float32Array(n), ny = new Float32Array(n);
  var wasser = new Uint8Array(n);
  var hMin = 1e9, hMax = -1e9, landZellen = 0;
  var i, j, id, x, z;
  for (j = 0; j < nx; j++) {
    for (i = 0; i < nx; i++) {
      id = j * nx + i;
      x = i * RASTER - half; z = j * RASTER - half;
      var hh = heightAt(x, z);
      h[id] = hh;
      ny[id] = slopeAt(x, z);
      if (hh < WATER) wasser[id] = 1; else { landZellen++; }
      if (hh < hMin) hMin = hh;
      if (hh > hMax) hMax = hh;
    }
  }
  var wasserAbstand = abstandsFeld(nx, wasser);

  /* Hoehenquantile des LANDES (nicht der ganzen Karte). Ohne sie waeren alle
     Hoehenbaender falsch geeicht: hMin ist immer die Randtiefe (-22 im
     Standardprofil), der Meeresgrund zieht die Spanne auf, und die eigentliche
     Landschaft draengt sich in den oberen Dezilen. Gemessen an einer 256er
     Wiese mit Seed 1337: Land liegt vollstaendig in den obersten vier Dezilen
     der Gesamtspanne — ein absolutes Hoehenband haette dort NIE gegriffen.
     Histogramm statt Sortieren: 256 Faecher reichen fuer Quantile, die nur
     weiche sstep-Kanten fuettern, und es bleibt linear. */
  var FACH = 256, hist = new Int32Array(FACH), landN = 0;
  for (id = 0; id < n; id++) {
    if (wasser[id]) continue;
    landN++;
    hist[clamp(Math.floor((h[id] - hMin) / Math.max(1e-6, hMax - hMin) * FACH), 0, FACH - 1)]++;
  }
  function quantil(p) {
    var ziel = landN * p, summe = 0;
    for (var f = 0; f < FACH; f++) {
      summe += hist[f];
      if (summe >= ziel) return hMin + (f + 0.5) / FACH * (hMax - hMin);
    }
    return hMax;
  }
  var landP20 = landN ? quantil(0.20) : WATER;
  var landP50 = landN ? quantil(0.50) : WATER;
  var landP85 = landN ? quantil(0.85) : WATER;
  // Baumgrenze knapp ueber dem 85er-Quantil: die obersten Kuppen bleiben kahl.
  var baumGrenze = landP85 + (landP85 - landP50) * 0.6 + 0.5;

  // Kueste, Gipfel, Senken, Paesse in EINEM Durchgang ueber das Innere.
  var kueste = [], gipfel = [], senken = [], paesse = [];
  var spanne = Math.max(1, hMax - hMin);
  var DI = [1, 1, 0, -1, -1, -1, 0, 1], DJ = [0, 1, 1, 1, 0, -1, -1, -1];
  for (j = 2; j < nx - 2; j++) {
    for (i = 2; i < nx - 2; i++) {
      id = j * nx + i;
      x = i * RASTER - half; z = j * RASTER - half;
      var hier = h[id];
      // Kueste: Land mit Wassernachbar
      if (!wasser[id] && wasserAbstand[id] <= RASTER * 1.5) kueste.push({ x: x, z: z, id: id });
      if (wasser[id]) continue;
      // Ringvergleich fuer Gipfel/Senke/Pass
      var hoeher = 0, tiefer = 0, wechsel = 0, mittel = 0, vor = 0;
      for (var k = 0; k < 8; k++) {
        var hn = h[(j + DJ[k]) * nx + (i + DI[k])];
        mittel += hn;
        var vz = hn > hier ? 1 : -1;
        if (vz > 0) hoeher++; else tiefer++;
        if (k > 0 && vz !== vor) wechsel++;
        vor = vz;
      }
      if (vor !== (h[(j + DJ[0]) * nx + (i + DI[0])] > hier ? 1 : -1)) wechsel++;
      mittel *= 0.125;
      // Gipfel: hoeher als alle acht Nachbarn und im oberen Drittel der Karte
      if (hoeher === 0 && (hier - hMin) / spanne > 0.5) {
        gipfel.push({ x: x, z: z, h: hier, id: id });
      }
      // Senke: tiefer als alle acht und deutlich muldig — daraus wird ein See
      else if (tiefer === 0 && hier > WATER + 0.4 && mittel - hier > 0.6) {
        senken.push({ x: x, z: z, h: hier, tiefe: mittel - hier, id: id });
      }
      // Pass: vier Vorzeichenwechsel im Ring = Sattel (in einer Richtung
      // Kamm, quer dazu Mulde). Mittlere Hoehen, sonst ist es ein Gipfel.
      else if (wechsel >= 4 && hoeher >= 2 && tiefer >= 2 &&
               (hier - hMin) / spanne > 0.25 && (hier - hMin) / spanne < 0.8) {
        paesse.push({ x: x, z: z, h: hier, id: id });
      }
    }
  }
  // Gipfel absteigend nach Hoehe, Gleichstand ueber den Index — die Reihenfolge
  // muss total und ortsunabhaengig sein, sonst haengt das Ergebnis an der
  // Sortierstabilitaet der Laufzeitumgebung.
  gipfel.sort(function (a, b) { return (b.h - a.h) || (a.id - b.id); });
  senken.sort(function (a, b) { return (b.tiefe - a.tiefe) || (a.id - b.id); });

  return {
    nx: nx, h: h, ny: ny, wasser: wasser, wasserAbstand: wasserAbstand,
    hMin: hMin, hMax: hMax, spanne: spanne,
    landP20: landP20, landP50: landP50, landP85: landP85, baumGrenze: baumGrenze,
    landAnteil: landZellen / n,
    kueste: kueste, gipfel: gipfel, senken: senken, paesse: paesse,
    seed: seed
  };
}

/**
 * Chamfer-Distanztransformation (1 / 1.41421) in Welteinheiten. Zwei Durchgaenge
 * statt einer exakten euklidischen Transformation: der Fehler liegt unter 4 %
 * und alle Verbraucher hier arbeiten mit weichen sstep-Kanten.
 */
function abstandsFeld(nx, quelle) {
  var n = nx * nx, d = new Float32Array(n), GROSS = 1e9;
  var i, j, id;
  for (id = 0; id < n; id++) d[id] = quelle[id] ? 0 : GROSS;
  var G = 1, D = 1.4142135623730951;
  for (j = 0; j < nx; j++) {
    for (i = 0; i < nx; i++) {
      id = j * nx + i;
      var v = d[id];
      if (i > 0 && d[id - 1] + G < v) v = d[id - 1] + G;
      if (j > 0 && d[id - nx] + G < v) v = d[id - nx] + G;
      if (i > 0 && j > 0 && d[id - nx - 1] + D < v) v = d[id - nx - 1] + D;
      if (i < nx - 1 && j > 0 && d[id - nx + 1] + D < v) v = d[id - nx + 1] + D;
      d[id] = v;
    }
  }
  for (j = nx - 1; j >= 0; j--) {
    for (i = nx - 1; i >= 0; i--) {
      id = j * nx + i;
      var w = d[id];
      if (i < nx - 1 && d[id + 1] + G < w) w = d[id + 1] + G;
      if (j < nx - 1 && d[id + nx] + G < w) w = d[id + nx] + G;
      if (i < nx - 1 && j < nx - 1 && d[id + nx + 1] + D < w) w = d[id + nx + 1] + D;
      if (i > 0 && j < nx - 1 && d[id + nx - 1] + D < w) w = d[id + nx - 1] + D;
      d[id] = w;
    }
  }
  for (id = 0; id < n; id++) d[id] = d[id] >= GROSS ? 1e6 : d[id] * RASTER;
  return d;
}


/* ==========================================================================
   Belegung — die vorlaeufige Karte des schon Beschlossenen
   ========================================================================== */

function neueBelegung(A) {
  return { nx: A.nx, feld: new Uint8Array(A.nx * A.nx) };
}

// Bit-Rollen, damit eine Zelle mehreres tragen kann.
var B_FLUSS = 1, B_ORT = 2, B_WEG = 4, B_GRUEN = 8;

function stempel(bel, x, z, r, rolle) {
  var half = KARTE.half, nx = bel.nx;
  var i0 = Math.max(0, Math.floor((x + half - r) / RASTER));
  var i1 = Math.min(nx - 1, Math.ceil((x + half + r) / RASTER));
  var j0 = Math.max(0, Math.floor((z + half - r) / RASTER));
  var j1 = Math.min(nx - 1, Math.ceil((z + half + r) / RASTER));
  var r2 = r * r;
  for (var j = j0; j <= j1; j++) {
    for (var i = i0; i <= i1; i++) {
      var dx = (i * RASTER - half) - x, dz = (j * RASTER - half) - z;
      if (dx * dx + dz * dz <= r2) bel.feld[j * nx + i] |= rolle;
    }
  }
}

function belegt(bel, x, z, rollen) {
  var half = KARTE.half, nx = bel.nx;
  var i = Math.round((x + half) / RASTER), j = Math.round((z + half) / RASTER);
  if (i < 0 || j < 0 || i >= nx || j >= nx) return true;      // ausserhalb = belegt
  return (bel.feld[j * nx + i] & rollen) !== 0;
}

/** Fuegt ein Element an und vergibt dabei seinen deterministischen Seed. */
function fuegeEin(W, kind, variant, points, params) {
  var el = {
    kind: kind, variant: variant, points: points, params: params,
    seed: elementSeed(W.seed, W.elemente.length)
  };
  W.elemente.push(el);
  return el;
}

/* ==========================================================================
   J3 — Benennung

   Jeder Name haengt am ELEMENTSEED, nicht an einem laufenden Zaehler: er
   ueberlebt damit dasselbe wie die Bestueckung. `rolle` trennt gleichseedige
   Rollen (der Fluss Nr. 2 und die Siedlung Nr. 2 haben verschiedene Seeds,
   aber die Rolle macht es unabhaengig davon eindeutig).

   Zwei Uebergaben sind wichtig:
     elemente: W.elemente  — die WACHSENDE Liste dieses Laufs. S.elements zeigt
       waehrend der Erzeugung noch die alte Karte; nur so weiss eine Siedlung,
       dass ein Fluss neben ihr liegt, und ein Wald, dass eine Strasse
       daneben laeuft.
     korridor: false — dieselbe Begruendung wie bei der Wegsuche weiter unten:
       die Korridormaske ist zum Erzeugungszeitpunkt die der VORIGEN Karte.
   ========================================================================== */
function benenne(W, art, x, z, seed, rolle, index) {
  if (!W.o.namen) return null;
  return nameFuer(art, x, z, seed, {
    worldSeed: W.seed,
    familie: W.o.sprachfamilie || undefined,
    index: index, rolle: rolle,
    vergabe: W.vergabe,
    elemente: W.elemente,
    korridor: false
  });
}

/* Acht Sektoren, beginnend bei Osten und gegen den Uhrzeigersinn im
   x/z-System (z zeigt nach Sueden). "Nordost" statt "Nordöstliche" — die
   Namen werden zusammengesetzt ("Nordostäcker von …"). */
var RICHTUNG = ["Ost", "Südost", "Süd", "Südwest", "West", "Nordwest", "Nord", "Nordost"];
function himmelsrichtung(dx, dz) {
  var a = Math.atan2(dz, dx);
  var k = Math.round(a / (Math.PI / 4));
  return RICHTUNG[((k % 8) + 8) % 8];
}

/** Setzt params.name, wenn ein Name erzeugt wurde. `name` ist ein neues,
 *  OPTIONALES Parameterfeld — serializeElements nimmt params als Ganzes mit,
 *  das Dateiformat aendert sich dadurch nicht. */
function benenneElement(el, name) {
  if (name) el.params.name = name;
  return el;
}

/**
 * Verrauschter Umriss um einen Mittelpunkt — die Standardform aller Flaechen
 * dieses Generators. `regel` (optional) darf jede Ecke ablehnen; sie wird dann
 * schrittweise eingezogen, bis sie passt. Dadurch legt sich ein Waldrand von
 * selbst an ein Ufer und ein Viertel kriecht nicht den Steilhang hoch.
 * Sternfoermig um den Mittelpunkt, die Ecken laufen streng im Winkel — das
 * Polygon bleibt damit ueberschneidungsfrei (Bedingung fuer inPoly).
 */
function umriss(cx, cz, r, ecken, wob, seed, regel) {
  var pts = [];
  for (var i = 0; i < ecken; i++) {
    var a = i / ecken * Math.PI * 2;
    var rad = r * (1 + (hashi(i, 0, seed) - 0.5) * wob);
    // zweite, langwellige Stoerung: ohne sie sieht der Umriss wie ein Zahnrad aus
    rad *= 0.86 + fractal(Math.cos(a) * 1.7 + 8, Math.sin(a) * 1.7 + 8, seed + 5) * 0.3;
    var x = cx + Math.cos(a) * rad, z = cz + Math.sin(a) * rad;
    for (var s = 0; s < 7 && regel && !regel(x, z); s++) {
      rad *= 0.84;
      x = cx + Math.cos(a) * rad; z = cz + Math.sin(a) * rad;
    }
    pts.push({ x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 });
  }
  return pts;
}


/* ==========================================================================
   2. Fluesse — steilster Abstieg von den Gipfeln

   Von jeder Quelle laeuft ein Lauf dem Gefaelle nach, bis er Wasser, einen
   anderen Lauf, eine Senke oder den Kartenrand erreicht. Zusammenfluesse
   entstehen echt: ein Lauf, der einem anderen zu nahe kommt, endet dort — und
   gibt seine Wassermenge weiter. Aus der Menge folgt die Breite, und weil die
   Menge an jedem Zufluss springt, wird der Lauf dort in einen breiteren
   Abschnitt geteilt. Der Bruch in der Breite liegt damit genau an der Stelle,
   an der er auch in der Natur liegt.
   ========================================================================== */

var FLUSS_SCHRITT = 3.0;          // Abtastweite eines Laufs in Welteinheiten
var FLUSS_MAX = 900;              // harter Deckel der Schritte je Lauf
// Arbeitsspeicher der Richtungsabtastung — einmal angelegt statt je Schritt
// (ein Lauf macht bis zu 900 Schritte, eine Karte bis zu zwoelf Laeufe).
var _zx = new Float64Array(16), _zz = new Float64Array(16), _zh = new Float64Array(16);

function laufeAb(W, sx, sz, nr, flussRaster) {
  var A = W.A, half = KARTE.half, nx = A.nx;
  var pts = [{ x: sx, z: sz }];
  var x = sx, z = sz, hier = heightAt(x, z);
  var dx = 0, dz = 0;             // letzte Richtung (Traegheit gegen Zickzack)
  var ende = "deckel", trifft = -1, trifftIdx = -1;
  for (var s = 0; s < FLUSS_MAX; s++) {
    // 16 Richtungen absuchen. Bewertet wird die Zielhoehe, dazu zwei
    // Korrekturen: ein feines Rauschen (Maeander — ein Fluss folgt nicht der
    // Rechenmitte) und ein Traegheitsbonus fuer die bisherige Richtung.
    //
    // BEIDE sind an die oertliche Reliefspanne gekoppelt, nicht an feste
    // Zahlen. Grund (gemessen): auf einer 256er Wiese liegt das ganze Land in
    // einem Hoehenband von rund 12 Einheiten, ein Schritt faellt oft nur um
    // 0.2 — ein festes Rauschen von +-0.4 wuerde das Gefaelle vollstaendig
    // uebertoenen, der Lauf irrte und endete nach wenigen Schritten in einer
    // Scheinsenke. Im Gebirge waere dasselbe Rauschen wirkungslos. Relativ
    // gerechnet maeandert der Fluss in der Ebene weit und folgt im engen Tal
    // der Sohle.
    var zx = _zx, zz2 = _zz, zh = _zh;
    var gueltig = 0, hLo = 1e9, hHi = -1e9, k, a, cx, cz;
    for (k = 0; k < 16; k++) {
      a = k / 16 * Math.PI * 2;
      cx = Math.cos(a); cz = Math.sin(a);
      var px = x + cx * FLUSS_SCHRITT, pz = z + cz * FLUSS_SCHRITT;
      if (px < -half + 2 || px > half - 2 || pz < -half + 2 || pz > half - 2) { zh[k] = 1e9; continue; }
      var hk = heightAt(px, pz);
      zx[k] = px; zz2[k] = pz; zh[k] = hk; gueltig++;
      if (hk < hLo) hLo = hk;
      if (hk > hHi) hHi = hk;
    }
    if (!gueltig) { ende = "rand"; break; }
    var relief = Math.max(0.08, hHi - hLo);
    var bestW = 1e9, bx = 0, bz = 0, bdx = 0, bdz = 0;
    for (k = 0; k < 16; k++) {
      if (zh[k] >= 1e9) continue;
      a = k / 16 * Math.PI * 2;
      cx = Math.cos(a); cz = Math.sin(a);
      var w = zh[k]
        + (fractal(zx[k] * 0.05, zz2[k] * 0.05, W.seed + 331 + nr) - 0.5) * relief * 0.55
        - (cx * dx + cz * dz) * relief * 0.30;
      if (w < bestW) { bestW = w; bx = zx[k]; bz = zz2[k]; bdx = cx; bdz = cz; }
    }
    x = bx; z = bz; dx = bdx; dz = bdz;
    var hNeu = heightAt(x, z);
    pts.push({ x: x, z: z });
    // Zusammenfluss: liegt der neue Punkt auf einem fremden Lauf, endet dieser
    // hier. Der Rasterspeicher haelt je Zelle Lauf- und Punktindex.
    var gi = Math.round((x + half) / RASTER), gj = Math.round((z + half) / RASTER);
    if (gi >= 0 && gj >= 0 && gi < nx && gj < nx) {
      var gid = gj * nx + gi;
      if (flussRaster.lauf[gid] >= 0 && flussRaster.lauf[gid] !== nr) {
        trifft = flussRaster.lauf[gid]; trifftIdx = flussRaster.idx[gid];
        ende = "zufluss"; break;
      }
    }
    if (hNeu < WATER + 0.15) { ende = "muendung"; break; }
    if (x < -half + 6 || x > half - 6 || z < -half + 6 || z > half - 6) { ende = "rand"; break; }
    // Kein Gefaelle mehr: hier steht das Wasser. Ein Versuch mit doppeltem
    // Schritt darf noch ueber eine flache Schwelle springen (sonst enden
    // Laeufe in jeder Bodenwelle), danach ist es ein See.
    if (hNeu > hier - 0.005) {
      var raus = false;
      for (var q = 0; q < 16; q++) {
        var aq = q / 16 * Math.PI * 2;
        var qx = x + Math.cos(aq) * FLUSS_SCHRITT * 2.2, qz = z + Math.sin(aq) * FLUSS_SCHRITT * 2.2;
        if (qx < -half + 6 || qx > half - 6 || qz < -half + 6 || qz > half - 6) continue;
        if (heightAt(qx, qz) < hier - 0.05) {
          x = qx; z = qz; hNeu = heightAt(x, z); pts.push({ x: x, z: z }); raus = true; break;
        }
      }
      if (!raus) { ende = "senke"; break; }
    }
    hier = hNeu;
  }
  return { punkte: pts, ende: ende, trifft: trifft, trifftIdx: trifftIdx, nr: nr };
}

function laufLaenge(pts) {
  var l = 0;
  for (var i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  return l;
}

/** Breite aus der Wassermenge (hier: eingesammelte Lauflaenge). Wurzelgesetz —
 *  doppelte Breite braucht die vierfache Menge, so wirkt kein Bach wie ein Strom. */
function breiteAus(menge) { return clamp(3.2 + Math.sqrt(Math.max(0, menge)) * 0.52, 3, 26); }

function erzeugeFluesse(W) {
  var A = W.A, o = W.o;
  var nx = A.nx;
  var flussRaster = { lauf: new Int32Array(nx * nx).fill(-1), idx: new Int32Array(nx * nx) };
  var laeufe = [];
  var wunsch = Math.round((2 + 2.4 * skala()) * o.fluesse);
  wunsch = clamp(wunsch, 0, 12);
  if (!wunsch || !A.gipfel.length) return laeufe;

  // Quellen: aus den hoechsten Gipfeln, mit Mindestabstand, seed-gewuerfelt
  // durchgeschuettelt (sonst laegen bei jeder Karte alle Quellen im hoechsten
  // Massiv). Der Strom haengt am Weltseed, nicht an der Aufrufreihenfolge.
  var rq = strom(0, 0, W.seed + 4711);
  var kandidaten = A.gipfel.slice(0, Math.max(wunsch * 5, 24));
  var quellen = [], minAb = 34 * Math.sqrt(skala());
  for (var i = 0; i < kandidaten.length && quellen.length < wunsch; i++) {
    // Ueberspringen mit fester Wahrscheinlichkeit statt echtem Mischen: das
    // haelt die Reihenfolge nach Hoehe grob erhalten (hohe Gipfel bleiben die
    // wahrscheinlicheren Quellen), streut aber ueber das Massiv.
    if (rq() < 0.25 && kandidaten.length - i > wunsch - quellen.length) continue;
    var g = kandidaten[i], frei = true;
    for (var q = 0; q < quellen.length; q++) {
      if (Math.hypot(quellen[q].x - g.x, quellen[q].z - g.z) < minAb) { frei = false; break; }
    }
    if (frei) quellen.push(g);
  }

  for (var s = 0; s < quellen.length; s++) {
    var lauf = laufeAb(W, quellen[s].x, quellen[s].z, laeufe.length, flussRaster);
    if (lauf.punkte.length < 8) continue;            // Rinnsal, keine Karte wert
    lauf.eigen = laufLaenge(lauf.punkte);
    if (lauf.eigen < 40) continue;
    lauf.zufluss = [];
    var nr = laeufe.length;
    lauf.nr = nr;
    laeufe.push(lauf);
    // In das Zusammenfluss-Raster eintragen (mit einer Zelle Toleranz, damit
    // ein anderer Lauf ihn auch quer trifft).
    for (var p = 0; p < lauf.punkte.length; p++) {
      var pt = lauf.punkte[p];
      merkeFluss(flussRaster, nx, pt.x, pt.z, nr, p);
    }
  }

  // Wassermengen: rueckwaerts, weil ein Lauf nur in einen FRUEHEREN muenden
  // kann (das Raster kennt spaetere noch nicht). Damit ist jeder Zufluss
  // fertig gerechnet, bevor sein Ziel drankommt.
  for (var t = laeufe.length - 1; t >= 0; t--) {
    var L = laeufe[t];
    L.gesamt = L.eigen;
    for (var zz = 0; zz < L.zufluss.length; zz++) L.gesamt += L.zufluss[zz].menge;
    if (L.trifft >= 0 && laeufe[L.trifft]) {
      laeufe[L.trifft].zufluss.push({ bei: L.trifftIdx, menge: L.gesamt });
    }
  }

  // Elemente bauen: je Lauf ein bis drei Abschnitte, geteilt an den groessten
  // Zufluessen. Die Abschnitte teilen sich den Trennpunkt, das Wasserband
  // laeuft also ohne Luecke weiter — nur breiter.
  for (var e = 0; e < laeufe.length; e++) abschnitteEinsetzen(W, laeufe[e]);
  return laeufe;
}

function merkeFluss(fr, nx, x, z, nr, idx) {
  var half = KARTE.half;
  var i0 = Math.round((x + half) / RASTER), j0 = Math.round((z + half) / RASTER);
  for (var dj = -1; dj <= 1; dj++) {
    for (var di = -1; di <= 1; di++) {
      var i = i0 + di, j = j0 + dj;
      if (i < 0 || j < 0 || i >= nx || j >= nx) continue;
      var id = j * nx + i;
      if (fr.lauf[id] < 0) { fr.lauf[id] = nr; fr.idx[id] = idx; }
    }
  }
}

function abschnitteEinsetzen(W, L) {
  var pts = L.punkte, n = pts.length;
  /* EIN Name je Lauf, nicht je Abschnitt: die zwei bis drei Elemente sind
     derselbe Fluss, nur mit verschiedener Breite. Gemessen wird in der Mitte
     des Laufs — dort liegt die Landschaft, die ihn praegt, und nicht die
     Quelle auf dem Gipfel. */
  var mitte = pts[n >> 1];
  var flussName = benenne(W, "fluss", mitte.x, mitte.z,
    elementSeed(W.seed, 9000 + L.nr), "fluss", L.nr);
  L.name = flussName;
  // Trennstellen: Zufluesse, die die Menge deutlich anheben (> 25 %) und weit
  // genug von den Enden und voneinander liegen.
  var zu = L.zufluss.slice().sort(function (a, b) { return (a.bei - b.bei) || (a.menge - b.menge); });
  var trenn = [];
  for (var i = 0; i < zu.length; i++) {
    var bei = zu[i].bei;
    if (bei < 10 || bei > n - 10) continue;
    if (trenn.length && bei - trenn[trenn.length - 1] < 14) continue;
    if (zu[i].menge < L.eigen * 0.25) continue;
    trenn.push(bei);
    if (trenn.length >= 2) break;
  }
  var grenzen = [0].concat(trenn, [n - 1]);
  for (var s = 0; s < grenzen.length - 1; s++) {
    var a = grenzen[s], b = grenzen[s + 1];
    var teil = pts.slice(a, b + 1);
    if (teil.length < 4) continue;
    // Menge an dieser Stelle: eigene Laufstrecke bis zum Abschnittsende plus
    // alle Zufluesse, die davor muenden.
    var menge = laufLaenge(pts.slice(0, b + 1));
    for (var z2 = 0; z2 < L.zufluss.length; z2++) if (L.zufluss[z2].bei <= b) menge += L.zufluss[z2].menge;
    var breite = breiteAus(menge);
    var punkte = vereinfache(teil, 1.7, 16);
    if (punkte.length < 2) continue;
    benenneElement(fuegeEin(W, "pfad", "fluss", punkte, {
      breite: Math.round(breite * 2) / 2,
      tiefe: Math.round(clamp(1.4 + breite * 0.22, 1, 8) * 2) / 2
    }), flussName);
    // Belegung: der Flusslauf selbst und ein Uferstreifen sind kein Bauland.
    for (var p = 0; p < teil.length; p += 2) stempel(W.bel, teil[p].x, teil[p].z, breite * 0.6 + 3, B_FLUSS);
  }
}


/* ==========================================================================
   3. Siedlungen — Bewertung jeder Kandidatenzelle

   punkte =  1.9 * flach      Hangneigung im 3x3-Mittel (22° .. 7°)
           + 1.6 * wasser     Wassernaehe 34 .. 7 Einheiten, aber nicht IM Wasser
           + 1.5 * fluss      dasselbe fuer den naechsten Flusslauf (Furt!)
           + 1.2 * muendung   Naehe zu einer Flussmuendung
           + 0.9 * bucht      Anteil Wasser auf einem Ring: am besten die Haelfte
           + 0.8 * hoehe      knapp ueber dem Spiegel, nicht im Hochgebirge
           + 0.6 * pass       Passhoehe in Reichweite
           + 0.4 * rauschen   ortsstabiler Hash, bricht Gleichstaende auf

   Die Gewichte sind Gestaltung, keine Physik: Wasser und Flachheit tragen die
   Entscheidung, die Sonderlagen (Muendung, Bucht, Pass) heben einzelne Orte
   heraus, damit nicht alle Siedlungen gleich aussehen.
   ========================================================================== */

function erzeugeSiedlungen(W, laeufe) {
  var A = W.A, o = W.o, half = KARTE.half, nx = A.nx;
  var wunsch = Math.round((2 + 2.2 * skala()) * o.siedlungen);
  wunsch = clamp(wunsch, 0, 14);
  if (!wunsch) return [];

  // Flussabstand und Muendungen als eigene Felder — sie kosten einmal eine
  // Distanztransformation und sparen je Kandidat eine Schleife ueber alle Laeufe.
  var flussMarke = new Uint8Array(nx * nx), muendMarke = new Uint8Array(nx * nx);
  var f, p;
  for (f = 0; f < laeufe.length; f++) {
    var L = laeufe[f];
    for (p = 0; p < L.punkte.length; p++) markiere(flussMarke, nx, L.punkte[p].x, L.punkte[p].z);
    if (L.ende === "muendung" || L.ende === "senke") {
      var letzt = L.punkte[L.punkte.length - 1];
      markiere(muendMarke, nx, letzt.x, letzt.z);
    }
  }
  var flussAbstand = laeufe.length ? abstandsFeld(nx, flussMarke) : null;
  var muendAbstand = laeufe.length ? abstandsFeld(nx, muendMarke) : null;
  var passMarke = new Uint8Array(nx * nx);
  for (p = 0; p < A.paesse.length; p++) markiere(passMarke, nx, A.paesse[p].x, A.paesse[p].z);
  var passAbstand = A.paesse.length ? abstandsFeld(nx, passMarke) : null;

  var kand = [];
  // Schrittweite 2 Rasterzellen = alle 8 Welteinheiten. Feiner braucht es
  // nicht: der Mindestabstand der Orte liegt bei ueber 40.
  for (var j = 2; j < nx - 2; j += 2) {
    for (var i = 2; i < nx - 2; i += 2) {
      var id = j * nx + i;
      if (A.wasser[id]) continue;
      var x = i * RASTER - half, z = j * RASTER - half;
      var dW = A.wasserAbstand[id];
      if (dW < 1.5 || dW > 90) continue;                 // weder Watt noch Binnenoede
      if (!fest(x, z)) continue;                          // gemeinsame Bodenregel
      if (belegt(W.bel, x, z, B_FLUSS)) continue;         // nicht ins Flussbett
      var nyM = (A.ny[id] * 2 + A.ny[id - 1] + A.ny[id + 1] + A.ny[id - nx] + A.ny[id + nx]) / 6;
      var flach = sstep(COS22, COS7, nyM);
      if (flach < 0.12) continue;                         // zu steil, gar nicht erst bewerten
      var hh = A.h[id];
      var wasser = sstep(34, 7, dW) * sstep(1.5, 5, dW);
      var fluss = flussAbstand ? sstep(26, 5, flussAbstand[id]) * sstep(1.5, 4.5, flussAbstand[id]) : 0;
      var muend = muendAbstand ? sstep(30, 6, muendAbstand[id]) : 0;
      var pass = passAbstand ? sstep(26, 4, passAbstand[id]) : 0;
      var hoehe = sstep(0.3, 2.2, hh - WATER) * sstep(26, 12, hh);
      var b = wasserRingAnteil(x, z, 17);
      var bucht = 4 * b * (1 - b);                        // Maximum bei halb Wasser
      var rausch = hashi(i, j, W.seed + 101);
      var punkte = 1.9 * flach + 1.6 * wasser + 1.5 * fluss + 1.2 * muend +
                   0.9 * bucht + 0.8 * hoehe + 0.6 * pass + 0.4 * rausch;
      if (punkte < 1.2) continue;
      kand.push({ x: x, z: z, p: punkte, id: id });
    }
  }
  kand.sort(function (a, b2) { return (b2.p - a.p) || (a.id - b2.id); });

  var minAb = 48 * Math.sqrt(skala());
  var orte = [];
  for (var k = 0; k < kand.length && orte.length < wunsch; k++) {
    var c = kand[k], frei = true;
    for (var q = 0; q < orte.length; q++) {
      if (Math.hypot(orte[q].x - c.x, orte[q].z - c.z) < minAb) { frei = false; break; }
    }
    if (frei) orte.push(c);
  }

  var stil = o.stil || BIOM_STIL[S.biom] || "dorf";
  for (var m = 0; m < orte.length; m++) siedlungEinsetzen(W, orte[m], m, stil);
  return orte;
}

function markiere(feld, nx, x, z) {
  var half = KARTE.half;
  var i = Math.round((x + half) / RASTER), j = Math.round((z + half) / RASTER);
  if (i < 0 || j < 0 || i >= nx || j >= nx) return;
  feld[j * nx + i] = 1;
}

/** Anteil Wasser auf einem Ring — Mass fuer eine Bucht (halb Wasser = Bucht,
 *  ganz Wasser = Insel/Klippe, gar keins = Binnenland). */
function wasserRingAnteil(x, z, r) {
  var n = 12, w = 0;
  for (var k = 0; k < n; k++) {
    var a = k / n * Math.PI * 2;
    if (heightAt(x + Math.cos(a) * r, z + Math.sin(a) * r) < WATER) w++;
  }
  return w / n;
}

function siedlungEinsetzen(W, ort, nr, stil) {
  var rs = strom(nr, 0, W.seed + 202);
  // Die erste Siedlung ist die groesste — eine Karte braucht eine Hauptstadt.
  var gross = nr === 0 ? 1.35 : (nr === 1 ? 1.1 : 1);
  var r = (16 + rr(rs, 0, 9)) * gross * Math.sqrt(skala());
  var pts = umriss(ort.x, ort.z, r, ri(rs, 8, 10), 0.30, W.seed + 700 + nr, fest);
  var netz = wpick(rs, [["raster", 3], ["gebogen", 4], ["zellen", 2], ["ring", 2]]);
  var viertel = fuegeEin(W, "flaeche", "viertel", pts, {
    netz: netz,
    block: Math.round(rr(rs, 14, 26)),
    gasse: Math.round(rr(rs, 2.75, 4.5) * 4) / 4,
    drehung: Math.round(rr(rs, 0, 180)),
    dichte: Math.round(rr(rs, 0.9, 1.5) * 20) / 20,
    stil: stil
  });
  // Der Ortsname entsteht AN DER STELLE der Siedlung — sie stand vorher schon
  // wegen ihrer Lage da (Furt, Muendung, Bucht, Pass), und genau diese Lage
  // waehlt nun das Grundwort. Deshalb heisst ein Fischerdorf nicht Steinhalde.
  ort.name = benenne(W, "ort", ort.x, ort.z, viertel.seed, "ort", nr);
  benenneElement(viertel, ort.name);
  ort.r = r;
  ort.stil = stil;
  stempel(W.bel, ort.x, ort.z, r + 4, B_ORT);

  // Felder daneben: 1-2 Stueck, auf der flachsten freien Seite.
  var felder = ri(rs, 1, 2);
  var gesetzt = 0;
  for (var v = 0; v < 10 && gesetzt < felder; v++) {
    var a = rr(rs, 0, Math.PI * 2);
    var d = r + rr(rs, 10, 20);
    var fx = ort.x + Math.cos(a) * d, fz = ort.z + Math.sin(a) * d;
    if (!fest(fx, fz)) continue;
    if (belegt(W.bel, fx, fz, B_ORT | B_FLUSS)) continue;
    if (slopeAt(fx, fz) < COS12) continue;                 // Aecker liegen eben
    var fr = rr(rs, 9, 15) * Math.sqrt(skala());
    var feld = fuegeEin(W, "flaeche", "feld", umriss(fx, fz, fr, ri(rs, 6, 8), 0.24, W.seed + 760 + nr * 4 + v, fest), {
      drehung: Math.round(rr(rs, 0, 180)),
      reihe: Math.round(rr(rs, 2.4, 4.2) * 10) / 10,
      hoehe: Math.round(rr(rs, 0.8, 1.2) * 20) / 20,
      frucht: wpick(rs, [["weizen", 5], ["kohl", 2], ["lavendel", 1], ["brache", 1]])
    });
    /* Acker haben keinen ERFUNDENEN Namen — sie gehoeren zum Ort und heissen
       nach ihm. Die Himmelsrichtung kommt aus der tatsaechlichen Lage zum
       Ortsmittelpunkt: sie macht die beiden Aecker EINER Siedlung
       unterscheidbar und ist zugleich die Auskunft, die ein Spielleiter am
       Tisch braucht. */
    benenneElement(feld, ort.name
      ? himmelsrichtung(fx - ort.x, fz - ort.z) + "äcker von " + ort.name : null);
    stempel(W.bel, fx, fz, fr + 2, B_ORT);
    gesetzt++;
  }
}


/* ==========================================================================
   4. Strassen — Wegsuche zwischen den Siedlungen

   Verbunden wird ueber einen minimalen Spannbaum (Prim, auf Luftlinie): jede
   Siedlung ist erreichbar, und es entsteht kein Netz aus Querverbindungen, die
   niemand geht. Ab vier Orten kommt EINE zusaetzliche Kante dazu — ein Ring
   liest sich lebendiger als ein Baum.

   Die schon gefundenen Wege werden in die eigene Belegung gestempelt und der
   Wegsuche als `bonus` gereicht: die naechste Strasse legt sich dann gern auf
   die vorhandene, statt daneben herzulaufen (siehe Kostenmodell wegsuche.js).
   ========================================================================== */

function erzeugeStrassen(W, orte) {
  var o = W.o;
  if (!o.strassen || orte.length < 2) return;
  var bel = W.bel;
  function bonusBei(x, z) { return belegt(bel, x, z, B_WEG) ? 1 : 0; }

  // Prim auf Luftlinie.
  var drin = [0], draussen = [], kanten = [];
  var i, j;
  for (i = 1; i < orte.length; i++) draussen.push(i);
  while (draussen.length) {
    var bestA = -1, bestB = -1, bestD = Infinity, bestQ = -1;
    for (i = 0; i < drin.length; i++) {
      for (j = 0; j < draussen.length; j++) {
        var d = Math.hypot(orte[drin[i]].x - orte[draussen[j]].x, orte[drin[i]].z - orte[draussen[j]].z);
        if (d < bestD) { bestD = d; bestA = drin[i]; bestB = draussen[j]; bestQ = j; }
      }
    }
    kanten.push([bestA, bestB]);
    drin.push(bestB);
    draussen.splice(bestQ, 1);
  }
  // Zusatzkante: die kuerzeste Verbindung, die noch keine ist.
  if (orte.length >= 4) {
    var zA = -1, zB = -1, zD = Infinity;
    for (i = 0; i < orte.length; i++) {
      for (j = i + 1; j < orte.length; j++) {
        var schon = false;
        for (var k = 0; k < kanten.length; k++) {
          if ((kanten[k][0] === i && kanten[k][1] === j) || (kanten[k][0] === j && kanten[k][1] === i)) schon = true;
        }
        if (schon) continue;
        var dd = Math.hypot(orte[i].x - orte[j].x, orte[i].z - orte[j].z);
        if (dd < zD) { zD = dd; zA = i; zB = j; }
      }
    }
    if (zA >= 0) kanten.push([zA, zB]);
  }

  var stil = o.stil || BIOM_STIL[S.biom] || "dorf";
  for (var e = 0; e < kanten.length; e++) {
    var a = orte[kanten[e][0]], b = orte[kanten[e][1]];
    var weg = sucheWeg(a, b, {
      // Auf grossen Karten die Knoten groeber setzen: die Suche waechst
      // quadratisch mit der Aufloesung, das Bild gewinnt dabei nichts.
      schritt: KARTE.map >= 1024 ? 4 : 2,
      bonus: bonusBei,
      // Die Korridormaske zeigt beim Erzeugen noch die ALTE Karte — sie
      // wuerde Wege an Strassen kleben, die es gleich nicht mehr gibt.
      korridorAn: false,
      maxPunkte: 20
    });
    if (weg.length < 2) continue;
    if (!weg.vollstaendig && weg.laenge < Math.hypot(a.x - b.x, a.z - b.z) * 0.4) continue;
    // Reine Punktobjekte statt des Rueckgabe-Arrays: an dem haengen noch die
    // Messwerte (.kosten, .ms). Sie wuerden beim Speichern zwar ohnehin
    // wegfallen, haetten in einem Element aber nichts verloren.
    var punkte = [];
    for (var w = 0; w < weg.length; w++) {
      punkte.push({ x: Math.round(weg[w].x * 10) / 10, z: Math.round(weg[w].z * 10) / 10 });
    }
    var rw = strom(e, 1, W.seed + 303);
    var breite = Math.round(rr(rw, 5, 8) * 2) / 2;
    var strasse = fuegeEin(W, "pfad", "strasse", punkte, {
      breite: breite,
      belag: wpick(rw, [["erde", 5], ["stein", 2], ["pflaster", 1]]),
      haeuser: rw() < 0.75,
      stil: stil,
      abstand: Math.round(rr(rw, 12, 24)),
      streuung: Math.round(rr(rw, 1, 3) * 5) / 5
    });
    /* Strassen bekommen keinen erfundenen Namen, sondern ihren wahren: eine
       Strasse heisst nach dem, was sie verbindet. Deshalb steht hier kein
       nameFuer-Aufruf — die Ortsnamen liegen schon vor. */
    if (W.o.namen && a.name && b.name) strasse.params.name = "Weg von " + a.name + " nach " + b.name;
    // Vormerken, damit die naechste Strasse sich anlehnt und die Vegetation
    // nicht auf der Fahrbahn beginnt. Feiner abgetastet als die Stuetzpunkte,
    // sonst blieben zwischen zwei Griffen Luecken.
    for (var s = 1; s < punkte.length; s++) {
      var q0 = punkte[s - 1], q1 = punkte[s];
      var laenge = Math.hypot(q1.x - q0.x, q1.z - q0.z);
      var n = Math.max(1, Math.ceil(laenge / 6));
      for (var t = 0; t <= n; t++) {
        stempel(W.bel, lerp(q0.x, q1.x, t / n), lerp(q0.z, q1.z, t / n), breite * 0.5 + 3, B_WEG);
      }
    }
  }
}


/* ==========================================================================
   5. Vegetation — Wald am Hang, Wiese in der Ebene

   wald  = steiler als 5°   (sstep COS5 -> COS12)
         * flacher als 38°  (sstep COS38 -> COS25)
         * ueber dem Spiegel und unter der Baumgrenze
         * Klumpenrauschen (fractal) — Waelder stehen in Massiven, nicht im Raster
   wiese = flacher als 12° * niedrig gelegen * Gegenstueck des Waldrauschens

   Zuletzt vor Arbor, damit sie Siedlungen, Felder und Strassen kennt: die
   MITTELPUNKTE weichen der Belegung aus. Ueber die Flaechen dürfen Wald und
   Wiese ruhig hinweggreifen — beim Bauen der Instanzen sorgt tryPlace mit der
   dann gefuellten Korridormaske dafuer, dass kein Baum auf der Strasse steht.
   ========================================================================== */

function erzeugeVegetation(W) {
  var A = W.A, o = W.o, half = KARTE.half, nx = A.nx;
  var flaeche = skala() * skala();
  var nWald = clamp(Math.round((3 + 4 * flaeche) * o.waldanteil), 0, 26);
  var nWiese = clamp(Math.round((2 + 3 * flaeche) * o.wiesen), 0, 20);
  if (!nWald && !nWiese) return;

  var waldKand = [], wieseKand = [];
  for (var j = 2; j < nx - 2; j += 2) {
    for (var i = 2; i < nx - 2; i += 2) {
      var id = j * nx + i;
      if (A.wasser[id]) continue;
      var x = i * RASTER - half, z = j * RASTER - half;
      if (!fest(x, z)) continue;
      if (belegt(W.bel, x, z, B_ORT | B_WEG | B_FLUSS)) continue;
      var ny = A.ny[id], hh = A.h[id];
      var ueber = sstep(0.6, 3, hh - WATER);
      var klump = fractal(x * 0.013, z * 0.013, W.seed + 909);
      // Hoehenbaender ueber die LAND-Quantile (siehe analysiere): ein absolutes
      // Band waere je Biom und Seed voellig anders geeicht.
      var wald = sstep(COS5, COS12, ny) * sstep(COS38, COS25, ny) * ueber *
                 sstep(A.baumGrenze, A.landP50, hh) * (0.35 + klump * 0.9) +
                 hashi(i, j, W.seed + 911) * 0.25;
      var wiese = sstep(COS12, COS5, ny) * ueber * sstep(A.landP85, A.landP20, hh) *
                  (1.05 - klump * 0.8) + hashi(i, j, W.seed + 913) * 0.25;
      if (wald > 0.55) waldKand.push({ x: x, z: z, p: wald, id: id });
      if (wiese > 0.55) wieseKand.push({ x: x, z: z, p: wiese, id: id });
    }
  }
  waldKand.sort(function (a, b) { return (b.p - a.p) || (a.id - b.id); });
  wieseKand.sort(function (a, b) { return (b.p - a.p) || (a.id - b.id); });

  var gesetzt = [];
  flaechenSetzen(W, waldKand, nWald, gesetzt, 34 * Math.sqrt(skala()), "wald");
  flaechenSetzen(W, wieseKand, nWiese, gesetzt, 30 * Math.sqrt(skala()), "wiese");
}

function flaechenSetzen(W, kand, anzahl, gesetzt, minAb, art) {
  var o = W.o;
  var nr = 0;
  for (var k = 0; k < kand.length && nr < anzahl; k++) {
    var c = kand[k], frei = true;
    for (var q = 0; q < gesetzt.length; q++) {
      // Gegenueber der EIGENEN Art gilt der volle Mindestabstand, gegenueber
      // der anderen nur gut die Haelfte. Sonst blockiert der zuerst gesetzte
      // Wald die halbe Karte fuer die Wiesen — Wald am Hang und Wiese in der
      // Ebene duerfen ruhig aneinandergrenzen, das ist sogar das Bild.
      var ab = gesetzt[q].art === art ? minAb : minAb * 0.55;
      if (Math.hypot(gesetzt[q].x - c.x, gesetzt[q].z - c.z) < ab) { frei = false; break; }
    }
    if (!frei) continue;
    if (belegt(W.bel, c.x, c.z, B_GRUEN | B_ORT | B_WEG)) continue;
    var rv = strom(nr, art === "wald" ? 2 : 3, W.seed + 404);
    var r = (art === "wald" ? rr(rv, 20, 40) * o.waldanteil : rr(rv, 16, 30)) * Math.sqrt(skala());
    r = clamp(r, 10, 70);
    var pts = umriss(c.x, c.z, r, ri(rv, 8, 12), 0.34, W.seed + 800 + nr * 3 + (art === "wald" ? 0 : 1), fest);
    if (art === "wald") {
      var wald = fuegeEin(W, "flaeche", "wald", pts, {
        dichte: Math.round(rr(rv, 0.8, 1.6) * 20) / 20,
        klumpen: Math.round(rr(rv, 0.35, 0.75) * 50) / 50,
        mischung: Math.round(rr(rv, 0.1, 0.6) * 50) / 50,
        unterholz: Math.round(rr(rv, 0.2, 0.6) * 50) / 50
      });
      benenneElement(wald, benenne(W, "wald", c.x, c.z, wald.seed, "wald", nr));
    } else {
      // Wiesen als "region" benannt: eine Wiese traegt in der Regel keinen
      // eigenen Namen, wohl aber der Landstrich, auf dem sie liegt.
      var wiese = fuegeEin(W, "flaeche", "wiese", pts, {
        dichte: Math.round(rr(rv, 0.9, 1.7) * 20) / 20,
        blumen: Math.round(rr(rv, 0.15, 0.5) * 50) / 50
      });
      benenneElement(wiese, benenne(W, "region", c.x, c.z, wiese.seed, "wiese", nr));
    }
    stempel(W.bel, c.x, c.z, r * 0.7, B_GRUEN);
    c.art = art;
    gesetzt.push(c);
    nr++;
  }
}


/* ==========================================================================
   6. Arbor zuletzt

   Zwei bis fuenf Ranken an markanten Punkten — Gipfel und Paesse, gefiltert
   ueber rankePlatzierbar (vines.js, nur gelesen): kein Wasser, kein Steilhang.
   Alle bekommen `kernzug` > 0, neigen sich also zur Kartenmitte, dem Apfelkern;
   Hoehe und Dicke sind gestaffelt, damit eine Rangordnung sichtbar wird, und
   mindestens eine traegt ein Plateau-Staedtchen. Damit steht der Kanon auf der
   Karte, ohne dass ihn jemand kennen muss.
   ========================================================================== */

function erzeugeRanken(W, orte) {
  var A = W.A, o = W.o;
  var anzahl = clamp(Math.round(o.ranken), 0, 5);
  if (!anzahl) return;
  var half = KARTE.half;

  // Kandidaten: erst Gipfel (nach Hoehe), dann Paesse als Auffuellung.
  var kand = A.gipfel.concat(A.paesse);
  var gewaehlt = [], minAb = 60 * Math.sqrt(skala());
  for (var k = 0; k < kand.length && gewaehlt.length < anzahl; k++) {
    var c = kand[k];
    // Kernzug neigt die Ranke zur Mitte; am Kartenrand kippte sie sonst ueber
    // die Kante hinaus, wo der Boden abfaellt.
    if (Math.abs(c.x) > half - 30 || Math.abs(c.z) > half - 30) continue;
    if (!rankePlatzierbar(c.x, c.z)) continue;
    if (!fest(c.x, c.z)) continue;
    var frei = true;
    for (var q = 0; q < gewaehlt.length; q++) {
      if (Math.hypot(gewaehlt[q].x - c.x, gewaehlt[q].z - c.z) < minAb) { frei = false; break; }
    }
    // Nicht mitten in eine Siedlung: eine Ranke ist ein Wahrzeichen am Horizont.
    for (var m = 0; orte && m < orte.length; m++) {
      if (Math.hypot(orte[m].x - c.x, orte[m].z - c.z) < (orte[m].r || 20) + 18) frei = false;
    }
    if (frei) gewaehlt.push(c);
  }

  var stil = o.stil || BIOM_STIL[S.biom] || "dorf";
  for (var i = 0; i < gewaehlt.length; i++) {
    var g = gewaehlt[i];
    var rr2 = strom(i, 4, W.seed + 505);
    // Rangordnung: die erste Ranke ist die hoechste und traegt das Staedtchen.
    var rang = 1 - i / Math.max(1, gewaehlt.length);
    var hoehe = Math.round(lerp(120, 300, rang * rang) * rr(rr2, 0.88, 1.12) / 5) * 5;
    var dicke = Math.round(lerp(0.75, 1.6, rang) * rr(rr2, 0.9, 1.15) * 20) / 20;
    var staedtchen = i === 0 || rr2() < 0.4;
    var ranke = fuegeEin(W, "ranke", "ranke", [{ x: Math.round(g.x), z: Math.round(g.z) }], {
      hoehe: clamp(hoehe, 60, 400),
      straenge: ri(rr2, 4, 5),
      dicke: clamp(dicke, 0.5, 2.5),
      stil: rr2() < 0.75 ? "geflochten" : "glatt",
      steigung: Math.round(rr(rr2, 2.2, 4) * 10) / 10,
      // Der Kanon: jede Ranke neigt sich zum Kern. Nie 0 — genau das ist der
      // Punkt dieser Runde.
      kernzug: Math.round(rr(rr2, 0.15, 0.55) * 20) / 20,
      blattgroesse: Math.round(rr(rr2, 0.85, 1.25) * 20) / 20,
      plateaus: staedtchen ? ri(rr2, 2, 4) : ri(rr2, 0, 2),
      plateau: Math.round(rr(rr2, 0.8, 1.3) * 20) / 20,
      staedtchen: staedtchen,
      inseln: ri(rr2, 1, 3),
      stadtStil: stil,
      stadtDichte: Math.round(rr(rr2, 0.7, 1.3) * 10) / 10
    });
    /* Ranken tragen die altertuemliche Wortwelt des Arbor-Kults, unabhaengig
       von der Sprachfamilie der Karte: eine Ranke ist ueberall dasselbe
       Wesen, und ihr Name soll sich hoerbar von den Ortsnamen abheben. */
    benenneElement(ranke, benenne(W, "ranke", g.x, g.z, ranke.seed, "ranke", i));
    stempel(W.bel, g.x, g.z, 24, B_ORT);
  }
}


/* ==========================================================================
   Einstieg
   ========================================================================== */

/**
 * Baut aus dem VORHANDENEN Terrain eine vollstaendige Elementliste und gibt sie
 * zurueck. Aendert nichts am Zustand — weder S.elements noch das Hoehenfeld.
 *
 * @param seed  Weltseed (ueblicherweise S.worldSeed; er beschreibt zusammen mit
 *              Kartengroesse und Biom bereits das Hoehenfeld)
 * @param opt   siehe WELT_STANDARD
 * @returns     Array von { kind, variant, points, params, seed } — direkt an
 *              hydrate() (core/store.js) uebergebbar.
 */
function erzeugeWelt(seed, opt) {
  var t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  seed = seed | 0;
  var A = analysiere(seed);
  var W = { seed: seed, o: optionen(opt), A: A, bel: neueBelegung(A), elemente: [] };
  /* J3: EIN Dublettenregister fuer die ganze Karte. Es traegt die vergebenen
     Namen und zaehlt, wie oft ein Bestimmungs- bzw. Grundwort schon benutzt
     wurde — daraus wird in namen.js eine Strafe auf das Gewicht. Ohne das
     bestuende eine Karte mit sechs Fluessen leicht aus sechsmal "-bach". */
  W.vergabe = neueVergabe();

  // Reihenfolge ist Inhalt, nicht Geschmack:
  //   Fluesse VOR den Siedlungen  — die Orte suchen Muendungen und Furten.
  //   Strassen NACH den Siedlungen — sie verbinden, was steht.
  //   Vegetation NACH den Strassen — sie weicht den Korridoren aus.
  //   Arbor ZULETZT               — die Ranken sollen die Orte nicht verdraengen.
  var laeufe = erzeugeFluesse(W);
  var orte = erzeugeSiedlungen(W, laeufe);
  erzeugeStrassen(W, orte);
  erzeugeVegetation(W);
  erzeugeRanken(W, orte);

  /* Der Name der Karte entsteht ZULETZT: erst jetzt kennt die Lagemessung
     Fluesse, Strassen, Waelder und Ranken. Gemessen wird an der Kartenmitte,
     das ist der Ort, den die Karte am ehesten meint. Er haengt am Element,
     das keines ist — deshalb ein eigener, vom Weltseed abgeleiteter Schluessel. */
  var region = W.o.namen
    ? nameFuer("region", 0, 0, elementSeed(seed, 31337), {
        worldSeed: seed, familie: W.o.sprachfamilie || undefined,
        rolle: "karte", index: 0, vergabe: W.vergabe,
        elemente: W.elemente, korridor: false,
        // Die Karte selbst spricht IMMER die Sprache der Karte — eine
        // Sprachinsel darf einzelne Orte umbenennen, nicht das Ganze.
        fremd: false
      })
    : null;

  var liste = W.elemente;
  liste.ms = ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - t0;
  liste.name = region;
  liste.bericht = {
    fluesse: laeufe.length, siedlungen: orte.length,
    gipfel: A.gipfel.length, senken: A.senken.length, paesse: A.paesse.length,
    landAnteil: A.landAnteil,
    // J3: wie viele Elemente einen Namen tragen und wie die Region heisst.
    region: region, namen: W.vergabe.anzahl
  };
  return liste;
}

export { erzeugeWelt, WELT_STANDARD, BIOM_STIL, analysiere, umriss };
