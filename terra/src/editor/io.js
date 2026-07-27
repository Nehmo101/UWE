// Untere Leiste: Seed, Tageszeit, Raster, Effekte, Speichern, Laden, PNG-Export.
import { S, HALF, serializeElements, hydrate } from '../core/store.js';
import { base, genBase } from '../world/terrain.js';
import { rebuildAll } from '../core/dirty.js';
import { pushUndo } from './history.js';
import { rebuildHandles } from './selection.js';
import { cam } from './camera.js';
import { ed } from './tools.js';
import { setTod, getTodName } from '../world/atmosphere.js';
import { buildPanel, toast } from '../ui/panels.js';
import { exportPNG, setPost, getPost, renderFrame } from '../render/pipeline.js';
import { camera } from './camera.js';
import { preview, handles, brushRing } from './selection.js';

// Grenzen beim Übernehmen der gespeicherten Kamera: Zoom wie das Mausrad
// (pointer.js klemmt tDist auf 25..400), Fokus wie die Tastatursteuerung.
var CAM_DIST_MIN = 25, CAM_DIST_MAX = 400;
var CAM_FOCUS_MAX = HALF + 40;

/**
 * Prüft eine geladene Kartendatei VOLLSTÄNDIG und baut temporäre, bereits
 * geprüfte Strukturen auf. Wirft bei jedem Verstoß — der Aufrufer fängt den
 * Fehler und lässt den Editor-Zustand dann komplett unangetastet.
 * Fassung 1 (terra.html, ohne version-Feld) und Fassung 2 werden gelesen.
 */
function validiereKarte(text) {
  var d = JSON.parse(text);
  if (!d || !d.hoehen || !d.elemente) throw new Error("Unbekanntes Format");
  if (!Array.isArray(d.hoehen) || !Array.isArray(d.elemente)) throw new Error("Unbekanntes Format");
  // Dateien ohne Versionsfeld stammen aus Fassung 1 und werden weiter gelesen;
  // fehlende Parameter ergänzt genElement aus dem Schema.
  var dateiVersion = d.version || 1;

  // Höhen: der genutzte Anfang muss aus endlichen Zahlen bestehen. Längere
  // Arrays werden abgeschnitten; kürzere füllt die Übernahme deterministisch
  // über genBase aus dem gespeicherten Seed auf.
  var n = Math.min(d.hoehen.length, base.length);
  var hoehen = new Float32Array(n);
  for (var i = 0; i < n; i++) {
    var h = d.hoehen[i];
    if (typeof h !== "number" || !Number.isFinite(h)) throw new Error("Ungültige Höhe an Index " + i);
    hoehen[i] = h;
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
    seed: d.seed | 0,
    hoehen: hoehen,
    elemente: elemente,
    kamera: d.kamera,
    raster: !!d.raster,
    tageszeit: d.tageszeit || "mittag"
  };
}

export function initIO() {
  document.getElementById("seedApply").addEventListener("click", function () {
    var v = document.getElementById("seed").value.trim();
    var s = 0;
    if (/^-?\d+$/.test(v)) s = parseInt(v, 10) | 0;
    else { for (var i = 0; i < v.length; i++) s = (Math.imul(s, 31) + v.charCodeAt(i)) | 0; }
    pushUndo();
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
    var hs = new Array(base.length);
    for (var i = 0; i < base.length; i++) hs[i] = Math.round(base[i] * 100) / 100;
    var data = {
      format: "terra", version: 2, seed: S.worldSeed, tageszeit: getTodName(), raster: S.snap,
      kamera: { x: cam.tFocus.x, z: cam.tFocus.z, dist: cam.tDist, yaw: cam.tYaw, pitch: cam.tPitch },
      hoehen: hs,
      elemente: serializeElements()
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
      } catch {
        toast("Datei konnte nicht gelesen werden");
        return;
      }
      // Ab hier ist alles geprüft: Undo-Punkt setzen und in einem Zug übernehmen.
      pushUndo();
      S.worldSeed = karte.seed;
      document.getElementById("seed").value = String(S.worldSeed);
      // Kürzere Höhenfelder (ältere/fremde Dateien): erst das komplette Feld
      // deterministisch aus dem geladenen Seed erzeugen, damit keine Reste der
      // vorherigen Karte stehen bleiben — dann die gespeicherten Höhen darüber.
      if (karte.hoehen.length < base.length) genBase(S.worldSeed);
      base.set(karte.hoehen);
      hydrate(karte.elemente);
      ed.selected = null;
      ed.draw = null;
      if (karte.kamera) {
        // Nur endliche Werte übernehmen (ein NaN würde die Dämpfung dauerhaft
        // einfrieren); sonst behält die Kamera ihren jeweiligen bisherigen Wert.
        var kk = karte.kamera;
        if (Number.isFinite(kk.x)) cam.tFocus.x = Math.max(-CAM_FOCUS_MAX, Math.min(CAM_FOCUS_MAX, kk.x));
        if (Number.isFinite(kk.z)) cam.tFocus.z = Math.max(-CAM_FOCUS_MAX, Math.min(CAM_FOCUS_MAX, kk.z));
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
