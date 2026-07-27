// Untere Leiste: Seed, Tageszeit, Raster, Effekte, Speichern, Laden, PNG-Export.
import { S, KARTE, KARTEN_GROESSEN, setKartenGroesse, BIOME, hoehenProfil,
  hoehenProfilGleich, serializeElements, hydrate, serializeMarker, hydrateMarker,
  serializeStempel, speicherLesen, speicherSchreiben } from '../core/store.js';
import { base, genBase, genBaseIn, terrainGeometrienNeu, basisGeaendert } from '../world/terrain.js';
// I1: der Kartenbaum. kartenbaum.js haengt nur an core/rng.js und
// core/store.js — kein Zyklus, auch nicht ueber diesen Import zurueck.
import { baueKartenbaum, mitKarte, legeKindkarteAn, pfadZurWurzel, kinderVon,
  leiteKindHoehenAb, handarbeitErmitteln, handarbeitAnwenden,
  erbWerte, loeseFeld, setzeEigen, erbeWieder, massstabName, massstabInfo,
  leseBaumDatei, schreibeBaumDatei, hoehenNachziehen } from '../world/kartenbaum.js';
import { rebuildAll } from '../core/dirty.js';
import { pushUndo, verwerfeHistorie } from './history.js';
import { rebuildHandles } from './selection.js';
// F4: der PNG-Export soll in der komponierten Einstellung aufnehmen. Dafuer
// braucht er den Modusschalter und updateCamera, um die gedaempfte Fahrt in
// einem Rutsch vorzuspulen (siehe kameraVorspulen weiter unten).
import { cam, setAufnahme, istAufnahme, updateCamera } from './camera.js';
import { ed, stempelUebernehmen, setzeAusschnittWeg, setTool } from './tools.js';
import { setTod, getTodName, setWetter, getWetterName } from '../world/atmosphere.js';
import { buildPanel, toast, setzeKartenWege } from '../ui/panels.js';
// J1: die Einbettung. Gleiche Richtung wie setzeKartenWege oben — io.js meldet
// seine Wege an, bruecke.js importiert NICHTS aus terra. Ausserhalb eines
// Rahmens (Doppelklick, Node-Tests) bleibt das Modul vollstaendig still.
import { setzeBrueckenWege, brueckeAktiv } from './bruecke.js';
// I4: Zielpruefung der Beschriftungen. beschriftung.js haengt nur an three und
// core/ — der Import ist zyklusfrei und bleibt es, solange das so ist.
import { zielPruefen } from '../ui/beschriftung.js';
/* J4 — KI-Vorgenerierung. welt.js LIEST nur (siehe weltWuerfeln in
   ui/panels.js); welt-vorgabe.js ist reine Rechnung. Das Einsetzen macht
   diese Datei, weil hier Kartengroesse, Biom, Terrain, Historie und Bild
   ohnehin zusammenlaufen. */
import { erzeugeWelt } from '../generators/welt.js';
import { pruefeVorgabe, weltOptionen, sucheSeed, namenAnwenden,
  herkunftBauen, herkunftGelesen } from '../generators/welt-vorgabe.js';
import { clearPreview } from './selection.js';
import { exportPNG, setPost, getPost, renderFrame,
  setFarbskript, getFarbskript, setPalette, getPalette, setMalschicht,
  getMalschicht, setMultiplane, getMultiplane } from '../render/pipeline.js';
import { camera } from './camera.js';
import { preview, handles, brushRing, markerGruppe, auswahlRahmen, rebuildMarker,
  waehleMarker } from './selection.js';
import { weiteHuellenNeu } from '../core/pools.js';
import { wasserNeuBauen } from '../world/water.js';

// Grenzen beim Übernehmen der gespeicherten Kamera: Zoom wie das Mausrad
// (pointer.js klemmt tDist auf 25..400), Fokus wie die Tastatursteuerung.
// Der Fokus haengt an der Kartengroesse und wird deshalb JETZT gelesen, nicht
// beim Modulstart in eine Konstante kopiert (H1b — HALF ist keine Konstante
// mehr, sondern eine lebende Bindung aus core/store.js).
var CAM_DIST_MIN = 25, CAM_DIST_MAX = 400;
function camFokusMax() { return KARTE.half + 40; }

/* --- Palettenbindung aus dem Biom (F1) -----------------------------------
   Die Standardrampe in pipeline.js ist entsaettigt "Tiefen blau, Lichter
   cremig". Aufgeprägt auf ein dunkles Biom zieht sie Mitteltoene Richtung
   Creme — in der Sichtpruefung bekam der Aschekegel dadurch helle Flecken.
   Die Rampe muss also aus dem Biom kommen: dessen Terrainpalette IST die
   Sammlung der Farben, die auf der Karte wirklich vorkommen. Sortiert nach
   Luminanz ergibt sie genau das, was ein Maler vormischt.                */
function biomRampe(b) {
  var t = (BIOME[b] || BIOME.wiese).terrain;
  var namen = ["tiefe", "seegrund", "erde", "tritt", "grasKuehl", "driftBlau",
    "grasWarm", "driftGelb", "grasTrocken", "fels", "sand", "brandung", "schnee"];
  var liste = [];
  for (var i = 0; i < namen.length; i++) {
    var c = t[namen[i]];
    if (!c) continue;
    liste.push({ hex: c.getHex(), lum: 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b });
  }
  // Nach Helligkeit sortieren; gleiche Luminanz ueber den Namen entscheiden,
  // damit die Rampe deterministisch bleibt.
  liste.sort(function (a, b2) { return a.lum - b2.lum || a.hex - b2.hex; });
  var raus = [];
  for (var k = 0; k < liste.length; k++) raus.push(liste[k].hex);
  return raus;
}

/** Rampe des aktiven Bioms setzen. Staerke bewusst niedrig: die Bindung soll
 *  das Bild auf eine Palette ziehen, nicht postern — 0.34 nahm in der
 *  Sichtpruefung sichtbar Kontrast. */
export function palettePassend() {
  setPalette(biomRampe(S.biom), 0.16);
}

/* --- Kartengroesse wechseln (H1b) ---------------------------------------
   setKartenGroesse() in store.js aendert nur Zahlen. Alles, was an diesen
   Zahlen haengt, muss hier in dieser Reihenfolge nachgezogen werden:
     1. Zahlen setzen (MAP/VW/HALF/MAX_INST_PER_EL),
     2. Hoehenfelder + Patchraster neu (terrain.js) — MUSS vor genBase laufen,
        weil genBase in das neue base-Feld schreibt,
     3. Huellkugeln der Instanz-Pools (pools.js),
     4. Wasserebene + Meeresboden (water.js),
     5. Kamerafokus in die neuen Grenzen klemmen (beim Verkleinern stuende er
        sonst ausserhalb der Karte).
   genBase/rebuildAll ruft der jeweilige Aufrufer, weil sich Lade- und
   UI-Pfad dort unterscheiden. */
function setzeKartenGroesse(n) {
  var g = setKartenGroesse(n);
  terrainGeometrienNeu();
  // Die gespeicherten Hoehenfelder der Historie passen nach dem Wechsel nicht
  // mehr zur Feldgroesse — ein Undo darueber hinweg stellte sonst ein fremdes
  // Terrain her (H1e).
  verwerfeHistorie();
  weiteHuellenNeu();
  wasserNeuBauen();
  var m = camFokusMax();
  cam.tFocus.x = Math.max(-m, Math.min(m, cam.tFocus.x));
  cam.tFocus.z = Math.max(-m, Math.min(m, cam.tFocus.z));
  cam.focus.x = Math.max(-m, Math.min(m, cam.focus.x));
  cam.focus.z = Math.max(-m, Math.min(m, cam.focus.z));
  var sel = document.getElementById("kartenSel");
  if (sel) sel.value = String(g);
  return g;
}

/* --- Speicherformat v3: Hoehen als Delta zum Seed-Terrain -----------------
   Das Seed-Terrain ist deterministisch aus genBaseIn(_, worldSeed)
   reproduzierbar; nur vom Pinsel veraenderte Zellen weichen ab. v3 speichert
   deshalb statt ~66k Zahlen nur `hoehenDelta: [i0, v0, i1, v1, ...]` —
   flache Index/Wert-Paare. Determinismus-Hinweis: die Umstellung der
   Bestueckungs-Zufaelle (generators/) auf ortsstabile Hashes aendert genBase
   NICHT (genBase haengt nur an fractal/hashi in terrain.js); das
   Delta-Format ist davon unabhaengig korrekt. Beide Helfer sind rein.   */

/**
 * Diff-Haelfte: vergleicht die aktuellen Hoehen mit dem frischen Seed-Terrain
 * und liefert das flache Paar-Array. Werte wie bisher auf 2 Nachkommastellen
 * gerundet; als Abweichung zaehlt erst |d| > 0.005, damit Rundungsrauschen
 * keine Eintraege erzeugt.
 */
function berechneHoehenDelta(aktuell, seedTerrain, anzahl) {
  var delta = [];
  // Nur die genutzten VW*VW Zellen vergleichen: die Hoehenfelder in
  // terrain.js wachsen mit der groessten je gewaehlten Kartengroesse mit und
  // koennen laenger sein als die aktuelle Karte (siehe felderSichern).
  for (var i = 0; i < anzahl; i++) {
    var d = aktuell[i] - seedTerrain[i];
    if (d > 0.005 || d < -0.005) delta.push(i, Math.round(aktuell[i] * 100) / 100);
  }
  return delta;
}

/** Merge-Haelfte: setzt die (bereits validierten) Deltapaare in das Ziel-Array. */
function wendeHoehenDeltaAn(ziel, delta) {
  for (var k = 0; k < delta.length; k += 2) ziel[delta[k]] = delta[k + 1];
}

/**
 * Prüft eine Elementliste (Kartenfeld `elemente` ODER die Elemente eines
 * Stempels) und liefert die geprüfte Kopie. Geprüft wird genau das, was
 * hydrate/mkElement/genElement wirklich brauchen: kind/variant fürs Schema,
 * points fürs Erzeugen, params als Objekt für die Schema-Ergänzung, seed/id
 * als Zahlen. Wirft bei jedem Verstoß; `wo` benennt die Fundstelle.
 * Ausgelagert aus validiereKarte, damit Stempel- und Kartenelemente
 * denselben Prüfweg nehmen — zwei Prüfungen driften sonst auseinander.
 */
function pruefeElemente(liste, wo) {
  var elemente = [];
  for (var k = 0; k < liste.length; k++) {
    var e = liste[k];
    if (!e || typeof e !== "object" || Array.isArray(e)) throw new Error("Ungültiges " + wo + " " + k);
    if (typeof e.kind !== "string" || !e.kind) throw new Error(wo + " " + k + ": kind fehlt");
    if (e.variant !== undefined && typeof e.variant !== "string") throw new Error(wo + " " + k + ": variant ungültig");
    if (!Array.isArray(e.points)) throw new Error(wo + " " + k + ": points fehlen");
    var pts = [];
    for (var p = 0; p < e.points.length; p++) {
      var pt = e.points[p];
      if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.z)) throw new Error(wo + " " + k + ": Punkt " + p + " ungültig");
      pts.push({ x: pt.x, z: pt.z });
    }
    if (e.params !== undefined && (typeof e.params !== "object" || e.params === null || Array.isArray(e.params)))
      throw new Error(wo + " " + k + ": params ungültig");
    // Zugpunkte der Ranken (H4.2) liegen in params und formen die Achse —
    // vines.js filtert zwar defensiv, aber eine kaputte Datei soll gar nicht
    // erst uebernommen werden (atomares Laden aus Runde C).
    if (e.params && Array.isArray(e.params.zugpunkte)) {
      for (var zq = 0; zq < e.params.zugpunkte.length; zq++) {
        var zz = e.params.zugpunkte[zq];
        if (!zz || !Number.isFinite(zz.h) || !Number.isFinite(zz.dx) || !Number.isFinite(zz.dz))
          throw new Error(wo + " " + k + ": Zugpunkt " + zq + " ungültig");
      }
    }
    /* I4 — das Klickziel einer Beschriftung. Die Pruefung sitzt HIER und
       nirgends sonst: Karten sollen geteilt werden, und eine fremde Datei darf
       keinen `javascript:`-Klick mitbringen. `zielPruefen` ist eine
       Erlaubnisliste (nur http und https), keine Verbotsliste — eine
       Verbotsliste haette man mit der naechsten Kodierung wieder umgangen.
       Abgelehnt wird beim LADEN und damit atomar, wie alles andere in dieser
       Funktion: lieber gar nicht geladen als halb. */
    if (e.params && e.params.ziel !== undefined) {
      var zp = zielPruefen(e.params.ziel);
      if (!zp.ok) throw new Error(wo + " " + k + ": ziel ungültig — " + zp.grund);
      // Die geprueften Werte ersetzen die eingelesenen — `zielPruefen` raeumt
      // dabei auch auf (art "keins" leert die Referenz).
      e.params = Object.assign({}, e.params, { ziel: zp.ziel });
    }
    if (e.seed !== undefined && !Number.isFinite(e.seed)) throw new Error(wo + " " + k + ": seed ungültig");
    if (e.id !== undefined && !Number.isFinite(e.id)) throw new Error(wo + " " + k + ": id ungültig");
    elemente.push({
      id: e.id === undefined ? undefined : (e.id | 0),
      kind: e.kind,
      variant: e.variant,
      points: pts,
      params: e.params || {},          // fehlende params ergänzt genElement aus dem Schema
      seed: e.seed === undefined ? 0 : (e.seed | 0)
    });
  }
  return elemente;
}

/**
 * Prüft eine geladene Kartendatei VOLLSTÄNDIG und baut temporäre, bereits
 * geprüfte Strukturen auf. Wirft bei jedem Verstoß — der Aufrufer fängt den
 * Fehler und lässt den Editor-Zustand dann komplett unangetastet.
 * Fassung 1 (terra.html, ohne version-Feld), Fassung 2 (hoehen-Vollarray),
 * Fassung 3 (hoehenDelta gegen das Seed-Terrain) und Fassung 4
 * (zusaetzlich `kartenGroesse`) werden gelesen.
 */
/* I2 — Klimaachse feldweise einlesen. Tolerant wie `biom` und `wetter`: jedes
   fehlende oder unbrauchbare Feld faellt einzeln auf seine Vorgabe zurueck,
   statt die ganze Karte scheitern zu lassen. Das ist Absicht und in
   docs/engineering/terra-runde-i-plan.md begruendet — atomar scheitern muss
   nur, was die Karte traegt, nicht ihr Beiwerk. */
function klimaGelesen(k) {
  var v = { richtung: 0, staerke: 0.5, grund: 0.5, hoeheKuehl: 0.012 };
  if (!k || typeof k !== "object") return v;
  for (var f in v) if (Number.isFinite(k[f])) v[f] = k[f];
  return v;
}

/* I1: in zwei Funktionen getrennt. Der Kartenbaum liest eine Datei mit
   MEHREREN Karten darin — er hat also bereits ein Objekt und keinen Text mehr,
   wenn er die einzelne Karte pruefen lassen will. Ein zweites JSON.parse je
   Karte waere nicht nur Verschwendung, es waere auch die falsche Zusage: die
   Datei ist einmal geparst, und ab da geht es um Inhalte, nicht um Text. */
function validiereKarte(text) { return validiereKarteObjekt(JSON.parse(text)); }

function validiereKarteObjekt(d) {
  if (!d || !d.elemente || !Array.isArray(d.elemente)) throw new Error("Unbekanntes Format");
  // Kartengroesse (v4). Fehlt das Feld — jede v1/v2/v3-Datei — gilt 256, denn
  // groesser konnte eine solche Karte nie sein. Unbekannte Werte werden nicht
  // geraten, sondern als Formatfehler behandelt: eine 700er-Karte gaebe es
  // sonst als stillschweigend verstuemmelte 256er.
  var kartenGroesse = 256;
  if (d.kartenGroesse !== undefined) {
    if (!Number.isFinite(d.kartenGroesse) || KARTEN_GROESSEN.indexOf(d.kartenGroesse | 0) < 0)
      throw new Error("Unbekannte Kartengröße");
    kartenGroesse = d.kartenGroesse | 0;
  }
  var zellen = (kartenGroesse + 1) * (kartenGroesse + 1);   // VW*VW der DATEI
  // Akzeptiert wird entweder `hoehen` (Vollarray, v1/v2) ODER `hoehenDelta`
  // (v3, flache Index/Wert-Paare). Enthaelt eine Datei unerwartet beides,
  // gewinnt `hoehen` — die einfachste tolerante Regel.
  var hatHoehen = Array.isArray(d.hoehen);
  if (!hatHoehen && !Array.isArray(d.hoehenDelta)) throw new Error("Unbekanntes Format");
  // Dateien ohne Versionsfeld stammen aus Fassung 1 und werden weiter gelesen;
  // fehlende Parameter ergänzt genElement aus dem Schema.
  var dateiVersion = d.version || 1;

  var hoehen = null, hoehenDelta = null;
  if (hatHoehen) {
    // Höhen: der genutzte Anfang muss aus endlichen Zahlen bestehen. Längere
    // Arrays werden abgeschnitten; kürzere füllt die Übernahme deterministisch
    // über genBase aus dem gespeicherten Seed auf.
    var n = Math.min(d.hoehen.length, zellen);
    hoehen = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var h = d.hoehen[i];
      if (typeof h !== "number" || !Number.isFinite(h)) throw new Error("Ungültige Höhe an Index " + i);
      hoehen[i] = h;
    }
  } else {
    // hoehenDelta: flaches Array gerader Laenge; Indizes ganzzahlig in
    // [0, zellen) — gegen die Kartengroesse DER DATEI geprueft, nicht gegen
    // base.length (das Feld kann laenger sein, siehe felderSichern).
    if (d.hoehenDelta.length % 2 !== 0) throw new Error("hoehenDelta: ungerade Länge");
    hoehenDelta = [];
    for (var q = 0; q < d.hoehenDelta.length; q += 2) {
      var di = d.hoehenDelta[q], dv = d.hoehenDelta[q + 1];
      if (typeof di !== "number" || !Number.isInteger(di) || di < 0 || di >= zellen)
        throw new Error("hoehenDelta: ungültiger Index an Position " + q);
      if (typeof dv !== "number" || !Number.isFinite(dv))
        throw new Error("hoehenDelta: ungültiger Wert an Position " + (q + 1));
      hoehenDelta.push(di, dv);
    }
  }

  var elemente = pruefeElemente(d.elemente, "Element");

  /* Marker (D1) und Stempel (A3): OPTIONALE Zusatzfelder wie `biom` und
     `seedZaehler`. Fehlen sie — jede Datei vor dieser Runde —, gilt "keine".
     Sind sie DA, werden sie so streng geprueft wie alles andere: die
     Validierung bleibt atomar, eine halb gelesene Karte gibt es nicht.
     Streng bei den TYPEN, tolerant bei den WERTEN: eine unbekannte Markerart
     ist kein Formatfehler (mkMarker faengt sie auf "ort"), ein Marker ohne
     endliche Koordinate schon. Deshalb bleibt `version` auch bei 4 —
     zusaetzliche optionale Felder brechen keinen aelteren Leser. */
  var marker = [];
  if (d.marker !== undefined) {
    if (!Array.isArray(d.marker)) throw new Error("marker: kein Array");
    for (var mk = 0; mk < d.marker.length; mk++) {
      var mm = d.marker[mk];
      if (!mm || typeof mm !== "object" || Array.isArray(mm))
        throw new Error("Marker " + mk + ": ungültig");
      if (!Number.isFinite(mm.x) || !Number.isFinite(mm.z))
        throw new Error("Marker " + mk + ": Koordinate ungültig");
      if (mm.text !== undefined && typeof mm.text !== "string")
        throw new Error("Marker " + mk + ": text ungültig");
      if (mm.art !== undefined && typeof mm.art !== "string")
        throw new Error("Marker " + mk + ": art ungültig");
      marker.push({ x: mm.x, z: mm.z, text: mm.text, art: mm.art });
    }
  }

  var stempel = [];
  if (d.stempel !== undefined) {
    if (!Array.isArray(d.stempel)) throw new Error("stempel: kein Array");
    for (var sk = 0; sk < d.stempel.length; sk++) {
      var ss = d.stempel[sk];
      if (!ss || typeof ss !== "object" || Array.isArray(ss))
        throw new Error("Stempel " + sk + ": ungültig");
      if (typeof ss.name !== "string" || !ss.name)
        throw new Error("Stempel " + sk + ": name fehlt");
      if (!ss.anker || !Number.isFinite(ss.anker.x) || !Number.isFinite(ss.anker.z))
        throw new Error("Stempel " + sk + ": anker ungültig");
      if (!Array.isArray(ss.elemente) || !ss.elemente.length)
        throw new Error("Stempel " + sk + ": elemente fehlen");
      // Dieselbe Elementpruefung wie oben — ein Stempelelement ist ein Element
      // ohne id und ohne seed (die vergibt stempelSetzen frisch).
      var sel = pruefeElemente(ss.elemente, "Stempel „" + ss.name + "“ · Element");
      var sElemente = [];
      for (var se = 0; se < sel.length; se++) {
        sElemente.push({ kind: sel[se].kind, variant: sel[se].variant,
          points: sel[se].points, params: sel[se].params });
      }
      stempel.push({ name: ss.name, anker: { x: ss.anker.x, z: ss.anker.z },
        elemente: sElemente });
    }
  }

  /* Farbskript (C2): OPTIONALES Zusatzfeld { licht, mitte, schatten, staerke }.
     Anders als Wetter und Biom wird es STRENG geprueft und nicht tolerant
     geglaettet: ein halb gelesenes Farbskript verschoebe die Farben der
     ganzen Karte, ohne dass jemand merkt, dass die Datei kaputt ist. Fehlt
     das Feld — jede Datei vor dieser Runde —, liefert die Pruefung null, und
     uebernehmeKarte schaltet den Zweig damit ab (Bild wie bisher).
     Die Farben werden auf 24 Bit geklemmt (& 0xffffff), weil setFarbskript
     sie an THREE.Color.set() weiterreicht; staerke muss endlich in 0..1
     liegen — alles andere ist ein Formatfehler. */
  var farbskript = null;
  if (d.farbskript !== undefined && d.farbskript !== null) {
    var skript = d.farbskript;
    if (typeof skript !== "object" || Array.isArray(skript)) throw new Error("farbskript: kein Objekt");
    var fFelder = ["licht", "mitte", "schatten"], fWerte = {};
    for (var fi = 0; fi < fFelder.length; fi++) {
      var fv = skript[fFelder[fi]];
      if (typeof fv !== "number" || !Number.isFinite(fv))
        throw new Error("farbskript: " + fFelder[fi] + " ist keine Zahl");
      fWerte[fFelder[fi]] = (fv | 0) & 0xffffff;
    }
    if (typeof skript.staerke !== "number" || !Number.isFinite(skript.staerke) ||
        skript.staerke < 0 || skript.staerke > 1)
      throw new Error("farbskript: staerke ungültig");
    fWerte.staerke = skript.staerke;
    farbskript = fWerte;
  }
  /* Ghibli-Bildaufbau (F1-F3). Die Setter in pipeline.js klemmen alles selbst,
     deshalb reicht hier tolerantes Durchreichen — geprueft wird nur die
     Farbrampe, weil ein Muellstring dort in THREE.Color.set() landete. */
  if (d.palette && typeof d.palette === "object" && Array.isArray(d.palette.farben)) {
    for (var pfi = 0; pfi < d.palette.farben.length; pfi++) {
      if (!Number.isFinite(d.palette.farben[pfi])) throw new Error("palette: Farbe " + pfi + " ist keine Zahl");
    }
  }

  return {
    marker: marker,
    stempel: stempel,
    dateiVersion: dateiVersion,
    kartenGroesse: kartenGroesse,
    seed: d.seed | 0,
    hoehen: hoehen,               // Float32Array (v1/v2) oder null
    hoehenDelta: hoehenDelta,     // flaches Paar-Array (v3) oder null
    elemente: elemente,
    kamera: d.kamera,
    raster: !!d.raster,
    tageszeit: d.tageszeit || "mittag",
    // Wetter (zweite Stimmungsachse): optionaler String, genauso tolerant wie
    // `tageszeit`. Fehlt das Feld oder ist der Wert unbekannt, gilt "klar" —
    // kein Formatfehler, denn eine Karte aus einem neueren Editor mit einer
    // weiteren Wetterlage soll lesbar bleiben. setWetter faengt Unbekanntes
    // ohnehin noch einmal ab; hier steht es, damit `karte.wetter` immer ein
    // String ist.
    wetter: typeof d.wetter === "string" ? d.wetter : "klar",
    // C2 Farbskript: null = kein Skript (Zweig aus).
    farbskript: farbskript,
    palette: d.palette || null,
    malschicht: d.malschicht || null,
    multiplane: d.multiplane || null,
    // Biom (G5, tolerantes Zusatzfeld): optionaler String. Fehlt das Feld
    // oder ist der Wert unbekannt, faellt die Karte ohne Fehler auf "wiese"
    // zurueck — aeltere Dateien sehen damit exakt wie bisher aus.
    biom: (typeof d.biom === "string" && BIOME[d.biom]) ? d.biom : "wiese",
    // J3: tolerant wie `biom` — unbekannte Werte fallen auf "auto" zurueck.
    sprachfamilie: typeof d.sprachfamilie === "string" ? d.sprachfamilie : "auto",
    /* J4: Herkunftsvermerk. Tolerant wie `biom` und `wetter` — was nicht
       stimmt, wird null. Der enthaltene Parametersatz laeuft durch DIESELBE
       Klemmung wie ein frischer, damit eine von Hand veraenderte Datei nichts
       durchreicht, was der Frame nicht selbst geprueft haette. */
    herkunft: herkunftGelesen(d.herkunft),
    // I2: Klimaachse, feldweise tolerant. Eine Karte aus einer Fassung ohne
    // Klima laedt mit den Vorgabewerten — die Biomflaechen selbst stehen als
    // Elemente in der Liste und haengen nicht daran.
    klima: klimaGelesen(d.klima),
    // Optionales Feld (ab dieser Runde mitgeschrieben, version bleibt 2):
    // Stand von S.elementSeedCounter beim Speichern. Fehlt es (aeltere
    // v1/v2-Dateien) oder ist es keine endliche Zahl, liefert null — der
    // Aufrufer leitet den Zaehler dann aus der Elementanzahl ab.
    seedZaehler: Number.isFinite(d.seedZaehler) ? (d.seedZaehler | 0) : null
  };
}

/**
 * Baut das Kartenobjekt im aktuellen Speicherformat (v4). Ausgelagert aus dem
 * Speichern-Knopf, weil der Autosave (D6) exakt dieselben Daten schreibt —
 * eine wiederhergestellte Sitzung muss durch genau dieselbe Validierung wie
 * eine geladene Datei laufen, sonst gibt es zwei Formatwahrheiten.
 */
function kartenDaten() {
  // v3: nur die Abweichungen vom deterministischen Seed-Terrain speichern.
  // Frisches Seed-Terrain in ein temporaeres Array rechnen (laesst
  // base/AO/Geometrie unberuehrt) und gegen das bearbeitete base diffen.
  var zellen = KARTE.vw * KARTE.vw;
  var seedTerrain = new Float32Array(base.length);
  genBaseIn(seedTerrain, S.worldSeed);
  var data = {
    // v4: neues Feld `kartenGroesse`. Sonst formatgleich zu v3 — Leser, die
    // das Feld nicht kennen, lesen die Karte weiterhin als 256er (was fuer
    // jede 256er-Datei auch exakt stimmt).
    format: "terra", version: 4, seed: S.worldSeed, tageszeit: getTodName(), raster: S.snap,
    kartenGroesse: KARTE.map,
    biom: S.biom,               // tolerantes Zusatzfeld (G5)
    sprachfamilie: S.sprachfamilie,   // tolerantes Zusatzfeld (J3)
    klima: S.klima,                   // tolerantes Zusatzfeld (I2)
    // Zweite Stimmungsachse neben der Tageszeit — wie `biom` ein optionales,
    // tolerant gelesenes Zusatzfeld. `version` bleibt deshalb 4: ein aelterer
    // Leser ueberliest das Feld und sieht die Karte bei klarem Wetter.
    wetter: getWetterName(),
    // C2 Bildlook der Karte. Ohne gesetztes Skript liefert getFarbskript()
    // dreimal Weiss mit staerke 0 — das Laden schaltet den Zweig damit
    // wieder ab, das Bild ist identisch zu einer Datei ganz ohne das Feld.
    farbskript: getFarbskript(),
    kamera: { x: cam.tFocus.x, z: cam.tFocus.z, dist: cam.tDist, yaw: cam.tYaw, pitch: cam.tPitch },
    hoehenDelta: berechneHoehenDelta(base, seedTerrain, zellen),
    elemente: serializeElements(),
    // Stand des Element-Seed-Zaehlers mitschreiben, damit nextSeed() nach
    // dem Laden keine bereits vergebenen Seeds erneut erzeugt.
    seedZaehler: S.elementSeedCounter
  };
  // D1/A3: die neuen Felder nur schreiben, wenn es etwas zu schreiben gibt.
  // Eine Karte ohne Marker und ohne Stempel ergibt dadurch byteidentisch
  // dieselbe Datei wie vor dieser Runde.
  if (S.marker.length) data.marker = serializeMarker();
  if (S.stempel.length) data.stempel = serializeStempel();
  /* J4: woraus diese Karte entstanden ist. Tolerantes Zusatzfeld nach dem
     Muster von `marker`/`stempel` — nur schreiben, wenn es etwas zu schreiben
     gibt; eine von Hand gebaute Karte ergibt damit byteidentisch dieselbe
     Datei wie zuvor, und `version` bleibt 4. Enthaelt den geprueften
     Parametersatz und den benutzten Seed (zusammen reproduzieren sie die
     Karte), aber NICHT den Prompt — Begruendung in
     generators/welt-vorgabe.js. */
  if (herkunftsVermerk) data.herkunft = herkunftsVermerk;
  // F1-F3 (Ghibli-Bildaufbau) nach demselben Muster: die 20er-Farbrampe
  // wuerde jede Datei aufblaehen, obwohl der Zweig bei staerke 0 gar nicht
  // laeuft. Fehlt das Feld beim Laden, setzt uebernehmeKarte auf 0 zurueck.
  if (getPalette().staerke > 0) data.palette = getPalette();
  if (getMalschicht().staerke > 0) data.malschicht = getMalschicht();
  if (getMultiplane().staerke > 0) data.multiplane = getMultiplane();
  return data;
}

/**
 * Übernimmt eine BEREITS VALIDIERTE Karte in einem Zug. Gemeinsamer Weg für
 * das Laden aus einer Datei und die Wiederherstellung eines Autosave-Standes;
 * den Undo-Punkt setzt der Aufrufer vorher (das Übernehmen ersetzt die Höhen).
 */
function uebernehmeKarte(karte, knoten) {
  S.worldSeed = karte.seed;
  document.getElementById("seed").value = String(S.worldSeed);
  // Biom VOR dem Terrain-/Elementaufbau setzen — terrainColor und die
  // Generatoren lesen S.biom im rebuildAll unten. Select-UI nachfuehren.
  S.biom = karte.biom;
  document.getElementById("biomSel").value = S.biom;
  S.sprachfamilie = karte.sprachfamilie;
  // J4: der Vermerk gehoert zur Karte und wird mit ihr ersetzt — sonst erbte
  // eine handgebaute Karte die Herkunft der zuvor geladenen.
  herkunftsVermerk = karte.herkunft;
  // I2: Klima VOR dem Aufbau — die Biom-Ableitung liest es, und die Farbe
  // haengt ueber die Biomflaechen daran.
  S.klima = karte.klima;
  // Kartengroesse VOR genBase/Delta setzen: genBase schreibt in das dann
  // passend dimensionierte base-Feld, und die Deltaindizes der Datei sind
  // gegen genau dieses VW gerechnet. (v1/v2/v3 liefern hier 256.)
  if (karte.kartenGroesse !== KARTE.map) setzeKartenGroesse(karte.kartenGroesse);
  var kartenSel = document.getElementById("kartenSel");
  if (kartenSel) kartenSel.value = String(KARTE.map);
  /* I1 — dritter Zweig: eine Kindkarte wuerfelt ihr Gelaende NICHT. Es wird
     aus der Elternkarte abgeleitet, sonst passte es nicht zu dem, was auf ihr
     zu sehen war, und die Hierarchie waere eine Luege. `hoehenDelta` ist hier
     die Handarbeit GEGEN die Ableitung, nicht die Abweichung vom Seed-Terrain
     — ein Kind hat kein eigenes Seed-Terrain. */
  if (knoten && knoten.karte.hoehenQuelle === "abgeleitet") {
    var ab = leiteHoehenFuer(S.baum, knoten.id);
    if (ab) {
      base.set(ab.subarray(0, Math.min(ab.length, base.length)));
      handarbeitAnwenden(base, karte.hoehenDelta || []);
      basisGeaendert(0, KARTE.vw - 1, 0, KARTE.vw - 1);
    } else {
      // Verwaist: der Elternteil fehlt, es gibt nichts abzuleiten. Lieber ein
      // eigenes Gelaende aus dem Seed als eine leere Karte.
      genBase(S.worldSeed);
      wendeHoehenDeltaAn(base, karte.hoehenDelta || []);
    }
  } else if (karte.hoehenDelta !== null) {
    // v3: erst das komplette Seed-Terrain deterministisch erzeugen —
    // S.worldSeed ist oben bereits gesetzt, genau wie im v1/v2-Ablauf —
    // dann die gespeicherten Deltapaare darueber.
    genBase(S.worldSeed);
    wendeHoehenDeltaAn(base, karte.hoehenDelta);
  } else {
    // Kürzere Höhenfelder (ältere/fremde Dateien): erst das komplette Feld
    // deterministisch aus dem geladenen Seed erzeugen, damit keine Reste der
    // vorherigen Karte stehen bleiben — dann die gespeicherten Höhen darüber.
    if (karte.hoehen.length < KARTE.vw * KARTE.vw) genBase(S.worldSeed);
    base.set(karte.hoehen);
  }
  hydrate(karte.elemente);
  if (karte.seedZaehler !== null) {
    S.elementSeedCounter = karte.seedZaehler;
  } else {
    // Datei ohne seedZaehler (aeltere v1/v2-Staende): Zaehler deterministisch
    // aus der Elementanzahl ableiten. 0x1234 ist der Startwert aus
    // core/store.js, 0x9e3779b9 der Golden-Ratio-Schritt von nextSeed();
    // nach n Aufrufen steht der Zaehler bei (0x1234 + n*Schritt) | 0.
    // Restunschaerfe: wurden in der Ursprungssitzung Elemente geloescht,
    // liegt der echte Zaehler weiter vorn — einzelne Seeds koennten dann
    // erneut vergeben werden. Besser geht es ohne gespeichertes Feld nicht.
    S.elementSeedCounter = (0x1234 + Math.imul(karte.elemente.length, 0x9e3779b9)) | 0;
  }
  // D1: Marker gehoeren zur Karte und werden mit ihr ersetzt.
  hydrateMarker(karte.marker);
  waehleMarker(-1);
  rebuildMarker();
  // A3: Stempel der Datei wandern in die Bibliothek (gleicher Name = ersetzen)
  // und stehen danach auch fuer andere Karten zur Verfuegung.
  var uebernommen = stempelUebernehmen(karte.stempel);
  ed.selected = null;
  ed.auswahl.length = 0;
  ed.draw = null;
  if (karte.kamera) {
    // Nur endliche Werte übernehmen (ein NaN würde die Dämpfung dauerhaft
    // einfrieren); sonst behält die Kamera ihren jeweiligen bisherigen Wert.
    var kk = karte.kamera;
    var fmax = camFokusMax();
    if (Number.isFinite(kk.x)) cam.tFocus.x = Math.max(-fmax, Math.min(fmax, kk.x));
    if (Number.isFinite(kk.z)) cam.tFocus.z = Math.max(-fmax, Math.min(fmax, kk.z));
    if (Number.isFinite(kk.dist)) cam.tDist = Math.max(CAM_DIST_MIN, Math.min(CAM_DIST_MAX, kk.dist));
    if (Number.isFinite(kk.yaw)) cam.tYaw = kk.yaw;
    if (Number.isFinite(kk.pitch)) cam.tPitch = kk.pitch;
  }
  S.snap = karte.raster;
  document.getElementById("snapBtn").classList.toggle("on", S.snap);
  rebuildAll();
  rebuildHandles();
  buildPanel();
  setTod(karte.tageszeit, true);
  // Wetter direkt neben der Tageszeit: applyTod() rechnet beide Achsen in
  // EINEM Durchlauf, der zweite Aufruf legt die Wetterkorrektur also sauber
  // ueber das frisch gesetzte Preset. `instant` wie bei setTod — geladen wird
  // ein Zustand, nicht ein Wetterwechsel.
  setWetter(karte.wetter || "klar", true);
  // Select nachfuehren (Muster wie die Biom-Zeile oben). setWetter tut das
  // selbst, wenn der Name gueltig war; bei einem unbekannten Wert aus einer
  // fremden Datei ist es auf "klar" zurueckgefallen und der Select muss den
  // TATSAECHLICHEN Zustand zeigen, nicht den Wunsch der Datei.
  var wetterSel = document.getElementById("wetterSel");
  if (wetterSel) wetterSel.value = getWetterName();
  // C2: null schaltet den Zweig ab — aeltere Dateien sehen damit exakt aus
  // wie bisher, statt das Skript der zuvor geladenen Karte zu erben.
  setFarbskript(karte.farbskript);
  // Fehlende Felder ⇒ staerke 0: eine Datei von vor dieser Runde sieht damit
  // exakt so aus wie frueher und erbt nichts von der zuvor geladenen Karte.
  setPalette(karte.palette && karte.palette.farben, karte.palette && karte.palette.staerke, karte.palette);
  setMalschicht(karte.malschicht);
  setMultiplane(karte.multiplane);
  return uebernommen;
}

/* ==========================================================================
   D6 — Autosave

   Ringpuffer der letzten drei Staende im localStorage, je Stand ein eigener
   Schluessel (ein einziger Schluessel mit allen dreien muesste bei jedem
   Schreiben das Dreifache serialisieren) plus ein kleiner Metaeintrag mit
   Zeitstempeln. Geschrieben wird alle 60 Sekunden und beim Verlassen der
   Seite; unveraenderte Staende werden uebersprungen (Textvergleich gegen den
   zuletzt geschriebenen Stand), damit der Ring nicht mit Kopien volllaeuft.

   Deckel: Das v4-Format ist normalerweise winzig (Delta + Elemente). NACH
   EINEM HOEHENKARTEN-IMPORT weicht praktisch jede Zelle vom Seed-Terrain ab,
   das Delta wird dann zu einem Vollarray mit zwei Zahlen je Zelle — auf einer
   1024er Karte sind das ueber 2 Millionen Zahlen. Ueber AUTOSAVE_MAX wird
   deshalb nicht mehr gespeichert (localStorage liegt je nach Browser bei
   5-10 MB fuer die GANZE Herkunft; ein einziger Stand darf das nicht
   auffressen). Der Nutzer erfaehrt das per Toast, statt sich auf einen
   Autosave zu verlassen, den es nicht gibt.
   ========================================================================== */
var AUTOSAVE_KEY = "terra.autosave.v1";
var AUTOSAVE_SLOTS = 3;
var AUTOSAVE_MAX = 4 * 1024 * 1024;   // Zeichen (JSON ist ASCII, ~1 Byte je Zeichen)
var AUTOSAVE_MS = 60000;
var letzterAutosave = null;           // zuletzt geschriebener Text (Vergleich)
var autosaveGewarnt = false;
var letzteSicht = null;               // billige Aenderungsprobe (siehe unten)
var letzteBaseKopie = null;

/**
 * Billige Vorprüfung: hat sich seit dem letzten Autosave-Versuch überhaupt
 * etwas geändert? Nötig, weil kartenDaten() das komplette Seed-Terrain neu
 * rechnet (genBaseIn über VW² Zellen) — auf einer 1024er Karte wäre das ein
 * spürbarer Ruckler JEDE Minute, auch wenn niemand etwas getan hat. Der
 * Vergleich hier kostet nur eine Elementserialisierung (ohne Terrain) und
 * einen Array-Durchlauf über die Höhen.
 * Die Kamera ist bewusst NICHT Teil der Probe: ein Schwenk ist keine
 * Änderung an der Karte und soll keinen neuen Stand in den Ring schieben.
 */
function autosaveNoetig() {
  var sicht = JSON.stringify({ e: serializeElements(), m: serializeMarker(),
    s: S.worldSeed, b: S.biom, g: KARTE.map, z: S.elementSeedCounter,
    t: S.stempel.length });
  var n = KARTE.vw * KARTE.vw;
  var gleich = (letzteSicht === sicht) && letzteBaseKopie && letzteBaseKopie.length === n;
  if (gleich) {
    for (var i = 0; i < n; i++) if (letzteBaseKopie[i] !== base[i]) { gleich = false; break; }
  }
  if (gleich) return false;
  letzteSicht = sicht;
  letzteBaseKopie = base.slice(0, n);
  return true;
}

function autosaveMeta() {
  var roh = speicherLesen(AUTOSAVE_KEY);
  if (!roh) return { next: 0, staende: [] };
  try {
    var m = JSON.parse(roh);
    if (!m || !Array.isArray(m.staende)) return { next: 0, staende: [] };
    return { next: (m.next | 0) % AUTOSAVE_SLOTS, staende: m.staende };
  } catch (e) { return { next: 0, staende: [] }; }
}

/* ==========================================================================
   I1 — Der Kartenbaum

   Terra kannte bisher genau eine Karte. Jetzt haelt `S.baum` alle Karten der
   Datei und `S.aktiveKarte` die, die gerade in S und im Hoehenfeld steht.

   Warum das hier steht und nicht in einem eigenen Modul: io.js besitzt bereits
   die Serialisierung einer Karte (kartenDaten/uebernehmeKarte/validiereKarte).
   Der Baum ist deren Fortsetzung. Ein eigenes Modul haette einen Zyklus
   gebaut — panels.js braeuchte es, es braeuchte io.js, und io.js braucht
   panels.js. Genau diese Sorte Ring hat in Runde H schon einmal den Modulstart
   zerlegt.

   Die eine Regel, die man kennen muss: der Eintrag der AKTIVEN Karte im Baum
   ist veraltet, solange man sie bearbeitet. Der Wahrheitswert steht in S und
   in `base`. karteSichern() schreibt ihn zurueck — und zwar vor jedem
   Kartenwechsel und vor jedem Speichern. Wer eine dritte Stelle findet, an der
   der Baum gelesen wird, muss vorher sichern.
   ========================================================================== */

/** Der Baum der Sitzung; legt beim ersten Zugriff einen mit genau der
 *  aktuellen Karte an. So verhaelt sich Terra ohne geladene Baumdatei wie
 *  bisher, ohne dass irgendwo ein Sonderfall stehen muss. */
function aktiverBaum() {
  if (!S.baum) {
    var eintrag = kartenDaten();
    eintrag.id = "k0";
    eintrag.elternId = null;
    eintrag.titel = "Karte";
    eintrag.einheitMeter = S.einheitMeter;
    eintrag.hoehenQuelle = "eigen";
    eintrag.eigen = {};
    S.baum = baueKartenbaum([eintrag]);
    S.aktiveKarte = "k0";
  }
  return S.baum;
}

/** Schreibt den JETZIGEN Stand in den Eintrag der aktiven Karte zurueck. */
function karteSichern() {
  var baum = aktiverBaum();
  var n = baum.index[S.aktiveKarte];
  if (!n) return baum;
  var frisch = kartenDaten();
  /* Die Baumfelder ueberleben — sie beschreiben die STELLUNG der Karte im
     Baum, und die aendert sich beim Bearbeiten nicht. kartenDaten() weiss von
     ihnen nichts und wuerde sie sonst stillschweigend loeschen. */
  frisch.id = n.id;
  frisch.elternId = n.elternId;
  frisch.titel = n.karte.titel;
  frisch.einheitMeter = n.karte.einheitMeter;
  frisch.hoehenQuelle = n.karte.hoehenQuelle;
  frisch.ausschnitt = n.karte.ausschnitt;
  frisch.rahmen = n.karte.rahmen;
  frisch.eigen = n.karte.eigen;
  /* Bei einer abgeleiteten Karte ist `hoehenDelta` die HANDARBEIT gegen die
     Ableitung, nicht die Abweichung vom Seed-Terrain. Ein Kind hat kein
     eigenes Seed-Terrain — sein Gelaende kommt aus dem Elternteil. */
  if (n.karte.hoehenQuelle === "abgeleitet") {
    var ab = leiteHoehenFuer(baum, n.id);
    if (ab) frisch.hoehenDelta = handarbeitErmitteln(base, ab, KARTE.vw * KARTE.vw);
  }
  var karten = baum.karten.slice();
  for (var i = 0; i < karten.length; i++) if (karten[i].id === n.id) karten[i] = frisch;
  S.baum = baueKartenbaum(karten, { wurzelId: baum.wurzelId });
  return S.baum;
}

/** Die abgeleiteten Hoehen einer Kindkarte — ohne ihre Handarbeit.
 *  Rechnet die Kette von der Wurzel herab, weil auch die Elternkarte
 *  abgeleitet sein kann (Kontinent -> Landschaft -> Stadt). */
function leiteHoehenFuer(baum, id) {
  var pfad = pfadZurWurzel(baum, id);
  if (pfad.length < 2) return null;
  var wurzel = baum.index[pfad[0]].karte;
  var vw = ((wurzel.kartenGroesse | 0) || 256) + 1;
  var hoehen = new Float32Array(vw * vw);
  genBaseIn(hoehen, wurzel.seed | 0, (wurzel.kartenGroesse | 0) || 256, wurzel.biom);
  wendeHoehenDeltaAn(hoehen, wurzel.hoehenDelta || []);
  for (var i = 1; i < pfad.length; i++) {
    var r = leiteKindHoehenAb(baum, pfad[i], hoehen);
    hoehen = r.hoehen;
    if (i < pfad.length - 1) {
      // Zwischenstufe: ihre eigene Handarbeit gehoert dazu, sonst leitet die
      // naechste Stufe aus einem Gelaende ab, das so nie zu sehen war.
      handarbeitAnwenden(hoehen, baum.index[pfad[i]].karte.hoehenDelta || []);
    }
  }
  return hoehen;
}

/** Wechselt die aktive Karte. Sichert die bisherige, laedt die neue. */
function wechsleZuKarte(id) {
  var baum = karteSichern();
  var n = baum.index[id];
  if (!n) { toast("Karte „" + id + "“ gibt es nicht"); return false; }
  if (id === S.aktiveKarte) return true;
  var karte;
  try { karte = validiereKarteObjekt(n.karte); }
  catch (e) { toast("Karte „" + n.karte.titel + "“ ist unlesbar: " + e.message); return false; }
  /* Geerbte Felder AUFLOESEN, bevor uebernehmeKarte sie liest. Im Eintrag
     einer erbenden Karte steht `biom` gar nicht — validiereKarteObjekt faellt
     dort auf seine eigene Vorgabe zurueck, und das Kind saehe aus wie eine
     frische Wiese statt wie sein Elternteil. */
  var erbe = erbWerte(baum, id);
  for (var f in erbe) if (erbe[f] !== undefined && erbe[f] !== null) karte[f] = erbe[f];
  pushUndo(true);
  S.aktiveKarte = id;
  S.einheitMeter = n.karte.einheitMeter || 1;
  uebernehmeKarte(karte, n);
  // Die Historie gehoert zur Karte: ein Undo ueber einen Kartenwechsel hinweg
  // wuerde Hoehen der einen Karte in die andere schreiben.
  verwerfeHistorie();
  buildPanel();
  toast("Karte: " + n.karte.titel + " · " + massstabName(S.einheitMeter));
  return true;
}

/** Legt aus einem Polygon auf der AKTIVEN Karte eine Kindkarte an und wechselt
 *  hinein. Der Ausschnitt ist damit das einzige Werkzeug, das eine neue Karte
 *  erzeugt — es gibt keinen zweiten Weg, und deshalb auch keine zweite Stelle,
 *  an der die Baumregeln durchgesetzt werden muessten. */
function neueKindkarte(polygon, opt) {
  var baum = karteSichern();
  var kind;
  try { kind = legeKindkarteAn(baum, S.aktiveKarte, polygon, opt || {}); }
  catch (e) { toast(e.message); return null; }
  S.baum = mitKarte(baum, kind);
  wechsleZuKarte(kind.id);
  return kind.id;
}

/**
 * Die beiden Wege, wenn sich die Elternkarte geaendert hat.
 *
 * `verwerfen = false` — Nachziehen: die neue Elternform uebernehmen, die
 *   eigene Handarbeit behalten. Der Regelfall, und der Grund, warum die
 *   Handarbeit ueberhaupt als Delta GEGEN die Ableitung gespeichert wird und
 *   nicht als absolute Hoehe: nur so laesst sie sich auf ein anderes
 *   Untergelaende umsetzen.
 * `verwerfen = true` — Neu ableiten: alles zurueck auf die reine Ableitung.
 *   Der Ausstieg, wenn man sich vertan hat.
 */
function zieheKarteNach(verwerfen) {
  var baum = karteSichern();
  var n = baum.index[S.aktiveKarte];
  if (!n || n.elternId === null) { toast("Die Wurzelkarte leitet sich aus nichts ab"); return; }
  var ab = leiteHoehenFuer(baum, n.id);
  if (!ab) { toast("Die Elternkarte fehlt — es gibt nichts abzuleiten"); return; }
  pushUndo(true);
  base.set(ab.subarray(0, Math.min(ab.length, base.length)));
  if (!verwerfen) handarbeitAnwenden(base, n.karte.hoehenDelta || []);
  basisGeaendert(0, KARTE.vw - 1, 0, KARTE.vw - 1);
  rebuildAll();
  buildPanel();
  toast(verwerfen ? "Gelände neu aus der Elternkarte abgeleitet"
                  : "Elternform nachgezogen, Handarbeit behalten");
}

/** Der ganze Baum als Dateitext — der Stand, der gespeichert wird. Sichert
 *  vorher die aktive Karte, sonst fehlte in der Datei genau das, woran man
 *  gerade gearbeitet hat. */
function baumText() {
  return JSON.stringify(schreibeBaumDatei(karteSichern()));
}

/** Gegenstueck zu baumText fuer Autosave und Datei: liest, prueft ALLE Karten
 *  und uebernimmt erst danach. Wirft, wenn irgendetwas nicht stimmt — der
 *  Aufrufer haelt den Zustand bis dahin unangetastet. */
function baumUebernehmen(text) {
  var gelesen = leseBaumDatei(JSON.parse(text));
  for (var i = 0; i < gelesen.baum.karten.length; i++) {
    validiereKarteObjekt(gelesen.baum.karten[i]);
  }
  var wurzel = gelesen.baum.index[gelesen.baum.wurzelId];
  var karte = validiereKarteObjekt(wurzel.karte);
  S.baum = gelesen.baum;
  S.aktiveKarte = gelesen.baum.wurzelId;
  S.einheitMeter = wurzel.karte.einheitMeter || 1;
  return uebernehmeKarte(karte, wurzel);
}

/** Schreibt den Stand in den Ring. Liefert "ok" | "gleich" |
 *  "zu gross" | "fehler" — der Aufrufer entscheidet ueber die Meldung. */
function autosaveSchreiben() {
  if (!autosaveNoetig()) return "gleich";
  var text;
  try { text = baumText(); }
  catch (e) { return "fehler"; }
  if (text === letzterAutosave) return "gleich";
  if (text.length > AUTOSAVE_MAX) return "zu gross";
  var meta = autosaveMeta();
  var slot = meta.next;
  if (!speicherSchreiben(AUTOSAVE_KEY + "." + slot, text)) return "fehler";
  var staende = [];
  for (var i = 0; i < meta.staende.length; i++)
    if (meta.staende[i] && meta.staende[i].slot !== slot) staende.push(meta.staende[i]);
  staende.push({ slot: slot, zeit: Date.now(), zeichen: text.length });
  if (!speicherSchreiben(AUTOSAVE_KEY,
      JSON.stringify({ next: (slot + 1) % AUTOSAVE_SLOTS, staende: staende }))) return "fehler";
  letzterAutosave = text;
  return "ok";
}

/** Juengster gespeicherter Stand als { text, zeit } — oder null. */
function neuesterAutosave() {
  var meta = autosaveMeta(), best = null;
  for (var i = 0; i < meta.staende.length; i++) {
    var s = meta.staende[i];
    if (!s || !Number.isFinite(s.zeit)) continue;
    if (!best || s.zeit > best.zeit) best = s;
  }
  if (!best) return null;
  var text = speicherLesen(AUTOSAVE_KEY + "." + best.slot);
  return text ? { text: text, zeit: best.zeit } : null;
}

function zeitText(ms) {
  var d = new Date(ms);
  function zz(n) { return (n < 10 ? "0" : "") + n; }
  return zz(d.getDate()) + "." + zz(d.getMonth() + 1) + ". " + zz(d.getHours()) + ":" + zz(d.getMinutes());
}

/**
 * Beim Start anbieten, den letzten Stand wiederherzustellen. Laeuft bewusst
 * verzoegert: initIO() wird in main.js VOR dem Aufbau der Demokarte gerufen —
 * eine sofortige Wiederherstellung wuerde von demoMap()/rebuildAll()
 * ueberschrieben. main.js ist von oben bis unten synchron, ein Timer laeuft
 * also garantiert erst danach; die 600 ms geben zusaetzlich Zeit fuer das
 * erste Bild, damit der Dialog nicht vor einer schwarzen Flaeche steht.
 * Verglichen wird gegen den FRISCHEN Demostand: wer nichts geaendert hat,
 * bekommt keine Rueckfrage.
 */
function autosaveAnbieten() {
  var stand = neuesterAutosave();
  if (!stand) return;
  var jetzt;
  try { jetzt = baumText(); } catch (e) { jetzt = null; }
  if (jetzt !== null) letzterAutosave = jetzt;      // Demostand gilt als geschrieben
  if (stand.text === jetzt) return;
  if (!confirm("Letzten Stand wiederherstellen? (" + zeitText(stand.zeit) + ")")) return;
  /* pushUndo VOR dem Versuch: baumUebernehmen prueft zwar alle Karten, bevor
     es irgendetwas anfasst, aber der Undo-Punkt kostet nichts und deckt auch
     den Fall ab, dass jemand die Reihenfolge dort spaeter aendert. Ein
     ueberzaehliger Punkt nach einem gescheiterten Laden ist harmlos; ein
     fehlender nach einem halb gelungenen waere es nicht. */
  pushUndo(true);
  try { baumUebernehmen(stand.text); }
  catch (err) { toast("Gespeicherter Stand ist unlesbar: " + err.message); return; }
  letzterAutosave = stand.text;
  toast("Stand vom " + zeitText(stand.zeit) + " wiederhergestellt");
}

/* ==========================================================================
   F4 — PNG-Export in der komponierten Einstellung

   Ein Filmhintergrund ist fuer GENAU EINE Kamera gemalt; der Export ist die
   Stelle, an der sich das im Editor auszahlt. War der Aufnahme-Modus aus, wird
   er fuer das eine Bild eingeschaltet, die Kamera an ihr Ziel gespult,
   gerendert, exportiert — und danach genauso zurueckgeschaltet und
   zurueckgespult.

   Vorspulen statt Warten: setAufnahme() setzt ausschliesslich ZIELwerte
   (tFov/tPitch/tHebung/tDist), die updateCamera mit DAMP = 0.15 anfaehrt. Ein
   Export „jetzt sofort“ zeigte sonst den ersten Frame der Fahrt statt der
   Komposition. AUFNAHME_VORLAUF Schritte a 1/60 s bringen den Restfehler auf
   0.85^120 ≈ 3e-9 der Anfangsdifferenz — die Kamera steht also exakt auf dem
   Ziel. Kosten: 120 heightAt-Aufrufe, unter einer Millisekunde, und zwar nur
   beim Klick auf PNG.

   Zurueck geht es NICHT durch ein zweites Vorspulen, sondern ueber einen
   Schnappschuss aller Kamerafelder: Vorspulen wuerde eine gerade laufende
   Fahrt (jemand haelt W gedrueckt und drueckt PNG) auf ihr Ziel schnappen
   lassen — sichtbar als Sprung. Der Schnappschuss stellt auch den halb
   interpolierten Zwischenstand wieder her. Einzige Handarbeit dabei:
   camera.fov muss ausdruecklich zurueckgesetzt werden, weil updateCamera die
   Projektionsmatrix nur anfasst, solange sich cam.fov und cam.tFov
   unterscheiden — nach dem Zurueckstellen tun sie das nicht mehr.

   Weil zwischen Hin und Zurueck KEIN Bild auf den Schirm geht (beides
   passiert im selben Klick-Handler, das Rendern dazwischen laeuft in den
   Offscreen-Puffer des Composers), sieht der Nutzer keinen Ruck: die Ansicht
   steht vor und nach dem Export exakt gleich.
   ========================================================================== */
var AUFNAHME_VORLAUF = 120;          // Schritte
var AUFNAHME_DT = 1 / 60;            // Schrittweite, wie ein Bild bei 60 fps

function kameraVorspulen() {
  for (var i = 0; i < AUFNAHME_VORLAUF; i++) updateCamera(AUFNAHME_DT);
}

/** Vollstaendiger Kamerastand: Ist- UND Zielwerte. */
function kameraStand() {
  return { fx: cam.focus.x, fz: cam.focus.z, fy: cam.focusY, dist: cam.dist,
    yaw: cam.yaw, pitch: cam.pitch, hebung: cam.hebung, fov: cam.fov,
    tfx: cam.tFocus.x, tfz: cam.tFocus.z, tDist: cam.tDist, tYaw: cam.tYaw,
    tPitch: cam.tPitch, tHebung: cam.tHebung, tFov: cam.tFov };
}

function kameraStandSetzen(s) {
  cam.focus.x = s.fx; cam.focus.z = s.fz; cam.focusY = s.fy; cam.dist = s.dist;
  cam.yaw = s.yaw; cam.pitch = s.pitch; cam.hebung = s.hebung; cam.fov = s.fov;
  cam.tFocus.x = s.tfx; cam.tFocus.z = s.tfz; cam.tDist = s.tDist; cam.tYaw = s.tYaw;
  cam.tPitch = s.tPitch; cam.tHebung = s.tHebung; cam.tFov = s.tFov;
  camera.fov = s.fov;
  camera.updateProjectionMatrix();
  // Position und Blickrichtung zieht der naechste updateCamera-Aufruf der
  // Renderschleife nach — er laeuft in main.js vor jedem renderFrame.
}

/* Der Umschalter „Komponiert“ in der unteren Leiste. Bewusst NICHT erzwungen:
   wer die freie Ansicht exportieren will (Arbeitsstand zeigen, Vergleichsbild,
   Draufsicht auf die ganze Karte), schaltet ihn aus. Default an — der
   komponierte Blick ist der bessere Vorgabewert fuer ein Bild, das geteilt
   wird. */
var komponiertExport = true;

/* ==========================================================================
   J4 — eine Karte aus einer Beschreibung

   Die Brain-Aktion `terra_world_draft` liefert einen geprueften
   Parametersatz, die Bruecke reicht ihn herein, generators/welt-vorgabe.js
   prueft ihn ein zweites Mal und rechnet ihn um — hier wird er ANGEWENDET.

   Warum in dieser Datei: eine Vorgabe kann Kartengroesse, Biom, Seed, Klima,
   Sprachfamilie, Massstab, Tageszeit und Wetter aendern. Genau diese acht
   Dinge zieht io.js beim Laden einer Datei ebenfalls nach, in genau dieser
   Reihenfolge (uebernehmeKarte). Ein zweiter Weg daneben waere eine zweite
   Wahrheit ueber den Kartenzustand.

   ANDERS ALS „Welt wuerfeln“ (ui/panels.js) wird hier das GELAENDE NEU
   erzeugt: Biom, Kartengroesse und Seed duerfen sich aendern, und ohne neues
   Basisterrain waere ein Reliefwunsch („Gebirge im Norden“) sinnlos. Die
   Rueckfrage sagt das ausdruecklich.

   Die Rueckfrage stellt der FRAME, nicht die Elternseite: nur er weiss, wie
   viele Elemente auf der Karte stehen. Dieselbe Haltung wie bei weltWuerfeln
   und beim Biomwechsel.
   ========================================================================== */

/** Herkunftsvermerk der aktiven Karte (tolerantes Zusatzfeld `herkunft`).
 *  null = die Karte ist nicht aus einer Beschreibung entstanden. */
var herkunftsVermerk = null;

/**
 * Wendet eine Weltvorgabe an. Liefert { ok, bericht, hinweise, meldung } —
 * nie ein throw nach aussen, damit die Bruecke immer quittieren kann.
 *
 * @param roh  Parametersatz, ungeprueft (er kam per postMessage herein)
 * @param opt  { laufId, seed }
 */
function weltVorgabeAnwenden(roh, opt) {
  opt = opt || {};
  var g = pruefeVorgabe(roh);
  var v = g.vorgabe;

  if (S.elements.length &&
      !confirm("Die Karte trägt bereits " + S.elements.length + " Elemente. "
        + "„Karte beschreiben“ ersetzt sie vollständig durch eine neu erzeugte Welt "
        + "und erzeugt auch das Geländerelief neu — von Hand modellierte Höhen "
        + "gehen dabei verloren. Fortfahren?")) {
    return { ok: false, hinweise: g.hinweise, meldung: "abgebrochen" };
  }

  var startSeed = Number.isFinite(opt.seed) ? (opt.seed | 0) : S.worldSeed;
  var suche = sucheSeed(v, startSeed);

  pushUndo(true);                       // ersetzt die Hoehen -> Terrainkopie sichern
  S.worldSeed = suche.seed;
  var seedFeld = document.getElementById("seed");
  if (seedFeld) seedFeld.value = String(S.worldSeed);
  S.biom = v.biom;
  var biomSel = document.getElementById("biomSel");
  if (biomSel) biomSel.value = S.biom;
  S.sprachfamilie = v.sprachfamilie;
  S.klima = { richtung: v.klima.richtung, staerke: v.klima.staerke,
              grund: v.klima.grund, hoeheKuehl: v.klima.hoeheKuehl };
  if (v.kartenGroesse !== KARTE.map) setzeKartenGroesse(v.kartenGroesse);
  /* Der Massstab steht im Baumeintrag, nicht in der Datei der Einzelkarte
     (karteSichern liest ihn von dort zurueck) — beides setzen, sonst faellt
     er beim naechsten Sichern auf den alten Wert. */
  S.einheitMeter = v.einheitMeter;
  var baum = aktiverBaum(), knoten = baum.index[S.aktiveKarte];
  if (knoten) knoten.karte.einheitMeter = v.einheitMeter;
  genBase(S.worldSeed);

  var liste;
  try {
    liste = erzeugeWelt(S.worldSeed, weltOptionen(v));
  } catch (err) {
    /* Das Gelaende steht schon neu, die Elemente noch nicht — ein Undo stellt
       beides her (pushUndo(true) oben hat die Hoehen gesichert). Mehr ist
       ehrlich nicht zu retten, und ein halb gebauter Zustand waere schlimmer. */
    console.error("erzeugeWelt", err);
    rebuildAll();
    return { ok: false, hinweise: g.hinweise, meldung: "Weltgenerator fehlgeschlagen" };
  }
  if (!liste || !liste.length) {
    rebuildAll();
    return { ok: false, hinweise: g.hinweise, meldung: "Kein brauchbarer Bauplatz auf dieser Karte" };
  }

  // Freie Namen des Modells VOR dem Einsetzen: danach haengen die Elemente in
  // S.elements und in den Pools, und eine Umbenennung muesste dort nachziehen.
  var freie = namenAnwenden(liste, v.namen);

  ed.selected = null;
  ed.auswahl.length = 0;
  ed.draw = null;
  clearPreview();
  hydrate(liste);
  rebuildAll();
  rebuildHandles();
  buildPanel();
  setTod(v.tageszeit, true);
  setWetter(v.wetter, true);
  var wetterSel = document.getElementById("wetterSel");
  if (wetterSel) wetterSel.value = getWetterName();

  var b = liste.bericht || {};
  var region = v.namen.region || b.region || null;
  herkunftsVermerk = herkunftBauen(v, {
    seed: S.worldSeed,
    laufId: opt.laufId,
    zeit: new Date().toISOString()
  });

  toast("Karte beschrieben: " + liste.length + " Elemente · "
    + (b.fluesse || 0) + " Flüsse · " + (b.siedlungen || 0) + " Siedlungen"
    + (region ? " · „" + region + "“" : ""));

  return {
    ok: true,
    hinweise: g.hinweise,
    bericht: {
      elemente: liste.length,
      fluesse: b.fluesse || 0,
      siedlungen: b.siedlungen || 0,
      namen: b.namen || 0,
      freieNamen: freie,
      region: region,
      seed: S.worldSeed,
      seedGesucht: suche.geprueft,
      kartenGroesse: KARTE.map,
      biom: S.biom
    }
  };
}

export function initIO() {
  /* I1: das Ausschnitt-Werkzeug meldet sein fertiges Polygon hierher. Die
     Richtung ist Absicht — io.js kennt tools.js, nicht umgekehrt. */
  /* I1: die Wege in den Baum. Gleiche Richtung wie oben — das Panel bekommt
     sie gereicht, statt io.js zu importieren. */
  setzeKartenWege({
    pfad: pfadZurWurzel,
    kinder: kinderVon,
    massstabName: massstabName,
    wechsle: wechsleZuKarte,
    nachziehen: function () { zieheKarteNach(false); },
    neuAbleiten: function () { zieheKarteNach(true); }
  });
  /* J1: dieselben zwei Wege, die auch Datei-Speichern und Datei-Laden nehmen.
     Die Bruecke bekommt bewusst KEINEN dritten Ladeweg — baumUebernehmen ist
     genau der Weg des Dateidialogs (leseBaumDatei -> validiereKarteObjekt je
     Karte -> uebernehmeKarte), nur ohne FileReader davor. */
  /* J4: der dritte Weg. Die Bruecke ruft ihn, wenn eine Weltvorgabe
     hereinkommt; ohne ihn antwortete sie mit einer Absage statt zu bauen. */
  setzeBrueckenWege({ text: baumText, uebernehmen: baumUebernehmen,
    vorgabe: weltVorgabeAnwenden });
  setzeAusschnittWeg(function (punkte) {
    var titel = prompt("Titel der neuen Karte", "Ausschnitt");
    if (titel === null) return;                       // Abbruch legt nichts an
    var id = neueKindkarte(punkte, { titel: String(titel) || "Ausschnitt" });
    if (id) setTool("auswahl");
  });
  document.getElementById("seedApply").addEventListener("click", function () {
    var v = document.getElementById("seed").value.trim();
    var s = 0;
    if (/^-?\d+$/.test(v)) s = parseInt(v, 10) | 0;
    else { for (var i = 0; i < v.length; i++) s = (Math.imul(s, 31) + v.charCodeAt(i)) | 0; }
    pushUndo(true);                      // genBase ersetzt die Hoehen -> Terrainkopie sichern
    S.worldSeed = s;
    genBase(S.worldSeed);
    rebuildAll();
    toast("Neue Karte mit Seed " + v);
  });
  var todBtns = document.querySelectorAll("#bar .tod");
  for (var ti = 0; ti < todBtns.length; ti++) {
    todBtns[ti].addEventListener("click", function () { setTod(this.dataset.t, false); });
  }
  document.getElementById("snapBtn").addEventListener("click", function () {
    S.snap = !S.snap;
    this.classList.toggle("on", S.snap);
    toast(S.snap ? "Raster-Einrasten an (2 Einheiten)" : "Raster-Einrasten aus");
  });
  // Biom-Wechsel (G5): gleiches Muster wie die Seed-Uebernahme — Zustand
  // sichern, dann voller Neuaufbau, denn Terrainfarben und Bestueckung
  // haengen am Biom (die Hoehen selbst bleiben unangetastet).
  document.getElementById("biomSel").addEventListener("change", function () {
    var b = BIOME[this.value] ? this.value : "wiese";
    this.value = b;
    if (b === S.biom) return;
    // H6/H2: Bringt das neue Biom ein anderes Hoehenprofil mit (Randabbruch,
    // Amplitude, Terrassen, Dolinen ...), muss das Basisterrain neu erzeugt
    // werden — sonst zeigt eine "Aschebrache" die weiche Kueste der Wiese.
    // 21 der 25 Biome tragen ein `hoehe`-Feld, der Zweig greift also regulaer.
    var formNeu = !hoehenProfilGleich(hoehenProfil(S.biom), hoehenProfil(b));
    // Rueckfrage VOR jeder Zustandsaenderung: das Gelaende ist Handarbeit
    // (Pinselhoehen, Flussbetten, Bruchkanten liegen darauf) und waere sonst
    // kommentarlos weg. Nur fragen, wenn es etwas zu verlieren gibt.
    if (formNeu && S.elements.length &&
        !confirm("Das Biom „" + BIOME[b].label + "“ bringt ein eigenes Geländeprofil mit. "
                 + "Das Basisgelände wird dafür neu erzeugt, von Hand modellierte Höhen gehen verloren. "
                 + "Trotzdem wechseln?")) {
      this.value = S.biom;                 // Auswahl zuruecksetzen
      return;
    }
    pushUndo(true);
    S.biom = b;
    if (formNeu) genBase(S.worldSeed);
    rebuildAll();
    // Tageszeit erneut anwenden: wasserTint, Schneeauflage und der luft-Block
    // des Bioms haengen daran und greifen so sofort beim Wechsel.
    palettePassend();
    setTod(getTodName(), true);
    toast("Biom: " + BIOME[b].label + (formNeu ? " — Gelände neu erzeugt" : ""));
  });
  /* Kartengroesse (H1b). Bewusst destruktiv: die Karte wird komplett neu
     erzeugt. Das Hoehen-Delta des v3/v4-Formats ist gegen ein Seed-Terrain
     EINER bestimmten Kartengroesse gerechnet — bei anderem VW liegen dieselben
     Indizes auf voellig anderen Punkten. Die Elemente bleiben erhalten (ihre
     Koordinaten sind Weltkoordinaten); nur der Pinsel-Anteil der Hoehen geht
     verloren, worauf der Toast hinweist. */
  document.getElementById("kartenSel").addEventListener("change", function () {
    var n = parseInt(this.value, 10) | 0;
    if (KARTEN_GROESSEN.indexOf(n) < 0) n = KARTE.map;
    this.value = String(KARTE.map);
    if (n === KARTE.map) return;
    pushUndo(true);              // ersetzt die Hoehen -> Terrainkopie sichern
    setzeKartenGroesse(n);       // Zahlen + Patchraster + Huellen + Wasser
    genBase(S.worldSeed);
    rebuildAll();
    setTod(getTodName(), true);  // Nebel/Wasserfarbe auf die neue Groesse anwenden
    toast("Kartengröße " + n + " — die Karte wurde neu erzeugt (Höhen aus dem Pinsel gehen verloren)");
  });
  function download(name, blob) {
    var a = document.createElement("a");
    var url = URL.createObjectURL(blob);
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  document.getElementById("saveBtn").addEventListener("click", function () {
    download("terra-karte.json",
      new Blob([baumText()], { type: "application/json" }));
    toast("Karte gespeichert");
  });
  document.getElementById("loadBtn").addEventListener("click", function () {
    document.getElementById("fileIn").click();
  });
  document.getElementById("fileIn").addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      // Erst vollständig validieren — schlägt das fehl, bleibt der Zustand
      // (Höhen, Elemente, Seed, Kamera, Undo-Stapel) komplett unverändert.
      /* I1 — der Ladeweg geht seit dem Kartenbaum IMMER ueber leseBaumDatei.
         Sie normiert v1 bis v4 zu einem Baum mit genau einer Wurzelkarte, so
         dass es hier keinen zweiten Zweig braucht — und keinen zweiten Zweig
         zu haben, ist der eigentliche Gewinn: der Ladeweg ist die Stelle, an
         der Terra am meisten Formatgeschichte traegt.

         Jede Karte des Baums wird geprueft, bevor irgendetwas uebernommen
         wird. Erst wenn ALLE durchgehen, wird der Zustand angefasst — atomar
         wie bisher, nur jetzt ueber die ganze Datei statt ueber eine Karte. */
      var gelesen, karte;
      try {
        gelesen = leseBaumDatei(JSON.parse(rd.result));
        for (var kb = 0; kb < gelesen.baum.karten.length; kb++) {
          validiereKarteObjekt(gelesen.baum.karten[kb]);
        }
        karte = validiereKarteObjekt(gelesen.baum.index[gelesen.baum.wurzelId].karte);
      } catch (err) {
        toast("Datei konnte nicht gelesen werden: " + err.message);
        return;
      }
      // Ab hier ist alles geprüft: Undo-Punkt setzen und in einem Zug übernehmen.
      pushUndo(true);                    // das Laden ersetzt die Hoehen -> Terrainkopie sichern
      S.baum = gelesen.baum;
      S.aktiveKarte = gelesen.baum.wurzelId;
      var wurzelKnoten = gelesen.baum.index[gelesen.baum.wurzelId];
      S.einheitMeter = wurzelKnoten.karte.einheitMeter || 1;
      var stempelZahl = uebernehmeKarte(karte, wurzelKnoten);
      if (gelesen.warnungen && gelesen.warnungen.length) {
        toast("Kartenbaum mit Anmerkungen: " + gelesen.warnungen[0]);
      }
      toast((karte.dateiVersion < 2 ? "Karte geladen (ältere Fassung)" : "Karte geladen")
        + (karte.marker.length ? " · " + karte.marker.length + " Marker" : "")
        + (stempelZahl ? " · " + stempelZahl + " Stempel übernommen" : ""));
    };
    rd.readAsText(f);
    e.target.value = "";
  });
  /* F4 — Umschalter „Komponiert“. Gleiches Muster wie der Höhenbild-Knopf:
     suchen, nur bei Fehlen anlegen, Listener IMMER anhängen — terra/index.html
     gehört dieser Runde nicht, der Knopf soll aber später ohne Codeänderung
     statisch dort stehen können. Der Zustand wird beim Verdrahten hart auf
     „an“ gesetzt und die Klasse danach angeglichen: so gilt der Default auch
     dann, wenn ein künftiges Dokument den Knopf ohne class="on" mitbringt. */
  var kompBtn = document.getElementById("komponiertBtn");
  if (!kompBtn) {
    var barK = document.getElementById("bar");
    if (barK) {
      kompBtn = document.createElement("button");
      kompBtn.id = "komponiertBtn";
      kompBtn.textContent = "Komponiert";
      var png0 = document.getElementById("pngBtn");
      // Direkt hinter „PNG“: der Schalter gehört zu diesem einen Knopf.
      if (png0 && png0.parentNode === barK) barK.insertBefore(kompBtn, png0.nextSibling);
      else barK.appendChild(kompBtn);
    }
  }
  if (kompBtn) {
    kompBtn.title = "PNG in der komponierten Aufnahme-Einstellung exportieren "
      + "(langes Objektiv, Horizont auf einem Drittel — wie Taste C). "
      + "Aus: das Bild wird genau so exportiert, wie die freie Ansicht gerade steht.";
    komponiertExport = true;
    kompBtn.classList.toggle("on", true);
    kompBtn.addEventListener("click", function () {
      komponiertExport = !komponiertExport;
      this.classList.toggle("on", komponiertExport);
      toast(komponiertExport ? "PNG-Export: komponierte Aufnahme"
                             : "PNG-Export: freie Ansicht");
    });
  }

  document.getElementById("pngBtn").addEventListener("click", function () {
    // D1: Marker sind Arbeitsanzeige, keine Bildbestandteile — sie werden an
    // DERSELBEN Stelle ausgeblendet wie Griffe, Vorschau und Pinselring, samt
    // den Rahmen der Mehrfachauswahl (A3).
    var pv = preview.visible, hv = handles.visible, bv = brushRing.visible;
    var mv = markerGruppe.visible, av = auswahlRahmen.visible;
    preview.visible = false; handles.visible = false; brushRing.visible = false;
    markerGruppe.visible = false; auswahlRahmen.visible = false;
    /* F4: Laeuft der Modus bereits, wird NICHTS umgeschaltet — die Einstellung
       steht ja schon und ein Vorspulen wuerde eine gerade laufende Fahrt des
       Nutzers abschneiden. Der Dateiname richtet sich danach, was tatsaechlich
       im Bild ist, nicht nur nach der Stellung des Schalters. */
    var warAn = istAufnahme();
    var komponiert = komponiertExport || warAn;
    var geschaltet = komponiert && !warAn;
    var stand = geschaltet ? kameraStand() : null;
    if (geschaltet) { setAufnahme(true); kameraVorspulen(); }
    renderFrame(camera, 0);
    exportPNG(komponiert ? "terra-aufnahme.png" : "terra-ansicht.png");
    if (geschaltet) { setAufnahme(false); kameraStandSetzen(stand); }
    preview.visible = pv; handles.visible = hv; brushRing.visible = bv;
    markerGruppe.visible = mv; auswahlRahmen.visible = av;
    toast(komponiert ? "PNG exportiert — komponierte Aufnahme"
                     : "PNG exportiert — freie Ansicht");
  });

  // Umschalter fuer die gesamte Nachbearbeitung (Vergleiche, schwache Rechner)
  document.getElementById("fxBtn").addEventListener("click", function () {
    setPost(!getPost());
    this.classList.toggle("on", getPost());
    toast(getPost() ? "Nachbearbeitung an" : "Nachbearbeitung aus");
  });

  /* ------------------------------------------------------------------------
     D2 — Höhenkarte importieren

     Knopf und Dateifeld stehen seit dieser Runde STATISCH in index.html —
     die Leiste gehört ins Dokument. Hier wird deshalb nur noch gesucht und
     verdrahtet. Die Notanlage bleibt als Rückfallebene erhalten (Dokumente
     ohne diese Elemente, etwa in Testläufen); sie ist wie bisher idempotent,
     es entstehen also nie zwei Knöpfe. WICHTIG war die Umstellung des
     Klick-Listeners: er hing früher IM Erzeugungszweig und wäre bei einem
     statischen Knopf nie angehängt worden — der Knopf wäre tot gewesen.
     ---------------------------------------------------------------------- */
  var bildIn = document.getElementById("hoehenbildIn");
  if (!bildIn) {
    bildIn = document.createElement("input");
    bildIn.type = "file";
    bildIn.id = "hoehenbildIn";
    bildIn.accept = "image/png,image/jpeg,image/*";
    bildIn.style.display = "none";
    document.body.appendChild(bildIn);
  }
  bildIn.addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (f) hoehenkarteImportieren(f);
  });
  var hb = document.getElementById("hoehenbildBtn");
  if (!hb) {
    var bar = document.getElementById("bar");
    if (bar) {
      var sep = document.createElement("div");   // gleiche Trennlinie wie in index.html
      sep.className = "sep";
      bar.appendChild(sep);
      hb = document.createElement("button");
      hb.id = "hoehenbildBtn";
      hb.textContent = "Höhenbild";
      hb.title = "Graustufenbild als Geländehöhe einlesen (PNG/JPG)";
      bar.appendChild(hb);
    }
  }
  // Ein Listener, egal woher der Knopf stammt.
  if (hb) hb.addEventListener("click", function () { bildIn.click(); });

  /* ------------------------------------------------------------------------
     D6 — Autosave: Timer, Seitenverlassen, Angebot beim Start.
     ---------------------------------------------------------------------- */
  setInterval(function () {
    var r = autosaveSchreiben();
    if (r === "zu gross" && !autosaveGewarnt) {
      autosaveGewarnt = true;
      toast("Karte zu groß für den Autosave (über 4 MB) — bitte von Hand speichern");
    }
  }, AUTOSAVE_MS);
  // Beim Verlassen synchron schreiben (localStorage ist synchron). Bewusst
  // ohne Toast und ohne Rueckfrage: ein beforeunload-Dialog ist in modernen
  // Browsern ohnehin nicht frei gestaltbar und hier auch nicht gewollt.
  window.addEventListener("beforeunload", function () { autosaveSchreiben(); });
  /* J1: im eingebetteten Rahmen NICHT anbieten. Dort ist die Wahrheit die
     Karte aus der Datenbank, die die Bruecke gerade hereingereicht hat — der
     Ringpuffer im localStorage dieser Herkunft gehoert einer anderen Sitzung
     und wuerde die Karte beim Bestaetigen ueberschreiben. Der Autosave selbst
     laeuft weiter; nur die Rueckfrage entfaellt. */
  setTimeout(function () { if (!brueckeAktiv()) autosaveAnbieten(); }, 600);
}

/**
 * D2 — Graustufenbild als Basisgelände einlesen.
 *
 * Ablauf: Datei -> Data-URL -> Image -> Canvas -> ImageData -> Luma -> `base`.
 * Die Skalierung auf VW×VW ist bilinear, damit ein 512er Bild auf einer
 * 1024er Karte nicht kachelig wird; die Luma-Gewichte (0.299/0.587/0.114)
 * entsprechen der üblichen Helligkeitswahrnehmung — ein reines Graubild
 * ergibt damit exakt seinen eigenen Grauwert.
 *
 * FORMAT-HINWEIS: `base` weicht danach in praktisch JEDER Zelle vom
 * Seed-Terrain ab. Das v3/v4-Delta (nur Abweichungen) wird dadurch zum
 * Vollarray mit zwei Zahlen je Zelle — das ist richtig so (die Höhen sind
 * nicht mehr reproduzierbar), macht die Datei aber groß und kann den
 * Autosave-Deckel reißen.
 *
 * Determinismus: keine Zufallsquelle, das Ergebnis hängt allein am Bild und
 * an den beiden Parametern.
 */
function hoehenkarteImportieren(datei) {
  var rd = new FileReader();
  rd.onerror = function () { toast("Bild konnte nicht gelesen werden"); };
  rd.onload = function () {
    var img = new Image();
    img.onerror = function () { toast("Das ist kein lesbares Bild"); };
    img.onload = function () {
      var bw = img.naturalWidth | 0, bh = img.naturalHeight | 0;
      if (bw < 2 || bh < 2) { toast("Bild ist zu klein"); return; }
      // Sehr große Bilder vor dem Auslesen verkleinern: die Zielauflösung ist
      // VW (höchstens 1025), alles darüber kostet nur Speicher.
      var maxK = 2048;
      var w = Math.min(bw, maxK), h = Math.min(bh, maxK);
      var cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      var ctx = cv.getContext("2d");
      if (!ctx) { toast("Canvas nicht verfügbar"); return; }
      ctx.drawImage(img, 0, 0, w, h);
      var px;
      try { px = ctx.getImageData(0, 0, w, h).data; }
      catch (err) { toast("Bilddaten nicht lesbar"); return; }

      // Parameter über prompt() — schlicht, aber ausreichend; die Vorgaben
      // sind so gewählt, dass ein durchschnittlich helles Bild eine Karte mit
      // Küstenlinie ergibt (Weiß ~48 über dem Meeresspiegel, Schwarz ~12
      // darunter).
      var skala = zahlAbfrage("Höhenskala: wie viele Einheiten liegen zwischen Schwarz und Weiß?", 60);
      if (skala === null) return;
      var offset = zahlAbfrage("Meeresspiegel-Offset (negativ setzt dunkle Flächen unter Wasser)", -12);
      if (offset === null) return;

      pushUndo(true);                       // ersetzt die Hoehen -> Terrainkopie sichern
      var VWl = KARTE.vw;
      for (var j = 0; j < VWl; j++) {
        var fy = j / (VWl - 1) * (h - 1);
        var y0 = Math.floor(fy), y1 = Math.min(h - 1, y0 + 1), ty = fy - y0;
        for (var i = 0; i < VWl; i++) {
          var fx = i / (VWl - 1) * (w - 1);
          var x0 = Math.floor(fx), x1 = Math.min(w - 1, x0 + 1), tx = fx - x0;
          var g00 = luma(px, (y0 * w + x0) * 4), g10 = luma(px, (y0 * w + x1) * 4);
          var g01 = luma(px, (y1 * w + x0) * 4), g11 = luma(px, (y1 * w + x1) * 4);
          var g = (g00 * (1 - tx) + g10 * tx) * (1 - ty) + (g01 * (1 - tx) + g11 * tx) * ty;
          base[j * VWl + i] = g * skala + offset;
        }
      }
      rebuildAll();
      rebuildHandles();
      toast("Höhenkarte übernommen (" + bw + "×" + bh + " → " + VWl + "²) — "
        + "die Datei wird dadurch deutlich größer");
    };
    img.src = rd.result;
  };
  rd.readAsDataURL(datei);
}

/** Helligkeit 0..1 eines RGBA-Pixels ab Byteoffset o. */
function luma(px, o) {
  return (px[o] * 0.299 + px[o + 1] * 0.587 + px[o + 2] * 0.114) / 255;
}

/** prompt() mit Zahlprüfung: null = abgebrochen oder unbrauchbar. */
function zahlAbfrage(frage, vorgabe) {
  var s = prompt(frage, String(vorgabe));
  if (s === null) return null;
  var v = parseFloat(String(s).replace(",", "."));
  if (!Number.isFinite(v)) { toast("Keine gültige Zahl — abgebrochen"); return null; }
  return v;
}
