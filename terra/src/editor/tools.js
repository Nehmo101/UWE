// Werkzeuge: Definitionen, Parameter-Schemata, aktiver Zustand, Zeichnen-Abschluss.
import { S, mkElement, nextSeed } from '../core/store.js';
import { commit, isHeavy } from '../core/dirty.js';
import { pushUndo } from './history.js';
import { clearPreview, setPreview, rebuildHandles, select, brushRing } from './selection.js';
import { buildPanel, updateHint } from '../ui/panels.js';

/** Aktiver Werkzeug-Zustand (frueher lose Globals). */
export const ed = {
  tool: "pfad",
  variantOf: { pfad: "strasse", flaeche: "wald", objekt: "baeume", ranke: "ranke", terrain: "heben" },
  draw: null,
  selected: null
};

var TOOLS = [
  { id: "pfad", g: "〰", l: "Pfad", key: "1" },
  { id: "flaeche", g: "▰", l: "Fläche", key: "2" },
  { id: "objekt", g: "✿", l: "Objekt", key: "3" },
  { id: "ranke", g: "⇡", l: "Ranke", key: "4" },
  { id: "terrain", g: "⛰", l: "Terrain", key: "5" },
  { id: "auswahl", g: "➤", l: "Auswahl", key: "6" }
];
var VARIANTS = {
  pfad: [["strasse", "Straße"], ["mauer", "Mauer"], ["fluss", "Fluss"],
         ["hecke", "Hecke / Zaun"], ["bruch", "Bruchkante"]],
  flaeche: [["wald", "Wald"], ["feld", "Feld"], ["viertel", "Viertel"], ["wiese", "Wiese"]],
  objekt: [["baeume", "Bäume"], ["haeuser", "Häuser"], ["klassisch", "Klassisch"],
           ["zwergisch", "Zwergisch"], ["elfisch", "Elfisch"], ["ruinen", "Ruinen"],
           ["felsen", "Felsen"], ["werk", "Werk"], ["natur", "Kleinzeug"],
           ["wehrbau", "Wehrbau"], ["palisaden", "Palisaden"],
           ["maritim", "Schiffe & Bojen"], ["hafen", "Hafen & Ufer"],
           ["inseln", "Schwebeinseln"]],
  ranke: [["ranke", "Ranke"]],
  terrain: [["heben", "Anheben"], ["senken", "Absenken"], ["glaetten", "Glätten"], ["ebnen", "Einebnen"]]
};
var PARAMS = {
  "pfad:strasse": [
    { k: "breite", l: "Breite", min: 2, max: 16, st: 0.5, d: 6 },
    { k: "belag", l: "Belag", o: [["erde", "Erde"], ["stein", "Stein"], ["pflaster", "Pflaster"]], d: "erde" },
    { k: "haeuser", l: "Häuser am Rand", b: true, d: true },
    { k: "stil", l: "Bebauung", o: [["dorf", "Dorf"], ["klassisch", "Klassisch"],
        ["zwergisch", "Zwergisch"], ["elfisch", "Elfisch"], ["werk", "Werkstätten"],
        ["burg", "Burg"], ["schloss", "Schloss"], ["holzburg", "Holzburg"],
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
        ["gemischt", "Gemischt"]], d: "" },
    { k: "stadtDichte", l: "Stadtdichte", min: 0, max: 2, st: 0.1, d: 1 },
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
})();
function curParams() { return toolParams[ed.tool + ":" + ed.variantOf[ed.tool]]; }

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
  if (id !== "auswahl" && ed.selected) { ed.selected = null; rebuildHandles(); }
  var rail = document.getElementById("rail");
  for (var i = 0; i < rail.children.length; i++) {
    rail.children[i].classList.toggle("on", rail.children[i].dataset.id === id);
  }
  if (id !== "terrain") brushRing.visible = false;
  buildPanel();
  updateHint();
}


export { TOOLS, VARIANTS, PARAMS, schemaKey, defaultsFor, toolParams, curParams,
  copyParams, snapPt, finishDraw, cancelDraw, setTool };
