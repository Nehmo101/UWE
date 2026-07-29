// Dezente 3D-Kantenkontur fuer genau das primaer ausgewaehlte Element.
// Poolinstanzen werden in einen Linienzug verschmolzen; eigene Meshgruppen
// behalten pro beweglichem Quellmesh eine Linie, damit Animationen folgen.
import * as THREE from 'three';
import { POOLS } from '../core/pools.js';

const KANTEN_WINKEL = Math.cos(35 * Math.PI / 180);
const KONTUR_FAKTOR = 1.004;
const MAX_DREIECKE = 45000;
const MAX_KANTEN_VERTICES = 120000;
const MAX_GRUPPEN_MESHES = 24;

const konturMaterial = new THREE.LineBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.82,
  depthTest: true,
  depthWrite: false,
  fog: false,
  toneMapped: false,
  linewidth: 1
});

export const auswahlKontur = new THREE.Group();
auswahlKontur.name = 'terra-auswahlkontur';
auswahlKontur.userData.terraAuswahlKontur = true;

var zielElement = null;
var zielInstanzen = null;
var gruppenSnapshot = [];
var gruppenLinien = [];
var gruppenFallbackAktiv = false;
var instanzMatrix = new THREE.Matrix4();
var weltMatrix = new THREE.Matrix4();
var instanzObjekt = new THREE.Object3D();
instanzObjekt.rotation.order = 'YXZ';

function leereGrenzen() {
  return {
    minX: Infinity, minY: Infinity, minZ: Infinity,
    maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity
  };
}

function grenzenLeer(g) {
  return g.minX > g.maxX || g.minY > g.maxY || g.minZ > g.maxZ;
}

function punktErweitern(g, x, y, z) {
  if (x < g.minX) g.minX = x;
  if (y < g.minY) g.minY = y;
  if (z < g.minZ) g.minZ = z;
  if (x > g.maxX) g.maxX = x;
  if (y > g.maxY) g.maxY = y;
  if (z > g.maxZ) g.maxZ = z;
}

function geometrieGrenzen(geo) {
  var g = leereGrenzen();
  var p = geo && geo.attributes && geo.attributes.position;
  if (!p) return g;
  for (var i = 0; i < p.count; i++) punktErweitern(g, p.getX(i), p.getY(i), p.getZ(i));
  return g;
}

function transformierePunkt(matrix, x, y, z, ziel, offset) {
  var e = matrix.elements;
  ziel[offset] = e[0] * x + e[4] * y + e[8] * z + e[12];
  ziel[offset + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
  ziel[offset + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
}

function transformiereGrenzen(quell, matrix, ziel) {
  if (grenzenLeer(quell)) return;
  var tmp = new Float32Array(3);
  for (var x = 0; x < 2; x++) {
    for (var y = 0; y < 2; y++) {
      for (var z = 0; z < 2; z++) {
        transformierePunkt(matrix,
          x ? quell.maxX : quell.minX,
          y ? quell.maxY : quell.minY,
          z ? quell.maxZ : quell.minZ, tmp, 0);
        punktErweitern(ziel, tmp[0], tmp[1], tmp[2]);
      }
    }
  }
}

function kistenPositionen(g) {
  if (grenzenLeer(g)) return new Float32Array(0);
  var cx = (g.minX + g.maxX) * 0.5, cy = (g.minY + g.maxY) * 0.5;
  var cz = (g.minZ + g.maxZ) * 0.5;
  var minX = cx + (g.minX - cx) * KONTUR_FAKTOR;
  var maxX = cx + (g.maxX - cx) * KONTUR_FAKTOR;
  var minY = cy + (g.minY - cy) * KONTUR_FAKTOR;
  var maxY = cy + (g.maxY - cy) * KONTUR_FAKTOR;
  var minZ = cz + (g.minZ - cz) * KONTUR_FAKTOR;
  var maxZ = cz + (g.maxZ - cz) * KONTUR_FAKTOR;
  var ecken = [
    [minX, minY, minZ], [maxX, minY, minZ],
    [maxX, maxY, minZ], [minX, maxY, minZ],
    [minX, minY, maxZ], [maxX, minY, maxZ],
    [maxX, maxY, maxZ], [minX, maxY, maxZ]
  ];
  var kanten = [
    0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4,
    0, 4, 1, 5, 2, 6, 3, 7
  ];
  var out = new Float32Array(kanten.length * 3);
  for (var i = 0; i < kanten.length; i++) {
    var p = ecken[kanten[i]];
    out[i * 3] = p[0]; out[i * 3 + 1] = p[1]; out[i * 3 + 2] = p[2];
  }
  return out;
}

function punktSchluessel(x, y, z) {
  return Math.round(x * 10000) + ',' + Math.round(y * 10000) + ',' +
    Math.round(z * 10000);
}

function kanteMerken(kanten, ax, ay, az, bx, by, bz, nx, ny, nz) {
  var ak = punktSchluessel(ax, ay, az), bk = punktSchluessel(bx, by, bz);
  if (ak === bk) return;
  if (ak > bk) {
    var tk = ak; ak = bk; bk = tk;
    var tx = ax; ax = bx; bx = tx;
    var ty = ay; ay = by; by = ty;
    var tz = az; az = bz; bz = tz;
  }
  var key = ak + '|' + bk;
  var alt = kanten.get(key);
  if (!alt) {
    kanten.set(key, {
      ax: ax, ay: ay, az: az, bx: bx, by: by, bz: bz,
      nx: nx, ny: ny, nz: nz, anzahl: 1, scharf: false
    });
    return;
  }
  alt.anzahl++;
  if (alt.nx * nx + alt.ny * ny + alt.nz * nz <= KANTEN_WINKEL) alt.scharf = true;
}

/**
 * Kleine EdgesGeometry-Entsprechung ohne zusaetzliche Three-Abhaengigkeit:
 * koplanare Dreiecksdiagonalen verschwinden, harte und offene Kanten bleiben.
 */
function kantenPositionen(geo) {
  var position = geo && geo.attributes && geo.attributes.position;
  if (!position || position.count < 3) return new Float32Array(0);
  var index = geo.index && geo.index.array;
  var anzahl = index ? index.length : position.count;
  var dreiecke = Math.floor(anzahl / 3);
  var bounds = geometrieGrenzen(geo);
  if (!dreiecke || dreiecke > MAX_DREIECKE) return kistenPositionen(bounds);
  var kanten = new Map();
  for (var i = 0; i < dreiecke; i++) {
    var ai = index ? index[i * 3] : i * 3;
    var bi = index ? index[i * 3 + 1] : i * 3 + 1;
    var ci = index ? index[i * 3 + 2] : i * 3 + 2;
    var ax = position.getX(ai), ay = position.getY(ai), az = position.getZ(ai);
    var bx = position.getX(bi), by = position.getY(bi), bz = position.getZ(bi);
    var cx = position.getX(ci), cy = position.getY(ci), cz = position.getZ(ci);
    var abx = bx - ax, aby = by - ay, abz = bz - az;
    var acx = cx - ax, acy = cy - ay, acz = cz - az;
    var nx = aby * acz - abz * acy;
    var ny = abz * acx - abx * acz;
    var nz = abx * acy - aby * acx;
    var laenge = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (laenge < 1e-10) continue;
    nx /= laenge; ny /= laenge; nz /= laenge;
    kanteMerken(kanten, ax, ay, az, bx, by, bz, nx, ny, nz);
    kanteMerken(kanten, bx, by, bz, cx, cy, cz, nx, ny, nz);
    kanteMerken(kanten, cx, cy, cz, ax, ay, az, nx, ny, nz);
  }
  var sichtbar = [];
  kanten.forEach(function (kante) {
    if (kante.anzahl !== 1 && !kante.scharf) return;
    sichtbar.push(kante);
  });
  if (!sichtbar.length) return kistenPositionen(bounds);
  var mx = (bounds.minX + bounds.maxX) * 0.5;
  var my = (bounds.minY + bounds.maxY) * 0.5;
  var mz = (bounds.minZ + bounds.maxZ) * 0.5;
  var out = new Float32Array(sichtbar.length * 6);
  for (i = 0; i < sichtbar.length; i++) {
    var q = sichtbar[i], o = i * 6;
    out[o] = mx + (q.ax - mx) * KONTUR_FAKTOR;
    out[o + 1] = my + (q.ay - my) * KONTUR_FAKTOR;
    out[o + 2] = mz + (q.az - mz) * KONTUR_FAKTOR;
    out[o + 3] = mx + (q.bx - mx) * KONTUR_FAKTOR;
    out[o + 4] = my + (q.by - my) * KONTUR_FAKTOR;
    out[o + 5] = mz + (q.bz - mz) * KONTUR_FAKTOR;
  }
  return out;
}

function linieAusPositionen(positionen, art) {
  if (!positionen || !positionen.length) return null;
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positionen, 3));
  var linie = new THREE.LineSegments(geo, konturMaterial);
  linie.frustumCulled = false;
  linie.renderOrder = 899;
  linie.userData.terraAuswahlKonturArt = art;
  auswahlKontur.add(linie);
  return linie;
}

function instanzDatenMatrix(a, offset) {
  instanzObjekt.position.set(a[offset], a[offset + 1], a[offset + 2]);
  instanzObjekt.rotation.set(a[offset + 3], a[offset + 4], a[offset + 5], 'YXZ');
  instanzObjekt.scale.set(a[offset + 6], a[offset + 7], a[offset + 8]);
  instanzObjekt.updateMatrix();
  return instanzObjekt.matrix;
}

function transformierePositionen(quell, matrix, ziel, offset) {
  for (var i = 0; i < quell.length; i += 3) {
    transformierePunkt(matrix, quell[i], quell[i + 1], quell[i + 2], ziel, offset);
    offset += 3;
  }
  return offset;
}

function poolKontur(el) {
  if (!el.inst) return;
  var namen = Object.keys(el.inst), daten = [], vertexGesamt = 0;
  var edgeCache = new Map(), zuGross = false;
  for (var i = 0; i < namen.length; i++) {
    var name = namen[i], a = el.inst[name], pool = POOLS[name];
    if (!pool || !pool.geo || !a || a.length < 12) continue;
    var kanten = edgeCache.get(pool.geo);
    if (!kanten) {
      kanten = kantenPositionen(pool.geo);
      edgeCache.set(pool.geo, kanten);
    }
    var instanzen = Math.floor(a.length / 12);
    vertexGesamt += kanten.length / 3 * instanzen;
    if (vertexGesamt > MAX_KANTEN_VERTICES) zuGross = true;
    daten.push({ a: a, kanten: kanten, instanzen: instanzen, geo: pool.geo });
  }
  if (!daten.length) return;
  if (zuGross) {
    var bounds = leereGrenzen();
    for (i = 0; i < daten.length; i++) {
      var lokal = geometrieGrenzen(daten[i].geo);
      for (var k = 0; k < daten[i].a.length; k += 12) {
        transformiereGrenzen(lokal, instanzDatenMatrix(daten[i].a, k), bounds);
      }
    }
    var fallback = linieAusPositionen(kistenPositionen(bounds), 'pool-huelle');
    if (fallback) fallback.userData.terraAuswahlKonturFallback = true;
    return;
  }
  var out = new Float32Array(vertexGesamt * 3), offset = 0;
  for (i = 0; i < daten.length; i++) {
    for (k = 0; k < daten[i].a.length; k += 12) {
      offset = transformierePositionen(
        daten[i].kanten, instanzDatenMatrix(daten[i].a, k), out, offset
      );
    }
  }
  var linie = linieAusPositionen(out, 'pool-kanten');
  if (linie) linie.userData.terraAuswahlKonturInstanzen =
    daten.reduce(function (summe, d) { return summe + d.instanzen; }, 0);
}

function gruppenMeshes(gruppe) {
  var out = [];
  if (!gruppe) return out;
  gruppe.updateWorldMatrix(true, true);
  gruppe.traverseVisible(function (objekt) {
    if (objekt !== gruppe && objekt.isMesh && !objekt.isLine && !objekt.isPoints &&
        objekt.geometry && objekt.geometry.attributes &&
        objekt.geometry.attributes.position) out.push(objekt);
  });
  return out;
}

function snapshotVon(meshes) {
  return meshes.map(function (mesh) {
    return {
      mesh: mesh,
      geo: mesh.geometry,
      positionVersion: mesh.geometry.attributes.position.version || 0,
      count: mesh.isInstancedMesh ? mesh.count : -1,
      instanzVersion: mesh.isInstancedMesh ? (mesh.instanceMatrix.version || 0) : -1,
      matrix: mesh.matrixWorld.elements.slice()
    };
  });
}

function snapshotGeaendert(meshes) {
  if (meshes.length !== gruppenSnapshot.length) return true;
  for (var i = 0; i < meshes.length; i++) {
    var alt = gruppenSnapshot[i], mesh = meshes[i];
    if (alt.mesh !== mesh || alt.geo !== mesh.geometry ||
        alt.positionVersion !== (mesh.geometry.attributes.position.version || 0) ||
        alt.count !== (mesh.isInstancedMesh ? mesh.count : -1) ||
        alt.instanzVersion !== (mesh.isInstancedMesh ?
          (mesh.instanceMatrix.version || 0) : -1)) return true;
    if (gruppenFallbackAktiv) {
      for (var k = 0; k < 16; k++) {
        if (alt.matrix[k] !== mesh.matrixWorld.elements[k]) return true;
      }
    }
  }
  return false;
}

function instancedMeshPositionen(mesh, kanten) {
  var count = Math.max(0, mesh.count | 0);
  if (kanten.length / 3 * count > MAX_KANTEN_VERTICES) {
    var bounds = leereGrenzen(), lokal = geometrieGrenzen(mesh.geometry);
    for (var i = 0; i < count; i++) {
      mesh.getMatrixAt(i, instanzMatrix);
      transformiereGrenzen(lokal, instanzMatrix, bounds);
    }
    return { positionen: kistenPositionen(bounds), fallback: true };
  }
  var out = new Float32Array(kanten.length * count), offset = 0;
  for (i = 0; i < count; i++) {
    mesh.getMatrixAt(i, instanzMatrix);
    offset = transformierePositionen(kanten, instanzMatrix, out, offset);
  }
  return { positionen: out, fallback: false };
}

function gruppenHuelle(meshes) {
  var bounds = leereGrenzen();
  for (var i = 0; i < meshes.length; i++) {
    var mesh = meshes[i], lokal = geometrieGrenzen(mesh.geometry);
    if (mesh.isInstancedMesh) {
      for (var k = 0; k < mesh.count; k++) {
        mesh.getMatrixAt(k, instanzMatrix);
        weltMatrix.multiplyMatrices(mesh.matrixWorld, instanzMatrix);
        transformiereGrenzen(lokal, weltMatrix, bounds);
      }
    } else {
      transformiereGrenzen(lokal, mesh.matrixWorld, bounds);
    }
  }
  var linie = linieAusPositionen(kistenPositionen(bounds), 'gruppen-huelle');
  if (linie) linie.userData.terraAuswahlKonturFallback = true;
}

function gruppenKontur(meshes) {
  gruppenLinien.length = 0;
  gruppenFallbackAktiv = meshes.length > MAX_GRUPPEN_MESHES;
  if (gruppenFallbackAktiv) {
    gruppenHuelle(meshes);
    return;
  }
  for (var i = 0; i < meshes.length; i++) {
    var mesh = meshes[i], kanten = kantenPositionen(mesh.geometry);
    var daten = mesh.isInstancedMesh
      ? instancedMeshPositionen(mesh, kanten)
      : { positionen: kanten, fallback: false };
    var linie = linieAusPositionen(daten.positionen,
      mesh.isInstancedMesh ? 'gruppen-instanzen' : 'gruppen-kanten');
    if (!linie) continue;
    linie.matrixAutoUpdate = false;
    linie.matrix.copy(mesh.matrixWorld);
    linie.matrixWorldNeedsUpdate = true;
    linie.userData.terraAuswahlKonturFallback = daten.fallback;
    gruppenLinien.push({ linie: linie, quelle: mesh });
  }
}

function kinderLeeren() {
  for (var i = auswahlKontur.children.length - 1; i >= 0; i--) {
    var kind = auswahlKontur.children[i];
    if (kind.geometry) kind.geometry.dispose();
    auswahlKontur.remove(kind);
  }
  gruppenLinien.length = 0;
  gruppenFallbackAktiv = false;
}

export function leereAuswahlKontur() {
  kinderLeeren();
  zielElement = null;
  zielInstanzen = null;
  gruppenSnapshot = [];
  auswahlKontur.visible = false;
}

function neuBauen(el, meshes) {
  kinderLeeren();
  zielElement = el;
  zielInstanzen = el.inst;
  gruppenSnapshot = snapshotVon(meshes);
  gruppenKontur(meshes);
  poolKontur(el);
  auswahlKontur.visible = auswahlKontur.children.length > 0;
}

/** Wird im Griff-Takt aufgerufen; baut nur bei Auswahl-/Geometriewechsel neu. */
export function aktualisiereAuswahlKontur(el, auswahlWerkzeugAktiv) {
  if (!auswahlWerkzeugAktiv || !el) {
    if (zielElement || auswahlKontur.children.length) leereAuswahlKontur();
    return 0;
  }
  var meshes = gruppenMeshes(el.group);
  if (el !== zielElement || el.inst !== zielInstanzen || snapshotGeaendert(meshes)) {
    neuBauen(el, meshes);
  } else {
    for (var i = 0; i < gruppenLinien.length; i++) {
      gruppenLinien[i].linie.matrix.copy(gruppenLinien[i].quelle.matrixWorld);
      gruppenLinien[i].linie.matrixWorldNeedsUpdate = true;
    }
  }
  return auswahlKontur.children.length;
}
