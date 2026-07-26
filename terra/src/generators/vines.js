// Die weissen Ranken: Geflecht, Wurzelteller, Blaetter, Blattplateaus, Inseln.
import * as THREE from 'three';
import { clamp, lerp, sstep, hashi, fractal, rngOf, rr, ri, wpick } from '../core/rng.js';
import { VINE_R, groupOf } from '../core/store.js';
import { emit, tintOf, schattenAn } from '../core/pools.js';
import { heightAt } from '../world/terrain.js';
import { newOcc, occFree, occAdd } from './objects.js';
import { mergeGeos, M, tubeGeo, leafHalfWidth, leafSurface, leafGeo, moundGeo, islandGeo }
  from './geometry.js';
import { vineMat, leafMat, rockMat } from '../render/materials.js';

/* Ortsstabiler Zufallsstrom: bindet alle Draws EINES Teilsystem-Bausteins
   (Strang, Blatt, Wurzel, Plateau, Gebaeude, Insel) an dessen stabilen Index
   statt an die Zugriffsreihenfolge — sonst wuerde z. B. eine geaenderte
   Plateau-Anzahl saemtliche nachgelagerten Teilsysteme umwuerfeln. */
function ortsRng(a, b, s) { return rngOf((hashi(a, b, s) * 4294967296) | 0); }

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
  // Zufalls-Schluessel je Teilsystem (jeweils + el.seed):
  //   Straenge (Strangindex, 0, +501) — Ringwerte kommen aus fractal, ortsstabil
  //   Nebentriebe (Triebindex, 0, +503)
  //   Blattbueschel (Hoehenschrittindex, -1, +505), einzelne Blaetter
  //     (Hoehenschrittindex, Blattindex, +505)
  //   Wurzelteller (Bogenindex, 0, +509)
  //   Plateaus (Plateauindex, -1, +511), Staedtchen-Gebaeude (Plateauindex,
  //     Gebaeudeindex, +513), Zypressen (Plateauindex, Baumindex, +515)
  //   Inseln (Inselindex, 0, +517)
  // Elementweit bleibt rGlob NUR fuer einmalige Globalwerte mit fester
  // Draw-Anzahl (Trieb-Anzahl, Bueschel-Starthoehe, Wurzelzahl und
  // -startwinkel) — die sind von Punkten und uebrigen Parametern unabhaengig
  // und koennen daher keinen Strom verschieben.
  var p = el.params, rGlob = rngOf(el.seed);
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
    var rStrang = ortsRng(k, 0, el.seed + 501);
    var a0 = k / nStr * Math.PI * 2 + rr(rStrang, -0.2, 0.2);
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
    var thick = rr(rStrang, 1.35, 1.7);      // dicker als frueher — weniger, massiver
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
  var nTrieb = ri(rGlob, 2, 4);
  for (k = 0; k < nTrieb; k++) {
    var rTrieb = ortsRng(k, 0, el.seed + 503);
    var tt0 = rr(rTrieb, 0.25, 0.85);
    frameAt(axis, tt0, c, n1, n2);
    var ta = rr(rTrieb, 0, 6.283);
    var tp = [];
    for (i = 0; i <= 10; i++) {
      var q = i / 10;
      tp.push(new THREE.Vector3(
        c.x + Math.cos(ta) * (VINE_R * 0.5 + q * VINE_R * rr(rTrieb, 1.2, 2.2)),
        c.y + q * VINE_R * rr(rTrieb, 0.8, 2.0) - q * q * VINE_R * 0.9,
        c.z + Math.sin(ta) * (VINE_R * 0.5 + q * VINE_R * rr(rTrieb, 1.2, 2.2))
      ));
    }
    geos.push((function (t0L) {
      return tubeGeo(tp, function (q2) { return VINE_R * 0.06 * (1 - q2 * 0.8); },
        5, function (q2, ii, col) { vineColor(t0L, col); });
    })(tt0));
  }

  // --- Grosse Blaetter in Buescheln entlang der Straenge -------------------
  // Die Starthoehe ist ein Globalwert (rGlob), jeder Hoehenschritt danach
  // wuerfelt aus seinem eigenen Strom — die Kette der Schrittweiten bleibt
  // sequentiell ueber den Schrittindex, der selbst stabil ist.
  var blattT = 0.06 + rGlob() * 0.05;
  var schritt = 0;
  while (blattT < 0.96) {
    var rB = ortsRng(schritt, -1, el.seed + 505);
    var hauptStrang = strandDaten[Math.floor(rB() * strandDaten.length)];
    var si = Math.floor(blattT * RINGS);
    var sp = hauptStrang.pts[Math.min(si, hauptStrang.pts.length - 1)];
    frameAt(axis, blattT, c, n1, n2);
    var buendel = ri(rB, 3, 7);
    for (i = 0; i < buendel; i++) {
      var rBl = ortsRng(schritt, i, el.seed + 505);
      var ba = Math.atan2(sp.z - c.z, sp.x - c.x) + rr(rBl, -1.1, 1.1);
      var groesse = rr(rBl, 4, 10.5) * (1 - blattT * 0.5) * (p.blattgroesse || 1);
      emit(el, "rankenblatt",
        sp.x + Math.cos(ba) * 0.4, sp.y + rr(rBl, -1.2, 1.2), sp.z + Math.sin(ba) * 0.4,
        -ba + rr(rBl, -0.4, 0.4),
        groesse, groesse * rr(rBl, 0.5, 0.7), groesse,
        [0.97, 1.0, 0.86], rr(rBl, -0.15, 0.15), rr(rBl, -0.7, -0.1));
    }
    // groessere blattfreie Abschnitte zwischen den Buescheln
    blattT += rr(rB, 0.07, 0.17);
    schritt++;
  }

  // --- Wurzelteller: ungleichmaessig um den Fuss verteilt, flacher, laenger
  var nRoot = ri(rGlob, 10, 14);
  var wStart = rr(rGlob, 0, 6.283);
  for (k = 0; k < nRoot; k++) {
    var rW = ortsRng(k, 0, el.seed + 509);
    var ra = wStart + Math.pow(k / nRoot, rr(rW, 0.7, 1.4)) * Math.PI * 2 + rr(rW, -0.3, 0.3);
    var rd = VINE_R * rr(rW, 1.6, 4.6);
    var gx = x0 + Math.cos(ra) * rd, gz = z0 + Math.sin(ra) * rd;
    var gy = heightAt(gx, gz) - 2.4;
    var attach = VINE_R * rr(rW, 0.9, 2.8);
    var bulk = rr(rW, 0.75, 1.45);
    var rp = [];
    for (i = 0; i <= 16; i++) {
      t = i / 16;
      var e = t * t * (3 - 2 * t);
      var swirl = Math.sin(t * Math.PI) * rr(rW, -0.35, 0.35);
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
    // Je Plateau ein eigener Strom: eine geaenderte Plateau-Anzahl laesst die
    // Auswuerfelung der uebrigen Plateaus (samt Staedtchen) unangetastet.
    // Die Hoehenformel fr haengt weiterhin deterministisch an nPl — die
    // Plateaus RUTSCHEN also bei Anzahlaenderung, wuerfeln aber nicht um.
    var rPl = ortsRng(k, -1, el.seed + 511);
    var fr = nPl > 1 ? k / (nPl - 1) : 0.45;
    t = clamp(0.34 + fr * 0.54 + rr(rPl, -0.025, 0.025), 0.1, 0.96);
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
    var nHaenge = ri(rPl, 3, 6);
    for (var hg2 = 0; hg2 < nHaenge; hg2++) {
      var hu = rr(rPl, 0.45, 0.9), hv = rr(rPl, -0.7, 0.7);
      var hx = hu * L, hz = hv * leafHalfWidth(hu) * W;
      var start = new THREE.Vector3(hx, leafSurface(hu, hv, L, cup) - thick, hz)
        .applyMatrix4(full);
      var laenge = rr(rPl, 3, 9);
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
    // Gebaeude/Zypressen je (Plateau, Index) — die occ-Pruefung bleibt
    // sequentiell in Schleifenreihenfolge und damit deterministisch.
    var occ2 = newOcc(4);
    var nH = ri(rPl, 5, 18);
    for (i = 0; i < nH; i++) {
      var rH = ortsRng(k, i, el.seed + 513);
      var u = rr(rH, 0.22, 0.86), v = rr(rH, -0.72, 0.72);
      _lv.set(u * L, leafSurface(u, v, L, cup), v * leafHalfWidth(u) * W).applyMatrix4(full);
      if (!occFree(occ2, _lv.x, _lv.z, 2.5)) continue;
      occAdd(occ2, _lv.x, _lv.z, 2.5);
      var kind = wpick(rH, [["haus", 6], ["haus2", 4], ["turm", 2], ["kuppel", 2], ["arkade", 1]]);
      var sc = rr(rH, 0.65, 0.95);
      emit(el, kind, _lv.x, _lv.y - 0.1, _lv.z, -pang + rr(rH, -0.25, 0.25),
        sc, sc * rr(rH, 0.9, 1.25), sc, tintOf(rH));
    }
    var nCyp = ri(rPl, 4, 9);
    for (i = 0; i < nCyp; i++) {
      var rZ = ortsRng(k, i, el.seed + 515);
      var u2 = rr(rZ, 0.3, 0.92), v2 = (rZ() < 0.5 ? -1 : 1) * rr(rZ, 0.78, 0.92);
      _lv.set(u2 * L, leafSurface(u2, v2, L, cup), v2 * leafHalfWidth(u2) * W).applyMatrix4(full);
      var sc2 = rr(rZ, 0.45, 0.8);
      emit(el, "zypresse", _lv.x, _lv.y - 0.1, _lv.z, rZ() * 6.28,
        sc2, sc2 * rr(rZ, 0.9, 1.3), sc2, tintOf(rZ, 0.08));
    }
  }

  // Ranken-Mesh erst NACH der Plateau-Schleife bauen, damit die
  // herabhaengenden Bewuchsstraenge (geos.push in der Schleife) mitkommen.
  var vineMesh = new THREE.Mesh(mergeGeos(geos), vineMat);
  vineMesh.userData.el = el;
  vineMesh.renderOrder = 2;
  groupOf(el).add(vineMesh);

  if (leafGeos.length) {
    var lm = new THREE.Mesh(mergeGeos(leafGeos), leafMat);
    lm.userData.el = el;
    groupOf(el).add(lm);
  }

  // --- Schwebeinseln ---
  var nIsl = clamp(Math.round(p.inseln), 0, 4);
  var islGeos = [];
  for (k = 0; k < nIsl; k++) {
    // Ein Strom je Insel (Baeume laufen sequentiell mit — sie gehoeren zur
    // Insel und wuerfeln nur zusammen mit ihr um).
    var rI = ortsRng(k, 0, el.seed + 517);
    t = rr(rI, 0.25, 0.95);
    frameAt(axis, t, c, n1, n2);
    var ia = rr(rI, 0, 6.283), idst = VINE_R * rr(rI, 2.6, 7);
    var ix = c.x + Math.cos(ia) * idst, iy = c.y + rr(rI, -H * 0.05, H * 0.05),
        iz = c.z + Math.sin(ia) * idst;
    var ir = rr(rI, 3.5, 8);
    var ig = islandGeo(ir, (el.seed + k * 77) | 0);
    ig.applyMatrix4(M(ix, iy, iz, 0, rr(rI, 0, 6.283), 0));
    islGeos.push(ig);
    var nT = ri(rI, 0, 3);
    for (i = 0; i < nT; i++) {
      var ta = rI() * 6.283, tq = Math.sqrt(rI()) * ir * 0.5;
      var sc3 = rr(rI, 0.3, 0.6);
      emit(el, rI() < 0.6 ? "baum" : "zypresse",
        ix + Math.cos(ta) * tq, iy + ir * 0.28, iz + Math.sin(ta) * tq,
        rI() * 6.28, sc3, sc3, sc3, tintOf(rI, 0.08));
    }
  }
  if (islGeos.length) {
    var im = new THREE.Mesh(mergeGeos(islGeos), rockMat);
    im.userData.el = el;
    groupOf(el).add(im);
  }
}


export { vineColor, genRanke };
