// Die weissen Ranken: Geflecht, Wurzelteller, Blaetter, Blattplateaus, Inseln.
import * as THREE from 'three';
import { clamp, lerp, sstep, fractal, rngOf, rr, ri, wpick } from '../core/rng.js';
import { S, VINE_R, groupOf } from '../core/store.js';
import { emit, tintOf, schattenAn } from '../core/pools.js';
import { heightAt } from '../world/terrain.js';
import { newOcc, occFree, occAdd } from './objects.js';
import { mergeGeos, M, tubeGeo, leafHalfWidth, leafSurface, leafGeo, moundGeo, islandGeo }
  from './geometry.js';
import { vineMat, leafMat, rockMat } from '../render/materials.js';

var VINE_LO = new THREE.Color(0xe7e2d6), VINE_MID = new THREE.Color(0xf4f1e8),
    VINE_HI = new THREE.Color(0xffffff);

/** Farbverlauf einer Ranke: unten leicht abgetönt, oben rein weiß im Dunst. */
function vineColor(t, out) {
  if (t < 0.25) out.copy(VINE_LO).lerp(VINE_MID, t / 0.25);
  else out.copy(VINE_MID).lerp(VINE_HI, sstep(0.25, 1, t));
}

var _vUp = new THREE.Vector3(0, 0, 1);
function frameAt(curve, t, outC, outN1, outN2) {
  curve.getPoint(t, outC);
  var tan = curve.getTangent(t).normalize();
  outN1.crossVectors(tan, _vUp);
  if (outN1.lengthSq() < 1e-6) outN1.set(1, 0, 0);
  outN1.normalize();
  outN2.crossVectors(tan, outN1).normalize();
}

function genRanke(el) {
  var p = el.params, rng = rngOf(el.seed);
  var pt = el.points[0];
  if (!pt) return;
  var x0 = pt.x, z0 = pt.z;
  var y0 = heightAt(x0, z0) - 1.8;
  var H = p.hoehe;
  var geos = [], i, k, t;

  // --- Mittelachse mit sanfter seitlicher Auslenkung ---
  var ctrl = [], NC = 12;
  var sway = H * 0.06;
  for (i = 0; i <= NC; i++) {
    t = i / NC;
    var f = Math.pow(t, 0.85);
    ctrl.push(new THREE.Vector3(
      x0 + (fractal(t * 3.1 + 1.7, 0.5, el.seed + 3) - 0.5) * 2 * sway * f,
      y0 + t * H,
      z0 + (fractal(0.5, t * 3.1 + 4.2, el.seed + 9) - 0.5) * 2 * sway * f
    ));
  }
  var axis = new THREE.CatmullRomCurve3(ctrl, false, "catmullrom", 0.5);

  // --- Stränge: viele, dünn und eng gewickelt, damit ein Geflecht entsteht
  var nStr = clamp(Math.round(p.straenge), 4, 10);
  // Die Steigung wird in Ranken-Durchmessern je Umdrehung angegeben — nur so
  // bleibt das Geflecht bei jeder Höhe gleich dicht geflochten.
  var TURNS = H / (p.steigung * 2 * VINE_R);
  var RINGS = clamp(Math.round(TURNS * 22), 64, 220);
  var c = new THREE.Vector3(), n1 = new THREE.Vector3(), n2 = new THREE.Vector3();
  function wrapAt(tt) { return VINE_R * 0.66 * (1 - 0.58 * tt); }
  function strandR(tt) { return VINE_R * (0.06 + 0.21 * Math.pow(1 - tt, 1.15)); }
  for (k = 0; k < nStr; k++) {
    var a0 = k / nStr * Math.PI * 2 + rr(rng, -0.06, 0.06);
    var pts = [];
    for (i = 0; i <= RINGS; i++) {
      t = i / RINGS;
      frameAt(axis, t, c, n1, n2);
      var wrap = wrapAt(t);
      var ang = a0 + t * TURNS * Math.PI * 2;
      var ca = Math.cos(ang), sa = Math.sin(ang);
      pts.push(new THREE.Vector3(
        c.x + n1.x * ca * wrap + n2.x * sa * wrap,
        c.y,
        c.z + n1.z * ca * wrap + n2.z * sa * wrap
      ));
    }
    var thick = rr(rng, 0.85, 1.15);
    geos.push(tubeGeo(pts, function (tt) { return strandR(tt) * thick; },
      7, function (tt, ii, col) { vineColor(tt, col); }));
  }

  // --- Wurzelteller: viele, unterschiedlich weit ausgreifende Bögen ---
  var nRoot = ri(rng, 12, 16);
  for (k = 0; k < nRoot; k++) {
    var ra = (k / nRoot) * Math.PI * 2 + rr(rng, -0.16, 0.16);
    var rd = VINE_R * rr(rng, 1.7, 3.6);
    var gx = x0 + Math.cos(ra) * rd, gz = z0 + Math.sin(ra) * rd;
    var gy = heightAt(gx, gz) - 2.4;
    var attach = VINE_R * rr(rng, 0.9, 2.8);
    var bulk = rr(rng, 0.75, 1.45);
    var rp = [];
    for (i = 0; i <= 16; i++) {
      t = i / 16;
      var e = t * t * (3 - 2 * t);
      var swirl = Math.sin(t * Math.PI) * rr(rng, -0.35, 0.35);
      rp.push(new THREE.Vector3(
        lerp(gx, x0 + Math.cos(ra) * VINE_R * 0.42, e) - Math.sin(ra) * swirl * VINE_R,
        lerp(gy, y0 + attach, e) + Math.sin(t * Math.PI) * VINE_R * 0.26,
        lerp(gz, z0 + Math.sin(ra) * VINE_R * 0.42, e) + Math.cos(ra) * swirl * VINE_R
      ));
    }
    geos.push(tubeGeo(rp, function (tt) {
      return VINE_R * (0.055 + 0.21 * Math.pow(tt, 0.75)) * bulk;
    }, 7, function (tt, ii, col) { vineColor(tt * 0.1, col); }));
  }

  schattenAn(el, x0, heightAt(x0, z0), z0, VINE_R * 5.2);

  var vineMesh = new THREE.Mesh(mergeGeos(geos), vineMat);
  vineMesh.userData.el = el;
  vineMesh.renderOrder = 2;
  groupOf(el).add(vineMesh);

  // --- Erdhügel, über den die Wurzeln laufen ---
  var mound = new THREE.Mesh(
    moundGeo(VINE_R * 3.6, VINE_R * 0.75, x0, z0, (el.seed + 61) | 0), rockMat);
  mound.position.set(x0, heightAt(x0, z0), z0);
  mound.userData.el = el;
  groupOf(el).add(mound);

  // --- Blätter am Stamm ---
  var nLeaf = Math.round(p.blaetter);
  for (k = 0; k < nLeaf; k++) {
    t = clamp(0.06 + Math.pow(rng(), 0.85) * 0.92, 0, 0.99);
    frameAt(axis, t, c, n1, n2);
    var la = rng() * Math.PI * 2;
    var surf = wrapAt(t) + strandR(t) * 0.7;
    var lx = c.x + n1.x * Math.cos(la) * surf + n2.x * Math.sin(la) * surf;
    var lz = c.z + n1.z * Math.cos(la) * surf + n2.z * Math.sin(la) * surf;
    var dirA = Math.atan2(lz - c.z, lx - c.x);
    var size = VINE_R * rr(rng, 0.9, 1.9) * (1 - t * 0.35);
    emit(el, "blatt", lx, c.y, lz, -dirA + rr(rng, -0.3, 0.3),
      size, size, size, tintOf(rng, 0.1), 0, rr(rng, -0.85, -0.15));
  }

  // --- Blattplateaus, spiralig um den Stamm gestaffelt ---
  var nPl = clamp(Math.round(p.plateaus), 0, 6);
  var leafGeos = [];
  var _lv = new THREE.Vector3();
  for (k = 0; k < nPl; k++) {
    var fr = nPl > 1 ? k / (nPl - 1) : 0.45;
    t = clamp(0.34 + fr * 0.54 + rr(rng, -0.025, 0.025), 0.1, 0.96);
    frameAt(axis, t, c, n1, n2);
    var pang = k * 2.39996 + el.seed * 0.0007;
    var L = lerp(44, 24, fr) * p.plateau;
    var W = L * 0.66, cup = 0.17, thick = L * 0.04;
    var ox = Math.cos(pang), oz = Math.sin(pang);
    var g = leafGeo(L, W, cup, thick, 0x62894a, 0x9cba7a, 0x8fb06c, (el.seed + k * 31) | 0);
    var droop = M(0, 0, 0, 0, 0, -0.1);
    var place = M(c.x + ox * VINE_R * 0.45, c.y, c.z + oz * VINE_R * 0.45, 0, -pang, 0);
    var full = new THREE.Matrix4().multiplyMatrices(place, droop);
    g.applyMatrix4(full);
    leafGeos.push(g);

    if (!p.staedtchen) continue;
    var occ2 = newOcc(4);
    var nH = ri(rng, 5, 18);
    for (i = 0; i < nH; i++) {
      var u = rr(rng, 0.22, 0.86), v = rr(rng, -0.72, 0.72);
      _lv.set(u * L, leafSurface(u, v, L, cup), v * leafHalfWidth(u) * W).applyMatrix4(full);
      if (!occFree(occ2, _lv.x, _lv.z, 2.5)) continue;
      occAdd(occ2, _lv.x, _lv.z, 2.5);
      var kind = wpick(rng, [["haus", 6], ["haus2", 4], ["turm", 2], ["kuppel", 2], ["arkade", 1]]);
      var sc = rr(rng, 0.65, 0.95);
      emit(el, kind, _lv.x, _lv.y - 0.1, _lv.z, -pang + rr(rng, -0.25, 0.25),
        sc, sc * rr(rng, 0.9, 1.25), sc, tintOf(rng));
    }
    var nCyp = ri(rng, 4, 9);
    for (i = 0; i < nCyp; i++) {
      var u2 = rr(rng, 0.3, 0.92), v2 = (rng() < 0.5 ? -1 : 1) * rr(rng, 0.78, 0.92);
      _lv.set(u2 * L, leafSurface(u2, v2, L, cup), v2 * leafHalfWidth(u2) * W).applyMatrix4(full);
      var sc2 = rr(rng, 0.45, 0.8);
      emit(el, "zypresse", _lv.x, _lv.y - 0.1, _lv.z, rng() * 6.28,
        sc2, sc2 * rr(rng, 0.9, 1.3), sc2, tintOf(rng, 0.08));
    }
  }
  if (leafGeos.length) {
    var lm = new THREE.Mesh(mergeGeos(leafGeos), leafMat);
    lm.userData.el = el;
    groupOf(el).add(lm);
  }

  // --- Schwebeinseln ---
  var nIsl = clamp(Math.round(p.inseln), 0, 4);
  var islGeos = [];
  for (k = 0; k < nIsl; k++) {
    t = rr(rng, 0.25, 0.95);
    frameAt(axis, t, c, n1, n2);
    var ia = rr(rng, 0, 6.283), idst = VINE_R * rr(rng, 2.6, 7);
    var ix = c.x + Math.cos(ia) * idst, iy = c.y + rr(rng, -H * 0.05, H * 0.05),
        iz = c.z + Math.sin(ia) * idst;
    var ir = rr(rng, 3.5, 8);
    var ig = islandGeo(ir, (el.seed + k * 77) | 0);
    ig.applyMatrix4(M(ix, iy, iz, 0, rr(rng, 0, 6.283), 0));
    islGeos.push(ig);
    var nT = ri(rng, 0, 3);
    for (i = 0; i < nT; i++) {
      var ta = rng() * 6.283, tq = Math.sqrt(rng()) * ir * 0.5;
      var sc3 = rr(rng, 0.3, 0.6);
      emit(el, rng() < 0.6 ? "baum" : "zypresse",
        ix + Math.cos(ta) * tq, iy + ir * 0.28, iz + Math.sin(ta) * tq,
        rng() * 6.28, sc3, sc3, sc3, tintOf(rng, 0.08));
    }
  }
  if (islGeos.length) {
    var im = new THREE.Mesh(mergeGeos(islGeos), rockMat);
    im.userData.el = el;
    groupOf(el).add(im);
  }
}


export { vineColor, genRanke };
