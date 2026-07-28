/* ==========================================================================
   Treiber fuer die Erosion (I3)

   world/erosion.js rechnet, weiss aber nichts von der Karte, der Historie oder
   der Bildschleife. Diese Datei ist das Bindeglied: sie startet einen Lauf,
   gibt ihm je Bild ein Zeitbudget, uebernimmt das Ergebnis und zieht die
   Fluesse nach.

   Warum ein eigenes Modul und nicht ein Abschnitt in tools.js: Ein Erosions-
   lauf ist der einzige Vorgang in Terra, der ueber MEHRERE Bilder laeuft und
   dabei einen eigenen Zustand mit sich fuehrt. Der gehoert an genau eine
   Stelle, an der man ihn sieht, statt verstreut in einer Datei mit 660 Zeilen
   Werkzeuglogik.

   Zyklusfrei: haengt an world/, core/ und editor/history.js — und bewusst
   NICHT an ui/panels.js. Panels importiert diese Datei (fuer den Knopf); der
   umgekehrte Weg waere ein Zyklus. Der Fortschritt geht deshalb ueber eine
   angemeldete Rueckmeldung heraus, nicht ueber einen Aufruf ins Panel hinein.
   ========================================================================== */
import { S, VW } from '../core/store.js';
import { base, wendeErosionAn, refreshTerrainFull } from '../world/terrain.js';
import { erosionStarten, erosionRegionStarten, erosionSchritt, erosionErgebnis,
  erosionAbbrechen, EROSION_STANDARD } from '../world/erosion.js';
import { pushUndo } from './history.js';
import { rebuildRivers } from '../core/dirty.js';

/* Zeitbudget je Bild. 8 ms lassen bei 60 Hz genug Luft fuer den Rest des
   Bildes; ein 1024er Lauf braucht damit rund 53 Bilder, also knapp eine
   Sekunde (gemessen). Das ERGEBNIS haengt nicht am Budget — erosion.js zaehlt
   Einheiten, nicht Millisekunden, und ein Lauf am Stueck und einer in 53
   Haeppchen liefern bitgleiche Felder. Das ist die Zusage, auf der dieser
   ganze Aufbau steht. */
var BUDGET_MS = 8;

var lauf = null;
var anzeige = null;

/** Meldet die Rueckmeldung an, ueber die der Fortschritt nach aussen geht.
 *  Signatur: fn(anteil 0..1, fertig, abgebrochen). */
function setzeErosionAnzeige(fn) { anzeige = fn; }

function melde(anteil, fertig, abgebrochen) {
  if (anzeige) anzeige(anteil, !!fertig, !!abgebrochen);
}

function optionen(regler) {
  /* Der Seed haengt am Weltseed, nicht an einem eigenen Zaehler: dieselbe Welt
     erodiert zweimal gleich, und ein Seed-Wechsel wirft auch die Erosion neu.
     Der Versatz 6151 ist wie ueberall im Bestand eine Primzahl, damit sich die
     Stroeme nicht mit denen der Generatoren ueberlagern. */
  var o = Object.assign({}, EROSION_STANDARD, regler || {});
  o.seed = S.worldSeed + 6151;
  return o;
}

/**
 * Startet den globalen Lauf ueber die ganze Karte.
 *
 * pushUndo(true) erzwingt den Vollschnappschuss: die Hoehen wechseln auf der
 * ganzen Flaeche, da waere die Regionslogik aus H1e nur Mehrarbeit. Der
 * Schnappschuss faellt VOR dem ersten Schritt, damit ein Abbruch mitten im
 * Lauf nichts hinterlaesst — abgebrochen wird nie etwas uebernommen.
 */
function starteErosion(regler) {
  if (lauf) erosionAbbrechen(lauf);
  pushUndo(true);
  lauf = erosionStarten(base, VW, optionen(regler));
  melde(0, false, false);
  return true;
}

/** Derselbe Lauf, aber nur in einem Fenster — der Pinsel. Die Randbehandlung
 *  (Einzug fuer zulaufende Tropfen, Saum zum Ausblenden) steckt in erosion.js;
 *  hier ist zwischen global und oertlich kein Unterschied mehr. */
function starteErosionPinsel(i0, i1, j0, j1, regler) {
  if (lauf) erosionAbbrechen(lauf);
  pushUndo(true);
  lauf = erosionRegionStarten(base, VW, i0, i1, j0, j1, optionen(regler));
  melde(0, false, false);
  return true;
}

function brichErosionAb() {
  if (!lauf) return false;
  erosionAbbrechen(lauf);
  lauf = null;
  melde(0, false, true);
  return true;
}

function erosionLaeuft() { return !!lauf; }

/**
 * Ein Bild Erosion. Gehoert in animate(), vor dem Zeichnen.
 *
 * Nach dem letzten Schritt wird das Ergebnis uebernommen und `rebuildRivers`
 * gerufen: die Flussstempel entstehen aus `baseHeightAt` entlang der Punkte,
 * und das Gelaende unter ihnen ist gerade ein anderes geworden. Ohne den Aufruf
 * laege ein Fluss weiter auf dem alten Profil — sichtbar als Band, das quer
 * durch die frisch erodierte Rinne schneidet statt in ihr zu liegen.
 *
 * Und weil rebuildRivers nur die STEMPELLISTE erneuert, muss das Hoehenfeld
 * danach ein zweites Mal durch — wendeErosionAn hat es mit den alten Stempeln
 * gerechnet. Das ist der eine Fall, in dem der doppelte Vollaufbau richtig
 * ist: er faellt einmal am Ende eines Sekundenlaufs an, nicht je Bild.
 */
function tickErosion() {
  if (!lauf) return false;
  var r = erosionSchritt(lauf, BUDGET_MS);
  if (!r.fertig) { melde(r.anteil, false, false); return true; }
  var e = erosionErgebnis(lauf);
  lauf = null;
  if (e) {
    wendeErosionAn(e);
    rebuildRivers();
    refreshTerrainFull();
  }
  melde(1, true, false);
  return true;
}

export { starteErosion, starteErosionPinsel, brichErosionAb, erosionLaeuft,
  tickErosion, setzeErosionAnzeige, BUDGET_MS };
