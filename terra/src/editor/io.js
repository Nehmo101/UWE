// Untere Leiste: Seed, Tageszeit, Raster, Effekte, Speichern, Laden, PNG-Export.
import { S, KARTE, KARTEN_GROESSEN, setKartenGroesse, BIOME, hoehenProfil,
  hoehenProfilGleich, serializeElements, hydrate } from '../core/store.js';
import { base, genBase, genBaseIn, terrainGeometrienNeu } from '../world/terrain.js';
import { rebuildAll } from '../core/dirty.js';
import { pushUndo, verwerfeHistorie } from './history.js';
import { rebuildHandles } from './selection.js';
import { cam } from './camera.js';
import { ed } from './tools.js';
import { setTod, getTodName } from '../world/atmosphere.js';
import { buildPanel, toast } from '../ui/panels.js';
import { exportPNG, setPost, getPost, renderFrame } from '../render/pipeline.js';
import { camera } from './camera.js';
import { preview, handles, brushRing } from './selection.js';
import { weiteHuellenNeu } from '../core/pools.js';
import { wasserNeuBauen } from '../world/water.js';

// Grenzen beim Übernehmen der gespeicherten Kamera: Zoom wie das Mausrad
// (pointer.js klemmt tDist auf 25..400), Fokus wie die Tastatursteuerung.
// Der Fokus haengt an der Kartengroesse und wird deshalb JETZT gelesen, nicht
// beim Modulstart in eine Konstante kopiert (H1b — HALF ist keine Konstante
// mehr, sondern eine lebende Bindung aus core/store.js).
var CAM_DIST_MIN = 25, CAM_DIST_MAX = 400;
function camFokusMax() { return KARTE.half + 40; }

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
 * Prüft eine geladene Kartendatei VOLLSTÄNDIG und baut temporäre, bereits
 * geprüfte Strukturen auf. Wirft bei jedem Verstoß — der Aufrufer fängt den
 * Fehler und lässt den Editor-Zustand dann komplett unangetastet.
 * Fassung 1 (terra.html, ohne version-Feld), Fassung 2 (hoehen-Vollarray),
 * Fassung 3 (hoehenDelta gegen das Seed-Terrain) und Fassung 4
 * (zusaetzlich `kartenGroesse`) werden gelesen.
 */
function validiereKarte(text) {
  var d = JSON.parse(text);
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

  // Elemente: genau die Felder prüfen, die hydrate/mkElement/genElement
  // wirklich brauchen (kind/variant fürs Schema, points fürs Erzeugen,
  // params als Objekt für die Schema-Ergänzung, seed/id als Zahlen).
  var elemente = [];
  for (var k = 0; k < d.elemente.length; k++) {
    var e = d.elemente[k];
    if (!e || typeof e !== "object" || Array.isArray(e)) throw new Error("Ungültiges Element " + k);
    if (typeof e.kind !== "string" || !e.kind) throw new Error("Element " + k + ": kind fehlt");
    if (e.variant !== undefined && typeof e.variant !== "string") throw new Error("Element " + k + ": variant ungültig");
    if (!Array.isArray(e.points)) throw new Error("Element " + k + ": points fehlen");
    var pts = [];
    for (var p = 0; p < e.points.length; p++) {
      var pt = e.points[p];
      if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.z)) throw new Error("Element " + k + ": Punkt " + p + " ungültig");
      pts.push({ x: pt.x, z: pt.z });
    }
    if (e.params !== undefined && (typeof e.params !== "object" || e.params === null || Array.isArray(e.params)))
      throw new Error("Element " + k + ": params ungültig");
    // Zugpunkte der Ranken (H4.2) liegen in params und formen die Achse —
    // vines.js filtert zwar defensiv, aber eine kaputte Datei soll gar nicht
    // erst uebernommen werden (atomares Laden aus Runde C).
    if (e.params && Array.isArray(e.params.zugpunkte)) {
      for (var zq = 0; zq < e.params.zugpunkte.length; zq++) {
        var zz = e.params.zugpunkte[zq];
        if (!zz || !Number.isFinite(zz.h) || !Number.isFinite(zz.dx) || !Number.isFinite(zz.dz))
          throw new Error("Element " + k + ": Zugpunkt " + zq + " ungültig");
      }
    }
    if (e.seed !== undefined && !Number.isFinite(e.seed)) throw new Error("Element " + k + ": seed ungültig");
    if (e.id !== undefined && !Number.isFinite(e.id)) throw new Error("Element " + k + ": id ungültig");
    elemente.push({
      id: e.id === undefined ? undefined : (e.id | 0),
      kind: e.kind,
      variant: e.variant,
      points: pts,
      params: e.params || {},          // fehlende params ergänzt genElement aus dem Schema
      seed: e.seed === undefined ? 0 : (e.seed | 0)
    });
  }

  return {
    dateiVersion: dateiVersion,
    kartenGroesse: kartenGroesse,
    seed: d.seed | 0,
    hoehen: hoehen,               // Float32Array (v1/v2) oder null
    hoehenDelta: hoehenDelta,     // flaches Paar-Array (v3) oder null
    elemente: elemente,
    kamera: d.kamera,
    raster: !!d.raster,
    tageszeit: d.tageszeit || "mittag",
    // Biom (G5, tolerantes Zusatzfeld): optionaler String. Fehlt das Feld
    // oder ist der Wert unbekannt, faellt die Karte ohne Fehler auf "wiese"
    // zurueck — aeltere Dateien sehen damit exakt wie bisher aus.
    biom: (typeof d.biom === "string" && BIOME[d.biom]) ? d.biom : "wiese",
    // Optionales Feld (ab dieser Runde mitgeschrieben, version bleibt 2):
    // Stand von S.elementSeedCounter beim Speichern. Fehlt es (aeltere
    // v1/v2-Dateien) oder ist es keine endliche Zahl, liefert null — der
    // Aufrufer leitet den Zaehler dann aus der Elementanzahl ab.
    seedZaehler: Number.isFinite(d.seedZaehler) ? (d.seedZaehler | 0) : null
  };
}

export function initIO() {
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
      kamera: { x: cam.tFocus.x, z: cam.tFocus.z, dist: cam.tDist, yaw: cam.tYaw, pitch: cam.tPitch },
      hoehenDelta: berechneHoehenDelta(base, seedTerrain, zellen),
      elemente: serializeElements(),
      // Stand des Element-Seed-Zaehlers mitschreiben, damit nextSeed() nach
      // dem Laden keine bereits vergebenen Seeds erneut erzeugt.
      seedZaehler: S.elementSeedCounter
    };
    download("terra-karte.json", new Blob([JSON.stringify(data)], { type: "application/json" }));
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
      var karte;
      try {
        karte = validiereKarte(rd.result);
      } catch (err) {
        toast("Datei konnte nicht gelesen werden");
        return;
      }
      // Ab hier ist alles geprüft: Undo-Punkt setzen und in einem Zug übernehmen.
      pushUndo(true);                    // das Laden ersetzt die Hoehen -> Terrainkopie sichern
      S.worldSeed = karte.seed;
      document.getElementById("seed").value = String(S.worldSeed);
      // Biom VOR dem Terrain-/Elementaufbau setzen — terrainColor und die
      // Generatoren lesen S.biom im rebuildAll unten. Select-UI nachfuehren.
      S.biom = karte.biom;
      document.getElementById("biomSel").value = S.biom;
      // Kartengroesse VOR genBase/Delta setzen: genBase schreibt in das dann
      // passend dimensionierte base-Feld, und die Deltaindizes der Datei sind
      // gegen genau dieses VW gerechnet. (v1/v2/v3 liefern hier 256.)
      if (karte.kartenGroesse !== KARTE.map) setzeKartenGroesse(karte.kartenGroesse);
      var kartenSel = document.getElementById("kartenSel");
      if (kartenSel) kartenSel.value = String(KARTE.map);
      if (karte.hoehenDelta !== null) {
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
      ed.selected = null;
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
      toast(karte.dateiVersion < 2 ? "Karte geladen (ältere Fassung)" : "Karte geladen");
    };
    rd.readAsText(f);
    e.target.value = "";
  });
  document.getElementById("pngBtn").addEventListener("click", function () {
    var pv = preview.visible, hv = handles.visible, bv = brushRing.visible;
    preview.visible = false; handles.visible = false; brushRing.visible = false;
    renderFrame(camera, 0);
    exportPNG("terra-ansicht.png");
    preview.visible = pv; handles.visible = hv; brushRing.visible = bv;
    toast("PNG exportiert");
  });

  // Umschalter fuer die gesamte Nachbearbeitung (Vergleiche, schwache Rechner)
  document.getElementById("fxBtn").addEventListener("click", function () {
    setPost(!getPost());
    this.classList.toggle("on", getPost());
    toast(getPost() ? "Nachbearbeitung an" : "Nachbearbeitung aus");
  });
}
