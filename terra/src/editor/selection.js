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

var _sceneHooked = null;
export function initSelection(scene) {
  _sceneHooked = scene;
  scene.add(preview);
  scene.add(handles);
  scene.add(brushRing);
  scene.add(markerGruppe);
  scene.add(auswahlRahmen);
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
  // A3: der Rahmen der Mehrfachauswahl haengt an derselben Zustandsaenderung
  // wie die Griffe (Auswahl, Zeichenbeginn, Loeschen) — hier mitzuziehen
  // erspart jedem Aufrufer einen zweiten Aufruf.
  rebuildAuswahlRahmen();
  updateHandlePositions();
}

/* ==========================================================================
   D1 — Marker als Stecknadeln

   Gleiche Machart wie die Griffe: eigene Gruppe, depthTest:false (immer
   sichtbar, auch hinter einem Berg), fog:false, Skalierung mit der
   Kameradistanz — eine Nadel, die mit dem Zoom schrumpft, waere auf einer
   1024er Karte unauffindbar.
   BESCHRIFTUNG: bewusst nicht im 3D-Bild. Text auf einer Ebene im Raum
   braucht entweder eine gerenderte Textur je Marker (Canvas -> Texture, neu
   bei jeder Textaenderung) oder Sprite-Fonts; beides ist fuer eine Notiz zu
   teuer und liest sich schraeg zur Kamera schlecht. Der richtige Ort ist ein
   HTML-Overlay in ui/panels.js — Vorschlag im Bericht.
   ========================================================================== */
var MARKER_FARBE = { ort: 0xf4f1e8, gefahr: 0xd0553c, notiz: 0xe0a83c, arbor: 0x7fe0cc };
// Geometrien einmal, mit dem Fusspunkt im Ursprung (translate auf der
// Geometrie statt Position am Mesh): so skaliert die ganze Nadel um ihren
// Fusspunkt, wenn die Gruppe skaliert wird.
var nadelGeo = new THREE.CylinderGeometry(0.16, 0.16, 6, 6);
nadelGeo.translate(0, 3, 0);
var nadelKopfGeo = new THREE.SphereGeometry(0.9, 10, 8);
nadelKopfGeo.translate(0, 6.4, 0);
var nadelMat = new THREE.MeshBasicMaterial({ color: 0x2b2f2c, depthTest: false, fog: false });
var kopfMats = {};
function kopfMat(art) {
  var f = MARKER_FARBE[art] === undefined ? MARKER_FARBE.notiz : MARKER_FARBE[art];
  if (!kopfMats[f]) kopfMats[f] = new THREE.MeshBasicMaterial({ color: f, depthTest: false, fog: false });
  return kopfMats[f];
}
// Ausgewaehlter Marker: dasselbe Gelb wie der aktive Punktgriff (dotMatC).
var kopfMatAktiv = new THREE.MeshBasicMaterial({ color: 0xe0a83c, depthTest: false, fog: false });
var markerGruppe = new THREE.Group();
markerGruppe.renderOrder = 903;

var markerAuswahl = -1;
/** Index des ausgewaehlten Markers in S.marker, oder -1. */
function getMarkerAuswahl() { return markerAuswahl; }
function waehleMarker(i) {
  var neu = (typeof i === "number" && i >= 0 && i < S.marker.length) ? i : -1;
  if (neu === markerAuswahl && markerGruppe.children.length === S.marker.length) return;
  markerAuswahl = neu;
  rebuildMarker();
}

/** Nadeln neu aufbauen. Aufrufen, wenn sich S.marker oder die Auswahl aendert
 *  — nicht je Bild (die Positionen zieht updateMarkerPositions nach). */
function rebuildMarker() {
  for (var i = markerGruppe.children.length - 1; i >= 0; i--) markerGruppe.remove(markerGruppe.children[i]);
  if (markerAuswahl >= S.marker.length) markerAuswahl = -1;
  for (var k = 0; k < S.marker.length; k++) {
    var g = new THREE.Group();
    var schaft = new THREE.Mesh(nadelGeo, nadelMat);
    var kopf = new THREE.Mesh(nadelKopfGeo, k === markerAuswahl ? kopfMatAktiv : kopfMat(S.marker[k].art));
    // renderOrder gehoert an die Meshes (eine Group rendert selbst nichts).
    schaft.renderOrder = 903; kopf.renderOrder = 904;
    schaft.frustumCulled = false; kopf.frustumCulled = false;
    schaft.userData.markerIdx = k; kopf.userData.markerIdx = k;
    g.add(schaft); g.add(kopf);
    markerGruppe.add(g);
  }
  updateMarkerPositions();
}

function updateMarkerPositions() {
  var s = clamp(cam.dist * 0.011, 0.5, 3.2);
  var n = Math.min(markerGruppe.children.length, S.marker.length);
  for (var i = 0; i < n; i++) {
    var m = S.marker[i], g = markerGruppe.children[i];
    g.position.set(m.x, heightAt(m.x, m.z), m.z);
    g.scale.setScalar(i === markerAuswahl ? s * 1.3 : s);
  }
}

/** Trefferpruefung Klickstrahl <-> Stecknadel. Liefert den Markerindex oder -1. */
function markerTreffer(ev) {
  if (!markerGruppe.children.length) return -1;
  rayFrom(ev);
  raycaster.setFromCamera(_ndc, camera);
  var hits = raycaster.intersectObjects(markerGruppe.children, true);
  if (!hits.length) return -1;
  var idx = hits[0].object.userData.markerIdx;
  return typeof idx === "number" ? idx : -1;
}

/* ==========================================================================
   A3 — Rahmen der Mehrfachauswahl

   Griffe bekommt weiterhin NUR ed.selected (die gesamte Griff-Logik bleibt
   unangetastet). Die uebrigen Elemente der Auswahl brauchen trotzdem eine
   Rueckmeldung, sonst ist Shift+Klick unsichtbar — sie bekommen einen
   flachen Rahmen um ihre Punkt-Huellbox. Bewusst nur die SEKUNDAEREN
   Elemente: das Primaerelement zeigt seine Griffe und waere waehrend eines
   Griff-Zugs der einzige Fall, in dem der Rahmen hinterherhinkte.
   ========================================================================== */
var auswahlRahmen = new THREE.Group();
var rahmenMat = new THREE.LineBasicMaterial({
  color: 0x2d74ab, transparent: true, opacity: 0.85, depthTest: false, fog: false
});

function leereRahmen() {
  for (var i = auswahlRahmen.children.length - 1; i >= 0; i--) {
    var c = auswahlRahmen.children[i];
    if (c.geometry) c.geometry.dispose();     // Geometrie ist je Rahmen eigen
    auswahlRahmen.remove(c);
  }
}

function rebuildAuswahlRahmen() {
  leereRahmen();
  if (!ed.auswahl || ed.auswahl.length < 2) return;
  for (var i = 0; i < ed.auswahl.length; i++) {
    var el = ed.auswahl[i];
    // Verwaiste Referenzen ueberspringen (siehe Konvention bei ed.auswahl)
    if (el === ed.selected || !el || !el.points || S.elements.indexOf(el) < 0) continue;
    var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (var p = 0; p < el.points.length; p++) {
      var q = el.points[p];
      if (q.x < minX) minX = q.x;
      if (q.x > maxX) maxX = q.x;
      if (q.z < minZ) minZ = q.z;
      if (q.z > maxZ) maxZ = q.z;
    }
    if (minX > maxX) continue;
    var r = 2.5;                                   // etwas Luft um die Punkte
    minX -= r; maxX += r; minZ -= r; maxZ += r;
    var ecken = [[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ]];
    var pos = new Float32Array(12);
    for (var e = 0; e < 4; e++) {
      pos[e * 3] = ecken[e][0];
      pos[e * 3 + 1] = heightAt(ecken[e][0], ecken[e][1]) + 0.9;
      pos[e * 3 + 2] = ecken[e][1];
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    var l = new THREE.LineLoop(g, rahmenMat);
    l.frustumCulled = false;
    l.renderOrder = 900;
    auswahlRahmen.add(l);
  }
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
  // D1: Nadeln haengen an derselben Kameradistanz wie die Griffe und werden
  // deshalb hier mitgezogen. main.js ruft updateHandlePositions ohnehin je
  // Bild auf — so kommt die Markeranzeige ohne Aenderung an main.js aus.
  updateMarkerPositions();
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
  /* A3: die Einzelauswahl SETZT die Liste neu, statt sie zu ergaenzen. Damit
     verhaelt sich jeder bestehende select()-Aufruf (Zeichnen abgeschlossen,
     Objekt gestreut, Ranke gepflanzt, Klick im Auswahlwerkzeug) exakt wie
     frueher, und die Konvention "ed.selected ist das letzte Element von
     ed.auswahl" gilt ohne Zutun des Aufrufers. */
  ed.auswahl.length = 0;
  if (el) ed.auswahl.push(el);
  rebuildHandles();
  buildPanel();
}

/**
 * A3 — Shift+Klick: Element zur Auswahl hinzufuegen oder aus ihr entfernen.
 * Haelt die Konvention ein (ed.selected = letztes Element der Liste, leer =
 * null) und laesst damit Griffe, Panel und Entf unveraendert am zuletzt
 * gewaehlten Element arbeiten. Liefert die neue Anzahl.
 */
function auswahlUmschalten(el) {
  if (!el) return ed.auswahl.length;
  var i = ed.auswahl.indexOf(el);
  if (i >= 0) {
    ed.auswahl.splice(i, 1);
    ed.selected = ed.auswahl.length ? ed.auswahl[ed.auswahl.length - 1] : null;
    aktiverGriff = -1;                       // der Griff gehoerte zum alten Element
  } else {
    ed.auswahl.push(el);
    if (el !== ed.selected) aktiverGriff = -1;
    ed.selected = el;
  }
  rebuildHandles();
  buildPanel();
  return ed.auswahl.length;
}


export { preview, handles, brushRing, setPreview, clearPreview, rebuildHandles,
  updateHandlePositions, updateBrushRing, distToPolyline, naechstesSegment,
  pickElement, select, auswahlUmschalten, aktiverGriff, setAktiverGriff,
  zugGriffIndex, zugGriffElement, zugpunktListe, rankeAchsenTreffer, zugPixelProHoehe,
  markerGruppe, rebuildMarker, updateMarkerPositions, markerTreffer, waehleMarker,
  getMarkerAuswahl, auswahlRahmen, rebuildAuswahlRahmen };
