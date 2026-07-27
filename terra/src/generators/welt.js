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
/* `abfluss` ist eines der drei Erosions-Messfelder. world/terrain.js verbietet
   Generatoren im Kommentar zu felderSichern ausdruecklich, diese Felder zu
   lesen — mit einer benannten Ausnahme: "Erlaubt sind Auswertungen, deren
   Ergebnis der Nutzer sieht und die gespeichert werden." Genau das ist der
   Weltgenerator. Er liest den Abfluss EINMAL, macht daraus Flusselemente, und
   die Elemente stehen danach in der Datei. Nach dem Laden ist das Feld null und
   der Generator regnet gleichmaessig (siehe Abschnitt 2, RUECKFALL) — eine
   geladene Karte sieht deshalb nicht anders aus als vor dem Speichern, sie
   wuerde beim NEUEN Wuerfeln nur andere Fluesse bekommen. */
import { heightAt, slopeAt, abfluss as terrainAbfluss } from '../world/terrain.js';
import { abflussNetz, breiteAusFlaeche } from '../world/erosion.js';
/* Binnenseen (Runde H). see.js traegt beide Haelften: die Ableitung aus der
   Senkenfuellung (rein, ohne store/three) und den Elementgenerator. Der Import
   ist zyklusfrei — see.js zieht core/, world/ und generators/{objects,zeichen,
   wegsuche}, aber nie welt.js. */
import { seenAusFuellung, SEE_ZIEL_PUNKTE } from './see.js';
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
  sprachfamilie: null,
  /* I3 — Abflussfeld fuer die Flusserzeugung.
       undefined  das Laufzeitfeld aus world/terrain.js nehmen, falls es zur
                  aktuellen Kartengroesse passt (Regelfall)
       null       ausdruecklich KEINS — gleichmaessiger Regen (Rueckfall)
       Float32Array  ein eigenes Feld, VW*VW, Zeilen-Major
     Der dritte Fall ist der, an dem die Pruefungen haengen: nur so laesst sich
     dieselbe Karte mit und ohne Abfluss vergleichen. */
  abfluss: undefined
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
  // `abfluss: null` heisst "ausdruecklich keins" und muss deshalb an der
  // undefined-Regel oben vorbei.
  if (opt && Object.prototype.hasOwnProperty.call(opt, 'abfluss')) o.abfluss = opt.abfluss;
  return o;
}

/**
 * Welches Abflussfeld gilt? Nur eines mit GENAU der Laenge des aktuellen
 * Gitters — und das ist keine Formalie, sondern die Lehre aus dem Fehler, den
 * Ebene 6 fuer das Biomfeld festhaelt: felderSichern laesst die Felder nur
 * WACHSEN. Nach einer 1024er Karte ist `abfluss` 1 050 625 Eintraege lang, auch
 * wenn danach eine 256er geladen wird — und dann steht dort ein Feld in der
 * Zeilenordnung der GROSSEN Karte. Es zu lesen ergaebe keinen Fehler, nur
 * Unsinn. Gleiche Laenge heisst dagegen: die letzte Belegung galt dieser
 * Groesse, die Zeilenordnung stimmt.
 */
function abflussFeld(o) {
  if (o.abfluss === null) return null;
  var f = o.abfluss === undefined ? terrainAbfluss : o.abfluss;
  var n = KARTE.vw * KARTE.vw;
  if (!f || f.length !== n) return null;
  return f;
}

/** Faktor gegenueber der 256er-Karte (Laengenmass, nicht Flaechenmass). */
function skala() { return KARTE.map / 256; }

/** Liegt der Punkt weit genug im Land, um ueberhaupt etwas zu tragen? */
function fest(x, z) { return tryPlace(null, x, z, 0, { ignoreCorridor: true }) !== null; }

/**
 * Liegt der Punkt in einem Binnensee? Fragt die Seemaske auf dem
 * Analyseraster ab (siehe erzeugeFluesse/erzeugeSeen).
 *
 * Warum das ueberhaupt noetig ist: `tryPlace` — DIE gemeinsame Bodenregel —
 * kennt genau EIN Gewaesser, naemlich das Meer (`h < WATER + 0.35`). Ein
 * Bergsee auf Hoehe 2 besteht diese Pruefung mit fliegenden Fahnen, und
 * solange man ihn nicht sah, war das folgenlos: die Baeume standen halt in
 * einer trockenen Mulde. Jetzt sieht man sie im Wasser stehen.
 *
 * Der Umriss jeder erzeugten Flaeche zieht sich deshalb aus dem See zurueck
 * (`festAmSee` unten). Das deckt alles ab, was DIESER Generator legt. Fuer
 * HANDGEZEICHNETE Flaechen ueber einem See braucht es die Korridormaske —
 * die noetigen Zeilen in core/dirty.js stehen im Bericht.
 */
function imSee(W, x, z) {
  var m = W.seeMaske;
  if (!m || !W.A) return false;
  var nx = W.A.nx, half = KARTE.half;
  var i = Math.round((x + half) / RASTER), j = Math.round((z + half) / RASTER);
  if (i < 0 || j < 0 || i >= nx || j >= nx) return false;
  return m[j * nx + i] === 1;
}

/** Die Umrissregel aller Flaechen dieses Generators: fester Boden UND kein
 *  See. `umriss` zieht abgelehnte Ecken schrittweise ein — ein Waldrand legt
 *  sich damit von selbst ans Ufer, genau wie er sich an die Kueste legt. */
function festAmSee(W) {
  return function (x, z) { return fest(x, z) && !imSee(W, x, z); };
}


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
   2. Fluesse — dem Wasser nach, nicht dem Zufall

   Bis hierher war ein Fluss: nimm einen zufaellig gewaehlten der hoechsten
   Gipfel, laufe steilsten Abstieg. Das ergibt einen Strich, der bergab geht,
   aber keinen Fluss: er beginnt, wo nichts zusammenlaeuft, er wird breiter,
   weil er lang ist, und zwei davon laufen parallel ins selbe Meer.

   Jetzt entsteht er umgekehrt — aus dem Wasser, das da ist:

     1. SENKENFUELLUNG (world/erosion.js). Auf dem Analyseraster wird ein
        zweites, gefuelltes Hoehenfeld gerechnet. Es veraendert das Gelaende
        nicht (Begruendung dort im Kopf); es liefert nur die Zusage, ohne die
        keine Verfolgung durchhaelt: jede Zelle hat einen echt tieferen
        Nachbarn, es gibt kein Steckenbleiben.
     2. ABFLUSSNETZ. Je Zelle die Richtung des steilsten Gefaelles auf dem
        GEFUELLTEN Feld, daraus das Einzugsgebiet jeder Zelle. `akk[id]` ist
        damit die Flaeche, die ueber id abfliesst — in Zellen, und weil der
        Regen unten auf Mittelwert 1 normiert wird, auch mit gewichtetem Regen.
     3. REGEN AUS DEM GEMESSENEN ABFLUSS. Hat die Erosion gelaufen, traegt jede
        Zelle nicht 1, sondern 1 + Anteil des dort gemessenen Abflusses. Das
        verschiebt die Einzugsgebiete dorthin, wo wirklich Wasser lief, und
        damit die Quellen und den Talweg. Ohne Erosionslauf faellt der Term weg
        und es regnet gleichmaessig — siehe RUECKFALL.
     4. QUELLEN sind die KOEPFE des Gerinnenetzes: Zellen ueber der Schwelle,
        ueber denen keine weitere Zelle ueber der Schwelle liegt. Ein Fluss
        beginnt damit genau dort, wo genug zusammengekommen ist.
     5. VERFOLGUNG entlang der Abflussrichtungen bis ins Meer, an den
        Kartenrand, in einen See oder in einen schon gelegten Lauf.

   RUECKFALL. `abfluss` ist ein LAUFZEITfeld: nach dem Laden einer Datei steht
   es auf null (Absicht, siehe world/terrain.js, felderSichern). Der Generator
   faellt deshalb nicht auf das alte Verfahren zurueck, sondern auf
   gleichmaessigen Regen — dasselbe Netz, nur ohne die Gewichtung. Es entstehen
   weiterhin Fluesse, und sie liegen weiterhin in Taelern; sie wissen nur nicht,
   wo das Wasser zuletzt wirklich lief. Ein zweites, voellig anderes Verfahren
   fuer den halben Fall waere doppelte Pflege fuer weniger Ergebnis.

   WARUM DER GENERATOR DIE EROSION NICHT SELBST ANWIRFT. Sie kostet auf 1024²
   rund 456 ms, also das Achtfache des ganzen Weltgenerators, und sie
   VERAENDERT das Hoehenfeld — erzeugeWelt sagt aber im Kopf zu, nichts zu
   veraendern, und der Editor haengt daran (Undo, Vorschau, Abbruch). Die
   Erosion hat ihren eigenen Knopf mit Zeitschnitt und Fortschritt; wer sie
   gelaufen hat, bekommt gewachsene Fluesse, wer nicht, bekommt gute.

   WARUM AUF DEM ANALYSERASTER (jede vierte Welteinheit) und nicht auf dem
   Terraingitter: Faktor 16 an Zellen (66 049 statt 1 050 625 auf einer 1024er
   Karte), und die Schrittweite von 4 Welteinheiten liegt ohnehin dicht an der
   frueheren Abtastweite von 3. Das Analyseraster steht zudem schon.
   ========================================================================== */

var FLUSS_MAX = 900;              // harter Deckel der Zellen je Lauf
var FLUSS_ZIEL_PUNKTE = 16;       // Griffe je Flusselement, siehe Vereinfachung

/* Was ein SEE ist — und was nur eine Mulde.

   Die Senkenfuellung sagt je Zelle, um wie viel sie angehoben werden musste.
   Diese Zahl allein taugt NICHT als Seekriterium, und das ist gemessen: auf
   einer 256er Wiese liegen rund 10 % der Rasterzellen ueber 0.6 Welteinheiten
   Auffuellung, verteilt auf Dutzende winziger Mulden. Wer an jeder davon einen
   Fluss enden laesst, bekommt Laeufe von vier Zellen Laenge — die erste
   Fassung dieses Abschnitts tat genau das und erzeugte auf 256 einen einzigen
   Fluss.

   Ein See braucht deshalb beides: TIEFE und FLAECHE. Die Regel und ihre
   Schwellen stehen jetzt in generators/see.js (`seenAusFuellung`), weil dort
   auch das Polygon entsteht — zwei Stellen mit derselben Schwelle waeren zwei
   Stellen, an denen ein Bach in einem See endet, den niemand sieht, oder
   umgekehrt an einem See vorbeilaeuft, der da ist.

   WICHTIG fuer diesen Abschnitt: die Maske, die `seenAusFuellung` liefert,
   reicht bis zur WASSERLINIE und nicht nur bis zur Kerntiefe. Ein Fluss endet
   damit genau dort, wo die gezeichnete Wasserflaeche anfaengt, und nicht ein
   bis zwei Zellen darin. */

/* Wie viele Seen hoechstens Elemente werden. Nicht aus Angst vor der
   Rechenzeit (die Ableitung ist eine Randverfolgung je Gebiet), sondern aus
   demselben Grund, aus dem `wunsch` die Fluesse deckelt: eine Karte mit
   dreissig Tuempeln liest sich nicht als Landschaft, sondern als Fehler. */
var SEE_MAX = 6;

/* Die Schwelle: wie gross das Einzugsgebiet einer Zelle mindestens sein muss,
   damit dort ein Gerinne beginnt — als ANTEIL DER LANDFLAECHE, nicht als feste
   Zellenzahl.

   Das ist die Antwort auf "die Schwelle muss mit der Kartengroesse mitwachsen",
   und sie ist die einzige, die sich selbst erklaert: ein Fluss ist auf jeder
   Karte etwas, das ein Fuenfzigstel des Landes entwaessert. Damit bleibt die
   DICHTE des Gerinnenetzes ueber alle Kartengroessen gleich (die Zahl der
   Netzkoepfe liegt bei rund Landflaeche / (2 * Schwelle), also konstant), und
   die Kartengroesse entscheidet nur noch darueber, wie viele davon gezeichnet
   werden — das tut `wunsch`.

   Gegenprobe mit einem Quantil ueber die Abflusswerte (erst so gebaut,
   gemessen und verworfen): auf einer 256er Karte mit wenig Land liegt das
   97,5. Perzentil bei einem Einzugsgebiet, das erst kurz vor der Muendung
   erreicht wird — es entstand EIN Fluss von acht Zellen Laenge. Ein Quantil
   misst die Verteilung, nicht die Landschaft. */
var SCHWELLE_ANTEIL = 0.002;
var SCHWELLE_MIN = 16;            // Zellen; darunter ist es keine Rinne

/* Der gemessene Abfluss wirkt an ZWEI Stellen, und sie tun Verschiedenes:

   REGEN_ABFLUSS wichtet, wie viel Wasser eine Zelle beisteuert. 3 heisst: die
     nasseste Zelle der Karte zaehlt wie vier trockene. Das verschiebt die
     Einzugsgebiete und damit die Quellen und die Breiten — nicht aber den WEG,
     denn der haengt am gefuellten Hoehenfeld.

   SOG_* wichtet die Richtungswahl: unter zwei absteigenden Nachbarn gewinnt
     der nassere. Das ist der Teil, der den Verlauf selbst bewegt — Wasser
     folgt der Rinne, die es gegraben hat. Die Spanne 0.55 (staubtrocken) bis
     2.2 (Hauptrinne) heisst: eine Rinne darf ein rund viermal flacheres
     Gefaelle haben und trotzdem gewaehlt werden. Mehr waere gefaehrlich — die
     Tropfenbahnen sind eine Stichprobe, keine Flaechendeckung, und ein zu
     starker Sog naehte den Fluss an einen einzelnen Tropfen.

   Gemessen bei GLEICHER Auswahl (dieselben Startzellen, dasselbe Gelaende,
   einmal mit und einmal ohne Sog; gemittelt wird der logarithmierte gemessene
   Abfluss entlang der Bahn) ueber die Seeds 4711/1337/2024 auf 256:
   Faktor 1.085 / 1.066 / 1.036. Der Sog fuehrt die Laeufe also durch messbar
   nasseres Gelaende — aber nur um wenige Prozent, und das ist die ehrliche
   Auskunft dieser Runde: die Hauptwirkung der Erosion auf die Fluesse laeuft
   gar nicht ueber dieses Messfeld, sondern ueber das GELAENDE, das sie dabei
   umgraebt. Die Rinne steht danach im Hoehenfeld, und dort findet die
   Verfolgung sie ohnehin. Der Sog ist die Zugabe fuer die Faelle, in denen
   zwei Rinnen aehnlich steil sind. Die Pruefung steht in
   terra/test/13-fluesse.test.mjs; ein Vergleich ueber zwei GEWUERFELTE Karten
   taugt dafuer nicht, weil dort auch die Auswahl der gezeichneten Laeufe
   wechselt und staerker streut als der Effekt selbst. */
var REGEN_ABFLUSS = 3;
var SOG_TROCKEN = 0.55;
var SOG_NASS = 2.2;

/* Maeanderamplitude in Zellen, und wie oft der [1 2 1]-Mittelwert ueber den
   Zug laeuft. Beides erklaert sich unten an der Stelle, an der es angewendet
   wird. */
/* Wieviel ein Zusammenfluss gegenueber blosser Lauflaenge wert ist. Begruendung
   und Messung stehen unten bei der Auswahl. 2.2 heisst: ein Nebenfluss darf
   halb so lang sein wie ein eigenstaendiger Lauf und wird trotzdem gezogen. */
var ZUFLUSS_BONUS = 2.2;

var MAEANDER = 1.1;
var GLATT_PASSE = 3;

/**
 * Regen- und Sogfeld auf dem Analyseraster aus dem gemessenen Abflussfeld.
 * Liefert null, wenn keines vorliegt — dann regnet es gleichmaessig und die
 * Richtungswahl haengt allein am Gefaelle.
 *
 * Drei Dinge sind hier wichtig:
 *
 * SUMMIEREN, NICHT ABTASTEN. Das Abflussfeld liegt auf dem Terraingitter (eine
 * Zelle je Welteinheit) und ist duenn: eine Tropfenbahn ist ein bis zwei Zellen
 * breit. Wer je Analysezelle EINEN Gitterpunkt abliest, verfehlt drei von vier
 * Bahnen. Summiert wird deshalb der ganze 4x4-Block.
 *
 * LOGARITHMISCH gegen das Maximum, exakt wie die Feuchte in world/biomfeld.js:
 * die Verteilung ist extrem schief (ein Hauptlauf traegt Groessenordnungen
 * mehr als jede Hangrinne), linear normiert waere alles ausser dem Hauptlauf
 * null.
 *
 * REGEN NORMIERT AUF MITTELWERT 1. Ohne das truege `akk` bei erodiertem
 * Gelaende ein Vielfaches, die Schwelle und die Breitenformel haetten je nach
 * Vorgeschichte eine andere Eichung, und derselbe Fluss waere nach einem
 * Erosionslauf ploetzlich doppelt so breit. Nach der Normierung bleibt `akk`
 * die Einzugsflaeche in Zellen — der Abfluss verschiebt nur, WO sie liegt.
 * Der SOG wird bewusst NICHT normiert: bei ihm zaehlt das Verhaeltnis
 * benachbarter Zellen, und das ist gegen jede gemeinsame Skalierung immun.
 */
function wasserFelder(W, A) {
  var feld = W.abfluss;
  if (!feld) return null;
  var VW = KARTE.vw, nx = A.nx, n = nx * nx;
  var regen = new Float32Array(n), sog = new Float32Array(n), max = 0;
  var i, j, gi, gj, id;
  for (j = 0; j < nx; j++) {
    var g0 = j * RASTER - (RASTER >> 1);
    for (i = 0; i < nx; i++) {
      var f0 = i * RASTER - (RASTER >> 1), s = 0;
      for (gj = g0; gj < g0 + RASTER; gj++) {
        if (gj < 0 || gj >= VW) continue;
        for (gi = f0; gi < f0 + RASTER; gi++) {
          if (gi < 0 || gi >= VW) continue;
          s += feld[gj * VW + gi];
        }
      }
      regen[j * nx + i] = s;
      if (s > max) max = s;
    }
  }
  if (!(max > 0)) return null;              // erodiert, aber nichts gemessen
  var logRef = Math.log(1 + max) || 1;
  var summe = 0;
  for (id = 0; id < n; id++) {
    var t = clamp(Math.log(1 + regen[id]) / logRef, 0, 1);
    regen[id] = 1 + REGEN_ABFLUSS * t;
    sog[id] = SOG_TROCKEN + (SOG_NASS - SOG_TROCKEN) * t;
    summe += regen[id];
  }
  var f = n / summe;                        // Mittelwert auf 1 ziehen, s. o.
  for (id = 0; id < n; id++) regen[id] *= f;
  return { regen: regen, sog: sog };
}

/** Zahl der Landzellen im Inneren des Analyserasters. */
function landZellen(A) {
  var nx = A.nx, m = 0;
  for (var j = 1; j < nx - 1; j++) {
    for (var i = 1; i < nx - 1; i++) if (!A.wasser[j * nx + i]) m++;
  }
  return m;
}

/** Seen dieser Karte: Maske (bis zur Wasserlinie) und fertige Polygone.
 *  Die ganze Regel steht in generators/see.js — hier wird nur das
 *  Analyseraster durchgereicht. */
function seenErmitteln(A, N) {
  return seenAusFuellung(A.h, N.gefuellt, A.nx, {
    raster: RASTER, half: KARTE.half,
    zielPunkte: SEE_ZIEL_PUNKTE, maxSeen: SEE_MAX
  });
}

/** Verfolgt das Netz von `start` abwaerts. Liefert die Zellkette und den Grund
 *  des Endes. `belegt` (optional) haelt die Zellen schon gelegter Laeufe. */
function laufeNetz(A, N, see, start, belegt) {
  var zellen = [start], id = start;
  /* `trifft`/`trifftIdx` sagen, IN WELCHEN Lauf und an welcher Stelle dieser
     hier muendet. Sie werden hier von niemandem gelesen — die Breite kommt aus
     `akk`, nicht aus einer Zuflussbuchhaltung. Sie stehen trotzdem im
     Ergebnis, weil sie ohne jede Rechnung anfallen und die einzige Auskunft
     sind, mit der sich die Baumstruktur des gezeichneten Netzes nachtraeglich
     rekonstruieren laesst (Benennung nach Flusssystem, Beschriftung entlang
     des Hauptstrangs). */
  var ende = "deckel", trifft = -1, trifftIdx = -1;
  for (var s = 0; s < FLUSS_MAX; s++) {
    var t = N.ziel[id];
    // Kein Ziel mehr: entweder ist die Zelle Meer (dann ist es eine Muendung)
    // oder sie liegt am Gitterrand (dann laeuft das Wasser aus der Karte).
    if (t < 0) { ende = A.wasser[id] ? "muendung" : "rand"; break; }
    if (belegt && belegt.lauf[t] >= 0) {
      zellen.push(t);
      trifft = belegt.lauf[t]; trifftIdx = belegt.idx[t];
      ende = "zufluss"; break;
    }
    zellen.push(t);
    if (A.wasser[t]) { ende = "muendung"; break; }
    // Der Fluss endet AM See — er soll nicht als Band ueber die Wasserflaeche
    // gezeichnet werden. Was unterhalb weiterlaeuft, wird als eigener Lauf am
    // Seeausgang neu begonnen (siehe seeAusgang).
    if (see[t]) { ende = "see"; break; }
    id = t;
  }
  return { zellen: zellen, ende: ende, trifft: trifft, trifftIdx: trifftIdx };
}

/** Erste Zelle unterhalb eines Sees, die nicht mehr unter Wasser steht.
 *  -1, wenn der See ins Meer oder aus der Karte laeuft. */
function seeAusgang(A, N, see, id) {
  for (var s = 0; s < FLUSS_MAX; s++) {
    var t = N.ziel[id];
    if (t < 0 || A.wasser[t]) return -1;
    if (!see[t]) return t;
    id = t;
  }
  return -1;
}

/** Einzugsgebiet in Analysezellen -> in WELTEINHEITEN². Das ist die Groesse,
 *  die als `params.einzug` mit dem Element gespeichert wird: sie haengt an
 *  keiner Rechenaufloesung und bleibt deshalb auch dann richtig, wenn das
 *  Analyseraster einmal feiner wird. */
function einzugsFlaeche(akkZellen) {
  return Math.max(1, akkZellen) * RASTER * RASTER;
}

/** Breite aus der Einzugsflaeche — die hydraulische Geometrie steht in
 *  world/erosion.js, weil paths.js dieselbe Kurve fuer die Strichstaerke des
 *  Kartenzeichens braucht (Begruendung dort). */
function breiteAus(akkZellen) {
  return breiteAusFlaeche(einzugsFlaeche(akkZellen));
}

/**
 * Maeander: der Zug wird quer zu seiner Richtung ausgelenkt, ortsstabil aus
 * `fractal`, mit einer Wellenlaenge von rund 50 Welteinheiten.
 *
 * Warum ueberhaupt: ein Talweg auf einem Gitter ist der kuerzeste Weg bergab,
 * und der ist gerade. Ein Fluss ist es nicht — er hat mehr Wasser als Gefaelle
 * und legt den Ueberschuss in Schlingen an.
 *
 * Warum an die FLACHHEIT gekoppelt: genau das ist der Unterschied zwischen der
 * Schlucht und der Aue. Im Steilhang (ny unter cos 12°) ist die Auslenkung
 * null, der Lauf bleibt in der Rinne; in der Ebene (ueber cos 5°) hat er die
 * volle Amplitude von gut einer Zelle. Ohne diese Kopplung klettert der Fluss
 * im Gebirge aus seinem eigenen Tal.
 */
function maeandere(pts, ny, W) {
  var n = pts.length;
  if (n < 5) return pts;
  var out = [pts[0]];
  for (var i = 1; i < n - 1; i++) {
    var p = pts[i];
    var tx = pts[i + 1].x - pts[i - 1].x, tz = pts[i + 1].z - pts[i - 1].z;
    var l = Math.hypot(tx, tz);
    if (!(l > 1e-6)) { out.push(p); continue; }
    var flach = sstep(COS12, COS5, ny[i]);
    var a = (fractal(p.x * 0.02, p.z * 0.02, W.seed + 331) - 0.5) * 2
          * MAEANDER * RASTER * flach;
    out.push({ x: p.x - tz / l * a, z: p.z + tx / l * a });
  }
  out.push(pts[n - 1]);
  return out;
}

/**
 * Gleitender [1 2 1]-Mittelwert ueber einen OFFENEN Zug, Enden fest.
 *
 * Dieselbe Antwort wie `randGlaetten` in world/biomfeld.js auf dasselbe
 * Problem, und aus demselben Grund keine Kosmetik: der Weg des steilsten
 * Abstiegs auf einem Gitter besteht aus Schritten in acht Richtungen, also aus
 * 45°-Treppen. Douglas-Peucker macht daraus keine Kurve, sondern behaelt jede
 * Ecke, die weiter als die Toleranz aussen liegt — die Punktzahl bleibt hoch
 * UND das Bild bleibt eckig. Erst nach der Glaettung darf die Vereinfachung
 * grob werden.
 *
 * Der Kern ist derselbe wie beim Hoehenprofil der Flussstempel in
 * core/dirty.js (rebuildRivers), damit im ganzen Haus dieselbe Kurve entsteht.
 */
function glaetteZug(pts, passe) {
  var n = pts.length;
  if (n < 3) return pts;
  var a = pts;
  for (var p = 0; p < passe; p++) {
    var b = new Array(n);
    b[0] = a[0]; b[n - 1] = a[n - 1];
    for (var i = 1; i < n - 1; i++) {
      b[i] = { x: (a[i - 1].x + a[i].x * 2 + a[i + 1].x) * 0.25,
               z: (a[i - 1].z + a[i].z * 2 + a[i + 1].z) * 0.25 };
    }
    a = b;
  }
  return a;
}

function erzeugeFluesse(W) {
  var A = W.A, o = W.o, nx = A.nx, n = nx * nx, half = KARTE.half;
  var laeufe = [];
  var wunsch = clamp(Math.round((2 + 2.4 * skala()) * o.fluesse), 0, 12);
  if (!wunsch) return laeufe;

  var WF = wasserFelder(W, A);
  W.abflussGenutzt = !!WF;
  var N = abflussNetz(A.h, nx, nx, {
    aussen: A.wasser,
    regen: WF ? WF.regen : null,
    sog: WF ? WF.sog : null
  });
  /* Seen ZUERST: der Fluss soll an der Wasserflaeche enden, die danach
     gezeichnet wird, und nicht an einer Maske, die ein Stueck weiter innen
     liegt. `W.seen` traegt die Polygone bis zu `erzeugeSeen` weiter — sie
     werden erst NACH den Fluessen zu Elementen, damit die Flusselemente ihre
     Listenposition und damit ihre Seeds behalten. */
  var SE = seenErmitteln(A, N);
  var see = SE.maske;
  W.seen = SE.seen;
  W.seeMaske = SE.maske;
  var akk = N.akk, i, j, id;
  var land = landZellen(A);
  if (land < 64) return laeufe;                    // fast nur Wasser
  var schwelle = Math.max(SCHWELLE_MIN, land * SCHWELLE_ANTEIL);

  /* Koepfe des Gerinnenetzes. Eine Zelle ueber der Schwelle ist ein Kopf, wenn
     NICHTS ueber der Schwelle in sie entwaessert — dort faengt der sichtbare
     Lauf an. Ohne diese Bedingung waere jede Zelle des Netzes eine Quelle. */
  var starkerZufluss = new Uint8Array(n);
  for (id = 0; id < n; id++) {
    if (akk[id] >= schwelle && N.ziel[id] >= 0) starkerZufluss[N.ziel[id]] = 1;
  }
  var offen = [], istKopf = new Uint8Array(n);
  for (j = 1; j < nx - 1; j++) {
    for (i = 1; i < nx - 1; i++) {
      id = j * nx + i;
      if (A.wasser[id] || akk[id] < schwelle || starkerZufluss[id]) continue;
      offen.push(id); istKopf[id] = 1;
    }
  }

  /* Rohlaeufe: erst OHNE Ruecksicht aufeinander verfolgen. Nur so kennt jeder
     Lauf sein wahres Ende und sein wahres Einzugsgebiet — und danach laesst
     sich entscheiden, welcher der Hauptstrang ist und welcher der Zufluss.
     Die Warteschlange waechst dabei: wer in einem See endet, setzt an dessen
     Ausgang einen neuen Kopf. Ohne das fehlte unterhalb jedes Sees der ganze
     Unterlauf — dort ist naemlich kein Netzkopf mehr, weil oberhalb reichlich
     Wasser ankommt. */
  var roh = [];
  for (var w = 0; w < offen.length && roh.length < 4000; w++) {
    var b = laufeNetz(A, N, see, offen[w], null);
    b.kopf = offen[w];
    b.muendungsZelle = b.zellen[b.zellen.length - 1];
    b.endAkk = akk[b.muendungsZelle];
    roh.push(b);
    if (b.ende === "see") {
      var aus = seeAusgang(A, N, see, b.muendungsZelle);
      if (aus >= 0 && !istKopf[aus]) { istKopf[aus] = 1; offen.push(aus); }
    }
  }

  /* Vorauswahl: die laengsten Rohlaeufe. Nur eine Sparmassnahme fuer die
     Auswahl darunter, die je Runde ueber alle Kandidaten geht — ein Lauf, der
     schon UNGETRIMMT zu den kurzen gehoert, wird getrimmt nicht laenger. */
  roh.sort(function (p, q) {
    return (q.zellen.length - p.zellen.length) || (q.endAkk - p.endAkk) || (p.kopf - q.kopf);
  });
  if (roh.length > 200) roh.length = 200;

  /* Mindestlaenge, an der Kartengroesse bemessen: 10 % der Rasterkante, nie
     unter 10 Zellen. Auf einer 256er Karte sind das 40 Welteinheiten (genau
     die Grenze, die auch das alte Verfahren zog), auf einer 1024er 104 —
     kuerzer ist auf der jeweiligen Karte kein Fluss, sondern ein Strich. */
  var minZellen = Math.max(10, Math.round(nx * 0.10));
  var belegt = { lauf: new Int32Array(n).fill(-1), idx: new Int32Array(n) };

  /* AUSWAHL UND LEGEN IN EINEM: je Runde wird der Kandidat gelegt, dessen
     GETRIMMTER Lauf am meisten wiegt (Laenge, mit Zuschlag fuer eine Muendung
     in einen schon gelegten Lauf — siehe unten).

     Der Umweg ueber "trimmen, dann waehlen" ist der Kern und war die dritte
     Fassung dieser Stelle. Erst wurde nach Endeinzugsgebiet sortiert und ein
     Praefix genommen — mit dem Ergebnis, dass sich unter den ersten zwoelf
     Kandidaten ein Dutzend Quellaeste DESSELBEN Oberlaufs draengten, die
     einander nach drei Zellen trafen: gemessen auf 1024/4711 blieb von
     zwoelf gewaehlten Laeufen genau EINER uebrig. Getrimmt gemessen faellt
     genau diese Sorte Kandidat sofort durch, und die naechste Runde nimmt
     stattdessen den laengsten Ast, der noch irgendwo eigenes Land hat.

     Dass die Bewertung mit jeder Runde neu laeuft, kostet nichts Nennenswertes
     (Kandidaten x Runden x Lauflaenge, also einige Hunderttausend Schritte)
     und ist der Grund, warum sich die Laeufe ueber die Karte verteilen, ohne
     dass eine Mindestabstandsregel noetig waere: der Abstand entsteht aus der
     Sache, nicht aus einer Zahl.

     Ein einmal zu kurz geratener Kandidat ist ENDGUELTIG erledigt — `belegt`
     waechst nur, sein getrimmter Lauf kann also nie wieder laenger werden. */
  var tot = new Uint8Array(roh.length), bestW = 0;
  while (laeufe.length < wunsch) {
    var bestI = -1, bestL = null;
    bestW = 0;
    for (var r = 0; r < roh.length; r++) {
      if (tot[r]) continue;
      var K = laufeNetz(A, N, see, roh[r].kopf, belegt);
      if (K.zellen.length < minZellen) { tot[r] = 1; continue; }
      /* Ein Lauf, der in einem schon gelegten MUENDET, zaehlt mehr als seine
         Laenge. Gemessen ohne diesen Bonus: ueber neun Karten (3 Groessen x 3
         Seeds) entstand GENAU EIN Zusammenfluss — der laengste noch freie Zug
         ist fast immer ein eigenes Tal, nie ein Nebenfluss, weil der Nebenfluss
         am Zusammenfluss abgeschnitten wird und damit kuerzer ist. Das Netz war
         also da, man sah es nur nie. Die Muendung ist aber das, was ein
         Flusssystem als System lesbar macht; sie ist mehr wert als dieselbe
         Strichlaenge irgendwo allein im Gelaende. Mit dem Bonus sind es auf
         denselben neun Karten 0 bis 3 Muendungen je Karte. Hoeher als 2.2 zu
         gehen bringt nichts mehr (bei 3.0 gemessen: dieselben Zahlen) — was
         dann noch fehlt, sind Nebenfluesse UNTER der Mindestlaenge, und die
         waeren als Element nicht mehr brauchbar. */
      var wert = K.zellen.length * (K.ende === "zufluss" ? ZUFLUSS_BONUS : 1);
      if (wert > bestW) { bestW = wert; bestL = K; bestI = r; }
    }
    if (bestI < 0) break;
    tot[bestI] = 1;
    var L = bestL;
    L.nr = laeufe.length;
    L.akk = new Float64Array(L.zellen.length);
    var ny = new Float64Array(L.zellen.length);
    var pts = [];
    for (var k = 0; k < L.zellen.length; k++) {
      var zk = L.zellen[k], zi = zk % nx, zj = (zk - zi) / nx;
      pts.push({ x: zi * RASTER - half, z: zj * RASTER - half });
      L.akk[k] = akk[zk];
      ny[k] = A.ny[zk];
    }
    // Maeander VOR der Glaettung: die Glaettung nimmt der Auslenkung die
    // Ecken, die Auslenkung ist danach eine Schlinge statt eines Zickzacks.
    L.punkte = glaetteZug(maeandere(pts, ny, W), GLATT_PASSE);
    laeufe.push(L);
    for (var p2 = 0; p2 < L.zellen.length; p2++) {
      var zz = L.zellen[p2];
      if (belegt.lauf[zz] < 0) { belegt.lauf[zz] = L.nr; belegt.idx[zz] = p2; }
    }
  }

  for (var e = 0; e < laeufe.length; e++) abschnitteEinsetzen(W, laeufe[e]);
  return laeufe;
}

/**
 * Ein Lauf wird zu einem bis drei Flusselementen. Geteilt wird dort, wo das
 * Einzugsgebiet SPRINGT — also an den groessten Zufluessen. Der Bruch in der
 * Breite liegt damit genau an der Stelle, an der er auch in der Natur liegt,
 * und die Abschnitte teilen sich den Trennpunkt, das Wasserband laeuft also
 * ohne Luecke weiter.
 *
 * Die Breite kommt aus `akk`, nicht aus der Buchfuehrung ueber die
 * GEZEICHNETEN Zufluesse. Das ist der stille Gewinn dieser Runde: ein Fluss
 * ist auch dann richtig breit, wenn seine Nebenfluesse unter der Schwelle
 * geblieben und deshalb gar nicht auf der Karte sind.
 */
function abschnitteEinsetzen(W, L) {
  var pts = L.punkte, n = pts.length, i;
  /* EIN Name je Lauf, nicht je Abschnitt: die zwei bis drei Elemente sind
     derselbe Fluss, nur mit verschiedener Breite. Gemessen wird in der Mitte
     des Laufs — dort liegt die Landschaft, die ihn praegt, und nicht die
     Quelle am Hang. */
  var mitte = pts[n >> 1];
  var flussName = benenne(W, "fluss", mitte.x, mitte.z,
    elementSeed(W.seed, 9000 + L.nr), "fluss", L.nr);
  L.name = flussName;

  // Spruenge im Einzugsgebiet suchen: mindestens ein Viertel mehr auf einen
  // Schritt, weit genug von den Enden und voneinander.
  var kandidaten = [];
  for (i = 10; i < n - 10; i++) {
    if (L.akk[i] > L.akk[i - 1] * 1.25) kandidaten.push({ bei: i, sprung: L.akk[i] / L.akk[i - 1] });
  }
  kandidaten.sort(function (a, b) { return (b.sprung - a.sprung) || (a.bei - b.bei); });
  var trenn = [];
  for (i = 0; i < kandidaten.length && trenn.length < 2; i++) {
    var bei = kandidaten[i].bei, frei = true;
    for (var t = 0; t < trenn.length; t++) if (Math.abs(trenn[t] - bei) < 14) frei = false;
    if (frei) trenn.push(bei);
  }
  trenn.sort(function (a, b) { return a - b; });

  var grenzen = [0].concat(trenn, [n - 1]);
  for (var s = 0; s < grenzen.length - 1; s++) {
    var a = grenzen[s], b = grenzen[s + 1];
    var teil = pts.slice(a, b + 1);
    if (teil.length < 4) continue;
    var breite = breiteAus(L.akk[b]);
    /* I3/H — die GESPEICHERTE Abflusskennzahl. `L.akk[b]` ist das
       Einzugsgebiet am unteren Ende des Abschnitts, also der groesste Abfluss
       entlang dieses Stuecks (akk waechst flussabwaerts nie). Umgerechnet auf
       Welteinheiten² wandert sie als `params.einzug` in die Datei — und nur
       deshalb darf paths.js die Strichstaerke daran haengen: das Laufzeitfeld
       `abfluss` waere nach dem Laden null. */
    var einzug = Math.round(einzugsFlaeche(L.akk[b]));
    /* Vereinfachung: dieselbe Funktion, die auch die Strassen der Wegsuche
       eindampft. FLUSS_ZIEL_PUNKTE = 16 Griffe je Element — das ist die
       Groesse, die der Editor als bearbeitbar vorfuehrt (die Waelder des
       Generators haben 8 bis 12), und genau die Begruendung, mit der
       world/biomfeld.js seine ZIEL_PUNKTE gewaehlt hat. Ein Lauf ueber die
       ganze Karte hat vor der Vereinfachung bis zu 900 Punkte. */
    var punkte = vereinfache(teil, 1.7, FLUSS_ZIEL_PUNKTE);
    if (punkte.length < 2) continue;
    benenneElement(fuegeEin(W, "pfad", "fluss", punkte, {
      breite: Math.round(breite * 2) / 2,
      tiefe: Math.round(clamp(1.4 + breite * 0.22, 1, 8) * 2) / 2,
      einzug: einzug
    }), flussName);
    // Belegung: der Flusslauf selbst und ein Uferstreifen sind kein Bauland.
    for (var p = 0; p < teil.length; p += 2) stempel(W.bel, teil[p].x, teil[p].z, breite * 0.6 + 3, B_FLUSS);
  }
}


/* ==========================================================================
   2b. Seen — aus der Senke wird ein Element

   Die Ableitung selbst steht in generators/see.js; hier wird sie zu Elementen.
   Drei Entscheidungen, die dabei fallen:

   NACH DEN FLUESSEN. Nicht, weil ein See spaeter entstuende, sondern weil
   `elementSeed` an der Listenposition haengt: waeren die Seen vorher
   eingetragen, saehe jede bestehende Karte anders bestueckt aus, obwohl an den
   Fluessen nichts geaendert wurde. Die Maske selbst wird dagegen VOR den
   Fluessen gebraucht (siehe erzeugeFluesse) — Reihenfolge der RECHNUNG und
   Reihenfolge der LISTE sind zwei verschiedene Dinge.

   `stau: 0`. Der Wasserspiegel wird nicht mitgegeben. Er ergaebe sich aus der
   Fuellhoehe und waere damit eine zweite Wahrheit neben dem Gelaende — nach
   dem ersten Verschieben des Sees eine falsche. genSee liest ihn stattdessen
   bei jeder Erzeugung am Ufer ab (see.js, seeSpiegel); auf einer Kontur, die
   ohnehin auf der Wasserlinie verfolgt wurde, ist das dieselbe Zahl.

   BELEGUNG. Die Seemaske liegt auf demselben Raster wie `bel` — sie wird
   deshalb direkt hineinodert statt in Kreisen gestempelt. Damit steht kein
   Dorf, kein Acker und kein Wald im See.
   ========================================================================== */

function erzeugeSeen(W) {
  var seen = W.seen || [];
  if (!seen.length) return seen;
  var bel = W.bel, i;
  // Der See ist kein Bauland — dieselbe Rolle wie das Flussbett.
  var maske = W.seeMaske;
  if (maske && maske.length === bel.feld.length) {
    for (i = 0; i < maske.length; i++) if (maske[i]) bel.feld[i] |= B_FLUSS;
  }
  for (i = 0; i < seen.length; i++) {
    var s = seen[i];
    var el = fuegeEin(W, "flaeche", "see", s.points, {
      stau: 0,
      /* Uferbreite an der Groesse des Sees: ein Tuempel mit fuenf Einheiten
         Brandungssaum waere zur Haelfte Schaum. Der Radius eines
         flaechengleichen Kreises ist das ehrlichste Mass dafuer, das ohne
         eine zweite Rechnung zu haben ist. */
      saum: Math.round(clamp(Math.sqrt(s.zellen * RASTER * RASTER / Math.PI) * 0.10,
        1.5, 9) * 2) / 2,
      ufer: true,
      dichte: 1
    });
    /* Seen tragen Wassernamen — `see` ist in namen.js seit jeher eine
       gefuehrte Art, sie hatte bisher nur keinen Aufrufer. */
    benenneElement(el, benenne(W, "see", s.mitte.x, s.mitte.z, el.seed, "see", i));
    s.el = el;
  }
  return seen;
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
    if (L.ende === "muendung" || L.ende === "see") {
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
  var pts = umriss(ort.x, ort.z, r, ri(rs, 8, 10), 0.30, W.seed + 700 + nr, festAmSee(W));
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
    var feld = fuegeEin(W, "flaeche", "feld", umriss(fx, fz, fr, ri(rs, 6, 8), 0.24, W.seed + 760 + nr * 4 + v, festAmSee(W)), {
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
    var pts = umriss(c.x, c.z, r, ri(rv, 8, 12), 0.34, W.seed + 800 + nr * 3 + (art === "wald" ? 0 : 1), festAmSee(W));
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
  W.abfluss = abflussFeld(W.o);
  /* J3: EIN Dublettenregister fuer die ganze Karte. Es traegt die vergebenen
     Namen und zaehlt, wie oft ein Bestimmungs- bzw. Grundwort schon benutzt
     wurde — daraus wird in namen.js eine Strafe auf das Gewicht. Ohne das
     bestuende eine Karte mit sechs Fluessen leicht aus sechsmal "-bach". */
  W.vergabe = neueVergabe();

  // Reihenfolge ist Inhalt, nicht Geschmack:
  //   Erosion VOR dem Wuerfeln    — nicht hier, sondern beim Nutzer: die
  //     Fluesse lesen `abfluss`, wenn eines vorliegt (siehe Abschnitt 2). Der
  //     Generator stoesst sie nicht selbst an; sie kostet das Achtfache dieses
  //     ganzen Laufs und wuerde das Hoehenfeld veraendern, was erzeugeWelt oben
  //     ausdruecklich zusagt nicht zu tun.
  //   Fluesse VOR den Siedlungen  — die Orte suchen Muendungen und Furten.
  //   Seen NACH den Fluessen      — ihre MASKE entsteht zwar vorher (die
  //     Verfolgung braucht sie), ihre ELEMENTE kommen danach: `elementSeed`
  //     haengt an der Listenposition, und eine bestehende Karte soll nicht
  //     anders bestueckt werden, nur weil jetzt Seen darin stehen.
  //   Strassen NACH den Siedlungen — sie verbinden, was steht.
  //   Vegetation NACH den Strassen — sie weicht den Korridoren aus.
  //   Arbor ZULETZT               — die Ranken sollen die Orte nicht verdraengen.
  var laeufe = erzeugeFluesse(W);
  var seen = erzeugeSeen(W);
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
    // Runde H: wie viele Binnenseen die Senkenfuellung hergegeben hat. Ohne
    // diese Zeile ist von aussen nicht zu sehen, ob eine Karte gar keine
    // Wanne hatte oder ob die Ableitung ausgefallen ist.
    seen: seen.length,
    // I3: lag ein gemessenes Abflussfeld vor, oder hat es gleichmaessig
    // geregnet? Ohne diese Zeile ist von aussen nicht zu unterscheiden, ob der
    // Rueckfall gegriffen hat — und genau das will man wissen.
    abflussGenutzt: !!W.abflussGenutzt,
    gipfel: A.gipfel.length, senken: A.senken.length, paesse: A.paesse.length,
    landAnteil: A.landAnteil,
    // J3: wie viele Elemente einen Namen tragen und wie die Region heisst.
    region: region, namen: W.vergabe.anzahl
  };
  return liste;
}

export { erzeugeWelt, WELT_STANDARD, BIOM_STIL, analysiere, umriss };
