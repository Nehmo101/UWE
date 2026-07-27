// Auswahl, Punktgriffe, Zeichenvorschau und Pinselring.
import * as THREE from 'three';
import { clamp } from '../core/rng.js';
import { S, VINE_R } from '../core/store.js';
import { heightAt } from '../world/terrain.js';
import { pathSamples } from '../generators/paths.js';
import { inPoly } from '../generators/areas.js';
import { rankeAchse, rankeStuetzen } from '../generators/vines.js';
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
// Zugpunkte einer Ranke: rankenweiss (VINE_MID aus vines.js), damit sie sich
// von den blauen Bodengriffen unterscheiden.
var dotMatD = new THREE.MeshBasicMaterial({ color: 0xf4f1e8, depthTest: false, fog: false });
var handles = new THREE.Group();
handles.renderOrder = 901;

/* Aufteilung der Griffleiste: die ersten `punkte` Griffe sind Elementpunkte
   (Index = Punktindex, alles Bestehende bleibt gueltig), danach folgen die
   Zugpunkt-Griffe der ausgewaehlten Ranke. pointer.js arbeitet dadurch
   weiterhin mit EINEM Griffindex und fragt hier nur nach, was er bedeutet. */
var griffLayout = { punkte: 0, zug: 0, el: null };

/** Zugpunkt-Index eines Griffs, oder -1 wenn es ein Elementpunkt ist. */
function zugGriffIndex(i) {
  if (i < griffLayout.punkte || i >= griffLayout.punkte + griffLayout.zug) return -1;
  return i - griffLayout.punkte;
}
/** Ranke, an der die Zugpunkt-Griffe haengen (oder null). */
function zugGriffElement() { return griffLayout.zug ? griffLayout.el : null; }

/** Zugpunktliste der ausgewaehlten Ranke (Rohdaten, Reihenfolge = Griffindex). */
function zugpunktListe(el) {
  return (el && el.kind === "ranke" && el.params && Array.isArray(el.params.zugpunkte))
    ? el.params.zugpunkte : null;
}

function griffMat(i) {
  if (ed.draw) return dotMatA;
  if (i === aktiverGriff) return dotMatC;
  return zugGriffIndex(i) >= 0 ? dotMatD : dotMatB;
}

// Zuletzt angefasster Punktgriff des ausgewaehlten Elements (-1 = keiner).
// Liegt hier statt an `ed`, damit tools.js unveraendert bleibt; pointer.js
// liest die Live-Bindung und setzt sie ueber setAktiverGriff.
var aktiverGriff = -1;
function setAktiverGriff(idx) {
  aktiverGriff = (typeof idx === "number" && idx >= 0) ? idx : -1;
  // Materialien in place umfaerben, ohne die Meshes neu zu bauen
  for (var i = 0; i < handles.children.length; i++) {
    handles.children[i].material = griffMat(i);
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
  // H4.2: Zugpunkte einer ausgewaehlten Ranke bekommen zusaetzliche Griffe
  // AUF IHRER WELTHOEHE. Waehrend einer Zeichnung nicht (dort gibt es kein
  // ausgewaehltes Element).
  var zugL = ed.draw ? null : zugpunktListe(ed.selected);
  griffLayout.punkte = list.length;
  griffLayout.zug = zugL ? zugL.length : 0;
  griffLayout.el = ed.draw ? null : ed.selected;
  var gesamt = griffLayout.punkte + griffLayout.zug;
  // Aktiver Griff verfaellt, sobald er ins Leere zeigt (Abwahl, Werkzeugwechsel
  // via setTool, Element geloescht) oder eine Zeichnung laeuft.
  if (ed.draw || aktiverGriff >= gesamt) aktiverGriff = -1;
  for (var k = 0; k < gesamt; k++) {
    var m = new THREE.Mesh(dotGeo, griffMat(k));
    m.userData.idx = k;
    handles.add(m);
  }
  updateHandlePositions();
}

var _gp = { x: 0, y: 0, z: 0 };
function updateHandlePositions() {
  var list = ed.draw ? ed.draw.points : (ed.selected ? ed.selected.points : []);
  var s = clamp(cam.dist * 0.011, 0.5, 3.2);
  var zugL = griffLayout.zug ? zugpunktListe(griffLayout.el) : null;
  // Stuetzstellen einmal je Aufruf: die Griffe sollen auf DERSELBEN Sollachse
  // sitzen, die genRanke baut (rankeAchse ist dort dieselbe Funktion).
  var st = zugL ? rankeStuetzen(griffLayout.el) : null;
  for (var i = 0; i < handles.children.length; i++) {
    var zi = zugGriffIndex(i);
    if (zi >= 0) {
      var zp = zugL && zugL[zi];
      if (!zp || !Number.isFinite(zp.h)) continue;
      rankeAchse(griffLayout.el, clamp(zp.h, 0, 1), _gp, st);
      handles.children[i].position.set(_gp.x, _gp.y, _gp.z);
      handles.children[i].scale.setScalar(i === aktiverGriff ? s * 1.45 : s);
      continue;
    }
    var p = list[i];
    if (!p) continue;
    handles.children[i].position.set(p.x, heightAt(p.x, p.z) + 0.9, p.z);
    // aktiver Griff etwas groesser, damit er als Ziel von Entf erkennbar ist
    handles.children[i].scale.setScalar(!ed.draw && i === aktiverGriff ? s * 1.45 : s);
  }
}

var _rt = { x: 0, y: 0, z: 0 }, _pv3 = new THREE.Vector3();

/** Trefferpruefung Klickstrahl <-> Rankenachse (H4.2, Zugpunkt einfuegen).
 *  Liefert die relative Hoehe des naechstliegenden Achsenpunkts oder -1.
 *  Reines Sampling gegen den Punkt-Strahl-Abstand: die Achse ist eine
 *  gestoerte Kurve, ein analytischer Schnitt lohnte den Aufwand nicht. */
function rankeAchsenTreffer(el, ev, tol) {
  if (!el || el.kind !== "ranke" || !el.points.length) return -1;
  // Vorgabe: etwa der halbe Geflechtdurchmesser plus Griffreserve
  if (!tol) tol = VINE_R * ((el.params && el.params.dicke) || 1) * 1.6;
  var ray = rayFrom(ev), st = rankeStuetzen(el);
  var best = -1, bd = tol, N = 96;
  for (var i = 0; i <= N; i++) {
    var t = i / N;
    rankeAchse(el, t, _rt, st);
    var vx = _rt.x - ray.origin.x, vy = _rt.y - ray.origin.y, vz = _rt.z - ray.origin.z;
    var pr = vx * ray.direction.x + vy * ray.direction.y + vz * ray.direction.z;
    if (pr <= 0) continue;                       // hinter der Kamera
    var dx = vx - ray.direction.x * pr, dy = vy - ray.direction.y * pr,
        dz = vz - ray.direction.z * pr;
    var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

/** Bildschirmpixel je voller Rankenhoehe — Skala fuers Hoehenziehen (Shift).
 *  Ohne die Projektion fuehlte sich der Zug bei jedem Zoom anders an; die
 *  Untergrenze faengt die fast senkrechte Aufsicht ab, in der die Ranke auf
 *  wenige Pixel zusammenfaellt. */
function zugPixelProHoehe(el) {
  rankeAchse(el, 0, _rt);
  _pv3.set(_rt.x, _rt.y, _rt.z).project(camera);
  var yA = _pv3.y;
  rankeAchse(el, 1, _rt);
  _pv3.set(_rt.x, _rt.y, _rt.z).project(camera);
  return Math.max(60, Math.abs((_pv3.y - yA) * 0.5 * window.innerHeight));
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
      // H4.4: eine Ranke kann mehrere Fuesse haben — der naechstgelegene zaehlt.
      for (var rf = 0; rf < el.points.length; rf++) {
        var rd = Math.hypot(el.points[rf].x - p.x, el.points[rf].z - p.z);
        if (rd < d) d = rd;
      }
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
  pickElement, select, aktiverGriff, setAktiverGriff,
  zugGriffIndex, zugGriffElement, zugpunktListe, rankeAchsenTreffer, zugPixelProHoehe };
