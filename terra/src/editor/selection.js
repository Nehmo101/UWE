// Auswahl, Punktgriffe, Zeichenvorschau und Pinselring.
import * as THREE from 'three';
import { clamp } from '../core/rng.js';
import { S, VINE_R } from '../core/store.js';
import { heightAt } from '../world/terrain.js';
import { pathSamples } from '../generators/paths.js';
import { inPoly } from '../generators/areas.js';
import { cam, camera, raycaster, _ndc, rayFrom } from './camera.js';
import { ed } from './tools.js';
import { buildPanel } from '../ui/panels.js';

var sceneHooked = null;
export function initSelection(scene) {
  sceneHooked = scene;
  scene.add(preview);
  scene.add(handles);
  scene.add(brushRing);
}

var previewGeo = new THREE.BufferGeometry();
previewGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(512 * 3), 3));
var preview = new THREE.Line(previewGeo, new THREE.LineBasicMaterial({
  color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false, fog: false
}));
preview.frustumCulled = false;
preview.renderOrder = 900;
preview.visible = false;
var dotGeo = new THREE.SphereGeometry(1, 10, 8);
var dotMatA = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, fog: false });
var dotMatB = new THREE.MeshBasicMaterial({ color: 0x2d74ab, depthTest: false, fog: false });
var dotMatC = new THREE.MeshBasicMaterial({ color: 0xe0a83c, depthTest: false, fog: false });
var handles = new THREE.Group();
handles.renderOrder = 901;

// Zuletzt angefasster Punktgriff des ausgewaehlten Elements (-1 = keiner).
// Liegt hier statt an `ed`, damit tools.js unveraendert bleibt; pointer.js
// liest die Live-Bindung und setzt sie ueber setAktiverGriff.
var aktiverGriff = -1;
function setAktiverGriff(idx) {
  aktiverGriff = (typeof idx === "number" && idx >= 0) ? idx : -1;
  // Materialien in place umfaerben, ohne die Meshes neu zu bauen
  for (var i = 0; i < handles.children.length; i++) {
    handles.children[i].material = ed.draw ? dotMatA
      : (i === aktiverGriff ? dotMatC : dotMatB);
  }
  updateHandlePositions();
}

function setPreview(points, cursor, closed) {
  var arr = previewGeo.attributes.position.array;
  var n = 0, i;
  function put(p) {
    if (n >= 500) return;
    arr[n * 3] = p.x; arr[n * 3 + 1] = heightAt(p.x, p.z) + 0.6; arr[n * 3 + 2] = p.z; n++;
  }
  // Zwischenpunkte für eine weiche Vorschau der Kurve
  var pts = points.slice();
  if (cursor) pts.push(cursor);
  if (pts.length >= 2 && !closed) {
    var sm = pathSamples(pts, 2.5);
    for (i = 0; i < sm.length; i++) put(sm[i]);
  } else {
    for (i = 0; i < pts.length; i++) put(pts[i]);
    if (closed && pts.length > 2) put(pts[0]);
  }
  previewGeo.attributes.position.needsUpdate = true;
  previewGeo.setDrawRange(0, n);
  preview.visible = n > 1;
}

function clearPreview() { preview.visible = false; previewGeo.setDrawRange(0, 0); }

function rebuildHandles() {
  for (var i = handles.children.length - 1; i >= 0; i--) handles.remove(handles.children[i]);
  var list = [];
  if (ed.draw) list = ed.draw.points;
  else if (ed.selected) list = ed.selected.points;
  // Aktiver Griff verfaellt, sobald er ins Leere zeigt (Abwahl, Werkzeugwechsel
  // via setTool, Element geloescht) oder eine Zeichnung laeuft.
  if (ed.draw || aktiverGriff >= list.length) aktiverGriff = -1;
  for (var k = 0; k < list.length; k++) {
    var m = new THREE.Mesh(dotGeo, ed.draw ? dotMatA : (k === aktiverGriff ? dotMatC : dotMatB));
    m.userData.idx = k;
    handles.add(m);
  }
  updateHandlePositions();
}

function updateHandlePositions() {
  var list = ed.draw ? ed.draw.points : (ed.selected ? ed.selected.points : []);
  var s = clamp(cam.dist * 0.011, 0.5, 3.2);
  for (var i = 0; i < handles.children.length; i++) {
    var p = list[i];
    if (!p) continue;
    handles.children[i].position.set(p.x, heightAt(p.x, p.z) + 0.9, p.z);
    // aktiver Griff etwas groesser, damit er als Ziel von Entf erkennbar ist
    handles.children[i].scale.setScalar(!ed.draw && i === aktiverGriff ? s * 1.45 : s);
  }
}

var brushRing = (function () {
  var N = 64, pos = new Float32Array((N + 1) * 3);
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  var l = new THREE.LineLoop(g, new THREE.LineBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.8, depthTest: false, fog: false
  }));
  l.frustumCulled = false; l.renderOrder = 902; l.visible = false;
  return l;
})();
function updateBrushRing(p, r) {
  if (!p) { brushRing.visible = false; return; }
  var arr = brushRing.geometry.attributes.position.array, N = 64;
  for (var i = 0; i <= N; i++) {
    var a = i / N * Math.PI * 2;
    var x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
    arr[i * 3] = x; arr[i * 3 + 1] = heightAt(x, z) + 0.35; arr[i * 3 + 2] = z;
  }
  brushRing.geometry.attributes.position.needsUpdate = true;
  brushRing.visible = true;
}

/** Kürzester Abstand Punkt→Polylinie. */
function distToPolyline(pts, x, z, closed) {
  var best = Infinity;
  var n = pts.length;
  for (var i = 0; i < n - (closed ? 0 : 1); i++) {
    var a = pts[i], b = pts[(i + 1) % n];
    var dx = b.x - a.x, dz = b.z - a.z;
    var l2 = dx * dx + dz * dz;
    var t = l2 > 0 ? clamp(((x - a.x) * dx + (z - a.z) * dz) / l2, 0, 1) : 0;
    var px = a.x + dx * t - x, pz = a.z + dz * t - z;
    var d = px * px + pz * pz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

/** Sucht das dem Punkt (x,z) naechstgelegene Segment eines Elements
 * (gleiche Projektionslogik wie distToPolyline, aber mit Trefferindex).
 * Flaechen zaehlen das Schlusssegment letzter→erster Punkt mit.
 * Liefert { index, px, pz } — Segment beginnt bei points[index], (px,pz) ist
 * der auf das Segment projizierte Punkt — oder null ausserhalb der Toleranz. */
function naechstesSegment(el, x, z, tol) {
  if (!el || !el.points || el.points.length < 2) return null;
  var pts = el.points, closed = el.kind === "flaeche";
  var n = pts.length, best = Infinity, bestI = -1, bx = 0, bz = 0;
  for (var i = 0; i < n - (closed ? 0 : 1); i++) {
    var a = pts[i], b = pts[(i + 1) % n];
    var dx = b.x - a.x, dz = b.z - a.z;
    var l2 = dx * dx + dz * dz;
    var t = l2 > 0 ? clamp(((x - a.x) * dx + (z - a.z) * dz) / l2, 0, 1) : 0;
    var px = a.x + dx * t, pz = a.z + dz * t;
    var d = (px - x) * (px - x) + (pz - z) * (pz - z);
    if (d < best) { best = d; bestI = i; bx = px; bz = pz; }
  }
  if (bestI < 0 || Math.sqrt(best) > tol) return null;
  return { index: bestI, px: bx, pz: bz };
}

function pickElement(ev, p) {
  // erst echte Meshes (Ranken, Plateaus) treffen
  rayFrom(ev);                       // setzt _ndc für den Raycaster
  var meshes = [];
  for (var i = 0; i < S.elements.length; i++) {
    if (S.elements[i].group) {
      for (var c = 0; c < S.elements[i].group.children.length; c++) meshes.push(S.elements[i].group.children[c]);
    }
  }
  if (meshes.length) {
    raycaster.setFromCamera(_ndc, camera);
    var hits = raycaster.intersectObjects(meshes, false);
    if (hits.length && hits[0].object.userData.el) return hits[0].object.userData.el;
  }
  if (!p) return null;
  var best = null, bestD = Infinity;
  for (i = 0; i < S.elements.length; i++) {
    var el = S.elements[i], d = Infinity, tol = 4;
    if (el.kind === "pfad") {
      d = distToPolyline(el.points, p.x, p.z, false);
      tol = (el.params.breite || el.params.dicke || 3) * 0.5 + 3.5;
    } else if (el.kind === "flaeche") {
      if (inPoly(el.points, p.x, p.z)) d = 0;
      else d = distToPolyline(el.points, p.x, p.z, true);
      tol = 3;
    } else if (el.kind === "objekt") {
      for (var k = 0; k < el.points.length; k++) {
        var dd = Math.hypot(el.points[k].x - p.x, el.points[k].z - p.z);
        if (dd < d) d = dd;
      }
      tol = 4 + (el.params.streuung || 0);
    } else if (el.kind === "ranke") {
      d = Math.hypot(el.points[0].x - p.x, el.points[0].z - p.z);
      tol = VINE_R * 3;
    }
    if (d <= tol && d < bestD) { bestD = d; best = el; }
  }
  return best;
}

function select(el) {
  // Anderes Element oder Abwahl: der aktive Griff gehoert zum alten Element
  if (el !== ed.selected) aktiverGriff = -1;
  ed.selected = el;
  rebuildHandles();
  buildPanel();
}


export { preview, handles, brushRing, setPreview, clearPreview, rebuildHandles,
  updateHandlePositions, updateBrushRing, distToPolyline, naechstesSegment,
  pickElement, select, aktiverGriff, setAktiverGriff };
