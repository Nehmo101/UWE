/**
 * Kleine, kulturgebundene Architekturdetails fuer den bestehenden Merge.
 *
 * Der Baustein erzeugt ausschliesslich gefaerbte BufferGeometry-Teile. Er
 * besitzt weder Meshes noch Materialien und kann deshalb direkt vor
 * `mergeGeos(parts)` aufgerufen werden. Alle Abweichungen leiten sich aus den
 * stabilen Stil- und Variantenindizes ab.
 */
import * as THREE from "three";
import { M, farbton, part } from "./geometrie-hilfen.js";

var PI = Math.PI, TAU = Math.PI * 2;
var STIL_IDS = new Set([
  "mondelfen", "tiefenzwerge", "windweiden", "kupfernomaden",
  "korallenhoefe", "pilzmarken", "wolkenkloster", "wurzelbund",
  "kristallorden", "schilfinseln", "sternensteppe", "drachenbasalt"
]);
var ROLLEN = new Set([
  "wohnen", "gemeinschaft", "handwerk", "wissen",
  "sakral", "wehr", "herrschaft", "infrastruktur"
]);

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

/* Wie in architektur-geometrie.js: diese beiden Formen tragen hier nur
   Kleinzeug (Laternenkugeln, Zierringe von 9 cm Rohrstaerke) und kosteten
   dafuer 64 bzw. 96 Dreiecke. Die gesenkte Aufloesung finanziert die
   Requisiten weiter unten, die man aus Siedlungsentfernung wirklich sieht. */
function kugel(parts, w, h, d, x, y, z, farbe) {
  parts.push(part(
    new THREE.SphereGeometry(0.5, 6, 4),
    M(x, y, z, 0, 0, 0, w, h, d),
    farbe
  ));
}

function torus(parts, w, h, d, x, y, z, farbe, bogen, rx, ry, rz) {
  parts.push(part(
    new THREE.TorusGeometry(0.5, 0.09, 3, 10, bogen === undefined ? TAU : bogen),
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

function positiveZahl(objekt, name) {
  var wert = Number(objekt && objekt[name]);
  if (!Number.isFinite(wert) || wert <= 0) {
    throw new TypeError("Architekturmass " + name + " muss positiv und endlich sein");
  }
  return wert;
}

function indexZahl(objekt, name) {
  var wert = Number(objekt && objekt[name]);
  if (!Number.isInteger(wert) || wert < 0) {
    throw new TypeError("Architekturindex " + name + " muss eine nichtnegative Ganzzahl sein");
  }
  return wert;
}

function farbe(farben, name, ersatz) {
  var wert = Number(farben && farben[name]);
  return Number.isFinite(wert) ? wert : ersatz;
}

function kontext(stil, variante, farben, masse) {
  if (!stil || !STIL_IDS.has(stil.id)) {
    throw new Error("Unbekannter Architektur-Detailstil: " + String(stil && stil.id));
  }
  if (!variante || typeof variante.id !== "string") {
    throw new TypeError("Architekturvariante mit stabiler id fehlt");
  }
  if (!ROLLEN.has(variante.gruppe)) {
    throw new Error("Unbekannte Architekturrolle: " + String(variante.gruppe));
  }
  var w = positiveZahl(masse, "w");
  var d = positiveZahl(masse, "d");
  var h = positiveZahl(masse, "h");
  var spitze = positiveZahl(masse, "spitze");
  var si = indexZahl(masse, "stilIndex");
  var vi = indexZahl(masse, "variantenIndex");
  var basis = stil.palette || {};
  var f = {
    wand: farbe(farben, "wand", farbe(basis, "wand", 0xc8b98f)),
    wandDunkel: farbe(farben, "wandDunkel",
      farbton(farbe(basis, "wand", 0xc8b98f), 0.72)),
    dach: farbe(farben, "dach", farbe(basis, "dach", 0x7d6c55)),
    akzent: farbe(farben, "akzent", farbe(basis, "akzent", 0xd5b86c)),
    holz: farbe(farben, "holz", farbe(basis, "holz", 0x6f543d)),
    fenster: farbe(farben, "fenster", farbe(basis, "fenster", 0xa8d8c4))
  };
  return {
    w: w, d: d, h: h, spitze: spitze,
    stil: stil.id, familie: stil.familie,
    si: si, vi: vi, f: f,
    profil: variante.profil || variante.id,
    gruppe: variante.gruppe
  };
}

/** Kleiner ganzzahliger Mischer fuer reproduzierbare Links-rechts-Variation. */
function muster(k, salz, modulo) {
  var wert = ((k.si + 1) * 97 + (k.vi + 1) * 53 + salz * 31) >>> 0;
  return wert % modulo;
}

function istBruecke(k) {
  return k.profil === "bruecke";
}

function stufen(parts, k, farbeWert, anzahl, breite) {
  if (istBruecke(k)) return;
  var sh = Math.max(0.07, Math.min(0.18, k.h * 0.032));
  var sd = Math.max(0.16, k.d * 0.075);
  var sw = k.w * (breite || 0.46);
  for (var i = 0; i < anzahl; i++) {
    box(parts, sw + (anzahl - i - 1) * k.w * 0.055, sh, sd,
      0, sh * (i + 0.5), k.d * 0.5 + sd * (anzahl - i - 0.5), farbeWert);
  }
}

function balkon(parts, k, farbeWert, y, breite) {
  var bw = k.w * (breite || 0.54);
  var z = k.d * 0.54;
  box(parts, bw, k.h * 0.045, k.d * 0.18, 0, y, z, farbeWert);
  for (var s = -1; s <= 1; s += 2) {
    zylinder(parts, k.w * 0.045, k.h * 0.28, k.w * 0.045,
      s * bw * 0.42, y - k.h * 0.14, z, farbeWert, 7, 0.78);
  }
}

function laternenPaar(parts, k, farbeWert, traegerFarbe, hoehe) {
  if (istBruecke(k)) return;
  var y = Math.min(k.spitze * 0.62, k.h * (hoehe || 0.48));
  for (var s = -1; s <= 1; s += 2) {
    var x = s * k.w * 0.34;
    var z = k.d * 0.58;
    zylinder(parts, k.w * 0.025, y * 0.75, k.w * 0.025,
      x, y * 0.375, z, traegerFarbe, 6, 0.76);
    kugel(parts, k.w * 0.11, k.w * 0.14, k.w * 0.11,
      x, y * 0.78, z, farbeWert);
  }
}

function mondelfen(parts, k) {
  zylinder(parts, k.w * 1.05, k.h * 0.09, k.d * 1.05,
    0, k.h * 0.045, 0, k.f.wandDunkel, 12, 0.92);
  stufen(parts, k, k.f.wandDunkel, 2, 0.42);
  balkon(parts, k, k.f.akzent, k.h * 0.61, 0.58);
  torus(parts, k.w * 0.34, k.h * 0.28, k.d * 0.10,
    0, k.h * 0.76, k.d * 0.61, k.f.fenster, PI * 1.45, 0, 0,
    (muster(k, 2, 3) - 1) * 0.08);
}

function tiefenzwerge(parts, k) {
  for (var i = 0; i < 3; i++) {
    box(parts, k.w * (1.12 - i * 0.08), k.h * 0.055, k.d * (1.10 - i * 0.07),
      0, k.h * (0.0275 + i * 0.055), 0,
      i === 1 ? k.f.akzent : k.f.wandDunkel);
  }
  stufen(parts, k, k.f.wandDunkel, 3, 0.56);
  for (var s = -1; s <= 1; s += 2) {
    box(parts, k.w * 0.14, k.h * 0.42, k.d * 0.28,
      s * k.w * 0.49, k.h * 0.21, k.d * 0.16, k.f.wandDunkel, 0, 0, -s * 0.05);
  }
}

function windweiden(parts, k) {
  if (!istBruecke(k)) {
    box(parts, k.w * 0.78, k.h * 0.055, k.d * 0.32,
      0, k.h * 0.04, k.d * 0.58, k.f.holz);
    balkon(parts, k, k.f.holz, k.h * 0.43, 0.62);
    box(parts, k.w * 0.68, k.h * 0.055, k.d * 0.34,
      0, k.h * 0.64, k.d * 0.61, k.f.dach, -0.10, 0,
      (muster(k, 4, 3) - 1) * 0.07);
  }
  var seite = muster(k, 5, 2) ? 1 : -1;
  box(parts, k.w * 0.28, k.h * 0.34, k.d * 0.52,
    seite * k.w * 0.57, k.h * 0.17, -k.d * 0.12, k.f.wandDunkel, 0, 0, seite * 0.05);
}

function kupfernomaden(parts, k) {
  zylinder(parts, k.w * 1.08, k.h * 0.07, k.d * 1.08,
    0, k.h * 0.035, 0, k.f.wandDunkel, 8, 0.94);
  stufen(parts, k, k.f.akzent, 2, 0.48);
  if (!istBruecke(k)) {
    box(parts, k.w * 0.72, k.h * 0.045, k.d * 0.38,
      0, k.h * 0.60, k.d * 0.62, k.f.dach, -0.12, 0, 0);
    for (var s = -1; s <= 1; s += 2) {
      zylinder(parts, k.w * 0.035, k.h * 0.58, k.w * 0.035,
        s * k.w * 0.32, k.h * 0.29, k.d * 0.59, k.f.holz, 6, 0.82);
    }
  }
  laternenPaar(parts, k, k.f.fenster, k.f.holz, 0.43);
}

function korallenhoefe(parts, k) {
  for (var i = 0; i < 5; i++) {
    var a = i * TAU / 5 + muster(k, 7, 4) * 0.08;
    kugel(parts, k.w * 0.25, k.h * 0.13, k.d * 0.22,
      Math.cos(a) * k.w * 0.46, k.h * 0.055,
      Math.sin(a) * k.d * 0.46, i % 2 ? k.f.wandDunkel : k.f.akzent);
  }
  stufen(parts, k, k.f.wandDunkel, 2, 0.44);
  torus(parts, k.w * 0.62, k.h * 0.22, k.d * 0.16,
    0, k.h * 0.48, k.d * 0.57, k.f.fenster, PI, 0, 0, 0);
  kugel(parts, k.w * 0.28, k.h * 0.32, k.d * 0.32,
    -k.w * 0.55, k.h * 0.16, -k.d * 0.18, k.f.wand);
}

function pilzmarken(parts, k) {
  for (var i = 0; i < 6; i++) {
    var a = i * TAU / 6;
    kugel(parts, k.w * 0.18, k.h * (0.10 + (i % 2) * 0.035), k.d * 0.16,
      Math.cos(a) * k.w * 0.48, k.h * 0.04,
      Math.sin(a) * k.d * 0.47, i % 3 ? k.f.wandDunkel : k.f.akzent);
  }
  stufen(parts, k, k.f.holz, 2, 0.40);
  var seite = muster(k, 9, 2) ? 1 : -1;
  zylinder(parts, k.w * 0.18, k.h * 0.28, k.d * 0.18,
    seite * k.w * 0.56, k.h * 0.14, k.d * 0.08, k.f.holz, 8, 0.78);
  kugel(parts, k.w * 0.38, k.h * 0.17, k.d * 0.36,
    seite * k.w * 0.56, k.h * 0.31, k.d * 0.08, k.f.dach);
}

function wolkenkloster(parts, k) {
  for (var s = -1; s <= 1; s += 2) {
    kegel(parts, k.w * 0.22, k.h * 0.42, k.d * 0.22,
      s * k.w * 0.32, k.h * 0.12, 0, k.f.wandDunkel, 8, 0, 0, PI);
  }
  box(parts, k.w * 0.66, k.h * 0.045, k.d * 0.28,
    0, k.h * 0.19, k.d * 0.57, k.f.wand);
  torus(parts, k.w * 0.42, k.h * 0.26, k.d * 0.10,
    0, k.h * 0.68, k.d * 0.57, k.f.fenster, PI * 1.35, 0, 0, 0);
  kristall(parts, k.w * 0.14, k.h * 0.20, k.d * 0.14,
    0, Math.min(k.spitze * 0.92, k.h * 1.04), k.d * 0.12, k.f.akzent, 0, 0.2, 0);
}

function wurzelbund(parts, k) {
  for (var i = 0; i < 4; i++) {
    var a = i * PI / 2 + 0.2;
    kegel(parts, k.w * 0.22, k.h * 0.48, k.d * 0.22,
      Math.cos(a) * k.w * 0.43, k.h * 0.13,
      Math.sin(a) * k.d * 0.42, k.f.holz, 7,
      Math.sin(a) * 0.62, 0, -Math.cos(a) * 0.62);
  }
  stufen(parts, k, k.f.holz, 2, 0.43);
  torus(parts, k.w * 0.54, k.h * 0.46, k.d * 0.13,
    0, k.h * 0.37, k.d * 0.58, k.f.dach, PI * 1.30, 0, 0, 0);
  kugel(parts, k.w * 0.25, k.h * 0.28, k.d * 0.24,
    k.w * 0.54, k.h * 0.14, -k.d * 0.16, k.f.wand);
}

function kristallorden(parts, k) {
  zylinder(parts, k.w * 1.06, k.h * 0.10, k.d * 1.06,
    0, k.h * 0.05, 0, k.f.wandDunkel, 6, 0.82);
  stufen(parts, k, k.f.wandDunkel, 3, 0.46);
  for (var s = -1; s <= 1; s += 2) {
    kristall(parts, k.w * 0.22, k.h * (0.34 + muster(k, 12 + s, 3) * 0.05),
      k.d * 0.20, s * k.w * 0.52, k.h * 0.16, k.d * 0.08,
      s > 0 ? k.f.fenster : k.f.akzent, 0, s * 0.19, s * 0.08);
  }
  balkon(parts, k, k.f.akzent, k.h * 0.58, 0.48);
}

function schilfinseln(parts, k) {
  for (var x = -1; x <= 1; x += 2) for (var z = -1; z <= 1; z += 2) {
    zylinder(parts, k.w * 0.055, k.h * 0.54, k.w * 0.055,
      x * k.w * 0.43, k.h * 0.20, z * k.d * 0.40, k.f.holz, 6, 0.78);
  }
  if (!istBruecke(k)) {
    box(parts, k.w * 0.44, k.h * 0.045, k.d * 0.62,
      0, k.h * 0.12, k.d * 0.68, k.f.holz);
    for (var i = 0; i < 3; i++) {
      box(parts, k.w * 0.38, k.h * 0.025, k.d * 0.055,
        0, k.h * (0.04 + i * 0.06), k.d * (0.88 - i * 0.11), k.f.akzent);
    }
  }
  laternenPaar(parts, k, k.f.fenster, k.f.holz, 0.38);
}

function sternensteppe(parts, k) {
  zylinder(parts, k.w * 1.08, k.h * 0.075, k.d * 1.08,
    0, k.h * 0.0375, 0, k.f.wandDunkel, 12, 0.94);
  stufen(parts, k, k.f.akzent, 2, 0.45);
  if (!istBruecke(k)) {
    box(parts, k.w * 0.70, k.h * 0.04, k.d * 0.34,
      0, k.h * 0.59, k.d * 0.61, k.f.dach, -0.08, 0, 0);
  }
  kristall(parts, k.w * 0.18, k.h * 0.22, k.d * 0.12,
    0, Math.min(k.spitze * 0.88, k.h * 0.96), k.d * 0.57,
    k.f.fenster, 0, 0, PI / 4);
  kugel(parts, k.w * 0.28, k.h * 0.32, k.d * 0.28,
    (muster(k, 14, 2) ? 1 : -1) * k.w * 0.55,
    k.h * 0.16, -k.d * 0.12, k.f.wand);
}

function drachenbasalt(parts, k) {
  zylinder(parts, k.w * 1.10, k.h * 0.13, k.d * 1.08,
    0, k.h * 0.065, 0, k.f.wandDunkel, 6, 0.74);
  stufen(parts, k, k.f.wandDunkel, 3, 0.52);
  for (var s = -1; s <= 1; s += 2) {
    kegel(parts, k.w * 0.20, k.h * 0.42, k.d * 0.22,
      s * k.w * 0.48, k.h * 0.18, -k.d * 0.22,
      k.f.wandDunkel, 5, 0, 0, -s * 0.16);
  }
  zylinder(parts, k.w * 0.17, k.h * 0.58, k.d * 0.17,
    (muster(k, 16, 2) ? 1 : -1) * k.w * 0.42,
    k.h * 0.29, -k.d * 0.30, k.f.dach, 6, 0.72);
  kugel(parts, k.w * 0.13, k.h * 0.13, k.d * 0.13,
    0, k.h * 0.23, k.d * 0.61, k.f.fenster);
}

/* Zweite Erz?hlschicht: gleiche Kultur, im Kleinen klar andere Nutzung. */
function rolleWohnen(parts, k) {
  var z = k.d * 0.535;
  for (var s = -1; s <= 1; s += 2) {
    var x = s * k.w * 0.25;
    box(parts, k.w * 0.24, k.h * 0.055, k.d * 0.09, x, k.h * 0.38, z, k.f.holz);
    kugel(parts, k.w * 0.085, k.h * 0.09, k.w * 0.075,
      x, k.h * 0.44, z, s > 0 ? k.f.akzent : k.f.fenster);
  }
  box(parts, k.w * 0.42, k.h * 0.025, k.d * 0.035,
    0, k.h * 0.57, z + k.d * 0.03, k.f.holz);
  box(parts, k.w * 0.12, k.h * 0.16, k.d * 0.025,
    (muster(k, 21, 2) ? 1 : -1) * k.w * 0.10, k.h * 0.49, z + k.d * 0.04, k.f.dach);
}

function rolleGemeinschaft(parts, k) {
  var x = (muster(k, 22, 2) ? 1 : -1) * k.w * 0.24, z = k.d * 0.66;
  box(parts, k.w * 0.42, k.h * 0.055, k.d * 0.16, x, k.h * 0.18, z, k.f.holz);
  for (var s = -1; s <= 1; s += 2) box(parts, k.w * 0.045, k.h * 0.18,
    k.d * 0.045, x + s * k.w * 0.15, k.h * 0.09, z, k.f.holz);
  box(parts, k.w * 0.52, k.h * 0.045, k.d * 0.27,
    x, k.h * 0.48, z, k.f.dach, -0.10, 0, 0.035);
}

function rolleHandwerk(parts, k) {
  var s = muster(k, 23, 2) ? 1 : -1;
  box(parts, k.w * 0.23, k.h * 0.19, k.d * 0.23,
    s * k.w * 0.57, k.h * 0.095, k.d * 0.20, k.f.holz);
  box(parts, k.w * 0.18, k.h * 0.15, k.d * 0.18,
    s * k.w * 0.48, k.h * 0.265, k.d * 0.18, k.f.wandDunkel, 0, s * 0.18, 0);
  zylinder(parts, k.w * 0.13, k.h * (k.profil === "schmiede" ? 0.82 : 0.58),
    k.d * 0.13, -s * k.w * 0.39, k.h * 0.42, -k.d * 0.26, k.f.wandDunkel, 6, 0.70);
}

function rolleWissen(parts, k) {
  var s = muster(k, 24, 2) ? 1 : -1, x = s * k.w * 0.43, z = k.d * 0.58;
  zylinder(parts, k.w * 0.16, k.h * 0.34, k.d * 0.16,
    x, k.h * 0.17, z, k.f.wandDunkel, 8, 0.82);
  torus(parts, k.w * 0.25, k.h * 0.23, k.d * 0.12,
    x, k.h * 0.43, z, k.f.akzent, TAU, PI / 2, s * 0.22, 0);
  kristall(parts, k.w * 0.11, k.h * 0.16, k.d * 0.11,
    x, k.h * 0.43, z, k.f.fenster, 0, 0.2, 0);
}

function rolleSakral(parts, k) {
  for (var i = -1; i <= 1; i++) {
    kugel(parts, k.w * 0.13, k.h * 0.10, k.d * 0.12,
      i * k.w * 0.16, k.h * 0.045, k.d * 0.64, i ? k.f.wandDunkel : k.f.akzent);
    box(parts, k.w * 0.055, k.h * (0.18 + (i + 1) * 0.025), k.d * 0.025,
      i * k.w * 0.16, k.h * 0.43, k.d * 0.545,
      i === 0 ? k.f.fenster : k.f.dach, 0, 0, i * 0.09);
  }
}

function rolleWehr(parts, k) {
  for (var s = -1; s <= 1; s += 2) {
    var x = s * k.w * (k.profil === "tor" ? 0.46 : 0.38);
    zylinder(parts, k.w * 0.13, k.h * 0.24, k.d * 0.13,
      x, k.h * 0.12, k.d * 0.61, k.f.holz, 8, 0.92);
    zylinder(parts, k.w * 0.055, k.h * 0.50, k.w * 0.055,
      x + s * k.w * 0.12, k.h * 0.25, k.d * 0.57, k.f.wandDunkel, 6, 0.72);
  }
}

function rolleHerrschaft(parts, k) {
  for (var i = -1; i <= 1; i++) kugel(parts, k.w * 0.18,
    k.h * (0.15 + (i & 1) * 0.04), k.d * 0.18,
    i * k.w * 0.25, k.h * 0.075, k.d * 0.63, i === 0 ? k.f.akzent : k.f.dach);
  laternenPaar(parts, k, k.f.fenster, k.f.holz, 0.52);
}

function rolleInfrastruktur(parts, k) {
  var z = istBruecke(k) ? k.d * 0.42 : k.d * 0.62;
  for (var s = -1; s <= 1; s += 2) {
    zylinder(parts, k.w * 0.055, k.h * 0.46, k.w * 0.055,
      s * k.w * 0.42, k.h * 0.23, z, k.f.holz, 6, 0.72);
    box(parts, k.w * 0.20, k.h * 0.075, k.d * 0.045,
      s * k.w * 0.37, k.h * 0.43, z, k.f.akzent, 0, s * 0.16, -s * 0.08);
    if (istBruecke(k)) box(parts, k.w * 0.11, k.h * 0.58, k.d * 0.30,
      s * k.w * 0.45, k.h * 0.29, 0, k.f.wandDunkel);
  }
}

/*
 * Letzte Waldsaeule-A-Schicht: kleine Materialbrueche statt weiterer
 * Grossformen. Alle Teile bleiben im bestehenden statischen Geometriemerge.
 */
function waldsaeuleSockel(parts, k) {
  var basis = Math.min(k.w, k.d);
  var stein = farbton(k.f.wandDunkel, 0.82);
  var anzahl = k.profil === "bruecke" ? 3 : 5;
  for (var i = 0; i < anzahl; i++) {
    var a = i * 2.399 + muster(k, 41, 9) * 0.17;
    var r = basis * (0.052 + i % 3 * 0.011);
    kristall(parts, r * 1.35, r * 0.62, r,
      Math.cos(a) * k.w * (0.43 + i % 2 * 0.05), r * 0.31,
      Math.sin(a) * k.d * (0.42 + i % 3 * 0.03),
      i % 2 ? stein : farbton(stein, 1.14), a * 0.07, a, -a * 0.05);
  }
  if (!istBruecke(k)) {
    for (var p = 0; p < 2; p++) {
      box(parts, k.w * 0.12, k.h * 0.025, k.d * 0.07,
        (p - 0.5) * k.w * 0.14, k.h * 0.0175,
        k.d * (0.61 + p * 0.09), farbton(stein, 1.08 + p * 0.08),
        0.03 * (p ? 1 : -1), 0, 0.06 * (p ? 1 : -1));
    }
  }
}

function waldsaeuleMaterial(parts, k) {
  if (k.profil === "halle" || k.profil === "schrein" ||
      k.profil === "pavillon" || k.profil === "bruecke" ||
      k.profil === "tor" || k.gruppe === "wehr" ||
      k.stil === "wurzelbund") return;
  var z = k.d * 0.552;
  var dunkel = farbton(k.f.wandDunkel, 0.78);
  if (k.familie === "stein") {
    for (var i = 0; i < 3; i++) {
      box(parts, k.w * (0.075 + i % 2 * 0.02), k.h * 0.028, k.d * 0.018,
        (i - 1) * k.w * 0.24, k.h * (0.25 + i % 2 * 0.19), z,
        i === 1 ? k.f.akzent : dunkel, 0, 0, (i - 1) * 0.035);
    }
  } else if (k.familie === "holz" || k.familie === "rinde") {
    for (var s = -1; s <= 1; s += 2) {
      box(parts, k.w * 0.032, k.h * 0.30, k.d * 0.018,
        s * k.w * 0.22, k.h * 0.36, z, k.f.holz, 0, 0, s * 0.35);
    }
    box(parts, k.w * 0.42, k.h * 0.026, k.d * 0.020,
      0, k.h * 0.58, z, farbton(k.f.holz, 1.12));
  } else if (k.familie === "metall") {
    for (var n = 0; n < 4; n++) {
      kristall(parts, k.w * 0.04, k.h * 0.035, k.d * 0.018,
        (n - 1.5) * k.w * 0.17, k.h * (0.30 + n % 2 * 0.18), z,
        n % 2 ? k.f.akzent : dunkel, 0, n, 0);
    }
  } else if (k.familie === "stoff") {
    for (var t = 0; t < 4; t++) {
      kegel(parts, k.w * 0.045, k.h * 0.10, k.d * 0.015,
        (t - 1.5) * k.w * 0.16, k.h * 0.55, z,
        t % 2 ? k.f.akzent : k.f.dach, 5, Math.PI, 0, (t - 1.5) * 0.035);
    }
  } else {
    for (var q = -1; q <= 1; q += 2) {
      box(parts, k.w * 0.035, k.h * 0.22, k.d * 0.015,
        q * k.w * 0.31, k.h * 0.32, z,
        farbton(k.f.akzent, 0.92), 0, 0, q * 0.05);
    }
  }
}

function waldsaeuleNutzung(parts, k) {
  var z = k.d * 0.63;
  var s = muster(k, 43, 2) ? 1 : -1;
  if (k.gruppe === "handwerk") {
    box(parts, k.w * 0.14, k.h * 0.06, k.d * 0.12,
      s * k.w * 0.48, k.h * 0.06, z, k.f.wandDunkel);
    box(parts, k.w * 0.20, k.h * 0.045, k.d * 0.10,
      s * k.w * 0.48, k.h * 0.11, z, k.f.akzent, 0, 0, s * 0.05);
    kristall(parts, k.w * 0.10, k.h * 0.07, k.d * 0.09,
      s * k.w * 0.25, k.h * 0.055, z, k.f.fenster, 0, s, 0);
  } else if (k.gruppe === "wehr") {
    for (var a = 0; a < 3; a++) {
      box(parts, k.w * 0.045, k.h * 0.09, k.d * 0.024,
        (a - 1) * k.w * 0.20, k.h * (0.32 + a * 0.16),
        k.d * 0.558, farbton(k.f.wandDunkel, 0.56));
    }
  }
}

/* ==========================================================================
   Siedlungsschicht — Erdanschluss, Schornstein, Requisiten

   Bis hierher war ein Bau ein Baukoerper: er stand mit einer scharfen Kante
   im Boden, hatte nichts auf dem Dach und nichts an der Wand. Fuenfzehn
   davon nebeneinander lasen sich als Modul, nicht als Siedlung. Was in
   anno-01, anno-08 und howl-006 eine Gasse bewohnt aussehen laesst, sind
   genau drei Dinge, und keines davon ist der Baukoerper selbst:

     1. Der ERDANSCHLUSS. Kein Haus endet als Schnittkante im Gras; darunter
        liegt ein breiteres Fundament aus grob gesetztem Stein.
     2. Der SCHORNSTEIN. Er bricht die Dachsilhouette, wirft einen eigenen
        Schatten auf die Dachflaeche und sagt "hier wird gekocht".
     3. Die REQUISITEN. Kisten, Faesser, Waesche, Markise, Blumenkasten,
        Aussentreppe — das Zeug, das Leute vor ihre Tuer stellen.

   Welche zwei Requisiten ein Bau bekommt, haengt am stabilen Muster aus Stil-
   und Variantenindex. Damit tragen die achtzehn Bautypen EINER Kultur
   achtzehn verschiedene Kombinationen, ohne dass ein Zufallsstrom noetig
   waere — die Geometrie wird einmal gebacken und hundertfach instanziert.

   Getragen wird die Schicht von den Rollen wohnen, handwerk und
   gemeinschaft. Bibliothek, Tempel und Palast bekommen sie NICHT: dort waere
   Waesche auf der Leine kein Leben, sondern ein Fehler — und in einem Dorf
   stehen von ihnen ohnehin hoechstens einer.
   ========================================================================== */

var SIEDLUNGS_ROLLEN = new Set(["wohnen", "handwerk", "gemeinschaft"]);
/* Haeuser auf Stelzen (schilfinseln) und schwebende Kloester (wolkenkloster)
   haben definitionsgemaess keinen Erdanschluss. Eine Bruecke auch nicht. */
var OHNE_SOCKEL = new Set(["schilfinseln", "wolkenkloster"]);

function siedlungsBau(k) {
  return SIEDLUNGS_ROLLEN.has(k.gruppe) && !istBruecke(k) &&
    k.profil !== "halle" && k.profil !== "pavillon";
}

/**
 * Fundamentkranz: ein flaches Achteck, gut zehn Prozent breiter als die Wand
 * und nach unten ausgestellt. Es traegt die Wand optisch und ersetzt den
 * geometrischen Schnitt in den Boden durch eine Kante, die dort hingehoert.
 * Achteckig, weil dieselbe Form unter einem Kastenhaus wie unter einem
 * Rundturm sitzt — ein Quadrat waere unter der Haelfte der zwoelf Kulturen
 * falsch herum.
 */
function erdanschluss(parts, k) {
  if (istBruecke(k) || OHNE_SOCKEL.has(k.stil)) return;
  var stein = farbton(k.f.wandDunkel, 0.80);
  zylinder(parts, k.w * 1.15, k.h * 0.062, k.d * 1.15,
    0, k.h * 0.031, 0, stein, 8, 0.86);
  /* Zwei unregelmaessig gesetzte Randsteine brechen die perfekte Kante. */
  for (var s = -1; s <= 1; s += 2) {
    var seite = s * (0.5 + muster(k, 51 + s, 3) * 0.06);
    box(parts, k.w * 0.15, k.h * 0.045, k.d * 0.13,
      seite * k.w, k.h * 0.022, s * k.d * 0.28,
      farbton(stein, s > 0 ? 1.16 : 0.88), 0, s * 0.14, s * 0.05);
  }
}

/**
 * Schornstein. Er muss ueber den First hinaus: `k.spitze` ist die Dachhoehe,
 * die architektur-geometrie.js aus Traufkranz und Dachkoerper zurueckmeldet.
 * Steht er zu kurz, sieht es aus, als sei er im Dach versunken.
 */
function schornstein(parts, k) {
  var b = Math.min(k.w, k.d) * 0.15;
  var fuss = k.h * 0.92;
  var kopf = Math.max(k.spitze, k.h * 1.15) + Math.max(0.22, k.h * 0.1);
  var hoehe = kopf - fuss;
  if (hoehe <= 0.1) return;
  var x = (muster(k, 61, 2) ? 1 : -1) * k.w * 0.26;
  var z = -k.d * (0.12 + muster(k, 62, 3) * 0.05);
  var schaft = farbton(k.f.wandDunkel, 0.94);
  box(parts, b, hoehe, b * 0.88, x, fuss + hoehe * 0.5, z, schaft);
  box(parts, b * 1.35, hoehe * 0.11, b * 1.22, x, kopf, z,
    farbton(schaft, 0.62));
}

function kisten(parts, k, s) {
  var g = Math.min(k.w, k.d) * 0.19;
  box(parts, g, g * 0.78, g * 0.9, s * k.w * 0.44, g * 0.39, k.d * 0.52,
    k.f.holz, 0, s * 0.22, 0);
  box(parts, g * 0.78, g * 0.62, g * 0.72, s * k.w * 0.4, g * 1.09,
    k.d * 0.55, farbton(k.f.holz, 1.18), 0, -s * 0.34, s * 0.04);
}

function faesser(parts, k, s) {
  var g = Math.min(k.w, k.d) * 0.17;
  for (var i = 0; i < 2; i++) {
    zylinder(parts, g * (1 - i * 0.12), g * 1.05, g * (1 - i * 0.12),
      s * k.w * (0.42 + i * 0.12), g * 0.53, k.d * (0.48 - i * 0.16),
      farbton(k.f.holz, i ? 0.86 : 1.1), 7, 0.9, i ? 0.1 : 0, 0, i ? s * 0.06 : 0);
  }
}

/** Waescheleine zwischen Hauswand und einem schraegen Pfosten. */
function waescheleine(parts, k, s) {
  var y = k.h * 0.56, z = k.d * 0.6;
  zylinder(parts, k.w * 0.028, k.h * 0.66, k.w * 0.028,
    s * k.w * 0.46, k.h * 0.33, z, k.f.holz, 6, 0.78, 0, 0, -s * 0.07);
  box(parts, k.w * 0.5, k.h * 0.012, k.d * 0.012,
    s * k.w * 0.24, y, z, farbton(k.f.holz, 0.7));
  for (var i = 0; i < 3; i++) {
    box(parts, k.w * 0.085, k.h * (0.1 + (i % 2) * 0.045), k.d * 0.012,
      s * k.w * (0.08 + i * 0.13), y - k.h * (0.06 + (i % 2) * 0.022), z,
      i === 1 ? k.f.fenster : farbton(k.f.wand, 1.1), 0, 0, (i - 1) * 0.05);
  }
}

/** Markise ueber der Tuer: ein geneigtes Tuch auf zwei duennen Stangen. */
function markise(parts, k, s) {
  var y = k.h * 0.42, z = k.d * 0.62;
  box(parts, k.w * 0.42, k.h * 0.028, k.d * 0.3,
    s * k.w * 0.06, y, z, k.f.akzent, -0.34, 0, 0);
  for (var q = -1; q <= 1; q += 2) {
    zylinder(parts, k.w * 0.022, k.h * 0.34, k.w * 0.022,
      s * k.w * 0.06 + q * k.w * 0.19, y - k.h * 0.2, z + k.d * 0.09,
      k.f.holz, 6, 0.8);
  }
}

function blumenkasten(parts, k, s) {
  var z = k.d * 0.57, y = k.h * 0.33;
  box(parts, k.w * 0.26, k.h * 0.055, k.d * 0.075,
    s * k.w * 0.18, y, z, k.f.holz);
  for (var i = -1; i <= 1; i++) {
    kugel(parts, k.w * 0.075, k.h * 0.06, k.d * 0.06,
      s * k.w * 0.18 + i * k.w * 0.085, y + k.h * 0.05, z,
      i ? farbton(k.f.dach, 1.24) : k.f.akzent);
  }
}

/** Aussentreppe an der Flanke — drei Stufen und ein Podest. */
function aussentreppe(parts, k, s) {
  var b = k.w * 0.2;
  for (var i = 0; i < 3; i++) {
    box(parts, b, k.h * 0.05, k.d * 0.16 - i * k.d * 0.03,
      s * k.w * (0.5 - i * 0.02), k.h * (0.025 + i * 0.05),
      k.d * (0.44 - i * 0.11), farbton(k.f.wandDunkel, 0.9 + i * 0.09));
  }
  box(parts, b * 1.1, k.h * 0.045, k.d * 0.2,
    s * k.w * 0.46, k.h * 0.175, k.d * 0.14, k.f.holz);
}

var REQUISITEN = [kisten, faesser, waescheleine, markise, blumenkasten, aussentreppe];

/**
 * Zwei Requisiten je Bau, auf verschiedenen Seiten. Der zweite Griff ist um
 * eine Primzahl versetzt, damit die Paare nicht nach dem dritten Bautyp
 * durchlaufen — sonst haetten wohnhaus und turmhaus dieselbe Kombination.
 */
function requisiten(parts, k) {
  var a = muster(k, 71, REQUISITEN.length);
  var b = (a + 1 + muster(k, 73, REQUISITEN.length - 1)) % REQUISITEN.length;
  var seite = muster(k, 77, 2) ? 1 : -1;
  REQUISITEN[a](parts, k, seite);
  REQUISITEN[b](parts, k, -seite);
}

var ROLLEN_VEREDLER = {
  wohnen: rolleWohnen, gemeinschaft: rolleGemeinschaft,
  handwerk: rolleHandwerk, wissen: rolleWissen,
  sakral: rolleSakral, wehr: rolleWehr,
  herrschaft: rolleHerrschaft, infrastruktur: rolleInfrastruktur
};

var VEREDLER = {
  mondelfen: mondelfen,
  tiefenzwerge: tiefenzwerge,
  windweiden: windweiden,
  kupfernomaden: kupfernomaden,
  korallenhoefe: korallenhoefe,
  pilzmarken: pilzmarken,
  wolkenkloster: wolkenkloster,
  wurzelbund: wurzelbund,
  kristallorden: kristallorden,
  schilfinseln: schilfinseln,
  sternensteppe: sternensteppe,
  drachenbasalt: drachenbasalt
};

/**
 * Haengt kulturtypische Boden-, Erschliessungs- und Storydetails an `parts`.
 * Das identische Array wird fuer direktes Chaining zurueckgegeben.
 */
export function veredleArchitektur(parts, stil, variante, farben, masse) {
  if (!Array.isArray(parts)) throw new TypeError("Architektur-parts muss ein Array sein");
  var k = kontext(stil, variante, farben, masse);
  VEREDLER[stil.id](parts, k);
  ROLLEN_VEREDLER[k.gruppe](parts, k);
  return parts;
}

/** Fuegt den freigegebenen Waldsaeule-A-Nahpass hinzu und meldet seine Teile. */
export function gestalteArchitekturFormensprache(parts, stil, variante, farben, masse) {
  if (!Array.isArray(parts)) throw new TypeError("Architektur-parts muss ein Array sein");
  var vorher = parts.length;
  var k = kontext(stil, variante, farben, masse);
  waldsaeuleSockel(parts, k);
  waldsaeuleMaterial(parts, k);
  waldsaeuleNutzung(parts, k);
  erdanschluss(parts, k);
  if (siedlungsBau(k)) {
    schornstein(parts, k);
    requisiten(parts, k);
  }
  return parts.length - vorher;
}
