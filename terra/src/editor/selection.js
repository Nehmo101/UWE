// Auswahl, Punktgriffe, Zeichenvorschau und Pinselring.
import * as THREE from 'three';
import { clamp } from '../core/rng.js';
import { S, VINE_R } from '../core/store.js';
// Bedienungsrunde: Klick auf Instanz-Objekte (Haeuser, Baeume …) waehlt ihr
// Element — dafuer braucht pickElement die Pool-Meshes. Zyklusfrei: pools.js
// importiert nichts aus editor/.
import { POOLS, POOL_NAMES } from '../core/pools.js';
import { heightAt } from '../world/terrain.js';
import { pathSamples } from '../generators/paths.js';
import { inPoly } from '../generators/areas.js';
/* Runde H (Bedienung): der Rand einer Flaeche als Beschriftungskurve. seeUmriss
   liest nur el.points und liefert die geschlossene Catmull-Rom-Kurve DURCH die
   Griffe — exakt die Kurve, die ein See als Ufer zeichnet. Dieselbe Frage
   („Griffe oder geglaettete Kurve?"), dieselbe Antwort, eine Funktion. Der
   Import ist zyklusfrei: see.js zieht core/, world/ und generators/, nie
   editor/. */
import { seeUmriss } from '../generators/see.js';
import { rankeAchse, rankeStuetzen } from '../generators/vines.js';
import { cam, camera, raycaster, _ndc, rayFrom } from './camera.js';
import { ed, zeichenMarkerNachziehen } from './tools.js';
import { buildPanel } from '../ui/panels.js';
// I4: die eine Beschriftungsschicht der laufenden Karte.
// Runde H (Bedienung): ringFenster schneidet aus dem geschlossenen Ring das
// offene Stueck aus, auf dem die Zeile laeuft (Anfang = Ankerpunkt).
import { holeBeschriftungsschicht, ringFenster } from '../ui/beschriftung.js';

export function initSelection(scene) {
  scene.add(preview);
  scene.add(handles);
  scene.add(brushRing);
  scene.add(markerGruppe);
  scene.add(auswahlRahmen);
  // I4: Beschriftungen liegen IN der Szene und nicht als HTML darueber —
  // das war der ganze Zweck: sie sollen im PNG-Export erscheinen.
  scene.add(holeBeschriftungsschicht().gruppe);
  beschriftungenAktualisieren();
}

/* ==========================================================================
   Beschriftungselemente in die Schicht spiegeln (I4)

   Gegenstueck zu rebuildMarker: dort die flache S.marker-Liste, hier die
   Elemente mit kind "marker" und variant "beschriftung". Zwei Listen, zwei
   Funktionen — sie sehen aehnlich aus, meinen aber Verschiedenes, und das
   soll man im Code sehen.

   Die Hoehe kommt aus heightAt und nicht aus dem Element: eine Beschriftung
   soll ueber dem Gelaende schweben, auch nachdem die Erosion darunter ein Tal
   gegraben hat. Der Zuschlag von 2,2 Einheiten haelt sie ueber niedrigem
   Bewuchs, ohne dass sie vom Boden abhebt.
   ========================================================================== */
function beschriftungenAktualisieren() {
  /* Runde H (Bedienung): handgesetzte Kartenzeichen (marker:zeichen) haengen
     am selben Selbstheilungs-Takt wie die Beschriftungen — main.js ruft diese
     Funktion fuenfmal je Sekunde, und genau das ist der Abgleich, „der von
     sich aus nachzieht und nicht vergessen werden kann" (Kommentar dort).
     Noetig, weil genElement in core/dirty.js den Durchfall-Zweig fuer
     marker-Elemente (noch) nicht kennt: jeder schwere Commit, jedes Undo und
     jedes Laden leert die Instanzen des Zeichens, ohne sie neu zu erzeugen.
     zeichenMarkerNachziehen erkennt genau das und setzt sie wieder. */
  zeichenMarkerNachziehen();
  var quellen = [];
  for (var i = 0; i < S.elements.length; i++) {
    var e = S.elements[i];
    if (e.kind !== "marker" || e.variant !== "beschriftung") continue;
    var p = e.points && e.points[0];
    if (!p) continue;
    var pr = e.params || {};
    if (!pr.text) continue;                 // ohne Text gibt es nichts zu zeichnen
    var q = {
      id: e.id, text: pr.text, klasse: pr.klasse, groesse: pr.groesse,
      ziel: pr.ziel, x: p.x, y: heightAt(p.x, p.z) + 2.2, z: p.z
    };
    kurveAnhaengen(q, pr.anPfad, p);
    quellen.push(q);
  }
  holeBeschriftungsschicht().abgleichen(quellen);
}

/* ==========================================================================
   Die Kurve einer verknuepften Beschriftung (I4, eingehaengt in dieser Runde)

   `params.anPfad` traegt die `el.id` des Elements, an dem die Beschriftung
   entlanglaufen soll. Hier wird der Verweis aufgeloest — und zwar bei JEDEM
   Abgleich neu (fuenfmal je Sekunde aus main.js), nicht einmalig gemerkt. Das
   ist die ganze Antwort auf „was passiert, wenn das Element geloescht wird":

     Element weg  ->  indexOf findet nichts  ->  kein `pfad` in der Quelle
                  ->  die Schicht baut ein gewoehnliches Sprite.

   Die Beschriftung bleibt also stehen, wo sie steht, und richtet sich wieder
   gerade auf. Kein Aufraeumen beim Loeschen, keine Rueckverweisliste, kein
   Zustand, der veralten koennte — dieselbe Haltung wie bei `ed.auswahl`
   (siehe Konvention in editor/tools.js): jeder LESER filtert, statt sich auf
   fremdes Aufraeumen zu verlassen. Wird dasselbe Element rueckgaengig wieder
   hergestellt, traegt es seine alte id (store.js hydrate) und die Verknuepfung
   lebt von selbst wieder auf.

   WELCHE ELEMENTE. `pfad` — dort IST die Punktfolge die Kurve, und
   pathSamples liefert genau die Catmull-Rom-Linie, die auch gezeichnet wird.
   Seit dieser Runde auch `flaeche`: ihr Rand wird ueber seeUmriss zur
   geschlossenen Catmull-Rom-Kurve DURCH die Griffe (dieselbe Kurve, die ein
   See als Ufer zeichnet), und ringFenster (ui/beschriftung.js) schneidet das
   offene Stueck heraus, dessen Mitte dem Ankerpunkt der Beschriftung am
   naechsten liegt — der Griff behaelt also auch am Ring seine Bedeutung: man
   schiebt ihn das Ufer entlang, und die Schrift wandert mit. Die
   Laufrichtung entscheidet die Sehne des Fensters in glyphenAufKurve, wie
   bei jedem Pfad.

   BEWUSST OFFEN: der Grat eines Gebirges. `gratPunkte` (generators/zeichen.js)
   liefert Kammpunkte MIT Richtung, aber als lose Rasterpunkte — eine Kette
   daraus zu verbinden heisst, unter mehreren Kaemmen, Verzweigungen und
   Luecken den einen Zug zu raten. Ein halber Grat, der falsch verbindet,
   waere schlechter als keiner. Dazu kommt das Datenmodell: `anPfad` verweist
   auf eine `el.id`, und ein Grat IST kein Element — er ist eine Ableitung
   aus dem Hoehenfeld ohne Identitaet, auf die ein gespeicherter Verweis
   zeigen koennte. Solange das so ist, traegt eine Gebirgsbeschriftung ihre
   Kurve am ehesten ueber einen von Hand gezogenen Pfad entlang des Kamms.
   ========================================================================== */

/** Kurze, stabile Signatur der Stuetzpunkte — der Schluessel, an dem die
 *  Beschriftungsschicht erkennt, dass der Pfad sich bewegt hat. Aus den
 *  PUNKTEN, nicht aus den Samples: das sind wenige Zahlen statt hunderter. */
function pfadSignatur(el) {
  var s = String(el.id) + ":";
  for (var i = 0; i < el.points.length; i++) {
    s += Math.round(el.points[i].x * 10) + "," + Math.round(el.points[i].z * 10) + ";";
  }
  return s;
}

/** Element mit dieser id — oder null. Lineare Suche ueber die Elementliste:
 *  eine Karte traegt Hunderte, keine Zehntausende, und ein zweiter Index
 *  waere ein Zustand, der beim Loeschen veralten kann. */
function elementMitId(id) {
  for (var i = 0; i < S.elements.length; i++) if (S.elements[i].id === id) return S.elements[i];
  return null;
}

function kurveAnhaengen(q, anPfad, anker) {
  if (!Number.isFinite(anPfad) || anPfad <= 0) return;
  if (anPfad === q.id) return;                       // nicht an sich selbst
  var el = elementMitId(anPfad | 0);
  if (!el || !el.points) return;
  if (el.kind === "flaeche") {
    if (el.points.length < 3) return;
    // Ring durch die Griffe (siehe Kopfkommentar), Fenster um den Anker.
    var f = ringFenster(seeUmriss(el), anker);
    if (!f) return;
    q.pfad = f.pfad;
    q.pfadStempel = pfadSignatur(el);
    q.lage = f.lage;
    return;
  }
  if (el.kind !== "pfad" || el.points.length < 2) return;
  var sm = pathSamples(el.points, 2.0);
  if (sm.length < 2) return;
  var pfad = [], i;
  for (i = 0; i < sm.length; i++) pfad.push({ x: sm[i].x, z: sm[i].z });
  /* Wo auf dem Pfad die Zeile sitzt, sagt der ANKERPUNKT der Beschriftung:
     der naechstgelegene Samplepunkt gibt seine Bogenlaenge her. Damit behaelt
     der Griff der Beschriftung auch im gebogenen Fall seine Bedeutung — man
     schiebt ihn den Fluss entlang, und die Schrift wandert mit. */
  var best = 0, bd = Infinity;
  for (i = 0; i < sm.length; i++) {
    var dx = sm[i].x - anker.x, dz = sm[i].z - anker.z;
    var d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  q.pfad = pfad;
  q.pfadStempel = pfadSignatur(el);
  q.lage = sm.len > 0 ? clamp(sm[best].s / sm.len, 0, 1) : 0.5;
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

/* Bedienungsrunde: der Setz-Ring ist jetzt eine Gruppe aus drei Teilen —
   dunkler Aussenring (Kontrastsaum, auf hellem Gelaende sonst unsichtbar),
   heller Hauptring (96 statt 64 Segmente, folgt dem Gelaende feiner) und ein
   Mittelpunkt-Kreuz, das die EXAKTE Setzstelle zeigt. Nach aussen bleibt
   `brushRing` dasselbe Objekt mit derselben `visible`-Bedienung. */
var BRUSH_N = 96;
var brushRing = (function () {
  var gruppe = new THREE.Group();
  gruppe.renderOrder = 902;
  gruppe.visible = false;
  function ringLinie(farbe, deckkraft) {
    var g = new THREE.BufferGeometry();
    g.setAttribute("position",
      new THREE.BufferAttribute(new Float32Array((BRUSH_N + 1) * 3), 3));
    var l = new THREE.LineLoop(g, new THREE.LineBasicMaterial({
      color: farbe, transparent: true, opacity: deckkraft, depthTest: false, fog: false
    }));
    l.frustumCulled = false;
    return l;
  }
  var saum = ringLinie(0x1f2823, 0.5);
  saum.renderOrder = 902;
  var ring = ringLinie(0xffffff, 0.92);
  ring.renderOrder = 903;
  // Mittelpunkt: kleines Kreuz aus zwei Linien (4 Segmente als LineSegments).
  var kg = new THREE.BufferGeometry();
  kg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(4 * 3), 3));
  var kern = new THREE.LineSegments(kg, new THREE.LineBasicMaterial({
    color: 0xe0a83c, transparent: true, opacity: 0.95, depthTest: false, fog: false
  }));
  kern.frustumCulled = false;
  kern.renderOrder = 904;
  gruppe.add(saum);
  gruppe.add(ring);
  gruppe.add(kern);
  gruppe.userData = { saum: saum, ring: ring, kern: kern };
  return gruppe;
})();
function updateBrushRing(p, r) {
  if (!p) { brushRing.visible = false; return; }
  var teile = brushRing.userData;
  var arrR = teile.ring.geometry.attributes.position.array;
  var arrS = teile.saum.geometry.attributes.position.array;
  for (var i = 0; i <= BRUSH_N; i++) {
    var a = i / BRUSH_N * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    var x = p.x + ca * r, z = p.z + sa * r;
    var y = heightAt(x, z);
    arrR[i * 3] = x; arrR[i * 3 + 1] = y + 0.35; arrR[i * 3 + 2] = z;
    // Saum knapp AUSSEN und minimal tiefer: er rahmt den hellen Ring.
    var xs = p.x + ca * (r + 0.45), zs = p.z + sa * (r + 0.45);
    arrS[i * 3] = xs; arrS[i * 3 + 1] = heightAt(xs, zs) + 0.3; arrS[i * 3 + 2] = zs;
  }
  teile.ring.geometry.attributes.position.needsUpdate = true;
  teile.saum.geometry.attributes.position.needsUpdate = true;
  // Kreuz an der exakten Setzstelle, mit dem Radius leicht mitwachsend.
  var k = Math.max(0.7, Math.min(2.2, r * 0.12));
  var ky = heightAt(p.x, p.z) + 0.4;
  var arrK = teile.kern.geometry.attributes.position.array;
  arrK[0] = p.x - k; arrK[1] = ky; arrK[2] = p.z;
  arrK[3] = p.x + k; arrK[4] = ky; arrK[5] = p.z;
  arrK[6] = p.x; arrK[7] = ky; arrK[8] = p.z - k;
  arrK[9] = p.x; arrK[10] = ky; arrK[11] = p.z + k;
  teile.kern.geometry.attributes.position.needsUpdate = true;
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

/** Instanz-Treffer -> Element: repack (core/pools.js) schreibt die Instanzen
 *  eines Pools in ELEMENTREIHENFOLGE — der Instanzindex laesst sich also
 *  eindeutig auf das besitzende Element zurueckrechnen. */
function elementVonPoolTreffer(poolName, instanceId) {
  var k = 0;
  for (var e = 0; e < S.elements.length; e++) {
    var a = S.elements[e].inst[poolName];
    if (!a) continue;
    var n = a.length / 12;
    if (instanceId < k + n) return S.elements[e];
    k += n;
  }
  return null;
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
  /* Bedienungsrunde: zusaetzlich die Instanz-Pools — ein Klick AUF ein Haus
     oder einen Baum soll dessen Element treffen, nicht erst ein Klick in die
     Naehe seines unsichtbaren Streuzentrums. Ausgenommen: Kartenzeichen
     (Tinte, kein Gegenstand) und Kleinstpools wie das Fensterlicht. */
  var poolMeshes = [], poolNamen = [];
  for (var pn = 0; pn < POOL_NAMES.length; pn++) {
    var P = POOLS[POOL_NAMES[pn]];
    if (!P || !P.mesh || !P.count || P.karte || P.radius < 0.4) continue;
    poolMeshes.push(P.mesh);
    poolNamen.push(POOL_NAMES[pn]);
  }
  if (meshes.length || poolMeshes.length) {
    raycaster.setFromCamera(_ndc, camera);
    var hits = raycaster.intersectObjects(meshes.concat(poolMeshes), true);
    for (var h = 0; h < hits.length; h++) {
      var o = hits[h].object;
      if (o.userData && o.userData.el) return o.userData.el;
      if (hits[h].instanceId !== undefined) {
        var pi = poolMeshes.indexOf(o);
        if (pi >= 0) {
          var et = elementVonPoolTreffer(poolNamen[pi], hits[h].instanceId);
          if (et) return et;
        }
      }
    }
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
  getMarkerAuswahl, auswahlRahmen, rebuildAuswahlRahmen,
  beschriftungenAktualisieren };
