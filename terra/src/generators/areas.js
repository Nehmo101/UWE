// Flaechen-Werkzeug: Wald, Feld, Wiese, Viertel samt innerem Wegenetz.
import { clamp, lerp, sstep, DEG, hashi, fractal, rngOf, rr, ri, wpick } from '../core/rng.js';
import { POOLS, emit, tintOf, rauchAus } from '../core/pools.js';
import { heightAt, slopeAt } from '../world/terrain.js';
import { newOcc, occAdd, tryPlace, KULTUR, emitFensterlicht } from './objects.js';
import { bandGeoAusLinie, bandMeshAusGeos } from './paths.js';

function polyBBox(pts) {
  var b = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  for (var i = 0; i < pts.length; i++) {
    if (pts[i].x < b.x0) b.x0 = pts[i].x;
    if (pts[i].x > b.x1) b.x1 = pts[i].x;
    if (pts[i].z < b.z0) b.z0 = pts[i].z;
    if (pts[i].z > b.z1) b.z1 = pts[i].z;
  }
  return b;
}

function inPoly(pts, x, z) {
  var inside = false;
  for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    var a = pts[i], b = pts[j];
    if (((a.z > z) !== (b.z > z)) && (x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x)) inside = !inside;
  }
  return inside;
}

function polyArea(pts) {
  var s = 0;
  for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) s += (pts[j].x + pts[i].x) * (pts[j].z - pts[i].z);
  return Math.abs(s * 0.5);
}

function polyCenter(pts) {
  var x = 0, z = 0;
  for (var i = 0; i < pts.length; i++) { x += pts[i].x; z += pts[i].z; }
  return { x: x / pts.length, z: z / pts.length };
}

/** Abstand so vergrößern, dass die Instanzzahl beherrschbar bleibt. */
function safeSpacing(pts, wanted, maxCount) {
  var a = polyArea(pts);
  var need = Math.sqrt(a / Math.max(1, maxCount));
  return Math.max(wanted, need);
}

/** 0 am Polygonkern, 1 nahe dem Rand — Unterwuchs verdichtet sich am Saum. */
function randNaehe(pts, x, z) {
  var best = 1e9;
  for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    var ax = pts[i].x, az = pts[i].z, bx = pts[j].x, bz = pts[j].z;
    var dx = bx - ax, dz = bz - az;
    var l2 = dx * dx + dz * dz;
    var t = l2 > 0 ? clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1) : 0;
    var px = ax + dx * t - x, pz = az + dz * t - z;
    var d = px * px + pz * pz;
    if (d < best) best = d;
  }
  return 1 - sstep(3, 9, Math.sqrt(best));
}

function genWald(el) {
  var p = el.params, pts = el.points;
  var klump = p.klumpen === undefined ? 0.55 : p.klumpen;
  var sp = safeSpacing(pts, 6.5 / p.dichte * (1 - 0.28 * klump), 14000);
  var schwelle = 0.26 + klump * 0.36;
  var bb = polyBBox(pts), occ = newOcc(4);
  var c0 = Math.floor(bb.x0 / sp), c1 = Math.ceil(bb.x1 / sp);
  var d0 = Math.floor(bb.z0 / sp), d1 = Math.ceil(bb.z1 / sp);
  for (var cz = d0; cz <= d1; cz++) {
    for (var cx = c0; cx <= c1; cx++) {
      var r1 = hashi(cx, cz, el.seed), r2 = hashi(cx, cz, el.seed + 1), r3 = hashi(cx, cz, el.seed + 2);
      var x = (cx + 0.5 + (r1 - 0.5) * 0.85) * sp;
      var z = (cz + 0.5 + (r2 - 0.5) * 0.85) * sp;
      if (!inPoly(pts, x, z)) continue;
      // Bäume wachsen in Nestern mit Lichtungen dazwischen, nicht im Raster
      if (fractal(x * 0.04, z * 0.04, el.seed + 21) < schwelle) continue;
      var rng = rngOf((hashi(cx, cz, el.seed + 7) * 4294967296) | 0);
      var nadel = r3 < p.mischung;
      var artW = hashi(cx, cz, el.seed + 33);
      var kind = nadel ? (artW < 0.6 ? "nadelbaum" : "zypresse")
        : (artW < 0.38 ? "baum2" : (artW < 0.86 ? "baum"
          : (artW < 0.94 ? "sumpfbaum" : "bluetenbaum")));
      var h = tryPlace(occ, x, z, POOLS[kind].radius * 0.8, null);
      if (h === null) continue;
      var sc = rr(rng, 0.8, 1.2);
      // Farbvarianz: leichte Verschiebung, selten ein deutlich abweichender Ton
      var tint = tintOf(rng, 0.09);
      var ausW = rng();
      if (ausW < 0.035) tint = [1.28, 0.92, 0.55];        // goldener Baum
      else if (ausW < 0.06) tint = [1.3, 0.78, 0.62];     // roetlicher Baum
      emit(el, kind, x, h - 0.1, z, rng() * 6.28, sc, sc * rr(rng, 0.85, 1.25), sc, tint);
      if (rng() < p.unterholz * (0.6 + randNaehe(pts, x, z) * 0.8)) {
        var bx = x + rr(rng, -sp * 0.5, sp * 0.5), bz = z + rr(rng, -sp * 0.5, sp * 0.5);
        if (!inPoly(pts, bx, bz)) continue;
        var bh = tryPlace(occ, bx, bz, 0.7, null);
        if (bh === null) continue;
        var bs = rr(rng, 0.7, 1.35);
        var uw = wpick(rng, [["busch", 5], ["farn", 4], ["moos", 3], ["stumpf", 1],
          ["stammliegend", 1], ["fels", 1]]);
        emit(el, uw, bx, bh + (uw === "moos" ? 0.04 : 0), bz, rng() * 6.28,
          bs, bs, bs, tintOf(rng, 0.08));
      }
    }
  }
}

// Leitfarben der Blumennester (multiplizieren die Bluetentextur)
var LEITFARBEN = [[1.25, 0.72, 0.85], [1.3, 1.15, 0.55], [1.1, 1.1, 1.15], [0.8, 0.85, 1.3]];

var FRUCHT = {
  weizen: [1.05, 1.0, 0.82], kohl: [0.86, 0.99, 0.83],
  lavendel: [0.95, 0.92, 1.08], brache: [1.0, 0.96, 0.9]
};
function genFeld(el) {
  var p = el.params, pts = el.points, rng = rngOf(el.seed);
  var bb = polyBBox(pts), ctr = polyCenter(pts);
  var ext = Math.max(bb.x1 - bb.x0, bb.z1 - bb.z0) * 0.75 + 4;
  var a = p.drehung * DEG, dx = Math.cos(a), dz = Math.sin(a);
  var px = -dz, pz = dx;
  var rowSp = safeSpacing(pts, p.reihe, 6000) * 1.0;
  var alongSp = 2.6;
  var frucht = FRUCHT[p.frucht] || FRUCHT.weizen;
  var occ = newOcc(2);
  var nRows = Math.ceil(ext * 2 / rowSp);
  for (var r = -nRows; r <= nRows; r++) {
    var off = r * rowSp;
    var steps = Math.ceil(ext * 2 / alongSp);
    for (var s = 0; s <= steps; s++) {
      var t = -ext + s * alongSp;
      var x = ctr.x + dx * t + px * off, z = ctr.z + dz * t + pz * off;
      if (!inPoly(pts, x, z)) continue;
      var h = tryPlace(occ, x, z, 0.5, null);
      if (h === null) continue;
      var tn = tintOf(rng, 0.05);
      emit(el, "feldreihe", x, h, z, a + Math.PI / 2,
        rowSp * 0.34, rr(rng, 0.75, 1.15) * p.hoehe, alongSp * 0.55,
        [frucht[0] * tn[0], frucht[1] * tn[1], frucht[2] * tn[2]]);
    }
  }
}

function genWiese(el) {
  var p = el.params, pts = el.points;
  var sp = safeSpacing(pts, 2.6 / p.dichte, 20000);
  var bb = polyBBox(pts), occ = newOcc(1.5);
  var c0 = Math.floor(bb.x0 / sp), c1 = Math.ceil(bb.x1 / sp);
  var d0 = Math.floor(bb.z0 / sp), d1 = Math.ceil(bb.z1 / sp);
  for (var cz = d0; cz <= d1; cz++) {
    for (var cx = c0; cx <= c1; cx++) {
      var r1 = hashi(cx, cz, el.seed), r2 = hashi(cx, cz, el.seed + 1);
      var x = (cx + 0.5 + (r1 - 0.5) * 0.95) * sp, z = (cz + 0.5 + (r2 - 0.5) * 0.95) * sp;
      if (!inPoly(pts, x, z)) continue;
      var rng = rngOf((hashi(cx, cz, el.seed + 3) * 4294967296) | 0);
      // Nester und Luecken statt Gleichverteilung
      if (fractal(x * 0.06, z * 0.06, el.seed + 77) < 0.34) continue;
      var h = tryPlace(occ, x, z, 0.25, null);
      if (h === null) continue;
      // Blumen wachsen in Nestern mit einer Leitfarbe je Nest
      var nestX = Math.floor(x / 9), nestZ = Math.floor(z / 9);
      var nest = hashi(nestX, nestZ, el.seed + 91);
      var istBlume = rng() < p.blumen * sstep(0.45, 0.75, nest);
      var kind = istBlume ? "blume" : "gras";
      var sc = rr(rng, 0.75, 1.35);
      var tint = tintOf(rng, 0.1);
      if (istBlume) {
        var leit = LEITFARBEN[Math.floor(hashi(nestX, nestZ, el.seed + 93) * LEITFARBEN.length)];
        tint = [leit[0] * (0.9 + rng() * 0.2), leit[1] * (0.9 + rng() * 0.2), leit[2] * (0.9 + rng() * 0.2)];
      }
      emit(el, kind, x, h, z, rng() * 6.28, sc, sc * rr(rng, 0.8, 1.3), sc, tint);
    }
  }
}

/** Inneres Wegenetz eines Viertels — reine Funktion der Punkte/Parameter/Seed. */
function districtStreets(el) {
  var p = el.params, pts = el.points, rng = rngOf(el.seed + 51);
  var bb = polyBBox(pts), ctr = polyCenter(pts);
  var ext = Math.max(bb.x1 - bb.x0, bb.z1 - bb.z0) * 0.72 + 3;
  var bs = Math.max(9, p.block);
  var out = [], k, s, line, steps, t;
  var ang = p.drehung * DEG;
  if (p.netz === "raster" || p.netz === "gebogen") {
    for (var dir = 0; dir < 2; dir++) {
      var a = ang + dir * Math.PI / 2, dx = Math.cos(a), dz = Math.sin(a);
      var px = -dz, pz = dx;
      var n = Math.ceil(ext / bs);
      for (k = -n; k <= n; k++) {
        var off = k * bs;
        line = []; steps = Math.max(8, Math.ceil(ext * 2 / 1.8));
        for (s = 0; s <= steps; s++) {
          t = -ext + (s / steps) * ext * 2;
          var wx = ctr.x + dx * t + px * off, wz = ctr.z + dz * t + pz * off;
          if (p.netz === "gebogen") {
            var b = (fractal(wx * 0.014, wz * 0.014, el.seed + dir * 31) - 0.5) * bs * 0.85;
            wx += px * b; wz += pz * b;
          }
          line.push({ x: wx, z: wz });
        }
        out.push(line);
      }
    }
  } else if (p.netz === "ring") {
    var R = ext, rings = clamp(Math.round(R / bs), 1, 7);
    for (var r = 1; r <= rings; r++) {
      var rad = (r / rings) * R * 0.92;
      line = []; steps = Math.max(24, Math.round(rad * 1.6));
      for (s = 0; s <= steps; s++) {
        var aa = (s / steps) * Math.PI * 2;
        line.push({ x: ctr.x + Math.cos(aa) * rad, z: ctr.z + Math.sin(aa) * rad });
      }
      out.push(line);
    }
    var spokes = ri(rng, 5, 9);
    for (k = 0; k < spokes; k++) {
      var sa = ang + k / spokes * Math.PI * 2;
      line = [];
      for (s = 0; s <= 40; s++) {
        t = (s / 40) * R * 0.95;
        line.push({ x: ctr.x + Math.cos(sa) * t, z: ctr.z + Math.sin(sa) * t });
      }
      out.push(line);
    }
  } else {   // zellen — unregelmäßige Blöcke durch verschobene Sehnen
    var K = clamp(Math.round(ext * 2 / bs) + 2, 3, 14);
    for (k = 0; k < K; k++) {
      var ca = rng() * Math.PI, cdx = Math.cos(ca), cdz = Math.sin(ca);
      var cpx = -cdz, cpz = cdx, coff = (rng() * 2 - 1) * ext * 0.85;
      line = [];
      for (s = 0; s <= 60; s++) {
        t = -ext + (s / 60) * ext * 2;
        var bx = ctr.x + cdx * t, bz = ctr.z + cdz * t;
        var bend = (fractal(bx * 0.02, bz * 0.02, el.seed + k * 17) - 0.5) * bs * 0.7;
        line.push({ x: bx + cpx * (coff + bend), z: bz + cpz * (coff + bend) });
      }
      out.push(line);
    }
  }
  return out;
}

function genViertel(el) {
  var p = el.params, pts = el.points, rng = rngOf(el.seed);
  if (!el.streets) el.streets = districtStreets(el);
  var streets = el.streets;
  var occ = newOcc(4.5);
  var i, k, s;
  // Gassen als durchgehendes Band bauen und als Sperrflaeche vormerken.
  // Alle Zuege wandern in EIN gemergtes Mesh (1 Draw Call statt 20-40);
  // gesammelt wird in Streets-Index-Reihenfolge, damit die gemergte
  // Geometrie bytegleich der bisherigen Aufrufreihenfolge entspricht.
  var gassenGeos = [];
  for (i = 0; i < streets.length; i++) {
    var innen = streets[i].filter(function (q) { return inPoly(pts, q.x, q.z); });
    if (innen.length > 1) {
      var geo = bandGeoAusLinie(el, innen, p.gasse * 0.5, [0.62, 0.58, 0.52], el.seed + i * 7, { einsinken: 0.08 });
      if (geo) gassenGeos.push(geo);
    }
  }
  bandMeshAusGeos(el, gassenGeos);
  for (i = 0; i < streets.length; i++) {
    var line = streets[i];
    for (k = 0; k < line.length; k++) {
      var q = line[k];
      if (!inPoly(pts, q.x, q.z)) continue;
      occAdd(occ, q.x, q.z, p.gasse * 0.5 + 0.6);
    }
  }
  // Bebauung an den Gassenseiten: geschlossene Reihen statt Streusiedlung.
  // In den Vorlagen stehen die Häuser Wand an Wand und bilden Blöcke.
  var table = KULTUR[p.stil] || KULTUR.dorf;
  if (p.stil === "dorf" || p.stil === "gemischt" || !p.stil) dorfUfer(el, pts, rng);
  var luecke = clamp(1.6 / p.dichte - 0.5, 0.1, 6);   // Abstand zwischen Nachbarn
  for (i = 0; i < streets.length; i++) {
    var ln = streets[i];
    for (var side = -1; side <= 1; side += 2) {
      var acc = rr(rng, 0, 6);
      var lauf = 0, laufKind = wpick(rng, table);
      for (k = 1; k < ln.length; k++) {
        var a = ln[k - 1], b = ln[k];
        var dx = b.x - a.x, dz = b.z - a.z, d = Math.sqrt(dx * dx + dz * dz);
        if (d < 0.001) continue;
        dx /= d; dz /= d;
        acc -= d;
        if (acc > 0) continue;
        // Reihenhaus-Läufe: 2–4 gleiche Typen nebeneinander, dann wechseln
        if (lauf <= 0) { laufKind = wpick(rng, table); lauf = ri(rng, 2, 4); }
        lauf--;
        var kind = laufKind;
        var br = POOLS[kind].radius * 2;
        acc = br + luecke * rr(rng, 0.4, 1.6);
        if (rng() < 0.1) continue;                     // gelegentliche Baulücke
        var off = p.gasse * 0.5 + POOLS[kind].radius + rr(rng, 0.2, 1.1);
        var x = b.x + (-dz) * off * side, z = b.z + dx * off * side;
        if (!inPoly(pts, x, z)) continue;
        var hh = tryPlace(occ, x, z, POOLS[kind].radius * 0.82, { ignoreCorridor: true });
        if (hh === null) continue;
        var sc = rr(rng, 0.88, 1.14);
        var hyaw = Math.atan2(dx, dz) + rr(rng, -0.05, 0.05);
        emit(el, kind, x, hh - 0.15, z, hyaw, sc, sc * rr(rng, 0.9, 1.25), sc, tintOf(rng));
        rauchAus(el, kind, x, hh, z, sc);
        emitFensterlicht(el, rng, kind, x, hh - 0.15, z, hyaw, sc);
      }
    }
  }
}

/** Uferzone eines Dorfviertels: Stege und Boote, wo das Polygon ans Wasser grenzt. */
function dorfUfer(el, pts, rng) {
  for (var i = 0; i < pts.length; i++) {
    var a = pts[i], b = pts[(i + 1) % pts.length];
    for (var t = 0.2; t < 1; t += 0.3) {
      var x = lerp(a.x, b.x, t), z = lerp(a.z, b.z, t);
      var h = heightAt(x, z);
      if (h > 0.4 || h < -2.5) continue;
      // Richtung Wasser: bergab
      var dx = heightAt(x + 2, z) - heightAt(x - 2, z);
      var dz = heightAt(x, z + 2) - heightAt(x, z - 2);
      var yaw = Math.atan2(-dx, -dz);
      if (rng() < 0.45) {
        emit(el, "steg", x, Math.max(h, 0.05), z, yaw, 1, 1, 1, tintOf(rng, 0.06));
        if (rng() < 0.7) {
          emit(el, "boot", x + Math.sin(yaw) * 2.4, 0.02, z + Math.cos(yaw) * 2.4,
            yaw + rr(rng, -0.5, 0.5), 1, 1, 1, tintOf(rng, 0.08));
        }
        return;   // ein Hafen je Viertel reicht
      }
    }
  }
}

function genFlaeche(el) {
  if (el.points.length < 3) return;
  if (el.variant === "wald") genWald(el);
  else if (el.variant === "feld") genFeld(el);
  else if (el.variant === "viertel") genViertel(el);
  else if (el.variant === "wiese") genWiese(el);
}


export { polyBBox, inPoly, polyArea, polyCenter, safeSpacing, genWald, genFeld,
  genWiese, districtStreets, genViertel, genFlaeche };
