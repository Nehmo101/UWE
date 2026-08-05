import * as THREE from 'three';
import { POOLS, weiteHuelle } from '../core/pools.js';

function materialFarbe(material) {
  return material && material.color ? material.color : new THREE.Color(0xffffff);
}

export function backeGruppeZuPoolGeometrie(gruppe) {
  gruppe.updateMatrixWorld(true);
  var teile = [];
  gruppe.traverse(function (objekt) {
    if (!objekt.isMesh || !objekt.geometry || !objekt.geometry.attributes.position) return;
    var geo = objekt.geometry.index ? objekt.geometry.toNonIndexed() : objekt.geometry.clone();
    geo.applyMatrix4(objekt.matrixWorld);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    var farbe = materialFarbe(objekt.material), n = geo.attributes.position.count;
    var farben = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    var istRinde = /bark|rinde|trunk/i.test(objekt.material && objekt.material.name || '');
    for (var i = 0; i < n; i++) {
      farben[i * 3] = farbe.r; farben[i * 3 + 1] = farbe.g; farben[i * 3 + 2] = farbe.b;
      uv[i * 2] = 0.5; uv[i * 2 + 1] = istRinde ? 0.008 : 0.72;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(farben, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    teile.push(geo);
  });
  if (!teile.length) throw new Error('Externes Pool-Asset enthaelt keine Mesh-Geometrie');
  var vertices = teile.reduce(function (summe, geo) { return summe + geo.attributes.position.count; }, 0);
  var pos = new Float32Array(vertices * 3), nor = new Float32Array(vertices * 3);
  var col = new Float32Array(vertices * 3), uv = new Float32Array(vertices * 2), offset = 0;
  for (var t = 0; t < teile.length; t++) {
    var teil = teile[t], count = teil.attributes.position.count;
    pos.set(teil.attributes.position.array, offset * 3);
    nor.set(teil.attributes.normal.array, offset * 3);
    col.set(teil.attributes.color.array, offset * 3);
    uv.set(teil.attributes.uv.array, offset * 2);
    offset += count;
  }
  var raus = new THREE.BufferGeometry();
  raus.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  raus.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  raus.setAttribute('color', new THREE.BufferAttribute(col, 3));
  raus.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  raus.computeBoundingBox(); raus.computeBoundingSphere();
  raus.userData.terraExternPool = true;
  return raus;
}

export function installiereExternenPool(id, gruppe) {
  var eintrag = typeof id === 'string' ? Object.getOwnPropertyDescriptor(POOLS, id) : null;
  var pool = eintrag && eintrag.value;
  if (!pool || pool.mesh) return false;
  pool.geo = weiteHuelle(backeGruppeZuPoolGeometrie(gruppe));
  pool.mat.map = null;
  pool.mat.alphaTest = 0;
  pool.mat.needsUpdate = true;
  pool.externesAsset = id;
  return true;
}
