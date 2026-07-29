/* ==========================================================================
   Steampunk-Luftflotte

   Zehn schwere Luftfahrzeuge fuer fuenf klar getrennte Fraktionen. Die
   Geometrien bestehen aus vernieteten Auftriebskoerpern, Panzerrahmen,
   Gondeln, Kesseln, Rotoren und Leitwerken. Sie sind absichtlich ernst,
   industriell und wehrhaft gehalten. Das Modul registriert nichts beim
   Import: geometry.js kann die gesamte Serie ueber genau einen API-Aufruf in
   die globale Pool-Registry aufnehmen.
   ========================================================================== */
import * as THREE from 'three';
import { definePool as terraDefinePool } from '../core/pools.js';
import { M, farbton, mergeGeos, part } from './geometrie-hilfen.js';

var PI = Math.PI;

function fraktion(id, label, form, metall, dunkel, akzent, leuchten, holz) {
  return Object.freeze({
    id: id, label: label, form: form,
    palette: Object.freeze({
      metall: metall, dunkel: dunkel, akzent: akzent,
      leuchten: leuchten, holz: holz
    })
  });
}

export var STEAMPUNK_FRAKTIONEN = Object.freeze([
  fraktion('menschenbund', 'Menschenbund', 'kreuzer',
    0x7b8790, 0x303942, 0xb8874f, 0xb9e3dd, 0x604a37),
  fraktion('mondelfen', 'Mondelfen-Konklave', 'sichel',
    0x9caeb0, 0x34464f, 0xc6a85e, 0xa8efe1, 0x525a58),
  fraktion('tiefenzwerge', 'Tiefenzwergen-Konsortium', 'panzer',
    0x685f59, 0x27272a, 0xc47d38, 0xffaa52, 0x4b392e),
  fraktion('goblinzunft', 'Goblinische Freizunft', 'pluenderer',
    0x69715d, 0x282c29, 0xb45b35, 0xd4e06b, 0x4d3b2e),
  fraktion('orklegion', 'Orkische Eisenlegion', 'ramme',
    0x535a58, 0x202526, 0xa54a32, 0xe58445, 0x3d302a)
]);

var TYPEN = Object.freeze([
  Object.freeze({ id: 'luftschiff', label: 'Panzerflugschiff' }),
  Object.freeze({ id: 'luftzug', label: 'Steampunk-Flugzug' })
]);

export var STEAMPUNK_LUFTFLOTTEN_ASSETS = Object.freeze(
  STEAMPUNK_FRAKTIONEN.flatMap(function (f, fraktionsIndex) {
    return TYPEN.map(function (typ, typIndex) {
      return Object.freeze({
        id: typ.id + '_' + f.id,
        label: f.label + ' – ' + typ.label,
        fraktion: f.id,
        fraktionsIndex: fraktionsIndex,
        typ: typ.id,
        typIndex: typIndex
      });
    });
  })
);

export var STEAMPUNK_LUFTFLOTTEN_NAMEN = Object.freeze(
  STEAMPUNK_LUFTFLOTTEN_ASSETS.map(function (asset) { return asset.id; })
);

function box(parts, w, h, d, x, y, z, farbe, rx, ry, rz) {
  parts.push(part(new THREE.BoxGeometry(1, 1, 1),
    M(x, y, z, rx, ry, rz, w, h, d), farbe));
}

function zylinder(parts, w, h, d, x, y, z, farbe, segmente, rx, ry, rz, oben) {
  parts.push(part(
    new THREE.CylinderGeometry((oben === undefined ? 0.78 : oben) * 0.5,
      0.5, 1, segmente || 8, 1, false),
    M(x, y, z, rx, ry, rz, w, h, d), farbe
  ));
}

function kegel(parts, w, h, d, x, y, z, farbe, segmente, rx, ry, rz) {
  parts.push(part(new THREE.ConeGeometry(0.5, 1, segmente || 7),
    M(x, y, z, rx, ry, rz, w, h, d), farbe));
}

function kugel(parts, w, h, d, x, y, z, farbe, segmente) {
  parts.push(part(new THREE.SphereGeometry(0.5, segmente || 12, 8),
    M(x, y, z, 0, 0, 0, w, h, d), farbe));
}

function torus(parts, w, h, d, x, y, z, farbe, rx, ry, rz) {
  parts.push(part(new THREE.TorusGeometry(0.5, 0.075, 5, 12),
    M(x, y, z, rx, ry, rz, w, h, d), farbe));
}

function kristall(parts, w, h, d, x, y, z, farbe, rx, ry, rz) {
  parts.push(part(new THREE.IcosahedronGeometry(0.5, 0),
    M(x, y, z, rx, ry, rz, w, h, d), farbe));
}

function palette(fraktion) {
  var p = fraktion.palette;
  return {
    metall: p.metall,
    metallHell: farbton(p.metall, 1.15),
    dunkel: p.dunkel,
    dunkelHell: farbton(p.dunkel, 1.22),
    akzent: p.akzent,
    leuchten: p.leuchten,
    holz: p.holz,
    holzHell: farbton(p.holz, 1.24),
    messing: farbton(p.akzent, 1.18),
    rost: farbton(p.akzent, 0.68),
    schwarz: farbton(p.dunkel, 0.58)
  };
}

function panzerRippen(parts, f, y, laenge, breite, hoehe, anzahl) {
  for (var i = 0; i < anzahl; i++) {
    var z = -laenge / 2 + (i + 1) * laenge / (anzahl + 1);
    torus(parts, breite * 1.025, hoehe * 1.025, 1, 0, y, z,
      i % 2 ? f.akzent : f.dunkelHell);
  }
}

function nietReihe(parts, f, y, z, breite, anzahl) {
  for (var i = 0; i < anzahl; i++) {
    var x = -breite / 2 + i * breite / Math.max(1, anzahl - 1);
    kristall(parts, 0.10, 0.10, 0.10, x, y, z, f.akzent,
      i * 0.11, i * 0.17, i * 0.07);
  }
}

/* Diagonalstreben lesen sich aus der Distanz als tragendes Fachwerk statt
   als beliebige duenne Linien. Die vier Balken bleiben Teil derselben
   Poolgeometrie und erzeugen daher keine zusaetzlichen Draw Calls. */
function tragStreben(parts, f, z, breite, unten, oben) {
  var dx = breite * 0.42;
  var dy = oben - unten;
  var laenge = Math.sqrt(dx * dx + dy * dy);
  var winkel = Math.atan2(dx, dy);
  for (var seite = -1; seite <= 1; seite += 2) {
    box(parts, 0.13, laenge, 0.13, seite * dx * 0.5,
      (unten + oben) * 0.5, z, f.schwarz, 0, 0, -seite * winkel);
    box(parts, 0.09, laenge * 0.82, 0.09, seite * dx * 0.52,
      (unten + oben) * 0.5, z + 0.18, f.messing, 0, 0, seite * winkel);
  }
}

function maschinenUnterbau(parts, fraktion, f, zug) {
  var laenge = zug ? 11.7 : 6.35;
  var breite = zug ? 3.25 : 3.05;
  var mitteZ = zug ? -0.35 : 0.05;
  var schwer = fraktion.form === 'panzer' || fraktion.form === 'ramme';
  box(parts, schwer ? 0.52 : 0.36, 0.34, laenge, 0, 0.78, mitteZ,
    f.schwarz);
  box(parts, 0.16, 0.13, laenge * 0.94, -0.46, 0.98, mitteZ,
    f.messing);
  box(parts, 0.16, 0.13, laenge * 0.94, 0.46, 0.98, mitteZ,
    f.rost);
  var traeger = zug ? 5 : 4;
  for (var i = 0; i < traeger; i++) {
    var z = mitteZ - laenge * 0.42 + i * laenge * 0.84 / (traeger - 1);
    box(parts, breite, schwer ? 0.28 : 0.20, 0.32, 0, 0.92, z,
      i % 2 ? f.metall : f.dunkelHell, 0, i % 2 ? 0.03 : -0.03, 0);
  }
  tragStreben(parts, f, mitteZ - laenge * 0.27, breite, 0.94, 3.02);
  tragStreben(parts, f, mitteZ + laenge * 0.27, breite, 0.94, 3.02);
  for (var seite = -1; seite <= 1; seite += 2) {
    zylinder(parts, 0.74, 1.62, 0.74, seite * breite * 0.47, 1.02,
      mitteZ - laenge * 0.18, f.schwarz, 8, PI / 2, 0, 0, 0.72);
    torus(parts, 0.79, 0.79, 1, seite * breite * 0.47, 1.02,
      mitteZ - laenge * 0.44, f.messing, PI / 2, 0, 0);
    kegel(parts, 0.62, 1.18, 0.62, seite * breite * 0.47, 1.02,
      mitteZ - laenge * 0.52, f.rost, 7, PI / 2, 0, 0);
  }
}

function fraktionsWappen(parts, fraktion, f, zug) {
  var front = zug ? 6.25 : 3.55;
  var heck = zug ? -5.65 : -3.55;
  var seite = zug ? 1.88 : 2.15;
  switch (fraktion.form) {
    case 'kreuzer':
      box(parts, 5.35, 0.16, 1.15, 0, 1.28, front - 0.65, f.messing);
      for (var h = -1; h <= 1; h += 2) {
        zylinder(parts, 0.24, 2.15, 0.24, h * 1.18, 1.10, front,
          f.schwarz, 7, PI / 2, 0, 0, 0.46);
      }
      break;
    case 'sichel':
      for (var e = -1; e <= 1; e += 2) {
        box(parts, 0.14, 0.92, 4.65, e * seite, 1.52, heck + 1.15,
          f.metallHell, e * 0.14, e * 0.18, e * 0.12);
        kristall(parts, 0.46, 1.38, 0.46, e * seite, 0.78, front - 0.55,
          f.leuchten, 0, 0, e * 0.18);
      }
      kristall(parts, 0.72, 1.65, 0.72, 0, 0.28, front - 1.10,
        f.leuchten, 0, 0.18, PI);
      break;
    case 'panzer':
      for (var p = -1; p <= 1; p += 2) {
        torus(parts, 1.44, 1.44, 1, p * seite, 1.20, front - 1.15,
          f.messing, 0, PI / 2, 0);
        box(parts, 0.36, 1.36, 3.25, p * seite, 1.05, -0.25,
          f.metall, 0, 0, p * 0.05);
      }
      box(parts, 2.42, 0.46, 3.65, 0, 0.48, front - 1.82, f.schwarz);
      break;
    case 'pluenderer':
      box(parts, 2.35, 0.18, 4.55, -seite, 1.02, -0.15,
        f.rost, 0.08, 0.13, -0.14);
      box(parts, 1.55, 0.20, 3.30, seite * 0.92, 1.58, heck + 1.4,
        f.holzHell, -0.08, -0.17, 0.10);
      rotor(parts, f, seite, 1.18, front - 1.35, 0.72, true, 0.33);
      break;
    case 'ramme':
      box(parts, 4.75, 0.42, 1.35, 0, 0.66, front - 1.0, f.schwarz);
      kegel(parts, 1.12, 3.05, 1.12, 0, 0.78, front + 0.75,
        f.messing, 6, PI / 2, 0, 0);
      for (var r = -2; r <= 2; r++) {
        kegel(parts, 0.38, 1.25, 0.38, r * 0.86, 0.60, front - 0.32,
          r % 2 ? f.rost : f.akzent, 5, PI, 0, 0);
      }
      break;
  }
}

function rotor(parts, f, x, y, z, groesse, achseX, versatz) {
  var rx = achseX ? 0 : PI / 2;
  var rz = achseX ? PI / 2 : 0;
  zylinder(parts, 0.34, 0.72, 0.34, x, y, z, f.dunkel, 8, rx, 0, rz);
  torus(parts, groesse * 1.95, groesse * 1.95, 1, x, y, z,
    f.akzent, achseX ? 0 : PI / 2, achseX ? PI / 2 : 0, 0);
  for (var i = 0; i < 4; i++) {
    var a = i * PI / 2 + versatz;
    if (achseX) {
      box(parts, 0.10, groesse * 1.55, groesse * 0.30,
        x, y + Math.sin(a) * groesse * 0.42, z + Math.cos(a) * groesse * 0.42,
        f.metallHell, a, 0, 0);
    } else {
      box(parts, groesse * 0.30, groesse * 1.55, 0.10,
        x + Math.cos(a) * groesse * 0.42, y + Math.sin(a) * groesse * 0.42, z,
        f.metallHell, 0, 0, a);
    }
  }
}

function dampfKessel(parts, f, x, y, z, laenge, radius, quer) {
  zylinder(parts, radius * 2, laenge, radius * 2, x, y, z,
    f.dunkelHell, 10, quer ? 0 : PI / 2, 0, quer ? PI / 2 : 0, 0.88);
  for (var i = -1; i <= 1; i++) {
    torus(parts, radius * 2.08, radius * 2.08, 1,
      x, y, z + (quer ? 0 : i * laenge * 0.28), f.akzent,
      quer ? 0 : 0, quer ? PI / 2 : 0, 0);
  }
}

function schornstein(parts, f, x, y, z, hoehe, neigung) {
  zylinder(parts, 0.48, hoehe, 0.48, x, y + hoehe / 2, z,
    f.dunkel, 8, 0, 0, neigung || 0, 0.72);
  zylinder(parts, 0.70, 0.22, 0.70, x + Math.sin(neigung || 0) * hoehe,
    y + hoehe, z, f.akzent, 8, 0, 0, neigung || 0, 0.86);
}

function leitwerk(parts, f, z, groesse, brutal) {
  box(parts, groesse * 2.6, 0.16, groesse * 1.20, 0, 3.0, z,
    brutal ? f.dunkel : f.metall, 0.08, 0, 0);
  box(parts, 0.16, groesse * 1.65, groesse * 1.25, 0, 3.75, z,
    brutal ? f.akzent : f.dunkelHell, -0.06, 0, 0);
  if (brutal) {
    kegel(parts, 0.42, 1.6, 0.42, -groesse * 1.35, 3.0, z,
      f.akzent, 5, 0, 0, PI / 2);
    kegel(parts, 0.42, 1.6, 0.42, groesse * 1.35, 3.0, z,
      f.akzent, 5, 0, 0, -PI / 2);
  }
}

function schiffGrundkoerper(parts, fraktion, f) {
  var schwer = fraktion.form === 'panzer' || fraktion.form === 'ramme';
  var breite = schwer ? 4.9 : 4.4;
  var hoehe = schwer ? 2.45 : 2.18;
  var laenge = fraktion.form === 'sichel' ? 8.8 : 8.1;
  kugel(parts, breite, hoehe, laenge, 0, 4.05, 0, f.metall, schwer ? 12 : 14);
  panzerRippen(parts, f, 4.05, laenge, breite, hoehe,
    fraktion.form === 'pluenderer' ? 4 : 6);
  box(parts, 3.05, 1.25, 4.7, 0, 2.05, 0.35, f.dunkel);
  box(parts, 2.45, 0.50, 3.9, 0, 1.25, 0.25, f.metall);
  box(parts, 0.34, 1.15, 5.75, 0, 1.65, -0.15, f.akzent);
  box(parts, 2.05, 0.95, 1.38, 0, 2.92, 1.20, f.dunkelHell);
  box(parts, 1.55, 0.40, 0.10, 0, 3.05, 1.92, f.leuchten);
  dampfKessel(parts, f, -1.45, 2.05, -0.65, 2.15, 0.48, false);
  dampfKessel(parts, f, 1.45, 2.05, -0.65, 2.15, 0.48, false);
  schornstein(parts, f, -0.58, 2.68, -0.80, 1.25, -0.08);
  schornstein(parts, f, 0.58, 2.68, -0.80, 1.10, 0.08);
  rotor(parts, f, -2.55, 2.25, 0.25, schwer ? 1.12 : 0.95, true, 0.18);
  rotor(parts, f, 2.55, 2.25, 0.25, schwer ? 1.12 : 0.95, true, 0.53);
  leitwerk(parts, f, -4.25, 1.05, schwer);
  nietReihe(parts, f, 1.38, 2.20, 2.45, 7);
}

function fraktionsSchiff(parts, fraktion, f) {
  switch (fraktion.form) {
    case 'kreuzer':
      box(parts, 5.8, 0.18, 1.05, 0, 4.05, 0.45, f.akzent);
      for (var h = -1; h <= 1; h += 2) {
        zylinder(parts, 0.32, 2.2, 0.32, h * 1.18, 1.65, 2.45,
          f.dunkel, 8, PI / 2, 0, 0);
      }
      break;
    case 'sichel':
      for (var e = -1; e <= 1; e += 2) {
        box(parts, 0.18, 2.15, 4.8, e * 2.30, 4.25, -0.25,
          f.metallHell, e * 0.18, 0, e * 0.12);
        kristall(parts, 0.62, 1.55, 0.62, e * 2.32, 4.30, 1.88,
          f.leuchten, 0, 0, e * 0.15);
      }
      torus(parts, 3.9, 1.45, 1, 0, 1.15, 2.65, f.akzent, PI / 2, 0, 0);
      break;
    case 'panzer':
      box(parts, 5.35, 0.34, 5.1, 0, 2.80, -0.15, f.metall);
      for (var z = -1; z <= 1; z++) {
        box(parts, 5.0, 0.24, 0.36, 0, 4.05, z * 2.05, f.akzent);
      }
      zylinder(parts, 1.15, 1.25, 1.15, 0, 2.75, 2.15, f.dunkel, 8);
      break;
    case 'pluenderer':
      box(parts, 2.1, 0.16, 5.8, -1.72, 3.05, -0.20,
        f.akzent, 0, 0.08, -0.13);
      box(parts, 1.45, 0.16, 4.9, 1.95, 3.52, -0.55,
        f.metallHell, 0.06, -0.13, 0.10);
      rotor(parts, f, 0.95, 4.75, -1.60, 0.82, false, 0.41);
      break;
    case 'ramme':
      kegel(parts, 1.35, 3.5, 1.35, 0, 1.78, 4.05,
        f.akzent, 7, PI / 2, 0, 0);
      for (var r = -1; r <= 1; r += 2) {
        kegel(parts, 0.55, 1.65, 0.55, r * 1.72, 2.05, 2.60,
          f.dunkel, 5, PI / 2, 0, r * 0.18);
      }
      box(parts, 4.8, 0.35, 1.1, 0, 3.15, 1.92, f.dunkel);
      break;
  }
}

function baueLuftschiff(fraktion, f) {
  var parts = [];
  schiffGrundkoerper(parts, fraktion, f);
  fraktionsSchiff(parts, fraktion, f);
  maschinenUnterbau(parts, fraktion, f, false);
  fraktionsWappen(parts, fraktion, f, false);
  return parts;
}

function zugWagen(parts, f, z, index, fraktion) {
  var schwer = fraktion.form === 'panzer' || fraktion.form === 'ramme';
  var breite = schwer ? 3.45 : 3.05;
  box(parts, breite, 1.30, 3.05, 0, 1.72, z, index ? f.dunkelHell : f.dunkel);
  box(parts, breite * 0.88, 0.28, 2.78, 0, 2.52, z, f.metall);
  box(parts, breite * 0.78, 0.12, 0.08, 0, 2.00, z + 1.535, f.leuchten);
  box(parts, breite * 0.12, 0.82, 0.10, 0, 1.88, z + 1.57, f.akzent);
  kugel(parts, breite * 0.92, 1.05, 3.22, 0, 4.15, z, f.metall,
    fraktion.form === 'pluenderer' ? 10 : 12);
  panzerRippen(parts, f, 4.15, 3.22, breite * 0.92, 1.05, 3);
  for (var x = -1; x <= 1; x += 2) {
    zylinder(parts, 0.52, 0.34, 0.52, x * breite * 0.46, 1.18, z,
      f.akzent, 8, 0, 0, PI / 2);
  }
  if (index) {
    box(parts, 0.18, 0.18, 0.70, 0, 1.70, z + 1.86, f.akzent);
  }
}

function zugLok(parts, fraktion, f) {
  var z = 4.05;
  box(parts, 3.45, 1.15, 4.05, 0, 1.58, z, f.dunkel);
  box(parts, 3.20, 0.32, 3.75, 0, 2.30, z, f.metall);
  dampfKessel(parts, f, 0, 2.66, z + 0.42, 2.65, 0.82, false);
  box(parts, 2.75, 1.65, 1.12, 0, 2.65, z - 1.30, f.dunkelHell);
  box(parts, 1.92, 0.60, 0.10, 0, 2.87, z - 0.72, f.leuchten);
  schornstein(parts, f, 0, 3.25, z + 1.05, 1.72,
    fraktion.form === 'pluenderer' ? -0.16 : 0);
  kugel(parts, 3.35, 1.18, 3.92, 0, 4.62, z, f.metall, 12);
  panzerRippen(parts, f, 4.62, 3.92, 3.35, 1.18, 4);
  kegel(parts, 1.30, 2.10, 1.30, 0, 1.52, z + 2.62,
    fraktion.form === 'ramme' ? f.akzent : f.metall, 7, PI / 2, 0, 0);
  for (var x = -1; x <= 1; x += 2) {
    rotor(parts, f, x * 2.08, 2.02, z + 0.22, 0.78, true,
      x > 0 ? 0.30 : 0.62);
  }
}

function fraktionsZug(parts, fraktion, f) {
  switch (fraktion.form) {
    case 'kreuzer':
      box(parts, 0.28, 0.28, 10.9, 0, 0.92, -0.85, f.akzent);
      nietReihe(parts, f, 1.05, 6.0, 2.7, 8);
      break;
    case 'sichel':
      for (var z = -4.0; z <= 4.1; z += 4.05) {
        kristall(parts, 0.62, 1.18, 0.62, 0, 5.02, z,
          f.leuchten, 0, z * 0.07, 0);
        box(parts, 4.4, 0.12, 0.70, 0, 3.75, z, f.akzent, 0, 0, 0.05);
      }
      break;
    case 'panzer':
      for (var p = -1; p <= 1; p += 2) {
        box(parts, 0.42, 1.72, 10.7, p * 1.80, 2.30, -0.62, f.akzent);
      }
      zylinder(parts, 1.20, 1.15, 1.20, 0, 2.55, 6.15, f.dunkel, 8);
      break;
    case 'pluenderer':
      box(parts, 0.18, 1.15, 9.6, -1.72, 3.58, -0.65,
        f.akzent, 0.08, 0, -0.12);
      rotor(parts, f, 1.25, 4.95, -4.12, 0.80, false, 0.48);
      break;
    case 'ramme':
      box(parts, 4.15, 0.35, 10.8, 0, 1.02, -0.55, f.dunkel);
      for (var i = -2; i <= 2; i++) {
        kegel(parts, 0.42, 1.20, 0.42, i * 0.72, 1.02, 6.30,
          f.akzent, 5, PI / 2, 0, 0);
      }
      break;
  }
}

function baueLuftzug(fraktion, f) {
  var parts = [];
  zugLok(parts, fraktion, f);
  zugWagen(parts, f, 0, 1, fraktion);
  zugWagen(parts, f, -4.0, 2, fraktion);
  box(parts, 0.22, 0.22, 0.92, 0, 1.72, 1.94, f.akzent);
  box(parts, 0.22, 0.22, 0.92, 0, 1.72, -2.0, f.akzent);
  maschinenUnterbau(parts, fraktion, f, true);
  fraktionsWappen(parts, fraktion, f, true);
  fraktionsZug(parts, fraktion, f);
  return parts;
}

function findeAsset(eingabe) {
  if (typeof eingabe === 'object' && eingabe && typeof eingabe.id === 'string') {
    return eingabe;
  }
  var asset = STEAMPUNK_LUFTFLOTTEN_ASSETS.find(function (a) { return a.id === eingabe; });
  if (!asset) throw new Error('Unbekanntes Steampunk-Luftfahrzeug: ' + String(eingabe));
  return asset;
}

/** Baut eine vollstaendige, einzelne Terra-BufferGeometry. */
export function erstelleSteampunkLuftfahrzeug(eingabe) {
  var asset = findeAsset(eingabe);
  var fraktion = STEAMPUNK_FRAKTIONEN[asset.fraktionsIndex];
  var f = palette(fraktion);
  var parts = asset.typ === 'luftschiff'
    ? baueLuftschiff(fraktion, f)
    : baueLuftzug(fraktion, f);
  var geometrie = mergeGeos(parts);
  geometrie.userData = {
    steampunkFraktion: fraktion.id,
    steampunkTyp: asset.typ,
    steampunkTeile: parts.length,
    steampunkArtPass: 'final-hart',
    steampunkMaterialZonen: 10
  };
  return geometrie;
}

function kollisionsradius(geometrie) {
  var position = geometrie.attributes.position;
  var maxQuadrat = 0;
  for (var i = 0; i < position.count; i++) {
    var x = position.getX(i);
    var z = position.getZ(i);
    var quadrat = x * x + z * z;
    if (quadrat > maxQuadrat) maxQuadrat = quadrat;
  }
  return Math.ceil(Math.sqrt(maxQuadrat) * 1.08 * 100) / 100;
}

export function steampunkLuftflottePoolOptionen(asset, geometrie) {
  var fraktion = STEAMPUNK_FRAKTIONEN[asset.fraktionsIndex];
  return {
    radius: kollisionsradius(geometrie),
    ao: fraktion.form === 'sichel' ? 0.16 : 0.24,
    familie: 'metall',
    sichtbarAb: 0,
    sichtbarBis: 120
  };
}

/**
 * Registriert exakt zehn Pools. Die injizierbare Funktion haelt Registrytests
 * isoliert; geometry.js kann denselben Aufruf mit seinem veredelnden
 * definePool-Wrapper verwenden.
 */
export function registriereSteampunkLuftflotte(poolDefinierer) {
  var define = poolDefinierer || terraDefinePool;
  if (typeof define !== 'function') throw new TypeError('definePool-Funktion fehlt');
  var registriert = [];
  for (var i = 0; i < STEAMPUNK_LUFTFLOTTEN_ASSETS.length; i++) {
    var asset = STEAMPUNK_LUFTFLOTTEN_ASSETS[i];
    var geometrie = erstelleSteampunkLuftfahrzeug(asset);
    define(asset.id, geometrie, steampunkLuftflottePoolOptionen(asset, geometrie));
    registriert.push(asset.id);
  }
  return registriert;
}
