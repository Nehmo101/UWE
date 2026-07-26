// Die weissen Ranken: Geflecht, Wurzelteller, Blaetter, Blattplateaus, Inseln.
import * as THREE from 'three';
import { clamp, lerp, sstep, hashi, fractal, rngOf, rr, ri, wpick } from '../core/rng.js';
import { VINE_R, WATER, COS40, groupOf } from '../core/store.js';
import { POOLS, emit, tintOf, schattenAn } from '../core/pools.js';
import { heightAt, slopeAt } from '../world/terrain.js';
import { newOcc, occFree, occAdd, KULTUR } from './objects.js';
import { mergeGeos, M, part, tubeGeo, leafHalfWidth, leafSurface, leafGeo, moundGeo,
  islandGeo } from './geometry.js';
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

/** Platzierungsregel fuer NEUE Ranken: kein Wasser, kein Steilhang.
    Wird bewusst NICHT in genRanke aufgerufen — bestehende Karten mit
    "unguenstig" liegenden Ranken muessen weiter rendern. Der Aufruf gehoert
    in pointer.js vor das Erzeugen des Elements (ranke-Zweig). */
function rankePlatzierbar(x, z) {
  if (heightAt(x, z) < WATER + 0.35) return false;   // nichts im Wasser
  if (slopeAt(x, z) < COS40) return false;           // nichts am Steilhang
  return true;
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

/* Gassenband der Plateau-Staedtchen: schmaler Streifen knapp ueber der
   Blattoberflaeche, in BLATT-Koordinaten (der Aufrufer transformiert mit der
   Plateau-Matrix). mode "u" = laengs (fix = Quer-Position v), mode "v" =
   quer (fix = Laengs-Position u). Farbe = Gassenfarbe der Viertel
   (areas.js: 0.62/0.58/0.52), leicht gekoernt ueber hashi (kein rng). */
function gassenBand(a0, a1, fix, mode, L, W, cup, halb, seed) {
  var NS = 16, pos = [], col = [], idx = [], s;
  for (s = 0; s <= NS; s++) {
    var q = a0 + (a1 - a0) * s / NS;
    var u = mode === "u" ? q : fix, v = mode === "u" ? fix : q;
    var x = u * L, z = v * leafHalfWidth(u) * W;
    var y = leafSurface(u, v, L, cup) + 0.07;   // knapp ueber der Oberflaeche
    if (mode === "u") pos.push(x, y, z - halb, x, y, z + halb);
    else pos.push(x - halb, y, z, x + halb, y, z);
    var f = 0.94 + hashi(s, mode === "u" ? 1 : 2, seed) * 0.12;
    col.push(0.62 * f, 0.58 * f, 0.52 * f, 0.62 * f, 0.58 * f, 0.52 * f);
  }
  for (s = 0; s < NS; s++) {
    var a2 = s * 2, b2 = a2 + 1, c2 = a2 + 2, d2 = a2 + 3;
    // mode "v" laeuft in +z: Umlaufsinn spiegeln, damit die Normale oben bleibt
    if (mode === "u") idx.push(a2, b2, c2, b2, d2, c2);
    else idx.push(a2, c2, b2, b2, c2, d2);
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

var _pv = new THREE.Vector3();
/** Blattmitte eines Plateaus (u=0.5, v=0) in Weltkoordinaten. */
function plateauMitte(P, out) {
  return out.set(0.5 * P.L, leafSurface(0.5, 0, P.L, P.cup), 0).applyMatrix4(P.full);
}
/** Punkt am Blattrand, der dem Ziel am naechsten liegt (Brueckenansatz). */
function plateauRandZu(P, ziel) {
  var best = new THREE.Vector3(), bd = Infinity;
  for (var s = 0; s <= 10; s++) {
    var u = 0.12 + 0.83 * s / 10;
    for (var sv = -1; sv <= 1; sv++) {
      if (sv === 0 && s < 10) continue;          // Mittelachse nur an der Spitze
      var v = sv * 0.92;
      _pv.set(u * P.L, leafSurface(u, v, P.L, P.cup), v * leafHalfWidth(u) * P.W)
        .applyMatrix4(P.full);
      var d = _pv.distanceTo(ziel);
      if (d < bd) { bd = d; best.copy(_pv); }
    }
  }
  return best;
}

function genRanke(el) {
  // Zufalls-Schluessel je Teilsystem (jeweils + el.seed):
  //   Straenge (Strangindex, 0, +501) — Ringwerte kommen aus fractal, ortsstabil
  //   Nebentriebe (Triebindex, 0, +503)
  //   Blattbueschel (Hoehenschrittindex, -1, +505), einzelne Blaetter
  //     (Hoehenschrittindex, Blattindex, +505)
  //   Wurzelteller (Bogenindex, 0, +509)
  //   Plateaus (Plateauindex, -1, +511), Staedtchen-Gebaeude (Plateauindex,
  //     Gebaeudeindex, +513) — dieselbe Systematik traegt auch die
  //     Zusatzindizes bei stadtDichte > 1 —, Zypressen (Plateauindex,
  //     Baumindex, +515)
  //   Inseln (Inselindex, 0, +517)
  //   Luftwurzeln: Anzahl (Plateauindex, -1, +519), je Strang
  //     (Plateauindex, Strangindex, +519); Pendel-Auslenkung ueber fractal
  //     mit el.seed + 521/523 (ohnehin ortsstabil)
  //   Staedtchen-Gassennetz (Plateauindex, -1, +525)
  //   Wendeltreppe (0, 0, +527)
  //   Haengebruecken (Plateauindex des unteren Plateaus, 0, +529)
  // Elementweit bleibt rGlob NUR fuer einmalige Globalwerte mit fester
  // Draw-Anzahl (Trieb-Anzahl, Bueschel-Starthoehe, Wurzelzahl und
  // -startwinkel) — die sind von Punkten und uebrigen Parametern unabhaengig
  // und koennen daher keinen Strom verschieben.
  var p = el.params, rGlob = rngOf(el.seed);
  // Rueckwaertskompatible Defaults: alte Karten ohne dicke/stil/luftwurzeln
  // rendern byteidentisch (R = VINE_R, alle Glatt-Faktoren = 1 bzw.
  // Glatt-Zweige inaktiv, Luftwurzel-Zweig inaktiv).
  var R = VINE_R * (p.dicke || 1);       // Dicke als Multiplikator auf den Bezugsradius
  var glatt = p.stil === "glatt";        // Stil: geflochten (Default) | glatt
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
  if (glatt) nStr = Math.min(nStr, 3);         // glatt: weniger Straenge (max 3)
  var strandB = glatt ? 1.8 : 1;               // glatt: dafuer breitere Straenge
  var steigungEff = p.steigung * (glatt ? 2.2 : 1); // glatt: traegere Windung
  var TURNS = H / (steigungEff * 2 * R);
  var RINGS = clamp(Math.round(TURNS * 26), 72, 240);
  var c = new THREE.Vector3(), n1 = new THREE.Vector3(), n2 = new THREE.Vector3();
  function wrapAt(tt, kk) {
    // Straenge legen sich stellenweise aneinander und laufen wieder auseinander
    var eng = 0.72 + (fractal(tt * 2.6 + kk * 3.7, 0.5, el.seed + 217) - 0.5) * 0.5;
    return R * 0.62 * (1 - 0.55 * tt) * eng;
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
      var rfAtem = 0.7 + 0.7 * fractal(t * 8.2, k * 2.3, el.seed + 149);
      // glatt: Atmung stark gedaempft (Amplitude x0.3 um die Mitte 1.05) —
      // rf faellt dann kaum noch unter die Moos-Schwelle 0.88, das Moos in
      // den Einschnuerungen wird dadurch automatisch entsprechend seltener
      if (glatt) rfAtem = 1.05 + (rfAtem - 1.05) * 0.3;
      radF.push(rfAtem);
    }
    var thick = rr(rStrang, 1.35, 1.7);      // dicker als frueher — weniger, massiver
    strandDaten.push({ pts: pts, radF: radF, thick: thick });
    geos.push((function (radFL, thickL) {
      return tubeGeo(pts, function (tt, ii) {
        // strandB: glatt-Stil verbreitert die (wenigeren) Straenge x1.8
        return R * 0.30 * lerp(1, 0.45, tt) * radFL[Math.min(ii, radFL.length - 1)] * thickL * strandB;
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
        c.x + Math.cos(ta) * (R * 0.5 + q * R * rr(rTrieb, 1.2, 2.2)),
        c.y + q * R * rr(rTrieb, 0.8, 2.0) - q * q * R * 0.9,
        c.z + Math.sin(ta) * (R * 0.5 + q * R * rr(rTrieb, 1.2, 2.2))
      ));
    }
    geos.push((function (t0L) {
      return tubeGeo(tp, function (q2) { return R * 0.06 * (1 - q2 * 0.8); },
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
    var rd = R * rr(rW, 1.6, 4.6);
    var gx = x0 + Math.cos(ra) * rd, gz = z0 + Math.sin(ra) * rd;
    var gy = heightAt(gx, gz) - 2.4;
    var attach = R * rr(rW, 0.9, 2.8);
    var bulk = rr(rW, 0.75, 1.45);
    var rp = [];
    for (i = 0; i <= 16; i++) {
      t = i / 16;
      var e = t * t * (3 - 2 * t);
      var swirl = Math.sin(t * Math.PI) * rr(rW, -0.35, 0.35);
      rp.push(new THREE.Vector3(
        lerp(gx, x0 + Math.cos(ra) * R * 0.42, e) - Math.sin(ra) * swirl * R,
        lerp(gy, y0 + attach, e) + Math.sin(t * Math.PI) * R * 0.26,
        lerp(gz, z0 + Math.sin(ra) * R * 0.42, e) + Math.cos(ra) * swirl * R
      ));
    }
    geos.push(tubeGeo(rp, function (tt) {
      return R * (0.055 + 0.21 * Math.pow(tt, 0.75)) * bulk;
    }, 7, function (tt, ii, col) { vineColor(tt * 0.1, col); }));
  }

  schattenAn(el, x0, heightAt(x0, z0), z0, R * 5.2);

  // --- Erdhügel, über den die Wurzeln laufen ---
  var mound = new THREE.Mesh(
    moundGeo(R * 4.6, R * 1.15, x0, z0, (el.seed + 61) | 0), rockMat);
  mound.position.set(x0, heightAt(x0, z0), z0);
  mound.userData.el = el;
  groupOf(el).add(mound);

  // --- Blattplateaus, spiralig um den Stamm gestaffelt ---
  var nPl = clamp(Math.round(p.plateaus), 0, 6);
  var leafGeos = [];
  var plateauDaten = [];   // fuer Erschliessung (Treppe/Bruecken), reines Sammeln
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
    var place = M(c.x + ox * R * 0.45, c.y, c.z + oz * R * 0.45, 0, -pang, 0);
    var full = new THREE.Matrix4().multiplyMatrices(place, droop);
    g.applyMatrix4(full);
    leafGeos.push(g);
    // Plateau-Daten fuer Treppe/Bruecken merken — keine Draws, keine
    // Geometrie: der Default-Pfad bleibt dadurch unveraendert.
    plateauDaten.push({ t: t, L: L, W: W, cup: cup, full: full });
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

    // --- Luftwurzeln: laengere, duennere, frei endende Straenge unter dem
    //     Plateau (Muster der Haengebewuchs-Straenge, aber Laenge 8..20 und
    //     duenner). Eigene Stroeme je (Plateauindex, Strangindex) mit +519 —
    //     rPl bleibt unangetastet, sonst wuerden die nachfolgenden
    //     Staedtchen-/Zypressen-Zaehler (nH, nCyp) verrutschen.
    //     Default luftwurzeln=false ⇒ Zweig inaktiv, alte Karten unveraendert.
    if (p.luftwurzeln) {
      var nLw = ri(ortsRng(k, -1, el.seed + 519), 2, 4);
      for (var lw = 0; lw < nLw; lw++) {
        var rLw = ortsRng(k, lw, el.seed + 519);
        var lu = rr(rLw, 0.35, 0.9), lv = rr(rLw, -0.7, 0.7);
        var lStart = new THREE.Vector3(lu * L,
          leafSurface(lu, lv, L, cup) - thick, lv * leafHalfWidth(lu) * W)
          .applyMatrix4(full);
        var lLen = rr(rLw, 8, 20), lPhase = rr(rLw, 0, 6.283);
        var lp = [];
        for (var lq = 0; lq <= 10; lq++) {
          var lqq = lq / 10;
          // leicht pendelnd: fractal-Auslenkung waechst zum freien Ende hin
          lp.push(new THREE.Vector3(
            lStart.x + (fractal(lqq * 1.6 + lPhase, k * 1.3 + lw * 2.7, el.seed + 521) - 0.5) * 2.4 * lqq,
            lStart.y - lqq * lLen,
            lStart.z + (fractal(k * 1.3 + lw * 2.7, lqq * 1.6 + lPhase, el.seed + 523) - 0.5) * 2.4 * lqq));
        }
        geos.push(tubeGeo(lp, function (qv) { return 0.09 * (1 - qv * 0.85); }, 4,
          function (qv, ii, col) { vineColor(0.15, col); }));
      }
    }

    if (!p.staedtchen) continue;
    // Gebaeude/Zypressen je (Plateau, Index) — die occ-Pruefung bleibt
    // sequentiell in Schleifenreihenfolge und damit deterministisch.
    var occ2 = newOcc(4);
    // Baustil: stadtStil "" (Default "klassisch kompakt") nimmt WOERTLICH den
    // alten Zweig (hartkodierte Tabelle, fester occ-Radius 2.5, kein
    // Gassennetz) — alte Karten bleiben byteidentisch. Ein gesetzter Stil
    // zieht die Gewichtstabelle aus KULTUR (objects.js); deren Pools
    // (scheune, windmuehle, zwergenhalle …) haben deutlich groessere
    // Grundflaechen, darum kommt der Belegungsradius dann aus
    // POOLS[kind].radius (x0.85 wie in genObjekt) statt der Pauschale.
    var stilTab = (p.stadtStil && KULTUR[p.stadtStil]) ? KULTUR[p.stadtStil] : null;

    // --- Gassennetz: nur grosse Plateaus (L > 30) und nur mit gesetztem
    //     Stil; Schluessel (k, -1, +525). 1 Hauptachse laengs (v=0) plus
    //     1–2 Queraeste. Gebaut als duenne Baender knapp ueber der
    //     Blattoberflaeche — robuster als das Umfaerben der leafGeo-Vertices,
    //     deren 16x12-Raster (Zellen ~L/16 ≈ 2–5 Einheiten) schmale Gassen
    //     gar nicht aufloesen koennte. Kein districtStreets: das arbeitet in
    //     Weltkoordinaten-Polygonen und laesst sich nicht auf gewoelbte
    //     Blattkoordinaten verpflanzen.
    var gassenSpuren = null;
    if (stilTab && L > 30) {
      var rGa = ortsRng(k, -1, el.seed + 525);
      gassenSpuren = [[0.16, 0.90, 0, "u"]];       // Hauptachse laengs
      var nQu = ri(rGa, 1, 2);
      for (var gq = 0; gq < nQu; gq++) {
        gassenSpuren.push([-0.55, 0.55, rr(rGa, 0.3, 0.75), "v"]);
      }
      for (var gi = 0; gi < gassenSpuren.length; gi++) {
        var spu = gassenSpuren[gi];
        var bg = gassenBand(spu[0], spu[1], spu[2], spu[3], L, W, cup,
          spu[3] === "u" ? 0.75 : 0.6, (el.seed + k * 13 + gi) | 0);
        bg.applyMatrix4(full);
        geos.push(bg);
        // occ-Eintrag je Gassensample: Gebaeude ruecken vom Band ab
        for (var gs = 0; gs <= 12; gs++) {
          var gqq = spu[0] + (spu[1] - spu[0]) * gs / 12;
          var gu = spu[3] === "u" ? gqq : spu[2];
          var gv = spu[3] === "u" ? spu[2] : gqq;
          _lv.set(gu * L, leafSurface(gu, gv, L, cup), gv * leafHalfWidth(gu) * W)
            .applyMatrix4(full);
          occAdd(occ2, _lv.x, _lv.z, 1.3);
        }
      }
    }

    // Gebaeudeanzahl: die Basis kommt wie bisher aus dem rPl-Strom — der
    // ri-Draw passiert IMMER (auch bei stadtDichte 0), sonst verrutschte der
    // nachfolgende nCyp-Draw. Skaliert wird nur das Produkt: Default 1 =>
    // Math.round(n * 1) === n, exakt die alte Anzahl; 0 => keine Gebaeude,
    // die Zypressen bleiben.
    var dichteSt = p.stadtDichte === undefined ? 1 : p.stadtDichte;
    var nH = Math.round(ri(rPl, 5, 18) * dichteSt);
    for (i = 0; i < nH; i++) {
      var rH = ortsRng(k, i, el.seed + 513);
      var u = rr(rH, 0.22, 0.86), v = rr(rH, -0.72, 0.72);
      _lv.set(u * L, leafSurface(u, v, L, cup), v * leafHalfWidth(u) * W).applyMatrix4(full);
      if (stilTab) {
        // Stil-Zweig: erst Gassen meiden (u/v-Abstandstest), dann Typ ziehen
        // (der Radius haengt am Pool), dann occ pruefen. Der vom Default
        // abweichende Draw-Ablauf ist unkritisch: jedes Gebaeude wuerfelt
        // aus seinem eigenen (k, i, +513)-Strom.
        var aufGasse = false;
        if (gassenSpuren) {
          for (var gj = 0; gj < gassenSpuren.length && !aufGasse; gj++) {
            var spg = gassenSpuren[gj];
            if (spg[3] === "u") {
              aufGasse = u >= spg[0] - 0.03 && u <= spg[1] + 0.03 &&
                Math.abs((v - spg[2]) * leafHalfWidth(u) * W) < 1.9;
            } else {
              aufGasse = v >= spg[0] - 0.05 && v <= spg[1] + 0.05 &&
                Math.abs((u - spg[2]) * L) < 1.8;
            }
          }
        }
        if (aufGasse) continue;
        var kindS = wpick(rH, stilTab);
        var radS = (POOLS[kindS] ? POOLS[kindS].radius : 2.9) * 0.85;
        if (!occFree(occ2, _lv.x, _lv.z, radS)) continue;
        occAdd(occ2, _lv.x, _lv.z, radS);
        var scS = rr(rH, 0.65, 0.95);
        emit(el, kindS, _lv.x, _lv.y - 0.1, _lv.z, -pang + rr(rH, -0.25, 0.25),
          scS, scS * rr(rH, 0.9, 1.25), scS, tintOf(rH));
      } else {
        if (!occFree(occ2, _lv.x, _lv.z, 2.5)) continue;
        occAdd(occ2, _lv.x, _lv.z, 2.5);
        var kind = wpick(rH, [["haus", 6], ["haus2", 4], ["turm", 2], ["kuppel", 2], ["arkade", 1]]);
        var sc = rr(rH, 0.65, 0.95);
        emit(el, kind, _lv.x, _lv.y - 0.1, _lv.z, -pang + rr(rH, -0.25, 0.25),
          sc, sc * rr(rH, 0.9, 1.25), sc, tintOf(rH));
      }
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

  // --- Wendeltreppe (p.treppe, Default false => Zweig inaktiv): schmales
  //     Stufenband am Aussenrand des Geflechts, von Bodennaehe bis zum
  //     untersten Plateau (ohne Plateaus bis H * 0.8). Verlaeuft auf der
  //     vorhandenen Achsen-/Frame-Logik mit Radius R*0.75 + Strang-
  //     Grundradius R*0.30. Schluessel (0, 0, +527) nur fuer den
  //     Startwinkel — der Verlauf selbst ist deterministisch.
  //     Reine Geometrie im Ranken-Mesh, keine Instanzen. Budget: je Stufe
  //     eine Box (12 Dreiecke) alle ~0.9 Bogeneinheiten bei ~28 Grad
  //     Steigung (Anstieg 0.42/Stufe); bei H=400 und Plateau bei t~0.34
  //     sind das ~320 Stufen ≈ 3.9k Dreiecke, plus Handlauf-Tube
  //     (~160 Punkte x 4-seitig ≈ 1.3k) — vertretbar.
  if (p.treppe) {
    var rT = ortsRng(0, 0, el.seed + 527);
    var tZiel = 0.8;
    for (k = 0; k < plateauDaten.length; k++) {
      tZiel = k === 0 ? plateauDaten[k].t : Math.min(tZiel, plateauDaten[k].t);
    }
    var rTr = R * 0.75 + R * 0.30;
    var yTr = heightAt(x0, z0) + 0.3, yEnd = y0 + tZiel * H;
    var thTr = rr(rT, 0, 6.283);
    var dTh = 0.795 / rTr;              // horizontaler Bogen je Stufe (ds=0.9)
    var stufeGeo = new THREE.BoxGeometry(1.2, 0.18, 0.5);
    var cSt = new THREE.Color();
    var lauf = [], nSt = 0;
    while (yTr < yEnd && nSt < 1600) {
      var tTr = clamp((yTr - y0) / H, 0, 1);
      frameAt(axis, tTr, c, n1, n2);
      var dxT = n1.x * Math.cos(thTr) + n2.x * Math.sin(thTr);
      var dzT = n1.z * Math.cos(thTr) + n2.z * Math.sin(thTr);
      var dlT = Math.sqrt(dxT * dxT + dzT * dzT) || 1;
      dxT /= dlT; dzT /= dlT;
      // heller Holz-/Steinton (KULTUR-Neutral), leicht gekoernt ueber hashi
      cSt.setHex(0xcfc0a2).multiplyScalar(0.94 + hashi(nSt, 7, el.seed + 527) * 0.1);
      geos.push(part(stufeGeo,
        M(c.x + dxT * rTr, yTr, c.z + dzT * rTr, 0, Math.atan2(-dzT, dxT), 0),
        cSt.getHex()));
      // Handlauf-Stuetzpunkte auf der Aussenseite, jede zweite Stufe
      if (nSt % 2 === 0) {
        lauf.push(new THREE.Vector3(
          c.x + dxT * (rTr + 0.58), yTr + 0.95, c.z + dzT * (rTr + 0.58)));
      }
      yTr += 0.42; thTr += dTh; nSt++;
    }
    if (lauf.length > 1) {
      geos.push(tubeGeo(lauf, function () { return 0.05; }, 4,
        function (qv, ii, col) { col.setRGB(0.78, 0.72, 0.6); }));
    }
  }

  // --- Haengebruecken (p.bruecken, Default false => Zweig inaktiv):
  //     verbinden aufeinanderfolgende Plateaus DERSELBEN Ranke (k -> k+1),
  //     wenn ihr 3D-Abstand < 55 ist. Schluessel (k, 0, +529).
  //     Bruecken zwischen VERSCHIEDENEN Ranken bleiben bewusst weg: jedes
  //     Element generiert isoliert und kennt die Plateaus anderer Elemente
  //     nicht — aus genRanke heraus gibt es schlicht keine Ansatzpunkte.
  //     Geometrie je Bruecke: Planken-Boxen alle ~0.75 (Spannweite < 55 =>
  //     max ~74 Planken ≈ 890 Dreiecke) + 2 Tragseil-Tubes (Radius 0.04,
  //     4-seitig, 24 Segmente ≈ 380 Dreiecke) — Kettenlinie angenaehert
  //     ueber quadratische Absenkung, Durchhang 8 % der Spannweite.
  if (p.bruecken && plateauDaten.length > 1) {
    var plankGeo = new THREE.BoxGeometry(1.1, 0.07, 0.42);
    var cPl = new THREE.Color();
    var _ba = new THREE.Vector3(), _bb = new THREE.Vector3();
    for (k = 0; k + 1 < plateauDaten.length; k++) {
      plateauMitte(plateauDaten[k], _ba);
      plateauMitte(plateauDaten[k + 1], _bb);
      if (_ba.distanceTo(_bb) >= 55) continue;
      var rBr = ortsRng(k, 0, el.seed + 529);
      // Ansatzpunkte am Blattrand Richtung Nachbar
      var pA = plateauRandZu(plateauDaten[k], _bb);
      var pB = plateauRandZu(plateauDaten[k + 1], _ba);
      var hxB = pB.x - pA.x, hzB = pB.z - pA.z;
      var hlB = Math.sqrt(hxB * hxB + hzB * hzB);
      if (hlB < 4) continue;             // Plateaus fast uebereinander: keine Bruecke
      var spann = pA.distanceTo(pB);
      var sagB = spann * 0.08;
      var yawB = Math.atan2(hxB, hzB);
      var holzTon = rr(rBr, 0.88, 1.04);
      var nPlk = Math.max(6, Math.round(spann / 0.75));
      for (i = 0; i <= nPlk; i++) {
        var sB = i / nPlk;
        cPl.setHex(0xb9a582)
          .multiplyScalar(holzTon * (0.93 + hashi(i, k, el.seed + 529) * 0.12));
        geos.push(part(plankGeo, M(
          pA.x + hxB * sB,
          lerp(pA.y, pB.y, sB) - sagB * 4 * sB * (1 - sB),
          pA.z + hzB * sB, 0, yawB, 0), cPl.getHex()));
      }
      // zwei Tragseile seitlich, leicht ueber Plankenhoehe
      var qxB = -hzB / hlB, qzB = hxB / hlB;
      for (var seite = -1; seite <= 1; seite += 2) {
        var seil = [];
        for (i = 0; i <= 24; i++) {
          var sS = i / 24;
          seil.push(new THREE.Vector3(
            pA.x + hxB * sS + qxB * 0.5 * seite,
            lerp(pA.y, pB.y, sS) - sagB * 4 * sS * (1 - sS) + 0.55,
            pA.z + hzB * sS + qzB * 0.5 * seite));
        }
        geos.push(tubeGeo(seil, function () { return 0.04; }, 4,
          function (qv, ii, col) { col.setRGB(0.36, 0.31, 0.26); }));
      }
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
    var ia = rr(rI, 0, 6.283), idst = R * rr(rI, 2.6, 7);
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


export { vineColor, genRanke, rankePlatzierbar };
