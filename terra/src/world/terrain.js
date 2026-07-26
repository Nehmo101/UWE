// Heightfield-Terrain: Hoehen, Farben, Kruemmungs-AO, Korridore, Fluesse, Pinsel.
import * as THREE from 'three';
import { clamp, lerp, sstep, DEG, hashi, vnoise, fractal } from '../core/rng.js';
import { MAP, VW, HALF, WATER, S, BIOME } from '../core/store.js';
import { terraMat, tintedMats } from '../render/materials.js';

var base = new Float32Array(VW * VW);   // prozedurale Höhen + Pinsel-Änderungen
var hgt = new Float32Array(VW * VW);    // base + Flusseinschnitte (Renderhöhe)

/**
 * Reine Funktion: schreibt das deterministische Seed-Terrain in das
 * UEBERGEBENE Float32Array `ziel` (Laenge VW*VW), ohne base/AO/Geometrie
 * anzufassen. Grundlage des Delta-Speicherformats v3 (editor/io.js): dort
 * wird ein frisch erzeugtes Seed-Terrain gegen das bearbeitete base gedifft.
 * Determinismus: haengt AUSSCHLIESSLICH an fractal/hashi aus core/rng.js.
 * Die Umstellung der Bestueckungs-Zufaelle (generators/) auf ortsstabile
 * Hashes aendert dieses Ergebnis nicht — das Delta-Format bleibt davon
 * unabhaengig korrekt.
 */
function genBaseIn(ziel, seed) {
  for (var j = 0; j < VW; j++) {
    for (var i = 0; i < VW; i++) {
      var x = i - HALF, z = j - HALF;
      var h = fractal(x * 0.006, z * 0.006, seed) * 26 + fractal(x * 0.03, z * 0.03, seed + 77) * 4 - 6;
      // Rand weich unter den Wasserspiegel ziehen, damit die Karte keine Kante zeigt
      var d = Math.min(i, j, MAP - i, MAP - j);
      h = lerp(-22, h, sstep(0, 55, d));
      ziel[j * VW + i] = h;
    }
  }
}

/** Seed-Terrain direkt nach base schreiben — gleiche Rechenreihenfolge wie immer. */
function genBase(seed) { genBaseIn(base, seed); }

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

var terrain = new THREE.Mesh(terrainGeo, terraMat({ vertexColors: true, cloudShadow: true, familie: 'erde' }));
terrain.frustumCulled = false;
tintedMats.push(terrain.material);

/** Terrain-Mesh in die Szene haengen (einmal beim Start). */
function initTerrain(scene) { scene.add(terrain); }

// Farbkonstanten (G5): alle Toene und Zonenschwellen liegen jetzt in der
// BIOME-Registry (core/store.js). Der Eintrag "wiese" enthaelt exakt die
// frueheren Konstanten (C_SAND 0xdfd0ab, C_WIESE_* usw.) — der Default-Pfad
// bleibt byteidentisch. Die F2-Farbdrift-Pole (driftGelb/driftBlau, frueher
// C_DRIFT_GELB/C_DRIFT_BLAU) wandern mit: zwei Zielpole nur wenige Grad neben
// den Grundtoenen, kleine Mischgewichte, weiche Schwellen — grosse Flaechen
// "atmen", ohne scheckig zu werden.
var COS50 = Math.cos(50 * DEG), COS58 = Math.cos(58 * DEG);
var COS_BAND_A = Math.cos(52 * DEG), COS_BAND_B = Math.cos(35 * DEG);
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
 * Einfärbung nach Höhe, Hangneigung und Krümmung. Drei Grundtöne über
 * zwei Rauschoktaven, Übergänge zu Sand und Fels mit gestörter Grenze —
 * nirgends bleibt eine einfarbige Fläche stehen. Seit G5 biom-parametrisiert:
 * Palette und Zonenschwellen kommen aus BIOME[S.biom].terrain — strukturell
 * bleibt es EINE Funktion, wiese liest exakt die alten Werte (byteidentisch).
 */
function terrainColor(h, ny, x, z, out, ao) {
  var P = (BIOME[S.biom] || BIOME.wiese).terrain;
  var gross = fractal(x * 0.012, z * 0.012, S.worldSeed + 404);
  var fein = fractal(x * 0.052, z * 0.052, S.worldSeed + 505);
  out.copy(P.grasKuehl).lerp(P.grasWarm,
    clamp(sstep(0.34, 0.72, gross) * 0.8 + sstep(1, 17, h) * 0.35, 0, 1));
  out.lerp(P.grasTrocken, sstep(0.54, 0.86, fein) * 0.7);
  out.lerp(P.erde, sstep(0.68, 0.9, fractal(x * 0.055, z * 0.055, S.worldSeed + 717)) * 0.34);

  // Oasen-Logik (nur wueste, oase > 0 — im wiese-Pfad springt der Zweig nie
  // an): unter Hoehe ~2 zieht es die Senken Richtung gedaempftem Gruen;
  // das grobe Rauschen macht die Flecken spaerlich statt zum Ring.
  if (P.oase > 0) out.lerp(P.oaseFarbe, sstep(2.4, 0.8, h) * sstep(0.35, 0.75, gross) * P.oase);

  // F2: grobe Farbdrift ueber die Landschaftsmassen. f = 0.025 ergibt eine
  // Wellenlaenge von ~40 Welteinheiten (Zielkorridor 30–50); Seed fest an
  // worldSeed + 1102 gebunden — deterministisch wie alle anderen Oktaven,
  // kein Math.random. Hue-Wirkung: wenige Grad Richtung Gelb bzw. Blaugruen.
  var drift = fractal(x * 0.025, z * 0.025, S.worldSeed + 1102);
  out.lerp(P.driftGelb, sstep(0.55, 0.85, drift) * 0.16);
  out.lerp(P.driftBlau, sstep(0.45, 0.15, drift) * 0.16);

  // Zonengrenzen: staerker gestoert (Zungen und Inseln) und mit dunklem Saum
  var stoer = (fractal(x * 0.09, z * 0.09, S.worldSeed + 606) - 0.5) * 2.6
            + (fractal(x * 0.22, z * 0.22, S.worldSeed + 607) - 0.5) * 0.9;
  var hg = h + stoer;
  out.lerp(P.sand, sstep(P.sandA, P.sandB, hg));
  out.lerp(P.fels, sstep(P.felsA, P.felsB, hg));
  out.lerp(P.schnee, sstep(P.schneeA, P.schneeB, hg));
  var saum = Math.max(
    1 - sstep(0.0, 0.55, Math.abs(hg - P.saumSand)),
    Math.max(1 - sstep(0.0, 0.7, Math.abs(hg - P.saumFels)),
             1 - sstep(0.0, 0.7, Math.abs(hg - P.saumSchnee))));
  out.multiplyScalar(1 - saum * 0.12);

  var rock = 1 - sstep(COS58, COS50, ny);                 // Steilhänge immer Fels
  if (rock > 0) out.lerp(P.fels, rock * 0.9);             // bricht auch durch Schnee
  // gerichtete Gesteinsbaender auf Haengen: folgen der Hoehenlinie
  var steil = 1 - sstep(COS_BAND_A, COS_BAND_B, ny);
  if (steil > 0) {
    var band = fractal(h * 0.55 + x * 0.01, z * 0.01, S.worldSeed + 808);
    out.multiplyScalar(1 + steil * (band - 0.5) * 0.34);
  }
  // Abnutzung entlang der Wege: getretenes Gras wird erdig, Rand ausgefranst
  var wtr = wearAt(x, z);
  if (wtr > 0.01) {
    var frans = fractal(x * 0.35, z * 0.35, S.worldSeed + 505) * 0.5;
    out.lerp(P.tritt, clamp(wtr * 1.05 - frans, 0, 0.7));
  }

  if (h < 0.35) {                                          // Meeresgrund
    _tc2.copy(P.seegrund).lerp(P.tiefe, sstep(-0.25, -4.5, h));
    out.lerp(_tc2, sstep(0.35, -0.4, h));
  }
  var surf = sstep(0.8, 0.3, h) * sstep(-0.6, 0.06, h);
  if (surf > 0) out.lerp(P.brandung, surf * 0.5);          // Brandungssaum

  // F2: dieselbe grobe Drift moduliert auch den Value um +-5 % — die
  // Helligkeitswelle folgt damit exakt der Farbwelle (ein Waschgang, wie beim
  // Nass-in-nass-Lauf), statt ein zweites unabhaengiges Muster zu stapeln.
  var v = 0.94 + fractal(x * 0.16, z * 0.16, S.worldSeed + 909) * 0.08
        + vnoise(x * 0.55, z * 0.55, S.worldSeed + 313) * 0.05
        + (drift - 0.5) * 0.10;
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
// Abnutzung entlang der Wege: 0..255, weich auslaufend, faerbt das Gras erdig.
var wear = new Uint8Array(VW * VW);
function stampWear(x, z, r) {
  var a0 = Math.max(0, Math.floor(x + HALF - r)), a1 = Math.min(VW - 1, Math.ceil(x + HALF + r));
  var b0 = Math.max(0, Math.floor(z + HALF - r)), b1 = Math.min(VW - 1, Math.ceil(z + HALF + r));
  for (var j = b0; j <= b1; j++) {
    for (var i = a0; i <= a1; i++) {
      var dx = (i - HALF) - x, dz = (j - HALF) - z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d > r) continue;
      var w = Math.round(sstep(r, r * 0.3, d) * 255);
      var id = j * VW + i;
      if (w > wear[id]) wear[id] = w;
    }
  }
}
function clearWear() { wear.fill(0); }
function wearAt(x, z) {
  var i = clamp(Math.round(x + HALF), 0, VW - 1), j = clamp(Math.round(z + HALF), 0, VW - 1);
  return wear[j * VW + i] / 255;
}
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

export { base, hgt, genBase, genBaseIn, stampWear, clearWear, wearAt, terrain, terrainGeo, initTerrain, terrainColor, computeAO,
  refreshGrid, heightAt, slopeAt, normalAt, baseHeightAt, corridor, stampCorridor,
  inCorridor, rivers, recomputeHeights, refreshTerrainFull, applyBrush, setFlattenTarget };
