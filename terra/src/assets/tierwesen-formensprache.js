/* Waldsaeule-A-Tierwesen: sieben zusammenhaengende, anatomisch lesbare Pools. */
import * as THREE from 'three';
import { M, mergeGeos, part } from './geometrie-hilfen.js';

export const TIERWESEN_FORMSPRACHE_POOLS = Object.freeze([
  'pferd', 'rind', 'schaf', 'ziege', 'moewe',
  'ochsengespann', 'rankengleiter'
]);

var KUGEL = new THREE.IcosahedronGeometry(0.5, 1);
var KUGEL_KLEIN = new THREE.IcosahedronGeometry(0.5, 0);
var KEGEL = new THREE.ConeGeometry(0.5, 1, 6, 1, false);
var ZYLINDER = new THREE.CylinderGeometry(0.42, 0.5, 1, 7, 1, false);
var BOX = new THREE.BoxGeometry(1, 1, 1);
var TORUS = new THREE.TorusGeometry(0.5, 0.08, 5, 12);
var Y_ACHSE = new THREE.Vector3(0, 1, 0);
var PI = Math.PI;

var FELL = 0xa86f42;
var FELL_HELL = 0xc48b56;
var FELL_DUNKEL = 0x5a4031;
var HUF = 0x332d29;
var AUGE = 0x202622;
var HORN = 0xd8c9a5;
var WOLLE = 0xe1dccb;
var HOLZ = 0x8b653f;
var HOLZ_DUNKEL = 0x594331;
var BLATT = 0x628253;
var BLATT_HELL = 0x91aa70;

function ellipsoid(parts, x, y, z, sx, sy, sz, farbe, rx, ry, rz, klein) {
  parts.push(part(klein ? KUGEL_KLEIN : KUGEL,
    M(x, y, z, rx, ry, rz, sx, sy, sz), farbe));
}

function kasten(parts, x, y, z, sx, sy, sz, farbe, rx, ry, rz) {
  parts.push(part(BOX, M(x, y, z, rx, ry, rz, sx, sy, sz), farbe));
}

function kegel(parts, x, y, z, sx, sy, sz, farbe, rx, ry, rz) {
  parts.push(part(KEGEL, M(x, y, z, rx, ry, rz, sx, sy, sz), farbe));
}

function segment(parts, ax, ay, az, bx, by, bz, radius, farbe) {
  var anfang = new THREE.Vector3(ax, ay, az);
  var ende = new THREE.Vector3(bx, by, bz);
  var richtung = ende.clone().sub(anfang);
  var laenge = richtung.length();
  if (laenge < 1e-6) return;
  var matrix = new THREE.Matrix4();
  matrix.compose(
    anfang.add(ende).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(Y_ACHSE, richtung.normalize()),
    new THREE.Vector3(radius * 2, laenge, radius * 2)
  );
  parts.push(part(ZYLINDER, matrix, farbe));
}

function flaeche(parts, punkte, farbe) {
  var positionen = [];
  for (var i = 1; i < punkte.length - 1; i++) {
    positionen.push(...punkte[0], ...punkte[i], ...punkte[i + 1]);
  }
  var geometrie = new THREE.BufferGeometry();
  geometrie.setAttribute('position', new THREE.Float32BufferAttribute(positionen, 3));
  geometrie.computeVertexNormals();
  parts.push(part(geometrie, null, farbe));
}

function augen(parts, x, y, z, breite, groesse) {
  for (var s = -1; s <= 1; s += 2) {
    var seitlich = breite * 0.72;
    ellipsoid(parts, x + s * seitlich, y, z, groesse, groesse, groesse,
      AUGE, 0, 0, 0, true);
    ellipsoid(parts, x + s * (seitlich + groesse * 0.04), y + groesse * 0.18,
      z + groesse * 0.28, groesse * 0.25, groesse * 0.25, groesse * 0.2,
      0xf3ead7, 0, 0, 0, true);
  }
}

function ohren(parts, x, y, z, breite, hoehe, farbe, neigung) {
  for (var s = -1; s <= 1; s += 2) {
    kegel(parts, x + s * breite, y, z, breite * 0.75, hoehe, breite * 0.58,
      farbe, neigung || 0, 0, s * 0.22);
  }
}

function huftierBeine(parts, daten, farbe) {
  for (var i = 0; i < daten.length; i++) {
    var bein = daten[i];
    segment(parts, bein[0], bein[1], bein[2], bein[3], bein[4], bein[5],
      bein[6], farbe);
    segment(parts, bein[3], bein[4], bein[5], bein[7], bein[8], bein[9],
      bein[6] * 0.78, farbe);
    ellipsoid(parts, bein[7], bein[8] + 0.035, bein[9] + 0.035,
      bein[6] * 3.0, bein[6] * 1.4, bein[6] * 3.8, HUF, 0, 0, 0, true);
  }
}

function schweif(parts, ax, ay, az, farbe, laenge) {
  segment(parts, ax, ay, az, ax, ay - laenge * 0.35, az - laenge * 0.45,
    laenge * 0.07, farbe);
  segment(parts, ax, ay - laenge * 0.35, az - laenge * 0.45,
    ax, ay - laenge, az - laenge * 0.62, laenge * 0.055, farbe);
  kegel(parts, ax, ay - laenge * 0.93, az - laenge * 0.62,
    laenge * 0.2, laenge * 0.52, laenge * 0.2, farbe, 0.38, 0, PI);
}

function pferd() {
  var p = [];
  ellipsoid(p, 0, 1.18, 0, 1.02, 0.88, 2.05, FELL, 0, 0, 0);
  ellipsoid(p, 0, 1.3, 0.58, 1.08, 1.0, 0.86, FELL_HELL, -0.08, 0, 0);
  ellipsoid(p, 0, 1.28, -0.62, 1.06, 0.96, 0.92, FELL, 0.05, 0, 0);
  segment(p, 0, 1.43, 0.52, 0, 1.88, 0.93, 0.29, FELL_HELL);
  ellipsoid(p, 0, 2.03, 1.12, 0.64, 0.58, 0.82, FELL_HELL, -0.18, 0, 0);
  ellipsoid(p, 0, 1.94, 1.54, 0.43, 0.32, 0.72, 0xb77c4e, -0.08, 0, 0);
  ohren(p, 0, 2.42, 1.03, 0.19, 0.52, FELL_DUNKEL, -0.12);
  augen(p, 0, 2.12, 1.4, 0.25, 0.078);
  ellipsoid(p, -0.1, 1.98, 1.85, 0.045, 0.032, 0.03, 0x4a3328, 0, 0, 0, true);
  ellipsoid(p, 0.1, 1.98, 1.85, 0.045, 0.032, 0.03, 0x4a3328, 0, 0, 0, true);
  huftierBeine(p, [
    [-0.34, 1.05, 0.56, -0.37, 0.58, 0.62, 0.105, -0.35, 0.08, 0.72],
    [0.34, 1.05, 0.56, 0.31, 0.58, 0.49, 0.105, 0.34, 0.08, 0.43],
    [-0.35, 1.02, -0.55, -0.3, 0.55, -0.63, 0.11, -0.37, 0.08, -0.72],
    [0.35, 1.02, -0.55, 0.39, 0.56, -0.48, 0.11, 0.34, 0.08, -0.42]
  ], FELL_DUNKEL);
  for (var i = 0; i < 5; i++) {
    kegel(p, 0, 2.13 - i * 0.18, 0.82 - i * 0.16,
      0.22, 0.34, 0.16, FELL_DUNKEL, 0.75, 0, PI);
  }
  schweif(p, 0, 1.48, -0.92, FELL_DUNKEL, 0.82);
  return p;
}

function rindKoerper(p, ox, oz, skala, farbe) {
  ellipsoid(p, ox, 0.95 * skala, oz, 1.22 * skala, 0.9 * skala,
    1.75 * skala, farbe, 0, 0, 0);
  ellipsoid(p, ox, 1.05 * skala, oz + 0.54 * skala,
    1.26 * skala, 1.0 * skala, 0.82 * skala, farbe, -0.08, 0, 0);
  segment(p, ox, 1.12 * skala, oz + 0.55 * skala,
    ox, 1.38 * skala, oz + 0.86 * skala, 0.31 * skala, farbe);
  ellipsoid(p, ox, 1.43 * skala, oz + 1.08 * skala,
    0.82 * skala, 0.65 * skala, 0.72 * skala, farbe, -0.15, 0, 0);
  ellipsoid(p, ox, 1.34 * skala, oz + 1.4 * skala,
    0.58 * skala, 0.34 * skala, 0.56 * skala, 0xb58b66, 0, 0, 0);
  augen(p, ox, 1.52 * skala, oz + 1.49 * skala,
    0.27 * skala, 0.065 * skala);
  for (var n = -1; n <= 1; n += 2) {
    ellipsoid(p, ox + n * 0.12 * skala, 1.35 * skala,
      oz + 1.68 * skala, 0.055 * skala, 0.034 * skala,
      0.03 * skala, 0x49362d, 0, 0, 0, true);
  }
  ohren(p, ox, 1.69 * skala, oz + 1.04 * skala,
    0.24 * skala, 0.38 * skala, farbe, -0.42);
  for (var s = -1; s <= 1; s += 2) {
    segment(p, ox + s * 0.24 * skala, 1.68 * skala, oz + 1.05 * skala,
      ox + s * 0.42 * skala, 1.82 * skala, oz + 1.12 * skala,
      0.055 * skala, HORN);
    kegel(p, ox + s * 0.46 * skala, 1.85 * skala, oz + 1.14 * skala,
      0.1 * skala, 0.22 * skala, 0.1 * skala, HORN, 0, 0, -s * 0.82);
  }
  var bx = 0.42 * skala, rz = 0.49 * skala;
  huftierBeine(p, [
    [ox - bx, 0.83 * skala, oz + rz, ox - bx, 0.46 * skala, oz + rz, 0.11 * skala, ox - bx, 0.07 * skala, oz + rz + 0.04],
    [ox + bx, 0.83 * skala, oz + rz, ox + bx, 0.46 * skala, oz + rz, 0.11 * skala, ox + bx, 0.07 * skala, oz + rz - 0.04],
    [ox - bx, 0.82 * skala, oz - rz, ox - bx, 0.45 * skala, oz - rz, 0.11 * skala, ox - bx, 0.07 * skala, oz - rz - 0.04],
    [ox + bx, 0.82 * skala, oz - rz, ox + bx, 0.45 * skala, oz - rz, 0.11 * skala, ox + bx, 0.07 * skala, oz - rz + 0.04]
  ], FELL_DUNKEL);
  schweif(p, ox, 1.12 * skala, oz - 0.83 * skala, FELL_DUNKEL, 0.58 * skala);
}

function rind() {
  var p = [];
  rindKoerper(p, 0, -0.08, 1, 0x8f6346);
  ellipsoid(p, -0.38, 1.08, 0.04, 0.5, 0.46, 0.7, 0xd0b896, 0, 0, 0);
  ellipsoid(p, 0.32, 0.82, -0.52, 0.45, 0.35, 0.55, 0x6f4937, 0, 0, 0);
  return p;
}

function schaf() {
  var p = [];
  ellipsoid(p, 0, 0.68, 0, 0.92, 0.72, 1.35, 0xd3cdbb, 0, 0, 0);
  var lagen = [
    [-0.27, 0.8, -0.38], [0.24, 0.82, -0.34], [-0.3, 0.78, 0.1],
    [0.28, 0.82, 0.12], [-0.22, 0.78, 0.48], [0.2, 0.82, 0.48],
    [0, 1.03, -0.38], [0, 1.08, 0.02], [0, 1.04, 0.42]
  ];
  for (var i = 0; i < lagen.length; i++) {
    ellipsoid(p, lagen[i][0], lagen[i][1], lagen[i][2],
      0.55, 0.48, 0.56, i % 2 ? WOLLE : 0xeee9dc, 0, i * 0.41, 0);
  }
  segment(p, 0, 0.76, 0.48, 0, 0.86, 0.78, 0.18, 0x4b4139);
  ellipsoid(p, 0, 0.88, 0.92, 0.48, 0.44, 0.56, 0x4b4139, -0.12, 0, 0);
  ellipsoid(p, 0, 0.8, 1.18, 0.32, 0.24, 0.36, 0x55463c, 0, 0, 0);
  ohren(p, 0, 1.04, 0.91, 0.16, 0.29, 0x4b4139, -0.62);
  augen(p, 0, 0.96, 1.15, 0.17, 0.055);
  huftierBeine(p, [
    [-0.27, 0.58, 0.37, -0.28, 0.34, 0.38, 0.07, -0.28, 0.06, 0.41],
    [0.27, 0.58, 0.37, 0.28, 0.34, 0.35, 0.07, 0.28, 0.06, 0.32],
    [-0.27, 0.58, -0.36, -0.28, 0.34, -0.37, 0.07, -0.28, 0.06, -0.4],
    [0.27, 0.58, -0.36, 0.28, 0.34, -0.34, 0.07, 0.28, 0.06, -0.31]
  ], 0x4b4139);
  return p;
}

function ziege() {
  var p = [];
  ellipsoid(p, 0, 0.78, 0, 0.78, 0.62, 1.28, 0xa57a55, 0, 0, 0);
  ellipsoid(p, 0, 0.88, 0.42, 0.8, 0.7, 0.68, 0xb78c61, -0.06, 0, 0);
  segment(p, 0, 0.92, 0.42, 0, 1.16, 0.72, 0.19, 0xb78c61);
  ellipsoid(p, 0, 1.24, 0.92, 0.52, 0.48, 0.62, 0xb78c61, -0.16, 0, 0);
  ellipsoid(p, 0, 1.13, 1.19, 0.42, 0.3, 0.42, 0x9b704e, 0, 0, 0);
  ohren(p, 0, 1.45, 0.91, 0.2, 0.35, 0x8f6447, -0.45);
  augen(p, 0, 1.31, 1.16, 0.18, 0.055);
  for (var s = -1; s <= 1; s += 2) {
    segment(p, s * 0.14, 1.46, 0.9, s * 0.19, 1.62, 0.74, 0.038, HORN);
    segment(p, s * 0.19, 1.62, 0.74, s * 0.21, 1.69, 0.56, 0.03, HORN);
  }
  kegel(p, 0, 1.0, 1.08, 0.2, 0.42, 0.18, FELL_DUNKEL, 0.4, 0, PI);
  huftierBeine(p, [
    [-0.25, 0.66, 0.35, -0.27, 0.36, 0.38, 0.075, -0.28, 0.06, 0.42],
    [0.25, 0.66, 0.35, 0.27, 0.36, 0.32, 0.075, 0.28, 0.06, 0.29],
    [-0.25, 0.66, -0.36, -0.27, 0.36, -0.38, 0.075, -0.28, 0.06, -0.42],
    [0.25, 0.66, -0.36, 0.27, 0.36, -0.32, 0.075, 0.28, 0.06, -0.29]
  ], 0x5e4537);
  segment(p, 0, 0.9, -0.58, 0, 1.08, -0.78, 0.055, FELL_DUNKEL);
  return p;
}

function moewe() {
  var p = [];
  ellipsoid(p, 0, 0.2, 0, 0.34, 0.28, 0.78, 0xf0ede3, 0.12, 0, 0);
  ellipsoid(p, 0, 0.32, 0.36, 0.34, 0.32, 0.38, 0xf6f2e8, 0, 0, 0);
  kegel(p, 0, 0.27, 0.68, 0.15, 0.34, 0.12, 0xd8a447, PI / 2, 0, 0);
  augen(p, 0, 0.38, 0.56, 0.105, 0.032);
  flaeche(p, [[-0.12, 0.28, 0.1], [-1.0, 0.5, -0.12], [-0.7, 0.18, -0.35], [-0.1, 0.12, -0.24]], 0xe8e4da);
  flaeche(p, [[0.12, 0.28, 0.1], [1.0, 0.5, -0.12], [0.7, 0.18, -0.35], [0.1, 0.12, -0.24]], 0xd9d8d2);
  flaeche(p, [[-1.0, 0.5, -0.12], [-0.72, 0.4, -0.2], [-0.7, 0.18, -0.35]], 0x667078);
  flaeche(p, [[1.0, 0.5, -0.12], [0.72, 0.4, -0.2], [0.7, 0.18, -0.35]], 0x59656d);
  flaeche(p, [[-0.12, 0.18, -0.34], [0, 0.2, -0.76], [0.12, 0.18, -0.34]], 0xe7e2d7);
  segment(p, -0.08, 0.08, -0.31, -0.13, -0.18, -0.39, 0.025, 0xb78a48);
  segment(p, 0.08, 0.08, -0.31, 0.13, -0.18, -0.39, 0.025, 0xb78a48);
  return p;
}

function ochsengespann() {
  var p = [];
  kasten(p, 0, 0.72, -1.15, 1.45, 0.26, 2.0, HOLZ);
  kasten(p, -0.68, 1.02, -1.15, 0.12, 0.62, 2.0, HOLZ_DUNKEL);
  kasten(p, 0.68, 1.02, -1.15, 0.12, 0.62, 2.0, HOLZ_DUNKEL);
  kasten(p, 0, 0.86, -2.1, 1.35, 0.55, 0.12, 0x9b7448);
  for (var s = -1; s <= 1; s += 2) {
    p.push(part(TORUS, M(s * 0.78, 0.52, -1.35, 0, PI / 2, 0,
      0.92, 0.92, 0.92), HOLZ_DUNKEL));
    segment(p, s * 0.78, 0.52, -1.35, -s * 0.1, 0.52, -1.35, 0.06, HOLZ);
  }
  kasten(p, 0, 0.76, 0.15, 0.12, 0.12, 2.3, HOLZ);
  kasten(p, 0, 1.15, 1.02, 1.55, 0.13, 0.14, HOLZ_DUNKEL);
  rindKoerper(p, -0.52, 1.35, 0.74, 0x9b704d);
  rindKoerper(p, 0.52, 1.35, 0.74, 0xb1845d);
  segment(p, -0.52, 1.2, 1.85, 0.52, 1.2, 1.85, 0.06, HOLZ_DUNKEL);
  return p;
}

function rankengleiter() {
  var p = [];
  ellipsoid(p, 0, 2.4, -0.05, 2.35, 1.05, 3.05, 0xd7d7ae, 0, 0, 0);
  for (var r = -1; r <= 1; r++) {
    ellipsoid(p, r * 0.43, 2.49, -0.08, 0.92, 0.72, 2.48,
      r === 0 ? 0xe9e4bd : 0xd1d3a7, 0, 0, 0);
  }
  segment(p, 0, 2.05, -1.22, 0, 2.78, 0.95, 0.06, 0xa2aa70);
  ellipsoid(p, 0, 0.72, 0, 0.82, 0.5, 1.7, 0x8a643e, 0, 0, 0);
  kasten(p, 0, 0.94, 0.05, 0.75, 0.16, 1.3, HOLZ_DUNKEL);
  segment(p, -0.32, 1.02, -0.48, -0.32, 1.28, -0.48, 0.025, HOLZ_DUNKEL);
  segment(p, 0.32, 1.02, -0.48, 0.32, 1.28, -0.48, 0.025, HOLZ_DUNKEL);
  segment(p, -0.32, 1.28, -0.48, 0.32, 1.28, -0.48, 0.025, HOLZ_DUNKEL);
  ellipsoid(p, 0, 0.72, 0.84, 0.2, 0.2, 0.12, 0xf0bd63, 0, 0, 0, true);
  flaeche(p, [[-0.24, 0.98, 0.5], [-1.75, 0.92, 0.2], [-1.25, 0.72, -0.62], [-0.18, 0.82, -0.42]], BLATT_HELL);
  flaeche(p, [[0.24, 0.98, 0.5], [1.75, 0.92, 0.2], [1.25, 0.72, -0.62], [0.18, 0.82, -0.42]], BLATT);
  segment(p, -0.16, 0.9, 0.12, -1.58, 0.87, -0.05, 0.045, 0x4e6d44);
  segment(p, 0.16, 0.9, 0.12, 1.58, 0.87, -0.05, 0.045, 0x4e6d44);
  for (var s = -1; s <= 1; s += 2) {
    segment(p, s * 0.28, 0.92, 0.48, s * 0.58, 2.0, 0.7, 0.035, HOLZ_DUNKEL);
    segment(p, s * 0.28, 0.92, -0.48, s * 0.58, 2.0, -0.78, 0.035, HOLZ_DUNKEL);
  }
  segment(p, 0, 0.62, -0.78, 0.08, 0.25, -1.3, 0.07, 0x4d6c45);
  segment(p, 0.08, 0.25, -1.3, -0.05, -0.08, -1.62, 0.045, 0x4d6c45);
  kegel(p, -0.18, 0.17, -1.44, 0.42, 0.18, 0.2, BLATT_HELL, 0, 0, 1.0);
  kegel(p, 0.13, -0.02, -1.65, 0.35, 0.16, 0.18, BLATT, 0, 0, -1.0);
  return p;
}

var BAUER = Object.freeze({ pferd, rind, schaf, ziege, moewe, ochsengespann, rankengleiter });

export function veredleTierwesenFormensprache(name, geo) {
  var bauer = BAUER[name];
  if (!bauer) return geo;
  var teile = bauer();
  var ergebnis = mergeGeos(teile);
  ergebnis.userData.bestandKatalogName = name;
  ergebnis.userData.bestandKatalogFamilie = name === 'rankengleiter' || name === 'moewe'
    ? 'schwebend' : 'tiere';
  ergebnis.userData.bestandKatalogFormensprache = 'waldsaeule-a';
  ergebnis.userData.bestandKatalogFormDetails = teile.length;
  ergebnis.userData.tierwesenFormensprache = 'waldsaeule-a';
  ergebnis.userData.tierwesenFormDetails = teile.length;
  return ergebnis;
}
