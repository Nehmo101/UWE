// Rechtes Panel, Werkzeugleiste, Hinweiszeile, Toast, Statusanzeige und das
// HTML-Overlay der Markerbeschriftungen.
import { Vector3 } from 'three';
import { S, hydrate, hydrateMarker, KARTE, VW, mkElement, nextSeed,
  speicherLesen, speicherSchreiben, zufallsWeltSeed } from '../core/store.js';
import { clamp } from '../core/rng.js';
import { instanceTotal, schattenAnzahl } from '../core/pools.js';
import { ed, TOOLS, VARIANTS, PARAMS, KARTE_PARAMS, karteParams, aktiveSprachfamilie,
  EROSION_PARAMS, erosionRegler, nurTypOptionen,
  schemaKey, defaultsFor, toolParams, setTool,
  genZeichenMarker,
  auswahlElemente, stempelErzeugen, aktuellerStempel }
  from '../editor/tools.js';
// I3: der Erosionstreiber. Zyklusfrei nur in DIESER Richtung — erosion-lauf.js
// haengt an world/, core/ und history.js und importiert nichts aus ui/.
import { starteErosion, brichErosionAb, erosionLaeuft, setzeErosionAnzeige }
  from '../editor/erosion-lauf.js';
// I4: Zielpruefung der Beschriftung. beschriftung.js haengt nur an three und
// core/ — kein Zyklus.
import { zielPruefen, anPfadPruefen } from './beschriftung.js';
// I2: Biom-Ableitung. biomfeld.js haengt nur an core/ — zyklusfrei.
import { biomeVorschlagen } from '../world/biomfeld.js';
import { base, abfluss, genBase } from '../world/terrain.js';
import { commit, isHeavy, deleteElement, regenElement, rebuildAll } from '../core/dirty.js';
import { pushUndo } from '../editor/history.js';
import { rebuildHandles, clearPreview, getMarkerAuswahl, rebuildMarker,
  beschriftungenAktualisieren } from '../editor/selection.js';
// F4: der Aufnahme-Modus ist ein Kamerazustand, kein Werkzeug — die Leiste
// zeigt ihn trotzdem an, weil sie der einzige Ort ist, an dem ein Zustand mit
// Tastenkuerzel sichtbar wird. Zyklusfrei: camera.js importiert nichts aus ui/.
import { camera, cam, istAufnahme, setAufnahme } from '../editor/camera.js';
import { heightAt } from '../world/terrain.js';
import { getRenderInfo } from '../render/pipeline.js';
/* Bedienungsrunde (Asset-Auswahl): der visuelle Katalog ersetzt das rohe
   „Nur Typ"-Select. Zyklusfrei — objekt-katalog.js importiert nur three und
   core/pools.js; die beschriftete Optionsliste kommt weiter aus tools.js. */
import { baueObjektKatalog } from './objekt-katalog.js';
// A1: der Weltgenerator. Zyklusfrei — welt.js importiert nur core/, world/ und
// generators/ (rng, store, terrain, objects, vines, wegsuche) und nichts aus
// editor/ oder ui/. Der Einsetzweg darf deshalb hier stehen.
import { erzeugeWelt } from '../generators/welt.js';
// J3: der Namensgenerator. Gleiche Begruendung wie oben — namen.js haengt nur
// an core/ und world/ und importiert nichts aus editor/ oder ui/.
import { nameFuer, sammleNamen } from '../generators/namen.js';

var panelEl = null;
export function initPanels() {
  panelEl = document.getElementById("panel");
  baueWeltKnopf();
  baueNeueWeltKnopf();
  setzeErosionAnzeige(zeigeErosionFortschritt);
}

/* ==========================================================================
   „Welt würfeln" (A1)

   Der Knopf sitzt in der unteren Leiste bei den anderen Kartenaktionen
   (Speichern / Laden / PNG) und wird von hier aus eingehaengt, weil
   terra/index.html in dieser Runde nicht angefasst wird — ein zur Laufzeit
   erzeugter Knopf ist an dieser Stelle das kleinere Uebel als eine zusaetzlich
   angefasste Datei. Er steht VOR "Speichern", weil er zur Gruppe "was mit der
   ganzen Karte passiert" gehoert.
   ========================================================================== */
function baueWeltKnopf() {
  var bar = document.getElementById("bar");
  if (!bar || document.getElementById("weltBtn")) return;
  var b = el("button", null, "🎲 Welt würfeln");
  b.id = "weltBtn";
  b.title = "Erzeugt aus dem Weltseed eine vollständige Karte: Flüsse, Siedlungen, "
    + "Straßen, Wälder und Ranken. Ersetzt alle vorhandenen Elemente.";
  b.addEventListener("click", weltWuerfeln);
  var vor = document.getElementById("saveBtn");
  if (vor && vor.parentNode === bar) bar.insertBefore(b, vor);
  else bar.appendChild(b);
}

/* ==========================================================================
   „Neue Welt" (Bedienungsrunde)

   Terra startete bisher immer mit derselben Demo-Startkarte und bot keinen
   Weg, wieder bei Null anzufangen. Dieser Knopf loescht alles Gesetzte
   (Elemente UND Marker), wuerfelt einen frischen Weltseed und baut nur das
   Terrain neu — keine Bauten. Die Demo bleibt ueber ?schau=demo erreichbar.
   Wie „Welt wuerfeln" wird der Knopf zur Laufzeit erzeugt (terra/index.html
   bleibt unangetastet) und steht direkt hinter dem Wuerfel-Knopf.
   ========================================================================== */
function baueNeueWeltKnopf() {
  var bar = document.getElementById("bar");
  if (!bar || document.getElementById("neuBtn")) return;
  var b = el("button", null, "🌱 Neue Welt");
  b.id = "neuBtn";
  b.title = "Löscht alle Elemente und Marker, würfelt einen neuen Weltseed "
    + "und baut nur das Terrain neu. Rückgängig (Strg+Z) stellt den alten "
    + "Stand wieder her.";
  b.addEventListener("click", neueWelt);
  var welt = document.getElementById("weltBtn");
  if (welt && welt.parentNode === bar) {
    if (welt.nextSibling) bar.insertBefore(b, welt.nextSibling);
    else bar.appendChild(b);
  } else {
    var vor = document.getElementById("saveBtn");
    if (vor && vor.parentNode === bar) bar.insertBefore(b, vor);
    else bar.appendChild(b);
  }
}

/**
 * Frische leere Welt: alles Gesetzte weg, neuer Zufallsseed, nur Terrain.
 * Der Undo-Schnappschuss nimmt das Terrain mit (mitTerrain = true), damit
 * Strg+Z auch die alte Hoehenkarte zurueckholt — Elemente und Marker haelt
 * jeder Schnappschuss ohnehin. Der neue Seed selbst ist bewusst NICHT Teil
 * von Undo (Konvention wie beim Seed-Feld in io.js).
 */
function neueWelt() {
  if (S.elements.length || S.marker.length) {
    if (!window.confirm("Neue Welt beginnen? Alle gesetzten Elemente und "
      + "Marker werden gelöscht (Strg+Z macht es rückgängig).")) return;
  }
  pushUndo(true);
  ed.selected = null;
  ed.auswahl.length = 0;
  ed.draw = null;
  clearPreview();            // eine angefangene Zeichnung darf nicht stehenbleiben
  hydrate([]);               // leert S.elements
  hydrateMarker([]);         // leert S.marker
  rebuildMarker();
  S.worldSeed = zufallsWeltSeed();
  var seedFeld = document.getElementById("seed");
  if (seedFeld) seedFeld.value = String(S.worldSeed);
  genBase(S.worldSeed);
  rebuildAll();
  rebuildHandles();
  buildPanel();
  toast("Neue Welt · Seed " + S.worldSeed);
}

/**
 * Erzeugt eine ganze Karte und setzt sie ein. Das Gelaende bleibt unangetastet
 * — der Generator LIEST das Hoehenfeld nur; die Flussbetten schneidet wie
 * ueblich rebuildAll ueber rivers/recomputeHeights ein.
 *
 * pushUndo() ohne Argument genuegt: `base` wird hier nicht ersetzt (nur `hgt`,
 * und das rechnet recomputeHeights jederzeit aus `base` neu). Der Schnappschuss
 * teilt sich damit die vorhandene Terrainkopie — genau der Fall, fuer den
 * history.js das Copy-on-Write hat.
 */
function weltWuerfeln() {
  if (S.elements.length &&
      !confirm("Die Karte trägt bereits " + S.elements.length + " Elemente. "
        + "„Welt würfeln“ ersetzt sie vollständig durch eine neu erzeugte Welt "
        + "(das Geländerelief bleibt erhalten). Fortfahren?")) return;
  // Kein Zwischen-Toast: die Erzeugung laeuft synchron (gemessen 14 ms auf
  // einer 256er, 56 ms auf einer 1024er Karte), der Browser kaeme vor dem
  // Ergebnis ohnehin nicht zum Zeichnen.
  var liste;
  try {
    liste = erzeugeWelt(S.worldSeed, {});
  } catch (err) {
    // Bis hierher wurde NICHTS veraendert (erzeugeWelt liest nur) — der Editor
    // bleibt vollstaendig im alten Zustand, wie beim Laden in io.js.
    console.error("erzeugeWelt", err);
    toast("Weltgenerator fehlgeschlagen");
    return;
  }
  if (!liste || !liste.length) { toast("Kein brauchbarer Bauplatz auf dieser Karte"); return; }
  pushUndo();
  ed.selected = null;
  ed.draw = null;
  clearPreview();            // eine angefangene Zeichnung darf nicht stehenbleiben
  hydrate(liste);           // leert S.elements und legt die neuen Elemente an
  rebuildAll();
  rebuildHandles();
  buildPanel();
  var b = liste.bericht || {};
  toast("Welt gewürfelt: " + liste.length + " Elemente · "
    + (b.fluesse || 0) + " Flüsse · " + (b.siedlungen || 0) + " Siedlungen"
    // J3: der Regionsname ist das Erste, was man von einer Karte wissen will.
    + (b.region ? " · „" + b.region + "“" : "")
    + (b.namen ? " · " + b.namen + " Namen" : ""));
}


/* ==========================================================================
   J3 — Namen im Panel

   Drei Bausteine, alle hier und nicht in tools.js, weil sie DOM erzeugen:

   1. `namensZeile` — ein Textfeld mit einem Würfelknopf daneben. Es gibt kein
      `.row`-Muster fuer "Eingabe + Knopf" in ui/style.css (die Datei gehoert
      dieser Runde nicht), deshalb steht die Aufteilung als Inline-Flex hier;
      Schriftgroesse und Rahmen erben von der globalen input-Regel.
   2. `nameArtFuer` — welche Wortwelt zu welchem Element gehoert.
   3. `baueNamenAbschnitt` — Sprachfamilie der Karte plus die Liste aller
      vergebenen Namen mit Dublettenmarke.

   Der Würfelknopf muss bei JEDEM Druck etwas Neues liefern, obwohl der
   Generator deterministisch ist. Deshalb ein laufender Zaehler als `index`:
   der Seed des Elements bleibt unangetastet (die Bestueckung aendert sich
   nicht), nur der Namensschluessel wandert weiter.
   ========================================================================== */
var wuerfelZaehler = 0;

/** Mittelpunkt der Punkte — die Lage, an der ein Element benannt wird. */
function elementMitte(e) {
  var p = e.points, x = 0, z = 0;
  if (!p || !p.length) return { x: 0, z: 0 };
  for (var i = 0; i < p.length; i++) { x += p[i].x; z += p[i].z; }
  return { x: x / p.length, z: z / p.length };
}

var NAME_ART = {
  "ranke:ranke": "ranke",
  "pfad:fluss": "fluss", "pfad:bruch": "bruch",
  "flaeche:wald": "wald",
  "flaeche:viertel": "ort", "flaeche:burg": "ort", "flaeche:kloster": "ort",
  "flaeche:werft": "ort",
  // Objektstreuungen: was gebaut aussieht, bekommt einen Hausnamen; was
  // gefallen ist, klingt nach Bruchkante; Fels nach Gebirge.
  "objekt:haeuser": "gasthaus", "objekt:wohnbau": "gasthaus",
  "objekt:handwerk": "gasthaus", "objekt:hof": "gasthaus",
  "objekt:ruinen": "bruch", "objekt:ruinen2": "bruch",
  "objekt:felsen": "gebirge", "objekt:natur2": "gebirge",
  "objekt:maritim": "ort", "objekt:hafen": "ort", "objekt:arbor": "ranke"
};
function nameArtFuer(e) { return NAME_ART[e.kind + ":" + e.variant] || "region"; }

/**
 * Der Vorschlag fuer EIN Element. Sonderfall Strasse: eine Strasse heisst
 * nicht nach sich selbst, sondern nach ihrem Ziel — genau wie im
 * Weltgenerator ("Weg von X nach Y"). Gemessen wird deshalb am ENDPUNKT, und
 * der Name entsteht als Ortsname.
 */
function namensVorschlag(target) {
  var m = elementMitte(target);
  if (target.kind === "pfad" && target.variant === "strasse" && target.points.length) {
    var e = target.points[target.points.length - 1];
    return "Weg nach " + nameFuer("ort", e.x, e.z, target.seed,
      { rolle: "panel-ziel", index: ++wuerfelZaehler });
  }
  return nameFuer(nameArtFuer(target), m.x, m.z, target.seed,
    { rolle: "panel", index: ++wuerfelZaehler });
}

/** Die vier Markerarten auf die Wortwelten abgebildet — eine Gefahrenstelle
 *  soll nach Abgrund klingen, eine Arbor-Nadel nach Ranke. */
var MARKER_ART = { ort: "ort", gefahr: "bruch", notiz: "region", arbor: "ranke" };

/**
 * Textfeld + Würfelknopf. `holen` liefert den aktuellen Text, `setzen(text)`
 * uebernimmt ihn, `wuerfeln()` liefert einen Vorschlag.
 */
function namensZeile(beschriftung, holen, setzen, wuerfeln, hinweis) {
  var row = el("div", "row");
  var lab = el("label");
  lab.appendChild(el("span", null, beschriftung));
  row.appendChild(lab);
  var box = el("div");
  box.style.display = "flex";
  box.style.gap = "6px";
  box.style.alignItems = "center";
  var inp = el("input");
  inp.type = "text";
  inp.value = holen() || "";
  inp.spellcheck = false;
  inp.style.flex = "1 1 auto";
  inp.style.minWidth = "0";
  inp.addEventListener("change", function () { setzen(inp.value); });
  // Enter uebernimmt sofort und gibt den Fokus frei — sonst wuerde ein
  // spaeterer Neuaufbau des Panels die Eingabe verschlucken.
  inp.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") { setzen(inp.value); inp.blur(); }
  });
  var b = el("button", null, "🎲");
  b.title = hinweis || "Neuen Namen vorschlagen — passend zur Lage auf der Karte";
  b.style.flex = "0 0 auto";
  b.style.padding = "4px 8px";
  b.addEventListener("click", function () {
    var neu = wuerfeln();
    if (!neu) return;
    inp.value = neu;
    setzen(neu);
  });
  box.appendChild(inp);
  box.appendChild(b);
  row.appendChild(box);
  return row;
}

/** Namenszeile fuer ein Element (schreibt in `params.name`). */
function elementNamensZeile(target) {
  return namensZeile("Name", function () { return target.params.name || ""; },
    function (txt) {
      pushUndo();
      txt = String(txt || "").trim();
      // Leerer Text loescht das Feld wieder, statt "" zu speichern — ein
      // namenloses Element soll auch in der Datei namenlos sein.
      if (txt) target.params.name = txt; else delete target.params.name;
      // KEIN commit: der Name erzeugt keine Geometrie und keine Instanzen.
      // Er steht in params und wandert damit von selbst in die Datei.
    },
    function () { return namensVorschlag(target); });
}

/* ==========================================================================
   Kartenbaum und Brotkrume (I1)

   Die Wege in den Baum hinein — wechseln, neu ableiten, nachziehen — leben in
   editor/io.js, wo der Baum wohnt. Hier stehen sie nur als angemeldete
   Rueckmeldungen: io.js importiert panels.js, der umgekehrte Weg waere ein
   Zyklus. Dasselbe Muster wie bei der Erosion und beim Ausschnitt-Werkzeug.

   Ohne geladene Baumdatei ist `S.baum` null. Dann zeigt der Abschnitt nichts
   ausser dem Hinweis, wie man eine Kindkarte anlegt — eine einzelne Karte
   braucht keinen Baum, und ein Baum mit einem Knoten waere nur Rauschen.
   ========================================================================== */
var kartenWege = null;
function setzeKartenWege(w) { kartenWege = w; }

/* ==========================================================================
   Bedienungsrunde — Kopf der aktiven Karte: Name und Massstab

   Beides sass bisher nirgends in der Bedienung: der Kartentitel stand nur im
   Baum (aenderbar allein beim Anlegen eines Ausschnitts), und der Massstab
   entstand ausschliesslich beim Ableiten einer Kindkarte. Hier bekommen beide
   eine Zeile im Karten-Panel (Auswahl-Werkzeug ohne Auswahl) — zugleich die
   Antwort auf „wie erzeuge ich eine Kontinentkarte": Massstab waehlen.
   Die Schreibwege liegen in editor/io.js (kartenWege.benenne/setzeMassstab),
   wo Baum und Kartenzustand wohnen.
   ========================================================================== */
function baueKarteKopf() {
  if (!kartenWege || !kartenWege.benenne) return;
  panelEl.appendChild(el("hr"));
  panelEl.appendChild(el("div", "ph", "Karte"));
  panelEl.appendChild(namensZeile("Kartenname",
    function () { return kartenWege.titel(); },
    function (txt) { kartenWege.benenne(txt); },
    function () {
      return nameFuer("region", 0, 0, S.worldSeed,
        { rolle: "kartenname", index: ++wuerfelZaehler });
    },
    "Neuen Kartennamen vorschlagen"));

  var row = el("div", "row");
  var lab = el("label");
  lab.appendChild(el("span", null, "Maßstab (m je Zelle)"));
  row.appendChild(lab);
  var sel = el("select");
  var stufen = [
    ["1", "Ort — 1 m je Zelle"],
    ["8", "Landschaft — 8 m je Zelle"],
    ["120", "Region — 120 m je Zelle"],
    ["1000", "Kontinent — 1000 m je Zelle"]
  ];
  var jetzt = kartenWege.massstab();
  var passt = false;
  for (var i = 0; i < stufen.length; i++) {
    if (parseFloat(stufen[i][0]) === jetzt) passt = true;
    var op = el("option", null, stufen[i][1]);
    op.value = stufen[i][0];
    sel.appendChild(op);
  }
  if (!passt) {
    var opX = el("option", null, jetzt + " m je Zelle");
    opX.value = String(jetzt);
    sel.appendChild(opX);
  }
  sel.value = String(jetzt);
  sel.addEventListener("change", function () {
    var m = parseFloat(sel.value);
    if (Number.isFinite(m) && m > 0) kartenWege.setzeMassstab(m);
  });
  row.appendChild(sel);
  panelEl.appendChild(row);
  panelEl.appendChild(el("div", "psub",
    "Der Maßstab macht aus derselben Karte einen Ort, eine Region oder einen "
    + "Kontinent: ab Regionsmaßstab zeichnen die Elemente Kartenzeichen statt "
    + "Baukörper. Für eine Stadt AUF einer Kontinentkarte mit dem Werkzeug "
    + "„Ausschnitt“ (Taste 0) ein Polygon ziehen — daraus entsteht eine "
    + "feinere Kindkarte."));
}

function baueKartenAbschnitt() {
  if (!S.baum || !kartenWege) return;
  var baum = S.baum;
  if (baum.karten.length < 2) return;          // eine einzelne Karte ist kein Baum

  panelEl.appendChild(el("hr"));
  panelEl.appendChild(el("div", "ph", "Karten"));

  /* Brotkrume: Wurzel → … → hier. Sie steht oben, weil sie die Frage
     beantwortet, die man an einer fremden Karte zuerst hat — wo bin ich? */
  var pfad = kartenWege.pfad(baum, S.aktiveKarte);
  var krume = el("div", "krume");
  for (var i = 0; i < pfad.length; i++) {
    (function (id, letzter) {
      if (i > 0) krume.appendChild(el("span", "krumeTrenner", "›"));
      var k = baum.index[id].karte;
      var b = el("span", letzter ? "krumeHier" : "krumeLink", k.titel || id);
      if (!letzter) b.addEventListener("click", function () { kartenWege.wechsle(id); });
      krume.appendChild(b);
    })(pfad[i], i === pfad.length - 1);
  }
  panelEl.appendChild(krume);

  var hier = baum.index[S.aktiveKarte].karte;
  // massstabName liefert die Stufe klein ("ort", "landschaft"); am Satzanfang
  // gehoert sie gross. Hier statt im Generator, weil dort der Name ein
  // Schluessel ist und mitten im Satz auch klein richtig waere.
  var stufe = kartenWege.massstabName(hier.einheitMeter || 1);
  panelEl.appendChild(el("div", "psub",
    stufe.charAt(0).toUpperCase() + stufe.slice(1) + " · "
    + (hier.einheitMeter || 1) + " m je Zelle · Kante "
    + Math.round(((hier.kartenGroesse | 0) || 256) * (hier.einheitMeter || 1)) + " m"));

  /* Kinder als Sprungliste. Doppelklick auf die markierte Flaeche in der Szene
     waere der schoenere Weg; bis es ihn gibt, ist die Liste der ehrliche. */
  var kinder = kartenWege.kinder(baum, S.aktiveKarte);
  if (kinder.length) {
    panelEl.appendChild(el("div", "psub", kinder.length + " Ausschnitte in dieser Karte:"));
    for (var c = 0; c < kinder.length; c++) {
      (function (id) {
        var k = baum.index[id].karte;
        var b = el("button", "wide", "↓ " + (k.titel || id));
        b.addEventListener("click", function () { kartenWege.wechsle(id); });
        panelEl.appendChild(b);
      })(kinder[c]);
    }
  }

  /* Neu ableiten / Nachziehen — nur an einer abgeleiteten Karte. Die beiden
     Knoepfe sind der Unterschied zwischen „ich habe mich vertan" und „das
     Elterngelaende hat sich geaendert". */
  if (baum.index[S.aktiveKarte].elternId !== null) {
    var nach = el("button", "wide", "Elternform nachziehen");
    nach.addEventListener("click", function () { kartenWege.nachziehen(); });
    panelEl.appendChild(nach);
    var neu = el("button", "wide warn", "Neu ableiten (verwirft Handarbeit)");
    neu.addEventListener("click", function () {
      if (!confirm("Das Gelände dieser Karte wird neu aus der Elternkarte abgeleitet. "
        + "Alle Höhenänderungen von Hand gehen verloren. Fortfahren?")) return;
      kartenWege.neuAbleiten();
    });
    panelEl.appendChild(neu);
    panelEl.appendChild(el("div", "psub",
      "„Nachziehen“ übernimmt die geänderte Elternform und behält deine "
      + "Höhenänderungen. „Neu ableiten“ verwirft sie."));
  } else {
    panelEl.appendChild(el("div", "psub",
      "Wurzelkarte. Mit dem Werkzeug „Ausschnitt“ (Taste 0) ein Polygon "
      + "zeichnen und daraus eine feinere Kindkarte machen."));
  }
}

/* ==========================================================================
   Abschnitt „Biome" (I2)

   Zwei Dinge: die Klimaachse der Karte und der Knopf, der daraus einen
   Vorschlag macht.

   Der Vorschlag erzeugt POLYGONE, keine Pixelmaske — das ist der Unterschied,
   auf den es ankommt. Was herauskommt, sind ganz normale Biomflaechen-
   Elemente, die man danach verschieben, verkleinern, loeschen oder umfaerben
   kann. Ein Vorschlag, den man weiterbearbeitet, statt eines Bildes, das man
   uebermalen muesste.
   ========================================================================== */
var KLIMA_PARAMS = [
  { k: "richtung", l: "Kälte kommt aus", min: 0, max: 359, st: 5, d: 0 },
  { k: "staerke", l: "Klimagefälle", min: 0, max: 1, st: 0.05, d: 0.5 },
  { k: "grund", l: "Grundwärme", min: 0, max: 1, st: 0.05, d: 0.5 },
  { k: "hoeheKuehl", l: "Höhenabkühlung", min: 0, max: 0.04, st: 0.002, d: 0.012 }
];

function baueBiomAbschnitt() {
  panelEl.appendChild(el("hr"));
  panelEl.appendChild(el("div", "ph", "Biome"));

  var vorhandene = S.elements.filter(function (e) {
    return e.kind === "flaeche" && e.variant === "biom";
  });
  // I2: Pinselstriche sind die zweite Quelle derselben Maske und gehoeren
  // deshalb in dieselbe Bilanz — sonst zaehlt das Panel die halbe Karte.
  var striche = S.elements.filter(function (e) {
    return e.kind === "pfad" && e.variant === "biompinsel";
  });

  for (var i = 0; i < KLIMA_PARAMS.length; i++) {
    // Wie bei der Erosion: die Regler wirken erst beim naechsten Vorschlag.
    // Sie sofort auszuwerten hiesse, 200 ms Ableitung je Reglerpixel.
    panelEl.appendChild(paramRow(KLIMA_PARAMS[i], S.klima, function () {}));
  }

  var knopf = el("button", "wide", "Biome vorschlagen");
  knopf.addEventListener("click", function () {
    var neu = biomeVorschlagen({ hoehe: base, abfluss: abfluss },
      VW, KARTE.map, { seed: S.worldSeed, klima: S.klima });
    if (!neu.length) {
      toast("Kein Vorschlag — das Gelände ist zu gleichförmig");
      return;
    }
    pushUndo(true);
    /* Alte Vorschlaege weichen, von Hand gezeichnete NICHT. Unterschieden wird
       ueber params.ausVorschlag: was der Nutzer angefasst hat, verliert die
       Marke im Panel — dort wird sie beim Aendern geloescht. Ohne diese
       Trennung waere ein zweiter Klick auf den Knopf ein stiller Datenverlust. */
    for (var k = S.elements.length - 1; k >= 0; k--) {
      var e = S.elements[k];
      if (e.kind === "flaeche" && e.variant === "biom" && e.params && e.params.ausVorschlag) {
        deleteElement(e);
      }
    }
    for (var n = 0; n < neu.length; n++) {
      S.elements.push(mkElement("flaeche", "biom", neu[n].points,
        { biom: neu[n].biom, weich: 8, ausVorschlag: true }, nextSeed()));
    }
    rebuildAll();
    buildPanel();
    toast(neu.length + " Biomflächen vorgeschlagen — jede ist ein Element und bleibt änderbar");
  });
  panelEl.appendChild(knopf);
  panelEl.appendChild(el("div", "psub",
    vorhandene.length || striche.length
      ? vorhandene.length + " Biomflächen"
        + (striche.length ? " und " + striche.length + " Pinselstriche" : "")
        + " auf der Karte. Ein neuer Vorschlag "
        + "ersetzt nur die vorgeschlagenen, nicht die selbst gezeichneten "
        + "und keinen Pinselstrich."
      : "Leitet aus Höhe, Hang, Wassernähe und — falls erodiert wurde — dem "
        + "Abfluss einen Vorschlag ab. Das Ergebnis sind Elemente, keine Maske: "
        + "jede Fläche lässt sich danach ziehen, umfärben oder löschen."));
}

/* ==========================================================================
   Zielzeile der Beschriftung (I4)

   Zwei Felder, die zusammengehoeren: die Art des Ziels und die Referenz. Sie
   stehen ausserhalb des Parameterschemas, weil `ziel` ein Objekt ist und das
   Schema nur Skalare kennt.

   Der wichtige Teil ist die Pruefung: JEDE Eingabe laeuft durch zielPruefen,
   bevor sie ins Element geht — dieselbe Erlaubnisliste, die auch beim Laden
   greift. Damit kann eine ungueltige Adresse gar nicht erst in einer Datei
   landen, die jemand weitergibt.
   ========================================================================== */
function baueZielZeile(obj, applyFn) {
  var ziel = (obj.ziel && typeof obj.ziel === "object") ? obj.ziel : { art: "keins", ref: "" };
  var row = el("div", "row");
  var lab = el("label");
  lab.appendChild(el("span", null, "Klickziel"));
  row.appendChild(lab);

  var sel = el("select");
  var arten = [["keins", "kein Ziel"], ["extern", "Adresse (http/https)"], ["wiki", "Wiki-Seite"]];
  for (var i = 0; i < arten.length; i++) {
    var op = el("option", null, arten[i][1]);
    op.value = arten[i][0];
    sel.appendChild(op);
  }
  sel.value = ziel.art || "keins";
  row.appendChild(sel);

  var ref = el("input");
  ref.type = "text";
  ref.value = String(ziel.ref || "");
  ref.placeholder = sel.value === "wiki" ? "seiten-kennung" : "https://…";
  ref.style.marginTop = "5px";
  ref.style.display = sel.value === "keins" ? "none" : "";
  row.appendChild(ref);

  var uebernimm = function () {
    var pruef = zielPruefen({ art: sel.value, ref: ref.value });
    if (!pruef.ok) {
      toast("Ziel abgelehnt: " + pruef.grund);
      // Feld stehen lassen, damit der Nutzer sieht, was er getippt hat — aber
      // NICHT uebernehmen. Ein abgelehntes Ziel darf das gueltige nicht loeschen.
      return;
    }
    applyFn(true);
    obj.ziel = pruef.ziel;
    ref.value = pruef.ziel.ref;
    applyFn();
  };
  sel.addEventListener("change", function () {
    ref.style.display = sel.value === "keins" ? "none" : "";
    ref.placeholder = sel.value === "wiki" ? "seiten-kennung" : "https://…";
    uebernimm();
  });
  ref.addEventListener("change", uebernimm);

  panelEl.appendChild(row);
  panelEl.appendChild(el("div", "psub",
    "Ein Klick auf die Beschriftung öffnet das Ziel in einem neuen Fenster. "
    + "Zugelassen sind nur http- und https-Adressen — geteilte Karten sollen "
    + "keinen Schadklick mitbringen. Im Aufnahme-Modus ist der Klick aus."));
}

/* ==========================================================================
   Zeile „Entlang eines Pfades" (I4, eingehaengt in dieser Runde)

   `glyphenAufKurve` konnte seit I4 Text auf eine Kurve setzen, aber es gab
   keinen Weg, eine Beschriftung mit einer Kurve zu VERKNUEPFEN. Der ist hier:
   ein Auswahlfeld mit allen Pfaden der Karte. Es steht — wie die Zielzeile —
   ausserhalb des Parameterschemas, aber aus einem anderen Grund: `anPfad` ist
   zwar ein Skalar, seine Auswahlliste entsteht aber erst zur Laufzeit aus der
   Elementliste. Ein Schemaeintrag mit `o:` waere beim Modulstart ausgewertet
   und zeigte fuer immer die Pfade der leeren Startkarte.

   Nur an einem GEWAEHLTEN Element: eine Verknuepfung gehoert zu genau einer
   Beschriftung und ist keine Werkzeugeinstellung, die man voreinstellt —
   dieselbe Begruendung wie bei der Namenszeile.
   ========================================================================== */
function pfadBeschreibung(e) {
  var art = { strasse: "Straße", mauer: "Mauer", fluss: "Fluss", hecke: "Hecke",
    bruch: "Bruchkante", biompinsel: "Biompinsel" }[e.variant] || e.variant;
  // Runde H (Bedienung): Flaechen stehen mit ihrem RAND in der Liste — der
  // Zusatz sagt, woran die Zeile entlanglaufen wird.
  if (e.kind === "flaeche") {
    art = ({ wald: "Wald", feld: "Feld", viertel: "Viertel", wiese: "Wiese",
      burg: "Burg", werft: "Werft", kloster: "Kloster", biom: "Biomfläche",
      see: "See" }[e.variant] || e.variant) + "-Rand";
  }
  var name = e.params && e.params.name;
  return (name ? name + " (" + art + ")" : art + " #" + e.id)
    + " · " + e.points.length + " Punkte";
}

function baueAnPfadZeile(target, applyFn) {
  var row = el("div", "row");
  var lab = el("label");
  // Runde H (Bedienung): auch der RAND einer Flaeche traegt jetzt eine Zeile —
  // der alte Wortlaut bleibt Praefix, damit bestehende Pruefungen (Browsertest
  // runde-h-bedienung) die Zeile weiter finden.
  lab.appendChild(el("span", null, "Entlang eines Pfades / Flächenrands"));
  row.appendChild(lab);

  var sel = el("select");
  var keins = el("option", null, "gerade setzen");
  keins.value = "0";
  sel.appendChild(keins);
  var kandidaten = S.elements.filter(function (e) {
    // Der Biompinsel steht bewusst mit in der Liste: er ist ein Pfad wie jeder
    // andere, und „Moorgürtel" entlang des gepinselten Streifens ist genau
    // die Beschriftung, die man dort haben will.
    // Runde H (Bedienung): Flaechen ebenso — ihr Rand ist die Kurve (seeUmriss
    // + ringFenster, siehe editor/selection.js kurveAnhaengen). „Seename am
    // Ufer entlang" ist der Fall, fuer den das gebaut wurde.
    return (e.kind === "pfad" && e.points && e.points.length >= 2)
        || (e.kind === "flaeche" && e.points && e.points.length >= 3);
  });
  for (var i = 0; i < kandidaten.length; i++) {
    var op = el("option", null, pfadBeschreibung(kandidaten[i]));
    op.value = String(kandidaten[i].id);
    sel.appendChild(op);
  }
  var jetzt = Number.isFinite(target.params.anPfad) ? target.params.anPfad | 0 : 0;
  /* Verwaister Verweis: das verknuepfte Element ist geloescht. Er wird
     ANGEZEIGT statt still gelaeutert — wer ihn sieht, weiss, warum die
     Beschriftung wieder gerade steht, und ein Rueckgaengig holt das Element
     mitsamt seiner id zurueck. Erst ein Griff ins Feld raeumt ihn weg. */
  if (jetzt && !kandidaten.some(function (e) { return e.id === jetzt; })) {
    var tot = el("option", null, "Element #" + jetzt + " — gelöscht");
    tot.value = String(jetzt);
    sel.appendChild(tot);
  }
  sel.value = String(jetzt);
  row.appendChild(sel);

  sel.addEventListener("change", function () {
    var pruef = anPfadPruefen(parseInt(sel.value, 10) || 0);
    if (!pruef.ok) { toast("Verknüpfung abgelehnt: " + pruef.grund); return; }
    applyFn(true);
    if (pruef.wert) target.params.anPfad = pruef.wert;
    else delete target.params.anPfad;      // „gerade" ist die Abwesenheit des Feldes
    applyFn();
    // Sofort statt erst beim naechsten Takt der Bildschleife: der Nutzer soll
    // die Wirkung seiner Auswahl im selben Augenblick sehen.
    beschriftungenAktualisieren();
    buildPanel();
  });

  panelEl.appendChild(row);
  panelEl.appendChild(el("div", "psub",
    kandidaten.length
      ? "Die Beschriftung läuft dann dem gewählten Pfad oder Flächenrand "
        + "entlang statt gerade zu stehen. Ihr Griff bestimmt, WO sie sitzt — "
        + "ziehen verschiebt sie den Fluss hinauf oder das Ufer entlang. Trägt "
        + "die Kurve den Text nicht (zu kurz, zu enge Biegung, Kopfstand), "
        + "steht sie gerade."
      : "Noch kein Pfad und keine Fläche auf der Karte. Straße, Fluss, See, "
        + "Wald oder Biompinsel zeichnen — danach kann eine Beschriftung der "
        + "Kurve folgen."));
}

/* ==========================================================================
   Abschnitt „Erosion“ (I3)

   Der einzige Vorgang in Terra, der ueber mehrere Bilder laeuft. Das Panel
   muss deshalb zwei Zustaende zeigen — bereit und laufend — und im laufenden
   Zustand einen Weg heraus anbieten.

   Der Balken wird NICHT ueber buildPanel() aktualisiert: ein Neuaufbau des
   ganzen Panels 60-mal je Sekunde waere absurd, und der Fokus im Regler ginge
   dabei verloren. Stattdessen meldet der Treiber seinen Fortschritt an ein
   Element, dessen Verweis hier liegt. Ist das Panel inzwischen neu gebaut, ist
   der Verweis tot und die Meldung laeuft ins Leere — genau richtig, denn dann
   zeigt das neue Panel den Zustand ohnehin von sich aus.
   ========================================================================== */
var erosionBalken = null;

function baueErosionAbschnitt() {
  panelEl.appendChild(el("hr"));
  panelEl.appendChild(el("div", "ph", "Erosion"));

  if (erosionLaeuft()) {
    var lauf = el("div", "psub", "Läuft …");
    panelEl.appendChild(lauf);
    var huelle = el("div", "fortschritt");
    var balken = el("div", "fortschrittBalken");
    huelle.appendChild(balken);
    panelEl.appendChild(huelle);
    erosionBalken = { balken: balken, text: lauf };
    var abbruch = el("button", "wide", "Abbrechen");
    abbruch.addEventListener("click", function () {
      brichErosionAb();
      toast("Erosion abgebrochen — nichts übernommen");
      buildPanel();
    });
    panelEl.appendChild(abbruch);
    return;
  }

  erosionBalken = null;
  for (var i = 0; i < EROSION_PARAMS.length; i++) {
    // apply ist hier leer: die Regler wirken erst beim naechsten Lauf, nicht
    // sofort. Eine Vorschau gaebe es nur um den Preis, die Erosion bei jedem
    // Reglerpixel neu zu rechnen — eine Sekunde je Zug.
    panelEl.appendChild(paramRow(EROSION_PARAMS[i], erosionRegler, function () {}));
  }
  var knopf = el("button", "wide", "Gelände erodieren");
  knopf.addEventListener("click", function () {
    starteErosion(erosionRegler);
    buildPanel();
  });
  panelEl.appendChild(knopf);
  panelEl.appendChild(el("div", "psub",
    "Wäscht Rinnen ins Gelände, lässt Steilhänge nachrutschen und legt "
    + "Schwemmland ab. Flüsse werden danach neu eingeschnitten und liegen in "
    + "den entstandenen Talböden. Ein Schritt in der Historie — Strg+Z macht "
    + "den ganzen Lauf rückgängig."));
}

/** Meldung des Treibers. Bewusst schmal: Breite setzen, Text setzen, fertig. */
function zeigeErosionFortschritt(anteil, fertig, abgebrochen) {
  if (fertig || abgebrochen) {
    erosionBalken = null;
    buildPanel();
    if (fertig) toast("Erosion fertig");
    return;
  }
  if (!erosionBalken || !erosionBalken.balken.isConnected) return;
  erosionBalken.balken.style.width = Math.round(anteil * 100) + "%";
  erosionBalken.text.textContent = "Läuft … " + Math.round(anteil * 100) + " %";
}

/**
 * Abschnitt „Namen“: Sprachfamilie der Karte und die Liste alles Benannten.
 * Die Liste liest ausschliesslich `params.name` und die Markertexte — beides
 * Felder, die ohnehin gespeichert werden; es gibt kein zweites Verzeichnis,
 * das veralten koennte.
 */
function baueNamenAbschnitt() {
  panelEl.appendChild(el("hr"));
  panelEl.appendChild(el("div", "ph", "Namen"));
  var applyFam = function (mode) {
    if (mode === true || mode === "vorschau") return;
    buildPanel();
    toast("Sprachfamilie: " + aktiveSprachfamilie());
  };
  panelEl.appendChild(paramRow(KARTE_PARAMS[0], karteParams, applyFam));
  panelEl.appendChild(el("div", "psub",
    "Bestimmt die Wortwelt neuer Namen. „Aus dem Biom“ leitet sie ab "
    + "(hier: " + aktiveSprachfamilie() + "). Die Lage auf der Karte wählt das "
    + "Grundwort mit: an einer Furt „-furt“, am Ufer „-hafen“, auf dem Sattel "
    + "„-scharte“, an einer Bruchkante „-riss“. Einzelne Landstriche sprechen "
    + "eine Nachbarsprache — so entstehen Sprachgrenzen."));

  var alle = sammleNamen();
  if (!alle.length) {
    panelEl.appendChild(el("div", "psub", "Noch nichts benannt. „🎲 Welt würfeln“ "
      + "benennt alles auf einmal, der Würfelknopf am Element einzeln."));
    return;
  }
  var dubl = 0, i;
  for (i = 0; i < alle.length; i++) if (alle[i].dublette) dubl++;
  panelEl.appendChild(el("div", "psub", alle.length + " Namen auf der Karte"
    + (dubl ? " · " + dubl + " Dublette" + (dubl === 1 ? "" : "n") + " (rot)" : " · keine Dubletten")));
  var box = el("div");
  box.style.maxHeight = "220px";
  box.style.overflowY = "auto";
  box.style.margin = "4px 0 2px";
  // Deckel gegen endlose Listen: eine 1024er Karte kann weit ueber hundert
  // Namen tragen, und das Panel ist keine Tabelle.
  var deckel = Math.min(alle.length, 120);
  for (i = 0; i < deckel; i++) {
    var z = el("div", "psub", alle[i].name + "  —  " + alle[i].was);
    z.style.margin = "0";
    z.style.whiteSpace = "nowrap";
    z.style.overflow = "hidden";
    z.style.textOverflow = "ellipsis";
    if (alle[i].dublette) z.style.color = "#c1523c";
    box.appendChild(z);
  }
  panelEl.appendChild(box);
  if (alle.length > deckel)
    panelEl.appendChild(el("div", "psub", "… und " + (alle.length - deckel) + " weitere."));
}

/* ==========================================================================
   D1/J3 — Markerpanel

   Bisher hatte das Markerwerkzeug gar kein Panel: die Beschriftung lief ueber
   prompt() beim Doppelklick (editor/pointer.js). Hier steht sie nun als
   Textfeld mit Würfelknopf — und zwar fuer ALLE Marker, nicht nur den
   gewaehlten: pointer.js ruft beim Anwaehlen einer Nadel kein buildPanel
   (und die Datei gehoert dieser Runde nicht), eine Liste bleibt deshalb
   immer richtig. Den Nachbau bei Anzahl- oder Auswahlwechsel besorgt
   tickToast weiter unten.
   ========================================================================== */
function baueMarkerPanel() {
  var gewaehlt = getMarkerAuswahl();
  panelEl.appendChild(el("hr"));
  if (!S.marker.length) {
    panelEl.appendChild(el("div", "psub", "Noch keine Nadel gesetzt. Klick auf das "
      + "Gelände setzt eine — die Beschriftung lässt sich hier ändern oder würfeln."));
    baueNamenAbschnitt();
    return;
  }
  var deckel = Math.min(S.marker.length, 40);
  for (var i = 0; i < deckel; i++) {
    (function (k) {
      var m = S.marker[k];
      var zeile = namensZeile((k === gewaehlt ? "▸ " : "") + (k + 1) + ". " + m.art,
        function () { return m.text; },
        function (txt) { m.text = String(txt); rebuildMarker(); },
        function () {
          return nameFuer(MARKER_ART[m.art] || "region", m.x, m.z,
            // Marker haben keinen Seed (siehe core/store.js) — die Koordinate
            // ist ihr stabiler Schluessel.
            (Math.round(m.x) * 73856093) ^ (Math.round(m.z) * 19349663),
            { rolle: "marker", index: ++wuerfelZaehler });
        });
      panelEl.appendChild(zeile);
    })(i);
  }
  if (S.marker.length > deckel)
    panelEl.appendChild(el("div", "psub", "… und " + (S.marker.length - deckel)
      + " weitere Nadeln (Doppelklick auf die Nadel beschriftet sie)."));
  baueNamenAbschnitt();
}

function el(tag, cls, txt) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt !== undefined) n.textContent = txt;
  return n;
}

function buildRail() {
  var rail = document.getElementById("rail");
  rail.innerHTML = "";
  for (var i = 0; i < TOOLS.length; i++) {
    (function (t) {
      var b = el("div", "tool card" + (t.id === ed.tool ? " on" : ""));
      b.dataset.id = t.id;
      b.appendChild(el("div", "g", t.g));
      b.appendChild(el("div", "l", t.l));
      b.appendChild(el("div", "k", t.key));
      b.title = t.l + "  (" + t.key + ")";
      b.addEventListener("click", function () { setTool(t.id); });
      rail.appendChild(b);
    })(TOOLS[i]);
  }
  baueAufnahmeKarte(rail);
}

/* ==========================================================================
   F4 — Aufnahme-Modus als eigene Karte hinter den Werkzeugen

   Bewusst KEIN Eintrag in TOOLS: ein Werkzeug setzt ed.tool, erzeugt Elemente
   und hat ein Panel — der Aufnahme-Modus tut nichts davon, er stellt die
   Kamera. Deshalb auch kein dataset.id (pointer.js und selection.js lesen das
   nirgends fuer diese Karte) und kein Ziffernkuerzel, sondern „C“.
   Die Karte traegt dieselben Klassen wie ein Werkzeug (`tool card`, `on`),
   damit sie ohne eine Zeile in ui/style.css — die dieser Runde nicht gehoert —
   wie die uebrigen aussieht; der zusaetzliche Abstand nach oben (9 px, also
   zusammen mit dem Flex-Gap doppelter Abstand) ist die einzige Ausnahme und
   steht als Inline-Stil hier.
   ========================================================================== */
function baueAufnahmeKarte(rail) {
  var b = el("div", "tool card" + (istAufnahme() ? " on" : ""));
  b.style.marginTop = "9px";
  b.appendChild(el("div", "g", "⊞"));
  b.appendChild(el("div", "l", "Aufnahme"));
  b.appendChild(el("div", "k", "C"));
  b.title = "Aufnahme-Modus  (C)\n"
    + "Komponierte Kamera: langes Objektiv (20°), Horizont auf einem Drittel, "
    + "angehobener Blickpunkt, gedämpfte Fahrt. Zoom, Schwenk und Drehung bleiben "
    + "frei — nur die Bildaufteilung rastet ein. Mit gewähltem Element richtet C "
    + "die Einstellung zusätzlich auf dessen ersten Punkt aus.";
  b.addEventListener("click", function () {
    var an = setAufnahme(!istAufnahme());
    toast(an ? "Aufnahme-Modus an — Horizont auf einem Drittel, 20° Objektiv"
             : "Aufnahme-Modus aus — freie Ansicht");
    buildRail();
  });
  rail.appendChild(b);
}

/** Erzeugt eine Zeile für einen Parameter und bindet sie an das Zielobjekt. */
function paramRow(def, obj, apply) {
  var row = el("div", "row");
  if (def.b) {
    var lab = el("label", "chk");
    var cb = el("input");
    cb.type = "checkbox";
    cb.checked = !!obj[def.k];
    cb.addEventListener("change", function () { apply(true); obj[def.k] = cb.checked; apply(); });
    lab.appendChild(cb);
    lab.appendChild(el("span", null, def.l));
    row.appendChild(lab);
    return row;
  }
  if (def.o || def.og) {
    var l2 = el("label");
    l2.appendChild(el("span", null, def.l));
    row.appendChild(l2);
    var sel = el("select");
    var fuege = function (ziel, liste) {
      for (var i = 0; i < liste.length; i++) {
        var op = el("option", null, liste[i][1]);
        op.value = liste[i][0];
        ziel.appendChild(op);
      }
    };
    if (def.o) fuege(sel, def.o);
    /* Bedienungsrunde: def.og = [[Gruppenlabel, Eintraege], …] baut
       <optgroup>-Abschnitte — gebraucht von der nach Objektart gefilterten
       „Nur Typ"-Liste (nurTypOptionen in editor/tools.js). */
    if (def.og) {
      for (var gi = 0; gi < def.og.length; gi++) {
        var og = el("optgroup");
        og.label = def.og[gi][0];
        fuege(og, def.og[gi][1]);
        sel.appendChild(og);
      }
    }
    sel.value = obj[def.k];
    /* Wert ausserhalb der Liste (z. B. nurTyp aus einer fremden Datei): als
       eigener Eintrag zeigen statt still auf den ersten zu springen — sonst
       saehe das Panel etwas anderes als das Element. */
    if (sel.value !== String(obj[def.k])) {
      var opX = el("option", null, String(obj[def.k]));
      opX.value = obj[def.k];
      sel.appendChild(opX);
      sel.value = obj[def.k];
    }
    sel.addEventListener("change", function () { apply(true); obj[def.k] = sel.value; apply(); });
    row.appendChild(sel);
    return row;
  }
  /* I4: freies Textfeld. Erst mit der Beschriftung gibt es einen Parameter,
     der Text IST — bis dahin war jeder Schemawert eine Zahl, ein Schalter oder
     eine Auswahl. `change` statt `input`: bei jedem Tastendruck einen Commit
     auszuloesen hiesse, das Element je Buchstabe neu zu bauen. */
  if (def.txt) {
    var l3 = el("label");
    l3.appendChild(el("span", null, def.l));
    row.appendChild(l3);
    var tf = el("input");
    tf.type = "text";
    tf.value = String(obj[def.k] === undefined ? "" : obj[def.k]);
    tf.addEventListener("change", function () {
      apply(true); obj[def.k] = tf.value; apply();
    });
    row.appendChild(tf);
    return row;
  }
  var lab2 = el("label");
  lab2.appendChild(el("span", null, def.l));
  var val = el("b", null, String(obj[def.k]));
  lab2.appendChild(val);
  row.appendChild(lab2);
  var inp = el("input");
  inp.type = "range";
  inp.min = def.min; inp.max = def.max; inp.step = def.st;
  inp.value = obj[def.k];
  var undoDone = false;
  // Slider feuern `input` pro Pixel — ein voller Commit (Fluesse, Korridore,
  // 257²-Terrain, ALLE Elemente) waere dort unbezahlbar. Deshalb waehrend des
  // Ziehens nur die leichte Vorschau (apply("vorschau") = regenElement des
  // Zielelements) und der schwere Teil erst beim Loslassen im `change`.
  // Fuer leichte Elemente ist die Vorschau bereits der ganze Commit — der
  // zusaetzliche Commit im `change` erzeugt dieselben Instanzen erneut
  // (deterministisch: gleicher Seed, gleiche Parameter), aendert also nichts
  // Beobachtbares.
  inp.addEventListener("input", function () {
    if (!undoDone) { apply(true); undoDone = true; }
    obj[def.k] = parseFloat(inp.value);
    val.textContent = inp.value;
    apply("vorschau");
  });
  inp.addEventListener("change", function () { undoDone = false; apply(); });
  row.appendChild(inp);
  return row;
}

function buildPanel() {
  panelEl.innerHTML = "";
  var target = ed.selected;
  var kind = target ? target.kind : ed.tool;
  var variant = target ? target.variant : ed.variantOf[ed.tool];
  var obj = target ? target.params : toolParams[ed.tool + ":" + ed.variantOf[ed.tool]];

  if (kind === "auswahl" && !target) {
    panelEl.appendChild(el("div", "ph", "Auswahl"));
    panelEl.appendChild(el("div", "psub",
      "Auf ein Element klicken, um seine Punkte und Parameter zu bearbeiten. " +
      "Shift+Klick nimmt weitere dazu (K macht aus der Auswahl einen Stempel). " +
      "Entf löscht die Auswahl."));
    panelEl.appendChild(el("div", "psub", S.elements.length + " Elemente auf der Karte."));
    // J3: Das Auswahl-Werkzeug ohne Auswahl ist das Panel der GANZEN Karte —
    // hier gehoert die kartenweite Sprachfamilie hin, nicht in ein Elementschema.
    // I1: der Baum steht ganz oben — wo man ist, beantwortet man vor allem
    // anderen. Erosion und Biome gelten immer nur der Karte, auf der man steht.
    baueKarteKopf();
    baueKartenAbschnitt();
    baueErosionAbschnitt();
    baueBiomAbschnitt();
    baueNamenAbschnitt();
    return;
  }
  var head = target
    ? "Element · " + kind
    : (TOOLS.filter(function (t) { return t.id === ed.tool; })[0] || { l: ed.tool }).l;
  panelEl.appendChild(el("div", "ph", head));

  /* A3 — Mehrfachauswahl sichtbar machen. Griffe und Parameter zeigen immer
     nur ed.selected; ohne diese Zeile bliebe voellig verborgen, dass Entf und
     K gleich mehrere Elemente betreffen. auswahlElemente() filtert gegen
     S.elements — verwaiste Referenzen zaehlen also nicht mit. */
  var mehrfach = target ? auswahlElemente() : [];
  if (mehrfach.length > 1) {
    panelEl.appendChild(el("div", "psub", mehrfach.length + " Elemente ausgewählt — "
      + "Parameter und Griffe gelten dem zuletzt gewählten. „Entf“ löscht alle, "
      + "„K“ macht daraus einen Stempel."));
  }

  /* Varianten. Schwelle: normalerweise erst ab zwei Varianten (ein einziger
     Knopf, der nichts umschaltet, ist nur Rauschen) — beim Stempel aber schon
     ab einem, denn dort IST der Variantenname der Stempelname. Bei genau
     einem Stempel in der Bibliothek stuende sonst nirgends im Panel, was der
     naechste Klick eigentlich setzt. */
  var minVarianten = (kind === "stempel" && !target) ? 1 : 2;
  if (VARIANTS[kind] && VARIANTS[kind].length >= minVarianten) {
    var seg = el("div", "seg");
    for (var i = 0; i < VARIANTS[kind].length; i++) {
      (function (v) {
        var b = el("button", v[0] === variant ? "on" : "", v[1]);
        b.addEventListener("click", function () {
          if (target && ed.tool === "auswahl") {
            /* Nur das Auswahl-Werkzeug darf ein markiertes Element
               umschreiben. Nach dem Platzieren bleibt das frische Element
               markiert — ein Variantenklick in einem Setz-Werkzeug soll das
               NAECHSTE Element betreffen, nicht das gerade gesetzte
               ueberschreiben (Bedienungsrunde: „alte werden ueberschrieben"). */
            pushUndo();
            target.variant = v[0];
            var nd = defaultsFor(target.kind, v[0]);
            for (var k in nd) if (target.params[k] === undefined) target.params[k] = nd[k];
            commit(target, true);
          } else if (target) {
            // Platzierungswerkzeug: Markierung loesen, damit weitere
            // Variantenklicks nicht versehentlich das Gesetzte umbauen.
            ed.selected = null;
            ed.auswahl.length = 0;
            rebuildHandles();
          }
          /* Werkzeug-Variante IMMER mitziehen (Bedienungsrunde): nach dem
             Platzieren ist das frische Element ausgewaehlt, und der
             Varianten-Klick aenderte bisher nur target.variant — der naechste
             Klick setzte dann wieder die ALTE Werkzeug-Variante. Jetzt gilt:
             was man zuletzt gewaehlt hat, wird auch als naechstes gesetzt. */
          if (ed.variantOf[kind] !== undefined) {
            ed.variantOf[kind] = v[0];
            if (ed.draw && ed.draw.kind === kind) ed.draw.variant = v[0];
          }
          buildPanel();
          updateHint();
        });
        seg.appendChild(b);
      })(VARIANTS[kind][i]);
    }
    var wrap = el("div", "row");
    wrap.appendChild(seg);
    panelEl.appendChild(wrap);
  }

  /* J3 — die Namenszeile steht VOR den Parametern: der Name ist das, was man
     an einem Element zuerst sucht. Sie erscheint nur an einem gewaehlten
     Element, denn ein Name gehoert zu EINEM Ding, nicht zur Werkzeugeinstellung
     (`name` ist deshalb auch kein Eintrag in PARAMS: es hat keinen Default,
     erbt nichts und darf beim Zeichnen nicht mitkopiert werden). */
  if (target) panelEl.appendChild(elementNamensZeile(target));

  // Parameter
  var defs = PARAMS[schemaKey(kind, variant)] || [];
  // Drei Aufruf-Modi statt zwei: true = Undo-Punkt (unveraendert), "vorschau" =
  // leichte Live-Vorschau waehrend des Slider-Zugs, ohne Argument = voller
  // Commit (Slider-change, Checkboxen, Selects — letztere feuern kein
  // input-Gewitter und duerfen sofort schwer committen). Bei Fluessen zeigt
  // die Vorschau das Flussbett im Terrain noch nicht — bewusst akzeptiert,
  // der schwere Teil folgt beim Loslassen.
  var applyFn = function (mode) {
    if (mode === true) { if (target) pushUndo(); return; }
    if (!target) return;
    /* Runde H (Bedienung): Kartenzeichen-Marker gehen NICHT ueber
       regenElement/commit — genElement (core/dirty.js) kennt ihren Zweig noch
       nicht und wuerde die Instanz nur leeren (die fehlende Zeile steht in
       editor/tools.js beim Erzeuger). genZeichenMarker ist Vorschau und
       Commit in einem: leicht genug fuer jeden Reglerpixel. */
    if (kind === "marker" && variant === "zeichen") { genZeichenMarker(target); return; }
    if (mode === "vorschau") { regenElement(target); return; }
    commit(target, isHeavy(target));
  };
  for (var d = 0; d < defs.length; d++) {
    var def = defs[d];
    /* Asset-Auswahl: statt des rohen „Nur Typ"-Selects steht hier der
       visuelle Katalog — Vorschaukarten der Pools der gewaehlten Objektart,
       eine Suche ueber alle erreichbaren Assets und die Mischung als erste
       Karte. Geschrieben wird weiterhin exakt params.nurTyp; Schema, Laden
       und Platzierungsregeln (generators/objects.js) bleiben unveraendert. */
    if (kind === "objekt" && def.k === "nurTyp") {
      if (obj[def.k] === undefined) obj[def.k] = def.d;
      panelEl.appendChild(baueObjektKatalog({
        optionen: nurTypOptionen(variant),
        wert: obj[def.k],
        waehle: (function (feld) {
          return function (name) {
            applyFn(true);
            obj[feld] = name || "";
            applyFn();
            buildPanel();
          };
        })(def.k)
      }));
      continue;
    }
    if (obj[def.k] === undefined) obj[def.k] = def.d;
    panelEl.appendChild(paramRow(def, obj, applyFn));
  }

  // I4: Klickziel der Beschriftung — von Hand, weil {art, ref} kein Skalar ist.
  if (kind === "marker" && variant === "beschriftung") baueZielZeile(obj, applyFn);
  // I4: Verknuepfung mit einem Pfad — von Hand, weil die Auswahlliste aus der
  // Elementliste kommt und erst zur Laufzeit feststeht.
  if (target && kind === "marker" && variant === "beschriftung") baueAnPfadZeile(target, applyFn);

  if (target) {
    panelEl.appendChild(el("hr"));
    var reroll = el("button", "btn", "🎲  Neu würfeln");
    reroll.addEventListener("click", function () {
      pushUndo();
      target.seed = (target.seed + 0x9e3779b9) | 0;
      commit(target, isHeavy(target));
      toast("Bestückung neu gewürfelt");
    });
    panelEl.appendChild(reroll);
    var del = el("button", "btn warn", "Löschen  (Entf)");
    del.addEventListener("click", function () {
      pushUndo();
      var heavy = isHeavy(target);
      deleteElement(target);
      ed.selected = null;
      /* A3: Die Konvention aus tools.js lautet "ed.selected === null <=>
         ed.auswahl ist leer". Ohne diese Zeile bliebe hier eine Auswahl ohne
         fuehrendes Element stehen — mitsamt einer Referenz auf das gerade
         geloeschte Element, das K dann in einen Stempel packen wollte. */
      ed.auswahl.length = 0;
      rebuildHandles();
      commit(null, heavy);
      buildPanel();
    });
    panelEl.appendChild(del);
    panelEl.appendChild(el("div", "psub", "Punkte ziehen verändert die Form — die Bestückung " +
      "wird dabei neu erzeugt."));
  } else if (kind === "terrain") {
    panelEl.appendChild(el("div", "psub", "Ziehen verformt das Terrain. „Einebnen“ nimmt die Höhe " +
      "des ersten Klicks als Ziel."));
  } else if (kind === "stempel") {
    baueStempelPanel();
  } else if (kind === "marker") {
    baueMarkerPanel();
  } else if (kind === "wegsuche") {
    // A2: das Werkzeug selbst (zwei Klicks) gehoert nach editor/tools.js und
    // editor/pointer.js. Der Zweig steht hier schon bereit und bleibt bis dahin
    // unerreichbar — kind ist "wegsuche" nur, wenn TOOLS einen solchen Eintrag
    // traegt.
    panelEl.appendChild(el("div", "psub",
      "Zwei Punkte klicken — dazwischen sucht sich die Straße ihren Verlauf: " +
      "Steigungen kosten (über 40° praktisch gesperrt), Wasserquerungen sind teuer " +
      "und bekommen von selbst eine Brücke, vorhandene Wege sind billig, Wege bündeln " +
      "sich also. Esc bricht ab."));
  } else if (kind === "pfad" && variant === "biompinsel") {
    // I2: eigener Text, weil der Pinsel als einzige Pfadvariante nicht
    // geklickt, sondern gezogen wird.
    panelEl.appendChild(el("div", "psub",
      "Ziehen trägt das gewählte Biom im Kreis auf — für die Nachbearbeitung "
      + "gezeichneter Biomflächen. Der Strich bleibt ein Element: Punkte ziehen, "
      + "Biom umstellen, löschen, rückgängig machen, alles wie gewohnt. Die Farbe "
      + "erscheint beim Loslassen."));
  } else if (kind === "pfad" || kind === "flaeche") {
    panelEl.appendChild(el("div", "psub", "Klicken setzt Punkte, Doppelklick oder Enter schließt ab, " +
      "Esc bricht ab."));
  }
}

/* ==========================================================================
   A3 — Bedienung des Stempelwerkzeugs im Panel

   Die drei Gesten gab es bisher nur als Tastenkuerzel (K/R/M in
   editor/pointer.js). Tastenkuerzel bleiben sie — die Knoepfe rufen exakt
   dieselben Funktionen auf und sind die sichtbare Seite derselben Sache; die
   Beschriftung nennt darum jeweils die Taste mit.

   Drehung und Spiegelung sitzen in einem `.seg`-Streifen, nicht in
   `.btn`-Zeilen: fuer `.seg button.on` gibt es die aktive Darstellung schon
   (ui/style.css ist in dieser Runde tabu, `.btn.on` waere ungestylt geblieben)
   — und beides sind Zustandsschalter, keine einmaligen Aktionen.
   ========================================================================== */
function baueStempelPanel() {
  var st = aktuellerStempel();

  panelEl.appendChild(el("hr"));

  var bK = el("button", "btn", "Stempel aus Auswahl  (K)");
  bK.title = "Nimmt die im Auswahl-Werkzeug gewählten Elemente (Shift+Klick wählt mehrere) "
    + "als neue Komposition in die Bibliothek auf.";
  bK.addEventListener("click", function () {
    var sel = auswahlElemente();
    if (!sel.length) {
      toast("Erst Elemente wählen: Auswahl-Werkzeug, Shift+Klick fügt hinzu");
      return;
    }
    var name = prompt("Name des Stempels (" + sel.length + " Elemente)", ed.variantOf.stempel || "");
    if (name === null) return;
    var neu = stempelErzeugen(String(name));
    if (!neu) { toast("Stempel braucht einen Namen"); return; }
    toast("Stempel „" + neu.name + "“ gespeichert (" + neu.elemente.length + " Elemente)");
    buildPanel();
    updateHint();
  });
  panelEl.appendChild(bK);

  var seg = el("div", "seg");
  var bR = el("button", ed.stempelDrehung ? "on" : "",
    "Drehen 90° (R) · " + (ed.stempelDrehung * 90) + "°");
  bR.addEventListener("click", function () {
    ed.stempelDrehung = (ed.stempelDrehung + 1) & 3;
    toast("Stempeldrehung " + (ed.stempelDrehung * 90) + "°");
    buildPanel();
    updateHint();
  });
  var bM = el("button", ed.stempelSpiegel ? "on" : "",
    "Spiegeln (M) · " + (ed.stempelSpiegel ? "an" : "aus"));
  bM.addEventListener("click", function () {
    ed.stempelSpiegel = !ed.stempelSpiegel;
    toast(ed.stempelSpiegel ? "Stempel gespiegelt" : "Stempel ungespiegelt");
    buildPanel();
    updateHint();
  });
  seg.appendChild(bR);
  seg.appendChild(bM);
  var wrap = el("div", "row");
  wrap.appendChild(seg);
  panelEl.appendChild(wrap);

  panelEl.appendChild(el("div", "psub", st
    ? "Klick setzt „" + st.name + "“ (" + st.elemente.length
      + (st.elemente.length === 1 ? " Element" : " Elemente")
      + ") — jedes Mal mit frischen Seeds, die Bestückung wiederholt sich also nicht. "
      + "Geländehöhen werden nicht mitkopiert: ein Stempel setzt Elemente, kein Relief. "
      + "Liegt das Ziel anders im Gelände, muss das Terrain dort von Hand nachgezogen werden."
    : "Noch kein Stempel in der Bibliothek. Mit dem Auswahl-Werkzeug Elemente wählen "
      + "(Shift+Klick nimmt weitere dazu) und hier „Stempel aus Auswahl“ drücken. "
      + "Die Bibliothek überdauert die Sitzung und wandert beim Speichern mit der Karte."));
}

/**
 * Misst die untere Leiste und legt ihre Hoehe als CSS-Variable ab.
 *
 * Die Hinweiszeile stand darueber auf einem geratenen Abstand. Das ging,
 * solange die Leiste eine Reihe hoch war — sie bricht aber je nach
 * Fensterbreite auf zwei um, und seit der Angleichung an das UWE-Design ist
 * die Laufschrift breiter, der Umbruch also frueher. Der Hinweis lag dann
 * ueber der Leiste und verdeckte Seed-Feld und Biomauswahl.
 *
 * Eine feste Zahl haette den Fehler nur verschoben. Gemessen wird beim
 * Wechsel des Hinweises und beim Aendern der Fenstergroesse — beides sind die
 * einzigen Anlaesse, bei denen sich die Hoehe aendern kann.
 */
function leistenHoeheMessen() {
  var bar = document.getElementById("bar");
  if (!bar) return;
  document.documentElement.style.setProperty(
    "--terra-leiste-hoehe", Math.ceil(bar.getBoundingClientRect().height) + "px");
}
if (typeof window !== "undefined") {
  window.addEventListener("resize", leistenHoeheMessen);
}

/* ==========================================================================
   Bedienungsrunde — die Hinweiszeile laesst sich ausblenden

   Wer die Gesten kennt, will die Box nicht dauerhaft im Bild. Das × blendet
   sie aus (im Browser-Speicher gemerkt, ueberdauert die Sitzung); an ihrer
   Stelle bleibt ein kleiner ?-Knopf, der sie zurueckholt.
   ========================================================================== */
var HINWEIS_KEY = "terra.hinweis.aus";
var hinweisAus = speicherLesen(HINWEIS_KEY) === "1";

function hinweisZeigenKnopf() {
  var z = document.getElementById("hintZeigen");
  if (z) return z;
  var ui = document.getElementById("ui");
  if (!ui) return null;
  z = el("button", "card", "?");
  z.id = "hintZeigen";
  z.title = "Bedienhinweise wieder einblenden";
  z.addEventListener("click", function () {
    hinweisAus = false;
    speicherSchreiben(HINWEIS_KEY, "0");
    updateHint();
  });
  ui.appendChild(z);
  return z;
}

function updateHint() {
  leistenHoeheMessen();
  var h = document.getElementById("hint");
  var zeig = hinweisZeigenKnopf();
  if (hinweisAus) {
    h.style.display = "none";
    if (zeig) zeig.style.display = "";
    return;
  }
  if (zeig) zeig.style.display = "none";
  h.style.display = "";
  var txt;
  if (ed.draw) txt = "<b>" + ed.draw.points.length + (ed.draw.points.length === 1 ? " Punkt" : " Punkte") +
    "</b> — Doppelklick oder <b>Enter</b> beendet, <b>Esc</b> bricht ab";
  // I2: der Biompinsel ist eine Pfadvariante, aber keine Zeichnung — sein
  // Zweig steht deshalb VOR dem allgemeinen Pfadtext.
  else if (ed.tool === "pfad" && ed.variantOf.pfad === "biompinsel")
    txt = "<b>Ziehen</b> trägt das Biom „" + (toolParams["pfad:biompinsel"] || {}).biom
      + "“ im Kreis auf · Radius und Biom im Panel rechts";
  else if (ed.tool === "pfad") txt = "<b>Pfad</b> zeichnen: klicken, Doppelklick beendet";
  else if (ed.tool === "flaeche") txt = "<b>Fläche</b> zeichnen: klicken, Doppelklick schließt das Polygon";
  else if (ed.tool === "objekt") txt = "<b>Klicken</b> platziert, <b>Ziehen</b> streut";
  else if (ed.tool === "ranke") txt = "<b>Klicken</b> pflanzt eine Ranke · <b>Alt+Klick</b> wächst einen Fuß an die ausgewählte an";
  else if (ed.tool === "terrain") txt = "<b>Ziehen</b> formt das Terrain";
  // D1 — Marker: eigener Zweig, sonst faellt das Werkzeug in den Auswahl-Text
  // und die einzige Geste, die den Text aendert (Doppelklick), bliebe ungenannt.
  else if (ed.tool === "marker") txt = "<b>Klick</b> setzt eine Nadel · <b>Klick auf eine Nadel</b> " +
    "wählt sie · <b>Doppelklick</b> ändert den Text · <b>Entf</b> löscht sie";
  // A3 — Stempel: die beiden Zustandsschalter nennen ihren AKTUELLEN Wert.
  // Ohne ihn muesste man raten, wie der naechste Klick ausgerichtet ist.
  else if (ed.tool === "stempel") txt = "<b>Klick</b> setzt " +
    (aktuellerStempel() ? "„" + aktuellerStempel().name + "“" : "den gewählten Stempel") +
    " · <b>R</b> dreht (" + (ed.stempelDrehung * 90) + "°) · <b>M</b> spiegelt (" +
    (ed.stempelSpiegel ? "an" : "aus") + ")";
  // A2: greift, sobald editor/tools.js ein Werkzeug "wegsuche" fuehrt.
  else if (ed.tool === "wegsuche") txt = "<b>Wegsuche</b>: erst den Startpunkt klicken, dann das " +
    "Ziel — der Weg sucht sich seinen Verlauf über das Gelände · <b>Esc</b> bricht ab";
  else txt = "<b>Klick</b> wählt aus · <b>Shift+Klick</b> wählt mehrere · <b>K</b> macht daraus einen Stempel · Griffe ziehen · <b>Doppelklick</b> auf Pfad oder Rankenachse setzt einen Punkt · <b>Shift</b> zieht Zugpunkte in der Höhe · <b>Entf</b> löscht";
  h.innerHTML = txt + "<br>WASD bewegen · Q/E drehen · Rad zoomen · Rechte Maus schwenken";
  var zu = el("button", "hintZu", "×");
  zu.title = "Hinweise ausblenden — der kleine ?-Knopf unten links holt sie zurück";
  zu.addEventListener("click", function () {
    hinweisAus = true;
    speicherSchreiben(HINWEIS_KEY, "1");
    updateHint();
  });
  h.appendChild(zu);
}

var toastT = 0;
function toast(msg) {
  var t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  toastT = performance.now() + 1600;
}

function updateStats(fps) {
  var info = getRenderInfo();
  document.getElementById("stats").innerHTML =
    Math.round(fps) + " <span>fps</span> &nbsp; " +
    info.calls + " <span>calls</span> &nbsp; " +
    (info.triangles > 99999 ? Math.round(info.triangles / 1000) + "k"
      : info.triangles.toLocaleString("de-DE")) + " <span>tris</span> &nbsp; " +
    (instanceTotal + schattenAnzahl).toLocaleString("de-DE") + " <span>Instanzen</span> &nbsp; " +
    S.elements.length + " <span>Elemente</span>" +
    // Adaptive Aufloesung sichtbar machen: laeuft der Leistungsregler unter
    // voller Schaerfe, soll man wissen WARUM das Bild weicher ist.
    (info.skala && info.skala < 1
      ? " &nbsp; " + Math.round(info.skala * 100) + "<span>% Auflösung</span>" : "");
}


/* ==========================================================================
   D1 — Beschriftung der Marker als HTML-Overlay

   editor/selection.js zeichnet die Stecknadeln, aber bewusst keinen Text: eine
   Schrift im 3D-Bild braeuchte je Marker eine gerenderte Textur (neu bei jeder
   Textaenderung) und laege schraeg zur Kamera. Ein HTML-Label ist scharf, in
   jeder Kameralage waagerecht, kostet keine Zeichenaufrufe und wird vom
   Browser mit Systemschrift und Kerning gesetzt.

   Machart bewusst wie #ui: ein fester Container ueber dem Canvas, der KEINE
   Zeigerereignisse annimmt (pointer-events:none) — sonst faenge ein Label den
   Klick ab, mit dem man genau diesen Marker anwaehlen will. z-index 5 liegt
   ueber dem Canvas (0) und unter dem Bedienrahmen (#ui, 10): Panel und
   Werkzeugleiste bleiben oben.

   Alles Styling steht hier in JS. ui/style.css ist in dieser Runde tabu; die
   Werte sind aus .card/.psub uebernommen, damit die Labels wie das uebrige UI
   aussehen.

   Es gibt kein rebuild: die Labels werden je Bild aus S.marker nachgezogen
   (Anzahl, Text, Position). Damit stimmen sie ohne einen einzigen zusaetzlichen
   Aufruf auch nach Laden, Undo, Loeschen und Umbenennen.
   ========================================================================== */
var MARKER_TON = { ort: "#7d8a99", gefahr: "#c1523c", notiz: "#b8862a", arbor: "#2f9c8c" };
var markerBox = null;              // Container-Div, beim ersten Marker angelegt
var markerLabels = [];             // ein Div je Marker, Index = Index in S.marker
var _mProj = new Vector3();

function markerBoxHolen() {
  if (markerBox && markerBox.parentNode) return markerBox;
  markerBox = document.createElement("div");
  markerBox.id = "markerLabels";
  var s = markerBox.style;
  s.position = "fixed";
  s.inset = "0";
  s.pointerEvents = "none";
  s.zIndex = "5";
  s.overflow = "hidden";
  document.body.appendChild(markerBox);
  return markerBox;
}

function markerLabelNeu() {
  var d = document.createElement("div");
  /* Die GESTALTUNG steht in ui/style.css unter `.markerLabel`. Sie stand
     frueher hier als Inline-Stil, und Inline schlaegt jede Regel im
     Stylesheet — diese Beschriftungen waren deshalb die einzige Stelle, die
     nach der Angleichung an das UWE-Design noch im alten Blaugrau stand und
     auch nicht mit Tag/Nacht drehte.

     Was inline BLEIBT, ist Mechanik und keine Gestaltung: die Verankerung an
     der Nadelspitze, die Umbruchsperre, die Breitengrenze und die
     Durchlaessigkeit fuer Klicks. Diese Werte gehoeren zur Positionierung im
     Bild, nicht zum Aussehen, und ein Themenwechsel hat mit ihnen nichts zu
     schaffen. */
  d.className = "markerLabel";
  var s = d.style;
  s.position = "absolute";
  // Der Ankerpunkt ist die Nadelspitze: waagerecht mittig, senkrecht darueber.
  s.transform = "translate(-50%,-100%)";
  s.whiteSpace = "nowrap";
  s.padding = "2px 8px";
  s.maxWidth = "230px";
  s.overflow = "hidden";
  s.textOverflow = "ellipsis";
  s.pointerEvents = "none";
  markerBoxHolen().appendChild(d);
  return d;
}

/**
 * Zieht die Beschriftungen aller Marker nach. Wird je Bild aus tickToast
 * gerufen (siehe dort) und ist fuer den Normalfall — keine Marker — nach zwei
 * Vergleichen wieder draussen.
 */
function markerOverlayAktualisieren() {
  var n = S.marker.length;
  if (!n && !markerLabels.length) return;          // haeufigster Fall, sofort raus

  // Anzahl angleichen. Kein vollstaendiger Neuaufbau: die Divs bleiben ueber
  // Bilder hinweg dieselben, es aendern sich nur left/top.
  while (markerLabels.length < n) markerLabels.push(markerLabelNeu());
  while (markerLabels.length > n) {
    var weg = markerLabels.pop();
    if (weg.parentNode) weg.parentNode.removeChild(weg);
  }
  if (!n) return;

  // Gleiche Skalierung wie die Nadeln in selection.js (updateMarkerPositions):
  // die Nadel ist rund 7.3 Einheiten hoch, das Label sitzt knapp darueber.
  var s = clamp(cam.dist * 0.011, 0.5, 3.2);
  var bw = window.innerWidth, bh = window.innerHeight;
  var gewaehlt = getMarkerAuswahl();

  for (var i = 0; i < n; i++) {
    var m = S.marker[i], d = markerLabels[i];
    if (!m.text) { d.style.display = "none"; continue; }   // unbeschriftet: nur die Nadel
    var hoch = (i === gewaehlt ? 7.3 * 1.3 : 7.3) * s + 0.6;
    _mProj.set(m.x, heightAt(m.x, m.z) + hoch, m.z);
    _mProj.project(camera);
    /* Hinter der Kamera ausblenden: dort ist w negativ, project() spiegelt x/y
       am Ursprung und liefert z > 1 — ohne diesen Test klebte das Label eines
       Markers im Ruecken spiegelverkehrt am Bildrand. Der grosszuegige
       Randbereich (±1.4) laesst Labels bis knapp ausserhalb stehen, statt sie
       am Bildrand aufblitzen zu lassen. */
    if (_mProj.z > 1 || _mProj.x < -1.4 || _mProj.x > 1.4 ||
        _mProj.y < -1.4 || _mProj.y > 1.4) { d.style.display = "none"; continue; }
    d.style.display = "block";
    d.style.left = ((_mProj.x * 0.5 + 0.5) * bw).toFixed(1) + "px";
    d.style.top = ((-_mProj.y * 0.5 + 0.5) * bh).toFixed(1) + "px";
    // Text und Farbe nur bei echter Aenderung schreiben: jedes Setzen von
    // textContent/style loest im Browser ein Neulayout aus, und beides steht
    // hier in einer Schleife, die 60-mal je Sekunde laeuft.
    if (d._txt !== m.text) { d._txt = m.text; d.textContent = m.text; }
    var ton = MARKER_TON[m.art] || MARKER_TON.notiz;
    if (d._ton !== ton) { d._ton = ton; d.style.borderLeft = "3px solid " + ton; }
    var aktiv = i === gewaehlt;
    if (d._aktiv !== aktiv) {
      d._aktiv = aktiv;
      // Klasse statt zweier Inline-Farben: die gewaehlte Beschriftung soll in
      // beiden Modi richtig aussehen, und das kann nur das Stylesheet wissen.
      d.classList.toggle("aktiv", aktiv);
    }
  }
}

/** Toast-Timer und Markerbeschriftung, von der Renderschleife bedient.
 *
 *  Das Overlay haengt hier mit dran, weil tickToast der einzige Taktgeber ist,
 *  den ui/panels.js schon besitzt: main.js ruft es in animate() je Bild auf.
 *  Sauberer waere in main.js eine eigene Zeile — `markerOverlayAktualisieren()`
 *  ist dafuer exportiert und darf jederzeit direkt aus der Renderschleife
 *  gerufen werden; dann entfaellt der Aufruf hier. */
/* J3 — das Markerpanel lebendig halten. editor/pointer.js setzt und waehlt
   Nadeln, ohne buildPanel zu rufen (und die Datei gehoert dieser Runde nicht).
   Statt dort eine Zeile zu ergaenzen, merkt sich das Panel Anzahl und Auswahl
   und baut sich nach, wenn sich eines der beiden aendert — zwei
   Ganzzahlvergleiche je Bild, und nur solange das Markerwerkzeug offen ist.
   Der Fokus-Test verhindert, dass ein Neuaufbau die gerade laufende Eingabe
   verschluckt. */
var mAnzahl = -1, mWahl = -2;
function markerPanelNachziehen() {
  if (ed.tool !== "marker" || ed.selected) { mAnzahl = -1; mWahl = -2; return; }
  var n = S.marker.length, w = getMarkerAuswahl();
  if (n === mAnzahl && w === mWahl) return;
  mAnzahl = n; mWahl = w;
  var akt = document.activeElement;
  if (akt && panelEl && panelEl.contains(akt)) return;   // Eingabe laeuft
  buildPanel();
}

function tickToast(now) {
  if (toastT && now > toastT) {
    document.getElementById("toast").classList.remove("show");
    toastT = 0;
  }
  // markerOverlayAktualisieren laeuft NICHT mehr hier mit: main.js ruft es
  // laengst als eigene Zeile in der Renderschleife — der zweite Aufruf je
  // Bild war reine Doppelarbeit (Projektion + Stilvergleiche je Marker).
  markerPanelNachziehen();
}

export { el, buildRail, paramRow, buildPanel, updateHint, toast, tickToast, updateStats,
  markerOverlayAktualisieren, setzeKartenWege };
