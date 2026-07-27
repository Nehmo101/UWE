// Wasserflaeche mit sanftem Wogen und ein kleiner Meeresboden-Teller.
// In der Distanz uebernimmt der (richtungsabhaengige) Nebel den Uebergang
// zum Himmel — die Kartenkante schneidet nicht mehr ins Bild.
import * as THREE from 'three';
import { terraMat, tintedMats } from '../render/materials.js';
import { TEX } from '../render/textures.js';
import { cam, camera } from '../editor/camera.js';

var waterGeo = new THREE.PlaneGeometry(2000, 2000, 32, 32);
waterGeo.rotateX(-Math.PI / 2);
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
var seabedGeo = new THREE.CircleGeometry(360, 48).rotateX(-Math.PI / 2);
(function () {
  var n = seabedGeo.attributes.position.count, arr = new Float32Array(n * 3);
  var c = new THREE.Color(0x1f4750);
  for (var i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  seabedGeo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
})();
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
(function () {
  var p = waterGeo.attributes.position;
  for (var i = 0; i < p.count; i++) waterBaseXZ.push(p.getX(i), p.getZ(i));
})();

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

export { water, waterMat, seabed, initWater, wasserSichtbar, updateWater };
