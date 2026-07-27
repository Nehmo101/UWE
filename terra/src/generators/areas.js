// Flaechen-Werkzeug: Wald, Feld, Wiese, Viertel samt innerem Wegenetz.
import { clamp, lerp, sstep, DEG, hashi, fractal, rngOf, rr, ri, wpick } from '../core/rng.js';
import { S, BIOME, KARTE, VW, MAP, WATER } from '../core/store.js';
import { POOLS, emit, tintOf, rauchAus } from '../core/pools.js';
import { heightAt, slopeAt, biomFeld, biomGewicht } from '../world/terrain.js';
// I2: harte Biomwahl je Kandidat. biomfeld.js haengt nur an core/ — zyklusfrei.
import { biomHartAn } from '../world/biomfeld.js';
// I1: Kartenzeichen. signaturen.js haengt an three, core/ und kartenbaum.js —
// es importiert nichts aus generators/, der Weg ist also zyklusfrei.
import { zeichenFuer, signaturPlatzierung, streuAbstand, streuRaster } from '../render/signaturen.js';
// I1: die geteilten Helfer der Maszstabsverzweigung. Sie lagen bis Runde J
// hier — jetzt teilen sich fuenf Generatoren eine Datei, statt dass jeder
// seine eigene Schwelle mitbraechte.
import { alsKoerper, alsZeichen, punktZeichen } from './zeichen.js';
import { newOcc, occAdd, tryPlace, KULTUR, emitFensterlicht } from './objects.js';
import { bandGeoAusLinie, bandMeshAusGeos } from './paths.js';
/* Die drei Kompositstrukturen des Objektkatalogs (Abschnitt "Kompositstrukturen
   und Struktur-Generatoren"). Sie liegen in einem eigenen Modul, weil ihre
   Layout-Logik mit der Streulogik dieser Datei nichts gemeinsam hat — und weil
   der Import damit EINE Richtung hat: areas.js -> strukturen.js, nie zurueck.
   Deshalb wohnen die reinen Polygonhelfer jetzt dort und werden hier nur noch
   durchgereicht; ihre bisherigen Importeure (selection.js, core/dirty.js)
   bleiben davon unberuehrt. */
import { polyBBox, inPoly, polyArea, polyCenter,
  genBurg, genWerft, genKloster } from './strukturen.js';
// Runde H: der Binnensee. see.js zieht core/, world/ und generators/{objects,
// zeichen,wegsuche} — nie areas.js; der Weg ist zyklusfrei.
import { genSee } from './see.js';

/* Ortsstabiler Zufallsstrom: bindet alle Draws EINER Platzierungsentscheidung
   an einen stabilen Schluessel statt an die Zugriffsreihenfolge — sonst
   wuerde jede Aenderung der Schleifenlaengen (Punkt verschoben, Parameter
   geaendert) die gesamte restliche Bestueckung umwuerfeln. genWald/genWiese
   arbeiten bereits so (Rasterzellen-Hash) und bleiben unveraendert. */
function ortsRng(a, b, s) { return rngOf((hashi(a, b, s) * 4294967296) | 0); }

/* polyBBox/inPoly/polyArea/polyCenter stehen jetzt in strukturen.js (siehe
   Importblock oben) und werden von dort unveraendert re-exportiert. */

/** Abstand so vergrößern, dass die Instanzzahl beherrschbar bleibt. */
/** Instanzdeckel flaechenproportional zur Karte (H1d). Gleicher Faktor und
 *  gleicher 4x-Deckel wie MAX_INST_PER_EL in store.js, damit die Flaechen-
 *  deckel nie ueber das Element-Budget hinauswachsen. Bei 256 liefert er
 *  exakt die alten Werte — grosse Karten sollen groessere Waelder tragen,
 *  nicht duennere. */
function deckel(n) {
  return Math.round(n * Math.min(4, (KARTE.map * KARTE.map) / (256 * 256)));
}

function safeSpacing(pts, wanted, maxCount) {
  var a = polyArea(pts);
  var need = Math.sqrt(a / Math.max(1, maxCount));
  return Math.max(wanted, need);
}

/**
 * Biom-Abstandsfaktor (H-Welle 2). `veg.dichte` wirkt konstruktionsbedingt NUR
 * nach unten (`if (V.dichte < 1 && ...)`), Werte > 1 sind wirkungslos —
 * Regenwald, Bambus und Pilzwald koennen deshalb ueber `dichte` gar nicht
 * dichter werden als der Bestand. `veg.abstand` ist der Gegenweg: ein Faktor
 * auf das FERTIGE Ergebnis von safeSpacing (< 1 verdichtet, > 1 lichtet auf).
 *
 * Bewusst NACH safeSpacing und nicht auf dessen `wanted`-Argument: der
 * Max()-Boden in safeSpacing ist genau die Grenze, die ueberschritten werden
 * soll. Der Instanzdeckel wird damit umgangen — bei abstand 0.55 (Bambus)
 * vervierfacht sich die Kandidatenzahl fast; MAX_INST_PER_EL in pools.js
 * bleibt das Sicherheitsnetz.
 *
 * Byteidentitaet: fehlt das Feld (wiese, kueste, alle Runde-G-Biome) oder
 * steht es auf 1, wird die Multiplikation NICHT ausgefuehrt — kein "* 1",
 * keine Rundungsschleife, kein veraenderter Float.
 */
function biomAbstand(V, sp) {
  var f = V.abstand;
  if (f === undefined || f === null || f === 1) return sp;
  return sp * f;
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

/* Biom-Vegetation (G5): genWald/genWiese lesen Multiplikatoren aus
   BIOME[S.biom].veg. Umsetzung minimalinvasiv: im wiese-Pfad sind alle
   Faktoren 1 bzw. null — jede Bedingung kurzschliesst, es wird kein
   zusaetzlicher Hash gezogen und kein bestehender Schluessel verschoben,
   die Bestueckung bleibt byteidentisch. Andere Biome duerfen zusaetzliche
   ortsstabile Ablehnungen (continue) oder Art-Ersetzungen ausloesen; die
   dafuer NEU vergebenen hashi-Schluessel sind el.seed+57 (Dichte) und
   el.seed+58 (Artgewichte) — beide waren bisher unbenutzt. */

// Standard-Unterwuchsmischung (wiese/kueste). Biome koennen per uwTabelle
// eine eigene wpick-Tabelle hinterlegen — der rng-Verbrauch bleibt gleich,
// wpick zieht unabhaengig von der Tabelle genau einen Wert.
var UW_STANDARD = [["busch", 5], ["farn", 4], ["moos", 3], ["stumpf", 1],
  ["stammliegend", 1], ["fels", 1]];

/* ==========================================================================
   I1 — Flaechenzeichen: eine Flaeche als Kartensignatur statt als Bewuchs

   Gemeinsamer Weg fuer Wald, Acker, Sumpf und die uebrigen Flaechen. Was sich
   je Flaechenart unterscheidet, ist genau eine Zeile — die Sache, die
   `zeichenFuer` nachschlaegt. Deshalb ein Helfer und keine vier Zweige.

   Gekachelt statt einmal in die Mitte gesetzt: eine einzelne Waldmarke auf
   einem 200 km breiten Wald saehe aus wie ein Fehler. Das Raster haengt am
   SCHWERPUNKT der Flaeche (ankerX/ankerZ), nicht am Weltnullpunkt — beim
   Verschieben sollen die Marken mitwandern, statt durch die Flaeche
   hindurchzuwandern. Baeume gehoeren dem Boden, ein Kartenzeichen gehoert der
   Sache.
   ========================================================================== */
/* `kante` ist die Kartenkante in WELTEINHEITEN (KARTE.map), nicht in Metern.
   Der Unterschied kostete beim ersten Versuch die halbe Wirkung: auf einer
   Kontinentkarte sind 256 Zellen 512 km, und ein Zeichen von 0,6 % davon
   waere 3 km — auf einer Karte, die insgesamt 256 Welteinheiten misst. Die
   Zeichen lagen dann als Riesenflecken uebereinander, und in kleinen Polygonen
   fand das Streuraster gar keinen Platz mehr. Der Maszstab entscheidet, OB ein
   Zeichen erscheint; wie gross es ist, entscheidet die Karte. */
function flaechenZeichen(el, sache, art) {
  var pts = el.points;
  var m = S.einheitMeter;
  var wahl = zeichenFuer(sache, el.kennzahl, m, { art: art });
  if (!wahl || !wahl.length) return;
  var bb = polyBBox(pts), mitte = polyCenter(pts);
  /* `biom` gehoert hier hinein und fehlte. Ohne es liegt JEDE Flaechensignatur
     in der Wiesenpalette — eine Waldmarke im Herbstbiom war grasgruen, eine im
     Nadelwald ebenso. Genau das sollte der Tint verhindern: die Atlasfelder
     sind Graustufen, damit dasselbe Zeichen in jedem Biom dessen Farbe
     annimmt, ohne dass es ein zweites Feld braucht. */
  var platz = signaturPlatzierung(wahl[0], { kante: KARTE.map, massstab: m, biom: S.biom });
  if (!platz) return;
  var sp = streuAbstand(platz.marke);
  var punkte = streuRaster({
    x0: bb.x0, z0: bb.z0, x1: bb.x1, z1: bb.z1, sp: sp,
    seed: el.seed + 0x51601, ankerX: mitte.x, ankerZ: mitte.z,
    imInneren: function (x, z) { return inPoly(pts, x, z); }
  });
  for (var i = 0; i < punkte.length; i++) {
    var q = punkte[i];
    var y = Math.max(heightAt(q.x, q.z), WATER) + platz.schwebe;
    emit(el, wahl[0], q.x, y, q.z, q.dreh, platz.sx * q.skala, platz.sy,
      platz.sz * q.skala, platz.tint);
  }
}

function genWald(el) {
  var p = el.params, pts = el.points;
  var mSig = S.einheitMeter;
  // I1: ueber der Uebergabe wird der Wald zum Zeichen. Im Ueberblendbereich
  // laeuft beides — die Signatur blendet ueber `sy` ein, die Baeume bleiben
  // bis zum oberen Rand stehen.
  if (alsZeichen(mSig)) flaechenZeichen(el, "wald", p.mischung > 0.6 ? "nadel" : null);
  if (!alsKoerper(mSig)) return;
  var V = (BIOME[S.biom] || BIOME.wiese).veg;
  var klump = p.klumpen === undefined ? 0.55 : p.klumpen;
  var sp = biomAbstand(V, safeSpacing(pts, 6.5 / p.dichte * (1 - 0.28 * klump), deckel(14000)));
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
      /* I2 — das Biom AN DIESER STELLE, nicht das der Karte. Harte Wahl ohne
         Mischung: ein halb verschneiter Bluetenbaum ergibt kein Bild, und was
         zwischen zwei Baumarten liegt, gibt es nicht. Die Abfrage ist eine
         reine Funktion der Position (das Gitter und der Seed sind fest), der
         Determinismus bleibt also unangetastet.

         Der ABSTAND `sp` bleibt bewusst beim Elementbiom: er bestimmt das
         Raster, ueber das diese Schleife laeuft. Liesse man ihn je Kandidat
         springen, waere das Raster kein Raster mehr. */
      var VP = (BIOME[biomHartAn(biomFeld, biomGewicht, VW, MAP, x, z,
        S.biom, S.worldSeed)] || BIOME.wiese).veg;
      // Bäume wachsen in Nestern mit Lichtungen dazwischen, nicht im Raster
      if (fractal(x * 0.04, z * 0.04, el.seed + 21) < schwelle) continue;
      // Biom-Gesamtdichte: zusaetzliche ortsstabile Ablehnung (Schluessel +57)
      if (VP.dichte < 1 && hashi(cx, cz, el.seed + 57) >= VP.dichte) continue;
      var rng = rngOf((hashi(cx, cz, el.seed + 7) * 4294967296) | 0);
      var nadel = r3 < p.mischung;
      var artW = hashi(cx, cz, el.seed + 33);
      var kind = nadel ? (artW < 0.6 ? "nadelbaum" : "zypresse")
        : (artW < 0.38 ? "baum2" : (artW < 0.86 ? "baum"
          : (artW < 0.94 ? "sumpfbaum" : "bluetenbaum")));
      // Biom-Artgewichte: Behalte-Wahrscheinlichkeit je Art (Schluessel +58);
      // Abgelehntes ersetzt ortsstabil die biomtypische Ersatzart oder faellt aus.
      if (VP.arten) {
        var behalte = VP.arten[kind];
        if (behalte !== undefined && hashi(cx, cz, el.seed + 58) >= behalte) {
          if (!VP.ersatz) continue;
          kind = VP.ersatz;
        }
      }
      var h = tryPlace(occ, x, z, POOLS[kind].radius * 0.8, null);
      if (h === null) continue;
      var sc = rr(rng, 0.8, 1.2);
      // Farbvarianz: leichte Verschiebung, selten ein deutlich abweichender Ton
      var tint = tintOf(rng, 0.09);
      var ausW = rng();
      if (ausW < 0.035) tint = [1.28, 0.92, 0.55];        // goldener Baum
      else if (ausW < 0.06) tint = [1.3, 0.78, 0.62];     // roetlicher Baum
      emit(el, kind, x, h - 0.1, z, rng() * 6.28, sc, sc * rr(rng, 0.85, 1.25), sc, tint);
      if (rng() < p.unterholz * VP.unterwuchs * (0.6 + randNaehe(pts, x, z) * 0.8)) {
        var bx = x + rr(rng, -sp * 0.5, sp * 0.5), bz = z + rr(rng, -sp * 0.5, sp * 0.5);
        if (!inPoly(pts, bx, bz)) continue;
        var bh = tryPlace(occ, bx, bz, 0.7, null);
        if (bh === null) continue;
        var bs = rr(rng, 0.7, 1.35);
        var uw = wpick(rng, VP.uwTabelle || UW_STANDARD);
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
  var p = el.params, pts = el.points;
  // I1: siehe genWald.  waehlt das Zeichen — Weinberg und Obstgarten
  // haben eigene, Weizen und Kohl teilen sich die Ackersignatur.
  if (alsZeichen(S.einheitMeter)) flaechenZeichen(el, "acker", p.frucht);
  if (!alsKoerper(S.einheitMeter)) return;
  var bb = polyBBox(pts), ctr = polyCenter(pts);
  var ext = Math.max(bb.x1 - bb.x0, bb.z1 - bb.z0) * 0.75 + 4;
  var a = p.drehung * DEG, dx = Math.cos(a), dz = Math.sin(a);
  var px = -dz, pz = dx;
  var rowSp = safeSpacing(pts, p.reihe, deckel(6000)) * 1.0;
  var alongSp = 2.6;
  var frucht = FRUCHT[p.frucht] || FRUCHT.weizen;
  var occ = newOcc(2);
  var nRows = Math.ceil(ext * 2 / rowSp);
  // Zufalls-Schluessel: (Reihenindex r, Schrittindex s, seed+23) — waechst
  // das Polygon, kommen nur neue Reihen/Schritte hinzu, die bestehenden
  // behalten ihre Varianz. Grenze: das Raster haengt an polyCenter, jede
  // Punktverschiebung rueckt also alle Weltpositionen leicht — die Zuordnung
  // Indexzelle -> Auswuerfelung bleibt davon aber unberuehrt.
  for (var r = -nRows; r <= nRows; r++) {
    var off = r * rowSp;
    var steps = Math.ceil(ext * 2 / alongSp);
    for (var s = 0; s <= steps; s++) {
      var t = -ext + s * alongSp;
      var x = ctr.x + dx * t + px * off, z = ctr.z + dz * t + pz * off;
      if (!inPoly(pts, x, z)) continue;
      var h = tryPlace(occ, x, z, 0.5, null);
      if (h === null) continue;
      var rs = ortsRng(r, s, el.seed + 23);
      var tn = tintOf(rs, 0.05);
      emit(el, "feldreihe", x, h, z, a + Math.PI / 2,
        rowSp * 0.34, rr(rs, 0.75, 1.15) * p.hoehe, alongSp * 0.55,
        [frucht[0] * tn[0], frucht[1] * tn[1], frucht[2] * tn[2]]);
    }
  }
}

function genWiese(el) {
  var p = el.params, pts = el.points;
  // I1: eine Wiese wird auf Kartenmaszstab zur Weidesignatur.
  if (alsZeichen(S.einheitMeter)) flaechenZeichen(el, "acker", "weide");
  if (!alsKoerper(S.einheitMeter)) return;
  var V = (BIOME[S.biom] || BIOME.wiese).veg;
  var sp = biomAbstand(V, safeSpacing(pts, 2.6 / p.dichte, deckel(20000)));
  // Blumen-Leitfarben: das Biom darf die modulweite Tabelle ersetzen
  // (Bluetental: rosa/creme). Ohne Feld ist LF exakt dieselbe Referenz wie
  // frueher — gleiche Laenge, gleiche Werte, gleicher Index.
  var LF = V.leitfarben || LEITFARBEN;
  var bb = polyBBox(pts), occ = newOcc(1.5);
  var c0 = Math.floor(bb.x0 / sp), c1 = Math.ceil(bb.x1 / sp);
  var d0 = Math.floor(bb.z0 / sp), d1 = Math.ceil(bb.z1 / sp);
  for (var cz = d0; cz <= d1; cz++) {
    for (var cx = c0; cx <= c1; cx++) {
      var r1 = hashi(cx, cz, el.seed), r2 = hashi(cx, cz, el.seed + 1);
      var x = (cx + 0.5 + (r1 - 0.5) * 0.95) * sp, z = (cz + 0.5 + (r2 - 0.5) * 0.95) * sp;
      if (!inPoly(pts, x, z)) continue;
      // I2: Biom je Kandidat, Begruendung wie in genWald. Die Leitfarben der
      // Blumennester bleiben beim Elementbiom (LF oben) — ein Nest ist groesser
      // als eine Zelle, seine Farbe darf nicht mitten im Nest umspringen.
      var VP = (BIOME[biomHartAn(biomFeld, biomGewicht, VW, MAP, x, z,
        S.biom, S.worldSeed)] || BIOME.wiese).veg;
      var rng = rngOf((hashi(cx, cz, el.seed + 3) * 4294967296) | 0);
      // Nester und Luecken statt Gleichverteilung
      if (fractal(x * 0.06, z * 0.06, el.seed + 77) < 0.34) continue;
      // Biom-Gesamtdichte (Schluessel +57, wie genWald): im wiese-Pfad
      // kurzgeschlossen, sonst ortsstabile Zusatz-Ablehnung.
      if (VP.dichte < 1 && hashi(cx, cz, el.seed + 57) >= VP.dichte) continue;
      var h = tryPlace(occ, x, z, 0.25, null);
      if (h === null) continue;
      // Blumen wachsen in Nestern mit einer Leitfarbe je Nest
      var nestX = Math.floor(x / 9), nestZ = Math.floor(z / 9);
      var nest = hashi(nestX, nestZ, el.seed + 91);
      var istBlume = rng() < p.blumen * VP.blumen * sstep(0.45, 0.75, nest);
      var kind = istBlume ? "blume" : "gras";
      var sc = rr(rng, 0.75, 1.35);
      var tint = tintOf(rng, 0.1);
      if (istBlume) {
        var leit = LF[Math.floor(hashi(nestX, nestZ, el.seed + 93) * LF.length)];
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
  var p = el.params, pts = el.points;
  /* I1 — ein Viertel wird auf Kartenmaszstab zur ORTSSIGNATUR, und zwar zu
     genau EINER: 30 Haeuser ergeben eine Dorfsignatur, nicht 30 Weiler-
     signaturen. Welche es wird, entscheidet die Kennzahl (Zahl der
     Baukoerper), die weiter unten auf Ortsmaszstab ermittelt und mit dem
     Element gespeichert wird — nicht hier auf Regionsmaszstab geschaetzt.
     Sonst hinge die Signatur davon ab, mit welchem Maszstab man die Karte
     zuletzt geoeffnet hat. */
  if (alsZeichen(S.einheitMeter)) {
    var om = polyCenter(pts);
    punktZeichen(el, "ort", el.kennzahl, om.x, om.z, null);
  }
  if (!alsKoerper(S.einheitMeter)) return;
  if (!el.streets) el.streets = districtStreets(el);
  var streets = el.streets;
  var occ = newOcc(4.5);
  var i, k, s, baukoerper = 0;
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
  // Zufalls-Schluessel: Startversatz + Anfangs-Lauf je Gassenseite
  // (Street-Index i, Seite, seed+31), jede Segmententscheidung je
  // (Segmentindex k, i*2+Seite, seed+37). Der Lauf-Zustand (lauf/laufKind)
  // bleibt sequentiell ueber k — zulaessig, weil k selbst stabil ist; nur die
  // DRAWS haengen am Schluessel. Das Strassennetz selbst (districtStreets,
  // eigener Strom seed+51) ist hier ausdruecklich nicht Thema. Kein
  // elementweiter Strom mehr in genViertel.
  var table = KULTUR[p.stil] || KULTUR.dorf;
  if (p.stil === "dorf" || p.stil === "gemischt" || !p.stil) dorfUfer(el, pts);
  var luecke = clamp(1.6 / p.dichte - 0.5, 0.1, 6);   // Abstand zwischen Nachbarn
  for (i = 0; i < streets.length; i++) {
    var ln = streets[i];
    for (var side = -1; side <= 1; side += 2) {
      var seite = side < 0 ? 0 : 1;
      var rSeite = ortsRng(i, seite, el.seed + 31);
      var acc = rr(rSeite, 0, 6);
      var lauf = 0, laufKind = wpick(rSeite, table);
      for (k = 1; k < ln.length; k++) {
        var a = ln[k - 1], b = ln[k];
        var dx = b.x - a.x, dz = b.z - a.z, d = Math.sqrt(dx * dx + dz * dz);
        if (d < 0.001) continue;
        dx /= d; dz /= d;
        acc -= d;
        if (acc > 0) continue;
        var rs = ortsRng(k, i * 2 + seite, el.seed + 37);
        // Reihenhaus-Läufe: 2–4 gleiche Typen nebeneinander, dann wechseln
        if (lauf <= 0) { laufKind = wpick(rs, table); lauf = ri(rs, 2, 4); }
        lauf--;
        var kind = laufKind;
        var br = POOLS[kind].radius * 2;
        acc = br + luecke * rr(rs, 0.4, 1.6);
        if (rs() < 0.1) continue;                     // gelegentliche Baulücke
        var off = p.gasse * 0.5 + POOLS[kind].radius + rr(rs, 0.2, 1.1);
        var x = b.x + (-dz) * off * side, z = b.z + dx * off * side;
        if (!inPoly(pts, x, z)) continue;
        var hh = tryPlace(occ, x, z, POOLS[kind].radius * 0.82, { ignoreCorridor: true });
        if (hh === null) continue;
        var sc = rr(rs, 0.88, 1.14);
        var hyaw = Math.atan2(dx, dz) + rr(rs, -0.05, 0.05);
        emit(el, kind, x, hh - 0.15, z, hyaw, sc, sc * rr(rs, 0.9, 1.25), sc, tintOf(rs));
        baukoerper++;
        rauchAus(el, kind, x, hh, z, sc);
        emitFensterlicht(el, rs, kind, x, hh - 0.15, z, hyaw, sc);
      }
    }
  }
  /* I1 — die Kennzahl entsteht HIER, auf Ortsmaszstab, wo die Baukoerper
     wirklich gesetzt werden. Sie wandert mit dem Element in die Datei und
     entscheidet spaeter, welche Ortssignatur die Siedlung bekommt.

     Sie auf Regionsmaszstab zu schaetzen waere der naheliegende Fehler: dann
     haenge die Signatur davon ab, mit welchem Maszstab man die Karte zuletzt
     geoeffnet hat — genau die Sorte versteckter Zustand, die rebuildAll in
     Runde I5 einen Tag gekostet hat. */
  el.kennzahl = baukoerper;
}

/** Uferzone eines Dorfviertels: Stege und Boote, wo das Polygon ans Wasser grenzt.
    Zufalls-Schluessel: (Kantenindex i, Uferpunkt-Index j, seed+71) — der Hafen
    haengt damit an SEINER Polygonkante; wird eine andere Kante verschoben,
    wandert oder wuerfelt er nicht mehr. Das Einfuegen/Loeschen von Punkten
    verschiebt die Kantenindizes dahinter (akzeptierte Grenze). */
function dorfUfer(el, pts) {
  for (var i = 0; i < pts.length; i++) {
    var a = pts[i], b = pts[(i + 1) % pts.length];
    for (var j = 0; j < 3; j++) {
      var t = 0.2 + j * 0.3;
      var x = lerp(a.x, b.x, t), z = lerp(a.z, b.z, t);
      var h = heightAt(x, z);
      if (h > 0.4 || h < -2.5) continue;
      // Richtung Wasser: bergab
      var dx = heightAt(x + 2, z) - heightAt(x - 2, z);
      var dz = heightAt(x, z + 2) - heightAt(x, z - 2);
      var yaw = Math.atan2(-dx, -dz);
      var ru = ortsRng(i, j, el.seed + 71);
      if (ru() < 0.45) {
        emit(el, "steg", x, Math.max(h, 0.05), z, yaw, 1, 1, 1, tintOf(ru, 0.06));
        if (ru() < 0.7) {
          emit(el, "boot", x + Math.sin(yaw) * 2.4, 0.02, z + Math.cos(yaw) * 2.4,
            yaw + rr(ru, -0.5, 0.5), 1, 1, 1, tintOf(ru, 0.08));
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
  // Die Kompositstrukturen haengen bewusst am ENDE der Kette (gleiche
  // Begruendung wie bei pfad:bruch in core/dirty.js): eine aeltere Fassung des
  // Editors faellt durch alle else-if hindurch und erzeugt schlicht nichts,
  // statt abzustuerzen — das Speicherformat bleibt abwaertskompatibel.
  else if (el.variant === "burg") genBurg(el);
  else if (el.variant === "werft") genWerft(el);
  else if (el.variant === "kloster") genKloster(el);
  // Der See haengt am ENDE der Kette, gleiche Begruendung wie bei pfad:bruch:
  // eine aeltere Fassung faellt durch alle else-if und erzeugt nichts, statt
  // abzustuerzen — das Speicherformat bleibt abwaertskompatibel.
  else if (el.variant === "see") genSee(el);
}


/* polyBBox/inPoly/polyArea/polyCenter werden hier weiter exportiert, obwohl sie
   jetzt aus strukturen.js kommen: selection.js und core/dirty.js importieren
   `inPoly` seit jeher von hier, und ein Umhaengen dort waere reiner Laerm. */
export { polyBBox, inPoly, polyArea, polyCenter, safeSpacing, genWald, genFeld,
  genWiese, districtStreets, genViertel, genFlaeche };
