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

var _moosFarbe = new THREE.Color(0x7a8a5c);
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
  var y0 = heightAt(x0, z0) - 2.6;   // waechst IN den aufgeworfenen Boden hinein
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

  // --- Straenge: wenige und massiv. Die Umdrehungsrate wechselt ueber die
  //     Hoehe abschnittsweise, der Radius atmet per Rauschen (Verdickungen
  //     und Einschnuerungen), Grundverjuengung nach oben auf 45 %.
  var nStr = clamp(Math.round(p.straenge), 3, 5);
  var TURNS = H / (p.steigung * 2 * VINE_R);
  var RINGS = clamp(Math.round(TURNS * 26), 72, 240);
  var c = new THREE.Vector3(), n1 = new THREE.Vector3(), n2 = new THREE.Vector3();
  function wrapAt(tt, kk) {
    // Straenge legen sich stellenweise aneinander und laufen wieder auseinander
    var eng = 0.72 + (fractal(tt * 2.6 + kk * 3.7, 0.5, el.seed + 217) - 0.5) * 0.5;
    return VINE_R * 0.62 * (1 - 0.55 * tt) * eng;
  }
  var strandDaten = [];
  for (k = 0; k < nStr; k++) {
    var a0 = k / nStr * Math.PI * 2 + rr(rng, -0.2, 0.2);
    var pts = [];
    var winkel = a0;
    var radF = [];
    for (i = 0; i <= RINGS; i++) {
      t = i / RINGS;
      frameAt(axis, t, c, n1, n2);
      // abschnittsweise wechselnde Umdrehungsrate
      var rate = 0.5 + fractal(t * 3.2, k * 1.7, el.seed + 131) * 1.1;
      winkel += (TURNS * Math.PI * 2 / RINGS) * rate;
      var wrap = wrapAt(t, k);
      var ca = Math.cos(winkel), sa = Math.sin(winkel);
      pts.push(new THREE.Vector3(
        c.x + n1.x * ca * wrap + n2.x * sa * wrap,
        c.y,
        c.z + n1.z * ca * wrap + n2.z * sa * wrap
      ));
      // Radius: Verdickungen/Einschnuerungen 0.7..1.4, Wellenlaenge ~H/8
      radF.push(0.7 + 0.7 * fractal(t * 8.2, k * 2.3, el.seed + 149));
    }
    var thick = rr(rng, 1.35, 1.7);          // dicker als frueher — weniger, massiver
    strandDaten.push({ pts: pts, radF: radF, thick: thick });
    geos.push((function (radFL, thickL) {
      return tubeGeo(pts, function (tt, ii) {
        return VINE_R * 0.30 * lerp(1, 0.45, tt) * radFL[Math.min(ii, radFL.length - 1)] * thickL;
      }, 8, function (tt, ii, col) {
        vineColor(tt, col);
        // Moos und Bewuchs sammeln sich in den Einschnuerungen
        var rf = radFL[Math.min(ii, radFL.length - 1)];
        if (rf < 0.88) col.lerp(_moosFarbe, (0.88 - rf) * 1.6);
      });
    })(radF, thick));
  }

  // --- Nebentriebe: duenne freie Auslaeufer vom Hauptbuendel ---------------
  var nTrieb = ri(rng, 2, 4);
  for (k = 0; k < nTrieb; k++) {
    var tt0 = rr(rng, 0.25, 0.85);
    frameAt(axis, tt0, c, n1, n2);
    var ta = rr(rng, 0, 6.283);
    var tp = [];
    for (i = 0; i <= 10; i++) {
      var q = i / 10;
      tp.push(new THREE.Vector3(
        c.x + Math.cos(ta) * (VINE_R * 0.5 + q * VINE_R * rr(rng, 1.2, 2.2)),
        c.y + q * VINE_R * rr(rng, 0.8, 2.0) - q * q * VINE_R * 0.9,
        c.z + Math.sin(ta) * (VINE_R * 0.5 + q * VINE_R * rr(rng, 1.2, 2.2))
      ));
    }
    geos.push((function (t0L) {
      return tubeGeo(tp, function (q2) { return VINE_R * 0.06 * (1 - q2 * 0.8); },
        5, function (q2, ii, col) { vineColor(t0L, col); });
    })(tt0));
  }

  // --- Grosse Blaetter in Buescheln entlang der Straenge -------------------
  var blattT = 0.06 + rng() * 0.05;
  while (blattT < 0.96) {
    var hauptStrang = strandDaten[Math.floor(rng() * strandDaten.length)];
    var si = Math.floor(blattT * RINGS);
    var sp = hauptStrang.pts[Math.min(si, hauptStrang.pts.length - 1)];
    frameAt(axis, blattT, c, n1, n2);
    var buendel = ri(rng, 3, 7);
    for (i = 0; i < buendel; i++) {
      var ba = Math.atan2(sp.z - c.z, sp.x - c.x) + rr(rng, -1.1, 1.1);
      var groesse = rr(rng, 4, 10.5) * (1 - blattT * 0.5) * (p.blattgroesse || 1);
      emit(el, "rankenblatt",
        sp.x + Math.cos(ba) * 0.4, sp.y + rr(rng, -1.2, 1.2), sp.z + Math.sin(ba) * 0.4,
        -ba + rr(rng, -0.4, 0.4),
        groesse, groesse * rr(rng, 0.5, 0.7), groesse,
        [0.97, 1.0, 0.86], rr(rng, -0.15, 0.15), rr(rng, -0.7, -0.1));
    }
    // groessere blattfreie Abschnitte zwischen den Buescheln
    blattT += rr(rng, 0.07, 0.17);
  }

  // --- Wurzelteller: ungleichmaessig um den Fuss verteilt, flacher, laenger
  var nRoot = ri(rng, 10, 14);
  var wStart = rr(rng, 0, 6.283);
  for (k = 0; k < nRoot; k++) {
    var ra = wStart + Math.pow(k / nRoot, rr(rng, 0.7, 1.4)) * Math.PI * 2 + rr(rng, -0.3, 0.3);
    var rd = VINE_R * rr(rng, 1.6, 4.6);
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
    moundGeo(VINE_R * 4.6, VINE_R * 1.15, x0, z0, (el.seed + 61) | 0), rockMat);
  mound.position.set(x0, heightAt(x0, z0), z0);
  mound.userData.el = el;
  groupOf(el).add(mound);

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
    // Bewuchsstraenge haengen von der Unterseite herab
    var nHaenge = ri(rng, 3, 6);
    for (var hg2 = 0; hg2 < nHaenge; hg2++) {
      var hu = rr(rng, 0.45, 0.9), hv = rr(rng, -0.7, 0.7);
      var hx = hu * L, hz = hv * leafHalfWidth(hu) * W;
      var start = new THREE.Vector3(hx, leafSurface(hu, hv, L, cup) - thick, hz)
        .applyMatrix4(full);
      var laenge = rr(rng, 3, 9);
      var hp = [];
      for (var hq = 0; hq <= 6; hq++) {
        var qq2 = hq / 6;
        hp.push(new THREE.Vector3(
          start.x + Math.sin(qq2 * 2.2 + hg2) * 0.5,
          start.y - qq2 * laenge,
          start.z + Math.cos(qq2 * 1.7 + hg2) * 0.5));
      }
      geos.push(tubeGeo(hp, function (qv) { return 0.14 * (1 - qv * 0.7); }, 4,
        function (qv, ii, col) { col.setRGB(0.45, 0.56, 0.34); }));
    }

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
