// Werkzeuge: Definitionen, Parameter-Schemata, aktiver Zustand, Zeichnen-Abschluss.
import { S, BIOME, mkElement, nextSeed, stempelGueltig, speicherLesen, speicherSchreiben }
  from '../core/store.js';
import { commit, isHeavy } from '../core/dirty.js';
import { pushUndo } from './history.js';
// J3 — die Auswahlliste der Sprachfamilien kommt aus dem Generator, damit sie
// an genau EINER Stelle gepflegt wird. namen.js importiert nur core/ und
// world/ und nichts aus editor/ oder ui/ — der Import ist zyklusfrei.
import { sprachfamilien, familieDerKarte, setzeSprachfamilie } from '../generators/namen.js';
import { clearPreview, setPreview, rebuildHandles, select, brushRing, waehleMarker }
  from './selection.js';
import { buildPanel, updateHint } from '../ui/panels.js';

/* I2 — Auswahlliste der Biome fuer das Schema der Biomflaeche. Sie wird aus
   der Registry abgeleitet und nicht abgeschrieben: die Leiste oben traegt
   dieselben 25 Eintraege als <optgroup> in index.html, und zwei Listen, die
   von Hand gleichgehalten werden muessen, laufen beim naechsten Biom
   auseinander. Reihenfolge ist die der Registry, damit sie stabil ist. */
function biomListe() {
  var out = [];
  for (var k in BIOME) out.push([k, BIOME[k].label || k]);
  return out;
}

/** Aktiver Werkzeug-Zustand (frueher lose Globals). */
export const ed = {
  tool: "pfad",
  /* A2: `wegsuche` steht hier neben `pfad`, obwohl beide dasselbe Element
     erzeugen — die Variante ist eine WERKZEUG-Einstellung, kein Elementfeld.
     Wer den Pfad von Hand zieht und wer ihn suchen laesst, will nicht
     zwangslaeufig dieselbe Sorte Band: eine eigene Zeile kostet nichts und
     haelt die beiden Werkzeuge unabhaengig. */
  variantOf: { pfad: "strasse", flaeche: "wald", objekt: "baeume", ranke: "ranke",
    terrain: "heben", marker: "ort", stempel: "", wegsuche: "strasse" },
  draw: null,
  /* A3 — Einzel- und Mehrfachauswahl nebeneinander.
     `selected` bleibt EXAKT das, was es war: das eine Element, an dem Griffe,
     Panel, Entf, Doppelklick-Punkt-Einfuegen und Zugpunkte haengen. Kein
     Aufrufer dieser Felder musste angefasst werden.
     `auswahl` ist die Liste ALLER gewaehlten Elemente. Konvention (in
     selection.js select/auswahlUmschalten durchgesetzt):
       - ed.selected ist immer das ZULETZT gewaehlte Element,
       - ed.selected ist immer das letzte Element von ed.auswahl,
       - ed.selected === null  <=>  ed.auswahl ist leer.
     Ein gewoehnlicher Klick setzt die Liste auf genau ein Element zurueck —
     wer die Mehrfachauswahl nicht benutzt, merkt von ihr nichts.
     Die Liste kann verwaiste Referenzen enthalten, wenn ein Element ausserhalb
     dieses Moduls geloescht oder die Elementliste ersetzt wird (panels.js
     Loeschknopf, history.js restore, io.js Laden). Jeder Leser filtert
     deshalb gegen S.elements, statt sich auf Aufraeumen zu verlassen. */
  selected: null,
  auswahl: [],
  // A3 — Ausrichtung beim Setzen: Vierteldrehungen (0..3) und Spiegelung.
  stempelDrehung: 0,
  stempelSpiegel: false
};

var TOOLS = [
  { id: "pfad", g: "〰", l: "Pfad", key: "1" },
  { id: "flaeche", g: "▰", l: "Fläche", key: "2" },
  { id: "objekt", g: "✿", l: "Objekt", key: "3" },
  { id: "ranke", g: "⇡", l: "Ranke", key: "4" },
  { id: "terrain", g: "⛰", l: "Terrain", key: "5" },
  { id: "auswahl", g: "➤", l: "Auswahl", key: "6" },
  /* D1 — eigener Modus statt einer Objekt-Variante: das Objekt-Werkzeug
     erzeugt Elemente (Streuung, Pools, Seeds), ein Marker ist eine Notiz.
     Gemeinsame Bedienung haetten beide nicht: kein Ziehen, kein Streuradius,
     dafuer Text und Auswahl per Klick. */
  { id: "marker", g: "⚑", l: "Marker", key: "7" },
  // A3 — Setzen von Kompositionen. Varianten = Eintraege der Bibliothek.
  { id: "stempel", g: "⧉", l: "Stempel", key: "8" },
  /* A2 — zwei Klicks, dazwischen sucht sich der Weg seinen Verlauf.
     Taste 9: 1..6 sind seit jeher belegt, 7 (Marker) und 8 (Stempel) kamen in
     D1/A3 dazu — 9 ist die naechste freie Ziffer (0 bleibt frei, onKey liest
     nur Digit/Numpad der hier eingetragenen Tasten). */
  { id: "wegsuche", g: "⤳", l: "Wegsuche", key: "9" }
];
var VARIANTS = {
  pfad: [["strasse", "Straße"], ["mauer", "Mauer"], ["fluss", "Fluss"],
         ["hecke", "Hecke / Zaun"], ["bruch", "Bruchkante"]],
  /* Die drei Kompositstrukturen stehen am ENDE der Liste, nicht zwischen den
     Bestandsvarianten: die Reihenfolge ist zugleich die Knopfreihenfolge im
     Panel, und die eingespielten Griffe der vier alten Varianten sollen bleiben,
     wo sie sind. */
  flaeche: [["wald", "Wald"], ["feld", "Feld"], ["viertel", "Viertel"], ["wiese", "Wiese"],
            ["burg", "Burg"], ["werft", "Werft"], ["kloster", "Kloster"],
            // I2: die Biomflaeche zeichnet nichts, sie faerbt und bepflanzt.
            ["biom", "Biom"]],
  objekt: [["baeume", "Bäume"], ["haeuser", "Häuser"], ["klassisch", "Klassisch"],
           ["zwergisch", "Zwergisch"], ["elfisch", "Elfisch"], ["ruinen", "Ruinen"],
           ["felsen", "Felsen"], ["werk", "Werk"], ["natur", "Kleinzeug"],
           ["wehrbau", "Wehrbau"], ["palisaden", "Palisaden"],
           ["maritim", "Schiffe & Bojen"], ["hafen", "Hafen & Ufer"],
           ["inseln", "Schwebeinseln"],
           // Runde H, Welle 3: die 164 neuen Katalog-Pools erreichbar machen.
           ["natur2", "Fels & Pilze"], ["ruinen2", "Ruinen (Bruch)"], ["arbor", "Arbor"],
           ["eis", "Eis & Schnee"], ["wueste", "Wüste"], ["moor", "Moor"],
           ["hof", "Hof & Acker"], ["handwerk", "Handwerk"], ["sakral", "Sakral"],
           ["wohnbau", "Wohnbau"], ["requisiten", "Requisiten"], ["tiere", "Tiere & Wagen"],
           ["wasserflora", "Wasserpflanzen"], ["ufer2", "Ufersaum"],
           ["schwebend", "Schwebendes"]],
  ranke: [["ranke", "Ranke"]],
  terrain: [["heben", "Anheben"], ["senken", "Absenken"], ["glaetten", "Glätten"], ["ebnen", "Einebnen"]],
  // D1: die vier Markerarten (Farbe der Stecknadel, siehe MARKER_ARTEN in store.js)
  // I4: „Beschriftung" ist die einzige Markervariante, die ein ELEMENT anlegt
  // statt einer Nadel in der flachen S.marker-Liste. Der Unterschied ist
  // gewollt und steht im Namen: eine Nadel ist eine Notiz fuer den Bauenden,
  // eine Beschriftung gehoert ins Bild und in den PNG-Export.
  marker: [["ort", "Ort"], ["gefahr", "Gefahr"], ["notiz", "Notiz"], ["arbor", "Arbor"],
    ["beschriftung", "Beschriftung"]],
  // A3: DYNAMISCH — stempelVariantenNeu() haelt die Liste an der Bibliothek.
  // Die Werte sind die Stempelnamen; panels.js baut daraus ohne Zusatzcode
  // die Variantenknoepfe, weil es diese Tabelle ohnehin schon rendert.
  stempel: []
};
var PARAMS = {
  "pfad:strasse": [
    { k: "breite", l: "Breite", min: 2, max: 16, st: 0.5, d: 6 },
    { k: "belag", l: "Belag", o: [["erde", "Erde"], ["stein", "Stein"], ["pflaster", "Pflaster"]], d: "erde" },
    { k: "haeuser", l: "Häuser am Rand", b: true, d: true },
    { k: "stil", l: "Bebauung", o: [["dorf", "Dorf"], ["klassisch", "Klassisch"],
        ["zwergisch", "Zwergisch"], ["elfisch", "Elfisch"], ["werk", "Werkstätten"],
        ["burg", "Burg"], ["schloss", "Schloss"], ["holzburg", "Holzburg"],
        ["bauern", "Bauernhof"], ["handwerk", "Handwerk"], ["kloster", "Kloster"],
        ["stadt", "Stadt"], ["nordisch", "Nordisch"], ["eis", "Eis"],
        ["wueste", "Wüste"], ["moor", "Moor"], ["arbor", "Arbor"],
        ["gemischt", "Gemischt"]], d: "dorf" },
    { k: "abstand", l: "Haus-Abstand", min: 5, max: 45, st: 1, d: 14 },
    { k: "streuung", l: "Versatz", min: 0, max: 6, st: 0.2, d: 2 }
  ],
  "pfad:mauer": [
    { k: "hoehe", l: "Höhe", min: 0.5, max: 2.5, st: 0.05, d: 1 },
    { k: "dicke", l: "Dicke", min: 0.8, max: 4, st: 0.1, d: 1.6 },
    { k: "turmAbstand", l: "Turm alle", min: 8, max: 80, st: 1, d: 26 },
    { k: "torAbstand", l: "Tor alle (0 = keins)", min: 0, max: 200, st: 5, d: 0 }
  ],
  "pfad:fluss": [
    { k: "breite", l: "Breite", min: 3, max: 30, st: 0.5, d: 9 },
    { k: "tiefe", l: "Tiefe", min: 1, max: 14, st: 0.5, d: 4 }
  ],
  "pfad:hecke": [
    { k: "stil", l: "Art", o: [["hecke", "Hecke"], ["zaun", "Zaun"]], d: "hecke" },
    { k: "hoehe", l: "Höhe", min: 0.5, max: 2.5, st: 0.05, d: 1 }
  ],
  // H6: Bruchkante — an dieser Linie reisst das Gelaende einseitig ab.
  // `seite` kommt als String aus dem Select, genBruch liest Number(p.seite).
  "pfad:bruch": [
    { k: "tiefe", l: "Absturztiefe", min: 40, max: 200, st: 5, d: 90 },
    { k: "breite", l: "Übergangszone", min: 2, max: 20, st: 0.5, d: 6 },
    { k: "zackigkeit", l: "Zackigkeit", min: 0, max: 1, st: 0.02, d: 0.5 },
    { k: "seite", l: "Abrissseite", o: [["1", "Rechts vom Pfad"], ["-1", "Links vom Pfad"]], d: "1" },
    { k: "wurzeln", l: "Wurzelvorhänge", b: true, d: true },
    { k: "truemmer", l: "Schwebende Trümmer", min: 0, max: 6, st: 1, d: 2 }
  ],
  "flaeche:wald": [
    { k: "dichte", l: "Dichte", min: 0.2, max: 2.5, st: 0.05, d: 1.1 },
    { k: "klumpen", l: "Klumpigkeit", min: 0, max: 1, st: 0.02, d: 0.55 },
    { k: "mischung", l: "Nadelanteil", min: 0, max: 1, st: 0.02, d: 0.25 },
    { k: "unterholz", l: "Unterholz", min: 0, max: 1, st: 0.02, d: 0.35 }
  ],
  "flaeche:feld": [
    { k: "drehung", l: "Reihenrichtung", min: 0, max: 180, st: 1, d: 30 },
    { k: "reihe", l: "Reihenabstand", min: 1.6, max: 9, st: 0.1, d: 3.2 },
    { k: "hoehe", l: "Wuchshöhe", min: 0.4, max: 2, st: 0.05, d: 1 },
    { k: "frucht", l: "Frucht", o: [["weizen", "Weizen"], ["kohl", "Kohl"], ["lavendel", "Lavendel"],
        ["brache", "Brache"]], d: "weizen" }
  ],
  "flaeche:viertel": [
    { k: "netz", l: "Wegenetz", o: [["raster", "Raster"], ["gebogen", "Gebogen"], ["zellen", "Zellen"],
        ["ring", "Ring"]], d: "raster" },
    { k: "block", l: "Blockgröße", min: 9, max: 45, st: 1, d: 21 },
    { k: "gasse", l: "Gassenbreite", min: 2, max: 10, st: 0.25, d: 3.5 },
    { k: "drehung", l: "Drehung", min: 0, max: 180, st: 1, d: 20 },
    { k: "dichte", l: "Bebauungsdichte", min: 0.3, max: 2.5, st: 0.05, d: 1 },
    { k: "stil", l: "Baustil", o: [["dorf", "Dorf"], ["klassisch", "Klassisch"],
        ["zwergisch", "Zwergisch"], ["elfisch", "Elfisch"], ["werk", "Werksviertel"],
        ["ruine", "Ruinen"], ["gemischt", "Gemischt"]], d: "dorf" }
  ],
  "flaeche:wiese": [
    { k: "dichte", l: "Dichte", min: 0.3, max: 2.5, st: 0.05, d: 1.2 },
    { k: "blumen", l: "Blütenanteil", min: 0, max: 1, st: 0.02, d: 0.25 }
  ],
  /* I2 — Biomflaeche. Sie erzeugt keine einzige Instanz; ihr ganzer Zweck ist
     die abgeleitete Maske, aus der terrainColor die Faerbung und genWald/
     genWiese ihre Bepflanzung ziehen. Deshalb steht sie auch nicht in der
     Kette von genFlaeche — dort faellt sie durch alle else-if und erzeugt
     nichts, genau wie eine unbekannte Variante in einer aelteren Fassung.

     `weich` ist bei 32 gedeckelt, nicht bei 64: darueber reichen die 16
     Mischstufen der Palette nicht mehr, dann wuerde die Stufung sichtbar.
     Gemessen liegen bei weich=32 rund drei Vertices auf einer Stufe. */
  "flaeche:biom": [
    { k: "biom", l: "Biom", o: biomListe(), d: "moor" },
    { k: "weich", l: "Randbreite", min: 1, max: 32, st: 1, d: 8 }
  ],
  /* --- Kompositstrukturen (generators/strukturen.js) ---------------------
     Der gezeichnete Polygonzug ist bei allen dreien mehr als eine Umrandung:
     bei der Burg IST er der Mauerring, beim Kloster geben die ersten beiden
     Punkte die Achse des Hofes, bei der Werft liefert das Gelaende darunter
     die Kaiflucht. Die Parameter beschreiben deshalb bewusst die ANLAGE
     (Mauerhoehe, Hellingen, Hofgroesse) und nicht eine Streudichte. */
  "flaeche:burg": [
    { k: "mauerhoehe", l: "Mauerhöhe", min: 0.6, max: 2, st: 0.05, d: 1 },
    { k: "turmAbstand", l: "Turm alle", min: 8, max: 60, st: 1, d: 22 },
    { k: "zwinger", l: "Zwinger (Vormauer)", b: true, d: false },
    { k: "palisade", l: "Holzburg statt Stein", b: true, d: false },
    { k: "dichte", l: "Hofbebauung", min: 0.2, max: 2.5, st: 0.05, d: 1 }
  ],
  "flaeche:werft": [
    { k: "hellingen", l: "Hellingen", min: 1, max: 4, st: 1, d: 2 },
    { k: "kai", l: "Kaimauer", b: true, d: true },
    { k: "dichte", l: "Dichte", min: 0.2, max: 2.5, st: 0.05, d: 1 }
  ],
  "flaeche:kloster": [
    // Obergrenze 2 = KLOSTER_MAX_GROESSE in strukturen.js; core/dirty.js
    // rechnet damit den Stempelaufschlag aus. Beide muessen gleich bleiben.
    { k: "groesse", l: "Hofgröße", min: 0.5, max: 2, st: 0.05, d: 1 },
    { k: "kirche", l: "Kirche", o: [["kapelle", "Kapelle"], ["kathedrale", "Kathedrale"]],
      d: "kapelle" },
    { k: "garten", l: "Kreuzgarten", min: 0, max: 1, st: 0.02, d: 0.5 }
  ],
  "objekt:*": [
    { k: "anzahl", l: "Stück pro Klick", min: 1, max: 12, st: 1, d: 1 },
    { k: "streuung", l: "Streuradius", min: 0, max: 20, st: 0.5, d: 4 },
    { k: "groesse", l: "Größe", min: 0.4, max: 2.5, st: 0.05, d: 1 },
    { k: "frei", l: "Auch auf Wegen", b: true, d: false },
    // Erzwungener Pool statt der gewichteten Gruppen-Auswahl ("" = Gruppe).
    // Statisch kuratierte Liste: POOLS wird erst beim Laden von geometry.js
    // gefüllt, dieses Schema aber schon beim Modul-Import ausgewertet —
    // die Namen sind mit den definePool-Aufrufen in generators/geometry.js
    // abgeglichen und müssen bei Umbenennungen dort mitgezogen werden.
    { k: "nurTyp", l: "Nur Typ", d: "", o: [
      ["", "(Gruppe)"],
      ["baum", "Laubbaum"], ["baum2", "Laubbaum hoch"], ["nadelbaum", "Nadelbaum"],
      ["zypresse", "Zypresse"], ["sumpfbaum", "Sumpfbaum"], ["bluetenbaum", "Blütenbaum"],
      ["busch", "Busch"],
      ["haus", "Haus"], ["hausA", "Haus A"], ["hausB", "Haus B"], ["hausC", "Haus C"],
      ["haus2", "Stadthaus"], ["villa", "Villa"], ["scheune", "Scheune"],
      ["windmuehle", "Windmühle"], ["turm", "Turm"], ["kuppel", "Kuppel"],
      ["arkade", "Arkade"], ["tempel", "Tempel"], ["tholos", "Tholos"],
      ["bogen", "Bogen"], ["saeule", "Säule"], ["mauer", "Mauer"],
      ["zwergenhalle", "Zwergenhalle"], ["schmiedeturm", "Schmiedeturm"],
      ["zwergentor", "Zwergentor"], ["elfenturm", "Elfenturm"], ["pavillon", "Pavillon"],
      ["industrie", "Industrie"], ["kran", "Kran"],
      ["brunnen", "Brunnen"], ["fass", "Fass"], ["kiste", "Kiste"],
      ["karren", "Karren"], ["laterne", "Laterne"], ["heuhaufen", "Heuhaufen"],
      ["marktstand", "Marktstand"], ["fels", "Fels"], ["blume", "Blume"],
      ["boot", "Boot"], ["steg", "Steg"],
      // Maritim (Objektkatalog Kategorie 2) und die Wasserbauten aus
      // Kategorie 7. "(Wasser)" markiert die Pools, die tryPlaceWasser
      // braucht: sie erscheinen NUR mit der Variante "Schiffe & Bojen", weil
      // jede andere Variante ueber tryPlace laeuft und dort alles unterhalb
      // von WATER + 0.35 verwirft. "(Ufer)" heisst umgekehrt: nur mit
      // "Hafen & Ufer" sitzen sie richtig und drehen sich zum Wasser.
      ["fischerboot", "Fischerboot (Wasser)"], ["kutter", "Kutter (Wasser)"],
      ["kogge", "Kogge (Wasser)"], ["dreimaster", "Dreimaster (Wasser)"],
      ["ruderschiff", "Ruderschiff (Wasser)"], ["floss", "Floß (Wasser)"],
      ["wrack", "Wrack (Wasser)"], ["boje", "Boje (Wasser)"],
      ["bake", "Bake (Wasser)"],
      ["steinbruecke", "Steinbrücke (Wasser)"], ["holzbruecke", "Holzbrücke (Wasser)"],
      ["kaimauer", "Kaimauer (Ufer)"], ["kaitreppe", "Kaitreppe (Ufer)"],
      ["kaikran", "Kaikran (Ufer)"], ["anleger", "Anleger (Ufer)"],
      ["bootshaus", "Bootshaus (Ufer)"], ["slipbahn", "Slipbahn (Ufer)"],
      ["werfthalle", "Werfthalle (Ufer)"], ["helling", "Helling (Ufer)"],
      ["leuchtturm", "Leuchtturm (Ufer)"], ["leuchtfeuer", "Leuchtfeuer (Ufer)"],
      ["hafenlaterne", "Hafenlaterne (Ufer)"], ["netzgestell", "Netzgestell (Ufer)"],
      ["fischtrockner", "Fischtrockner (Ufer)"], ["reusenstapel", "Reusenstapel (Ufer)"],
      ["salzgarten", "Salzgarten (Ufer)"], ["uferdamm", "Uferdamm (Ufer)"],
      ["kanalschleuse", "Kanalschleuse (Ufer)"],
      ["tauhaufen", "Tauhaufen"], ["aquaedukt", "Aquädukt"],
      ["aquaeduktkopf", "Aquädukt-Kopf"]
    ] }
  ],
  // Eigenes Variantenschema: schemaKey prueft ERST "kind:variant", dann den
  // Wildcard "kind:*" — ein exakter Eintrag hier deckt die Variante also
  // vollstaendig ab, und toolParams/defaultsFor laufen ohne Sonderfall
  // darueber. Darum bekommen die Schwebeinseln ihre Sonderfelder (hoehe,
  // baeumchen) NICHT im "objekt:*"-Schema, sondern hier; frei/nurTyp fehlen
  // bewusst — genInseln (objects.js) nutzt weder Bodenregeln noch Pooltabellen.
  "objekt:inseln": [
    { k: "anzahl", l: "Inseln pro Klick", min: 1, max: 6, st: 1, d: 2 },
    { k: "hoehe", l: "Schwebehöhe", min: 10, max: 60, st: 1, d: 24 },
    { k: "groesse", l: "Größe", min: 0.5, max: 2, st: 0.05, d: 1 },
    { k: "streuung", l: "Streuradius", min: 5, max: 40, st: 0.5, d: 18 },
    { k: "baeumchen", l: "Bäumchen obendrauf", b: true, d: true }
  ],
  /* I4 — Kartenbeschriftung. `text` braucht ein Textfeld; paramRow hat dafuer
     den Zweig `def.txt` bekommen. Das Klickziel steht bewusst NICHT im Schema:
     es ist ein verschachteltes Objekt ({art, ref}), und das Schema kennt nur
     Skalare. Die Zielzeile baut ui/panels.js von Hand und laesst sie durch
     zielPruefen laufen, bevor sie ins Element geht. */
  "marker:beschriftung": [
    { k: "text", l: "Text", txt: true, d: "" },
    { k: "klasse", l: "Klasse", d: "ort", o: [["ort", "Ort"], ["region", "Region"],
      ["gewaesser", "Gewässer"], ["gebirge", "Gebirge"], ["gefahr", "Gefahr"],
      ["arbor", "Arbor"]] },
    { k: "groesse", l: "Größe", min: 0.4, max: 3, st: 0.05, d: 1 }
  ],
  "ranke:ranke": [
    { k: "hoehe", l: "Höhe", min: 60, max: 400, st: 5, d: 190 },
    { k: "straenge", l: "Stränge", min: 3, max: 5, st: 1, d: 4 },
    { k: "dicke", l: "Dicke", min: 0.5, max: 2.5, st: 0.05, d: 1 },
    // H4.1: Endradius relativ zum Fussradius. 0.45 ist die frueher fest
    // verdrahtete Verjuengung — als Default rendert jede Bestandskarte
    // unveraendert weiter.
    { k: "dickeOben", l: "Dicke oben (Anteil)", min: 0.2, max: 1, st: 0.05, d: 0.45 },
    { k: "stil", l: "Stil", o: [["geflochten", "Geflochten"], ["glatt", "Glatt"]], d: "geflochten" },
    { k: "steigung", l: "Steigung (Ø je Windung)", min: 1.2, max: 8, st: 0.1, d: 2.8 },
    // H4.1: Windung ueber die Hoehe interpoliert. 0 = "wie Steigung" — ein
    // Sentinel statt eines festen Zahlwerts, weil defaultsFor fehlende
    // Parameter beim Laden ergaenzt: ein fester Default wuerde jede
    // Bestandskarte mit abweichender `steigung` umformen.
    { k: "windungUnten", l: "Windung unten (0 = wie Steigung)", min: 0, max: 8, st: 0.1, d: 0 },
    { k: "windungOben", l: "Windung oben (0 = wie Steigung)", min: 0, max: 8, st: 0.1, d: 0 },
    // H4.3 (Kanon): Neigung zur Kartenmitte, dem Apfelkern. 0 = senkrecht.
    { k: "kernzug", l: "Kernneigung zur Mitte", min: 0, max: 1, st: 0.05, d: 0 },
    { k: "blattgroesse", l: "Blattgröße", min: 0.5, max: 1.8, st: 0.05, d: 1 },
    { k: "plateaus", l: "Blattplateaus", min: 0, max: 6, st: 1, d: 3 },
    { k: "plateau", l: "Plateaugröße", min: 0.5, max: 2, st: 0.05, d: 1 },
    { k: "staedtchen", l: "Städtchen darauf", b: true, d: true },
    { k: "inseln", l: "Schwebeinseln", min: 0, max: 4, st: 1, d: 2 },
    { k: "luftwurzeln", l: "Luftwurzeln", b: true, d: false },
    // "" = alter hartkodierter Gebaeudemix (byteidentisch fuer Bestandskarten);
    // die uebrigen Werte sind KULTUR-Tabellen aus generators/objects.js.
    { k: "stadtStil", l: "Baustil Städtchen", o: [["", "Klassisch kompakt"],
        ["dorf", "Dorf"], ["klassisch", "Klassisch"], ["zwergisch", "Zwergisch"],
        ["elfisch", "Elfisch"], ["werk", "Werkstätten"], ["ruine", "Ruinen"],
        ["burg", "Burg"], ["schloss", "Schloss"], ["holzburg", "Holzburg"],
        // Welle 3: neue KULTUR-Stile aus dem Objektkatalog
        ["bauern", "Bauernhof"], ["handwerk", "Handwerk"], ["kloster", "Kloster"],
        ["stadt", "Stadt"], ["nordisch", "Nordisch"], ["eis", "Eis"],
        ["wueste", "Wüste"], ["moor", "Moor"], ["arbor", "Arbor"],
        ["gemischt", "Gemischt"]], d: "" },
    { k: "stadtDichte", l: "Stadtdichte", min: 0, max: 2, st: 0.1, d: 1 },
    // genBlattstadt: "" = wie bisher. Sentinel statt inhaltlichem Default,
    // weil defaultsFor fehlende Parameter beim Laden ergaenzt — jeder echte
    // Wert wuerde Bestandskarten (auch die von welt.js erzeugten) umbauen.
    { k: "stadtNetz", l: "Gassennetz Blattstadt", o: [["", "Wie bisher"],
        ["aus", "Ohne Gassen"], ["einfach", "Hauptachse + Queräste"],
        ["gassen", "Gassennetz mit Randring"]], d: "" },
    { k: "stadtRand", l: "Geländer am Blattrand", b: true, d: false },
    { k: "stadtBloecke", l: "Blocktiefe Blattstadt", min: 10, max: 60, st: 2, d: 20 },
    { k: "treppe", l: "Wendeltreppe", b: true, d: false },
    { k: "bruecken", l: "Hängebrücken", b: true, d: false },
    // H4.4: relative Höhe, ab der mehrere Fußpunkte zu einer Ranke
    // zusammenwachsen. Bei nur einem Fußpunkt wirkungslos — und mehr als
    // einen Fußpunkt kann keine Bestandskarte haben.
    { k: "vereinigung", l: "Vereinigung ab Höhe", min: 0.15, max: 0.8, st: 0.05, d: 0.35 }
  ],
  "terrain:*": [
    { k: "radius", l: "Pinselradius", min: 2, max: 40, st: 0.5, d: 12 },
    { k: "staerke", l: "Stärke", min: 0.05, max: 3, st: 0.05, d: 0.8 }
  ]
};
/* ==========================================================================
   A2 — Wegsuche: Varianten und Parameter als VERWEIS auf die Pfad-Schemata

   Das Werkzeug erzeugt am Ende ein ganz gewoehnliches `pfad`-Element (nur die
   Punktliste kommt aus sucheWeg statt aus der Hand). Es darf deshalb kein
   zweites, eigenes Schema fuehren: waechst "pfad:strasse" um einen Parameter,
   muss die Wegsuche ihn ohne Zutun mitbekommen.

   Deshalb dieselben ARRAY-OBJEKTE, nicht Kopien — und deshalb ausserhalb des
   Objektliterals: innerhalb koennte `PARAMS["pfad:strasse"]` noch nicht
   gelesen werden, das Literal ist bis zur schliessenden Klammer nicht an
   PARAMS gebunden.

   Angeboten werden nur die drei Varianten, deren Verlauf sich ueber das
   Gelaende suchen laesst: Straße, Fluss, Hecke. Mauer und Bruchkante fehlen
   bewusst — eine Mauer folgt einer Absicht, keiner guenstigen Steigung, und
   eine Bruchkante ist ein Terraineingriff. Beide bleiben Sache des
   Pfad-Werkzeugs; die Variante eines fertigen Elements laesst sich im Panel
   ohnehin jederzeit umstellen.
   ========================================================================== */
VARIANTS.wegsuche = [["strasse", "Straße"], ["fluss", "Fluss"], ["hecke", "Hecke / Zaun"]];
PARAMS["wegsuche:strasse"] = PARAMS["pfad:strasse"];
PARAMS["wegsuche:fluss"] = PARAMS["pfad:fluss"];
PARAMS["wegsuche:hecke"] = PARAMS["pfad:hecke"];

/* ==========================================================================
   J3 — KARTENWEITE Parameter

   PARAMS beschreibt Parameter EINES ELEMENTS. Die kartenweiten Einstellungen
   (Weltseed, Biom, Kartengroesse, Tageszeit, Wetter) sitzen dagegen nicht im
   Elementschema, sondern als feste Bedienelemente in der unteren Leiste von
   terra/index.html — und index.html gehoert dieser Runde nicht.

   Deshalb hier ein eigenes, kleines Schema in derselben Schreibweise wie
   PARAMS (k/l/o/d), das ui/panels.js mit paramRow rendern kann. Der Wert
   selbst liegt in `S.sprachfamilie`; core/store.js gehoert dieser Runde
   ebenfalls nicht, das Feld fehlt also in der Deklaration von S und entsteht
   erst beim ersten Setzen. Alle Leser (namen.js familieDerKarte, das Objekt
   unten) behandeln "fehlt" wie "auto" — es gibt keinen Zustand, in dem das
   auffiele.

   Nachzuziehen, wenn die fremden Dateien wieder offen sind (siehe Bericht):
     core/store.js  in S ergaenzen:  sprachfamilie: "auto",
     editor/io.js   speichern:       data.sprachfamilie = S.sprachfamilie;
                    lesen (tolerant, wie `biom`):
                      sprachfamilie: typeof d.sprachfamilie === "string"
                        ? d.sprachfamilie : "auto"
                    uebernehmen:     S.sprachfamilie = karte.sprachfamilie;
   Bis dahin ueberlebt die Einstellung die Sitzung, aber nicht das Speichern —
   ohne Folgen fuer bereits vergebene Namen, denn die stehen als Text in
   params.name bzw. im Markertext und werden mitgespeichert.
   ========================================================================== */
var KARTE_PARAMS = [
  { k: "sprachfamilie", l: "Sprachfamilie der Karte", o: sprachfamilien(), d: "auto" }
];

/* --- Erosion (I3) --------------------------------------------------------
   Fuenf Regler von zweiundzwanzig Werten aus EROSION_STANDARD. Die Auswahl ist
   nicht willkuerlich: Es sind die, deren Wirkung man im Bild ohne Erklaerung
   erkennt. Kapazitaet, Traegheit und Verdunstung aendern das Ergebnis
   ebenfalls, aber niemand kann vorhersagen wie — solche Regler stiften nur
   Ratlosigkeit und stehen deshalb nicht im Panel. Wer sie braucht, ruft
   starteErosion mit eigenen Werten.

   Sitzungswerte, bewusst NICHT im Speicherformat: Erosion ist eine einmalige
   Handlung, ihr Ergebnis steckt danach im Hoehenfeld (Format v3 als
   `hoehenDelta`). Die Regler noch einmal mitzuspeichern hiesse, einen Zustand
   zu fuehren, den nichts liest. */
var EROSION_PARAMS = [
  { k: "staerke", l: "Stärke", min: 0, max: 2, st: 0.05, d: 1 },
  { k: "tropfenDichte", l: "Tropfen je Zelle", min: 0, max: 0.15, st: 0.005, d: 0.05 },
  { k: "merkmalGroesse", l: "Rinnenbreite", min: 1, max: 6, st: 0.5, d: 2 },
  { k: "haerteVarianz", l: "Härtevarianz", min: 0, max: 0.9, st: 0.05, d: 0.35 },
  { k: "boeschung", l: "Böschungswinkel", min: 22, max: 52, st: 1, d: 34 }
];

var erosionRegler = {};
(function () {
  for (var i = 0; i < EROSION_PARAMS.length; i++) {
    erosionRegler[EROSION_PARAMS[i].k] = EROSION_PARAMS[i].d;
  }
})();

/* Ein Objekt mit Zugriffsfaellen statt eines schlichten Verweises auf S:
   paramRow (ui/panels.js) liest und schreibt `obj[def.k]` — mit diesem Objekt
   landet der Schreibzugriff direkt in S, ohne dass panels.js davon wissen
   muss, und ohne eine zweite Kopie des Wertes, die auseinanderlaufen koennte. */
var karteParams = {};
Object.defineProperty(karteParams, "sprachfamilie", {
  enumerable: true,
  get: function () { return (typeof S.sprachfamilie === "string") ? S.sprachfamilie : "auto"; },
  set: function (v) { setzeSprachfamilie(v); }
});

/** Die Familie, die auf dieser Karte tatsaechlich gilt — "auto" aufgeloest. */
function aktiveSprachfamilie() { return familieDerKarte(); }

function schemaKey(kind, variant) {
  if (PARAMS[kind + ":" + variant]) return kind + ":" + variant;
  return kind + ":*";
}

function defaultsFor(kind, variant) {
  var s = PARAMS[schemaKey(kind, variant)] || [], o = {};
  for (var i = 0; i < s.length; i++) o[s[i].k] = s[i].d;
  return o;
}

var toolParams = {};
(function () {
  for (var kind in VARIANTS) {
    for (var i = 0; i < VARIANTS[kind].length; i++) {
      var v = VARIANTS[kind][i][0];
      toolParams[kind + ":" + v] = defaultsFor(kind, v);
    }
  }
  // Leere Stempelbibliothek: ed.variantOf.stempel ist "" und VARIANTS.stempel
  // enthaelt (noch) nichts. panels.js liest toolParams[tool + ":" + variante]
  // vorbehaltlos — der Eintrag muss also auch fuer den Leerfall existieren.
  toolParams["stempel:"] = {};
})();
/* Fehlende Eintraege werden nachgezogen statt vorausgesetzt: die
   Stempelvarianten entstehen erst zur Laufzeit (Bibliothek). Fuer alle
   statischen Werkzeuge ist der Eintrag laengst da — der Zweig greift dort nie
   und das Verhalten bleibt unveraendert. */
function curParams() {
  var k = ed.tool + ":" + ed.variantOf[ed.tool];
  if (!toolParams[k]) toolParams[k] = defaultsFor(ed.tool, ed.variantOf[ed.tool]);
  return toolParams[k];
}

function copyParams(o) { var c = {}; for (var k in o) c[k] = o[k]; return c; }

function snapPt(p) {
  if (!S.snap) return { x: p.x, z: p.z };
  return { x: Math.round(p.x / 2) * 2, z: Math.round(p.z / 2) * 2 };
}

function finishDraw() {
  if (!ed.draw) return;
  var min = ed.draw.kind === "flaeche" ? 3 : 2;
  if (ed.draw.points.length < min) { cancelDraw(); return; }
  pushUndo();
  var el = mkElement(ed.draw.kind, ed.draw.variant, ed.draw.points.slice(),
    copyParams(toolParams[ed.draw.kind + ":" + ed.draw.variant]), nextSeed());
  S.elements.push(el);
  ed.draw = null;
  clearPreview();
  commit(el, isHeavy(el));
  select(el);
  updateHint();
}

function cancelDraw() {
  ed.draw = null;
  clearPreview();
  rebuildHandles();
  updateHint();
}

function setTool(id) {
  if (ed.draw && ed.draw.kind !== id) cancelDraw();
  ed.tool = id;
  // Die Mehrfachauswahl verfaellt mit der Einzelauswahl — sie ist immer nur
  // so lange gueltig, wie ed.selected es ist (Konvention oben).
  if (id !== "auswahl" && ed.selected) { ed.selected = null; ed.auswahl.length = 0; rebuildHandles(); }
  // D1: die Markerauswahl gehoert zum Markerwerkzeug; sonst zeigte eine
  // hervorgehobene Nadel eine Auswahl an, die Entf gar nicht mehr trifft.
  if (id !== "marker") waehleMarker(-1);
  var rail = document.getElementById("rail");
  for (var i = 0; i < rail.children.length; i++) {
    rail.children[i].classList.toggle("on", rail.children[i].dataset.id === id);
  }
  if (id !== "terrain") brushRing.visible = false;
  buildPanel();
  updateHint();
}

/* ==========================================================================
   A3 — Stempelbibliothek

   Speicherort ist localStorage (ueberdauert die Sitzung, ist an den Browser
   gebunden); dieselbe Liste wandert optional als Kartenfeld `stempel` mit der
   Datei (io.js) und wird beim Laden in die Bibliothek uebernommen. Damit ist
   ein Stempel sowohl persoenliches Werkzeug als auch teilbarer Bestandteil
   einer Karte, ohne zwei Datenmodelle.
   ========================================================================== */
var STEMPEL_KEY = "terra.stempel.v1";

function stempelIndex(name) {
  for (var i = 0; i < S.stempel.length; i++) if (S.stempel[i].name === name) return i;
  return -1;
}

/** Bibliothek -> VARIANTS/toolParams/ed.variantOf angleichen. Muss nach JEDER
 *  Aenderung der Liste laufen, sonst zeigt panels.js Knoepfe fuer Stempel, die
 *  es nicht mehr gibt (oder greift auf einen fehlenden toolParams-Eintrag zu). */
function stempelVariantenNeu() {
  VARIANTS.stempel.length = 0;
  for (var i = 0; i < S.stempel.length; i++) {
    var n = S.stempel[i].name;
    VARIANTS.stempel.push([n, n]);
    if (!toolParams["stempel:" + n]) toolParams["stempel:" + n] = {};
  }
  if (stempelIndex(ed.variantOf.stempel) < 0)
    ed.variantOf.stempel = S.stempel.length ? S.stempel[0].name : "";
}

/** Bibliothek aus dem Browser-Speicher lesen. Kaputte Eintraege werden still
 *  verworfen — ein defekter Speicherstand darf den Editor nicht blockieren. */
function stempelBibliothekLaden() {
  S.stempel.length = 0;
  var roh = speicherLesen(STEMPEL_KEY);
  if (roh) {
    try {
      var arr = JSON.parse(roh);
      if (Array.isArray(arr)) {
        for (var i = 0; i < arr.length; i++) if (stempelGueltig(arr[i])) S.stempel.push(arr[i]);
      }
    } catch (e) { /* unlesbar: leere Bibliothek, kein Absturz */ }
  }
  stempelVariantenNeu();
}

function stempelBibliothekSichern() {
  var ok = speicherSchreiben(STEMPEL_KEY, JSON.stringify(S.stempel));
  stempelVariantenNeu();
  return ok;
}

/** Stempel aus einer geladenen Karte in die Bibliothek uebernehmen.
 *  Gleicher Name = ersetzen (der Kartenstand gewinnt, weil er der explizit
 *  geladene ist). Liefert die Anzahl uebernommener Stempel. */
function stempelUebernehmen(liste) {
  var n = 0;
  if (Array.isArray(liste)) {
    for (var i = 0; i < liste.length; i++) {
      if (!stempelGueltig(liste[i])) continue;
      var k = stempelIndex(liste[i].name);
      if (k >= 0) S.stempel[k] = liste[i]; else S.stempel.push(liste[i]);
      n++;
    }
  }
  if (n) stempelBibliothekSichern(); else stempelVariantenNeu();
  return n;
}

/** Die aktuell gewaehlten, noch existierenden Elemente (siehe Konvention bei
 *  ed.auswahl: die Liste darf verwaiste Referenzen enthalten). */
function auswahlElemente() {
  var out = [];
  for (var i = 0; i < ed.auswahl.length; i++)
    if (S.elements.indexOf(ed.auswahl[i]) >= 0) out.push(ed.auswahl[i]);
  return out;
}

/**
 * Erzeugt aus der aktuellen Auswahl einen Stempel und legt ihn in der
 * Bibliothek ab. Anker ist die Mitte der Punkt-Huellbox: sie liegt auch dann
 * mitten in der Komposition, wenn ein Element weit ausgreift (der erste Punkt
 * des ersten Elements taete das nicht — der Stempel haenge dann schief am
 * Mauszeiger). Liefert den Stempel oder null.
 */
function stempelErzeugen(name) {
  var sel = auswahlElemente();
  if (!sel.length || typeof name !== "string" || !name.trim()) return null;
  var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  var i, p;
  for (i = 0; i < sel.length; i++) {
    for (p = 0; p < sel[i].points.length; p++) {
      var q = sel[i].points[p];
      if (q.x < minX) minX = q.x;
      if (q.x > maxX) maxX = q.x;
      if (q.z < minZ) minZ = q.z;
      if (q.z > maxZ) maxZ = q.z;
    }
  }
  if (minX > maxX) return null;                 // Auswahl ohne Punkte
  var anker = { x: (minX + maxX) * 0.5, z: (minZ + maxZ) * 0.5 };
  var elemente = [];
  for (i = 0; i < sel.length; i++) {
    var e = sel[i], pts = [];
    for (p = 0; p < e.points.length; p++)
      pts.push({ x: e.points[p].x - anker.x, z: e.points[p].z - anker.z });
    elemente.push({
      kind: e.kind, variant: e.variant, points: pts,
      // Tiefe Kopie: params kann verschachtelt sein (Ranken tragen
      // params.zugpunkte als Array). Eine flache Kopie liesse den Stempel und
      // das Originalelement dieselbe Zugpunktliste teilen.
      params: JSON.parse(JSON.stringify(e.params || {}))
      // KEIN seed: siehe Kommentar zum Datenmodell in core/store.js.
    });
  }
  var st = { name: name.trim(), anker: anker, elemente: elemente };
  var k = stempelIndex(st.name);
  if (k >= 0) S.stempel[k] = st; else S.stempel.push(st);
  ed.variantOf.stempel = st.name;
  stempelBibliothekSichern();
  return st;
}

/** Aktuell im Werkzeug gewaehlter Stempel (oder der erste, oder null). */
function aktuellerStempel() {
  var k = stempelIndex(ed.variantOf.stempel);
  if (k >= 0) return S.stempel[k];
  return S.stempel.length ? S.stempel[0] : null;
}

/* Exakte Vierteldrehungen als Tabelle statt ueber Math.cos/sin: 90° liefert
   dort 6.1e-17 statt 0 und verschoebe jeden Punkt um einen Rundungsrest —
   bei einem Werkzeug, dessen Ergebnis gespeichert und wieder geladen wird,
   ist das vermeidbarer Dreck. */
var VIERTEL_COS = [1, 0, -1, 0], VIERTEL_SIN = [0, 1, 0, -1];

/* Punkte lassen sich exakt drehen und spiegeln, RICHTUNGSPARAMETER nur
   sinngemaess — sie werden hier mitgezogen, weil ein gedrehtes Viertel mit
   ungedrehtem Gassenraster sonst sichtbar quer zur Komposition steht.
     drehung  Winkel in Grad, Wertebereich 0..180 (Feldreihen, Viertelraster):
              Spiegelung kippt ihn (180 - a), Drehung addiert q*90.
     seite    Abrissseite der Bruchkante, "1"/"-1" relativ zur Laufrichtung:
              nur die Spiegelung dreht die Haendigkeit um.
   Alle uebrigen Parameter sind richtungsfrei. */
function richtungDrehen(par, q, sp) {
  if (Number.isFinite(par.drehung)) {
    var a = sp < 0 ? 180 - par.drehung : par.drehung;
    par.drehung = ((a + q * 90) % 180 + 180) % 180;
  }
  if (sp < 0 && (par.seite === "1" || par.seite === "-1"))
    par.seite = par.seite === "1" ? "-1" : "1";
}

/**
 * Setzt einen Stempel an (pos.x, pos.z) — mit ed.stempelDrehung /
 * ed.stempelSpiegel und IMMER frischen Seeds, damit dieselbe Komposition nie
 * zweimal identisch aussieht. Terrain wird bewusst nicht angefasst.
 * Der Aufrufer setzt den Undo-Punkt (pushUndo) VOR dem Aufruf.
 * Liefert die Anzahl gesetzter Elemente.
 */
function stempelSetzen(st, pos) {
  if (!st || !st.elemente || !st.elemente.length) return 0;
  var q = ((ed.stempelDrehung % 4) + 4) % 4;
  var ca = VIERTEL_COS[q], sa = VIERTEL_SIN[q], sp = ed.stempelSpiegel ? -1 : 1;
  var neu = [], heavy = false, i;
  for (i = 0; i < st.elemente.length; i++) {
    var se = st.elemente[i], pts = [];
    for (var p = 0; p < se.points.length; p++) {
      // erst spiegeln (an der z-Achse), dann drehen, dann verschieben
      var rx = se.points[p].x * sp, rz = se.points[p].z;
      pts.push({ x: pos.x + rx * ca - rz * sa, z: pos.z + rx * sa + rz * ca });
    }
    var par = JSON.parse(JSON.stringify(se.params || {}));
    richtungDrehen(par, q, sp);
    var el = mkElement(se.kind, se.variant, pts, par, nextSeed());
    S.elements.push(el);
    neu.push(el);
    if (isHeavy(el)) heavy = true;
  }
  // Ein einziger schwerer Commit fuer die ganze Komposition: commit(null,true)
  // baut Fluesse, Korridore, Terrain und alle Elemente neu — je Element
  // einzeln waere derselbe Vollaufbau mehrfach.
  if (heavy) commit(null, true);
  else for (i = 0; i < neu.length; i++) commit(neu[i], false);
  // Die frisch gesetzte Gruppe ist die neue Auswahl (Konvention: ed.selected
  // ist das letzte Element der Liste) — man kann sofort weiterarbeiten.
  ed.auswahl.length = 0;
  for (i = 0; i < neu.length; i++) ed.auswahl.push(neu[i]);
  ed.selected = neu.length ? neu[neu.length - 1] : null;
  rebuildHandles();
  buildPanel();
  return neu.length;
}

// Bibliothek beim Modulstart lesen — vor buildRail/buildPanel in main.js, die
// Varianten stehen dadurch beim ersten Aufbau des Panels bereits.
stempelBibliothekLaden();

export { TOOLS, VARIANTS, PARAMS, KARTE_PARAMS, karteParams, aktiveSprachfamilie,
  EROSION_PARAMS, erosionRegler,
  schemaKey, defaultsFor, toolParams, curParams,
  copyParams, snapPt, finishDraw, cancelDraw, setTool,
  auswahlElemente, stempelErzeugen, stempelSetzen, aktuellerStempel,
  stempelUebernehmen, stempelBibliothekLaden, stempelBibliothekSichern };
