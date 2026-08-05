/* ==========================================================================
   Veredelung des Welle-3-Bestandskatalogs

   Dieser Pass gibt 149 aelteren Natur-, Kultur- und Requisitenpools eine
   lesbare, handgebaute Silhouette. Alle Aufsaetze werden deterministisch in
   die vorhandene BufferGeometry verschmolzen: keine neuen Poolkennungen,
   Materialien, Meshes oder Draw Calls.
   ========================================================================== */
import * as THREE from 'three';
import { M, mergeGeos, part } from './geometrie-hilfen.js';

var FAMILIEN = Object.freeze({
  natur_pilz: Object.freeze([
    'felsbogen', 'geysir', 'schlammtopf', 'riesenpilz', 'pilzhut',
    'leuchtpilz', 'dornbusch', 'bambus', 'blumenteppich', 'lavaspalte'
  ]),
  ruinen: Object.freeze([
    'mauerruine', 'saeulenstumpf', 'giebelruine', 'gewoelbekeller',
    'bruchkante', 'truemmerhaufen', 'statuentorso', 'treppenruine',
    'rissspalt', 'ruinenturm', 'tempelruine'
  ]),
  arbor: Object.freeze([
    'rankenstamm', 'rankenknoten', 'blattsteg', 'rankentreppe',
    'rankenleiter', 'saftzapfer', 'lichtbluete', 'sporenlaterne',
    'wurzelbogen', 'wurzelanker', 'samenkapsel', 'rankenkai',
    'huetersaeule', 'arborschrein', 'rankenaltar', 'lichtsammler',
    'samenreliquiar', 'blattkanzel', 'gebetsband', 'rankentor'
  ]),
  eis: Object.freeze([
    'iglu', 'schlitten', 'gletschertor', 'pelzzelt', 'schneewall',
    'thermalquelle', 'geweihgestell'
  ]),
  wueste: Object.freeze([
    'wuestenzelt', 'kleinzelt', 'zisterne', 'windfaenger', 'lehmspeicher',
    'palme', 'oasenbecken', 'traenke', 'sandwehe', 'obelisk', 'gebein',
    'lehmkuppelhaus'
  ]),
  moor: Object.freeze([
    'torfstich', 'torfstapel', 'moorhuette', 'irrlicht', 'pfahlgoetze'
  ]),
  hof: Object.freeze([
    'rebenreihe', 'hopfengeruest', 'garbe', 'heuschober', 'taubenschlag',
    'bienenstand', 'viehstall', 'kornspeicher', 'dreschtenne',
    'terrassenfeld', 'vogelscheuche', 'wassermuehle'
  ]),
  handwerk: Object.freeze([
    'schmiede', 'koehlermeiler', 'ziegelofen', 'kalkofen', 'gerbergruben',
    'faerbergestell', 'seilerbahn', 'saegewerk', 'steinmetzhof',
    'glashuette', 'lagerhaus', 'hochschlot', 'windpumpe'
  ]),
  sakral: Object.freeze([
    'kapelle', 'glockenturm', 'kathedralenschiff', 'rosette', 'bildstock',
    'steinkreis', 'menhir', 'feuerschale', 'opferstein', 'grabhuegel'
  ]),
  wohnbau: Object.freeze([
    'hofdurchfahrt', 'baumhaus', 'rankenhaus', 'elfenlaube', 'stollenhaus',
    'wohnblock', 'gaube', 'kamin'
  ]),
  requisiten: Object.freeze([
    'wagenrad', 'holzstapel', 'wasserbottich', 'waescheleine', 'bank',
    'tisch', 'feuerstelle', 'kochkessel', 'gartenbeet', 'tontoepfe',
    'sackstapel', 'schubkarre', 'leiter', 'blumenkasten', 'brunnentrog',
    'marktkorb'
  ]),
  tiere: Object.freeze([
    'ochsengespann', 'kutsche', 'pferd', 'rind', 'schaf', 'ziege'
  ]),
  wasserflora: Object.freeze([
    'koralle', 'seetang', 'aalreuse', 'schilf', 'seerose', 'moorkahn',
    'eisscholle'
  ]),
  ufer: Object.freeze([
    'kaskadenstufe', 'muschelbank', 'treibholz', 'wurzelstelze',
    'eisfischerhuette', 'wasserrad', 'pfahlhaus', 'wollgras'
  ]),
  schwebend: Object.freeze([
    'schwebefels', 'sturzwurzel', 'moewe', 'rankengleiter'
  ])
});
export var BESTAND_KATALOG_FAMILIEN = FAMILIEN;

export var BESTAND_KATALOG_VERFEINERTE_POOLS = Object.freeze(
  Object.values(FAMILIEN).flat()
);

var ZU_FAMILIE = Object.create(null);
var ZU_INDEX = Object.create(null);
BESTAND_KATALOG_VERFEINERTE_POOLS.forEach(function (name, index) {
  ZU_INDEX[name] = index;
});
Object.keys(FAMILIEN).forEach(function (familie) {
  FAMILIEN[familie].forEach(function (name) {
    ZU_FAMILIE[name] = familie;
  });
});

var BOX = new THREE.BoxGeometry(1, 1, 1);
var CY6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1, false);
var CONE6 = new THREE.ConeGeometry(0.5, 1, 6, 1, false);
var ICOSA = new THREE.IcosahedronGeometry(0.5, 0);
var TORUS = new THREE.TorusGeometry(0.5, 0.12, 4, 8);
var PI = Math.PI;

function opakerTeil(basis, matrix, farbe) {
  var geo = part(basis, matrix, farbe);
  var uv = new Float32Array(geo.attributes.position.count * 2);
  for (var i = 0; i < geo.attributes.position.count; i++) {
    uv[i * 2] = 0.5;
    uv[i * 2 + 1] = 0.008;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

function kasten(x, y, z, rx, ry, rz, sx, sy, sz, farbe) {
  return opakerTeil(BOX, M(x, y, z, rx, ry, rz, sx, sy, sz), farbe);
}

function stab(x, y, z, rx, ry, rz, sx, sy, sz, farbe) {
  return opakerTeil(CY6, M(x, y, z, rx, ry, rz, sx, sy, sz), farbe);
}

function spitze(x, y, z, rx, ry, rz, sx, sy, sz, farbe) {
  return opakerTeil(CONE6, M(x, y, z, rx, ry, rz, sx, sy, sz), farbe);
}

function knolle(x, y, z, rx, ry, rz, sx, sy, sz, farbe) {
  return opakerTeil(ICOSA, M(x, y, z, rx, ry, rz, sx, sy, sz), farbe);
}

function ring(x, y, z, rx, ry, rz, sx, sy, sz, farbe) {
  return opakerTeil(TORUS, M(x, y, z, rx, ry, rz, sx, sy, sz), farbe);
}

function grenzen(geo) {
  if (!geo.boundingBox) geo.computeBoundingBox();
  var box = geo.boundingBox;
  return {
    minY: box.min.y,
    maxY: box.max.y,
    cx: (box.min.x + box.max.x) / 2,
    cz: (box.min.z + box.max.z) / 2,
    sx: Math.max(0.2, box.max.x - box.min.x),
    sy: Math.max(0.2, box.max.y - box.min.y),
    sz: Math.max(0.2, box.max.z - box.min.z)
  };
}

function naturDetails(name, b, v) {
  var x = b.cx + b.sx * 0.59;
  var pilz = name === 'riesenpilz' || name === 'pilzhut' || name === 'leuchtpilz';
  if (pilz) {
    return [
      stab(x, b.minY + b.sy * 0.25, b.cz, 0, 0, -0.11,
        b.sx * 0.13, b.sy * 0.5, b.sz * 0.13, 0xd9c99f),
      knolle(x - b.sx * 0.025, b.minY + b.sy * 0.54, b.cz, 0, 0.2, 0,
        b.sx * 0.5 * v, b.sy * 0.2, b.sz * 0.46, name === 'leuchtpilz' ? 0xb9e8cf : 0xb85e4b),
      stab(x, b.minY + b.sy * 0.51, b.cz, PI / 2, 0, 0,
        b.sx * 0.31, b.sy * 0.035, b.sz * 0.31, 0xf1ddb5)
    ];
  }
  if (name === 'geysir' || name === 'schlammtopf') {
    var wasser = name === 'geysir' ? 0xb7e1df : 0x806650;
    return [
      ring(x, b.minY + b.sy * 0.04, b.cz, PI / 2, 0, 0,
        b.sx * 0.48 * v, b.sy * 0.15, b.sz * 0.48, 0x6f7d68),
      spitze(x, b.minY + b.sy * 0.27, b.cz, 0, 0, 0,
        b.sx * 0.16, b.sy * 0.5, b.sz * 0.16, wasser),
      knolle(x + b.sx * 0.09, b.minY + b.sy * 0.49, b.cz, 0, 0, 0,
        b.sx * 0.13, b.sy * 0.12, b.sz * 0.13, 0xe9efe0)
    ];
  }
  if (name === 'bambus' || name === 'dornbusch' || name === 'blumenteppich') {
    return [
      stab(x, b.minY + b.sy * 0.3, b.cz, 0.08, 0, -0.14,
        b.sx * 0.09, b.sy * 0.62 * v, b.sz * 0.09, 0x557f42),
      stab(x + b.sx * 0.12, b.minY + b.sy * 0.23, b.cz + b.sz * 0.08,
        -0.15, 0, 0.18, b.sx * 0.06, b.sy * 0.44, b.sz * 0.06, 0x7f9b52),
      knolle(x - b.sx * 0.08, b.minY + b.sy * 0.49, b.cz, 0, 0, 0,
        b.sx * 0.24, b.sy * 0.11, b.sz * 0.34, 0xd9a75d)
    ];
  }
  return [
    spitze(x, b.minY + b.sy * 0.27, b.cz, 0.05, 0, 0.12,
      b.sx * 0.28 * v, b.sy * 0.55, b.sz * 0.3, 0x596054),
    knolle(x - b.sx * 0.15, b.minY + b.sy * 0.08, b.cz + b.sz * 0.12,
      0, 0, 0, b.sx * 0.32, b.sy * 0.17, b.sz * 0.28, 0x8b7661),
    kasten(x + b.sx * 0.04, b.minY + b.sy * 0.05, b.cz - b.sz * 0.15,
      0.2, 0.4, 0.1, b.sx * 0.2, b.sy * 0.1, b.sz * 0.23, 0xc36d45)
  ];
}

function ruinenDetails(_name, b, v) {
  var x = b.cx + b.sx * 0.6;
  return [
    kasten(x, b.minY + b.sy * 0.29, b.cz, 0, 0.12, -0.08,
      b.sx * 0.2 * v, b.sy * 0.58, b.sz * 0.26, 0x8e8371),
    kasten(x - b.sx * 0.07, b.minY + b.sy * 0.59, b.cz, 0.1, 0.18, 0.24,
      b.sx * 0.38, b.sy * 0.12, b.sz * 0.23, 0xb2a287),
    knolle(x - b.sx * 0.22, b.minY + b.sy * 0.07, b.cz + b.sz * 0.17,
      0, 0.3, 0, b.sx * 0.3, b.sy * 0.14, b.sz * 0.27, 0x6f695d)
  ];
}

function arborDetails(name, b, v) {
  var x = b.cx + b.sx * 0.58;
  var bluete = name === 'lichtbluete' || name === 'sporenlaterne' ||
    name === 'samenkapsel' || name === 'samenreliquiar';
  return [
    stab(x, b.minY + b.sy * 0.32, b.cz, 0.18, 0, -0.22,
      b.sx * 0.12, b.sy * 0.68 * v, b.sz * 0.12, 0x476d45),
    stab(x - b.sx * 0.12, b.minY + b.sy * 0.22, b.cz + b.sz * 0.06,
      -0.2, 0, 0.65, b.sx * 0.075, b.sy * 0.52, b.sz * 0.075, 0x6f8b50),
    knolle(x + b.sx * 0.07, b.minY + b.sy * 0.58, b.cz, 0, 0.25, -0.28,
      b.sx * 0.38, b.sy * 0.12, b.sz * 0.5, 0x83a95b),
    knolle(x, b.minY + b.sy * 0.63, b.cz + b.sz * 0.04, 0, 0, 0,
      b.sx * 0.13, b.sy * 0.12, b.sz * 0.13, bluete ? 0xf5d27a : 0xa8d7a4)
  ];
}

function eisDetails(name, b, v) {
  var x = b.cx + b.sx * 0.6;
  var warm = name === 'thermalquelle';
  return [
    spitze(x, b.minY + b.sy * 0.31, b.cz, 0, 0, -0.1,
      b.sx * 0.28 * v, b.sy * 0.64, b.sz * 0.28, warm ? 0x8fd2c8 : 0xbadce2),
    spitze(x - b.sx * 0.16, b.minY + b.sy * 0.2, b.cz + b.sz * 0.13,
      0.12, 0, 0.18, b.sx * 0.18, b.sy * 0.4, b.sz * 0.2, 0xe1eef0),
    kasten(x - b.sx * 0.04, b.minY + b.sy * 0.045, b.cz - b.sz * 0.13,
      0, 0.17, 0, b.sx * 0.5, b.sy * 0.09, b.sz * 0.38, 0x91b8c4)
  ];
}

function wuesteDetails(name, b, v) {
  var x = b.cx + b.sx * 0.59;
  if (name === 'palme') {
    return [
      stab(x, b.minY + b.sy * 0.34, b.cz, 0.05, 0, -0.12,
        b.sx * 0.1, b.sy * 0.72 * v, b.sz * 0.1, 0x8b6744),
      knolle(x, b.minY + b.sy * 0.68, b.cz, 0.2, 0.5, -0.1,
        b.sx * 0.55, b.sy * 0.08, b.sz * 0.2, 0x527e49),
      knolle(x, b.minY + b.sy * 0.68, b.cz, -0.2, -0.7, 0.1,
        b.sx * 0.22, b.sy * 0.08, b.sz * 0.55, 0x6d9852)
    ];
  }
  if (name === 'sandwehe') {
    return [
      knolle(x, b.minY + b.sy * 0.08, b.cz, 0, 0.25, 0,
        b.sx * 0.65 * v, b.sy * 0.16, b.sz * 0.55, 0xd8b777),
      ring(x - b.sx * 0.08, b.minY + b.sy * 0.05, b.cz, PI / 2, 0, 0,
        b.sx * 0.45, b.sy * 0.12, b.sz * 0.38, 0xc99b5b)
    ];
  }
  return [
    kasten(x, b.minY + b.sy * 0.22, b.cz, 0, 0.08, -0.04,
      b.sx * 0.25 * v, b.sy * 0.44, b.sz * 0.32, 0xb97952),
    kasten(x - b.sx * 0.09, b.minY + b.sy * 0.07, b.cz,
      0, 0.08, 0, b.sx * 0.46, b.sy * 0.14, b.sz * 0.43, 0xd1a36c),
    knolle(x + b.sx * 0.13, b.minY + b.sy * 0.11, b.cz + b.sz * 0.19,
      0, 0, 0, b.sx * 0.16, b.sy * 0.22, b.sz * 0.16, 0x79a690)
  ];
}

function moorDetails(name, b, v) {
  var x = b.cx + b.sx * 0.59;
  if (name === 'irrlicht') {
    return [
      stab(x, b.minY + b.sy * 0.22, b.cz, 0.1, 0, 0,
        b.sx * 0.045, b.sy * 0.45, b.sz * 0.045, 0x526c4d),
      knolle(x, b.minY + b.sy * 0.48, b.cz, 0, 0, 0,
        b.sx * 0.19 * v, b.sy * 0.18, b.sz * 0.19, 0xb8e7bd),
      knolle(x + b.sx * 0.16, b.minY + b.sy * 0.32, b.cz + b.sz * 0.08,
        0, 0, 0, b.sx * 0.09, b.sy * 0.09, b.sz * 0.09, 0xe2ed9c)
    ];
  }
  return [
    kasten(x, b.minY + b.sy * 0.065, b.cz, 0.03, 0.12, -0.02,
      b.sx * 0.48 * v, b.sy * 0.13, b.sz * 0.42, 0x5c4939),
    stab(x + b.sx * 0.1, b.minY + b.sy * 0.31, b.cz + b.sz * 0.11,
      0.1, 0, -0.08, b.sx * 0.055, b.sy * 0.54, b.sz * 0.055, 0x66764b),
    stab(x - b.sx * 0.1, b.minY + b.sy * 0.25, b.cz - b.sz * 0.1,
      -0.1, 0, 0.1, b.sx * 0.045, b.sy * 0.43, b.sz * 0.045, 0x87935e)
  ];
}

function hofDetails(name, b, v) {
  var x = b.cx + b.sx * 0.59;
  if (name === 'garbe' || name === 'heuschober') {
    return [
      spitze(x, b.minY + b.sy * 0.25, b.cz, 0, 0, 0,
        b.sx * 0.3 * v, b.sy * 0.5, b.sz * 0.34, 0xd5ad58),
      stab(x, b.minY + b.sy * 0.25, b.cz, 0, 0, 0,
        b.sx * 0.07, b.sy * 0.54, b.sz * 0.07, 0x8b603c),
      ring(x, b.minY + b.sy * 0.23, b.cz, PI / 2, 0, 0,
        b.sx * 0.28, b.sy * 0.08, b.sz * 0.28, 0x9f7041)
    ];
  }
  if (name === 'wassermuehle') {
    return [
      ring(x, b.minY + b.sy * 0.36, b.cz, 0, 0, 0,
        b.sx * 0.58 * v, b.sy * 0.58, b.sz * 0.18, 0x79553a),
      stab(x, b.minY + b.sy * 0.36, b.cz, PI / 2, 0, 0,
        b.sx * 0.1, b.sy * 0.3, b.sz * 0.1, 0xa3784d)
    ];
  }
  return [
    stab(x - b.sx * 0.13, b.minY + b.sy * 0.28, b.cz, 0, 0, 0,
      b.sx * 0.07, b.sy * 0.56, b.sz * 0.07, 0x745039),
    stab(x + b.sx * 0.13, b.minY + b.sy * 0.28, b.cz, 0, 0, 0,
      b.sx * 0.07, b.sy * 0.56, b.sz * 0.07, 0x8e653e),
    kasten(x, b.minY + b.sy * 0.34, b.cz, 0, 0, 0.08,
      b.sx * 0.48 * v, b.sy * 0.09, b.sz * 0.09, 0xb1844f)
  ];
}

function handwerkDetails(name, b, v) {
  var x = b.cx + b.sx * 0.59;
  if (name === 'windpumpe') {
    return [
      stab(x, b.minY + b.sy * 0.35, b.cz, 0, 0, 0,
        b.sx * 0.07, b.sy * 0.72, b.sz * 0.07, 0x685a4e),
      ring(x, b.minY + b.sy * 0.56, b.cz, 0, 0, 0,
        b.sx * 0.52 * v, b.sy * 0.52, b.sz * 0.13, 0x89918b),
      kasten(x, b.minY + b.sy * 0.56, b.cz, 0, 0, 0.75,
        b.sx * 0.05, b.sy * 0.52, b.sz * 0.05, 0xc3aa7b)
    ];
  }
  return [
    kasten(x, b.minY + b.sy * 0.2, b.cz, 0, 0.12, -0.12,
      b.sx * 0.19 * v, b.sy * 0.4, b.sz * 0.23, 0x584941),
    kasten(x - b.sx * 0.1, b.minY + b.sy * 0.39, b.cz, 0, -0.1, 0.66,
      b.sx * 0.1, b.sy * 0.5, b.sz * 0.1, 0x8a6041),
    ring(x, b.minY + b.sy * 0.19, b.cz + b.sz * 0.16, PI / 2, 0, 0,
      b.sx * 0.26, b.sy * 0.07, b.sz * 0.26, name === 'glashuette' ? 0x7eb9ac : 0x6d7471)
  ];
}

function sakralDetails(name, b, v) {
  var x = b.cx + b.sx * 0.59;
  var feuer = name === 'feuerschale';
  return [
    kasten(x, b.minY + b.sy * 0.055, b.cz, 0, 0.1, 0,
      b.sx * 0.52 * v, b.sy * 0.11, b.sz * 0.48, 0xaaa088),
    stab(x, b.minY + b.sy * 0.29, b.cz, 0, 0, 0,
      b.sx * 0.13, b.sy * 0.48, b.sz * 0.13, 0x827b70),
    spitze(x, b.minY + b.sy * 0.58, b.cz, 0, 0, 0,
      b.sx * 0.19, b.sy * 0.24, b.sz * 0.19, feuer ? 0xe89a4a : 0xd8bc6a),
    ring(x, b.minY + b.sy * 0.45, b.cz, 0, 0, 0,
      b.sx * 0.27, b.sy * 0.27, b.sz * 0.08, 0xc9b56e)
  ];
}

function wohnbauDetails(_name, b, v) {
  var x = b.cx + b.sx * 0.58;
  return [
    kasten(x, b.minY + b.sy * 0.055, b.cz, 0, 0.08, 0,
      b.sx * 0.52 * v, b.sy * 0.11, b.sz * 0.48, 0x947355),
    stab(x - b.sx * 0.14, b.minY + b.sy * 0.31, b.cz, 0, 0, 0,
      b.sx * 0.075, b.sy * 0.54, b.sz * 0.075, 0x69462f),
    stab(x + b.sx * 0.14, b.minY + b.sy * 0.31, b.cz, 0, 0, 0,
      b.sx * 0.075, b.sy * 0.54, b.sz * 0.075, 0x795238),
    kasten(x, b.minY + b.sy * 0.56, b.cz, 0, 0, 0,
      b.sx * 0.42, b.sy * 0.09, b.sz * 0.12, 0xb78f62)
  ];
}

function requisitenDetails(name, b, v) {
  var x = b.cx + b.sx * 0.59;
  if (name === 'wagenrad') {
    return [
      ring(x, b.minY + b.sy * 0.28, b.cz, 0, 0, 0,
        b.sx * 0.5 * v, b.sy * 0.5, b.sz * 0.15, 0x795236),
      stab(x, b.minY + b.sy * 0.28, b.cz, PI / 2, 0, 0,
        b.sx * 0.09, b.sy * 0.22, b.sz * 0.09, 0x9c7449)
    ];
  }
  if (name === 'feuerstelle' || name === 'kochkessel') {
    return [
      ring(x, b.minY + b.sy * 0.08, b.cz, PI / 2, 0, 0,
        b.sx * 0.48 * v, b.sy * 0.11, b.sz * 0.48, 0x5f554a),
      knolle(x, b.minY + b.sy * 0.18, b.cz, 0, 0, 0,
        b.sx * 0.3, b.sy * 0.25, b.sz * 0.3, 0x43484a),
      spitze(x, b.minY + b.sy * 0.38, b.cz, 0, 0, 0,
        b.sx * 0.14, b.sy * 0.32, b.sz * 0.14, 0xe38b42)
    ];
  }
  return [
    kasten(x, b.minY + b.sy * 0.12, b.cz, 0.04, 0.18, -0.04,
      b.sx * 0.4 * v, b.sy * 0.24, b.sz * 0.36, 0x9a7048),
    kasten(x, b.minY + b.sy * 0.24, b.cz, 0, 0, 0.55,
      b.sx * 0.08, b.sy * 0.44, b.sz * 0.08, 0x625044),
    ring(x, b.minY + b.sy * 0.14, b.cz, PI / 2, 0, 0,
      b.sx * 0.34, b.sy * 0.08, b.sz * 0.34, 0xc39b61)
  ];
}

function tiereDetails(name, b, v) {
  if (name === 'ochsengespann' || name === 'kutsche') {
    return [
      stab(b.cx, b.minY + b.sy * 0.3, b.cz + b.sz * 0.55,
        PI / 2, 0, 0, b.sx * 0.045, b.sy * 0.62 * v, b.sz * 0.045, 0x684b39),
      ring(b.cx - b.sx * 0.42, b.minY + b.sy * 0.23, b.cz - b.sz * 0.25,
        0, 0, 0, b.sx * 0.3, b.sy * 0.3, b.sz * 0.1, 0x574338),
      ring(b.cx + b.sx * 0.42, b.minY + b.sy * 0.23, b.cz - b.sz * 0.25,
        0, 0, 0, b.sx * 0.3, b.sy * 0.3, b.sz * 0.1, 0x574338)
    ];
  }
  var hell = name === 'schaf' ? 0xd8d2bd : (name === 'rind' ? 0x8c6b51 : 0xac8764);
  var kopfZ = b.cz + b.sz * 0.54;
  var parts = [
    stab(b.cx, b.minY + b.sy * 0.7, b.cz + b.sz * 0.34,
      -0.55, 0, 0, b.sx * 0.16, b.sy * 0.48 * v, b.sz * 0.16, hell),
    knolle(b.cx, b.minY + b.sy * 0.86, kopfZ, -0.08, 0, 0,
      b.sx * 0.38, b.sy * 0.23, b.sz * 0.28, hell),
    spitze(b.cx - b.sx * 0.14, b.minY + b.sy * 0.98, kopfZ - b.sz * 0.05,
      0.2, 0, -0.24, b.sx * 0.1, b.sy * 0.2, b.sz * 0.09, 0x59483b),
    spitze(b.cx + b.sx * 0.14, b.minY + b.sy * 0.98, kopfZ - b.sz * 0.05,
      0.2, 0, 0.24, b.sx * 0.1, b.sy * 0.2, b.sz * 0.09, 0x59483b),
    stab(b.cx, b.minY + b.sy * 0.58, b.cz - b.sz * 0.54,
      0.8, 0, 0, b.sx * 0.045, b.sy * 0.36, b.sz * 0.045, 0x5e493b)
  ];
  return parts;
}

function wasserfloraDetails(name, b, v) {
  var x = b.cx + b.sx * 0.59;
  if (name === 'eisscholle') {
    return [
      knolle(x, b.minY + b.sy * 0.06, b.cz, 0, 0.18, 0,
        b.sx * 0.62 * v, b.sy * 0.12, b.sz * 0.58, 0xb8dce2),
      spitze(x + b.sx * 0.08, b.minY + b.sy * 0.19, b.cz, 0, 0, -0.1,
        b.sx * 0.18, b.sy * 0.28, b.sz * 0.18, 0xe1eef0)
    ];
  }
  if (name === 'seerose' || name === 'koralle') {
    return [
      knolle(x, b.minY + b.sy * 0.08, b.cz, 0, 0.25, 0,
        b.sx * 0.58 * v, b.sy * 0.1, b.sz * 0.46, 0x5b9870),
      stab(x, b.minY + b.sy * 0.24, b.cz, 0, 0, 0,
        b.sx * 0.055, b.sy * 0.36, b.sz * 0.055, 0x3d7b67),
      knolle(x, b.minY + b.sy * 0.43, b.cz, 0, 0, 0,
        b.sx * 0.19, b.sy * 0.13, b.sz * 0.19, name === 'seerose' ? 0xe4a6ae : 0xe69a70)
    ];
  }
  return [
    ring(x, b.minY + b.sy * 0.04, b.cz, PI / 2, 0, 0,
      b.sx * 0.5 * v, b.sy * 0.08, b.sz * 0.5, 0x477f75),
    stab(x - b.sx * 0.09, b.minY + b.sy * 0.25, b.cz, 0.1, 0, -0.08,
      b.sx * 0.05, b.sy * 0.5, b.sz * 0.05, 0x4b835f),
    stab(x + b.sx * 0.1, b.minY + b.sy * 0.21, b.cz + b.sz * 0.08,
      -0.12, 0, 0.1, b.sx * 0.045, b.sy * 0.42, b.sz * 0.045, 0x77a66e)
  ];
}

function uferDetails(name, b, v) {
  var x = b.cx + b.sx * 0.59;
  if (name === 'wasserrad') {
    return [
      ring(x, b.minY + b.sy * 0.34, b.cz, 0, 0, 0,
        b.sx * 0.58 * v, b.sy * 0.58, b.sz * 0.16, 0x76533a),
      stab(x, b.minY + b.sy * 0.34, b.cz, PI / 2, 0, 0,
        b.sx * 0.09, b.sy * 0.26, b.sz * 0.09, 0xab7d4d)
    ];
  }
  if (name === 'wollgras') {
    return [
      stab(x, b.minY + b.sy * 0.28, b.cz, 0.05, 0, -0.08,
        b.sx * 0.05, b.sy * 0.56 * v, b.sz * 0.05, 0x66815b),
      knolle(x, b.minY + b.sy * 0.57, b.cz, 0, 0, 0,
        b.sx * 0.16, b.sy * 0.14, b.sz * 0.16, 0xe8e3ce),
      knolle(x + b.sx * 0.13, b.minY + b.sy * 0.43, b.cz + b.sz * 0.1,
        0, 0, 0, b.sx * 0.11, b.sy * 0.1, b.sz * 0.11, 0xf3ead5)
    ];
  }
  return [
    knolle(x, b.minY + b.sy * 0.07, b.cz, 0, 0.15, 0,
      b.sx * 0.52 * v, b.sy * 0.14, b.sz * 0.43, 0x71816e),
    stab(x + b.sx * 0.08, b.minY + b.sy * 0.27, b.cz + b.sz * 0.1,
      0.08, 0, -0.08, b.sx * 0.065, b.sy * 0.48, b.sz * 0.065, 0x796044),
    kasten(x - b.sx * 0.11, b.minY + b.sy * 0.12, b.cz - b.sz * 0.11,
      0.1, 0.35, 0.08, b.sx * 0.32, b.sy * 0.12, b.sz * 0.16, 0xa38a66)
  ];
}

function schwebendDetails(name, b, v) {
  var x = b.cx + b.sx * 0.58;
  if (name === 'moewe') {
    return [
      spitze(x - b.sx * 0.12, b.maxY + b.sy * 0.04, b.cz, 0, 0, PI / 2,
        b.sx * 0.42 * v, b.sy * 0.1, b.sz * 0.22, 0xe5e2d6),
      spitze(x + b.sx * 0.12, b.maxY + b.sy * 0.04, b.cz, 0, 0, -PI / 2,
        b.sx * 0.42, b.sy * 0.1, b.sz * 0.22, 0xf3efe1),
      knolle(x, b.maxY, b.cz, 0, 0, 0,
        b.sx * 0.19, b.sy * 0.14, b.sz * 0.24, 0x72675c)
    ];
  }
  return [
    spitze(x, b.minY - b.sy * 0.24, b.cz, PI, 0, 0,
      b.sx * 0.27 * v, b.sy * 0.52, b.sz * 0.29, 0x5e6258),
    stab(x - b.sx * 0.1, b.minY - b.sy * 0.2, b.cz + b.sz * 0.08,
      0.15, 0, 0.24, b.sx * 0.055, b.sy * 0.42, b.sz * 0.055, 0x4f6446),
    knolle(x + b.sx * 0.11, b.minY - b.sy * 0.12, b.cz - b.sz * 0.08,
      0, 0, 0, b.sx * 0.22, b.sy * 0.18, b.sz * 0.22, 0x879078)
  ];
}

var BAUER = Object.freeze({
  natur_pilz: naturDetails,
  ruinen: ruinenDetails,
  arbor: arborDetails,
  eis: eisDetails,
  wueste: wuesteDetails,
  moor: moorDetails,
  hof: hofDetails,
  handwerk: handwerkDetails,
  sakral: sakralDetails,
  wohnbau: wohnbauDetails,
  requisiten: requisitenDetails,
  tiere: tiereDetails,
  wasserflora: wasserfloraDetails,
  ufer: uferDetails,
  schwebend: schwebendDetails
});

/**
 * Verschmilzt den semantischen Welle-3-Aufbau mit der vorhandenen Geometrie.
 * Unbekannte Kennungen werden absichtlich als identische Referenz gereicht.
 */
export function veredleBestandKatalog(name, geo) {
  var familie = ZU_FAMILIE[name];
  if (!familie) return geo;
  var index = ZU_INDEX[name];
  var variation = 1 + index * 0.0017;
  var details = BAUER[familie](name, grenzen(geo), variation);
  var ergebnis = mergeGeos([geo].concat(details));
  ergebnis.userData.bestandKatalogName = name;
  ergebnis.userData.bestandKatalogFamilie = familie;
  ergebnis.userData.bestandKatalogDetails = details.length;
  return ergebnis;
}
