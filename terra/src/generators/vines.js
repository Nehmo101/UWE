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

/* ===== H4: Formhelfer der Mittelachse ====================================
   Zugpunkte (H4.2) und Kernneigung (H4.3) verschieben die Achse horizontal.
   Alle Helfer sind rein und ziehen KEINEN Zufall — sie lesen nur el.params
   bzw. ihre Argumente. Fehlen `zugpunkte` und `kernzug`, liefern sie exakt
   Nullauslenkung, und der Achsenbau ueberspringt die Addition ganz (er
   addiert also nicht einmal 0) — der Bestandsverlauf bleibt Bit fuer Bit.

   Datenmodell (RELATIV, bewusst nicht absolut): el.params.zugpunkte =
   [{ h, dx, dz }, ...] mit h = 0..1 relative Hoehe und dx/dz = horizontale
   Auslenkung in Welteinheiten GEGENUEBER DEM FUSS. Begruendung: Fuss und
   Hoehe sind bereits Elementdaten (points[0], params.hoehe). Absolute
   Punkte muessten beim Verschieben des Fussgriffs und bei jeder
   Hoehenaenderung nachgerechnet werden — relativ wandert die gezogene Form
   automatisch mit, und ein Zugpunkt kann nie "neben" der Ranke haengen
   bleiben. Das Feld ist optional; fehlt es, ist die Achse die bisherige. */

/** Bereinigte, nach Hoehe sortierte Kopie von el.params.zugpunkte.
 *  io.js prueft params nur grob (Objekt ja/nein), deshalb wird hier
 *  vollstaendig gefiltert: nicht endliche Werte fliegen raus, h wird auf
 *  0..1 geklemmt, und Punkte, die weniger als 1e-4 auseinanderliegen,
 *  fallen weg (sonst wird die Hermite-Steigung unendlich). */
function zugpunkteVon(el) {
  var roh = el.params && el.params.zugpunkte;
  if (!roh || !roh.length) return [];
  var list = [], i, z;
  for (i = 0; i < roh.length; i++) {
    z = roh[i];
    if (!z || !Number.isFinite(z.h) || !Number.isFinite(z.dx) || !Number.isFinite(z.dz)) continue;
    list.push({ h: clamp(z.h, 0, 1), dx: z.dx, dz: z.dz });
  }
  list.sort(function (a, b) { return a.h - b.h; });
  var out = [];
  for (i = 0; i < list.length; i++) {
    if (out.length && list[i].h - out[out.length - 1].h < 1e-4) continue;
    out.push(list[i]);
  }
  return out;
}

/** Stuetzstellen der Zugkurve: Fuss (0,0,0) -> Zugpunkte -> Spitze.
 *  Die Spitze erbt die Auslenkung des obersten Zugpunkts — oberhalb des
 *  letzten Zugs waechst die Ranke in der eingeschlagenen Richtung weiter,
 *  statt zur Senkrechten zurueckgerissen zu werden (das saehe nach Gummiband
 *  aus, nicht nach Wuchs). */
function zugStuetzen(zp) {
  var st = [{ h: 0, dx: 0, dz: 0 }];
  for (var i = 0; i < zp.length; i++) if (zp[i].h > 1e-4) st.push(zp[i]);
  var top = st[st.length - 1];
  if (top.h < 1 - 1e-4) st.push({ h: 1, dx: top.dx, dz: top.dz });
  return st;
}

/** Horizontale Zug-Auslenkung an relativer Hoehe t.
 *  CatmullRom in NICHT-uniformer Parametrisierung, geschrieben als kubische
 *  Hermite mit zentralen Differenzen: die Kurve laeuft exakt durch jeden
 *  Zugpunkt und bleibt an den Stuetzstellen knickfrei (C1), auch wenn die
 *  Punkte sehr ungleich ueber die Hoehe verteilt sind. THREE.CatmullRomCurve3
 *  taugt hier nicht: dessen getPoint(t) parametrisiert ueber den
 *  Stuetzpunkt-INDEX, nicht ueber die Hoehe — zwei eng benachbarte Zugpunkte
 *  wuerden damit die halbe Ranke beanspruchen. */
function zugAuslenkung(st, t, out) {
  out.x = 0; out.z = 0;
  if (st.length < 2) return out;
  var n = st.length, j = 0;
  while (j < n - 2 && t > st[j + 1].h) j++;
  var a = st[j], b = st[j + 1], d = b.h - a.h;
  if (d <= 0) { out.x = b.dx; out.z = b.dz; return out; }
  var s = clamp((t - a.h) / d, 0, 1);
  var p0 = st[j - 1] || a, p3 = st[j + 2] || b;
  var d0 = b.h - p0.h, d3 = p3.h - a.h;
  var mAx = d0 > 0 ? (b.dx - p0.dx) / d0 : 0, mAz = d0 > 0 ? (b.dz - p0.dz) / d0 : 0;
  var mBx = d3 > 0 ? (p3.dx - a.dx) / d3 : 0, mBz = d3 > 0 ? (p3.dz - a.dz) / d3 : 0;
  var s2 = s * s, s3 = s2 * s;
  var h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s,
      h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  out.x = h00 * a.dx + h10 * d * mAx + h01 * b.dx + h11 * d * mBx;
  out.z = h00 * a.dz + h10 * d * mAz + h01 * b.dz + h11 * d * mBz;
  return out;
}

/** Kernneigung (H4.3). KANON: Terra ist der zerbissene Apfel, Arbor der
 *  Apfelkern — die Triebe wachsen nicht parallel in den Himmel, sondern
 *  laufen zur Mitte zusammen. Der Kernpunkt ist die Kartenmitte (0,0), die
 *  Hoehe bleibt unbeschraenkt (der Kern liegt erzaehlerisch weit ueber der
 *  Karte, ein Zielpunkt in endlicher Hoehe wuerde die Ranken zum Umkippen
 *  zwingen).
 *  Die Auslenkung waechst QUADRATISCH mit der Hoehe: linear ergaebe eine
 *  konstante Neigung, die Ranke stuende schon in der ersten Ringlage schief
 *  im Erdhuegel und der Wurzelteller passte nicht mehr dazu. Mit t² tritt
 *  sie senkrecht aus dem Boden und biegt erst mit der Hoehe ab (Tangente am
 *  Wipfel = 2·kernzug·Abstand) — das ist der Wuchs eines Astes, der dem Kern
 *  nachwaechst, statt einer umgelegten Stange. */
function kernAuslenkung(kernzug, bx, bz, t, out) {
  var f = kernzug * t * t;
  out.x = -bx * f; out.z = -bz * f;   // proportional zum Abstand Fuss<->Kern
  return out;
}

var _zo = { x: 0, z: 0 }, _ko = { x: 0, z: 0 };

/** Stuetzstellen der Zugkurve eines Elements (Bequemlichkeit fuer den Editor). */
function rankeStuetzen(el) { return zugStuetzen(zugpunkteVon(el)); }

/** Punkt der Sollachse OHNE das fraktale Rauschen: Fuss + Kernneigung + Zug.
 *  Daran haengen die Zugpunkt-Griffe und die Trefferpruefung des
 *  Klickstrahls (selection.js) — genRanke setzt dieselben Helfer ein, die
 *  Griffe sitzen also garantiert auf der Ranke. `st` darf vorberechnet
 *  uebergeben werden (Trefferpruefung sampelt die Achse vielfach). */
function rankeAchse(el, t, out, st) {
  out = out || { x: 0, y: 0, z: 0 };
  var pt = el.points && el.points[0];
  if (!pt) { out.x = 0; out.y = 0; out.z = 0; return out; }
  var p = el.params || {};
  kernAuslenkung(p.kernzug || 0, pt.x, pt.z, t, _ko);
  zugAuslenkung(st || rankeStuetzen(el), t, _zo);
  out.x = pt.x + _ko.x + _zo.x;
  out.z = pt.z + _ko.z + _zo.z;
  out.y = heightAt(pt.x, pt.z) - 2.6 + t * (p.hoehe || 0);
  return out;
}

/** Wie rankeAchse, aber OHNE den Zuganteil — Bezugspunkt, gegen den ein
 *  gezogener Griff sein neues dx/dz misst. */
function rankeKernPunkt(el, t, out) {
  out = out || { x: 0, y: 0, z: 0 };
  var pt = el.points && el.points[0];
  if (!pt) { out.x = 0; out.y = 0; out.z = 0; return out; }
  var p = el.params || {};
  kernAuslenkung(p.kernzug || 0, pt.x, pt.z, t, _ko);
  out.x = pt.x + _ko.x;
  out.z = pt.z + _ko.z;
  out.y = heightAt(pt.x, pt.z) - 2.6 + t * (p.hoehe || 0);
  return out;
}

function genRanke(el) {
  // Zufalls-Schluessel je Teilsystem (jeweils + el.seed):
  //   Straenge (Strangindex, Fussindex, +501) — Ringwerte kommen aus fractal,
  //     ortsstabil; der zweite Schluesselplatz traegt seit H4.4 den Fussindex
  //     (0 = der bisherige Hauptast, darum unveraendert)
  //   Nebentriebe (Triebindex, 0, +503)
  //   Blattbueschel (Hoehenschrittindex, -1, +505), einzelne Blaetter
  //     (Hoehenschrittindex, Blattindex, +505)
  //   Wurzelteller (Bogenindex, Fussindex, +509); Anzahl/Startwinkel der
  //     ZUSATZ-Fuesse (Fussindex, -1, +509) — Fuss 0 zieht beides wie bisher
  //     aus rGlob
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
  // NEU in H4.4 (bis +531 war vergeben):
  //   Achsenrauschen der ZUSATZ-Aeste: fractal-Seeds el.seed + 533 + (fi%33)*2
  //     und +1 darauf, also der reservierte Block +533..+599 (Fuss 0 behaelt
  //     +3/+9). Ab dem 34. Fuss wiederholt sich das Rauschmuster (Modulo),
  //     statt in den naechsten Block zu laufen.
  //   Blattbueschel der Zusatz-Aeste: Starthoehe (Fussindex, -2, +601),
  //     Bueschel (Fussindex*4096 + Schrittindex, -1, +601), einzelne Blaetter
  //     (Fussindex*4096 + Schrittindex, Blattindex, +601) — dieselbe
  //     Systematik wie +505 am Hauptast
  //   Verwachsungsknoten: Anzahlen (0, 0, +605), Rindenfalten
  //     (Faltenindex, 2, +605), Moospolster (Moosindex, 3, +605)
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

  /* --- H4.4: mehrere Fusspunkte ------------------------------------------
     el.points darf 1..n Punkte tragen (wie ein Pfad). Aus jedem Fuss waechst
     ein eigenes Strangbuendel mit eigener Achse; ab `vereinigung` laufen alle
     Achsen auf die gemeinsame Achse ueber dem Schwerpunkt zu, und der Radius
     des Hauptbuendels waechst FLAECHENRICHTIG mit: r = sqrt(Σ r_i²). Da alle
     Aeste dieselbe Elementdicke tragen (r_i = R), ist das r = R·sqrt(n).
     Radien zu addieren waere falsch — die Ranke wuerde unfoermig fett. */
  var fuesse = el.points, nF = fuesse.length;
  var tVer = clamp(p.vereinigung === undefined ? 0.35 : p.vereinigung, 0.15, 0.8);
  var tVerEnd = Math.min(0.99, tVer + 0.18);   // Ende der Verschmelzungsrampe
  // sstep ist an beiden Kanten ableitungsfrei -> die Aeste biegen weich ein,
  // es entsteht kein Knick. Bei einem einzigen Fuss ist die Rampe konstant 0.
  function verSchmelz(tt) { return nF > 1 ? sstep(tVer, tVerEnd, tt) : 0; }
  var rSkalaOben = Math.sqrt(nF);
  function radSkala(tt) { return lerp(1, rSkalaOben, verSchmelz(tt)); }
  var zx = x0, zz = z0;                 // Schwerpunkt der Fusspunkte
  if (nF > 1) {
    zx = 0; zz = 0;
    for (i = 0; i < nF; i++) { zx += fuesse[i].x; zz += fuesse[i].z; }
    zx /= nF; zz /= nF;
  }

  // --- Mittelachse mit sanfter seitlicher Auslenkung ---
  // H4.2/H4.3: Zugpunkte und Kernneigung verschieben die Stuetzpunkte
  // horizontal. Ohne beides bleibt formAktiv false und die Schleife rechnet
  // exakt den bisherigen Verlauf (sie addiert nicht einmal eine 0).
  var zug = zugpunkteVon(el);
  var zugSt = zugStuetzen(zug);
  var kernzug = p.kernzug || 0;
  var formAktiv = zug.length > 0 || kernzug > 0;
  // Wo Zugpunkte die Achse vorgeben, wird das Rauschen gedaempft, damit die
  // gezogene Form lesbar bleibt; ohne Zugpunkte ist der Faktor exakt 1.
  var rauschD = zug.length ? 0.65 : 1;
  // Feinere Stuetzung nur in den NEUEN Faellen: die Vereinigungsrampe (Breite
  // 0.18) und enge Zugpunkte brauchen mehr als 12 Stuetzstellen, sonst
  // rundet die CatmullRom sie weg. Der Bestandsfall bleibt bei 12.
  var NC = (nF > 1 || zug.length) ? 32 : 12;
  var sway = H * 0.06;

  /** Rohachse eines Astes um den Fuss (bx,bz,by) mit eigenem Rauschstrom. */
  function rohAchse(bx, bz, by, sX, sZ) {
    var pts = [], ii, tt, f, cx, cz;
    for (ii = 0; ii <= NC; ii++) {
      tt = ii / NC;
      f = Math.pow(tt, 0.85);
      cx = bx + (fractal(tt * 3.1 + 1.7, 0.5, sX) - 0.5) * 2 * sway * f * rauschD;
      cz = bz + (fractal(0.5, tt * 3.1 + 4.2, sZ) - 0.5) * 2 * sway * f * rauschD;
      if (formAktiv) {
        kernAuslenkung(kernzug, bx, bz, tt, _ko);
        zugAuslenkung(zugSt, tt, _zo);
        cx += _ko.x + _zo.x;
        cz += _ko.z + _zo.z;
      }
      pts.push(new THREE.Vector3(cx, by + tt * H, cz));
    }
    return pts;
  }

  var ctrl = rohAchse(x0, z0, y0, el.seed + 3, el.seed + 9);
  // Gemeinsame Achse: gleiche Rauschstroeme wie der Hauptast, aber ueber dem
  // Schwerpunkt — die Verschmelzung ist damit fuer den Hauptast eine reine
  // Verschiebung, sein Rauschprofil bleibt oberhalb der Fuge erhalten.
  var gemCtrl = null;
  if (nF > 1) {
    gemCtrl = rohAchse(zx, zz, heightAt(zx, zz) - 2.6, el.seed + 3, el.seed + 9);
    for (i = 0; i <= NC; i++) ctrl[i].lerp(gemCtrl[i], verSchmelz(i / NC));
  }
  var axis = new THREE.CatmullRomCurve3(ctrl, false, "catmullrom", 0.5);

  // --- Straenge: wenige und massiv. Die Umdrehungsrate wechselt ueber die
  //     Hoehe abschnittsweise, der Radius atmet per Rauschen (Verdickungen
  //     und Einschnuerungen), Grundverjuengung nach oben auf `dickeOben`
  //     (Default 0.45 = die frueher fest verdrahteten 45 %).
  var nStr = clamp(Math.round(p.straenge), 3, 5);
  if (glatt) nStr = Math.min(nStr, 3);         // glatt: weniger Straenge (max 3)
  var strandB = glatt ? 1.8 : 1;               // glatt: dafuer breitere Straenge
  /* --- H4.1: Windungsgrad ueber die Hoehe differenziert -------------------
     windungUnten/-Oben sind wie p.steigung "Durchmesser je Windung"; 0 heisst
     "wie Steigung" (Default). Der Sentinel 0 statt eines festen Zahlwerts ist
     Absicht: defaultsFor ergaenzt fehlende Parameter beim Laden, ein fester
     Default wuerde Bestandskarten mit abweichender `steigung` umformen.
     Sind beide Enden gleich (Default), faellt jede Formel unten Zeichen fuer
     Zeichen auf den Altwert zurueck — lerp(a,a,t) liefert exakt a. */
  // Math.max haelt die Windung von 0 weg (Division!) und liefert fuer jeden
  // regulaeren Wert exakt den Operanden zurueck — der Bestandspfad bleibt.
  var windU = Math.max(0.4, (p.windungUnten ? p.windungUnten : p.steigung) * (glatt ? 2.2 : 1));
  var windO = Math.max(0.4, (p.windungOben ? p.windungOben : p.steigung) * (glatt ? 2.2 : 1));
  /** Windungen je Einheit t an der Stelle tt (Hoehe / Durchmesser je Windung). */
  function turnsProT(tt) { return H / (lerp(windU, windO, tt) * 2 * R); }
  /* Gesamtwindungszahl = ∫₀¹ turnsProT dt. Fuer die lineare Interpolation der
     Steigung hat das Integral die geschlossene Form ln(b/a)/(b-a); bei
     gleichen Enden ist es 1/a, also exakt der bisherige Ausdruck. TURNS
     traegt weiterhin die Ringzahl (26 Ringe je Windung IM MITTEL) — das
     Geflecht bleibt damit ueber die ganze Hoehe gleich dicht aufgeloest,
     genau der Sinn der Steigungsformel. Die Ringe sind bei ungleichen Enden
     nicht mehr aequidistant in der Windung, aber turnsProT verteilt den
     Drehwinkel lokal richtig, sodass unten enger und oben weiter gewunden
     wird (oder umgekehrt). */
  var TURNS = windU === windO ? H / (windU * 2 * R)
    : (H / (2 * R)) * Math.log(windO / windU) / (windO - windU);
  var RINGS = clamp(Math.round(TURNS * 26), 72, 240);
  // Endradius relativ zum Fussradius; 0.45 ist die bisher fest verdrahtete
  // Verjuengung und daher der Schema-Default.
  var dickeOben = p.dickeOben === undefined ? 0.45 : clamp(p.dickeOben, 0.2, 1);
  var c = new THREE.Vector3(), n1 = new THREE.Vector3(), n2 = new THREE.Vector3();
  function wrapAt(tt, kk, fi) {
    // Straenge legen sich stellenweise aneinander und laufen wieder auseinander
    var eng = 0.72 + (fractal(tt * 2.6 + kk * 3.7 + fi * 13.1, 0.5, el.seed + 217) - 0.5) * 0.5;
    return R * 0.62 * lerp(1, dickeOben, tt) * eng;
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
      winkel += (turnsProT(t) * Math.PI * 2 / RINGS) * rate;
      // radSkala: oberhalb der Vereinigung traegt dieses Buendel die Summe
      // der Astquerschnitte (Faktor exakt 1, solange es nur einen Fuss gibt).
      var wrap = wrapAt(t, k, 0) * radSkala(t);
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
        return R * 0.30 * lerp(1, dickeOben, tt) * radFL[Math.min(ii, radFL.length - 1)] *
          thickL * strandB * radSkala(tt);
      }, 8, function (tt, ii, col) {
        vineColor(tt, col);
        // Moos und Bewuchs sammeln sich in den Einschnuerungen
        var rf = radFL[Math.min(ii, radFL.length - 1)];
        if (rf < 0.88) col.lerp(_moosFarbe, (0.88 - rf) * 1.6);
      });
    })(radF, thick));
  }

  /* --- H4.4: Zusatz-Aeste aus den weiteren Fusspunkten --------------------
     Bewusst eine EIGENE Schleife statt einer Verallgemeinerung der obigen:
     das Hauptbuendel bleibt dadurch Zeile fuer Zeile das alte (Ringzahl
     RINGS ueber die volle Hoehe, Stroeme (k,0,+501)). Ein Zusatzast laeuft
     nur bis zum Ende der Verschmelzungsrampe; darueber traegt allein das
     Hauptbuendel weiter, dessen Radius dort per radSkala bereits auf
     sqrt(Σ r_i²) angewachsen ist. Die Astenden verschwinden im
     Verwachsungsknoten (weiter unten). */
  for (var fi = 1; fi < nF; fi++) {
    var fpt = fuesse[fi];
    var fo = 533 + (fi % 33) * 2;       // reservierter Block +533..+599
    var aCtrl = rohAchse(fpt.x, fpt.z, heightAt(fpt.x, fpt.z) - 2.6,
      el.seed + fo, el.seed + fo + 1);
    for (i = 0; i <= NC; i++) aCtrl[i].lerp(gemCtrl[i], verSchmelz(i / NC));
    var aAxis = new THREE.CatmullRomCurve3(aCtrl, false, "catmullrom", 0.5);
    // Ringzahl proportional zum kuerzeren Weg — gleiche Aufloesung je Windung
    var RA = clamp(Math.round(TURNS * tVerEnd * 26), 48, 240);
    var astStraenge = [];
    for (k = 0; k < nStr; k++) {
      var rSa = ortsRng(k, fi, el.seed + 501);
      var aWinkel = k / nStr * Math.PI * 2 + rr(rSa, -0.2, 0.2);
      var aPts = [], aRadF = [];
      for (i = 0; i <= RA; i++) {
        var u = i / RA, at = u * tVerEnd;
        frameAt(aAxis, at, c, n1, n2);
        var aRate = 0.5 + fractal(at * 3.2, k * 1.7 + fi * 11.3, el.seed + 131) * 1.1;
        aWinkel += turnsProT(at) * Math.PI * 2 * (tVerEnd / RA) * aRate;
        var aWrap = wrapAt(at, k, fi);   // Ast traegt seinen eigenen Radius R
        var aCa = Math.cos(aWinkel), aSa = Math.sin(aWinkel);
        aPts.push(new THREE.Vector3(
          c.x + n1.x * aCa * aWrap + n2.x * aSa * aWrap,
          c.y,
          c.z + n1.z * aCa * aWrap + n2.z * aSa * aWrap
        ));
        var aAtem = 0.7 + 0.7 * fractal(at * 8.2, k * 2.3 + fi * 7.9, el.seed + 149);
        if (glatt) aAtem = 1.05 + (aAtem - 1.05) * 0.3;
        aRadF.push(aAtem);
      }
      var aThick = rr(rSa, 1.35, 1.7);
      astStraenge.push({ pts: aPts, radF: aRadF, thick: aThick });
      geos.push((function (ptsL, radFL, thickL) {
        return tubeGeo(ptsL, function (uu, ii) {
          // uu laeuft 0..1 ueber den Ast, die Verjuengung aber ueber die
          // ECHTE Hoehe — sonst waere der Ast oben duenner als der Stamm.
          return R * 0.30 * lerp(1, dickeOben, uu * tVerEnd) *
            radFL[Math.min(ii, radFL.length - 1)] * thickL * strandB;
        }, 8, function (uu, ii, col) {
          vineColor(uu * tVerEnd, col);
          var rf = radFL[Math.min(ii, radFL.length - 1)];
          if (rf < 0.88) col.lerp(_moosFarbe, (0.88 - rf) * 1.6);
        });
      })(aPts, aRadF, aThick));
    }
    // Blattbueschel am Zusatzast — Muster des Hauptastes (dort ab "Grosse
    // Blaetter"), eigener Strom +601, Ende an der Vereinigung.
    var rAstStart = ortsRng(fi, -2, el.seed + 601);
    var aBlattT = 0.06 + rAstStart() * 0.05;
    var aSchritt = 0;
    while (aBlattT < tVerEnd - 0.02) {
      var rAB = ortsRng(fi * 4096 + aSchritt, -1, el.seed + 601);
      var aStrang = astStraenge[Math.floor(rAB() * astStraenge.length)];
      var aSi = Math.floor(aBlattT / tVerEnd * RA);
      var aSp = aStrang.pts[Math.min(aSi, aStrang.pts.length - 1)];
      frameAt(aAxis, aBlattT, c, n1, n2);
      var aBuendel = ri(rAB, 3, 7);
      for (i = 0; i < aBuendel; i++) {
        var rABl = ortsRng(fi * 4096 + aSchritt, i, el.seed + 601);
        var aBa = Math.atan2(aSp.z - c.z, aSp.x - c.x) + rr(rABl, -1.1, 1.1);
        var aGr = rr(rABl, 4, 10.5) * (1 - aBlattT * 0.5) * (p.blattgroesse || 1);
        emit(el, "rankenblatt",
          aSp.x + Math.cos(aBa) * 0.4, aSp.y + rr(rABl, -1.2, 1.2), aSp.z + Math.sin(aBa) * 0.4,
          -aBa + rr(rABl, -0.4, 0.4),
          aGr, aGr * rr(rABl, 0.5, 0.7), aGr,
          [0.97, 1.0, 0.86], rr(rABl, -0.15, 0.15), rr(rABl, -0.7, -0.1));
      }
      aBlattT += rr(rAB, 0.07, 0.17);
      aSchritt++;
    }
  }

  /* --- H4.4: Verwachsungsknoten ------------------------------------------
     Ohne ihn saehe die Querschnittsaddition nach Fehler aus: unter der Fuge
     n Buendel mit Radius R, darueber eines mit sqrt(n)·R. Der Knoten sitzt
     genau auf dem Ende der Rampe, ueberdeckt die Astenden und verkauft den
     Radiussprung als Verwachsung — Wulst (Fass mit Sinus-Bauch), ein paar
     Rindenfalten laengs darueber und etwas Moos aus dem vorhandenen
     moos-Pool. Kanon: hier laufen die Triebe Arbors zusammen. */
  if (nF > 1) {
    var rK = ortsRng(0, 0, el.seed + 605);
    var tK0 = Math.max(0.01, tVerEnd - 0.055), tK1 = Math.min(0.995, tVerEnd + 0.055);
    var rKnoten = R * rSkalaOben * lerp(1, dickeOben, tVerEnd);
    var kPts = [], NK = 16, kTmp = new THREE.Vector3();
    for (i = 0; i <= NK; i++) {
      axis.getPoint(lerp(tK0, tK1, i / NK), kTmp);
      kPts.push(kTmp.clone());
    }
    // Bauch: an den Enden 0.80 (steckt im Geflecht, kein sichtbarer Absatz),
    // in der Mitte bis 1.42 des Buendelradius.
    function knotenR(ss) {
      return rKnoten * (0.80 + 0.62 * Math.pow(Math.sin(Math.PI * ss), 1.15)) *
        (0.97 + hashi(Math.round(ss * 64), 3, el.seed + 605) * 0.07);
    }
    geos.push(tubeGeo(kPts, function (ss) { return knotenR(ss); }, 12,
      function (ss, ii, col) {
        vineColor(tVerEnd, col);
        col.multiplyScalar(0.9 + hashi(ii, 11, el.seed + 605) * 0.12);
        // Moosansatz auf der unteren Haelfte des Wulstes
        if (ss < 0.5) col.lerp(_moosFarbe, (0.5 - ss) * 0.5);
      }));
    var nFalte = ri(rK, 5, 8);
    for (k = 0; k < nFalte; k++) {
      var rFa = ortsRng(k, 2, el.seed + 605);
      var faA = rr(rFa, 0, 6.283), faDreh = rr(rFa, -0.9, 0.9);
      var faPts = [];
      for (i = 0; i <= NK; i++) {
        var fs = i / NK, fw = faA + faDreh * fs;
        frameAt(axis, lerp(tK0, tK1, fs), c, n1, n2);
        var fr = knotenR(fs) * 1.02;
        faPts.push(new THREE.Vector3(
          c.x + (n1.x * Math.cos(fw) + n2.x * Math.sin(fw)) * fr,
          c.y,
          c.z + (n1.z * Math.cos(fw) + n2.z * Math.sin(fw)) * fr));
      }
      geos.push(tubeGeo(faPts, function (fs) {
        return rKnoten * 0.075 * (0.4 + Math.sin(Math.PI * fs));
      }, 5, function (fs, ii, col) {
        vineColor(tVerEnd * 0.5, col);
        col.multiplyScalar(0.86);
      }));
    }
    var nMoos = ri(rK, 4, 7);
    for (k = 0; k < nMoos; k++) {
      var rMo = ortsRng(k, 3, el.seed + 605);
      var mS = rr(rMo, 0.1, 0.55), mW = rr(rMo, 0, 6.283);
      frameAt(axis, lerp(tK0, tK1, mS), c, n1, n2);
      var mR = knotenR(mS) * 0.95, mSc = rr(rMo, 0.9, 1.8);
      emit(el, "moos",
        c.x + (n1.x * Math.cos(mW) + n2.x * Math.sin(mW)) * mR,
        c.y, c.z + (n1.z * Math.cos(mW) + n2.z * Math.sin(mW)) * mR,
        mW, mSc, mSc * rr(rMo, 0.8, 1.2), mSc, [0.85, 0.95, 0.8]);
    }
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
      // Ansatz am Buendelrand: radSkala schiebt ihn oberhalb der Vereinigung
      // nach aussen mit, sonst begaenne der Trieb im Stamminneren.
      tp.push(new THREE.Vector3(
        c.x + Math.cos(ta) * (R * 0.5 * radSkala(tt0) + q * R * rr(rTrieb, 1.2, 2.2)),
        c.y + q * R * rr(rTrieb, 0.8, 2.0) - q * q * R * 0.9,
        c.z + Math.sin(ta) * (R * 0.5 * radSkala(tt0) + q * R * rr(rTrieb, 1.2, 2.2))
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
  // H4.4: dieselbe Logik je Fusspunkt. Fuss 0 zieht Anzahl und Startwinkel
  // weiter aus rGlob und in derselben Reihenfolge wie bisher (die beiden
  // Draws sind die letzten am Globalstrom), weitere Fuesse aus ihrem eigenen
  // ortsstabilen Strom (fi, -1, +509). Auch Kontaktschatten und Erdhuegel
  // gehoeren jedem Fuss einzeln — sie stehen ja im Boden.
  for (var wf = 0; wf < nF; wf++) {
    var fx0 = fuesse[wf].x, fz0 = fuesse[wf].z;
    var fy0 = wf === 0 ? y0 : heightAt(fx0, fz0) - 2.6;
    var rFuss = wf === 0 ? null : ortsRng(wf, -1, el.seed + 509);
    var nRoot = wf === 0 ? ri(rGlob, 10, 14) : ri(rFuss, 10, 14);
    var wStart = wf === 0 ? rr(rGlob, 0, 6.283) : rr(rFuss, 0, 6.283);
    for (k = 0; k < nRoot; k++) {
      var rW = ortsRng(k, wf, el.seed + 509);
      var ra = wStart + Math.pow(k / nRoot, rr(rW, 0.7, 1.4)) * Math.PI * 2 + rr(rW, -0.3, 0.3);
      var rd = R * rr(rW, 1.6, 4.6);
      var gx = fx0 + Math.cos(ra) * rd, gz = fz0 + Math.sin(ra) * rd;
      var gy = heightAt(gx, gz) - 2.4;
      var attach = R * rr(rW, 0.9, 2.8);
      var bulk = rr(rW, 0.75, 1.45);
      var rp = [];
      for (i = 0; i <= 16; i++) {
        t = i / 16;
        var e = t * t * (3 - 2 * t);
        var swirl = Math.sin(t * Math.PI) * rr(rW, -0.35, 0.35);
        rp.push(new THREE.Vector3(
          lerp(gx, fx0 + Math.cos(ra) * R * 0.42, e) - Math.sin(ra) * swirl * R,
          lerp(gy, fy0 + attach, e) + Math.sin(t * Math.PI) * R * 0.26,
          lerp(gz, fz0 + Math.sin(ra) * R * 0.42, e) + Math.cos(ra) * swirl * R
        ));
      }
      geos.push(tubeGeo(rp, function (tt) {
        return R * (0.055 + 0.21 * Math.pow(tt, 0.75)) * bulk;
      }, 7, function (tt, ii, col) { vineColor(tt * 0.1, col); }));
    }

    schattenAn(el, fx0, heightAt(fx0, fz0), fz0, R * 5.2);

    // --- Erdhügel, über den die Wurzeln laufen ---
    var mound = new THREE.Mesh(
      moundGeo(R * 4.6, R * 1.15, fx0, fz0, (el.seed + 61 + wf * 977) | 0), rockMat);
    mound.position.set(fx0, heightAt(fx0, fz0), fz0);
    mound.userData.el = el;
    groupOf(el).add(mound);
  }

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
    // radSkala: sitzt das Plateau oberhalb der Vereinigung, ruecken Ansatz
    // und Blattwurzel mit dem dickeren Stamm nach aussen (sonst steckte das
    // Blatt im Geflecht). Bei einem Fuss ist der Faktor exakt 1.
    var place = M(c.x + ox * R * 0.45 * radSkala(t), c.y,
      c.z + oz * R * 0.45 * radSkala(t), 0, -pang, 0);
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
    // horizontaler Bogen je Stufe (ds=0.9) — haengt am oertlichen Radius,
    // weil der Stamm oberhalb der Vereinigung dicker wird (Faktor 1 bei
    // einem Fuss, dann exakt der frueher einmalig berechnete Wert).
    var stufeGeo = new THREE.BoxGeometry(1.2, 0.18, 0.5);
    var cSt = new THREE.Color();
    var lauf = [], nSt = 0;
    while (yTr < yEnd && nSt < 1600) {
      var tTr = clamp((yTr - y0) / H, 0, 1);
      frameAt(axis, tTr, c, n1, n2);
      var rTrL = rTr * radSkala(tTr);
      var dxT = n1.x * Math.cos(thTr) + n2.x * Math.sin(thTr);
      var dzT = n1.z * Math.cos(thTr) + n2.z * Math.sin(thTr);
      var dlT = Math.sqrt(dxT * dxT + dzT * dzT) || 1;
      dxT /= dlT; dzT /= dlT;
      // heller Holz-/Steinton (KULTUR-Neutral), leicht gekoernt ueber hashi
      cSt.setHex(0xcfc0a2).multiplyScalar(0.94 + hashi(nSt, 7, el.seed + 527) * 0.1);
      geos.push(part(stufeGeo,
        M(c.x + dxT * rTrL, yTr, c.z + dzT * rTrL, 0, Math.atan2(-dzT, dxT), 0),
        cSt.getHex()));
      // Handlauf-Stuetzpunkte auf der Aussenseite, jede zweite Stufe
      if (nSt % 2 === 0) {
        lauf.push(new THREE.Vector3(
          c.x + dxT * (rTrL + 0.58), yTr + 0.95, c.z + dzT * (rTrL + 0.58)));
      }
      yTr += 0.42; thTr += 0.795 / rTrL; nSt++;
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


export { vineColor, genRanke, rankePlatzierbar,
  zugpunkteVon, rankeStuetzen, zugAuslenkung, rankeAchse, rankeKernPunkt };
