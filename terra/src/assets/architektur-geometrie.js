import * as THREE from "three";
import { definePool as terraDefinePool } from "../core/pools.js";
import {
  ARCHITEKTUR_ASSETS,
  ARCHITEKTUR_STILE,
  ARCHITEKTUR_VARIANTEN
} from "./architektur-katalog.js";
import { M, farbton, mergeGeos, part } from "./geometrie-hilfen.js";
import {
  gestalteArchitekturFormensprache,
  veredleArchitektur
} from "./architektur-details.js";
import { gestalteArchitekturFassade } from "./architektur-fassaden.js";

var PI = Math.PI, TAU = Math.PI * 2;
var OFFENE_PROFILE = new Set(["halle", "schrein", "pavillon", "bruecke", "tor"]);

function istOffenesProfil(profil) {
  return OFFENE_PROFILE.has(profil);
}

function box(parts, w, h, d, x, y, z, farbe, rx, ry, rz) {
  parts.push(part(
    new THREE.BoxGeometry(1, 1, 1),
    M(x, y, z, rx, ry, rz, w, h, d),
    farbe
  ));
}

function zylinder(parts, w, h, d, x, y, z, farbe, segmente, oben, rx, ry, rz) {
  parts.push(part(
    new THREE.CylinderGeometry((oben === undefined ? 1 : oben) * 0.5, 0.5, 1, segmente || 8),
    M(x, y, z, rx, ry, rz, w, h, d),
    farbe
  ));
}

function kegel(parts, w, h, d, x, y, z, farbe, segmente, rx, ry, rz) {
  parts.push(part(
    new THREE.ConeGeometry(0.5, 1, segmente || 8),
    M(x, y, z, rx, ry, rz, w, h, d),
    farbe
  ));
}

function kugel(parts, w, h, d, x, y, z, farbe, halbkugel) {
  parts.push(part(
    new THREE.SphereGeometry(0.5, 10, 6, 0, TAU, 0, halbkugel ? PI / 2 : PI),
    M(x, y, z, 0, 0, 0, w, h, d),
    farbe
  ));
}

function torus(parts, w, h, d, x, y, z, farbe, bogen, rx, ry, rz) {
  parts.push(part(
    new THREE.TorusGeometry(0.5, 0.09, 4, 12, bogen === undefined ? TAU : bogen),
    M(x, y, z, rx, ry, rz, w, h, d),
    farbe
  ));
}

function kristall(parts, w, h, d, x, y, z, farbe, rx, ry, rz) {
  parts.push(part(
    new THREE.IcosahedronGeometry(0.5, 0),
    M(x, y, z, rx, ry, rz, w, h, d),
    farbe
  ));
}

function farbenFuer(stil, variantenIndex) {
  var drift = 0.94 + ((variantenIndex * 7) % 9) * 0.012;
  return {
    wand: farbton(stil.palette.wand, drift),
    wandDunkel: farbton(stil.palette.wand, drift * 0.76),
    dach: farbton(stil.palette.dach, 0.92 + (variantenIndex % 5) * 0.018),
    akzent: farbton(stil.palette.akzent, 0.95 + (variantenIndex % 3) * 0.025),
    holz: farbton(stil.palette.holz, 0.90 + (variantenIndex % 4) * 0.02),
    fenster: farbton(stil.palette.fenster, 0.94 + (variantenIndex % 2) * 0.04)
  };
}

/**
 * Der Grundkörper übersetzt die zwölf Kulturformen in echte Silhouetten.
 * w/d/h sind Außenmaße; alle Formen stehen auf y=0.
 */
function baueKern(parts, stil, f, w, d, h, x, z, stilIndex, variantenIndex) {
  var neigung = (variantenIndex % 3 - 1) * 0.018;
  switch (stil.form) {
    case "filigran":
      zylinder(parts, w, h, d, x, h / 2, z, f.wand, 10, 0.72);
      for (var a = -1; a <= 1; a += 2) {
        zylinder(parts, w * 0.10, h * 0.88, d * 0.10, x + a * w * 0.46,
          h * 0.44, z, f.akzent, 8, 0.65);
      }
      break;
    case "massiv":
      box(parts, w, h * 0.82, d, x, h * 0.41, z, f.wand);
      box(parts, w * 0.88, h * 0.18, d * 0.88, x, h * 0.91, z, f.wandDunkel);
      for (var m = -1; m <= 1; m += 2) {
        box(parts, w * 0.13, h * 0.72, d * 1.08, x + m * w * 0.49,
          h * 0.36, z, f.wandDunkel);
      }
      break;
    case "windschief":
      box(parts, w, h * 0.62, d, x, h * 0.31, z, f.wand, 0, 0, neigung);
      box(parts, w * 0.88, h * 0.38, d * 0.92, x + neigung * h,
        h * 0.81, z, f.wandDunkel, 0, 0, neigung * 1.8);
      break;
    case "zeltartig":
      zylinder(parts, w, h * 0.72, d, x, h * 0.36, z, f.wand, 6, 0.76);
      box(parts, w * 0.78, h * 0.28, d * 0.80, x, h * 0.86, z, f.wandDunkel);
      break;
    case "korallin":
      zylinder(parts, w * 0.72, h, d * 0.72, x, h / 2, z, f.wand, 9, 0.66);
      kugel(parts, w * 0.48, h * 0.34, d * 0.42, x - w * 0.34,
        h * 0.48, z + d * 0.16, f.wand);
      kugel(parts, w * 0.38, h * 0.28, d * 0.36, x + w * 0.35,
        h * 0.66, z - d * 0.15, f.wandDunkel);
      break;
    case "pilzartig":
      zylinder(parts, w * 0.58, h, d * 0.58, x, h / 2, z, f.wand, 9, 0.80);
      kugel(parts, w * 0.88, h * 0.24, d * 0.82, x, h * 0.72, z, f.wandDunkel);
      break;
    case "schwebend":
      kegel(parts, w * 0.82, h * 0.30, d * 0.82, x, h * 0.15, z,
        f.wandDunkel, 8, 0, 0, PI);
      zylinder(parts, w, h * 0.70, d, x, h * 0.65, z, f.wand, 10, 0.74);
      break;
    case "organisch":
      zylinder(parts, w * 0.66, h, d * 0.66, x, h / 2, z, f.holz, 9, 0.74);
      kugel(parts, w, h * 0.56, d, x, h * 0.66, z, f.wand);
      for (var o = -1; o <= 1; o += 2) {
        zylinder(parts, w * 0.13, h * 0.62, d * 0.13, x + o * w * 0.38,
          h * 0.31, z, f.holz, 7, 0.55, 0, 0, o * 0.13);
      }
      break;
    case "kristallin":
      box(parts, w * 0.82, h * 0.34, d * 0.82, x, h * 0.17, z, f.wandDunkel);
      kristall(parts, w, h * 0.82, d, x, h * 0.61, z, f.wand, 0,
        (stilIndex + 1) * 0.07, 0);
      break;
    case "gestelzt":
      for (var px = -1; px <= 1; px += 2) for (var pz = -1; pz <= 1; pz += 2) {
        zylinder(parts, w * 0.09, h * 0.48, d * 0.09,
          x + px * w * 0.37, h * 0.24, z + pz * d * 0.36, f.holz, 6, 0.82);
      }
      box(parts, w, h * 0.56, d, x, h * 0.70, z, f.wand);
      break;
    case "kuppelig":
      zylinder(parts, w, h * 0.66, d, x, h * 0.33, z, f.wand, 12, 0.90);
      kugel(parts, w * 0.94, h * 0.68, d * 0.94, x, h * 0.65, z, f.wandDunkel, true);
      break;
    case "vulkanisch":
      zylinder(parts, w, h, d, x, h / 2, z, f.wand, 6, 0.68);
      for (var b = -1; b <= 1; b += 2) {
        kegel(parts, w * 0.24, h * 0.60, d * 0.30, x + b * w * 0.43,
          h * 0.30, z, f.wandDunkel, 5, 0, 0, -b * 0.18);
      }
      break;
  }
}

function baueDach(parts, stil, f, w, d, y, x, z, variantenIndex) {
  var rh = Math.max(0.72, Math.min(w, d) * 0.42);
  switch (stil.dach) {
    case "blatt":
      kugel(parts, w * 1.18, rh * 0.62, d * 1.10, x, y + rh * 0.18, z, f.dach);
      box(parts, w * 0.05, rh * 0.34, d * 1.04, x, y + rh * 0.20, z, f.akzent);
      break;
    case "stufe":
      box(parts, w * 1.08, rh * 0.28, d * 1.08, x, y + rh * 0.14, z, f.dach);
      box(parts, w * 0.78, rh * 0.28, d * 0.78, x, y + rh * 0.42, z, f.dach);
      box(parts, w * 0.46, rh * 0.24, d * 0.46, x, y + rh * 0.68, z, f.akzent);
      break;
    case "schindel":
      kegel(parts, w * 1.18, rh, d * 1.18, x, y + rh / 2, z, f.dach, 4, 0, PI / 4, 0);
      break;
    case "zelt":
      kegel(parts, w * 1.20, rh * 1.16, d * 1.20, x, y + rh * 0.58, z, f.dach, 6);
      torus(parts, w * 0.46, rh * 0.20, d * 0.46, x, y + rh * 0.98, z,
        f.akzent, TAU, PI / 2, 0, 0);
      break;
    case "muschel":
      kugel(parts, w * 1.18, rh * 0.78, d * 1.12, x, y, z, f.dach, true);
      torus(parts, w * 0.94, rh * 0.40, d * 1.02, x, y + rh * 0.10, z,
        f.akzent, PI, PI / 2, 0, 0);
      break;
    case "pilz":
      kugel(parts, w * 1.32, rh * 0.76, d * 1.26, x, y + rh * 0.02, z, f.dach, true);
      zylinder(parts, w * 0.78, rh * 0.10, d * 0.78, x, y + rh * 0.02, z,
        f.akzent, 12, 1);
      break;
    case "wolke":
      kugel(parts, w * 0.88, rh * 0.68, d * 0.92, x, y + rh * 0.20, z, f.dach);
      kugel(parts, w * 0.58, rh * 0.54, d * 0.60, x - w * 0.30,
        y + rh * 0.18, z, f.dach);
      kugel(parts, w * 0.52, rh * 0.50, d * 0.56, x + w * 0.32,
        y + rh * 0.16, z, f.dach);
      break;
    case "krone":
      kugel(parts, w * 1.12, rh * 0.54, d * 1.10, x, y + rh * 0.10, z, f.dach);
      for (var i = -1; i <= 1; i++) {
        kegel(parts, w * 0.24, rh * (0.56 + 0.08 * Math.abs(i)), d * 0.24,
          x + i * w * 0.30, y + rh * 0.44, z, f.akzent, 7);
      }
      break;
    case "kristall":
      kristall(parts, w * 1.12, rh * 1.25, d * 1.10, x, y + rh * 0.48, z,
        f.dach, 0, variantenIndex * 0.11, 0);
      break;
    case "schilf":
      kegel(parts, w * 1.20, rh * 0.92, d * 1.20, x, y + rh * 0.46, z, f.dach, 8);
      for (var s = -1; s <= 1; s += 2) {
        kegel(parts, w * 0.10, rh * 0.64, d * 0.10, x + s * w * 0.36,
          y + rh * 0.46, z, f.akzent, 5);
      }
      break;
    case "stern":
      kugel(parts, w * 1.10, rh * 0.72, d * 1.10, x, y, z, f.dach, true);
      kristall(parts, w * 0.22, rh * 0.56, d * 0.22, x, y + rh * 0.66, z, f.akzent);
      break;
    case "basalt":
      kegel(parts, w * 1.12, rh, d * 1.12, x, y + rh / 2, z, f.dach, 6);
      for (var q = -1; q <= 1; q += 2) {
        kristall(parts, w * 0.18, rh * 0.62, d * 0.18, x + q * w * 0.28,
          y + rh * 0.44, z, f.akzent, 0, 0, q * 0.12);
      }
      break;
  }
  return y + rh;
}

function fensterUndTuer(parts, f, w, d, h, x, z, variantenIndex) {
  var variante = ARCHITEKTUR_VARIANTEN[variantenIndex];
  if (variante && istOffenesProfil(variante.profil)) return;
  var etagen = Math.min(3, Math.max(1, Number(variante && variante.etagen) || 1));
  var rasterZeile = etagen === 3 ? 1 : 0;
  var fensterY = h * (0.34 + (rasterZeile + 0.5) * 0.43 / etagen);
  var anzahl = 1 + variantenIndex % 3;
  for (var i = 0; i < anzahl; i++) {
    var fx = x + (i - (anzahl - 1) / 2) * w * 0.24;
    box(parts, w * 0.12, h * 0.18, d * 0.025, fx, fensterY,
      z + d * 0.505, f.fenster);
  }
  box(parts, w * 0.19, h * 0.32, d * 0.035, x, h * 0.16,
    z + d * 0.51, f.holz);
}

function baueOrnament(parts, stil, f, x, y, z, groesse, stilIndex, variantenIndex) {
  var dreh = (stilIndex * 7 + variantenIndex * 3) * 0.09;
  switch (stil.ornament) {
    case "mond":
      torus(parts, groesse, groesse, groesse * 0.35, x, y, z, f.akzent, PI * 1.55, 0, 0, dreh);
      break;
    case "rune":
      box(parts, groesse * 0.18, groesse, groesse * 0.18, x, y, z, f.akzent, 0, 0, 0.18);
      box(parts, groesse * 0.72, groesse * 0.16, groesse * 0.18, x, y, z, f.akzent, 0, 0, -0.28);
      break;
    case "wirbel":
      torus(parts, groesse, groesse * 0.70, groesse * 0.30, x, y, z, f.akzent, PI * 1.45, 0, 0, dreh);
      torus(parts, groesse * 0.58, groesse * 0.42, groesse * 0.22, x, y, z, f.fenster, PI * 1.25, 0, 0, -dreh);
      break;
    case "sonne":
      kugel(parts, groesse * 0.46, groesse * 0.46, groesse * 0.34, x, y, z, f.akzent);
      for (var r = 0; r < 4; r++) {
        box(parts, groesse * 0.12, groesse * 0.48, groesse * 0.12, x, y, z,
          f.akzent, 0, 0, r * PI / 4);
      }
      break;
    case "perle":
      kugel(parts, groesse * 0.62, groesse * 0.62, groesse * 0.50, x, y, z, f.fenster);
      torus(parts, groesse, groesse * 0.72, groesse * 0.30, x, y, z, f.akzent);
      break;
    case "spore":
      for (var p = 0; p < 3; p++) {
        kugel(parts, groesse * (0.28 + p * 0.08), groesse * (0.28 + p * 0.08),
          groesse * 0.24, x + (p - 1) * groesse * 0.28,
          y + (p % 2) * groesse * 0.22, z, p === 1 ? f.fenster : f.akzent);
      }
      break;
    case "feder":
      kugel(parts, groesse * 0.42, groesse, groesse * 0.20, x, y, z, f.fenster);
      box(parts, groesse * 0.10, groesse * 1.10, groesse * 0.10, x, y, z,
        f.akzent, 0, 0, -0.28);
      break;
    case "blattader":
      kugel(parts, groesse * 0.62, groesse, groesse * 0.22, x, y, z, f.dach);
      box(parts, groesse * 0.08, groesse * 0.90, groesse * 0.10, x, y, z,
        f.akzent, 0, 0, 0.18);
      break;
    case "prisma":
      kristall(parts, groesse * 0.72, groesse, groesse * 0.60, x, y, z,
        f.akzent, dreh * 0.2, dreh, 0);
      break;
    case "welle":
      torus(parts, groesse, groesse * 0.62, groesse * 0.30, x, y, z,
        f.fenster, PI * 1.10, 0, 0, dreh);
      break;
    case "stern":
      kristall(parts, groesse, groesse, groesse * 0.46, x, y, z, f.akzent, 0, 0, dreh);
      break;
    case "flamme":
      kegel(parts, groesse * 0.56, groesse, groesse * 0.46, x, y, z,
        f.akzent, 7, 0, 0, dreh * 0.2);
      kugel(parts, groesse * 0.38, groesse * 0.36, groesse * 0.34,
        x, y - groesse * 0.32, z, f.fenster);
      break;
  }
}

function kernMitDach(parts, stil, f, w, d, h, x, z, si, vi, details) {
  baueKern(parts, stil, f, w, d, h, x, z, si, vi);
  var spitze = baueDach(parts, stil, f, w, d, h, x, z, vi);
  if (details !== false) fensterUndTuer(parts, f, w, d, h, x, z, vi);
  return spitze;
}

function ornamentAnker(profil, w, d, h, stilIndex, variantenIndex) {
  var seite = (stilIndex + variantenIndex) % 2 ? 1 : -1;
  switch (profil) {
    case "halle":
      return { x: seite * w * 0.40, y: h * 0.54, z: d * 0.39, faktor: 0.64 };
    case "schrein":
      return { x: seite * w * 0.34, y: h * 0.43, z: d * 0.04, faktor: 0.58 };
    case "pavillon":
      return { x: seite * w * 0.283, y: h * 0.47, z: d * 0.283, faktor: 0.58 };
    case "bruecke":
      return { x: seite * w * 0.30, y: h * 1.02, z: d * 0.47, faktor: 0.56 };
    case "tor":
      return { x: seite * w * 0.36, y: h * 0.60, z: d * 0.505, faktor: 0.62 };
    default:
      return null;
  }
}

function baueProfil(parts, stil, variante, f, si, vi) {
  var w = variante.breite * stil.mass;
  var d = variante.tiefe * stil.mass;
  var h = variante.hoehe * (0.74 + stil.schlankheit * 0.24);
  var spitze = h;

  switch (variante.profil) {
    case "haus":
      spitze = kernMitDach(parts, stil, f, w, d, h, 0, 0, si, vi);
      break;
    case "langhaus":
      spitze = kernMitDach(parts, stil, f, w, d, h, 0, 0, si, vi);
      box(parts, w * 0.86, h * 0.10, d * 1.08, 0, h * 0.12, 0, f.akzent);
      break;
    case "turm":
      spitze = kernMitDach(parts, stil, f, w * 0.84, d * 0.84, h, 0, 0, si, vi);
      torus(parts, w * 0.82, h * 0.10, d * 0.82, 0, h * 0.68, 0, f.akzent, TAU, PI / 2);
      break;
    case "gasthaus":
      spitze = kernMitDach(parts, stil, f, w * 0.72, d, h, -w * 0.12, 0, si, vi);
      kernMitDach(parts, stil, f, w * 0.34, d * 0.70, h * 0.66, w * 0.36, 0, si, vi, false);
      torus(parts, w * 0.16, h * 0.16, d * 0.10, w * 0.43, h * 0.55,
        d * 0.52, f.akzent, TAU);
      break;
    case "rathaus":
      spitze = kernMitDach(parts, stil, f, w * 0.64, d, h, 0, 0, si, vi);
      for (var rt = -1; rt <= 1; rt += 2) {
        kernMitDach(parts, stil, f, w * 0.25, d * 0.72, h * 0.72,
          rt * w * 0.40, 0, si, vi, false);
      }
      for (var st = 0; st < 3; st++) {
        box(parts, w * (0.48 + st * 0.12), h * 0.05, d * (0.22 + st * 0.08),
          0, h * 0.025 + st * h * 0.05, d * 0.58 + st * d * 0.04, f.wandDunkel);
      }
      break;
    case "halle":
      box(parts, w, h * 0.12, d, 0, h * 0.06, 0, f.wandDunkel);
      for (var hx = -1; hx <= 1; hx += 2) for (var hz = -1; hz <= 1; hz += 2) {
        zylinder(parts, w * 0.08, h * 0.74, d * 0.08,
          hx * w * 0.40, h * 0.43, hz * d * 0.39, f.akzent, 8, 0.82);
      }
      spitze = baueDach(parts, stil, f, w, d, h * 0.82, 0, 0, vi);
      break;
    case "werkstatt":
      spitze = kernMitDach(parts, stil, f, w * 0.76, d, h, -w * 0.10, 0, si, vi);
      box(parts, w * 0.34, h * 0.52, d * 0.72, w * 0.39, h * 0.26, 0, f.holz);
      box(parts, w * 0.40, h * 0.08, d * 0.84, w * 0.39, h * 0.56, 0,
        f.dach, 0, 0, -0.12);
      break;
    case "schmiede":
      spitze = kernMitDach(parts, stil, f, w, d, h, 0, 0, si, vi);
      zylinder(parts, w * 0.16, h * 0.86, d * 0.16, w * 0.29, h * 0.72,
        -d * 0.20, f.wandDunkel, 6, 0.78);
      torus(parts, w * 0.26, h * 0.12, d * 0.22, -w * 0.28, h * 0.28,
        d * 0.52, f.akzent, TAU);
      spitze = Math.max(spitze, h * 1.15);
      break;
    case "bibliothek":
      spitze = kernMitDach(parts, stil, f, w * 0.62, d, h, 0, 0, si, vi);
      for (var bw = -1; bw <= 1; bw += 2) {
        kernMitDach(parts, stil, f, w * 0.28, d * 0.72, h * 0.62,
          bw * w * 0.39, 0, si, vi, false);
      }
      for (var fy = 0; fy < 3; fy++) {
        torus(parts, w * 0.34, h * 0.12, d * 0.12, 0, h * (0.30 + fy * 0.20),
          d * 0.51, f.fenster, PI);
      }
      break;
    case "tempel":
      box(parts, w, h * 0.10, d, 0, h * 0.05, 0, f.wandDunkel);
      baueKern(parts, stil, f, w * 0.56, d * 0.64, h * 0.72, 0, -d * 0.05, si, vi);
      for (var tx = -1; tx <= 1; tx += 2) for (var tz = -1; tz <= 1; tz += 2) {
        zylinder(parts, w * 0.08, h * 0.72, d * 0.08, tx * w * 0.39,
          h * 0.41, tz * d * 0.36, f.akzent, 9, 0.76);
      }
      spitze = baueDach(parts, stil, f, w * 0.92, d * 0.88, h * 0.78, 0, 0, vi);
      break;
    case "schrein":
      box(parts, w, h * 0.10, d, 0, h * 0.05, 0, f.wandDunkel);
      for (var sx = -1; sx <= 1; sx += 2) {
        zylinder(parts, w * 0.10, h * 0.62, d * 0.10, sx * w * 0.34,
          h * 0.36, 0, f.akzent, 8, 0.72);
      }
      spitze = baueDach(parts, stil, f, w, d, h * 0.67, 0, 0, vi);
      break;
    case "tor":
      for (var gt = -1; gt <= 1; gt += 2) {
        baueKern(parts, stil, f, w * 0.28, d, h, gt * w * 0.36, 0, si, vi);
        baueDach(parts, stil, f, w * 0.31, d * 1.04, h, gt * w * 0.36, 0, vi);
      }
      box(parts, w * 0.48, h * 0.22, d * 0.82, 0, h * 0.78, 0, f.wand);
      torus(parts, w * 0.36, h * 0.62, d * 0.16, 0, h * 0.31, d * 0.43,
        f.akzent, PI);
      spitze = h * 1.18;
      break;
    case "wehrturm":
      baueKern(parts, stil, f, w, d, h, 0, 0, si, vi);
      box(parts, w * 1.08, h * 0.11, d * 1.08, 0, h * 0.91, 0, f.wandDunkel);
      for (var cr = 0; cr < 8; cr++) {
        var ang = cr * PI / 4;
        box(parts, w * 0.15, h * 0.18, d * 0.15, Math.cos(ang) * w * 0.44,
          h * 1.05, Math.sin(ang) * d * 0.44, f.akzent, 0, -ang, 0);
      }
      spitze = h * 1.14;
      break;
    case "palast":
      spitze = kernMitDach(parts, stil, f, w * 0.50, d, h, 0, 0, si, vi);
      for (var pw = -1; pw <= 1; pw += 2) {
        kernMitDach(parts, stil, f, w * 0.28, d * 0.76, h * 0.66,
          pw * w * 0.38, 0, si, vi, false);
        kernMitDach(parts, stil, f, w * 0.15, d * 0.42, h * 0.92,
          pw * w * 0.47, -d * 0.27, si, vi, false);
      }
      break;
    case "bruecke":
      box(parts, w, h * 0.18, d, 0, h * 0.82, 0, f.wand);
      for (var bp = -1; bp <= 1; bp += 2) {
        box(parts, w * 0.12, h * 0.82, d * 0.88, bp * w * 0.31,
          h * 0.41, 0, f.wandDunkel);
      }
      torus(parts, w * 0.52, h * 1.25, d * 0.42, 0, h * 0.10,
        d * 0.51, f.akzent, PI);
      for (var br = -1; br <= 1; br += 2) {
        box(parts, w, h * 0.07, d * 0.08, 0, h * 1.02,
          br * d * 0.47, f.holz);
      }
      spitze = h * 1.06;
      break;
    case "muehle":
      baueKern(parts, stil, f, w, d, h * 0.78, 0, 0, si, vi);
      spitze = baueDach(parts, stil, f, w, d, h * 0.78, 0, 0, vi);
      zylinder(parts, w * 0.14, d * 0.30, w * 0.14, 0, h * 0.62,
        d * 0.60, f.akzent, 8, 1, PI / 2);
      var fluegelY = h * 0.62;
      for (var fl = 0; fl < 4; fl++) {
        var winkel = fl * PI / 2 + PI / 4;
        var sin = Math.sin(winkel), cos = Math.cos(winkel);
        var innen = h * 0.25, aussen = h * 0.21;
        var innenAbstand = innen * 0.5;
        var aussenAbstand = innen + aussen * 0.5;
        box(parts, w * 0.055, innen, d * 0.050,
          -sin * innenAbstand, fluegelY + cos * innenAbstand,
          d * 0.67, f.holz, 0, 0, winkel);
        box(parts, w * 0.12, aussen, d * 0.055,
          -sin * aussenAbstand, fluegelY + cos * aussenAbstand,
          d * 0.67, fl % 2 ? f.akzent : f.holz, 0, 0, winkel);
      }
      break;
    case "observatorium":
      zylinder(parts, w, h * 0.64, d, 0, h * 0.32, 0, f.wand, 12, 0.92);
      kugel(parts, w * 1.04, h * 0.72, d * 1.04, 0, h * 0.62, 0, f.dach, true);
      zylinder(parts, w * 0.18, h * 0.76, d * 0.18, w * 0.12, h * 0.92,
        0, f.akzent, 8, 0.82, PI / 3, 0, -0.18);
      torus(parts, w * 0.94, h * 0.12, d * 0.94, 0, h * 0.64, 0,
        f.akzent, TAU, PI / 2);
      spitze = h * 1.20;
      break;
    case "pavillon":
      box(parts, w, h * 0.08, d, 0, h * 0.04, 0, f.wandDunkel);
      for (var pv = 0; pv < 8; pv++) {
        var pa = pv * TAU / 8;
        zylinder(parts, w * 0.07, h * 0.72, d * 0.07,
          Math.cos(pa) * w * 0.40, h * 0.40, Math.sin(pa) * d * 0.40,
          f.akzent, 8, 0.76);
      }
      spitze = baueDach(parts, stil, f, w, d, h * 0.76, 0, 0, vi);
      break;
  }

  /* Jedes Paar trägt sein Kulturornament an einer leicht eigenen Position.
     Das ist sichtbare Individualität und zugleich ein stabiler Geometrieanker. */
  var ornamentGroesse = 0.48 + si * 0.018 + vi * 0.009;
  var ox = (vi % 5 - 2) * w * 0.025;
  var oz = d * 0.545;
  var oy = h * 0.70;
  if (variante.gruppe === "wohnen" || variante.gruppe === "handwerk") oy = h * 0.78;
  if (variante.gruppe === "wehr" || variante.gruppe === "infrastruktur") oy = h * 0.58;
  var offenerAnker = ornamentAnker(variante.profil, w, d, h, si, vi);
  if (offenerAnker) {
    baueOrnament(parts, stil, f, offenerAnker.x, offenerAnker.y, offenerAnker.z,
      ornamentGroesse * offenerAnker.faktor, si, vi);
  } else if (variante.gruppe === "sakral" || variante.gruppe === "herrschaft") {
    for (var fr = -1; fr <= 1; fr++) {
      baueOrnament(parts, stil, f, fr * w * 0.22, oy, oz,
        ornamentGroesse * (fr === 0 ? 0.72 : 0.52), si, vi + fr + 1);
    }
  } else {
    baueOrnament(parts, stil, f, ox, oy, oz, ornamentGroesse * 0.82, si, vi);
  }
  return { w: w, d: d, h: h, spitze: spitze };
}

function finde(eingabe, liste, art) {
  if (typeof eingabe === "object" && eingabe && typeof eingabe.id === "string") return eingabe;
  var gefunden = liste.find(function (eintrag) { return eintrag.id === eingabe; });
  if (!gefunden) throw new Error("Unbekannter Architektur-" + art + ": " + String(eingabe));
  return gefunden;
}

/** Baut genau eine Stil×Typ-Geometrie aus Three-Primitiven. */
export function erstelleArchitekturGeometrie(stilEingabe, variantenEingabe) {
  var stil = finde(stilEingabe, ARCHITEKTUR_STILE, "Stil");
  var variante = finde(variantenEingabe, ARCHITEKTUR_VARIANTEN, "Variante");
  var stilIndex = ARCHITEKTUR_STILE.indexOf(stil);
  var variantenIndex = ARCHITEKTUR_VARIANTEN.indexOf(variante);
  var parts = [];
  var farben = farbenFuer(stil, variantenIndex);
  var masse = baueProfil(parts, stil, variante, farben, stilIndex, variantenIndex);
  var veredelungsMasse = {
    w: masse.w, d: masse.d, h: masse.h, spitze: masse.spitze,
    stilIndex: stilIndex, variantenIndex: variantenIndex, etagen: variante.etagen
  };
  gestalteArchitekturFassade(parts, stil, variante, farben, veredelungsMasse);
  veredleArchitektur(parts, stil, variante, farben, veredelungsMasse);
  var formDetails = gestalteArchitekturFormensprache(
    parts, stil, variante, farben, veredelungsMasse
  );
  var geometrie = mergeGeos(parts);
  geometrie.userData = {
    architekturStil: stil.id,
    architekturVariante: variante.id,
    architekturTeile: parts.length,
    architekturFormensprache: "waldsaeule-a",
    architekturFormDetails: formDetails
  };
  return geometrie;
}

export function architekturPoolOptionen(stil, variante, variantenIndex) {
  var optionen = {
    radius: Math.round(variante.radius * stil.mass * 100) / 100,
    ao: 0.18 + (variantenIndex % 4) * 0.02,
    familie: stil.familie
  };
  if (variante.gruppe !== "handwerk") return optionen;

  var w = variante.breite * stil.mass;
  var d = variante.tiefe * stil.mass;
  var h = variante.hoehe * (0.74 + stil.schlankheit * 0.24);
  if (variante.profil === "schmiede") {
    optionen.rauchAnker = [w * 0.29, h * 1.15 + 0.12, -d * 0.20];
  } else if (variante.profil === "werkstatt") {
    var stilIndex = ARCHITEKTUR_STILE.indexOf(stil);
    var seite = (((stilIndex + 1) * 97 + (variantenIndex + 1) * 53 +
      23 * 31) >>> 0) % 2 ? 1 : -1;
    optionen.rauchAnker = [-seite * w * 0.39, h * 0.71 + 0.12, -d * 0.26];
  }
  return optionen;
}

/** Radius der fertig gebauten Form, inklusive fuenf Prozent Auslegerreserve. */
function architekturRegistrierungsradius(geo, katalogRadius) {
  var position = geo && geo.attributes && geo.attributes.position;
  var maxQuadrat = 0;
  if (!position || position.itemSize < 3) return katalogRadius;
  for (var i = 0; i < position.count; i++) {
    var x = position.getX(i), z = position.getZ(i);
    maxQuadrat = Math.max(maxQuadrat, x * x + z * z);
  }
  return Math.ceil(Math.max(katalogRadius, Math.sqrt(maxQuadrat) * 1.05) * 100) / 100;
}

/**
 * Registriert exakt 216 Pools. Die optionale Injektion erlaubt isolierte
 * Registry-Tests. Der direkte Standardweg misst zusaetzlich die fertige Form,
 * damit auch erneute Registrierung nie auf den kleineren Katalogradius faellt.
 */
export function registriereArchitekturPools(poolDefinierer) {
  var direkt = !poolDefinierer;
  var define = poolDefinierer || terraDefinePool;
  if (typeof define !== 'function') throw new TypeError('definePool-Funktion fehlt');
  var registriert = [];
  for (var i = 0; i < ARCHITEKTUR_ASSETS.length; i++) {
    var asset = ARCHITEKTUR_ASSETS[i];
    var stil = ARCHITEKTUR_STILE[asset.stilIndex];
    var variante = ARCHITEKTUR_VARIANTEN[asset.variantenIndex];
    var geo = erstelleArchitekturGeometrie(stil, variante);
    var optionen = architekturPoolOptionen(stil, variante, asset.variantenIndex);
    if (direkt) optionen.radius = architekturRegistrierungsradius(geo, optionen.radius);
    define(asset.id, geo, optionen);
    registriert.push(asset.id);
  }
  return registriert;
}
