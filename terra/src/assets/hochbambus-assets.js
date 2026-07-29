/*
 * Hochbambus als instanzierbare Poolfamilie.
 *
 * Die Geometrien bleiben bewusst schlank: ein Kronendach-Horst repraesentiert
 * sieben einzelne Halme. Dadurch koennen dichte Haine tausende sichtbare
 * Staengel tragen, waehrend die Runtime nur einige hundert Instanzen packt.
 */
import * as THREE from 'three';
import { hashi } from '../core/rng.js';
import { M, mergeGeos, part, vollstaendigeAttribute } from './geometrie-hilfen.js';

export const HOCHBAMBUS_POOL_IDS = Object.freeze({
  hoch: 'bambus_hoch',
  kronendach: 'bambus_kronendach',
  jung: 'bambus_jung'
});

export const HOCHBAMBUS_BASIS_HOEHEN = Object.freeze({
  bambus_hoch: 18,
  bambus_kronendach: 16,
  bambus_jung: 9
});

export const HOCHBAMBUS_STAENGEL_PRO_INSTANZ = Object.freeze({
  bambus_hoch: 1,
  bambus_kronendach: 7,
  bambus_jung: 3
});

const STAMM_DUNKEL = 0x344b32;
const STAMM_MITTEL = 0x526744;
const STAMM_HELL = 0x71805a;
const KNOTEN = 0x273b2a;
const KNOTEN_ALT = 0x8a815d;
const SCHEIDE = 0x4a4b32;
const BLATT_DUNKEL = 0x304a38;
const BLATT_SCHATTEN = 0x20362e;
const BLATT_MITTEL = 0x476247;
const BLATT_HELL = 0x627b51;

function blattGeometrie(laenge, breite) {
  var l = laenge, b = breite, r = breite * 0.14;
  var position = new Float32Array([
    0, 0, 0,      -b, l * 0.38, 0,   0, l * 0.46, r,
    0, 0, 0,       0, l * 0.46, r,   b, l * 0.38, 0,
    -b, l * 0.38, 0,  0, l, 0,       0, l * 0.46, r,
    0, l * 0.46, r,  0, l, 0,        b, l * 0.38, 0
  ]);
  var uv = new Float32Array([
    0.5, 0, 0, 0.38, 0.5, 0.46,
    0.5, 0, 0.5, 0.46, 1, 0.38,
    0, 0.38, 0.5, 1, 0.5, 0.46,
    0.5, 0.46, 0.5, 1, 1, 0.38
  ]);
  var geometrie = new THREE.BufferGeometry();
  geometrie.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometrie.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometrie.computeVertexNormals();
  return vollstaendigeAttribute(geometrie);
}

function windUv(geometrie, basisHoehe) {
  var position = geometrie.attributes.position;
  var uv = geometrie.attributes.uv;
  for (var i = 0; i < position.count; i++) {
    uv.setY(i, Math.max(0, Math.min(1, position.getY(i) / basisHoehe)));
  }
  uv.needsUpdate = true;
  return geometrie;
}

function stengelTeile(cfg) {
  var teile = [];
  var abschnitte = cfg.abschnitte;
  var abschnittHoehe = cfg.hoehe / abschnitte;
  var seed = cfg.seed;
  var i;
  for (i = 0; i < abschnitte; i++) {
    var t0 = i / abschnitte, t1 = (i + 1) / abschnitte;
    var unten = cfg.radius * (1 - t0 * 0.48);
    var oben = cfg.radius * (1 - t1 * 0.48);
    var y = (i + 0.5) * abschnittHoehe;
    var x = cfg.x + cfg.neigungX * t0 * t0;
    var z = cfg.z + cfg.neigungZ * t0 * t0;
    var farbe = i % 3 === 0 ? STAMM_HELL : (i % 2 ? STAMM_DUNKEL : STAMM_MITTEL);
    teile.push(part(new THREE.CylinderGeometry(oben, unten,
      abschnittHoehe * 1.018, cfg.radial, 1, false),
    M(x, y, z, 0, 0, 0), farbe));
    if (i > 0) {
      teile.push(part(new THREE.CylinderGeometry(unten * 1.18, unten * 1.18,
        Math.max(0.08, cfg.radius * 0.42), cfg.radial, 1, false),
      M(x, i * abschnittHoehe, z), i % 3 ? KNOTEN : KNOTEN_ALT));
    }
  }

  // Dunkle, polygonale Blattscheide am Fuss und eine scharfe Endknospe
  // nehmen dem Halm die weiche Standard-Zylinder-Silhouette.
  teile.push(part(new THREE.CylinderGeometry(cfg.radius * 1.18,
    cfg.radius * 1.62, Math.min(0.72, cfg.hoehe * 0.055), cfg.radial, 1, false),
  M(cfg.x, Math.min(0.36, cfg.hoehe * 0.027), cfg.z), SCHEIDE));
  var spitzenX = cfg.x + cfg.neigungX;
  var spitzenZ = cfg.z + cfg.neigungZ;
  teile.push(part(new THREE.ConeGeometry(cfg.radius * 0.54,
    cfg.radius * 2.8, Math.min(4, cfg.radial)),
  M(spitzenX, cfg.hoehe + cfg.radius * 1.35, spitzenZ,
    cfg.neigungZ * 0.035, 0, -cfg.neigungX * 0.035),
  KNOTEN_ALT));

  var blatt = blattGeometrie(cfg.blattLaenge, cfg.blattBreite);
  for (i = 0; i < cfg.blaetter; i++) {
    var h = cfg.hoehe * (0.52 + hashi(i, 3, seed) * 0.43);
    var t = h / cfg.hoehe;
    var a = i * 2.399963229728653 + hashi(i, 5, seed) * 0.42;
    var zweig = cfg.radius * (3.2 + hashi(i, 7, seed) * 2.4);
    var bx = cfg.x + cfg.neigungX * t * t;
    var bz = cfg.z + cfg.neigungZ * t * t;
    teile.push(part(new THREE.CylinderGeometry(cfg.radius * 0.16,
      cfg.radius * 0.28, zweig, 5, 1, false),
    M(bx + Math.cos(a) * zweig * 0.36, h,
      bz + Math.sin(a) * zweig * 0.36,
      Math.sin(a) * 0.92, 0, -Math.cos(a) * 0.92),
    STAMM_DUNKEL));

    var blattFarbe = i % 3 === 0 ? BLATT_HELL
      : (i % 2 ? BLATT_DUNKEL : BLATT_MITTEL);
    var blattX = bx + Math.cos(a) * zweig * 0.72;
    var blattZ = bz + Math.sin(a) * zweig * 0.72;
    teile.push(part(blatt,
      M(blattX, h + (hashi(i, 11, seed) - 0.5) * 0.45, blattZ,
        0, -a, (i % 2 ? 1 : -1) * (1.12 + hashi(i, 13, seed) * 0.30),
        1, 1, i % 2 ? 1 : -1),
      blattFarbe));
    teile.push(part(blatt,
      M(blattX, h - 0.18, blattZ, 0, -a + 0.62,
        -(1.06 + hashi(i, 17, seed) * 0.28), 0.82, 0.86, 1),
      BLATT_SCHATTEN));
    if (cfg.dicht) {
      teile.push(part(blatt,
        M(blattX - Math.cos(a) * cfg.radius * 0.45, h + 0.12,
          blattZ - Math.sin(a) * cfg.radius * 0.45,
          0, -a - 0.68, 0.96 + hashi(i, 19, seed) * 0.30,
          0.74, 0.80, -1),
        i % 2 ? BLATT_MITTEL : BLATT_DUNKEL));
    }
  }
  return teile;
}

function stengelGeometrie(cfg) {
  return windUv(mergeGeos(stengelTeile(cfg)), cfg.basisHoehe || cfg.hoehe);
}

function hochGeometrie() {
  return stengelGeometrie({
    x: 0, z: 0, hoehe: 18, basisHoehe: 18, radius: 0.25,
    abschnitte: 8, radial: 7, blaetter: 12,
    blattLaenge: 1.55, blattBreite: 0.28,
    neigungX: 0.46, neigungZ: -0.24, seed: 0x811
  });
}

function kronendachGeometrie() {
  var teile = [];
  var anzahl = HOCHBAMBUS_STAENGEL_PRO_INSTANZ.bambus_kronendach;
  for (var i = 0; i < anzahl; i++) {
    var a = i / anzahl * Math.PI * 2 + (i % 2) * 0.29;
    var dist = i === 0 ? 0 : 1.05 + hashi(i, 3, 0x853) * 1.05;
    var hoehe = 12.5 + hashi(i, 5, 0x853) * 3.5;
    teile.push(stengelGeometrie({
      x: Math.cos(a) * dist,
      z: Math.sin(a) * dist,
      hoehe,
      basisHoehe: 16,
      radius: 0.16 + hashi(i, 7, 0x853) * 0.05,
      abschnitte: 6,
      radial: 6,
      blaetter: 5,
      dicht: true,
      blattLaenge: 1.12,
      blattBreite: 0.21,
      neigungX: Math.cos(a) * (0.18 + hashi(i, 11, 0x853) * 0.30),
      neigungZ: Math.sin(a) * (0.18 + hashi(i, 13, 0x853) * 0.30),
      seed: 0x853 + i * 41
    }));
  }
  return windUv(mergeGeos(teile), 16);
}

function jungGeometrie() {
  var teile = [];
  var anzahl = HOCHBAMBUS_STAENGEL_PRO_INSTANZ.bambus_jung;
  for (var i = 0; i < anzahl; i++) {
    var a = i / anzahl * Math.PI * 2 + 0.4;
    teile.push(stengelGeometrie({
      x: Math.cos(a) * 0.62,
      z: Math.sin(a) * 0.62,
      hoehe: 6.8 + i * 0.9,
      basisHoehe: 9,
      radius: 0.12,
      abschnitte: 5,
      radial: 6,
      blaetter: 4,
      blattLaenge: 0.82,
      blattBreite: 0.17,
      neigungX: Math.cos(a) * 0.34,
      neigungZ: Math.sin(a) * 0.34,
      seed: 0x8d1 + i * 29
    }));
  }
  return windUv(mergeGeos(teile), 9);
}

export function erzeugeHochbambusGeometrie(art) {
  var poolId = HOCHBAMBUS_POOL_IDS[art] || HOCHBAMBUS_POOL_IDS.hoch;
  var geometrie;
  if (poolId === HOCHBAMBUS_POOL_IDS.kronendach) geometrie = kronendachGeometrie();
  else if (poolId === HOCHBAMBUS_POOL_IDS.jung) geometrie = jungGeometrie();
  else geometrie = hochGeometrie();
  geometrie.userData.terraAssetFamilie = 'hochbambus';
  geometrie.userData.terraHochbambusArt = art in HOCHBAMBUS_POOL_IDS ? art : 'hoch';
  geometrie.userData.terraBasisHoehe = HOCHBAMBUS_BASIS_HOEHEN[poolId];
  geometrie.userData.terraStaengel = HOCHBAMBUS_STAENGEL_PRO_INSTANZ[poolId];
  geometrie.userData.terraArtDirection = 'hoch-kantig-erwachsen';
  geometrie.userData.terraMaterialZonen = 10;
  geometrie.userData.terraBlattFaechern = art === 'kronendach' ? 3 : 2;
  geometrie.computeBoundingBox();
  geometrie.computeBoundingSphere();
  return geometrie;
}

/** Registrierung ohne Import-Nebeneffekt; Root verdrahtet sie in geometry.js. */
export function registriereHochbambusPools(definePool) {
  if (typeof definePool !== 'function') {
    throw new TypeError('registriereHochbambusPools braucht definePool');
  }
  var definitionen = [
    ['hoch', 3.0, 1.05],
    ['kronendach', 3.9, 0.68],
    ['jung', 2.0, 0.42]
  ];
  for (var i = 0; i < definitionen.length; i++) {
    var d = definitionen[i];
    definePool(HOCHBAMBUS_POOL_IDS[d[0]], erzeugeHochbambusGeometrie(d[0]), {
      radius: d[1],
      dbl: true,
      ao: 0.22,
      familie: 'laub',
      wind: { amp: d[2] },
      sichtbarBis: 600
    });
  }
  return definitionen.map(function (d) { return HOCHBAMBUS_POOL_IDS[d[0]]; });
}
