/* ========================================================================== 
   Waldsaeulen-Formensprache fuer die 42 historischen Umweltpools

   Der Pass uebertraegt die ausgewaehlte Kandidatenrichtung A auf den gesamten
   Umweltvertrag: geschlossene Volumen, sichtbare Konstruktion, Bodenkontakt
   und drei klar lesbare Farbwerte. Alle Teile werden in die Quellgeometrie
   gebacken; Pool-ID, Instancing und Draw-Call-Vertrag bleiben unveraendert.
   ========================================================================== */
import * as THREE from 'three';
import { M, mergeGeos, part } from './geometrie-hilfen.js';
import { UMWELT_VERFEINERTE_POOLS } from './umwelt-geometrie.js';

export var UMWELT_FORMSPRACHE_POOLS = UMWELT_VERFEINERTE_POOLS;

var BAUM = new Set([
  'baum', 'baum2', 'nadelbaum', 'zypresse', 'sumpfbaum', 'bluetenbaum', 'obstbaum'
]);
var BODEN = new Set(['busch', 'gras', 'blume', 'farn', 'moos']);
var FELS = new Set(['fels', 'findling', 'geroell', 'felsnadel', 'basaltsaeulen', 'eisfels']);
var FELD = new Set(['feldreihe', 'ackerscholle']);
var ZAUN = new Set(['pfosten', 'lattenzaun', 'palisade', 'pferch']);
var UFER = new Set(['steg', 'anleger', 'kaimauer', 'kaitreppe', 'uferdamm', 'moorsteg']);
var GEBAEUDE = new Set([
  'haus', 'hausA', 'hausB', 'hausC', 'haus2', 'scheune', 'villa', 'langhaus',
  'grubenhaus', 'turmhaus', 'giebelhaus', 'laubenhaus'
]);

var CY6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1, false);
var CO5 = new THREE.ConeGeometry(0.5, 1, 5, 1, false);
var IC0 = new THREE.IcosahedronGeometry(0.5, 0);
var BOX = new THREE.BoxGeometry(1, 1, 1);

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
    sx: Math.max(0.3, b.max.x - b.min.x),
    sy: Math.max(0.3, b.max.y - b.min.y),
    sz: Math.max(0.3, b.max.z - b.min.z)
  };
}

function teil(basis, matrix, farbe, wind) {
  var geo = part(basis, matrix, farbe);
  if (wind !== undefined) {
    var uv = geo.attributes.uv.array;
    for (var i = 0; i < geo.attributes.uv.count; i++) {
      uv[i * 2] = 0.5;
      uv[i * 2 + 1] = wind;
    }
  }
  return geo;
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

function kasten(x, y, z, rx, ry, rz, sx, sy, sz, farbe) {
  return teil(BOX, M(x, y, z, rx, ry, rz, sx, sy, sz), farbe, 0.008);
}

function baumForm(name, b, seed) {
  var parts = [];
  var nadel = name === 'nadelbaum' || name === 'zypresse';
  var sumpf = name === 'sumpfbaum';
  var dunkel = sumpf ? 0x334b3d : 0x285438;
  var mitte = sumpf ? 0x58715a : 0x4f7d48;
  var licht = name === 'bluetenbaum' ? 0xd9a5ae : 0x8cab60;
  for (var i = 0; i < (nadel ? 13 : 8); i++) {
    var a = i * 2.399 + seed * 0.0017;
    var stufe = nadel ? i % 5 : i % 3;
    var y = nadel
      ? b.minY + b.sy * (0.43 + stufe * 0.105)
      : b.minY + b.sy * (0.69 + stufe * 0.075);
    var radius = nadel ? b.sx * (0.27 - stufe * 0.026) : b.sx * 0.25;
    var farbe = i % 3 === 0 ? licht : (i % 2 ? mitte : dunkel);
    parts.push(knolle(
      b.cx + Math.cos(a) * radius, y,
      b.cz + Math.sin(a) * Math.max(b.sz * 0.22, radius * 0.72),
      a * 0.07, a, -a * 0.04,
      nadel ? b.sx * 0.34 : b.sx * 0.31,
      nadel ? b.sy * 0.085 : b.sy * 0.16,
      nadel ? b.sz * 0.19 : b.sz * 0.28,
      farbe, 0.72));
  }
  parts.push(knolle(b.cx + b.sx * 0.13, b.minY + b.sy * 0.31, b.cz - b.sz * 0.18,
    0.2, seed * 0.01, 0, b.sx * 0.12, b.sy * 0.09, b.sz * 0.09, 0x6b4a32, 0.008));
  return parts;
}

function bodenForm(name, b, seed) {
  var parts = [];
  var basis = Math.max(0.32, Math.max(b.sx, b.sz));
  if (name === 'moos') {
    for (var m = 0; m < 10; m++) {
      var ma = m * 2.399 + seed * 0.01;
      var md = basis * (0.12 + (m % 4) * 0.055);
      parts.push(knolle(b.cx + Math.cos(ma) * md, b.minY + basis * 0.025,
        b.cz + Math.sin(ma) * md, ma * 0.08, ma, 0,
        basis * 0.22, basis * 0.07, basis * 0.17,
        m % 3 === 0 ? 0x9aae62 : (m % 2 ? 0x557d48 : 0x739454), 0.34));
    }
    return parts;
  }
  if (name === 'busch') {
    for (var k = 0; k < 9; k++) {
      var ka = k * 2.399 + seed * 0.004;
      var kd = basis * (0.08 + (k % 3) * 0.08);
      parts.push(knolle(b.cx + Math.cos(ka) * kd,
        b.minY + basis * (0.20 + (k % 4) * 0.07), b.cz + Math.sin(ka) * kd,
        ka * 0.11, ka, -ka * 0.06, basis * 0.34, basis * 0.26, basis * 0.31,
        k % 3 === 0 ? 0x91a95c : (k % 2 ? 0x537a45 : 0x355e3e), 0.7));
    }
    return parts;
  }
  var anzahl = name === 'gras' ? 13 : (name === 'farn' ? 9 : 7);
  for (var i = 0; i < anzahl; i++) {
    var a = i * 2.399 + seed * 0.003;
    var d = basis * (0.08 + (i % 4) * 0.055);
    var h = basis * (name === 'farn' ? 0.46 : 0.34) * (0.76 + (i % 5) * 0.07);
    var x = b.cx + Math.cos(a) * d;
    var z = b.cz + Math.sin(a) * d;
    parts.push(stab(x, b.minY + h * 0.47, z, 0.08 * Math.sin(a), 0,
      0.14 * Math.cos(a), basis * 0.025, h, basis * 0.025, 0x496e3d, 0.55));
    if (name === 'blume') {
      var bluete = i % 3 === 0 ? 0xf3d47b : (i % 2 ? 0xe99cab : 0xf1eee0);
      parts.push(knolle(x, b.minY + h, z, a, a * 0.4, 0,
        basis * 0.13, basis * 0.07, basis * 0.13, bluete, 0.82));
    } else {
      parts.push(spitze(x + Math.cos(a) * h * 0.13, b.minY + h * 0.82,
        z + Math.sin(a) * h * 0.13, 0, a, -0.34,
        basis * (name === 'farn' ? 0.19 : 0.10), h * 0.44,
        basis * (name === 'farn' ? 0.08 : 0.05),
        i % 2 ? 0x71904e : 0x91a85b, 0.78));
    }
  }
  return parts;
}

function felsForm(name, b, seed) {
  var parts = [];
  var basis = Math.max(b.sx, b.sz);
  var eis = name === 'eisfels';
  for (var i = 0; i < 7; i++) {
    var a = i * 2.399 + seed * 0.002;
    var d = basis * (0.32 + (i % 3) * 0.09);
    var r = basis * (0.11 + (i % 4) * 0.025);
    parts.push(knolle(b.cx + Math.cos(a) * d, b.minY + r * 0.36,
      b.cz + Math.sin(a) * d, a * 0.13, a, -a * 0.08,
      r * 1.4, r * 0.65, r,
      eis ? (i % 2 ? 0xc8e1e7 : 0x8fb9c8) : (i % 2 ? 0x87847b : 0xa29d90), 0.008));
  }
  parts.push(kasten(b.cx, b.minY + b.sy * 0.28, b.cz + b.sz * 0.48,
    0.08, seed * 0.002, -0.05, b.sx * 0.72, b.sy * 0.035, b.sz * 0.06,
    eis ? 0xe0eef0 : 0x696861));
  return parts;
}

function feldForm(_name, b, seed) {
  var parts = [];
  for (var i = 0; i < 12; i++) {
    var spalte = i % 4, reihe = Math.floor(i / 4);
    var x = b.cx + (spalte - 1.5) * b.sx * 0.21;
    var z = b.cz + (reihe - 1) * b.sz * 0.25;
    var h = b.sy * (0.38 + (i % 3) * 0.07);
    parts.push(spitze(x, b.minY + h * 0.5, z, 0.04, seed * 0.001, (i % 3 - 1) * 0.08,
      b.sx * 0.055, h, b.sz * 0.055, i % 2 ? 0x96a95e : 0x687f45, 0.74));
  }
  return parts;
}

function zaunForm(_name, b, seed) {
  var holz = seed % 2 ? 0x6d513a : 0x7d5c3e;
  return [
    kasten(b.cx, b.minY + b.sy * 0.52, b.cz + b.sz * 0.18,
      0, seed * 0.001, -0.38, b.sx * 0.82, b.sy * 0.07, b.sz * 0.07, holz),
    kasten(b.cx, b.minY + b.sy * 0.34, b.cz - b.sz * 0.15,
      0, -seed * 0.001, 0.31, b.sx * 0.72, b.sy * 0.06, b.sz * 0.06, 0x8a6845),
    knolle(b.cx - b.sx * 0.46, b.minY + b.sy * 0.035, b.cz + b.sz * 0.2,
      0.1, 0.4, 0, b.sx * 0.16, b.sy * 0.08, b.sz * 0.18, 0x8d887c, 0.008),
    knolle(b.cx + b.sx * 0.43, b.minY + b.sy * 0.03, b.cz - b.sz * 0.18,
      -0.1, -0.3, 0, b.sx * 0.13, b.sy * 0.07, b.sz * 0.15, 0xa09a8d, 0.008)
  ];
}

function uferForm(name, b, seed) {
  var parts = [];
  for (var i = 0; i < 6; i++) {
    var x = b.cx + (i - 2.5) * b.sx * 0.12;
    var h = b.sy * (0.28 + (i % 3) * 0.08);
    parts.push(stab(x, b.minY + h * 0.5, b.cz + b.sz * 0.4,
      0.04, 0, (i % 2 ? 1 : -1) * 0.1, b.sx * 0.018, h, b.sz * 0.018,
      i % 2 ? 0x6f8451 : 0x506b45, 0.76));
  }
  parts.push(knolle(b.cx + b.sx * 0.38, b.minY + b.sy * 0.03, b.cz - b.sz * 0.35,
    0.1, seed * 0.01, 0, b.sx * 0.2, b.sy * 0.08, b.sz * 0.18,
    name === 'moorsteg' ? 0x554c40 : 0x88867e, 0.008));
  return parts;
}

function gebaeudeForm(name, b, seed) {
  var stein = name === 'villa' ? 0xb5aa91 : 0x938772;
  var parts = [];
  for (var i = 0; i < 5; i++) {
    var x = b.cx + (i - 2) * b.sx * 0.19;
    parts.push(knolle(x, b.minY + b.sy * 0.025, b.cz + b.sz * 0.48,
      0.1 * i, seed * 0.002 + i, 0,
      b.sx * 0.15, b.sy * 0.06, b.sz * 0.13,
      i % 2 ? stein : 0x746d61, 0.008));
  }
  var seite = seed % 2 ? 1 : -1;
  parts.push(stab(b.cx + seite * b.sx * 0.42, b.minY + b.sy * 0.42,
    b.cz + b.sz * 0.5, 0.08, 0, seite * 0.1,
    b.sx * 0.025, b.sy * 0.52, b.sz * 0.025, 0x516e43, 0.55));
  parts.push(knolle(b.cx + seite * b.sx * 0.4, b.minY + b.sy * 0.69,
    b.cz + b.sz * 0.5, 0, seed * 0.01, 0,
    b.sx * 0.15, b.sy * 0.08, b.sz * 0.13, 0x7f9a56, 0.74));
  return parts;
}

export function veredleUmweltFormensprache(name, geo) {
  if (!UMWELT_FORMSPRACHE_POOLS.includes(name)) return geo;
  var b = grenzen(geo);
  var seed = hash(name);
  var details;
  if (BAUM.has(name)) details = baumForm(name, b, seed);
  else if (BODEN.has(name)) details = bodenForm(name, b, seed);
  else if (FELS.has(name)) details = felsForm(name, b, seed);
  else if (FELD.has(name)) details = feldForm(name, b, seed);
  else if (ZAUN.has(name)) details = zaunForm(name, b, seed);
  else if (UFER.has(name)) details = uferForm(name, b, seed);
  else if (GEBAEUDE.has(name)) details = gebaeudeForm(name, b, seed);
  else throw new Error('Umwelt-Formensprache ohne Familie: ' + name);
  var ergebnis = mergeGeos([geo].concat(details));
  ergebnis.userData.umweltFormensprache = 'waldsaeule-a';
  ergebnis.userData.umweltFormDetails = details.length;
  return ergebnis;
}
