// Pfad-Werkzeug: Strasse, Mauer, Fluss, Hecke/Zaun.
import * as THREE from 'three';
import { lerp, hashi, fractal, rngOf, rr, wpick } from '../core/rng.js';
import { WATER, COS40, groupOf } from '../core/store.js';
import { POOLS, emit, tintOf, rauchAus } from '../core/pools.js';
import { heightAt, baseHeightAt, slopeAt } from '../world/terrain.js';
import { newOcc, tryPlace, KULTUR, emitFensterlicht } from './objects.js';
import { terraMat, tintedMats } from '../render/materials.js';

function pathCurve(points) {
  var v = [];
  for (var i = 0; i < points.length; i++) v.push(new THREE.Vector3(points[i].x, 0, points[i].z));
  if (v.length < 2) return null;
  return new THREE.CatmullRomCurve3(v, false, "catmullrom", 0.5);
}

/** Gleichmäßige Abtastung mit Tangenten; s = Bogenlänge. */
function pathSamples(points, step) {
  var curve = pathCurve(points);
  if (!curve) return [];
  var len = curve.getLength();
  if (!(len > 0.01)) return [];
  var n = Math.max(1, Math.ceil(len / step));
  var out = [];
  for (var i = 0; i <= n; i++) {
    var t = i / n;
    var p = curve.getPointAt(t), tg = curve.getTangentAt(t);
    var tl = Math.sqrt(tg.x * tg.x + tg.z * tg.z) || 1;
    out.push({ x: p.x, z: p.z, tx: tg.x / tl, tz: tg.z / tl, s: t * len });
  }
  out.len = len;
  return out;
}


/* ==========================================================================
   Durchgehendes Wegband: folgt der Terrainhoehe, franst an den Raendern
   unregelmaessig aus und sinkt leicht in den Boden ein — keine Plattennaehte.
   Erkennt Wasserquerungen und errichtet dort automatisch eine Bruecke.
   ========================================================================== */
function bandAusLinie(el, linie, halbBreite, grundFarbe, seed, opts) {
  opts = opts || {};
  var einsinken = opts.einsinken === undefined ? 0.12 : opts.einsinken;
  var pos = [], col = [], idx = [];
  var n = linie.length;
  if (n < 2) return null;
  var holz = [0.58, 0.47, 0.35];
  var istBruecke = new Array(n);
  var deckHoehe = new Array(n);
  // 1) Wasserquerungen finden und Deckhoehe der Bruecke bestimmen
  var i;
  for (i = 0; i < n; i++) {
    var q = linie[i];
    var h = heightAt(q.x, q.z);
    istBruecke[i] = h < WATER + 0.25;
    deckHoehe[i] = Math.max(h, WATER + 0.15) + 0.1;
  }
  for (i = 0; i < n; i++) {
    if (!istBruecke[i]) continue;
    // Ufersuche links/rechts, Deck spannt zwischen den Ufern
    var a = i; while (a > 0 && istBruecke[a - 1]) a--;
    var b = i; while (b < n - 1 && istBruecke[b + 1]) b++;
    var ha = deckHoehe[Math.max(0, a - 1)], hb = deckHoehe[Math.min(n - 1, b + 1)];
    var t = (i - a + 1) / (b - a + 2);
    deckHoehe[i] = Math.max(lerp(ha, hb, t), WATER + 1.0) +
      Math.sin(t * Math.PI) * 0.35;                     // leichter Bogen
  }
  // 2) Band bauen
  for (i = 0; i < n; i++) {
    var q2 = linie[i];
    var vor = linie[Math.min(n - 1, i + 1)], zur = linie[Math.max(0, i - 1)];
    var tx = vor.x - zur.x, tz = vor.z - zur.z;
    var tl = Math.sqrt(tx * tx + tz * tz) || 1;
    var nx = -tz / tl, nz = tx / tl;
    // ausgefranste Raender: Halbbreite je Seite vom Rauschen moduliert
    var fL = halbBreite * (1 + (fractal(q2.x * 0.3 + 9, q2.z * 0.3, seed) - 0.5) * 0.7);
    var fR = halbBreite * (1 + (fractal(q2.x * 0.3, q2.z * 0.3 + 9, seed + 3) - 0.5) * 0.7);
    var y = deckHoehe[i];
    var yL = istBruecke[i] ? y : heightAt(q2.x + nx * fL, q2.z + nz * fL) + 0.1 - einsinken;
    var yR = istBruecke[i] ? y : heightAt(q2.x - nx * fR, q2.z - nz * fR) + 0.1 - einsinken;
    var f = istBruecke[i] ? holz : grundFarbe;
    var vv = 0.92 + hashi(i, 3, seed) * 0.14;
    pos.push(q2.x + nx * fL, yL, q2.z + nz * fL);
    col.push(f[0] * vv * 0.92, f[1] * vv * 0.92, f[2] * vv * 0.92);
    pos.push(q2.x, y + (istBruecke[i] ? 0 : 0.045), q2.z);
    col.push(f[0] * vv, f[1] * vv, f[2] * vv);
    pos.push(q2.x - nx * fR, yR, q2.z - nz * fR);
    col.push(f[0] * vv * 0.92, f[1] * vv * 0.92, f[2] * vv * 0.92);
    if (i > 0) {
      var A = (i - 1) * 3, B = i * 3;
      idx.push(A, B, A + 1, A + 1, B, B + 1);
      idx.push(A + 1, B + 1, A + 2, A + 2, B + 1, B + 2);
    }
    // 3) Brueckenausstattung: Pfaehle und Gelaender
    if (istBruecke[i] && (i % 3 === 1)) {
      emit(el, "pfosten", q2.x + nx * (halbBreite + 0.2), y + 0.15, q2.z + nz * (halbBreite + 0.2),
        Math.atan2(tx, tz), 1, 1.2, 1, [0.9, 0.86, 0.8]);
      emit(el, "pfosten", q2.x - nx * (halbBreite + 0.2), y + 0.15, q2.z - nz * (halbBreite + 0.2),
        Math.atan2(tx, tz), 1, 1.2, 1, [0.9, 0.86, 0.8]);
      emit(el, "mauer", q2.x + nx * halbBreite * 0.7, y - 1.1, q2.z + nz * halbBreite * 0.7,
        Math.atan2(tx, tz), 0.35, 1.1, 0.35, [0.6, 0.52, 0.42]);
    }
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  var mesh = new THREE.Mesh(g, wegBandMat);
  mesh.userData.el = el;
  groupOf(el).add(mesh);
  return mesh;
}
var wegBandMat = terraMat({ vertexColors: true, familie: 'erde' });

// Geteiltes Flusswasser-Material: frueher erzeugte genFluss bei JEDER
// Regenerierung ein neues Material (Leck beim Ziehen des Breite-Sliders).
// Eigenschaften exakt wie zuvor pro Aufruf; alle Fluss-Meshes teilen es.
// Ueber tintedMats macht es den Tageszeit-Grundton (welt) mit — die
// Hauptwasserflaeche haengt separat am wasser-Preset (waterMat.color in
// atmosphere.js); eine exakte Kopplung daran braeuchte dort eine Zeile.
var flussMat = terraMat({
  vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide
});
tintedMats.push(flussMat);

var BELAG = { erde: [1.02, 0.98, 0.9], stein: [0.9, 0.92, 0.95], pflaster: [0.82, 0.84, 0.86] };

function genStrasse(el) {
  var p = el.params, rng = rngOf(el.seed);
  var w = p.breite, sm = pathSamples(el.points, 1.6);
  if (!sm.length) return;
  var belag = BELAG[p.belag] || BELAG.erde;
  var i, s;
  // Fahrbahn als durchgehendes Band (mit automatischen Bruecken ueber Wasser)
  var bandFarbe = [0.60 * belag[0], 0.545 * belag[1], 0.45 * belag[2]];
  bandAusLinie(el, sm, w * 0.5, bandFarbe, el.seed, { einsinken: 0.12 });
  if (!p.haeuser) return;
  // Bebauung beidseitig, zur Straße ausgerichtet
  var occ = newOcc(4);
  var half = w * 0.5;
  for (var side = -1; side <= 1; side += 2) {
    var next = rr(rng, 2, p.abstand);
    for (i = 0; i < sm.length; i++) {
      s = sm[i];
      if (s.s < next) continue;
      next = s.s + p.abstand * rr(rng, 0.7, 1.35);
      var nx = -s.tz, nz = s.tx;
      var off = half + 2.6 + rr(rng, 0, p.streuung);
      var x = s.x + nx * off * side + s.tx * rr(rng, -p.streuung, p.streuung);
      var z = s.z + nz * off * side + s.tz * rr(rng, -p.streuung, p.streuung);
      var kind = wpick(rng, KULTUR[p.stil] || KULTUR.dorf);
      var h = tryPlace(occ, x, z, POOLS[kind].radius, null);
      if (h === null) continue;
      var sc = rr(rng, 0.85, 1.2);
      var syaw = Math.atan2(s.tx, s.tz) + rr(rng, -0.14, 0.14);
      emit(el, kind, x, h - 0.15, z, syaw, sc, sc * rr(rng, 0.9, 1.15), sc, tintOf(rng));
      rauchAus(el, kind, x, h, z, sc);
      emitFensterlicht(el, rng, kind, x, h - 0.15, z, syaw, sc);
      if (rng() < 0.35) {
        var bx = x + nx * side * rr(rng, 2.2, 3.6), bz = z + nz * side * rr(rng, 2.2, 3.6);
        var bh = tryPlace(occ, bx, bz, 0.9, null);
        if (bh !== null) emit(el, "busch", bx, bh, bz, rng() * 6.28,
          rr(rng, 0.8, 1.3), rr(rng, 0.8, 1.3), rr(rng, 0.8, 1.3), tintOf(rng));
      }
    }
  }
}

function genMauer(el) {
  var p = el.params, rng = rngOf(el.seed);
  var sm = pathSamples(el.points, 2.0);
  if (!sm.length) return;
  var gates = [];
  if (p.torAbstand > 0) {
    for (var g = p.torAbstand; g < sm.len; g += p.torAbstand) gates.push(g);
  }
  var nextTurm = p.turmAbstand;
  for (var i = 0; i < sm.length; i++) {
    var s = sm[i];
    var y = Math.max(heightAt(s.x, s.z), WATER + 0.2);
    var yaw = Math.atan2(s.tx, s.tz);
    var atGate = false;
    for (var k = 0; k < gates.length; k++) if (Math.abs(s.s - gates[k]) < 3.4) atGate = true;
    if (!atGate) {
      var t = tintOf(rng, 0.05);
      emit(el, "mauer", s.x, y - 0.35, s.z, yaw, p.dicke, 2.6 * p.hoehe, 2.2, t);
    }
    if (s.s >= nextTurm) {
      nextTurm += p.turmAbstand;
      var th = heightAt(s.x, s.z);
      emit(el, "turm", s.x, th - 0.4, s.z, rng() * 6.28,
        p.dicke * 0.85, p.hoehe * 1.05, p.dicke * 0.85, tintOf(rng, 0.04));
    }
  }
  // Tortürme flankierend
  for (var q = 0; q < gates.length; q++) {
    for (var side = -1; side <= 1; side += 2) {
      var target = gates[q] + side * 3.8, best = null;
      for (var m = 0; m < sm.length; m++) if (!best || Math.abs(sm[m].s - target) < Math.abs(best.s - target)) best = sm[m];
      if (!best) continue;
      emit(el, "turm", best.x, heightAt(best.x, best.z) - 0.4, best.z, rng() * 6.28,
        p.dicke * 0.8, p.hoehe * 1.15, p.dicke * 0.8, tintOf(rng, 0.04));
    }
  }
}

function genFluss(el) {
  var p = el.params, rng = rngOf(el.seed);
  var sm = pathSamples(el.points, 2.2);
  if (sm.length < 2) return;
  // Höhenprofil der Sohle glätten, damit das Wasser nicht bergauf fließt
  var prof = [];
  for (var i = 0; i < sm.length; i++) prof.push(baseHeightAt(sm[i].x, sm[i].z));
  for (var pass = 0; pass < 8; pass++) {
    var cp = prof.slice();
    for (var k = 1; k < prof.length - 1; k++) prof[k] = (cp[k - 1] + cp[k] * 2 + cp[k + 1]) * 0.25;
  }
  var pos = [], col = [], idx = [];
  var wc = new THREE.Color(0x6fb5c4), tmp = new THREE.Color();
  var wSurf = [];
  for (i = 0; i < sm.length; i++) {
    var s = sm[i];
    var y = prof[i] - p.tiefe * 0.42;
    wSurf.push(y);
    var nx = -s.tz, nz = s.tx, hw = p.breite * 0.5;
    tmp.copy(wc).multiplyScalar(0.95 + hashi(i, el.seed, 3) * 0.1);
    pos.push(s.x + nx * hw, y, s.z + nz * hw);
    col.push(tmp.r, tmp.g, tmp.b);
    pos.push(s.x - nx * hw, y, s.z - nz * hw);
    col.push(tmp.r, tmp.g, tmp.b);
    if (i > 0) {
      var a = (i - 1) * 2, b = a + 1, c = i * 2, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  var mesh = new THREE.Mesh(g, flussMat);
  mesh.renderOrder = 5;
  groupOf(el).add(mesh);
  // Schilf und Steine am Ufer
  var occ = newOcc(2.2);
  for (i = 0; i < sm.length; i += 2) {
    var ss = sm[i];
    for (var side = -1; side <= 1; side += 2) {
      if (rng() > 0.55) continue;
      var ox = -ss.tz * side, oz = ss.tx * side;
      var d = p.breite * 0.5 + rr(rng, 0.6, 3.2);
      var x = ss.x + ox * d, z = ss.z + oz * d;
      var h = tryPlace(occ, x, z, 0.5, { ignoreCorridor: true });
      if (h === null) continue;
      var what = rng() < 0.72 ? "gras" : "fels";
      var sc = rr(rng, 0.8, 1.6);
      emit(el, what, x, h, z, rng() * 6.28, sc, sc * rr(rng, 1, 1.6), sc, tintOf(rng));
    }
  }
}

function genHecke(el) {
  var p = el.params, rng = rngOf(el.seed);
  var step = p.stil === "zaun" ? 2.0 : 1.15;
  var sm = pathSamples(el.points, step);
  for (var i = 0; i < sm.length; i++) {
    var s = sm[i];
    var nx = -s.tz, nz = s.tx;
    var j = rr(rng, -0.3, 0.3);
    var x = s.x + nx * j, z = s.z + nz * j;
    var h = heightAt(x, z);
    if (h < WATER + 0.25 || slopeAt(x, z) < COS40) continue;
    var yaw = Math.atan2(s.tx, s.tz);
    if (p.stil === "zaun") {
      emit(el, "pfosten", x, h, z, yaw + Math.PI / 2, 1, rr(rng, 0.9, 1.1) * p.hoehe, 1, tintOf(rng));
    } else {
      var sc = rr(rng, 0.85, 1.3);
      emit(el, "busch", x, h, z, rng() * 6.28, sc * 1.1, sc * p.hoehe, sc * 0.95, tintOf(rng, 0.08));
    }
  }
}


export { pathCurve, pathSamples, BELAG, bandAusLinie, genStrasse, genMauer, genFluss, genHecke };
