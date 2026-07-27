// InstancedMesh-Pools, Instanz-Emission, Kontaktschatten und Dirty-Packen.
import * as THREE from 'three';
import { lerp, sstep } from '../core/rng.js';
import { S, sceneRef, MAX_INST_PER_EL, KARTE } from '../core/store.js';
import { terraMat, tintedMats } from '../render/materials.js';
import { TEX } from '../render/textures.js';
import { heightAt, normalAt } from '../world/terrain.js';

/**
 * Dunkelt die Vertexfarben eines Objekts nach unten ab. Ohne
 * Umgebungsverdeckung kleben Objekte sonst wertgleich auf dem Boden —
 * dieser Verlauf setzt sie ab und bringt Tiefe in die Fläche.
 */
function shadeVertical(geo, strength) {
  geo.computeBoundingBox();
  var y0 = geo.boundingBox.min.y, y1 = geo.boundingBox.max.y;
  if (y1 - y0 < 1e-4) return geo;
  var pos = geo.attributes.position, col = geo.attributes.color;
  for (var i = 0; i < pos.count; i++) {
    var t = (pos.getY(i) - y0) / (y1 - y0);
    // unten abdunkeln, oben leicht ueber Grundton aufhellen — Firste, Kronen
    // und Spitzen werden heller als ihre Basis (gemalte Hintergruende tun das
    // durchgehend, und es kostet nichts)
    var f = lerp(1 - strength, 1, sstep(0, 0.6, t)) * (1 + sstep(0.72, 1, t) * 0.10);
    col.setXYZ(i, col.getX(i) * f, col.getY(i) * f, col.getZ(i) * f);
  }
  col.needsUpdate = true;
  return geo;
}

function Pool(name, geo, opts) {
  this.name = name;
  this.geo = geo;
  this.radius = opts.radius;
  this.mat = terraMat({
    vertexColors: true,
    side: opts.dbl ? THREE.DoubleSide : THREE.FrontSide,
    transparent: !!opts.transparent,
    opacity: opts.opacity === undefined ? 1 : opts.opacity,
    map: opts.map || null,
    alphaTest: opts.alphaTest || 0,
    familie: opts.familie || 'holz',
    wind: opts.wind || null,
    emissive: opts.emissive || 0x000000
  });
  if (opts.emissiveIntensity !== undefined) this.mat.emissiveIntensity = opts.emissiveIntensity;
  tintedMats.push(this.mat);
  this.cap = 0;
  this.mesh = null;
  this.count = 0;
}
Pool.prototype.ensure = function (n) {
  if (n <= this.cap) return;
  var cap = Math.max(256, this.cap * 2, Math.ceil(n * 1.35));
  if (this.mesh) { sceneRef.scene.remove(this.mesh); this.mesh.dispose(); }
  var m = new THREE.InstancedMesh(this.geo, this.mat, cap);
  m.frustumCulled = true;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
  m.instanceColor.setUsage(THREE.DynamicDrawUsage);
  m.count = 0;
  sceneRef.scene.add(m);
  this.mesh = m;
  this.cap = cap;
};

var POOLS = {};

/* --- Huellkugel der Pool-Geometrien (H1b) -------------------------------
   Pool-Geometrien sind Einheitsformen im Ursprung; ihre Instanzen liegen
   ueber der ganzen Karte. Three.js kullt InstancedMeshes ueber die
   Geometrie-Huellkugel, deshalb wird sie hier bewusst auf Kartengroesse
   aufgeblasen — sonst verschwaende der Culling-Test korrekte Instanzen.

   Radius 460 war auf die 256er-Karte kalibriert (halbe Kartendiagonale 181
   plus reichlich Reserve nach oben fuer Ranken, Plateaus und Schwebeinseln,
   Mittelpunkt deshalb bei y = 60). Er waechst jetzt proportional zur
   Kantenlaenge mit: bei map = 256 kommt exakt 460 heraus, das Verhalten der
   Standardkarte bleibt unveraendert. Eine zu grosse Kugel kostet nur
   Culling-Wirkung, eine zu kleine verwirft Sichtbares — deshalb lieber
   grosszuegig skalieren als knapp rechnen. */
var huellenGeos = [];
function huellenRadius() { return 460 * (KARTE.map / 256); }
/** Hüllkugel über die ganze Karte: Culling verwirft korrekt statt falsch. */
function weiteHuelle(geo) {
  geo.computeBoundingSphere();
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 60, 0), huellenRadius());
  if (huellenGeos.indexOf(geo) < 0) huellenGeos.push(geo);
  return geo;
}
/** Nach einem Wechsel der Kartengroesse alle Huellkugeln nachziehen. */
function weiteHuellenNeu() {
  var r = huellenRadius();
  for (var i = 0; i < huellenGeos.length; i++) huellenGeos[i].boundingSphere.radius = r;
}
function definePool(name, geo, opts) {
  opts = opts || {};
  shadeVertical(geo, opts.ao === undefined ? 0.3 : opts.ao);
  weiteHuelle(geo);
  POOLS[name] = new Pool(name, geo, opts);
}

var POOL_NAMES = [];
function setPoolNames() { POOL_NAMES.length = 0; Object.keys(POOLS).forEach(function (k) { POOL_NAMES.push(k); }); }

/*  x, y, z, pitch, yaw, roll, sx, sy, sz, tintR, tintG, tintB              */

var _schattenN = new THREE.Vector3();
function emit(el, pool, x, y, z, yaw, sx, sy, sz, tint, pitch, roll) {
  var a = el.inst[pool];
  if (!a) { a = el.inst[pool] = []; }
  if (el.total >= MAX_INST_PER_EL) return;
  el.total++;
  a.push(x, y, z, pitch || 0, yaw || 0, roll || 0, sx, sy, sz,
    tint ? tint[0] : 1, tint ? tint[1] : 1, tint ? tint[2] : 1);
  // Kontaktschatten nur für bodenständige Objekte mit nennenswerter Grundfläche
  var r = POOLS[pool] ? POOLS[pool].radius : 0;
  if (r < 0.6) return;
  var bh = heightAt(x, z);
  if (Math.abs(y - bh) > 2.2) return;                 // z. B. Häuser auf Plateaus
  schattenAn(el, x, bh, z, r * sx * 1.6);
}
/** Legt einen an die Hangneigung angepassten Schattenfleck ab. */
function schattenAn(el, x, bh, z, groesse) {
  normalAt(x, z, _schattenN);
  el.schatten.push(x, bh + 0.06, z, groesse,
    _schattenN.x, _schattenN.y, _schattenN.z);
}
/** Merkt sich Schornsteine, aus denen später Rauch steigt. */
function rauchAus(el, kind, x, y, z, sc) {
  if (el.rauch.length > 60) return;
  if (kind === "industrie") el.rauch.push(x - 1.3 * sc, y + 6.3 * sc, z + 0.6 * sc);
  else if (kind === "schmiedeturm") el.rauch.push(x + 1.0 * sc, y + 6.5 * sc, z + 0.3 * sc);
  else if (kind === "zwergenhalle") el.rauch.push(x, y + 4.2 * sc, z);
}

/** Leichte, deterministische Farbvariation (±amt, plus winziger Farbdreh). */
function tintOf(rng, amt) {
  if (amt === undefined) amt = 0.06;
  var d = (rng() * 2 - 1) * amt, w = (rng() * 2 - 1) * amt * 0.5;
  return [1 + d + w, 1 + d, 1 + d - w * 0.6];
}

var _io = new THREE.Object3D();
_io.rotation.order = "YXZ";
var _ic = new THREE.Color();
var instanceTotal = 0;

/** Schreibt die Instanzen der genannten Pools neu (einmal pro Frame bei Bedarf). */
function repack(names) {
  for (var p = 0; p < names.length; p++) {
    var name = names[p], pool = POOLS[name], total = 0, e;
    if (!pool) continue;
    for (e = 0; e < S.elements.length; e++) {
      var arr = S.elements[e].inst[name];
      if (arr) total += arr.length / 12;
    }
    if (total === 0) { if (pool.mesh) pool.mesh.count = 0; pool.count = 0; continue; }
    pool.ensure(total);
    var mesh = pool.mesh, k = 0;
    for (e = 0; e < S.elements.length; e++) {
      var a = S.elements[e].inst[name];
      if (!a) continue;
      for (var i = 0; i < a.length; i += 12) {
        _io.position.set(a[i], a[i + 1], a[i + 2]);
        _io.rotation.set(a[i + 3], a[i + 4], a[i + 5], "YXZ");
        _io.scale.set(a[i + 6], a[i + 7], a[i + 8]);
        _io.updateMatrix();
        mesh.setMatrixAt(k, _io.matrix);
        _ic.setRGB(a[i + 9], a[i + 10], a[i + 11]);
        mesh.setColorAt(k, _ic);
        k++;
      }
    }
    mesh.count = k;
    pool.count = k;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  instanceTotal = 0;
  for (var q = 0; q < POOL_NAMES.length; q++) instanceTotal += POOLS[POOL_NAMES[q]].count;
}

/* --- Kontaktschatten: eine InstancedMesh für die ganze Karte ---------- */
var schattenGeo = weiteHuelle(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
var schattenMat = new THREE.MeshBasicMaterial({
  map: TEX.shadowBlob, color: 0x2b2318, transparent: true,
  depthWrite: false, side: THREE.DoubleSide, opacity: 0.45
});
var schattenMesh = null, schattenCap = 0, schattenAnzahl = 0;
var _schObj = new THREE.Object3D(), _schQ = new THREE.Quaternion();
var _schUp = new THREE.Vector3(0, 1, 0), _schV = new THREE.Vector3();
function schattenEnsure(n) {
  if (n <= schattenCap) return;
  var cap = Math.max(512, schattenCap * 2, Math.ceil(n * 1.35));
  if (schattenMesh) { sceneRef.scene.remove(schattenMesh); schattenMesh.dispose(); }
  schattenMesh = new THREE.InstancedMesh(schattenGeo, schattenMat, cap);
  schattenMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  schattenMesh.renderOrder = 1;
  schattenMesh.count = 0;
  sceneRef.scene.add(schattenMesh);
  schattenCap = cap;
}
function packSchatten() {
  var total = 0, e;
  for (e = 0; e < S.elements.length; e++) total += S.elements[e].schatten.length / 7;
  schattenAnzahl = total;
  if (total === 0) { if (schattenMesh) schattenMesh.count = 0; return; }
  schattenEnsure(total);
  var k = 0;
  for (e = 0; e < S.elements.length; e++) {
    var sa = S.elements[e].schatten;
    for (var i = 0; i < sa.length; i += 7) {
      _schV.set(sa[i + 4], sa[i + 5], sa[i + 6]);
      _schQ.setFromUnitVectors(_schUp, _schV);
      _schObj.position.set(sa[i], sa[i + 1], sa[i + 2]);
      _schObj.quaternion.copy(_schQ);
      _schObj.scale.set(sa[i + 3], 1, sa[i + 3]);
      _schObj.updateMatrix();
      schattenMesh.setMatrixAt(k++, _schObj.matrix);
    }
  }
  schattenMesh.count = k;
  schattenMesh.instanceMatrix.needsUpdate = true;
}

var packAll = false, packSet = null;
/** names weglassen = alle Pools neu schreiben. */
function markDirty(names) {
  if (!names) { packAll = true; return; }
  if (!packSet) packSet = {};
  for (var i = 0; i < names.length; i++) packSet[names[i]] = 1;
}
function flushPack() {
  if (!packAll && !packSet) return;
  repack(packAll ? POOL_NAMES : Object.keys(packSet));
  packAll = false; packSet = null;
  var punkte = [];
  for (var e = 0; e < S.elements.length; e++) {
    var r = S.elements[e].rauch;
    for (var i = 0; i < r.length; i++) punkte.push(r[i]);
  }
  if (rauchSammler) rauchSammler(punkte);
  packSchatten();
}
var rauchSammler = null;
function setRauchSammler(fn) { rauchSammler = fn; }


export { Pool, POOLS, POOL_NAMES, setPoolNames, weiteHuelle, weiteHuellenNeu, definePool, emit, schattenAn,
  rauchAus, tintOf, repack, instanceTotal, schattenMat, schattenAnzahl, packSchatten,
  markDirty, flushPack, setRauchSammler };
