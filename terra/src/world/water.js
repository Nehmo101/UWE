// Wasserflaeche mit sanftem Wogen und ein kleiner Meeresboden-Teller.
// In der Distanz uebernimmt der (richtungsabhaengige) Nebel den Uebergang
// zum Himmel — die Kartenkante schneidet nicht mehr ins Bild.
import * as THREE from 'three';
import { KARTE } from '../core/store.js';
import { terraMat, tintedMats } from '../render/materials.js';
import { TEX } from '../render/textures.js';
import { cam, camera } from '../editor/camera.js';

/* --- Masse mit der Kartengroesse (H1b) ----------------------------------
   Beide Flaechen muessen die Karte plus Sichtweite ueberdecken, sonst
   schneidet ihre Kante ins Bild.

   Wasser: die Ebene ist auf den Ursprung zentriert, der Kamerafokus laeuft
   bis HALF+40 nach aussen, und ab dort traegt der Nebel (fogFern 860..1150
   in den Presets) den Uebergang. Der bisherige Wert 2000 entspricht genau
   872 Einheiten Rand jenseits der Kartenkante — dieser Rand bleibt
   konstant, denn er haengt am Nebel, nicht an der Karte. 256 -> 2000
   (unveraendert), 512 -> 2256, 1024 -> 2768.
   Die Segmentdichte bleibt ebenfalls konstant (62.5 Einheiten je Segment =
   2000/32), weil updateWater() die Wellen aus Weltkoordinaten rechnet:
   groebere Segmente wuerden die Wellenlaenge (~140 Einheiten) unterabtasten.

   Meeresboden: reiner Teller unter der Karte, der Nebel schluckt seinen
   Rand. Radius waechst proportional (360 deckt die halbe 256er-Diagonale
   von 181 doppelt ab); 256 -> 360 (unveraendert), 512 -> 720, 1024 -> 1440. */
var WASSER_RAND = 872;
function wasserGroesse() { return 2 * (KARTE.half + WASSER_RAND); }
function wasserSegmente() { return Math.round(wasserGroesse() / 62.5); }
function bodenRadius() { return 360 * (KARTE.map / 256); }

function baueWasserGeo() {
  var g = new THREE.PlaneGeometry(wasserGroesse(), wasserGroesse(), wasserSegmente(), wasserSegmente());
  g.rotateX(-Math.PI / 2);
  return g;
}
var waterGeo = baueWasserGeo();
var waterMat = terraMat({
  color: 0x3f93ad, transparent: true, opacity: 0.68, depthWrite: false,
  map: TEX.foamEdge
});
waterMat.map.repeat.set(26, 26);
var water = new THREE.Mesh(waterGeo, waterMat);
water.position.y = 0;
water.renderOrder = 4;
water.frustumCulled = false;

// Meeresboden nur als Teller unter der Karte, nicht als bildfuellende Lage.
function baueBodenGeo() {
  var g = new THREE.CircleGeometry(bodenRadius(), 48).rotateX(-Math.PI / 2);
  var n = g.attributes.position.count, arr = new Float32Array(n * 3);
  var c = new THREE.Color(0x1f4750);
  for (var i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}
var seabedGeo = baueBodenGeo();
var seabed = new THREE.Mesh(seabedGeo, terraMat({ vertexColors: true }));
seabed.position.y = -24;
seabed.frustumCulled = false;
// Grundfarbe liegt in den Vertexfarben, material.color bleibt weiss und ist
// frei fuer den Tageszeit-Grundton — sonst bliebe der Boden bei Abendrot neutral.
tintedMats.push(seabed.material);

function initWater(scene) {
  scene.add(water);
  scene.add(seabed);
}

var waterBaseXZ = [];
function merkeWasserXZ() {
  waterBaseXZ.length = 0;
  var p = waterGeo.attributes.position;
  for (var i = 0; i < p.count; i++) waterBaseXZ.push(p.getX(i), p.getZ(i));
}
merkeWasserXZ();

/** Kartengroesse hat sich geaendert: beide Geometrien neu bauen. Die MESHES
 *  bleiben dieselben Objekte (main.js haelt eine Referenz auf `water` und
 *  schaltet dessen visible), nur ihre Geometrie wird getauscht. */
function wasserNeuBauen() {
  water.geometry.dispose();
  waterGeo = baueWasserGeo();
  water.geometry = waterGeo;
  merkeWasserXZ();
  seabed.geometry.dispose();
  seabedGeo = baueBodenGeo();
  seabed.geometry = seabedGeo;
}

/** Wogen nur berechnen, wenn die Wasserfläche überhaupt im Bild liegt. */
var _wasserFrustum = new THREE.Frustum(), _wasserM = new THREE.Matrix4();
var _wasserBox = new THREE.Box3();
/** Wogen nur berechnen, wenn die Wasserflaeche ueberhaupt im Bild liegt. */
function wasserSichtbar(fogFar) {
  _wasserM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _wasserFrustum.setFromProjectionMatrix(_wasserM);
  var r = fogFar;
  _wasserBox.min.set(cam.focus.x - r, -1.5, cam.focus.z - r);
  _wasserBox.max.set(cam.focus.x + r, 1.5, cam.focus.z + r);
  return _wasserFrustum.intersectsBox(_wasserBox);
}

function updateWater(t) {
  var p = waterGeo.attributes.position, arr = p.array;
  for (var i = 0; i < p.count; i++) {
    var x = waterBaseXZ[i * 2], z = waterBaseXZ[i * 2 + 1];
    arr[i * 3 + 1] = Math.sin(x * 0.045 + t * 0.7) * 0.32 + Math.sin(z * 0.031 - t * 0.55) * 0.26
      + Math.sin((x + z) * 0.018 + t * 0.35) * 0.2;
  }
  p.needsUpdate = true;
}

export { water, waterMat, seabed, initWater, wasserSichtbar, updateWater, wasserNeuBauen };
