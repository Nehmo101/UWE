/**
 * Kulturtypische Fassadenrahmen fuer die prozedurale Architektur.
 *
 * Das Modul erzeugt nur gefaerbte BufferGeometry-Teile. Es darf deshalb direkt
 * vor `mergeGeos(parts)` laufen. Die bestehende generische Fensterbeleuchtung
 * bleibt sichtbar; diese Schicht setzt davor charakteristische Laibungen,
 * Sprossen, Portale und bewusst unregelmaessige Nebenzeichen.
 */
import * as THREE from "three";
import { M, part } from "./geometrie-hilfen.js";

var PI = Math.PI, TAU = PI * 2;
var STIL_IDS = new Set([
  "mondelfen", "tiefenzwerge", "windweiden", "kupfernomaden",
  "korallenhoefe", "pilzmarken", "wolkenkloster", "wurzelbund",
  "kristallorden", "schilfinseln", "sternensteppe", "drachenbasalt"
]);

function box(parts, w, h, d, x, y, z, farbe, rx, ry, rz) {
  parts.push(part(
    new THREE.BoxGeometry(1, 1, 1),
    M(x, y, z, rx, ry, rz, w, h, d),
    farbe
  ));
}


function kegel(parts, w, h, d, x, y, z, farbe, segmente, rx, ry, rz) {
  parts.push(part(
    new THREE.ConeGeometry(0.5, 1, segmente || 6),
    M(x, y, z, rx, ry, rz, w, h, d),
    farbe
  ));
}

function kugel(parts, w, h, d, x, y, z, farbe) {
  parts.push(part(
    new THREE.SphereGeometry(0.5, 9, 6),
    M(x, y, z, 0, 0, 0, w, h, d),
    farbe
  ));
}

function torus(parts, w, h, d, x, y, z, farbe, bogen, rz) {
  parts.push(part(
    new THREE.TorusGeometry(0.5, 0.09, 4, 12, bogen === undefined ? TAU : bogen),
    M(x, y, z, 0, 0, rz, w, h, d),
    farbe
  ));
}

function kristall(parts, w, h, d, x, y, z, farbe, rz) {
  parts.push(part(
    new THREE.IcosahedronGeometry(0.5, 0),
    M(x, y, z, 0, 0, rz, w, h, d),
    farbe
  ));
}

function positiveZahl(objekt, name) {
  var wert = Number(objekt && objekt[name]);
  if (!Number.isFinite(wert) || wert <= 0) {
    throw new TypeError("Architekturfassaden-Mass " + name + " muss positiv und endlich sein");
  }
  return wert;
}

function indexZahl(objekt, name, positiv) {
  var wert = Number(objekt && objekt[name]);
  if (!Number.isInteger(wert) || wert < (positiv ? 1 : 0)) {
    throw new TypeError("Architekturfassaden-Index " + name + " ist ungueltig");
  }
  return wert;
}

function farbe(farben, palette, name, ersatz) {
  var wert = Number(farben && farben[name]);
  if (Number.isFinite(wert)) return wert;
  wert = Number(palette && palette[name]);
  return Number.isFinite(wert) ? wert : ersatz;
}

function kontext(stil, variante, farben, masse) {
  if (!stil || !STIL_IDS.has(stil.id)) {
    throw new Error("Unbekannter Architekturfassaden-Stil: " + String(stil && stil.id));
  }
  if (!variante || typeof variante.id !== "string" || typeof variante.gruppe !== "string") {
    throw new TypeError("Architekturvariante mit stabiler id und Gruppe fehlt");
  }
  var palette = stil.palette || {};
  var k = {
    stilId: stil.id,
    w: positiveZahl(masse, "w"),
    d: positiveZahl(masse, "d"),
    h: positiveZahl(masse, "h"),
    spitze: positiveZahl(masse, "spitze"),
    si: indexZahl(masse, "stilIndex", false),
    vi: indexZahl(masse, "variantenIndex", false),
    etagen: indexZahl(masse, "etagen", true),
    gruppe: variante.gruppe,
    profil: variante.profil || variante.id
  };
  k.f = {
    wand: farbe(farben, palette, "wand", 0xc8b98f),
    wandDunkel: farbe(farben, palette, "wandDunkel", 0x75654f),
    dach: farbe(farben, palette, "dach", 0x7d6c55),
    akzent: farbe(farben, palette, "akzent", 0xd5b86c),
    holz: farbe(farben, palette, "holz", 0x6f543d),
    fenster: farbe(farben, palette, "fenster", 0xa8d8c4)
  };
  k.front = k.d * 0.535;
  k.tiefe = Math.max(0.035, k.d * 0.024);
  k.seite = muster(k, 3, 2) ? 1 : -1;
  return k;
}

/** Ganzzahliger, reproduzierbarer Mischer; keine Zufalls- oder Zeitquelle. */
function muster(k, salz, modulo) {
  return (((k.si + 1) * 97 + (k.vi + 1) * 53 + salz * 31) >>> 0) % modulo;
}

function spalten(k) {
  if (k.profil === "turm" || k.profil === "wehrturm" || k.profil === "muehle") return 1;
  if (k.profil === "langhaus" || k.gruppe === "gemeinschaft" ||
      k.gruppe === "herrschaft") return 3;
  if (k.gruppe === "sakral") return k.profil === "tempel" ? 3 : 1;
  if (k.gruppe === "wissen") return k.profil === "bibliothek" ? 3 : 1;
  if (k.gruppe === "infrastruktur") return k.profil === "bruecke" ? 3 : 1;
  return 2;
}

/**
 * Gleiche Etagen ergeben gleiche Hoehen, die Rolle bestimmt die Spaltenzahl.
 * Oben wird bei mehrgeschossigen Bauten eine Oeffnung ausgelassen; ihre Seite
 * folgt stabil aus Stil und Variante und bricht die perfekte Symmetrie.
 */
function fensterRaster(k) {
  var zeilen = Math.min(3, k.etagen);
  if (k.profil === "bruecke" || k.profil === "pavillon" || k.profil === "schrein") {
    zeilen = 1;
  }
  var basisSpalten = spalten(k), punkte = [];
  for (var r = 0; r < zeilen; r++) {
    var anzahl = basisSpalten;
    if (r === zeilen - 1 && zeilen > 1 && basisSpalten > 1) anzahl--;
    var y = k.profil === "bruecke"
      ? k.h * 0.91
      : k.h * (0.34 + (r + 0.5) * 0.43 / zeilen);
    var versatz = (r % 2 ? -k.seite : k.seite) * k.w * 0.035;
    for (var i = 0; i < anzahl; i++) {
      var x = anzahl === 1 ? versatz :
        (i - (anzahl - 1) / 2) * k.w * (anzahl === 2 ? 0.34 : 0.27) + versatz;
      punkte.push({
        x: x, y: y,
        s: 1 + ((i + r + muster(k, 5, 3)) % 3 === 0 ? 0.16 : 0),
        zeile: r
      });
    }
  }
  return punkte;
}

function fensterMasse(k, p) {
  var mehr = Math.min(3, k.etagen) > 1;
  return {
    w: k.w * (k.gruppe === "wehr" ? 0.075 : 0.115) * p.s,
    h: k.h * (mehr ? 0.085 : 0.13) * p.s,
    t: Math.max(0.035, Math.min(k.w, k.h) * 0.016)
  };
}

function lichtRechteck(parts, k, p, schmal) {
  var m = fensterMasse(k, p);
  box(parts, m.w * (schmal || 0.78), m.h * 0.78, k.tiefe,
    p.x, p.y, k.front, k.f.fenster);
  return m;
}

function rechteckRahmen(parts, k, p, farbeWert, neigung) {
  var m = lichtRechteck(parts, k, p, 0.76), t = m.t;
  box(parts, m.w + t, t, k.tiefe * 1.45, p.x, p.y + m.h * 0.5, k.front + k.tiefe * 0.2,
    farbeWert, 0, 0, neigung);
  box(parts, m.w + t, t, k.tiefe * 1.45, p.x, p.y - m.h * 0.5, k.front + k.tiefe * 0.2,
    farbeWert, 0, 0, -neigung);
  for (var s = -1; s <= 1; s += 2) {
    box(parts, t, m.h, k.tiefe * 1.45, p.x + s * m.w * 0.5, p.y,
      k.front + k.tiefe * 0.2, farbeWert, 0, 0, s * neigung);
  }
  return m;
}

function portal(parts, k, farbeWert, art) {
  var tw = k.w * 0.23, th = k.h * 0.35, t = Math.max(0.05, k.w * 0.025);
  var z = k.front + k.tiefe * 0.35;
  for (var s = -1; s <= 1; s += 2) {
    var hoehenDrift = s === k.seite ? k.h * 0.035 : 0;
    box(parts, t, th + hoehenDrift, k.tiefe * 1.7, s * tw * 0.52,
      (th + hoehenDrift) * 0.5, z, farbeWert, 0, 0,
      art === "schraeg" ? -s * 0.09 : 0);
  }
  if (art === "bogen") {
    torus(parts, tw * 1.16, th * 0.46, k.tiefe * 1.8, 0, th * 0.98, z,
      farbeWert, PI, 0);
  } else {
    box(parts, tw * 1.22, t, k.tiefe * 1.7, 0, th, z, farbeWert, 0, 0,
      art === "schraeg" ? k.seite * 0.08 : 0);
  }
}

function mondelfen(parts, k, fenster) {
  for (var p of fenster) {
    var m = fensterMasse(k, p);
    kugel(parts, m.w * 0.66, m.h, k.tiefe, p.x, p.y, k.front, k.f.fenster);
    torus(parts, m.w * 1.25, m.h * 1.18, k.tiefe * 1.6, p.x, p.y,
      k.front + k.tiefe * 0.2, k.f.akzent, PI * 1.48, k.seite * 0.12);
    box(parts, m.t, m.h * 0.82, k.tiefe * 1.5, p.x, p.y,
      k.front + k.tiefe * 0.3, k.f.wandDunkel, 0, 0, k.seite * 0.08);
  }
  portal(parts, k, k.f.akzent, "bogen");
}

function tiefenzwerge(parts, k, fenster) {
  for (var p of fenster) {
    var m = rechteckRahmen(parts, k, p, k.f.wandDunkel, 0);
    box(parts, m.w * 1.35, m.t * 1.6, k.tiefe * 1.7, p.x,
      p.y + m.h * 0.66, k.front + k.tiefe * 0.3, k.f.akzent);
    box(parts, m.w * 0.46, m.t, k.tiefe * 1.8, p.x + k.seite * m.w * 0.16,
      p.y, k.front + k.tiefe * 0.4, k.f.akzent, 0, 0, k.seite * 0.35);
  }
  portal(parts, k, k.f.wandDunkel, "stufe");
}

function windweiden(parts, k, fenster) {
  for (var p of fenster) {
    var m = lichtRechteck(parts, k, p, 0.74);
    for (var s = -1; s <= 1; s += 2) {
      box(parts, m.t, m.h * 1.28, k.tiefe * 1.6, p.x, p.y,
        k.front + k.tiefe * 0.25, k.f.holz, 0, 0, s * (0.42 + k.seite * 0.04));
    }
    box(parts, m.w * 1.22, m.t, k.tiefe * 1.5, p.x + k.seite * m.w * 0.12,
      p.y - m.h * 0.58, k.front, k.f.dach, 0, 0, k.seite * 0.08);
  }
  portal(parts, k, k.f.holz, "schraeg");
}

function kupfernomaden(parts, k, fenster) {
  for (var p of fenster) {
    var m = fensterMasse(k, p);
    kegel(parts, m.w, m.h * 1.28, k.tiefe, p.x, p.y, k.front,
      k.f.fenster, 3, 0, 0, 0);
    for (var s = -1; s <= 1; s += 2) {
      box(parts, m.t, m.h * 1.16, k.tiefe * 1.5,
        p.x + s * m.w * 0.27, p.y, k.front + k.tiefe * 0.25,
        k.f.akzent, 0, 0, -s * 0.38);
    }
  }
  portal(parts, k, k.f.akzent, "schraeg");
  torus(parts, k.w * 0.16, k.h * 0.15, k.tiefe * 1.5,
    k.seite * k.w * 0.34, k.h * 0.27, k.front, k.f.fenster, TAU, 0);
}

function korallenhoefe(parts, k, fenster) {
  for (var p of fenster) {
    var m = fensterMasse(k, p);
    kugel(parts, m.w, m.h * 0.86, k.tiefe, p.x, p.y, k.front, k.f.fenster);
    torus(parts, m.w * 1.3, m.h * 1.22, k.tiefe * 1.7, p.x, p.y,
      k.front + k.tiefe * 0.25, k.f.akzent, TAU, 0);
    kugel(parts, m.t * 2.3, m.t * 2.3, k.tiefe * 1.6,
      p.x + k.seite * m.w * 0.65, p.y + m.h * 0.34,
      k.front + k.tiefe * 0.3, k.f.wand);
  }
  portal(parts, k, k.f.akzent, "bogen");
}

function pilzmarken(parts, k, fenster) {
  for (var p of fenster) {
    var m = fensterMasse(k, p);
    kugel(parts, m.w, m.h * 0.78, k.tiefe, p.x, p.y, k.front, k.f.fenster);
    torus(parts, m.w * 1.3, m.h, k.tiefe * 1.6, p.x, p.y + m.h * 0.12,
      k.front + k.tiefe * 0.25, k.f.dach, PI, 0);
    for (var g = -1; g <= 1; g++) {
      box(parts, m.t * 0.7, m.h * 0.48, k.tiefe * 1.5,
        p.x + g * m.w * 0.24, p.y - m.h * 0.22,
        k.front + k.tiefe * 0.3, k.f.akzent, 0, 0, g * 0.18);
    }
  }
  portal(parts, k, k.f.holz, "bogen");
}

function wolkenkloster(parts, k, fenster) {
  for (var p of fenster) {
    var m = fensterMasse(k, p);
    kugel(parts, m.w * 0.78, m.h, k.tiefe, p.x, p.y, k.front, k.f.fenster);
    for (var s = -1; s <= 1; s += 2) {
      torus(parts, m.w * 0.82, m.h * 0.72, k.tiefe * 1.5,
        p.x + s * m.w * 0.31, p.y, k.front + k.tiefe * 0.25,
        k.f.wand, PI * 1.15, s * 0.16);
    }
    box(parts, m.t, m.h * 1.05, k.tiefe * 1.6, p.x + k.seite * m.w * 0.1,
      p.y, k.front + k.tiefe * 0.3, k.f.akzent, 0, 0, -k.seite * 0.24);
  }
  portal(parts, k, k.f.wand, "bogen");
}

function wurzelbund(parts, k, fenster) {
  for (var p of fenster) {
    var m = fensterMasse(k, p);
    kugel(parts, m.w * 0.7, m.h, k.tiefe, p.x, p.y, k.front, k.f.fenster);
    for (var s = -1; s <= 1; s += 2) {
      box(parts, m.t, m.h * 1.2, k.tiefe * 1.6,
        p.x + s * m.w * 0.38, p.y, k.front + k.tiefe * 0.25,
        k.f.holz, 0, 0, -s * (0.22 + (s === k.seite ? 0.10 : 0)));
    }
    torus(parts, m.w * 1.15, m.h * 0.72, k.tiefe * 1.5, p.x,
      p.y + m.h * 0.22, k.front, k.f.dach, PI, 0);
  }
  portal(parts, k, k.f.holz, "bogen");
}

function kristallorden(parts, k, fenster) {
  for (var p of fenster) {
    var m = fensterMasse(k, p);
    kristall(parts, m.w, m.h, k.tiefe, p.x, p.y, k.front, k.f.fenster, PI / 4);
    for (var s = -1; s <= 1; s += 2) {
      box(parts, m.t, m.h * 1.22, k.tiefe * 1.6, p.x + s * m.w * 0.38,
        p.y, k.front + k.tiefe * 0.25, k.f.akzent, 0, 0, s * PI / 4);
    }
  }
  portal(parts, k, k.f.akzent, "schraeg");
}

function schilfinseln(parts, k, fenster) {
  for (var p of fenster) {
    var m = fensterMasse(k, p);
    for (var s = -1; s <= 1; s++) {
      box(parts, m.w * 0.18, m.h, k.tiefe * 1.2,
        p.x + s * m.w * 0.29, p.y + s * m.h * 0.04,
        k.front, s ? k.f.holz : k.f.fenster, 0, 0, s * 0.035);
    }
    for (var q = -1; q <= 1; q += 2) {
      box(parts, m.w * 1.15, m.t * 0.72, k.tiefe * 1.5,
        p.x, p.y + q * m.h * 0.37, k.front + k.tiefe * 0.25,
        k.f.akzent, 0, 0, q * k.seite * 0.06);
    }
  }
  portal(parts, k, k.f.holz, "stufe");
}

function sternensteppe(parts, k, fenster) {
  for (var p of fenster) {
    var m = fensterMasse(k, p);
    kristall(parts, m.w, m.h, k.tiefe, p.x, p.y, k.front, k.f.fenster, PI / 4);
    for (var i = 0; i < 4; i++) {
      box(parts, m.t * 0.72, m.h * 1.18, k.tiefe * 1.5, p.x, p.y,
        k.front + k.tiefe * 0.25, k.f.akzent, 0, 0, i * PI / 4);
    }
  }
  portal(parts, k, k.f.akzent, "schraeg");
}

function drachenbasalt(parts, k, fenster) {
  for (var p of fenster) {
    var m = fensterMasse(k, p);
    box(parts, m.w * 0.38, m.h, k.tiefe, p.x, p.y, k.front, k.f.fenster);
    for (var s = -1; s <= 1; s += 2) {
      box(parts, m.t * 1.35, m.h * 0.72, k.tiefe * 1.7,
        p.x + s * m.w * 0.28, p.y + s * k.seite * m.h * 0.08,
        k.front + k.tiefe * 0.3, k.f.wandDunkel, 0, 0, -s * 0.44);
    }
    box(parts, m.w * 0.92, m.t * 1.2, k.tiefe * 1.7, p.x + k.seite * m.w * 0.1,
      p.y + m.h * 0.52, k.front, k.f.akzent, 0, 0, k.seite * 0.14);
  }
  portal(parts, k, k.f.wandDunkel, "schraeg");
  kegel(parts, k.w * 0.09, k.h * 0.15, k.tiefe * 1.7,
    k.seite * k.w * 0.34, k.h * 0.26, k.front, k.f.akzent, 6);
}

var GESTALTER = {
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

/** Kulturzeichen, das direkt auf einem offenen Tragteil statt auf Glas sitzt. */
function offenesZeichen(parts, k, x, y, z, s) {
  var w = k.w * s, h = k.h * s, d = k.tiefe * 1.7;
  switch (k.stilId) {
    case "mondelfen":
      torus(parts, w, h, d, x, y, z, k.f.akzent, PI * 1.48, k.seite * 0.12);
      box(parts, w * 0.09, h * 0.78, d, x, y, z, k.f.fenster); break;
    case "tiefenzwerge":
      box(parts, w * 0.18, h, d, x, y, z, k.f.wandDunkel, 0, 0, 0.16);
      box(parts, w * 0.78, h * 0.16, d, x, y, z, k.f.akzent, 0, 0, -0.28); break;
    case "windweiden":
      torus(parts, w, h * 0.72, d, x, y, z, k.f.akzent, PI * 1.42, k.seite * 0.18);
      box(parts, w * 0.10, h, d, x, y, z, k.f.holz, 0, 0, -k.seite * 0.42); break;
    case "kupfernomaden":
      torus(parts, w * 0.72, h * 0.72, d, x, y, z, k.f.akzent, TAU, 0);
      box(parts, w * 0.12, h, d, x, y, z, k.f.fenster, 0, 0, PI / 4); break;
    case "korallenhoefe":
      torus(parts, w, h * 0.78, d, x, y, z, k.f.akzent, TAU, 0);
      kugel(parts, w * 0.42, h * 0.42, d, x + k.seite * w * 0.22, y, z, k.f.fenster); break;
    case "pilzmarken":
      for (var p = -1; p <= 1; p++) kugel(parts, w * 0.34, h * 0.34, d,
        x + p * w * 0.28, y + (p & 1) * h * 0.18, z, p ? k.f.akzent : k.f.fenster);
      break;
    case "wolkenkloster":
      torus(parts, w, h * 0.70, d, x, y, z, k.f.fenster, PI * 1.34, 0);
      box(parts, w * 0.10, h, d, x + k.seite * w * 0.12, y, z,
        k.f.akzent, 0, 0, -k.seite * 0.28); break;
    case "wurzelbund":
      torus(parts, w, h * 0.82, d, x, y, z, k.f.dach, PI * 1.30, 0);
      for (var r = -1; r <= 1; r += 2) box(parts, w * 0.10, h * 0.78, d,
        x + r * w * 0.24, y, z, k.f.holz, 0, 0, -r * 0.26); break;
    case "kristallorden":
      kristall(parts, w, h, d, x, y, z, k.f.fenster, PI / 4); break;
    case "schilfinseln":
      for (var q = -1; q <= 1; q++) box(parts, w * 0.14, h, d,
        x + q * w * 0.28, y, z, q ? k.f.holz : k.f.fenster, 0, 0, q * 0.04);
      box(parts, w, h * 0.10, d, x, y, z, k.f.akzent); break;
    case "sternensteppe":
      for (var i = 0; i < 4; i++) box(parts, w * 0.10, h, d,
        x, y, z, k.f.akzent, 0, 0, i * PI / 4); break;
    case "drachenbasalt":
      kegel(parts, w * 0.58, h, d, x, y, z, k.f.akzent, 6);
      kugel(parts, w * 0.34, h * 0.32, d, x, y - h * 0.30, z, k.f.fenster); break;
  }
}

/** Verankert Kulturzeichen an realen Pfeilern, Linteln oder Gelaendern. */
function offeneFassade(parts, k) {
  if (k.profil === "bruecke") {
    for (var b = -1; b <= 1; b += 2) {
      offenesZeichen(parts, k, b * k.w * 0.29, k.h * 1.02, k.d * 0.49, 0.105);
    }
  } else if (k.profil === "halle") {
    for (var h = -1; h <= 1; h += 2) {
      offenesZeichen(parts, k, h * k.w * 0.40, k.h * 0.49, k.d * 0.43, 0.095);
    }
  } else if (k.profil === "pavillon") {
    offenesZeichen(parts, k, 0, k.h * 0.48, k.d * 0.43, 0.11);
  } else if (k.profil === "schrein") {
    box(parts, k.w * 0.78, k.h * 0.05, k.d * 0.12, 0, k.h * 0.61, 0, k.f.holz);
    offenesZeichen(parts, k, k.seite * k.w * 0.13, k.h * 0.63, k.d * 0.07, 0.105);
  } else if (k.profil === "tor") {
    for (var t = -1; t <= 1; t += 2) {
      offenesZeichen(parts, k, t * k.w * 0.36, k.h * 0.55, k.d * 0.515, 0.085);
    }
  }
}
/**
 * Fuegt der bestehenden Grundbeleuchtung eine kulturtypische Fassade hinzu.
 *
 * `masse` entspricht architektur-details.js und ergaenzt `etagen`:
 * { w, d, h, spitze, stilIndex, variantenIndex, etagen }.
 */
export function gestalteArchitekturFassade(parts, stil, variante, farben, masse) {
  if (!Array.isArray(parts)) throw new TypeError("Architektur-parts muss ein Array sein");
  var k = kontext(stil, variante, farben, masse);
  if (k.profil === "halle" || k.profil === "schrein" || k.profil === "tor" ||
      k.profil === "bruecke" || k.profil === "pavillon") {
    offeneFassade(parts, k);
    return parts;
  }
  if (k.profil === "tempel") {
    var ursprungsD = k.d;
    k = Object.assign({}, k, {
      w: k.w * 0.56, d: k.d * 0.64, h: k.h * 0.72,
      front: ursprungsD * 0.285, etagen: Math.min(2, k.etagen), profil: "haus"
    });
  }
  GESTALTER[stil.id](parts, k, fensterRaster(k));
  return parts;
}
