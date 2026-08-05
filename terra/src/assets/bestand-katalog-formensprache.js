/* ========================================================================== 
   Waldsaeule-A-Formensprache fuer den 149er-Bestandskatalog

   Jede der 15 semantischen Familien bekommt einen eigenen Aufbau. Die
   Details werden in die bestehende BufferGeometry gebacken; damit bleiben
   Pool-IDs, Instancing, Karten und Draw-Call-Vertrag unangetastet.
   ========================================================================== */
import * as THREE from 'three';
import { M, farbton, mergeGeos, part } from './geometrie-hilfen.js';
import {
  BESTAND_KATALOG_FAMILIEN,
  BESTAND_KATALOG_VERFEINERTE_POOLS
} from './bestand-katalog-veredelung.js';

export var BESTAND_KATALOG_FORMSPRACHE_POOLS = BESTAND_KATALOG_VERFEINERTE_POOLS;

var BOX = new THREE.BoxGeometry(1, 1, 1);
var CY6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1, false);
var CO5 = new THREE.ConeGeometry(0.5, 1, 5, 1, false);
var IC0 = new THREE.IcosahedronGeometry(0.5, 0);
var TORUS = new THREE.TorusGeometry(0.5, 0.11, 4, 8);
var PI = Math.PI;

var ZU_FAMILIE = Object.create(null);
Object.keys(BESTAND_KATALOG_FAMILIEN).forEach(function (familie) {
  BESTAND_KATALOG_FAMILIEN[familie].forEach(function (name) {
    ZU_FAMILIE[name] = familie;
  });
});

function hash(name) {
  var wert = 2166136261;
  for (var i = 0; i < name.length; i++) {
    wert ^= name.charCodeAt(i);
    wert = Math.imul(wert, 16777619);
  }
  return wert >>> 0;
}

function grenzen(geo) {
  if (!geo.boundingBox) geo.computeBoundingBox();
  var b = geo.boundingBox;
  return {
    minY: b.min.y, maxY: b.max.y,
    cx: (b.min.x + b.max.x) * 0.5,
    cz: (b.min.z + b.max.z) * 0.5,
    sx: Math.max(0.42, b.max.x - b.min.x),
    sy: Math.max(0.42, b.max.y - b.min.y),
    sz: Math.max(0.42, b.max.z - b.min.z)
  };
}

function teil(basis, matrix, farbe, wind) {
  var geo = part(basis, matrix, farbe);
  var uv = geo.attributes.uv.array;
  var gewicht = wind === undefined ? 0.008 : wind;
  for (var i = 0; i < geo.attributes.uv.count; i++) {
    uv[i * 2] = 0.5;
    uv[i * 2 + 1] = gewicht;
  }
  return geo;
}

function kasten(x, y, z, rx, ry, rz, sx, sy, sz, farbe) {
  return teil(BOX, M(x, y, z, rx, ry, rz, sx, sy, sz), farbe);
}

function stab(x, y, z, rx, ry, rz, sx, sy, sz, farbe, wind) {
  return teil(CY6, M(x, y, z, rx, ry, rz, sx, sy, sz), farbe, wind);
}

function spitze(x, y, z, rx, ry, rz, sx, sy, sz, farbe, wind) {
  return teil(CO5, M(x, y, z, rx, ry, rz, sx, sy, sz), farbe, wind);
}

function knolle(x, y, z, rx, ry, rz, sx, sy, sz, farbe, wind) {
  return teil(IC0, M(x, y, z, rx, ry, rz, sx, sy, sz), farbe, wind);
}

function ring(x, y, z, rx, ry, rz, sx, sy, sz, farbe) {
  return teil(TORUS, M(x, y, z, rx, ry, rz, sx, sy, sz), farbe);
}

function bodenSteine(b, seed, farbe, anzahl) {
  var parts = [];
  var basis = Math.min(b.sx, b.sz);
  for (var i = 0; i < anzahl; i++) {
    var a = i * 2.399 + seed * 0.001;
    var d = basis * (0.31 + (i % 3) * 0.09);
    var r = basis * (0.09 + (i % 4) * 0.018);
    parts.push(knolle(b.cx + Math.cos(a) * d, b.minY + r * 0.34,
      b.cz + Math.sin(a) * d, a * 0.1, a, -a * 0.05,
      r * 1.35, r * 0.62, r, farbton(farbe, i % 2 ? 0.86 : 1.08)));
  }
  return parts;
}

function naturPilz(name, b, seed) {
  var parts = bodenSteine(b, seed, 0x77746a, 4);
  var pilz = /pilz/.test(name);
  for (var i = 0; i < (pilz ? 5 : 3); i++) {
    var a = i * 2.399 + seed * 0.002;
    var x = b.cx + Math.cos(a) * b.sx * (0.18 + i % 2 * 0.07);
    var z = b.cz + Math.sin(a) * b.sz * (0.18 + i % 2 * 0.07);
    var h = b.sy * (0.22 + (i % 3) * 0.05);
    parts.push(stab(x, b.minY + h * 0.5, z, 0.05, 0, -0.08,
      b.sx * 0.035, h, b.sz * 0.035, pilz ? 0xd8c8a5 : 0x5f7448, 0.42));
    parts.push(knolle(x, b.minY + h, z, 0, a, 0,
      b.sx * 0.16, b.sy * 0.065, b.sz * 0.14,
      pilz ? (i % 2 ? 0xc36b54 : 0xdaa565) : 0x7b9654, 0.72));
  }
  if (/geysir|schlamm|lava/.test(name)) {
    parts.push(ring(b.cx, b.minY + b.sy * 0.04, b.cz, PI / 2, 0, 0,
      b.sx * 0.44, b.sy * 0.09, b.sz * 0.44,
      name === 'lavaspalte' ? 0xd36e3e : 0x83aaa0));
  }
  return parts;
}

function ruinen(name, b, seed) {
  var parts = bodenSteine(b, seed, 0x8d8473, 7);
  var seite = seed % 2 ? 1 : -1;
  parts.push(kasten(b.cx + seite * b.sx * 0.34, b.minY + b.sy * 0.24, b.cz,
    0.08, seed * 0.002, seite * 0.12,
    b.sx * 0.16, b.sy * 0.48, b.sz * 0.22, 0x716c61));
  parts.push(kasten(b.cx + seite * b.sx * 0.22, b.minY + b.sy * 0.5, b.cz,
    0.15, -seite * 0.18, 0.2, b.sx * 0.42, b.sy * 0.1, b.sz * 0.2, 0xaaa08a));
  if (!/riss|bruchkante|truemmer/.test(name)) {
    parts.push(stab(b.cx - seite * b.sx * 0.29, b.minY + b.sy * 0.32,
      b.cz + b.sz * 0.16, 0.12, 0, -seite * 0.18,
      b.sx * 0.025, b.sy * 0.56, b.sz * 0.025, 0x526c43, 0.58));
  }
  return parts;
}

function arbor(name, b, seed) {
  var parts = [];
  var blatt = /blatt|kanzel|steg/.test(name);
  for (var i = 0; i < 7; i++) {
    var a = i * 2.399 + seed * 0.0015;
    var d = Math.min(b.sx, b.sz) * (0.15 + i % 3 * 0.09);
    var y = b.minY + b.sy * (0.12 + i % 4 * 0.12);
    parts.push(stab(b.cx + Math.cos(a) * d, y, b.cz + Math.sin(a) * d,
      0.18 * Math.sin(a), 0, -0.19 * Math.cos(a),
      b.sx * 0.04, b.sy * 0.48, b.sz * 0.04, i % 2 ? 0x496a3f : 0x617d47, 0.62));
    parts.push(knolle(b.cx + Math.cos(a) * d * 1.15, y + b.sy * 0.2,
      b.cz + Math.sin(a) * d * 1.15, a * 0.08, a, 0,
      b.sx * (blatt ? 0.25 : 0.18), b.sy * 0.075, b.sz * 0.2,
      i % 3 === 0 ? 0xa2b96a : (i % 2 ? 0x6e9856 : 0x3e7149), 0.78));
  }
  if (/tor|bogen/.test(name)) {
    for (var j = 0; j < 6; j++) {
      var stufe = j % 3;
      var seite = j < 3 ? -1 : 1;
      var x = b.cx + seite * b.sx * (0.38 - stufe * 0.055);
      var y = b.minY + b.sy * (0.19 + stufe * 0.24);
      parts.push(stab(x, y, b.cz - b.sz * 0.05, 0, 0,
        seite * (0.12 + stufe * 0.14), b.sx * 0.035, b.sy * 0.34,
        b.sz * 0.035, stufe % 2 ? 0x496a3f : 0x6d914f, 0.66));
      parts.push(knolle(x - seite * b.sx * 0.055, y + b.sy * 0.15, b.cz,
        0, seed * 0.001 + j, 0, b.sx * 0.15, b.sy * 0.06, b.sz * 0.13, 0x83a95b, 0.8));
    }
  }
  if (/licht|sporen|samen|reliquiar/.test(name)) {
    parts.push(knolle(b.cx, b.maxY + b.sy * 0.06, b.cz, 0, seed * 0.01, 0,
      b.sx * 0.17, b.sy * 0.12, b.sz * 0.17, 0xf2d98a, 0.84));
  }
  return parts;
}

function eis(name, b, seed) {
  var parts = bodenSteine(b, seed, 0xb8d8de, 6);
  for (var i = 0; i < 4; i++) {
    var a = i * 1.57 + seed * 0.002;
    parts.push(spitze(b.cx + Math.cos(a) * b.sx * 0.33,
      b.minY + b.sy * 0.18, b.cz + Math.sin(a) * b.sz * 0.31,
      0.04, a, (i % 2 ? 1 : -1) * 0.12,
      b.sx * 0.13, b.sy * 0.36, b.sz * 0.13,
      i % 2 ? 0xdcecef : 0x91bec9));
  }
  if (/pelz|geweih|schlitten/.test(name)) {
    parts.push(kasten(b.cx, b.minY + b.sy * 0.11, b.cz + b.sz * 0.38,
      0, seed * 0.002, 0.04, b.sx * 0.62, b.sy * 0.1, b.sz * 0.18, 0x805d42));
  }
  return parts;
}

function wueste(name, b, seed) {
  var parts = [];
  for (var i = 0; i < 6; i++) {
    var a = i * 2.399 + seed * 0.001;
    parts.push(knolle(b.cx + Math.cos(a) * b.sx * 0.34, b.minY + b.sy * 0.025,
      b.cz + Math.sin(a) * b.sz * 0.3, 0, a, 0,
      b.sx * 0.24, b.sy * 0.055, b.sz * 0.2, i % 2 ? 0xd3ab68 : 0xb88650));
  }
  if (/zelt/.test(name)) {
    for (var k = 0; k < 3; k++) {
      var s = k - 1;
      parts.push(stab(b.cx + s * b.sx * 0.33, b.minY + b.sy * 0.23,
        b.cz + b.sz * 0.36, 0.1, 0, s * 0.09,
        b.sx * 0.025, b.sy * 0.46, b.sz * 0.025, 0x75533a));
    }
  } else {
    parts.push(knolle(b.cx + b.sx * 0.34, b.minY + b.sy * 0.2, b.cz,
      0, seed * 0.01, 0, b.sx * 0.2, b.sy * 0.16, b.sz * 0.2,
      /palme|oase|traenke/.test(name) ? 0x668f54 : 0xc98954));
  }
  return parts;
}

function moor(name, b, seed) {
  var parts = bodenSteine(b, seed, 0x574d3e, 5);
  for (var i = 0; i < 7; i++) {
    var x = b.cx + (i - 3) * b.sx * 0.09;
    var h = b.sy * (0.28 + i % 3 * 0.08);
    parts.push(stab(x, b.minY + h * 0.5, b.cz + b.sz * 0.36,
      0.05, 0, (i % 2 ? 1 : -1) * 0.11,
      b.sx * 0.02, h, b.sz * 0.02, 0x536746, 0.76));
  }
  if (name === 'irrlicht') {
    parts.push(knolle(b.cx, b.maxY + b.sy * 0.08, b.cz, 0, 0, 0,
      b.sx * 0.17, b.sy * 0.13, b.sz * 0.17, 0xc8e9ae, 0.88));
  }
  return parts;
}

function hof(name, b, seed) {
  var parts = bodenSteine(b, seed, 0x83725a, 4);
  var stroh = /garbe|heu|dresch/.test(name);
  for (var i = 0; i < 4; i++) {
    var s = i % 2 ? 1 : -1;
    parts.push(stab(b.cx + s * b.sx * (0.25 + i * 0.025),
      b.minY + b.sy * (0.19 + i % 2 * 0.05), b.cz + (i - 1.5) * b.sz * 0.12,
      0.08, 0, s * 0.12, b.sx * 0.035, b.sy * 0.42, b.sz * 0.035,
      stroh ? 0xc69b50 : 0x765039));
  }
  parts.push(kasten(b.cx, b.minY + b.sy * 0.08, b.cz - b.sz * 0.42,
    0, seed * 0.001, 0.04, b.sx * 0.72, b.sy * 0.07, b.sz * 0.16,
    stroh ? 0xd2ad60 : 0x8d6843));
  return parts;
}

function handwerk(name, b, seed) {
  var parts = bodenSteine(b, seed, 0x62584e, 5);
  var heiss = /schmiede|ofen|meiler|glashuette/.test(name);
  parts.push(kasten(b.cx - b.sx * 0.34, b.minY + b.sy * 0.23, b.cz,
    0.05, seed * 0.001, -0.08, b.sx * 0.14, b.sy * 0.46, b.sz * 0.2, 0x59463a));
  parts.push(stab(b.cx + b.sx * 0.32, b.minY + b.sy * 0.27, b.cz + b.sz * 0.18,
    PI / 2, 0, 0, b.sx * 0.06, b.sy * 0.52, b.sz * 0.06, 0x8c633e));
  if (heiss) {
    parts.push(knolle(b.cx, b.minY + b.sy * 0.1, b.cz + b.sz * 0.38,
      0, seed * 0.01, 0, b.sx * 0.18, b.sy * 0.11, b.sz * 0.18, 0xe08346));
  }
  if (name === 'schmiede') {
    parts.push(kasten(b.cx - b.sx * 0.18, b.minY + b.sy * 0.16,
      b.cz + b.sz * 0.5, 0, 0, 0, b.sx * 0.12, b.sy * 0.25, b.sz * 0.12, 0x4f5350));
    parts.push(kasten(b.cx - b.sx * 0.18, b.minY + b.sy * 0.31,
      b.cz + b.sz * 0.5, 0, 0, 0, b.sx * 0.31, b.sy * 0.08, b.sz * 0.18, 0x676b67));
    parts.push(stab(b.cx + b.sx * 0.12, b.minY + b.sy * 0.29,
      b.cz + b.sz * 0.5, 0, 0, -0.62, b.sx * 0.035, b.sy * 0.34, b.sz * 0.035, 0x7a5238));
    parts.push(kasten(b.cx + b.sx * 0.22, b.minY + b.sy * 0.42,
      b.cz + b.sz * 0.5, 0, 0, -0.62, b.sx * 0.18, b.sy * 0.08, b.sz * 0.1, 0x555a58));
  }
  return parts;
}

function sakral(name, b, seed) {
  var parts = bodenSteine(b, seed, 0x8e887b, 6);
  for (var i = 0; i < 3; i++) {
    parts.push(kasten(b.cx, b.minY + b.sy * (0.03 + i * 0.045),
      b.cz + b.sz * (0.52 + i * 0.11), 0, seed * 0.001, 0,
      b.sx * (0.78 - i * 0.13), b.sy * 0.07, b.sz * 0.16, 0xaaa08b));
  }
  if (/feuer|kapelle|glocke/.test(name)) {
    parts.push(spitze(b.cx + b.sx * 0.3, b.minY + b.sy * 0.3, b.cz,
      0, 0, 0, b.sx * 0.1, b.sy * 0.28, b.sz * 0.1,
      name === 'feuerschale' ? 0xe59a4c : 0xcfb46c));
  }
  return parts;
}

function wohnbau(_name, b, seed) {
  var parts = bodenSteine(b, seed, 0x827563, 6);
  parts.push(kasten(b.cx, b.minY + b.sy * 0.06, b.cz + b.sz * 0.5,
    0, seed * 0.001, 0, b.sx * 0.72, b.sy * 0.1, b.sz * 0.28, 0x9b7754));
  var seite = seed % 2 ? 1 : -1;
  parts.push(stab(b.cx + seite * b.sx * 0.42, b.minY + b.sy * 0.34,
    b.cz + b.sz * 0.48, 0.08, 0, seite * 0.1,
    b.sx * 0.025, b.sy * 0.48, b.sz * 0.025, 0x536f43, 0.58));
  parts.push(knolle(b.cx + seite * b.sx * 0.4, b.minY + b.sy * 0.58,
    b.cz + b.sz * 0.48, 0, seed * 0.01, 0,
    b.sx * 0.15, b.sy * 0.08, b.sz * 0.13, 0x7f9957, 0.75));
  return parts;
}

function requisiten(name, b, seed) {
  var parts = bodenSteine(b, seed, 0x746959, 3);
  var stoff = /waesche|sack|blumen|markt/.test(name);
  parts.push(kasten(b.cx, b.minY + b.sy * 0.045, b.cz + b.sz * 0.35,
    0.03, seed * 0.002, -0.03, b.sx * 0.64, b.sy * 0.07, b.sz * 0.2,
    stoff ? 0xb78d62 : 0x79563b));
  parts.push(stab(b.cx + b.sx * 0.34, b.minY + b.sy * 0.25, b.cz,
    0.05, 0, 0.12, b.sx * 0.035, b.sy * 0.5, b.sz * 0.035, 0x684a34));
  parts.push(knolle(b.cx - b.sx * 0.31, b.minY + b.sy * 0.1, b.cz - b.sz * 0.24,
    0, seed * 0.01, 0, b.sx * 0.18, b.sy * 0.16, b.sz * 0.17,
    stoff ? 0xc97d6b : 0x9c774d));
  return parts;
}

function tiere(name, b, seed) {
  if (/kutsche|ochsengespann/.test(name)) {
    return [
      ring(b.cx - b.sx * 0.32, b.minY + b.sy * 0.22, b.cz - b.sz * 0.34,
        0, 0, 0, b.sx * 0.28, b.sy * 0.28, b.sz * 0.1, 0x503d32),
      ring(b.cx + b.sx * 0.32, b.minY + b.sy * 0.22, b.cz + b.sz * 0.34,
        0, 0, 0, b.sx * 0.28, b.sy * 0.28, b.sz * 0.1, 0x503d32),
      kasten(b.cx, b.minY + b.sy * 0.34, b.cz, 0, seed * 0.001, 0,
        b.sx * 0.68, b.sy * 0.22, b.sz * 0.58, 0x7a5438)
    ];
  }
  var fell = name === 'schaf' ? 0xd8d2bd : (name === 'rind' ? 0x76513e : 0x9a7453);
  var parts = [];
  for (var c = 0; c < 5; c++) {
    parts.push(knolle(b.cx + Math.sin(c * 1.7) * b.sx * 0.06,
      b.minY + b.sy * (0.51 + c % 2 * 0.035),
      b.cz + (c - 2) * b.sz * 0.13, 0, seed * 0.002 + c, 0,
      b.sx * 0.43, b.sy * 0.25, b.sz * 0.3,
      farbton(fell, c % 2 ? 0.92 : 1.08)));
  }
  for (var i = 0; i < 4; i++) {
    var x = b.cx + (i % 2 ? 1 : -1) * b.sx * 0.25;
    var z = b.cz + (i < 2 ? 1 : -1) * b.sz * 0.25;
    parts.push(stab(x, b.minY + b.sy * 0.23, z,
      0.02, 0, (i % 2 ? 1 : -1) * 0.045,
      b.sx * 0.075, b.sy * 0.4, b.sz * 0.075, farbton(fell, 0.78)));
    parts.push(knolle(x, b.minY + b.sy * 0.035, z, 0, seed * 0.01 + i, 0,
      b.sx * 0.12, b.sy * 0.07, b.sz * 0.12, 0x493d35));
  }
  parts.push(stab(b.cx, b.minY + b.sy * 0.67, b.cz + b.sz * 0.32,
    -0.52, 0, 0, b.sx * 0.16, b.sy * 0.48, b.sz * 0.16, farbton(fell, 0.96)));
  parts.push(knolle(b.cx, b.minY + b.sy * 0.82, b.cz + b.sz * 0.48,
    -0.08, seed * 0.004, 0, b.sx * 0.3, b.sy * 0.22, b.sz * 0.3,
    farbton(fell, 1.04)));
  parts.push(knolle(b.cx, b.minY + b.sy * 0.76, b.cz + b.sz * 0.61,
    0, 0, 0, b.sx * 0.23, b.sy * 0.13, b.sz * 0.2, farbton(fell, 0.9)));
  for (var e = -1; e <= 1; e += 2) {
    parts.push(spitze(b.cx + e * b.sx * 0.14, b.minY + b.sy * 0.96,
      b.cz + b.sz * 0.43, 0.15, 0, e * 0.18,
      b.sx * 0.085, b.sy * 0.11, b.sz * 0.075, 0x59483b));
    parts.push(knolle(b.cx + e * b.sx * 0.16, b.minY + b.sy * 0.84,
      b.cz + b.sz * 0.58, 0, 0, 0,
      b.sx * 0.035, b.sy * 0.035, b.sz * 0.035, 0x252521));
  }
  parts.push(stab(b.cx, b.minY + b.sy * 0.5, b.cz - b.sz * 0.52,
    0.72, 0, 0, b.sx * 0.05, b.sy * 0.36, b.sz * 0.05, farbton(fell, 0.7)));
  parts.push(spitze(b.cx, b.minY + b.sy * 0.31, b.cz - b.sz * 0.65,
    0.72, 0, 0, b.sx * 0.11, b.sy * 0.24, b.sz * 0.11, 0x4f4037));
  if (name === 'schaf') {
    for (var w = 0; w < 7; w++) {
      var a = w * 2.399 + seed * 0.001;
      parts.push(knolle(b.cx + Math.cos(a) * b.sx * 0.2,
        b.minY + b.sy * (0.62 + w % 2 * 0.09), b.cz + Math.sin(a) * b.sz * 0.25,
        0, a, 0, b.sx * 0.27, b.sy * 0.18, b.sz * 0.25, 0xe4dfcf));
    }
  } else if (name === 'pferd') {
    for (var m = 0; m < 4; m++) {
      parts.push(spitze(b.cx, b.minY + b.sy * (0.73 + m * 0.08),
        b.cz + b.sz * (0.25 + m * 0.1), -0.45, 0, 0,
        b.sx * 0.085, b.sy * 0.1, b.sz * 0.075, 0x4f4037));
    }
  } else {
    for (var h = -1; h <= 1; h += 2) {
      parts.push(spitze(b.cx + h * b.sx * 0.14, b.minY + b.sy * 1.02,
        b.cz + b.sz * 0.45, -0.55, 0, h * 0.35,
        b.sx * 0.07, b.sy * 0.22, b.sz * 0.07, 0xd5c9aa));
    }
  }
  return parts;
}

function wasserflora(name, b, seed) {
  var parts = bodenSteine(b, seed, 0x65796d, 5);
  var bluete = /seerose|koralle/.test(name);
  for (var i = 0; i < 7; i++) {
    var a = i * 2.399 + seed * 0.002;
    var h = b.sy * (0.26 + i % 3 * 0.08);
    var x = b.cx + Math.cos(a) * b.sx * 0.25;
    var z = b.cz + Math.sin(a) * b.sz * 0.25;
    parts.push(stab(x, b.minY + h * 0.5, z, 0.08, 0, -0.09,
      b.sx * 0.025, h, b.sz * 0.025, 0x3d7356, 0.78));
    parts.push(knolle(x, b.minY + h, z, 0, a, 0,
      b.sx * 0.13, b.sy * 0.07, b.sz * 0.13,
      bluete ? (i % 2 ? 0xe5a0a1 : 0xe6c27c) : 0x6f9b68, 0.84));
  }
  return parts;
}

function ufer(name, b, seed) {
  var parts = bodenSteine(b, seed, 0x737970, 6);
  for (var i = 0; i < 6; i++) {
    var x = b.cx + (i - 2.5) * b.sx * 0.11;
    var h = b.sy * (0.3 + i % 3 * 0.07);
    parts.push(stab(x, b.minY + h * 0.5, b.cz + b.sz * 0.38,
      0.04, 0, (i % 2 ? 1 : -1) * 0.1,
      b.sx * 0.02, h, b.sz * 0.02, 0x58734d, 0.76));
  }
  if (/treibholz|wurzel/.test(name)) {
    parts.push(stab(b.cx, b.minY + b.sy * 0.13, b.cz, PI / 2, 0, 0.16,
      b.sx * 0.07, b.sy * 0.72, b.sz * 0.07, 0x6d4f38));
  }
  return parts;
}

function schwebend(name, b, seed) {
  var parts = [];
  if (name === 'moewe') {
    for (var s = -1; s <= 1; s += 2) {
      parts.push(spitze(b.cx + s * b.sx * 0.24, b.maxY + b.sy * 0.04, b.cz,
        0, 0, s * PI / 2, b.sx * 0.42, b.sy * 0.1, b.sz * 0.22,
        s > 0 ? 0xf0ecdf : 0xd1d0c8, 0.9));
    }
    return parts;
  }
  for (var i = 0; i < 5; i++) {
    var a = i * 1.257 + seed * 0.002;
    parts.push(spitze(b.cx + Math.cos(a) * b.sx * 0.24,
      b.minY - b.sy * (0.2 + i % 2 * 0.1), b.cz + Math.sin(a) * b.sz * 0.24,
      PI, a, 0, b.sx * 0.14, b.sy * 0.44, b.sz * 0.14,
      i % 2 ? 0x4d5f48 : 0x65665a, 0.62));
  }
  return parts;
}

var BAUER = Object.freeze({
  natur_pilz: naturPilz,
  ruinen,
  arbor,
  eis,
  wueste,
  moor,
  hof,
  handwerk,
  sakral,
  wohnbau,
  requisiten,
  tiere,
  wasserflora,
  ufer,
  schwebend
});

export function veredleBestandKatalogFormensprache(name, geo) {
  var familie = ZU_FAMILIE[name];
  if (!familie) return geo;
  var details = BAUER[familie](name, grenzen(geo), hash(name));
  var ersetztLegacyTier = familie === 'tiere' &&
    name !== 'kutsche' && name !== 'ochsengespann';
  var ergebnis = mergeGeos((ersetztLegacyTier ? [] : [geo]).concat(details));
  ergebnis.userData.bestandKatalogName = name;
  ergebnis.userData.bestandKatalogFamilie = familie;
  ergebnis.userData.bestandKatalogFormensprache = 'waldsaeule-a';
  ergebnis.userData.bestandKatalogFormDetails = details.length;
  return ergebnis;
}
