/* ==========================================================================
   Signaturen — Kartenzeichen, die dem Massstab folgen (Runde I1)

   Entwurf: docs/engineering/terra-signaturenkatalog.md

   Die Leitentscheidung, an der hier jede Einzelheit gemessen wird:

     Eine Signatur ist keine kleine Version des Koerpers. Sie ist ein Zeichen
     fuer die Sache, das auch dann noch liest, wenn die Sache drei Bildpunkte
     breit waere.

   Deshalb steht in diesem Modul KEINE verkleinerte Geometrie. Es steht darin:
   ein Zeichenatlas (Tinte auf Papier, in Weiss mit Alpha gemalt), eine
   Massstabsleiter mit weichen Baendern, eine Groessenrechnung im BILDraum
   statt im Weltraum, eine Zeichenwahl aus einer mit dem Element gespeicherten
   Kennzahl, und ein ortsstabiles Streuraster fuer Flaechenzeichen.

   --- Warum das Modul so wenig importiert -------------------------------
   Erlaubt waeren auch core/pools.js und generators/geometry.js. Genommen
   werden nur `three`, `core/rng.js` und `core/store.js`. Der Grund ist kein
   Geschmack: geometry.js ist die Datei, die alle Pools registriert, also die
   Datei, die spaeter `registriereSignaturPools` AUFRUFT. Wuerde dieses Modul
   umgekehrt geometry.js (oder pools.js, das materials.js beim Modulstart
   Materialien anlegen laesst) importieren, entstuende genau die Sorte
   Auswertungszyklus, die in Runde H den Modulstart zerlegt hat. `definePool`
   wird deshalb als PARAMETER hereingereicht — das kostet eine Zeile beim
   Aufrufer und macht den Registrierweg nebenbei ohne Szene pruefbar.

   --- Warum der Atlas und nicht flache Geometrie ------------------------
   Der Instanzpfad schreibt 12 Festwerte je Instanz (Matrix + Tint, siehe
   `emit` in core/pools.js) und hat keinen Platz fuer einen UV-Versatz je
   Instanz. Ein Atlas mit PRO POOL GEBACKENEN UV umgeht das vollstaendig:
   jedes Zeichen ist ein eigener Pool mit einem eigenen Quad, dessen UV auf
   sein Atlasfeld zeigt. Eine Textur fuer alle Kartenzeichen, kein einziger
   Eingriff in die Instanzmechanik.

   --- Warum Weiss mit Alpha und nicht Farbe -----------------------------
   Die Felder tragen keine Farbe, nur Deckung. Die Farbe kommt aus dem
   Instanz-Tint und damit aus der Biompalette: dieselbe Waldsignatur liegt im
   Nadelwaldbiom in dessen Gruen und im Herbstbiom in dessen Ocker, ohne dass
   es zwei Atlasfelder braucht. Graustufen INNERHALB eines Feldes bleiben
   erlaubt, aber nur fuer Binnenschattierung (Schattenflanke am Gipfel,
   Flaechenton unter einer Randmarke).

   --- Trennung fuer die Pruefbarkeit ------------------------------------
   Alles Rechnende (Baender, Ausblendfaktor, Groesse, Zeichenwahl, Streuung,
   Atlasbelegung) ist DOM-frei und direkt pruefbar. Alles Zeichnende bekommt
   den 2D-Kontext als Parameter; es gibt in diesem Modul kein
   `document.getElementById` und kein Modulglobal, das auf ein Canvas zeigt.
   Benutzt werden ausschliesslich Kontextaufrufe, die auch der Test-Stub
   kennt (save/restore/translate/scale/beginPath/moveTo/lineTo/arc/fill/
   stroke/fillRect/clearRect) — keine Bezierkurven, keine Verlaeufe, kein
   setLineDash. Das ist keine Einschraenkung, sondern derselbe Vorrat, mit
   dem Karten seit je gestochen werden.
   ========================================================================== */
import * as THREE from 'three';
import { bildhoehe } from '../core/bild.js';
import { clamp, lerp, sstep, DEG, hashi } from '../core/rng.js';
import { KARTE, BIOME } from '../core/store.js';
// I1: die Maszstabsleiter gehoert der Karte, nicht der Darstellung.
// kartenbaum.js haengt nur an core/ — kein Zyklus.
import { MASSSTAB_LEITER } from '../world/kartenbaum.js';

var TAU = Math.PI * 2;


/* ==========================================================================
   1 — Die Massstabsleiter

   Massstab ist in Terra WELTMETER JE GITTERZELLE — eine Zahl, kein
   Levelname. Die vier Namen unten sind Ankerpunkte fuer die Bedienung, nicht
   Faelle im Code: nichts in diesem Modul verzweigt ueber `stufeFuer`, sie
   dient der Anzeige und der Pruefung.
   ========================================================================== */

var MASSSTAB_MIN = 0.5;      // feiner als 0,5 m/Zelle waere ein Bauplan
var MASSSTAB_MAX = 4000;     // gröber waere ein Globus

/* Die Leiter selbst steht in world/kartenbaum.js — sie ist eine Eigenschaft
   der KARTE, nicht der Darstellung, und der Kartenbaum ist es, der sie
   vergibt. Hier wird sie nur um die Anzeigenamen ergaenzt.

   Vorher stand sie zweimal da, mit anderen Feldnamen (`von/bis/id` gegen
   `ab/bis/name`) und denselben Zahlen. Solche Paare halten genau so lange,
   bis jemand eine der beiden anfasst. */
var MASSSTABSLEITER = MASSSTAB_LEITER.map(function (L) {
  return { id: L.name, label: L.name.charAt(0).toUpperCase() + L.name.slice(1),
    von: L.ab, bis: L.bis };
});

/** Name der Stufe, in die ein Massstab faellt (nur fuer Anzeige/Pruefung). */
function stufeFuer(massstab) {
  if (!Number.isFinite(massstab)) return null;
  var m = clamp(massstab, MASSSTAB_MIN, MASSSTAB_MAX);
  for (var i = 0; i < MASSSTABSLEITER.length; i++) {
    var L = MASSSTABSLEITER[i];
    if (m >= L.von && (m < L.bis || i === MASSSTABSLEITER.length - 1)) return L.id;
  }
  return MASSSTABSLEITER[MASSSTABSLEITER.length - 1].id;
}

/* --- Uebergabepunkte -----------------------------------------------------
   Der Katalog schreibt die Baender als freie Zahlen (40, 45, 55, 60, 900,
   1200, 1600, 2500, 4000). Vier verschiedene UNTERE Grenzen sind der Anfang
   vom Auseinanderlaufen: sie sehen einzeln plausibel aus und ergeben in der
   Summe ein Bild, in dem an einer Stelle ein Loch klafft und an der anderen
   zwei Darstellungen uebereinanderliegen. Deshalb stehen hier BENANNTE
   Uebergabepunkte, und jedes Zeichen zeigt auf einen davon.

   `koerper` = 60 ist der wichtigste Wert des ganzen Moduls. Er ist NICHT
   frei gewaehlt, sondern der Vorgabewert `sichtbarBis` des Bestands: unter
   60 m/Zelle zeichnet Terra Koerper, darueber Zeichen. Nur wenn der untere
   Rand eines Zeichens EXAKT auf dem oberen Rand der Koerperstufe liegt,
   summieren sich beide Ausblendfaktoren zu genau 1 (Begruendung bei
   `bandFaktor`). Jede andere Zahl — auch die 45 und 55 des Katalogs —
   erzeugt entweder eine Luecke oder ein doppelt deckendes Bild. */
var UEBERGABE = {
  koerper: 60,     // hier uebernimmt die Karte vom Koerper
  detail:  900,    // was nur Detail ist, endet hier (Bruecke, Furt, Muehle)
  nah:    1200,
  mittel: 1600,
  gross:  2500,
  voll:   4000     // Ende der Leiter
};

/** Vorgabeband des Bestands: genau dort, wo er heute schon ist.
 *  Fehlen `sichtbarAb`/`sichtbarBis` an einem Pool, gilt dieses Paar — damit
 *  bleibt jeder der 272 vorhandenen Pools ohne eine einzige Aenderung im
 *  Band „Ort bis Landschaft". Keine Migration, keine Formataenderung. */
var VORGABE_BAND = { ab: 0, bis: UEBERGABE.koerper };

/* Breite der Ueberblendung, als FAKTOR auf die Bandgrenze. 1.6 ist rund eine
   halbe Groessenordnung (10^0.2 ≈ 1.58) — ein Zoom ueber die Grenze soll
   nicht springen, aber auch nicht ueber zwei Zehnerpotenzen matschen. */
var BLENDE = 1.6;

/**
 * Sichtbarkeit als FAKTOR, nicht als Schaltung.
 *
 *   f(m) = sstep(ab, ab*1.6, m) * sstep(bis*1.6, bis, m)
 *
 * Ein Pool erscheint ueber eine halbe Groessenordnung und verschwindet ueber
 * eine halbe Groessenordnung.
 *
 * Die Eigenschaft, wegen der die Uebergabepunkte oben ueberhaupt existieren:
 * ist `ab` der Nachfolgestufe gleich `bis` der Vorstufe, dann laufen beide
 * Rampen ueber DASSELBE Intervall [X, 1.6X], und ihre Smoothstep-Parameter
 * addieren sich dort zu 1. Weil S(t) = t²(3−2t) punktsymmetrisch um (0.5,0.5)
 * ist, gilt S(1−t) = 1 − S(t) — die beiden Faktoren summieren sich also EXAKT
 * zu 1, nicht ungefaehr. Ein sauberes Kreuzblenden ohne eine einzige
 * Sonderregel.
 *
 * `ab = 0` ist ausdruecklich erlaubt (Vorgabeband des Bestands) und muss
 * abgefangen werden: sstep(0, 0, m) rechnet 0/0 und lieferte NaN, das dann
 * als Tint bis in die Instanzdaten liefe.
 */
function bandFaktor(ab, bis, massstab) {
  // Ohne Massstab ist alles sichtbar. So verhaelt sich das Modul, bis der
  // Kartenbaum die Zahl liefert — und so bleibt der Bestand unveraendert.
  if (!Number.isFinite(massstab)) return 1;
  var ein = (Number.isFinite(ab) && ab > 0) ? sstep(ab, ab * BLENDE, massstab) : 1;
  var aus = (Number.isFinite(bis) && bis > 0) ? sstep(bis * BLENDE, bis, massstab) : 0;
  var f = ein * aus;
  return f > 0 ? (f < 1 ? f : 1) : 0;
}

/** Band eines benannten Zeichens (oder das Vorgabeband, wenn es keines ist). */
function bandVon(name) {
  var Z = ZEICHEN[name];
  if (!Z) return { ab: VORGABE_BAND.ab, bis: VORGABE_BAND.bis };
  return { ab: Z.ab, bis: Z.bis };
}

/** Ausblendfaktor eines benannten Zeichens. */
function zeichenFaktor(name, massstab) {
  var b = bandVon(name);
  return bandFaktor(b.ab, b.bis, massstab);
}


/* ==========================================================================
   2 — Der Katalog

   49 Zeichen in fuenf Gruppen. (Der Fliesstext des Entwurfs spricht von 47;
   die Tabellen darunter zaehlen 14 + 15 + 8 + 7 + 5 = 49. Gebaut sind die
   Tabellen — sie sind die genauere Quelle.)

   Felder je Eintrag:
     gruppe    Katalogabschnitt; bestimmt zugleich die Atlaszeile
     anteil    Groesse als Bruchteil der Kartenkante (siehe Abschnitt 4)
     ab, bis   Band in Metern je Zelle; `ab` immer ein Uebergabepunkt
     quelle    'E' aus einem Element, 'A' aus einer Ableitung, 'H' von Hand
     ton       woraus der Instanz-Tint kommt (Abschnitt 6)
     rueckfall OPTIONAL. Zeichen, das uebernimmt, wenn dieses aus dem Band
               faellt — die kartografische Generalisierung: ein Weinberg wird
               auf Regionsmassstab zu Ackerland, nicht zu nichts.
     leuchtet  OPTIONAL. Traegt Eigenlicht (nur die Arbor-Gruppe).
   ========================================================================== */

var GRUPPEN = ['bauwerk', 'flaeche', 'relief', 'linie', 'arbor'];

function z(gruppe, anteil, bis, quelle, ton, extra) {
  var e = { gruppe: gruppe, anteil: anteil, ab: UEBERGABE.koerper, bis: bis,
    quelle: quelle, ton: ton, rueckfall: null, leuchtet: false,
    streifen: false, strich: false };
  if (extra) for (var k in extra) if (extra.hasOwnProperty(k)) e[k] = extra[k];
  return e;
}

var ZEICHEN = {
  /* --- 1. Orte und Bauwerk ------------------------------------------------
     Ein Ort ist auf einer Karte ein RING, kein Grundriss. Der Ring sagt „hier
     ist etwas", der Punkt darin sagt „und es hat eine Mitte". Das ist die
     aelteste Konvention der Tabelle und die belastbarste. */
  sig_weiler:     z('bauwerk', 0.004, UEBERGABE.voll,   'E', 'tinte'),
  sig_dorf:       z('bauwerk', 0.006, UEBERGABE.voll,   'E', 'tinte'),
  sig_stadt:      z('bauwerk', 0.009, UEBERGABE.voll,   'E', 'tinte'),
  sig_stadtmauer: z('bauwerk', 0.013, UEBERGABE.nah,    'E', 'tinte'),
  sig_hauptstadt: z('bauwerk', 0.012, UEBERGABE.voll,   'H', 'tinte'),
  sig_burg:       z('bauwerk', 0.007, UEBERGABE.gross,  'E', 'tinte'),
  sig_kloster:    z('bauwerk', 0.006, UEBERGABE.gross,  'E', 'tinte'),
  sig_turm:       z('bauwerk', 0.005, UEBERGABE.mittel, 'E', 'tinte'),
  sig_ruine:      z('bauwerk', 0.006, UEBERGABE.gross,  'E', 'tinte'),
  sig_hafen:      z('bauwerk', 0.006, UEBERGABE.gross,  'E', 'tinte'),
  sig_bruecke:    z('bauwerk', 0.004, UEBERGABE.detail, 'E', 'tinte'),
  sig_furt:       z('bauwerk', 0.004, UEBERGABE.detail, 'A', 'wasser'),
  sig_mine:       z('bauwerk', 0.005, UEBERGABE.mittel, 'E', 'tinte'),
  sig_muehle:     z('bauwerk', 0.005, UEBERGABE.detail, 'E', 'tinte'),

  /* --- 2. Flaechen und Bewuchs ------------------------------------------
     Flaechenzeichen werden gekachelt gestreut (Abschnitt 5), nicht einmal in
     die Mitte gesetzt. Sie tragen deshalb einen schwachen Flaechenton unter
     der Randmarke: erst dadurch liest ein Feld gestreuter Marken als TON und
     nicht als Punktwolke. */
  sig_laubwald:   z('flaeche', 0.010, UEBERGABE.voll,   'E', 'bewuchs'),
  sig_nadelwald:  z('flaeche', 0.010, UEBERGABE.voll,   'E', 'bewuchs'),
  sig_mischwald:  z('flaeche', 0.010, UEBERGABE.voll,   'E', 'bewuchs'),
  sig_hain:       z('flaeche', 0.007, UEBERGABE.mittel, 'E', 'bewuchs'),
  sig_acker:      z('flaeche', 0.008, UEBERGABE.mittel, 'E', 'kultur'),
  sig_weide:      z('flaeche', 0.008, UEBERGABE.mittel, 'E', 'kultur',
    { rueckfall: 'sig_acker' }),
  sig_sumpf:      z('flaeche', 0.009, UEBERGABE.voll,   'A', 'nass'),
  sig_moor:       z('flaeche', 0.009, UEBERGABE.voll,   'A', 'nass'),
  sig_wueste:     z('flaeche', 0.011, UEBERGABE.voll,   'A', 'trocken'),
  sig_salzpfanne: z('flaeche', 0.011, UEBERGABE.voll,   'A', 'trocken'),
  sig_tundra:     z('flaeche', 0.010, UEBERGABE.voll,   'A', 'kalt'),
  sig_eis:        z('flaeche', 0.010, UEBERGABE.voll,   'A', 'kalt'),
  sig_karst:      z('flaeche', 0.010, UEBERGABE.voll,   'A', 'stein'),
  sig_weinberg:   z('flaeche', 0.008, UEBERGABE.detail, 'E', 'kultur',
    { rueckfall: 'sig_acker' }),
  sig_obstgarten: z('flaeche', 0.008, UEBERGABE.detail, 'E', 'kultur',
    { rueckfall: 'sig_acker' }),

  /* --- 3. Relief ---------------------------------------------------------
     Die Regel, an der Karten am schnellsten billig aussehen: DEM GRAT FOLGEN,
     NICHT DIE FLAECHE FUELLEN. Ein Gebirge wird durch seine Kammlinie
     erzaehlt, nicht durch ein Feld aus Bergchen. Deshalb ist `sig_grat` das
     Leitzeichen der Gruppe und `sig_gipfel` die Ausnahme, nicht umgekehrt. */
  sig_grat:       z('relief', 0.014, UEBERGABE.voll,   'A', 'stein'),
  sig_gipfel:     z('relief', 0.009, UEBERGABE.voll,   'A', 'stein'),
  sig_vulkan:     z('relief', 0.011, UEBERGABE.voll,   'A', 'stein'),
  sig_klippe:     z('relief', 0.007, UEBERGABE.gross,  'A', 'stein'),
  sig_schlucht:   z('relief', 0.009, UEBERGABE.gross,  'A', 'stein'),
  sig_pass:       z('relief', 0.006, UEBERGABE.mittel, 'A', 'stein'),
  sig_huegelland: z('relief', 0.010, UEBERGABE.voll,   'A', 'stein'),
  sig_krater:     z('relief', 0.010, UEBERGABE.voll,   'A', 'stein'),

  /* --- 4. Wege, Grenzen, Gewaesser ---------------------------------------
     KEINE gestreuten Quads, sondern ein Band entlang des Pfades (dieselbe
     pathSamples-Mechanik wie genStrasse, nur mit Signaturbreite). Ihr
     Atlasfeld ist deshalb ein STREIFEN, der in u kachelbar ist: er wird
     entlang des Pfades wiederholt, nicht auf ein Quad gelegt. `anteil` ist
     bei ihnen die BREITE des Bandes, nicht seine Laenge. */
  sig_handelsstrasse: z('linie', 0.0035, UEBERGABE.voll,   'E', 'tinte', { streifen: true }),
  sig_landweg:        z('linie', 0.0022, UEBERGABE.nah,    'E', 'tinte', { streifen: true }),
  sig_saumpfad:       z('linie', 0.0016, UEBERGABE.detail, 'E', 'tinte',
    { streifen: true, strich: true }),
  sig_fluss:          z('linie', 0.0030, UEBERGABE.voll,   'E', 'wasser', { streifen: true }),
  sig_kueste:         z('linie', 0.0045, UEBERGABE.voll,   'A', 'wasser', { streifen: true }),
  sig_grenze:         z('linie', 0.0028, UEBERGABE.voll,   'H', 'grenze',
    { streifen: true, strich: true }),
  sig_seeweg:         z('linie', 0.0018, UEBERGABE.voll,   'H', 'wasser',
    { streifen: true, strich: true }),
  /* I6 — der GRUNDRISS, den der Katalog als naechsten Schritt nennt: „eine
     Burg mit drei Mauerringen verdient ihre Form" statt eines groesseren
     Rechtecks. Er steht in der Liniengruppe und nicht bei den Bauwerken,
     obwohl er eine Anlage zeigt: er ist ein STREIFEN, laeuft also am Umriss
     entlang statt in dessen Mitte zu stehen, und die Gruppe entscheidet in
     diesem Modul ueber die Bauart des Zeichens, nicht ueber sein Thema
     (11-signaturen haelt genau das fest: `streifen` gilt fuer die
     Liniengruppe und nur fuer sie).

     Warum er bei `nah` (1200) endet und nicht wie sig_burg bei `gross`: der
     Grundriss ist die WAHRE Ausdehnung der Anlage. Solange man sie als
     Anlage liest, ist das die genauere Auskunft; sobald die Karte einen
     Landstrich zeigt, ist die Burg ein Ort und kein Bauwerk mehr — dann
     gehoert dorthin ein Zeichen und keine Grundflaeche. Das Punktzeichen
     laeuft die ganze Zeit mit; beides zusammen ist die Staffelung, die ein
     Messtischblatt einem Uebersichtsblatt voraushat.

     `anteil` ist bei einem Streifen die BANDBREITE, nicht die
     Zeichengroesse. 0.0050 liegt zwischen Kueste (0.0045) und Handelsstrasse
     (0.0035): der Umriss ist die Aussenkante eines Bauwerks und darf kraeftiger
     stehen als ein Weg, ohne zur Mauer zu werden — bei voll im Bild stehender
     Karte sind das rund vier Bildpunkte Band mit gut einem Punkt Tinte darin. */
  sig_grundriss:      z('linie', 0.0050, UEBERGABE.nah,    'A', 'tinte',
    { streifen: true }),

  /* --- 5. Arbor ----------------------------------------------------------
     Der Hauskanon: Terra ist auseinandergerissen und wird vom weissen,
     leuchtenden Riesenbaum Arbor zusammengehalten. Auf Kartenmassstab ist das
     kein Bewuchs, sondern INFRASTRUKTUR — die Ranken sind das, was die
     Bruchstuecke verbindet. Diese fuenf ziehen ihre Farbe als einzige nicht
     aus der Biompalette, sondern aus der Arborfarbe, und tragen Eigenlicht.
     Auf einer Kontinentkarte ist das der einzige Ort im Bild, an dem es
     leuchtet — man liest die Karte von den Ranken her. Das ist Absicht. */
  sig_ranke:        z('arbor', 0.010, UEBERGABE.voll,  'E', 'arbor', { leuchtet: true }),
  sig_rankenfuss:   z('arbor', 0.008, UEBERGABE.gross, 'E', 'arbor', { leuchtet: true }),
  sig_bruchkante:   z('arbor', 0.012, UEBERGABE.voll,  'E', 'arbor', { leuchtet: true }),
  sig_arborknoten:  z('arbor', 0.014, UEBERGABE.voll,  'H', 'arbor', { leuchtet: true }),
  sig_lichtbruecke: z('arbor', 0.008, UEBERGABE.gross, 'E', 'arbor', { leuchtet: true })
};

var ZEICHEN_NAMEN = Object.keys(ZEICHEN);

/** Katalogeintrag oder null. */
function zeichenDaten(name) {
  return ZEICHEN.hasOwnProperty(name) ? ZEICHEN[name] : null;
}

/** Ist ein Zeichen bei diesem Massstab sichtbar — und wenn nicht, was
 *  uebernimmt? Gibt den Namen des tatsaechlich zu zeichnenden Zeichens
 *  zurueck oder null. Ein Rueckfall darf selbst wieder zurueckfallen
 *  (Weinberg -> Acker -> nichts), deshalb die Schleife statt eines `if`. */
function imBand(name, massstab) {
  var tiefe = 0;
  while (name && tiefe++ < 4) {
    if (zeichenFaktor(name, massstab) > 0) return name;
    var Z = ZEICHEN[name];
    name = Z ? Z.rueckfall : null;
  }
  return null;
}


/* ==========================================================================
   3 — Die Sachen und ihre Darstellungsketten

   Der Katalog nennt Zeichen. Die schwierigere Haelfte ist die Frage, WELCHES
   Zeichen eine Sache bekommt — und was ueberhaupt aus einer Sache wird, wenn
   man herauszoomt. Das ist die Stufentabelle des Entwurfs, hier als Daten.

   Eine Kette deckt die Leiter LUECKENLOS ab: jede Stufe beginnt dort, wo die
   vorige endet. Vier Arten von Stufe:

     koerper      die vorhandenen Koerperpools zeichnen die Sache
     zeichen      ein Kartenzeichen aus der Wahlgruppe der Sache
     flaechenton  das GELAENDE traegt die Sache (Terrainfarbe, kein Pool) —
                  der Kontinentfall des Katalogs fuer Acker, Sumpf, Klippe
     entfaellt    bewusst weggelassen; eine Bruecke gehoert auf keine
                  Kontinentkarte

   `entfaellt` ist die wichtigste der vier: sie macht das Weglassen zu einer
   EINTRAGUNG statt zu einer Luecke. Eine Luecke sieht im Betrieb genauso aus
   wie ein Fehler, und genau deshalb prueft 11-signaturen, dass es keine
   uneingetragenen gibt.
   ========================================================================== */

function kette() {
  var stufen = [], von = MASSSTAB_MIN;
  for (var i = 0; i < arguments.length; i++) {
    var s = arguments[i];
    stufen.push({ von: von, bis: s.bis, art: s.art, in: s.in || null,
      hinweis: s.hinweis || '' });
    von = s.bis;
  }
  return stufen;
}
function K(bis) { return { bis: bis, art: 'koerper' }; }
function Zs(bis) { return { bis: bis, art: 'zeichen' }; }
function Ton(bis, hinweis) { return { bis: bis, art: 'flaechenton', hinweis: hinweis }; }
function Weg(bis, hinweis) { return { bis: bis, art: 'entfaellt', hinweis: hinweis }; }
function Auf(bis, ziel) { return { bis: bis, art: 'aufgegangen', in: ziel }; }

/* Die Waehler. Jeder bekommt (kennzahl, massstab, opt) und liefert eine
   LISTE von Zeichennamen — meist eine, bei der Grossstadt zwei (Signatur plus
   Mauerkranz), auf grobem Massstab auch keine (Generalisierung).

   Alle greifen ueber `imBand`, nie direkt auf den Namen zu: das ist die eine
   Stelle, an der aus „faellt aus dem Band" ein „wird zu seinem Rueckfall"
   wird. */

/** Aus vielen Haeusern wird ein Ort.
 *
 *  Die Kennzahl ist die Zahl der gesetzten BAUKOERPER, und sie wird auf
 *  ORTSMASSSTAB ermittelt und mit dem Element gespeichert — nicht auf
 *  Regionsmassstab geschaetzt. Sonst hinge die Signatur davon ab, mit welchem
 *  Massstab man die Karte zuletzt geoeffnet hat; genau die Sorte versteckter
 *  Zustand, an der dieses Projekt schon einmal einen Tag verloren hat
 *  (rebuildAll, Runde I5).
 *
 *  Grenzfaelle sind bewusst eindeutig: 8 ist noch Weiler, 9 schon Dorf,
 *  40 ist noch Dorf, 41 schon Stadt. Ohne Kennzahl faellt die Wahl auf den
 *  Weiler — ein zu klein gezeichneter Ort ist ein Fehler zweiter Ordnung,
 *  eine erfundene Stadt einer erster. */
var ORT_SCHWELLEN = [[8, 'sig_weiler'], [40, 'sig_dorf'], [150, 'sig_stadt']];
function waehleOrt(kennzahl, massstab, opt) {
  opt = opt || {};
  var aus = [], k = Number.isFinite(kennzahl) ? kennzahl : 0;
  // Ueber der letzten Schwelle bleibt es bei deren Zeichen — die Grossstadt
  // bekommt keinen eigenen Ring, sondern denselben plus Mauerkranz.
  var grund = ORT_SCHWELLEN[ORT_SCHWELLEN.length - 1][1];
  for (var i = 0; i < ORT_SCHWELLEN.length; i++) {
    if (k <= ORT_SCHWELLEN[i][0]) { grund = ORT_SCHWELLEN[i][1]; break; }
  }
  if (opt.hauptstadt) grund = 'sig_hauptstadt';
  var g = imBand(grund, massstab);
  if (g) aus.push(g);
  // Der Mauerkranz ist ein ZUSATZ, kein Ersatz: er liegt um den Doppelring,
  // und ueber `nah` faellt er weg, waehrend die Ortssignatur bleibt.
  if (k > 150) {
    var m = imBand('sig_stadtmauer', massstab);
    if (m) aus.push(m);
  }
  return aus;
}

/** Waehler, der nur eine Art durchreicht (mit Vorgabe). */
function nachArt(vorgabe, erlaubt) {
  return function (kennzahl, massstab, opt) {
    var art = opt && opt.art;
    var name = (art && erlaubt.indexOf(art) >= 0) ? art : vorgabe;
    var n = imBand(name, massstab);
    return n ? [n] : [];
  };
}

/** Wald: erst die Groesse (Hain oder Wald), dann die Mischung.
 *  Kennzahl = Zahl der auf Ortsmassstab gesetzten Baeume, gespeichert. */
function waehleWald(kennzahl, massstab, opt) {
  opt = opt || {};
  var k = Number.isFinite(kennzahl) ? kennzahl : 200;
  var name;
  if (k <= 40) name = 'sig_hain';
  else {
    var mi = Number.isFinite(opt.mischung) ? opt.mischung : 0.25;
    name = mi < 0.2 ? 'sig_laubwald' : (mi > 0.8 ? 'sig_nadelwald' : 'sig_mischwald');
  }
  var n = imBand(name, massstab);
  return n ? [n] : [];
}

var SACHEN = {
  /* Ein Wohnhaus hat auf keiner Karte ein eigenes Zeichen. Es geht in der
     Ortssignatur AUF — deshalb `aufgegangen` und nicht `entfaellt`: die Sache
     verschwindet nicht, sie wird von einer anderen mitgetragen. */
  wohnhaus: { label: 'Wohnhaus', zeichen: [], leit: null,
    kette: kette(K(UEBERGABE.koerper), Auf(UEBERGABE.voll, 'ort')), waehle: null },

  /* Dorf und Stadt sind im Entwurf zwei Zeilen. Sie sind dieselbe Kette und
     unterscheiden sich AUSSCHLIESSLICH in der Kennzahl — genau das ist der
     Zusammenzeichen-Mechanismus. Zwei Eintraege daraus zu machen hiesse, ihn
     zweimal zu pflegen. */
  ort: { label: 'Ort', leit: 'sig_dorf',
    zeichen: ['sig_weiler', 'sig_dorf', 'sig_stadt', 'sig_stadtmauer', 'sig_hauptstadt'],
    kette: kette(K(UEBERGABE.koerper), Zs(UEBERGABE.voll)), waehle: waehleOrt },

  wehrbau: { label: 'Wehr- und Sakralbau', leit: 'sig_burg',
    zeichen: ['sig_burg', 'sig_kloster', 'sig_turm'],
    kette: kette(K(UEBERGABE.koerper), Zs(UEBERGABE.gross),
      Weg(UEBERGABE.voll, 'auf Kontinentmassstab traegt die Ortssignatur den Platz')),
    waehle: nachArt('sig_burg', ['sig_burg', 'sig_kloster', 'sig_turm']) },

  ruine: { label: 'Ruine', leit: 'sig_ruine', zeichen: ['sig_ruine'],
    kette: kette(K(UEBERGABE.koerper), Zs(UEBERGABE.gross),
      Weg(UEBERGABE.voll, 'Katalog: Kontinent „—"')),
    waehle: nachArt('sig_ruine', ['sig_ruine']) },

  hafen: { label: 'Hafen', leit: 'sig_hafen', zeichen: ['sig_hafen'],
    kette: kette(K(UEBERGABE.koerper), Zs(UEBERGABE.gross), Auf(UEBERGABE.voll, 'ort')),
    waehle: nachArt('sig_hafen', ['sig_hafen']) },

  uebergang: { label: 'Flussuebergang', leit: 'sig_bruecke',
    zeichen: ['sig_bruecke', 'sig_furt'],
    kette: kette(K(UEBERGABE.koerper), Zs(UEBERGABE.detail),
      Weg(UEBERGABE.voll, 'eine Bruecke gehoert auf keine Regionskarte')),
    waehle: nachArt('sig_bruecke', ['sig_bruecke', 'sig_furt']) },

  werk: { label: 'Werk', leit: 'sig_mine', zeichen: ['sig_mine', 'sig_muehle'],
    kette: kette(K(UEBERGABE.koerper), Zs(UEBERGABE.mittel),
      Weg(UEBERGABE.voll, 'Einzelwerke gehen im Ortsnetz auf')),
    waehle: nachArt('sig_mine', ['sig_mine', 'sig_muehle']) },

  wald: { label: 'Wald', leit: 'sig_laubwald',
    zeichen: ['sig_laubwald', 'sig_nadelwald', 'sig_mischwald', 'sig_hain'],
    kette: kette(K(UEBERGABE.koerper), Zs(UEBERGABE.voll)), waehle: waehleWald },

  acker: { label: 'Acker und Weide', leit: 'sig_acker',
    zeichen: ['sig_acker', 'sig_weide', 'sig_weinberg', 'sig_obstgarten'],
    kette: kette(K(UEBERGABE.koerper), Zs(UEBERGABE.mittel),
      Ton(UEBERGABE.voll, 'Katalog: Kontinent = Flaechenton')),
    waehle: nachArt('sig_acker',
      ['sig_acker', 'sig_weide', 'sig_weinberg', 'sig_obstgarten']) },

  nass: { label: 'Sumpf und Moor', leit: 'sig_sumpf',
    zeichen: ['sig_sumpf', 'sig_moor'],
    kette: kette(K(UEBERGABE.koerper), Zs(UEBERGABE.voll)),
    waehle: nachArt('sig_sumpf', ['sig_sumpf', 'sig_moor']) },

  trocken: { label: 'Wueste', leit: 'sig_wueste',
    zeichen: ['sig_wueste', 'sig_salzpfanne'],
    kette: kette(K(UEBERGABE.koerper), Zs(UEBERGABE.voll)),
    waehle: nachArt('sig_wueste', ['sig_wueste', 'sig_salzpfanne']) },

  kalt: { label: 'Tundra und Eis', leit: 'sig_tundra',
    zeichen: ['sig_tundra', 'sig_eis'],
    kette: kette(K(UEBERGABE.koerper), Zs(UEBERGABE.voll)),
    waehle: nachArt('sig_tundra', ['sig_tundra', 'sig_eis']) },

  karst: { label: 'Karst', leit: 'sig_karst', zeichen: ['sig_karst'],
    kette: kette(K(UEBERGABE.koerper), Zs(UEBERGABE.voll)),
    waehle: nachArt('sig_karst', ['sig_karst']) },

  gebirge: { label: 'Gebirge', leit: 'sig_grat',
    zeichen: ['sig_grat', 'sig_gipfel', 'sig_vulkan', 'sig_huegelland', 'sig_krater'],
    kette: kette(K(UEBERGABE.koerper), Zs(UEBERGABE.voll)),
    waehle: nachArt('sig_grat',
      ['sig_grat', 'sig_gipfel', 'sig_vulkan', 'sig_huegelland', 'sig_krater']) },

  kante: { label: 'Klippe und Schlucht', leit: 'sig_klippe',
    zeichen: ['sig_klippe', 'sig_schlucht'],
    kette: kette(K(UEBERGABE.koerper), Zs(UEBERGABE.gross),
      Ton(UEBERGABE.voll, 'Reliefschattierung uebernimmt (kein Pool)')),
    waehle: nachArt('sig_klippe', ['sig_klippe', 'sig_schlucht']) },

  pass: { label: 'Pass', leit: 'sig_pass', zeichen: ['sig_pass'],
    kette: kette(K(UEBERGABE.koerper), Zs(UEBERGABE.mittel),
      Weg(UEBERGABE.voll, 'Katalog: Kontinent „—"')),
    waehle: nachArt('sig_pass', ['sig_pass']) },

  /* Leitzeichen ist die HANDELSSTRASSE, nicht der Landweg: auf
     Kontinentmassstab bleiben nur die Hauptzuege, und die Sache „Strasse"
     muss dort noch darstellbar sein. Landweg und Saumpfad fallen ueber ihre
     eigenen Baender weg — das IST die Generalisierung, nicht ihr Verlust. */
  strasse: { label: 'Strasse', leit: 'sig_handelsstrasse',
    zeichen: ['sig_handelsstrasse', 'sig_landweg', 'sig_saumpfad'],
    kette: kette(K(UEBERGABE.koerper), Zs(UEBERGABE.voll)),
    waehle: nachArt('sig_landweg',
      ['sig_handelsstrasse', 'sig_landweg', 'sig_saumpfad']) },

  gewaesser: { label: 'Gewaesser', leit: 'sig_fluss',
    zeichen: ['sig_fluss', 'sig_kueste'],
    kette: kette(K(UEBERGABE.koerper), Zs(UEBERGABE.voll)),
    waehle: nachArt('sig_fluss', ['sig_fluss', 'sig_kueste']) },

  grenze: { label: 'Grenze', leit: 'sig_grenze',
    zeichen: ['sig_grenze', 'sig_seeweg'],
    kette: kette(K(UEBERGABE.koerper), Zs(UEBERGABE.voll)),
    waehle: nachArt('sig_grenze', ['sig_grenze', 'sig_seeweg']) },

  arbor: { label: 'Arbor', leit: 'sig_ranke',
    zeichen: ['sig_ranke', 'sig_rankenfuss', 'sig_arborknoten', 'sig_lichtbruecke'],
    kette: kette(K(UEBERGABE.koerper), Zs(UEBERGABE.voll)),
    waehle: nachArt('sig_ranke',
      ['sig_ranke', 'sig_rankenfuss', 'sig_arborknoten', 'sig_lichtbruecke']) },

  /* I6 — der Grundriss ist eine eigene SACHE und kein Zusatz zum Wehrbau,
     denn seine Kette ist eine andere: ein Wehrbau wird ueber der Uebergabe
     zum Zeichen und bleibt es bis 2500, der Grundriss ist der Koerper VON
     OBEN und hoert deshalb frueher auf. Er beginnt genau dort, wo der
     Baukoerper endet, und endet dort, wo aus der Anlage ein Ort wird. */
  grundriss: { label: 'Grundriss einer Anlage', leit: 'sig_grundriss',
    zeichen: ['sig_grundriss'],
    kette: kette(K(UEBERGABE.koerper), Zs(UEBERGABE.nah),
      Weg(UEBERGABE.voll, 'ab Regionsmassstab traegt das Punktzeichen die Anlage')),
    waehle: nachArt('sig_grundriss', ['sig_grundriss']) },

  bruch: { label: 'Bruchkante', leit: 'sig_bruchkante', zeichen: ['sig_bruchkante'],
    kette: kette(K(UEBERGABE.koerper), Zs(UEBERGABE.voll)),
    waehle: nachArt('sig_bruchkante', ['sig_bruchkante']) }
};

var SACHEN_NAMEN = Object.keys(SACHEN);

/** Welche Stufe der Kette gilt bei diesem Massstab? */
function darstellungAn(sache, massstab) {
  var S1 = SACHEN[sache];
  if (!S1) return null;
  var m = clamp(massstab, MASSSTAB_MIN, MASSSTAB_MAX);
  for (var i = 0; i < S1.kette.length; i++) {
    var st = S1.kette[i];
    if (m >= st.von && (m < st.bis || i === S1.kette.length - 1)) return st;
  }
  return null;
}

/**
 * Die Zeichen, die eine Sache bei diesem Massstab bekommt.
 * Leere Liste heisst NICHT „Fehler", sondern „auf diesem Massstab
 * weggelassen" — ein Hain gehoert auf keine Kontinentkarte.
 */
function zeichenFuer(sache, kennzahl, massstab, opt) {
  var S1 = SACHEN[sache];
  if (!S1 || !S1.waehle) return [];
  var st = darstellungAn(sache, massstab);
  if (!st || st.art !== 'zeichen') return [];
  return S1.waehle(kennzahl, massstab, opt);
}


/* ==========================================================================
   4 — Groesse: der Fallstrick, an dem naive Umsetzungen scheitern

   Ein Koerper ist in Weltmetern gross. Ein Kartenzeichen ist es NICHT. Eine
   Ortssignatur von 30 m waere auf einer Kontinentkarte mit 2000 m/Zelle ein
   Sechzigstel einer Zelle — unsichtbar.

   Kartenzeichen bekommen ihre Groesse deshalb relativ zur KARTENKANTE:

       marke = anteil * kartenKante

   In Terra ist die Kartenkante immer 256/512/1024 Welteinheiten, unabhaengig
   davon, wie viele Meter eine Zelle bedeutet. Ein Zeichen ist damit auf einer
   2-km-Karte und auf einer 2000-km-Karte im BILD gleich gross — genau das
   will man: die Lesbarkeit haengt am Bild, nicht an der Welt.

   Dazu Mindest- und Hoechstgroesse im Bildraum, weil sonst der weite Blick
   die Zeichen unter die Lesbarkeitsschwelle druckt und der nahe sie zu Fladen
   aufblaest. Bei voll im Bild stehender Karte liegt ein Ortszeichen roh bei
   rund 5 px — die Mindestgroesse ist hier also kein Notausgang, sondern der
   Normalfall.
   ========================================================================== */

var SIG_MIN_PX = 9;      // darunter ist ein Ring ein Fleck
var SIG_MAX_PX = 64;     // darueber ein Fladen

/* Der Feldinhalt liegt im inneren Teil des Atlasfeldes; der Rand ist
   Sicherheitsabstand gegen Mip-Ausblutung (siehe Abschnitt 7). Damit `anteil`
   trotzdem die Groesse der TINTE meint und nicht die des Quads, wird das Quad
   um denselben Faktor groesser gerechnet. */
var ATLAS_INHALT = 0.76;



/**
 * Weltgroesse eines Zeichens.
 * sicht: { kante?, abstand?, fov?, bildHoehe? } — fehlen Kameraangaben,
 * bleibt die Bildraumschranke aus (dann ist `px` null).
 * Rueckgabe: { quad, marke, px, gedeckelt }
 *   quad   Kantenlaenge des Quads in Welteinheiten (das, was in die Skalierung
 *          der Instanz geht)
 *   marke  Kantenlaenge der sichtbaren Tinte — das, was `anteil` meint
 */
function signaturGroesse(name, sicht) {
  sicht = sicht || {};
  var Z = ZEICHEN[name];
  var anteil = Z ? Z.anteil : 0.006;
  var kante = Number.isFinite(sicht.kante) ? sicht.kante : KARTE.map;
  var marke = anteil * kante;
  var px = null, gedeckelt = '';
  if (Number.isFinite(sicht.abstand) && Number.isFinite(sicht.bildHoehe) && sicht.bildHoehe > 0) {
    px = bildhoehe(marke, sicht.abstand, sicht.fov, sicht.bildHoehe);
    var min = Number.isFinite(sicht.minPx) ? sicht.minPx : SIG_MIN_PX;
    var max = Number.isFinite(sicht.maxPx) ? sicht.maxPx : SIG_MAX_PX;
    if (px > 0 && px < min) { marke *= min / px; px = min; gedeckelt = 'min'; }
    else if (px > max) { marke *= max / px; px = max; gedeckelt = 'max'; }
  }
  return { quad: marke / ATLAS_INHALT, marke: marke, px: px, gedeckelt: gedeckelt };
}

/* Signaturen liegen flach in der XZ-Ebene, leicht ueber dem Gelaende — sonst
   verschwinden sie an einem Hang im Boden. 0,4 % der Kartenkante ist bei 256
   gut ein Meter und waechst mit der Karte mit. */
var SCHWEBE_ANTEIL = 0.004;
function schwebeHoehe(kante) {
  return SCHWEBE_ANTEIL * (Number.isFinite(kante) ? kante : KARTE.map);
}


/* ==========================================================================
   5 — Flaechenzeichen streuen

   Eine einzelne Waldmarke auf einem 200-km-Wald saehe aus wie ein Fehler.
   Flaechenzeichen werden deshalb gekachelt ueber die Flaeche gestreut.

   Das Raster ist dasselbe Muster wie in genWald: Zellenindex als Schluessel
   fuer hashi, Jitter aus dem Hash, nichts haengt an der Reihenfolge der
   Schleife. Ein Unterschied ist bewusst gemacht:

   genWald verankert sein Raster in WELTkoordinaten — Baeume gehoeren zum
   Boden und sollen stehen bleiben, wenn man das Polygon verschiebt. Eine
   Signatur gehoert dagegen zur SACHE, nicht zum Boden: schoebe man die
   Flaeche und das Markenmuster bliebe liegen, wanderte das Muster durch die
   Flaeche, und an den Raendern erschienen und verschwaenden Marken bei jeder
   Mausbewegung. Deshalb wird das Raster an einem mitgereichten Anker
   ausgerichtet (in der Praxis der Schwerpunkt des Polygons): eine Verschiebung
   um einen Betrag, der KEIN Vielfaches des Rasters ist, verschiebt die Marken
   starr mit, statt sie neu zu wuerfeln.

   Ohne Anker (0,0) ist es exakt das Weltraster von genWald — der Aufrufer
   entscheidet, welche der beiden Bedeutungen er will.
   ========================================================================== */

/* Abstand der Marken in Vielfachen ihrer eigenen Groesse. Enger als 2 sieht
   nach Textur aus, weiter als 3 nach Zufall. */
var STREU_ABSTAND = 2.4;
function streuAbstand(markeGroesse) { return Math.max(1e-4, markeGroesse * STREU_ABSTAND); }

/**
 * Rasterpunkte fuer gekachelte Flaechenzeichen.
 *
 * opt:
 *   x0, z0, x1, z1   Huellrechteck der Flaeche (Weltkoordinaten)
 *   sp               Rasterabstand (aus streuAbstand)
 *   seed             Elementseed — der Zufall haengt nur an ihm und am Index
 *   ankerX, ankerZ   Bezugspunkt des Rasters (Vorgabe 0/0 = Weltraster)
 *   imInneren(x, z)  Praedikat; fehlt es, gilt das ganze Rechteck
 *   maxN             Deckel gegen Instanzexplosion (Vorgabe 4000)
 *
 * Rueckgabe: [{ cx, cz, x, z, dreh, skala }]
 *   `dreh` und `skala` streuen das Bild leicht auf — ohne sie liest ein Feld
 *   von Marken als Tapete statt als Handzeichnung.
 */
function streuRaster(opt) {
  opt = opt || {};
  var sp = Number.isFinite(opt.sp) && opt.sp > 0 ? opt.sp : 1;
  var ax = Number.isFinite(opt.ankerX) ? opt.ankerX : 0;
  var az = Number.isFinite(opt.ankerZ) ? opt.ankerZ : 0;
  var seed = (opt.seed | 0);
  var maxN = Number.isFinite(opt.maxN) ? opt.maxN : 4000;
  var innen = typeof opt.imInneren === 'function' ? opt.imInneren : null;
  var jit = Number.isFinite(opt.jitter) ? opt.jitter : 0.34;

  var c0 = Math.floor((opt.x0 - ax) / sp), c1 = Math.ceil((opt.x1 - ax) / sp);
  var d0 = Math.floor((opt.z0 - az) / sp), d1 = Math.ceil((opt.z1 - az) / sp);
  var aus = [];
  for (var cz = d0; cz <= d1 && aus.length < maxN; cz++) {
    for (var cx = c0; cx <= c1 && aus.length < maxN; cx++) {
      var r1 = hashi(cx, cz, seed), r2 = hashi(cx, cz, seed + 1);
      var x = ax + (cx + 0.5 + (r1 - 0.5) * 2 * jit) * sp;
      var zz = az + (cz + 0.5 + (r2 - 0.5) * 2 * jit) * sp;
      if (innen && !innen(x, zz)) continue;
      aus.push({
        cx: cx, cz: cz, x: x, z: zz,
        dreh: (hashi(cx, cz, seed + 2) - 0.5) * 0.5,       // ±0,25 rad
        skala: 0.86 + hashi(cx, cz, seed + 3) * 0.28
      });
    }
  }
  return aus;
}


/* ==========================================================================
   6 — Farbe: Tinte aus der Biompalette

   Die Atlasfelder tragen keine Farbe. Der Instanz-Tint traegt sie, und er
   kommt aus der Palette des Bioms — so liegt eine Waldsignatur im
   Nadelwaldbiom in dessen Gruen und im Herbstbiom in dessen Ocker, ohne dass
   es zwei Felder braucht.

   Zwei Toene stehen bewusst AUSSERHALB der Palette:
   `tinte`, weil ein Ortsring Tinte ist und kein Gegenstand im Licht — er darf
   nicht mit dem Untergrund mitwandern, sonst verliert die Karte ihren Halt;
   und `arbor`, weil der Riesenbaum die eine Farbe der Welt ist, die keinem
   Biom gehoert.
   ========================================================================== */

var TINTE = [0.24, 0.20, 0.17];          // warmes Sepia-Schwarz

/* Arbors Weiss (uArborFarbe = 0xdfe8f0) mal 1,4. Der Faktor ist kein
   Geschmack, sondern gerechnet: das Kartenmaterial ist unbeleuchtet, sein
   Bild ist also genau `Tint × Atlasdeckung`. Die Bloom-Schwelle der Pipeline
   liegt bei 0.9 (UnrealBloomPass in render/pipeline.js). Mit Tint 0.87 laege
   die Signatur bei 0.82 und blieb stumpf; mit 1.22 liegt sie bei 1.15 und
   traegt den Bluetesaum, den der Katalog fuer die fuenf Arborzeichen
   verlangt — ohne emissive, das ein unbeleuchtetes Material gar nicht kennt.
   Auf einer Kontinentkarte ist das der einzige Ort im Bild, an dem es
   leuchtet, und genau deshalb liest man die Karte von den Ranken her. */
var ARBOR_FARBE = [1.22, 1.30, 1.36];

/* Woher ein Ton seine Palettenfarbe zieht und wie stark er sie abdunkelt.
   Abgedunkelt wird, weil die Palette Flaechenfarben beschreibt: eine Marke in
   exakt der Flaechenfarbe waere unsichtbar.

   I6 — die Faktoren der LANDtoene sind um rund ein Sechstel gefallen (0.62 →
   0.52 usw.). Der Grund haengt mit der Beruhigung in world/terrain.js
   zusammen: solange die Flaeche unter der Marke selbst gesprenkelt war,
   verschwand ein Zeichen mit 62 % der Grundfarbe im Rauschen, und mehr
   Kontrast haette es nur lauter, nicht lesbarer gemacht. Auf einer
   beruhigten Flaeche ist der Kontrast des Zeichens gegen sie das EINZIGE,
   was es sichtbar macht. Die Wassertoene bleiben unveraendert: sie hellen
   auf (Faktor > 1), weil `tiefe` der dunkelste Wert der Palette ist. */
var TON_QUELLE = {
  bewuchs: { feld: 'grasKuehl',    faktor: 0.52 },
  kultur:  { feld: 'grasTrocken',  faktor: 0.56 },
  nass:    { feld: 'tiefe',        faktor: 1.15 },
  trocken: { feld: 'sand',         faktor: 0.53 },
  kalt:    { feld: 'schnee',       faktor: 0.58 },
  stein:   { feld: 'fels',         faktor: 0.50 },
  wasser:  { feld: 'tiefe',        faktor: 1.25 },
  grenze:  { feld: 'erde',         faktor: 0.60 }
};

/** Instanz-Tint eines Zeichens. Rueckgabe [r, g, b] als Multiplikatoren. */
function signaturTint(name, biomName) {
  var Z = ZEICHEN[name];
  var ton = Z ? Z.ton : 'tinte';
  if (ton === 'tinte') return [TINTE[0], TINTE[1], TINTE[2]];
  if (ton === 'arbor') return [ARBOR_FARBE[0], ARBOR_FARBE[1], ARBOR_FARBE[2]];
  var Q = TON_QUELLE[ton];
  var B = BIOME[biomName] || BIOME.wiese;
  var c = Q && B && B.terrain ? B.terrain[Q.feld] : null;
  if (!c) return [TINTE[0], TINTE[1], TINTE[2]];
  var f = Q.faktor;
  return [clamp(c.r * f, 0, 1), clamp(c.g * f, 0, 1), clamp(c.b * f, 0, 1)];
}


/* ==========================================================================
   7 — Der Zeichenatlas

   8 × 8 Felder à 128 px, also 1024² — eine Textur, ein Materialwechsel, ein
   Zeichenaufruf je Pool.

   Die Belegung ist nicht „der Reihe nach", sondern GRUPPENWEISE ab
   Zeilenanfang. Das kostet 15 leere Felder und macht das Blatt lesbar: wer es
   im Browser aufmacht, sieht Orte in Zeile 0–1, Flaechen in 2–3, Relief in 4,
   Linien in 5, Arbor in 6. Zeile 7 bleibt Reserve. Ein Atlas, den man nicht
   ansehen kann, wird nicht gepflegt.

   Randabstand: die Textur bekommt Mipmaps (ein Zeichen wird auf 9 px
   gezeichnet, ohne Mipmaps flimmerte es). Auf Mipstufe 4 ist ein Feld noch
   8 Texel breit — der Inhalt liegt deshalb im inneren ATLAS_INHALT, und die
   UV werden zusaetzlich um ein Texel eingezogen. Ohne beides blutete das
   Nachbarfeld herein, und zwar genau bei den kleinen Groessen, auf die es
   ankommt.
   ========================================================================== */

var ATLAS_RASTER = 8;                                  // Felder je Achse
var ATLAS_KACHEL = 128;                                // Pixel je Feld
var ATLAS_KANTE = ATLAS_RASTER * ATLAS_KACHEL;         // 1024
var ATLAS_SAUM_TEXEL = 1;

/* Erste Zeile je Gruppe. Zwei Zeilen fuer die Gruppen mit mehr als acht
   Zeichen, eine fuer die uebrigen. */
var GRUPPEN_ZEILE = { bauwerk: 0, flaeche: 2, relief: 4, linie: 5, arbor: 6 };

var ATLAS_FELDER = (function belegeAtlas() {
  var felder = {}, zaehler = {};
  for (var g = 0; g < GRUPPEN.length; g++) zaehler[GRUPPEN[g]] = 0;
  for (var i = 0; i < ZEICHEN_NAMEN.length; i++) {
    var name = ZEICHEN_NAMEN[i], Z = ZEICHEN[name];
    var lauf = zaehler[Z.gruppe]++;
    var zeile = GRUPPEN_ZEILE[Z.gruppe] + Math.floor(lauf / ATLAS_RASTER);
    var spalte = lauf % ATLAS_RASTER;
    var s = 1 / ATLAS_RASTER, e = ATLAS_SAUM_TEXEL / ATLAS_KANTE;
    var fx = spalte * s, fy = zeile * s;
    var r = (1 - ATLAS_INHALT) * 0.5 * s;          // Rand des Feldes in UV
    felder[name] = {
      name: name, spalte: spalte, zeile: zeile,
      index: zeile * ATLAS_RASTER + spalte,
      // v gedreht: CanvasTexture kommt mit flipY, die oberste Canvaszeile
      // liegt also bei v = 1.
      u0: fx + e, u1: fx + s - e,
      v0: 1 - fy - s + e, v1: 1 - fy - e,
      /* Kachelbereich der Streifenzeichen: GENAU der Inhaltskasten, ohne
         Texelsaum. Ein Wegband wiederholt diesen Ausschnitt entlang des
         Pfades; nimmt man stattdessen das ganze Feld, klafft an jeder
         Kachelgrenze der leere Rand — bei 12 % je Seite ein Viertel der
         Strecke. Die Streifenmaler zeichnen dafuer ueber den Inhaltskasten
         HINAUS (STREIFEN_UEBER), damit die Kante glatt abgeschnitten wird
         statt mit einer Kappe zu enden. */
      su0: fx + r, su1: fx + s - r,
      sv0: 1 - fy - s + r, sv1: 1 - fy - r
    };
  }
  return felder;
})();

/** Atlasfeld eines Zeichens (oder null). */
function atlasFeld(name) {
  return ATLAS_FELDER.hasOwnProperty(name) ? ATLAS_FELDER[name] : null;
}
/** UV-Rechteck eines Zeichens: [u0, v0, u1, v1]. */
function atlasUV(name) {
  var f = atlasFeld(name);
  return f ? [f.u0, f.v0, f.u1, f.v1] : null;
}
/** UV-Rechteck fuer die KACHELUNG eines Streifenzeichens entlang eines
 *  Pfades: [u0, v0, u1, v1] des Inhaltskastens. Das ist der Ausschnitt, den
 *  eine Liniensignatur wiederholt — nicht der von `atlasUV`. */
function atlasStreifenUV(name) {
  var f = atlasFeld(name);
  return f ? [f.su0, f.sv0, f.su1, f.sv1] : null;
}


/* --------------------------------------------------------------------------
   Der Zeichenvorrat: Tinte auf Papier

   Alles in einem 0..1-Quadrat, alles in Weiss mit Alpha. Der Kontext ist
   immer ein Parameter.

   Das Zittern (`zitter`) ist der Unterschied zwischen „gezeichnet" und
   „gerendert": jede Linie bekommt in der Mitte eine winzige Auslenkung quer
   zu ihrer Richtung, die Endpunkte bleiben exakt. Es kommt aus hashi, ist
   also bei jedem Start dasselbe. Ohne das sieht ein Kartenblatt aus wie ein
   Schaltplan; mit zu viel davon wie ein Zittern der Hand, und das ist bei
   12 px Bildgroesse nur noch Unschaerfe.
   -------------------------------------------------------------------------- */

var DECK_VOLL = 0.94;      // Hauptstrich
var DECK_HALB = 0.48;      // Schattenseite, Binnenzeichnung
/* I6 — der Flaechenton war 0.16 und ist 0.26.
   Grund ist nicht Geschmack, sondern die Mip-Kette. Ein Atlasfeld ist 128 px
   gross und steht im Bild bei 9 bis 14 px; gezeichnet wird also aus einer
   Mipstufe, in der der 0.060 breite Strich (7,7 px im Feld) auf unter einen
   halben Pixel geschrumpft ist. Sein Alpha mittelt sich dabei mit dem leeren
   Umfeld auf ein Zehntel herunter — von der Binnenzeichnung eines
   Flaechenzeichens kommt bei Kartengroesse fast nichts mehr an.
   Was ankommt, ist der TON: eine Flaeche, die keine feine Struktur hat und
   deshalb auch keine verliert. Genau so ist eine Karte auch gestochen — das
   Waldsignet ist die Zugabe, der Flaechenton ist die Aussage. Mit 0.26 liest
   ein Waldstueck als Waldstueck, ohne dass die Marke zum Klecks wird
   (getestet gegen den Ortsmassstab: dort steht dieselbe Marke bei 40 px und
   bleibt eine Zeichnung mit hellem Grund). */
var DECK_TON = 0.26;       // Flaechenton unter der Randmarke
var ZITTER = 0.010;

function zitter(seed, i) { return (hashi(i, seed, 0x51ce) - 0.5) * 2 * ZITTER; }

function stift(ctx, breite, deckung) {
  ctx.strokeStyle = 'rgba(255,255,255,' + (deckung === undefined ? DECK_VOLL : deckung) + ')';
  ctx.lineWidth = breite;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}
function pinsel(ctx, deckung) {
  ctx.fillStyle = 'rgba(255,255,255,' + (deckung === undefined ? DECK_VOLL : deckung) + ')';
}

/** Handgezogener Streckenzug ueber eine Punktliste [[x,y], ...]. */
function zug(ctx, pts, seed, schliessen) {
  if (!pts || pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  var n = 0, i, k;
  var liste = schliessen ? pts.concat([pts[0]]) : pts;
  for (i = 1; i < liste.length; i++) {
    var ax = liste[i - 1][0], ay = liste[i - 1][1];
    var bx = liste[i][0], by = liste[i][1];
    var dx = bx - ax, dy = by - ay;
    var l = Math.sqrt(dx * dx + dy * dy) || 1;
    var px = -dy / l, py = dx / l;
    for (k = 1; k <= 3; k++) {
      var t = k / 3, w = (k === 3) ? 0 : zitter(seed, ++n);
      ctx.lineTo(ax + dx * t + px * w, ay + dy * t + py * w);
    }
  }
  ctx.stroke();
}

/** Kreisbogen als Streckenzug — mit Zittern, und ohne ctx.arc, damit die
 *  Kontur dieselbe Handschrift traegt wie die geraden Zuege. */
function bogenPunkte(cx, cy, r, a0, a1, seed, schritte) {
  var n = schritte || 14, pts = [];
  for (var i = 0; i <= n; i++) {
    var t = i / n, a = lerp(a0, a1, t);
    var rr = r * (1 + zitter(seed, i + 71) * 0.9);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
}
function bogen(ctx, cx, cy, r, a0, a1, seed, schritte) {
  zug(ctx, bogenPunkte(cx, cy, r, a0, a1, seed, schritte), seed);
}
function ring(ctx, cx, cy, r, seed) { bogen(ctx, cx, cy, r, 0, TAU, seed, 20); }

/** Gefuellter Punkt — der eine Ort, an dem ctx.arc gebraucht wird. */
function punkt(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
}

/** Weicher Flaechenton: drei ineinanderliegende Scheiben statt eines
 *  Verlaufs (der Testkontext kennt keine Verlaeufe, und drei Stufen reichen
 *  bei einer Marke, die im Bild 12 px misst, vollkommen). */
function ton(ctx, cx, cy, r, deckung) {
  var d = (deckung === undefined ? DECK_TON : deckung);
  for (var i = 3; i >= 1; i--) {
    pinsel(ctx, d * (i === 3 ? 0.45 : (i === 2 ? 0.7 : 1)));
    punkt(ctx, cx, cy, r * (i / 3));
  }
}

/** Strichlinie zwischen zwei Punkten: `n` Striche mit Luecken. */
function strichlinie(ctx, x0, y0, x1, y1, n, fuellung, seed) {
  var f = fuellung === undefined ? 0.55 : fuellung;
  for (var i = 0; i < n; i++) {
    var a = i / n, b = a + f / n;
    zug(ctx, [[lerp(x0, x1, a), lerp(y0, y1, a)],
      [lerp(x0, x1, b), lerp(y0, y1, b)]], seed + i);
  }
}


/* --------------------------------------------------------------------------
   Die 49 Zeichen

   Jedes ist so knapp gehalten, wie es geht: eine Waldsignatur aus zwei
   sauberen Kreisboegen liest bei 12 px, eine mit zwanzig Details wird Matsch.
   Wo der Katalog eine Zeichnung beschreibt, steht sie hier so und nicht
   anders; abgewichen ist nur, wo das Beschriebene bei kleiner Groesse
   zerfiel — das ist jeweils an Ort und Stelle vermerkt.
   -------------------------------------------------------------------------- */

var MALER = {};

/* --- Orte und Bauwerk --------------------------------------------------- */

MALER.sig_weiler = function (ctx, s) {
  // Offener Ring: die Luecke ist die Aussage — ein Weiler hat keinen Kern.
  stift(ctx, 0.075);
  bogen(ctx, 0.5, 0.5, 0.30, 0.55, TAU - 0.15, s, 18);
};
MALER.sig_dorf = function (ctx, s) {
  stift(ctx, 0.075);
  ring(ctx, 0.5, 0.5, 0.30, s);
  pinsel(ctx, DECK_VOLL);
  punkt(ctx, 0.5, 0.5, 0.085);
};
MALER.sig_stadt = function (ctx, s) {
  // Radien 0,44 und 0,24 mit duennerem Strich: bei 0,38/0,25 liefen die
  // beiden Ringe unterhalb von etwa 20 Bildpunkten zu einem breiten
  // Reifen zusammen, und dann ist eine Stadt von einem Dorf nicht mehr zu
  // unterscheiden. Der Zwischenraum ist das Zeichen, nicht die Ringe.
  stift(ctx, 0.060);
  ring(ctx, 0.5, 0.5, 0.44, s);
  ring(ctx, 0.5, 0.5, 0.24, s + 1);
  pinsel(ctx, DECK_VOLL);
  punkt(ctx, 0.5, 0.5, 0.080);
};
MALER.sig_stadtmauer = function (ctx, s) {
  // Zackenkranz OHNE den Doppelring darunter: er wird als zweite Instanz
  // ueber die Stadtsignatur gelegt. Beides in ein Feld zu malen hiesse, den
  // Ring zweimal im Atlas zu haben — und der Kranz koennte nicht fuer sich
  // ausblenden, was sein ganzer Zweck ist.
  var n = 14, pts = [];
  for (var i = 0; i < n; i++) {
    var a = i / n * TAU;
    var r = (i % 2 === 0) ? 0.46 : 0.36;
    pts.push([0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r]);
  }
  stift(ctx, 0.050);
  zug(ctx, pts, s, true);
};
MALER.sig_hauptstadt = function (ctx, s) {
  stift(ctx, 0.070);
  ring(ctx, 0.5, 0.5, 0.42, s);
  ring(ctx, 0.5, 0.5, 0.29, s + 1);
  // Fuenfstrahliger Stern statt eines gefuellten Sterns: ausgefuellt wuerde er
  // bei kleiner Groesse zum selben Fleck wie der Dorfpunkt.
  stift(ctx, 0.055);
  for (var i = 0; i < 5; i++) {
    var a = -Math.PI / 2 + i / 5 * TAU;
    zug(ctx, [[0.5, 0.5], [0.5 + Math.cos(a) * 0.21, 0.5 + Math.sin(a) * 0.21]], s + i);
  }
};
MALER.sig_burg = function (ctx, s) {
  stift(ctx, 0.058);
  var x0 = 0.20, x1 = 0.80, y0 = 0.42, y1 = 0.76;
  zug(ctx, [[x0, y1], [x0, y0], [x1, y0], [x1, y1]], s);
  zug(ctx, [[x0, y1], [x1, y1]], s + 1);
  /* DREI Zinnen, 0,16 hoch. Vier flachere (0,10) verschmolzen unterhalb von
     etwa 25 Bildpunkten mit der Mauerkrone zu einem Balken — und ein Balken
     ist kein Wehrbau, sondern ein Rechteck. Weniger und hoehere Zinnen
     ueberleben die Verkleinerung; das ist dieselbe Rechnung, die auch die
     Doppelringe der Stadt auseinandergezogen hat. */
  for (var i = 0; i < 3; i++) {
    var xa = lerp(x0, x1, i / 3 + 0.05), xb = lerp(x0, x1, (i + 1) / 3 - 0.05);
    zug(ctx, [[xa, y0], [xa, y0 - 0.16], [xb, y0 - 0.16], [xb, y0]], s + 10 + i);
  }
};
MALER.sig_kloster = function (ctx, s) {
  stift(ctx, 0.060);
  zug(ctx, [[0.26, 0.26], [0.74, 0.26], [0.74, 0.74], [0.26, 0.74]], s, true);
  zug(ctx, [[0.5, 0.34], [0.5, 0.66]], s + 1);
  zug(ctx, [[0.37, 0.46], [0.63, 0.46]], s + 2);
};
MALER.sig_turm = function (ctx, s) {
  stift(ctx, 0.060);
  zug(ctx, [[0.42, 0.78], [0.42, 0.24]], s);
  // Faehnchen als Dreieck, gefuellt: ein umrissenes waere bei 8 px ein Klecks
  pinsel(ctx, DECK_VOLL);
  ctx.beginPath();
  ctx.moveTo(0.44, 0.24); ctx.lineTo(0.74, 0.32); ctx.lineTo(0.44, 0.40);
  ctx.closePath(); ctx.fill();
  punkt(ctx, 0.42, 0.80, 0.075);
};
MALER.sig_ruine = function (ctx, s) {
  // Halber Zinnenriss: die Kontur bricht ab, statt sich zu schliessen. Genau
  // dieser Abbruch ist das Zeichen — eine gestrichelte Burg lase sich als
  // „geplant", nicht als „zerfallen".
  stift(ctx, 0.062);
  zug(ctx, [[0.22, 0.76], [0.22, 0.36], [0.34, 0.36], [0.34, 0.28], [0.46, 0.28],
    [0.46, 0.44], [0.56, 0.52]], s);
  zug(ctx, [[0.66, 0.76], [0.68, 0.50], [0.78, 0.44]], s + 1);
  zug(ctx, [[0.20, 0.78], [0.80, 0.78]], s + 2);
};
MALER.sig_hafen = function (ctx, s) {
  stift(ctx, 0.062);
  zug(ctx, [[0.5, 0.22], [0.5, 0.68]], s);            // Schaft
  zug(ctx, [[0.30, 0.34], [0.70, 0.34]], s + 1);      // Querbalken
  bogen(ctx, 0.5, 0.56, 0.24, 0.15 * Math.PI, 0.85 * Math.PI, s + 2, 10);  // Fluke
  punkt(ctx, 0.5, 0.20, 0.055);
};
MALER.sig_bruecke = function (ctx, s) {
  stift(ctx, 0.070);
  zug(ctx, [[0.30, 0.34], [0.70, 0.34]], s);
  zug(ctx, [[0.30, 0.66], [0.70, 0.66]], s + 1);
};
MALER.sig_furt = function (ctx, s) {
  stift(ctx, 0.055);
  zug(ctx, [[0.32, 0.30], [0.68, 0.30]], s);
  zug(ctx, [[0.26, 0.50], [0.62, 0.50]], s + 1);
  zug(ctx, [[0.32, 0.70], [0.68, 0.70]], s + 2);
};
MALER.sig_mine = function (ctx, s) {
  stift(ctx, 0.060);
  zug(ctx, [[0.24, 0.74], [0.72, 0.28]], s);
  zug(ctx, [[0.28, 0.28], [0.76, 0.74]], s + 1);
  pinsel(ctx, DECK_VOLL);
  punkt(ctx, 0.74, 0.26, 0.075);      // Schlaegelkopf
  punkt(ctx, 0.26, 0.26, 0.055);      // Eisenspitze
};
MALER.sig_muehle = function (ctx, s) {
  stift(ctx, 0.055);
  for (var i = 0; i < 4; i++) {
    var a = Math.PI / 4 + i * Math.PI / 2;
    zug(ctx, [[0.5, 0.5], [0.5 + Math.cos(a) * 0.34, 0.5 + Math.sin(a) * 0.34]], s + i);
  }
  pinsel(ctx, DECK_VOLL);
  punkt(ctx, 0.5, 0.5, 0.06);
};

/* --- Flaechen und Bewuchs ----------------------------------------------- */

MALER.sig_laubwald = function (ctx, s) {
  ton(ctx, 0.5, 0.5, 0.46);
  stift(ctx, 0.060);
  // Zwei gerundete Kronenboegen, verschieden gross — gleich grosse laesen
  // sich als Brille.
  bogen(ctx, 0.36, 0.58, 0.20, Math.PI, TAU, s, 12);
  bogen(ctx, 0.66, 0.52, 0.15, Math.PI, TAU, s + 1, 10);
  zug(ctx, [[0.36, 0.58], [0.36, 0.72]], s + 2);
  zug(ctx, [[0.66, 0.52], [0.66, 0.66]], s + 3);
};
MALER.sig_nadelwald = function (ctx, s) {
  ton(ctx, 0.5, 0.5, 0.46);
  stift(ctx, 0.060);
  zug(ctx, [[0.22, 0.70], [0.38, 0.30], [0.54, 0.70]], s);
  zug(ctx, [[0.50, 0.72], [0.64, 0.40], [0.78, 0.72]], s + 1);
};
MALER.sig_mischwald = function (ctx, s) {
  ton(ctx, 0.5, 0.5, 0.46);
  stift(ctx, 0.060);
  bogen(ctx, 0.34, 0.58, 0.19, Math.PI, TAU, s, 12);
  zug(ctx, [[0.34, 0.58], [0.34, 0.72]], s + 1);
  zug(ctx, [[0.52, 0.72], [0.68, 0.34], [0.84, 0.72]], s + 2);
};
MALER.sig_hain = function (ctx, s) {
  ton(ctx, 0.5, 0.54, 0.34);
  stift(ctx, 0.065);
  bogen(ctx, 0.5, 0.56, 0.22, Math.PI, TAU, s, 14);
  zug(ctx, [[0.5, 0.56], [0.5, 0.74]], s + 1);
};
MALER.sig_acker = function (ctx, s) {
  ton(ctx, 0.5, 0.5, 0.44, DECK_TON * 0.8);
  stift(ctx, 0.048);
  // Karo aus vier Strichen: die Diagonale ist das Ackerzeichen, das
  // achsenparallele Gitter waere ein Stadtplan.
  zug(ctx, [[0.5, 0.18], [0.82, 0.5]], s);
  zug(ctx, [[0.82, 0.5], [0.5, 0.82]], s + 1);
  zug(ctx, [[0.5, 0.82], [0.18, 0.5]], s + 2);
  zug(ctx, [[0.18, 0.5], [0.5, 0.18]], s + 3);
};
MALER.sig_weide = function (ctx, s) {
  ton(ctx, 0.5, 0.56, 0.42, DECK_TON * 0.8);
  stift(ctx, 0.050);
  for (var i = 0; i < 3; i++) {
    var x = 0.26 + i * 0.24, y = 0.72 - (i === 1 ? 0.06 : 0);
    zug(ctx, [[x - 0.09, y], [x, y - 0.24]], s + i * 3);
    zug(ctx, [[x + 0.09, y], [x, y - 0.24]], s + i * 3 + 1);
  }
};
MALER.sig_sumpf = function (ctx, s) {
  ton(ctx, 0.5, 0.5, 0.44, DECK_TON * 0.9);
  stift(ctx, 0.055);
  zug(ctx, [[0.20, 0.34], [0.62, 0.34]], s);
  zug(ctx, [[0.34, 0.52], [0.80, 0.52]], s + 1);
  zug(ctx, [[0.20, 0.70], [0.62, 0.70]], s + 2);
};
MALER.sig_moor = function (ctx, s) {
  ton(ctx, 0.5, 0.5, 0.44, DECK_TON * 1.3);
  stift(ctx, 0.055);
  zug(ctx, [[0.20, 0.36], [0.58, 0.36]], s);
  zug(ctx, [[0.36, 0.66], [0.78, 0.66]], s + 1);
  pinsel(ctx, DECK_VOLL);
  punkt(ctx, 0.72, 0.34, 0.055);
  punkt(ctx, 0.26, 0.64, 0.045);
};
MALER.sig_wueste = function (ctx, s) {
  ton(ctx, 0.5, 0.5, 0.46, DECK_TON * 0.7);
  stift(ctx, 0.052);
  // Drei Duenenboegen, jeder mit einem laengeren Luvschenkel: eine Duene ist
  // asymmetrisch, und diese Asymmetrie ist alles, was sie von einer Welle
  // unterscheidet.
  for (var i = 0; i < 3; i++) {
    var y = 0.32 + i * 0.19, x = 0.24 + (i % 2) * 0.12;
    bogen(ctx, x + 0.16, y + 0.10, 0.17, Math.PI + 0.35, TAU - 0.05, s + i, 10);
  }
};
MALER.sig_salzpfanne = function (ctx, s) {
  ton(ctx, 0.5, 0.5, 0.46, DECK_TON * 0.6);
  stift(ctx, 0.040);
  // Bruchmuster: ein Sternpunkt mit fuenf Rissen und zwei Querverbindungen —
  // ein vollstaendiges Polygonnetz wuerde bei 12 px zur grauen Flaeche.
  var k = [];
  for (var i = 0; i < 5; i++) {
    var a = i / 5 * TAU + 0.4;
    k.push([0.5 + Math.cos(a) * 0.42, 0.5 + Math.sin(a) * 0.42]);
    zug(ctx, [[0.5, 0.5], k[i]], s + i);
  }
  zug(ctx, [k[0], k[2]], s + 11);
  zug(ctx, [k[1], k[3]], s + 12);
};
MALER.sig_tundra = function (ctx, s) {
  ton(ctx, 0.5, 0.5, 0.46, DECK_TON * 0.7);
  pinsel(ctx, DECK_VOLL * 0.85);
  for (var i = 0; i < 9; i++) {
    var x = 0.20 + (i % 3) * 0.30 + (hashi(i, 1, s) - 0.5) * 0.10;
    var y = 0.24 + Math.floor(i / 3) * 0.26 + (hashi(i, 2, s) - 0.5) * 0.10;
    punkt(ctx, x, y, 0.034 + hashi(i, 3, s) * 0.016);
  }
};
MALER.sig_eis = function (ctx, s) {
  stift(ctx, 0.045);
  // Kristallhaeckchen: drei Achsen mit je zwei Aestchen — das ist der
  // Schneestern, reduziert auf das, was bei 12 px uebrigbleibt.
  for (var i = 0; i < 3; i++) {
    var a = i / 3 * Math.PI, dx = Math.cos(a) * 0.34, dy = Math.sin(a) * 0.34;
    zug(ctx, [[0.5 - dx, 0.5 - dy], [0.5 + dx, 0.5 + dy]], s + i);
    var ax = 0.5 + dx * 0.6, ay = 0.5 + dy * 0.6;
    zug(ctx, [[ax, ay], [ax - dy * 0.24 - dx * 0.10, ay + dx * 0.24 - dy * 0.10]], s + i + 5);
    zug(ctx, [[ax, ay], [ax + dy * 0.24 - dx * 0.10, ay - dx * 0.24 - dy * 0.10]], s + i + 9);
  }
};
MALER.sig_karst = function (ctx, s) {
  stift(ctx, 0.045);
  // Kalkschraffur: kurze Parallelen in zwei versetzten Reihen.
  for (var i = 0; i < 4; i++) {
    var x = 0.24 + i * 0.17;
    zug(ctx, [[x, 0.28], [x - 0.05, 0.46]], s + i);
    zug(ctx, [[x + 0.06, 0.54], [x + 0.01, 0.72]], s + i + 7);
  }
};
MALER.sig_weinberg = function (ctx, s) {
  stift(ctx, 0.045);
  for (var i = 0; i < 4; i++) {
    var x = 0.22 + i * 0.19;
    zug(ctx, [[x, 0.72], [x + 0.14, 0.30]], s + i);
  }
};
MALER.sig_obstgarten = function (ctx, s) {
  pinsel(ctx, DECK_VOLL * 0.9);
  // Punktraster, bewusst REGELMAESSIG (im Gegensatz zur Tundra): eine
  // Pflanzung ist gesetzt, keine Streuung. Der Unterschied traegt die
  // Unterscheidung der beiden Zeichen ganz allein.
  for (var i = 0; i < 9; i++) {
    punkt(ctx, 0.24 + (i % 3) * 0.26, 0.24 + Math.floor(i / 3) * 0.26, 0.042);
  }
};

/* --- Relief -------------------------------------------------------------- */

MALER.sig_grat = function (ctx, s) {
  // Dem Grat folgen, nicht die Flaeche fuellen: eine Kammlinie und Haeckchen
  // NUR auf der Schattenseite. Beidseitig waere es eine Raupe.
  var kamm = [[0.10, 0.62], [0.30, 0.40], [0.50, 0.52], [0.70, 0.32], [0.90, 0.48]];
  stift(ctx, 0.058);
  zug(ctx, kamm, s);
  stift(ctx, 0.036, DECK_HALB);
  for (var i = 0; i < kamm.length - 1; i++) {
    for (var k = 1; k <= 2; k++) {
      var t = k / 3;
      var x = lerp(kamm[i][0], kamm[i + 1][0], t);
      var y = lerp(kamm[i][1], kamm[i + 1][1], t);
      zug(ctx, [[x, y], [x + 0.02, y + 0.15]], s + i * 4 + k);
    }
  }
};
MALER.sig_gipfel = function (ctx, s) {
  stift(ctx, 0.060);
  zug(ctx, [[0.18, 0.76], [0.5, 0.22], [0.82, 0.76]], s);
  // Schattenflanke rechts, halb gedeckt — das ist die einzige Stelle, an der
  // eine Graustufe im Atlas Information traegt und nicht Zierat ist.
  pinsel(ctx, DECK_HALB);
  ctx.beginPath();
  ctx.moveTo(0.5, 0.24); ctx.lineTo(0.80, 0.74); ctx.lineTo(0.5, 0.74);
  ctx.closePath(); ctx.fill();
};
MALER.sig_vulkan = function (ctx, s) {
  stift(ctx, 0.060);
  zug(ctx, [[0.16, 0.76], [0.38, 0.30], [0.62, 0.30], [0.84, 0.76]], s);
  zug(ctx, [[0.38, 0.30], [0.62, 0.30]], s + 1);
  pinsel(ctx, DECK_HALB);
  ctx.beginPath();
  ctx.moveTo(0.5, 0.30); ctx.lineTo(0.82, 0.74); ctx.lineTo(0.5, 0.74);
  ctx.closePath(); ctx.fill();
};
MALER.sig_klippe = function (ctx, s) {
  stift(ctx, 0.052);
  zug(ctx, [[0.10, 0.42], [0.90, 0.42]], s);
  for (var i = 0; i < 5; i++) {
    var x = 0.16 + i * 0.17;
    zug(ctx, [[x, 0.42], [x + 0.05, 0.70]], s + i + 3);
  }
};
MALER.sig_schlucht = function (ctx, s) {
  stift(ctx, 0.046);
  zug(ctx, [[0.10, 0.34], [0.90, 0.34]], s);
  zug(ctx, [[0.10, 0.66], [0.90, 0.66]], s + 1);
  for (var i = 0; i < 5; i++) {
    var x = 0.16 + i * 0.17;
    zug(ctx, [[x, 0.34], [x + 0.04, 0.50]], s + i + 3);
    zug(ctx, [[x + 0.08, 0.66], [x + 0.04, 0.50]], s + i + 9);
  }
};
MALER.sig_pass = function (ctx, s) {
  // Zwei Boegen mit Luecke: der Pass IST die Luecke. Sie muss deshalb breiter
  // sein als der Strich, sonst schliesst sie sich beim Verkleinern.
  stift(ctx, 0.058);
  bogen(ctx, 0.24, 0.66, 0.24, Math.PI + 0.15, TAU - 0.55, s, 10);
  bogen(ctx, 0.76, 0.66, 0.24, Math.PI + 0.55, TAU - 0.15, s + 1, 10);
};
MALER.sig_huegelland = function (ctx, s) {
  stift(ctx, 0.052);
  for (var i = 0; i < 3; i++) {
    bogen(ctx, 0.22 + i * 0.28, 0.62 + (i % 2) * 0.06, 0.16,
      Math.PI + 0.15, TAU - 0.15, s + i, 10);
  }
};
MALER.sig_krater = function (ctx, s) {
  stift(ctx, 0.058);
  ring(ctx, 0.5, 0.5, 0.34, s);
  stift(ctx, 0.036, DECK_HALB);
  bogen(ctx, 0.5, 0.5, 0.26, -0.35 * Math.PI, 0.45 * Math.PI, s + 1, 12);
};

/* --- Linien: kachelbare Streifen ----------------------------------------
   Anders als alle anderen Felder werden diese ENTLANG eines Pfades
   wiederholt (Kachelbereich: `atlasStreifenUV`, also der Inhaltskasten).
   Daraus folgen zwei Regeln, die keine der uebrigen 42 Zeichnungen braucht:

   1. Der Inhalt muss an u = 0 und u = 1 auf derselben Hoehe ansetzen, sonst
      knickt das Band an jeder Kachelgrenze. Deshalb laufen alle waagerecht,
      und die Flusswelle ist GENAU eine Periode lang.
   2. Durchgezogene Linien muessen ueber den Inhaltskasten hinauslaufen und
      dort glatt abgeschnitten werden. Endeten sie am Kasten, saehe man an
      jeder Kachelgrenze die runde Strichkappe als Perlenkette. Deshalb der
      Ueberstand und die stumpfe Kappe (`streifenStift`).

   Gestrichelte Zeichen brauchen den Ueberstand nicht: bei ihnen faellt die
   Kachelgrenze in eine Luecke, wenn das Strichmuster im Kasten aufgeht.
   ------------------------------------------------------------------------- */

var STREIFEN_UEBER = 0.10;      // Ueberstand in Feldbreiten, kleiner als der Rand

/** Stift fuer durchgezogene Streifen: stumpfe Kappe statt runder. */
function streifenStift(ctx, breite, deckung) {
  stift(ctx, breite, deckung);
  ctx.lineCap = 'butt';
}
/** Waagerechter Strich ueber die volle Kachel samt Ueberstand. */
function streifenStrich(ctx, y, seed) {
  zug(ctx, [[-STREIFEN_UEBER, y], [1 + STREIFEN_UEBER, y]], seed);
}

/* Strichstaerken der vier Linienzeichen, angehoben nach der Sichtpruefung.
   Gemessen lagen sie bei rund 1,3 Bildpunkten, wenn die Karte voll im Bild
   steht — der Landweg war praktisch unsichtbar. Angehoben wurde die TINTE,
   nicht das Band: `anteil` meint laut Katalog die Bandbreite, und ein
   breiteres Band liefe ueber Ufer und Haeuser hinaus. */
MALER.sig_handelsstrasse = function (ctx, s) {
  streifenStift(ctx, 0.44);
  streifenStrich(ctx, 0.5, s);
};
MALER.sig_landweg = function (ctx, s) {
  streifenStift(ctx, 0.28);
  streifenStrich(ctx, 0.5, s);
};
MALER.sig_saumpfad = function (ctx, s) {
  // Strichlinie: fuenf Striche je Kachel, der erste beginnt exakt am
  // Kachelanfang — dadurch geht das Muster ueber die Grenze hinweg auf.
  streifenStift(ctx, 0.22);
  strichlinie(ctx, 0, 0.5, 1, 0.5, 5, 0.55, s);
};
MALER.sig_fluss = function (ctx, s) {
  // Genau eine Sinusperiode ueber die Kachel: an beiden Kachelraendern liegt
  // die Linie auf 0.5 und hat dieselbe Steigung, das Band knickt also nicht.
  streifenStift(ctx, 0.20);
  var pts = [];
  for (var i = 0; i <= 12; i++) {
    var u = -STREIFEN_UEBER + (1 + 2 * STREIFEN_UEBER) * i / 12;
    pts.push([u, 0.5 + Math.sin(u * TAU) * 0.10]);
  }
  zug(ctx, pts, s);
};
MALER.sig_kueste = function (ctx, s) {
  // Linie mit einseitigem Tonverlauf: die Seewaerts-Seite bekommt zwei immer
  // schwaechere Parallelen. Das ist der alte Kupferstich-Trick und liest
  // auch dann noch als „hier ist Wasser", wenn die Farbe fehlt.
  streifenStift(ctx, 0.16);
  streifenStrich(ctx, 0.34, s);
  streifenStift(ctx, 0.10, DECK_HALB);
  streifenStrich(ctx, 0.54, s + 1);
  streifenStift(ctx, 0.07, DECK_TON * 2.2);
  streifenStrich(ctx, 0.72, s + 2);
};
MALER.sig_grundriss = function (ctx, s) {
  /* Mauerzug im Grundriss: eine durchgezogene Linie mit einem Turmklotz je
     Kachel. Die Linie liegt in der Bandmitte, der Klotz sitzt AUSSEN — beim
     Umlauf eines Polygons zeigt die eine Bandseite nach aussen (die Kacheln
     laufen mit der Punktreihenfolge), und ein Turm steht auf der Feldseite
     der Mauer. Ohne den Klotz waere der Umriss von einem Weg nicht zu
     unterscheiden; mit ihm liest er als Wehrbau, auch wenn er im Bild nur
     drei Bildpunkte breit ist.

     Die Linie laeuft ueber den Inhaltskasten hinaus (STREIFEN_UEBER), damit
     an der Kachelnaht Strichmitte auf Strichmitte trifft; der Klotz nicht,
     sonst zerschnitte ihn die Kante. */
  streifenStift(ctx, 0.30);
  streifenStrich(ctx, 0.5, s);
  pinsel(ctx, DECK_VOLL);
  ctx.fillRect(0.42, 0.16, 0.16, 0.34);
};
MALER.sig_grenze = function (ctx, s) {
  // Perlband: EIN Strich und EIN Punkt je Kachel. Die Konvention fuer
  // „vereinbart, nicht vorgefunden" — und der Grund, warum eine Grenze nie
  // durchgezogen wird. Ein Strich je Kachel statt zweier Halber: sonst
  // verschmelzen die beiden Haelften ueber die Kachelgrenze zu einem
  // ueberlangen Strich, und das Muster stakst.
  streifenStift(ctx, 0.14);
  zug(ctx, [[0, 0.5], [0.60, 0.5]], s);
  pinsel(ctx, DECK_VOLL);
  punkt(ctx, 0.80, 0.5, 0.09);
};
MALER.sig_seeweg = function (ctx, s) {
  streifenStift(ctx, 0.16);
  strichlinie(ctx, 0, 0.5, 1, 0.5, 7, 0.45, s);
};

/* --- Arbor --------------------------------------------------------------- */

MALER.sig_ranke = function (ctx, s) {
  // Lichtsaeule: senkrechter Strich mit Halo. Der Halo ist der Grund, warum
  // dieses Zeichen ueberhaupt liest — die Ranke ist auf Kartenmassstab keine
  // Pflanze, sondern eine Lichtquelle.
  ton(ctx, 0.5, 0.5, 0.46, DECK_TON * 1.8);
  stift(ctx, 0.085);
  zug(ctx, [[0.5, 0.10], [0.5, 0.90]], s);
  stift(ctx, 0.040, DECK_HALB);
  zug(ctx, [[0.36, 0.16], [0.36, 0.84]], s + 1);
  zug(ctx, [[0.64, 0.16], [0.64, 0.84]], s + 2);
};
MALER.sig_rankenfuss = function (ctx, s) {
  stift(ctx, 0.044, DECK_HALB);
  ring(ctx, 0.5, 0.5, 0.34, s);
  // Blattmarken auf dem Ring: sechs kurze Boegen, tangential.
  stift(ctx, 0.055);
  for (var i = 0; i < 6; i++) {
    var a = i / 6 * TAU, cx = 0.5 + Math.cos(a) * 0.34, cy = 0.5 + Math.sin(a) * 0.34;
    zug(ctx, [[cx - Math.sin(a) * 0.09, cy + Math.cos(a) * 0.09],
      [cx + Math.cos(a) * 0.10, cy + Math.sin(a) * 0.10],
      [cx + Math.sin(a) * 0.09, cy - Math.cos(a) * 0.09]], s + i);
  }
};
MALER.sig_bruchkante = function (ctx, s) {
  // Doppelte Bruchlinie mit Schattenseite. Dieselbe Erzaehlung wie
  // `bruchkante` in generators/geometry.js: die Kante ist kein Strich,
  // sondern eine Fuge — und was auf der einen Seite fehlt, liegt auf der
  // anderen im Schatten.
  var linie = [[0.06, 0.36], [0.28, 0.46], [0.46, 0.34], [0.68, 0.48], [0.94, 0.38]];
  stift(ctx, 0.060);
  zug(ctx, linie, s);
  var unten = linie.map(function (p) { return [p[0] + 0.02, p[1] + 0.18]; });
  stift(ctx, 0.046);
  zug(ctx, unten, s + 1);
  stift(ctx, 0.030, DECK_HALB);
  for (var i = 0; i < linie.length; i++) zug(ctx, [linie[i], unten[i]], s + 10 + i);
};
MALER.sig_arborknoten = function (ctx, s) {
  ton(ctx, 0.5, 0.5, 0.48, DECK_TON * 2.0);
  stift(ctx, 0.060);
  for (var i = 0; i < 6; i++) {
    var a = i / 6 * TAU;
    zug(ctx, [[0.5 - Math.cos(a) * 0.06, 0.5 - Math.sin(a) * 0.06],
      [0.5 + Math.cos(a) * 0.44, 0.5 + Math.sin(a) * 0.44]], s + i);
  }
  pinsel(ctx, DECK_VOLL);
  punkt(ctx, 0.5, 0.5, 0.075);
};
MALER.sig_lichtbruecke = function (ctx, s) {
  stift(ctx, 0.070);
  zug(ctx, [[0.06, 0.5], [0.30, 0.5]], s);
  zug(ctx, [[0.70, 0.5], [0.94, 0.5]], s + 1);
  pinsel(ctx, DECK_VOLL);
  punkt(ctx, 0.42, 0.5, 0.048);
  punkt(ctx, 0.58, 0.5, 0.048);
};


/* --------------------------------------------------------------------------
   Atlas zeichnen
   -------------------------------------------------------------------------- */

/**
 * Zeichnet EIN Feld. `ctx` ist der 2D-Kontext des Atlaskanvas; alle
 * Koordinaten des Malers liegen in 0..1 und werden hier auf das Feld
 * abgebildet. `opt.kachel` erlaubt eine andere Feldgroesse (Pruefung).
 */
function zeichneFeld(ctx, name, opt) {
  var maler = MALER[name], f = atlasFeld(name);
  if (!maler || !f) return false;
  opt = opt || {};
  var kachel = Number.isFinite(opt.kachel) ? opt.kachel : ATLAS_KACHEL;
  var rand = kachel * (1 - ATLAS_INHALT) * 0.5;
  var inhalt = kachel * ATLAS_INHALT;
  ctx.save();
  ctx.translate(f.spalte * kachel + rand, f.zeile * kachel + rand);
  ctx.scale(inhalt, inhalt);
  // Der Seed haengt am FELDINDEX, nicht an der Zeichenreihenfolge: kaeme ein
  // Zeichen hinzu, wuerde sonst das Zittern aller folgenden anders ausfallen.
  maler(ctx, 0x5163 + f.index * 131);
  ctx.restore();
  return true;
}

/** Zeichnet das ganze Blatt. Deterministisch: zweimal gezeichnet, Zug fuer
 *  Zug dieselbe Folge von Kontextaufrufen. */
function zeichneAtlas(ctx, opt) {
  opt = opt || {};
  var kachel = Number.isFinite(opt.kachel) ? opt.kachel : ATLAS_KACHEL;
  var kante = ATLAS_RASTER * kachel;
  ctx.clearRect(0, 0, kante, kante);
  var n = 0;
  for (var i = 0; i < ZEICHEN_NAMEN.length; i++) {
    if (zeichneFeld(ctx, ZEICHEN_NAMEN[i], { kachel: kachel })) n++;
  }
  return n;
}

/* Traege erzeugt: dieses Modul wird auch dort geladen, wo niemand ein Canvas
   will (Pruefung, Kopfloser-Lauf). Erst wer die Textur ANFRAGT, bekommt eine.
   Dieselbe Begruendung wie bei holeBeschriftungsschicht in ui/beschriftung.js. */
var atlasTextur = null;
/**
 * Die eine Atlastextur der laufenden Karte.
 * opt.canvasFabrik(kante) erlaubt einen Ersatz fuer document.createElement.
 */
function holeSignaturAtlas(opt) {
  if (atlasTextur) return atlasTextur;
  opt = opt || {};
  var kante = ATLAS_KANTE;
  var canvas;
  if (typeof opt.canvasFabrik === 'function') canvas = opt.canvasFabrik(kante);
  else if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = kante;
  } else return null;
  var ctx = canvas.getContext('2d');
  if (!ctx) return null;
  zeichneAtlas(ctx, { kachel: ATLAS_KACHEL });
  var t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = true;
  if (THREE.LinearMipmapLinearFilter !== undefined) t.minFilter = THREE.LinearMipmapLinearFilter;
  if (THREE.LinearFilter !== undefined) t.magFilter = THREE.LinearFilter;
  // Reine Alpha-/Datentextur: die Farbe kommt aus dem Tint. Deshalb KEIN
  // sRGB — genau wie bei shadowBlob und malschicht in render/textures.js.
  t.needsUpdate = true;
  atlasTextur = t;
  return t;
}
/** Verwirft die Textur (Kartenwechsel, Pruefung). */
function verwirfSignaturAtlas() {
  if (atlasTextur && atlasTextur.dispose) atlasTextur.dispose();
  atlasTextur = null;
}


/* ==========================================================================
   8 — Geometrie und Poolregistrierung

   Jedes Zeichen ist ein Einheitsquad in der XZ-Ebene mit GEBACKENEN UV. Das
   ist der ganze Grund, warum der Atlas gewaehlt wurde: der Instanzpfad
   braucht keinen UV-Versatz, weil er im Vertexpuffer schon steht.

   Die Groesse steckt in der Instanzskalierung (sx = sz = quad), nicht in der
   Geometrie — sonst braeuchte jedes Zeichen so viele Pools, wie es Groessen
   hat.
   ========================================================================== */

/** Einheitsquad in XZ mit den UV seines Atlasfeldes. */
function signaturGeometrie(name) {
  var f = atlasFeld(name);
  if (!f) return null;
  var g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  var uv = g.attributes.uv;
  for (var i = 0; i < uv.count; i++) {
    uv.setXY(i, lerp(f.u0, f.u1, uv.getX(i)), lerp(f.v0, f.v1, uv.getY(i)));
  }
  uv.needsUpdate = true;
  // Weisse Vertexfarben: die Pools laufen mit vertexColors, und der Tint soll
  // ungefiltert durchkommen.
  var n = g.attributes.position.count;
  var col = new Float32Array(n * 3);
  col.fill(1);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/**
 * Die definePool-Optionen eines Zeichens.
 *
 * `radius: 0` ist kein Platzhalter, sondern Aussage: `emit` legt nur fuer
 * Radien ab 0.6 einen Kontaktschatten ab, und eine Signatur ist Tinte auf
 * Papier — sie wirft keinen.
 *
 * `flach: true` verlangt ein UNBELEUCHTETES Material. Ohne das saehe ein
 * Ortsring aus wie ein liegender Reifen: er bekaeme Lichtrichtung,
 * Wolkenschatten und Malschicht wie ein Gegenstand in der Welt. Ein
 * Kartenzeichen hat davon nichts. Aus demselben Grund traegt es KEINE
 * Materialfamilie — die Familie ist genau die Zuordnung zur Malschicht.
 */
function signaturPoolOpts(name, atlas) {
  var Z = ZEICHEN[name];
  if (!Z) return null;
  return {
    radius: 0,
    familie: 'karte',
    karte: true,
    flach: true,
    sichtbarAb: Z.ab,
    sichtbarBis: Z.bis,
    map: atlas || null,
    transparent: true,
    alphaTest: 0.03,
    dbl: true,
    ao: 0                                   // kein Hoehenverlauf auf einem Quad
  };
}

/**
 * Registriert alle Kartenzeichen als Pools.
 *
 * `definePoolFn` wird HEREINGEREICHT statt importiert: die Datei, die diese
 * Funktion aufruft, ist generators/geometry.js — also genau die Datei, die
 * dieses Modul sonst importieren muesste. Ein Zyklus weniger, und der
 * Registrierweg laesst sich ohne Szene pruefen (die Pruefung reicht eine
 * mitschreibende Funktion herein).
 *
 * Rueckgabe: Liste der registrierten Namen.
 */
function registriereSignaturPools(definePoolFn, opt) {
  opt = opt || {};
  if (typeof definePoolFn !== 'function') return [];
  var atlas = opt.atlas !== undefined ? opt.atlas : holeSignaturAtlas(opt);
  var namen = [];
  for (var i = 0; i < ZEICHEN_NAMEN.length; i++) {
    var name = ZEICHEN_NAMEN[i];
    var geo = signaturGeometrie(name);
    if (!geo) continue;
    definePoolFn(name, geo, signaturPoolOpts(name, atlas));
    namen.push(name);
  }
  return namen;
}


/* ==========================================================================
   9 — Platzierung: alles zusammen

   Reine Funktion, die aus Zeichen + Massstab + Sicht die Zahlen liefert, die
   ein Generator an `emit` weiterreicht.

   Die eine Stelle, an der dieses Modul etwas ueber den Instanzpfad
   VORAUSSETZT: `sy` traegt bei Kartenzeichen keine Groesse, sondern den
   Ausblendfaktor. Ein flaches Quad hat in y keine Ausdehnung, die
   y-Skalierung ist dort also geometrisch wirkungslos — und sie ist der
   einzige der 12 Festwerte, der frei ist. Der Kartenshader liest sie als
   Deckung zurueck (Bericht: Aenderung am Emit-Pfad). Nach unten begrenzt,
   damit die Instanzmatrix nie exakt singulaer wird.
   ========================================================================== */

var VERBLASST_MIN = 0.001;

/**
 * name    Zeichenname
 * opt     { massstab, kante, abstand, fov, bildHoehe, biom, dreh, skala }
 * Rueckgabe null, wenn das Zeichen bei diesem Massstab nichts beitraegt.
 */
function signaturPlatzierung(name, opt) {
  opt = opt || {};
  var f = zeichenFaktor(name, opt.massstab);
  if (!(f > 0)) return null;
  var g = signaturGroesse(name, opt);
  var sk = Number.isFinite(opt.skala) ? opt.skala : 1;
  return {
    name: name,
    sx: g.quad * sk,
    sy: clamp(f, VERBLASST_MIN, 1),
    sz: g.quad * sk,
    yaw: Number.isFinite(opt.dreh) ? opt.dreh : 0,
    tint: signaturTint(name, opt.biom),
    faktor: f,
    marke: g.marke * sk,
    px: g.px,
    schwebe: schwebeHoehe(opt.kante)
  };
}


export {
  // Massstab
  MASSSTABSLEITER, MASSSTAB_MIN, MASSSTAB_MAX, stufeFuer,
  UEBERGABE, VORGABE_BAND, BLENDE,
  bandFaktor, bandVon, zeichenFaktor, imBand,
  // Katalog
  ZEICHEN, ZEICHEN_NAMEN, GRUPPEN, zeichenDaten,
  // Sachen und Zeichenwahl
  SACHEN, SACHEN_NAMEN, ORT_SCHWELLEN, darstellungAn, zeichenFuer,
  // Groesse
  SIG_MIN_PX, SIG_MAX_PX, ATLAS_INHALT, SCHWEBE_ANTEIL,
  bildhoehe, signaturGroesse, schwebeHoehe,
  // Streuung
  STREU_ABSTAND, streuAbstand, streuRaster,
  // Farbe
  TINTE, ARBOR_FARBE, TON_QUELLE, signaturTint,
  // Atlas
  ATLAS_RASTER, ATLAS_KACHEL, ATLAS_KANTE, ATLAS_FELDER, GRUPPEN_ZEILE,
  atlasFeld, atlasUV, atlasStreifenUV, STREIFEN_UEBER,
  MALER, zeichneFeld, zeichneAtlas,
  holeSignaturAtlas, verwirfSignaturAtlas,
  // Geometrie und Pools
  signaturGeometrie, signaturPoolOpts, registriereSignaturPools,
  // Platzierung
  VERBLASST_MIN, signaturPlatzierung
};
