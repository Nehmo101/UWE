// Einzigartige, animierte Landmarke: eine gewaltige Landschildkroete mit
// einer bewohnten Burg auf dem Panzer. Anders als die kleinen Pool-Objekte
// bleibt sie ein Element-eigenes Mesh-Ensemble, damit der Kopf langsam und
// unabhaengig vom Koerper bewegt werden kann.
import * as THREE from 'three';
import { DEG, clamp, hashi } from '../core/rng.js';
import { groupOf } from '../core/store.js';
import { heightAt } from '../world/terrain.js';
import { terraMat, tintedMats } from '../render/materials.js';
import { M, mergeGeos, part, prismGeo } from '../assets/geometrie-hilfen.js';
import { baueWeltschildkroetenKopf } from './weltschildkroete-kopf.js';
import { landmarkenBereich, landmarkenSkala } from './landmarken-bereich.js';
import { landmarkenLicht, landmarkenLichtFrei } from './landmarken-licht.js';
import { externesAsset } from '../assets/external-assets.js';

const BX = THREE.BoxGeometry;
const CY = THREE.CylinderGeometry;
const CO = THREE.ConeGeometry;
const SP = THREE.SphereGeometry;
const IC = THREE.IcosahedronGeometry;
const TO = THREE.TorusGeometry;
const PL = THREE.PlaneGeometry;

const HAUT = 0x625f4e;
const HAUT_HELL = 0x8b8167;
const HAUT_DUNKEL = 0x343b32;
const PANZER = 0x39483c;
const PANZER_DUNKEL = 0x202b27;
const MOOS = 0x526442;
const PUTZ = 0x666963;
const PUTZ_SCHATTEN = 0x3d4341;
const DACH = 0x4b3d38;
const DACH_DUNKEL = 0x292f31;
const HOLZ = 0x4b392d;
const KUPFER = 0x486f65;
const LICHT = 0xffc66b;
const TUCH_GOLD = 0xa87b3f;
const TUCH_BLAU = 0x4f6b73;
const BLUETE = 0x8f5d55;
const STEIN_KANTE = 0x858278;

const koerperMat = terraMat({
  vertexColors: true,
  familie: 'laub',
  side: THREE.FrontSide
});
const kopfMat = terraMat({ vertexColors: true, familie: 'putz' });
const lichtMat = terraMat({
  vertexColors: true,
  familie: 'putz',
  emissive: LICHT
});
const akzentMat = terraMat({
  vertexColors: true,
  familie: 'putz',
  side: THREE.DoubleSide
});
lichtMat.emissiveIntensity = 2.4;
tintedMats.push(koerperMat, kopfMat, lichtMat, akzentMat);

function kugel(rx, ry, rz, x, y, z, farbe, segmente) {
  return part(
    new SP(1, segmente || 16, Math.max(8, Math.round((segmente || 16) * 0.55))),
    M(x, y, z, 0, 0, 0, rx, ry, rz),
    farbe
  );
}

function facette(rx, ry, rz, x, y, z, farbe, detail) {
  var geo = new IC(1, detail === undefined ? 1 : detail);
  geo.computeVertexNormals();
  return part(geo, M(x, y, z, 0, 0, 0, rx, ry, rz), farbe);
}

function zylinder(r0, r1, h, x, y, z, farbe, segmente, rx, ry, rz) {
  return part(
    new CY(r0, r1, h, segmente || 10),
    M(x, y, z, rx || 0, ry || 0, rz || 0),
    farbe
  );
}

function turm(parts, x, z, r, h, dachFarbe, basisY, abschluss) {
  var unten = basisY === undefined ? 6.7 : basisY;
  parts.push(zylinder(r * 1.05, r, h, x, unten + h * 0.5, z, PUTZ, 8));
  parts.push(zylinder(r * 1.16, r * 1.16, 0.3, x, unten + h, z, PUTZ_SCHATTEN, 8));
  if (abschluss === 'zinnen') {
    parts.push(part(new BX(r * 2.25, 0.34, r * 2.25),
      M(x, unten + h + 0.2, z), PUTZ_SCHATTEN));
    for (var j = 0; j < 4; j++) {
      var za = j / 4 * Math.PI * 2;
      parts.push(part(new BX(r * 0.52, r * 0.64, r * 0.52),
        M(x + Math.cos(za) * r * 0.82, unten + h + r * 0.5,
          z + Math.sin(za) * r * 0.82), PUTZ));
    }
  } else if (abschluss === 'giebel') {
    parts.push(part(prismGeo(r * 2.45, r * 0.9, r * 2.1),
      M(x, unten + h + 0.1, z, 0, Math.PI / 2, 0), dachFarbe));
  } else {
    parts.push(part(new CO(r * 1.32, r * 1.8, 6),
      M(x, unten + h + r * 0.92, z), dachFarbe));
  }
  parts.push(part(new BX(r * 0.42, h * 0.68, r * 0.5),
    M(x - r * 0.88, unten + h * 0.34, z), PUTZ_SCHATTEN));
  parts.push(part(new BX(r * 0.42, h * 0.68, r * 0.5),
    M(x + r * 0.88, unten + h * 0.34, z), PUTZ_SCHATTEN));
  parts.push(zylinder(0.05, 0.05, r * 1.45, x, unten + h + r * 2.45, z, HOLZ, 5));
}
function fenster(parts, x, y, z, sx, sy, yaw) {
  parts.push(part(new PL(sx, sy), M(x, y, z, 0, yaw || 0, 0), LICHT));
}

function baueKoerperGeometrie() {
  var p = [], i;
  // Breiter, tief gelagerter Saurierkoerper und grob facettierter Carapax.
  // Die Festung sitzt in der tragenden Panzerwoelbung, nicht auf einer Kugel.
  p.push(facette(7.4, 2.4, 8.15, 0, 5.2, -0.15, HAUT_DUNKEL, 1));
  p.push(facette(8.15, 5.15, 9.15, 0, 7.35, -0.45, PANZER, 1));
  // Der fruehere dunkle Randtorus („Schwimmring") ist bewusst weg — die 18
  // ueberlappenden Randplatten unten zeichnen die Panzerkante allein, ohne
  // dass ein aufgeblasener schwarzer Ring die Silhouette umlaeuft.

  // Flache Schildplatten folgen der steilen Woelbung statt eine Wiese zu
  // bilden. Der mittlere Kranz laesst genug Panzer zwischen den Mauern sehen.
  p.push(zylinder(1.78, 2.04, 0.26, 0, 12.55, -0.45, 0x4d5a45, 6));
  for (i = 0; i < 8; i++) {
    var a = i / 8 * Math.PI * 2;
    var sx = Math.cos(a) * 5.35;
    var sz = -0.45 + Math.sin(a) * 6.0;
    var norm = sx * sx / (8.15 * 8.15) + (sz + 0.45) * (sz + 0.45) / (9.15 * 9.15);
    var sy = 7.35 + 5.15 * Math.sqrt(Math.max(0.08, 1 - norm)) + 0.12;
    p.push(zylinder(1.52, 1.78, 0.24, sx, sy, sz,
      i % 3 === 0 ? 0x526442 : (i % 2 ? 0x45523f : 0x344139), 6, 0, a * 0.16, 0));
    p.push(part(new IC(1, 0), M(sx * 1.24, sy - 1.18, -0.45 + (sz + 0.45) * 1.18,
      0, -a, 0, 0.88, 0.26, 1.25), i % 2 ? 0x4b5747 : PANZER_DUNKEL));
  }
  for (i = 0; i < 4; i++) {
    var ia = i / 4 * Math.PI * 2 + 0.42;
    var ix = Math.cos(ia) * 3.15;
    var iz = -0.4 + Math.sin(ia) * 3.45;
    var inorm = ix * ix / (8.15 * 8.15) + (iz + 0.45) * (iz + 0.45) / (9.15 * 9.15);
    var iy = 7.35 + 5.15 * Math.sqrt(Math.max(0.08, 1 - inorm)) + 0.12;
    p.push(zylinder(1.15, 1.38, 0.2, ix, iy, iz,
      i % 2 ? 0x45523f : 0x344139, 6, 0, -ia * 0.12, 0));
  }
  // Achtzehn ueberlappende Randplatten ersetzen den weichen Mooskranz.
  for (i = 0; i < 18; i++) {
    var ra = i / 18 * Math.PI * 2 + 0.1;
    var rw = 0.72 + (i % 3) * 0.09;
    var rx = Math.cos(ra) * 7.55;
    var rz = -0.45 + Math.sin(ra) * 8.35;
    p.push(part(new IC(1, 0), M(rx, 7.86 + Math.sin(ra * 2) * 0.1, rz,
      0, -ra, 0, rw, 0.34, rw * 0.92), i % 3 ? PANZER_DUNKEL : 0x485542));
    if (i % 3 === 1) {
      p.push(part(new CO(0.22, 0.76 + (i % 2) * 0.2, 5),
        M(rx, 7.28, rz, 0, 0, Math.sin(ra) * 0.24), 0x303a32));
    }
  }

  // Vier saurierhaft schwere Gliedmassen: gepanzerte Schulter, breite Fessel,
  // flacher Lastfuss und lange Krallen bilden eine klar lesbare Silhouette.
  var beine = [
    [-6.15, 5.2, 5.65, -0.06, 1], [6.15, 5.16, 5.5, 0.06, 1],
    [-6.8, 5.0, -6.7, 0.08, -1], [6.8, 5.06, -6.82, -0.08, -1]
  ];
  for (i = 0; i < beine.length; i++) {
    var b = beine[i];
    var fussVor = b[4];
    var hinten = i >= 2;
    var erde = hinten ? HAUT_DUNKEL : HAUT;
    var unterschenkel = hinten ? 0x555447 : 0x666250;
    var gelenk = hinten ? 0x77705b : HAUT_HELL;
    var schulterBreite = hinten ? 2.55 : 2.35;
    var schulterTiefe = hinten ? 2.55 : 2.35;
    p.push(facette(schulterBreite, 2.5, schulterTiefe,
      b[0], b[1], b[2] - fussVor * 0.12, erde, 1));
    p.push(zylinder(1.28, 1.75, 3.9,
      b[0], 3.0, b[2] + fussVor * 0.32, unterschenkel, 6, 0, 0, b[3]));
    p.push(facette(1.5, 1.1, 1.45,
      b[0], 1.22, b[2] + fussVor * 0.54, gelenk, 0));
    p.push(facette(2.05, 0.72, 1.82,
      b[0], 0.54, b[2] + fussVor * 1.2, HAUT_HELL, 0));
    for (var k = -1; k <= 1; k++) {
      var zehenX = b[0] + k * 0.68;
      var zehenZ = b[2] + fussVor * (2.35 + (k === 0 ? 0.18 : 0));
      p.push(part(new BX(0.62, 0.38, 1.08),
        M(zehenX, 0.4, zehenZ, 0, b[3] * 0.3 + k * 0.12, 0),
        k === 0 ? 0x44483d : 0x555648));
      p.push(part(new CO(0.24, 0.82, 5),
        M(zehenX, 0.36, zehenZ + fussVor * 0.76,
          fussVor * Math.PI / 2, 0, 0), 0xc8b990));
    }
    for (var s = 0; s < 4; s++) {
      p.push(facette(0.65, 0.34, 0.2,
        b[0] + (s % 2 ? 0.42 : -0.4), 1.86 + s * 0.62,
        b[2] + fussVor * 1.58, PANZER_DUNKEL, 0));
    }
    var aussen = b[0] < 0 ? -1 : 1;
    p.push(facette(0.8, 0.46, 0.32, b[0] + aussen * 1.55, b[1] + 0.42,
      b[2] - fussVor * 0.22, PANZER_DUNKEL, 0));
    p.push(facette(1.08, 0.5, 0.62, b[0] + aussen * 1.35, b[1] + 1.1,
      b[2] - fussVor * 0.28, i % 2 ? 0x455044 : PANZER_DUNKEL, 0));
  }
  p.push(part(new CO(1.2, 3.3, 6),
    M(0, 5.15, -9.15, -Math.PI / 2, 0, 0), HAUT_DUNKEL));
  // Gesichtsrunde: Halskragen und Brustpartie. Der Hals (eigenes Kopf-Mesh)
  // tritt bei (0, 4.75, 7.15) aus dem Koerper — eine weiche Hautfalte um die
  // Austrittsstelle und eine helle Brustplatte darunter verzahnen ihn mit dem
  // Rumpf, statt ihn aufgesteckt wirken zu lassen.
  p.push(part(new TO(2.55, 0.62, 8, 16),
    M(0, 4.85, 6.7, -0.5, 0, 0, 1.06, 1, 0.92), HAUT));
  p.push(part(new TO(2.9, 0.45, 7, 14),
    M(0, 4.35, 6.15, -0.44, 0, 0, 1.1, 1, 0.9), HAUT_DUNKEL));
  p.push(facette(3.1, 1.5, 1.7, 0, 3.35, 6.15, HAUT_HELL, 1));
  p.push(facette(2.2, 1.05, 1.15, 0, 2.35, 6.9, 0x77705b, 0));
  // Dunkle, gestufte Felsterrassen verzahnen die Burg mit dem Carapax.
  // Polygonale Steinlagen lesen sich wie Last tragendes Mauerwerk.
  p.push(zylinder(6.15, 6.45, 0.42, 0, 10.9, -0.45, 0x35433a, 12));
  p.push(zylinder(5.8, 6.1, 0.58, 0, 11.35, -0.45, PUTZ_SCHATTEN, 12));
  p.push(zylinder(5.45, 5.85, 1.35, 0, 12.05, -0.45, PUTZ_SCHATTEN, 12));
  for (i = 0; i < 8; i++) {
    var strebenWinkel = i / 8 * Math.PI * 2 + 0.2;
    p.push(part(prismGeo(1.05 + (i % 2) * 0.16, 2.35 + (i % 3) * 0.18, 1.45),
      M(Math.cos(strebenWinkel) * 5.72, 9.35,
        -0.45 + Math.sin(strebenWinkel) * 5.1, 0, -strebenWinkel, 0),
      i % 2 ? PUTZ_SCHATTEN : STEIN_KANTE));
  }
  for (i = 0; i < 12; i++) {
    var ba = i / 12 * Math.PI * 2 + 0.08;
    var boulderX = Math.cos(ba) * 6.0;
    var boulderZ = -0.45 + Math.sin(ba) * 5.1;
    p.push(facette(0.66 + (i % 3) * 0.09, 0.38 + (i % 2) * 0.08, 0.58,
      boulderX, 11.28 + (i % 3) * 0.1, boulderZ,
      i % 4 === 0 ? MOOS : PUTZ_SCHATTEN, 0));
  }
  // Breite, gebrochene Frontschuerze: alte Steine reichen bis zur Treppe.
  var frontSockel = [
    [-4.55, 4.05, 0.94], [-3.48, 4.72, 1.08], [-2.35, 5.22, 0.96],
    [-1.18, 5.62, 1.05], [0, 5.92, 1.12], [1.22, 5.58, 0.94],
    [2.42, 5.18, 1.07], [3.52, 4.68, 0.98], [4.55, 4.02, 0.92]
  ];
  for (i = 0; i < frontSockel.length; i++) {
    var fs = frontSockel[i];
    p.push(facette(0.78 * fs[2], 0.34 + (i % 2) * 0.07, 0.7 * fs[2],
      fs[0], 10.91 + (i % 3) * 0.08, fs[1],
      i % 3 === 1 ? MOOS : PUTZ_SCHATTEN, 0));
  }
  for (i = 0; i < 14; i++) {
    var wa = i / 14 * Math.PI * 2;
    var wallX = Math.cos(wa) * 4.95;
    var wallZ = -0.4 + Math.sin(wa) * 4.35;
    p.push(part(new BX(1.45, 1.55, 0.5),
      M(wallX, 12.55, wallZ, 0, -wa, 0), i % 3 ? PUTZ : PUTZ_SCHATTEN));
    p.push(part(new BX(0.4, 0.58, 0.64),
      M(Math.cos(wa) * 5.03, 13.62, -0.4 + Math.sin(wa) * 4.43,
        0, -wa, 0), PUTZ));
    if (i % 2 === 0) {
      p.push(part(new BX(0.58, 1.75, 0.82),
        M(wallX, 11.78, wallZ, 0, -wa, Math.sin(wa) * 0.08),
        i % 4 ? PUTZ_SCHATTEN : MOOS));
    }
  }

  // Drei ineinander verzahnte Steinmassen steigen zu einem asymmetrischen
  // Bergfried auf. Rote Daechern halten die Terra-Maerchensprache lebendig.
  p.push(part(new BX(5.4, 5.4, 4.4), M(-0.6, 15.0, -0.35), PUTZ));
  p.push(part(prismGeo(5.8, 1.55, 4.8), M(-0.6, 17.72, -0.35, 0, Math.PI / 2, 0), DACH));
  p.push(part(new BX(3.35, 8.8, 3.1), M(0.85, 17.38, -0.7), PUTZ_SCHATTEN));
  p.push(part(prismGeo(3.7, 1.55, 3.5), M(0.85, 21.8, -0.7), DACH_DUNKEL));
  p.push(zylinder(0.05, 0.05, 1.8, 0.85, 23.55, -0.7, HOLZ, 5));
  p.push(part(new BX(2.8, 5.2, 2.65), M(-3.15, 14.45, 0.7, 0, -0.14, 0), PUTZ));
  p.push(part(prismGeo(3.15, 1.15, 2.95), M(-3.15, 17.07, 0.7, 0, -0.14, 0), DACH));
  for (i = 0; i < 4; i++) {
    p.push(part(new BX(3.5, 0.18, 3.2), M(0.85, 14.15 + i * 1.85, -0.7),
      i % 2 ? PUTZ : PUTZ_SCHATTEN));
  }
  p.push(part(new BX(0.42, 2.0, 0.46), M(-1.7, 19.0, -0.95, 0, 0, -0.04), PUTZ));
  p.push(part(new CO(0.42, 0.7, 6), M(-1.7, 20.35, -0.95), DACH_DUNKEL));
  p.push(part(new BX(0.36, 1.55, 0.4), M(2.15, 18.8, 0.6, 0, 0, 0.05), PUTZ));
  p.push(part(new CO(0.38, 0.62, 6), M(2.15, 19.9, 0.6), DACH));

  turm(p, -3.65, -3.0, 1.05, 7.0, DACH, 11.2, 'zinnen');
  turm(p, 3.55, -2.8, 1.18, 8.8, DACH_DUNKEL, 11.1, 'giebel');
  turm(p, -3.9, 2.7, 0.95, 6.2, DACH_DUNKEL, 11.3);
  turm(p, 3.5, 2.8, 1.0, 7.4, DACH, 11.15);

  // Tor, Treppenruecken und zwei steinerne Seitenbruecken wachsen aus dem
  // Schildrand; dadurch sitzt die Festung optisch nicht auf einer Platte.
  p.push(part(new TO(0.9, 0.2, 6, 12, Math.PI), M(0, 13.0, 2.24, 0, 0, 0), HOLZ));
  p.push(part(new BX(3.5, 0.32, 1.4), M(-0.45, 15.3, 2.15), PUTZ_SCHATTEN));
  for (i = -1; i <= 1; i++) {
    p.push(part(new BX(0.2, 0.8, 0.2), M(-0.45 + i * 1.35, 15.7, 2.72), PUTZ));
  }
  p.push(part(new BX(2.3, 0.32, 1.0), M(2.55, 13.7, -1.9, 0, -0.26, 0), PUTZ_SCHATTEN));
  p.push(part(new BX(2.4, 0.3, 0.95), M(-2.6, 13.5, -2.05, 0, 0.22, 0), PUTZ_SCHATTEN));
  for (i = 0; i < 9; i++) {
    var stufenY = 12.45 - i * 0.17;
    var stufenZ = 2.75 + i * 0.43;
    var stufenW = 1.7 + i * 0.18;
    p.push(part(new BX(stufenW, 0.18, 0.52),
      M(0, stufenY, stufenZ), i % 2 ? PUTZ_SCHATTEN : PUTZ));
    if (i % 2 === 0) {
      var randX = stufenW * 0.53;
      p.push(part(new BX(0.14, 0.78, 0.14), M(-randX, stufenY + 0.38, stufenZ), HOLZ));
      p.push(part(new BX(0.14, 0.78, 0.14), M(randX, stufenY + 0.38, stufenZ), HOLZ));
      p.push(part(new CO(0.18, 0.3, 5), M(-randX, stufenY + 0.88, stufenZ), KUPFER));
      p.push(part(new CO(0.18, 0.3, 5), M(randX, stufenY + 0.88, stufenZ), KUPFER));
    }
  }

  // Wenige dunkle, windgezeichnete Burgbaeume statt runder Ziergartenkugeln.
  var burgBaeume = [
    [-4.35, 12.55, 1.3, 1.15],
    [3.95, 12.7, 1.45, 1.0],
    [-1.7, 17.4, -1.95, 0.82]
  ];
  for (i = 0; i < burgBaeume.length; i++) {
    var bt = burgBaeume[i];
    p.push(zylinder(0.16 * bt[3], 0.3 * bt[3], 2.7 * bt[3],
      bt[0], bt[1] + 1.25 * bt[3], bt[2], HOLZ, 6));
    p.push(facette(1.08 * bt[3], 1.3 * bt[3], 1.0 * bt[3],
      bt[0], bt[1] + 2.75 * bt[3], bt[2], 0x3d5140, 0));
    p.push(facette(0.7 * bt[3], 0.9 * bt[3], 0.68 * bt[3],
      bt[0] - 0.7 * bt[3], bt[1] + 2.5 * bt[3], bt[2] + 0.18,
      i % 2 ? 0x4b6248 : 0x34483b, 0));
  }
  for (i = 0; i < 10; i++) {
    var ma = i / 10 * Math.PI * 2 + 0.16;
    var gx = Math.cos(ma) * 4.35;
    var gz = -0.4 + Math.sin(ma) * 3.75;
    p.push(facette(0.42 + (i % 2) * 0.1, 0.5, 0.38,
      gx, 13.05, gz, i % 3 ? MOOS : 0x475344, 0));
  }
  // Die Stoffdetails liegen in einer eigenen, gemeinsam animierten Geometrie.
  // Die Fahnenstangen selbst bleiben als Teil der Tuerme unbewegt.
  return mergeGeos(p);
}

function baueLichtGeometrie() {
  var p = [];
  for (var i = 0; i < 6; i++) {
    var a = i / 6 * Math.PI * 2 + 0.22;
    p.push(kugel(0.22, 0.22, 0.22,
      Math.cos(a) * 4.55, 13.8, -0.4 + Math.sin(a) * 3.9,
      LICHT, 8));
  }
  // Fenster staffeln die Festungsmasse vom Mauerring bis zum Bergfried.
  for (i = -1; i <= 1; i++) {
    fenster(p, -0.55 + i * 1.6, 14.6, 1.87, 0.5, 0.72, 0);
    fenster(p, -0.55 + i * 1.6, 16.35, 1.87, 0.46, 0.68, 0);
  }
  fenster(p, 0.25, 17.3, 0.87, 0.48, 0.76, 0);
  fenster(p, 1.45, 19.0, 0.87, 0.48, 0.76, 0);
  fenster(p, 0.25, 20.55, 0.87, 0.42, 0.66, 0);
  fenster(p, -3.15, 14.4, 2.04, 0.42, 0.68, -0.14);
  fenster(p, -3.15, 15.9, 2.04, 0.42, 0.68, -0.14);
  fenster(p, -3.65, 15.1, -1.9, 0.4, 0.62, 0);
  fenster(p, -3.65, 17.0, -1.9, 0.4, 0.62, 0);
  fenster(p, 3.55, 15.5, -1.56, 0.42, 0.66, 0);
  fenster(p, 3.55, 18.3, -1.56, 0.42, 0.66, 0);
  fenster(p, -3.9, 15.2, 3.7, 0.38, 0.58, Math.PI);
  fenster(p, 3.5, 16.1, 3.86, 0.4, 0.6, Math.PI);
  for (var j = 0; j < 9; j += 2) {
    var ly = 12.45 - j * 0.17 + 0.9;
    var lz = 2.75 + j * 0.43;
    var lw = (1.7 + j * 0.18) * 0.53;
    p.push(kugel(0.17, 0.2, 0.17, -lw, ly, lz, LICHT, 8));
    p.push(kugel(0.17, 0.2, 0.17, lw, ly, lz, LICHT, 8));
  }
  return mergeGeos(p);
}
function baueAkzentGeometrie() {
  var p = [];
  // Alle Stoffteile der hohen Festung bleiben in einem einzigen Draw Call.
  var fahnen = [
    [-3.65, 20.95, -3.0, TUCH_GOLD, 1],
    [3.55, 23.0, -2.8, TUCH_BLAU, -1],
    [0.85, 23.85, -0.7, BLUETE, 1]
  ];
  for (var i = 0; i < fahnen.length; i++) {
    var f = fahnen[i];
    p.push(part(new PL(0.95, 1.12),
      M(f[0], f[1], f[2] + f[4] * 0.36, 0, Math.PI / 2, f[4] * 0.14), f[3]));
    p.push(part(new PL(0.62, 0.5),
      M(f[0], f[1] - 0.27, f[2] + f[4] * 0.92, 0, Math.PI / 2, -f[4] * 0.22), f[3]));
  }
  // Wimpel und lange Mauerbanner machen die enorme Hoehe ablesbar.
  for (i = 0; i < 7; i++) {
    p.push(part(new CO(0.19, 0.46, 3),
      M(-1.7 + i * 0.56, 17.25 - Math.sin(i * 0.52) * 0.22, 2.83,
        0, 0, Math.PI), i % 2 ? TUCH_GOLD : TUCH_BLAU));
  }
  p.push(part(new PL(0.78, 1.8), M(-1.45, 14.65, 1.9, 0, 0, -0.04), TUCH_BLAU));
  p.push(part(new PL(0.78, 1.8), M(0.55, 14.65, 1.9, 0, 0, 0.04), TUCH_GOLD));
  return mergeGeos(p);
}
const BASIS_KOERPER = baueKoerperGeometrie();
const BASIS_KOPF = baueWeltschildkroetenKopf();
const BASIS_LICHT = baueLichtGeometrie();
const BASIS_AKZENTE = baueAkzentGeometrie();
BASIS_KOERPER.userData.terraAnatomie = 'landschildkroete';
BASIS_KOERPER.userData.terraBeine = 4;
BASIS_KOERPER.userData.terraZehenProBein = 3;
BASIS_KOERPER.userData.terraFrontSockelBreite = 9.1;
BASIS_KOERPER.userData.terraHinterbeinSpur = 13.6;
BASIS_KOERPER.userData.terraPanzerplatten = 13;
BASIS_KOERPER.userData.terraPanzerFlankenFaktor = 0.91;
BASIS_KOERPER.userData.terraBeinSchuppen = 'facettierte-polyeder';
BASIS_KOERPER.userData.terraFussplattenKontrast = true;
BASIS_KOERPER.userData.terraKrallenFarbe = 'elfenbein';
BASIS_KOERPER.userData.terraBurgStrebepfeiler = 15;
BASIS_KOERPER.userData.terraBurgAbschluesse = 'zinnen-giebel';
BASIS_KOERPER.userData.terraArtDirection = 'alt-kantig';
BASIS_KOERPER.userData.terraKoerperProfil = 'saurier-schwer';
BASIS_KOERPER.userData.terraPanzerRandplatten = 18;
BASIS_KOERPER.userData.terraBurgMaterial = 'dunkler-verwitterter-stein';
BASIS_KOERPER.userData.terraPanzerFlankenplatten = 8;
BASIS_KOERPER.userData.terraBurgPanzerstreben = 8;
BASIS_KOERPER.userData.terraMaterialTrennung = 'haut-panzer-basalt-schiefer-metall';
BASIS_KOERPER.userData.terraHalsKragen = 'doppelte-hautfalte';
BASIS_KOERPER.userData.terraBrustplatte = true;
var koepfe = [];

function setzeTransform(mesh, x, y, z, yaw, groesse) {
  mesh.position.set(x, y, z);
  mesh.rotation.set(0, yaw, 0);
  mesh.scale.setScalar(groesse);
  mesh.userData.terraBasisSkala = groesse;
}

/** Erzeugt eine Landmarke je Klickpunkt. */
function genWeltschildkroete(el) {
  var p = el.params || {};
  var bereich = landmarkenBereich(p);
  var groesse = landmarkenSkala(p, 0.55, 2.2);
  var yaw = (Number(p.drehung) || 0) * DEG;
  var amplitude = clamp(Number(p.kopfbewegung), 0, 1);
  if (!Number.isFinite(amplitude)) amplitude = 0.65;
  var gruppe = groupOf(el);
  // Der Schein kommt aus dem festen Lichtpool (landmarken-licht.js) — ein
  // Neuaufbau beginnt mit der Freigabe der alten Zuteilung, damit die
  // Lichtzahl in der Szene niemals schwankt (sonst Compile-Stillstand).
  landmarkenLichtFrei(el);

  for (var i = 0; i < el.points.length; i++) {
    var pt = el.points[i];
    var boden = heightAt(pt.x, pt.z);
    var koerper = new THREE.Mesh(BASIS_KOERPER.clone(), koerperMat);
    setzeTransform(koerper, pt.x, boden, pt.z, yaw, groesse);
    koerper.castShadow = true;
    koerper.receiveShadow = true;
    koerper.userData.el = el;
    koerper.userData.terraBereich = bereich.id;
    gruppe.add(koerper);

    var vorX = Math.sin(yaw), vorZ = Math.cos(yaw);
    var kopf = externesAsset('weltschildkroete') || new THREE.Mesh(BASIS_KOPF.clone(), kopfMat);
    setzeTransform(kopf,
      pt.x + vorX * 7.15 * groesse,
      boden + 4.75 * groesse,
      pt.z + vorZ * 7.15 * groesse,
      yaw,
      groesse);
    kopf.castShadow = true;
    kopf.receiveShadow = true;
    kopf.userData.el = el;
    kopf.userData.terraWeltschildkroetenKopf = true;
    gruppe.add(kopf);

    var licht = new THREE.Mesh(BASIS_LICHT.clone(), lichtMat);
    setzeTransform(licht, pt.x, boden, pt.z, yaw, groesse);
    licht.renderOrder = 3;
    licht.userData.el = el;
    gruppe.add(licht);

    var akzente = new THREE.Mesh(BASIS_AKZENTE.clone(), akzentMat);
    setzeTransform(akzente, pt.x, boden, pt.z, yaw, groesse);
    akzente.castShadow = true;
    akzente.userData.el = el;
    akzente.userData.terraWeltschildkroetenAkzente = true;
    gruppe.add(akzente);

    // Pool-Licht statt eigenem PointLight: kein Hinzufuegen/Entfernen von
    // Lichtern zur Laufzeit. null = Pool erschoepft, die Schildkroete steht
    // dann ohne Schein da statt die Lichtzahl umzuwerfen.
    var schein = landmarkenLicht(el);
    if (schein) {
      schein.color.setHex(LICHT);
      schein.distance = 24 * groesse;
      schein.decay = 2;
      schein.position.set(pt.x, boden + 18.2 * groesse, pt.z);
      schein.intensity = 8.5 * groesse;
    }

    kopf.userData.terraAnimation = {
      yaw: yaw,
      phase: hashi(el.seed, i, 8147) * Math.PI * 2,
      amplitude: amplitude,
      groesse: groesse,
      akzentY: boden,
      akzente: akzente,
      schein: schein
    };
    koepfe.push(kopf);
  }
}

function reduzierteBewegung() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  if (typeof document !== 'undefined' && document.documentElement &&
      document.documentElement.getAttribute('data-uwe-motion') === 'off') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Ein einziger, sehr ruhiger Takt fuer alle Schildkroetenkoepfe. */
function tickWeltschildkroeten(zeit) {
  var ruhig = reduzierteBewegung();
  for (var i = koepfe.length - 1; i >= 0; i--) {
    var kopf = koepfe[i];
    if (!kopf.parent) { koepfe.splice(i, 1); continue; }
    var a = kopf.userData.terraAnimation;
    if (!a) continue;
    var amp = ruhig ? 0 : a.amplitude;
    // Zwei lange Perioden verhindern die mechanische Pendelbewegung einer
    // einzelnen Sinuskurve. Maximal etwa fuenf Grad Gier, zwei Grad Nicken.
    var gier = (Math.sin(zeit * 0.145 + a.phase) * 0.068
      + Math.sin(zeit * 0.057 + a.phase * 0.73) * 0.026) * amp;
    var nick = Math.sin(zeit * 0.091 + a.phase * 1.31) * 0.032 * amp;
    var atem = Math.sin(zeit * 0.052 + a.phase * 0.41) * amp;
    kopf.rotation.y = a.yaw + gier;
    kopf.rotation.x = nick;
    kopf.rotation.z = atem * 0.009;

    // Die zusammengefassten Stoffteile reagieren auf denselben Wind, aber
    // mit einer zweiten Frequenz. So bleibt es ein Draw Call ohne Stillstand.
    var stoff = a.akzente;
    if (stoff && stoff.parent) {
      var wind = (Math.sin(zeit * 0.72 + a.phase * 0.37) * 0.65
        + Math.sin(zeit * 1.21 + a.phase) * 0.35) * amp;
      stoff.rotation.y = a.yaw + wind * 0.004;
      stoff.rotation.z = wind * 0.014;
      stoff.position.y = a.akzentY + wind * 0.025 * a.groesse;
      stoff.scale.set(a.groesse * (1 + wind * 0.006), a.groesse, a.groesse);
    }
    if (a.schein && a.schein.parent) {
      var glimmen = ruhig ? 1 : 1 + Math.sin(zeit * 1.7 + a.phase) * 0.035;
      a.schein.intensity = 8.5 * a.groesse * glimmen;
    }
  }
}

export {
  genWeltschildkroete,
  tickWeltschildkroeten,
  BASIS_KOERPER,
  BASIS_KOPF,
  BASIS_LICHT,
  BASIS_AKZENTE
};
