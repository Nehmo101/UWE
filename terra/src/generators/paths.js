// Pfad-Werkzeug: Strasse, Mauer, Fluss, Hecke/Zaun.
import * as THREE from 'three';
import { clamp, lerp, sstep, hashi, rngOf, rr, wpick } from '../core/rng.js';
import { S, WATER, COS40, groupOf } from '../core/store.js';
import { POOLS, emit, tintOf, rauchAus } from '../core/pools.js';
import { heightAt, baseHeightAt, slopeAt } from '../world/terrain.js';
import { newOcc, tryPlace, KULTUR } from './objects.js';
import { terraMat } from '../render/materials.js';

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

var BELAG = { erde: [1.02, 0.98, 0.9], stein: [0.9, 0.92, 0.95], pflaster: [0.82, 0.84, 0.86] };

function genStrasse(el) {
  var p = el.params, rng = rngOf(el.seed);
  var w = p.breite, sm = pathSamples(el.points, 1.6);
  if (!sm.length) return;
  var belag = BELAG[p.belag] || BELAG.erde;
  var i, s;
  // Fahrbahn aus abgeflachten Quadern
  for (i = 0; i < sm.length; i++) {
    s = sm[i];
    var y = Math.max(heightAt(s.x, s.z), WATER + 0.15) + 0.09;
    var t = tintOf(rng, 0.05);
    emit(el, "weg", s.x, y, s.z, Math.atan2(s.tx, s.tz),
      w, 1, 2.3, [belag[0] * t[0], belag[1] * t[1], belag[2] * t[2]]);
  }
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
      emit(el, kind, x, h - 0.15, z, Math.atan2(s.tx, s.tz) + rr(rng, -0.14, 0.14),
        sc, sc * rr(rng, 0.9, 1.15), sc, tintOf(rng));
      rauchAus(el, kind, x, h, z, sc);
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
  var mesh = new THREE.Mesh(g, terraMat({
    vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide
  }));
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


export { pathCurve, pathSamples, BELAG, genStrasse, genMauer, genFluss, genHecke };
