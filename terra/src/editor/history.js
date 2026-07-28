// Undo/Redo ueber Schnappschuesse von Elementliste und Terrainhoehen.
import { VW, serializeElements, hydrate, serializeMarker, hydrateMarker } from '../core/store.js';
import { base, hoehenVersion, holeSchmutzRegion } from '../world/terrain.js';
import { rebuildAll } from '../core/dirty.js';
import { rebuildHandles, rebuildMarker } from './selection.js';
import { ed } from './tools.js';
import { buildPanel, toast } from '../ui/panels.js';

var undoStack = [], redoStack = [];

/* ==========================================================================
   Hoehen im Schnappschuss (Runde D: Copy-on-Write, H1e: regionsweise)

   Bis H1e hielt JEDER Terrainschritt eine Vollkopie des Hoehenfelds fest —
   264 KB auf einer 256er, 1,05 MB auf einer 512er und 4,2 MB auf einer 1024er
   Karte, bei Stapeltiefe 40 also bis zu 168 MB. Zusaetzlich verglich
   `terrainGeaendert()` bei JEDEM pushUndo elementweise das ganze Feld
   (1.050.625 Vergleiche auf 1024er Karten, auch bei einer reinen
   Elementaenderung, bei der sich keine einzige Hoehe bewegt hat).

   Beides ist jetzt ersetzt:

   1. ERKENNUNG O(1). world/terrain.js zaehlt `hoehenVersion` bei jedem
      Schreibzugriff auf `base` hoch. Hier wird nur noch diese Zahl mit
      `letzteVersion` verglichen.

   2. REGIONS-SCHNAPPSCHUSS. terrain.js fuehrt zugleich die Vereinigungsbox
      aller Schreibzugriffe mit; `holeSchmutzRegion()` liefert sie und setzt
      sie zurueck. Gesichert wird nur dieser Ausschnitt:
      `{i0,i1,j0,j1,vw,werte}` statt eines kompletten Feldes. Ein Pinselstrich
      mit Radius 20 kostet damit rund 7 KB statt 4,2 MB.

   3. `schatten` ist die EINE verbleibende Vollkopie: der Hoehenstand zum
      Zeitpunkt des letzten Schnappschusses. Aus ihm werden die Regionswerte
      geschnitten, danach wird er im selben Bereich nachgezogen. Er wird nie
      geteilt: sobald er als Vollkopie an einen Schnappschuss geht, tritt eine
      frische Kopie an seine Stelle.

   ZEITLICHE VERSCHIEBUNG — der Kern der Sache. `pushUndo()` laeuft VOR der
   Aenderung; welchen Bereich sie beruehren wird, ist da noch unbekannt. Ein
   Schnappschuss bekommt seinen Hoehenanteil deshalb NACHTRAEGLICH: sobald die
   naechste Sicherung feststellt, dass sich etwas bewegt hat, traegt sie den
   Altstand des betroffenen Bereichs in den zuletzt erzeugten Schnappschuss
   (`offen`) nach. Ein Schnappschuss ohne Hoehenanteil (`h === null`) bedeutet
   genau: zwischen ihm und dem naechsten hat sich an den Hoehen nichts
   geaendert — beim Wiederherstellen bleiben sie, wie sie sind.

   Damit wird die Historie INKREMENTELL. Das ist zulaessig, weil undo/redo die
   Kette strikt Schritt fuer Schritt abarbeiten: Schnappschuss k muss nur die
   Aenderung zwischen k und k+1 zuruecknehmen koennen, nicht einen beliebigen
   Sprung. `restore()` haelt die Kette in beide Richtungen geschlossen, indem
   es den Gegen-Schnappschuss (den undo/redo gerade auf den anderen Stapel
   gelegt hat) mit dem JETZT-Stand derselben Region fuellt, bevor es sie
   ueberschreibt.

   VOLLKOPIEN bleiben, wo die Aenderung unbegrenzt ist: Laden, Seedwechsel,
   Biomwechsel, Hoehenkarten-Import — alle rufen `pushUndo(true)`. Der Schatten
   ist danach wertlos und wird beim naechsten Zugriff komplett neu gezogen.
   Der Groessenwechsel verwirft die Historie ohnehin (verwerfeHistorie).
   ========================================================================== */
var schatten = base.slice();          // Hoehenstand des letzten Schnappschusses
var letzteVersion = hoehenVersion;    // O(1)-Abgleich statt Vollscan
var offen = null;                     // Schnappschuss, dessen Hoehenanteil aussteht
var schattenUngueltig = false;        // nach pushUndo(true): base wird gleich ersetzt

/** Frischer Schatten samt Buchhaltung — nach jeder unbegrenzten Aenderung. */
function schattenNeu() {
  schatten = base.slice();
  letzteVersion = hoehenVersion;
  holeSchmutzRegion();                // gesammelte Region verwerfen
  schattenUngueltig = false;
}

/** Schneidet [i0..i1]x[j0..j1] aus einem Hoehenfeld heraus. */
function regionKopie(quelle, r) {
  var b = r.i1 - r.i0 + 1, hh = r.j1 - r.j0 + 1;
  var w = new Float32Array(b * hh);
  for (var j = 0; j < hh; j++) {
    var von = (r.j0 + j) * VW + r.i0;
    w.set(quelle.subarray(von, von + b), j * b);
  }
  return { i0: r.i0, i1: r.i1, j0: r.j0, j1: r.j1, vw: VW, werte: w };
}

/** Schreibt einen Regions-Schnappschuss in ein Hoehenfeld zurueck. */
function regionSchreiben(ziel, s) {
  var b = s.i1 - s.i0 + 1, hh = s.j1 - s.j0 + 1;
  for (var j = 0; j < hh; j++) {
    ziel.set(s.werte.subarray(j * b, j * b + b), (s.j0 + j) * VW + s.i0);
  }
}

/** Kopiert einen Bereich aus base in den Schatten (Schatten nachziehen). */
function schattenNachziehen(r) {
  var b = r.i1 - r.i0 + 1;
  for (var j = r.j0; j <= r.j1; j++) {
    var von = j * VW + r.i0;
    schatten.set(base.subarray(von, von + b), von);
  }
}

/**
 * Traegt eine seit dem letzten Schnappschuss erfolgte Hoehenaenderung nach:
 * der zuletzt erzeugte Schnappschuss bekommt den Altstand des betroffenen
 * Bereichs, danach wird der Schatten dort auf den neuen Stand gezogen.
 * Verlaesst die Funktion, gilt wieder: schatten === base.
 */
function hoehenNachtragen() {
  if (schattenUngueltig) { schattenNeu(); return; }    // Altstand liegt bereits voll vor
  if (hoehenVersion === letzteVersion) return;         // der ganze Gewinn: ein Zahlenvergleich
  var r = holeSchmutzRegion();
  // Kein Bereich bekannt oder das Feld hat die Laenge gewechselt: konservativ
  // die alte Vollkopie weiterreichen und neu aufsetzen.
  if (!r || schatten.length !== base.length) {
    if (offen && !offen.h) offen.h = schatten;
    schattenNeu();
    return;
  }
  if (offen && !offen.h) offen.h = regionKopie(schatten, r);
  schattenNachziehen(r);
  letzteVersion = hoehenVersion;
}

/**
 * mitTerrain === true erzwingt eine frische Hoehen-Vollkopie IN DIESEN
 * Schnappschuss (Aufrufer, die base gleich komplett ersetzen: Laden, Seed,
 * Biom, Hoehenkarte in io.js). Alle uebrigen Aufrufer brauchen kein Argument —
 * ihre Aenderung wird ueber `hoehenVersion` erkannt und beim naechsten
 * Schnappschuss regionsweise nachgetragen.
 */
/* Marker sind Teil des Schnappschusses (frueher nicht — ein geloeschter
   Marker liess sich nicht zurueckholen). Sie liegen als eigene flache Liste
   in S.marker (D1) und sind billig zu sichern: JSON ueber {x,z,text,art},
   ohne Laufzeitfelder. Gleiche Copy-on-Write-Frage wie beim Terrain stellt
   sich nicht, weil serializeMarker() ohnehin frische Objekte liefert und der
   String danach unveraenderlich ist. */
function snapshot(mitTerrain) {
  hoehenNachtragen();
  var s = { el: JSON.stringify(serializeElements()), h: null,
    mk: JSON.stringify(serializeMarker()) };
  if (mitTerrain === true) {
    s.h = base.slice();
    // base wird gleich unkontrolliert ueberschrieben — der Schatten ist danach
    // wertlos und wird beim naechsten Zugriff komplett neu gezogen. Dass diese
    // Aenderung keine Region meldet, ist unschaedlich: der Altstand steckt
    // bereits vollstaendig in s.h.
    schattenUngueltig = true;
  }
  offen = s;
  return s;
}

function pushUndo(mitTerrain) {
  undoStack.push(snapshot(mitTerrain));
  if (undoStack.length > 40) undoStack.shift();
  redoStack.length = 0;
}

/**
 * Hoehenanteil eines Schnappschusses zurueckspielen — Vollkopie
 * (Float32Array) oder Region ({i0,i1,j0,j1,vw,werte}). Vorher bekommt der
 * offene Gegen-Schnappschuss (von undo/redo eben auf den anderen Stapel
 * gelegt) denselben Ausschnitt im JETZT-Stand; nur so bleibt die Kette in
 * beide Richtungen geschlossen.
 */
function hoehenWiederherstellen(h) {
  if (!h) return;                       // kein Hoehenanteil -> Hoehen bleiben stehen
  if (schattenUngueltig || schatten.length !== base.length) schattenNeu();
  else hoehenNachtragen();              // noch nicht verbuchte Aenderung zuerst
  if (h instanceof Float32Array) {
    if (offen && !offen.h) offen.h = schatten;
    // Laengenschutz: die Hoehenfelder wachsen nur (felderSichern in
    // terrain.js). Ein Groessenwechsel verwirft die Historie, eine zu lange
    // Altkopie kann hier also nicht mehr auftauchen — der Zuschnitt bleibt
    // trotzdem stehen, weil restore/snapshot exportiert sind.
    base.set(h.length > base.length ? h.subarray(0, base.length) : h);
    schatten = base.slice();
  } else if (h.vw === VW) {
    if (offen && !offen.h) offen.h = regionKopie(schatten, h);
    regionSchreiben(base, h);
    regionSchreiben(schatten, h);
  }
  letzteVersion = hoehenVersion;
  holeSchmutzRegion();                  // was terrain.js seitdem gesammelt hat, ist verbucht
  offen = null;                         // der Gegen-Schnappschuss ist vollstaendig
  schattenUngueltig = false;
}

function restore(s) {
  hoehenWiederherstellen(s.h);
  hydrate(JSON.parse(s.el));
  // Marker zurueckholen. `mk` ist optional geprueft, damit ein von aussen
  // gebauter Schnappschuss (restore/snapshot sind exportiert) die Historie
  // nicht sprengt; fehlt das Feld, bleiben die Marker wie sie sind.
  if (typeof s.mk === "string") {
    hydrateMarker(JSON.parse(s.mk));
    // rebuildMarker() baut die Nadeln neu UND klemmt dabei die Markerauswahl
    // auf die neue Listenlaenge (selection.js) — nach einem rueckgaengig
    // gemachten Loeschen zeigt der Index sonst auf einen fremden Marker.
    rebuildMarker();
  }
  ed.selected = null;
  ed.draw = null;
  rebuildAll();
  rebuildHandles();
  buildPanel();
}

function undo() {
  if (!undoStack.length) { toast("Nichts zum Rückgängigmachen"); return; }
  redoStack.push(snapshot());
  restore(undoStack.pop());
  toast("Rückgängig");
}

function redo() {
  if (!redoStack.length) { toast("Nichts zum Wiederholen"); return; }
  undoStack.push(snapshot());
  restore(redoStack.pop());
  toast("Wiederholt");
}


/** Historie verwerfen — noetig beim Wechsel der Kartengroesse (H1e): die
 *  gespeicherten Hoehenfelder passen danach nicht mehr zur Feldgroesse, ein
 *  Undo darueber hinweg wuerde ein inhaltlich fremdes Terrain herstellen.
 *  (Regions-Schnappschuesse traegen ihr VW mit und wuerden sich zusaetzlich
 *  selbst verweigern — der Stapel wird trotzdem geleert, weil ein halb
 *  wirksames Rueckgaengig schlimmer waere als gar keines.)
 *
 *  Betrifft NUR den Stapel der Karte, auf der man gerade steht. Die geparkten
 *  Stapel anderer Karten bleiben liegen: deren Hoehenfelder haben mit dieser
 *  Groessenaenderung nichts zu tun, und sie werden beim Zurueckkehren ohnehin
 *  gegen ihr eigenes VW geprueft (siehe historieKarteHolen).
 *
 *  Liefert die Zahl der verworfenen Schritte — der Aufrufer entscheidet, ob
 *  das eine Meldung wert ist. Bewusst kein Toast von hier aus: diese Funktion
 *  laeuft auch mitten in einem Ladevorgang, und eine Meldung ueber eine
 *  Historie, die der Nutzer gerade selbst ersetzt, ist keine Nachricht. */
function verwerfeHistorie() {
  var n = undoStack.length + redoStack.length;
  undoStack.length = 0;
  redoStack.length = 0;
  offen = null;
  schattenNeu();
  return n;
}


/* ==========================================================================
   H1e/I1 — Ein Stapel JE KARTE

   Bis hierher wurde die Historie beim Wechsel der Karte weggeworfen. Das war
   sicher und richtig begruendet — ein Undo, das Hoehen der einen Karte in die
   andere schriebe, waere schlimmer als gar keines —, aber unbequem: wer sich
   in eine Kindkarte verklickt, verliert seinen Stapel.

   Die Loesung ist kein Umbau der Schnappschuesse, sondern eine Ablage. Beim
   Wechsel wird der aktuelle Stapel unter der Kennung seiner Karte GEPARKT,
   beim Zurueckkehren wieder hervorgeholt. Der Stapel bleibt damit immer bei
   seinem Hoehenfeld — genau die Zusage, die das Verwerfen erzwungen hatte.

   WARUM DAS TRAEGT. Die Kette der Schnappschuesse ist inkrementell (siehe
   ganz oben): Schnappschuss k muss die Aenderung zwischen k und k+1
   zuruecknehmen koennen. Zwischen Parken und Zurueckkehren passiert mit DIESER
   Karte aber nichts: `wechsleZuKarte` sichert sie vorher vollstaendig
   (karteSichern) und stellt sie beim Zurueckkommen aus demselben Eintrag
   wieder her. Das Hoehenfeld ist danach Zelle fuer Zelle dasselbe, die Kette
   also geschlossen. Drei Dinge sichern das ab:
     1. `hoehenNachtragen()` VOR dem Parken — eine noch nicht verbuchte
        Aenderung gehoert in den offenen Schnappschuss dieser Karte, nicht in
        den der naechsten.
     2. `offen` wandert MIT in die Ablage; ohne ihn faende die naechste
        Aenderung nach der Rueckkehr keinen Schnappschuss zum Nachtragen.
     3. `schattenNeu()` NACH dem Holen — `base` ist zwischenzeitlich komplett
        ersetzt worden, der Schatten muss frisch gezogen werden.
   Zusaetzlich traegt jeder Eintrag sein VW und wird bei Abweichung verworfen
   statt angewandt (Guertel und Hosentraeger: die Kartengroesse einer geparkten
   Karte kann sich nicht aendern, ohne dass sie aktiv ist — aber ein halb
   wirksames Rueckgaengig ist der eine Fehler, den man nicht bemerken wuerde).

   DER SPEICHER — die eigentliche Frage. Ein Vollschnappschuss auf einer 1024er
   Karte ist 4,2 MB; bei Stapeltiefe 40 waeren das 168 MB JE KARTE, und ein
   Baum hat beliebig viele. Deshalb zwei Deckel:
     - hoechstens PARK_MAX_KARTEN geparkte Stapel (die zuletzt benutzten),
     - hoechstens PARK_MAX_BYTES ueber alle geparkten zusammen.
   Der Regelfall kostet fast nichts: seit H1e sind die Hoehenanteile
   Regionsausschnitte von wenigen Kilobyte, ein voller 40er-Stapel liegt
   typisch bei 1-2 MB. Der Deckel greift erst, wo jemand wirklich mehrfach das
   ganze Gelaende ersetzt hat — und dort ist er richtig.
   ========================================================================== */
var geparkt = new Map();                 // karteId -> { undo, redo, offen, vw }
var PARK_MAX_KARTEN = 3;
var PARK_MAX_BYTES = 32 * 1024 * 1024;

/** Ungefaehre Groesse eines Schnappschusses in Byte. Die beiden Zeichenketten
 *  zaehlen mit einem Byte je Zeichen (JSON ist ASCII), der Hoehenanteil mit
 *  vier Byte je Float. Genauer muss es nicht sein — es geht um eine Schranke,
 *  nicht um eine Bilanz. */
function schnappGroesse(s) {
  var n = (s.el ? s.el.length : 0) + (s.mk ? s.mk.length : 0);
  if (s.h) n += (s.h.werte ? s.h.werte.length : s.h.length) * 4;
  return n;
}

function stapelGroesse(e) {
  var n = 0, i;
  for (i = 0; i < e.undo.length; i++) n += schnappGroesse(e.undo[i]);
  for (i = 0; i < e.redo.length; i++) n += schnappGroesse(e.redo[i]);
  return n;
}

/** Aeltestes zuerst hinauswerfen, bis beide Deckel eingehalten sind.
 *  Map bewahrt die Einfuegereihenfolge; `historieKarteParken` loescht vor dem
 *  Setzen, ein erneut geparkter Stapel rutscht damit ans Ende — die Ablage ist
 *  also nach letzter Benutzung geordnet. Liefert die Kennungen der
 *  aufgegebenen Stapel, damit der Aufrufer es sagen kann. */
function parkAufraeumen() {
  var raus = [], bytes = 0, e;
  var schluessel = Array.from(geparkt.keys());
  for (var i = 0; i < schluessel.length; i++) bytes += stapelGroesse(geparkt.get(schluessel[i]));
  var k = 0;
  while (k < schluessel.length && (geparkt.size > PARK_MAX_KARTEN || bytes > PARK_MAX_BYTES)) {
    e = geparkt.get(schluessel[k]);
    bytes -= stapelGroesse(e);
    geparkt.delete(schluessel[k]);
    raus.push(schluessel[k]);
    k++;
  }
  return raus;
}

/**
 * Den Stapel der Karte `id` ablegen und mit einem leeren weiterarbeiten.
 * Aufzurufen BEVOR das Hoehenfeld der neuen Karte geladen wird.
 * Liefert die Zahl der abgelegten Schritte.
 */
function historieKarteParken(id) {
  hoehenNachtragen();                    // Punkt 1 der Begruendung oben
  var n = undoStack.length + redoStack.length;
  if (typeof id === "string" && id && n) {
    geparkt.delete(id);                  // erneut geparkt = zuletzt benutzt
    geparkt.set(id, { undo: undoStack, redo: redoStack, offen: offen, vw: VW });
    var raus = parkAufraeumen();
    if (raus.length) {
      toast("Undo-Stapel von " + raus.join(", ") + " aufgegeben (Speichergrenze)");
    }
  } else if (typeof id === "string" && id) {
    geparkt.delete(id);                  // nichts zu parken: alten Eintrag raeumen
  }
  undoStack = [];
  redoStack = [];
  offen = null;
  return n;
}

/**
 * Den Stapel der Karte `id` wieder aufnehmen. Aufzurufen NACHDEM ihr
 * Hoehenfeld steht. Liefert die Zahl der zurueckgeholten Schritte.
 */
function historieKarteHolen(id) {
  var e = (typeof id === "string" && id) ? geparkt.get(id) : null;
  if (e) geparkt.delete(id);
  undoStack = [];
  redoStack = [];
  offen = null;
  schattenNeu();                         // Punkt 3 der Begruendung oben
  if (!e) return 0;
  if (e.vw !== VW) {
    // Kann im heutigen Ablauf nicht vorkommen; wenn doch, ist Wegwerfen die
    // einzige richtige Antwort — und der Nutzer erfaehrt, warum.
    toast("Historie dieser Karte passt nicht mehr zur Kartengröße und wurde verworfen");
    return 0;
  }
  undoStack = e.undo;
  redoStack = e.redo;
  offen = e.offen;
  return undoStack.length + redoStack.length;
}

/** Die ABLAGE leeren — beim Laden einer anderen Datei. Die Kennungen des alten
 *  Baums kommen im neuen fast sicher wieder vor ("k0" ist die Wurzel jeder
 *  Datei); ein liegengebliebener Stapel wuerde dort wieder aufgenommen und
 *  schriebe die Elemente einer fremden Karte zurueck.
 *  Der AKTIVE Stapel bleibt bewusst stehen: er gehoert zu dem Stand, den der
 *  Ladevorgang gerade ersetzt, und genau der soll sich mit Strg+Z
 *  zurueckholen lassen — so war es vor dieser Aenderung und so bleibt es.
 *  Liefert die Zahl der aufgegebenen Stapel. */
function verwerfeGeparkteHistorien() {
  var n = geparkt.size;
  geparkt.clear();
  return n;
}

/** Nur fuer Pruefungen: wie viele Stapel liegen in der Ablage? */
function geparkteHistorien() { return geparkt.size; }

/** Wie viele Schritte haengen am aktiven Stapel? Fuer die Rueckfrage vor einem
 *  Groessenwechsel — dem einzigen Weg, auf dem eine Historie noch verloren
 *  geht (editor/io.js). */
function schritteInHistorie() { return undoStack.length + redoStack.length; }

export { snapshot, pushUndo, restore, undo, redo, verwerfeHistorie,
  historieKarteParken, historieKarteHolen, verwerfeGeparkteHistorien,
  geparkteHistorien, schritteInHistorie };
