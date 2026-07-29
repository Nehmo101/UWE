/* ==========================================================================
   Veredelung historischer Bau-, Wehr- und Hafenpools

   Die Geometrien dieses Bestands stammen aus mehreren Ausbauphasen. Dieser
   Pass gibt ihnen eine gemeinsame, handgebaute Silhouette: sichtbaren
   Bodenkontakt, facettierte Stuetzen, Dach- bzw. Mastakzente und bewusst
   unregelmaessige Konturen. Alles wird vor der Pool-Erzeugung in genau eine
   BufferGeometry verschmolzen. Es entstehen keine weiteren Renderobjekte,
   Kennungen oder Kartenfelder.
   ========================================================================== */
import * as THREE from 'three';

var KULTUR = Object.freeze([
  'turm', 'kuppel', 'arkade', 'windmuehle', 'tholos', 'tempel', 'bogen',
  'saeule', 'zwergenhalle', 'schmiedeturm', 'zwergentor', 'mauer',
  'elfenturm', 'pavillon', 'industrie', 'kran'
]);
var BEGLEITER = Object.freeze([
  'rankenblatt', 'stammliegend', 'fass', 'kiste', 'karren', 'brunnen',
  'laterne', 'heuhaufen', 'marktstand', 'boot', 'fensterlicht', 'pechnase',
  'zugbruecke', 'burgpalas', 'burgkapelle', 'burgkueche', 'schlossfluegel',
  'schlossturmhaube', 'schlossportal', 'aquaedukt', 'aquaeduktkopf',
  'stumpf'
]);
var WEHR = Object.freeze([
  'mauerstueck', 'mauerecke', 'mauerdurchlass', 'mauerbogen', 'zwingermauer',
  'mauertreppe', 'schildmauer', 'wehrturm', 'geschuetzturm', 'bergfried',
  'torhaus', 'barbakane', 'bastion', 'kettenturm', 'wappenstein',
  'wehrbanner', 'palisadentor', 'wachturm'
]);
var HAFEN = Object.freeze([
  'fischerboot', 'kutter', 'floss', 'boje', 'bake', 'kogge', 'dreimaster',
  'ruderschiff', 'wrack', 'holzbruecke', 'steinbruecke', 'tauhaufen',
  'reusenstapel', 'netzgestell', 'fischtrockner', 'hafenlaterne', 'bootshaus',
  'kaikran', 'leuchtfeuer', 'slipbahn', 'salzgarten', 'werfthalle', 'helling',
  'leuchtturm', 'kanalschleuse'
]);

export var BESTAND_BAU_VERFEINERTE_POOLS = Object.freeze(
  KULTUR.concat(BEGLEITER, WEHR, HAFEN)
);

var KULTUR_SET = new Set(KULTUR);
var BEGLEITER_SET = new Set(BEGLEITER);
var WEHR_SET = new Set(WEHR);
var HAFEN_SET = new Set(HAFEN);
var SCHIFFE = new Set([
  'fischerboot', 'kutter', 'floss', 'kogge', 'dreimaster', 'ruderschiff',
  'wrack', 'boot'
]);
var KLEINTEILE = new Set([
  'rankenblatt', 'stammliegend', 'fass', 'kiste', 'karren', 'brunnen',
  'laterne', 'heuhaufen', 'marktstand', 'fensterlicht', 'stumpf'
]);
var ZEICHEN = new Set(['rankenblatt', 'fensterlicht', 'wappenstein', 'wehrbanner']);

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

function hashName(name) {
  var h = 2166136261;
  for (var i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function grenzen(geo) {
  if (!geo.boundingBox) geo.computeBoundingBox();
  var b = geo.boundingBox;
  var sx = Math.max(0.2, b.max.x - b.min.x);
  var sy = Math.max(0.2, b.max.y - b.min.y);
  var sz = Math.max(0.2, b.max.z - b.min.z);
  return {
    minY: b.min.y, maxY: b.max.y, sx: sx, sy: sy, sz: sz,
    cx: (b.min.x + b.max.x) / 2, cz: (b.min.z + b.max.z) / 2
  };
}

function basisFarbe(geo) {
  var a = geo.attributes.color;
  if (!a || !a.count) return new THREE.Color(0x998b73);
  var schritt = Math.max(1, Math.floor(a.count / 24));
  var r = 0, g = 0, b = 0, n = 0;
  for (var i = 0; i < a.count; i += schritt) {
    r += a.getX(i);
    g += a.getY(i);
    b += a.getZ(i);
    n++;
  }
  return new THREE.Color(r / n, g / n, b / n);
}

function ton(farbe, faktor, seed) {
  var c = farbe.clone();
  var streu = ((seed % 17) - 8) * 0.0025;
  c.r = Math.min(1, Math.max(0, c.r * faktor + streu));
  c.g = Math.min(1, Math.max(0, c.g * faktor - streu * 0.55));
  c.b = Math.min(1, Math.max(0, c.b * faktor + streu * 0.35));
  return c;
}

function farbTeil(geo, mat, farbe, uvY) {
  var g = geo.clone();
  if (mat) g.applyMatrix4(mat);
  if (!g.attributes.normal) g.computeVertexNormals();
  var n = g.attributes.position.count;
  var farben = new Float32Array(n * 3);
  var uv = new Float32Array(n * 2);
  for (var i = 0; i < n; i++) {
    farben[i * 3] = farbe.r;
    farben[i * 3 + 1] = farbe.g;
    farben[i * 3 + 2] = farbe.b;
    uv[i * 2] = 0.5;
    uv[i * 2 + 1] = uvY === undefined ? 0.008 : uvY;
  }
  g.setAttribute('color', new THREE.BufferAttribute(farben, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

function verschmelze(geos) {
  var bereit = [], vGesamt = 0, iGesamt = 0, i, k;
  for (i = 0; i < geos.length; i++) {
    var g = geos[i];
    if (!g || !g.attributes || !g.attributes.position) continue;
    if (!g.attributes.normal || !g.attributes.color || !g.attributes.uv) {
      g = g.clone();
      if (!g.attributes.normal) g.computeVertexNormals();
      var n0 = g.attributes.position.count;
      if (!g.attributes.color) {
        var weiss = new Float32Array(n0 * 3);
        weiss.fill(1);
        g.setAttribute('color', new THREE.BufferAttribute(weiss, 3));
      }
      if (!g.attributes.uv) {
        g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n0 * 2), 2));
      }
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
    col.set(quelle.attributes.color.array.subarray(0, n * 3), vo * 3);
    uv.set(quelle.attributes.uv.array.subarray(0, n * 2), vo * 2);
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
  raus.computeBoundingBox();
  raus.computeBoundingSphere();
  return raus;
}

function box(x, y, z, mx, my, mz, rx, ry, rz, farbe) {
  return farbTeil(new THREE.BoxGeometry(x, y, z),
    matrix(mx, my, mz, rx, ry, rz), farbe);
}

function zylinder(rad, hoehe, seg, mx, my, mz, rx, ry, rz, farbe) {
  return farbTeil(new THREE.CylinderGeometry(rad * 0.82, rad, hoehe, seg),
    matrix(mx, my, mz, rx, ry, rz), farbe);
}

function kegel(rad, hoehe, seg, mx, my, mz, rx, ry, rz, farbe) {
  return farbTeil(new THREE.ConeGeometry(rad, hoehe, seg),
    matrix(mx, my, mz, rx, ry, rz), farbe);
}

function stein(rad, mx, my, mz, seed, farbe) {
  return farbTeil(new THREE.IcosahedronGeometry(rad, 0),
    matrix(mx, my, mz, seed * 0.013, seed * 0.021, -seed * 0.008,
      1.18, 0.52 + (seed % 5) * 0.04, 0.84), farbe);
}

function kulturDetails(m, c, seed) {
  var dunkel = ton(c, 0.72, seed);
  var hell = ton(c, 1.22, seed);
  var y = m.minY + m.sy * 0.035;
  var parts = [
    box(m.sx * 1.10, m.sy * 0.07, m.sz * 1.08, m.cx, y, m.cz,
      0, seed * 0.0009, 0, dunkel)
  ];
  for (var i = 0; i < 2; i++) {
    var s = i ? 1 : -1;
    parts.push(box(m.sx * 0.13, m.sy * 0.46, m.sz * 0.18,
      m.cx + s * m.sx * 0.48, m.minY + m.sy * 0.23,
      m.cz + ((seed >>> (i + 2)) % 3 - 1) * m.sz * 0.08,
      0, s * 0.05, s * 0.075, dunkel));
  }
  parts.push(kegel(Math.min(m.sx, m.sz) * 0.10, m.sy * 0.22, 5,
    m.cx + ((seed % 5) - 2) * m.sx * 0.045, m.maxY + m.sy * 0.10, m.cz,
    0, seed * 0.017, 0, hell));
  return parts;
}

function kleinDetails(m, c, seed) {
  var holz = ton(c, 0.70, seed);
  var akzent = ton(c, 1.30, seed);
  var rad = Math.min(m.sx, m.sz);
  var parts = [
    stein(rad * 0.17, m.cx - m.sx * 0.25, m.minY + rad * 0.035,
      m.cz + m.sz * 0.12, seed, holz),
    stein(rad * 0.13, m.cx + m.sx * 0.28, m.minY + rad * 0.028,
      m.cz - m.sz * 0.17, seed + 19, ton(c, 0.86, seed))
  ];
  if (ZEICHEN.has([...KLEINTEILE].find(function (n) { return hashName(n) === seed; }))) {
    parts.push(box(m.sx * 0.78, m.sy * 0.055, m.sz * 0.09, m.cx,
      m.minY + m.sy * 0.56, m.cz + m.sz * 0.06, 0, 0, seed % 2 ? 0.08 : -0.08,
      akzent));
  } else {
    parts.push(zylinder(rad * 0.08, m.sy * 0.62, 5, m.cx + m.sx * 0.34,
      m.minY + m.sy * 0.31, m.cz, 0, 0, (seed % 7 - 3) * 0.025, holz));
  }
  parts.push(kegel(rad * 0.105, m.sy * 0.18, 5, m.cx + m.sx * 0.34,
    m.minY + m.sy * 0.69, m.cz, 0, seed * 0.01, 0, akzent));
  return parts;
}

function begleiterBauDetails(m, c, seed) {
  var dunkel = ton(c, 0.68, seed);
  var akzent = ton(c, 1.27, seed);
  return [
    box(m.sx * 1.08, m.sy * 0.075, m.sz * 1.08, m.cx,
      m.minY + m.sy * 0.025, m.cz, 0, seed * 0.001, 0, dunkel),
    box(m.sx * 0.13, m.sy * 0.52, m.sz * 0.20, m.cx - m.sx * 0.47,
      m.minY + m.sy * 0.26, m.cz + m.sz * 0.25, 0, 0.04, -0.07, dunkel),
    box(m.sx * 0.13, m.sy * 0.48, m.sz * 0.20, m.cx + m.sx * 0.47,
      m.minY + m.sy * 0.24, m.cz - m.sz * 0.23, 0, -0.04, 0.07, dunkel),
    stein(Math.min(m.sx, m.sz) * 0.13, m.cx + (seed % 2 ? 1 : -1) * m.sx * 0.30,
      m.maxY + m.sy * 0.035, m.cz, seed, akzent)
  ];
}

function wehrDetails(m, c, seed, zeichen) {
  var steinTon = ton(c, 0.73, seed);
  var licht = ton(c, 1.22, seed);
  var parts = [
    box(m.sx * 1.13, m.sy * 0.08, m.sz * 1.12, m.cx,
      m.minY + m.sy * 0.025, m.cz, 0, seed * 0.0011, 0, steinTon)
  ];
  for (var i = 0; i < 2; i++) {
    var s = i ? 1 : -1;
    parts.push(box(m.sx * 0.17, m.sy * 0.60, m.sz * 0.21,
      m.cx + s * m.sx * 0.49, m.minY + m.sy * 0.29,
      m.cz - s * m.sz * 0.25, 0, s * 0.04, s * 0.10, steinTon));
  }
  for (var k = 0; k < 3; k++) {
    parts.push(box(m.sx * 0.16, m.sy * (zeichen ? 0.12 : 0.17), m.sz * 0.18,
      m.cx + (k - 1) * m.sx * 0.32, m.maxY + m.sy * 0.055,
      m.cz + ((seed >>> (k + 1)) % 3 - 1) * m.sz * 0.035,
      0, 0, (k - 1) * 0.025, k === 1 ? licht : steinTon));
  }
  return parts;
}

function schiffDetails(m, c, seed) {
  var holz = ton(c, 0.63, seed);
  var segel = ton(c, 1.34, seed);
  var quer = m.sx >= m.sz;
  var laenge = Math.max(m.sx, m.sz);
  var breite = Math.min(m.sx, m.sz);
  var rx = quer ? 0 : Math.PI / 2;
  var parts = [
    box(quer ? laenge * 0.92 : breite * 0.13, breite * 0.12,
      quer ? breite * 0.13 : laenge * 0.92, m.cx, m.minY - m.sy * 0.015,
      m.cz, 0, seed * 0.0012, 0, holz),
    zylinder(breite * 0.055, m.sy * 0.94, 6, m.cx, m.minY + m.sy * 0.58,
      m.cz, 0, 0, 0, holz)
  ];
  parts.push(box(quer ? laenge * 0.42 : m.sx * 0.045, m.sy * 0.38,
    quer ? m.sz * 0.045 : laenge * 0.42,
    m.cx + (quer ? laenge * 0.12 : 0), m.minY + m.sy * 0.67,
    m.cz + (quer ? 0 : laenge * 0.12), 0, rx, seed % 2 ? 0.08 : -0.08, segel));
  for (var i = 0; i < 2; i++) {
    var s = i ? 1 : -1;
    parts.push(box(quer ? breite * 0.05 : breite * 0.82, m.sy * 0.055,
      quer ? breite * 0.82 : breite * 0.05,
      m.cx + (quer ? s * laenge * 0.24 : 0), m.minY + m.sy * 0.20,
      m.cz + (quer ? 0 : s * laenge * 0.24), 0, 0, s * 0.11, holz));
  }
  return parts;
}

function hafenDetails(m, c, seed) {
  var dunkel = ton(c, 0.67, seed);
  var licht = ton(c, 1.24, seed);
  var rad = Math.min(m.sx, m.sz);
  var parts = [
    box(m.sx * 1.08, m.sy * 0.07, m.sz * 1.08, m.cx,
      m.minY + m.sy * 0.02, m.cz, 0, seed * 0.001, 0, dunkel)
  ];
  for (var i = 0; i < 2; i++) {
    var s = i ? 1 : -1;
    parts.push(zylinder(rad * 0.075, m.sy * 0.42, 5,
      m.cx + s * m.sx * 0.39, m.minY + m.sy * 0.22,
      m.cz + s * m.sz * 0.25, 0, 0, s * 0.055, dunkel));
    parts.push(stein(rad * 0.11, m.cx + s * m.sx * 0.46,
      m.minY + rad * 0.03, m.cz - s * m.sz * 0.37, seed + i * 17, licht));
  }
  parts.push(box(m.sx * 0.82, m.sy * 0.07, m.sz * 0.08, m.cx,
    m.minY + m.sy * 0.46, m.cz + m.sz * 0.28, 0, 0, seed % 2 ? 0.05 : -0.05,
    licht));
  return parts;
}

/**
 * Veredelt exakt die gelisteten Bestandspools. Unbekannte Geometrien werden
 * referenzidentisch durchgereicht, damit nachfolgende Spezialpaesse unsichtbar
 * bleiben.
 */
export function veredleBestandBau(name, geo) {
  var gruppe = KULTUR_SET.has(name) || BEGLEITER_SET.has(name) ||
    WEHR_SET.has(name) || HAFEN_SET.has(name);
  if (!gruppe) return geo;
  var m = grenzen(geo);
  var c = basisFarbe(geo);
  var seed = hashName(name);
  var details;
  if (KULTUR_SET.has(name)) details = kulturDetails(m, c, seed);
  else if (KLEINTEILE.has(name)) details = kleinDetails(m, c, seed);
  else if (BEGLEITER_SET.has(name)) {
    details = SCHIFFE.has(name) ? schiffDetails(m, c, seed) :
      begleiterBauDetails(m, c, seed);
  } else if (WEHR_SET.has(name)) details = wehrDetails(m, c, seed, ZEICHEN.has(name));
  else details = SCHIFFE.has(name) ? schiffDetails(m, c, seed) :
    hafenDetails(m, c, seed);
  return verschmelze([geo].concat(details));
}
