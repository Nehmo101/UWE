// Zeichnbare, animierte Steampunk-Flugrouten ueber dem Gelaende.
import * as THREE from 'three';
import { clamp } from '../core/rng.js';
import { S, WATER, groupOf } from '../core/store.js';
import { POOLS } from '../core/pools.js';
import { heightAt } from '../world/terrain.js';
import { pathSamples } from './paths.js';
import { STEAMPUNK_FRAKTIONEN } from '../assets/steampunk-luftflotte.js';

var FRAKTIONEN = new Set(STEAMPUNK_FRAKTIONEN.map(function (f) { return f.id; }));

/* Die Route ist Orientierung, nicht das lauteste Objekt der Szene. Fraktions-
   tints und eine ruhige Strichelung lesen sich wie Luftkorridore, ohne das
   Wolkenmeer mit technischen weissen Spaghetti zu ueberziehen. */
var ROUTEN_FARBEN = Object.freeze({
  menschenbund: 0xb8d4d2,
  mondelfen: 0xd2c9e5,
  tiefenzwerge: 0xd2aa6b,
  goblinzunft: 0xa7c77b,
  orklegion: 0xc28a73
});
var routenMats = Object.create(null);
var bojenMats = Object.create(null);

function routenMaterial(fraktion) {
  var id = FRAKTIONEN.has(fraktion) ? fraktion : 'menschenbund';
  if (!routenMats[id]) {
    routenMats[id] = new THREE.LineDashedMaterial({
      color: ROUTEN_FARBEN[id], transparent: true, opacity: 0.36,
      dashSize: 3.6, gapSize: 2.4, scale: 1,
      depthTest: true, depthWrite: false, fog: true
    });
  }
  return routenMats[id];
}

function bojenMaterial(fraktion) {
  var id = FRAKTIONEN.has(fraktion) ? fraktion : 'menschenbund';
  if (!bojenMats[id]) {
    bojenMats[id] = new THREE.MeshBasicMaterial({
      color: ROUTEN_FARBEN[id], transparent: true, opacity: 0.58,
      depthTest: true, depthWrite: false, fog: true
    });
  }
  return bojenMats[id];
}

export function flugroutePoolId(fraktion, typ) {
  var f = FRAKTIONEN.has(fraktion) ? fraktion : 'menschenbund';
  var t = typ === 'zug' ? 'luftzug' : 'luftschiff';
  return t + '_' + f;
}

function sichereZahl(v, fallback, min, max) {
  return Number.isFinite(v) ? clamp(v, min, max) : fallback;
}

/** 3D-Polylinie mit gleichmaessiger Bodenfreiheit und geglaetteter Hoehe. */
export function flugroutePunkte(el) {
  if (!el || !el.points || el.points.length < 2) return [];
  var hoehe = sichereZahl(el.params && el.params.hoehe, 55, 18, 180);
  var sm = pathSamples(el.points, 5);
  if (sm.length < 2) return [];
  var y = [], i, pass;
  for (i = 0; i < sm.length; i++) {
    y.push(Math.max(heightAt(sm[i].x, sm[i].z), WATER) + hoehe);
  }
  /* Zwei milde Glaettungen verhindern harte Nickbewegungen ueber Bergspitzen,
     ohne die garantierte Mindestfreiheit aufzugeben. */
  for (pass = 0; pass < 2; pass++) {
    var alt = y.slice();
    for (i = 1; i < y.length - 1; i++) {
      var ziel = (alt[i - 1] + alt[i] * 2 + alt[i + 1]) * 0.25;
      y[i] = Math.max(Math.max(heightAt(sm[i].x, sm[i].z), WATER) + hoehe, ziel);
    }
  }
  var out = [];
  out.laengen = [0];
  out.gesamt = 0;
  for (i = 0; i < sm.length; i++) {
    var v = new THREE.Vector3(sm[i].x, y[i], sm[i].z);
    if (i) {
      out.gesamt += v.distanceTo(out[i - 1]);
      out.laengen.push(out.gesamt);
    }
    out.push(v);
  }
  return out;
}

/** Interpolierte Position und Tangente bei einer Bogenlaenge. */
export function positionAufFlugroute(route, distanz, ziel, tangente) {
  ziel = ziel || new THREE.Vector3();
  tangente = tangente || new THREE.Vector3();
  if (!route || route.length < 2 || !(route.gesamt > 0)) {
    ziel.set(0, 0, 0); tangente.set(0, 0, 1);
    return { position: ziel, tangente: tangente };
  }
  var d = ((distanz % route.gesamt) + route.gesamt) % route.gesamt;
  var i = 1;
  while (i < route.laengen.length - 1 && route.laengen[i] < d) i++;
  var a = route[i - 1], b = route[i];
  var l0 = route.laengen[i - 1], l1 = route.laengen[i];
  var t = l1 > l0 ? (d - l0) / (l1 - l0) : 0;
  ziel.copy(a).lerp(b, t);
  tangente.copy(b).sub(a).normalize();
  return { position: ziel, tangente: tangente };
}

function baueRoutenlinie(el, route, gruppe) {
  if (el.params && el.params.routeSichtbar === false) return;
  var geo = new THREE.BufferGeometry().setFromPoints(route);
  var line = new THREE.Line(geo, routenMaterial(el.params && el.params.fraktion));
  line.computeLineDistances();
  line.userData.el = el;
  line.renderOrder = 22;
  gruppe.add(line);
}

function naechsterRoutenpunkt(route, punkt) {
  var best = route[0], bd = Infinity;
  for (var i = 0; i < route.length; i++) {
    var d = Math.hypot(route[i].x - punkt.x, route[i].z - punkt.z);
    if (d < bd) { bd = d; best = route[i]; }
  }
  return best;
}

function baueBojen(el, route, gruppe) {
  if (el.params && el.params.stationen === false) return;
  var geo = new THREE.TorusGeometry(2.05, 0.08, 5, 18);
  var ringe = new THREE.InstancedMesh(
    geo, bojenMaterial(el.params && el.params.fraktion), el.points.length);
  var dummy = new THREE.Object3D();
  for (var i = 0; i < el.points.length; i++) {
    var p = naechsterRoutenpunkt(route, el.points[i]);
    dummy.position.copy(p);
    var vor = route[Math.min(route.length - 1, route.indexOf(p) + 1)];
    dummy.lookAt(vor);
    dummy.updateMatrix();
    ringe.setMatrixAt(i, dummy.matrix);
  }
  ringe.count = el.points.length;
  ringe.instanceMatrix.needsUpdate = true;
  ringe.userData.el = el;
  ringe.renderOrder = 23;
  gruppe.add(ringe);
}

function fahrzeugTyp(params, index) {
  if (params.fahrzeug === 'zug') return 'zug';
  if (params.fahrzeug === 'schiff') return 'schiff';
  return index % 2 ? 'zug' : 'schiff';
}

function baueFahrzeuge(el, route, gruppe) {
  var params = el.params || {};
  var n = Math.round(sichereZahl(params.verkehr, 3, 1, 8));
  var fahrzeuge = [];
  var nachTyp = { schiff: [], zug: [] };
  for (var i = 0; i < n; i++) {
    var typ = fahrzeugTyp(params, i);
    var id = flugroutePoolId(params.fraktion, typ);
    var pool = POOLS[id];
    if (!pool || !pool.geo || !pool.mat) continue;
    /* Logisches Fahrzeug bleibt ein Object3D, wird aber nicht der Szene
       hinzugefuegt. So bleiben Position/Rotation/userData fuer Tests,
       Diagnose und bestehende Aufrufer erhalten, waehrend nur die unten
       gebauten InstancedMeshes gerendert werden. */
    var fahrzeug = new THREE.Object3D();
    fahrzeug.userData.el = el;
    fahrzeug.userData.flugroute = {
      phase: i / n, richtung: i % 3 === 2 ? -1 : 1, typ: typ
    };
    fahrzeug.scale.setScalar(typ === 'zug' ? 1.02 : 1.18);
    fahrzeuge.push(fahrzeug);
    nachTyp[typ].push(fahrzeug);
  }

  var batches = [];
  ['schiff', 'zug'].forEach(function (typ) {
    var instanzen = nachTyp[typ];
    if (!instanzen.length) return;
    var id = flugroutePoolId(params.fraktion, typ);
    var pool = POOLS[id];
    var geo = pool.geo.clone();
    geo.boundingSphere = null;
    geo.computeBoundingSphere();
    var batch = new THREE.InstancedMesh(geo, pool.mat, instanzen.length);
    batch.count = instanzen.length;
    batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    batch.userData.el = el;
    batch.userData.flugroute = { typ: typ, fahrzeuge: instanzen };
    batch.castShadow = true;
    /* Die Fahrzeuge laufen ueber die ganze Route. Eine statische lokale
       Huelle um das Ursprungsasset duerfte sie am Kartenrand ausblenden. */
    batch.frustumCulled = false;
    gruppe.add(batch);
    batches.push(batch);
  });
  return { fahrzeuge: fahrzeuge, batches: batches };
}

var _pos = new THREE.Vector3();
var _tan = new THREE.Vector3();

function setzeFahrzeug(mesh, route, zeit, tempo) {
  var f = mesh.userData.flugroute;
  var weg = f.phase * route.gesamt + f.richtung * zeit * tempo * 9;
  positionAufFlugroute(route, weg, _pos, _tan);
  mesh.position.copy(_pos);
  mesh.position.y += Math.sin(zeit * 0.72 + f.phase * Math.PI * 2) * 0.42;
  var yaw = Math.atan2(_tan.x * f.richtung, _tan.z * f.richtung);
  var horizontal = Math.hypot(_tan.x, _tan.z) || 1;
  var pitch = -Math.atan2(_tan.y * f.richtung, horizontal);
  var roll = f.typ === 'zug' ? 0 : Math.sin(zeit * 0.38 + f.phase * 7) * 0.025;
  mesh.rotation.set(pitch, yaw, roll, 'YXZ');
}

function aktualisiereBatches(batches) {
  for (var i = 0; i < batches.length; i++) {
    var batch = batches[i];
    var fahrzeuge = batch.userData.flugroute.fahrzeuge;
    for (var k = 0; k < fahrzeuge.length; k++) {
      fahrzeuge[k].updateMatrix();
      batch.setMatrixAt(k, fahrzeuge[k].matrix);
    }
    batch.instanceMatrix.needsUpdate = true;
  }
}

/** Baut Linie, Luftbojen und die bewegten Fahrzeuge eines Pfadelements. */
export function genFlugroute(el) {
  var route = flugroutePunkte(el);
  if (route.length < 2) return null;
  var gruppe = groupOf(el);
  baueRoutenlinie(el, route, gruppe);
  baueBojen(el, route, gruppe);
  var gebaut = baueFahrzeuge(el, route, gruppe);
  var data = {
    route: route,
    fahrzeuge: gebaut.fahrzeuge,
    batches: gebaut.batches
  };
  el.flugroute = data;
  var tempo = sichereZahl(el.params && el.params.geschwindigkeit, 0.75, 0.15, 2.5);
  for (var i = 0; i < data.fahrzeuge.length; i++) {
    setzeFahrzeug(data.fahrzeuge[i], route, 0, tempo);
  }
  aktualisiereBatches(data.batches);
  return data;
}

/** Frame-Takt; scannt nur die wenigen Pfade der Karte und haelt keinen Index. */
export function tickFlugrouten(zeit) {
  var bewegt = 0;
  for (var i = 0; i < S.elements.length; i++) {
    var el = S.elements[i];
    if (el.kind !== 'pfad' || el.variant !== 'flugroute' || !el.flugroute) continue;
    var data = el.flugroute;
    var tempo = sichereZahl(el.params && el.params.geschwindigkeit, 0.75, 0.15, 2.5);
    for (var k = 0; k < data.fahrzeuge.length; k++) {
      setzeFahrzeug(data.fahrzeuge[k], data.route, zeit, tempo);
      bewegt++;
    }
    aktualisiereBatches(data.batches || []);
  }
  return bewegt;
}
