/* ========================================================================== 
   Waldsaeule-A-Formensprache fuer 81 Bau-, Wehr- und Hafenassets

   Der historische Pass stabilisiert die Grundsilhouette. Dieser zweite Pass
   gibt jeder der vier Familien eine eigene Nahlesbarkeit: Mauerlagen und
   Banner, Takelage und Ladung, Marktware und Handwerk sowie bewohnte Sockel.
   Alle Teile werden in die bestehende Geometrie gebacken; Pool-IDs,
   Materialien und Draw-Call-Gruppen bleiben unveraendert.
   ========================================================================== */
import * as THREE from 'three';
import { M, farbton, mergeGeos, part } from './geometrie-hilfen.js';
import {
  BESTAND_BAU_FAMILIEN,
  BESTAND_BAU_VERFEINERTE_POOLS
} from './bestand-bau-veredelung.js';

export var BESTAND_BAU_FORMSPRACHE_POOLS = BESTAND_BAU_VERFEINERTE_POOLS;

var BOX = new THREE.BoxGeometry(1, 1, 1);
var CY6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1, false);
var CO5 = new THREE.ConeGeometry(0.5, 1, 5, 1, false);
var IC0 = new THREE.IcosahedronGeometry(0.5, 0);
var TORUS = new THREE.TorusGeometry(0.5, 0.1, 4, 10);
var PI = Math.PI;

var ZU_FAMILIE = Object.create(null);
Object.keys(BESTAND_BAU_FAMILIEN).forEach(function (familie) {
  BESTAND_BAU_FAMILIEN[familie].forEach(function (name) {
    ZU_FAMILIE[name] = familie;
  });
});

var SCHIFFE = new Set([
  'boot', 'fischerboot', 'kutter', 'floss', 'kogge', 'dreimaster',
  'ruderschiff', 'wrack'
]);

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
    sx: Math.max(0.4, b.max.x - b.min.x),
    sy: Math.max(0.4, b.max.y - b.min.y),
    sz: Math.max(0.4, b.max.z - b.min.z)
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

function kasten(x, y, z, rx, ry, rz, sx, sy, sz, farbe, wind) {
  return teil(BOX, M(x, y, z, rx, ry, rz, sx, sy, sz), farbe, wind);
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
    var d = basis * (0.34 + i % 3 * 0.08);
    var r = basis * (0.07 + i % 4 * 0.014);
    parts.push(knolle(b.cx + Math.cos(a) * d, b.minY + r * 0.3,
      b.cz + Math.sin(a) * d, a * 0.1, a, -a * 0.04,
      r * 1.35, r * 0.62, r, farbton(farbe, i % 2 ? 0.86 : 1.08)));
  }
  return parts;
}

function kultur(name, b, seed) {
  var parts = bodenSteine(b, seed, 0x847b6b, 6);
  var stein = /tempel|tholos|arkade|bogen|saeule|kuppel|zwerg/.test(name);
  var grund = stein ? 0xaaa18d : 0x806248;
  for (var i = 0; i < 4; i++) {
    var x = b.cx + (i % 2 ? 1 : -1) * b.sx * 0.42;
    var z = b.cz + (i < 2 ? 1 : -1) * b.sz * 0.39;
    parts.push(kasten(x, b.minY + b.sy * 0.16, z,
      0.04 * (i - 1.5), seed * 0.0005, (i % 2 ? 1 : -1) * 0.06,
      b.sx * 0.11, b.sy * 0.32, b.sz * 0.12, farbton(grund, i % 2 ? 0.83 : 1.05)));
  }
  for (var s = 0; s < 3; s++) {
    parts.push(kasten(b.cx, b.minY + b.sy * (0.035 + s * 0.045),
      b.cz + b.sz * (0.5 + s * 0.08), 0, seed * 0.0008, 0,
      b.sx * (0.72 - s * 0.1), b.sy * 0.065, b.sz * 0.15,
      farbton(grund, 0.86 + s * 0.09)));
  }
  if (/windmuehle/.test(name)) {
    parts.push(ring(b.cx, b.minY + b.sy * 0.67, b.cz + b.sz * 0.5,
      0, 0, 0, b.sx * 0.48, b.sy * 0.48, b.sz * 0.08, 0x6e5038));
    for (var f = 0; f < 4; f++) {
      parts.push(kasten(b.cx, b.minY + b.sy * 0.67, b.cz + b.sz * 0.53,
        0, 0, f * PI / 2 + seed * 0.001,
        b.sx * 0.075, b.sy * 0.78, b.sz * 0.035, f % 2 ? 0xd6c59e : 0x8a6643));
    }
  } else if (/kran|industrie/.test(name)) {
    parts.push(stab(b.cx + b.sx * 0.3, b.minY + b.sy * 0.5, b.cz,
      0, 0, -0.22, b.sx * 0.055, b.sy * 0.92, b.sz * 0.055, 0x674b39));
    parts.push(stab(b.cx, b.minY + b.sy * 0.78, b.cz,
      PI / 2, 0, 0.18, b.sx * 0.045, b.sy * 0.8, b.sz * 0.045, 0x8e6946));
  } else if (/turm|halle|tor/.test(name)) {
    for (var h = 0; h < 3; h++) {
      parts.push(kasten(b.cx, b.minY + b.sy * (0.28 + h * 0.2),
        b.cz + b.sz * 0.505, 0, 0, 0,
        b.sx * 0.09, b.sy * 0.075, b.sz * 0.03, 0x3f4745));
    }
  }
  return parts;
}

function marktDetails(b, seed) {
  var parts = [];
  var farben = [0xd68b57, 0xd6b35f, 0x839b59, 0xb96754, 0xe1d7a8];
  for (var i = 0; i < 10; i++) {
    var reihe = Math.floor(i / 5);
    parts.push(knolle(b.cx + (i % 5 - 2) * b.sx * 0.115,
      b.minY + b.sy * (0.43 + reihe * 0.08), b.cz + b.sz * (0.42 - reihe * 0.13),
      0, seed * 0.002 + i, 0,
      b.sx * 0.105, b.sy * 0.09, b.sz * 0.105, farben[i % farben.length]));
  }
  for (var k = 0; k < 5; k++) {
    parts.push(spitze(b.cx + (k - 2) * b.sx * 0.185, b.maxY - b.sy * 0.16,
      b.cz + b.sz * 0.485, PI, 0, (k - 2) * 0.025,
      b.sx * 0.082, b.sy * 0.18, b.sz * 0.025,
      k % 2 ? 0xe2c990 : 0xb96450, 0.52));
  }
  return parts;
}

function begleiter(name, b, seed) {
  if (SCHIFFE.has(name)) return schiff(name, b, seed);
  var parts = bodenSteine(b, seed, 0x756a5a, 4);
  if (name === 'marktstand') return parts.concat(marktDetails(b, seed));
  if (/fass|kiste|karren|heuhaufen/.test(name)) {
    for (var i = 0; i < 5; i++) {
      parts.push(knolle(b.cx + (i % 3 - 1) * b.sx * 0.24,
        b.minY + b.sy * (0.12 + Math.floor(i / 3) * 0.18),
        b.cz + (i % 2 ? 1 : -1) * b.sz * 0.2, 0, seed * 0.003 + i, 0,
        b.sx * 0.2, b.sy * 0.18, b.sz * 0.2,
        /heu/.test(name) ? 0xc9a052 : (i % 2 ? 0x8b623f : 0xa57b4e)));
    }
  } else if (/brunnen/.test(name)) {
    parts.push(ring(b.cx, b.minY + b.sy * 0.45, b.cz,
      PI / 2, 0, 0, b.sx * 0.42, b.sy * 0.1, b.sz * 0.42, 0x786d5d));
    parts.push(stab(b.cx, b.minY + b.sy * 0.62, b.cz,
      0, 0, 0, b.sx * 0.025, b.sy * 0.48, b.sz * 0.025, 0x594333));
    parts.push(knolle(b.cx, b.minY + b.sy * 0.38, b.cz,
      0, seed * 0.01, 0, b.sx * 0.14, b.sy * 0.1, b.sz * 0.14, 0x456e76));
  } else if (/laterne|fensterlicht/.test(name)) {
    for (var l = 0; l < 3; l++) {
      parts.push(knolle(b.cx + (l - 1) * b.sx * 0.2,
        b.minY + b.sy * (0.42 + l % 2 * 0.15), b.cz,
        0, seed * 0.005 + l, 0,
        b.sx * 0.12, b.sy * 0.12, b.sz * 0.12, l === 1 ? 0xf2d488 : 0xd9a75a));
    }
  } else {
    parts.push(kasten(b.cx, b.minY + b.sy * 0.06, b.cz + b.sz * 0.5,
      0, seed * 0.001, 0, b.sx * 0.7, b.sy * 0.1, b.sz * 0.22, 0x987453));
    parts.push(stab(b.cx + b.sx * 0.38, b.minY + b.sy * 0.31,
      b.cz + b.sz * 0.46, 0.08, 0, 0.1,
      b.sx * 0.03, b.sy * 0.48, b.sz * 0.03, 0x4d6944, 0.55));
    parts.push(knolle(b.cx + b.sx * 0.37, b.minY + b.sy * 0.56,
      b.cz + b.sz * 0.46, 0, seed * 0.01, 0,
      b.sx * 0.14, b.sy * 0.08, b.sz * 0.13, 0x789558, 0.76));
  }
  return parts;
}

function wehr(name, b, seed) {
  var parts = bodenSteine(b, seed, 0x7d786d, 8);
  var turm = /turm|bergfried/.test(name);
  var tor = /tor|durchlass|barbakane|zugbruecke/.test(name);
  for (var i = 0; i < 4; i++) {
    var x = b.cx + (i % 2 ? 1 : -1) * b.sx * 0.45;
    var z = b.cz + (i < 2 ? 1 : -1) * b.sz * 0.42;
    for (var lage = 0; lage < 2; lage++) {
      parts.push(kasten(x, b.minY + b.sy * (0.13 + lage * 0.27), z,
        (i - 1.5) * 0.025, seed * 0.0005, (i % 2 ? 1 : -1) * 0.05,
        b.sx * 0.13, b.sy * 0.22, b.sz * 0.14,
        lage ? 0xa29b8b : 0x77736a));
    }
  }
  if (tor) {
    for (var g = 0; g < 5; g++) {
      parts.push(stab(b.cx + (g - 2) * b.sx * 0.105,
        b.minY + b.sy * 0.32, b.cz + b.sz * 0.51,
        0, 0, 0, b.sx * 0.022, b.sy * 0.58, b.sz * 0.022, 0x4b4037));
    }
    parts.push(kasten(b.cx, b.minY + b.sy * 0.62, b.cz + b.sz * 0.52,
      0, 0, 0, b.sx * 0.62, b.sy * 0.08, b.sz * 0.04, 0x64503d));
  } else {
    for (var s = 0; s < 3; s++) {
      parts.push(kasten(b.cx + (s - 1) * b.sx * 0.2,
        b.minY + b.sy * (0.27 + s * 0.19), b.cz + b.sz * 0.505,
        0, 0, 0, b.sx * 0.055, b.sy * 0.095, b.sz * 0.025, 0x414747));
    }
  }
  if (turm && name !== 'bergfried') {
    parts.push(stab(b.cx + b.sx * 0.26, b.maxY + b.sy * 0.12, b.cz,
      0, 0, 0.04, b.sx * 0.018, b.sy * 0.34, b.sz * 0.018, 0x654c36));
    parts.push(kasten(b.cx + b.sx * 0.36, b.maxY + b.sy * 0.2, b.cz,
      0, 0, 0.04, b.sx * 0.2, b.sy * 0.13, b.sz * 0.025,
      seed % 2 ? 0x8a4650 : 0x57768a, 0.56));
  }
  if (/palisade|wachturm|wehrbanner/.test(name)) {
    for (var p = 0; p < 4; p++) {
      parts.push(spitze(b.cx + (p - 1.5) * b.sx * 0.18,
        b.maxY + b.sy * 0.08, b.cz - b.sz * 0.2,
        0, 0, 0, b.sx * 0.055, b.sy * 0.22, b.sz * 0.055, 0x6c4c34));
    }
  }
  return parts;
}

function schiff(name, b, seed) {
  var parts = [];
  var quer = b.sx > b.sz;
  var laenge = Math.max(b.sx, b.sz);
  var breite = Math.min(b.sx, b.sz);
  for (var i = 0; i < 5; i++) {
    var lang = (i - 2) * laenge * 0.12;
    var x = b.cx + (quer ? lang : (i % 2 ? 1 : -1) * breite * 0.16);
    var z = b.cz + (quer ? (i % 2 ? 1 : -1) * breite * 0.16 : lang);
    parts.push(knolle(x, b.minY + b.sy * 0.18, z,
      0, seed * 0.002 + i, 0,
      breite * 0.2, b.sy * 0.16, breite * 0.2,
      i % 2 ? 0x7d593b : 0xa8794b));
  }
  var mastZahl = name === 'kogge' ? 0 : (/dreimaster/.test(name) ? 3 : 2);
  for (var m = 0; m < mastZahl; m++) {
    var versatz = (m - 0.5) * laenge * 0.22;
    parts.push(stab(b.cx + (quer ? versatz : 0), b.minY + b.sy * 0.65,
      b.cz + (quer ? 0 : versatz), 0, 0, 0,
      breite * 0.028, b.sy * 0.86, breite * 0.028, 0x68472f));
    for (var seg = 0; seg < 2; seg++) {
      var seitlich = (seg ? 1 : -1) * laenge * 0.075;
      parts.push(kasten(b.cx + (quer ? versatz + seitlich : 0),
        b.minY + b.sy * (0.61 + m * 0.065 - seg * 0.035),
        b.cz + (quer ? 0 : versatz + seitlich),
        0, quer ? PI / 2 : 0, (m % 2 ? -1 : 1) * (0.09 + seg * 0.025),
        quer ? breite * 0.045 : laenge * 0.135, b.sy * (0.25 - seg * 0.035),
        quer ? laenge * 0.135 : breite * 0.045,
        seg ? 0xd9c9a6 : 0xb96950, 0.48));
    }
    parts.push(spitze(b.cx + (quer ? versatz : 0), b.minY + b.sy * 0.91,
      b.cz + (quer ? 0 : versatz), quer ? 0 : PI / 2, 0, quer ? -PI / 2 : 0,
      breite * 0.08, b.sy * 0.16, laenge * 0.09,
      m % 2 ? 0x486b72 : 0xc0754d, 0.62));
  }
  if (name === 'kogge') {
    parts.push(ring(b.cx, b.minY + b.sy * 0.62, b.cz + b.sz * 0.12,
      0, 0, 0, breite * 0.21, breite * 0.21, breite * 0.055, 0xb96950));
    parts.push(knolle(b.cx, b.minY + b.sy * 0.62, b.cz + b.sz * 0.126,
      0, seed * 0.004, 0, breite * 0.13, b.sy * 0.085, breite * 0.035, 0xd7ad55));
  }
  for (var s = -1; s <= 1; s += 2) {
    parts.push(stab(b.cx + (quer ? s * laenge * 0.31 : s * breite * 0.3),
      b.minY + b.sy * 0.48,
      b.cz + (quer ? s * breite * 0.3 : s * laenge * 0.31),
      0.62, 0, s * 0.08,
      breite * 0.012, b.sy * 0.78, breite * 0.012, 0xb19772));
  }
  parts.push(knolle(b.cx, b.minY + b.sy * 0.28, b.cz - b.sz * 0.38,
    0, seed * 0.01, 0, breite * 0.16, b.sy * 0.15, breite * 0.16, 0xd7ad55));
  return parts;
}

function hafen(name, b, seed) {
  if (SCHIFFE.has(name)) return schiff(name, b, seed);
  var parts = bodenSteine(b, seed, 0x65716d, 6);
  var basis = Math.min(b.sx, b.sz);
  for (var i = 0; i < 4; i++) {
    var x = b.cx + (i % 2 ? 1 : -1) * b.sx * 0.39;
    var z = b.cz + (i < 2 ? 1 : -1) * b.sz * 0.38;
    parts.push(stab(x, b.minY + b.sy * 0.2, z,
      0.04, 0, (i % 2 ? 1 : -1) * 0.05,
      basis * 0.045, b.sy * 0.42, basis * 0.045, 0x614a38));
  }
  if (/leucht|bake|boje|hafenlaterne/.test(name)) {
    parts.push(ring(b.cx, b.maxY - b.sy * 0.16, b.cz,
      PI / 2, 0, 0, b.sx * 0.35, b.sy * 0.06, b.sz * 0.35, 0x4d5351));
    parts.push(knolle(b.cx, b.maxY + b.sy * 0.04, b.cz,
      0, seed * 0.01, 0, basis * 0.16, b.sy * 0.12, basis * 0.16, 0xf0cb71));
  } else if (/kran|helling|slipbahn|werft/.test(name)) {
    parts.push(stab(b.cx, b.minY + b.sy * 0.55, b.cz,
      0, 0, -0.18, basis * 0.045, b.sy * 0.9, basis * 0.045, 0x6f4d35));
    parts.push(stab(b.cx + b.sx * 0.17, b.minY + b.sy * 0.79, b.cz,
      PI / 2, 0, 0.2, basis * 0.035, b.sy * 0.64, basis * 0.035, 0x89603e));
    parts.push(knolle(b.cx - b.sx * 0.18, b.minY + b.sy * 0.08,
      b.cz + b.sz * 0.35, 0, seed * 0.01, 0,
      basis * 0.16, b.sy * 0.12, basis * 0.16, 0xb18b55));
  } else if (/salzgarten/.test(name)) {
    for (var k = 0; k < 7; k++) {
      parts.push(spitze(b.cx + (k % 4 - 1.5) * b.sx * 0.16,
        b.minY + b.sy * 0.1, b.cz + (Math.floor(k / 4) - 0.5) * b.sz * 0.28,
        0, seed * 0.002 + k, 0,
        basis * 0.09, b.sy * 0.2, basis * 0.09, k % 2 ? 0xf0e5cf : 0xd8cbb5));
    }
  } else {
    parts.push(kasten(b.cx, b.minY + b.sy * 0.08, b.cz + b.sz * 0.48,
      0, seed * 0.001, 0, b.sx * 0.7, b.sy * 0.1, b.sz * 0.18, 0x8d6945));
    parts.push(ring(b.cx + b.sx * 0.32, b.minY + b.sy * 0.24,
      b.cz + b.sz * 0.42, PI / 2, 0, 0,
      basis * 0.16, b.sy * 0.05, basis * 0.16, 0xb59b73));
  }
  return parts;
}

var BAUER = Object.freeze({ kultur, begleiter, wehr, hafen });

export function veredleBestandBauFormensprache(name, geo) {
  var familie = ZU_FAMILIE[name];
  if (!familie) return geo;
  var details = BAUER[familie](name, grenzen(geo), hash(name));
  var ergebnis = mergeGeos([geo].concat(details));
  ergebnis.userData.bestandBauName = name;
  ergebnis.userData.bestandBauFamilie = familie;
  ergebnis.userData.bestandBauFormensprache = 'waldsaeule-a';
  ergebnis.userData.bestandBauFormDetails = details.length;
  return ergebnis;
}
