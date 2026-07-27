// Alle Basisgeometrien (aus Primitiven), Blatt-/Huegel-/Inselformen und die
// Pool-Registrierung. mergeGeos bleibt eine eigene Implementierung: die Bausteine
// mischen indizierte und nicht indizierte Geometrie und fuellen fehlende
// Farbattribute auf - beides deckt mergeGeometries aus den Addons nicht ab.
import * as THREE from 'three';
import { clamp, lerp, sstep, hashi, vnoise, fractal, rngOf, rr, ri } from '../core/rng.js';
import { TEX } from '../render/textures.js';
import { definePool, setPoolNames } from '../core/pools.js';
// I1: die Kartenzeichen. Umgekehrter Weg waere ein Zyklus — siehe unten.
import { registriereSignaturPools } from '../render/signaturen.js';
import { terrainColor, heightAt } from '../world/terrain.js';
// B4 — Bruchdrift: render/materials.js braucht das Uniform-Buendel der
// Bruchmaske, darf paths.js aber nicht selbst importieren (paths.js legt beim
// Modulstart Materialien an; der umgekehrte Zyklus laesst FAMILIEN in der TDZ
// auflaufen und die App gar nicht erst starten). Diese Datei ist die richtige
// Stelle fuer die Weitergabe: hier stehen ohnehin die Pools, die driften.
// Uebergeben wird der NAMENSRAUM, nicht der Wert — materials.js liest ihn erst
// in onBeforeCompile, dann ist paths.js in jeder Einstiegsreihenfolge fertig.
// (Gegenprobe: eine Kopie beim Modulstart waere bei Einstieg ueber paths.js
// `undefined`, weil bruchMaskeUniforms dort ein noch nicht belegtes `var` ist.)
import * as PFADE from './paths.js';
import { setBruchQuelle } from '../render/materials.js';
setBruchQuelle(PFADE);

/* --- B4: Amplituden der Bruchdrift (Welteinheiten) ----------------------
   Nur ZWEI Werte, damit die Programmzahl nicht ausufert: der Cache-Schluessel
   in materials.js traegt die Amplitude, jede weitere Zahl waere eine weitere
   Shader-Permutation je Materialfamilie.
     LEICHT  — Blattwerk, Bodenflor, Leuchtwerk: reisst sofort ab und taumelt.
     BROCKEN — Stein, Stumpf, Geroell: schwer, hebt und dreht sich nur traege.
   Schwere Bauten (Haeuser, Tuerme, Mauern, Bruecken) bekommen KEINE Drift —
   ein schwebendes Haus waere kein Detail mehr, sondern eine andere Erzaehlung. */
const DRIFT_LEICHT = 0.55;
const DRIFT_BROCKEN = 0.28;

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
  normalenRetten(out);
  out.computeBoundingSphere();
  return out;
}

/**
 * Sicherheitsnetz gegen Normalen der Laenge 0. Die entstehen ueberall dort, wo
 * computeVertexNormals nur entartete Dreiecke zu addieren hatte — am haeufigsten
 * hinter `bruchkante` (zwei auf dieselbe Ebene geklappte Ecken ergeben ein
 * Dreieck ohne Flaeche), vereinzelt auch in flach skalierten Primitiven. Im
 * Bild sind das unbeleuchtete, also schwarze Vertices; sie fallen erst im
 * Streiflicht auf und sind dann nicht mehr zuzuordnen.
 *
 * Ersatzrichtung ist die Achse vom Schwerpunkt nach aussen: fuer Rand- und
 * Bruchvertices, wo der Fall auftritt, zeigt sie verlaesslich vom Koerper weg.
 * Nur INDIZIERTE Vertices werden angefasst — ein Vertex ohne Dreieck wird nie
 * gezeichnet, den zu reparieren waere Kosmetik an der Messung.
 * Der Schnelltest laeuft leer durch, wenn nichts zu tun ist (Regelfall).
 */
function normalenRetten(g) {
  var nor = g.attributes.normal.array, pos = g.attributes.position.array;
  var n = g.attributes.position.count, i, kaputt = 0;
  for (i = 0; i < n; i++) {
    var a = nor[i * 3], b = nor[i * 3 + 1], c = nor[i * 3 + 2];
    if (a * a + b * b + c * c < 1e-12) { kaputt++; break; }
  }
  if (!kaputt) return 0;
  var benutzt = new Uint8Array(n), ix = g.index.array;
  for (i = 0; i < ix.length; i++) benutzt[ix[i]] = 1;
  var cx = 0, cy = 0, cz = 0, m = 0;
  for (i = 0; i < n; i++) {
    if (!benutzt[i]) continue;
    cx += pos[i * 3]; cy += pos[i * 3 + 1]; cz += pos[i * 3 + 2]; m++;
  }
  if (!m) return 0;
  cx /= m; cy /= m; cz /= m;
  var fix = 0;
  for (i = 0; i < n; i++) {
    if (!benutzt[i]) continue;
    var x = nor[i * 3], y = nor[i * 3 + 1], z = nor[i * 3 + 2];
    if (x * x + y * y + z * z >= 1e-12) continue;
    var dx = pos[i * 3] - cx, dy = pos[i * 3 + 1] - cy, dz = pos[i * 3 + 2] - cz;
    var l = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (l < 1e-6) { nor[i * 3] = 0; nor[i * 3 + 1] = 1; nor[i * 3 + 2] = 0; }
    else { nor[i * 3] = dx / l; nor[i * 3 + 1] = dy / l; nor[i * 3 + 2] = dz / l; }
    fix++;
  }
  return fix;
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

function geoBaum2() {
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
   Wehrbau- und Ausbauhelfer: Zinnen, Arkaden, Treppen, Dachlandschaft,
   Fachwerk, Bruchkante. Sie tragen Kategorie 1 des Objektkatalogs und werden
   von den spaeteren Buendeln (Kloster, Verkehr, Ruinen) mitbenutzt.
   ========================================================================== */

/**
 * Zinnenkranz. Alle drei Grundrisse setzen dieselbe Merlon-Zelle und
 * unterscheiden nur die Bahn — als drei Helfer stuende der Merlon dreimal im
 * Code, und die vierzehn Wehrbau-Pools muessten sich fuer einen entscheiden.
 * opt.form:
 *   "rund"  — n Merlonen tangential auf dem Kreis mit Radius w; opt.bogen
 *             begrenzt den Kranz und opt.mitte dreht ihn (Halbschale der
 *             Barbakane, die nur nach vorn Zinnen traegt),
 *   "reihe" — eine gerade Bahn der Laenge w entlang opt.achse ("x" oder "z";
 *             Aussenseite einer Mauer, deren Innenseite nur eine Brustwehr
 *             traegt — Mauerschenkel laufen in beide Richtungen), opt.dreh
 *             kippt die Bahn um die Hochachse (schraege Bastionsfacen),
 *   sonst   — geschlossener Ring um das Rechteck w x d.
 * y ist die Oberkante des Wehrgangs, opt.x/opt.z verschieben den Grundriss
 * (Mauerschenkel sitzen neben dem Ursprung, nicht darauf).
 */
function zinnen(parts, w, d, y, hex, n, opt) {
  opt = opt || {};
  var hz = opt.hoehe || 0.44, t = opt.staerke || 0.24;
  var x0 = opt.x || 0, z0 = opt.z || 0, i;
  if (opt.form === "rund") {
    var sp = opt.bogen === undefined ? Math.PI * 2 : opt.bogen;
    var voll = sp >= Math.PI * 2 - 1e-6, mitte = opt.mitte || 0;
    var br = sp * w / n * 0.56;             // 56 % Deckung, der Rest bleibt Scharte
    for (i = 0; i < n; i++) {
      var a = mitte + (voll ? i / n : (n > 1 ? i / (n - 1) : 0.5) - 0.5) * sp;
      parts.push(part(new BX(t, hz, br),
        M(x0 + Math.cos(a) * w, y + hz / 2, z0 + Math.sin(a) * w, 0, -a, 0), hex));
    }
    return parts;
  }
  var bx = w / n * 0.58;
  if (opt.form === "reihe") {
    var laengsZ = opt.achse === "z";
    var dr = opt.dreh || 0, cd = Math.cos(dr), sd = Math.sin(dr);
    for (i = 0; i < n; i++) {
      var pu = -w / 2 + (i + 0.5) * (w / n);
      var ux = laengsZ ? 0 : pu, uz = laengsZ ? pu : 0;
      parts.push(part(laengsZ ? new BX(t, hz, bx) : new BX(bx, hz, t),
        M(x0 + ux * cd + uz * sd, y + hz / 2, z0 - ux * sd + uz * cd, 0, dr, 0), hex));
    }
    return parts;
  }
  for (i = 0; i < n; i++) {
    var px = x0 - w / 2 + (i + 0.5) * (w / n);
    parts.push(part(new BX(bx, hz, t), M(px, y + hz / 2, z0 + d / 2 - t / 2), hex));
    parts.push(part(new BX(bx, hz, t), M(px, y + hz / 2, z0 - d / 2 + t / 2), hex));
  }
  var m = Math.max(1, Math.round(n * d / w));
  for (i = 0; i < m; i++) {
    var pz = z0 - d / 2 + (i + 0.5) * (d / m), bz = d / m * 0.58;
    parts.push(part(new BX(t, hz, bz), M(x0 + w / 2 - t / 2, y + hz / 2, pz), hex));
    parts.push(part(new BX(t, hz, bz), M(x0 - w / 2 + t / 2, y + hz / 2, pz), hex));
  }
  return parts;
}

/**
 * Arkade: n Halbboegen der lichten Weite spann zwischen n+1 Pfeilern; y ist
 * die Standflaeche, hoehe die Kaempferhoehe. Die Boegen sind TorusGeometry mit
 * thetaLength = PI, in z auf die Bautiefe gestreckt — dieselbe Bauweise wie im
 * Bestand (geoBogen). Aus BX-Segmenten gestueckelt kostete derselbe Bogen mehr
 * Dreiecke, braeuchte je Segment eine eigene Drehmatrix und liesse am
 * Pfeileransatz eine Fuge stehen, die der Torus von sich aus schliesst.
 */
function bogenreihe(parts, n, spann, hoehe, y, hex, tiefe, pfeilerB) {
  var pw = pfeilerB || spann * 0.32, t = tiefe || spann * 0.6;
  var schritt = spann + pw, x0 = -n * schritt / 2;
  var r = schritt / 2, tube = pw * 0.42;          // Bogen setzt in der Pfeilermitte an
  var bogen = new THREE.TorusGeometry(r, tube, 5, 7, Math.PI);
  var i;
  for (i = 0; i <= n; i++) {
    parts.push(part(new BX(pw, hoehe, t), M(x0 + i * schritt, y + hoehe / 2, 0), hex));
  }
  for (i = 0; i < n; i++) {
    parts.push(part(bogen, M(x0 + (i + 0.5) * schritt, y + hoehe, 0,
      0, 0, 0, 1, 1, t / (tube * 2)), hex));
  }
  return parts;
}

/**
 * Gerader Stufenlauf, ansteigend in +z ab (x, y, z). Jede Stufe ist ein Block
 * bis zum Boden statt einer schwebenden Platte: gleiche Dreieckszahl, aber der
 * Lauf bleibt von der Seite geschlossen. wangeHex setzt zwei Schraegwangen.
 * (Die Wendelvariante haengt in vines.js an der Rankenachse und bleibt dort.)
 */
function treppe(parts, n, breite, steigung, x, y, z, hex, wangeHex) {
  var auftritt = steigung * 1.35, i;
  for (i = 0; i < n; i++) {
    var h = steigung * (i + 1);
    parts.push(part(new BX(breite, h, auftritt),
      M(x, y + h / 2, z + (i + 0.5) * auftritt), hex));
  }
  if (wangeHex !== undefined) {
    var lauf = n * auftritt, stieg = n * steigung;
    var lang = Math.sqrt(lauf * lauf + stieg * stieg);
    var neig = Math.atan2(stieg, lauf);
    for (var s = -1; s <= 1; s += 2) {
      parts.push(part(new BX(0.14, 0.34, lang),
        M(x + s * (breite / 2 + 0.06), y + stieg / 2 + 0.12, z + lauf / 2,
          -neig, 0, 0), wangeHex));
    }
  }
  return parts;
}

/**
 * Walmdach als Sechs-Punkt-Koerper: vier Traufecken und ein in z verkuerzter
 * First. firstAnteil = 1 ergibt das Giebelprisma, 0 die Pyramide; der
 * Krueppelwalm liegt dazwischen und ist mit prismGeo allein nicht baubar.
 */
function walmGeo(w, h, d, firstAnteil) {
  var hw = w / 2, hd = d / 2, fd = hd * clamp(firstAnteil, 0, 1);
  var A = [-hw, 0, -hd], B = [hw, 0, -hd], C = [hw, 0, hd], D = [-hw, 0, hd];
  var E = [0, h, -fd], F = [0, h, fd];
  var tri = [D, C, F,  B, A, E,  B, F, C,  B, E, F,
             A, F, E,  A, D, F,  A, B, C,  A, C, D];
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
 * Reicheres Dach als dach(): Walm, Krueppelwalm oder Mansarde, dazu Gauben und
 * Kamine, alles aus der Seed bestimmt. dach() bleibt unveraendert, weil der
 * Bestand auf seine Proportionen eingemessen ist — neue Bauten nehmen diese
 * Variante, damit die Dachlinie einer Siedlung nicht viermal dieselbe ist.
 */
function dachlandschaft(parts, w, d, y, hex, seed) {
  var art = Math.floor(hashi(3, 5, seed) * 3);          // 0 Walm, 1 Krueppelwalm, 2 Mansarde
  // Ueberstand aus der KURZEN Seite: dach() rechnet ihn aus w, was bei den
  // langgestreckten Bauten hier (Palas, Schlossfluegel) einen Meter Dachrand
  // ueber der Traufe ergaebe.
  var ue = Math.min(w, d) * 0.11, dw = w + ue * 2, dd = d + ue * 2;
  var h = Math.min(w, d) * (0.5 + hashi(5, 7, seed) * 0.3);
  var knick = new THREE.Color(hex).multiplyScalar(0.86).getHex();
  var hUnten = art === 2 ? h * 0.58 : h, firstY, i;
  if (art === 2) {                                       // Mansarde: steil, dann flach
    parts.push(part(walmGeo(dw, hUnten, dd, 0.5), M(0, y, 0), hex));
    parts.push(part(new BX(dw * 0.66, 0.12, dd * 0.66), M(0, y + hUnten, 0), knick));
    parts.push(part(walmGeo(dw * 0.62, h * 0.52, dd * 0.62, 0.7), M(0, y + hUnten, 0), hex));
    firstY = y + hUnten + h * 0.52;
  } else {
    parts.push(part(walmGeo(dw, h, dd, art === 0 ? 0.3 : 0.74), M(0, y, 0), hex));
    firstY = y + h;
  }
  parts.push(part(new BX(dw, 0.10, dd), M(0, y - 0.05, 0), 0x4a4038));    // Untersicht
  parts.push(part(new BX(w * 1.01, 0.22, d * 1.01), M(0, y - 0.20, 0), 0x3a332c));
  // Gauben auf den Traufseiten. Der Fusspunkt wird aus der Dachflaeche
  // gerechnet (die Flanke faellt von x = 0 nach x = dw/2 auf 0 ab), sonst
  // haengen sie je nach Dachart in der Luft oder stecken im Dach.
  var nG = Math.floor(hashi(11, 13, seed) * 3), rel = 0.52;
  for (i = 0; i < nG; i++) {
    var s = i % 2 === 0 ? 1 : -1;
    var gx = dw * 0.5 * rel * s, gz = (hashi(i, 23, seed) - 0.5) * dd * 0.5;
    var gy = y + hUnten * (1 - rel);
    parts.push(part(prismGeo(0.66, 0.36, 0.72),
      M(gx, gy, gz, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2, 0), hex));
    parts.push(part(new BX(0.32, 0.34, 0.1),
      M(gx + s * 0.32, gy + 0.17, gz, 0, Math.PI / 2, 0), 0x2e3038));
  }
  var nK = 1 + Math.floor(hashi(17, 19, seed) * 2);
  for (i = 0; i < nK; i++) {
    var kz = (hashi(i, 29, seed) - 0.5) * dd * 0.55;
    parts.push(part(new BX(0.3, 1.0, 0.3), M(0.06, firstY - 0.25, kz), 0x9a8e80));
    parts.push(part(new BX(0.44, 0.1, 0.44), M(0.06, firstY + 0.3, kz), 0x8a7e70));
    parts.push(part(new BX(0.2, 0.06, 0.2), M(0.06, firstY + 0.33, kz), 0x2a2622));
  }
  return parts;
}

/**
 * Fachwerkraster auf EINER Wandflaeche: Schwelle, Raehm, Staender und je nach
 * muster Riegel, Eckstreben oder Andreaskreuze. seite wie bei fenster(): "z" =
 * die Flaeche blickt in z-Richtung und liegt bei z = versatz, sonst blickt sie
 * in x-Richtung und liegt bei x = versatz. Aus einer Seed entstehen so ganze
 * Fassadenfamilien statt der vier handverdrahteten Balken in geoHausB.
 * muster 0 ist das reine Gitter und dient auch als Fallgitter/Gatter.
 */
function fachwerk(parts, w, h, versatz, seite, muster, seed, hex) {
  var holz = hex === undefined ? 0x6f5a44 : hex;
  var t = 0.09, ry = seite === "z" ? 0 : Math.PI / 2, i;
  /** u = Laengskoordinate auf der Wand, v = Hoehe ueber dem Wandfuss. */
  function balken(bw, bh, u, v, dreh) {
    parts.push(part(new BX(bw, bh, t),
      M(seite === "z" ? u : versatz, v, seite === "z" ? versatz : u, 0, ry, dreh || 0), holz));
  }
  var felder = Math.max(2, Math.round(w / 1.1) + (hashi(2, 3, seed) < 0.5 ? 0 : 1));
  var fb = w / felder;
  balken(w, 0.14, 0, 0.07);                                   // Schwelle
  balken(w, 0.14, 0, h - 0.07);                               // Raehm
  for (i = 0; i <= felder; i++) balken(0.13, h, -w / 2 + i * fb, h / 2);   // Staender
  if (muster === 0) {
    var rn = Math.max(1, Math.round(h / 0.8));
    for (i = 1; i < rn; i++) balken(w, 0.11, 0, h * i / rn);
    return parts;
  }
  balken(w, 0.12, 0, h * 0.52);                               // durchlaufender Riegel
  var dia = Math.sqrt(fb * fb + h * h * 0.25), wink = Math.atan2(h * 0.5, fb);
  for (i = 0; i < felder; i++) {
    var u0 = -w / 2 + (i + 0.5) * fb;
    if (muster === 2 || (muster === 3 && hashi(i, 11, seed) < 0.6)) {
      balken(dia, 0.11, u0, h * 0.26, wink);                  // Andreaskreuze
      balken(dia, 0.11, u0, h * 0.26, -wink);
      balken(dia, 0.11, u0, h * 0.76, wink);
      balken(dia, 0.11, u0, h * 0.76, -wink);
    } else if (i === 0 || i === felder - 1) {
      balken(dia, 0.11, u0, h * 0.26, i === 0 ? wink : -wink);   // Eckstreben
      balken(dia, 0.11, u0, h * 0.76, i === 0 ? -wink : wink);
    }
  }
  return parts;
}

/**
 * Kappt eine fertige Geometrie an einer verrauschten Ebene zu einer gebrochenen
 * Kante: Vertices jenseits der Ebene werden auf sie zurueckgezogen, komplett
 * jenseitige Dreiecke fallen weg. Bewusst kein echtes Clipping — bei diesem
 * Poly-Budget ist das Zackenprofil von einem echten Schnitt nicht zu
 * unterscheiden, es entstehen aber keine neuen Vertices, und die Vertexfarben
 * bleiben unangetastet (nur position und index werden geschrieben).
 * ebene: { nx, ny, nz, wert, rauheit } — die Normale zeigt auf die Seite, die
 * abbricht, wert ist ihr Abstand vom Ursprung.
 * Indizierte UND nicht indizierte Eingaben sind zulaessig; die Bausteine
 * mischen beides (siehe mergeGeos). Das Ergebnis ist immer indiziert.
 */
/** Kreuzprodukt der beiden Kanten: kleiner als eine hundertstel Quadrat-
 *  einheit heisst "keine Flaeche" — bei Bauteilen im Meter-Massstab liegt
 *  jedes echte Dreieck weit darueber. */
function dreieckEntartet(pos, a, b, c) {
  var ax = pos.getX(a), ay = pos.getY(a), az = pos.getZ(a);
  var ux = pos.getX(b) - ax, uy = pos.getY(b) - ay, uz = pos.getZ(b) - az;
  var vx = pos.getX(c) - ax, vy = pos.getY(c) - ay, vz = pos.getZ(c) - az;
  var kx = uy * vz - uz * vy, ky = uz * vx - ux * vz, kz = ux * vy - uy * vx;
  return kx * kx + ky * ky + kz * kz < 1e-8;
}

function bruchkante(geo, ebene, seed) {
  var nx = ebene.nx || 0, ny = ebene.ny === undefined ? 1 : ebene.ny, nz = ebene.nz || 0;
  var len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  nx /= len; ny /= len; nz /= len;
  var wert = ebene.wert || 0, rau = ebene.rauheit === undefined ? 0.4 : ebene.rauheit;
  var pos = geo.attributes.position, n = pos.count, i;
  var s = new Float32Array(n);
  for (i = 0; i < n; i++) {
    var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // Rauschen ueber die QUANTISIERTE Position (Muster geoFels/islandGeo):
    // doppelt gefuehrte Ecken derselben Stelle bekommen denselben Versatz,
    // sonst klaffen die Teilflaechen an der Bruchkante auseinander.
    var qa = Math.round((x * 3.1 + z * 1.7) * 8), qb = Math.round((y * 2.3 + z * 0.9) * 8);
    var d = x * nx + y * ny + z * nz - wert + (hashi(qa, qb, seed) - 0.5) * rau;
    s[i] = d;
    if (d > 0) pos.setXYZ(i, x - nx * d, y - ny * d, z - nz * d);
  }
  var alt = geo.index ? geo.index.array : null;
  var anz = alt ? alt.length : n, behalten = [];
  for (i = 0; i + 2 < anz; i += 3) {
    var a = alt ? alt[i] : i, b = alt ? alt[i + 1] : i + 1, c = alt ? alt[i + 2] : i + 2;
    if (s[a] > 0 && s[b] > 0 && s[c] > 0) continue;      // ganz jenseits: faellt weg
    // Ein Dreieck mit ZWEI Ecken jenseits behaelt beide — sie landen aber auf
    // derselben Ebene und liegen dort oft aufeinander. Uebrig bleibt ein
    // Dreieck ohne Flaeche: unsichtbar, aber computeVertexNormals addiert ihm
    // eine Normale der Laenge 0, und der Vertex wird schwarz. Gemessen betraf
    // das bis zu 27 % der Vertices eines Ruinen-Pools. Also hier aussortieren,
    // wo die Ursache sitzt, statt die Normale hinterher zu flicken.
    if (dreieckEntartet(pos, a, b, c)) continue;
    behalten.push(a, b, c);
  }
  geo.setIndex(new THREE.BufferAttribute(
    n > 65535 ? new Uint32Array(behalten) : new Uint16Array(behalten), 1));
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/* ==========================================================================
   Schiffbau- und Stoffhelfer: Rumpf, Takelage, gespannte Bahn. Sie tragen
   Kategorie 2 des Objektkatalogs und werden von Zelten, Planen und Markisen
   der spaeteren Buendel mitbenutzt. Bewusst OHNE die Maritim-Palette weiter
   unten: als allgemeine Helfer bringen sie ihre Vorgabefarben selbst mit.
   ========================================================================== */

/**
 * Setzt die uv aller bereits gesammelten Teile auf einen festen Punkt.
 * Zwei Gruende, beide unverzichtbar, sobald ein Pool Stoffbahnen enthaelt:
 * der Wind-Shader gewichtet die Auslenkung mit uv.y (BX/CY/PL bringen echte
 * uv von 0..1 mit und wuerden sonst mitschwingen), und ein Pool mit
 * alphaTest-Karte muss seine starren Teile auf den opaken Texturstreifen
 * klemmen (Muster geoBaumArt: v = 0.008). Danach angehaengte zeltbahn-Flaechen
 * behalten ihre eigenen uv und schwingen als Einzige.
 */
function starr(parts, ab, v) {
  for (var i = ab || 0; i < parts.length; i++) uvKonst(parts[i], 0.5, v || 0);
  return parts;
}

/**
 * Schiffsrumpf als gelofteter Koerper: laengs gekruemmter Kiel (Aufkimmung an
 * Bug und Heck), sich zu den Enden verjuengende Spanten, darauf ein Deck.
 * Bug zeigt nach +z. y = 0 IST DIE WASSERLINIE — damit steht derselbe Rumpf
 * richtig im Wasser, egal ob tryPlaceWasser ihn auf WATER setzt oder ein
 * Kompositum ihn auf die Helling hebt.
 * l/b/h = Laenge/Breite/Rumpfhoehe (Kiel bis Schandeck mittschiffs),
 * sprung = Deckssprung, also die Ueberhoehung des Decks an den Enden.
 * Kahn bis Dreimaster unterscheiden sich NUR in diesen vier Zahlen; deshalb
 * ist der Rumpf ein Generator und kein Satz fertiger Geometrien.
 * Rueckgabe ist eine fertig eingefaerbte Geometrie (Muster geoFels/leafGeo):
 * unter der Wasserlinie laeuft sie in den Teerton aus, part() darf also NICHT
 * mehr darueber, das wuerde die Faerbung platt schreiben.
 */
function rumpf(l, b, h, sprung, hex) {
  var NL = 8, NV = 6, NB = 2, i, j;
  var pos = [], col = [], idx = [];
  var c = new THREE.Color(hex), teer = new THREE.Color(0x453a30), tmp = new THREE.Color();
  var halb = [], kiel = [], deck = [];
  for (i = 0; i <= NL; i++) {
    var t = i / NL, voll = Math.sin(Math.PI * t);
    halb.push(b * 0.5 * Math.pow(voll, 0.5) * (0.7 + 0.3 * voll));
    kiel.push(-h * 0.6 * (0.4 + 0.6 * Math.pow(voll, 0.7)));
    // vorn staerker ueberhoeht als achtern — so sitzt jedes Rundspantboot
    deck.push(h * 0.4 + sprung * Math.pow(Math.abs(t * 2 - 1), 1.7) * (t > 0.5 ? 1.2 : 0.85));
  }
  function schreib(x, y, z, unter) {
    tmp.copy(c);
    if (unter > 0) tmp.lerp(teer, clamp(unter, 0, 1) * 0.75);
    // Rauschen ueber die QUANTISIERTE Lage (Muster geoFels): eine Planke
    // behaelt ihren Ton, auch wenn zwei Flaechen dieselbe Ecke fuehren.
    tmp.multiplyScalar(0.95 + hashi(Math.round(x * 8), Math.round(z * 8), 311) * 0.1);
    pos.push(x, y, z); col.push(tmp.r, tmp.g, tmp.b);
  }
  // Aussenhaut: j laeuft vom Backbord-Schandeck ueber den Kiel nach Steuerbord.
  // Der Exponent 0.72 auf sin(a) macht die Kimm voll statt spitz — ein reines
  // sin ergaebe ein V-Boot, das nur als Rennruderer taugt.
  for (i = 0; i <= NL; i++) {
    for (j = 0; j <= NV; j++) {
      var a = Math.PI * j / NV;
      var y = deck[i] - (deck[i] - kiel[i]) * Math.pow(Math.sin(a), 0.72);
      schreib(-Math.cos(a) * halb[i], y, (i / NL - 0.5) * l, -y / (h * 0.5));
    }
  }
  for (i = 0; i < NL; i++) {
    for (j = 0; j < NV; j++) {
      var a0 = i * (NV + 1) + j, b0 = a0 + 1, c0 = a0 + NV + 1, d0 = c0 + 1;
      idx.push(a0, b0, c0, b0, d0, c0);         // Umlauf so, dass die Normale nach aussen zeigt
    }
  }
  // Deck etwas unter der Schandeckkante: der Rest der Aussenhaut steht dann von
  // selbst als Schanzkleid darueber und kostet kein eigenes Bauteil.
  var ds = pos.length / 3;
  for (i = 0; i <= NL; i++) {
    for (j = 0; j <= NB; j++) {
      schreib((j / NB * 2 - 1) * halb[i] * 0.88, deck[i] - h * 0.16, (i / NL - 0.5) * l, -1);
    }
  }
  for (i = 0; i < NL; i++) {
    for (j = 0; j < NB; j++) {
      var e0 = ds + i * (NB + 1) + j, f0 = e0 + 1, g0 = e0 + NB + 1, h0 = g0 + 1;
      idx.push(e0, g0, f0, f0, g0, h0);
    }
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Gespannte Stoffbahn zwischen VIER Eckpunkten: pts = [oben-links, oben-rechts,
 * unten-rechts, unten-links], wobei "oben" die Kante ist, an der die Bahn
 * haengt. durchhang beult die Flaeche ENTGEGEN ihrer Normalen aus (Normale =
 * (p1-p0) x (p3-p0)) — eine waagerecht gespannte Plane sackt damit nach unten
 * durch, ein senkrechtes Segel bauscht sich nach Lee. Reihenfolge der Ecken
 * und Vorzeichen von durchhang bestimmen also die Richtung; ein flaches PL
 * bekommt diesen Bauch nie hin, und genau daran erkennt man Stoff.
 * Die uv laufen mit v = 0 an der Aufhaengung und v = 1 an der freien Kante:
 * der Wind-Shader gewichtet mit uv.y, der Saum schwingt, die Naht nicht.
 */
function zeltbahn(parts, pts, durchhang, hex) {
  var NU = 5, NV = 3, i, j;
  var p0 = pts[0], p1 = pts[1], p2 = pts[2], p3 = pts[3];
  var e1 = new THREE.Vector3().subVectors(p1, p0);
  var e2 = new THREE.Vector3().subVectors(p3, p0);
  var nrm = new THREE.Vector3().crossVectors(e1, e2);
  if (nrm.lengthSq() < 1e-9) nrm.set(0, 1, 0);     // entartete Ecken: nach oben ausbeulen
  nrm.normalize();
  var anz = (NU + 1) * (NV + 1);
  var pos = new Float32Array(anz * 3), uv = new Float32Array(anz * 2), idx = [];
  var a = new THREE.Vector3(), b = new THREE.Vector3();
  for (i = 0; i <= NU; i++) {
    var u = i / NU;
    a.lerpVectors(p0, p1, u);
    b.lerpVectors(p3, p2, u);
    for (j = 0; j <= NV; j++) {
      var v = j / NV, k = i * (NV + 1) + j;
      // Beide Ränder festgehalten, Maximum in der Mitte — das ist die
      // Naeherung einer an allen vier Ecken angeschlagenen Bahn.
      var s = durchhang * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
      pos[k * 3] = a.x + (b.x - a.x) * v - nrm.x * s;
      pos[k * 3 + 1] = a.y + (b.y - a.y) * v - nrm.y * s;
      pos[k * 3 + 2] = a.z + (b.z - a.z) * v - nrm.z * s;
      uv[k * 2] = u; uv[k * 2 + 1] = v;
    }
  }
  for (i = 0; i < NU; i++) {
    for (j = 0; j < NV; j++) {
      var q = i * (NV + 1) + j;
      idx.push(q, q + 1, q + NV + 1, q + 1, q + NV + 2, q + NV + 1);
    }
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  parts.push(part(g, null, hex));
  return parts;
}

/**
 * Takelage: Masten, Rahen, Segel und Wanten — bewusst getrennt vom Rumpf,
 * damit Wrack und Floss sie einfach weglassen.
 * masten: [{ x, z, h, r, rake, wx, wy }] — Fusspunkt, Hoehe, Fussradius,
 *   Neigung nach achtern, Ansatzbreite/-hoehe der Wanten (wx fehlt = keine).
 * segel:  [{ m, y, w, h, dx, dz, bauch, unten, rahe, hex }] — Mastindex,
 *   Rahhoehe, Breite, Hoehe, Versatz zum Mast, Bauch, Breitenverhaeltnis der
 *   Unterkante, rahe:false laesst die Rah weg (Stag- und Klueversegel).
 * seed streut Bauch und Rahlaenge — sechs Segel eines Dreimasters sollen nicht
 * sechsmal dasselbe Rechteck sein.
 * Segel bleiben ohne Karte: eine Tuchtextur mit brauchbarem Alpha gibt es im
 * Bestand nicht, und ein alphaTest auf einer der Vegetationskarten wuerde
 * Loecher ins Tuch schlagen. Ein schlichtes, gebauschtes Tuch traegt hier
 * mehr als eine falsche Silhouette. (transparent bleibt in jedem Fall tabu.)
 */
function takelage(parts, masten, segel, seed, hex) {
  var holz = hex === undefined ? 0x6a5540 : hex, i, s;
  for (i = 0; i < masten.length; i++) {
    var m = masten[i];
    var mr = m.r === undefined ? m.h * 0.024 : m.r;
    parts.push(part(new CY(mr * 0.5, mr, m.h, 6), M(m.x, m.h * 0.5, m.z, m.rake || 0, 0, 0), holz));
    parts.push(part(new CO(mr * 1.5, mr * 3.4, 5), M(m.x, m.h + mr * 1.5, m.z), holz));
    if (m.wx) {
      for (s = -1; s <= 1; s += 2) {
        // Wanten laufen als leicht eingezogener Zug von der Reling zum Topp.
        // radial 3: bei dieser Kameradistanz ist ein Want ein Strich — ein
        // Dreikant kostet 12 Dreiecke statt der 48 eines runden Seils.
        var zug = [new THREE.Vector3(m.x + s * m.wx, m.wy || 0, m.z),
                   new THREE.Vector3(m.x + s * m.wx * 0.5, m.h * 0.52, m.z),
                   new THREE.Vector3(m.x, m.h * 0.9, m.z)];
        parts.push(part(tubeGeo(zug, function () { return mr * 0.28; }, 3), null, 0xb2a184));
      }
    }
  }
  for (i = 0; i < segel.length; i++) {
    var sg = segel[i], mm = masten[sg.m];
    var sr = mm.r === undefined ? mm.h * 0.024 : mm.r;
    var cx = mm.x + (sg.dx || 0), cz = mm.z + (sg.dz || 0);
    var bw = sg.w * 0.5, uw = bw * (sg.unten === undefined ? 0.94 : sg.unten);
    var y1 = sg.y, y0 = sg.y - sg.h;
    if (sg.rahe !== false) {
      parts.push(part(new CY(sr * 0.45, sr * 0.45, sg.w * (1.04 + hashi(i, 3, seed) * 0.12), 5),
        M(cx, y1, cz, 0, 0, Math.PI / 2), holz));
    }
    var bauch = (sg.bauch === undefined ? sg.h * 0.17 : sg.bauch) * (0.7 + hashi(i, 5, seed) * 0.6);
    zeltbahn(parts, [
      new THREE.Vector3(cx - bw, y1, cz), new THREE.Vector3(cx + bw, y1, cz),
      new THREE.Vector3(cx + uw, y0, cz), new THREE.Vector3(cx - uw, y0, cz)
    ], bauch, sg.hex === undefined ? 0xe8dfc9 : sg.hex);
  }
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
  elfenturm: [[0, 5.2, 1.1], [0, 3.1, 1.05]],
  /* Wehrbau (Buendel 1). Nur ACHSPARALLELE Oeffnungen bekommen einen Anker:
     emitFensterlicht leitet die Blickrichtung aus der dominanten Achse ab und
     kennt deshalb nur vier Richtungen — der schraege Kuechenschlitz und die
     Turmscharten dazwischen bekaemen ein verdreht stehendes Lichtquad. */
  bergfried: [[-0.9, 5.4, 2.06], [0.9, 5.4, 2.06], [2.06, 5.4, 0], [0, 3.2, 2.06]],
  wehrturm: [[1.22, 2.2, 0], [0, 2.75, 1.22], [-1.22, 3.3, 0]],
  torhaus: [[3.36, 3.0, 0], [-3.36, 3.0, 0]],
  burgpalas: [[-2.25, 3.95, 2.28], [-0.75, 3.95, 2.28], [0.75, 3.95, 2.28],
              [2.25, 3.95, 2.28], [3.58, 3.95, 0]],
  schlossfluegel: [[-3.0, 1.9, 1.88], [-1.0, 1.9, 1.88], [1.0, 1.9, 1.88], [3.0, 1.9, 1.88],
                   [-3.0, 4.15, 1.88], [-1.0, 4.15, 1.88], [1.0, 4.15, 1.88], [3.0, 4.15, 1.88]],
  schlossturmhaube: [[0, 2.7, 1.34]]
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
 * Biegt die Normalen der Kronenkarten von der Plane-Normale weg auf die
 * Richtung vom Kronenzentrum nach aussen (Huellkugel-Technik, Kids with
 * Sticks / 80.lv): die alphaTest-Silhouetten bleiben unruhig, aber das Licht
 * laeuft ueber die Krone wie ueber EINEN weichen Koerper, statt jede Karte
 * einzeln hart zu kanten. oval < 1 staucht die y-Differenz vor dem
 * Normalisieren: bei schlanken Kronen (Zypresse, Nadel) kippen die Normalen
 * der Flankenvertices sonst fast senkrecht (das Kugelzentrum liegt weit ueber
 * bzw. unter ihnen) und die Flanke saeuft im Seitenlicht ab — die Stauchung
 * entspricht der Normalen eines gestreckten Ellipsoids, dessen Gradient die
 * y-Komponente genau so herunterskaliert.
 * Reihenfolge ist unkritisch: shadeVertical (laeuft danach in definePool)
 * liest nur position und schreibt color, die Normalen ueberleben also.
 * Die Baum-Pools rendern mit dbl → DoubleSide; Three flippt im Shader die
 * Normale fuer Rueckseiten, dort zeigt sie dann nach innen. Das ist hier
 * akzeptiert: die Karten stehen gekreuzt, die Kamera sieht ueberwiegend
 * Vorderseiten, und Materialaenderungen sind tabu.
 */
function kugelNormalen(geos, cx, cy, cz, oval) {
  for (var g = 0; g < geos.length; g++) {
    var pos = geos[g].attributes.position, nor = geos[g].attributes.normal;
    for (var i = 0; i < pos.count; i++) {
      var dx = pos.getX(i) - cx, dy = (pos.getY(i) - cy) * oval, dz = pos.getZ(i) - cz;
      var l = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // Vertex exakt im Zentrum wuerde durch 0 teilen — nach oben ist die
      // plausibelste Richtung fuer die Kronenmitte.
      if (l < 1e-6) { dx = 0; dy = 1; dz = 0; l = 1; }
      nor.setXYZ(i, dx / l, dy / l, dz / l);
    }
  }
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
  // Kronenkarten getrennt sammeln: nur ihre Normalen werden unten auf die
  // Huellkugel umgebogen — der Stamm behaelt seine Zylindernormalen, sonst
  // wuerde er wie Laub statt wie Holz beleuchtet.
  var kronen = [];
  var cx = 0, cy = 0, cz = 0;
  for (var i = 0; i < o.karten; i++) {
    var a = i / o.karten * Math.PI + hashi(i, 3, o.seed) * 0.8;
    var kw = o.kroneW * (0.75 + hashi(i, 5, o.seed) * 0.5);
    var kh = o.kroneH * (0.8 + hashi(i, 7, o.seed) * 0.4);
    var ox = (hashi(i, 11, o.seed) - 0.5) * o.kroneW * 0.3 + o.lehne * 0.6;
    var oz = (hashi(i, 13, o.seed) - 0.5) * o.kroneW * 0.3;
    var oy = o.kroneY + (hashi(i, 17, o.seed) - 0.5) * o.kroneH * 0.22;
    var q = kronenQuad(kw, kh, ox, oy, oz, a, (hashi(i, 19, o.seed) - 0.5) * 0.16, o.laub);
    kronen.push(q);
    parts.push(q);
    // Zentrum aus den echten Platzierungen (Kartenfuss + halbe Hoehe) statt
    // aus kroneY/kroneH der Presets: so folgt das Lichtzentrum auch der
    // seed-gestreuten Anordnung und der Lehne (SUMPF lehnt mit 0.42 deutlich).
    // Die kleine tiltZ-Verschiebung (max ~0.08 rad) ist dafuer vernachlaessigbar.
    cx += ox; cy += oy + kh / 2; cz += oz;
  }
  kugelNormalen(kronen, cx / o.karten, cy / o.karten, cz / o.karten,
    o.oval === undefined ? 1 : o.oval);
  return mergeGeos(parts);
}

var BAUM_LAUBBREIT = { stammOben: 0.16, stammUnten: 0.34, stammH: 2.4, rinde: 0x6f5a44,
  karten: 4, kroneW: 4.2, kroneH: 3.4, kroneY: 2.0, lehne: 0.15, laub: 0x87a45c, seed: 41 };
var BAUM_LAUBHOCH = { stammOben: 0.13, stammUnten: 0.26, stammH: 3.4, rinde: 0x7a6450,
  karten: 3, kroneW: 2.6, kroneH: 4.4, kroneY: 2.6, lehne: 0.08, laub: 0x7d9a52, seed: 43 };
// oval (Default 1, s. kugelNormalen): nur die schlanken Arten stauchen die
// y-Differenz — Nadel ist ~1.8x, Zypresse ~4x hoeher als breit, ohne Stauchung
// wuerden ihre Flanken fast nur Auf-/Abwaertsnormalen bekommen.
var BAUM_NADEL = { stammOben: 0.10, stammUnten: 0.24, stammH: 1.4, rinde: 0x5f4c3c,
  karten: 3, kroneW: 2.6, kroneH: 4.8, kroneY: 0.9, lehne: 0.04, laub: 0x4e6b48, seed: 47,
  oval: 0.55 };
var BAUM_ZYPRESSE = { stammOben: 0.08, stammUnten: 0.16, stammH: 0.8, rinde: 0x6d5a45,
  karten: 3, kroneW: 1.3, kroneH: 5.4, kroneY: 0.55, lehne: 0.05, laub: 0x3f5f45, seed: 53,
  oval: 0.45 };
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
definePool("busch", geoBusch(), { radius: 0.85, dbl: true, familie: 'laub', wind: { amp: 0.14 },
  drift: DRIFT_LEICHT });
definePool("gras", geoGras(), { radius: 0.3, dbl: true, ao: 0.18,
  map: TEX.grassTuft, alphaTest: 0.42, familie: 'laub', wind: { amp: 0.4 },
  drift: DRIFT_LEICHT });
definePool("blume", part(new PL(1.0, 1.0), M(0, 0.5, 0), 0xffffff),
  { radius: 0.3, dbl: true, ao: 0.1, map: TEX.bluete, alphaTest: 0.42,
    familie: 'laub', wind: { amp: 0.42 }, drift: DRIFT_LEICHT });
definePool("industrie", geoIndustrie(), { radius: 3.4, familie: 'stein' });
definePool("kran", geoKran(), { radius: 2.4, familie: 'holz' });
// rankenblatt und fels sind die beiden Pools, die vines.js als schwebende
// Truemmer an die Bruchkante wirft (schwebeDrift) — ohne Drift stuenden genau
// die still, die es am noetigsten haben.
definePool("rankenblatt", part(new PL(1, 0.5), M(0.5, 0, 0), 0xffffff),
  { radius: 0.8, dbl: true, ao: 0, map: TEX.rankenBlatt, alphaTest: 0.4,
    familie: 'laub', wind: { amp: 0.8 }, drift: DRIFT_LEICHT });
definePool("kuppel", geoKuppel(), { radius: 2.6, familie: 'putz' });
definePool("arkade", geoArkade(), { radius: 2.9, familie: 'putz' });
definePool("fels", geoFels(), { radius: 1.1, familie: 'stein', drift: DRIFT_BROCKEN });
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
  map: TEX.grassTuft, alphaTest: 0.4, familie: 'laub', wind: { amp: 0.3 },
  drift: DRIFT_LEICHT });
definePool("stumpf", geoStumpf(), { radius: 0.5, familie: 'rinde', drift: DRIFT_BROCKEN });
// stammliegend (Radius 1.4) bleibt liegen: ein ganzer Stamm ist kein Truemmer.
definePool("stammliegend", geoStammLiegend(), { radius: 1.4, familie: 'rinde' });
definePool("moos", geoMoos(), { radius: 0.6, dbl: true, ao: 0,
  map: TEX.kroneRund, alphaTest: 0.42, familie: 'laub', drift: DRIFT_LEICHT });
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

/* ==========================================================================
   Kategorie 1 des Objektkatalogs — Wehrbau (Buendel 1). Mauern, Tore, Tuerme,
   Burg, Schloss. Alle Bauten teilen eine Palette, damit Mauerstueck, Wehrturm
   und Torhaus als Teile DERSELBEN Burg lesbar bleiben und nicht als drei
   zufaellig benachbarte Objekte.
   ========================================================================== */
var WB_STEIN = 0xbdb7a8,      // Mauerwerk
    WB_HELL = 0xcdc7b6,       // Abdeckplatten, Zinnen, Gesimse
    WB_DUNKEL = 0x968f80,     // Sockel und Boeschungen
    WB_DACH = 0x53707e,       // Schiefer
    WB_HOLZ = 0x8a7050,
    WB_HOLZD = 0x6f5a44,
    WB_EISEN = 0x4c4841,
    WB_PUTZ = 0xefe7d6,
    WB_TUCH = 0xb0574e,
    WB_SCHARTE = 0x2e3038;    // dunkle Oeffnungen, wie das Glas in fenster()

/* --- Mauerwerk: kachelbare Stuecke, die genBurg spaeter aneinanderreiht --- */

function geoMauerstueck() {
  var parts = [
    part(new BX(3.2, 2.5, 0.9), M(0, 1.25, 0), WB_STEIN),
    part(new BX(3.24, 0.18, 1.2), M(0, 2.59, 0), WB_HELL),        // auskragender Wehrgang
    part(new BX(3.24, 0.5, 0.24), M(0, 2.93, 0.42), WB_STEIN)     // Brustwehr innen
  ];
  sockel(parts, 3.2, 0.9, WB_DUNKEL);
  // Merlonen nur auf der Feldseite: innen laeuft der Wehrgang, dort waere ein
  // zweiter Zinnenkranz sowohl falsch als auch doppelt so teuer.
  zinnen(parts, 3.24, 0, 2.68, WB_HELL, 5, { form: "reihe", z: -0.46 });
  return mergeGeos(parts);
}

function geoMauerecke() {
  var parts = [
    part(new BX(2.6, 2.5, 0.9), M(1.6, 1.25, 0), WB_STEIN),       // Schenkel nach +x
    part(new BX(0.9, 2.5, 2.6), M(0, 1.25, 1.6), WB_STEIN),       // Schenkel nach +z
    part(new BX(2.6, 0.18, 1.2), M(1.6, 2.59, 0), WB_HELL),
    part(new BX(1.2, 0.18, 2.6), M(0, 2.59, 1.6), WB_HELL),
    part(new CY(0.9, 1.05, 3.9, 8), M(0, 1.95, 0), WB_STEIN),     // Ecktuermchen
    part(new CY(1.3, 1.3, 0.2, 8), M(0, 4.0, 0), WB_HELL),
    part(new CY(1.2, 1.35, 0.5, 8), M(0, 0.25, 0), WB_DUNKEL)
  ];
  zinnen(parts, 2.6, 0, 2.68, WB_HELL, 4, { form: "reihe", x: 1.6, z: -0.46 });
  zinnen(parts, 2.6, 0, 2.68, WB_HELL, 4, { form: "reihe", achse: "z", x: -0.46, z: 1.6 });
  zinnen(parts, 1.16, 0, 4.1, WB_HELL, 7, { form: "rund" });
  return mergeGeos(parts);
}

function geoMauerdurchlass() {
  var parts = [];
  bogenreihe(parts, 1, 0.8, 1.1, 0, WB_STEIN, 0.9, 1.2);          // Laibung + Pfortenbogen
  parts.push(part(new BX(3.2, 0.45, 0.9), M(0, 2.28, 0), WB_STEIN));
  parts.push(part(new BX(3.24, 0.18, 1.2), M(0, 2.59, 0), WB_HELL));
  parts.push(part(new BX(3.24, 0.5, 0.24), M(0, 2.93, 0.42), WB_STEIN));
  zinnen(parts, 3.24, 0, 2.68, WB_HELL, 5, { form: "reihe", z: -0.46 });
  tuer(parts, 0, 0, 0.44, 0.72, 1.6);
  return mergeGeos(parts);
}

function geoMauerbogen() {
  var parts = [];
  bogenreihe(parts, 3, 1.05, 1.9, 0, WB_STEIN, 0.85, 0.45);        // Blendboegen am Hang
  parts.push(part(new BX(4.9, 1.45, 0.9), M(0, 3.12, 0), WB_STEIN));
  parts.push(part(new BX(4.94, 0.18, 1.2), M(0, 3.94, 0), WB_HELL));
  parts.push(part(new BX(4.94, 0.5, 0.24), M(0, 4.28, 0.42), WB_STEIN));
  zinnen(parts, 4.94, 0, 4.03, WB_HELL, 7, { form: "reihe", z: -0.46 });
  return mergeGeos(parts);
}

function geoSchildmauer() {
  var parts = [];
  sockel(parts, 4.6, 1.1, WB_DUNKEL);
  parts.push(part(new BX(4.6, 5.4, 1.1), M(0, 2.7, 0), WB_STEIN));
  for (var i = -1; i <= 1; i++) {
    parts.push(part(new BX(0.55, 4.5, 0.8), M(i * 1.6, 2.25, 0.9), WB_DUNKEL));
    parts.push(part(prismGeo(0.8, 0.5, 0.55), M(i * 1.6, 4.5, 0.9, 0, Math.PI / 2, 0), WB_DUNKEL));
  }
  parts.push(part(new BX(4.9, 0.3, 1.5), M(0, 5.55, 0), WB_HELL));  // Kranzgesims
  parts.push(part(new BX(4.9, 0.18, 1.5), M(0, 5.34, 0), WB_DUNKEL));
  return mergeGeos(parts);
}

function geoZwingermauer() {
  var parts = [];
  sockel(parts, 2.4, 0.7, WB_DUNKEL);
  parts.push(part(new BX(2.4, 1.15, 0.7), M(0, 0.85, 0), WB_STEIN));
  parts.push(part(new BX(2.44, 0.14, 0.92), M(0, 1.49, 0), WB_HELL));
  zinnen(parts, 2.44, 0, 1.56, WB_HELL, 5,
    { form: "reihe", z: -0.34, hoehe: 0.3, staerke: 0.2 });
  return mergeGeos(parts);
}

function geoMauertreppe() {
  var parts = [];
  treppe(parts, 9, 1.0, 0.28, 0, 0, -1.7, WB_STEIN, WB_HELL);
  parts.push(part(new BX(1.3, 0.4, 0.6), M(0, 2.72, 1.9), WB_HELL));   // Podest am Wehrgang
  return mergeGeos(parts);
}

function geoPechnase() {
  return mergeGeos([
    part(new BX(1.0, 0.75, 0.6), M(0, 0.4, 0.3), WB_STEIN),
    part(new BX(1.06, 0.12, 0.68), M(0, 0.84, 0.3), WB_HELL),
    part(new BX(0.9, 0.1, 0.5), M(0, 0.03, 0.3), WB_DUNKEL),
    part(new BX(0.3, 0.12, 0.4), M(0, 0.02, 0.32), 0x2a2622),          // Wurfschlitz
    part(new CY(0.12, 0.15, 0.66, 6), M(-0.36, 0.06, 0.3, Math.PI / 2, 0, 0), WB_DUNKEL),
    part(new CY(0.12, 0.15, 0.66, 6), M(0.36, 0.06, 0.3, Math.PI / 2, 0, 0), WB_DUNKEL)
  ]);
}

/* --- Tuerme ------------------------------------------------------------- */

function geoWehrturm() {
  var parts = [
    part(new CY(1.05, 1.35, 4.6, 10), M(0, 2.3, 0), WB_STEIN),
    part(new CY(1.45, 1.45, 0.26, 10), M(0, 4.73, 0), WB_HELL),        // Kragplatte
    part(new CY(1.45, 1.62, 0.5, 10), M(0, 0.25, 0), WB_DUNKEL),
    part(new CO(1.6, 2.1, 10), M(0, 6.2, 0), WB_DACH),
    part(new CY(0.05, 0.05, 0.9, 5), M(0, 7.6, 0), WB_EISEN)
  ];
  zinnen(parts, 1.32, 0, 4.86, WB_HELL, 9, { form: "rund" });
  // Scharten achsparallel: emitFensterlicht kennt nur die vier Himmelsrichtungen,
  // schraeg gesetzte Anker bekaemen ein schief stehendes Lichtquad.
  var winkel = [0, Math.PI / 2, Math.PI];
  for (var i = 0; i < 3; i++) {
    parts.push(part(new BX(0.16, 0.85, 0.28),
      M(Math.cos(winkel[i]) * 1.18, 2.2 + i * 0.55, Math.sin(winkel[i]) * 1.18,
        0, -winkel[i], 0), WB_SCHARTE));
  }
  return mergeGeos(parts);
}

function geoGeschuetzturm() {
  var parts = [
    part(new CY(2.15, 2.45, 3.0, 12), M(0, 1.5, 0), WB_STEIN),
    part(new CY(2.55, 2.75, 0.55, 12), M(0, 0.28, 0), WB_DUNKEL),      // Boeschungsfuss
    part(new CY(2.55, 2.55, 0.3, 12), M(0, 3.15, 0), WB_HELL),         // Kragplatte
    part(new CY(1.95, 1.95, 0.14, 12), M(0, 3.44, 0), WB_HELL)         // Plattform
  ];
  for (var i = 0; i < 5; i++) {
    var a = i / 5 * Math.PI * 2 + 0.3;
    parts.push(part(new BX(0.34, 0.5, 0.8),
      M(Math.cos(a) * 2.2, 1.5, Math.sin(a) * 2.2, 0, -a, 0), WB_SCHARTE));
  }
  zinnen(parts, 2.42, 0, 3.3, WB_HELL, 10, { form: "rund" });
  return mergeGeos(parts);
}

function geoBergfried() {
  var parts = [];
  sockel(parts, 4.0, 4.0, WB_DUNKEL);
  parts.push(part(new BX(4.0, 7.4, 4.0), M(0, 4.0, 0), WB_STEIN));
  parts.push(part(new BX(4.3, 0.24, 4.3), M(0, 7.55, 0), WB_HELL));    // Kranzgesims
  zinnen(parts, 4.3, 4.3, 7.67, WB_HELL, 4);
  // Walmspitze statt prismGeo: der Bergfried hat vier gleich lange Traufen,
  // ein Giebelprisma bekaeme zwei Giebelwaende, die es dort nie gibt.
  parts.push(part(walmGeo(3.0, 2.2, 3.0, 0.2), M(0, 8.11, 0), WB_DACH));
  fenster(parts, -0.9, 5.4, 2.02, 0.5, 0.8, "z");
  fenster(parts, 0.9, 5.4, 2.02, 0.5, 0.8, "z");
  fenster(parts, 2.02, 5.4, 0, 0.5, 0.8, "x");
  fenster(parts, 0, 3.2, 2.02, 0.42, 0.9, "z");
  tuer(parts, 0, 1.2, 2.04, 0.9, 1.8);
  parts.push(part(new BX(1.5, 1.3, 0.5), M(0, 0.6, 2.2), WB_DUNKEL));  // Aufstieg zur Hochtuer
  return mergeGeos(parts);
}

/* --- Tore und Vorwerke --------------------------------------------------- */

function geoTorhaus() {
  var parts = [];
  for (var s = -1; s <= 1; s += 2) {
    parts.push(part(new CY(1.15, 1.35, 5.2, 9), M(s * 2.1, 2.6, 0), WB_STEIN));
    parts.push(part(new CY(1.5, 1.5, 0.24, 9), M(s * 2.1, 5.32, 0), WB_HELL));
    parts.push(part(new CY(1.45, 1.62, 0.5, 9), M(s * 2.1, 0.25, 0), WB_DUNKEL));
    parts.push(part(new BX(0.16, 0.85, 0.28), M(s * 3.3, 3.0, 0, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2, 0), WB_SCHARTE));
    zinnen(parts, 1.38, 0, 5.44, WB_HELL, 8, { form: "rund", x: s * 2.1 });
  }
  parts.push(part(new BX(4.2, 2.0, 2.2), M(0, 4.0, 0), WB_STEIN));      // Riegel ueber der Durchfahrt
  parts.push(part(new BX(4.3, 0.2, 2.5), M(0, 5.1, 0), WB_HELL));
  zinnen(parts, 4.3, 0, 5.2, WB_HELL, 5, { form: "reihe", z: -1.12 });
  bogenreihe(parts, 1, 1.9, 1.6, 0, WB_STEIN, 2.2, 1.3);
  // Fallgitter: das reine Balkenraster (muster 0) IST das Gitter — dafuer
  // wurde der Musterzweig ohne Streben ueberhaupt vorgesehen.
  fachwerk(parts, 1.8, 2.7, 1.14, "z", 0, 3, WB_EISEN);
  tuer(parts, 0, 0, 0.2, 1.5, 2.2);
  return mergeGeos(parts);
}

function geoBarbakane() {
  var parts = [
    // Halbschale: thetaStart -PI/2 ueber PI baucht nach +z aus, der Zinnenkranz
    // bekommt mit mitte = PI/2 genau denselben Halbkreis.
    part(new CY(2.9, 3.15, 2.8, 14, 1, false, -Math.PI / 2, Math.PI), M(0, 1.4, 0), WB_STEIN),
    part(new BX(6.4, 2.8, 0.8), M(0, 1.4, -0.4), WB_STEIN),             // Rueckwand
    part(new BX(6.4, 0.24, 1.0), M(0, 2.9, -0.4), WB_HELL),
    // Deckplatte kragt ueber die Schale (2.9) hinaus, damit der Zinnenkranz
    // darauf steht statt daneben zu schweben.
    part(new CY(3.06, 3.06, 0.2, 14, 1, false, -Math.PI / 2, Math.PI), M(0, 2.9, 0), WB_HELL),
    part(new BX(1.6, 0.3, 2.4), M(0, 1.4, -1.4, -0.5, 0, 0), WB_DUNKEL) // Rampe in den Hof
  ];
  zinnen(parts, 2.92, 0, 3.0, WB_HELL, 9, { form: "rund", bogen: Math.PI, mitte: Math.PI / 2 });
  return mergeGeos(parts);
}

function geoBastion() {
  var parts = [
    part(new CY(2.2, 2.9, 1.0, 6), M(0, 0.5, 0), WB_DUNKEL),            // Boeschungsfuss
    part(new BX(5.2, 3.0, 1.0), M(0, 2.0, -1.5), WB_STEIN)              // Kehlmauer
  ];
  var wink = 0.62;
  for (var s = -1; s <= 1; s += 2) {
    parts.push(part(new BX(3.6, 3.0, 1.0), M(s * 1.5, 2.0, 1.1, 0, -s * wink, 0), WB_STEIN));
    parts.push(part(new BX(3.7, 0.26, 1.4), M(s * 1.5, 3.63, 1.1, 0, -s * wink, 0), WB_HELL));
    zinnen(parts, 3.4, 0, 3.76, WB_HELL, 4,
      { form: "reihe", x: s * 1.5, z: 1.1, dreh: -s * wink, hoehe: 0.4 });
  }
  parts.push(part(new BX(5.2, 0.26, 1.4), M(0, 3.63, -1.5), WB_HELL));
  return mergeGeos(parts);
}

function geoZugbruecke() {
  var parts = [];
  for (var i = 0; i < 7; i++) {                     // halb aufgezogenes Brueckenblatt
    parts.push(part(new BX(0.3, 0.11, 3.4), M(-1.08 + i * 0.36, 0.85, 0.5, -0.38, 0, 0), WB_HOLZ));
  }
  parts.push(part(new BX(2.5, 0.14, 0.22), M(0, 0.42, -0.98, -0.38, 0, 0), WB_HOLZD));
  parts.push(part(new BX(2.5, 0.14, 0.22), M(0, 1.28, 0.98, -0.38, 0, 0), WB_HOLZD));
  parts.push(part(new BX(0.9, 0.7, 1.1), M(-1.7, 0.35, -1.3), WB_DUNKEL));   // Widerlager
  parts.push(part(new BX(0.9, 0.7, 1.1), M(1.7, 0.35, -1.3), WB_DUNKEL));
  for (var s = -1; s <= 1; s += 2) {                // Ketten zum Torhaus
    parts.push(part(new CY(0.05, 0.05, 2.6, 5), M(s * 1.15, 1.85, 0.4, -0.9, 0, 0), WB_EISEN));
  }
  return mergeGeos(parts);
}

/* --- Bauten im Burghof --------------------------------------------------- */

function geoBurgpalas() {
  var parts = [];
  sockel(parts, 7.0, 4.4, WB_DUNKEL);
  parts.push(part(new BX(7.0, 4.6, 4.4), M(0, 2.7, 0), WB_PUTZ));
  parts.push(part(new BX(7.2, 0.18, 4.6), M(0, 3.05, 0), WB_HELL));     // Gurtgesims
  parts.push(part(new BX(7.2, 0.24, 4.6), M(0, 5.1, 0), WB_HELL));      // Kranzgesims
  dachlandschaft(parts, 7.0, 4.4, 5.24, 0x8a5c48, 91);
  for (var i = 0; i < 4; i++) {
    fenster(parts, -2.25 + i * 1.5, 3.95, 2.24, 0.68, 1.1, "z");
  }
  fenster(parts, 3.54, 3.95, 0, 0.68, 1.1, "x");
  parts.push(part(new BX(1.5, 2.3, 0.9), M(-2.0, 2.35, 2.6), WB_PUTZ));  // Erker
  parts.push(part(prismGeo(1.7, 0.55, 1.1), M(-2.0, 3.5, 2.6, 0, Math.PI / 2, 0), 0x8a5c48));
  tuer(parts, 1.6, 0.5, 2.26, 0.95, 1.9);
  return mergeGeos(parts);
}

function geoBurgkapelle() {
  var parts = [];
  sockel(parts, 2.6, 3.4, WB_DUNKEL);
  parts.push(part(new BX(2.6, 3.0, 3.4), M(0, 1.9, 0), WB_STEIN));
  // Apsis: halber Zylinder am Chorende, Oeffnungswinkel zum Schiff hin
  parts.push(part(new CY(1.3, 1.3, 3.0, 9, 1, false, Math.PI / 2, Math.PI),
    M(0, 1.9, -1.7), WB_STEIN));
  parts.push(part(prismGeo(2.9, 1.35, 3.9), M(0, 3.4, 0), WB_DACH));
  parts.push(part(new CO(1.5, 0.9, 9), M(0, 3.55, -1.7), WB_DACH));      // Apsisdach
  parts.push(part(new CY(0.26, 0.3, 1.1, 6), M(0, 5.2, 0.9), WB_HELL));  // Dachreiter
  parts.push(part(new CO(0.4, 0.7, 6), M(0, 6.1, 0.9), WB_DACH));
  parts.push(part(new THREE.TorusGeometry(0.36, 0.08, 4, 9), M(0, 2.9, 1.72), WB_HELL));
  parts.push(part(new PL(0.62, 0.62), M(0, 2.9, 1.7), 0x6f7f8e));        // Rundfenster
  tuer(parts, 0, 0, 1.72, 0.8, 1.7);
  return mergeGeos(parts);
}

function geoBurgkueche() {
  var parts = [
    part(new CY(1.5, 1.75, 2.4, 10), M(0, 1.2, 0), WB_STEIN),
    part(new CY(1.85, 2.0, 0.5, 10), M(0, 0.25, 0), WB_DUNKEL),
    part(new CO(1.72, 1.5, 10), M(0, 3.15, 0), WB_DACH),                 // Rauchhaube
    part(new CY(0.36, 0.44, 1.6, 8), M(0, 4.3, 0), WB_STEIN),            // Schlot
    part(new CY(0.3, 0.3, 0.16, 8), M(0, 5.14, 0), 0x2a2622),
    part(new BX(0.5, 0.6, 0.2), M(1.14, 1.6, 0.85, 0, -0.9, 0), WB_SCHARTE)
  ];
  tuer(parts, 0, 0, 1.46, 0.9, 1.7);
  return mergeGeos(parts);
}

/* --- Holzbefestigung ----------------------------------------------------- */

function geoPalisade() {
  var parts = [];
  for (var i = 0; i < 8; i++) {
    var d = hashi(i, 3, 71);
    // CY mit radiusTop nahe 0 ist der zugespitzte Pfahl in EINEM Primitiv —
    // ein zusaetzlicher CO je Pfahl kostete acht weitere Deckel.
    parts.push(part(new CY(0.02, 0.17 + d * 0.03, 2.2 + d * 0.3, 5),
      M(-1.19 + i * 0.34, 1.1 + d * 0.15, (hashi(i, 7, 71) - 0.5) * 0.1), WB_HOLZ));
  }
  parts.push(part(new BX(2.74, 0.12, 0.1), M(0, 1.55, -0.16), WB_HOLZD));
  parts.push(part(new BX(2.74, 0.12, 0.1), M(0, 0.75, -0.16), WB_HOLZD));
  return mergeGeos(parts);
}

function geoPalisadentor() {
  var parts = [];
  for (var s = -1; s <= 1; s += 2) {
    for (var i = 0; i < 3; i++) {
      var d = hashi(i + (s > 0 ? 5 : 0), 3, 73);
      parts.push(part(new CY(0.02, 0.17, 2.2 + d * 0.25, 5),
        M(s * (1.0 + i * 0.34), 1.1 + d * 0.12, 0), WB_HOLZ));
    }
    parts.push(part(new CY(0.24, 0.3, 3.0, 6), M(s * 0.74, 1.5, 0), WB_HOLZD));
    parts.push(part(new BX(1.1, 0.11, 0.1), M(s * 1.55, 1.5, -0.16), WB_HOLZD));
  }
  parts.push(part(new BX(2.1, 0.3, 0.36), M(0, 3.05, 0), WB_HOLZD));      // Sturz
  parts.push(part(new BX(0.6, 0.26, 0.32), M(0, 3.34, 0), WB_HOLZ));
  tuer(parts, 0, 0, 0.18, 1.15, 2.4);
  return mergeGeos(parts);
}

function geoWachturm() {
  var parts = [];
  for (var s = -1; s <= 1; s += 2) {
    for (var q = -1; q <= 1; q += 2) {
      parts.push(part(new BX(0.2, 4.2, 0.2), M(s * 0.85, 2.1, q * 0.85), WB_HOLZD));
    }
  }
  // Zwei verschieden ausgesteifte Seiten aus einer Seed: das Geruest wirkt
  // gebaut statt gespiegelt, ohne dass beide Raster von Hand stehen muessen.
  fachwerk(parts, 1.9, 4.0, -0.85, "z", 1, 17, WB_HOLZD);
  fachwerk(parts, 1.9, 4.0, 0.85, "x", 1, 19, WB_HOLZD);
  parts.push(part(new BX(2.5, 0.16, 2.5), M(0, 4.24, 0), WB_HOLZ));       // Kanzelboden
  parts.push(part(new BX(2.3, 0.7, 2.3), M(0, 4.67, 0), WB_HOLZ));        // Bruestung
  parts.push(part(prismGeo(2.7, 0.9, 2.7), M(0, 5.42, 0), 0x7a6248));
  parts.push(part(new BX(0.09, 4.4, 0.09), M(-0.28, 2.2, 1.3, 0.16, 0, 0), WB_HOLZD));
  parts.push(part(new BX(0.09, 4.4, 0.09), M(0.28, 2.2, 1.3, 0.16, 0, 0), WB_HOLZD));
  for (var r = 0; r < 6; r++) {                                          // Leitersprossen
    parts.push(part(new BX(0.66, 0.07, 0.07), M(0, 0.5 + r * 0.62, 1.24 - r * 0.1), WB_HOLZ));
  }
  return mergeGeos(parts);
}

/* --- Schloss: dieselbe Burg, dreihundert Jahre spaeter -------------------- */

function geoSchlossfluegel() {
  var parts = [];
  sockel(parts, 8.6, 3.6, WB_DUNKEL);
  parts.push(part(new BX(8.6, 5.0, 3.6), M(0, 2.9, 0), WB_PUTZ));
  parts.push(part(new BX(8.8, 0.18, 3.8), M(0, 3.05, 0), WB_HELL));
  parts.push(part(new BX(8.8, 0.26, 3.8), M(0, 5.3, 0), WB_HELL));
  dachlandschaft(parts, 8.6, 3.6, 5.46, 0x5b5a64, 97);
  parts.push(part(new CY(1.4, 1.55, 6.2, 8), M(4.5, 3.1, 0), WB_PUTZ));   // Eckpavillon
  parts.push(part(new CO(1.8, 1.7, 8), M(4.5, 7.05, 0), 0x5b5a64));
  for (var i = 0; i < 4; i++) {
    var fx = -3.0 + i * 2.0;
    fenster(parts, fx, 1.9, 1.84, 0.62, 1.2, "z");
    fenster(parts, fx, 4.15, 1.84, 0.62, 1.0, "z");
  }
  tuer(parts, -3.0, 0.5, 1.86, 1.0, 2.0);
  return mergeGeos(parts);
}

function geoSchlossturmhaube() {
  var parts = [
    part(new CY(1.15, 1.32, 4.4, 10), M(0, 2.2, 0), WB_PUTZ),
    part(new CY(1.5, 1.5, 0.24, 10), M(0, 4.52, 0), WB_HELL),
    part(new THREE.SphereGeometry(1.34, 10, 6), M(0, 5.35, 0, 0, 0, 0, 1, 1.2, 1), WB_DACH),
    part(new CY(0.55, 0.72, 0.85, 8), M(0, 6.55, 0), WB_HELL),            // Laterne
    part(new CO(0.64, 0.9, 8), M(0, 7.4, 0), WB_DACH),
    part(new CY(0.045, 0.045, 1.3, 5), M(0, 8.45, 0), WB_EISEN),
    part(new PL(0.8, 0.42), M(0.4, 8.9, 0, 0, 0, 0.08), WB_TUCH)
  ];
  fenster(parts, 0, 2.7, 1.3, 0.55, 0.95, "z");
  return mergeGeos(parts);
}

function geoSchlossportal() {
  // Der Lauf steigt (wie jede treppe()) nach +z, der Portalkoerper steht an
  // seinem oberen Ende — die Schauseite dieses Pools blickt daher nach -z.
  var parts = [];
  treppe(parts, 3, 4.6, 0.28, 0, 0, -1.5, WB_HELL, WB_STEIN);
  parts.push(part(new BX(5.0, 4.4, 1.2), M(0, 3.04, 0), WB_STEIN));
  bogenreihe(parts, 1, 1.5, 1.9, 0.84, WB_HELL, 1.34, 0.7);
  saeulen(parts, 2, -1.95, 3.9, 0.84, 0.95, 0.28, 3.0, WB_HELL);
  saeulen(parts, 2, -1.35, 2.7, 0.84, 0.95, 0.24, 3.0, WB_HELL);
  parts.push(part(new BX(5.2, 0.42, 1.5), M(0, 4.05, 0.5), WB_HELL));      // Gebaelk
  parts.push(part(prismGeo(5.2, 1.2, 1.5), M(0, 4.26, 0.5, 0, Math.PI / 2, 0), WB_HELL));
  tuer(parts, 0, 0.84, 0.62, 1.4, 2.4);
  return mergeGeos(parts);
}

function geoKettenturm() {
  var parts = [
    part(new CY(0.95, 1.15, 3.6, 9), M(0, 1.8, 0), WB_STEIN),
    part(new CY(1.28, 1.28, 0.22, 9), M(0, 3.71, 0), WB_HELL),
    part(new CY(1.25, 1.42, 0.5, 9), M(0, 0.25, 0), WB_DUNKEL),
    part(new BX(0.9, 0.55, 0.9), M(2.1, 0.27, 0), WB_DUNKEL),             // Ankerstein
    part(new BX(0.26, 0.34, 0.26), M(1.02, 1.9, 0), WB_EISEN)             // Kettenoese
  ];
  zinnen(parts, 1.16, 0, 3.82, WB_HELL, 8, { form: "rund" });
  var glied = new THREE.TorusGeometry(0.2, 0.055, 4, 6);
  for (var i = 0; i < 3; i++) {
    parts.push(part(glied,
      M(1.3 + i * 0.34, 1.72 - i * 0.42, 0, 0, i % 2 ? Math.PI / 2 : 0, 0.62), WB_EISEN));
  }
  return mergeGeos(parts);
}

/* --- Aufsaetze ----------------------------------------------------------- */

function geoWehrbanner() {
  return mergeGeos([
    part(new CY(0.045, 0.055, 2.6, 5), M(0, 1.3, 0), WB_HOLZD),
    part(new CO(0.075, 0.2, 5), M(0, 2.7, 0), 0xc0a24e),
    part(new BX(0.06, 0.06, 0.72), M(0, 2.42, 0.36), WB_HOLZD),           // Ausleger
    part(new BX(0.62, 0.06, 0.06), M(0, 2.36, 0.36, 0, Math.PI / 2, 0), WB_HOLZD),
    part(new PL(0.62, 1.1), M(0, 1.8, 0.36, 0, Math.PI / 2, 0), WB_TUCH)
  ]);
}

function geoWappenstein() {
  // Das Relief ist eine hinten abgebrochene IC-Kugel: bruchkante kappt die
  // Rueckseite, damit es flach in der Tafel sitzt statt davor zu schweben.
  var relief = bruchkante(new IC(0.22, 0), { nx: 0, ny: 0, nz: -1, wert: -0.02, rauheit: 0.14 }, 83);
  return mergeGeos([
    part(new BX(0.66, 0.8, 0.14), M(0, 0.4, 0), WB_HELL),
    part(new BX(0.8, 0.11, 0.2), M(0, 0.84, 0), WB_STEIN),                // Verdachung
    part(new BX(0.8, 0.11, 0.2), M(0, -0.03, 0), WB_STEIN),
    part(relief, M(0, 0.44, 0.06, 0, 0, 0, 1.15, 1.35, 1), WB_TUCH),
    part(new PL(0.3, 0.38), M(0, 0.44, 0.15), 0xc0a24e)                   // Schildfeld
  ]);
}

/* --- Pools. Radien und Familien stammen aus der Katalogtabelle. ----------- */
definePool("mauerstueck", geoMauerstueck(), { radius: 1.6, familie: 'stein' });
definePool("mauerecke", geoMauerecke(), { radius: 1.9, familie: 'stein' });
definePool("mauerdurchlass", geoMauerdurchlass(), { radius: 1.8, familie: 'stein' });
definePool("mauerbogen", geoMauerbogen(), { radius: 2.4, ao: 0.26, familie: 'stein' });
definePool("schildmauer", geoSchildmauer(), { radius: 2.4, familie: 'stein' });
definePool("zwingermauer", geoZwingermauer(), { radius: 1.2, familie: 'stein' });
definePool("mauertreppe", geoMauertreppe(), { radius: 1.3, ao: 0.26, familie: 'stein' });
definePool("pechnase", geoPechnase(), { radius: 0.8, familie: 'stein' });
definePool("wehrturm", geoWehrturm(), { radius: 2.2, familie: 'stein' });
definePool("geschuetzturm", geoGeschuetzturm(), { radius: 2.6, familie: 'stein' });
definePool("bergfried", geoBergfried(), { radius: 2.6, ao: 0.24, familie: 'stein' });
definePool("torhaus", geoTorhaus(), { radius: 3.6, ao: 0.24, familie: 'stein' });
definePool("barbakane", geoBarbakane(), { radius: 3.2, familie: 'stein' });
definePool("bastion", geoBastion(), { radius: 3.4, familie: 'stein' });
definePool("zugbruecke", geoZugbruecke(), { radius: 2.2, familie: 'holz' });
definePool("burgpalas", geoBurgpalas(), { radius: 4.0, familie: 'putz' });
definePool("burgkapelle", geoBurgkapelle(), { radius: 2.2, familie: 'stein' });
definePool("burgkueche", geoBurgkueche(), { radius: 2.0, familie: 'stein' });
definePool("palisade", geoPalisade(), { radius: 1.4, familie: 'holz' });
definePool("palisadentor", geoPalisadentor(), { radius: 1.8, familie: 'holz' });
definePool("wachturm", geoWachturm(), { radius: 1.5, ao: 0.26, familie: 'holz' });
definePool("schlossfluegel", geoSchlossfluegel(), { radius: 4.6, familie: 'putz' });
definePool("schlossturmhaube", geoSchlossturmhaube(), { radius: 2.0, familie: 'putz' });
definePool("schlossportal", geoSchlossportal(), { radius: 3.0, ao: 0.24, familie: 'stein' });
definePool("kettenturm", geoKettenturm(), { radius: 1.6, familie: 'stein' });
definePool("wehrbanner", geoWehrbanner(), { radius: 0.4, dbl: true, ao: 0.12,
  familie: 'stoff', wind: { amp: 0.22 } });
definePool("wappenstein", geoWappenstein(), { radius: 0.4, ao: 0.2, familie: 'stein' });

/* ==========================================================================
   Kategorie 2 des Objektkatalogs — Maritim (Buendel 3), dazu die Wasser- und
   Brueckenbauten aus Kategorie 7. Wie beim Wehrbau teilen sich alle Bauten
   EINE Palette: nur so lesen Kaimauer, Kran und Kogge als ein Hafen statt als
   drei zufaellig benachbarte Objekte.

   AUSRICHTUNGSKONVENTION: Jedes Uferobjekt ist mit dem WASSER BEI +z gebaut.
   tryPlaceUfer (objects.js) liefert den Yaw aus dem Hoehengradienten — bergab
   entspricht dem lokalen +z — und genObjekt dreht die Instanz damit direkt
   aufs Wasser zu, statt sie zufaellig zu wuerfeln. Wer hier eine Rueckwand
   nach +z setzt, dreht dem Hafenbecken den Ruecken zu.
   ========================================================================== */
var MR_HOLZ = 0x9a7f5e,       // frische Planken, Beplankung
    MR_HOLZH = 0xb09268,      // Decksbretter, Aufbauten (heller)
    MR_HOLZD = 0x6a5540,      // Balken, Spanten, Masten
    MR_TEER = 0x453a30,       // geteerte Pfahlfuesse, Unterwasserschiff
    MR_STEIN = 0xb2ac9e,      // Kaimauerwerk
    MR_STEINH = 0xc6c0b0,     // Abdeckplatten, Kaikante
    MR_STEIND = 0x8b8474,     // nasse Sockelzone
    MR_TUCH = 0xe8dfc9,       // Segeltuch
    MR_TUCHR = 0xc0553f,      // Seezeichen, Wimpel, Bojenmarken
    MR_EISEN = 0x4c4841,
    MR_SEIL = 0xb2a184,
    MR_GLUT = 0xffd28a,       // Laternenglas und Glut (Schein kommt aus dem
                              // fensterlicht-Pool, s. LICHT_ANKER)
    MR_PUTZ = 0xf0e8d8,
    MR_NETZ = 0x7d7254,
    MR_WASSER = 0x35566b,     // gefasste Wasserflaechen (Becken, Rinne, Kammer)
    MR_SALZ = 0xf4f1e4,
    MR_TANG = 0x5c6b4a;

/* --- Werft und Kai ------------------------------------------------------- */

function geoWerfthalle() {
  var parts = [], i, s;
  for (s = -1; s <= 1; s += 2) {
    for (i = 0; i < 4; i++) {
      parts.push(part(new CY(0.17, 0.23, 4.0, 6), M(s * 2.5, 2.0, -3.3 + i * 2.2), MR_HOLZ));
    }
    parts.push(part(new BX(0.26, 0.28, 7.6), M(s * 2.5, 4.14, 0), MR_HOLZD));   // Pfette
    // Nur die Laengsseiten sind beplankt; die Giebelseite zum Wasser (+z)
    // bleibt offen — sonst kaeme kein Rumpf aus der Halle.
    fachwerk(parts, 7.2, 3.9, s * 2.5, "x", 1, s > 0 ? 151 : 157, MR_HOLZD);
  }
  parts.push(part(new BX(5.2, 3.9, 0.16), M(0, 1.95, -3.7), MR_HOLZ));         // Rueckwand
  parts.push(part(new BX(5.3, 0.24, 0.28), M(0, 4.14, -3.7), MR_HOLZD));
  parts.push(part(prismGeo(5.8, 1.9, 8.0), M(0, 4.28, 0), 0x6f5a48));
  parts.push(part(new BX(5.8, 0.1, 8.0), M(0, 4.23, 0), 0x4a4038));            // Untersicht
  return mergeGeos(parts);
}

function geoHelling() {
  var parts = [], i, s;
  for (i = 0; i < 7; i++) {                                  // Kielpallen
    parts.push(part(new BX(0.6, 0.85 - Math.abs(i - 3) * 0.05, 0.4),
      M(0, 0.42, -2.7 + i * 0.9), MR_HOLZD));
  }
  parts.push(part(new BX(0.3, 0.34, 6.6), M(0, 1.0, 0), MR_HOLZD));            // Kielbalken
  // Halbfertiger Rumpf: bruchkante kappt ihn an einer schraegen, verrauschten
  // Ebene. Auf der einen Seite steht die Beplankung schon bis zum Schandeck,
  // auf der anderen ist offen — genau das macht eine Helling aus, und es
  // kostet keine zweite Rumpfvariante.
  var rh = rumpf(6.2, 2.3, 1.6, 0.4, MR_HOLZ);
  bruchkante(rh, { nx: 0.55, ny: 1, nz: 0.15, wert: 0.35, rauheit: 0.75 }, 163);
  rh.applyMatrix4(M(0, 2.05, 0));
  parts.push(rh);
  for (i = 0; i < 6; i++) {                                  // aufragende Spanten
    var t = (i + 0.5) / 6, voll = Math.sin(Math.PI * t);
    var hw = 1.15 * Math.pow(voll, 0.5) * (0.7 + 0.3 * voll);
    for (s = -1; s <= 1; s += 2) {
      parts.push(part(new BX(0.12, 1.5, 0.22),
        M(s * hw, 2.8, (t - 0.5) * 6.2, 0, 0, -s * 0.35), MR_HOLZD));
    }
  }
  for (s = -1; s <= 1; s += 2) {                             // Geruestleitern
    parts.push(part(new BX(0.1, 3.2, 0.1), M(s * 1.8, 1.6, 1.6), MR_HOLZD));
    parts.push(part(new BX(0.1, 3.2, 0.1), M(s * 1.8, 1.6, 2.05), MR_HOLZD));
    for (i = 0; i < 5; i++) {
      parts.push(part(new BX(0.09, 0.07, 0.5), M(s * 1.8, 0.6 + i * 0.6, 1.83), MR_HOLZ));
    }
  }
  return mergeGeos(parts);
}

function geoSlipbahn() {
  var parts = [], i, s;
  // Die Bahn faellt nach +z ins Wasser; u ist die Koordinate auf der geneigten
  // Achse, alle Teile teilen dieselbe Drehung um x.
  var neig = 0.24, cn = Math.cos(neig), sn = Math.sin(neig);
  for (i = 0; i < 8; i++) {
    var u = -2.45 + i * 0.7;
    parts.push(part(new BX(2.7, 0.2, 0.3), M(0, 0.45 - u * sn, u * cn, neig, 0, 0), MR_HOLZD));
  }
  for (s = -1; s <= 1; s += 2) {
    for (i = 0; i < 3; i++) {
      var ox = s * (0.3 + i * 0.52);
      parts.push(part(new BX(0.22, 0.22, 5.6), M(ox, 0.62, 0, neig, 0, 0), MR_HOLZ));
    }
  }
  parts.push(part(new BX(3.0, 0.6, 0.6), M(0, 0.5, -2.95), MR_STEIND));        // Widerlager
  return mergeGeos(parts);
}

function geoKaimauer() {
  var parts = [
    part(new BX(4.4, 3.2, 1.7), M(0, -1.15, 0), MR_STEIN),                     // Blockmauer
    part(new BX(4.5, 0.7, 1.84), M(0, -2.4, 0), MR_STEIND),                    // nasse Sockelzone
    part(new BX(4.5, 0.3, 1.88), M(0, 0.6, 0), MR_STEINH),                     // Kaikante
    part(new BX(4.4, 0.16, 1.7), M(0, 0.83, 0), MR_STEIN)                      // Pflaster
  ];
  var ring = new THREE.TorusGeometry(0.2, 0.045, 4, 8);
  for (var i = -1; i <= 1; i++) {
    parts.push(part(new CY(0.2, 0.24, 0.75, 8), M(i * 1.5, 1.28, 0.45), MR_HOLZD));
    parts.push(part(new CY(0.26, 0.26, 0.1, 8), M(i * 1.5, 1.68, 0.45), MR_HOLZD));
    // Torus liegt von Haus aus in der xy-Ebene — der Anlegering haengt damit
    // flach an der Kaifront (z = +0.85) und braucht keine Drehung.
    parts.push(part(ring, M(i * 1.5, 0.2, 0.88), MR_EISEN));
  }
  return mergeGeos(parts);
}

function geoKaitreppe() {
  var parts = [], sub = [], i;
  // treppe() steigt immer nach +z; die Kaitreppe fuehrt INS Wasser, also wird
  // der fertige Lauf um die Hochachse gedreht. Ein zweiter Treppenhelfer mit
  // umgekehrter Laufrichtung waere dieselbe Schleife noch einmal.
  treppe(sub, 8, 1.3, 0.26, 0, -2.08, -2.0, MR_STEIN, MR_STEINH);
  var dreh = M(0, 0, 0, 0, Math.PI, 0);
  for (i = 0; i < sub.length; i++) parts.push(sub[i].applyMatrix4(dreh));
  parts.push(part(new BX(1.7, 0.3, 0.8), M(0, -0.15, -1.4), MR_STEINH));       // Podest oben
  return mergeGeos(parts);
}

function geoKaikran() {
  var parts = [], s, i;
  for (s = -1; s <= 1; s += 2) {
    for (i = -1; i <= 1; i += 2) {
      parts.push(part(new BX(0.22, 4.4, 0.22), M(s * 0.85, 2.2, i * 0.85), MR_HOLZD));
    }
  }
  fachwerk(parts, 1.9, 4.2, -0.85, "z", 1, 167, MR_HOLZD);
  fachwerk(parts, 1.9, 4.2, 0.85, "x", 3, 173, MR_HOLZD);
  parts.push(part(new BX(2.1, 0.95, 2.1), M(0, 4.78, 0), MR_HOLZ));            // Radkasten
  // Das Tretrad ist ein offener Zylinder quer im Kasten — ein geschlossener
  // haette zwei Deckel, die niemand je sieht.
  parts.push(part(new CY(0.8, 0.8, 1.5, 12, 1, true),
    M(0, 4.78, 0, 0, 0, Math.PI / 2), MR_HOLZD));
  parts.push(part(prismGeo(2.5, 1.0, 2.5), M(0, 5.26, 0), 0x6f5a48));          // Haube
  parts.push(part(new BX(0.3, 0.3, 3.4), M(0, 5.0, 1.5, -0.5, 0, 0), MR_HOLZ)); // Ausleger
  parts.push(part(new CY(0.03, 0.03, 3.6, 4), M(0, 3.9, 2.98), MR_SEIL));
  parts.push(part(new BX(0.34, 0.18, 0.34), M(0, 2.1, 2.98), MR_EISEN));       // Kloben
  return mergeGeos(parts);
}

function geoAnleger() {
  var parts = [], i;
  // L-foermig: der Stamm laeuft nach +z ins Wasser, der Kopf quer davor.
  for (i = 0; i < 7; i++) {
    parts.push(part(new BX(1.7, 0.12, 0.46), M(0, 0.55, -1.4 + i * 0.56), MR_HOLZ));
  }
  for (i = 0; i < 5; i++) {
    parts.push(part(new BX(0.5, 0.12, 1.6), M(-1.4 + i * 0.7, 0.55, 2.9), MR_HOLZ));
  }
  parts.push(part(new BX(1.9, 0.16, 0.18), M(0, 0.42, -1.5), MR_HOLZD));       // Landanschluss
  for (i = 0; i < 4; i++) {
    parts.push(part(new CY(0.11, 0.14, 2.2, 6),
      M(i % 2 ? 0.7 : -0.7, -0.4, -1.0 + Math.floor(i / 2) * 1.9), MR_TEER));
  }
  for (i = 0; i < 4; i++) {
    parts.push(part(new CY(0.11, 0.14, 2.2, 6), M(-1.35 + i * 0.9, -0.4, 2.9), MR_TEER));
  }
  for (i = -1; i <= 1; i += 2) {
    parts.push(part(new CY(0.16, 0.19, 0.7, 7), M(i * 1.1, 0.85, 3.3), MR_HOLZD)); // Poller
  }
  return mergeGeos(parts);
}

function geoBootshaus() {
  var parts = [], i;
  for (i = 0; i < 6; i++) {
    parts.push(part(new CY(0.14, 0.18, 2.6, 6),
      M(i % 2 ? 1.35 : -1.35, 0.0, -1.6 + Math.floor(i / 2) * 1.6), MR_TEER));
  }
  parts.push(part(new BX(3.4, 0.16, 4.0), M(0, 1.2, 0), MR_HOLZ));             // Plattform
  parts.push(part(new BX(3.2, 2.2, 3.8), M(0, 2.35, 0), MR_HOLZ));
  // Wasserdurchfahrt: ein dunkler Kasten durch den ganzen Baukoerper. Billiger
  // und lesbarer als eine echte Aussparung, die drei Wandstuecke braeuchte.
  parts.push(part(new BX(1.5, 1.6, 4.1), M(0, 2.0, 0), 0x2a2622));
  dach(parts, 3.2, 3.8, 1.5, 3.45, 0x6f5a48, false);
  // Torbahn vor der Durchfahrt, leicht nach aussen gebaucht
  zeltbahn(parts, [new THREE.Vector3(-0.75, 2.7, 1.94), new THREE.Vector3(0.75, 2.7, 1.94),
    new THREE.Vector3(0.75, 1.35, 1.94), new THREE.Vector3(-0.75, 1.35, 1.94)], 0.14, MR_TUCH);
  return mergeGeos(parts);
}

/* --- Seezeichen ---------------------------------------------------------- */

function geoLeuchtturm() {
  var parts = [], i;
  parts.push(part(new CY(1.5, 2.2, 1.1, 12), M(0, 0.45, 0), MR_STEIND));       // Fundament
  parts.push(part(new CY(0.85, 1.5, 6.6, 12), M(0, 4.3, 0), MR_PUTZ));
  for (i = 0; i < 3; i++) {                                                    // Farbringe
    var t = 0.16 + i * 0.29, r = 1.5 - 0.65 * t;
    parts.push(part(new CY(r + 0.02, r + 0.05, 0.8, 12), M(0, 1.0 + t * 6.6, 0),
      i % 2 ? MR_PUTZ : MR_TUCHR));
  }
  parts.push(part(new CY(1.25, 1.25, 0.22, 12), M(0, 7.71, 0), MR_STEINH));    // Galerie
  parts.push(part(new CY(1.2, 1.2, 0.45, 12, 1, true), M(0, 8.04, 0), MR_EISEN));
  parts.push(part(new CY(0.78, 0.84, 1.3, 10), M(0, 8.6, 0), MR_GLUT));        // Laternenhaus
  for (i = 0; i < 6; i++) {                                                    // Sprossen
    var a = i / 6 * Math.PI * 2;
    parts.push(part(new BX(0.08, 1.32, 0.08),
      M(Math.cos(a) * 0.82, 8.6, Math.sin(a) * 0.82), MR_EISEN));
  }
  parts.push(part(new CO(1.05, 0.85, 10), M(0, 9.68, 0), MR_EISEN));
  parts.push(part(new CY(0.04, 0.04, 0.5, 4), M(0, 10.3, 0), MR_EISEN));
  fenster(parts, 0, 3.4, 1.24, 0.42, 0.7, "z");
  tuer(parts, 0, 1.0, 1.44, 0.7, 1.5);
  return mergeGeos(parts);
}

function geoLeuchtfeuer() {
  var parts = [
    part(new BX(0.55, 0.16, 0.55), M(0, 0.08, 0), MR_STEIND),
    part(new CY(0.07, 0.1, 2.2, 6), M(0, 1.2, 0), MR_EISEN),
    part(new CY(0.34, 0.22, 0.42, 8, 1, true), M(0, 2.4, 0), MR_EISEN),        // Feuerkorb
    part(new IC(0.26, 0), M(0, 2.44, 0, 0, 0, 0, 1, 0.7, 1), MR_GLUT)          // Glut
  ];
  for (var i = 0; i < 4; i++) {
    var a = i / 4 * Math.PI * 2;
    parts.push(part(new BX(0.05, 0.5, 0.05),
      M(Math.cos(a) * 0.3, 2.34, Math.sin(a) * 0.3), MR_EISEN));
  }
  return mergeGeos(parts);
}

function geoBake() {
  // Die Dreieckstafel ist ein sehr flaches prismGeo: das Dreieck steckt damit
  // in EINEM Primitiv statt in zwei PL-Haelften mit offener Rueckseite.
  return mergeGeos([
    part(new CY(0.09, 0.13, 3.6, 6), M(0, 1.4, 0), MR_HOLZD),
    part(new BX(0.8, 0.09, 0.09), M(0, 2.1, 0), MR_HOLZD),
    part(new BX(0.8, 0.09, 0.09), M(0, 1.5, 0), MR_HOLZD),
    part(prismGeo(0.95, 1.05, 0.07), M(0, 2.45, 0), MR_TUCHR)
  ]);
}

function geoBoje() {
  return mergeGeos([
    part(new CY(0.3, 0.34, 0.35, 8), M(0, -0.4, 0), MR_EISEN),                 // Unterwasserteil
    part(new CY(0.34, 0.26, 0.62, 8), M(0, 0.05, 0), MR_TUCHR),
    part(new CO(0.34, 0.42, 8), M(0, 0.57, 0), MR_TUCHR),
    part(new CY(0.04, 0.04, 1.0, 4), M(0, 1.2, 0), MR_EISEN),
    part(new IC(0.16, 0), M(0, 1.68, 0), 0x2a2622)                             // Topzeichen
  ]);
}

function geoHafenlaterne() {
  return mergeGeos([
    part(new CY(0.16, 0.22, 0.35, 6), M(0, 0.17, 0), MR_STEIND),
    part(new CY(0.07, 0.12, 3.4, 6), M(0, 1.9, 0), MR_EISEN),
    // Ausleger als halber Torus, um PI gedreht, damit der Bogen UNTER der
    // Laterne durchhaengt: dieser Schwung unterscheidet die Kailaterne von der
    // geraden Strassenlaterne.
    part(new THREE.TorusGeometry(0.3, 0.035, 4, 8, Math.PI), M(0, 3.35, 0, 0, 0, Math.PI), MR_EISEN),
    part(new BX(0.34, 0.44, 0.34), M(0, 3.72, 0), MR_GLUT),
    part(new BX(0.44, 0.08, 0.44), M(0, 4.0, 0), MR_EISEN),
    part(new CO(0.3, 0.26, 6), M(0, 4.16, 0), MR_EISEN)
  ]);
}

/* --- Fischerei am Ufer --------------------------------------------------- */

function geoNetzgestell() {
  var parts = [], s;
  for (s = -1; s <= 1; s += 2) {
    parts.push(part(new CY(0.06, 0.08, 2.5, 5), M(s * 1.2, 1.1, 0.35, -0.25, 0, 0), MR_HOLZD));
    parts.push(part(new CY(0.06, 0.08, 2.5, 5), M(s * 1.2, 1.1, -0.35, 0.25, 0, 0), MR_HOLZD));
  }
  parts.push(part(new CY(0.055, 0.055, 2.8, 5), M(0, 2.14, 0, 0, 0, Math.PI / 2), MR_HOLZD));
  // Alles Holz auf den opaken Texturstreifen klemmen (Muster geoBaumArt): der
  // Pool traegt eine alphaTest-Karte fuer die Netze, sonst waeren die Boecke
  // durchloechert — und der Wind laesst sie zugleich stehen.
  starr(parts, 0, 0.008);
  for (s = 0; s < 3; s++) {
    var x0 = -0.9 + s * 0.9;
    zeltbahn(parts, [
      new THREE.Vector3(x0 - 0.42, 2.1, 0), new THREE.Vector3(x0 + 0.42, 2.1, 0),
      new THREE.Vector3(x0 + 0.38, 0.7, 0.24), new THREE.Vector3(x0 - 0.38, 0.7, 0.24)
    ], 0.22, MR_NETZ);
  }
  return mergeGeos(parts);
}

function geoFischtrockner() {
  var parts = [], s, i;
  for (s = -1; s <= 1; s += 2) {
    parts.push(part(new BX(0.12, 2.6, 0.12), M(s * 1.3, 1.3, -0.3), MR_HOLZD));
    parts.push(part(new BX(0.12, 2.6, 0.12), M(s * 1.3, 1.3, 0.3), MR_HOLZD));
    parts.push(part(new BX(0.1, 0.1, 0.86), M(s * 1.3, 2.55, 0), MR_HOLZD));
  }
  for (i = 0; i < 2; i++) {
    parts.push(part(new BX(2.8, 0.09, 0.09), M(0, 1.5 + i * 0.9, 0), MR_HOLZD));
  }
  // Stockfische aus einer Seed: zwoelf gleich grosse Klumpen im exakten Raster
  // sehen nach Tapete aus, nicht nach Fang.
  for (i = 0; i < 14; i++) {
    var d = hashi(i, 3, 181);
    parts.push(part(new IC(0.1 + d * 0.05, 0),
      M(-1.2 + (i % 7) * 0.4, 1.5 + (i % 2) * 0.9 - 0.26 - d * 0.08,
        i % 2 ? 0.07 : -0.07, 0, d * 3, 0, 0.7, 1.9, 0.7), 0xcdbd9a));
  }
  return mergeGeos(parts);
}

function geoReusenstapel() {
  var parts = [], i;
  // Offene CY (kein Deckel) = Korbreuse; die Stapelung kommt aus hashi, damit
  // die drei Koerbe nicht wie gestanzt uebereinanderliegen.
  for (i = 0; i < 3; i++) {
    var d = hashi(i, 5, 191);
    parts.push(part(new CY(0.24, 0.3, 0.85, 8, 1, true),
      M(-0.18 + i * 0.2, 0.26 + (i === 2 ? 0.44 : 0), (d - 0.5) * 0.3,
        Math.PI / 2 + (d - 0.5) * 0.2, (d - 0.5) * 0.6, 0), MR_HOLZ));
  }
  parts.push(part(new BX(1.0, 0.07, 0.07), M(0, 0.05, 0.32), MR_HOLZD));
  return mergeGeos(parts);
}

function geoTauhaufen() {
  var parts = [];
  for (var i = 0; i < 3; i++) {
    // radial 3 statt 4: ein aufgeschossenes Tau mit r = 0.4 ist zwei Pixel
    // dick — der Dreikant spart hier ein Viertel der Dreiecke sichtbar folgenlos.
    parts.push(part(new THREE.TorusGeometry(0.3 - i * 0.05, 0.055, 3, 8),
      M(0, 0.06 + i * 0.1, 0, Math.PI / 2, i * 0.5, 0), MR_SEIL));
  }
  return mergeGeos(parts);
}

function geoSalzgarten() {
  var parts = [], i;
  for (i = 0; i < 4; i++) {
    var x = i % 2 ? 1.1 : -1.1, z = i < 2 ? -1.1 : 1.1;
    parts.push(part(new BX(2.1, 0.3, 2.1), M(x, 0.0, z), 0x8a7f68));           // Wanne
    parts.push(part(new BX(1.86, 0.06, 1.86), M(x, 0.13, z), MR_WASSER));      // Sole
  }
  parts.push(part(new BX(4.6, 0.34, 0.34), M(0, 0.17, 0), 0x9c8f74));          // Daemme
  parts.push(part(new BX(0.34, 0.34, 4.6), M(0, 0.17, 0), 0x9c8f74));
  for (i = 0; i < 3; i++) {
    parts.push(part(new CO(0.4, 0.55, 7),
      M(-1.2 + i * 1.2, 0.42, 2.6, 0, i * 0.7, 0, 1, 0.9, 1), MR_SALZ));
  }
  return mergeGeos(parts);
}

/* --- Schiffe. Alle nutzen rumpf(); die Typen unterscheiden sich in Laenge,
   Breite, Rumpfhoehe, Deckssprung und Aufbauten, nicht in der Bauweise. ---- */

function geoFischerboot() {
  var parts = [rumpf(3.6, 1.25, 0.85, 0.22, MR_HOLZ)];
  parts.push(part(new BX(1.0, 0.07, 0.34), M(0, 0.2, -0.55), MR_HOLZH));       // Duchten
  parts.push(part(new BX(1.0, 0.07, 0.34), M(0, 0.2, 0.7), MR_HOLZH));
  takelage(parts, [{ x: 0, z: 0.35, h: 3.4, r: 0.06, wx: 0.5, wy: 0.3 }],
    [{ m: 0, y: 3.0, w: 1.5, h: 2.0, unten: 1.25 }], 197, MR_HOLZD);
  parts.push(part(new BX(0.1, 0.55, 0.6), M(0, 0.1, -1.8, 0.3, 0, 0), MR_HOLZD)); // Ruder
  return mergeGeos(parts);
}

function geoKutter() {
  var parts = [rumpf(5.4, 1.9, 1.25, 0.32, MR_HOLZ)];
  parts.push(part(new BX(1.5, 0.95, 1.8), M(0, 0.78, -1.1), MR_HOLZH));        // Kajuete
  // Eigenes Kajuetdach statt dach(): dach() setzt immer auf x = z = 0 auf, die
  // Kajuete steht aber achtern.
  parts.push(part(prismGeo(1.68, 0.5, 1.92), M(0, 1.25, -1.1), 0x6f5a48));
  parts.push(part(new BX(1.68, 0.08, 1.92), M(0, 1.21, -1.1), 0x4a4038));
  fenster(parts, 0, 1.0, -0.2, 0.4, 0.34, "z");
  takelage(parts, [{ x: 0, z: 0.9, h: 4.8, r: 0.08, wx: 0.75, wy: 0.5 }],
    [{ m: 0, y: 4.3, w: 2.1, h: 2.6, unten: 1.2 },
     { m: 0, y: 4.0, w: 1.2, h: 2.2, dz: 1.4, unten: 0.35, rahe: false }], 199, MR_HOLZD);
  parts.push(part(new BX(0.12, 0.75, 0.55), M(0, 0.05, -2.75, 0.35, 0, 0), MR_HOLZD));
  return mergeGeos(parts);
}

function geoKogge() {
  var parts = [rumpf(7.2, 2.9, 1.9, 0.55, MR_HOLZ)];
  // Kastelle vorn und achtern mit Zinnenband: die Kogge ist ein schwimmendes
  // Wehrbauwerk, deshalb hier dieselbe zinnen()-Zelle wie an Land.
  parts.push(part(new BX(2.0, 1.3, 1.6), M(0, 1.4, -2.6), MR_HOLZH));
  parts.push(part(new BX(1.7, 1.1, 1.3), M(0, 1.3, 2.6), MR_HOLZH));
  zinnen(parts, 2.0, 1.6, 2.05, MR_HOLZD, 4, { z: -2.6, hoehe: 0.34, staerke: 0.18 });
  zinnen(parts, 1.7, 1.3, 1.85, MR_HOLZD, 3, { z: 2.6, hoehe: 0.34, staerke: 0.18 });
  takelage(parts, [{ x: 0, z: 0.2, h: 7.0, r: 0.14, wx: 1.25, wy: 0.75 }],
    [{ m: 0, y: 6.2, w: 4.4, h: 3.4, unten: 1.0 }], 211, MR_HOLZD);
  parts.push(part(new PL(0.9, 0.3), M(0.45, 7.15, 0.2, 0, Math.PI / 2, 0), MR_TUCHR));
  return mergeGeos(parts);
}

function geoDreimaster() {
  var parts = [rumpf(10.5, 3.2, 2.4, 0.7, MR_HOLZ)];
  parts.push(part(new BX(2.4, 1.4, 2.6), M(0, 1.7, -3.6), MR_HOLZH));          // Achterkastell
  parts.push(part(new BX(2.5, 0.16, 2.7), M(0, 2.45, -3.6), MR_HOLZD));
  parts.push(part(new BX(2.0, 0.75, 1.4), M(0, 1.35, 3.8), MR_HOLZH));         // Back
  // Bugspriet: CY-Achse ist +y, PI/2 legt sie nach +z, die 0.3 heben die
  // Spitze aus dem Wasser.
  parts.push(part(new CY(0.06, 0.11, 3.2, 6), M(0, 1.9, 5.2, Math.PI / 2 - 0.3, 0, 0), MR_HOLZD));
  takelage(parts, [
    { x: 0, z: 3.0, h: 7.4, r: 0.14, wx: 1.3, wy: 1.0 },
    { x: 0, z: 0.0, h: 9.6, r: 0.17, wx: 1.55, wy: 1.0 },
    { x: 0, z: -3.4, h: 7.0, r: 0.12, wx: 1.2, wy: 1.5 }
  ], [
    { m: 0, y: 6.9, w: 3.4, h: 2.6 }, { m: 0, y: 4.1, w: 3.9, h: 2.4 },
    { m: 1, y: 9.0, w: 3.8, h: 2.8 }, { m: 1, y: 6.0, w: 4.6, h: 2.9 },
    { m: 2, y: 6.5, w: 3.0, h: 2.3 }, { m: 2, y: 4.0, w: 3.4, h: 2.2 }
  ], 223, MR_HOLZD);
  return mergeGeos(parts);
}

function geoRuderschiff() {
  var parts = [rumpf(9.0, 1.7, 1.3, 0.5, MR_HOLZ)], i, s;
  parts.push(part(new BX(0.42, 0.42, 1.9), M(0, -0.15, 5.0, 0.12, 0, 0), MR_EISEN)); // Rammsporn
  parts.push(part(new BX(0.9, 0.1, 6.4), M(0, 0.5, -0.4), MR_HOLZH));          // Laufgang
  for (s = -1; s <= 1; s += 2) {
    for (i = 0; i < 8; i++) {
      var z = -2.9 + i * 0.82;
      // Riemen leicht gefaechert (hashi): eine exakt parallele Reihe wirkt wie
      // ein Kamm, nicht wie ein rudernder Verband.
      parts.push(part(new BX(2.6, 0.07, 0.11),
        M(s * 1.55, 0.3, z, 0, s * (0.06 + hashi(i, 3, 227) * 0.05), -s * 0.22), MR_HOLZD));
      parts.push(part(new BX(0.5, 0.05, 0.3),
        M(s * 2.75, -0.02, z, 0, s * 0.1, -s * 0.22), MR_HOLZH));              // Blatt
    }
  }
  takelage(parts, [{ x: 0, z: 0.0, h: 5.4, r: 0.1, wx: 0.7, wy: 0.5 }],
    [{ m: 0, y: 4.9, w: 2.8, h: 2.2 }], 229, MR_HOLZD);
  return mergeGeos(parts);
}

function geoFloss() {
  var parts = [], i;
  for (i = 0; i < 6; i++) {
    var d = hashi(i, 3, 233);
    // Stammachse nach z drehen; die halb eingetauchte Lage (Mitte auf y = 0)
    // ist genau die Schwimmlage eines Rundholzes.
    parts.push(part(new CY(0.24 + d * 0.04, 0.26 + d * 0.04, 3.2, 7),
      M(-0.75 + i * 0.3, 0.0, (d - 0.5) * 0.2, Math.PI / 2, (d - 0.5) * 0.05, 0), MR_HOLZD));
  }
  parts.push(part(new BX(1.7, 0.09, 1.7), M(0, 0.24, 0), MR_HOLZ));
  parts.push(part(new BX(1.2, 0.9, 1.2), M(-0.1, 0.73, -0.35), MR_HOLZH));     // Huette
  parts.push(part(prismGeo(1.45, 0.5, 1.45), M(-0.1, 1.18, -0.35), 0x6f5a48));
  parts.push(part(new CY(0.05, 0.06, 3.0, 5), M(0.7, 1.3, 0.8, 0.3, 0, 0.18), MR_HOLZD));
  return mergeGeos(parts);
}

function geoWrack() {
  var parts = [];
  // Erst wegbrechen, dann kippen: bruchkante nimmt dem Rumpf die hochliegende
  // Bordwand, die Matrix legt ihn danach auf die Seite. Aus einem Bestandsteil
  // wird so seine Ruine, ohne eine zweite Rumpfvariante zu bauen.
  var rh = rumpf(6.6, 2.5, 1.8, 0.45, 0x7a6a55);
  bruchkante(rh, { nx: -0.8, ny: 1, nz: 0.3, wert: 0.5, rauheit: 0.9 }, 239);
  rh.applyMatrix4(M(0, 0.1, 0, 0.1, 0, -0.55));
  parts.push(rh);
  parts.push(part(new CY(0.09, 0.17, 2.6, 6), M(1.05, 1.1, 0.3, 0.15, 0, -0.62), MR_HOLZD));
  parts.push(part(new IC(0.32, 0), M(1.95, 0.05, 0.7, 0.4, 0.9, 0.2, 1.4, 0.5, 1.2), MR_STEIND));
  zeltbahn(parts, [new THREE.Vector3(-0.9, 0.55, -1.4), new THREE.Vector3(-1.5, 0.15, 0.9),
    new THREE.Vector3(-0.6, -0.5, 1.2), new THREE.Vector3(-0.2, -0.35, -1.2)], 0.3, MR_TANG);
  return mergeGeos(parts);
}

/* --- Kategorie 7: Bruecken und Wasserbauten ------------------------------ */

function geoSteinbruecke() {
  var parts = [], s, i;
  // bogenreihe liefert Pfeiler und Boegen in einem Zug; die Bruecke setzt nur
  // Fahrbahn, Bruestung und Eisbrecher dazu.
  bogenreihe(parts, 3, 1.9, 1.5, -1.4, MR_STEIN, 2.4, 0.9);
  parts.push(part(new BX(9.0, 0.4, 2.6), M(0, 1.75, 0), MR_STEIN));            // Fahrbahn
  parts.push(part(new BX(9.0, 0.18, 2.84), M(0, 1.99, 0), MR_STEINH));
  for (s = -1; s <= 1; s += 2) {
    parts.push(part(new BX(9.0, 0.5, 0.22), M(0, 2.33, s * 1.31), MR_STEINH)); // Bruestung
  }
  // Eisbrecher: CY mit 3 Radialsegmenten IST der dreieckige Keil — ein
  // gedrehter BX braeuchte zwei Teile fuer dieselbe Schneide.
  for (i = -1; i <= 1; i += 2) {
    parts.push(part(new CY(0.5, 0.62, 2.6, 3), M(i * 1.4, -0.3, 1.5, 0, Math.PI / 6, 0), MR_STEIND));
  }
  return mergeGeos(parts);
}

function geoHolzbruecke() {
  var parts = [], s, i;
  for (i = 0; i < 12; i++) {
    parts.push(part(new BX(0.42, 0.11, 2.2), M(-2.31 + i * 0.42, 1.06, 0), MR_HOLZ));
  }
  for (s = -1; s <= 1; s += 2) {
    parts.push(part(new BX(5.4, 0.22, 0.22), M(0, 0.9, s * 0.95), MR_HOLZD));  // Holm
    for (i = -1; i <= 1; i += 2) {                                             // Joche
      parts.push(part(new CY(0.14, 0.18, 2.8, 6),
        M(i * 1.5, -0.25, s * 0.95, 0, 0, s * i * 0.12), MR_TEER));
    }
    parts.push(part(new BX(5.4, 0.09, 0.09), M(0, 1.85, s * 1.04), MR_HOLZD)); // Handlauf
    for (i = 0; i < 4; i++) {
      parts.push(part(new BX(0.09, 0.85, 0.09), M(-2.1 + i * 1.4, 1.5, s * 1.04), MR_HOLZD));
    }
  }
  return mergeGeos(parts);
}

function geoKanalschleuse() {
  var parts = [], s, i;
  for (s = -1; s <= 1; s += 2) {
    parts.push(part(new BX(1.0, 3.0, 6.0), M(s * 1.9, 0.1, 0), MR_STEIN));     // Kammerwange
    parts.push(part(new BX(1.16, 0.24, 6.2), M(s * 1.9, 1.72, 0), MR_STEINH));
    for (i = -1; i <= 1; i += 2) {                                             // Spindeln
      parts.push(part(new CY(0.09, 0.09, 1.0, 6), M(s * 1.9, 2.3, i * 2.6), MR_EISEN));
      parts.push(part(new BX(0.6, 0.09, 0.09), M(s * 1.9, 2.8, i * 2.6, 0, 0.5, 0), MR_EISEN));
    }
  }
  for (i = -1; i <= 1; i += 2) {                                               // Stemmtore
    for (s = -1; s <= 1; s += 2) {
      parts.push(part(new BX(1.6, 2.2, 0.22), M(s * 0.72, 0.7, i * 2.6, 0, s * i * 0.28, 0), MR_HOLZD));
    }
  }
  parts.push(part(new BX(4.6, 0.16, 0.7), M(0, 1.92, 2.6), MR_HOLZ));          // Steg
  parts.push(part(new BX(2.8, 0.1, 4.6), M(0, -1.2, 0), MR_WASSER));           // Kammerwasser
  return mergeGeos(parts);
}

function geoUferdamm() {
  var parts = [], i;
  // Der Kern ist ein um die Laengsachse gekippter Block: die Kante zum Wasser
  // (+z) liegt tiefer, die Schuettung liegt darauf.
  parts.push(part(new BX(4.0, 0.9, 2.8), M(0, -0.2, 0, 0.34, 0, 0), MR_STEIND));
  for (i = 0; i < 12; i++) {
    var a = hashi(i, 3, 251), b = hashi(i, 7, 251);
    parts.push(part(new IC(0.22 + a * 0.16, 0),
      M(-1.8 + (i % 6) * 0.72, (i < 6 ? 0.25 : -0.3) - b * 0.12,
        (i < 6 ? -0.55 : 0.7) + (a - 0.5) * 0.4,
        a * 3, b * 3, a * 2, 1, 0.75, 1), MR_STEIN));
  }
  return mergeGeos(parts);
}

function geoAquaedukt() {
  var parts = [];
  bogenreihe(parts, 2, 1.7, 3.4, 0, MR_STEIN, 1.3, 0.8);
  parts.push(part(new BX(5.8, 0.4, 1.5), M(0, 4.8, 0), MR_STEIN));             // Rinnenunterbau
  parts.push(part(new BX(5.8, 0.6, 0.3), M(0, 5.3, 0.6), MR_STEINH));          // Wangen
  parts.push(part(new BX(5.8, 0.6, 0.3), M(0, 5.3, -0.6), MR_STEINH));
  parts.push(part(new BX(5.8, 0.12, 0.9), M(0, 5.16, 0), MR_WASSER));          // Wasserfaden
  return mergeGeos(parts);
}

function geoAquaeduktkopf() {
  var parts = [];
  sockel(parts, 3.0, 2.6, MR_STEIND);
  parts.push(part(new BX(3.0, 3.2, 2.6), M(0, 2.1, 0), MR_STEIN));
  parts.push(part(new BX(3.2, 0.22, 2.8), M(0, 3.81, 0), MR_STEINH));
  dach(parts, 3.0, 2.6, 1.1, 3.98, 0x8a5c48, false);
  parts.push(part(new CY(1.25, 1.35, 0.7, 12), M(0, 0.35, 2.2), MR_STEINH));   // Auslaufbecken
  parts.push(part(new CY(1.1, 1.1, 0.1, 12), M(0, 0.66, 2.2), MR_WASSER));
  parts.push(part(new CY(0.18, 0.18, 0.6, 8), M(0, 1.5, 1.55, Math.PI / 2, 0, 0), MR_STEIND));
  parts.push(part(new BX(0.3, 0.95, 0.12), M(0, 1.05, 1.7), MR_WASSER));       // Strahl
  return mergeGeos(parts);
}

/* --- Dauerlicht-Anker: lokale Position + Groesse des Lichtscheins ---------
   Gegenstueck zu FENSTER_ANKER, aber ohne Wuerfeln: emitLicht (objects.js)
   setzt hier IMMER einen fensterlicht-Quad hin. Ein Seezeichen, das in 60 %
   der Faelle aus ist, waere keines. Der bestehende fensterlicht-Pool wird
   bewusst mitbenutzt — atmosphere.js faehrt dessen emissiveIntensity schon
   ueber die Tageszeit, ein eigener Leucht-Pool braeuchte dort eine Zeile.
   Werte: [x, y, z, groesse] im lokalen Massstab des Wirtspools.            */
var LICHT_ANKER = {
  leuchtturm: [0, 8.6, 0, 2.6],
  leuchtfeuer: [0, 2.44, 0, 1.1],
  hafenlaterne: [0, 3.72, 0, 0.7]
};

/* --- Pools. Radien und Familien stammen aus der Katalogtabelle. ----------- */
definePool("werfthalle", geoWerfthalle(), { radius: 4.4, ao: 0.26, familie: 'holz' });
definePool("helling", geoHelling(), { radius: 3.6, ao: 0.26, familie: 'holz' });
definePool("slipbahn", geoSlipbahn(), { radius: 2.6, familie: 'holz' });
definePool("kaimauer", geoKaimauer(), { radius: 2.2, familie: 'stein' });
definePool("kaitreppe", geoKaitreppe(), { radius: 1.2, ao: 0.26, familie: 'stein' });
definePool("kaikran", geoKaikran(), { radius: 2.6, ao: 0.26, familie: 'holz' });
definePool("anleger", geoAnleger(), { radius: 2.4, familie: 'holz' });
definePool("bootshaus", geoBootshaus(), { radius: 2.8, familie: 'holz' });
definePool("leuchtturm", geoLeuchtturm(), { radius: 2.4, familie: 'putz' });
definePool("leuchtfeuer", geoLeuchtfeuer(), { radius: 0.6, familie: 'metall' });
definePool("bake", geoBake(), { radius: 0.7, familie: 'holz' });
definePool("boje", geoBoje(), { radius: 0.5, familie: 'metall' });
// Netze: TEX.kroneZerzaust statt einer eigenen Netzkarte — sie ist die einzige
// vorhandene alphaTest-Silhouette mit dem opaken Streifen am unteren Rand, den
// starr() fuer die Boecke braucht (siehe geoBaumArt). Der Kompromiss ist die
// Silhouette selbst; eine echte Maschenkarte gehoert in textures.js.
definePool("netzgestell", geoNetzgestell(), { radius: 1.4, dbl: true, ao: 0.18,
  map: TEX.kroneZerzaust, alphaTest: 0.4, familie: 'stoff', wind: { amp: 0.24 } });
definePool("fischtrockner", geoFischtrockner(), { radius: 1.5, familie: 'holz' });
definePool("reusenstapel", geoReusenstapel(), { radius: 0.6, familie: 'holz' });
definePool("tauhaufen", geoTauhaufen(), { radius: 0.4, familie: 'stoff' });
definePool("salzgarten", geoSalzgarten(), { radius: 2.8, ao: 0.18, familie: 'erde' });
definePool("hafenlaterne", geoHafenlaterne(), { radius: 0.4, familie: 'metall' });
// Schiffe: dbl, weil die Segel von beiden Seiten gesehen werden. ao bleibt
// niedrig — der Rumpf bringt seine Abdunkelung unter der Wasserlinie schon mit.
definePool("fischerboot", geoFischerboot(), { radius: 1.8, dbl: true, ao: 0.18, familie: 'holz' });
definePool("kutter", geoKutter(), { radius: 2.6, dbl: true, ao: 0.18, familie: 'holz' });
definePool("kogge", geoKogge(), { radius: 3.6, dbl: true, ao: 0.18, familie: 'holz' });
definePool("dreimaster", geoDreimaster(), { radius: 5.0, dbl: true, ao: 0.18, familie: 'holz' });
definePool("ruderschiff", geoRuderschiff(), { radius: 4.0, dbl: true, ao: 0.18, familie: 'holz' });
definePool("floss", geoFloss(), { radius: 1.9, familie: 'holz' });
definePool("wrack", geoWrack(), { radius: 3.0, dbl: true, ao: 0.2, familie: 'holz' });
definePool("steinbruecke", geoSteinbruecke(), { radius: 4.0, ao: 0.26, familie: 'stein' });
definePool("holzbruecke", geoHolzbruecke(), { radius: 2.6, ao: 0.24, familie: 'holz' });
definePool("kanalschleuse", geoKanalschleuse(), { radius: 3.0, ao: 0.24, familie: 'stein' });
definePool("uferdamm", geoUferdamm(), { radius: 2.0, familie: 'stein' });
definePool("aquaedukt", geoAquaedukt(), { radius: 3.0, ao: 0.26, familie: 'stein' });
definePool("aquaeduktkopf", geoAquaeduktkopf(), { radius: 2.0, familie: 'stein' });

/* ==========================================================================
   Kategorie 13 des Objektkatalogs — Natur (Fels, Geysire, Korallen, Pilze),
   erweitert um die Biom-Sonderarten, auf die die Biom-Registry (store.js)
   heute nur in Kommentaren verweist: bambus, palme (Wueste), pilzhut,
   koralle, lavaspalte, wollgras.

   FORMENSPRACHE (Ideen-Welle 2, F6): wenige grosse Flaechen, bewusst
   uebertriebene Proportionen, Silhouette vor Oberflaeche. Ein Fels sind drei
   Flaechen — deshalb sitzt hier ueberall IC(r, 0) (20 Dreiecke) und nicht
   IC(r, 1) (80), und die Form kommt aus der Verzerrung, nicht aus Unterteilung.
   ========================================================================== */
var NA_FELS = 0xb0aca2,       // Grundton wie geoFels — die Formationen sollen
    NA_FELSD = 0x8e897e,      // mit dem Bestandsfelsen als EIN Gestein lesen
    NA_FELSH = 0xc6c1b4,
    NA_ERDE = 0x7d6a52,
    NA_MOOS = 0x5c7a48,
    NA_SINTER = 0xd8cfb8,     // Kalksinter der Terrassen und Geysirkegel
    NA_DAMPF = 0xf0f2ee,
    NA_WASSER = 0x3f6b7a,
    NA_SCHLAMM = 0x6a5a44,
    NA_KORALLE = 0xcf7f68,
    NA_KORALLE2 = 0xe3a98a,
    NA_TANG = 0x5c6b4a,
    NA_MUSCHEL = 0xdcd2bc,
    NA_BLEICH = 0xc6bda6,     // Treibholz, gebleichtes Gebein
    NA_STIEL = 0xe0d3b4,
    NA_HUT = 0xbf5f4c,
    NA_LAMELLE = 0xf2e6cc,
    NA_GLUEHEN = 0x9ff0c8,    // Leuchtpilz, Sporen — kaltes Arbor-Gruen
    NA_LAVA = 0xff8c3c,
    NA_BAMBUS = 0x9aab5e,
    NA_BLATT = 0x7f9a4e,
    NA_DORN = 0x6a5a48;

/**
 * Verzerrter Brocken als gemeinsame Basis von Nadel, Findling, Geroell,
 * Schutt, Eisfels und Muschel. Die Verschiebung laeuft ueber die QUANTISIERTE
 * Position (Muster geoFels/islandGeo), damit doppelt gefuehrte Ecken denselben
 * Versatz bekommen und der Koerper geschlossen bleibt.
 */
function brockenGeo(r, seed, streu) {
  var g = new IC(r, 0), p = g.attributes.position;
  var s = streu === undefined ? 0.45 : streu, i;
  for (i = 0; i < p.count; i++) {
    var qx = Math.round(p.getX(i) * 30), qy = Math.round(p.getY(i) * 30),
        qz = Math.round(p.getZ(i) * 30);
    p.setXYZ(i,
      p.getX(i) * (1 - s * 0.5 + hashi(qx, qz, seed) * s),
      p.getY(i) * (1 - s * 0.5 + hashi(qy, qx, seed + 4) * s),
      p.getZ(i) * (1 - s * 0.5 + hashi(qz, qy, seed + 8) * s));
  }
  g.computeVertexNormals();
  return g;
}

function geoFelsnadel() {
  var parts = [part(brockenGeo(1.25, 79, 0.35), M(0, 0.2, 0, 0, 0, 0, 1, 0.32, 1), NA_FELSD)];
  for (var i = 0; i < 3; i++) {
    var r = 1.0 - i * 0.24;
    parts.push(part(brockenGeo(r, 71 + i * 5, 0.5),
      M((hashi(i, 3, 73) - 0.5) * 0.55, 0.9 + i * 1.7, (hashi(i, 7, 73) - 0.5) * 0.55,
        0, i * 1.1, (hashi(i, 11, 73) - 0.5) * 0.22, 1, 1.55, 1),
      i % 2 ? NA_FELS : NA_FELSD));
  }
  return mergeGeos(parts);
}

function geoFelsbogen() {
  // Der Torus traegt den Bogen in EINEM Primitiv; aus BX-Segmenten gestueckelt
  // stuende an jedem Kaempfer eine Fuge (dieselbe Begruendung wie bogenreihe).
  return mergeGeos([
    part(new THREE.TorusGeometry(1.85, 0.6, 4, 9, Math.PI),
      M(0, 1.45, 0, 0, 0, 0, 1, 1.3, 0.95), NA_FELS),
    part(brockenGeo(1.05, 83, 0.4), M(-1.9, 0.85, 0, 0, 0, 0, 1, 1.5, 1.1), NA_FELSD),
    part(brockenGeo(1.1, 89, 0.4), M(1.9, 0.8, 0, 0, 1.2, 0, 1, 1.4, 1.1), NA_FELSD),
    part(brockenGeo(0.5, 91, 0.5), M(1.15, 0.25, 0.85), NA_FELS)
  ]);
}

function geoFindling() {
  return mergeGeos([
    part(brockenGeo(1.5, 97, 0.5), M(0, 0.95, 0, 0.12, 0.6, -0.08, 1, 0.85, 1), NA_FELS),
    part(brockenGeo(0.55, 101, 0.6), M(0.9, 0.25, 0.7), NA_FELSD),
    // Moos als flach gedrueckter Brocken statt PL: der Pool traegt keine
    // alphaTest-Karte, ein Quad staende hier als sichtbares Rechteck.
    part(brockenGeo(0.85, 103, 0.35), M(-0.15, 1.62, 0.1, 0, 0.8, 0, 1, 0.16, 0.9), NA_MOOS)
  ]);
}

function geoGeroell() {
  var parts = [], i;
  for (i = 0; i < 9; i++) {
    var d = hashi(i, 3, 107), e = hashi(i, 5, 107);
    parts.push(part(brockenGeo(0.16 + d * 0.24, 109 + i * 3, 0.55),
      M((e - 0.5) * 2.0, 0.1 + d * 0.16, (hashi(i, 7, 107) - 0.5) * 2.0,
        d * 2, e * 3, d, 1, 0.7, 1), d < 0.5 ? NA_FELS : NA_FELSD));
  }
  return mergeGeos(parts);
}

function geoBasaltsaeulen() {
  var parts = [], i;
  for (i = 0; i < 7; i++) {
    var d = hashi(i, 3, 127), a = i / 7 * Math.PI * 2;
    var q = i === 0 ? 0 : 0.5 + hashi(i, 5, 127) * 0.5;
    parts.push(part(new CY(0.42, 0.46, 1.6 + d * 3.4, 6),
      M(Math.cos(a) * q, (1.6 + d * 3.4) / 2, Math.sin(a) * q, 0, d * 1.0, (d - 0.5) * 0.07),
      i % 2 ? NA_FELSD : NA_FELS));
  }
  return mergeGeos(parts);
}

function geoGeysir() {
  var parts = [
    part(new CY(0.95, 1.55, 1.0, 9), M(0, 0.5, 0), NA_SINTER),
    part(new CY(0.72, 0.72, 0.9, 9), M(0, 0.6, 0), NA_WASSER),
    part(new CY(1.9, 2.1, 0.22, 9), M(0, 0.11, 0), NA_SINTER)
  ];
  // Dampf auf kroneZerzaust: die einzige vorhandene alphaTest-Silhouette mit
  // dem opaken Streifen am unteren Rand, den starr() fuer den Sinterkegel
  // braucht (Muster netzgestell). Eine echte Dampfkarte gehoert in textures.js.
  starr(parts, 0, 0.008);
  for (var i = 0; i < 3; i++) {
    parts.push(kronenQuad(1.8 + i * 0.5, 2.6 + i * 1.1, 0, 0.9 + i * 1.5, 0,
      i * 1.1, (hashi(i, 3, 131) - 0.5) * 0.3, NA_DAMPF));
  }
  return mergeGeos(parts);
}

function geoSchlammtopf() {
  var parts = [
    part(new CY(1.0, 1.15, 0.5, 9), M(0, 0.25, 0), NA_SCHLAMM),
    part(new CY(0.86, 0.86, 0.1, 9), M(0, 0.46, 0), 0x4a3c2c)
  ];
  for (var i = 0; i < 5; i++) {
    var d = hashi(i, 3, 137), a = i / 5 * 6.28;
    parts.push(part(new IC(0.12 + d * 0.14, 0),
      M(Math.cos(a) * d * 0.6, 0.5 + d * 0.12, Math.sin(a) * d * 0.6,
        0, 0, 0, 1, 0.7, 1), NA_SCHLAMM));
  }
  return mergeGeos(parts);
}

function geoKaskadenstufe() {
  var parts = [], i;
  for (i = 0; i < 3; i++) {
    var r = 2.2 - i * 0.55;
    parts.push(part(new CY(r, r * 1.06, 0.55, 10), M(0, 0.3 + i * 0.5, -i * 0.5), NA_SINTER));
    parts.push(part(new CY(r * 0.86, r * 0.86, 0.12, 10),
      M(0, 0.6 + i * 0.5, -i * 0.5), NA_WASSER));
  }
  // Ueberlauf: eine schmale, geneigte Flaeche je Kante — der Wasserfall ist
  // eine Silhouette, kein Partikelsystem.
  for (i = 0; i < 3; i++) {
    parts.push(part(new BX(0.9, 0.5, 0.1),
      M(0, 0.42 + i * 0.5, 1.55 - i * 0.05 - i * 0.5, 0.35, 0, 0), NA_WASSER));
  }
  return mergeGeos(parts);
}

function geoKoralle() {
  var parts = [part(brockenGeo(0.45, 139, 0.5), M(0, 0.16, 0, 0, 0, 0, 1, 0.6, 1), NA_FELSD)];
  for (var i = 0; i < 5; i++) {
    var a = i / 5 * 6.28 + hashi(i, 3, 141), n = 0.35 + hashi(i, 5, 141) * 0.45;
    var h = 0.9 + hashi(i, 7, 141) * 0.9;
    parts.push(part(new CY(0.07, 0.13, h, 5),
      M(Math.cos(a) * 0.2, 0.2 + h / 2 * Math.cos(n), Math.sin(a) * 0.2,
        Math.sin(a) * n, 0, -Math.cos(a) * n), i % 2 ? NA_KORALLE : NA_KORALLE2));
    parts.push(part(new IC(0.14, 0),
      M(Math.cos(a) * (0.2 + Math.sin(n) * h), 0.2 + h * Math.cos(n),
        Math.sin(a) * (0.2 + Math.sin(n) * h), 0, 0, 0, 1, 0.8, 1), NA_KORALLE2));
  }
  return mergeGeos(parts);
}

function geoSeetang() {
  return mergeGeos([
    kronenQuad(1.1, 1.9, 0, 0, 0, 0.3, 0.1, NA_TANG),
    kronenQuad(0.9, 1.5, 0.2, 0, -0.15, 1.4, -0.14, 0x4e5c40),
    kronenQuad(0.8, 1.2, -0.22, 0, 0.2, 2.5, 0.18, 0x67754e)
  ]);
}

function geoMuschelbank() {
  var parts = [], i;
  for (i = 0; i < 12; i++) {
    var d = hashi(i, 3, 149), e = hashi(i, 5, 149);
    parts.push(part(new IC(0.1 + d * 0.1, 0),
      M((e - 0.5) * 1.7, 0.05 + d * 0.05, (hashi(i, 7, 149) - 0.5) * 1.7,
        d * 3, e * 6, 0, 1.3, 0.35, 1), d < 0.4 ? NA_MUSCHEL : 0xc9bda2));
  }
  return mergeGeos(parts);
}

function geoTreibholz() {
  var parts = [
    part(new CY(0.2, 0.3, 2.4, 6), M(0, 0.28, 0, 0, 0.2, Math.PI / 2), NA_BLEICH),
    part(new CY(0.3, 0.42, 0.5, 7), M(-1.15, 0.32, 0.05, 0, 0, Math.PI / 2), 0xb2a88f)
  ];
  for (var i = 0; i < 4; i++) {
    var a = i / 4 * 6.28 + 0.4, d = hashi(i, 3, 151);
    parts.push(part(new CY(0.05, 0.11, 0.8 + d * 0.5, 5),
      M(-1.3, 0.35 + Math.sin(a) * 0.3, Math.cos(a) * 0.3,
        0, 0, Math.PI / 2 + Math.sin(a) * 0.7), NA_BLEICH));
  }
  return mergeGeos(parts);
}

function geoRiesenpilz() {
  var parts = [
    part(new CY(0.26, 0.4, 2.2, 8), M(0, 1.1, 0, 0, 0, 0.06), NA_STIEL),
    // Phi-Halbschnitt: die Kappe ist eine Halbkugel, in y gestaucht — das
    // gestauchte Profil ist die bewusste Uebertreibung aus F6.
    part(new THREE.SphereGeometry(1.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      M(0.08, 2.05, 0, 0, 0, 0, 1, 0.72, 1), NA_HUT),
    part(new CY(1.5, 1.42, 0.12, 12), M(0.08, 2.03, 0), NA_LAMELLE)
  ];
  // Sechs Lamellen statt zwoelf: unter der Kappe zaehlt der Rhythmus, nicht
  // die Zahl — die zweiten sechs waeren aus keiner Kameradistanz zu trennen.
  for (var i = 0; i < 6; i++) {
    var a = i / 6 * 6.28;
    parts.push(part(new BX(0.06, 0.16, 1.1),
      M(0.08 + Math.cos(a) * 0.65, 1.94, Math.sin(a) * 0.65, 0, -a, 0), NA_LAMELLE));
  }
  return mergeGeos(parts);
}

function geoPilzhut() {
  // Baumhoher Pilz fuer den Pilzwald: dieselbe Bauweise wie riesenpilz, nur in
  // Baumproportionen — die Registry sucht dort eine BAUMSILHOUETTE als Ersatzart.
  var parts = [
    part(new CY(0.2, 0.46, 4.2, 8), M(0.1, 2.1, 0, 0, 0, 0.05), NA_STIEL),
    part(new CY(0.62, 0.62, 0.18, 8), M(0.1, 2.6, 0), NA_LAMELLE),   // Manschette
    part(new THREE.SphereGeometry(2.0, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      M(0.18, 4.0, 0, 0, 0, 0, 1, 0.62, 1), 0xa8556a),
    part(new CY(2.0, 1.9, 0.14, 12), M(0.18, 3.98, 0), NA_LAMELLE)
  ];
  for (var i = 0; i < 5; i++) {   // helle Tupfen als Silhouettenbrecher
    var a = i / 5 * 6.28 + 0.7, d = hashi(i, 3, 157);
    parts.push(part(new IC(0.16 + d * 0.1, 0),
      M(0.18 + Math.cos(a) * (0.5 + d * 0.9), 4.6 - d * 0.45, Math.sin(a) * (0.5 + d * 0.9),
        0, 0, 0, 1, 0.45, 1), NA_LAMELLE));
  }
  return mergeGeos(parts);
}

function geoLeuchtpilz() {
  var parts = [], i;
  // Streuware mit Radius 0.4: IC(r, 0) statt SphereGeometry — bei dieser
  // Groesse ist der Unterschied ein Pixel, der Preis aber ein Sechstel.
  for (i = 0; i < 5; i++) {
    var d = hashi(i, 3, 163), a = i / 5 * 6.28;
    var x = Math.cos(a) * d * 0.35, z = Math.sin(a) * d * 0.35, h = 0.2 + d * 0.3;
    parts.push(part(new CY(0.035, 0.055, h, 4), M(x, h / 2, z), NA_STIEL));
    parts.push(part(new IC(0.09 + d * 0.07, 0), M(x, h, z, 0, 0, 0, 1, 0.7, 1), NA_GLUEHEN));
  }
  return mergeGeos(parts);
}

function geoDornbusch() {
  var parts = [], i;
  for (i = 0; i < 7; i++) {
    var a = i / 7 * Math.PI * 2, d = hashi(i, 3, 167);
    var h = 0.7 + d * 0.8, n = 0.4 + d * 0.5;
    parts.push(part(new CY(0.015, 0.05, h, 4),
      M(Math.cos(a) * 0.1, h / 2 * Math.cos(n) + 0.05, Math.sin(a) * 0.1,
        Math.sin(a) * n, 0, -Math.cos(a) * n), NA_DORN));
    parts.push(part(new CO(0.035, 0.16, 3),
      M(Math.cos(a) * (0.1 + Math.sin(n) * h * 0.7), h * 0.62, Math.sin(a) * (0.1 + Math.sin(n) * h * 0.7),
        Math.sin(a) * (n + 0.9), 0, -Math.cos(a) * (n + 0.9)), 0x8a7a5c));
  }
  return mergeGeos(parts);
}

function geoBambus() {
  var parts = [], i;
  for (i = 0; i < 6; i++) {
    var d = hashi(i, 3, 311), h = 3.4 + d * 2.4;
    var x = (hashi(i, 5, 311) - 0.5) * 0.8, z = (hashi(i, 7, 311) - 0.5) * 0.8;
    parts.push(part(new CY(0.05, 0.075, h, 5),
      M(x, h / 2, z, (d - 0.5) * 0.14, 0, (hashi(i, 11, 311) - 0.5) * 0.18),
      i % 2 ? NA_BAMBUS : 0x8b9c52));
  }
  starr(parts, 0, 0.008);                  // Halme opak halten und still stellen
  for (i = 0; i < 8; i++) {
    var a = i / 8 * Math.PI * 2 + hashi(i, 13, 313) * 0.9;
    parts.push(kronenQuad(1.6, 1.2, Math.cos(a) * 0.35,
      2.4 + hashi(i, 17, 313) * 2.6, Math.sin(a) * 0.35, a,
      (hashi(i, 19, 313) - 0.5) * 0.45, NA_BLATT));
  }
  return mergeGeos(parts);
}

function geoBlumenteppich() {
  return part(new PL(2.4, 2.4), M(0, 0.05, 0, -Math.PI / 2, 0, 0), 0xffffff);
}

function geoLavaspalte() {
  var parts = [], i;
  // Zwei versetzte Kanten, dazwischen die Glut — dieselbe Bauweise wie
  // rissspalt, nur heiss statt leuchtend.
  for (i = 0; i < 2; i++) {
    var s = i ? 1 : -1;
    parts.push(part(new BX(3.6, 0.7, 1.0),
      M(s * 0.05, 0.25, s * 0.72, 0, s * 0.06, s * 0.05), 0x4a4038));
    parts.push(part(new BX(3.4, 0.22, 0.8), M(s * 0.05, 0.6, s * 0.78), 0x5c5248));
  }
  parts.push(part(new BX(3.2, 0.14, 0.6), M(0, 0.12, 0), NA_LAVA));
  for (i = 0; i < 3; i++) {
    parts.push(part(new IC(0.16 + hashi(i, 3, 173) * 0.1, 0),
      M(-1.1 + i * 1.1, 0.2, (hashi(i, 5, 173) - 0.5) * 0.3, 0, 0, 0, 1, 0.6, 1), NA_LAVA));
  }
  return mergeGeos(parts);
}

/* ==========================================================================
   Kategorie 8 des Objektkatalogs — Ruinen und Bruchkanten des zerrissenen
   Planeten. Der Katalog sieht sie ausdruecklich als ABLEITUNG vor: bruchkante()
   kappt fertige Bauteile an einer verrauschten Ebene, damit aus mauerstueck,
   saeule, wehrturm und treppe() ihre Ruinen werden, ohne eine zweite Fassung
   derselben Geometrie zu bauen. Das ist der wirtschaftlichste Weg — und der
   einzige, bei dem Ruine und Original als DASSELBE Bauwerk lesen.
   ========================================================================== */
var RU_STEIN = 0xb4aea0,
    RU_STEIND = 0x8f8878,
    RU_SCHUTT = 0x9c9486,
    RU_MOOS = 0x5e7844,
    RU_EFEU = 0x4f6b3e,
    RU_ERDE = 0x74624a,
    RU_WURZEL = 0x6b5a46,
    RU_SCHEIN = 0xa8e6ff;     // Lichtschein aus dem Riss (Arbor-Kaltlicht)

/** Streut Schutt um den Fuss einer Ruine — die Gebrauchsspur aus F6. */
function schutt(parts, n, radius, seed, hex) {
  for (var i = 0; i < n; i++) {
    var d = hashi(i, 3, seed), a = i / n * 6.28 + hashi(i, 5, seed) * 1.4;
    var q = radius * (0.4 + d * 0.6);
    parts.push(part(brockenGeo(0.14 + d * 0.2, seed + i * 7, 0.55),
      M(Math.cos(a) * q, 0.08 + d * 0.12, Math.sin(a) * q, d * 3, a, d, 1, 0.6, 1),
      hex === undefined ? RU_SCHUTT : hex));
  }
  return parts;
}

function geoMauerruine() {
  // geoMauerstueck() liefert eine FRISCHE Geometrie (definePool haengt seine
  // Abdunkelung an die uebergebene Instanz, nicht an die Funktion) — sie darf
  // hier also gefahrlos zerbrochen werden.
  var w = bruchkante(geoMauerstueck(),
    { nx: 0.42, ny: 1, nz: 0.1, wert: 1.5, rauheit: 0.85 }, 301);
  var parts = [w];
  parts.push(part(brockenGeo(0.7, 307, 0.5), M(1.5, 0.3, 0.2, 0.3, 0.8, 0, 1, 0.5, 1), RU_STEIND));
  parts.push(part(brockenGeo(0.5, 311, 0.4), M(-1.3, 0.9, -0.1, 0, 1.4, 0.2, 1, 0.25, 0.9), RU_MOOS));
  schutt(parts, 5, 1.9, 313);
  return mergeGeos(parts);
}

function geoSaeulenstumpf() {
  var s = bruchkante(geoSaeule(), { ny: 1, nx: 0.3, wert: 1.35, rauheit: 0.55 }, 317);
  return mergeGeos([s,
    part(new CY(0.44, 0.46, 0.8, 9), M(1.0, 0.24, 0.25, 0, 0.4, Math.PI / 2), RU_STEIN),
    part(new CY(0.42, 0.44, 0.7, 9), M(0.55, 0.24, -0.9, 0, 1.1, Math.PI / 2), RU_STEIND),
    part(brockenGeo(0.3, 319, 0.5), M(-0.7, 0.12, 0.6, 0, 0, 0, 1, 0.5, 1), RU_SCHUTT)
  ]);
}

function geoGiebelruine() {
  var parts = [
    part(new BX(3.4, 3.6, 0.55), M(0, 1.8, 0), RU_STEIN),
    part(prismGeo(3.4, 1.7, 0.55), M(0, 3.6, 0), RU_STEIN),
    part(new BX(0.9, 1.2, 0.7), M(-0.75, 2.4, 0), 0x2e3038),          // Fensterloch
    part(new BX(1.1, 0.16, 0.72), M(-0.75, 3.05, 0), RU_STEIND),      // Sturz
    part(new BX(0.75, 1.5, 0.7), M(0.9, 0.75, 0), 0x2e3038)           // Tuerloch
  ];
  var g = bruchkante(mergeGeos(parts),
    { nx: 1, ny: 0.55, nz: 0, wert: 1.55, rauheit: 1.0 }, 323);
  var rest = [g];
  // Efeu als flach gedrueckte Brocken, nicht als Quad: der Pool traegt keine
  // alphaTest-Karte (siehe findling).
  rest.push(part(brockenGeo(0.8, 331, 0.45), M(-1.35, 1.5, 0.32, 0, 0.5, 0.2, 0.9, 1.6, 0.14), RU_EFEU));
  rest.push(part(brockenGeo(0.55, 337, 0.5), M(0.4, 0.5, 0.34, 0, 1.2, 0, 1.2, 0.9, 0.14), RU_MOOS));
  schutt(rest, 6, 2.2, 341);
  return mergeGeos(rest);
}

function geoGewoelbekeller() {
  var parts = [
    // Offene Halbschale: CY ohne Deckel, thetaLength = PI, um x gelegt.
    part(new CY(1.5, 1.5, 3.4, 12, 1, true, 0, Math.PI),
      M(0, 1.15, 0, 0, 0, Math.PI / 2), RU_STEIN),
    part(new BX(0.5, 1.3, 3.5), M(-1.5, 0.65, 0), RU_STEIND),
    part(new BX(0.5, 1.3, 3.5), M(1.5, 0.65, 0), RU_STEIND),
    part(new BX(3.5, 0.3, 0.5), M(0, 0.15, -1.6), RU_STEIND)
  ];
  var g = bruchkante(mergeGeos(parts),
    { nx: 0.2, ny: 0.25, nz: 1, wert: 1.3, rauheit: 0.9 }, 347);
  var rest = [g];
  schutt(rest, 7, 2.0, 349);
  return mergeGeos(rest);
}

function geoBruchkanteFeld() {
  var parts = [
    part(brockenGeo(2.4, 353, 0.4), M(0, -0.6, 0, 0, 0.4, 0, 1.2, 0.85, 1), RU_ERDE),
    part(brockenGeo(2.2, 359, 0.35), M(0.1, 0.35, 0.1, 0, 1.1, 0, 1.15, 0.28, 0.95), 0x6f8a4e)
  ];
  // Wurzelvorhang: fuenf Straenge, die ueber die Abbruchkante nach unten
  // haengen. Sie machen aus einem Erdklotz eine ABGERISSENE Kante.
  for (var i = 0; i < 5; i++) {
    var d = hashi(i, 3, 361), a = -0.9 + i * 0.45;
    var pts = [
      new THREE.Vector3(Math.cos(a) * 1.9, 0.1, Math.sin(a) * 1.9 + 1.2),
      new THREE.Vector3(Math.cos(a) * 2.1, -0.9 - d * 0.4, Math.sin(a) * 2.0 + 1.5),
      new THREE.Vector3(Math.cos(a) * 1.8 + (d - 0.5) * 0.6, -2.2 - d * 1.4,
        Math.sin(a) * 1.8 + 1.4)
    ];
    parts.push(part(tubeGeo(pts, function (t) { return 0.14 * (1 - t * 0.7); }, 4),
      null, RU_WURZEL));
  }
  return mergeGeos(parts);
}

function geoSchwebefels() {
  var parts = [islandGeo(2.1, 367)];
  for (var i = 0; i < 4; i++) {
    var a = i / 4 * 6.28 + 0.6, d = hashi(i, 3, 373);
    parts.push(part(new IC(0.3 + d * 0.25, 0),
      M(Math.cos(a) * d * 1.2, 0.72 + d * 0.12, Math.sin(a) * d * 1.2,
        0, a, 0, 1.2, 0.7, 1.2), d < 0.5 ? 0x6d8f4a : 0x7ba055));
  }
  return mergeGeos(parts);
}

function geoTruemmerhaufen() {
  var parts = [], i;
  for (i = 0; i < 6; i++) {
    var d = hashi(i, 3, 379), e = hashi(i, 5, 379);
    parts.push(part(new BX(0.16 + d * 0.1, 0.16, 1.4 + e * 1.0),
      M((e - 0.5) * 1.2, 0.12 + d * 0.35, (d - 0.5) * 1.2,
        (d - 0.5) * 0.5, e * 3.1, (e - 0.5) * 0.4), 0x7a6450));
  }
  schutt(parts, 4, 1.1, 383, RU_STEIN);
  return mergeGeos(parts);
}

function geoStatuentorso() {
  var parts = [
    part(new BX(1.1, 0.42, 1.1), M(0, 0.21, 0), RU_STEIND),
    part(new BX(0.95, 0.18, 0.95), M(0, 0.5, 0), RU_STEIN),
    part(new CY(0.3, 0.38, 1.5, 8), M(0.05, 1.35, 0, 0, 0.4, 0.07), RU_STEIN),
    part(new IC(0.42, 0), M(0.06, 1.95, 0, 0, 0.5, 0, 1.25, 0.85, 0.9), RU_STEIN),
    part(new CY(0.13, 0.16, 0.9, 6), M(-0.42, 1.6, 0.1, 0.2, 0, 0.35), RU_STEIN)
  ];
  var g = bruchkante(mergeGeos(parts), { ny: 1, nx: 0.3, wert: 2.15, rauheit: 0.5 }, 389);
  return mergeGeos([g, part(brockenGeo(0.28, 397, 0.5), M(0.8, 0.12, 0.55), RU_SCHUTT)]);
}

function geoTreppenruine() {
  var parts = [];
  treppe(parts, 7, 1.6, 0.3, 0, 0, -1.0, RU_STEIN, RU_STEIND);
  var g = bruchkante(mergeGeos(parts),
    { nz: 1, ny: 0.35, wert: 1.5, rauheit: 0.85 }, 401);
  var rest = [g];
  schutt(rest, 5, 1.5, 409);
  return mergeGeos(rest);
}

function geoRissspalt() {
  var parts = [], i;
  for (i = 0; i < 2; i++) {
    var s = i ? 1 : -1;
    parts.push(part(new BX(4.2, 0.9, 1.4),
      M(s * 0.1, 0.3, s * 0.95, 0, s * 0.05, s * 0.04), RU_ERDE));
    parts.push(part(new BX(4.0, 0.2, 1.2), M(s * 0.1, 0.72, s * 1.0), 0x6f8a4e));
  }
  parts.push(part(new BX(3.8, 0.1, 0.5), M(0, -0.15, 0), 0x2a2620));
  parts.push(part(new PL(3.6, 0.42), M(0, -0.08, 0, -Math.PI / 2, 0, 0), RU_SCHEIN));
  return mergeGeos(parts);
}

function geoSturzwurzel() {
  var parts = [
    part(brockenGeo(1.0, 419, 0.4), M(0, 0.1, 0, 0, 0.5, 0, 1.4, 0.4, 1), RU_ERDE)
  ];
  for (var i = 0; i < 5; i++) {
    var d = hashi(i, 3, 421), x = -0.8 + i * 0.4;
    var pts = [
      new THREE.Vector3(x, 0.1, (d - 0.5) * 0.7),
      new THREE.Vector3(x + (d - 0.5) * 0.4, -1.1 - d * 0.5, (d - 0.5) * 0.9),
      new THREE.Vector3(x + (d - 0.5) * 0.9, -2.4 - d * 1.2, (d - 0.5) * 1.1)
    ];
    parts.push(part(tubeGeo(pts, function (t) { return 0.12 * (1 - t * 0.75); }, 4),
      null, RU_WURZEL));
    parts.push(part(new IC(0.2 + d * 0.14, 0),
      M(x + (d - 0.5) * 0.5, -1.4 - d * 0.6, (d - 0.5) * 0.9, 0, 0, 0, 1, 0.5, 0.6), RU_MOOS));
  }
  return mergeGeos(parts);
}

function geoRuinenturm() {
  var t = bruchkante(geoWehrturm(),
    { nx: 0.5, ny: 1, nz: 0.2, wert: 3.6, rauheit: 1.3 }, 431);
  var parts = [t];
  parts.push(part(brockenGeo(0.9, 433, 0.4), M(-1.0, 1.8, 0.6, 0, 0.7, 0.2, 0.5, 2.2, 0.16), RU_EFEU));
  parts.push(part(brockenGeo(0.7, 439, 0.45), M(0.9, 1.1, -0.8, 0, 1.6, -0.2, 0.4, 1.8, 0.16), RU_MOOS));
  schutt(parts, 7, 2.4, 443);
  return mergeGeos(parts);
}

function geoTempelruine() {
  var parts = [
    part(new BX(7.0, 0.4, 4.6), M(0, 0.2, 0), RU_STEIND),
    part(new BX(6.4, 0.35, 4.0), M(0, 0.55, 0), RU_STEIN),
    part(new BX(6.0, 0.25, 3.6), M(0, 0.85, 0), RU_STEIN)
  ];
  saeulen(parts, 2, -2.4, 4.8, 1.0, 1.5, 0.3, 3.0, RU_STEIN);
  parts.push(part(new CY(0.34, 0.34, 0.55, 9), M(-2.4, 4.15, 1.5), RU_STEIND));
  // Gefallene Saeulen als liegende Zylinder mit Trommelfugen — der Bruch
  // erzaehlt mehr als eine zweite stehende Reihe.
  for (var i = 0; i < 4; i++) {
    var d = hashi(i, 3, 449);
    parts.push(part(new CY(0.3, 0.32, 2.2 + d * 1.4, 9),
      M(-1.6 + i * 1.3, 1.3, -1.2 - d * 0.6, 0, 0.2 + d * 0.5, Math.PI / 2 + (d - 0.5) * 0.2),
      i % 2 ? RU_STEIN : RU_STEIND));
  }
  parts.push(part(prismGeo(3.0, 0.9, 0.7), M(1.4, 1.05, 1.6, 0, 0.3, 0.12), RU_STEIN));
  schutt(parts, 8, 3.2, 457);
  return mergeGeos(parts);
}

/* --- Pools Natur und Ruinen. Radien und Familien aus der Katalogtabelle. -- */
definePool("felsnadel", geoFelsnadel(), { radius: 1.2, familie: 'stein' });
definePool("felsbogen", geoFelsbogen(), { radius: 3.2, ao: 0.26, familie: 'stein' });
definePool("findling", geoFindling(), { radius: 1.8, familie: 'stein' });
definePool("geroell", geoGeroell(), { radius: 1.2, ao: 0.2, familie: 'stein',
  drift: DRIFT_BROCKEN });
definePool("basaltsaeulen", geoBasaltsaeulen(), { radius: 1.8, ao: 0.28, familie: 'stein' });
definePool("geysir", geoGeysir(), { radius: 1.6, dbl: true, ao: 0.18,
  map: TEX.kroneZerzaust, alphaTest: 0.4, familie: 'stein', wind: { amp: 0.3 } });
definePool("schlammtopf", geoSchlammtopf(), { radius: 1.2, familie: 'erde' });
definePool("kaskadenstufe", geoKaskadenstufe(), { radius: 2.6, ao: 0.22, familie: 'stein' });
definePool("koralle", geoKoralle(), { radius: 1.0, familie: 'laub' });
definePool("seetang", geoSeetang(), { radius: 0.6, dbl: true, ao: 0.18,
  map: TEX.grassTuft, alphaTest: 0.4, familie: 'laub', wind: { amp: 0.55 } });
definePool("muschelbank", geoMuschelbank(), { radius: 1.0, ao: 0.16, familie: 'stein' });
definePool("treibholz", geoTreibholz(), { radius: 1.4, familie: 'rinde' });
definePool("riesenpilz", geoRiesenpilz(), { radius: 1.4, familie: 'laub' });
definePool("pilzhut", geoPilzhut(), { radius: 2.0, ao: 0.24, familie: 'laub' });
definePool("leuchtpilz", geoLeuchtpilz(), { radius: 0.4, ao: 0.12, familie: 'laub',
  emissive: 0x4ea882, emissiveIntensity: 0.9 });
definePool("dornbusch", geoDornbusch(), { radius: 0.8, familie: 'rinde' });
definePool("bambus", geoBambus(), { radius: 0.9, dbl: true, ao: 0.22,
  map: TEX.kroneSchmal, alphaTest: 0.42, familie: 'laub', wind: { amp: 0.42 } });
definePool("blumenteppich", geoBlumenteppich(), { radius: 1.2, dbl: true, ao: 0,
  map: TEX.bluete, alphaTest: 0.4, familie: 'laub' });
definePool("lavaspalte", geoLavaspalte(), { radius: 2.0, ao: 0.2, familie: 'stein',
  emissive: 0x923a12, emissiveIntensity: 0.8 });

definePool("mauerruine", geoMauerruine(), { radius: 1.6, familie: 'stein' });
definePool("saeulenstumpf", geoSaeulenstumpf(), { radius: 0.8, familie: 'stein' });
definePool("giebelruine", geoGiebelruine(), { radius: 2.2, ao: 0.26, familie: 'stein' });
definePool("gewoelbekeller", geoGewoelbekeller(), { radius: 2.4, ao: 0.28, familie: 'stein' });
definePool("bruchkante", geoBruchkanteFeld(), { radius: 3.4, ao: 0.28, familie: 'erde' });
// schwebefels schwebt laut Namen ohnehin; truemmerhaufen ist Bruchgut. Beide
// bekommen die BROCKEN-Amplitude — sichtbar, aber traege.
definePool("schwebefels", geoSchwebefels(), { radius: 2.5, ao: 0.24, familie: 'stein',
  drift: DRIFT_BROCKEN });
definePool("truemmerhaufen", geoTruemmerhaufen(), { radius: 1.4, familie: 'stein',
  drift: DRIFT_BROCKEN });
definePool("statuentorso", geoStatuentorso(), { radius: 0.9, familie: 'stein' });
definePool("treppenruine", geoTreppenruine(), { radius: 1.8, ao: 0.26, familie: 'stein' });
definePool("rissspalt", geoRissspalt(), { radius: 2.8, ao: 0.2, familie: 'erde',
  emissive: 0x2a5a70, emissiveIntensity: 0.55 });
definePool("sturzwurzel", geoSturzwurzel(), { radius: 1.6, ao: 0.22, familie: 'rinde' });
definePool("ruinenturm", geoRuinenturm(), { radius: 2.0, ao: 0.26, familie: 'stein' });
definePool("tempelruine", geoTempelruine(), { radius: 4.0, ao: 0.26, familie: 'stein' });

/* ==========================================================================
   Kategorie 9 des Objektkatalogs — Arbor. Die weissen Ranken des Riesenbaums,
   der den zerrissenen Planeten zusammenhaelt: alles hier ist weiss, leicht
   durchscheinend hell und traegt leuchtende Adern.

   `blattplateau` und `genBlattstadt` fehlen bewusst — sie sind Struktur-
   generatoren und wohnen in vines.js bei der Rankenachse, nicht hier.
   ========================================================================== */
var AR_HAUT = 0xf2efe4,       // Rankenhaut
    AR_HELL = 0xfaf8f0,
    AR_DUNKEL = 0xd8d2c2,     // Schattenseite, Knoten
    AR_BLATT = 0xdfe9c6,      // Blattoberseite (bleiches Arbor-Gruen)
    AR_BLATTU = 0xeef0dc,     // Unterseite
    AR_ADER = 0xb4e6cc,       // Blattadern und Leuchtrillen
    AR_HOLZ = 0x9c8a6e,       // angezimmertes Holz an der Ranke
    AR_HOLZD = 0x7a6a52,
    AR_METALL = 0x8e8a80,
    AR_GLUT = 0xcdf4e0;       // leuchtender Kern

/**
 * Faerbung fuer tubeGeo: helle Rankenhaut mit einem laengs laufenden Band aus
 * Leuchtadern. Der Katalog nennt das `emissiveAdern`; als colorAt-Funktion
 * braucht es dafuer keinen eigenen Helfer — tubeGeo bringt den Haken schon mit.
 */
function rankenAder(t, i, c) {
  var g = Math.pow(Math.abs(Math.sin(t * 9.5 + hashi(i, 3, 601) * 2.4)), 6);
  c.setRGB(0.95 + g * 0.05, 0.94 + g * 0.06, 0.86 + g * 0.14);
}

function geoRankenstamm() {
  var pts = [], i;
  for (i = 0; i <= 10; i++) {
    var t = i / 10;
    pts.push(new THREE.Vector3(Math.sin(t * 2.4) * 1.7, t * 8.6,
      Math.cos(t * 1.7) * 1.0 - 1.0));
  }
  return mergeGeos([tubeGeo(pts,
    function (u) { return 0.95 - u * 0.34 + Math.sin(u * 7) * 0.07; }, 9, rankenAder)]);
}

function geoRankenknoten() {
  var parts = [], k;
  for (k = 0; k < 3; k++) {
    var a = k / 3 * 6.28 + 0.4;
    var pts = [
      new THREE.Vector3(Math.cos(a) * 3.0, 0.6 + hashi(k, 3, 607) * 1.2, Math.sin(a) * 3.0),
      new THREE.Vector3(Math.cos(a) * 1.3, 1.5, Math.sin(a) * 1.3),
      new THREE.Vector3(0, 2.1, 0),
      new THREE.Vector3(Math.cos(a) * -0.4, 3.4 + hashi(k, 5, 607) * 1.0, Math.sin(a) * -0.4)
    ];
    parts.push(tubeGeo(pts, function (u) { return 0.5 + Math.sin(u * 3.1) * 0.14; }, 8, rankenAder));
  }
  parts.push(part(new IC(0.95, 1), M(0, 2.1, 0, 0, 0.5, 0, 1.1, 0.9, 1.1), AR_HELL));
  return mergeGeos(parts);
}

function geoBlattsteg() {
  var parts = [leafGeo(6.0, 0.62, 0.4, 0.16, AR_BLATT, AR_BLATTU, AR_ADER, 613)];
  // Zwei Halteseile vom Stielansatz zur Spitze: sie machen aus einem Blatt
  // eine BRUECKE — ohne sie liegt es nur herum.
  for (var s = -1; s <= 1; s += 2) {
    parts.push(part(tubeGeo([
      new THREE.Vector3(0.1, 0.1, s * 0.5),
      new THREE.Vector3(3.0, 1.5, s * 0.85),
      new THREE.Vector3(5.9, 0.2, s * 0.3)
    ], function () { return 0.055; }, 4), null, AR_HELL));
  }
  parts.push(part(new CY(0.14, 0.2, 0.9, 6), M(-0.4, 0, 0, 0, 0, Math.PI / 2), AR_HAUT));
  return mergeGeos(parts);
}

function geoRankentreppe() {
  var parts = [], i;
  var pts = [];
  for (i = 0; i <= 6; i++) {
    pts.push(new THREE.Vector3(0, i * 0.9, 0));
  }
  parts.push(tubeGeo(pts, function () { return 0.55; }, 8, rankenAder));  // Ranke als Kern
  for (i = 0; i < 16; i++) {
    var a = i * 0.62, y = 0.3 + i * 0.31;
    parts.push(part(new BX(1.0, 0.11, 0.42),
      M(Math.cos(a) * 0.95, y, Math.sin(a) * 0.95, 0, -a, 0), AR_HOLZ));
  }
  // Handlauf auf derselben Helix, eine Stufenhoehe darueber.
  var hl = [];
  for (i = 0; i <= 16; i++) {
    var b = i * 0.62;
    hl.push(new THREE.Vector3(Math.cos(b) * 1.35, 1.15 + i * 0.31, Math.sin(b) * 1.35));
  }
  parts.push(part(tubeGeo(hl, function () { return 0.06; }, 4), null, AR_HOLZD));
  return mergeGeos(parts);
}

function geoRankenleiter() {
  var parts = [], s, i;
  for (s = -1; s <= 1; s += 2) {
    parts.push(part(tubeGeo([
      new THREE.Vector3(s * 0.3, 4.6, 0),
      new THREE.Vector3(s * 0.34, 2.3, 0.18),
      new THREE.Vector3(s * 0.3, 0.05, 0)
    ], function () { return 0.05; }, 4), null, AR_HOLZD));
  }
  for (i = 0; i < 12; i++) {
    parts.push(part(new BX(0.68, 0.06, 0.09),
      M(0, 0.2 + i * 0.38, 0.1 + Math.sin(i * 0.5) * 0.05, 0, 0,
        (hashi(i, 3, 617) - 0.5) * 0.12), AR_HOLZ));
  }
  return mergeGeos(parts);
}

function geoSaftzapfer() {
  return mergeGeos([
    part(new BX(0.62, 0.5, 0.44), M(0, 1.15, 0), AR_HOLZ),
    part(new BX(0.7, 0.1, 0.52), M(0, 1.44, 0), AR_HOLZD),
    part(new CY(0.07, 0.07, 0.55, 6), M(0, 1.0, 0.25, Math.PI / 2 - 0.5, 0, 0), AR_METALL),
    part(new CY(0.3, 0.24, 0.62, 8), M(0, 0.31, 0.42), AR_HOLZ),
    part(new CY(0.31, 0.31, 0.05, 8), M(0, 0.5, 0.42), AR_HOLZD),
    part(new CY(0.26, 0.26, 0.06, 8), M(0, 0.55, 0.42), AR_GLUT),      // Saftspiegel
    part(new IC(0.06, 0), M(0, 0.78, 0.36), AR_GLUT)                   // fallender Tropfen
  ]);
}

function geoLichtbluete() {
  // Reine Karten mit alphaTest: das emissive Material glueht dann exakt in der
  // Bluetensilhouette. Ein IC-Kern daneben wuerde von derselben alphaTest-Karte
  // durchloechert (die bluete-Textur traegt keinen opaken Streifen).
  return mergeGeos([
    kronenQuad(0.9, 0.9, 0, 0.05, 0, 0.2, 0.1, AR_GLUT),
    kronenQuad(0.75, 0.75, 0.12, 0.3, -0.1, 1.5, -0.2, AR_HELL),
    kronenQuad(0.6, 0.6, -0.14, 0.15, 0.16, 2.7, 0.25, AR_BLATT)
  ]);
}

function geoSporenlaterne() {
  return mergeGeos([
    part(new IC(0.22, 1), M(0, 0.25, 0), AR_GLUT),
    part(new IC(0.34, 0), M(0, 0.25, 0, 0.4, 0.7, 0), AR_HELL)
  ]);
}

function geoWurzelbogen() {
  var parts = [], s;
  for (s = -1; s <= 1; s += 2) {
    parts.push(part(tubeGeo([
      new THREE.Vector3(s * 1.9, 0.0, 0.3),
      new THREE.Vector3(s * 1.5, 1.9, -0.1),
      new THREE.Vector3(s * 0.4, 3.1, 0.1),
      new THREE.Vector3(-s * 0.9, 2.7, -0.2),
      new THREE.Vector3(-s * 1.7, 1.4, 0.2)
    ], function (t) { return 0.34 - t * 0.1; }, 7, rankenAder), null, AR_HAUT));
  }
  // Erdanschuettung als gestauchter Brocken statt moundGeo: moundGeo liest
  // heightAt/terrainColor und wuerde die Geometrie an das Terrain BEIM LADEN
  // binden — Pool-Geometrien werden aber einmal gebaut und ueberall gesetzt.
  for (s = -1; s <= 1; s += 2) {
    parts.push(part(brockenGeo(1.0, 619 + (s + 1), 0.4),
      M(s * 1.8, 0.15, 0.2, 0, s * 0.8, 0, 1.1, 0.45, 1), 0x6f5f48));
    parts.push(part(brockenGeo(0.5, 631 + (s + 1), 0.5),
      M(s * 1.5, 0.5, 0.5, 0, s, 0, 1, 0.35, 0.9), 0x5e7844));
  }
  return mergeGeos(parts);
}

function geoWurzelanker() {
  var parts = [part(brockenGeo(1.25, 641, 0.45), M(0, 0.6, 0, 0.2, 0.6, 0, 1.2, 0.9, 1), 0xa5a094)];
  for (var i = 0; i < 4; i++) {
    var a = i / 4 * 6.28 + 0.5, d = hashi(i, 3, 643);
    parts.push(part(tubeGeo([
      new THREE.Vector3(0, 2.6, 0),
      new THREE.Vector3(Math.cos(a) * 0.9, 1.5, Math.sin(a) * 0.9),
      new THREE.Vector3(Math.cos(a) * 1.7, 0.5 + d * 0.3, Math.sin(a) * 1.7),
      new THREE.Vector3(Math.cos(a) * 2.4, 0.05, Math.sin(a) * 2.4)
    ], function (t) { return 0.32 - t * 0.22; }, 6, rankenAder), null, AR_HAUT));
  }
  return mergeGeos(parts);
}

function geoSamenkapsel() {
  var parts = [];
  // Zwei Halbschalen mit Phi-Segment: die Kapsel ist AUFGEPLATZT, der Spalt
  // dazwischen ist die ganze Idee — eine geschlossene Kugel waere ein Ei.
  for (var s = -1; s <= 1; s += 2) {
    parts.push(part(new THREE.SphereGeometry(1.5, 10, 6, 0, Math.PI * 0.82, 0, Math.PI),
      M(0, 1.45, 0, 0, s > 0 ? 0.35 : Math.PI + 0.35, 0, 1, 1.25, 1),
      s > 0 ? AR_HAUT : AR_DUNKEL));
  }
  parts.push(part(new IC(0.85, 0), M(0, 1.3, 0), AR_GLUT));            // Innenlicht
  parts.push(part(new BX(2.6, 0.3, 1.8), M(0, 0.15, 0), 0x8a8278));    // Fuss im Boden
  tuer(parts, 0, 0.25, 0.95, 0.7, 1.2);
  return mergeGeos(parts);
}

function geoRankenkai() {
  var parts = [leafGeo(5.2, 1.5, 0.22, 0.22, AR_BLATT, AR_BLATTU, AR_ADER, 647)];
  var i;
  for (i = 0; i < 4; i++) {   // Poller entlang der Blattkante
    var u = 1.2 + i * 1.0, s = i % 2 ? 1 : -1;
    parts.push(part(new CY(0.13, 0.17, 0.55, 7),
      M(u, 0.05 - u * 0.012, s * leafHalfWidth(u / 5.2) * 1.5 * 0.8), AR_HOLZ));
  }
  for (i = -1; i <= 1; i += 2) {
    parts.push(part(new CY(0.07, 0.1, 3.0, 6), M(2.4, 1.5, i * 0.5, 0, 0, i * 0.05), AR_HOLZD));
    parts.push(part(new PL(0.8, 0.3), M(2.8, 2.7, i * 0.5, 0, Math.PI / 2, 0.1), AR_ADER));
  }
  parts.push(part(new CY(0.18, 0.26, 1.1, 6), M(-0.5, 0, 0, 0, 0, Math.PI / 2), AR_HAUT));
  return mergeGeos(parts);
}

function geoHuetersaeule() {
  var parts = [
    part(new BX(0.8, 0.24, 0.8), M(0, 0.12, 0), AR_DUNKEL),
    part(new CY(0.24, 0.34, 3.2, 8), M(0, 1.7, 0), AR_HELL),
    part(new CO(0.3, 0.5, 8), M(0, 3.55, 0), AR_HAUT)
  ];
  for (var i = 0; i < 4; i++) {      // geschnitzte Rankenbaender
    parts.push(part(new BX(0.72, 0.09, 0.72),
      M(0, 0.7 + i * 0.68, 0, 0, i * 0.5, 0), i % 2 ? AR_GLUT : AR_DUNKEL));
  }
  return mergeGeos(parts);
}

/* ==========================================================================
   Kategorie 12 — Biom Moor / Sumpf. Dunkle Erde, nasses Holz, wenig Farbe:
   das Moor lebt von der Silhouette gegen den Dunst, nicht von Buntheit.
   ========================================================================== */
var MO_TORF = 0x4a3f31,
    MO_TORFH = 0x655440,
    MO_HOLZ = 0x7d6e56,
    MO_HOLZD = 0x5c5040,
    MO_WASSER = 0x384432,
    MO_MOOS = 0x6c7a48,
    MO_REET = 0x9a8a62,
    MO_SCHILF = 0x8b9a5c,
    MO_BLUETE = 0xe8e0d0,
    MO_IRR = 0xa6f2c4,
    MO_STOFF = 0xaa9a80;

function geoTorfstich() {
  var parts = [], i;
  for (i = 0; i < 3; i++) {          // abgestochene Stufenkante
    parts.push(part(new BX(4.0 - i * 0.5, 0.5, 1.2),
      M(0, 0.25 + i * 0.45, -0.7 - i * 0.9), i % 2 ? MO_TORF : MO_TORFH));
  }
  parts.push(part(new BX(4.2, 0.12, 2.0), M(0, 0.06, 1.1), MO_WASSER));
  for (i = 0; i < 8; i++) {          // gestochene Soden zum Trocknen
    var d = hashi(i, 3, 701);
    parts.push(part(new BX(0.5, 0.16, 0.32),
      M(-1.6 + (i % 4) * 1.05, 0.09 + Math.floor(i / 4) * 0.17, 0.5 + (d - 0.5) * 0.5,
        0, (d - 0.5) * 0.5, 0), MO_TORF));
  }
  return mergeGeos(parts);
}

function geoTorfstapel() {
  var parts = [], i;
  for (i = 0; i < 12; i++) {
    var lage = Math.floor(i / 4), d = hashi(i, 3, 709);
    var q = 0.5 - lage * 0.13;
    var a = (i % 4) / 4 * 6.28 + lage * 0.7;
    parts.push(part(new BX(0.46, 0.17, 0.3),
      M(Math.cos(a) * q, 0.09 + lage * 0.18, Math.sin(a) * q, 0, -a + (d - 0.5) * 0.3, 0),
      lage % 2 ? MO_TORF : MO_TORFH));
  }
  return mergeGeos(parts);
}

function geoMoorsteg() {
  var parts = [], i;
  for (i = 0; i < 12; i++) {
    var d = hashi(i, 3, 719);
    // Leicht wellig: ein Bohlenweg im Moor liegt nie eben, und genau das
    // erzaehlt den weichen Untergrund.
    parts.push(part(new BX(1.5, 0.09, 0.42),
      M((d - 0.5) * 0.12, 0.42 + Math.sin(i * 0.9) * 0.09, -2.6 + i * 0.47,
        Math.sin(i * 0.9) * 0.06, (d - 0.5) * 0.12, (d - 0.5) * 0.1), MO_HOLZ));
  }
  for (i = 0; i < 6; i++) {
    parts.push(part(new CY(0.08, 0.1, 1.1, 5),
      M(i % 2 ? 0.6 : -0.6, -0.05, -2.3 + i * 0.94), MO_HOLZD));
  }
  return mergeGeos(parts);
}

function geoMoorhuette() {
  var parts = [];
  sockel(parts, 2.4, 2.0, 0x6a6052);
  // Die Kate steht schief — die bewusste Uebertreibung aus F6. Ein gerades
  // Haus im Moor sieht aus wie ein Fehler, ein schiefes wie eine Geschichte.
  parts.push(part(new BX(2.4, 1.7, 2.0), M(0, 1.15, 0, 0.04, 0, -0.07), 0xa89c84));
  dach(parts, 2.4, 2.0, 1.25, 2.05, MO_REET, true);
  parts.push(part(new BX(2.7, 0.2, 2.3), M(0, 2.75, 0, 0, 0, -0.05), MO_MOOS)); // Torfdach
  tuer(parts, 0.35, 0.42, 1.03, 0.6, 1.15);
  fenster(parts, -0.6, 1.35, 1.03, 0.42, 0.44, "z");
  parts.push(part(brockenGeo(0.6, 727, 0.5), M(-1.3, 0.35, 0.7, 0, 0.6, 0, 1, 0.4, 1), MO_MOOS));
  return mergeGeos(parts);
}

function geoAalreuse() {
  return mergeGeos([
    part(new CY(0.11, 0.13, 2.4, 5), M(0.35, 0.9, 0, 0.1, 0, -0.12), MO_HOLZD),
    part(new CY(0.16, 0.28, 0.95, 8, 1, true), M(0, 0.0, 0, Math.PI / 2 - 0.25, 0.4, 0), MO_HOLZ),
    part(new CY(0.29, 0.29, 0.05, 8), M(-0.12, -0.35, 0, Math.PI / 2 - 0.25, 0.4, 0), MO_HOLZD),
    part(new CY(0.5, 0.5, 0.04, 10), M(0, 0.02, 0), MO_WASSER)
  ]);
}

function geoIrrlicht() {
  return mergeGeos([
    part(new IC(0.16, 1), M(0, 0.9, 0), MO_IRR),
    part(new IC(0.28, 0), M(0, 0.9, 0, 0.3, 0.8, 0, 1, 0.8, 1), 0xd6f8e4)
  ]);
}

function geoSchilf() {
  return mergeGeos([
    kronenQuad(1.0, 1.9, 0, 0, 0, 0.25, 0.06, MO_SCHILF),
    kronenQuad(0.9, 1.6, 0.1, 0, 0.12, 1.55, -0.1, 0x7d8c52),
    kronenQuad(0.7, 1.2, -0.12, 0, -0.1, 2.6, 0.14, 0x9aa868)
  ]);
}

function geoSeerose() {
  var parts = [], i;
  for (i = 0; i < 3; i++) {
    var a = i / 3 * 6.28, d = hashi(i, 3, 733);
    parts.push(part(new CY(0.34 + d * 0.16, 0.34 + d * 0.16, 0.04, 9),
      M(Math.cos(a) * 0.42, 0.02, Math.sin(a) * 0.42), i === 1 ? 0x5c7a48 : 0x6b8a50));
  }
  parts.push(part(new IC(0.14, 0), M(0, 0.1, 0, 0, 0, 0, 1, 0.9, 1), MO_BLUETE));
  parts.push(part(new IC(0.07, 0), M(0, 0.18, 0), 0xe8d488));
  return mergeGeos(parts);
}

function geoWurzelstelze() {
  var parts = [], i;
  for (i = 0; i < 6; i++) {          // Stelzwurzeln, die den Stamm aus dem Wasser heben
    var a = i / 6 * 6.28 + 0.3, d = hashi(i, 3, 739);
    parts.push(part(tubeGeo([
      new THREE.Vector3(Math.cos(a) * 0.25, 1.9, Math.sin(a) * 0.25),
      new THREE.Vector3(Math.cos(a) * 0.9, 1.0, Math.sin(a) * 0.9),
      new THREE.Vector3(Math.cos(a) * 1.35, -0.15 - d * 0.2, Math.sin(a) * 1.35)
    ], function (t) { return 0.2 - t * 0.09; }, 5), null, 0x5c5244));
  }
  starr(parts, 0, 0.008);            // Wurzeln opak halten (Pool traegt Kronenkarte)
  parts.push(geoBaumArt(BAUM_SUMPF).translate(0, 1.7, 0));
  return mergeGeos(parts);
}

function geoPfahlgoetze() {
  var parts = [
    part(new CY(0.17, 0.22, 2.3, 7), M(0, 1.15, 0, 0, 0.3, 0.03), MO_HOLZ),
    part(new BX(0.44, 0.34, 0.4), M(0, 2.3, 0, 0, 0.3, 0), MO_HOLZ),
    part(new BX(0.1, 0.08, 0.1), M(-0.1, 2.35, 0.2, 0, 0.3, 0), 0x2a2620),   // Augen
    part(new BX(0.1, 0.08, 0.1), M(0.1, 2.35, 0.18, 0, 0.3, 0), 0x2a2620),
    part(new BX(0.3, 0.06, 0.1), M(0, 2.18, 0.2, 0, 0.3, 0), 0x2a2620)
  ];
  for (var i = 0; i < 3; i++) {
    parts.push(part(new PL(0.16, 0.7),
      M(0, 1.65 - i * 0.1, 0.22, 0, i * 1.2, (hashi(i, 3, 743) - 0.5) * 0.4), MO_STOFF));
  }
  return mergeGeos(parts);
}

function geoMoorkahn() {
  return mergeGeos([
    part(new BX(0.9, 0.28, 3.2), M(0, 0.05, 0), MO_HOLZ),
    part(new BX(0.1, 0.34, 3.2), M(-0.45, 0.15, 0), MO_HOLZD),
    part(new BX(0.1, 0.34, 3.2), M(0.45, 0.15, 0), MO_HOLZD),
    part(new BX(0.9, 0.3, 0.4), M(0, 0.16, 1.55, -0.4, 0, 0), MO_HOLZD),
    part(new BX(0.9, 0.3, 0.4), M(0, 0.16, -1.55, 0.4, 0, 0), MO_HOLZD),
    part(new BX(0.8, 0.06, 0.24), M(0, 0.24, -0.5), MO_HOLZ),
    part(new CY(0.04, 0.05, 3.4, 5), M(0.3, 1.1, 0.3, 0.35, 0, 0.12), MO_HOLZD)
  ]);
}

function geoWollgras() {
  // Reine Karten: unten der Horst, oben die weissen Fruchtstaende. Zwei Ebenen
  // statt IC-Koepfen — der Pool traegt eine alphaTest-Karte, ein Koerper darin
  // wuerde durchloechert.
  return mergeGeos([
    kronenQuad(0.9, 0.8, 0, 0, 0, 0.3, 0, 0x8a9a60),
    kronenQuad(0.8, 0.7, 0.08, 0, 0.06, 1.6, 0.08, 0x7d8c54),
    kronenQuad(0.55, 0.5, 0, 0.55, 0, 0.7, -0.06, 0xf2efe0),
    kronenQuad(0.45, 0.42, 0.1, 0.72, -0.08, 2.2, 0.1, 0xe8e4d2)
  ]);
}

/* ==========================================================================
   Kategorie 10 — Biom Eis / Schnee. Weiss auf Weiss lebt nur ueber die
   Silhouette und einen kuehlen Schattenton; deshalb ist der Schnee hier nie
   rein 0xffffff, sondern immer leicht blau gebrochen.
   ========================================================================== */
var EI_SCHNEE = 0xf2f6fa,
    EI_SCHNEED = 0xd4e0ea,
    EI_EIS = 0xb8d6e4,
    EI_EISD = 0x82abc2,
    EI_FELL = 0x8a7358,
    EI_FELLD = 0x685440,
    EI_HOLZ = 0x8a7050,
    EI_HOLZD = 0x6a5540,
    EI_GEWEIH = 0xdcd4bc,
    EI_DAMPF = 0xeaf0f4,
    EI_SINTER = 0xc4bca6;

function geoIglu() {
  var parts = [
    part(new THREE.SphereGeometry(1.7, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      M(0, 0, 0, 0, 0, 0, 1, 0.92, 1), EI_SCHNEE),
    part(new CY(0.62, 0.7, 1.5, 8, 1, true), M(0, 0.62, 1.6, Math.PI / 2, 0, 0), EI_SCHNEE),
    part(new CY(0.5, 0.5, 0.1, 8), M(0, 0.6, 2.3, Math.PI / 2, 0, 0), 0x2a3038)
  ];
  // Blockfugen als flach aufgesetzte Quader: die Kuppel wird dadurch aus
  // Schneebloecken GEBAUT statt gegossen — zehn reichen dafuer.
  for (var i = 0; i < 10; i++) {
    var ring = Math.floor(i / 5), a = (i % 5) / 5 * 6.28 + ring * 0.6;
    var t = ring === 0 ? 0.35 : 0.78, r = Math.cos(t) * 1.72, y = Math.sin(t) * 1.58;
    parts.push(part(new BX(0.62, 0.1, 0.28),
      M(Math.cos(a) * r, y, Math.sin(a) * r, 0, -a, t), EI_SCHNEED));
  }
  return mergeGeos(parts);
}

function geoEisfischerhuette() {
  var parts = [
    part(new BX(1.7, 1.4, 1.5), M(0, 0.7, 0, 0, 0, 0.04), 0x9c8a70)
  ];
  parts.push(part(prismGeo(1.95, 0.8, 1.75), M(0, 1.4, 0, 0, 0, 0.04), EI_SCHNEE));
  parts.push(part(new BX(1.95, 0.09, 1.75), M(0, 1.36, 0, 0, 0, 0.04), 0x4a4038));
  tuer(parts, 0, 0.05, 0.78, 0.55, 1.0);
  parts.push(part(new CY(0.4, 0.4, 0.06, 9), M(1.3, 0.03, 0.9), 0x2a4450));   // Angelloch
  parts.push(part(new CY(0.02, 0.03, 0.9, 4), M(1.3, 0.45, 0.9, 0.4, 0, 0.2), EI_HOLZD));
  return mergeGeos(parts);
}

function geoSchlitten() {
  var parts = [], s;
  for (s = -1; s <= 1; s += 2) {
    parts.push(part(new BX(0.1, 0.1, 2.0), M(s * 0.34, 0.08, 0), EI_HOLZD));
    parts.push(part(new BX(0.1, 0.32, 0.28), M(s * 0.34, 0.25, -0.95, -0.5, 0, 0), EI_HOLZD));
    parts.push(part(new BX(0.09, 0.45, 0.09), M(s * 0.34, 0.35, 0.85), EI_HOLZ));
  }
  parts.push(part(new BX(0.82, 0.3, 1.5), M(0, 0.32, -0.05), EI_HOLZ));
  parts.push(part(new BX(0.86, 0.08, 0.1), M(0, 0.58, 0.85), EI_HOLZ));
  parts.push(part(new IC(0.3, 0), M(-0.1, 0.6, -0.3, 0.3, 0.6, 0, 1.3, 0.8, 1), EI_FELL));
  parts.push(part(new IC(0.24, 0), M(0.18, 0.58, 0.2, 0, 1.1, 0.2, 1.2, 0.8, 1), EI_FELLD));
  return mergeGeos(parts);
}

function geoEisfels() {
  var parts = [
    part(brockenGeo(1.1, 751, 0.5), M(0, 0.8, 0, 0.1, 0.5, 0, 1, 1.5, 1), 0x9aa8ae),
    part(brockenGeo(0.85, 757, 0.45), M(0.2, 1.9, 0.1, 0, 1.2, 0.15, 1, 0.9, 1), EI_SCHNEE)
  ];
  for (var i = 0; i < 5; i++) {
    var a = i / 5 * 6.28, d = hashi(i, 3, 761);
    parts.push(part(new CO(0.13, 0.5 + d * 0.5, 5),
      M(Math.cos(a) * 0.85, 1.0 + d * 0.7, Math.sin(a) * 0.85, Math.PI, 0, 0), EI_EIS));
  }
  return mergeGeos(parts);
}

function geoEisscholle() {
  // Flache, quantisiert verzerrte Platte — dieselbe Technik wie islandGeo,
  // aber ohne Unterbau: eine Scholle hat keine Wurzel.
  var g = new IC(2.2, 0), p = g.attributes.position, i;
  for (i = 0; i < p.count; i++) {
    var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    var qx = Math.round(x * 20), qz = Math.round(z * 20);
    var d = (hashi(qx, qz, 769) - 0.5) * 0.9;
    p.setXYZ(i, x * (1 + d * 0.3), y * 0.11 + (y > 0 ? 0.14 : -0.06), z * (1 + d * 0.3));
  }
  g.computeVertexNormals();
  return mergeGeos([part(g, null, EI_SCHNEE),
    part(brockenGeo(0.55, 773, 0.5), M(0.5, 0.2, -0.3, 0, 0.7, 0, 1, 0.9, 1), EI_EIS)]);
}

function geoGletschertor() {
  var parts = [
    part(new THREE.TorusGeometry(1.7, 0.75, 4, 8, Math.PI),
      M(0, 1.3, 0, 0, 0, 0, 1, 1.35, 1.1), EI_EIS),
    part(new BX(1.0, 2.0, 1.2), M(-1.75, 1.0, 0, 0, 0.2, -0.06), EI_EIS),
    part(new BX(1.0, 2.0, 1.2), M(1.75, 1.0, 0, 0, -0.2, 0.06), EI_EIS),
    part(new PL(2.9, 3.0), M(0, 1.5, -0.5), 0x1c3a4e)                  // dunkles Inneres
  ];
  for (var i = 0; i < 6; i++) {
    var d = hashi(i, 3, 787), a = -1.1 + i * 0.44;
    parts.push(part(brockenGeo(0.4 + d * 0.35, 787 + i * 5, 0.5),
      M(Math.cos(a) * 2.2, 0.3 + d * 0.5, Math.sin(a) * 1.2 + 0.6, d, a, 0), EI_SCHNEE));
  }
  return mergeGeos(parts);
}

function geoPelzzelt() {
  var parts = [], i;
  for (i = 0; i < 5; i++) {          // Stangen ragen oben heraus
    var a = i / 5 * 6.28;
    parts.push(part(new CY(0.04, 0.06, 3.4, 4),
      M(Math.cos(a) * 0.3, 1.7, Math.sin(a) * 0.3, Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25),
      EI_HOLZD));
  }
  parts.push(part(new CO(1.35, 2.6, 9), M(0, 1.3, 0), EI_FELL));
  parts.push(part(new CO(1.4, 0.5, 9), M(0, 0.25, 0), EI_FELLD));      // schwerer Saum
  parts.push(part(new BX(0.6, 1.1, 0.12), M(0, 0.55, 1.05, 0.18, 0, 0), EI_FELLD));
  return mergeGeos(parts);
}

function geoSchneewall() {
  var parts = [], i;
  for (i = 0; i < 8; i++) {
    var lage = i % 2, d = hashi(i, 3, 797);
    parts.push(part(new BX(1.0, 0.5, 0.55),
      M(-1.7 + Math.floor(i / 2) * 1.15 + lage * 0.1, 0.25 + lage * 0.5,
        (d - 0.5) * 0.14, 0, (d - 0.5) * 0.12, 0), lage ? EI_SCHNEE : EI_SCHNEED));
  }
  parts.push(part(new CY(0.3, 0.3, 4.5, 7, 1, false),
    M(0, 1.0, 0, 0, 0, Math.PI / 2, 1, 1, 0.65), EI_SCHNEE));          // gerundete Krone
  return mergeGeos(parts);
}

function geoThermalquelle() {
  var parts = [
    part(new CY(1.35, 1.6, 0.55, 10), M(0, 0.27, 0), EI_SINTER),
    part(new CY(1.15, 1.15, 0.12, 10), M(0, 0.5, 0), 0x4e8296)
  ];
  for (var i = 0; i < 4; i++) {
    var a = i / 4 * 6.28 + 0.4;
    parts.push(part(brockenGeo(0.4, 809 + i * 3, 0.5),
      M(Math.cos(a) * 1.5, 0.2, Math.sin(a) * 1.5, 0, a, 0, 1, 0.55, 1), EI_SINTER));
  }
  starr(parts, 0, 0.008);
  parts.push(kronenQuad(1.6, 2.2, 0, 0.5, 0, 0.4, 0.12, EI_DAMPF));
  parts.push(kronenQuad(1.3, 1.8, 0.2, 0.7, -0.2, 1.7, -0.15, EI_DAMPF));
  return mergeGeos(parts);
}

function geoGeweihgestell() {
  var parts = [], s, i;
  for (s = -1; s <= 1; s += 2) {
    parts.push(part(new BX(0.1, 2.0, 0.1), M(s * 1.0, 1.0, -0.25), EI_HOLZD));
    parts.push(part(new BX(0.1, 2.0, 0.1), M(s * 1.0, 1.0, 0.25), EI_HOLZD));
  }
  parts.push(part(new BX(2.3, 0.09, 0.09), M(0, 1.95, 0), EI_HOLZD));
  for (i = 0; i < 4; i++) {          // Geweihe: Stange plus zwei Enden
    var x = -0.9 + i * 0.6, d = hashi(i, 3, 811);
    parts.push(part(new CY(0.035, 0.055, 0.9 + d * 0.4, 4),
      M(x, 1.55, 0, 0, 0, (d - 0.5) * 0.5), EI_GEWEIH));
    parts.push(part(new CY(0.03, 0.04, 0.5, 4),
      M(x + 0.15, 1.95 + d * 0.2, 0, 0, 0, 0.8), EI_GEWEIH));
    parts.push(part(new CY(0.03, 0.04, 0.42, 4),
      M(x - 0.15, 1.9 + d * 0.2, 0, 0, 0, -0.9), EI_GEWEIH));
  }
  for (i = -1; i <= 1; i += 2) {     // Felle ueber der Stange
    parts.push(part(new BX(0.75, 1.0, 0.12), M(i * 0.5, 1.42, 0.24, 0, 0, i * 0.05),
      i > 0 ? EI_FELL : EI_FELLD));
  }
  return mergeGeos(parts);
}

/* ==========================================================================
   Kategorie 11 — Biom Wueste. Lehm, Sand, gespanntes Tuch. Der Katalog fuehrt
   `karawanserei` als Struktur-Generator (G) — sie fehlt hier bewusst, weil ein
   ummauerter Hof aus Kantenlaengen entsteht und nicht aus einer Instanz.
   ========================================================================== */
var WU_LEHM = 0xd6c096,
    WU_LEHMD = 0xae9670,
    WU_LEHMH = 0xe8d8b2,
    WU_STOFF = 0xc9a97c,
    WU_STOFFD = 0x9c8158,
    WU_HOLZ = 0x9a7f56,
    WU_SAND = 0xe0d0a6,
    WU_STEIN = 0xc2b28c,
    WU_STEIND = 0x9a8c6a,
    WU_GOLD = 0xd8b25e,
    WU_WASSER = 0x3f7f8c,
    WU_PALME = 0x7f9a4e,
    WU_KNOCHEN = 0xe6dec6;

function geoWuestenzelt() {
  var parts = [], i;
  for (i = 0; i < 3; i++) {          // Firststangen
    parts.push(part(new CY(0.06, 0.09, 3.0, 5), M(-1.2 + i * 1.2, 1.5, 0), WU_HOLZ));
  }
  for (i = 0; i < 6; i++) {          // Abspannpfloecke
    var a = i / 6 * 6.28;
    parts.push(part(new CY(0.04, 0.05, 0.4, 4),
      M(Math.cos(a) * 2.3, 0.1, Math.sin(a) * 1.7, 0.3, -a, 0), WU_HOLZ));
  }
  starr(parts, 0, 0);
  // Vier Bahnen mit Durchhang: das ist der Unterschied zwischen Stoff und
  // Blech. Der Bauch faellt nach aussen, die Bahn haengt am First.
  for (i = -1; i <= 1; i += 2) {
    zeltbahn(parts, [
      new THREE.Vector3(-1.5, 3.0, 0), new THREE.Vector3(1.5, 3.0, 0),
      new THREE.Vector3(1.9, 0.15, i * 1.9), new THREE.Vector3(-1.9, 0.15, i * 1.9)
    ], i * 0.35, i > 0 ? WU_STOFF : WU_STOFFD);
  }
  zeltbahn(parts, [
    new THREE.Vector3(-1.5, 3.0, 0), new THREE.Vector3(-1.5, 3.0, 0),
    new THREE.Vector3(-2.2, 0.15, 1.5), new THREE.Vector3(-2.2, 0.15, -1.5)
  ], 0.3, WU_STOFFD);
  return mergeGeos(parts);
}

function geoKleinzelt() {
  var parts = [
    part(new CO(1.0, 1.9, 8), M(0, 0.95, 0), WU_STOFF),
    part(new CO(1.05, 0.35, 8), M(0, 0.17, 0), WU_STOFFD),
    part(new BX(0.5, 0.9, 0.1), M(0, 0.45, 0.72, 0.1, 0, 0), WU_STOFFD),
    part(new CY(0.03, 0.04, 0.5, 4), M(0, 2.05, 0), WU_HOLZ)
  ];
  return mergeGeos(parts);
}

function geoZisterne() {
  var parts = [
    part(new CY(1.15, 1.15, 2.2, 10, 1, true), M(0, -0.9, 0), WU_STEIND),
    part(new CY(1.3, 1.35, 0.4, 10), M(0, 0.2, 0), WU_STEIN),
    part(new CY(1.0, 1.0, 0.06, 10), M(0, -1.6, 0), WU_WASSER)
  ];
  treppe(parts, 8, 0.9, -0.22, 0, 0.1, -1.05, WU_STEIND);
  for (var i = 0; i < 4; i++) {      // Kuppel auf vier Saeulen
    var a = i / 4 * 6.28 + 0.78;
    parts.push(part(new CY(0.13, 0.16, 2.0, 7),
      M(Math.cos(a) * 1.15, 1.4, Math.sin(a) * 1.15), WU_STEIN));
  }
  parts.push(part(new THREE.SphereGeometry(1.3, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
    M(0, 2.4, 0, 0, 0, 0, 1, 0.8, 1), WU_LEHMH));
  parts.push(part(new CO(0.16, 0.3, 6), M(0, 3.5, 0), WU_GOLD));
  return mergeGeos(parts);
}

function geoWindfaenger() {
  var parts = [
    part(new BX(1.1, 3.4, 1.1), M(0, 1.7, 0), WU_LEHM),
    part(new BX(1.35, 0.22, 1.35), M(0, 3.5, 0), WU_LEHMH),
    part(new BX(1.2, 0.14, 1.2), M(0, 3.7, 0), WU_LEHMD)
  ];
  for (var i = 0; i < 4; i++) {      // Schlitze auf allen vier Seiten
    var a = i / 4 * 6.28;
    parts.push(part(new BX(0.7, 1.1, 0.14),
      M(Math.cos(a) * 0.56, 2.7, Math.sin(a) * 0.56, 0, -a, 0), 0x2e3038));
  }
  return mergeGeos(parts);
}

function geoLehmspeicher() {
  var parts = [
    part(new CO(1.2, 3.0, 9), M(0, 1.5, 0, 0, 0, 0, 1, 1, 1), WU_LEHM),
    part(new CY(0.28, 0.34, 0.4, 7), M(0, 3.0, 0), WU_LEHMD),
    part(new BX(0.4, 0.5, 0.16), M(0, 0.35, 1.0), 0x2e3038)
  ];
  for (var i = 0; i < 4; i++) {      // Ringrillen aus der Bauweise
    var y = 0.5 + i * 0.55, r = 1.2 * (1 - y / 3.0) + 0.06;
    parts.push(part(new CY(r, r, 0.1, 9), M(0, y, 0), WU_LEHMH));
  }
  return mergeGeos(parts);
}

function geoPalme() {
  var pts = [], i;
  for (i = 0; i <= 6; i++) {
    var t = i / 6;
    // Gebogener Stamm: der Schwung ist die halbe Palme.
    pts.push(new THREE.Vector3(Math.pow(t, 1.9) * 1.3, t * 5.4, Math.pow(t, 2.2) * 0.4));
  }
  var parts = [tubeGeo(pts, function (t) { return 0.24 - t * 0.11; }, 6,
    function (t, k, c) {
      var b = (k % 2) * 0.06;
      c.setRGB(0.62 + b, 0.53 + b, 0.38 + b);
    })];
  starr(parts, 0, 0.008);
  for (i = 0; i < 7; i++) {          // Fiederwedel, kraeftig nach aussen gekippt
    var a = i / 7 * 6.28 + 0.4;
    parts.push(kronenQuad(3.4, 1.5, 1.3 + Math.cos(a) * 0.35, 5.2, 0.4 + Math.sin(a) * 0.35,
      a, -0.5 - hashi(i, 3, 821) * 0.5, i % 2 ? WU_PALME : 0x6d8a44));
  }
  return mergeGeos(parts);
}

function geoOasenbecken() {
  var parts = [
    part(new CY(1.7, 1.75, 0.7, 12), M(0, 0.3, 0), WU_STEIN),
    part(new CY(1.5, 1.5, 0.55, 12), M(0, 0.35, 0), WU_WASSER),
    part(new CY(1.9, 1.95, 0.22, 12), M(0, 0.11, 0), WU_STEIND)
  ];
  for (var i = 0; i < 4; i++) {
    var a = i / 4 * 6.28 + 0.4;
    parts.push(part(new BX(0.7, 0.28, 0.3),
      M(Math.cos(a) * 1.8, 0.76, Math.sin(a) * 1.8, 0, -a, 0), WU_LEHMH));
  }
  return mergeGeos(parts);
}

function geoTraenke() {
  return mergeGeos([
    part(new BX(1.5, 0.42, 0.62), M(0, 0.21, 0), WU_STEIN),
    part(new BX(1.3, 0.26, 0.44), M(0, 0.3, 0), WU_WASSER),
    part(new CY(0.07, 0.07, 0.7, 5), M(-0.72, 0.65, 0, 0, 0, 0.35), WU_STEIND),
    part(new CY(0.32, 0.34, 0.05, 9), M(0.9, 0.02, 0.3), 0x8a7c5e)   // Pfuetze
  ]);
}

function geoSandwehe() {
  var parts = [
    part(brockenGeo(2.4, 823, 0.3), M(0, -0.2, 0, 0, 0.4, 0, 1.15, 0.32, 0.85), WU_SAND),
    part(brockenGeo(1.4, 827, 0.35), M(0.9, -0.1, 0.6, 0, 1.1, 0, 1.1, 0.28, 0.9), WU_LEHMH)
  ];
  for (var i = 0; i < 6; i++) {      // Halmbueschel als schlanke Kegel: kein
    var d = hashi(i, 3, 829), a = i / 6 * 6.28;   // alphaTest noetig, und aus
    var q = 0.6 + d * 1.2;                        // der Distanz identisch.
    parts.push(part(new CO(0.07, 0.55 + d * 0.4, 4),
      M(Math.cos(a) * q, 0.45 + d * 0.15, Math.sin(a) * q,
        Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25), 0x9a9464));
  }
  return mergeGeos(parts);
}

function geoObelisk() {
  var parts = [];
  sockel(parts, 0.9, 0.9, WU_STEIND);
  parts.push(part(new BX(0.62, 4.6, 0.62), M(0, 2.8, 0, 0, 0, 0, 1, 1, 1), WU_STEIN));
  // Verjuengung: ein zweiter, schmalerer Block oben statt echter Konik — die
  // Silhouette liest identisch, kostet aber kein Sonderprimitiv.
  parts.push(part(new BX(0.44, 1.6, 0.44), M(0, 5.6, 0), WU_STEIN));
  parts.push(part(new CO(0.32, 0.6, 4), M(0, 6.6, 0, 0, Math.PI / 4, 0), WU_GOLD));
  return mergeGeos(parts);
}

function geoGebein() {
  var parts = [
    part(new CY(0.11, 0.13, 2.6, 6), M(0, 0.25, 0, 0, 0.15, Math.PI / 2), WU_KNOCHEN)
  ];
  for (var i = 0; i < 6; i++) {      // Rippenbogen ueber der Wirbelsaeule
    var x = -1.0 + i * 0.42, d = hashi(i, 3, 839);
    var h = 0.9 + Math.sin(i / 5 * Math.PI) * 0.7;
    parts.push(part(new THREE.TorusGeometry(h * 0.5, 0.055, 3, 6, Math.PI * 0.9),
      M(x, 0.25, 0, 0, Math.PI / 2, (d - 0.5) * 0.2), WU_KNOCHEN));
  }
  parts.push(part(new IC(0.36, 0), M(1.65, 0.25, 0.1, 0.3, 0.7, 0, 1.4, 0.85, 0.9), WU_KNOCHEN));
  parts.push(part(new BX(0.3, 0.14, 0.14), M(2.0, 0.2, 0.1, 0, 0.7, 0), 0xd0c8b0));
  return mergeGeos(parts);
}

/* --- Pools Arbor, Moor, Eis, Wueste --------------------------------------- */
definePool("rankenstamm", geoRankenstamm(), { radius: 3.5, ao: 0.18, familie: 'rinde',
  emissive: 0x2e4a3e, emissiveIntensity: 0.5 });
definePool("rankenknoten", geoRankenknoten(), { radius: 3.0, ao: 0.18, familie: 'rinde',
  emissive: 0x2e4a3e, emissiveIntensity: 0.5 });
definePool("blattsteg", geoBlattsteg(), { radius: 3.0, dbl: true, ao: 0.16, familie: 'laub' });
definePool("rankentreppe", geoRankentreppe(), { radius: 2.2, ao: 0.24, familie: 'holz' });
definePool("rankenleiter", geoRankenleiter(), { radius: 0.8, ao: 0.2, familie: 'holz' });
definePool("saftzapfer", geoSaftzapfer(), { radius: 1.0, familie: 'holz',
  emissive: 0x2a4438, emissiveIntensity: 0.4 });
definePool("lichtbluete", geoLichtbluete(), { radius: 0.5, dbl: true, ao: 0,
  map: TEX.bluete, alphaTest: 0.4, familie: 'laub', wind: { amp: 0.6 },
  emissive: 0x4e8a72, emissiveIntensity: 0.9, drift: DRIFT_LEICHT });
definePool("sporenlaterne", geoSporenlaterne(), { radius: 0.3, ao: 0, familie: 'laub',
  emissive: 0x5ea88a, emissiveIntensity: 1.0, drift: DRIFT_LEICHT });
definePool("wurzelbogen", geoWurzelbogen(), { radius: 2.6, ao: 0.24, familie: 'rinde',
  emissive: 0x2e4a3e, emissiveIntensity: 0.4 });
definePool("wurzelanker", geoWurzelanker(), { radius: 2.8, ao: 0.24, familie: 'rinde',
  emissive: 0x2e4a3e, emissiveIntensity: 0.4 });
definePool("samenkapsel", geoSamenkapsel(), { radius: 2.2, ao: 0.22, familie: 'rinde',
  emissive: 0x3a5a4a, emissiveIntensity: 0.45 });
definePool("rankenkai", geoRankenkai(), { radius: 3.4, dbl: true, ao: 0.18, familie: 'laub' });
definePool("huetersaeule", geoHuetersaeule(), { radius: 0.8, familie: 'stein',
  emissive: 0x3a5a4a, emissiveIntensity: 0.5 });

definePool("torfstich", geoTorfstich(), { radius: 2.2, ao: 0.22, familie: 'erde' });
definePool("torfstapel", geoTorfstapel(), { radius: 0.9, familie: 'erde' });
definePool("moorsteg", geoMoorsteg(), { radius: 2.6, familie: 'holz' });
definePool("moorhuette", geoMoorhuette(), { radius: 1.8, familie: 'reet' });
definePool("aalreuse", geoAalreuse(), { radius: 0.6, familie: 'holz' });
definePool("irrlicht", geoIrrlicht(), { radius: 0.3, ao: 0, familie: 'laub',
  emissive: 0x4e9c78, emissiveIntensity: 1.0 });
definePool("schilf", geoSchilf(), { radius: 0.5, dbl: true, ao: 0.18,
  map: TEX.grassTuft, alphaTest: 0.42, familie: 'laub', wind: { amp: 0.55 } });
definePool("seerose", geoSeerose(), { radius: 0.7, ao: 0.1, familie: 'laub' });
definePool("wurzelstelze", geoWurzelstelze(), { radius: 2.8, dbl: true, ao: 0.26,
  map: TEX.kroneZerzaust, alphaTest: 0.4, familie: 'rinde', wind: WINDLAUB });
definePool("pfahlgoetze", geoPfahlgoetze(), { radius: 0.5, familie: 'holz' });
definePool("moorkahn", geoMoorkahn(), { radius: 1.6, familie: 'holz' });
definePool("wollgras", geoWollgras(), { radius: 0.4, dbl: true, ao: 0.16,
  map: TEX.grassTuft, alphaTest: 0.42, familie: 'laub', wind: { amp: 0.5 } });

definePool("iglu", geoIglu(), { radius: 1.8, familie: 'putz' });
definePool("eisfischerhuette", geoEisfischerhuette(), { radius: 1.6, familie: 'holz' });
definePool("schlitten", geoSchlitten(), { radius: 1.2, familie: 'holz' });
definePool("eisfels", geoEisfels(), { radius: 1.6, familie: 'stein' });
definePool("eisscholle", geoEisscholle(), { radius: 2.4, ao: 0.14, familie: 'stein' });
definePool("gletschertor", geoGletschertor(), { radius: 3.0, dbl: true, ao: 0.28, familie: 'stein' });
definePool("pelzzelt", geoPelzzelt(), { radius: 1.6, familie: 'stoff' });
definePool("schneewall", geoSchneewall(), { radius: 2.0, ao: 0.2, familie: 'putz' });
definePool("thermalquelle", geoThermalquelle(), { radius: 2.0, dbl: true, ao: 0.18,
  map: TEX.kroneZerzaust, alphaTest: 0.4, familie: 'stein', wind: { amp: 0.28 } });
definePool("geweihgestell", geoGeweihgestell(), { radius: 1.2, familie: 'holz' });

definePool("wuestenzelt", geoWuestenzelt(), { radius: 2.2, dbl: true, ao: 0.2,
  familie: 'stoff', wind: { amp: 0.16 } });
definePool("kleinzelt", geoKleinzelt(), { radius: 1.0, familie: 'stoff' });
definePool("zisterne", geoZisterne(), { radius: 2.4, ao: 0.26, familie: 'stein' });
definePool("windfaenger", geoWindfaenger(), { radius: 1.2, familie: 'putz' });
definePool("lehmspeicher", geoLehmspeicher(), { radius: 1.4, familie: 'putz' });
definePool("palme", geoPalme(), { radius: 1.6, dbl: true, ao: 0.22,
  map: TEX.kroneZerzaust, alphaTest: 0.4, familie: 'laub', wind: { amp: 0.36 } });
definePool("oasenbecken", geoOasenbecken(), { radius: 2.2, ao: 0.2, familie: 'stein' });
definePool("traenke", geoTraenke(), { radius: 0.8, familie: 'stein' });
definePool("sandwehe", geoSandwehe(), { radius: 2.6, ao: 0.16, familie: 'erde' });
definePool("obelisk", geoObelisk(), { radius: 0.7, familie: 'stein' });
definePool("gebein", geoGebein(), { radius: 1.8, ao: 0.16, familie: 'stein' });

/* ==========================================================================
   Kategorie 3 — Landwirtschaft. Der bewirtschaftete Guertel um jedes Dorf:
   Acker, Weide, Vorrat. Alles teilt die Holz-/Stroh-Palette des Bestands
   (geoScheune, geoHeuhaufen), damit Hof und Dorf als EIN Ort lesen.
   ========================================================================== */
var LW_HOLZ = 0x9c8468,
    LW_HOLZD = 0x7a6450,
    LW_ERDE = 0x7d6a50,
    LW_ERDEH = 0x8f7a5c,
    LW_STROH = 0xc9b374,
    LW_STROHD = 0xa8945c,
    LW_LAUB = 0x7ba055,
    LW_STEIN = 0xb0aa9c,
    LW_PUTZ = 0xefe7d6,
    LW_DACH = 0x8a7a5a,
    LW_STOFF = 0xc4b89c,
    LW_GRUEN = 0x6f8f4a;

function geoAckerscholle() {
  var parts = [], i;
  for (i = 0; i < 5; i++) {
    var d = hashi(i, 3, 901);
    parts.push(part(new BX(0.5, 0.26 + d * 0.12, 3.4),
      M(-1.0 + i * 0.5, 0.13 + d * 0.06, 0, 0, (d - 0.5) * 0.05, 0),
      i % 2 ? LW_ERDE : LW_ERDEH));
    parts.push(part(new BX(0.2, 0.1, 3.4),
      M(-1.0 + i * 0.5 + 0.25, 0.05, 0), 0x6a5a44));           // Furche dazwischen
  }
  return mergeGeos(parts);
}

function geoRebenreihe() {
  var parts = [
    part(new CY(0.05, 0.07, 1.5, 5), M(-0.85, 0.75, 0), LW_HOLZD),
    part(new CY(0.05, 0.07, 1.5, 5), M(0.85, 0.75, 0), LW_HOLZD),
    part(new BX(1.8, 0.04, 0.04), M(0, 1.25, 0), 0x6a6258),
    part(new BX(1.8, 0.04, 0.04), M(0, 0.85, 0), 0x6a6258)
  ];
  for (var i = 0; i < 5; i++) {
    var d = hashi(i, 3, 907);
    parts.push(part(new IC(0.3 + d * 0.12, 0),
      M(-0.8 + i * 0.4, 0.95 + d * 0.14, (d - 0.5) * 0.16, 0, d * 3, 0, 1, 0.85, 1),
      i % 2 ? LW_LAUB : LW_GRUEN));
  }
  return mergeGeos(parts);
}

function geoHopfengeruest() {
  var parts = [], i, s;
  for (i = 0; i < 4; i++) {
    var x = i % 2 ? 1.1 : -1.1, z = i < 2 ? -0.6 : 0.6;
    parts.push(part(new CY(0.06, 0.09, 3.6, 5), M(x, 1.8, z), LW_HOLZD));
  }
  parts.push(part(new BX(2.4, 0.08, 0.08), M(0, 3.55, -0.6), LW_HOLZD));
  parts.push(part(new BX(2.4, 0.08, 0.08), M(0, 3.55, 0.6), LW_HOLZD));
  starr(parts, 0, 0);
  // Die Rankenbahnen als gespannte, durchhaengende Flaechen: der Bauch macht
  // aus einem Draht eine bewachsene Bahn.
  for (s = 0; s < 3; s++) {
    var u = -0.8 + s * 0.8;
    zeltbahn(parts, [
      new THREE.Vector3(u - 0.3, 3.5, -0.6), new THREE.Vector3(u + 0.3, 3.5, -0.6),
      new THREE.Vector3(u + 0.3, 0.2, -0.45), new THREE.Vector3(u - 0.3, 0.2, -0.45)
    ], 0.2, s % 2 ? LW_LAUB : LW_GRUEN);
    zeltbahn(parts, [
      new THREE.Vector3(u - 0.3, 3.5, 0.6), new THREE.Vector3(u + 0.3, 3.5, 0.6),
      new THREE.Vector3(u + 0.3, 0.2, 0.45), new THREE.Vector3(u - 0.3, 0.2, 0.45)
    ], -0.2, s % 2 ? LW_GRUEN : LW_LAUB);
  }
  return mergeGeos(parts);
}

var BAUM_OBST = { stammOben: 0.14, stammUnten: 0.3, stammH: 1.3, rinde: 0x74604a,
  karten: 4, kroneW: 3.2, kroneH: 2.0, kroneY: 1.1, lehne: 0.1, laub: 0x82a856, seed: 67 };

function geoObstbaum() {
  var parts = [geoBaumArt(BAUM_OBST)], i;
  for (i = 0; i < 8; i++) {
    var a = i / 8 * 6.28 + hashi(i, 3, 911), d = hashi(i, 5, 911);
    var f = part(new IC(0.11, 0),
      M(Math.cos(a) * (0.7 + d * 0.6), 1.5 + d * 1.0, Math.sin(a) * (0.7 + d * 0.6)),
      d < 0.5 ? 0xd8734c : 0xe0a03c);
    // Fruechte auf den opaken Texturstreifen klemmen — sonst schlaegt die
    // alphaTest-Kronenkarte Loecher in sie (Muster geoBaumArt).
    uvKonst(f, 0.5, 0.008);
    parts.push(f);
  }
  return mergeGeos(parts);
}

function geoGarbe() {
  return mergeGeos([
    part(new CO(0.34, 1.3, 8), M(0, 0.65, 0, 0.06, 0, 0.05), LW_STROH),
    part(new CY(0.3, 0.3, 0.08, 8), M(0, 0.85, 0), LW_STROHD),
    part(new CY(0.24, 0.24, 0.07, 8), M(0, 0.45, 0), LW_STROHD)
  ]);
}

function geoHeuschober() {
  var parts = [], i;
  for (i = 0; i < 4; i++) {
    var x = i % 2 ? 1.1 : -1.1, z = i < 2 ? -1.0 : 1.0;
    parts.push(part(new CY(0.09, 0.12, 3.0, 5), M(x, 1.5, z), LW_HOLZD));
  }
  parts.push(part(new CO(1.3, 1.9, 9), M(0, 0.95, 0), LW_STROH));
  parts.push(part(prismGeo(2.9, 0.7, 2.6), M(0, 2.85, 0, 0, Math.PI / 2, 0), LW_DACH));
  parts.push(part(new BX(2.9, 0.09, 2.6), M(0, 2.8, 0), 0x4a4038));
  return mergeGeos(parts);
}

function geoTaubenschlag() {
  var parts = [
    part(new CY(0.55, 0.65, 3.2, 8), M(0, 1.6, 0), LW_PUTZ),
    part(new CY(0.75, 0.75, 0.14, 8), M(0, 3.25, 0), LW_HOLZD),
    part(new CO(0.85, 0.7, 8), M(0, 3.65, 0), LW_DACH),
    part(new BX(0.9, 0.06, 0.4), M(0, 2.6, 0.5), LW_HOLZ)         // Anflugbrett
  ];
  for (var i = 0; i < 8; i++) {   // Flugloecher in zwei Reihen
    var a = (i % 4) / 4 * 6.28 + Math.floor(i / 4) * 0.78;
    parts.push(part(new BX(0.16, 0.2, 0.14),
      M(Math.cos(a) * 0.56, 2.35 + Math.floor(i / 4) * 0.45, Math.sin(a) * 0.56, 0, -a, 0),
      0x2e3038));
  }
  return mergeGeos(parts);
}

function geoBienenstand() {
  var parts = [
    part(new BX(2.2, 0.5, 0.7), M(0, 0.25, 0), LW_HOLZD),
    part(new BX(2.5, 0.12, 1.0), M(0, 1.35, -0.15, -0.22, 0, 0), LW_DACH),
    part(new CY(0.08, 0.08, 1.2, 4), M(-1.1, 0.9, -0.3), LW_HOLZD),
    part(new CY(0.08, 0.08, 1.2, 4), M(1.1, 0.9, -0.3), LW_HOLZD)
  ];
  for (var i = 0; i < 4; i++) {
    var d = hashi(i, 3, 919);
    parts.push(part(new CY(0.2, 0.26, 0.55, 8),
      M(-0.78 + i * 0.52, 0.78, (d - 0.5) * 0.1), LW_STROH));
    parts.push(part(new CO(0.27, 0.24, 8), M(-0.78 + i * 0.52, 1.15, (d - 0.5) * 0.1), LW_STROHD));
  }
  return mergeGeos(parts);
}

function geoPferch() {
  var parts = [], i;
  for (i = 0; i < 10; i++) {
    var a = i / 10 * 6.28;
    if (i === 0) continue;          // Luecke fuer das Gatter
    var x = Math.cos(a) * 2.3, z = Math.sin(a) * 2.3;
    parts.push(part(new BX(0.14, 1.1, 0.14), M(x, 0.55, z, 0, -a, 0), LW_HOLZD));
    var b = (i - 0.5) / 10 * 6.28, l = 2 * 2.3 * Math.sin(Math.PI / 10);
    parts.push(part(new BX(l, 0.09, 0.07),
      M(Math.cos(b) * 2.3, 0.85, Math.sin(b) * 2.3, 0, -b + Math.PI / 2, 0), LW_HOLZ));
    parts.push(part(new BX(l, 0.09, 0.07),
      M(Math.cos(b) * 2.3, 0.5, Math.sin(b) * 2.3, 0, -b + Math.PI / 2, 0), LW_HOLZ));
  }
  parts.push(part(new BX(1.3, 0.9, 0.09), M(2.3, 0.5, 0, 0, Math.PI / 2, 0.12), LW_HOLZ));
  return mergeGeos(parts);
}

function geoViehstall() {
  var parts = [];
  sockel(parts, 4.2, 2.6, 0x8a8278);
  parts.push(part(new BX(4.2, 1.8, 2.6), M(0, 1.3, 0), 0xd8cbb0));
  dach(parts, 4.2, 2.6, 1.2, 2.2, LW_DACH, true);
  tuer(parts, -0.9, 0.5, 1.35, 1.3, 1.4);
  fenster(parts, 1.2, 1.5, 1.34, 0.5, 0.4, "z");
  for (var i = 0; i < 5; i++) {   // Freilaufzaun
    parts.push(part(new BX(0.11, 0.9, 0.11), M(-2.3 + i * 1.15, 0.45, 2.6), LW_HOLZD));
  }
  parts.push(part(new BX(4.7, 0.08, 0.07), M(-0.05, 0.75, 2.6), LW_HOLZ));
  parts.push(part(new BX(4.7, 0.08, 0.07), M(-0.05, 0.4, 2.6), LW_HOLZ));
  return mergeGeos(parts);
}

function geoKornspeicher() {
  var parts = [], i;
  for (i = 0; i < 4; i++) {
    var x = i % 2 ? 0.85 : -0.85, z = i < 2 ? -0.7 : 0.7;
    parts.push(part(new CY(0.13, 0.16, 1.2, 6), M(x, 0.6, z), LW_HOLZD));
    // Maeusescheiben: die flache Platte auf dem Stelzenkopf ist das Merkmal,
    // an dem ein Speicher als Speicher zu erkennen ist.
    parts.push(part(new CY(0.4, 0.4, 0.09, 8), M(x, 1.25, z), LW_STEIN));
  }
  parts.push(part(new BX(2.4, 1.7, 2.0), M(0, 2.15, 0), 0xc6b18c));
  parts.push(part(new BX(2.5, 0.12, 2.1), M(0, 1.32, 0), LW_HOLZD));
  dach(parts, 2.4, 2.0, 1.0, 3.0, LW_DACH, false);
  tuer(parts, 0, 1.35, 1.02, 0.6, 1.1);
  for (i = 0; i < 5; i++) {       // Leiter
    parts.push(part(new BX(0.5, 0.05, 0.07), M(0, 0.3 + i * 0.22, 1.3 + i * 0.05), LW_HOLZ));
  }
  return mergeGeos(parts);
}

function geoDreschtenne() {
  var parts = [
    part(new CY(2.2, 2.3, 0.2, 14), M(0, 0.1, 0), LW_ERDEH),
    part(new CY(2.05, 2.05, 0.08, 14), M(0, 0.2, 0), 0x8a7a5e),
    part(new CY(0.42, 0.42, 1.1, 9), M(0.4, 0.44, 0.2, 0, 0.4, Math.PI / 2), LW_STEIN),
    part(new BX(1.2, 0.08, 0.08), M(1.2, 0.5, 0.2, 0, 0.4, 0), LW_HOLZD)
  ];
  for (var i = 0; i < 2; i++) {   // Gabeln an der Kante
    parts.push(part(new CY(0.04, 0.05, 1.8, 4),
      M(-1.5 - i * 0.3, 0.85, -0.8 + i * 0.4, 0.25, 0, 0.2 + i * 0.15), LW_HOLZ));
  }
  return mergeGeos(parts);
}

function geoTerrassenfeld() {
  var parts = [], i;
  for (i = 0; i < 3; i++) {
    parts.push(part(new BX(5.0, 0.9, 0.45), M(0, 0.45 + i * 0.8, 1.4 - i * 1.4), LW_STEIN));
    parts.push(part(new BX(5.0, 0.16, 0.5), M(0, 0.94 + i * 0.8, 1.4 - i * 1.4), 0xc2bcae));
    parts.push(part(new BX(4.8, 0.5, 1.0),
      M(0, 0.65 + i * 0.8, 0.9 - i * 1.4), i % 2 ? LW_ERDE : LW_ERDEH));
    parts.push(part(new BX(4.6, 0.14, 0.85),
      M(0, 0.94 + i * 0.8, 0.9 - i * 1.4), LW_GRUEN));
  }
  treppe(parts, 6, 0.8, 0.4, 2.0, 0, -1.6, LW_STEIN);
  return mergeGeos(parts);
}

function geoVogelscheuche() {
  var parts = [
    part(new BX(0.09, 2.2, 0.09), M(0, 1.1, 0), LW_HOLZD),
    part(new BX(1.5, 0.08, 0.08), M(0, 1.65, 0), LW_HOLZD),
    part(new IC(0.2, 0), M(0, 2.0, 0, 0, 0.5, 0, 1, 1.1, 1), LW_STROH),
    part(new CO(0.42, 0.28, 8), M(0, 2.2, 0, 0.15, 0, 0.1), LW_STROHD)
  ];
  starr(parts, 0, 0);
  zeltbahn(parts, [
    new THREE.Vector3(-0.66, 1.62, 0), new THREE.Vector3(0.66, 1.62, 0),
    new THREE.Vector3(0.44, 0.55, 0.1), new THREE.Vector3(-0.44, 0.55, 0.1)
  ], 0.2, LW_STOFF);
  return mergeGeos(parts);
}

function geoWassermuehle() {
  var parts = [];
  sockel(parts, 3.0, 2.6, 0x8a8278);
  parts.push(part(new BX(3.0, 2.4, 2.6), M(0, 1.7, 0), LW_PUTZ));
  parts.push(part(new BX(0.1, 2.4, 0.1), M(-1.46, 1.7, 1.28), LW_HOLZD));
  parts.push(part(new BX(0.1, 2.4, 0.1), M(1.46, 1.7, 1.28), LW_HOLZD));
  parts.push(part(new BX(2.9, 0.1, 0.1), M(0, 2.85, 1.29), LW_HOLZD));
  dach(parts, 3.0, 2.6, 1.5, 2.95, LW_DACH, false);
  fenster(parts, -0.8, 2.0, 1.32, 0.5, 0.6, "z");
  tuer(parts, 0.7, 0.5, 1.32, 0.7, 1.3);
  // Unterschlaechtiges Rad an der Giebelseite: Felge, Achse, zwoelf Schaufeln.
  parts.push(part(new CY(1.25, 1.25, 0.12, 14), M(1.85, 1.0, 0, 0, 0, Math.PI / 2), LW_HOLZD));
  parts.push(part(new CY(1.25, 1.25, 0.12, 14), M(2.55, 1.0, 0, 0, 0, Math.PI / 2), LW_HOLZD));
  parts.push(part(new CY(0.12, 0.12, 1.2, 6), M(2.2, 1.0, 0, 0, 0, Math.PI / 2), LW_HOLZ));
  for (var i = 0; i < 12; i++) {
    var a = i / 12 * 6.28;
    parts.push(part(new BX(0.62, 0.34, 0.07),
      M(2.2, 1.0 + Math.sin(a) * 1.1, Math.cos(a) * 1.1, a, Math.PI / 2, 0), LW_HOLZ));
  }
  parts.push(part(new BX(0.7, 0.22, 2.2), M(2.2, 1.9, -1.5), LW_HOLZD));   // Gerinne
  return mergeGeos(parts);
}

/* ==========================================================================
   Kategorie 4 — Handwerk / Industrie. Der laute Rand der Siedlung. Die vier
   Feuerstellen (Schmiede, Ziegelofen, Kalkofen, Glashuette) bekommen einen
   Eintrag in LICHT_ANKER: eine Esse, die nicht glueht, ist ein Schuppen.
   ========================================================================== */
var HW_STEIN = 0xa8a094,
    HW_STEIND = 0x847e6e,
    HW_ZIEGEL = 0xa8624c,
    HW_ZIEGELD = 0x8a4e3c,
    HW_ERDE = 0x6a5844,
    HW_HOLZ = 0x9a7f5e,
    HW_HOLZD = 0x6f5a44,
    HW_GLUT = 0xffa04c,
    HW_METALL = 0x4c4841,
    HW_PUTZ = 0xe6dcc6,
    HW_DACH = 0x6f5a48,
    HW_TUCH1 = 0xb0574e,
    HW_TUCH2 = 0x3d78a8,
    HW_TUCH3 = 0xd8b25e;

function geoSchmiede() {
  var parts = [
    part(new BX(2.6, 1.9, 2.2), M(0, 0.95, -0.4), HW_STEIN),
    part(new BX(2.7, 0.16, 2.3), M(0, 1.95, -0.4), HW_STEIND)
  ];
  parts.push(part(prismGeo(3.4, 1.1, 3.2), M(0, 2.05, -0.1, 0, Math.PI / 2, 0), HW_DACH));
  parts.push(part(new BX(3.4, 0.1, 3.2), M(0, 2.0, -0.1), 0x4a4038));
  parts.push(part(new CY(0.09, 0.11, 2.0, 5), M(-1.5, 1.0, 1.35), HW_HOLZD));  // offene Front
  parts.push(part(new CY(0.09, 0.11, 2.0, 5), M(1.5, 1.0, 1.35), HW_HOLZD));
  parts.push(part(new CY(0.34, 0.44, 3.4, 7), M(0.9, 2.4, -1.0), HW_ZIEGEL));  // Esse
  parts.push(part(new CY(0.4, 0.4, 0.16, 7), M(0.9, 4.05, -1.0), HW_ZIEGELD));
  parts.push(part(new BX(0.8, 0.6, 0.3), M(0.9, 0.55, 0.3), HW_GLUT));         // Feuerstelle
  parts.push(part(new BX(0.55, 0.3, 0.55), M(-0.7, 0.4, 0.5), HW_HOLZD));      // Ambossklotz
  parts.push(part(new IC(0.26, 0), M(-0.7, 0.68, 0.5, 0, 0.5, 0, 1.6, 0.6, 0.7), HW_METALL));
  return mergeGeos(parts);
}

function geoKoehlermeiler() {
  var parts = [
    part(new CO(1.7, 2.0, 10), M(0, 1.0, 0), HW_ERDE),
    part(new CO(1.75, 0.35, 10), M(0, 0.17, 0), 0x584a3a),
    part(new CY(0.2, 0.26, 0.5, 7), M(0, 2.1, 0), 0x3a332c)     // Rauchloch
  ];
  for (var i = 0; i < 6; i++) {   // Holzstapel daneben
    var lage = Math.floor(i / 3);
    parts.push(part(new CY(0.16, 0.16, 1.4, 5),
      M(2.2 + (i % 3) * 0.34, 0.16 + lage * 0.33, 0, Math.PI / 2, 0.1, 0), HW_HOLZ));
  }
  return mergeGeos(parts);
}

function geoZiegelofen() {
  var parts = [
    part(new CY(0.8, 1.5, 3.0, 10), M(0, 1.5, 0), HW_ZIEGEL),
    part(new CY(1.55, 1.55, 0.2, 10), M(0, 0.1, 0), HW_ZIEGELD),
    part(new CO(0.95, 1.0, 10), M(0, 3.4, 0), HW_ZIEGELD),
    part(new CY(0.24, 0.24, 0.3, 7), M(0, 3.95, 0), 0x2e2a24),
    part(new BX(0.85, 0.95, 0.4), M(0, 0.5, 1.25), HW_GLUT)     // Ofenmaul
  ];
  for (var i = 0; i < 6; i++) {   // Ziegelstapel
    var lage = Math.floor(i / 3);
    parts.push(part(new BX(0.7, 0.3, 0.9),
      M(2.3, 0.15 + lage * 0.33, -0.9 + (i % 3) * 0.95, 0, (hashi(i, 3, 941) - 0.5) * 0.2, 0),
      lage % 2 ? HW_ZIEGEL : HW_ZIEGELD));
  }
  return mergeGeos(parts);
}

function geoKalkofen() {
  var parts = [
    part(new CY(1.2, 1.55, 2.6, 9), M(0, 1.3, 0), HW_STEIN),
    part(new CY(1.3, 1.3, 0.22, 9), M(0, 2.6, 0), HW_STEIND),
    part(new CY(0.95, 0.95, 0.3, 9), M(0, 2.5, 0), 0x2e2a24),   // Trichtermund
    part(new BX(0.7, 0.85, 0.5), M(0, 0.42, 1.35), 0x2a2620),   // Feuerloch
    part(new BX(1.6, 0.3, 3.4), M(0, 2.1, -2.4, 0.22, 0, 0), HW_HOLZD)  // Rampe vom Hang
  ];
  for (var i = 0; i < 5; i++) {
    var d = hashi(i, 3, 947), a = i / 5 * 6.28;
    parts.push(part(brockenGeo(0.24 + d * 0.16, 947 + i * 3, 0.5),
      M(Math.cos(a) * (1.9 + d * 0.6), 0.16, Math.sin(a) * (1.9 + d * 0.6) + 1.0,
        d, a, 0, 1, 0.7, 1), 0xd0cabc));
  }
  return mergeGeos(parts);
}

function geoGerbergruben() {
  var parts = [], i;
  for (i = 0; i < 4; i++) {
    var x = i % 2 ? 0.95 : -0.95, z = i < 2 ? -0.95 : 0.95;
    parts.push(part(new CY(0.72, 0.72, 0.7, 9), M(x, 0.05, z), HW_STEIND));
    parts.push(part(new CY(0.6, 0.6, 0.08, 9),
      M(x, 0.3, z), i % 2 ? 0x5a4a30 : 0x6a5a3a));
  }
  for (i = -1; i <= 1; i += 2) {   // Haeuterahmen
    parts.push(part(new BX(0.09, 2.0, 0.09), M(i * 2.0, 1.0, -0.7), HW_HOLZD));
    parts.push(part(new BX(0.09, 2.0, 0.09), M(i * 2.0, 1.0, 0.7), HW_HOLZD));
    parts.push(part(new BX(0.09, 0.09, 1.5), M(i * 2.0, 1.95, 0), HW_HOLZD));
    parts.push(part(new BX(0.07, 1.3, 1.25), M(i * 2.0, 1.25, 0), 0xc0a684));
  }
  return mergeGeos(parts);
}

function geoFaerbergestell() {
  var parts = [], i;
  for (i = -1; i <= 1; i += 2) {
    parts.push(part(new BX(0.13, 3.0, 0.13), M(i * 1.7, 1.5, 0), HW_HOLZD));
  }
  parts.push(part(new BX(3.6, 0.12, 0.12), M(0, 2.95, 0), HW_HOLZD));
  parts.push(part(new BX(3.6, 0.12, 0.12), M(0, 2.2, 0), HW_HOLZD));
  starr(parts, 0, 0);
  var toene = [HW_TUCH1, HW_TUCH2, HW_TUCH3, 0x5f8a56];
  for (i = 0; i < 4; i++) {
    var u = -1.35 + i * 0.9;
    zeltbahn(parts, [
      new THREE.Vector3(u - 0.34, 2.9, 0), new THREE.Vector3(u + 0.34, 2.9, 0),
      new THREE.Vector3(u + 0.34, 0.35, 0.12), new THREE.Vector3(u - 0.34, 0.35, 0.12)
    ], 0.22 + i * 0.05, toene[i]);
  }
  return mergeGeos(parts);
}

function geoSeilerbahn() {
  var parts = [], i, s;
  for (s = -1; s <= 1; s += 2) {   // Boecke an beiden Enden
    parts.push(part(new BX(0.14, 1.3, 0.14), M(s * 3.0, 0.65, -0.35), HW_HOLZD));
    parts.push(part(new BX(0.14, 1.3, 0.14), M(s * 3.0, 0.65, 0.35), HW_HOLZD));
    parts.push(part(new BX(0.16, 0.16, 0.9), M(s * 3.0, 1.3, 0), HW_HOLZD));
  }
  for (i = 0; i < 3; i++) {        // drei laufende Seile
    parts.push(part(new CY(0.045, 0.045, 6.0, 4),
      M(0, 1.28, -0.3 + i * 0.3, 0, 0, Math.PI / 2), 0xb2a184));
  }
  parts.push(part(new CY(0.7, 0.7, 0.12, 12), M(-3.35, 1.3, 0, 0, 0, Math.PI / 2), HW_HOLZ));
  for (i = 0; i < 4; i++) {        // Speichen des Haspelrads
    parts.push(part(new BX(0.08, 1.3, 0.08),
      M(-3.35, 1.3, 0, 0, 0, i * 0.78 + Math.PI / 2), HW_HOLZD));
  }
  parts.push(part(new BX(0.7, 0.4, 0.8), M(1.4, 1.05, 0), HW_HOLZ));   // Schlitten
  return mergeGeos(parts);
}

function geoSaegewerk() {
  var parts = [], i, s;
  for (s = -1; s <= 1; s += 2) {   // offene Halle auf Staendern
    for (i = 0; i < 3; i++) {
      parts.push(part(new CY(0.15, 0.19, 2.8, 6), M(s * 1.7, 1.4, -2.0 + i * 2.0), HW_HOLZ));
    }
    parts.push(part(new BX(0.22, 0.24, 4.6), M(s * 1.7, 2.9, 0), HW_HOLZD));
    fachwerk(parts, 4.4, 2.7, s * 1.7, "x", 1, s > 0 ? 953 : 967, HW_HOLZD);
  }
  parts.push(part(prismGeo(4.0, 1.2, 5.0), M(0, 3.0, 0), HW_DACH));
  parts.push(part(new BX(4.0, 0.1, 5.0), M(0, 2.95, 0), 0x4a4038));
  parts.push(part(new BX(0.9, 0.06, 3.0), M(0, 1.4, 0), HW_HOLZ));     // Sagegatter
  parts.push(part(new BX(0.1, 1.3, 0.06), M(0, 1.9, 0.4), HW_METALL));
  parts.push(part(new CY(1.1, 1.1, 0.12, 12), M(2.4, 0.9, 1.6, 0, 0, Math.PI / 2), HW_HOLZD));
  for (i = 0; i < 10; i++) {
    var a = i / 10 * 6.28;
    parts.push(part(new BX(0.5, 0.28, 0.06),
      M(2.4, 0.9 + Math.sin(a) * 0.95, 1.6 + Math.cos(a) * 0.95, a, Math.PI / 2, 0), HW_HOLZ));
  }
  for (i = 0; i < 4; i++) {        // Bretterstapel
    parts.push(part(new BX(1.4, 0.12, 2.4), M(-2.9, 0.1 + i * 0.15, -0.6), HW_HOLZ));
  }
  return mergeGeos(parts);
}

function geoSteinmetzhof() {
  var parts = [], i;
  for (i = 0; i < 4; i++) {
    var d = hashi(i, 3, 971);
    parts.push(part(new BX(0.9 + d * 0.3, 0.65 + d * 0.3, 0.8),
      M(-1.4 + (i % 2) * 1.5, 0.35 + d * 0.15, -0.9 + Math.floor(i / 2) * 1.6,
        0, (d - 0.5) * 0.6, 0), i % 2 ? HW_STEIN : 0xc0bbac));
  }
  parts.push(part(new BX(0.6, 0.55, 1.6), M(1.4, 0.28, 0.9), HW_HOLZD));  // Bock
  parts.push(part(new CY(0.34, 0.4, 1.9, 9), M(1.4, 0.75, 0.9, 0, 0.3, Math.PI / 2), 0xcac4b6));
  var s = bruchkante(part(new CY(0.34, 0.34, 0.5, 9), M(1.4, 0.75, 2.0, 0, 0, Math.PI / 2), 0xcac4b6),
    { nz: 1, wert: 2.05, rauheit: 0.35 }, 977);
  parts.push(s);
  for (i = 0; i < 5; i++) {        // Spaene
    var e = hashi(i, 5, 983);
    parts.push(part(brockenGeo(0.1 + e * 0.1, 983 + i * 3, 0.6),
      M((e - 0.5) * 2.4, 0.05, 1.6 + (hashi(i, 7, 983) - 0.5) * 1.0, e * 3, e * 6, 0,
        1, 0.5, 1), 0xd4cfc0));
  }
  return mergeGeos(parts);
}

function geoGlashuette() {
  var parts = [];
  sockel(parts, 3.2, 2.8, HW_STEIND);
  parts.push(part(new BX(3.2, 2.2, 2.8), M(0, 1.6, 0), HW_PUTZ));
  dach(parts, 3.2, 2.8, 1.3, 2.75, HW_DACH, false);
  fenster(parts, -1.0, 1.9, 1.42, 0.5, 0.55, "z");
  tuer(parts, 0.9, 0.5, 1.42, 0.75, 1.3);
  parts.push(part(new CO(1.1, 1.8, 9), M(0, 2.5, -0.3), HW_ZIEGEL));    // Ofen im Haus
  parts.push(part(new CY(0.3, 0.36, 2.4, 7), M(0, 4.3, -0.3), HW_ZIEGELD));
  parts.push(part(new CY(0.4, 0.4, 0.14, 7), M(0, 5.5, -0.3), 0x2e2a24));
  parts.push(part(new BX(0.7, 0.55, 0.25), M(0, 0.75, 1.44), HW_GLUT));  // Glutschein
  return mergeGeos(parts);
}

function geoLagerhaus() {
  var parts = [], i;
  sockel(parts, 3.4, 3.0, 0x8a8278);
  parts.push(part(new BX(3.4, 4.6, 3.0), M(0, 2.8, 0), 0xb09a72));
  // Nur die Schauseite bekommt Fachwerk: die drei uebrigen Wandflaechen sieht
  // die Kamera bei diesem Objekt praktisch nie, und jede kostete 60 Dreiecke.
  fachwerk(parts, 3.3, 4.4, 1.51, "z", 3, 991, HW_HOLZD);
  parts.push(part(prismGeo(3.8, 1.6, 3.4), M(0, 5.1, 0), HW_DACH));
  parts.push(part(new BX(3.8, 0.1, 3.4), M(0, 5.05, 0), 0x4a4038));
  for (i = 0; i < 4; i++) {
    fenster(parts, -0.9 + (i % 2) * 1.8, 1.9 + Math.floor(i / 2) * 1.7, 1.53, 0.45, 0.5, "z");
  }
  parts.push(part(new BX(0.9, 1.3, 0.14), M(0, 4.4, 1.55), 0x3a332c));   // Ladeluke
  parts.push(part(new BX(0.24, 0.24, 1.6), M(0, 5.3, 2.0), HW_HOLZD));   // Ausleger
  parts.push(part(new CY(0.22, 0.22, 0.2, 8), M(0, 5.3, 2.7, 0, 0, Math.PI / 2), HW_HOLZ));
  parts.push(part(new CY(0.03, 0.03, 1.6, 4), M(0, 4.5, 2.7), 0xb2a184));
  tuer(parts, 0, 0.5, 1.53, 1.1, 1.6);
  return mergeGeos(parts);
}

function geoHochschlot() {
  var parts = [
    part(new CY(0.4, 0.95, 7.0, 9), M(0, 3.5, 0), HW_ZIEGEL),
    part(new CY(1.15, 1.25, 0.5, 9), M(0, 0.25, 0), HW_ZIEGELD),
    part(new CY(0.5, 0.5, 0.14, 9), M(0, 6.98, 0), 0x2a2620)
  ];
  for (var i = 0; i < 3; i++) {
    var y = 2.0 + i * 1.7, r = 0.95 - (y / 7.0) * 0.55 + 0.07;
    parts.push(part(new CY(r, r, 0.22, 9), M(0, y, 0), HW_ZIEGELD));
  }
  return mergeGeos(parts);
}

function geoWasserrad() {
  var parts = [], i;
  parts.push(part(new CY(1.55, 1.55, 0.14, 16), M(0, 1.7, -0.4, 0, 0, Math.PI / 2), HW_HOLZD));
  parts.push(part(new CY(1.55, 1.55, 0.14, 16), M(0, 1.7, 0.4, 0, 0, Math.PI / 2), HW_HOLZD));
  parts.push(part(new CY(0.14, 0.14, 1.4, 6), M(0, 1.7, 0, 0, 0, Math.PI / 2), HW_HOLZ));
  for (i = 0; i < 12; i++) {
    var a = i / 12 * 6.28;
    parts.push(part(new BX(0.9, 0.42, 0.08),
      M(0, 1.7 + Math.sin(a) * 1.35, Math.cos(a) * 1.35, a, Math.PI / 2, 0), HW_HOLZ));
  }
  for (i = -1; i <= 1; i += 2) {   // Bock
    parts.push(part(new BX(0.2, 2.0, 0.2), M(i * 0.85, 0.9, 0), HW_HOLZD));
    parts.push(part(new BX(0.16, 1.4, 0.16), M(i * 1.5, 0.7, 0, 0, 0, i * 0.5), HW_HOLZD));
  }
  return mergeGeos(parts);
}

function geoWindpumpe() {
  var parts = [], i;
  for (i = 0; i < 4; i++) {        // Bockgeruest
    var x = i % 2 ? 0.7 : -0.7, z = i < 2 ? -0.7 : 0.7;
    parts.push(part(new BX(0.14, 3.2, 0.14),
      M(x * 0.55, 1.6, z * 0.55, z * 0.13, 0, -x * 0.13), HW_HOLZD));
  }
  parts.push(part(new BX(1.1, 0.14, 1.1), M(0, 3.2, 0), HW_HOLZD));
  parts.push(part(new BX(0.9, 0.7, 0.9), M(0, 0.35, 0), HW_HOLZ));      // Pumpenkasten
  parts.push(part(new CY(0.16, 0.16, 0.4, 8), M(0, 3.4, 0.55, Math.PI / 2, 0, 0), HW_METALL));
  for (i = 0; i < 4; i++) {        // Fluegel: schmale Bretter statt Tuecher,
    var a = i / 4 * 6.28;          // damit sie ohne alphaTest opak bleiben
    parts.push(part(new BX(0.42, 1.6, 0.06),
      M(Math.sin(a) * 0.9, 3.4 + Math.cos(a) * 0.9, 0.75, 0, 0, -a), 0xd8cdb2));
  }
  return mergeGeos(parts);
}

/* --- Pools Landwirtschaft und Handwerk ------------------------------------ */
definePool("ackerscholle", geoAckerscholle(), { radius: 1.8, ao: 0.15, familie: 'erde' });
definePool("rebenreihe", geoRebenreihe(), { radius: 1.0, ao: 0.2, familie: 'laub' });
definePool("hopfengeruest", geoHopfengeruest(), { radius: 1.4, dbl: true, ao: 0.2,
  familie: 'holz', wind: { amp: 0.22 } });
definePool("obstbaum", geoObstbaum(), { radius: 1.6, dbl: true, ao: 0.24,
  map: TEX.kroneRund, alphaTest: 0.42, familie: 'laub', wind: WINDLAUB });
definePool("garbe", geoGarbe(), { radius: 0.4, familie: 'stoff' });
definePool("heuschober", geoHeuschober(), { radius: 1.5, ao: 0.24, familie: 'stoff' });
definePool("taubenschlag", geoTaubenschlag(), { radius: 1.0, familie: 'holz' });
definePool("bienenstand", geoBienenstand(), { radius: 1.2, familie: 'stoff' });
definePool("pferch", geoPferch(), { radius: 2.6, ao: 0.2, familie: 'holz' });
definePool("viehstall", geoViehstall(), { radius: 2.6, familie: 'holz' });
definePool("kornspeicher", geoKornspeicher(), { radius: 1.8, ao: 0.24, familie: 'holz' });
definePool("dreschtenne", geoDreschtenne(), { radius: 2.0, ao: 0.16, familie: 'erde' });
definePool("terrassenfeld", geoTerrassenfeld(), { radius: 3.0, ao: 0.22, familie: 'stein' });
definePool("vogelscheuche", geoVogelscheuche(), { radius: 0.4, dbl: true, ao: 0.16,
  familie: 'stoff', wind: { amp: 0.3 } });
definePool("wassermuehle", geoWassermuehle(), { radius: 3.0, ao: 0.24, familie: 'holz' });

definePool("schmiede", geoSchmiede(), { radius: 2.2, ao: 0.24, familie: 'stein' });
definePool("koehlermeiler", geoKoehlermeiler(), { radius: 1.8, familie: 'erde' });
definePool("ziegelofen", geoZiegelofen(), { radius: 2.2, familie: 'stein' });
definePool("kalkofen", geoKalkofen(), { radius: 2.0, ao: 0.24, familie: 'stein' });
definePool("gerbergruben", geoGerbergruben(), { radius: 2.4, ao: 0.22, familie: 'holz' });
definePool("faerbergestell", geoFaerbergestell(), { radius: 1.8, dbl: true, ao: 0.2,
  familie: 'stoff', wind: { amp: 0.26 } });
definePool("seilerbahn", geoSeilerbahn(), { radius: 3.2, ao: 0.2, familie: 'holz' });
definePool("saegewerk", geoSaegewerk(), { radius: 3.2, ao: 0.26, familie: 'holz' });
definePool("steinmetzhof", geoSteinmetzhof(), { radius: 2.2, familie: 'stein' });
definePool("glashuette", geoGlashuette(), { radius: 2.6, familie: 'stein' });
definePool("lagerhaus", geoLagerhaus(), { radius: 3.0, ao: 0.24, familie: 'holz' });
definePool("hochschlot", geoHochschlot(), { radius: 1.0, familie: 'stein' });
definePool("wasserrad", geoWasserrad(), { radius: 2.0, ao: 0.24, familie: 'holz' });
definePool("windpumpe", geoWindpumpe(), { radius: 1.6, ao: 0.24, familie: 'holz' });

/* ==========================================================================
   Kategorie 5 — Sakral / Kult, einschliesslich des Arbor-Kults. Zwei Familien
   in einer Kategorie: der gebaute Kult aus Stein (Kapelle bis Steinkreis) und
   der gewachsene aus Ranke und Blatt. Sie teilen bewusst KEINE Palette — der
   Unterschied zwischen beiden ist die halbe Aussage des Settings.

   `kreuzgang` fehlt: der Katalog fuehrt ihn als Struktur-Generator (G), weil
   ein geschlossener Arkadenhof aus Kantenlaengen entsteht.
   ========================================================================== */
var SK_STEIN = 0xc4beac,
    SK_STEIND = 0x9a9484,
    SK_PUTZ = 0xf2ecdc,
    SK_DACH = 0x53707e,
    SK_HOLZ = 0x7a6450,
    SK_GOLD = 0xd8b25e,
    SK_GLAS = 0xe2934c,
    SK_MOOS = 0x5e7844,
    SK_METALL = 0x8e8a80,
    SK_GLUT = 0xffb45c,
    SK_TUCH1 = 0xb0574e,
    SK_TUCH2 = 0x3d78a8;

function geoKapelle() {
  var parts = [];
  sockel(parts, 2.4, 3.4, SK_STEIND);
  parts.push(part(new BX(2.4, 2.2, 3.4), M(0, 1.6, 0), SK_PUTZ));
  parts.push(part(new CY(1.2, 1.2, 2.2, 9, 1, false, -Math.PI / 2, Math.PI),
    M(0, 1.6, -1.7, 0, 0, 0, 1, 1, 1), SK_PUTZ));               // halbrunde Apsis
  parts.push(part(prismGeo(2.7, 1.2, 3.9), M(0, 2.7, 0, 0, Math.PI / 2, 0), SK_DACH));
  parts.push(part(new BX(2.7, 0.1, 3.9), M(0, 2.65, 0), 0x4a4038));
  parts.push(part(new CY(0.24, 0.28, 0.9, 6), M(0, 4.1, 1.0), SK_PUTZ));  // Dachreiter
  parts.push(part(new CO(0.34, 0.7, 6), M(0, 4.85, 1.0), SK_DACH));
  parts.push(part(new THREE.TorusGeometry(0.34, 0.09, 4, 9),
    M(0, 2.35, 1.72), SK_STEIN));                                // Rundfenster
  parts.push(part(new CY(0.3, 0.3, 0.08, 9), M(0, 2.35, 1.7), SK_GLAS));
  tuer(parts, 0, 0.5, 1.72, 0.75, 1.4);
  return mergeGeos(parts);
}

function geoGlockenturm() {
  var parts = [];
  sockel(parts, 1.7, 1.7, SK_STEIND);
  parts.push(part(new BX(1.7, 6.0, 1.7), M(0, 3.4, 0), SK_PUTZ));
  parts.push(part(new BX(1.95, 0.2, 1.95), M(0, 6.5, 0), SK_STEIN));
  for (var i = 0; i < 4; i++) {     // Schalloeffnungen
    var a = i / 4 * 6.28;
    parts.push(part(new BX(0.6, 1.4, 0.2),
      M(Math.cos(a) * 0.83, 5.6, Math.sin(a) * 0.83, 0, -a, 0), 0x2e3038));
  }
  parts.push(part(prismGeo(2.0, 1.3, 2.0), M(0, 6.6, 0), SK_DACH));
  parts.push(part(new BX(2.0, 0.1, 2.0), M(0, 6.55, 0), 0x4a4038));
  parts.push(part(new IC(0.34, 0), M(0, 5.55, 0, 0, 0.4, 0, 1, 1.2, 1), SK_GOLD));
  return mergeGeos(parts);
}

function geoKathedralenschiff() {
  var parts = [], i, s;
  parts.push(part(new BX(3.6, 6.4, 9.0), M(0, 3.2, 0), SK_PUTZ));
  parts.push(part(new BX(3.8, 0.24, 9.2), M(0, 6.5, 0), SK_STEIN));
  parts.push(part(prismGeo(4.2, 2.0, 9.4), M(0, 6.6, 0, 0, Math.PI / 2, 0), SK_DACH));
  parts.push(part(new BX(4.2, 0.1, 9.4), M(0, 6.55, 0), 0x4a4038));
  // Strebewerk: Pfeiler aussen, Bogen zurueck ans Langhaus. Der Torus traegt
  // den Bogen in einem Stueck — dieselbe Begruendung wie in bogenreihe().
  var bogen = new THREE.TorusGeometry(1.05, 0.16, 4, 6, Math.PI * 0.55);
  for (s = -1; s <= 1; s += 2) {
    for (i = 0; i < 3; i++) {
      var z = -2.8 + i * 2.8;
      parts.push(part(new BX(0.55, 4.6, 0.8), M(s * 2.9, 2.3, z), SK_STEIN));
      parts.push(part(new CO(0.4, 0.8, 5), M(s * 2.9, 4.9, z), SK_DACH));
      parts.push(part(bogen, M(s * 2.35, 4.3, z, 0, 0, s > 0 ? 0.35 : Math.PI - 0.35,
        1, 1, 5), SK_STEIN));
    }
  }
  // Rosette in der Westfassade — als Aufsatz gedacht, hier fest verbaut, weil
  // die Fassade ohne sie nur eine Wand ist.
  parts.push(part(new THREE.TorusGeometry(0.85, 0.16, 4, 12), M(0, 4.6, 4.55), SK_STEIN));
  parts.push(part(new CY(0.8, 0.8, 0.1, 12), M(0, 4.6, 4.52, Math.PI / 2, 0, 0), SK_GLAS));
  tuer(parts, 0, 0.5, 4.55, 1.4, 2.4);
  parts.push(part(new THREE.TorusGeometry(0.85, 0.28, 4, 8, Math.PI),
    M(0, 2.9, 4.55, 0, 0, 0, 1, 1, 1.2), SK_STEIN));
  return mergeGeos(parts);
}

function geoRosette() {
  var parts = [
    part(new THREE.TorusGeometry(0.55, 0.11, 4, 12), M(0, 0.55, 0), SK_STEIN),
    part(new CY(0.5, 0.5, 0.07, 12), M(0, 0.55, 0, Math.PI / 2, 0, 0), SK_GLAS)
  ];
  for (var i = 0; i < 8; i++) {
    parts.push(part(new BX(1.05, 0.08, 0.09), M(0, 0.55, 0.02, 0, 0, i * 0.393), SK_STEIN));
  }
  return mergeGeos(parts);
}

function geoBildstock() {
  return mergeGeos([
    part(new BX(0.5, 0.2, 0.5), M(0, 0.1, 0), SK_STEIND),
    part(new CY(0.13, 0.17, 1.9, 7), M(0, 1.15, 0), SK_STEIN),
    part(new BX(0.46, 0.55, 0.36), M(0, 2.35, 0), SK_PUTZ),
    part(new BX(0.3, 0.38, 0.12), M(0, 2.35, 0.16), 0x3a332c),
    part(prismGeo(0.66, 0.28, 0.52), M(0, 2.63, 0, 0, Math.PI / 2, 0), SK_DACH),
    part(new CY(0.02, 0.02, 0.3, 4), M(0, 2.95, 0), SK_METALL)
  ]);
}

function geoMenhir() {
  return mergeGeos([
    part(new BX(0.62, 2.4, 0.42), M(0, 1.2, 0, 0.04, 0.3, 0.09, 1, 1, 1), SK_STEIN),
    part(new BX(0.4, 0.9, 0.3), M(0.06, 2.5, 0.02, 0.04, 0.3, 0.09), SK_STEIN),
    part(new BX(0.66, 0.4, 0.46), M(0, 0.35, 0, 0, 0.3, 0), SK_MOOS)
  ]);
}

function geoSteinkreis() {
  var parts = [], i;
  for (i = 0; i < 9; i++) {
    var a = i / 9 * 6.28, d = hashi(i, 3, 1009);
    parts.push(part(new BX(0.55 + d * 0.2, 1.8 + d * 1.4, 0.4),
      M(Math.cos(a) * 3.0, (1.8 + d * 1.4) / 2, Math.sin(a) * 3.0,
        (d - 0.5) * 0.18, -a, (d - 0.5) * 0.22), i % 3 ? SK_STEIN : SK_STEIND));
  }
  parts.push(part(new BX(1.4, 0.3, 1.0), M(0, 0.15, 0, 0, 0.4, 0), SK_STEIND));
  return mergeGeos(parts);
}

function geoFeuerschale() {
  var parts = [], i;
  for (i = 0; i < 3; i++) {
    var a = i / 3 * 6.28;
    parts.push(part(new CY(0.04, 0.06, 1.1, 4),
      M(Math.cos(a) * 0.22, 0.55, Math.sin(a) * 0.22,
        Math.sin(a) * 0.22, 0, -Math.cos(a) * 0.22), SK_METALL));
  }
  parts.push(part(new CY(0.48, 0.3, 0.34, 9), M(0, 1.2, 0), SK_METALL));
  parts.push(part(new IC(0.3, 0), M(0, 1.32, 0, 0, 0.4, 0, 1, 0.55, 1), SK_GLUT));
  return mergeGeos(parts);
}

function geoOpferstein() {
  var parts = [
    part(new BX(1.7, 0.5, 1.1), M(0, 0.25, 0, 0, 0.1, 0.02), SK_STEIN),
    part(new BX(1.5, 0.1, 0.9), M(0, 0.5, 0, 0, 0.1, 0), SK_STEIND),
    part(new BX(0.9, 0.2, 0.55), M(-0.9, 0.1, 0.2, 0, 0.5, 0.1), SK_MOOS)
  ];
  for (var i = 0; i < 2; i++) {     // eingekerbte Rinnen
    parts.push(part(new BX(1.4, 0.07, 0.09), M(0, 0.51, -0.25 + i * 0.5, 0, 0.1, 0), 0x6a6458));
  }
  return mergeGeos(parts);
}

/** Kleines Arbor-Blatt als gestauchter Brocken statt leafGeo: leafGeo kostet
    ueber 380 Dreiecke pro Flaeche und ist fuer eine handgrosse Beigabe an
    Schrein, Altar und Tor um zwei Groessenordnungen zu teuer. */
function arborBlatt(parts, x, y, z, r, ry, hex) {
  parts.push(part(brockenGeo(r, 1013 + Math.round(x * 7 + z * 13), 0.3),
    M(x, y, z, 0.2, ry, 0.15, 1.5, 0.16, 0.75), hex === undefined ? AR_BLATT : hex));
  return parts;
}

function geoArborschrein() {
  var parts = [];
  // Rankenschlaufe: ein geschlossener Bogen ueber dem Altar, der links und
  // rechts in den Boden laeuft. Das ist die Geste des ganzen Kults.
  parts.push(part(tubeGeo([
    new THREE.Vector3(-1.1, 0.0, 0.2), new THREE.Vector3(-0.9, 1.4, -0.3),
    new THREE.Vector3(0.0, 2.2, 0.1), new THREE.Vector3(0.9, 1.5, -0.2),
    new THREE.Vector3(1.1, 0.0, 0.25)
  ], function (t) { return 0.19 + Math.sin(t * 3.14) * 0.06; }, 7, rankenAder), null, AR_HAUT));
  parts.push(part(new BX(1.2, 0.55, 0.8), M(0, 0.28, 0), SK_STEIN));
  parts.push(part(new BX(1.35, 0.12, 0.95), M(0, 0.58, 0), SK_STEIND));
  arborBlatt(parts, -0.75, 1.5, -0.1, 0.34, 0.5);
  arborBlatt(parts, 0.7, 1.7, 0.1, 0.3, -0.7, AR_BLATTU);
  arborBlatt(parts, 0.05, 2.35, -0.05, 0.26, 1.4);
  return mergeGeos(parts);
}

function geoRankenaltar() {
  var parts = [
    part(new BX(1.5, 0.9, 1.0), M(0, 0.45, 0), SK_STEIN),
    part(new BX(1.65, 0.14, 1.15), M(0, 0.95, 0), SK_STEIND)
  ];
  // Die Ranke durchstoesst den Block: sie war zuerst da, der Altar kam darum
  // herum. Der Katalogeintrag lebt genau von dieser Lesart.
  parts.push(part(tubeGeo([
    new THREE.Vector3(-1.0, -0.1, 0.3), new THREE.Vector3(-0.2, 0.5, 0.0),
    new THREE.Vector3(0.4, 1.2, -0.1), new THREE.Vector3(0.75, 2.0, 0.25)
  ], function (t) { return 0.16 - t * 0.05; }, 6, rankenAder), null, AR_HAUT));
  arborBlatt(parts, 0.85, 1.85, 0.3, 0.3, 0.6);
  arborBlatt(parts, 0.6, 1.35, -0.15, 0.24, -1.1, AR_BLATTU);
  return mergeGeos(parts);
}

function geoLichtsammler() {
  var parts = [
    part(new CY(0.3, 0.34, 0.3, 8), M(0, 0.15, 0), SK_STEIND),
    part(new CY(0.09, 0.12, 1.8, 6), M(0, 1.1, 0), SK_METALL),
    // Invertierter Kegel: die Schale oeffnet sich nach OBEN zum Licht.
    part(new CO(0.95, 0.8, 10), M(0, 2.35, 0, Math.PI, 0, 0), SK_METALL),
    part(new CY(0.85, 0.85, 0.07, 10), M(0, 2.6, 0), AR_GLUT)
  ];
  for (var i = 0; i < 3; i++) {
    var a = i / 3 * 6.28;
    parts.push(part(new CY(0.035, 0.045, 1.1, 4),
      M(Math.cos(a) * 0.42, 1.7, Math.sin(a) * 0.42,
        -Math.sin(a) * 0.35, 0, Math.cos(a) * 0.35), SK_METALL));
  }
  return mergeGeos(parts);
}

function geoSamenreliquiar() {
  var parts = [
    part(new BX(0.9, 0.3, 0.9), M(0, 0.15, 0), SK_STEIND),
    part(new BX(0.75, 0.1, 0.75), M(0, 0.35, 0), SK_METALL),
    part(new THREE.SphereGeometry(0.5, 10, 6), M(0, 1.15, 0, 0, 0, 0, 1, 1.25, 1), AR_HELL),
    part(new IC(0.24, 0), M(0, 1.1, 0), AR_GLUT),
    part(new CO(0.3, 0.4, 6), M(0, 1.95, 0), SK_GOLD)
  ];
  for (var i = 0; i < 4; i++) {
    var a = i / 4 * 6.28 + 0.78;
    parts.push(part(new CY(0.04, 0.05, 1.6, 4),
      M(Math.cos(a) * 0.36, 1.15, Math.sin(a) * 0.36), SK_METALL));
  }
  return mergeGeos(parts);
}

function geoBlattkanzel() {
  var b = leafGeo(3.0, 1.1, 0.62, 0.16, AR_BLATT, AR_BLATTU, AR_ADER, 1019);
  b.applyMatrix4(M(-1.0, 1.9, 0, 0, 0, 0.12));
  var parts = [b];
  parts.push(part(tubeGeo([
    new THREE.Vector3(-1.3, 0.0, 0), new THREE.Vector3(-1.15, 1.0, 0.15),
    new THREE.Vector3(-1.0, 1.9, 0)
  ], function (t) { return 0.24 - t * 0.09; }, 6, rankenAder), null, AR_HAUT));
  // Gelaender auf der offenen Seite: erst dadurch wird aus einem Blatt eine
  // Kanzel, auf der jemand stehen kann.
  for (var i = 0; i < 5; i++) {
    var u = 0.4 + i * 0.4, hw = leafHalfWidth(u / 3.0) * 1.1;
    parts.push(part(new CY(0.035, 0.045, 0.55, 4),
      M(u - 1.0, 2.15, hw * 0.9), AR_HOLZ));
    parts.push(part(new CY(0.035, 0.045, 0.55, 4),
      M(u - 1.0, 2.15, -hw * 0.9), AR_HOLZ));
  }
  return mergeGeos(parts);
}

function geoGebetsband() {
  var parts = [
    part(new CY(0.06, 0.09, 2.2, 5), M(-1.1, 1.1, 0), SK_HOLZ),
    part(new CY(0.06, 0.09, 2.2, 5), M(1.1, 1.1, 0), SK_HOLZ),
    part(new BX(2.3, 0.05, 0.05), M(0, 2.1, 0), 0xb2a184)
  ];
  starr(parts, 0, 0);
  var toene = [SK_TUCH1, SK_TUCH2, 0xe8dfc9, SK_GOLD, 0x5f8a56, 0xc0a6c4];
  for (var i = 0; i < 6; i++) {
    var u = -0.95 + i * 0.38;
    zeltbahn(parts, [
      new THREE.Vector3(u - 0.13, 2.08, 0), new THREE.Vector3(u + 0.13, 2.08, 0),
      new THREE.Vector3(u + 0.13, 0.9 - hashi(i, 3, 1021) * 0.5, 0.1),
      new THREE.Vector3(u - 0.13, 0.9 - hashi(i, 3, 1021) * 0.5, 0.1)
    ], 0.14, toene[i]);
  }
  return mergeGeos(parts);
}

function geoRankentor() {
  var parts = [], s;
  // Zwei Ranken, die sich oben verflechten: das Tor ist gewachsen, nicht
  // gebaut — es hat keinen Sturz, nur einen Knoten.
  for (s = -1; s <= 1; s += 2) {
    parts.push(part(tubeGeo([
      new THREE.Vector3(s * 1.9, 0.0, 0.15),
      new THREE.Vector3(s * 1.7, 1.6, -0.2),
      new THREE.Vector3(s * 0.9, 2.9, 0.1),
      new THREE.Vector3(-s * 0.2, 3.4, -0.15),
      new THREE.Vector3(-s * 0.9, 3.0, 0.15)
    ], function (t) { return 0.28 - t * 0.11; }, 7, rankenAder), null, AR_HAUT));
  }
  arborBlatt(parts, -1.5, 2.1, 0.2, 0.4, 0.4);
  arborBlatt(parts, 1.55, 1.7, -0.2, 0.36, -0.6, AR_BLATTU);
  arborBlatt(parts, 0.3, 3.5, 0.1, 0.32, 1.2);
  arborBlatt(parts, -0.5, 2.7, -0.25, 0.28, 2.1, AR_BLATTU);
  return mergeGeos(parts);
}

function geoGrabhuegel() {
  var parts = [
    // Kein moundGeo: das liest heightAt/terrainColor und wuerde die Geometrie
    // an das Terrain BEIM LADEN binden — Pool-Geometrien entstehen aber einmal
    // und stehen danach ueberall auf der Karte.
    part(brockenGeo(2.2, 1031, 0.3), M(0, 0.0, 0, 0, 0.4, 0, 1.1, 0.55, 1), 0x6f8a4e),
    part(brockenGeo(1.5, 1033, 0.35), M(-0.3, 0.5, -0.2, 0, 1.2, 0, 1, 0.45, 1), 0x7ba055),
    part(new BX(1.3, 1.5, 0.4), M(0, 0.7, 1.75, 0.1, 0, 0.03), SK_STEIN),
    part(new BX(1.6, 0.3, 0.5), M(0, 1.55, 1.75), SK_STEIND),
    part(new BX(0.7, 0.9, 0.2), M(0, 0.45, 1.95), 0x2e2a24)
  ];
  for (var s = -1; s <= 1; s += 2) {
    parts.push(part(new BX(0.42, 1.5, 0.3),
      M(s * 1.5, 0.75, 1.6, (s) * 0.06, s * 0.3, s * 0.1), SK_STEIN));
  }
  return mergeGeos(parts);
}

/* ==========================================================================
   Kategorie 6 — Wohnbau je Kultur. Vierzehn Haustypen plus die zwei Aufsaetze
   (Gaube, Kamin), die der Katalog als Anker-Bauteile fuehrt. Alle Bauten mit
   Fenstern bekommen unten einen FENSTER_ANKER-Eintrag, damit emitFensterlicht
   greift — ein Wohnhaus ohne Licht im Fenster ist eine Kulisse.
   ========================================================================== */
var WO_PUTZ = 0xf0ece0,
    WO_PUTZ2 = 0xe4dac2,
    WO_HOLZ = 0x9c8468,
    WO_HOLZD = 0x6f5a44,
    WO_DACH = 0x8a7a5a,
    WO_DACHZ = 0x36719f,
    WO_DACHS = 0x53707e,
    WO_REET = 0x9a8862,
    WO_STEIN = 0xb4aea0,
    WO_STEIND = 0x8f8878,
    WO_STOFF = 0xdcd0b4,
    WO_GRAS = 0x6f8f4a;

function geoLanghaus() {
  var parts = [], s, i;
  sockel(parts, 3.0, 7.0, WO_STEIND);
  parts.push(part(new BX(3.0, 2.0, 7.0), M(0, 1.4, 0), 0xd6c8a8));
  dach(parts, 3.0, 7.0, 1.8, 2.4, WO_REET, true);
  parts.push(part(new BX(3.5, 0.24, 7.6), M(0, 3.4, 0), WO_GRAS));   // Grasdach
  // Aeussere Stuetzboecke: die schraegen Balken sind die Silhouette, an der
  // ein nordisches Langhaus erkannt wird.
  for (s = -1; s <= 1; s += 2) {
    for (i = 0; i < 3; i++) {
      parts.push(part(new BX(0.16, 3.0, 0.16),
        M(s * 2.1, 1.3, -2.2 + i * 2.2, 0, 0, s * 0.42), WO_HOLZD));
    }
  }
  tuer(parts, 0, 0.5, 3.55, 0.9, 1.6);
  fenster(parts, 1.55, 1.7, -1.2, 0.45, 0.4, "x");
  fenster(parts, -1.55, 1.7, 1.0, 0.45, 0.4, "x");
  return mergeGeos(parts);
}

function geoGrubenhaus() {
  var parts = [
    part(brockenGeo(1.9, 1039, 0.3), M(0, -0.35, 0, 0, 0.4, 0, 1.1, 0.5, 1), 0x7a6a50)
  ];
  // Das Dach reicht bis auf den Boden — das ist die ganze Bauform.
  parts.push(part(prismGeo(2.6, 1.9, 3.0), M(0, 0.15, 0, 0, Math.PI / 2, 0), WO_REET));
  parts.push(part(new BX(2.7, 0.14, 3.1), M(0, 0.1, 0), 0x4a4038));
  parts.push(part(new CY(0.12, 0.12, 3.1, 5), M(0, 2.08, 0, Math.PI / 2, 0, 0), WO_HOLZD));
  parts.push(part(new BX(1.0, 1.3, 0.16), M(0, 0.65, 1.5), 0xa89678));
  tuer(parts, 0, 0.1, 1.6, 0.6, 1.1);
  return mergeGeos(parts);
}

function geoTurmhaus() {
  var parts = [], i;
  sockel(parts, 2.0, 2.0, WO_STEIND);
  parts.push(part(new BX(2.0, 5.6, 2.0), M(0, 3.3, 0), WO_PUTZ));
  parts.push(part(new BX(2.2, 0.14, 2.2), M(0, 2.4, 0), WO_PUTZ2));   // Gesimse
  parts.push(part(new BX(2.2, 0.14, 2.2), M(0, 4.2, 0), WO_PUTZ2));
  dach(parts, 2.0, 2.0, 1.3, 6.1, WO_DACHZ, false);
  for (i = 0; i < 3; i++) {
    fenster(parts, -0.45, 1.6 + i * 1.8, 1.02, 0.42, 0.55, "z");
    fenster(parts, 0.45, 1.6 + i * 1.8, 1.02, 0.42, 0.55, "z");
  }
  tuer(parts, 0, 0.5, 1.02, 0.65, 1.3);
  return mergeGeos(parts);
}

function geoGiebelhaus() {
  var parts = [], s, i;
  sockel(parts, 2.6, 3.2, WO_STEIND);
  parts.push(part(new BX(2.6, 3.4, 3.2), M(0, 2.2, 0), WO_PUTZ));
  parts.push(part(prismGeo(2.6, 1.5, 3.3), M(0, 3.9, 0, 0, Math.PI / 2, 0), WO_DACHZ));
  // Treppengiebel: fuenf Stufen je Seite, das Erkennungszeichen des Typs.
  for (s = -1; s <= 1; s += 2) {
    for (i = 0; i < 5; i++) {
      var b = 2.6 - i * 0.44;
      parts.push(part(new BX(b, 0.32, 0.24),
        M(0, 3.95 + i * 0.3, s * 1.62), WO_PUTZ2));
    }
    parts.push(part(new BX(0.5, 0.26, 0.3), M(0, 5.45, s * 1.62), WO_PUTZ2));
  }
  for (i = 0; i < 2; i++) {
    fenster(parts, -0.65, 1.6 + i * 1.5, 1.62, 0.5, 0.6, "z");
    fenster(parts, 0.65, 1.6 + i * 1.5, 1.62, 0.5, 0.6, "z");
  }
  tuer(parts, 0, 0.5, 1.62, 0.7, 1.4);
  return mergeGeos(parts);
}

function geoLaubenhaus() {
  var parts = [];
  sockel(parts, 3.4, 3.0, WO_STEIND);
  // Arkadenlaube im Erdgeschoss: bogenreihe traegt die Konstruktion, das
  // Obergeschoss sitzt darauf.
  bogenreihe(parts, 3, 0.72, 1.5, 0.5, WO_STEIN, 2.9, 0.35);
  parts.push(part(new BX(3.6, 0.22, 3.1), M(0, 2.6, 0), WO_STEIN));    // Laubendecke
  parts.push(part(new BX(3.4, 2.2, 3.0), M(0, 3.8, 0), WO_PUTZ));
  dach(parts, 3.4, 3.0, 1.4, 4.9, WO_DACHZ, false);
  fenster(parts, -0.9, 4.0, 1.52, 0.5, 0.6, "z");
  fenster(parts, 0.9, 4.0, 1.52, 0.5, 0.6, "z");
  fenster(parts, 1.72, 4.0, 0, 0.5, 0.6, "x");
  tuer(parts, 0, 0.6, 1.4, 0.7, 1.3);
  return mergeGeos(parts);
}

function geoHofdurchfahrt() {
  var parts = [];
  sockel(parts, 3.4, 2.8, WO_STEIND);
  for (var s = -1; s <= 1; s += 2) {   // zwei Pfeilerteile, dazwischen die Durchfahrt
    parts.push(part(new BX(1.0, 2.6, 2.8), M(s * 1.2, 1.5, 0), WO_PUTZ));
  }
  parts.push(part(new BX(3.4, 1.9, 2.8), M(0, 3.75, 0), WO_PUTZ));     // Riegel darueber
  parts.push(part(new THREE.TorusGeometry(0.72, 0.2, 4, 8, Math.PI),
    M(0, 2.35, 0, 0, 0, 0, 1, 1, 7.0), WO_STEIN));
  parts.push(part(new BX(3.6, 0.14, 2.95), M(0, 2.75, 0), WO_PUTZ2));
  dach(parts, 3.4, 2.8, 1.4, 4.7, WO_DACH, false);
  fenster(parts, -0.9, 3.9, 1.42, 0.5, 0.55, "z");
  fenster(parts, 0.9, 3.9, 1.42, 0.5, 0.55, "z");
  return mergeGeos(parts);
}

function geoPfahlhaus() {
  var parts = [], i;
  for (i = 0; i < 6; i++) {
    var x = (i % 3 - 1) * 1.1, z = i < 3 ? -0.9 : 0.9;
    parts.push(part(new CY(0.14, 0.19, 2.6, 6), M(x, 1.0, z), 0x6a5540));
  }
  parts.push(part(new BX(3.0, 0.16, 2.4), M(0, 2.3, 0), WO_HOLZ));
  parts.push(part(new BX(2.4, 1.7, 2.0), M(-0.2, 3.25, 0), 0xc8b494));
  dach(parts, 2.4, 2.0, 1.2, 4.1, WO_REET, true);
  parts.push(part(new BX(0.9, 0.1, 2.4), M(1.25, 2.38, 0), WO_HOLZ));  // Plattform
  for (i = 0; i < 5; i++) {                                            // Leiter
    parts.push(part(new BX(0.6, 0.05, 0.07), M(1.55, 0.4 + i * 0.42, 0.9), WO_HOLZ));
  }
  tuer(parts, -0.2, 2.4, 1.03, 0.6, 1.2);
  fenster(parts, -1.0, 3.4, 1.03, 0.42, 0.44, "z");
  return mergeGeos(parts);
}

function geoBaumhaus() {
  var parts = [
    part(new CY(0.34, 0.62, 5.0, 7), M(0, 2.5, 0, 0, 0, 0.05), 0x6f5a44),
    part(new BX(2.3, 0.16, 2.0), M(0.25, 3.3, 0, 0, 0.2, 0.04), WO_HOLZ),
    part(new BX(2.0, 1.5, 1.7), M(0.35, 4.1, 0, 0, 0.2, 0.05), 0xc0aa86)
  ];
  parts.push(part(prismGeo(2.4, 1.0, 2.1), M(0.35, 4.85, 0, 0, Math.PI / 2 + 0.2, 0), WO_DACH));
  parts.push(part(new BX(2.4, 0.09, 2.1), M(0.35, 4.8, 0, 0, 0.2, 0), 0x4a4038));
  tuer(parts, 0.5, 3.4, 0.9, 0.55, 1.1);
  fenster(parts, -0.35, 4.2, 0.88, 0.4, 0.42, "z");
  // Leiterseil statt Leiter: es haengt und schwingt, eine Holzleiter stuende.
  parts.push(part(tubeGeo([
    new THREE.Vector3(0.5, 3.25, 1.0), new THREE.Vector3(0.6, 1.7, 1.35),
    new THREE.Vector3(0.55, 0.05, 1.15)
  ], function () { return 0.05; }, 4), null, 0xb2a184));
  for (var i = 0; i < 6; i++) {
    parts.push(part(new BX(0.4, 0.05, 0.06),
      M(0.56, 0.4 + i * 0.5, 1.1 + Math.sin(i * 0.6) * 0.1), WO_HOLZ));
  }
  return mergeGeos(parts);
}

function geoRankenhaus() {
  var parts = [], s;
  for (s = -1; s <= 1; s += 2) {   // zwei Aufhaengungen nach oben
    parts.push(part(tubeGeo([
      new THREE.Vector3(s * 0.9, 4.6, 0.1),
      new THREE.Vector3(s * 1.0, 2.8, -0.15),
      new THREE.Vector3(s * 0.85, 1.5, 0.05)
    ], function (t) { return 0.2 - t * 0.06; }, 6, rankenAder), null, AR_HAUT));
  }
  parts.push(part(new BX(2.4, 1.9, 2.1), M(0, 0.95, 0), 0xd0c0a0));
  dach(parts, 2.4, 2.1, 1.2, 1.9, WO_DACH, false);
  parts.push(part(new BX(2.6, 0.14, 2.3), M(0, -0.1, 0), WO_HOLZD));
  // Blattterrasse an der Front: gestauchte Brocken statt leafGeo (siehe
  // arborBlatt) — bei 2.6 m Radius zaehlt die Silhouette, nicht die Aderung.
  arborBlatt(parts, 0, -0.2, 1.9, 1.1, 0.2);
  arborBlatt(parts, 0.9, -0.15, 1.5, 0.7, 1.1, AR_BLATTU);
  fenster(parts, -0.6, 1.2, 1.07, 0.45, 0.5, "z");
  fenster(parts, 0.6, 1.2, 1.07, 0.45, 0.5, "z");
  return mergeGeos(parts);
}

function geoElfenlaube() {
  var parts = [], i;
  for (i = 0; i < 6; i++) {
    var a = i / 6 * 6.28;
    parts.push(part(new CY(0.1, 0.14, 2.6, 7),
      M(Math.cos(a) * 1.6, 1.3, Math.sin(a) * 1.6), WO_PUTZ));
  }
  parts.push(part(new CY(1.9, 1.9, 0.14, 12), M(0, 0.07, 0), WO_PUTZ2));  // Boden
  parts.push(part(new CY(1.85, 1.85, 0.12, 12), M(0, 2.65, 0), WO_PUTZ2));
  parts.push(part(new CO(2.1, 1.4, 12), M(0, 3.4, 0), 0x5f8a76));
  starr(parts, 0, 0);
  for (i = 0; i < 4; i++) {        // Segeltuecher zwischen den Saeulen
    var a0 = i * 1.57 + 0.52, a1 = a0 + 1.05;
    zeltbahn(parts, [
      new THREE.Vector3(Math.cos(a0) * 1.6, 2.55, Math.sin(a0) * 1.6),
      new THREE.Vector3(Math.cos(a1) * 1.6, 2.55, Math.sin(a1) * 1.6),
      new THREE.Vector3(Math.cos(a1) * 1.7, 0.5, Math.sin(a1) * 1.7),
      new THREE.Vector3(Math.cos(a0) * 1.7, 0.5, Math.sin(a0) * 1.7)
    ], 0.28, i % 2 ? WO_STOFF : 0xe8e0cc);
  }
  return mergeGeos(parts);
}

function geoStollenhaus() {
  var parts = [];
  parts.push(part(brockenGeo(2.6, 1049, 0.4),
    M(0, 1.2, -2.2, 0, 0.5, 0, 1.2, 1.3, 1), 0x9a948a));    // Felsruecken dahinter
  sockel(parts, 3.2, 1.2, WO_STEIND);
  parts.push(part(new BX(3.2, 3.2, 1.2), M(0, 1.8, 0), WO_STEIN));
  parts.push(part(new BX(3.5, 0.24, 1.4), M(0, 3.5, 0), 0x9a9488));
  parts.push(part(new THREE.TorusGeometry(0.62, 0.18, 4, 8, Math.PI),
    M(0, 1.55, 0, 0, 0, 0, 1, 1, 3.6), 0x9a9488));
  parts.push(part(new BX(1.15, 1.55, 0.3), M(0, 0.8, 0.1), 0x2a2620));   // dunkler Stollen
  fenster(parts, -1.1, 2.5, 0.63, 0.45, 0.5, "z");
  fenster(parts, 1.1, 2.5, 0.63, 0.45, 0.5, "z");
  return mergeGeos(parts);
}

function geoLehmkuppelhaus() {
  var parts = [], i;
  parts.push(part(new CY(1.5, 1.65, 2.2, 10), M(0, 1.1, 0), WU_LEHM));
  parts.push(part(new THREE.SphereGeometry(1.55, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    M(0, 2.2, 0, 0, 0, 0, 1, 0.78, 1), WU_LEHMH));
  parts.push(part(new CY(0.2, 0.24, 0.3, 6), M(0, 3.4, 0), WU_LEHMD));
  for (i = 0; i < 6; i++) {        // Aussentreppe aufs Dach
    var a = -0.5 + i * 0.28;
    parts.push(part(new BX(0.75, 0.24, 0.42),
      M(Math.cos(a) * 1.75, 0.2 + i * 0.35, Math.sin(a) * 1.75, 0, -a, 0), WU_LEHMD));
  }
  fenster(parts, -0.75, 1.6, 1.32, 0.34, 0.4, "z");
  fenster(parts, 1.32, 1.6, -0.4, 0.34, 0.4, "x");
  tuer(parts, 0.3, 0.05, 1.5, 0.65, 1.3);
  return mergeGeos(parts);
}

function geoWohnblock() {
  var parts = [], i;
  sockel(parts, 3.6, 3.0, WO_STEIND);
  parts.push(part(new BX(3.6, 6.4, 3.0), M(0, 3.7, 0), WO_PUTZ));
  parts.push(part(new BX(3.8, 0.3, 3.2), M(0, 7.05, 0), WO_PUTZ2));     // Attika
  parts.push(part(new BX(3.5, 0.16, 2.9), M(0, 6.95, 0), 0x6a6458));    // Flachdach
  // Acht Fenster statt zwoelf: die vierte Reihe verschwindet in der Silhouette,
  // kostet aber 48 Dreiecke je Fenster.
  for (i = 0; i < 8; i++) {
    fenster(parts, -1.1 + (i % 2) * 2.2, 1.7 + Math.floor(i / 2) * 1.55, 1.53,
      0.5, 0.62, "z");
  }
  fenster(parts, 1.83, 3.2, 0.7, 0.5, 0.62, "x");
  fenster(parts, 1.83, 4.75, -0.7, 0.5, 0.62, "x");
  tuer(parts, 0, 0.5, 1.53, 0.8, 1.5);
  for (i = 0; i < 3; i++) {        // Kamine auf dem Flachdach
    parts.push(part(new BX(0.34, 1.0, 0.34), M(-1.0 + i * 1.0, 7.5, -0.6), WO_STEIN));
    parts.push(part(new BX(0.48, 0.12, 0.48), M(-1.0 + i * 1.0, 8.05, -0.6), WO_STEIND));
    parts.push(part(new BX(0.22, 0.06, 0.22), M(-1.0 + i * 1.0, 8.09, -0.6), 0x2a2622));
  }
  return mergeGeos(parts);
}

function geoGaube() {
  var parts = [
    part(new BX(0.66, 0.5, 0.66), M(0, 0.25, 0), WO_PUTZ),
    part(prismGeo(0.78, 0.34, 0.74), M(0, 0.5, 0, 0, Math.PI / 2, 0), WO_DACHS),
    part(new BX(0.78, 0.08, 0.74), M(0, 0.46, 0), 0x4a4038)
  ];
  fenster(parts, 0, 0.28, 0.34, 0.36, 0.34, "z");
  return mergeGeos(parts);
}

function geoKamin() {
  return mergeGeos([
    part(new BX(0.36, 1.3, 0.36), M(0, 0.65, 0), WO_STEIN),
    part(new BX(0.3, 0.2, 0.3), M(0, 0.3, 0), WO_STEIND),
    part(new BX(0.52, 0.13, 0.52), M(0, 1.36, 0), WO_STEIND),
    part(new BX(0.24, 0.07, 0.24), M(0, 1.41, 0), 0x2a2622)
  ]);
}

/* --- Pools Sakral und Wohnbau --------------------------------------------- */
definePool("kapelle", geoKapelle(), { radius: 2.0, ao: 0.24, familie: 'putz' });
definePool("glockenturm", geoGlockenturm(), { radius: 1.6, familie: 'putz' });
definePool("kathedralenschiff", geoKathedralenschiff(), { radius: 5.0, ao: 0.26, familie: 'stein' });
definePool("rosette", geoRosette(), { radius: 0.6, ao: 0.14, familie: 'stein' });
definePool("bildstock", geoBildstock(), { radius: 0.4, familie: 'stein' });
definePool("steinkreis", geoSteinkreis(), { radius: 3.4, ao: 0.24, familie: 'stein' });
definePool("menhir", geoMenhir(), { radius: 0.8, familie: 'stein' });
definePool("feuerschale", geoFeuerschale(), { radius: 0.7, ao: 0.16, familie: 'metall' });
definePool("opferstein", geoOpferstein(), { radius: 0.9, familie: 'stein' });
definePool("arborschrein", geoArborschrein(), { radius: 1.6, ao: 0.2, familie: 'rinde',
  emissive: 0x2e4a3e, emissiveIntensity: 0.5 });
definePool("rankenaltar", geoRankenaltar(), { radius: 1.2, familie: 'stein',
  emissive: 0x24382e, emissiveIntensity: 0.4 });
definePool("lichtsammler", geoLichtsammler(), { radius: 1.4, ao: 0.18, familie: 'metall',
  emissive: 0x4e8a72, emissiveIntensity: 0.6 });
definePool("samenreliquiar", geoSamenreliquiar(), { radius: 1.0, ao: 0.16, familie: 'metall',
  emissive: 0x4e8a72, emissiveIntensity: 0.7 });
definePool("blattkanzel", geoBlattkanzel(), { radius: 2.0, dbl: true, ao: 0.18, familie: 'laub' });
definePool("gebetsband", geoGebetsband(), { radius: 1.2, dbl: true, ao: 0.16,
  familie: 'stoff', wind: { amp: 0.5 } });
definePool("rankentor", geoRankentor(), { radius: 2.4, ao: 0.2, familie: 'rinde',
  emissive: 0x2e4a3e, emissiveIntensity: 0.5 });
definePool("grabhuegel", geoGrabhuegel(), { radius: 2.6, ao: 0.24, familie: 'erde' });

definePool("langhaus", geoLanghaus(), { radius: 3.8, ao: 0.26, familie: 'reet' });
definePool("grubenhaus", geoGrubenhaus(), { radius: 1.8, familie: 'reet' });
definePool("turmhaus", geoTurmhaus(), { radius: 2.0, familie: 'putz' });
definePool("giebelhaus", geoGiebelhaus(), { radius: 2.6, familie: 'putz' });
definePool("laubenhaus", geoLaubenhaus(), { radius: 3.0, ao: 0.26, familie: 'putz' });
definePool("hofdurchfahrt", geoHofdurchfahrt(), { radius: 3.0, ao: 0.26, familie: 'putz' });
definePool("pfahlhaus", geoPfahlhaus(), { radius: 2.4, ao: 0.26, familie: 'holz' });
definePool("baumhaus", geoBaumhaus(), { radius: 2.2, ao: 0.26, familie: 'holz' });
definePool("rankenhaus", geoRankenhaus(), { radius: 2.6, ao: 0.22, familie: 'holz' });
definePool("elfenlaube", geoElfenlaube(), { radius: 2.4, dbl: true, ao: 0.2,
  familie: 'stoff', wind: { amp: 0.2 } });
definePool("stollenhaus", geoStollenhaus(), { radius: 2.8, ao: 0.24, familie: 'stein' });
definePool("lehmkuppelhaus", geoLehmkuppelhaus(), { radius: 2.2, familie: 'putz' });
definePool("wohnblock", geoWohnblock(), { radius: 3.6, ao: 0.26, familie: 'putz' });
definePool("gaube", geoGaube(), { radius: 0.5, familie: 'dachziegel' });
definePool("kamin", geoKamin(), { radius: 0.3, familie: 'stein' });

/* ==========================================================================
   Kategorie 14 — Kleinzeug und Requisiten. Sie stehen an keiner Struktur, sind
   billig und machen am Ende den Unterschied zwischen "Modell" und "bewohnter
   Ort" (Katalog, Buendel 6). Deshalb ist hier jedes Stueck unter 100 Dreiecke.
   ========================================================================== */
var RQ_HOLZ = 0x9c8468,
    RQ_HOLZD = 0x6f5a44,
    RQ_STEIN = 0xa9a196,
    RQ_STEIND = 0x8a8278,
    RQ_METALL = 0x4c4841,
    RQ_STOFF = 0xdcd0b4,
    RQ_ERDE = 0x6a5844,
    RQ_TON = 0xb87a52,
    RQ_WASSER = 0x2e3a40,
    RQ_GLUT = 0xffa04c,
    RQ_GRUEN = 0x6f8f4a;

function geoWagenrad() {
  var parts = [
    part(new THREE.TorusGeometry(0.45, 0.07, 3, 12), M(0, 0.5, 0, 0, 0, 0.25), RQ_HOLZD),
    part(new CY(0.11, 0.11, 0.14, 7), M(0, 0.5, 0, Math.PI / 2, 0, 0), RQ_HOLZ)
  ];
  for (var i = 0; i < 6; i++) {
    parts.push(part(new BX(0.06, 0.86, 0.05), M(0, 0.5, 0, 0, 0, i * 0.52 + 0.25), RQ_HOLZ));
  }
  return mergeGeos(parts);
}

function geoHolzstapel() {
  var parts = [], i;
  for (i = 0; i < 12; i++) {
    var lage = Math.floor(i / 6), d = hashi(i, 3, 1061);
    parts.push(part(new CY(0.11 + d * 0.03, 0.11 + d * 0.03, 1.3, 5),
      M(-0.42 + (i % 6) * 0.17, 0.12 + lage * 0.24, (d - 0.5) * 0.08,
        Math.PI / 2, (d - 0.5) * 0.06, 0), lage ? RQ_HOLZ : 0x8a7050));
  }
  return mergeGeos(parts);
}

function geoWasserbottich() {
  return mergeGeos([
    part(new CY(0.42, 0.36, 0.6, 9), M(0, 0.3, 0), RQ_HOLZ),
    part(new CY(0.435, 0.435, 0.06, 9), M(0, 0.14, 0), 0x55483a),
    part(new CY(0.425, 0.425, 0.06, 9), M(0, 0.5, 0), 0x55483a),
    part(new CY(0.38, 0.38, 0.05, 9), M(0, 0.52, 0), RQ_WASSER)
  ]);
}

function geoWaescheleine() {
  var parts = [
    part(new CY(0.05, 0.07, 1.9, 5), M(-1.2, 0.95, 0), RQ_HOLZD),
    part(new CY(0.05, 0.07, 1.9, 5), M(1.2, 0.95, 0), RQ_HOLZD),
    part(new BX(2.5, 0.03, 0.03), M(0, 1.82, 0), 0xb2a184)
  ];
  starr(parts, 0, 0);
  var toene = [RQ_STOFF, 0xe8e0cc, 0xc0d0d8, 0xd8c8b0];
  for (var i = 0; i < 4; i++) {
    var u = -0.9 + i * 0.6;
    zeltbahn(parts, [
      new THREE.Vector3(u - 0.24, 1.8, 0), new THREE.Vector3(u + 0.24, 1.8, 0),
      new THREE.Vector3(u + 0.24, 1.0 - hashi(i, 3, 1063) * 0.3, 0.08),
      new THREE.Vector3(u - 0.24, 1.0 - hashi(i, 3, 1063) * 0.3, 0.08)
    ], 0.12, toene[i]);
  }
  return mergeGeos(parts);
}

function geoBank() {
  return mergeGeos([
    part(new BX(1.5, 0.1, 0.36), M(0, 0.42, 0), RQ_HOLZ),
    part(new BX(0.12, 0.42, 0.32), M(-0.6, 0.21, 0), RQ_HOLZD),
    part(new BX(0.12, 0.42, 0.32), M(0.6, 0.21, 0), RQ_HOLZD)
  ]);
}

function geoTisch() {
  var parts = [
    part(new BX(1.6, 0.1, 0.8), M(0, 0.72, 0), RQ_HOLZ),
    part(new BX(1.4, 0.08, 0.3), M(0, 0.42, 0.65), RQ_HOLZ),
    part(new BX(1.4, 0.08, 0.3), M(0, 0.42, -0.65), RQ_HOLZ)
  ], i;
  for (i = 0; i < 4; i++) {
    parts.push(part(new CY(0.06, 0.07, 0.7, 5),
      M(i % 2 ? 0.65 : -0.65, 0.35, i < 2 ? -0.28 : 0.28), RQ_HOLZD));
  }
  for (i = -1; i <= 1; i += 2) {
    parts.push(part(new BX(0.1, 0.36, 0.26), M(-0.55, 0.2, i * 0.65), RQ_HOLZD));
    parts.push(part(new BX(0.1, 0.36, 0.26), M(0.55, 0.2, i * 0.65), RQ_HOLZD));
  }
  return mergeGeos(parts);
}

function geoFeuerstelle() {
  var parts = [], i;
  for (i = 0; i < 8; i++) {
    var a = i / 8 * 6.28, d = hashi(i, 3, 1069);
    parts.push(part(brockenGeo(0.13 + d * 0.07, 1069 + i * 3, 0.5),
      M(Math.cos(a) * 0.58, 0.08, Math.sin(a) * 0.58, d, a, 0, 1, 0.7, 1), RQ_STEIN));
  }
  for (i = 0; i < 4; i++) {
    var b = i / 4 * 3.14;
    parts.push(part(new CY(0.05, 0.06, 0.85, 4),
      M(0, 0.16, 0, 0.2, b, 1.35), 0x6a5540));
  }
  parts.push(part(new CO(0.24, 0.62, 6), M(0, 0.4, 0, 0, 0.4, 0.05), RQ_GLUT));
  return mergeGeos(parts);
}

function geoKochkessel() {
  var parts = [], i;
  for (i = 0; i < 3; i++) {
    var a = i / 3 * 6.28;
    parts.push(part(new CY(0.03, 0.045, 1.3, 4),
      M(Math.cos(a) * 0.24, 0.65, Math.sin(a) * 0.24,
        Math.sin(a) * 0.32, 0, -Math.cos(a) * 0.32), RQ_METALL));
  }
  parts.push(part(new THREE.SphereGeometry(0.3, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.62),
    M(0, 0.62, 0, Math.PI, 0, 0), 0x3a3630));
  parts.push(part(new THREE.TorusGeometry(0.28, 0.025, 3, 8, Math.PI),
    M(0, 0.62, 0, 0, 0, 0), RQ_METALL));
  return mergeGeos(parts);
}

function geoLattenzaun() {
  var parts = [
    part(new CY(0.08, 0.1, 1.2, 5), M(-0.95, 0.6, 0), RQ_HOLZD),
    part(new CY(0.08, 0.1, 1.2, 5), M(0.95, 0.6, 0), RQ_HOLZD),
    part(new BX(2.0, 0.08, 0.06), M(0, 0.95, 0), RQ_HOLZ),
    part(new BX(2.0, 0.08, 0.06), M(0, 0.55, 0), RQ_HOLZ)
  ];
  for (var i = 0; i < 5; i++) {
    var d = hashi(i, 3, 1087);
    parts.push(part(new BX(0.11, 1.05, 0.05),
      M(-0.72 + i * 0.36, 0.55, 0.03, 0, 0, (d - 0.5) * 0.1), RQ_HOLZ));
  }
  return mergeGeos(parts);
}

function geoGartenbeet() {
  var parts = [
    part(new BX(1.4, 0.32, 0.9), M(0, 0.16, 0), RQ_HOLZ),
    part(new BX(1.24, 0.1, 0.74), M(0, 0.34, 0), RQ_ERDE)
  ];
  for (var i = 0; i < 6; i++) {
    var d = hashi(i, 3, 1091);
    parts.push(part(new IC(0.12 + d * 0.06, 0),
      M(-0.45 + (i % 3) * 0.45, 0.42, i < 3 ? -0.18 : 0.18, 0, d * 3, 0, 1, 0.9, 1),
      i % 2 ? RQ_GRUEN : 0x86a85a));
  }
  return mergeGeos(parts);
}

function geoTontoepfe() {
  var parts = [], i;
  for (i = 0; i < 4; i++) {
    var d = hashi(i, 3, 1093);
    parts.push(part(new CY(0.16 - i * 0.02, 0.11 - i * 0.015, 0.24, 8),
      M((d - 0.5) * 0.1, 0.12 + i * 0.2, (hashi(i, 5, 1093) - 0.5) * 0.1,
        0, d * 3, (d - 0.5) * 0.08), i % 2 ? RQ_TON : 0xa06a48));
  }
  return mergeGeos(parts);
}

function geoSackstapel() {
  var parts = [], i;
  for (i = 0; i < 5; i++) {
    var lage = i < 3 ? 0 : 1, d = hashi(i, 3, 1097);
    var a = (i % 3) / 3 * 6.28 + lage * 0.9;
    parts.push(part(new IC(0.22, 0),
      M(Math.cos(a) * 0.22, 0.17 + lage * 0.32, Math.sin(a) * 0.22,
        0, d * 3, (d - 0.5) * 0.2, 1.15, 0.85, 0.95),
      lage ? 0xcfc3a4 : 0xbfb08e));
  }
  return mergeGeos(parts);
}

function geoSchubkarre() {
  return mergeGeos([
    part(new BX(0.55, 0.32, 0.8), M(0, 0.42, 0, 0.1, 0, 0), RQ_HOLZ),
    part(new BX(0.48, 0.06, 0.7), M(0, 0.3, 0), RQ_HOLZD),
    part(new CY(0.2, 0.2, 0.07, 9), M(0, 0.2, 0.62, 0, 0, Math.PI / 2), RQ_HOLZD),
    part(new BX(0.06, 0.06, 1.0), M(-0.2, 0.5, -0.75, -0.12, 0, 0), RQ_HOLZ),
    part(new BX(0.06, 0.06, 1.0), M(0.2, 0.5, -0.75, -0.12, 0, 0), RQ_HOLZ),
    part(new CY(0.05, 0.05, 0.3, 4), M(0, 0.16, -0.4, 0, 0, Math.PI / 2), RQ_HOLZD)
  ]);
}

function geoLeiter() {
  var parts = [
    part(new BX(0.07, 2.6, 0.07), M(-0.24, 1.3, 0, 0.22, 0, 0), RQ_HOLZ),
    part(new BX(0.07, 2.6, 0.07), M(0.24, 1.3, 0, 0.22, 0, 0), RQ_HOLZ)
  ];
  for (var i = 0; i < 7; i++) {
    var y = 0.2 + i * 0.36;
    parts.push(part(new BX(0.5, 0.05, 0.05), M(0, y, -y * 0.22, 0, 0, 0), RQ_HOLZD));
  }
  return mergeGeos(parts);
}

function geoBlumenkasten() {
  var parts = [
    part(new BX(0.62, 0.16, 0.18), M(0, 0.08, 0), RQ_HOLZD),
    part(new BX(0.56, 0.06, 0.13), M(0, 0.17, 0), RQ_ERDE)
  ];
  var toene = [0xd8734c, 0xe0a03c, 0xc0a6c4, 0xe8e0cc, 0xd06a7c];
  for (var i = 0; i < 5; i++) {
    parts.push(part(new IC(0.07, 0),
      M(-0.22 + i * 0.11, 0.23, (hashi(i, 3, 1103) - 0.5) * 0.06), toene[i]));
  }
  return mergeGeos(parts);
}

function geoBrunnentrog() {
  return mergeGeos([
    part(new BX(1.9, 0.5, 0.6), M(0, 0.25, 0), RQ_STEIN),
    part(new BX(1.7, 0.28, 0.44), M(0, 0.34, 0), RQ_WASSER),
    part(new BX(0.4, 0.75, 0.3), M(-1.05, 0.38, 0), RQ_STEIND),
    part(new CY(0.06, 0.06, 0.34, 5), M(-0.86, 0.62, 0, 0, 0, Math.PI / 2), RQ_METALL),
    part(new BX(0.08, 0.28, 0.06), M(-0.7, 0.48, 0), 0x35566b)
  ]);
}

function geoMarktkorb() {
  var parts = [], i;
  for (i = 0; i < 3; i++) {
    var d = hashi(i, 3, 1109), a = i / 3 * 6.28;
    parts.push(part(new CY(0.2, 0.15, 0.26, 8, 1, true),
      M(Math.cos(a) * 0.16, 0.13 + (i === 2 ? 0.18 : 0), Math.sin(a) * 0.16,
        0, d * 3, (d - 0.5) * 0.14), 0xb59a6e));
  }
  for (i = 0; i < 4; i++) {
    var e = hashi(i, 5, 1109);
    parts.push(part(new IC(0.06 + e * 0.03, 0),
      M(0.16 + (e - 0.5) * 0.2, 0.4, 0.0 + (hashi(i, 7, 1109) - 0.5) * 0.2),
      i % 2 ? 0xd8734c : 0xd8b25e));
  }
  return mergeGeos(parts);
}

/* ==========================================================================
   Kategorie 15 — Fahrzeuge und Tiersilhouetten. Tiere sind hier bewusst
   SILHOUETTEN und keine Modelle: Rumpf, vier Striche, Kopf. Alles darueber
   hinaus liest bei Objektgroesse 0.5 m nicht mehr, kostet aber sofort.
   ========================================================================== */
var TI_FELL = 0xa89478,
    TI_FELLD = 0x74604a,
    TI_WOLLE = 0xe0d8c4,
    TI_DUNKEL = 0x4a4038,
    TI_HORN = 0xd8cfb4;

/** Vier Beine an den Ecken eines Rumpfes — der Kern jeder Tiersilhouette. */
function beine(parts, bx, bz, y, h, r, hex) {
  for (var i = 0; i < 4; i++) {
    parts.push(part(new CY(r * 0.75, r, h, 4),
      M(i % 2 ? bx : -bx, y - h / 2, i < 2 ? -bz : bz), hex));
  }
  return parts;
}

function geoPferd() {
  var parts = [part(new BX(0.44, 0.6, 1.5), M(0, 1.2, 0), TI_FELL)];
  beine(parts, 0.16, 0.52, 0.9, 0.9, 0.07, TI_FELLD);
  parts.push(part(new BX(0.3, 0.75, 0.34), M(0, 1.5, 0.62, -0.5, 0, 0), TI_FELL));
  parts.push(part(new CO(0.19, 0.5, 5), M(0, 1.85, 0.95, 1.9, 0, 0), TI_FELL));
  parts.push(part(new PL(0.75, 0.3), M(0, 1.65, 0.6, 0, Math.PI / 2, -0.5), TI_FELLD));
  parts.push(part(new PL(0.5, 0.24), M(0, 1.3, -0.78, 0, Math.PI / 2, 0.35), TI_FELLD));
  return mergeGeos(parts);
}

function geoRind() {
  var parts = [part(new BX(0.5, 0.62, 1.35), M(0, 0.95, 0), 0xc4b8a4)];
  beine(parts, 0.19, 0.45, 0.65, 0.65, 0.075, TI_FELLD);
  parts.push(part(new BX(0.36, 0.34, 0.5), M(0, 1.0, 0.85, -0.15, 0, 0), 0xc4b8a4));
  parts.push(part(new BX(0.42, 0.5, 0.42), M(0, 0.9, -0.62), TI_DUNKEL));
  for (var s = -1; s <= 1; s += 2) {
    parts.push(part(new CO(0.05, 0.28, 4), M(s * 0.16, 1.2, 0.8, 0, 0, s * 1.0), TI_HORN));
  }
  return mergeGeos(parts);
}

function geoSchaf() {
  var parts = [part(new IC(0.4, 0), M(0, 0.62, 0, 0, 0.4, 0, 1.0, 0.85, 1.35), TI_WOLLE)];
  beine(parts, 0.16, 0.24, 0.4, 0.4, 0.045, TI_DUNKEL);
  parts.push(part(new BX(0.22, 0.26, 0.3), M(0, 0.66, 0.52, 0.2, 0, 0), TI_DUNKEL));
  parts.push(part(new IC(0.13, 0), M(0, 0.78, 0.44), TI_WOLLE));
  return mergeGeos(parts);
}

function geoZiege() {
  var parts = [part(new IC(0.3, 0), M(0, 0.62, 0, 0, 0.3, 0, 0.9, 0.85, 1.4), 0xbdb0a0)];
  beine(parts, 0.13, 0.22, 0.44, 0.44, 0.04, TI_FELLD);
  parts.push(part(new BX(0.18, 0.2, 0.3), M(0, 0.7, 0.44, -0.2, 0, 0), 0xbdb0a0));
  for (var s = -1; s <= 1; s += 2) {   // geschwungene Hoerner nach hinten
    parts.push(part(new CY(0.02, 0.035, 0.34, 4), M(s * 0.07, 0.86, 0.38, -0.9, 0, s * 0.2), TI_HORN));
    parts.push(part(new CY(0.015, 0.025, 0.24, 4), M(s * 0.08, 0.95, 0.24, -1.9, 0, s * 0.2), TI_HORN));
  }
  parts.push(part(new PL(0.2, 0.16), M(0, 0.62, 0.46, 0, Math.PI / 2, 0.4), TI_FELLD));
  return mergeGeos(parts);
}

function geoMoewe() {
  // V-Stellung: die einzige Flugsilhouette, die aus jeder Richtung als Vogel
  // gelesen wird. Der Koerper ist bewusst ein einziger Quader.
  return mergeGeos([
    part(new BX(0.1, 0.09, 0.4), M(0, 0, 0), 0xf2efe6),
    part(new PL(0.7, 0.2), M(-0.36, 0.11, 0, 0, 0, 0.32), 0xf2efe6),
    part(new PL(0.7, 0.2), M(0.36, 0.11, 0, 0, 0, -0.32), 0xeae6da),
    part(new CO(0.05, 0.14, 3), M(0, 0.01, 0.24, Math.PI / 2, 0, 0), 0xd8a44c)
  ]);
}

function geoKutsche() {
  var parts = [], i;
  parts.push(part(new BX(0.95, 1.1, 1.5), M(0, 1.0, 0), 0x6a4a3c));
  parts.push(part(new BX(1.05, 0.14, 1.6), M(0, 1.6, 0), 0x54382c));
  parts.push(part(prismGeo(1.1, 0.28, 1.65), M(0, 1.67, 0, 0, Math.PI / 2, 0), 0x54382c));
  parts.push(part(new BX(1.0, 0.16, 1.6), M(0, 0.42, 0), 0x54382c));
  fenster(parts, 0, 1.15, 0.78, 0.44, 0.5, "z");
  fenster(parts, 0.5, 1.15, 0, 0.44, 0.5, "x");
  parts.push(part(new BX(0.9, 0.12, 0.5), M(0, 1.72, 0.7), 0x6a4a3c));   // Kutschbock
  for (i = 0; i < 4; i++) {
    var gross = i < 2;
    var r = gross ? 0.42 : 0.28;
    parts.push(part(new CY(r, r, 0.07, 10),
      M(i % 2 ? 0.55 : -0.55, r, gross ? -0.62 : 0.72, 0, 0, Math.PI / 2), RQ_HOLZD));
  }
  parts.push(part(new BX(0.08, 0.08, 1.4), M(0, 0.5, 1.5, -0.06, 0, 0), RQ_HOLZ));
  return mergeGeos(parts);
}

function geoOchsengespann() {
  var parts = [], s;
  // Karren: Muster geoKarren, aber laenger und mit Bordwaenden.
  parts.push(part(new BX(1.1, 0.24, 2.0), M(0, 0.72, -0.9), RQ_HOLZ));
  parts.push(part(new BX(0.1, 0.42, 2.0), M(-0.55, 0.95, -0.9), RQ_HOLZD));
  parts.push(part(new BX(0.1, 0.42, 2.0), M(0.55, 0.95, -0.9), RQ_HOLZD));
  for (s = -1; s <= 1; s += 2) {
    parts.push(part(new CY(0.45, 0.45, 0.08, 10),
      M(s * 0.62, 0.45, -1.3, 0, 0, Math.PI / 2), RQ_HOLZD));
  }
  parts.push(part(new BX(0.09, 0.09, 1.6), M(0, 0.7, 0.6), RQ_HOLZ));   // Deichsel
  parts.push(part(new BX(1.3, 0.12, 0.12), M(0, 0.95, 1.35), RQ_HOLZD));  // Joch
  for (s = -1; s <= 1; s += 2) {     // zwei Zugochsen
    var ox = s * 0.42;
    parts.push(part(new BX(0.48, 0.6, 1.3), M(ox, 0.95, 2.1), 0xa89478));
    // Beine hier von Hand statt ueber beine(): das Gespann setzt ZWEI Ochsen
    // nebeneinander, der Helfer kennt nur einen Rumpf im Ursprung.
    parts.push(part(new CY(0.06, 0.075, 0.65, 4), M(ox - 0.18, 0.32, 1.72), TI_FELLD));
    parts.push(part(new CY(0.06, 0.075, 0.65, 4), M(ox + 0.18, 0.32, 1.72), TI_FELLD));
    parts.push(part(new CY(0.06, 0.075, 0.65, 4), M(ox - 0.18, 0.32, 2.5), TI_FELLD));
    parts.push(part(new CY(0.06, 0.075, 0.65, 4), M(ox + 0.18, 0.32, 2.5), TI_FELLD));
    parts.push(part(new BX(0.34, 0.32, 0.46), M(ox, 0.98, 2.9, -0.12, 0, 0), 0xa89478));
    parts.push(part(new CO(0.05, 0.26, 4), M(ox - 0.14, 1.2, 2.85, 0, 0, -0.9), TI_HORN));
    parts.push(part(new CO(0.05, 0.26, 4), M(ox + 0.14, 1.2, 2.85, 0, 0, 0.9), TI_HORN));
  }
  return mergeGeos(parts);
}

function geoRankengleiter() {
  var parts = [rumpf(3.4, 1.0, 0.75, 0.25, AR_HOLZ)], s;
  // Blattfluegel ohne Dicke (thick = 0): eine Tragflaeche wird von unten
  // gesehen, deshalb rendert der Pool mit dbl — eine zweite Blattflaeche waere
  // 380 Dreiecke fuer nichts.
  for (s = -1; s <= 1; s += 2) {
    var fl = leafGeo(2.6, 1.0, 0.3, 0, AR_BLATT, AR_BLATTU, AR_ADER, 1117 + (s + 1));
    fl.applyMatrix4(M(s * 0.4, 0.5, 0, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2, s * 0.18));
    parts.push(fl);
  }
  parts.push(part(new THREE.SphereGeometry(1.1, 12, 6),
    M(0, 1.9, -0.2, 0, 0, 0, 1.0, 0.62, 2.1), AR_HELL));   // gestauchter Ballon
  for (s = -1; s <= 1; s += 2) {
    parts.push(part(new CY(0.04, 0.05, 1.2, 4), M(s * 0.45, 1.1, -0.2), AR_HOLZD));
  }
  starr(parts, 0, 0);
  zeltbahn(parts, [
    new THREE.Vector3(-0.1, 1.5, -1.9), new THREE.Vector3(0.1, 1.5, -1.9),
    new THREE.Vector3(0.1, 0.4, -2.4), new THREE.Vector3(-0.1, 0.4, -2.4)
  ], 0.25, 0xe8dfc9);
  return mergeGeos(parts);
}

/* --- Pools Requisiten, Fahrzeuge, Tiere ----------------------------------- */
definePool("wagenrad", geoWagenrad(), { radius: 0.5, familie: 'holz' });
definePool("holzstapel", geoHolzstapel(), { radius: 0.8, familie: 'holz' });
definePool("wasserbottich", geoWasserbottich(), { radius: 0.5, familie: 'holz' });
definePool("waescheleine", geoWaescheleine(), { radius: 1.4, dbl: true, ao: 0.16,
  familie: 'stoff', wind: { amp: 0.42 } });
definePool("bank", geoBank(), { radius: 0.6, familie: 'holz' });
definePool("tisch", geoTisch(), { radius: 0.9, familie: 'holz' });
definePool("feuerstelle", geoFeuerstelle(), { radius: 0.8, ao: 0.18, familie: 'stein' });
definePool("kochkessel", geoKochkessel(), { radius: 0.6, familie: 'metall' });
definePool("lattenzaun", geoLattenzaun(), { radius: 1.0, familie: 'holz' });
definePool("gartenbeet", geoGartenbeet(), { radius: 0.8, familie: 'holz' });
definePool("tontoepfe", geoTontoepfe(), { radius: 0.4, familie: 'erde' });
definePool("sackstapel", geoSackstapel(), { radius: 0.6, familie: 'stoff' });
definePool("schubkarre", geoSchubkarre(), { radius: 0.7, familie: 'holz' });
definePool("leiter", geoLeiter(), { radius: 0.6, familie: 'holz' });
definePool("blumenkasten", geoBlumenkasten(), { radius: 0.3, ao: 0.14, familie: 'holz' });
definePool("brunnentrog", geoBrunnentrog(), { radius: 0.8, familie: 'stein' });
definePool("marktkorb", geoMarktkorb(), { radius: 0.4, familie: 'stoff' });

definePool("ochsengespann", geoOchsengespann(), { radius: 2.2, ao: 0.24, familie: 'holz' });
definePool("kutsche", geoKutsche(), { radius: 1.6, familie: 'holz' });
definePool("pferd", geoPferd(), { radius: 1.0, dbl: true, ao: 0.2, familie: 'stoff' });
definePool("rind", geoRind(), { radius: 0.8, familie: 'stoff' });
definePool("schaf", geoSchaf(), { radius: 0.5, familie: 'stoff' });
definePool("ziege", geoZiege(), { radius: 0.4, dbl: true, ao: 0.2, familie: 'stoff' });
definePool("moewe", geoMoewe(), { radius: 0.2, dbl: true, ao: 0, familie: 'stoff' });
definePool("rankengleiter", geoRankengleiter(), { radius: 3.0, dbl: true, ao: 0.18,
  familie: 'stoff' });

/* --- Anker der neuen Buendel ---------------------------------------------
   Beide Tabellen werden NUR ERWEITERT. Die Bestandszeilen bleiben unberuehrt,
   weil jede Aenderung dort die Beleuchtung bestehender Karten verschoebe.   */

/* Fensterglut: nur ACHSPARALLELE Oeffnungen bekommen einen Anker —
   emitFensterlicht leitet die Blickrichtung aus der dominanten Achse ab. */
FENSTER_ANKER.langhaus = [[1.58, 1.7, -1.2], [-1.58, 1.7, 1.0]];
FENSTER_ANKER.turmhaus = [[-0.45, 1.6, 1.05], [0.45, 1.6, 1.05],
                          [-0.45, 3.4, 1.05], [0.45, 3.4, 1.05], [0.45, 5.2, 1.05]];
FENSTER_ANKER.giebelhaus = [[-0.65, 1.6, 1.65], [0.65, 1.6, 1.65],
                            [-0.65, 3.1, 1.65], [0.65, 3.1, 1.65]];
FENSTER_ANKER.laubenhaus = [[-0.9, 4.0, 1.55], [0.9, 4.0, 1.55], [1.75, 4.0, 0]];
FENSTER_ANKER.hofdurchfahrt = [[-0.9, 3.9, 1.45], [0.9, 3.9, 1.45]];
FENSTER_ANKER.pfahlhaus = [[-1.0, 3.4, 1.06]];
FENSTER_ANKER.baumhaus = [[-0.35, 4.2, 0.91]];
FENSTER_ANKER.rankenhaus = [[-0.6, 1.2, 1.1], [0.6, 1.2, 1.1]];
FENSTER_ANKER.stollenhaus = [[-1.1, 2.5, 0.66], [1.1, 2.5, 0.66]];
FENSTER_ANKER.lehmkuppelhaus = [[-0.75, 1.6, 1.35], [1.35, 1.6, -0.4]];
FENSTER_ANKER.wohnblock = [[-1.1, 1.7, 1.56], [1.1, 1.7, 1.56],
                           [-1.1, 3.25, 1.56], [1.1, 3.25, 1.56],
                           [-1.1, 4.8, 1.56], [1.1, 4.8, 1.56],
                           [-1.1, 6.35, 1.56], [1.1, 6.35, 1.56],
                           [1.86, 3.2, 0.7], [1.86, 4.75, -0.7]];
FENSTER_ANKER.moorhuette = [[-0.6, 1.35, 1.06]];
FENSTER_ANKER.lagerhaus = [[-0.9, 1.9, 1.56], [0.9, 1.9, 1.56],
                           [-0.9, 3.6, 1.56], [0.9, 3.6, 1.56]];
FENSTER_ANKER.glashuette = [[-1.0, 1.9, 1.45]];
FENSTER_ANKER.viehstall = [[1.2, 1.5, 1.37]];
FENSTER_ANKER.wassermuehle = [[-0.8, 2.0, 1.35]];
FENSTER_ANKER.kapelle = [[0, 2.35, 1.74]];
FENSTER_ANKER.gaube = [[0, 0.28, 0.37]];
FENSTER_ANKER.kutsche = [[0, 1.15, 0.81]];

/* Dauerlicht: hier wird NICHT gewuerfelt. Eine Esse, ein Irrlicht oder eine
   Lavaspalte, die in 60 % der Faelle aus ist, waere keine.
   Werte: [x, y, z, groesse] im lokalen Massstab des Wirtspools.            */
LICHT_ANKER.schmiede = [0.9, 0.6, 0.35, 1.5];
LICHT_ANKER.ziegelofen = [0, 0.55, 1.3, 1.4];
LICHT_ANKER.kalkofen = [0, 0.45, 1.4, 1.1];
LICHT_ANKER.glashuette = [0, 0.8, 1.5, 1.2];
LICHT_ANKER.feuerschale = [0, 1.34, 0, 1.1];
LICHT_ANKER.feuerstelle = [0, 0.28, 0, 1.2];
LICHT_ANKER.lavaspalte = [0, 0.2, 0, 2.4];
LICHT_ANKER.rissspalt = [0, 0.0, 0, 2.6];
LICHT_ANKER.irrlicht = [0, 0.9, 0, 1.3];
LICHT_ANKER.sporenlaterne = [0, 0.25, 0, 1.3];
LICHT_ANKER.leuchtpilz = [0, 0.35, 0, 0.9];
LICHT_ANKER.lichtbluete = [0, 0.3, 0, 1.0];
LICHT_ANKER.samenreliquiar = [0, 1.15, 0, 1.3];
LICHT_ANKER.lichtsammler = [0, 2.62, 0, 1.5];
LICHT_ANKER.samenkapsel = [0, 1.3, 0, 2.0];
LICHT_ANKER.saftzapfer = [0, 0.56, 0.42, 0.7];

/* I1 — die 49 Kartenzeichen. `definePool` wird HEREINGEREICHT statt dort
   importiert: signaturen.js darf diese Datei nicht importieren, sonst
   entstuende genau der Auswertungszyklus, der in Runde H schon einmal die
   ganze App am Start gehindert hat (siehe die Notiz zu setBruchQuelle oben).
   Die Richtung ist also geometry.js -> signaturen.js, nie zurueck. */
registriereSignaturPools(definePool);
setPoolNames();

export { mergeGeos, M, part, prismGeo, tubeGeo, leafHalfWidth, leafSurface, leafGeo,
  moundGeo, islandGeo, FENSTER_ANKER, LICHT_ANKER };
