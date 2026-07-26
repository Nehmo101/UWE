// Heightfield-Terrain: Hoehen, Farben, Kruemmungs-AO, Korridore, Fluesse, Pinsel.
import * as THREE from 'three';
import { clamp, lerp, sstep, DEG, hashi, vnoise, fractal } from '../core/rng.js';
import { MAP, VW, HALF, WATER, S } from '../core/store.js';
import { terraMat, tintedMats } from '../render/materials.js';

var base = new Float32Array(VW * VW);   // prozedurale Höhen + Pinsel-Änderungen
var hgt = new Float32Array(VW * VW);    // base + Flusseinschnitte (Renderhöhe)

function genBase(seed) {
  for (var j = 0; j < VW; j++) {
    for (var i = 0; i < VW; i++) {
      var x = i - HALF, z = j - HALF;
      var h = fractal(x * 0.006, z * 0.006, seed) * 26 + fractal(x * 0.03, z * 0.03, seed + 77) * 4 - 6;
      // Rand weich unter den Wasserspiegel ziehen, damit die Karte keine Kante zeigt
      var d = Math.min(i, j, MAP - i, MAP - j);
      h = lerp(-22, h, sstep(0, 55, d));
      base[j * VW + i] = h;
    }
  }
}

var terrainGeo = new THREE.BufferGeometry();
(function buildTerrainGeometry() {
  var n = VW * VW;
  var pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (var j = 0; j < VW; j++) {
    for (var i = 0; i < VW; i++) {
      var k = (j * VW + i) * 3;
      pos[k] = i - HALF; pos[k + 1] = 0; pos[k + 2] = j - HALF;
      nor[k + 1] = 1; col[k] = col[k + 1] = col[k + 2] = 1;
    }
  }
  var idx = new Uint32Array(MAP * MAP * 6), o = 0;
  for (var jj = 0; jj < MAP; jj++) {
    for (var ii = 0; ii < MAP; ii++) {
      var a = jj * VW + ii, b = a + 1, c = a + VW, d = c + 1;
      idx[o++] = a; idx[o++] = c; idx[o++] = b;
      idx[o++] = b; idx[o++] = c; idx[o++] = d;
    }
  }
  terrainGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  terrainGeo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  terrainGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  terrainGeo.setIndex(new THREE.BufferAttribute(idx, 1));
})();

var terrain = new THREE.Mesh(terrainGeo, terraMat({ vertexColors: true, cloudShadow: true }));
terrain.frustumCulled = false;
tintedMats.push(terrain.material);

/** Terrain-Mesh in die Szene haengen (einmal beim Start). */
function initTerrain(scene) { scene.add(terrain); }

var C_SAND = new THREE.Color(0xdfd0ab),          // Strandsaum
    C_WIESE_KUEHL = new THREE.Color(0x8ea86a),
    C_WIESE_WARM = new THREE.Color(0xa8b877),
    C_WIESE_TROCKEN = new THREE.Color(0xbcbd8a),
    C_EARTH = new THREE.Color(0x9d8560),         // Lehmflecken
    C_ROCK = new THREE.Color(0xa9a99f),
    C_SNOW = new THREE.Color(0xf4f6f8),
    C_SEABED = new THREE.Color(0xd2c6a2),        // heller Sandgrund → türkises Flachwasser
    C_DEEP = new THREE.Color(0x1f4750),
    C_SURF = new THREE.Color(0xf2f6f4);
var COS50 = Math.cos(50 * DEG), COS58 = Math.cos(58 * DEG);
var _tc = new THREE.Color(), _tc2 = new THREE.Color();

/* --- Krümmungs-Verdeckung (D1) ---------------------------------------
   Mulden und Grabenkanten sind konkav und werden abgedunkelt, Grate
   leicht aufgehellt. Danach einmal über die Nachbarschaft glätten.    */
var aoRoh = new Float32Array(VW * VW);
var aoFeld = new Float32Array(VW * VW);
(function () { aoRoh.fill(1); aoFeld.fill(1); })();

function computeAO(i0, i1, j0, j1) {
  i0 = clamp(i0 - 1, 0, VW - 1); i1 = clamp(i1 + 1, 0, VW - 1);
  j0 = clamp(j0 - 1, 0, VW - 1); j1 = clamp(j1 + 1, 0, VW - 1);
  var i, j;
  for (j = j0; j <= j1; j++) {
    var jm = (j > 0 ? j - 1 : 0) * VW, jp = (j < VW - 1 ? j + 1 : VW - 1) * VW, jr = j * VW;
    for (i = i0; i <= i1; i++) {
      var im = i > 0 ? i - 1 : 0, ip = i < VW - 1 ? i + 1 : VW - 1;
      var mittel = (hgt[jr + im] + hgt[jr + ip] + hgt[jm + i] + hgt[jp + i] +
                    hgt[jm + im] + hgt[jm + ip] + hgt[jp + im] + hgt[jp + ip]) * 0.125;
      var d = hgt[jr + i] - mittel;                       // >0 = Grat, <0 = Mulde
      aoRoh[jr + i] = clamp(0.95 + d * 2.2, 0.72, 1.04);
    }
  }
  for (j = j0 + 1; j <= j1 - 1; j++) {
    var jr2 = j * VW;
    for (i = i0 + 1; i <= i1 - 1; i++) {
      aoFeld[jr2 + i] = (aoRoh[jr2 + i] * 4 + aoRoh[jr2 + i - 1] + aoRoh[jr2 + i + 1] +
        aoRoh[jr2 - VW + i] + aoRoh[jr2 + VW + i]) * 0.125;
    }
  }
  for (j = j0; j <= j1; j++) {                            // Ränder ohne Glättung
    for (i = i0; i <= i1; i++) {
      if (i === i0 || i === i1 || j === j0 || j === j1) aoFeld[j * VW + i] = aoRoh[j * VW + i];
    }
  }
}

/**
 * Einfärbung nach Höhe, Hangneigung und Krümmung. Drei Wiesentöne über
 * zwei Rauschoktaven, Übergänge zu Sand und Fels mit gestörter Grenze —
 * nirgends bleibt eine einfarbige Fläche stehen.
 */
function terrainColor(h, ny, x, z, out, ao) {
  var gross = fractal(x * 0.012, z * 0.012, S.worldSeed + 404);
  var fein = fractal(x * 0.052, z * 0.052, S.worldSeed + 505);
  out.copy(C_WIESE_KUEHL).lerp(C_WIESE_WARM,
    clamp(sstep(0.34, 0.72, gross) * 0.8 + sstep(1, 17, h) * 0.35, 0, 1));
  out.lerp(C_WIESE_TROCKEN, sstep(0.54, 0.86, fein) * 0.7);
  out.lerp(C_EARTH, sstep(0.68, 0.9, fractal(x * 0.055, z * 0.055, S.worldSeed + 717)) * 0.34);

  var stoer = (fractal(x * 0.09, z * 0.09, S.worldSeed + 606) - 0.5) * 1.7;
  out.lerp(C_SAND, sstep(2.3 + stoer, 0.8 + stoer, h));
  out.lerp(C_ROCK, sstep(12.6 + stoer, 14.1 + stoer, h));
  out.lerp(C_SNOW, sstep(23 + stoer, 25 + stoer, h));
  var rock = 1 - sstep(COS58, COS50, ny);                 // Steilhänge immer Fels
  if (rock > 0) out.lerp(C_ROCK, rock * 0.9);

  if (h < 0.35) {                                          // Meeresgrund
    _tc2.copy(C_SEABED).lerp(C_DEEP, sstep(-0.25, -4.5, h));
    out.lerp(_tc2, sstep(0.35, -0.4, h));
  }
  var surf = sstep(0.8, 0.3, h) * sstep(-0.6, 0.06, h);
  if (surf > 0) out.lerp(C_SURF, surf * 0.5);              // Brandungssaum

  var v = 0.94 + fractal(x * 0.16, z * 0.16, S.worldSeed + 909) * 0.08
        + vnoise(x * 0.55, z * 0.55, S.worldSeed + 313) * 0.05;
  out.multiplyScalar(v * (ao === undefined ? 1 : ao));
}

/**
 * Aktualisiert Höhe, Normale und Farbe nur im angegebenen Gitterbereich.
 * Die Upload-Range umfasst ganze Zeilen, damit sie zusammenhängend bleibt.
 */
function refreshGrid(i0, i1, j0, j1) {
  i0 = clamp(i0 | 0, 0, VW - 1); i1 = clamp(i1 | 0, 0, VW - 1);
  j0 = clamp(j0 | 0, 0, VW - 1); j1 = clamp(j1 | 0, 0, VW - 1);
  var pos = terrainGeo.attributes.position, nor = terrainGeo.attributes.normal,
      col = terrainGeo.attributes.color;
  var P = pos.array, N = nor.array, C = col.array;
  for (var j = j0; j <= j1; j++) {
    var jm = (j > 0 ? j - 1 : 0) * VW, jp = (j < VW - 1 ? j + 1 : VW - 1) * VW, jr = j * VW;
    for (var i = i0; i <= i1; i++) {
      var id = jr + i, k = id * 3;
      var h = hgt[id];
      P[k + 1] = h;
      var hl = hgt[jr + (i > 0 ? i - 1 : 0)], hrr = hgt[jr + (i < VW - 1 ? i + 1 : VW - 1)];
      var hd = hgt[jm + i], hu = hgt[jp + i];
      var nx = (hl - hrr) * 0.5, ny = 1, nz = (hd - hu) * 0.5;
      var inv = 1 / Math.sqrt(nx * nx + 1 + nz * nz);
      nx *= inv; ny *= inv; nz *= inv;
      N[k] = nx; N[k + 1] = ny; N[k + 2] = nz;
      terrainColor(h, ny, i - HALF, j - HALF, _tc, aoFeld[id]);
      C[k] = _tc.r; C[k + 1] = _tc.g; C[k + 2] = _tc.b;
    }
  }
  var off = j0 * VW * 3, cnt = (j1 - j0 + 1) * VW * 3;
  pos.clearUpdateRanges(); pos.addUpdateRange(off, cnt); pos.needsUpdate = true;
  nor.clearUpdateRanges(); nor.addUpdateRange(off, cnt); nor.needsUpdate = true;
  col.clearUpdateRanges(); col.addUpdateRange(off, cnt); col.needsUpdate = true;
  if (j0 === 0 && j1 === VW - 1) terrainGeo.computeBoundingSphere();
}

/** Bilineare Höhe an Weltkoordinaten. */
function heightAt(x, z) {
  var fi = clamp(x + HALF, 0, MAP), fj = clamp(z + HALF, 0, MAP);
  var i = Math.min(MAP - 1, fi | 0), j = Math.min(MAP - 1, fj | 0);
  var tx = fi - i, tz = fj - j;
  var a = hgt[j * VW + i], b = hgt[j * VW + i + 1];
  var c = hgt[(j + 1) * VW + i], d = hgt[(j + 1) * VW + i + 1];
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}

/** y-Komponente der Normalen (= cos der Hangneigung). */
function slopeAt(x, z) {
  var i = clamp(Math.round(x + HALF), 1, VW - 2), j = clamp(Math.round(z + HALF), 1, VW - 2);
  var nx = (hgt[j * VW + i - 1] - hgt[j * VW + i + 1]) * 0.5;
  var nz = (hgt[(j - 1) * VW + i] - hgt[(j + 1) * VW + i]) * 0.5;
  return 1 / Math.sqrt(nx * nx + 1 + nz * nz);
}

/** Interpolierte Terrainnormale — richtet die Kontaktschatten am Hang aus. */
function normalAt(x, z, out) {
  var i = clamp(Math.round(x + HALF), 1, VW - 2), j = clamp(Math.round(z + HALF), 1, VW - 2);
  var nx = (hgt[j * VW + i - 1] - hgt[j * VW + i + 1]) * 0.5;
  var nz = (hgt[(j - 1) * VW + i] - hgt[(j + 1) * VW + i]) * 0.5;
  var inv = 1 / Math.sqrt(nx * nx + 1 + nz * nz);
  out.set(nx * inv, inv, nz * inv);
  return out;
}

function baseHeightAt(x, z) {
  var fi = clamp(x + HALF, 0, MAP), fj = clamp(z + HALF, 0, MAP);
  var i = Math.min(MAP - 1, fi | 0), j = Math.min(MAP - 1, fj | 0);
  var tx = fi - i, tz = fj - j;
  var a = base[j * VW + i], b = base[j * VW + i + 1];
  var c = base[(j + 1) * VW + i], d = base[(j + 1) * VW + i + 1];
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}

var corridor = new Uint8Array(VW * VW);
function stampCorridor(x, z, r) {
  var a0 = Math.max(0, Math.floor(x + HALF - r)), a1 = Math.min(VW - 1, Math.ceil(x + HALF + r));
  var b0 = Math.max(0, Math.floor(z + HALF - r)), b1 = Math.min(VW - 1, Math.ceil(z + HALF + r));
  var rr2 = r * r;
  for (var j = b0; j <= b1; j++) {
    for (var i = a0; i <= a1; i++) {
      var dx = (i - HALF) - x, dz = (j - HALF) - z;
      if (dx * dx + dz * dz <= rr2) corridor[j * VW + i] = 1;
    }
  }
}

function inCorridor(x, z) {
  var i = Math.round(x + HALF), j = Math.round(z + HALF);
  if (i < 0 || j < 0 || i >= VW || j >= VW) return false;
  return corridor[j * VW + i] === 1;
}

var rivers = [];   // {samples:[{x,z,y}], radius, depth}

/** hgt = base, danach alle Flussstempel — idempotent und bereichsweise anwendbar. */
function recomputeHeights(i0, i1, j0, j1) {
  i0 = clamp(i0 | 0, 0, VW - 1); i1 = clamp(i1 | 0, 0, VW - 1);
  j0 = clamp(j0 | 0, 0, VW - 1); j1 = clamp(j1 | 0, 0, VW - 1);
  for (var j = j0; j <= j1; j++) {
    var row = j * VW;
    for (var i = i0; i <= i1; i++) hgt[row + i] = base[row + i];
  }
  for (var r = 0; r < rivers.length; r++) {
    var riv = rivers[r], R = riv.radius;
    for (var s = 0; s < riv.samples.length; s++) {
      var p = riv.samples[s];
      var a0 = Math.max(i0, Math.floor(p.x + HALF - R)), a1 = Math.min(i1, Math.ceil(p.x + HALF + R));
      var b0 = Math.max(j0, Math.floor(p.z + HALF - R)), b1 = Math.min(j1, Math.ceil(p.z + HALF + R));
      var bed = p.y - riv.depth;
      for (var jj = b0; jj <= b1; jj++) {
        for (var ii = a0; ii <= a1; ii++) {
          var dx = (ii - HALF) - p.x, dz = (jj - HALF) - p.z;
          var d = Math.sqrt(dx * dx + dz * dz);
          if (d > R) continue;
          var w = sstep(R, R * 0.3, d);
          var id = jj * VW + ii;
          var target = lerp(base[id], bed, w);
          if (target < hgt[id]) hgt[id] = target;
        }
      }
    }
  }
}

/** Terrain aus Basis + Flüssen neu berechnen und hochladen. */
function refreshTerrainFull() {
  recomputeHeights(0, VW - 1, 0, VW - 1);
  computeAO(0, VW - 1, 0, VW - 1);
  refreshGrid(0, VW - 1, 0, VW - 1);
}

var flattenTarget = 0;
function applyBrush(p, mode, radius, strength, dt) {
  var r = radius, i0 = Math.floor(p.x + HALF - r), i1 = Math.ceil(p.x + HALF + r);
  var j0 = Math.floor(p.z + HALF - r), j1 = Math.ceil(p.z + HALF + r);
  i0 = clamp(i0, 0, VW - 1); i1 = clamp(i1, 0, VW - 1);
  j0 = clamp(j0, 0, VW - 1); j1 = clamp(j1, 0, VW - 1);
  var amt = strength * dt * 60 * 0.35;
  for (var j = j0; j <= j1; j++) {
    for (var i = i0; i <= i1; i++) {
      var dx = (i - HALF) - p.x, dz = (j - HALF) - p.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d > r) continue;
      var w = sstep(r, r * 0.25, d);
      var id = j * VW + i;
      if (mode === "heben") base[id] += amt * w;
      else if (mode === "senken") base[id] -= amt * w;
      else if (mode === "ebnen") base[id] = lerp(base[id], flattenTarget, clamp(w * amt * 0.5, 0, 1));
      else if (mode === "glaetten") {
        var il = Math.max(0, i - 1), ir2 = Math.min(VW - 1, i + 1);
        var jd = Math.max(0, j - 1), ju = Math.min(VW - 1, j + 1);
        var avg = (base[j * VW + il] + base[j * VW + ir2] + base[jd * VW + i] + base[ju * VW + i]) * 0.25;
        base[id] = lerp(base[id], avg, clamp(w * amt * 0.6, 0, 1));
      }
    }
  }
  var m = Math.ceil(r) + 2;
  recomputeHeights(i0 - m, i1 + m, j0 - m, j1 + m);
  computeAO(i0 - m - 1, i1 + m + 1, j0 - m - 1, j1 + m + 1);
  refreshGrid(i0 - m, i1 + m, j0 - m, j1 + m);
}

function setFlattenTarget(v) { flattenTarget = v; }

export { base, hgt, genBase, terrain, terrainGeo, initTerrain, terrainColor, computeAO,
  refreshGrid, heightAt, slopeAt, normalAt, baseHeightAt, corridor, stampCorridor,
  inCorridor, rivers, recomputeHeights, refreshTerrainFull, applyBrush, setFlattenTarget };
