/* ==========================================================================
   Umwelt-Geometriepass

   Die aeltesten Naturpools sind bewusst klein und billig gebaut. Im heutigen
   Nahbereich fallen deshalb vor allem drei Dinge auf: ein einzelner Horst
   statt einer Pflanzengruppe, Baumstaemme ohne Wurzelkontakt und Felsen bzw.
   Zaunelemente, die sauber auf dem Boden enden. Dieser Pass fuegt den
   betroffenen Pools VOR dem InstancedMesh-Aufbau deterministische Details
   hinzu. Ergebnis bleibt genau EINE BufferGeometry je Pool: keine neuen
   Materialien, Draw Calls, IDs oder Kartenfelder.
   ========================================================================== */
import * as THREE from 'three';

var CY = THREE.CylinderGeometry;
var BX = THREE.BoxGeometry;
var IC = THREE.IcosahedronGeometry;
var CO = THREE.ConeGeometry;

var BAUM = Object.freeze({
  baum:          { r: 0.88, farbe: 0x6f5a44, seed: 11 },
  baum2:         { r: 0.72, farbe: 0x7a6450, seed: 17 },
  nadelbaum:     { r: 0.58, farbe: 0x5f4c3c, seed: 23 },
  zypresse:      { r: 0.42, farbe: 0x6d5a45, seed: 29 },
  sumpfbaum:     { r: 1.05, farbe: 0x5c5244, seed: 31 },
  bluetenbaum:   { r: 0.74, farbe: 0x7a6450, seed: 37 },
  obstbaum:      { r: 0.66, farbe: 0x74604a, seed: 41 }
});

var BODENDECKER = Object.freeze({
  busch: [[-0.34, 0.01, 0.22, 0.58, 0.72]],
  gras:  [[-0.18, 0, 0.12, 0.68, 0.52]],
  blume: [[-0.17, 0, 0.12, 0.68, 0.61]],
  farn:  [[-0.28, 0, 0.18, 0.64, 0.57]],
  moos:  [[-0.18, 0.008, 0.16, 0.58, 0.48]]
});

var FELS = Object.freeze({
  fels:           { r: 0.72, farbe: 0x8f8b82, seed: 53 },
  findling:       { r: 1.12, farbe: 0x8e897e, seed: 59 },
  geroell:        { r: 0.82, farbe: 0x8a867d, seed: 61 },
  felsnadel:      { r: 0.86, farbe: 0x89857c, seed: 67 },
  basaltsaeulen:  { r: 1.02, farbe: 0x66635f, seed: 71 },
  eisfels:        { r: 1.00, farbe: 0xb8d6e4, seed: 73 }
});

var FELD = Object.freeze({
  feldreihe: {
    farbe: 0x8fa35f,
    punkte: [[-0.16, 0.42, -1.05], [0.14, 0.42, -0.42], [-0.12, 0.42, 0.28], [0.15, 0.42, 1.02]]
  },
  ackerscholle: {
    farbe: 0x78934f,
    punkte: [[-0.78, 0.34, -1.15], [-0.28, 0.37, -0.48], [0.22, 0.34, 0.16],
      [0.72, 0.38, 0.82], [-0.72, 0.35, 1.18], [0.76, 0.33, -0.92]]
  }
});

var ZAUN = Object.freeze({
  pfosten:    { w: 1.75, h: 0.72, farbe: 0x806a52, steine: 0.72 },
  lattenzaun: { w: 1.84, h: 0.77, farbe: 0x846d53, steine: 0.76 },
  palisade:   { w: 2.55, h: 1.15, farbe: 0x66503c, steine: 1.05 },
  pferch:     { w: 1.20, h: 0.58, farbe: 0x80684e, steine: 2.15 }
});

var UFER = Object.freeze({
  steg:       { x: 0.67, y: 0.02, z: -1.12, s: 0.72, seed: 83 },
  anleger:    { x: 0.88, y: -0.08, z: -1.28, s: 0.82, seed: 89 },
  kaimauer:   { x: 1.72, y: 0.72, z: 0.92, s: 0.76, seed: 97 },
  kaitreppe:  { x: 0.78, y: -0.20, z: 1.18, s: 0.72, seed: 101 },
  uferdamm:   { x: 1.45, y: 0.02, z: 0.82, s: 0.84, seed: 103 },
  moorsteg:   { x: 0.68, y: -0.08, z: -1.82, s: 0.78, seed: 107 }
});

var GEBAEUDE = Object.freeze({
  haus:         { front: 1.38, stufe: 0.78, seed: 113 },
  hausA:        { front: 1.38, stufe: 0.78, seed: 127 },
  hausB:        { front: 2.42, stufe: 0.82, seed: 131 },
  hausC:        { front: 1.38, stufe: 0.78, seed: 137 },
  haus2:        { front: 1.44, stufe: 0.82, seed: 139 },
  scheune:      { front: 1.98, stufe: 1.10, seed: 149 },
  villa:        { front: 2.28, stufe: 1.12, seed: 151 },
  langhaus:     { front: 3.46, stufe: 0.94, seed: 157 },
  grubenhaus:   { front: 1.72, stufe: 0.72, seed: 163 },
  turmhaus:     { front: 1.18, stufe: 0.70, seed: 167 },
  giebelhaus:   { front: 1.78, stufe: 0.80, seed: 173 },
  laubenhaus:   { front: 1.68, stufe: 0.86, seed: 179 }
});
export var UMWELT_VERFEINERTE_POOLS = Object.freeze(
  Object.keys(BAUM)
    .concat(Object.keys(BODENDECKER), Object.keys(FELS), Object.keys(FELD),
      Object.keys(ZAUN), Object.keys(UFER), Object.keys(GEBAEUDE))
);

function matrix(x, y, z, rx, ry, rz, sx, sy, sz) {
  var m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(x || 0, y || 0, z || 0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
    new THREE.Vector3(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy,
      sz === undefined ? 1 : sz)
  );
  return m;
}

function farbTeil(geo, mat, hex, opak) {
  var g = geo.clone();
  if (mat) g.applyMatrix4(mat);
  if (!g.attributes.normal) g.computeVertexNormals();
  var n = g.attributes.position.count;
  var c = new THREE.Color(hex);
  var farben = new Float32Array(n * 3);
  var uv = new Float32Array(n * 2);
  for (var i = 0; i < n; i++) {
    farben[i * 3] = c.r;
    farben[i * 3 + 1] = c.g;
    farben[i * 3 + 2] = c.b;
    if (opak) {
      uv[i * 2] = 0.5;
      uv[i * 2 + 1] = 0.008;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(farben, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

function verschmelze(geos) {
  var vGesamt = 0, iGesamt = 0, i, k;
  var bereit = [];
  for (i = 0; i < geos.length; i++) {
    var g = geos[i];
    if (!g || !g.attributes || !g.attributes.position) continue;
    if (!g.attributes.normal) {
      g = g.clone();
      g.computeVertexNormals();
    }
    bereit.push(g);
    vGesamt += g.attributes.position.count;
    iGesamt += g.index ? g.index.count : g.attributes.position.count;
  }
  var pos = new Float32Array(vGesamt * 3);
  var nor = new Float32Array(vGesamt * 3);
  var col = new Float32Array(vGesamt * 3);
  var uv = new Float32Array(vGesamt * 2);
  var idx = vGesamt > 65535 ? new Uint32Array(iGesamt) : new Uint16Array(iGesamt);
  var vo = 0, io = 0;
  for (i = 0; i < bereit.length; i++) {
    var quelle = bereit[i];
    var n = quelle.attributes.position.count;
    pos.set(quelle.attributes.position.array.subarray(0, n * 3), vo * 3);
    nor.set(quelle.attributes.normal.array.subarray(0, n * 3), vo * 3);
    if (quelle.attributes.color) {
      col.set(quelle.attributes.color.array.subarray(0, n * 3), vo * 3);
    } else {
      col.fill(1, vo * 3, (vo + n) * 3);
    }
    if (quelle.attributes.uv) {
      uv.set(quelle.attributes.uv.array.subarray(0, n * 2), vo * 2);
    }
    if (quelle.index) {
      var a = quelle.index.array;
      for (k = 0; k < a.length; k++) idx[io + k] = a[k] + vo;
      io += a.length;
    } else {
      for (k = 0; k < n; k++) idx[io + k] = vo + k;
      io += n;
    }
    vo += n;
  }
  var raus = new THREE.BufferGeometry();
  raus.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  raus.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  raus.setAttribute('color', new THREE.BufferAttribute(col, 3));
  raus.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  raus.setIndex(new THREE.BufferAttribute(idx, 1));
  raus.computeBoundingSphere();
  return raus;
}

function wurzelSternGeo(opt) {
  var pos = [], idx = [];
  for (var i = 0; i < 5; i++) {
    var a = i / 5 * Math.PI * 2 + opt.seed * 0.073;
    var ca = Math.cos(a), sa = Math.sin(a), px = -sa, pz = ca;
    var streu = 0.84 + ((i * 37 + opt.seed) % 17) / 50;
    var lang = opt.r * streu, innen = opt.r * 0.09;
    var wi = opt.r * 0.13, wa = opt.r * 0.045;
    var start = pos.length / 3;
    pos.push(ca * innen, 0.22, sa * innen);
    pos.push(ca * innen + px * wi, 0.018, sa * innen + pz * wi);
    pos.push(ca * innen - px * wi, 0.018, sa * innen - pz * wi);
    pos.push(ca * lang + px * wa, 0.012, sa * lang + pz * wa);
    pos.push(ca * lang - px * wa, 0.012, sa * lang - pz * wa);
    pos.push(ca * lang * 0.88, 0.055, sa * lang * 0.88);
    idx.push(start, start + 1, start + 3, start, start + 3, start + 5,
      start, start + 5, start + 4, start, start + 4, start + 2,
      start + 1, start + 2, start + 4, start + 1, start + 4, start + 3);
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function baumDetails(opt) {
  return [farbTeil(wurzelSternGeo(opt), null, opt.farbe, true)];
}

function bodendeckerDetails(geo, vorgaben) {
  var parts = [];
  for (var i = 0; i < vorgaben.length; i++) {
    var v = vorgaben[i];
    var g = geo.clone();
    g.applyMatrix4(matrix(v[0], v[1], v[2], 0, v[4], (i ? -1 : 1) * 0.055,
      v[3], 0.82 + i * 0.08, v[3]));
    parts.push(g);
  }
  return parts;
}

function felsDetails(opt) {
  var parts = [];
  for (var i = 0; i < 3; i++) {
    var a = i / 3 * Math.PI * 2 + opt.seed * 0.041;
    var d = opt.r * (0.56 + ((i * 19 + opt.seed) % 13) / 40);
    var r = opt.r * (0.16 + ((i * 11 + opt.seed) % 9) / 100);
    var ton = i % 2 ? opt.farbe : new THREE.Color(opt.farbe).multiplyScalar(1.08).getHex();
    parts.push(farbTeil(new IC(r, 0),
      matrix(Math.cos(a) * d, r * 0.42, Math.sin(a) * d,
        a * 0.3, a, -a * 0.18, 1.15, 0.58, 0.92), ton, false));
  }
  return parts;
}

/* Der Stengel war ein VIERKANTIGES Rohr mit zwei Deckeln (16 Dreiecke) —
   bei 0,012 Weltmetern Radius. Drei offene Kanten (6 Dreiecke) sind an
   dieser Groesse nicht zu unterscheiden und sparen bei den 188 Feldreihen
   der Beispielkarte rund 7.500 Dreiecke. Zusaetzlich verjuengt sich der
   Stengel jetzt nach oben, statt gleich dick zu bleiben. */
var STENGEL = new THREE.CylinderGeometry(0.010, 0.026, 1, 3, 1, true);

function spross(x, y, z, farbe, i) {
  var parts = [];
  var h = 0.26 + (i % 3) * 0.055;
  parts.push(farbTeil(STENGEL,
    matrix(x, y + h / 2, z, (i % 2 ? 1 : -1) * 0.08, 0, (i % 3 - 1) * 0.09, 1, h, 1),
    0x607d43, false));
  parts.push(farbTeil(new CO(0.07, 0.16, 5),
    matrix(x + (i % 2 ? 0.025 : -0.025), y + h + 0.06, z), farbe, false));
  return parts;
}

function feldDetails(opt) {
  var parts = [];
  for (var i = 0; i < opt.punkte.length; i++) {
    var p = opt.punkte[i];
    parts.push.apply(parts, spross(p[0], p[1], p[2], opt.farbe, i));
  }
  return parts;
}

function zaunDetails(opt) {
  var parts = [];
  parts.push(farbTeil(new BX(opt.w, 0.10, 0.08),
    matrix(0, opt.h, -0.11, 0, 0, -0.31), opt.farbe, false));
  for (var i = 0; i < 2; i++) {
    var s = i ? 1 : -1;
    var r = 0.11 + i * 0.025;
    parts.push(farbTeil(new IC(r, 0),
      matrix(s * opt.steine * (0.72 + i * 0.08), r * 0.42, (i - 1) * 0.12,
        i * 0.4, i, -i * 0.2, 1.1, 0.55, 0.9), i % 2 ? 0x89847a : 0x9a9488, false));
  }
  return parts;
}

function uferDetails(opt) {
  var parts = [];
  for (var i = 0; i < 3; i++) {
    var dx = (i - 1) * 0.15 * opt.s;
    var h = (0.72 + i * 0.11) * opt.s;
    parts.push(farbTeil(new CY(0.018, 0.028, h, 4),
      matrix(opt.x + dx, opt.y + h / 2, opt.z + (i % 2) * 0.08, 0.05 * i, 0, -0.08 + i * 0.035),
      i % 2 ? 0x667c48 : 0x718650, false));
    if (i === 1) {
      parts.push(farbTeil(new CO(0.055, 0.20 * opt.s, 5),
        matrix(opt.x + dx, opt.y + h + 0.08 * opt.s, opt.z + (i % 2) * 0.08),
        0x806f4f, false));
    }
  }
  for (var k = 0; k < 2; k++) {
    var a = k / 2 * Math.PI * 2 + opt.seed * 0.03;
    var r = (0.12 + k * 0.025) * opt.s;
    parts.push(farbTeil(new IC(r, 0),
      matrix(opt.x + Math.cos(a) * 0.36 * opt.s, opt.y + r * 0.38,
        opt.z + Math.sin(a) * 0.28 * opt.s, a * 0.2, a, -a * 0.1, 1.2, 0.52, 0.9),
      k % 2 ? 0x8f8b80 : 0x777970, false));
  }
  return parts;
}

function gebaeudeDetails(opt) {
  var parts = [];
  var versatz = ((opt.seed % 7) - 3) * 0.035;
  var front = opt.front;
  var breite = opt.stufe;
  parts.push(farbTeil(new BX(breite, 0.12, 0.42),
    matrix(versatz, 0.025, front + 0.10, 0, 0, 0), 0x948b78, false));
  for (var i = 0; i < 2; i++) {
    var seite = i ? 1 : -1;
    var r = breite * (i ? 0.18 : 0.21);
    parts.push(farbTeil(new IC(r, 0),
      matrix(versatz + seite * breite * 0.18, 0.02, front + 0.48 + i * 0.32,
        0.12 * seite, 0.45 + i, -0.08 * seite, 1.18, 0.34, 0.88),
      i ? 0x8a8477 : 0xa29a88, false));
  }
  var sx = versatz - breite * 0.58;
  parts.push(farbTeil(new CY(0.018, 0.026, 0.28, 4),
    matrix(sx, 0.14, front + 0.34, 0, 0, -0.08), 0x607d43, false));
  parts.push(farbTeil(new CO(0.09, 0.18, 5),
    matrix(sx - 0.02, 0.34, front + 0.34, 0, 0, 0.10), 0x789452, false));
  return parts;
}

/**
 * Liefert fuer bekannte schwache Umweltpools eine veredelte Einzelgeometrie. * Unbekannte Pools werden identisch durchgereicht; dadurch bleibt der Hook
 * fuer Architektur und Kartenzeichen unsichtbar.
 */
export function veredleUmweltGeometrie(name, geo) {
  var details = null;
  if (BAUM[name]) details = baumDetails(BAUM[name]);
  else if (BODENDECKER[name]) details = bodendeckerDetails(geo, BODENDECKER[name]);
  else if (FELS[name]) details = felsDetails(FELS[name]);
  else if (FELD[name]) details = feldDetails(FELD[name]);
  else if (ZAUN[name]) details = zaunDetails(ZAUN[name]);
  else if (UFER[name]) details = uferDetails(UFER[name]);
  else if (GEBAEUDE[name]) details = gebaeudeDetails(GEBAEUDE[name]);
  if (!details) return geo;
  return verschmelze([geo].concat(details));
}
