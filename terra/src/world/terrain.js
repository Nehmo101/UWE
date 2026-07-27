// Heightfield-Terrain: Hoehen, Farben, Kruemmungs-AO, Korridore, Fluesse, Pinsel.
import * as THREE from 'three';
import { clamp, lerp, sstep, DEG, hashi, vnoise, fractal } from '../core/rng.js';
import { MAP, VW, HALF, WATER, S, BIOME, hoehenProfil } from '../core/store.js';
import { terraMat, tintedMats } from '../render/materials.js';
// I2: Biomflaechen. biomfeld.js haengt nur an core/rng.js und core/store.js —
// es traegt eine eigene Kopie von inPoly/polyBBox, damit kein Rueckimport nach
// generators/ entsteht (dort haengt areas.js an genau dieser Datei).
import { biomFeldBauen, biomGewichtAn, biomIndexAn, mischPalette, mischStufe,
  cacheLeeren as biomCacheLeeren, BIOM_KEINS } from './biomfeld.js';

/* ==========================================================================
   Aenderungserkennung fuer die Historie (H1e)

   editor/history.js musste bisher bei JEDEM pushUndo elementweise ueber das
   ganze Hoehenfeld laufen (1.050.625 Vergleiche auf einer 1024er Karte, auch
   bei einer reinen Elementaenderung) und im Trefferfall eine Vollkopie ziehen
   (4,2 MB). Beides ersetzt dieses Paar:

   * `hoehenVersion` — ein Zaehler, der bei JEDER Schreiboperation auf `base`
     steigt. history.js vergleicht nur noch zwei Zahlen (O(1)). Der Export ist
     eine lebende Modulbindung: der Importeur liest immer den aktuellen Wert,
     ein `var` reicht dafuer (wie MAP/VW/HALF aus core/store.js).
   * die "schmutzige Region" — die Vereinigungsbox aller Schreibzugriffe seit
     dem letzten Abholen. history.js holt sie beim Schnappschuss ab (setzt sie
     dabei zurueck) und sichert nur noch diesen Ausschnitt.

   BEWUSSTE ABWEICHUNG von der Roadmap-Notiz: `recomputeHeights` zaehlt NICHT
   mit. Es schreibt ausschliesslich `hgt` (base + Flussstempel) und laesst
   `base` unangetastet — und nur `base` steckt im Schnappschuss. Wuerde es
   mitzaehlen, markierte jedes `refreshTerrainFull()` (also jedes Element-
   Commit, jedes rebuildAll) die ganze Karte als schmutzig und H1e waere
   wirkungslos: genau der Fall, den die Roadmap abstellen will.

   VERTRAG fuer fremde Module: wer `base` direkt beschreibt, MUSS danach
   `basisGeaendert(i0,i1,j0,j1)` rufen. Heute tut das niemand ohne Not — die
   drei Stellen in editor/io.js (v3-Delta, base.set, Hoehenkarten-Import)
   stehen alle hinter `pushUndo(true)`, und dieser Vollschnappschuss deckt
   eine unbegrenzte Aenderung ohnehin ab (history.js zieht den Schatten
   danach komplett nach).
   ========================================================================== */
var hoehenVersion = 0;
// leere Box: i1 < i0
var schmutzI0 = 0, schmutzI1 = -1, schmutzJ0 = 0, schmutzJ1 = -1;

/** Meldet einen Schreibzugriff auf `base` im Gitterbereich [i0..i1]x[j0..j1]. */
function basisGeaendert(i0, i1, j0, j1) {
  i0 = clamp(i0 | 0, 0, VW - 1); i1 = clamp(i1 | 0, 0, VW - 1);
  j0 = clamp(j0 | 0, 0, VW - 1); j1 = clamp(j1 | 0, 0, VW - 1);
  if (i1 < i0 || j1 < j0) return;             // nichts beruehrt -> auch kein Takt
  hoehenVersion++;
  if (schmutzI1 < schmutzI0) {                 // erste Meldung seit dem Abholen
    schmutzI0 = i0; schmutzI1 = i1; schmutzJ0 = j0; schmutzJ1 = j1;
    return;
  }
  if (i0 < schmutzI0) schmutzI0 = i0;
  if (i1 > schmutzI1) schmutzI1 = i1;
  if (j0 < schmutzJ0) schmutzJ0 = j0;
  if (j1 > schmutzJ1) schmutzJ1 = j1;
}

/** Liefert die schmutzige Region und setzt sie zurueck — oder null, wenn seit
 *  dem letzten Abholen nichts geschrieben wurde. Nur history.js ruft das. */
function holeSchmutzRegion() {
  if (schmutzI1 < schmutzI0) return null;
  var r = { i0: schmutzI0, i1: schmutzI1, j0: schmutzJ0, j1: schmutzJ1 };
  schmutzI0 = 0; schmutzI1 = -1; schmutzJ0 = 0; schmutzJ1 = -1;
  return r;
}

/* --- Hoehenfelder (H1b) -------------------------------------------------
   Die Felder haengen an VW und muessen beim Wechsel der Kartengroesse
   mitwachsen. Bewusst NUR WACHSEN, nie schrumpfen:

   editor/history.js (tabu, Runde D) haelt Copy-on-Write-Kopien per
   `base.slice()` und spielt sie mit `base.set(kopie)` zurueck. Wuerde base
   beim Verkleinern kuerzer, warfe `set` bei einer laengeren Altkopie einen
   RangeError — ein harter Absturz beim Rueckgaengigmachen ueber einen
   Groessenwechsel hinweg. Ein zu langes Feld ist dagegen voellig harmlos:
   saemtliche Zugriffe laufen ueber j*VW+i und beruehren nur die ersten
   VW*VW Eintraege, der Rest liegt brach. Der Preis ist etwas Speicher, wenn
   in einer Sitzung eine grosse Karte benutzt wurde. Die saubere Loesung
   (Undo-Stapel beim Groessenwechsel verwerfen) braucht history.js — siehe
   Bericht H1e. */
var feldLaenge = 0;
var base, hgt, aoRoh, aoFeld, corridor, wear, abfluss, sediment, haerte,
    biomFeld, biomGewicht;
function felderSichern() {
  var n = VW * VW;
  if (n <= feldLaenge) return;
  base = new Float32Array(n);           // prozedurale Höhen + Pinsel-Änderungen
  hgt = new Float32Array(n);            // base + Flusseinschnitte (Renderhöhe)
  aoRoh = new Float32Array(n); aoRoh.fill(1);
  aoFeld = new Float32Array(n); aoFeld.fill(1);
  corridor = new Uint8Array(n);
  // Abnutzung entlang der Wege: 0..255, weich auslaufend, faerbt das Gras erdig.
  wear = new Uint8Array(n);
  /* I3: Ergebnisfelder der Erosion. Sie wachsen mit base/hgt mit und stehen
     auch ohne gelaufene Erosion bereit (Abfluss und Sediment 0, Haerte neutral
     1) — wer sie liest, darf das bedingungslos tun.

     LAUFZEITFELDER, bewusst nicht im Speicherformat. Die Hoehenaenderung der
     Erosion steckt ohnehin im `hoehenDelta` (Format v3), diese drei sind
     daraus abgeleitete Messwerte. Sie nach dem Laden neu zu erzeugen hiesse,
     die Erosion noch einmal laufen zu lassen — 456 ms, und das Ergebnis wuerde
     auf dem bereits erodierten Gelaende ein anderes sein als beim ersten Mal.

     Daraus folgt eine Regel, die einzuhalten ist: KEIN Generator darf diese
     Felder lesen. Sonst saehe eine Karte nach dem Laden anders aus als vor dem
     Speichern — genau die Sorte versteckter Zustand, die `rebuildAll` in
     Runde I5 einen Tag gekostet hat. Erlaubt sind Auswertungen, deren Ergebnis
     der Nutzer sieht und die gespeichert werden: die Biom-Ableitung macht aus
     `abfluss` Polygone, und die Polygone liegen danach in der Datei. */
  abfluss = new Float32Array(n);
  sediment = new Float32Array(n);
  haerte = new Float32Array(n); haerte.fill(1);
  /* I2: abgeleitete Biomflaechen. Laufzeitfelder wie corridor und wear — und
     aus demselben Grund unbedenklich, anders als die drei Erosionsfelder
     darueber: Im Speicherformat stehen die POLYGONE, und aus ihnen entsteht
     dieses Gitter bei jedem Aufbau neu. Die Ableitung ist eine reine Funktion
     der Elementliste, das Bild nach dem Laden also dasselbe wie davor. */
  biomFeld = new Uint8Array(n); biomFeld.fill(BIOM_KEINS);
  biomGewicht = new Uint8Array(n);
  feldLaenge = n;
  // Frisches (genullte) base-Feld ist eine Aenderung wie jede andere. Praktisch
  // folgt sofort verwerfeHistorie() aus io.js, aber der Zaehler soll auch dann
  // stimmen, wenn jemand felderSichern() kuenftig ohne diesen Rahmen ruft.
  basisGeaendert(0, VW - 1, 0, VW - 1);
}
felderSichern();

/**
 * Schreibt das deterministische Seed-Terrain in das UEBERGEBENE Float32Array
 * `ziel` (mindestens VW*VW lang), ohne base/AO/Geometrie anzufassen.
 * Grundlage des Delta-Speicherformats v3 (editor/io.js): dort wird ein frisch
 * erzeugtes Seed-Terrain gegen das bearbeitete base gedifft.
 * Determinismus: haengt AUSSCHLIESSLICH an fractal/hashi aus core/rng.js
 * sowie an Kartengroesse und Hoehenprofil des Bioms — gleiche Seed + gleiche
 * Kartengroesse + gleiches Biom ergibt dieselbe Karte.
 * Die Umstellung der Bestueckungs-Zufaelle (generators/) auf ortsstabile
 * Hashes aendert dieses Ergebnis nicht — das Delta-Format bleibt davon
 * unabhaengig korrekt.
 */
/**
 * @param groesse  I1: Kartengroesse in Zellen, falls das Ziel NICHT die
 *   aktuelle Karte ist. Der Kartenbaum braucht das: um eine Kindkarte
 *   abzuleiten, muss zuerst das Gelaende der ELTERNkarte stehen, und die hat
 *   im Allgemeinen eine andere Groesse als die gerade geoeffnete. Ohne den
 *   Parameter rechnete die Ableitung auf einem Gitter der falschen Kantenlaenge
 *   — das Ergebnis waere nicht falsch aussehend, sondern schlicht versetzt.
 *   Fehlt der Parameter, gilt wie bisher die aktuelle Karte, und der Rechenweg
 *   ist Bit fuer Bit der alte.
 * @param biom  desgleichen fuer das Hoehenprofil: eine Elternkarte mit
 *   Karstprofil ergibt ein anderes Gelaende als eine mit Wiesenprofil, und
 *   S.biom steht beim Ableiten schon auf dem der KINDkarte.
 */
function genBaseIn(ziel, seed, groesse, biom) {
  var MAP_L = Number.isFinite(groesse) && groesse > 0 ? (groesse | 0) : MAP;
  var VW_L = MAP_L + 1, HALF_L = MAP_L / 2;
  // H6: die frueheren Literale 26 / 4 / -6 / -22 / 55 kommen jetzt aus der
  // BIOME-Registry. Fehlt dort das Feld `hoehe`, liefert hoehenProfil() exakt
  // diese Werte zurueck — das gilt seit H-Welle 2 noch fuer wiese, kueste,
  // sumpf und schnee; die uebrigen 21 Biome tragen ein eigenes Profil.
  var HP = hoehenProfil(typeof biom === "string" ? biom : S.biom);
  // randBreite 0 = Abrisskante ohne Uebergang. sstep teilt durch (e1-e0),
  // deshalb hier ein Winzigwert statt einer Fallunterscheidung in der
  // inneren Schleife (bei 55 rechnerisch identisch zu vorher).
  var randBreite = HP.randBreite > 0 ? HP.randBreite : 1e-6;
  for (var j = 0; j < VW_L; j++) {
    for (var i = 0; i < VW_L; i++) {
      var x = i - HALF_L, z = j - HALF_L;
      var h = fractal(x * 0.006, z * 0.006, seed) * HP.amp
            + fractal(x * 0.03, z * 0.03, seed + 77) * HP.fein + HP.sockel;
      // Vorbereitete Profilfelder: bei 0 (Standard) wird der Zweig komplett
      // uebersprungen, der Rechenweg bleibt damit Bit fuer Bit der alte.
      // Grate: invertiertes Rauschen (Ridge) schaerft Kaemme statt Kuppen.
      // H-Welle 2: `grat` ist RELATIV zu amp. Der Biomkatalog nennt Werte von
      // 0.1 (Bluetental, weich) bis 0.7 (Karst, Turmkarst) — als absolute
      // Welteinheiten waeren sie neben amp 26 unsichtbar, als Bruchteil der
      // Landschaftsmasse ergeben sie genau die beschriebenen Silhouetten.
      if (HP.grat !== 0) {
        var rg = fractal(x * 0.011, z * 0.011, seed + 211);
        h += (1 - Math.abs(rg * 2 - 1)) * HP.grat * HP.amp;
      }
      // Terrassen: Hoehe auf ein Raster ziehen. `stufeKante` bestimmt, wie
      // hart die Stufe wird — 1 ergibt senkrechte Wangen, der Standard 0.8
      // (frueher fest verdrahtet) laesst sie malerisch weich, Terrassenland
      // faehrt mit 0.35 die gemalte Weichheit des Katalogs.
      if (HP.stufe !== 0) h = lerp(h, Math.round(h / HP.stufe) * HP.stufe, HP.stufeKante);
      // Senken/Dolinen: nur die obersten Rauschwerte reissen ein Loch.
      if (HP.senken !== 0) {
        h -= sstep(0.62, 1.0, fractal(x * 0.045, z * 0.045, seed + 311)) * HP.senken;
      }
      // Rand auf randTiefe ziehen: weich unter den Wasserspiegel (Standard)
      // oder ueber wenige Kacheln senkrecht ins Bodenlose (Bruchkante, H6).
      var d = Math.min(i, j, MAP_L - i, MAP_L - j);
      h = lerp(HP.randTiefe, h, sstep(0, randBreite, d));
      ziel[j * VW_L + i] = h;
    }
  }
  // H1e: nur der Schreibpfad AUF base zaehlt. io.js laesst sich hier auch ein
  // frisches Vergleichsfeld fuellen (Seed-Terrain fuers v3-Delta) — das ist
  // kein Undo-relevanter Vorgang und darf den Zaehler nicht bewegen.
  if (ziel === base) basisGeaendert(0, VW_L - 1, 0, VW_L - 1);
}

/** Seed-Terrain direkt nach base schreiben — gleiche Rechenreihenfolge wie immer. */
function genBase(seed) { genBaseIn(base, seed); }

/* ==========================================================================
   Terrain-Patches (H1a)

   Frueher: EIN Mesh mit VW*VW Vertices und frustumCulled = false. Jetzt ein
   Raster aus Patches mit fester Kantenlaenge PATCH (64 Kacheln): 4x4 = 16
   Patches bei MAP 256, 8x8 = 64 bei 512, 16x16 = 256 bei 1024.

   Ueberlappung: Patch (pi,pj) traegt die Gittervertices
   [pi*64 .. pi*64+64] x [pj*64 .. pj*64+64], also 65x65 Vertices. Die
   Randreihe gehoert damit ZWEI benachbarten Patches gleichzeitig — der
   Vertex existiert doppelt.

   Nahtfreiheit: aktualisierePatch() berechnet Hoehe, Normale und Farbe
   AUSSCHLIESSLICH aus dem globalen Hoehenfeld `hgt` und `aoFeld` ueber die
   globalen Indizes (i,j) — die Nachbarzugriffe der Normalenberechnung
   klemmen am GLOBALEN Kartenrand (i>0?i-1:0 / i<VW-1?i+1:VW-1), nicht am
   Patchrand. Ein doppelter Randvertex durchlaeuft in beiden Patches exakt
   dieselbe Rechnung mit exakt denselben Eingaben und bekommt deshalb
   bitgleiche Werte. Es gibt keine Naht, weil es keine abweichende Rechnung
   gibt. Voraussetzung ist nur, dass refreshGrid JEDEN Patch anfasst, der
   einen betroffenen Vertex traegt — dafuer sorgt die Patchbereich-Formel
   unten (ceil(i0/PATCH)-1).

   Alle Patches teilen sich EIN Material (Material-Sharing zwischen nicht
   instanzierten Meshes ist erlaubt) und ihre Indexattribute (die lokale
   Topologie ist in jedem Patch dieselbe; hoechster lokaler Index 65*65-1 =
   4224, deshalb genuegt Uint16 statt des frueheren Uint32). Seit H1c ist das
   nicht mehr EIN Indexattribut, sondern eines je Detailstufe und Randmuster —
   geteilt bleibt es trotzdem, siehe den LOD-Abschnitt weiter unten.
   ========================================================================== */
var PATCH = 64;                 // Kacheln je Patch-Kante (teilt 256/512/1024)
var PVW = PATCH + 1;            // Vertices je Patch-Kante
var terrain = new THREE.Group();   // Huelle: alle Patch-Meshes haengen hier drin
var terraMaterial = terraMat({ vertexColors: true, cloudShadow: true, familie: 'erde' });
tintedMats.push(terraMaterial);    // genau EINMAL, auch ueber Groessenwechsel
// [{geo, mesh, gi0, gj0, stufe, kanten, wunsch}], zeilenweise pj*patchN+pi
var patches = [];
var patchN = 0;                 // Patches je Achse
var patchIndex = null;          // Startindex aller Patches (Stufe 0, keine Randanpassung)

function baueEinenPatch(gi0, gj0) {
  var geo = new THREE.BufferGeometry();
  var n = PVW * PVW;
  var pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (var lj = 0; lj < PVW; lj++) {
    for (var li = 0; li < PVW; li++) {
      var k = (lj * PVW + li) * 3;
      // Weltkoordinaten wie im Einzelmesh — die Meshes bleiben bei (0,0,0),
      // damit heightAt/Raycast/Gizmos dieselben Koordinaten sehen wie bisher.
      pos[k] = (gi0 + li) - HALF; pos[k + 1] = 0; pos[k + 2] = (gj0 + lj) - HALF;
      nor[k + 1] = 1; col[k] = col[k + 1] = col[k + 2] = 1;
    }
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setIndex(patchIndex);
  geo.computeBoundingSphere();       // vorlaeufig flach, refreshGrid zieht nach
  var mesh = new THREE.Mesh(geo, terraMaterial);
  mesh.frustumCulled = true;         // jetzt sinnvoll: Patches sind klein genug
  // H1c: der einzige Weg an die Kamera, ohne main.js anzufassen. Der Haken
  // drosselt sich selbst (siehe lodHaken) und ist bei abgeschaltetem LOD ein
  // einziger Vergleich pro Patch und Bild.
  mesh.onBeforeRender = lodHaken;
  terrain.add(mesh);
  // stufe/kanten: aktuell gezeichnete Detailstufe und das Randmuster (H1c).
  // 0/0 = jede Zelle, keine angepasste Kante = exakt das Bild vor H1c.
  return { geo: geo, mesh: mesh, gi0: gi0, gj0: gj0, stufe: 0, kanten: 0, wunsch: 0 };
}

/** Baut das Patchraster fuer die aktuelle Kartengroesse neu auf. */
function bauePatches() {
  for (var q = 0; q < patches.length; q++) {
    terrain.remove(patches[q].mesh);
    patches[q].geo.dispose();        // alle teilen patchIndex und gehen gemeinsam
  }
  patches.length = 0;
  patchN = MAP / PATCH;
  // Alle Indexpuffer gehen mit den Geometrien: geo.dispose() raeumt oben auch
  // die geteilten Attribute ab, ein weiterverwendeter Cache zeigte danach auf
  // geloeschte GPU-Puffer. Der Cache ist billig wieder aufgebaut.
  indexCache.length = 0;
  patchIndex = holeIndex(0, 0);
  lodAktiv = lodErlaubt && MAP > 256;
  for (var pj = 0; pj < patchN; pj++) {
    for (var pi = 0; pi < patchN; pi++) patches.push(baueEinenPatch(pi * PATCH, pj * PATCH));
  }
}

/* ==========================================================================
   Detailstufen (H1c)

   Drei Stufen, Schrittweite 1 / 2 / 4 Kacheln. Die VERTEXDATEN bleiben in
   jeder Stufe dieselben — Position, Normale und Farbe stehen unveraendert an
   den 65x65 Gittervertices, nur der Indexpuffer benutzt weniger davon. Das ist
   der billigste Weg (kein zweiter Upload, kein zweiter Speichersatz) und hat
   eine angenehme Nebenwirkung: weil die benutzten Vertices eine echte
   Teilmenge sind, wechseln beim Stufensprung WEDER Farbe NOCH Normale eines
   einzigen weiterverwendeten Punktes. Die Beleuchtung kann also nicht
   springen; sichtbar ist nur, dass die Flaeche zwischen zwei behaltenen
   Punkten linear statt ueber die uebersprungenen Stuetzstellen laeuft.
   65 = 64+1 und 64 ist durch 1, 2 und 4 teilbar: jede Stufe trifft die
   Patchecken und die Patchkanten exakt.

   NAHTPROBLEM. Grenzen zwei Patches unterschiedlicher Stufe aneinander, laege
   auf der feineren Seite ein Vertex mitten auf der Kante der groeberen — ein
   T-Vertex, und weil dieser Vertex eine andere Hoehe hat als die gerade
   Verbindung der groeberen Seite, klafft dort ein Riss.

   Geloest wird das mit ANGEPASSTEN RANDINDIZES, nicht mit einem Rock:
   * Die Stufen benachbarter Patches duerfen sich um hoechstens 1
     unterscheiden (Glaettungsdurchlauf in aktualisiereDetailstufen).
   * Der FEINERE Patch verzichtet entlang der betroffenen Kante auf seine
     Zwischenvertices: sein Aussenrand benutzt dort die Schrittweite des
     groeberen Nachbarn und ist damit Punkt fuer Punkt derselbe Polygonzug.
     Kein T-Vertex, kein Riss — auch nicht unter Vergroesserung, und ohne
     jede zusaetzliche Flaeche.
   Ein vertikaler Rock waere einfacher, aber schlechter: er braucht zusaetz-
   liche Vertices (also ein zweites Positionsschema in aktualisierePatch),
   verdeckt den Riss nur statt ihn zu vermeiden, und ragt an steilen Haengen
   als dunkler Streifen ins Bild. Da unser Patch ein reines Gitter mit
   konstanter Kantenlaenge ist, kostet der saubere Weg fast nichts.

   Der Indexpuffer haengt damit an (Stufe, Randmuster). Randmuster = 4 Bits
   (links/rechts/unten/oben je "Nachbar ist eine Stufe groeber"), also
   3 * 16 = 48 moegliche Puffer. Sie entstehen faul und werden von ALLEN
   Patches geteilt; in der Praxis sind je Blickrichtung eine Handvoll aktiv.
   ========================================================================== */
var LOD_SCHRITT = [1, 2, 4];
/* Umschaltabstaende in Welteinheiten, gemessen von der Kamera zur Huellkugel
   des Patches (Mittelpunkt minus Radius, also naeherungsweise zur
   Patchoberflaeche). Ein Patch ist 64 Einheiten breit, die Kamera steht 25..400
   Einheiten vom Fokus entfernt (CAM_DIST_MIN/MAX in editor/io.js).
   Geeicht am Hoehennebel aus world/atmosphere.js, nicht am Bauchgefuehl:
   fog.near liegt je nach Tageszeit bei 110..260, fog.far bei 860..1150, im
   Wetter "nebel" faellt fog.far auf ~0.45 davon. Stufe 1 beginnt damit ab
   260+34 = 294 — dort steht das Gelaende bereits im Dunst; Stufe 2 ab 554, wo
   es bei Nebelwetter praktisch vollstaendig im Dunst verschwindet. Die
   Kartenmitte, wo gearbeitet wird, bleibt in jeder Kartengroesse Stufe 0. */
var LOD_ABSTAND1 = 260, LOD_ABSTAND2 = 520;
// Hysterese: erst 34 Einheiten JENSEITS der Schwelle wird umgeschaltet, erst
// 34 Einheiten DIESSEITS zurueck. Ohne das flackerte die Stufe, sobald die
// Kamera genau auf der Grenze schwebt.
var LOD_HYSTERESE = 34;
var LOD_TAKT = 220;             // ms zwischen zwei Neuberechnungen (~4,5/s)
var lodErlaubt = true;          // Nutzerschalter
var lodAktiv = false;           // erlaubt UND lohnend (erst ab 512er Karten)
var lodZeit = -1e9;
var indexCache = [];            // [stufe*16 + kanten] -> THREE.BufferAttribute

/** Voller Indexsatz einer Stufe — fuer Schritt 1 Zahl fuer Zahl derselbe
 *  Puffer wie vor H1c (gleiche Diagonale b->c, gleiche Umlaufrichtung,
 *  gleiche Reihenfolge). Deshalb ist Stufe 0 ohne angepasste Kante keine
 *  Naeherung des alten Bildes, sondern buchstaeblich dasselbe Dreiecksnetz. */
function ebenerIndex(s) {
  var z = PATCH / s;
  var idx = new Uint16Array(z * z * 6), o = 0;
  for (var jj = 0; jj < PATCH; jj += s) {
    for (var ii = 0; ii < PATCH; ii += s) {
      var a = jj * PVW + ii, b = a + s, c = a + s * PVW, d = c + s;
      idx[o++] = a; idx[o++] = c; idx[o++] = b;
      idx[o++] = b; idx[o++] = c; idx[o++] = d;
    }
  }
  return idx;
}

/* Reissverschluss zwischen zwei Polygonzuegen desselben Randstreifens.
   `aussen`/`innen` sind flache Paarlisten [vertexIndex, laufwert, ...]; der
   Laufwert ist die Position entlang der Kante (0..PATCH). Es wird immer die
   Seite weitergeschaltet, deren naechster Punkt frueher kommt — dadurch
   entstehen weder Loecher noch Ueberlappungen, unabhaengig davon, wie sich die
   Schrittweiten der beiden Seiten verhalten. Genau m+n Dreiecke.
   Umlaufsinn: die vier Streifen laufen im Kreis (unten +i, rechts +j, oben -i,
   links -j); mit den beiden Dreiecksformen unten zeigt die Normale in allen
   vier Faellen nach oben — nachgerechnet fuer jede Kante. */
function reissverschluss(idx, o, aussen, innen) {
  var mA = aussen.length / 2 - 1, mI = innen.length / 2 - 1;
  var a = 0, b = 0;
  while (a < mA || b < mI) {
    var nehmeAussen;
    if (a >= mA) nehmeAussen = false;
    else if (b >= mI) nehmeAussen = true;
    else nehmeAussen = aussen[(a + 1) * 2 + 1] <= innen[(b + 1) * 2 + 1];
    idx[o++] = aussen[a * 2]; idx[o++] = innen[b * 2];
    if (nehmeAussen) { idx[o++] = aussen[(a + 1) * 2]; a++; }
    else { idx[o++] = innen[(b + 1) * 2]; b++; }
  }
  return o;
}

/** Aussenrand eines Streifens: Laufwerte 0..PATCH in Schritten von `schritt`,
 *  Vertexindex ueber die Abbildung f(t). */
function randPunkte(schritt, f) {
  var l = [];
  for (var t = 0; t <= PATCH; t += schritt) { l.push(f(t)); l.push(t); }
  return l;
}
/** Innenrand desselben Streifens: Laufwerte s..PATCH-s in eigener Schrittweite. */
function innenPunkte(s, f) {
  var l = [];
  for (var t = s; t <= PATCH - s; t += s) { l.push(f(t)); l.push(t); }
  return l;
}

/**
 * Indexsatz mit angepassten Raendern. `s` ist die eigene Schrittweite, die
 * vier Randschrittweiten sind entweder `s` (Nachbar gleich fein oder feiner)
 * oder `2*s` (Nachbar eine Stufe groeber).
 *
 * Aufbau: ein Kern aus regulaeren Zellen [s .. PATCH-s] plus vier Randstreifen
 * zwischen dem Aussenrand des Patches und dem Rand des Kerns. Die Streifen
 * schliessen an ihren Enden ueber die Diagonale Aussenecke->Innenecke ab und
 * teilen diese Diagonale mit dem jeweils naechsten Streifen — der Ring ist
 * damit lueckenlos gekachelt, auch wenn zwei benachbarte Kanten gleichzeitig
 * vergroebert sind.
 */
function gestreifterIndex(s, eL, eR, eU, eO) {
  var kern = PATCH / s - 2;                       // Kernzellen je Achse
  var n = kern * kern * 2
        + (PATCH / eU + PATCH / s - 2)            // unten
        + (PATCH / eR + PATCH / s - 2)            // rechts
        + (PATCH / eO + PATCH / s - 2)            // oben
        + (PATCH / eL + PATCH / s - 2);           // links
  var idx = new Uint16Array(n * 3), o = 0;
  for (var jj = s; jj <= PATCH - 2 * s; jj += s) {
    for (var ii = s; ii <= PATCH - 2 * s; ii += s) {
      var a = jj * PVW + ii, b = a + s, c = a + s * PVW, d = c + s;
      idx[o++] = a; idx[o++] = c; idx[o++] = b;
      idx[o++] = b; idx[o++] = c; idx[o++] = d;
    }
  }
  var P = PATCH, Q = PVW;
  o = reissverschluss(idx, o,                                     // unten, +i
    randPunkte(eU, function (t) { return t; }),
    innenPunkte(s, function (t) { return s * Q + t; }));
  o = reissverschluss(idx, o,                                     // rechts, +j
    randPunkte(eR, function (t) { return t * Q + P; }),
    innenPunkte(s, function (t) { return t * Q + (P - s); }));
  o = reissverschluss(idx, o,                                     // oben, -i
    randPunkte(eO, function (t) { return P * Q + (P - t); }),
    innenPunkte(s, function (t) { return (P - s) * Q + (P - t); }));
  o = reissverschluss(idx, o,                                     // links, -j
    randPunkte(eL, function (t) { return (P - t) * Q; }),
    innenPunkte(s, function (t) { return (P - t) * Q + s; }));
  return idx;
}

/** Geteiltes Indexattribut zu (Stufe, Randmuster) — wird faul gebaut.
 *  Exportiert als `terrainIndexSatz`, damit Testabzug und Debugansicht die
 *  Netztopologie einer Stufe pruefen koennen, ohne einen Patch dorthin
 *  schalten zu muessen. */
function holeIndex(stufe, kanten) {
  var key = stufe * 16 + kanten;
  var a = indexCache[key];
  if (a) return a;
  var s = LOD_SCHRITT[stufe];
  var arr = kanten === 0 ? ebenerIndex(s)
    : gestreifterIndex(s, (kanten & 1) ? 2 * s : s, (kanten & 2) ? 2 * s : s,
                          (kanten & 4) ? 2 * s : s, (kanten & 8) ? 2 * s : s);
  a = new THREE.BufferAttribute(arr, 1);
  indexCache[key] = a;
  return a;
}

function setzeStufe(p, stufe, kanten) {
  if (p.stufe === stufe && p.kanten === kanten) return;
  p.stufe = stufe; p.kanten = kanten;
  p.geo.setIndex(holeIndex(stufe, kanten));
}

/**
 * Waehlt fuer jeden Patch die Detailstufe nach Kameraabstand, klemmt die
 * Stufendifferenz benachbarter Patches auf 1 und setzt daraus Indexpuffer und
 * Randanpassung. Kostet einen Durchlauf ueber die Patchliste (16 bei 256,
 * 256 bei 1024) und laeuft nur alle LOD_TAKT Millisekunden.
 */
function aktualisiereDetailstufen(kamera) {
  if (!lodAktiv || !kamera || !patches.length) return;
  var kp = kamera.position, q, p;
  for (q = 0; q < patches.length; q++) {
    p = patches[q];
    var bs = p.geo.boundingSphere;
    var d;
    if (bs) {
      var dx = kp.x - bs.center.x, dy = kp.y - bs.center.y, dz = kp.z - bs.center.z;
      d = Math.sqrt(dx * dx + dy * dy + dz * dz) - bs.radius;
    } else {
      var cx = p.gi0 + PATCH * 0.5 - HALF, cz = p.gj0 + PATCH * 0.5 - HALF;
      d = Math.sqrt((kp.x - cx) * (kp.x - cx) + (kp.z - cz) * (kp.z - cz));
    }
    if (d < 0) d = 0;
    var st = p.stufe;
    // Hysterese in beide Richtungen; die Schleifen erlauben zugleich einen
    // Sprung ueber zwei Stufen, wenn die Kamera weit versetzt wird.
    while (st < 2 && d > (st === 0 ? LOD_ABSTAND1 : LOD_ABSTAND2) + LOD_HYSTERESE) st++;
    while (st > 0 && d < (st === 1 ? LOD_ABSTAND1 : LOD_ABSTAND2) - LOD_HYSTERESE) st--;
    p.wunsch = st;
  }
  // Stufendifferenz auf 1 klemmen — Voraussetzung dafuer, dass eine Kante nur
  // die Faelle "gleich" und "genau eine Stufe groeber" kennt. Es wird immer
  // nur verfeinert, der Durchlauf terminiert daher (hoechstens 2 Runden noetig).
  var runde = 0, geaendert = true;
  while (geaendert && runde++ < 4) {
    geaendert = false;
    for (var pj = 0; pj < patchN; pj++) {
      for (var pi = 0; pi < patchN; pi++) {
        var k = pj * patchN + pi, w = patches[k].wunsch, m = w;
        if (pi > 0 && patches[k - 1].wunsch + 1 < m) m = patches[k - 1].wunsch + 1;
        if (pi < patchN - 1 && patches[k + 1].wunsch + 1 < m) m = patches[k + 1].wunsch + 1;
        if (pj > 0 && patches[k - patchN].wunsch + 1 < m) m = patches[k - patchN].wunsch + 1;
        if (pj < patchN - 1 && patches[k + patchN].wunsch + 1 < m) m = patches[k + patchN].wunsch + 1;
        if (m < w) { patches[k].wunsch = m; geaendert = true; }
      }
    }
  }
  for (var bj = 0; bj < patchN; bj++) {
    for (var bi = 0; bi < patchN; bi++) {
      var kk = bj * patchN + bi, s = patches[kk].wunsch, bits = 0;
      if (bi > 0 && patches[kk - 1].wunsch > s) bits |= 1;               // links
      if (bi < patchN - 1 && patches[kk + 1].wunsch > s) bits |= 2;      // rechts
      if (bj > 0 && patches[kk - patchN].wunsch > s) bits |= 4;          // unten
      if (bj < patchN - 1 && patches[kk + patchN].wunsch > s) bits |= 8; // oben
      setzeStufe(patches[kk], s, bits);
    }
  }
}

/* Selbstgetakteter Aufhaenger an jedem Patch-Mesh. three.js ruft
   object.onBeforeRender in renderObject() — also einmal je gezeichnetem Patch
   und Renderdurchgang (Depth-Prepass UND Composer-Durchgang, beide mit
   derselben Kamera; der Schattenwurf laeuft an onBeforeRender vorbei). Die
   Zeitdrossel macht daraus wenige Neuberechnungen pro Sekunde statt einer je
   Patch und Bild. Ein waehrend des Durchgangs gewechselter Indexpuffer eines
   bereits gezeichneten Patches wirkt erst im naechsten Bild — beide Stufen
   sind gueltige Netze derselben Flaeche, ein Zwischenzustand ist deshalb
   unkritisch. */
function lodHaken(renderer, scene, kamera) {
  if (!lodAktiv) return;
  var t = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  if (t - lodZeit < LOD_TAKT) return;
  lodZeit = t;
  aktualisiereDetailstufen(kamera);
}

/** LOD an/aus (Vorgabe an). Aus setzt alle Patches auf Stufe 0 zurueck — das
 *  Bild ist danach wieder das von vor H1c. Unabhaengig davon bleibt LOD auf
 *  256er Karten wirkungslos: dort gibt es bei 16 Patches nichts zu sparen,
 *  und die halbe Kartendiagonale (181) liegt unter der ersten Schwelle. */
function setzeLod(an) {
  lodErlaubt = !!an;
  lodAktiv = lodErlaubt && MAP > 256;
  if (!lodAktiv) for (var q = 0; q < patches.length; q++) setzeStufe(patches[q], 0, 0);
}
function lodAn() { return lodAktiv; }

/** Kennzahlen fuer Bericht und Statistikanzeige. */
function terrainStufenStatistik() {
  var z = [0, 0, 0], dr = 0;
  for (var q = 0; q < patches.length; q++) {
    z[patches[q].stufe]++;
    var ix = patches[q].geo.getIndex();
    dr += (ix ? ix.count : 0) / 3;
  }
  return { aktiv: lodAktiv, patches: patches.length, stufen: z, dreiecke: dr,
    dreieckeVoll: patches.length * PATCH * PATCH * 2 };
}

bauePatches();

/** Terrain-Meshes in die Szene haengen (einmal beim Start). Die Gruppe bleibt
 *  ueber Groessenwechsel hinweg dieselbe — nur ihre Kinder werden getauscht. */
function initTerrain(scene) { scene.add(terrain); }

/** Kartengroesse hat sich geaendert: Hoehenfelder und Patchraster nachziehen.
 *  Der Aufrufer (editor/io.js) ruft danach genBase + rebuildAll. */
function terrainGeometrienNeu() {
  felderSichern();
  bauePatches();
}

// Farbkonstanten (G5): alle Toene und Zonenschwellen liegen jetzt in der
// BIOME-Registry (core/store.js). Der Eintrag "wiese" enthaelt exakt die
// frueheren Konstanten (C_SAND 0xdfd0ab, C_WIESE_* usw.) — der Default-Pfad
// bleibt byteidentisch. Die F2-Farbdrift-Pole (driftGelb/driftBlau, frueher
// C_DRIFT_GELB/C_DRIFT_BLAU) wandern mit: zwei Zielpole nur wenige Grad neben
// den Grundtoenen, kleine Mischgewichte, weiche Schwellen — grosse Flaechen
// "atmen", ohne scheckig zu werden.
var COS50 = Math.cos(50 * DEG), COS58 = Math.cos(58 * DEG);
var COS_BAND_A = Math.cos(52 * DEG), COS_BAND_B = Math.cos(35 * DEG);
var _tc = new THREE.Color(), _tc2 = new THREE.Color();

/* --- Krümmungs-Verdeckung (D1) ---------------------------------------
   Mulden und Grabenkanten sind konkav und werden abgedunkelt, Grate
   leicht aufgehellt. Danach einmal über die Nachbarschaft glätten.
   (aoRoh/aoFeld werden oben in felderSichern() angelegt und mit 1 gefuellt.) */

function computeAO(i0, i1, j0, j1) {
  i0 = clamp(i0 - 1, 0, VW - 1); i1 = clamp(i1 + 1, 0, VW - 1);
  j0 = clamp(j0 - 1, 0, VW - 1); j1 = clamp(j1 + 1, 0, VW - 1);
  var i, j;
  for (j = j0; j <= j1; j++) {
    var jm = (j > 0 ? j - 1 : 0) * VW, jp = (j < VW - 1 ? j + 1 : VW - 1) * VW, jr = j * VW;
    for (i = i0; i <= i1; i++) {
      var im = i > 0 ? i - 1 : 0, ip = i < VW - 1 ? i + 1 : VW - 1;
      var mittel = (hgt[jr + im] + hgt[jr + ip] + hgt[jm + i] + hgt[jp + i] +
                    hgt[jm + im] + hgt[jm + ip] + hgt[jp + im] + hgt[jp + ip]) * 0.125;
      var d = hgt[jr + i] - mittel;                       // >0 = Grat, <0 = Mulde
      aoRoh[jr + i] = clamp(0.95 + d * 2.2, 0.72, 1.04);
    }
  }
  for (j = j0 + 1; j <= j1 - 1; j++) {
    var jr2 = j * VW;
    for (i = i0 + 1; i <= i1 - 1; i++) {
      aoFeld[jr2 + i] = (aoRoh[jr2 + i] * 4 + aoRoh[jr2 + i - 1] + aoRoh[jr2 + i + 1] +
        aoRoh[jr2 - VW + i] + aoRoh[jr2 + VW + i]) * 0.125;
    }
  }
  for (j = j0; j <= j1; j++) {                            // Ränder ohne Glättung
    for (i = i0; i <= i1; i++) {
      if (i === i0 || i === i1 || j === j0 || j === j1) aoFeld[j * VW + i] = aoRoh[j * VW + i];
    }
  }
}

/**
 * Einfärbung nach Höhe, Hangneigung und Krümmung. Drei Grundtöne über
 * zwei Rauschoktaven, Übergänge zu Sand und Fels mit gestörter Grenze —
 * nirgends bleibt eine einfarbige Fläche stehen. Seit G5 biom-parametrisiert:
 * Palette und Zonenschwellen kommen aus BIOME[S.biom].terrain — strukturell
 * bleibt es EINE Funktion, wiese liest exakt die alten Werte (byteidentisch).
 */
function terrainColor(h, ny, x, z, out, ao) {
  var P = (BIOME[S.biom] || BIOME.wiese).terrain;
  /* I2: liegt an dieser Stelle eine Biomflaeche, wird gegen deren Palette
     gemischt. Der Nachschlag kostet einen Feldzugriff, die Mischung selbst ist
     vorgerechnet — 16 Stufen je Biompaar, gecacht. Feiner waere wirkungslos:
     das Gitter hat einen Vertex je Welteinheit, bis `weich` = 16 ist die
     Quantisierung der POSITION groeber als die der Palette.

     Bei Gewicht 0 — also ueberall dort, wo keine Flaeche liegt — bleibt P die
     Registry-Palette, und der gesamte Rechenweg darunter ist Bit fuer Bit der
     bisherige. Genau deshalb steht die Abfrage hier oben und nicht verteilt
     auf die zwanzig Palettenzugriffe weiter unten. */
  var bg = biomGewichtAn(biomGewicht, VW, MAP, x, z);
  if (bg > 0) P = mischPalette(S.biom, biomIndexAn(biomFeld, VW, MAP, x, z), mischStufe(bg));
  var gross = fractal(x * 0.012, z * 0.012, S.worldSeed + 404);
  var fein = fractal(x * 0.052, z * 0.052, S.worldSeed + 505);
  out.copy(P.grasKuehl).lerp(P.grasWarm,
    clamp(sstep(0.34, 0.72, gross) * 0.8 + sstep(1, 17, h) * 0.35, 0, 1));
  out.lerp(P.grasTrocken, sstep(0.54, 0.86, fein) * 0.7);
  out.lerp(P.erde, sstep(0.68, 0.9, fractal(x * 0.055, z * 0.055, S.worldSeed + 717)) * 0.34);

  // Oasen-Logik (nur wueste, oase > 0 — im wiese-Pfad springt der Zweig nie
  // an): unter Hoehe ~2 zieht es die Senken Richtung gedaempftem Gruen;
  // das grobe Rauschen macht die Flecken spaerlich statt zum Ring.
  if (P.oase > 0) out.lerp(P.oaseFarbe, sstep(2.4, 0.8, h) * sstep(0.35, 0.75, gross) * P.oase);

  // F2: grobe Farbdrift ueber die Landschaftsmassen. f = 0.025 ergibt eine
  // Wellenlaenge von ~40 Welteinheiten (Zielkorridor 30–50); Seed fest an
  // worldSeed + 1102 gebunden — deterministisch wie alle anderen Oktaven,
  // kein Math.random. Hue-Wirkung: wenige Grad Richtung Gelb bzw. Blaugruen.
  var drift = fractal(x * 0.025, z * 0.025, S.worldSeed + 1102);
  out.lerp(P.driftGelb, sstep(0.55, 0.85, drift) * 0.16);
  out.lerp(P.driftBlau, sstep(0.45, 0.15, drift) * 0.16);

  // Zonengrenzen: staerker gestoert (Zungen und Inseln) und mit dunklem Saum
  var stoer = (fractal(x * 0.09, z * 0.09, S.worldSeed + 606) - 0.5) * 2.6
            + (fractal(x * 0.22, z * 0.22, S.worldSeed + 607) - 0.5) * 0.9;
  var hg = h + stoer;
  out.lerp(P.sand, sstep(P.sandA, P.sandB, hg));
  out.lerp(P.fels, sstep(P.felsA, P.felsB, hg));
  out.lerp(P.schnee, sstep(P.schneeA, P.schneeB, hg));
  var saum = Math.max(
    1 - sstep(0.0, 0.55, Math.abs(hg - P.saumSand)),
    Math.max(1 - sstep(0.0, 0.7, Math.abs(hg - P.saumFels)),
             1 - sstep(0.0, 0.7, Math.abs(hg - P.saumSchnee))));
  out.multiplyScalar(1 - saum * 0.12);

  var rock = 1 - sstep(COS58, COS50, ny);                 // Steilhänge immer Fels
  if (rock > 0) out.lerp(P.fels, rock * 0.9);             // bricht auch durch Schnee
  // gerichtete Gesteinsbaender auf Haengen: folgen der Hoehenlinie
  var steil = 1 - sstep(COS_BAND_A, COS_BAND_B, ny);
  if (steil > 0) {
    var band = fractal(h * 0.55 + x * 0.01, z * 0.01, S.worldSeed + 808);
    out.multiplyScalar(1 + steil * (band - 0.5) * 0.34);
  }
  // Abnutzung entlang der Wege: getretenes Gras wird erdig, Rand ausgefranst
  var wtr = wearAt(x, z);
  if (wtr > 0.01) {
    var frans = fractal(x * 0.35, z * 0.35, S.worldSeed + 505) * 0.5;
    out.lerp(P.tritt, clamp(wtr * 1.05 - frans, 0, 0.7));
  }

  if (h < 0.35) {                                          // Meeresgrund
    _tc2.copy(P.seegrund).lerp(P.tiefe, sstep(-0.25, -4.5, h));
    out.lerp(_tc2, sstep(0.35, -0.4, h));
  }
  // Brandungssaum (H-Welle 2 parametrisiert). Frueher fest 0.8 / 0.3 / 0.5 —
  // genau diese Zahlen sind jetzt die Standardwerte, wenn das Biom die Felder
  // nicht traegt (wiese, wueste, ...): der Rechenweg bleibt dort Bit fuer Bit
  // der alte. Klippenmeer braucht 1.4 / -0.3 / 0.8 (Gischt bis unter die
  // Wasserlinie), Kueste den breiten weichen Bogen 1.1 / 0.15 / 0.65.
  var brA = P.brandungA === undefined ? 0.8 : P.brandungA;
  var brB = P.brandungB === undefined ? 0.3 : P.brandungB;
  var brS = P.brandungStaerke === undefined ? 0.5 : P.brandungStaerke;
  var surf = sstep(brA, brB, h) * sstep(-0.6, 0.06, h);
  if (surf > 0) out.lerp(P.brandung, surf * brS);

  // F2: dieselbe grobe Drift moduliert auch den Value um +-5 % — die
  // Helligkeitswelle folgt damit exakt der Farbwelle (ein Waschgang, wie beim
  // Nass-in-nass-Lauf), statt ein zweites unabhaengiges Muster zu stapeln.
  var v = 0.94 + fractal(x * 0.16, z * 0.16, S.worldSeed + 909) * 0.08
        + vnoise(x * 0.55, z * 0.55, S.worldSeed + 313) * 0.05
        + (drift - 0.5) * 0.10;
  out.multiplyScalar(v * (ao === undefined ? 1 : ao));
}

/**
 * Schreibt Höhe, Normale und Farbe eines Patches im Schnitt des globalen
 * Bereichs [i0..i1]x[j0..j1] mit dem Patchgebiet. Die Rechnung je Vertex ist
 * unveraendert aus dem frueheren Einzelmesh uebernommen — nur der Zielindex
 * ist lokal (lj*PVW+li), waehrend saemtliche Eingaben (hgt, aoFeld, die
 * Nachbarklemmung am Kartenrand, die Weltkoordinate i-HALF) global bleiben.
 * Genau das macht die doppelten Randvertices bitgleich und die Naht unsichtbar.
 */
function aktualisierePatch(p, i0, i1, j0, j1) {
  var gi0 = p.gi0, gj0 = p.gj0;
  var liA = Math.max(i0, gi0) - gi0, liB = Math.min(i1, gi0 + PATCH) - gi0;
  var ljA = Math.max(j0, gj0) - gj0, ljB = Math.min(j1, gj0 + PATCH) - gj0;
  if (liB < liA || ljB < ljA) return;
  var pos = p.geo.attributes.position, nor = p.geo.attributes.normal,
      col = p.geo.attributes.color;
  var P = pos.array, N = nor.array, C = col.array;
  for (var lj = ljA; lj <= ljB; lj++) {
    var j = gj0 + lj;
    var jm = (j > 0 ? j - 1 : 0) * VW, jp = (j < VW - 1 ? j + 1 : VW - 1) * VW, jr = j * VW;
    var lr = lj * PVW;
    for (var li = liA; li <= liB; li++) {
      var i = gi0 + li;
      var id = jr + i, k = (lr + li) * 3;
      var h = hgt[id];
      P[k + 1] = h;
      var hl = hgt[jr + (i > 0 ? i - 1 : 0)], hrr = hgt[jr + (i < VW - 1 ? i + 1 : VW - 1)];
      var hd = hgt[jm + i], hu = hgt[jp + i];
      var nx = (hl - hrr) * 0.5, ny = 1, nz = (hd - hu) * 0.5;
      var inv = 1 / Math.sqrt(nx * nx + 1 + nz * nz);
      nx *= inv; ny *= inv; nz *= inv;
      N[k] = nx; N[k + 1] = ny; N[k + 2] = nz;
      terrainColor(h, ny, i - HALF, j - HALF, _tc, aoFeld[id]);
      C[k] = _tc.r; C[k + 1] = _tc.g; C[k + 2] = _tc.b;
    }
  }
  // Upload-Range umfasst ganze Patchzeilen, damit sie zusammenhängend bleibt.
  var off = ljA * PVW * 3, cnt = (ljB - ljA + 1) * PVW * 3;
  pos.clearUpdateRanges(); pos.addUpdateRange(off, cnt); pos.needsUpdate = true;
  nor.clearUpdateRanges(); nor.addUpdateRange(off, cnt); nor.needsUpdate = true;
  col.clearUpdateRanges(); col.addUpdateRange(off, cnt); col.needsUpdate = true;
  // Hoehen haben sich geaendert -> Huellkugel neu. Frueher geschah das nur
  // beim Vollrefresh (frustumCulled war aus); jetzt haengt das Culling daran,
  // also nach JEDER Aenderung. Kosten: ein Durchlauf ueber 65*65 Vertices je
  // beruehrtem Patch — beim Pinseln typischerweise ein bis vier Patches.
  p.geo.computeBoundingSphere();
}

/**
 * Aktualisiert Höhe, Normale und Farbe nur im angegebenen Gitterbereich —
 * und dort nur in den Patches, die ihn ueberhaupt beruehren.
 */
function refreshGrid(i0, i1, j0, j1) {
  i0 = clamp(i0 | 0, 0, VW - 1); i1 = clamp(i1 | 0, 0, VW - 1);
  j0 = clamp(j0 | 0, 0, VW - 1); j1 = clamp(j1 | 0, 0, VW - 1);
  if (i1 < i0 || j1 < j0) return;
  // Patch p traegt die Vertices [p*PATCH .. p*PATCH+PATCH]. Er ist beteiligt,
  // wenn dieses Intervall den Bereich schneidet: p >= ceil(i0/PATCH)-1 und
  // p <= floor(i1/PATCH). Das "-1" ist der Grund, warum eine Aenderung genau
  // auf einer Patchgrenze BEIDE angrenzenden Patches auffrischt — ohne das
  // bliebe die doppelte Randreihe des linken Nachbarn stehen (sichtbare Naht).
  var pi0 = clamp(Math.ceil(i0 / PATCH) - 1, 0, patchN - 1);
  var pi1 = clamp(Math.floor(i1 / PATCH), 0, patchN - 1);
  var pj0 = clamp(Math.ceil(j0 / PATCH) - 1, 0, patchN - 1);
  var pj1 = clamp(Math.floor(j1 / PATCH), 0, patchN - 1);
  for (var pj = pj0; pj <= pj1; pj++) {
    for (var pi = pi0; pi <= pi1; pi++) aktualisierePatch(patches[pj * patchN + pi], i0, i1, j0, j1);
  }
}

/** Bilineare Höhe an Weltkoordinaten. */
function heightAt(x, z) {
  var fi = clamp(x + HALF, 0, MAP), fj = clamp(z + HALF, 0, MAP);
  var i = Math.min(MAP - 1, fi | 0), j = Math.min(MAP - 1, fj | 0);
  var tx = fi - i, tz = fj - j;
  var a = hgt[j * VW + i], b = hgt[j * VW + i + 1];
  var c = hgt[(j + 1) * VW + i], d = hgt[(j + 1) * VW + i + 1];
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}

/** y-Komponente der Normalen (= cos der Hangneigung). */
function slopeAt(x, z) {
  var i = clamp(Math.round(x + HALF), 1, VW - 2), j = clamp(Math.round(z + HALF), 1, VW - 2);
  var nx = (hgt[j * VW + i - 1] - hgt[j * VW + i + 1]) * 0.5;
  var nz = (hgt[(j - 1) * VW + i] - hgt[(j + 1) * VW + i]) * 0.5;
  return 1 / Math.sqrt(nx * nx + 1 + nz * nz);
}

/** Interpolierte Terrainnormale — richtet die Kontaktschatten am Hang aus. */
function normalAt(x, z, out) {
  var i = clamp(Math.round(x + HALF), 1, VW - 2), j = clamp(Math.round(z + HALF), 1, VW - 2);
  var nx = (hgt[j * VW + i - 1] - hgt[j * VW + i + 1]) * 0.5;
  var nz = (hgt[(j - 1) * VW + i] - hgt[(j + 1) * VW + i]) * 0.5;
  var inv = 1 / Math.sqrt(nx * nx + 1 + nz * nz);
  out.set(nx * inv, inv, nz * inv);
  return out;
}

function baseHeightAt(x, z) {
  var fi = clamp(x + HALF, 0, MAP), fj = clamp(z + HALF, 0, MAP);
  var i = Math.min(MAP - 1, fi | 0), j = Math.min(MAP - 1, fj | 0);
  var tx = fi - i, tz = fj - j;
  var a = base[j * VW + i], b = base[j * VW + i + 1];
  var c = base[(j + 1) * VW + i], d = base[(j + 1) * VW + i + 1];
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}

// corridor und wear werden oben in felderSichern() angelegt.
function stampWear(x, z, r) {
  var a0 = Math.max(0, Math.floor(x + HALF - r)), a1 = Math.min(VW - 1, Math.ceil(x + HALF + r));
  var b0 = Math.max(0, Math.floor(z + HALF - r)), b1 = Math.min(VW - 1, Math.ceil(z + HALF + r));
  for (var j = b0; j <= b1; j++) {
    for (var i = a0; i <= a1; i++) {
      var dx = (i - HALF) - x, dz = (j - HALF) - z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d > r) continue;
      var w = Math.round(sstep(r, r * 0.3, d) * 255);
      var id = j * VW + i;
      if (w > wear[id]) wear[id] = w;
    }
  }
}
function clearWear() { wear.fill(0); }
function wearAt(x, z) {
  var i = clamp(Math.round(x + HALF), 0, VW - 1), j = clamp(Math.round(z + HALF), 0, VW - 1);
  return wear[j * VW + i] / 255;
}
/**
 * I2: leitet die Biomflaechen-Elemente ins Gitter ab.
 *
 * Gegenstueck zu rebuildCorridors, an derselben Stelle der Kette und aus
 * demselben Grund immer global: ein geloeschter Stempel laesst sich nicht
 * oertlich zuruecknehmen — man weiss nicht, was vorher darunter lag. Der
 * optionale `box`-Weg (aus biomBox eines Elements) ist da, wird aber nicht
 * gebraucht: 23 ms fuer eine kartengroesse Flaeche auf 1024² liegen unter dem,
 * was rebuildCorridors ohnehin kostet.
 *
 * biomCacheLeeren am Ende: der Mischcache haelt 16 Stufen je Biompaar und
 * waere nach einem Biomwechsel der Karte falsch.
 */
function rebuildBiomFeld(flaechen, box) {
  /* subarray, und das ist kein Schoenheitsfehler: felderSichern laesst die
     Felder nur WACHSEN (`if (n <= feldLaenge) return`). Nach einer 1024er
     Karte ist biomFeld 1.050.625 Eintraege lang, auch wenn danach eine 256er
     geladen wird. biomFeldBauen prueft aber `opt.feld.length === VW*VW` und
     legt bei Abweichung still ein EIGENES Feld an — die Ableitung liefe dann
     ins Leere, und keine Biomflaeche haette mehr eine Wirkung. Ohne Fehler-
     meldung, nur ohne Bild.

     Die subarray-Sicht teilt den Puffer, Schreibzugriffe landen also im
     Original. Sie kostet eine Allokation je Aufbau (ein paar Bytes
     Kopfstruktur, keine Daten) — der Preis dafuer, dass biomfeld.js seine
     Laenge streng prueft, statt wie base und hgt einfach ueber j*VW+i zu
     indizieren. Die Strenge ist dort richtig; hier ist die Sicht die
     Uebersetzung zwischen beiden Konventionen. */
  var n = VW * VW;
  biomFeldBauen(flaechen, VW, MAP, {
    seed: S.worldSeed,
    feld: biomFeld.length === n ? biomFeld : biomFeld.subarray(0, n),
    gewicht: biomGewicht.length === n ? biomGewicht : biomGewicht.subarray(0, n),
    box: box
  });
  biomCacheLeeren();
}

function stampCorridor(x, z, r) {
  var a0 = Math.max(0, Math.floor(x + HALF - r)), a1 = Math.min(VW - 1, Math.ceil(x + HALF + r));
  var b0 = Math.max(0, Math.floor(z + HALF - r)), b1 = Math.min(VW - 1, Math.ceil(z + HALF + r));
  var rr2 = r * r;
  for (var j = b0; j <= b1; j++) {
    for (var i = a0; i <= a1; i++) {
      var dx = (i - HALF) - x, dz = (j - HALF) - z;
      if (dx * dx + dz * dz <= rr2) corridor[j * VW + i] = 1;
    }
  }
}

function inCorridor(x, z) {
  var i = Math.round(x + HALF), j = Math.round(z + HALF);
  if (i < 0 || j < 0 || i >= VW || j >= VW) return false;
  return corridor[j * VW + i] === 1;
}

var rivers = [];   // {samples:[{x,z,y}], radius, depth}

/** hgt = base, danach alle Flussstempel — idempotent und bereichsweise anwendbar. */
function recomputeHeights(i0, i1, j0, j1) {
  i0 = clamp(i0 | 0, 0, VW - 1); i1 = clamp(i1 | 0, 0, VW - 1);
  j0 = clamp(j0 | 0, 0, VW - 1); j1 = clamp(j1 | 0, 0, VW - 1);
  for (var j = j0; j <= j1; j++) {
    var row = j * VW;
    for (var i = i0; i <= i1; i++) hgt[row + i] = base[row + i];
  }
  for (var r = 0; r < rivers.length; r++) {
    var riv = rivers[r], R = riv.radius;
    for (var s = 0; s < riv.samples.length; s++) {
      var p = riv.samples[s];
      var a0 = Math.max(i0, Math.floor(p.x + HALF - R)), a1 = Math.min(i1, Math.ceil(p.x + HALF + R));
      var b0 = Math.max(j0, Math.floor(p.z + HALF - R)), b1 = Math.min(j1, Math.ceil(p.z + HALF + R));
      var bed = p.y - riv.depth;
      for (var jj = b0; jj <= b1; jj++) {
        for (var ii = a0; ii <= a1; ii++) {
          var dx = (ii - HALF) - p.x, dz = (jj - HALF) - p.z;
          var d = Math.sqrt(dx * dx + dz * dz);
          if (d > R) continue;
          var w = sstep(R, R * 0.3, d);
          var id = jj * VW + ii;
          var target = lerp(base[id], bed, w);
          if (target < hgt[id]) hgt[id] = target;
        }
      }
    }
  }
}

/** Terrain aus Basis + Flüssen neu berechnen und hochladen. */
function refreshTerrainFull() {
  recomputeHeights(0, VW - 1, 0, VW - 1);
  computeAO(0, VW - 1, 0, VW - 1);
  refreshGrid(0, VW - 1, 0, VW - 1);
}

var flattenTarget = 0;
function applyBrush(p, mode, radius, strength, dt) {
  var r = radius, i0 = Math.floor(p.x + HALF - r), i1 = Math.ceil(p.x + HALF + r);
  var j0 = Math.floor(p.z + HALF - r), j1 = Math.ceil(p.z + HALF + r);
  i0 = clamp(i0, 0, VW - 1); i1 = clamp(i1, 0, VW - 1);
  j0 = clamp(j0, 0, VW - 1); j1 = clamp(j1, 0, VW - 1);
  var amt = strength * dt * 60 * 0.35;
  for (var j = j0; j <= j1; j++) {
    for (var i = i0; i <= i1; i++) {
      var dx = (i - HALF) - p.x, dz = (j - HALF) - p.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d > r) continue;
      var w = sstep(r, r * 0.25, d);
      var id = j * VW + i;
      if (mode === "heben") base[id] += amt * w;
      else if (mode === "senken") base[id] -= amt * w;
      else if (mode === "ebnen") base[id] = lerp(base[id], flattenTarget, clamp(w * amt * 0.5, 0, 1));
      else if (mode === "glaetten") {
        var il = Math.max(0, i - 1), ir2 = Math.min(VW - 1, i + 1);
        var jd = Math.max(0, j - 1), ju = Math.min(VW - 1, j + 1);
        var avg = (base[j * VW + il] + base[j * VW + ir2] + base[jd * VW + i] + base[ju * VW + i]) * 0.25;
        base[id] = lerp(base[id], avg, clamp(w * amt * 0.6, 0, 1));
      }
    }
  }
  // H1e: geschrieben wurde ausschliesslich in [i0..i1]x[j0..j1] (die Kreis-
  // pruefung klippt nur weiter herein). Der Sicherheitsrand `m` unten gilt der
  // abgeleiteten Rechnung (hgt/AO/Normalen) und gehoert NICHT in die Box —
  // `base` steht dort unveraendert.
  basisGeaendert(i0, i1, j0, j1);
  var m = Math.ceil(r) + 2;
  recomputeHeights(i0 - m, i1 + m, j0 - m, j1 + m);
  computeAO(i0 - m - 1, i1 + m + 1, j0 - m - 1, j1 + m + 1);
  refreshGrid(i0 - m, i1 + m, j0 - m, j1 + m);
}

/**
 * Uebernimmt ein Erosionsergebnis — global oder Fenster, die Struktur ist
 * dieselbe — nach base und in die drei Messfelder, und zieht Hoehen, AO und
 * Gitter im beruehrten Bereich nach.
 *
 * Der Saum von zwei bzw. drei Zellen ist derselbe wie in applyBrush: eine
 * Hoehenaenderung an der Kante beeinflusst die Normale ihrer Nachbarn, und AO
 * schaut noch eine Zelle weiter. Ohne den Saum bliebe an der Fenstergrenze des
 * Pinsels eine sichtbare Beleuchtungsnaht stehen.
 *
 * Der Aufrufer hat vorher pushUndo(true) gerufen: die Erosion ist EIN
 * Historienschritt, nicht einer je Bild. basisGeaendert meldet die Box an die
 * Regionslogik aus H1e, damit der Schnappschuss klein bleibt.
 */
function wendeErosionAn(e) {
  var i0 = e.i0, j0 = e.j0, w = e.w, hh = e.h;
  for (var jl = 0; jl < hh; jl++) {
    var q = jl * w, z = (j0 + jl) * VW + i0;
    for (var il = 0; il < w; il++) {
      base[z + il] = e.hoehe[q + il];
      abfluss[z + il] = e.abfluss[q + il];
      sediment[z + il] = e.sediment[q + il];
      haerte[z + il] = e.haerte[q + il];
    }
  }
  var i1 = i0 + w - 1, j1 = j0 + hh - 1;
  basisGeaendert(i0, i1, j0, j1);
  recomputeHeights(i0 - 2, i1 + 2, j0 - 2, j1 + 2);
  computeAO(i0 - 3, i1 + 3, j0 - 3, j1 + 3);
  refreshGrid(i0 - 2, i1 + 2, j0 - 2, j1 + 2);
}

function setFlattenTarget(v) { flattenTarget = v; }

/* `terrain` ist jetzt eine THREE.Group mit den Patch-Meshes statt eines
   einzelnen Mesh; initTerrain(scene) bleibt unveraendert der einzige Weg,
   sie in die Szene zu haengen. Der frueher exportierte `terrainGeo` entfaellt
   ersatzlos — es gibt keine EINE Terraingeometrie mehr, und kein Modul hat
   ihn je importiert (geprueft ueber das ganze Projekt). Wer die Meshes
   braucht (Statistik, Debug), liest terrain.children oder terrainPatches.

   Neu ab H1e: `hoehenVersion` (LEBENDE Bindung — der Importeur sieht jede
   Erhoehung sofort, wie MAP/VW/HALF aus core/store.js), `basisGeaendert` fuer
   fremde Schreiber von `base` und `holeSchmutzRegion` fuer editor/history.js.

   Neu ab H1c: `aktualisiereDetailstufen(kamera)` laeuft von selbst ueber den
   onBeforeRender-Haken der Patch-Meshes; der Export ist fuer den Fall gedacht,
   dass main.js sie kuenftig lieber einmal je Bild im Animationslauf anstoesst
   (deterministischer als der Renderhaken). `setzeLod`/`lodAn` sind der
   Nutzerschalter, `terrainStufenStatistik` liefert Kennzahlen fuer die
   Statistikanzeige, `terrainIndexSatz` den geteilten Indexpuffer einer
   (Stufe, Randmuster)-Kombination fuer Testabzug und Debugansicht. */
export { base, hgt, genBase, genBaseIn, stampWear, clearWear, wearAt, terrain, patches as terrainPatches,
  initTerrain, terrainGeometrienNeu, terrainColor, computeAO,
  refreshGrid, heightAt, slopeAt, normalAt, baseHeightAt, corridor, stampCorridor,
  inCorridor, rivers, recomputeHeights, refreshTerrainFull, applyBrush, setFlattenTarget,
  abfluss, sediment, haerte, wendeErosionAn,
  biomFeld, biomGewicht, rebuildBiomFeld,
  hoehenVersion, basisGeaendert, holeSchmutzRegion,
  aktualisiereDetailstufen, setzeLod, lodAn, terrainStufenStatistik,
  holeIndex as terrainIndexSatz };
