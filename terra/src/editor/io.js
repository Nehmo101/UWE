// Untere Leiste: Seed, Tageszeit, Raster, Effekte, Speichern, Laden, PNG-Export.
import { S, serializeElements, hydrate } from '../core/store.js';
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
      try {
        var d = JSON.parse(rd.result);
        if (!d || !d.hoehen || !d.elemente) throw new Error("Unbekanntes Format");
        // Dateien ohne Versionsfeld stammen aus Fassung 1 und werden weiter gelesen;
        // fehlende Parameter ergänzt genElement aus dem Schema.
        var dateiVersion = d.version || 1;
        pushUndo();
        S.worldSeed = d.seed | 0;
        document.getElementById("seed").value = String(S.worldSeed);
        for (var i = 0; i < base.length && i < d.hoehen.length; i++) base[i] = d.hoehen[i];
        hydrate(d.elemente);
      ed.selected = null;
      ed.draw = null;
        if (d.kamera) {
          cam.tFocus.x = d.kamera.x; cam.tFocus.z = d.kamera.z;
          cam.tDist = d.kamera.dist; cam.tYaw = d.kamera.yaw; cam.tPitch = d.kamera.pitch;
        }
        S.snap = !!d.raster;
        document.getElementById("snapBtn").classList.toggle("on", S.snap);
        rebuildAll();
        rebuildHandles();
        buildPanel();
        setTod(d.tageszeit || "mittag", true);
        toast(dateiVersion < 2 ? "Karte geladen (ältere Fassung)" : "Karte geladen");
      } catch (err) {
        toast("Datei konnte nicht gelesen werden");
      }
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
