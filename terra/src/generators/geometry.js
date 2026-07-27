// Alle Basisgeometrien (aus Primitiven), Blatt-/Huegel-/Inselformen und die
// Pool-Registrierung. mergeGeos bleibt eine eigene Implementierung: die Bausteine
// mischen indizierte und nicht indizierte Geometrie und fuellen fehlende
// Farbattribute auf - beides deckt mergeGeometries aus den Addons nicht ab.
import * as THREE from 'three';
import { clamp, sstep, hashi } from '../core/rng.js';
import { TEX } from '../render/textures.js';
import { definePool, setPoolNames } from '../core/pools.js';
import { terrainColor, heightAt } from '../world/terrain.js';

/** Fügt Geometrien (position/normal/color/uv, indiziert oder nicht) zu einer zusammen. */
function mergeGeos(list) {
  var vTot = 0, iTot = 0, g, i, k;
  for (i = 0; i < list.length; i++) {
    g = list[i];
    vTot += g.attributes.position.count;
    iTot += g.index ? g.index.count : g.attributes.position.count;
  }
  var pos = new Float32Array(vTot * 3), nor = new Float32Array(vTot * 3), col = new Float32Array(vTot * 3);
  // uv muss mitwandern: die Pools mit alphaTest-Textur (Kronenkarten, grassTuft)
  // sampeln sonst konstant bei (0,0), und der Wind-Shader gewichtet mit uv.y.
  // Float32Array ist nullinitialisiert — Teile ohne uv landen automatisch auf (0,0).
  var uv = new Float32Array(vTot * 2);
  var idx = vTot > 65535 ? new Uint32Array(iTot) : new Uint16Array(iTot);
  var vo = 0, io = 0;
  for (i = 0; i < list.length; i++) {
    g = list[i];
    var c = g.attributes.position.count;
    pos.set(g.attributes.position.array.subarray(0, c * 3), vo * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array.subarray(0, c * 3), vo * 3);
    if (g.attributes.color) col.set(g.attributes.color.array.subarray(0, c * 3), vo * 3);
    else col.fill(1, vo * 3, (vo + c) * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array.subarray(0, c * 2), vo * 2);
    if (g.index) {
      var a = g.index.array;
      for (k = 0; k < a.length; k++) idx[io + k] = a[k] + vo;
      io += a.length;
    } else {
      for (k = 0; k < c; k++) idx[io + k] = vo + k;
      io += c;
    }
    vo += c;
  }
  var out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

/** Transformationsmatrix aus Position / Euler / Skalierung. */
function M(x, y, z, rx, ry, rz, sx, sy, sz) {
  var m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(x || 0, y || 0, z || 0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
    new THREE.Vector3(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz)
  );
  return m;
}

/** Primitiv einfärben und platzieren. */
function part(geo, mat, hex) {
  var g = geo.clone();
  if (mat) g.applyMatrix4(mat);
  if (!g.attributes.normal) g.computeVertexNormals();
  var n = g.attributes.position.count;
  var c = new THREE.Color(hex);
  var arr = new Float32Array(n * 3);
  for (var i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Giebeldach als Dreiecksprisma (Firstrichtung = z). */
function prismGeo(w, h, d) {
  var hw = w / 2, hd = d / 2;
  var A = [-hw, 0, -hd], B = [hw, 0, -hd], C = [0, h, -hd];
  var D = [-hw, 0, hd], E = [hw, 0, hd], F = [0, h, hd];
  var tri = [A, C, B, D, E, F, A, D, F, A, F, C, B, C, F, B, F, E, A, B, E, A, E, D];
  var pos = new Float32Array(tri.length * 3);
  for (var i = 0; i < tri.length; i++) {
    pos[i * 3] = tri[i][0]; pos[i * 3 + 1] = tri[i][1]; pos[i * 3 + 2] = tri[i][2];
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * Röhre mit veränderlichem Radius entlang einer Punktfolge (Parallel-Transport-
 * Rahmen). radiusAt(t,i) und colorAt(t,i,color) steuern Verjüngung und Färbung.
 */
function tubeGeo(pts, radiusAt, radial, colorAt) {
  var n = pts.length, i, j;
  var tang = [];
  for (i = 0; i < n; i++) {
    var a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    var t = new THREE.Vector3().subVectors(b, a);
    if (t.lengthSq() < 1e-9) t.set(0, 1, 0);
    tang.push(t.normalize());
  }
  var nv = new THREE.Vector3(0, 1, 0);
  if (Math.abs(tang[0].dot(nv)) > 0.9) nv.set(1, 0, 0);
  nv.crossVectors(tang[0], nv).normalize();
  var pos = new Float32Array(n * radial * 3), nor = new Float32Array(n * radial * 3),
      col = new Float32Array(n * radial * 3);
  var q = new THREE.Quaternion(), bin = new THREE.Vector3(), d = new THREE.Vector3();
  var c = new THREE.Color(1, 1, 1);
  for (i = 0; i < n; i++) {
    if (i > 0) {
      q.setFromUnitVectors(tang[i - 1], tang[i]);
      nv.applyQuaternion(q);
      nv.addScaledVector(tang[i], -nv.dot(tang[i]));
      if (nv.lengthSq() < 1e-8) { nv.set(0, 1, 0); nv.crossVectors(tang[i], nv); }
      nv.normalize();
    }
    bin.crossVectors(tang[i], nv).normalize();
    var tt = n > 1 ? i / (n - 1) : 0;
    var r = radiusAt(tt, i);
    if (colorAt) colorAt(tt, i, c);
    for (j = 0; j < radial; j++) {
      var ang = j / radial * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
      d.set(nv.x * ca + bin.x * sa, nv.y * ca + bin.y * sa, nv.z * ca + bin.z * sa);
      var k = (i * radial + j) * 3;
      pos[k] = pts[i].x + d.x * r; pos[k + 1] = pts[i].y + d.y * r; pos[k + 2] = pts[i].z + d.z * r;
      nor[k] = d.x; nor[k + 1] = d.y; nor[k + 2] = d.z;
      // feine laengslaufende Faserung ueber die Radialsegmente
      var faser = 0.965 + hashi(j, 17, 91) * 0.07;
      col[k] = c.r * faser; col[k + 1] = c.g * faser; col[k + 2] = c.b * faser;
    }
  }
  var idx = new Uint32Array((n - 1) * radial * 6), o = 0;
  for (i = 0; i < n - 1; i++) {
    for (j = 0; j < radial; j++) {
      var j2 = (j + 1) % radial;
      var a1 = i * radial + j, b1 = i * radial + j2, c1 = (i + 1) * radial + j, d1 = (i + 1) * radial + j2;
      idx[o++] = a1; idx[o++] = b1; idx[o++] = c1;
      idx[o++] = b1; idx[o++] = d1; idx[o++] = c1;
    }
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

/** Halbe Blattbreite an der Längsposition u (0 = Stiel, 1 = Spitze). */
function leafHalfWidth(u) { return Math.sin(Math.PI * Math.pow(u, 0.72)) * (1 - u * 0.12); }
/** Höhenprofil der Blattfläche: leichte Schale quer, Neigung längs, Mittelrippe. */
function leafSurface(u, v, L, cup) {
  return L * (0.05 * Math.sin(u * Math.PI) - 0.07 * u * u)
       - cup * L * v * v * 0.34
       + L * 0.02 * (1 - Math.min(1, Math.abs(v) * 5));
}

/**
 * Erzeugt ein Blatt: Spitze, Mittelrippe, seitliche Adern, gewellter Rand.
 * thick > 0 schließt es zu einem tragfähigen Plateau mit heller Unterseite.
 */
/**
 * Erzeugt ein Blatt: Spitze, Mittelrippe, seitliche Adern, gewellter Rand.
 * thick > 0 schließt es zu einem tragfähigen Plateau mit heller Unterseite.
 */
function leafGeo(L, W, cup, thick, topHex, botHex, veinHex, seed) {
  var NU = 16, NV = 12, i, j;
  var pos = [], col = [], idx = [];
  var ct = new THREE.Color(topHex), cb = new THREE.Color(botHex),
      cv = new THREE.Color(veinHex), tmp = new THREE.Color();
  function surface(down, flip) {
    var start = pos.length / 3;
    for (i = 0; i <= NU; i++) {
      var u = i / NU;
      var hw = leafHalfWidth(u);
      for (j = 0; j <= NV; j++) {
        var v = (j / NV) * 2 - 1;
        var wob = 1 + (hashi(i, j, seed) - 0.5) * 0.30 * u
              + Math.sin(u * 14 + seed) * 0.09 * u;          // gelappter Rand
        var x = u * L;
        var z = v * hw * W * wob;
        var y = leafSurface(u, v, L, cup) - (down ? thick * (0.55 + 0.45 * (1 - Math.abs(v))) : 0);
        pos.push(x, y, z);
        if (down) {
          tmp.copy(cb).multiplyScalar(0.95 + hashi(i, j, seed + 7) * 0.09);
        } else {
          tmp.copy(ct);
          var rib = 1 - Math.min(1, Math.abs(v) * 9);                 // Mittelrippe
          var lat = 1 - Math.min(1, Math.abs(((u * 4.5 + Math.abs(v) * 1.2) % 1) - 0.5) * 9); // Seitenadern
          tmp.lerp(cv, clamp(rib * 0.75 + lat * 0.35 * u, 0, 0.85));
          tmp.multiplyScalar(0.93 + hashi(i, j, seed + 3) * 0.13);
        }
        col.push(tmp.r, tmp.g, tmp.b);
      }
    }
    for (i = 0; i < NU; i++) {
      for (j = 0; j < NV; j++) {
        var a0 = start + i * (NV + 1) + j, b0 = a0 + 1;
        var c0 = start + (i + 1) * (NV + 1) + j, d0 = c0 + 1;
        if (flip) idx.push(a0, c0, b0, b0, c0, d0);
        else idx.push(a0, b0, c0, b0, d0, c0);
      }
    }
    return start;
  }
  surface(false, false);
  if (thick > 0) {
    var bs = surface(true, true);
    for (i = 0; i < NU; i++) {          // Rand schließen
      for (var side = 0; side < 2; side++) {
        var j2 = side === 0 ? 0 : NV;
        var t0 = i * (NV + 1) + j2, t1 = (i + 1) * (NV + 1) + j2;
        var u0 = bs + t0, u1 = bs + t1;
        if (side === 0) idx.push(t0, u0, t1, t1, u0, u1);
        else idx.push(t0, t1, u0, t1, u1, u0);
      }
    }
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Flacher Erdhügel, über den die Wurzeln laufen. */
function moundGeo(r, h, x0, z0, seed) {
  // SEG statt S: der Name kollidierte frueher mit dem Store-Import und
  // beschattete ihn — als Segmentzahl benannt ist er eindeutig.
  var SEG = 30, R = 6, pos = [], col = [], idx = [], i, j;
  var tmp = new THREE.Color();
  var h0 = heightAt(x0, z0);
  for (i = 0; i <= R; i++) {
    var q = i / R;
    for (j = 0; j < SEG; j++) {
      var a = j / SEG * Math.PI * 2;
      var wob = 1 + (hashi(i, j, seed) - 0.5) * 0.26;
      var x = Math.cos(a) * r * q * wob, z = Math.sin(a) * r * q * wob;
      var wx = x0 + x, wz = z0 + z, wh = heightAt(wx, wz);
      // dem Gelände folgen, in der Mitte aufwölben, am Rand einsinken
      var y = (wh - h0) + h * Math.pow(1 - q * q, 1.4) - 0.35 - q * q * 1.6;
      terrainColor(Math.max(0.8, wh), 0.97, wx, wz, tmp);
      tmp.multiplyScalar(0.97 + hashi(j, i, seed + 5) * 0.1);
      pos.push(x, y, z); col.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (i = 0; i < R; i++) {
    for (j = 0; j < SEG; j++) {
      var j3 = (j + 1) % SEG;
      var a1 = i * SEG + j, b1 = i * SEG + j3, c1 = (i + 1) * SEG + j, d1 = (i + 1) * SEG + j3;
      idx.push(a1, b1, c1, b1, d1, c1);
    }
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Schwebender Felsbrocken: unten spitz, oben begrünt. */
function islandGeo(r, seed) {
  var g = new THREE.IcosahedronGeometry(r, 1);
  var p = g.attributes.position, n = p.count;
  var col = new Float32Array(n * 3);
  var cTop = new THREE.Color(0x7ba05e), cRock = new THREE.Color(0xa9a396), tmp = new THREE.Color();
  for (var i = 0; i < n; i++) {
    var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    var u = y / r;
    if (u > 0) y *= 0.34; else { var tap = clamp(1 + u * 0.88, 0.06, 1); x *= tap; z *= tap; y *= 1.75; }
    // Verschiebung über quantisierte Position, damit doppelte Ecken gleich bleiben
    var qx = Math.round(x * 40), qy = Math.round(y * 40), qz = Math.round(z * 40);
    var d = (hashi(qx, qz * 31 + qy, seed) - 0.5) * r * 0.3;
    var d2 = (hashi(qz, qx * 17 + qy, seed + 3) - 0.5) * r * 0.22;
    x += d; z += d2; y += (hashi(qy, qx + qz, seed + 9) - 0.5) * r * 0.12;
    p.setXYZ(i, x, y, z);
    tmp.copy(cRock).lerp(cTop, sstep(-0.02, 0.16, y / r));
    tmp.multiplyScalar(0.93 + hashi(qx, qy, seed + 21) * 0.14);
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

var CY = THREE.CylinderGeometry, BX = THREE.BoxGeometry, IC = THREE.IcosahedronGeometry,
    CO = THREE.ConeGeometry, PL = THREE.PlaneGeometry;

function geoTurm() {
  return mergeGeos([
    part(new CY(1.05, 1.25, 5.4, 9), M(0, 2.7, 0), 0xe8e2d4),
    part(new CY(1.32, 1.32, 0.32, 9), M(0, 5.3, 0), 0xd8d2c2),
    part(new CO(1.55, 2.1, 9), M(0, 6.5, 0), 0x36719f),
    part(new CY(0.07, 0.07, 1.2, 5), M(0, 8.1, 0), 0xdcd2ba),
    part(new PL(0.85, 0.45), M(0.44, 8.4, 0, 0, 0, 0.1), 0xd8785f)
  ]);
}

function geoMauer() {
  return mergeGeos([
    part(new BX(1, 1, 1), M(0, 0.5, 0), 0xc8c4b8),
    part(new BX(1.12, 0.14, 1.2), M(0, 1.03, 0), 0xd4d0c4)
  ]);
}

function geoSaeule() {
  return mergeGeos([
    part(new CY(0.52, 0.6, 0.34, 9), M(0, 0.17, 0), 0xcac4b6),
    part(new CY(0.42, 0.48, 2.9, 9), M(0, 1.6, 0), 0xd6d0c2),
    part(new CY(0.42, 0.42, 0.5, 9), M(0.1, 3.15, 0, 0.3, 0, 0.22), 0xcdc7b9)
  ]);
}

function geoFeldreihe() {
  return mergeGeos([
    part(new BX(0.62, 0.34, 2.8), M(0, 0.17, 0), 0x8d9165),
    part(new BX(0.3, 0.16, 2.8), M(0, 0.4, 0), 0x9ba073)
  ]);
}

function geoBusch() {
  return mergeGeos([
    part(new PL(1.5, 1.25), M(0, 0.62, 0), 0x5d7845),
    part(new PL(1.5, 1.25), M(0, 0.62, 0, 0, Math.PI / 2, 0), 0x526b3d),
    part(new IC(0.52, 0), M(0, 0.55, 0, 0, 0.4, 0, 1.15, 0.8, 1.15), 0x587442)
  ]);
}

function geoGras() {   // gekreuzte Quads mit gezeichneter Halm-Silhouette
  return mergeGeos([
    part(new PL(1.0, 0.8), M(0, 0.4, 0), 0xffffff),
    part(new PL(1.0, 0.8), M(0, 0.4, 0, 0, Math.PI / 2, 0), 0xe8f0e0)
  ]);
}

function geoIndustrie() {
  return mergeGeos([
    part(new BX(4.4, 3.2, 3.2), M(0, 1.6, 0), 0x8a6a5c),
    part(new BX(4.6, 0.3, 3.4), M(0, 3.3, 0), 0x6f6a64),
    part(new CY(0.26, 0.32, 3.4, 6), M(-1.3, 4.9, 0.6), 0x9a7a6c),
    part(new CY(0.22, 0.28, 2.4, 6), M(1.2, 4.4, -0.7), 0x9a7a6c)
  ]);
}

function geoKran() {
  return mergeGeos([
    part(new BX(0.55, 6.6, 0.55), M(0, 3.3, 0), 0x9c8468),
    part(new BX(5.2, 0.42, 0.42), M(1.7, 6.4, 0), 0x9c8468),
    part(new BX(2.4, 0.3, 0.3), M(0.7, 5.2, 0, 0, 0, 0.5), 0x8a7358),
    part(new BX(1.5, 0.22, 1.5), M(0, 0.11, 0), 0x8a7358)
  ]);
}

function geoKuppel() {
  return mergeGeos([
    part(new BX(3.4, 2.4, 3.4), M(0, 1.2, 0), 0xf2eee2),
    part(new BX(3.8, 0.3, 3.8), M(0, 2.5, 0), 0xe4dfd0),
    part(new THREE.SphereGeometry(1.7, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2),
      M(0, 2.6, 0, 0, 0, 0, 1, 1.15, 1), 0x36719f),
    part(new CY(0.16, 0.16, 1.1, 6), M(0, 4.6, 0), 0xd8cfae)
  ]);
}

function geoArkade() {
  var parts = [
    part(new BX(4.8, 2.4, 2.6), M(0, 1.2, 0), 0xf0ece0),
    part(new BX(5.1, 0.22, 2.9), M(0, 2.5, 0), 0xe6e0d0),
    part(new BX(4.9, 0.5, 2.7), M(0, 2.85, 0), 0x3d78a8)
  ];
  for (var i = -2; i <= 2; i++) {
    parts.push(part(new CY(0.2, 0.24, 2.2, 7), M(i * 1.05, 1.1, 1.42), 0xe8e3d5));
  }
  return mergeGeos(parts);
}

/** Säulenreihe als Bausteinhilfe. */
function saeulen(parts, n, x0, dx, y, z, r, h, hex) {
  for (var i = 0; i < n; i++) {
    parts.push(part(new CY(r * 0.88, r, h, 8), M(x0 + i * dx, y + h / 2, z), hex));
  }
}

function geoTempel() {
  var parts = [
    part(new BX(7.6, 0.35, 5.0), M(0, 0.17, 0), 0xe2dccb),
    part(new BX(7.0, 0.35, 4.4), M(0, 0.52, 0), 0xece6d6),
    part(new BX(6.4, 0.3, 3.8), M(0, 0.85, 0), 0xf1ece0),
    part(new BX(3.8, 2.5, 2.2), M(0, 2.25, 0), 0xf4f0e6),
    part(new BX(7.0, 0.5, 4.4), M(0, 3.75, 0), 0xece5d4),
    part(prismGeo(4.6, 1.35, 6.8), M(0, 4.0, 0, 0, Math.PI / 2, 0), 0xc07a56)
  ];
  saeulen(parts, 7, -2.7, 0.9, 1.0, 1.75, 0.24, 2.75, 0xf4f0e4);
  saeulen(parts, 7, -2.7, 0.9, 1.0, -1.75, 0.24, 2.75, 0xefe9dc);
  return mergeGeos(parts);
}

function geoTholos() {
  var parts = [
    part(new CY(3.2, 3.4, 0.5, 16), M(0, 0.25, 0), 0xe2dccb),
    part(new CY(2.9, 3.0, 0.35, 16), M(0, 0.65, 0), 0xf1ece0),
    part(new CY(1.5, 1.5, 2.6, 12), M(0, 2.1, 0), 0xf4f0e6),
    part(new CY(2.9, 2.9, 0.4, 16), M(0, 3.6, 0), 0xece5d4),
    part(new CO(3.1, 1.7, 16), M(0, 4.6, 0), 0xc07a56),
    part(new CY(0.14, 0.14, 0.8, 6), M(0, 5.7, 0), 0xd8b45c)
  ];
  for (var i = 0; i < 10; i++) {
    var a = i / 10 * Math.PI * 2;
    parts.push(part(new CY(0.2, 0.23, 2.7, 8),
      M(Math.cos(a) * 2.45, 2.15, Math.sin(a) * 2.45), 0xf4f0e4));
  }
  return mergeGeos(parts);
}

function geoVilla() {
  var parts = [
    part(new BX(5.2, 2.5, 4.2), M(0, 1.25, 0), 0xefe6d2),
    part(new CO(3.7, 1.1, 4), M(0, 3.0, 0, 0, Math.PI / 4, 0, 1.28, 1, 1.05), 0xc07a56),
    part(new BX(5.6, 0.9, 0.28), M(0, 0.45, 2.6), 0xe6dcc6),
    part(new BX(0.28, 0.9, 2.4), M(-2.7, 0.45, 1.5), 0xe6dcc6),
    part(new BX(3.4, 0.3, 1.6), M(0, 2.5, 2.9), 0xc07a56),
    part(new BX(1.0, 1.5, 0.16), M(0, 0.75, 2.12), 0x8d7050)
  ];
  saeulen(parts, 4, -1.35, 0.9, 0, 2.9, 0.16, 2.4, 0xf2ece0);
  return mergeGeos(parts);
}

function geoBogen() {
  var t = new THREE.TorusGeometry(1.75, 0.42, 6, 14, Math.PI);
  return mergeGeos([
    part(new BX(1.1, 3.4, 1.6), M(-2.15, 1.7, 0), 0xe8e1d0),
    part(new BX(1.1, 3.4, 1.6), M(2.15, 1.7, 0), 0xe8e1d0),
    part(t, M(0, 3.4, 0, 0, 0, 0, 1, 1, 2.4), 0xf1ece0),
    part(new BX(5.6, 0.8, 1.9), M(0, 5.6, 0), 0xece5d4),
    part(new BX(4.4, 0.5, 1.5), M(0, 6.2, 0), 0xd8cdb6)
  ]);
}

function geoZwergenhalle() {
  return mergeGeos([
    part(new CY(2.3, 3.1, 3.2, 4), M(0, 1.6, 0, 0, Math.PI / 4, 0), 0x8a857c),
    part(new CY(2.9, 2.9, 0.55, 4), M(0, 3.45, 0, 0, Math.PI / 4, 0), 0x726c62),
    part(new BX(0.8, 0.6, 5.8), M(0, 3.95, 0), 0x4c4841),
    part(new BX(0.9, 2.2, 0.9), M(-2.5, 1.1, 0), 0x625d56),
    part(new BX(0.9, 2.2, 0.9), M(2.5, 1.1, 0), 0x625d56),
    part(new BX(1.2, 1.7, 0.25), M(0, 0.85, 1.85), 0x3a3630),
    part(new BX(1.5, 0.28, 0.3), M(0, 1.85, 1.9), 0xc09a52),
    part(new BX(0.3, 0.3, 0.2), M(-0.9, 2.4, 1.7), 0xc09a52),
    part(new BX(0.3, 0.3, 0.2), M(0.9, 2.4, 1.7), 0xc09a52)
  ]);
}

function geoSchmiedeturm() {
  return mergeGeos([
    part(new CY(1.7, 2.1, 3.6, 6), M(0, 1.8, 0), 0x8a857c),
    part(new CY(2.4, 2.4, 0.45, 6), M(0, 3.8, 0), 0x726c62),
    part(new CO(2.2, 1.5, 6), M(0, 4.7, 0), 0x5b564e),
    part(new CY(0.5, 0.62, 2.8, 6), M(1.0, 5.2, 0.3), 0x625d56),
    part(new BX(1.0, 0.9, 0.2), M(0, 0.9, 1.85), 0xff8a3c),
    part(new BX(1.3, 0.24, 0.28), M(0, 1.5, 1.9), 0xc09a52),
    part(new BX(0.34, 0.34, 0.34), M(-1.5, 0.34, 1.2), 0x5b564e)
  ]);
}

function geoZwergentor() {
  return mergeGeos([
    part(new BX(1.7, 4.2, 1.7), M(-2.4, 2.1, 0), 0x8a857c),
    part(new BX(1.7, 4.2, 1.7), M(2.4, 2.1, 0), 0x8a857c),
    part(new BX(6.6, 1.2, 1.9), M(0, 4.8, 0), 0x625d56),
    part(new BX(1.4, 1.7, 2.1), M(0, 5.8, 0), 0x565149),
    part(new BX(0.9, 0.9, 0.22), M(0, 5.8, 1.1), 0xc09a52),
    part(new BX(0.5, 0.5, 0.2), M(-2.4, 3.4, 0.9), 0xc09a52),
    part(new BX(0.5, 0.5, 0.2), M(2.4, 3.4, 0.9), 0xc09a52)
  ]);
}

function geoElfenturm() {
  var parts = [
    part(new CY(0.6, 1.15, 7.6, 10), M(0, 3.8, 0), 0xf2ecdc),
    part(new CY(1.55, 1.55, 0.22, 10), M(0, 6.1, 0), 0xe8e0cc),
    part(new CO(1.75, 0.95, 10), M(0, 7.6, 0), 0x74b3a2),
    part(new CO(1.25, 1.1, 10), M(0, 8.5, 0), 0x69a998),
    part(new CO(0.8, 1.5, 10), M(0, 9.6, 0), 0x5e9d8d),
    part(new CY(0.09, 0.09, 1.3, 5), M(0, 10.9, 0), 0xd8b45c),
    part(new PL(0.9, 0.5), M(0.45, 11.2, 0, 0, 0, 0.12), 0xe8a08a),
    part(new IC(0.2, 0), M(0, 11.6, 0), 0xf0dc9a),
    part(new BX(0.5, 1.3, 0.14), M(0, 1.0, 1.05), 0xdcd3bc)
  ];
  for (var i = 0; i < 6; i++) {
    var a = i / 6 * Math.PI * 2;
    parts.push(part(new CY(0.09, 0.09, 1.0, 5),
      M(Math.cos(a) * 1.4, 6.6, Math.sin(a) * 1.4), 0xe8e0cc));
  }
  return mergeGeos(parts);
}

function geoPavillon() {
  var parts = [
    part(new CY(2.3, 2.5, 0.35, 8), M(0, 0.17, 0), 0xefe8d6),
    part(new CY(1.9, 1.9, 0.18, 8), M(0, 0.4, 0), 0xe6ddc8),
    part(new CO(2.7, 1.2, 8), M(0, 3.3, 0), 0x6fae9e),
    part(new CO(1.5, 1.1, 8), M(0, 4.1, 0), 0x63a394),
    part(new CY(0.08, 0.08, 0.9, 5), M(0, 4.9, 0), 0xd8b45c)
  ];
  for (var i = 0; i < 6; i++) {
    var a = i / 6 * Math.PI * 2 + 0.3;
    parts.push(part(new CY(0.11, 0.13, 2.3, 6),
      M(Math.cos(a) * 1.75, 1.6, Math.sin(a) * 1.75), 0xf2ecdc));
  }
  return mergeGeos(parts);
}

function geoWindmuehle() {
  var parts = [
    part(new CY(1.35, 2.0, 5.8, 10), M(0, 2.9, 0), 0xf0e8d6),
    part(new CY(2.2, 2.2, 0.2, 10), M(0, 2.2, 0), 0xdcd2ba),
    part(new THREE.SphereGeometry(1.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      M(0, 5.8, 0, 0, 0, 0, 1, 1.1, 1), 0x7a6248),
    part(new CY(0.22, 0.22, 1.4, 6), M(0, 5.7, 1.3, Math.PI / 2, 0, 0), 0x5f4c38),
    part(new BX(1.0, 1.5, 0.16), M(0, 0.75, 1.75), 0x8d7050)
  ];
  for (var i = 0; i < 4; i++) {
    var m = new THREE.Matrix4().makeTranslation(0, 5.7, 1.95);
    m.multiply(new THREE.Matrix4().makeRotationZ(i * Math.PI / 2 + 0.4));
    m.multiply(new THREE.Matrix4().makeTranslation(0, 2.3, 0));
    parts.push(part(new BX(0.55, 4.2, 0.12), m, 0xe8dcc2));
    var m2 = m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0));
    parts.push(part(new BX(0.14, 4.4, 0.2), m2, 0x6f5a44));
  }
  return mergeGeos(parts);
}

function geoScheune() {
  return mergeGeos([
    part(new BX(4.8, 2.4, 3.6), M(0, 1.2, 0), 0xa8664a),
    part(prismGeo(3.9, 1.5, 5.0), M(0, 2.4, 0, 0, Math.PI / 2, 0), 0x6f5a48),
    part(new BX(4.9, 0.18, 0.18), M(0, 1.3, 1.82), 0xe8e0cc),
    part(new BX(0.18, 2.3, 0.18), M(-1.8, 1.2, 1.82), 0xe8e0cc),
    part(new BX(0.18, 2.3, 0.18), M(1.8, 1.2, 1.82), 0xe8e0cc),
    part(new BX(1.6, 1.9, 0.16), M(0, 0.95, 1.85), 0x8d7050)
  ]);
}

function _geoBaum2() {
  return mergeGeos([
    part(new CY(0.18, 0.4, 2.6, 6), M(0, 1.3, 0), 0x6f5a44),
    part(new IC(1.9, 1), M(0, 3.6, 0, 0, 0.3, 0, 1, 0.82, 1), 0x7ba055),
    part(new IC(1.25, 1), M(0.7, 4.7, -0.4, 0.2, 0, 0.15, 1, 0.85, 1), 0x8cb162),
    part(new IC(1.0, 0), M(-0.75, 4.4, 0.5, 0, 0.5, 0, 1, 0.9, 1), 0x6b8f4a)
  ]);
}

function geoFels() {
  var g = new IC(0.95, 0);
  var p = g.attributes.position;
  for (var i = 0; i < p.count; i++) {
    var qx = Math.round(p.getX(i) * 30), qy = Math.round(p.getY(i) * 30), qz = Math.round(p.getZ(i) * 30);
    p.setXYZ(i, p.getX(i) * (0.8 + hashi(qx, qz, 5) * 0.5),
      p.getY(i) * (0.5 + hashi(qy, qx, 9) * 0.35) + 0.42,
      p.getZ(i) * (0.8 + hashi(qz, qy, 13) * 0.5));
  }
  g.computeVertexNormals();
  return part(g, null, 0xb0aca2);
}

function geoPfosten() {
  return mergeGeos([
    part(new BX(0.17, 1.15, 0.17), M(0, 0.58, 0), 0x9c8468),
    part(new BX(1.9, 0.11, 0.09), M(0, 0.86, 0), 0x9c8468),
    part(new BX(1.9, 0.11, 0.09), M(0, 0.52, 0), 0x93795e)
  ]);
}

/* ==========================================================================
   Bauhelfer: Dach mit Ueberstand, Fenster, Tuer, Sockel — die Zutaten, die
   aus Quadern Haeuser machen.
   ========================================================================== */

/** UVs einer Geometrie auf einen festen Punkt setzen (fuer Stamm im Kronen-Pool). */
function uvKonst(geo, u, v) {
  var uv = geo.attributes.uv;
  if (!uv) {
    var n = geo.attributes.position.count;
    geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    uv = geo.attributes.uv;
  }
  for (var i = 0; i < uv.count; i++) uv.setXY(i, u, v);
  return geo;
}

/**
 * Giebeldach mit Ueberstand: ragt an allen Seiten ueber die Wand hinaus,
 * mit sichtbarer Untersicht und dunklem Schattenband darunter.
 * reet = dickere, runder auslaufende Kontur.
 */
function dach(parts, w, d, h, y, hex, reet) {
  var ue = w * (reet ? 0.15 : 0.10);          // Ueberstand 10-15 % der Breite
  var dw = w + ue * 2, dd = d + ue * 2;
  parts.push(part(prismGeo(dw, h, dd), M(0, y, 0), hex));
  if (reet) {                                  // Reet: wulstige Traufkante
    parts.push(part(new BX(dw * 1.02, h * 0.22, dd * 1.04), M(0, y + h * 0.04, 0), hex));
    parts.push(part(new CY(0.16, 0.16, dd * 1.02, 6),
      M(0, y + h + 0.05, 0, Math.PI / 2, 0, 0), 0x8a7a5a));   // Firstwulst
  } else {
    parts.push(part(new BX(0.2, 0.16, dd * 1.02), M(0, y + h + 0.02, 0), 0x6f5a44)); // Firstbalken
  }
  // Untersicht + Schattenband unter der Traufe
  parts.push(part(new BX(dw, 0.10, dd), M(0, y - 0.05, 0), 0x4a4038));
  parts.push(part(new BX(w * 1.01, 0.22, d * 1.01), M(0, y - 0.20, 0), 0x3a332c));
  return parts;
}

/** Eingesenktes Fenster: Rahmen, dunkles Glas, Sprossenkreuz. */
function fenster(parts, x, y, z, w, h, seite) {
  var ry = seite === "z" ? 0 : Math.PI / 2;
  var t = 0.06;
  parts.push(part(new BX(w, h, 0.10), M(x, y, z, 0, ry, 0), 0xe8e0cc));            // Rahmen
  parts.push(part(new BX(w - t * 2, h - t * 2, 0.16), M(x, y, z - (seite === "z" ? 0.05 : 0),
    0, ry, 0), 0x2e3038));                                                          // Glas, eingesenkt
  parts.push(part(new BX(0.04, h - t * 2, 0.12), M(x, y, z, 0, ry, 0), 0xd8d0ba)); // Sprosse
  parts.push(part(new BX(w - t * 2, 0.04, 0.12), M(x, y, z, 0, ry, 0), 0xd8d0ba));
  return parts;
}

/** Tuer mit Sturz und Schwelle. */
function tuer(parts, x, y, z, w, h) {
  parts.push(part(new BX(w, h, 0.14), M(x, y + h / 2, z), 0x5c4a36));
  parts.push(part(new BX(w + 0.24, 0.14, 0.2), M(x, y + h + 0.07, z), 0x8a7a64));  // Sturz
  parts.push(part(new BX(w + 0.3, 0.1, 0.34), M(x, y + 0.02, z), 0x9a938a));       // Schwelle
  return parts;
}

/** Dunklere, rauere Sockelzone. */
function sockel(parts, w, d, hex) {
  parts.push(part(new BX(w * 1.03, 0.5, d * 1.03), M(0, 0.25, 0), hex || 0x8a8278));
  return parts;
}

/* ==========================================================================
   Gebaeude, zweite Fassung: Ueberstand, Fenster, Sockel, Stilmerkmale.
   ========================================================================== */

/** Dorfhaus: Reet oder Ziegel, Fachwerk, Anbauten in drei Varianten. */
function geoHausB(roofHex, variante, reet) {
  var parts = [];
  sockel(parts, 2.8, 2.4);
  parts.push(part(new BX(2.8, 1.9, 2.4), M(0, 1.35, 0), 0xf0ece0));
  // Fachwerkbalken sichtbar vor der Putzflaeche
  parts.push(part(new BX(0.09, 1.9, 0.09), M(-1.36, 1.35, 1.18), 0x6f5a44));
  parts.push(part(new BX(0.09, 1.9, 0.09), M(1.36, 1.35, 1.18), 0x6f5a44));
  parts.push(part(new BX(2.75, 0.09, 0.09), M(0, 2.22, 1.19), 0x6f5a44));
  parts.push(part(new BX(0.09, 1.6, 0.09), M(0.62, 1.3, 1.19, 0, 0, 0.5), 0x6f5a44));
  dach(parts, 2.8, 2.4, 1.5, 2.35, roofHex, reet);
  fenster(parts, -0.7, 1.55, 1.21, 0.55, 0.6, "z");
  fenster(parts, 1.21, 1.55, -0.55, 0.55, 0.6, "x");
  tuer(parts, 0.55, 0.5, 1.22, 0.68, 1.25);
  if (variante === 1) {           // Schuppen-Anbau
    parts.push(part(new BX(1.3, 1.1, 1.5), M(-1.9, 0.55, -0.2), 0xcbb896));
    parts.push(part(prismGeo(1.5, 0.5, 1.7), M(-1.9, 1.1, -0.2, 0, Math.PI / 2, 0), 0x6f5a48));
  } else if (variante === 2) {    // Vordach auf Pfosten
    parts.push(part(new BX(1.6, 0.08, 1.0), M(0.5, 1.35, 1.85, 0.18, 0, 0), roofHex));
    parts.push(part(new CY(0.06, 0.07, 1.3, 5), M(-0.2, 0.65, 2.2), 0x6f5a44));
    parts.push(part(new CY(0.06, 0.07, 1.3, 5), M(1.2, 0.65, 2.2), 0x6f5a44));
  } else if (variante === 3) {    // Holzstapel an der Wand
    for (var i = 0; i < 4; i++) {
      parts.push(part(new CY(0.13, 0.13, 1.0, 5),
        M(-1.55, 0.15 + (i % 2) * 0.24, -0.5 + Math.floor(i / 2) * 0.3, Math.PI / 2, 0, 0), 0x8a7050));
    }
  }
  return mergeGeos(parts);
}

/** Klassisches Stadthaus: Putz, Ziegeldach, Gesims, symmetrische Fenster. */
function geoStadthausB(roofHex) {
  var parts = [];
  sockel(parts, 2.9, 2.5, 0x9a9288);
  parts.push(part(new BX(2.9, 2.3, 2.5), M(0, 1.6, 0), 0xf2eadc));
  parts.push(part(new BX(3.05, 0.14, 2.65), M(0, 2.7, 0), 0xe0d6c4));   // Gesims
  dach(parts, 2.9, 2.5, 1.3, 2.8, roofHex, false);
  fenster(parts, -0.8, 1.9, 1.26, 0.5, 0.66, "z");
  fenster(parts, 0.8, 1.9, 1.26, 0.5, 0.66, "z");
  fenster(parts, 1.26, 1.9, 0, 0.5, 0.66, "x");
  tuer(parts, 0, 0.5, 1.27, 0.7, 1.3);
  return mergeGeos(parts);
}

/* --- Fensterlicht-Anker: lokale Position + Blickrichtung je Haustyp ------
   Beim Platzieren entscheidet die Element-Seed, welche Fenster gluehen. -- */
var FENSTER_ANKER = {
  haus:   [[-0.7, 1.55, 1.24], [1.24, 1.55, -0.55]],
  haus2:  [[-0.8, 1.9, 1.3], [0.8, 1.9, 1.3], [1.3, 1.9, 0]],
  villa:  [[-1.35, 1.4, 2.15], [1.35, 1.4, 2.15]],
  zwergenhalle: [[0, 0.85, 1.9]],
  elfenturm: [[0, 5.2, 1.1], [0, 3.1, 1.05]]
};

/* ==========================================================================
   Baeume als Mischform: Stammgeometrie plus Kronenkarten (gemalte
   Alphasilhouetten auf gekreuzten, gestaffelten Quads).
   ========================================================================== */

/** Kronenquad mit Stiel-Ursprung unten Mitte. */
function kronenQuad(w, h, x, y, z, ry, tiltZ, hex) {
  var g = part(new PL(w, h), M(0, h / 2, 0), hex);
  g.applyMatrix4(M(x, y, z, 0, ry, tiltZ || 0));
  return g;
}

/**
 * Baumart: konischer Stamm (UV auf den opaken Texturrand geklemmt) plus
 * mehrere Kronenkarten in verschiedenen Winkeln und Groessen.
 */
function geoBaumArt(o) {
  var parts = [];
  var stamm = part(new CY(o.stammOben, o.stammUnten, o.stammH, 6),
    M(o.lehne * 0.4, o.stammH / 2, 0, 0, 0, o.lehne * 0.22), o.rinde);
  // Der opake Streifen wird bei fillRect(0, height-4, ...) an den unteren
  // Canvas-Rand gemalt; CanvasTexture laedt mit flipY=true, also liegt er bei
  // v ~ [0, 4/256]. v=0.008 trifft die Streifenmitte — und haelt den Stamm
  // zugleich im Wind still, weil der Shaderpatch mit uv.y gewichtet.
  uvKonst(stamm, 0.5, 0.008);
  parts.push(stamm);
  for (var i = 0; i < o.karten; i++) {
    var a = i / o.karten * Math.PI + hashi(i, 3, o.seed) * 0.8;
    var kw = o.kroneW * (0.75 + hashi(i, 5, o.seed) * 0.5);
    var kh = o.kroneH * (0.8 + hashi(i, 7, o.seed) * 0.4);
    var ox = (hashi(i, 11, o.seed) - 0.5) * o.kroneW * 0.3 + o.lehne * 0.6;
    var oz = (hashi(i, 13, o.seed) - 0.5) * o.kroneW * 0.3;
    parts.push(kronenQuad(kw, kh, ox, o.kroneY + (hashi(i, 17, o.seed) - 0.5) * o.kroneH * 0.22,
      oz, a, (hashi(i, 19, o.seed) - 0.5) * 0.16, o.laub));
  }
  return mergeGeos(parts);
}

var BAUM_LAUBBREIT = { stammOben: 0.16, stammUnten: 0.34, stammH: 2.4, rinde: 0x6f5a44,
  karten: 4, kroneW: 4.2, kroneH: 3.4, kroneY: 2.0, lehne: 0.15, laub: 0x87a45c, seed: 41 };
var BAUM_LAUBHOCH = { stammOben: 0.13, stammUnten: 0.26, stammH: 3.4, rinde: 0x7a6450,
  karten: 3, kroneW: 2.6, kroneH: 4.4, kroneY: 2.6, lehne: 0.08, laub: 0x7d9a52, seed: 43 };
var BAUM_NADEL = { stammOben: 0.10, stammUnten: 0.24, stammH: 1.4, rinde: 0x5f4c3c,
  karten: 3, kroneW: 2.6, kroneH: 4.8, kroneY: 0.9, lehne: 0.04, laub: 0x4e6b48, seed: 47 };
var BAUM_ZYPRESSE = { stammOben: 0.08, stammUnten: 0.16, stammH: 0.8, rinde: 0x6d5a45,
  karten: 3, kroneW: 1.3, kroneH: 5.4, kroneY: 0.55, lehne: 0.05, laub: 0x3f5f45, seed: 53 };
var BAUM_SUMPF = { stammOben: 0.2, stammUnten: 0.42, stammH: 2.8, rinde: 0x5c5244,
  karten: 5, kroneW: 4.6, kroneH: 3.0, kroneY: 2.6, lehne: 0.42, laub: 0x6e8258, seed: 59 };
var BAUM_BLUETE = { stammOben: 0.12, stammUnten: 0.26, stammH: 1.9, rinde: 0x7a6450,
  karten: 4, kroneW: 3.4, kroneH: 2.8, kroneY: 1.7, lehne: 0.12, laub: 0xe3bfc6, seed: 61 };

/* --- Unterwuchs -------------------------------------------------------- */
function geoFarn() {
  return mergeGeos([
    part(new PL(1.6, 1.1), M(0, 0.55, 0), 0x55743f),
    part(new PL(1.6, 1.1), M(0, 0.55, 0, 0, Math.PI / 2, 0), 0x4c6a3a)
  ]);
}
function geoStumpf() {
  return mergeGeos([
    part(new CY(0.34, 0.44, 0.55, 7), M(0, 0.27, 0), 0x6f5a44),
    part(new CY(0.3, 0.3, 0.06, 7), M(0, 0.56, 0), 0xc9b896)
  ]);
}
function geoStammLiegend() {
  return mergeGeos([
    part(new CY(0.22, 0.3, 2.6, 6), M(0, 0.26, 0, 0, 0, Math.PI / 2), 0x6a5744),
    part(new IC(0.34, 0), M(-1.1, 0.3, 0.1, 0, 0, 0, 1, 0.6, 1), 0x5c7042)
  ]);
}
function geoMoos() {
  var g = part(new PL(1.8, 1.8), M(0, 0.04, 0, -Math.PI / 2, 0, 0), 0x4e6b3c);
  // kroneRund traegt bei v<~0.016 den opak weissen Stamm-Anker — den Streifen
  // darf das Moos nicht sampeln, sonst bekommt es einen hellen Saum.
  var uv = g.attributes.uv;
  for (var i = 0; i < uv.count; i++) uv.setY(i, 0.03 + uv.getY(i) * 0.97);
  return g;
}

/* --- Requisiten -------------------------------------------------------- */
function geoFass() {
  return mergeGeos([
    part(new CY(0.32, 0.26, 0.72, 8), M(0, 0.36, 0), 0x8a7050),
    part(new CY(0.335, 0.335, 0.06, 8), M(0, 0.2, 0), 0x55483a),
    part(new CY(0.33, 0.33, 0.06, 8), M(0, 0.55, 0), 0x55483a)
  ]);
}
function geoKiste() {
  return mergeGeos([
    part(new BX(0.6, 0.55, 0.6), M(0, 0.28, 0), 0x9c8468),
    part(new BX(0.64, 0.07, 0.64), M(0, 0.56, 0), 0x8a7358)
  ]);
}
function geoKarren() {
  return mergeGeos([
    part(new BX(1.5, 0.34, 0.9), M(0, 0.62, 0, 0, 0, -0.06), 0x9c8468),
    part(new CY(0.34, 0.34, 0.08, 9), M(-0.35, 0.34, 0.5, Math.PI / 2, 0, 0), 0x6f5a44),
    part(new CY(0.34, 0.34, 0.08, 9), M(-0.35, 0.34, -0.5, Math.PI / 2, 0, 0), 0x6f5a44),
    part(new BX(1.1, 0.07, 0.09), M(1.05, 0.42, 0.18, 0, 0, -0.22), 0x8a7358),
    part(new BX(1.1, 0.07, 0.09), M(1.05, 0.42, -0.18, 0, 0, -0.22), 0x8a7358)
  ]);
}
function geoBrunnen() {
  var parts = [
    part(new CY(0.75, 0.8, 0.7, 9), M(0, 0.35, 0), 0xa9a196),
    part(new CY(0.58, 0.58, 0.72, 9), M(0, 0.37, 0), 0x2e3a40),
    part(new BX(0.1, 1.5, 0.1), M(-0.65, 1.0, 0), 0x6f5a44),
    part(new BX(0.1, 1.5, 0.1), M(0.65, 1.0, 0), 0x6f5a44)
  ];
  dach(parts, 1.5, 1.1, 0.55, 1.7, 0x8a7050, false);
  return mergeGeos(parts);
}
function geoLaterne() {
  return mergeGeos([
    part(new CY(0.05, 0.08, 2.1, 5), M(0, 1.05, 0), 0x4c4841),
    part(new BX(0.26, 0.32, 0.26), M(0, 2.2, 0), 0xffe8b0),
    part(new BX(0.32, 0.06, 0.32), M(0, 2.4, 0), 0x4c4841)
  ]);
}
function geoHeuhaufen() {
  return mergeGeos([
    part(new CO(1.0, 1.5, 8), M(0, 0.75, 0), 0xc9b374),
    part(new CY(0.06, 0.06, 1.7, 5), M(0, 0.85, 0), 0x8a7358)
  ]);
}
function geoMarktstand() {
  var parts = [
    part(new BX(1.8, 0.75, 0.9), M(0, 0.55, 0), 0x9c8468),
    part(new CY(0.06, 0.07, 1.9, 5), M(-0.85, 0.95, 0.4), 0x6f5a44),
    part(new CY(0.06, 0.07, 1.9, 5), M(0.85, 0.95, 0.4), 0x6f5a44),
    part(prismGeo(2.2, 0.5, 1.4), M(0, 1.85, 0, 0, Math.PI / 2, 0), 0xb0574e)
  ];
  return mergeGeos(parts);
}
function geoBoot() {
  return mergeGeos([
    part(new BX(0.85, 0.32, 2.2), M(0, 0.2, 0), 0x8a7050),
    part(new BX(0.6, 0.3, 0.5), M(0, 0.2, 1.25, 0.35, 0, 0), 0x8a7050),
    part(new BX(0.6, 0.3, 0.5), M(0, 0.2, -1.25, -0.35, 0, 0), 0x8a7050),
    part(new BX(0.55, 0.06, 0.3), M(0, 0.38, 0.2), 0x9c8468)
  ]);
}
function geoSteg() {
  var parts = [];
  for (var i = 0; i < 5; i++) {
    parts.push(part(new BX(1.4, 0.08, 0.52), M(0, 0.55, -1.4 + i * 0.7), 0x9c8468));
  }
  parts.push(part(new CY(0.09, 0.11, 1.3, 5), M(-0.55, 0.05, -1.2), 0x6f5a44));
  parts.push(part(new CY(0.09, 0.11, 1.3, 5), M(0.55, 0.05, 0.2), 0x6f5a44));
  parts.push(part(new CY(0.09, 0.11, 1.3, 5), M(-0.55, 0.05, 1.3), 0x6f5a44));
  return mergeGeos(parts);
}
function geoFensterlicht() {
  return part(new PL(0.5, 0.58), M(0, 0, 0.02), 0xffffff);
}

// Unterste Zeile der Kronentexturen opak weiss machen: dort liegen die
// Stamm-UVs, damit Stamm und Krone in einem Pool leben koennen.
["kroneRund", "kroneSchmal", "kroneZerzaust", "kroneNadel"].forEach(function (n) {
  var img = TEX[n].image, ctx = img.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, img.height - 4, img.width, 4);
  TEX[n].needsUpdate = true;
});

var WINDLAUB = { amp: 0.30 };
definePool("baum", geoBaumArt(BAUM_LAUBBREIT), { radius: 2.3, dbl: true, ao: 0.26,
  map: TEX.kroneRund, alphaTest: 0.42, familie: 'laub', wind: WINDLAUB });
definePool("baum2", geoBaumArt(BAUM_LAUBHOCH), { radius: 1.7, dbl: true, ao: 0.24,
  map: TEX.kroneSchmal, alphaTest: 0.42, familie: 'laub', wind: WINDLAUB });
definePool("nadelbaum", geoBaumArt(BAUM_NADEL), { radius: 1.6, dbl: true, ao: 0.24,
  map: TEX.kroneNadel, alphaTest: 0.42, familie: 'laub', wind: { amp: 0.16 } });
definePool("zypresse", geoBaumArt(BAUM_ZYPRESSE), { radius: 1.0, dbl: true, ao: 0.24,
  map: TEX.kroneNadel, alphaTest: 0.42, familie: 'laub', wind: { amp: 0.14 } });
definePool("sumpfbaum", geoBaumArt(BAUM_SUMPF), { radius: 2.6, dbl: true, ao: 0.28,
  map: TEX.kroneZerzaust, alphaTest: 0.4, familie: 'laub', wind: WINDLAUB });
definePool("bluetenbaum", geoBaumArt(BAUM_BLUETE), { radius: 1.9, dbl: true, ao: 0.2,
  map: TEX.kroneRund, alphaTest: 0.42, familie: 'laub', wind: WINDLAUB });

definePool("haus", geoHausB(0x8a7a5a, 0, true), { radius: 2.9, familie: 'reet' });
definePool("hausA", geoHausB(0x9a8862, 1, true), { radius: 3.4, familie: 'reet' });
definePool("hausB", geoHausB(0x36719f, 2, false), { radius: 3.0, familie: 'dachziegel' });
definePool("hausC", geoHausB(0x8a7a5a, 3, true), { radius: 3.0, familie: 'reet' });
definePool("haus2", geoStadthausB(0x36719f), { radius: 2.9, familie: 'putz' });
definePool("turm", geoTurm(), { radius: 2.0, familie: 'putz' });
definePool("mauer", geoMauer(), { radius: 1.2, familie: 'stein' });
definePool("saeule", geoSaeule(), { radius: 0.9, familie: 'stein' });
definePool("feldreihe", geoFeldreihe(), { radius: 0.6, ao: 0.15, familie: 'erde' });
definePool("busch", geoBusch(), { radius: 0.85, dbl: true, familie: 'laub', wind: { amp: 0.14 } });
definePool("gras", geoGras(), { radius: 0.3, dbl: true, ao: 0.18,
  map: TEX.grassTuft, alphaTest: 0.42, familie: 'laub', wind: { amp: 0.4 } });
definePool("blume", part(new PL(1.0, 1.0), M(0, 0.5, 0), 0xffffff),
  { radius: 0.3, dbl: true, ao: 0.1, map: TEX.bluete, alphaTest: 0.42,
    familie: 'laub', wind: { amp: 0.42 } });
definePool("industrie", geoIndustrie(), { radius: 3.4, familie: 'stein' });
definePool("kran", geoKran(), { radius: 2.4, familie: 'holz' });
definePool("rankenblatt", part(new PL(1, 0.5), M(0.5, 0, 0), 0xffffff),
  { radius: 0.8, dbl: true, ao: 0, map: TEX.rankenBlatt, alphaTest: 0.4,
    familie: 'laub', wind: { amp: 0.8 } });
definePool("kuppel", geoKuppel(), { radius: 2.6, familie: 'putz' });
definePool("arkade", geoArkade(), { radius: 2.9, familie: 'putz' });
definePool("fels", geoFels(), { radius: 1.1, familie: 'stein' });
definePool("pfosten", geoPfosten(), { radius: 0.5, familie: 'holz' });
definePool("tempel", geoTempel(), { radius: 4.2, ao: 0.22, familie: 'stein' });
definePool("tholos", geoTholos(), { radius: 3.4, ao: 0.22, familie: 'stein' });
definePool("villa", geoVilla(), { radius: 3.2, familie: 'putz' });
definePool("bogen", geoBogen(), { radius: 3.0, ao: 0.22, familie: 'stein' });
definePool("zwergenhalle", geoZwergenhalle(), { radius: 3.0, familie: 'stein' });
definePool("schmiedeturm", geoSchmiedeturm(), { radius: 2.4, familie: 'stein' });
definePool("zwergentor", geoZwergentor(), { radius: 3.4, familie: 'stein' });
definePool("elfenturm", geoElfenturm(), { radius: 1.9, ao: 0.2, familie: 'putz' });
definePool("pavillon", geoPavillon(), { radius: 2.6, ao: 0.2, familie: 'putz' });
definePool("windmuehle", geoWindmuehle(), { radius: 2.8, ao: 0.22, familie: 'putz' });
definePool("scheune", geoScheune(), { radius: 2.8, familie: 'holz' });

// Unterwuchs und Requisiten
definePool("farn", geoFarn(), { radius: 0.7, dbl: true, ao: 0.2,
  map: TEX.grassTuft, alphaTest: 0.4, familie: 'laub', wind: { amp: 0.3 } });
definePool("stumpf", geoStumpf(), { radius: 0.5, familie: 'rinde' });
definePool("stammliegend", geoStammLiegend(), { radius: 1.4, familie: 'rinde' });
definePool("moos", geoMoos(), { radius: 0.6, dbl: true, ao: 0,
  map: TEX.kroneRund, alphaTest: 0.42, familie: 'laub' });
definePool("fass", geoFass(), { radius: 0.4, familie: 'holz' });
definePool("kiste", geoKiste(), { radius: 0.45, familie: 'holz' });
definePool("karren", geoKarren(), { radius: 1.2, familie: 'holz' });
definePool("brunnen", geoBrunnen(), { radius: 1.1, familie: 'stein' });
definePool("laterne", geoLaterne(), { radius: 0.35, familie: 'metall' });
definePool("heuhaufen", geoHeuhaufen(), { radius: 1.1, familie: 'stoff' });
definePool("marktstand", geoMarktstand(), { radius: 1.4, familie: 'stoff' });
definePool("boot", geoBoot(), { radius: 1.3, familie: 'holz' });
definePool("steg", geoSteg(), { radius: 1.6, familie: 'holz' });
definePool("fensterlicht", geoFensterlicht(), { radius: 0, ao: 0, dbl: true,
  familie: 'putz', emissive: 0xffc878, emissiveIntensity: 0 });

setPoolNames();

export { mergeGeos, M, part, prismGeo, tubeGeo, leafHalfWidth, leafSurface, leafGeo,
  moundGeo, islandGeo, FENSTER_ANKER };
