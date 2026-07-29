// Kleine, erzählerische Bewegungsschicht für bewohnte Orte und die
// Weltschildkröte. Alle Figuren, Falter und Fahnen teilen je Typ genau einen
// Instanz-Puffer: vier zusätzliche Draw Calls, unabhängig von der Zahl der
// Siedlungen. Positionen sind vollständig aus Element-Seed und Geometrie
// abgeleitet; ein Speichern/Laden würfelt die Szene deshalb nicht neu.
import * as THREE from 'three';
import { clamp, rngOf, rr } from '../core/rng.js';
import { S } from '../core/store.js';
import { heightAt, hoehenVersion } from './terrain.js';
import { camera } from '../editor/camera.js';

const MAX_ANKER = 10;
const MAX_BEWOHNER = 48;
const MAX_FALTER = 64;
const MAX_FAHNEN = 20;

const FIGUR_FARBEN = [
  0x5c6f68, 0x8d584b, 0xb1884f, 0x597488, 0x725d78, 0x65794d
];
const FALTER_FARBEN = [
  0xf2b85b, 0xd98974, 0x79a5a2, 0xe5cf75, 0xb98bb0, 0xf0e2b2
];
const FAHNEN_FARBEN = [
  0xc76850, 0x547f83, 0xd0a24f, 0x7d6684, 0x6f8c58, 0xb66c69
];

function mittelpunkt(points) {
  var x = 0, z = 0;
  for (var i = 0; i < points.length; i++) {
    x += Number(points[i].x) || 0;
    z += Number(points[i].z) || 0;
  }
  return { x: x / points.length, z: z / points.length };
}

function ausdehnung(points, mitte) {
  var summe = 0;
  for (var i = 0; i < points.length; i++) {
    var dx = points[i].x - mitte.x, dz = points[i].z - mitte.z;
    summe += dx * dx + dz * dz;
  }
  return clamp(Math.sqrt(summe / points.length), 8, 32);
}

function basisSeed(el, zusatz) {
  var seed = Number(el.seed);
  if (!Number.isFinite(seed)) seed = Number(el.id) || 1;
  return (seed ^ Math.imul(zusatz + 1, 0x9e3779b9)) | 0;
}

/**
 * Reine Ableitung der Orte, an denen Leben sinnvoll ist. Bewusst keine
 * einzelnen Häuser scannen: ein Viertel ist bereits die semantische Aussage
 * „hier leben Leute“, während hunderte Architekturinstanzen das Budget nur
 * mehrfach auf denselben Platz legen würden.
 */
function weltlebenAnker(elements) {
  var out = [];
  for (var i = 0; i < elements.length && out.length < MAX_ANKER; i++) {
    var el = elements[i], points = el && Array.isArray(el.points) ? el.points : [];
    if (!points.length) continue;
    if (el.kind === 'flaeche' && el.variant === 'viertel' && points.length >= 3) {
      var m = mittelpunkt(points);
      out.push({
        typ: 'siedlung',
        x: m.x,
        z: m.z,
        radius: ausdehnung(points, m),
        seed: basisSeed(el, 17),
        groesse: 1,
        drehung: 0
      });
      continue;
    }
    if (el.kind === 'objekt' && el.variant === 'weltschildkroete') {
      var p = el.params || {};
      for (var q = 0; q < points.length && out.length < MAX_ANKER; q++) {
        out.push({
          typ: 'schildkroete',
          x: Number(points[q].x) || 0,
          z: Number(points[q].z) || 0,
          radius: 18 * clamp(Number(p.groesse) || 1, 0.55, 2.2),
          seed: basisSeed(el, q + 101),
          groesse: clamp(Number(p.groesse) || 1, 0.55, 2.2),
          drehung: (Number(p.drehung) || 0) * Math.PI / 180
        });
      }
    }
  }
  return out;
}

function ankerSignatur(anker) {
  var teile = [hoehenVersion];
  for (var i = 0; i < anker.length; i++) {
    var a = anker[i];
    teile.push(a.typ, a.x.toFixed(3), a.z.toFixed(3), a.radius.toFixed(3),
      a.seed, a.groesse.toFixed(3), a.drehung.toFixed(3));
  }
  return teile.join('|');
}

function figurGeometrie() {
  // Körper, runder Kopf und ein asymmetrischer Hut in einer flachen,
  // kameraseitigen Silhouette. Bei Kartenmaßstab liest man erst Bewegung und
  // Farbe; zu viel Anatomie wäre nur flimmernde Geometrie.
  var pos = [
    -0.20, 0, 0,  0.20, 0, 0,  0.27, 0.78, 0, -0.27, 0.78, 0,
    -0.22, 0.78, 0, 0.22, 0.78, 0, 0.18, 1.17, 0, -0.18, 1.17, 0,
    -0.17, 1.14, 0, 0.17, 1.14, 0, 0.14, 1.43, 0, -0.14, 1.43, 0,
    -0.31, 1.42, 0, 0.18, 1.42, 0, -0.04, 1.69, 0
  ];
  var idx = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7,
    8, 9, 10, 8, 10, 11, 12, 13, 14];
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function falterGeometrie() {
  var pos = [
    0, 0, 0, -0.92, 0.48, 0, -0.50, -0.38, 0,
    0, 0, 0, 0.92, 0.48, 0, 0.50, -0.38, 0,
    -0.07, -0.36, 0.02, 0.07, -0.36, 0.02, 0.05, 0.42, 0.02,
    -0.07, -0.36, 0.02, 0.05, 0.42, 0.02, -0.05, 0.42, 0.02
  ];
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  g.computeVertexNormals();
  return g;
}

function fahnenGeometrie() {
  // Dreigeteilte, leicht gezackte Stoffkante. Die ganze Fahne schwingt sehr
  // klein; die Staffelung der Segmente verhindert das starre Rechteck.
  var pos = [
    0, 0, 0, 0, 1, 0, 0.72, 0.92, 0, 0.72, 0.08, 0,
    1.42, 0.78, 0, 1.42, 0.16, 0, 2.0, 0.55, 0
  ];
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex([0, 2, 3, 0, 1, 2, 3, 2, 4, 3, 4, 5, 5, 4, 6]);
  g.computeVertexNormals();
  return g;
}

var figurMat = new THREE.MeshLambertMaterial({
  color: 0xffffff, side: THREE.DoubleSide
});
var falterMat = new THREE.MeshBasicMaterial({
  color: 0xffffff, side: THREE.DoubleSide
});
var fahnenMat = new THREE.MeshLambertMaterial({
  color: 0xffffff, side: THREE.DoubleSide
});
var mastMat = new THREE.MeshLambertMaterial({ color: 0x69503a });

var figurMesh = new THREE.InstancedMesh(figurGeometrie(), figurMat, MAX_BEWOHNER);
var falterMesh = new THREE.InstancedMesh(falterGeometrie(), falterMat, MAX_FALTER);
var fahnenMesh = new THREE.InstancedMesh(fahnenGeometrie(), fahnenMat, MAX_FAHNEN);
var mastMesh = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(0.055, 0.075, 1, 6), mastMat, MAX_FAHNEN);

var dynamischeMeshes = [figurMesh, falterMesh, fahnenMesh];
for (var dm = 0; dm < dynamischeMeshes.length; dm++) {
  dynamischeMeshes[dm].frustumCulled = false;
  dynamischeMeshes[dm].instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  dynamischeMeshes[dm].count = 0;
}
mastMesh.frustumCulled = false;
mastMesh.count = 0;
falterMesh.renderOrder = 4;

var bewohner = [], falter = [], fahnen = [];
var ankerCache = [], signatur = '', naechsterAbgleich = 0;
var farbe = new THREE.Color();
var figurObj = new THREE.Object3D();
var falterObj = new THREE.Object3D();
var fahnenObj = new THREE.Object3D();
var mastObj = new THREE.Object3D();

function setzeFarbe(mesh, index, hex) {
  farbe.set(hex);
  mesh.setColorAt(index, farbe);
}

function baueBewohner(a, rng) {
  var n = a.typ === 'schildkroete' ? 3 : 5;
  for (var i = 0; i < n && bewohner.length < MAX_BEWOHNER; i++) {
    bewohner.push({
      anker: a,
      phase: rng() * Math.PI * 2,
      bahn: rr(rng, a.radius * 0.16, a.radius * 0.43),
      tempo: rr(rng, 0.018, 0.038) * (rng() < 0.5 ? -1 : 1),
      seite: rr(rng, 0.55, 1.0),
      skala: rr(rng, 1.05, 1.48),
      neigung: rr(rng, -0.04, 0.04),
      farbe: FIGUR_FARBEN[Math.floor(rng() * FIGUR_FARBEN.length)]
    });
  }
}

function baueFalter(a, rng) {
  var n = a.typ === 'schildkroete' ? 9 : 5;
  for (var i = 0; i < n && falter.length < MAX_FALTER; i++) {
    var r = rr(rng, a.radius * 0.22, a.radius * 0.72);
    var ph = rng() * Math.PI * 2;
    var x = a.x + Math.cos(ph) * r, z = a.z + Math.sin(ph) * r;
    falter.push({
      anker: a,
      phase: ph,
      bahn: r,
      tempo: rr(rng, 0.09, 0.22) * (rng() < 0.5 ? -1 : 1),
      hoehe: rr(rng, 1.0, a.typ === 'schildkroete' ? 4.2 : 3.2),
      boden: heightAt(x, z),
      skala: rr(rng, 0.42, 0.78),
      farbe: FALTER_FARBEN[Math.floor(rng() * FALTER_FARBEN.length)]
    });
  }
}

function fahneAn(a, rng, winkel, zweite) {
  if (fahnen.length >= MAX_FAHNEN) return;
  var schild = a.typ === 'schildkroete';
  var r = schild ? 0 : a.radius * (zweite ? 0.52 : 0.34);
  var x = a.x + Math.cos(winkel) * r, z = a.z + Math.sin(winkel) * r;
  var skala = schild ? a.groesse * 1.05 : rr(rng, 0.95, 1.25);
  if (schild) {
    // Auf dem zentralen Burgturm statt mitten durch die Kuppel: derselbe
    // lokale Versatz wie der Turm in weltschildkroete.js, mit der Landmarke
    // mitgedreht.
    var lx = 0.8 * a.groesse, lz = -0.5 * a.groesse;
    x += Math.cos(a.drehung) * lx + Math.sin(a.drehung) * lz;
    z += -Math.sin(a.drehung) * lx + Math.cos(a.drehung) * lz;
  }
  var boden = heightAt(x, z);
  fahnen.push({
    x: x,
    z: z,
    y: schild ? boden + 14.0 * a.groesse : boden + 0.05,
    yaw: schild ? a.drehung + Math.PI * 0.5 : winkel + Math.PI * 0.5,
    hoehe: (schild ? 3.6 : rr(rng, 3.4, 4.5)) * skala,
    skala: skala,
    phase: rng() * Math.PI * 2,
    farbe: FAHNEN_FARBEN[Math.floor(rng() * FAHNEN_FARBEN.length)]
  });
}

function baueFahnen(a, rng) {
  var winkel = rng() * Math.PI * 2;
  fahneAn(a, rng, winkel, false);
  if (a.typ === 'siedlung' && a.radius > 14) {
    fahneAn(a, rng, winkel + Math.PI * rr(rng, 0.62, 1.22), true);
  }
}

function verwerfeLeben() {
  bewohner.length = 0;
  falter.length = 0;
  fahnen.length = 0;
}

function erneuereLeben(neueAnker, neueSignatur) {
  verwerfeLeben();
  ankerCache = neueAnker;
  signatur = neueSignatur;
  for (var i = 0; i < ankerCache.length; i++) {
    var a = ankerCache[i], rng = rngOf(a.seed);
    baueBewohner(a, rng);
    baueFalter(a, rng);
    baueFahnen(a, rng);
  }

  mastMesh.count = fahnen.length;
  fahnenMesh.count = fahnen.length;
  for (var f = 0; f < fahnen.length; f++) {
    var flag = fahnen[f];
    mastObj.position.set(flag.x, flag.y + flag.hoehe * 0.5, flag.z);
    mastObj.rotation.set(0, 0, 0);
    mastObj.scale.set(flag.skala, flag.hoehe, flag.skala);
    mastObj.updateMatrix();
    mastMesh.setMatrixAt(f, mastObj.matrix);
    setzeFarbe(fahnenMesh, f, flag.farbe);
  }
  mastMesh.instanceMatrix.needsUpdate = true;
  if (fahnenMesh.instanceColor) fahnenMesh.instanceColor.needsUpdate = true;

  figurMesh.count = bewohner.length;
  falterMesh.count = falter.length;
  for (var b = 0; b < bewohner.length; b++) setzeFarbe(figurMesh, b, bewohner[b].farbe);
  for (var k = 0; k < falter.length; k++) setzeFarbe(falterMesh, k, falter[k].farbe);
  if (figurMesh.instanceColor) figurMesh.instanceColor.needsUpdate = true;
  if (falterMesh.instanceColor) falterMesh.instanceColor.needsUpdate = true;
}

function reduzierteBewegung() {
  if (typeof document !== 'undefined' && document.documentElement &&
      typeof document.documentElement.getAttribute === 'function' &&
      document.documentElement.getAttribute('data-uwe-motion') === 'off') return true;
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function pruefeAnker(zeit) {
  if (zeit < naechsterAbgleich) return;
  naechsterAbgleich = zeit + 0.8;
  var neu = weltlebenAnker(S.elements);
  var neuSig = ankerSignatur(neu);
  if (neuSig !== signatur) erneuereLeben(neu, neuSig);
}

function tickBewohner(zeit) {
  var blickX = camera.position.x, blickZ = camera.position.z;
  for (var i = 0; i < bewohner.length; i++) {
    var b = bewohner[i], a = b.anker;
    var t = b.phase + zeit * b.tempo;
    var x = a.x + Math.cos(t) * b.bahn;
    var z = a.z + Math.sin(t) * b.bahn * b.seite;
    figurObj.position.set(x, heightAt(x, z) + 0.04, z);
    figurObj.rotation.set(0, Math.atan2(blickX - x, blickZ - z), b.neigung);
    var schritt = 1 + Math.sin(zeit * 4.2 + b.phase) * 0.035;
    figurObj.scale.set(b.skala, b.skala * schritt, b.skala);
    figurObj.updateMatrix();
    figurMesh.setMatrixAt(i, figurObj.matrix);
  }
  figurMesh.instanceMatrix.needsUpdate = true;
}

function tickFalter(zeit) {
  var blickX = camera.position.x, blickZ = camera.position.z;
  for (var i = 0; i < falter.length; i++) {
    var f = falter[i], a = f.anker;
    var t = f.phase + zeit * f.tempo;
    var x = a.x + Math.cos(t) * f.bahn + Math.sin(zeit * 0.41 + f.phase) * 0.8;
    var z = a.z + Math.sin(t) * f.bahn + Math.cos(zeit * 0.37 + f.phase) * 0.8;
    var y = f.boden + f.hoehe + Math.sin(zeit * 1.15 + f.phase) * 0.7;
    falterObj.position.set(x, y, z);
    falterObj.rotation.set(0, Math.atan2(blickX - x, blickZ - z),
      Math.sin(zeit * 2.4 + f.phase) * 0.22);
    var fluegel = 0.24 + Math.abs(Math.sin(zeit * 5.8 + f.phase)) * 0.76;
    falterObj.scale.set(f.skala * fluegel, f.skala, f.skala);
    falterObj.updateMatrix();
    falterMesh.setMatrixAt(i, falterObj.matrix);
  }
  falterMesh.instanceMatrix.needsUpdate = true;
}

function tickFahnen(zeit) {
  var blickX = camera.position.x, blickZ = camera.position.z;
  for (var i = 0; i < fahnen.length; i++) {
    var f = fahnen[i];
    var flattern = Math.sin(zeit * 1.55 + f.phase) * 0.075 +
      Math.sin(zeit * 3.7 + f.phase * 1.7) * 0.025;
    fahnenObj.position.set(f.x, f.y + f.hoehe - f.skala * 0.72, f.z);
    var bildYaw = Math.atan2(blickX - f.x, blickZ - f.z);
    fahnenObj.rotation.set(0, bildYaw + flattern * 0.18, flattern);
    fahnenObj.scale.set(f.skala * (1 + Math.abs(flattern) * 0.7), f.skala, f.skala);
    fahnenObj.updateMatrix();
    fahnenMesh.setMatrixAt(i, fahnenObj.matrix);
  }
  fahnenMesh.instanceMatrix.needsUpdate = true;
}

function initWeltleben(scene) {
  scene.add(mastMesh);
  scene.add(fahnenMesh);
  scene.add(figurMesh);
  scene.add(falterMesh);
}

/** Pro Bild: höchstens 48 Bodenabfragen, 132 kleine Matrixschreibvorgänge. */
function tickWeltleben(_dt, zeit) {
  pruefeAnker(zeit);
  var t = reduzierteBewegung() ? 0 : zeit;
  tickBewohner(t);
  tickFalter(t);
  tickFahnen(t);
}

export {
  initWeltleben,
  tickWeltleben,
  weltlebenAnker,
  MAX_ANKER,
  MAX_BEWOHNER,
  MAX_FALTER,
  MAX_FAHNEN,
  figurMesh,
  falterMesh,
  fahnenMesh,
  mastMesh
};
