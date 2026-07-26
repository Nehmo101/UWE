// Zeigereingabe: Zeichnen, Griffe, Pinsel, Orbit/Pan/Zoom — und die Tastatur.
// Mausbewegungen schreiben nur Koordinaten; die Terrain-Strahl-Auswertung laeuft
// gedrosselt auf 30 Hz in der Renderschleife (verarbeiteZeiger).
import { clamp, DEG } from '../core/rng.js';
import { S, HALF, mkElement, nextSeed } from '../core/store.js';
import { applyBrush, baseHeightAt, setFlattenTarget } from '../world/terrain.js';
import { cam, groundPoint, rayFrom, rayPlane, autoPitch } from './camera.js';
import { ed, setTool, finishDraw, cancelDraw, curParams, copyParams, snapPt, TOOLS }
  from './tools.js';
import { handles, rebuildHandles, updateHandlePositions, setPreview, updateBrushRing,
  brushRing, pickElement, select } from './selection.js';
import { raycaster, _ndc, camera } from './camera.js';
import { regenElement, commit, isHeavy, deleteElement } from '../core/dirty.js';
import { pushUndo, undo, redo } from './history.js';
import { toast, buildPanel, updateHint } from '../ui/panels.js';

var ptr = { down: false, mode: null, x: 0, y: 0, sx: 0, sy: 0, moved: 0, handle: -1,
            grab: null, lastClick: 0, lastCx: -999, lastCy: -999, lastX: 0, lastZ: 0,
            dragged: false };
var hoverPoint = null;
var zeigerOffen = false, zeigerX = 0, zeigerY = 0, zeigerZuletzt = 0;
var _zeigerEv = { clientX: 0, clientY: 0 };

var hoverExport = { get punkt() { return hoverPoint; } };

export function initPointer(cv) {
  cv.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  window.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  cv.addEventListener("pointerdown", function (e) {
    cv.setPointerCapture(e.pointerId);
    ptr.down = true; ptr.x = e.clientX; ptr.y = e.clientY;
    ptr.sx = e.clientX; ptr.sy = e.clientY; ptr.moved = 0; ptr.dragged = false;
    var p = groundPoint(e);
    if (e.button === 2) {
      ptr.mode = "pan";
      ptr.grab = p ? { x: p.x, y: p.y, z: p.z } : { x: cam.focus.x, y: cam.focusY, z: cam.focus.z };
      return;
    }
    if (e.button === 1) { ptr.mode = "orbit"; return; }
    if (e.button !== 0) return;

    // Griff anfassen?
    if ((ed.selected || ed.draw) && handles.children.length) {
      raycaster.setFromCamera(_ndc, camera);
      var hits = raycaster.intersectObjects(handles.children, false);
      if (hits.length) {
        ptr.mode = "handle";
        ptr.handle = hits[0].object.userData.idx;
        if (!ed.draw) pushUndo();
        return;
      }
    }
    if (!p) return;
    if (ed.tool === "terrain") {
      ptr.mode = "brush";
      pushUndo();
      setFlattenTarget(baseHeightAt(p.x, p.z));
      applyBrush(p, ed.variantOf.terrain, curParams().radius, curParams().staerke, 1 / 60);
      return;
    }
    if (ed.tool === "objekt") {
      ptr.mode = "scatter";
      pushUndo();
      var sp = snapPt(p);
      var el = mkElement("objekt", ed.variantOf.objekt, [sp], copyParams(curParams()), nextSeed());
      S.elements.push(el);
      regenElement(el);
      ptr.scatterEl = el;
      ptr.lastX = sp.x; ptr.lastZ = sp.z;
      select(el);
      return;
    }
    if (ed.tool === "ranke") {
      pushUndo();
      var rel = mkElement("ranke", "ranke", [snapPt(p)], copyParams(curParams()), nextSeed());
      S.elements.push(rel);
      regenElement(rel);
      select(rel);
      ptr.mode = "done";
      return;
    }
  });

  cv.addEventListener("pointermove", function (e) {
    var dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
    ptr.x = e.clientX; ptr.y = e.clientY;
    ptr.moved += Math.abs(dx) + Math.abs(dy);
    if (ptr.moved > 6) ptr.dragged = true;

    if (ptr.mode === "orbit") {                    // billig, sofort auswerten
      cam.tYaw -= dx * 0.006;
      cam.tPitch = clamp(cam.tPitch + dy * 0.004, 22 * DEG, 68 * DEG);
      return;
    }
    if (ptr.mode === "pan" && ptr.grab) {          // nur Ebenenschnitt, kein Terrain
      var pp = rayPlane(rayFrom(e), ptr.grab.y);
      if (pp) {
        cam.tFocus.x = clamp(cam.tFocus.x + (ptr.grab.x - pp.x), -HALF - 40, HALF + 40);
        cam.tFocus.z = clamp(cam.tFocus.z + (ptr.grab.z - pp.z), -HALF - 40, HALF + 40);
      }
      return;
    }
    zeigerOffen = true; zeigerX = e.clientX; zeigerY = e.clientY;
  });


  cv.addEventListener("pointerup", function (e) {
    var wasMode = ptr.mode, dragged = ptr.dragged;
    ptr.down = false; ptr.mode = null; ptr.grab = null;
    if (cv.hasPointerCapture(e.pointerId)) cv.releasePointerCapture(e.pointerId);
    if (wasMode === "brush") { toast("Terrain geändert"); return; }
    if (wasMode === "handle") {
      if (ed.selected) commit(ed.selected, isHeavy(ed.selected));
      return;
    }
    if (wasMode === "scatter") { ptr.scatterEl = null; return; }
    if (wasMode === "pan" || wasMode === "orbit" || wasMode === "done") return;
    if (e.button !== 0 || dragged) return;

    var p = groundPoint(e);
    if (!p) return;
    var now = performance.now();
    // Doppelklick nur, wenn beide Klicks auch am selben Fleck sitzen —
    // sonst beendet schnelles Setzen zweier Punkte versehentlich die Zeichnung.
    var isDouble = (now - ptr.lastClick) < 340 &&
      Math.abs(e.clientX - ptr.lastCx) + Math.abs(e.clientY - ptr.lastCy) < 10;
    ptr.lastClick = now; ptr.lastCx = e.clientX; ptr.lastCy = e.clientY;

    if (ed.tool === "auswahl") { select(pickElement(e, p)); return; }
    if (ed.tool === "pfad" || ed.tool === "flaeche") {
      if (isDouble) { finishDraw(); return; }
      if (!ed.draw) ed.draw = { kind: ed.tool, variant: ed.variantOf[ed.tool], points: [] };
      ed.draw.points.push(snapPt(p));
      rebuildHandles();
      setPreview(ed.draw.points, null, ed.tool === "flaeche");
      updateHint();
    }
  });

  cv.addEventListener("dblclick", function () {
    if (!ed.draw) return;
    // Zwillingspunkt des Doppelklicks entfernen, falls die Zeitschwelle nicht griff
    var n = ed.draw.points.length;
    if (n >= 2) {
      var a = ed.draw.points[n - 1], b = ed.draw.points[n - 2];
      if (Math.hypot(a.x - b.x, a.z - b.z) < 2.5) ed.draw.points.pop();
    }
    finishDraw();
  });

  cv.addEventListener("wheel", function (e) {
    e.preventDefault();
    cam.tDist = clamp(cam.tDist * Math.exp(e.deltaY * 0.0012), 25, 400);
    cam.tPitch = autoPitch();
  }, { passive: false });
}

/** Ausgelagerte Auswertung der Mausposition, höchstens alle 33 ms. */
function verarbeiteZeiger(now) {
  if (!zeigerOffen || now - zeigerZuletzt < 33) return;
  zeigerZuletzt = now; zeigerOffen = false;
  _zeigerEv.clientX = zeigerX; _zeigerEv.clientY = zeigerY;
  var p = groundPoint(_zeigerEv);
  hoverPoint = p;

  if (ptr.mode === "brush" && p) {
    applyBrush(p, ed.variantOf.terrain, curParams().radius, curParams().staerke, 1 / 60);
    updateBrushRing(p, curParams().radius);
    return;
  }
  if (ptr.mode === "handle" && p) {
    var list = ed.draw ? ed.draw.points : (ed.selected ? ed.selected.points : null);
    if (list && list[ptr.handle]) {
      var sp = snapPt(p);
      list[ptr.handle].x = sp.x; list[ptr.handle].z = sp.z;
      updateHandlePositions();
      if (ed.draw) setPreview(ed.draw.points, null, ed.draw.kind === "flaeche");
      else regenElement(ed.selected);
    }
    return;
  }
  if (ptr.mode === "scatter" && p && ptr.scatterEl) {
    var d = Math.hypot(p.x - ptr.lastX, p.z - ptr.lastZ);
    if (d > Math.max(2.5, ptr.scatterEl.params.streuung * 0.8)) {
      var sp2 = snapPt(p);
      ptr.scatterEl.points.push(sp2);
      ptr.lastX = sp2.x; ptr.lastZ = sp2.z;
      regenElement(ptr.scatterEl);
    }
    return;
  }
  if (ed.tool === "terrain") updateBrushRing(p, curParams().radius);
  else brushRing.visible = false;
  if (ed.draw && p) setPreview(ed.draw.points, snapPt(p), ed.draw.kind === "flaeche");
}

function onKey(e) {
  if (e.ctrlKey || e.metaKey) {
    if (e.code === "KeyZ" && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (e.code === "KeyY" || (e.code === "KeyZ" && e.shiftKey)) { e.preventDefault(); redo(); return; }
    return;
  }
  for (var i = 0; i < TOOLS.length; i++) {
    if (e.code === "Digit" + TOOLS[i].key || e.code === "Numpad" + TOOLS[i].key) {
      setTool(TOOLS[i].id); return;
    }
  }
  if (e.code === "Escape") {
    if (ed.draw) cancelDraw();
    else if (ed.selected) select(null);
    return;
  }
  if (e.code === "Enter" || e.code === "NumpadEnter") { finishDraw(); return; }
  if (e.code === "Delete" || e.code === "Backspace") {
    if (ed.selected) {
      pushUndo();
      var was = ed.selected, heavy = isHeavy(was);
      deleteElement(was);
      ed.selected = null;
      rebuildHandles();
      commit(null, heavy);
      buildPanel();
      toast("Element gelöscht");
    }
  }
}

export { verarbeiteZeiger, onKey, ptr, hoverExport };
