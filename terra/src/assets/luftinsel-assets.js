/*
 * Harte, skalierbare Grundformen fuer fliegende Inseln.
 *
 * Jede Form ist eine einzige Pool-Geometrie. Der Generator skaliert sie
 * nicht-uniform, sodass auch grosse Formationen bei vier Draw Calls bleiben:
 * ein Pool je Silhouettenfamilie, unabhaengig von der Inselanzahl.
 */
import * as THREE from 'three';
import { hashi } from '../core/rng.js';
import { M, mergeGeos, part, vollstaendigeAttribute } from './geometrie-hilfen.js';

export const LUFTINSEL_POOL_IDS = Object.freeze({
  fels: 'luftinsel_fels',
  scherbe: 'luftinsel_scherbe',
  tafel: 'luftinsel_tafel',
  archipel: 'luftinsel_archipel'
});

export const LUFTINSEL_FORMEN = Object.freeze(Object.keys(LUFTINSEL_POOL_IDS));

const PROFILE = Object.freeze({
  fels: Object.freeze({
    radius: 5.2, tiefe: 8.4, segmente: 13, x: 1.0, z: 0.92,
    schulter: 0.86, taille: 0.54, spitze: 0.12, seed: 0x511
  }),
  scherbe: Object.freeze({
    radius: 4.5, tiefe: 11.8, segmente: 11, x: 0.62, z: 1.28,
    schulter: 0.72, taille: 0.34, spitze: 0.06, seed: 0x5a7
  }),
  tafel: Object.freeze({
    radius: 6.4, tiefe: 6.8, segmente: 14, x: 1.22, z: 0.90,
    schulter: 0.96, taille: 0.68, spitze: 0.20, seed: 0x61d
  }),
  archipel: Object.freeze({
    radius: 4.2, tiefe: 7.2, segmente: 12, x: 1.0, z: 0.88,
    schulter: 0.82, taille: 0.48, spitze: 0.10, seed: 0x683
  })
});

const FARBE_PLATEAU = new THREE.Color(0x64764f);
const FARBE_KANTE = new THREE.Color(0x625f55);
const FARBE_FELS = new THREE.Color(0x77756e);
const FARBE_TIEFE = new THREE.Color(0x3f4142);
const FARBE_ERDSAUM = 0x4b4339;
const FARBE_ADER = 0x8a7249;
const FARBE_MINERAL = 0x66746f;
const FARBE_SCHATTEN = 0x2d3234;

function transformiereMitEigenfarben(geometrie, matrix) {
  var teil = geometrie.clone();
  teil.applyMatrix4(matrix);
  return vollstaendigeAttribute(teil);
}

function punkt(cfg, ring, segment, seed) {
  var a = segment / cfg.segmente * Math.PI * 2;
  var basis = ring.radius;
  var kantig = 0.86 + hashi(segment, ring.index * 37, seed) * 0.25;
  var schlag = (segment % 3 === 0 ? 1.08 : 0.96);
  var radius = basis * kantig * schlag;
  var versatz = (hashi(segment, ring.index * 71, seed + 17) - 0.5)
    * cfg.radius * ring.unruhe;
  return {
    x: Math.cos(a) * radius * cfg.x + Math.sin(a * 2.0) * versatz,
    y: ring.y + (hashi(segment, ring.index * 11, seed + 31) - 0.5)
      * cfg.radius * ring.yUnruhe,
    z: Math.sin(a) * radius * cfg.z + Math.cos(a * 3.0) * versatz
  };
}

function farbeFuer(y, cfg, segment, seed) {
  var t = Math.max(0, Math.min(1, -y / cfg.tiefe));
  var farbe = new THREE.Color();
  if (y > -0.32) {
    farbe.copy(FARBE_PLATEAU).lerp(FARBE_KANTE,
      Math.max(0, Math.min(1, (-y - 0.02) * 2.8)));
  } else {
    farbe.copy(FARBE_FELS).lerp(FARBE_TIEFE, t * 0.82);
  }
  farbe.multiplyScalar(0.88 + hashi(segment, Math.round(y * 19), seed + 53) * 0.20);
  return farbe;
}

function dreieck(daten, a, b, c, cfg, segment, seed) {
  var punkte = [a, b, c];
  for (var i = 0; i < 3; i++) {
    var p = punkte[i];
    var farbe = farbeFuer(p.y, cfg, segment + i, seed);
    daten.position.push(p.x, p.y, p.z);
    daten.farbe.push(farbe.r, farbe.g, farbe.b);
    daten.uv.push((p.x / (cfg.radius * cfg.x * 2)) + 0.5,
      (p.z / (cfg.radius * cfg.z * 2)) + 0.5);
  }
}

function facettenKern(cfg, seed) {
  var ringe = [
    { index: 0, radius: cfg.radius * 0.78, y: 0.05, unruhe: 0.035, yUnruhe: 0.012 },
    { index: 1, radius: cfg.radius, y: -0.34, unruhe: 0.055, yUnruhe: 0.025 },
    { index: 2, radius: cfg.radius * cfg.schulter, y: -cfg.tiefe * 0.23,
      unruhe: 0.080, yUnruhe: 0.035 },
    { index: 3, radius: cfg.radius * cfg.taille, y: -cfg.tiefe * 0.58,
      unruhe: 0.095, yUnruhe: 0.045 },
    { index: 4, radius: cfg.radius * cfg.spitze, y: -cfg.tiefe * 0.92,
      unruhe: 0.060, yUnruhe: 0.025 }
  ];
  var rp = ringe.map(function (ring) {
    var ergebnis = [];
    for (var s = 0; s < cfg.segmente; s++) ergebnis.push(punkt(cfg, ring, s, seed));
    return ergebnis;
  });
  var daten = { position: [], farbe: [], uv: [] };
  var mitte = { x: cfg.radius * -0.08, y: 0.12, z: cfg.radius * 0.04 };

  for (var s = 0; s < cfg.segmente; s++) {
    var sn = (s + 1) % cfg.segmente;
    dreieck(daten, mitte, rp[0][sn], rp[0][s], cfg, s, seed);
  }
  for (var r = 0; r < rp.length - 1; r++) {
    for (s = 0; s < cfg.segmente; s++) {
      sn = (s + 1) % cfg.segmente;
      dreieck(daten, rp[r][s], rp[r][sn], rp[r + 1][s], cfg,
        s + r * cfg.segmente, seed);
      dreieck(daten, rp[r][sn], rp[r + 1][sn], rp[r + 1][s], cfg,
        s + r * cfg.segmente + 7, seed);
    }
  }
  var spitze = {
    x: cfg.radius * (hashi(1, 2, seed) - 0.5) * 0.18,
    y: -cfg.tiefe,
    z: cfg.radius * (hashi(3, 4, seed) - 0.5) * 0.18
  };
  for (s = 0; s < cfg.segmente; s++) {
    sn = (s + 1) % cfg.segmente;
    dreieck(daten, rp[rp.length - 1][s], rp[rp.length - 1][sn], spitze,
      cfg, s + 101, seed);
  }

  var geometrie = new THREE.BufferGeometry();
  geometrie.setAttribute('position',
    new THREE.BufferAttribute(new Float32Array(daten.position), 3));
  geometrie.setAttribute('color',
    new THREE.BufferAttribute(new Float32Array(daten.farbe), 3));
  geometrie.setAttribute('uv',
    new THREE.BufferAttribute(new Float32Array(daten.uv), 2));
  geometrie.computeVertexNormals();
  return vollstaendigeAttribute(geometrie);
}

function schichtbaender(cfg, seed) {
  var teile = [];
  var anzahl = cfg === PROFILE.tafel ? 9 : 7;
  for (var i = 0; i < anzahl; i++) {
    var a = i / anzahl * Math.PI * 2 + hashi(i, 3, seed) * 0.25;
    var hoehe = -cfg.tiefe * (0.22 + hashi(i, 7, seed) * 0.48);
    var breite = cfg.radius * (0.45 + hashi(i, 11, seed) * 0.32);
    var tiefe = cfg.radius * (0.08 + hashi(i, 13, seed) * 0.07);
    var dist = cfg.radius * (0.38 + hashi(i, 17, seed) * 0.22);
    teile.push(part(new THREE.BoxGeometry(breite, 0.16, tiefe),
      M(Math.cos(a) * dist * cfg.x, hoehe, Math.sin(a) * dist * cfg.z,
        (hashi(i, 19, seed) - 0.5) * 0.16, -a, (hashi(i, 23, seed) - 0.5) * 0.12),
      i % 2 ? 0x555551 : 0x686761));
  }
  return teile;
}

function gratplatten(cfg, seed) {
  var teile = [];
  var anzahl = cfg === PROFILE.scherbe ? 7 : 5;
  for (var i = 0; i < anzahl; i++) {
    var a = i / anzahl * Math.PI * 2 + 0.37;
    var laenge = cfg.radius * (0.38 + hashi(i, 5, seed) * 0.28);
    teile.push(part(new THREE.BoxGeometry(laenge, 0.14, 0.18),
      M(Math.cos(a) * cfg.radius * 0.42 * cfg.x, 0.15,
        Math.sin(a) * cfg.radius * 0.42 * cfg.z,
        0, -a, (hashi(i, 29, seed) - 0.5) * 0.10),
      i % 2 ? 0x4c5942 : 0x71805b));
  }
  return teile;
}

function plateauDetails(cfg, seed, form) {
  if (form === 'archipel') return [];
  var teile = [];
  for (var i = 0; i < 5; i++) {
    var a = i / 5 * Math.PI * 2 + hashi(i, 107, seed) * 0.38;
    var dist = cfg.radius * (0.38 + hashi(i, 109, seed) * 0.24);
    teile.push(part(new THREE.ConeGeometry(0.5, 1, 4),
      M(Math.cos(a) * dist * cfg.x, 0.13,
        Math.sin(a) * dist * cfg.z, 0, -a,
        (hashi(i, 113, seed) - 0.5) * 0.18,
        cfg.radius * 0.075, 0.30, cfg.radius * 0.040),
      i % 2 ? 0x536449 : 0x78815a));
  }
  for (i = 0; i < 3; i++) {
    a = -0.62 + i * 0.48;
    teile.push(part(new THREE.IcosahedronGeometry(0.5, 0),
      M(Math.sin(a) * cfg.radius * 0.26, 0.12,
        Math.cos(a) * cfg.radius * 0.22,
        i * 0.19, -a, i * 0.11,
        cfg.radius * 0.10, 0.22, cfg.radius * 0.07),
      i === 1 ? FARBE_ADER : FARBE_KANTE.getHex()));
  }
  return teile;
}

function strebeZwischen(a, b, breite, farbe) {
  var start = new THREE.Vector3(a[0], a[1], a[2]);
  var ende = new THREE.Vector3(b[0], b[1], b[2]);
  var richtung = ende.clone().sub(start);
  var laenge = richtung.length();
  var mitte = start.clone().add(ende).multiplyScalar(0.5);
  var rotation = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0), richtung.normalize());
  var matrix = new THREE.Matrix4().compose(mitte, rotation,
    new THREE.Vector3(breite, laenge, breite));
  return part(new THREE.BoxGeometry(1, 1, 1), matrix, farbe);
}

function erdsaum(cfg, seed) {
  var teile = [];
  var anzahl = cfg === PROFILE.tafel ? 10 : 8;
  for (var i = 0; i < anzahl; i++) {
    var a = i / anzahl * Math.PI * 2;
    var dist = cfg.radius * (0.73 + hashi(i, 41, seed) * 0.12);
    var breite = cfg.radius * (0.34 + hashi(i, 43, seed) * 0.22);
    teile.push(part(new THREE.BoxGeometry(1, 1, 1),
      M(Math.cos(a) * dist * cfg.x, -0.18,
        Math.sin(a) * dist * cfg.z, 0, -a,
        (hashi(i, 47, seed) - 0.5) * 0.16,
        breite, 0.22, cfg.radius * 0.16),
      i % 3 ? FARBE_ERDSAUM : 0x5a503f));
  }
  return teile;
}

function unterseitenStrebewerk(cfg, form, seed) {
  var teile = [];
  var anzahl = form === 'tafel' ? 8 : 6;
  for (var i = 0; i < anzahl; i++) {
    var a = i / anzahl * Math.PI * 2 + hashi(i, 53, seed) * 0.22;
    var obenR = cfg.radius * (0.60 + hashi(i, 59, seed) * 0.20);
    var untenR = cfg.radius * (0.16 + hashi(i, 61, seed) * 0.22);
    var oben = [Math.cos(a) * obenR * cfg.x, -cfg.tiefe * 0.18,
      Math.sin(a) * obenR * cfg.z];
    var unten = [Math.cos(a + 0.24) * untenR * cfg.x,
      -cfg.tiefe * (0.66 + hashi(i, 67, seed) * 0.22),
      Math.sin(a + 0.24) * untenR * cfg.z];
    teile.push(strebeZwischen(oben, unten,
      cfg.radius * (i % 2 ? 0.035 : 0.052),
      i % 3 ? FARBE_MINERAL : FARBE_ADER));
  }

  var scherben = form === 'scherbe' ? 7 : 5;
  for (i = 0; i < scherben; i++) {
    a = i / scherben * Math.PI * 2 + 0.31;
    var laenge = cfg.tiefe * (0.22 + hashi(i, 71, seed) * 0.22);
    var radius = cfg.radius * (0.13 + hashi(i, 73, seed) * 0.07);
    var y = -cfg.tiefe * (0.48 + hashi(i, 79, seed) * 0.28);
    teile.push(part(new THREE.ConeGeometry(0.5, 1, form === 'tafel' ? 6 : 5),
      M(Math.cos(a) * cfg.radius * 0.42 * cfg.x, y,
        Math.sin(a) * cfg.radius * 0.42 * cfg.z,
        Math.PI, a * 0.12, (hashi(i, 83, seed) - 0.5) * 0.28,
        radius * 2, laenge, radius * 2),
      i % 2 ? FARBE_SCHATTEN : 0x4a4d4c));
  }

  if (form === 'tafel') {
    // Basaltprismen tragen die breite Platte; ihre gestaffelten Enden
    // verhindern eine weiche, spielzeughafte Kegelsilhouette.
    for (i = 0; i < 6; i++) {
      a = i / 6 * Math.PI * 2 + 0.18;
      laenge = cfg.tiefe * (0.34 + hashi(i, 89, seed) * 0.25);
      teile.push(part(new THREE.CylinderGeometry(0.5, 0.42, 1, 6),
        M(Math.cos(a) * cfg.radius * 0.36 * cfg.x,
          -cfg.tiefe * 0.56,
          Math.sin(a) * cfg.radius * 0.36 * cfg.z,
          0, a, (hashi(i, 97, seed) - 0.5) * 0.10,
          cfg.radius * 0.16, laenge, cfg.radius * 0.16),
        i % 2 ? 0x515554 : FARBE_SCHATTEN));
    }
  }
  return teile;
}

function kernMitDetails(cfg, seed, form) {
  return mergeGeos([
    facettenKern(cfg, seed),
    ...schichtbaender(cfg, seed),
    ...gratplatten(cfg, seed),
    ...erdsaum(cfg, seed),
    ...unterseitenStrebewerk(cfg, form, seed),
    ...plateauDetails(cfg, seed, form)
  ]);
}

function archipelGeometrie() {
  var cfg = PROFILE.archipel;
  var teile = [kernMitDetails(cfg, cfg.seed, 'archipel')];
  var satelliten = [
    [-5.8, -0.9, 2.6, 0.48, 0.62, 0.42],
    [5.1, -1.5, 3.5, 0.38, 0.52, 0.46],
    [4.6, -2.4, -4.2, 0.30, 0.44, 0.34]
  ];
  for (var i = 0; i < satelliten.length; i++) {
    var s = satelliten[i];
    teile.push(transformiereMitEigenfarben(
      facettenKern(cfg, cfg.seed + 101 + i * 17),
      M(s[0], s[1], s[2], 0, i * 0.8, 0, s[3], s[4], s[5])
    ));
  }
  // Mineralische Zugbaender halten die groessten Satelliten optisch
  // zusammen, ohne die Negativraeume des Archipels zu schliessen.
  teile.push(strebeZwischen([-2.4, -2.5, 1.0], [-5.0, -3.6, 2.35],
    0.18, FARBE_ADER));
  teile.push(strebeZwischen([2.3, -2.8, 1.2], [4.7, -4.2, 3.15],
    0.16, FARBE_MINERAL));
  teile.push(strebeZwischen([2.1, -3.3, -1.7], [4.3, -5.0, -3.8],
    0.14, FARBE_SCHATTEN));
  return mergeGeos(teile);
}

export function erzeugeLuftinselGeometrie(form) {
  var id = LUFTINSEL_POOL_IDS[form] ? form : 'fels';
  var cfg = PROFILE[id];
  var geometrie = id === 'archipel'
    ? archipelGeometrie()
    : kernMitDetails(cfg, cfg.seed, id);
  geometrie.userData.terraAssetFamilie = 'luftinsel';
  geometrie.userData.terraLuftinselForm = id;
  geometrie.userData.terraLuftinselPlateauRadius = cfg.radius
    * Math.min(cfg.x, cfg.z) * 0.62;
  geometrie.userData.terraLuftinselBasisRadius = cfg.radius;
  geometrie.userData.terraLuftinselBasisTiefe = cfg.tiefe;
  geometrie.userData.terraArtDirection = 'kantig-erwachsen';
  geometrie.computeBoundingBox();
  geometrie.userData.terraUnterseite = 'facetten-streben-mineral';
  geometrie.userData.terraMaterialZonen = 8;
  geometrie.userData.terraLuftweltFormensprache = 'waldsaeule-a';
  geometrie.userData.terraLuftweltFormDetails = id === 'archipel' ? 3 : 8;
  geometrie.computeBoundingSphere();
  return geometrie;
}

/**
 * Registry-Haken. geometry.js ruft ihn nach den bestehenden Poolwellen auf;
 * das Modul selbst registriert beim Import absichtlich nichts.
 */
export function registriereLuftinselPools(definePool) {
  if (typeof definePool !== 'function') {
    throw new TypeError('registriereLuftinselPools braucht definePool');
  }
  var radien = { fels: 6.3, scherbe: 6.25, tafel: 9.75, archipel: 9.4 };
  for (var i = 0; i < LUFTINSEL_FORMEN.length; i++) {
    var form = LUFTINSEL_FORMEN[i];
    definePool(LUFTINSEL_POOL_IDS[form], erzeugeLuftinselGeometrie(form), {
      radius: radien[form],
      ao: 0.34,
      familie: 'stein',
      sichtbarBis: 600
    });
  }
  return LUFTINSEL_FORMEN.map(function (form) {
    return LUFTINSEL_POOL_IDS[form];
  });
}
