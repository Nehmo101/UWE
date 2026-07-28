// Kompositstrukturen (Objektkatalog, Abschnitt "Kompositstrukturen und
// Struktur-Generatoren"): Burg, Werft und Kloster. Der Katalog fuehrt sie als
// "G" — sie duerfen kein definePool sein, weil ihre Gestalt aus dem
// gezeichneten Polygon und dem Gelaende entsteht und aus Dutzenden
// verschiedener Teile besteht. Aufgerufen werden sie wie genViertel aus
// genFlaeche (areas.js), als Varianten flaeche:burg / :werft / :kloster.
//
// Modulgraph: diese Datei importiert NICHTS aus areas.js. Damit areas.js hier
// importieren kann (genFlaeche -> genBurg/genWerft/genKloster), ohne einen
// Importzyklus zu erzeugen, wohnen die reinen Polygonhelfer (polyBBox, inPoly,
// polyArea, polyCenter) jetzt hier; areas.js reicht sie unveraendert weiter,
// die bisherigen Importeure (selection.js, core/dirty.js) merken davon nichts.
// Dieselbe Zyklusfreiheit begruendet paths.js fuer geometry.js.
import { clamp, hashi, rngOf, rr, wpick } from '../core/rng.js';
// HALF/WATER sind LEBENDE Bindungen (siehe Kopf von core/store.js) — nur
// innerhalb von Funktionen lesen, nie beim Modulstart in eine Variable kopieren.
import { HALF, WATER } from '../core/store.js';
import { POOLS, emit, tintOf } from '../core/pools.js';
import { heightAt } from '../world/terrain.js';
import { newOcc, occAdd, tryPlace, tryPlaceUfer, KULTUR } from './objects.js';

/* ==========================================================================
   Polygon-Grundlagen (aus areas.js hierher gezogen, Wortlaut unveraendert)
   ========================================================================== */

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

/* ==========================================================================
   Gemeinsame Werkzeuge der drei Generatoren
   ========================================================================== */

/* Ortsstabiler Zufallsstrom — identisches Muster wie genViertel/genStrasse:
   der Strom haengt an einem STABILEN Indexpaar, nicht an der
   Zugriffsreihenfolge. Sonst wuerfelte jede geaenderte Schleifenlaenge (ein
   Punkt verschoben, ein Parameter gedreht) die gesamte restliche Bestueckung um.

   Schluesselblock dieser Datei (bisher unbenutzt; setzt die Serie fort, die
   vines.js mit +501..+529 und objects.js mit +531 begonnen haben):
     Burg    +601 Mauerstueck, +602 Ecke, +603 Turm, +604 Zwinger,
             +605 Torgruppe,  +607 Hofbauten, +611 Hofstreuung
     Werft   +641 Hellingachse, +643 Kai, +645 Landzeile, +647 Kleinkram
     Kloster +681 Arkadenjoch, +683 Kreuzgarten
   Ein Element ist immer NUR eine Variante, Kollisionen mit den Offsets in
   areas.js (+0..+93) sind damit ohnehin ausgeschlossen; der eigene Block macht
   das nur nachpruefbar.

   GRENZEN der Ortsstabilitaet, gemessen mit einem verschobenen Polygonpunkt
   (Testabzug Runde H, 256er-Karte):
     Burg    ~70 % der Instanzen bleiben stehen. Der Ring haengt an
             (Kantenindex, Jochindex) — nur die beruehrten Kanten rechnen neu,
             das Hofraster (Weltrasterzellen) bleibt vollstaendig.
     Werft   ~35 %. Die Kaiflucht ist definitionsgemaess eine Aussage ueber das
             GANZE Polygon (gewichtete Gradientensumme); dreht sie sich um ein
             Grad, wandert die ganze Anlage mit. Das ist der Preis dafuer, dass
             alles auf EINER Linie steht, und keine Schwaeche des Schluessels.
     Kloster ~0 %. Das Rechteck haengt an polyCenter und der projizierten
             Huellbox — dieselbe, in genFeld ausdruecklich vermerkte Grenze:
             jede Punktverschiebung ruecke alle Weltpositionen. Die Zuordnung
             Rasterindex -> Auswuerfelung bleibt davon unberuehrt, der Garten
             wird also verschoben und nicht neu gewuerfelt. */
function ortsRng(a, b, s) { return rngOf((hashi(a, b, s) * 4294967296) | 0); }

/**
 * Bauteillaenge eines Pools in Weltmetern. Die Wehrbau-, Kai- und
 * Arkaden-Pools sind durchgehend so definiert, dass `radius` die HALBE
 * Grundriss-Breite in x ist (mauerstueck 3.2 -> 1.6, zwingermauer 2.4 -> 1.2,
 * torhaus 7.2 -> 3.6, kaimauer 4.4 -> 2.2). Der Ring rechnet deshalb mit
 * radius*2 statt mit einer zweiten, danebenlaufenden Zahlentabelle, die bei
 * jeder Geometrieaenderung stillschweigend falsch wuerde.
 */
function bauLaenge(name) {
  var p = POOLS[name];
  return p ? p.radius * 2 : 2;
}

/**
 * Kanten des Polygons mit ihrer nach INNEN zeigenden Normalen.
 * Die Innenseite kommt aus der Umlaufrichtung (Shoelace), nicht aus einem
 * Schwerpunkt-Test: bei einer nicht konvexen Burgmauer liegt der Schwerpunkt
 * nicht zwingend auf der Hofseite jeder Kante, die Umlaufrichtung stimmt immer.
 */
function ringKanten(pts) {
  var a2 = 0, i;
  for (i = 0; i < pts.length; i++) {
    var q = pts[i], r = pts[(i + 1) % pts.length];
    a2 += q.x * r.z - r.x * q.z;
  }
  var links = a2 > 0;      // Umlauf gegen den Uhrzeigersinn -> innen liegt links
  var out = [];
  for (i = 0; i < pts.length; i++) {
    var A = pts[i], B = pts[(i + 1) % pts.length];
    var dx = B.x - A.x, dz = B.z - A.z;
    var len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.5) continue;                    // Doppelklick-Punkte ueberspringen
    dx /= len; dz /= len;
    out.push({
      ax: A.x, az: A.z, bx: B.x, bz: B.z,
      mx: (A.x + B.x) * 0.5, mz: (A.z + B.z) * 0.5,
      dx: dx, dz: dz, len: len,
      inX: links ? -dz : dz, inZ: links ? dx : -dx
    });
  }
  return out;
}

/** Kuerzester Abstand zum Polygonrand (fuer "wie tief im Hof liegt der Punkt"). */
function randAbstand(pts, x, z) {
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
  return Math.sqrt(best);
}

/** Innerhalb des Polygons oder hoechstens `tol` daneben. Die Werft baut auf
 *  der Wasserlinie, und die liegt selten exakt auf dem gezogenen Rand. */
function imBereich(pts, x, z, tol) {
  return inPoly(pts, x, z) || randAbstand(pts, x, z) <= tol;
}

/**
 * Setzt ein Bauteil der TRAGENDEN Struktur (Mauerjoch, Turm, Arkadenjoch).
 * Bewusst OHNE tryPlace: eine Mauer folgt dem gezeichneten Polygon, sie darf
 * nicht an einem Hangwinkel oder einem Belegungsradius ausfallen — sonst
 * klaffen Loecher im Ring. Genau dieselbe Begruendung wie in genMauer
 * (paths.js), das ebenfalls direkt emittiert. Der Belegungseintrag wird
 * trotzdem gesetzt: die SPAETERE Streuung im Hof soll den Ring meiden.
 */
function setzeBau(el, occ, kind, x, z, yaw, sx, sy, sz, tint) {
  if (!POOLS[kind]) return false;
  if (x < -HALF + 1 || x > HALF - 1 || z < -HALF + 1 || z > HALF - 1) return false;
  // Wie in genMauer: unter dem Wasserspiegel wuerde das Joch versinken.
  var y = Math.max(heightAt(x, z), WATER + 0.2);
  emit(el, kind, x, y - 0.15, z, yaw, sx, sy, sz, tint);
  if (occ) occAdd(occ, x, z, POOLS[kind].radius * 0.85);
  return true;
}

/** Rasterkandidaten im Polygoninneren, mindestens `saum` vom Rand entfernt.
 *  Grid-Index (cx, cz) statt Laufindex — er ist der ortsstabile Schluessel
 *  (Muster genWald/genWiese) und ueberlebt jede Aenderung der Polygonform. */
function innenRaster(pts, sp, saum) {
  var bb = polyBBox(pts), out = [];
  var c0 = Math.floor(bb.x0 / sp), c1 = Math.ceil(bb.x1 / sp);
  var d0 = Math.floor(bb.z0 / sp), d1 = Math.ceil(bb.z1 / sp);
  for (var cz = d0; cz <= d1; cz++) {
    for (var cx = c0; cx <= c1; cx++) {
      var x = (cx + 0.5) * sp, z = (cz + 0.5) * sp;
      if (!inPoly(pts, x, z)) continue;
      if (randAbstand(pts, x, z) < saum) continue;
      out.push({ cx: cx, cz: cz, x: x, z: z });
    }
  }
  return out;
}

/* ==========================================================================
   genBurg — Mauerring auf dem Polygonzug, Tor talseitig, Bergfried im Hof

   Ausrichtungskonvention des Wehrbau-Kits (geometry.js): ein Mauerjoch liegt
   mit seiner LAENGE auf der lokalen x-Achse, die Zinnen sitzen auf -z
   ("Merlonen nur auf der Feldseite"), der Wehrgang auf +z. Lokales +z ist also
   die HOFSEITE. Bei einer Drehung um yaw geht lokal +z nach (sin yaw, cos yaw)
   — mit yaw = atan2(inX, inZ) zeigt es exakt auf die Innennormale der Kante.
   Dieselbe Formel wie bei tryPlaceUfer (dort yaw = atan2(-dx, -dz), also
   "lokales +z blickt in die genannte Richtung"); sie ist die eine Regel, aus
   der hier ALLE Drehungen folgen.

   Zwei Pools sind bewusst andersherum gebaut und bekommen deshalb yaw + PI:
   `barbakane` (Halbschale baucht nach +z aus, Rueckwand und Hoframpe auf -z)
   und `zugbruecke` (Widerlager und Kettenzug auf -z, also zum Torhaus hin).
   ========================================================================== */

/* Steinburg und Holzburg als zwei Bestueckungen DERSELBEN Layout-Logik. Der
   Parameter `palisade` tauscht nur die Tabelle — jede Sonderbehandlung im Code
   waere ein zweiter Generator, der beim naechsten Umbau auseinanderliefe. */
var BURG_STEIN = {
  mauer: "mauerstueck", ecke: "mauerecke", turm: "wehrturm", schwer: "geschuetzturm",
  tor: "torhaus", kern: "bergfried", vor: "zwingermauer",
  hof: ["burgpalas", "burgkapelle", "burgkueche"], tabelle: "burg", steinbau: true
};
var BURG_HOLZ = {
  // Es gibt kein hoelzernes Eckstueck; der Wachturm IST die Ecke einer
  // Holzburg (und steht in den Vorlagen genau dort).
  mauer: "palisade", ecke: "wachturm", turm: "wachturm", schwer: "wachturm",
  tor: "palisadentor", kern: "wachturm", vor: "palisade",
  hof: ["langhaus", "kapelle", "scheune"], tabelle: "holzburg", steinbau: false
};

function genBurg(el) {
  var p = el.params, pts = el.points;
  var B = p.palisade ? BURG_HOLZ : BURG_STEIN;
  var kanten = ringKanten(pts);
  if (!kanten.length) return;
  var occ = newOcc(4.5);
  var mauerL = bauLaenge(B.mauer);
  var hoehe = p.mauerhoehe === undefined ? 1 : p.mauerhoehe;
  var i, k;

  /* --- Torkante: die talseitige, also die mit der niedrigsten mittleren
     Hoehe. Drei Stuetzstellen je Kante (Anfang, Mitte, Ende) reichen: gesucht
     ist die Kante, nicht ihr Profil. */
  var torI = 0, torBest = Infinity;
  for (i = 0; i < kanten.length; i++) {
    var e = kanten[i];
    var hm = (heightAt(e.ax, e.az) + heightAt(e.mx, e.mz) + heightAt(e.bx, e.bz)) / 3;
    if (hm < torBest) { torBest = hm; torI = i; }
  }
  var torL = bauLaenge(B.tor);

  /* --- Mauerjoche und Tuerme entlang der Kanten -------------------------
     Je Kante wird die Jochzahl gerundet und die Jochlaenge exakt darauf
     gestreckt (sx = step/mauerL). Dadurch stossen die Joche an den Ecken auf
     den Millimeter aneinander, egal wie der Nutzer das Polygon zieht. */
  var turmAbstand = Math.max(6, p.turmAbstand || 22);
  var strecke = 0, naechsterTurm = turmAbstand;
  for (i = 0; i < kanten.length; i++) {
    var kn = kanten[i];
    var yaw = Math.atan2(kn.inX, kn.inZ);
    var n = Math.max(1, Math.round(kn.len / mauerL));
    var step = kn.len / n;
    for (k = 0; k < n; k++) {
      var t = (k + 0.5) * step;
      var x = kn.ax + kn.dx * t, z = kn.az + kn.dz * t;
      // Torzone freihalten: halbe Torbreite plus ein halbes Joch Luft.
      if (i === torI && Math.abs(t - kn.len * 0.5) < torL * 0.5 + step * 0.5) continue;
      var rs = ortsRng(i, k, el.seed + 601);
      if (strecke + t >= naechsterTurm) {
        naechsterTurm += turmAbstand;
        // Der Turm ERSETZT das Joch, statt darin zu stecken: seine Breite
        // (wehrturm 4.4, geschuetzturm 5.2) ueberdeckt die Luecke ohnehin.
        var rt = ortsRng(i, k, el.seed + 603);
        var art = rt() < 0.3 ? B.schwer : B.turm;
        setzeBau(el, occ, art, x, z, yaw, 1, hoehe, 1, tintOf(rt, 0.04));
        continue;
      }
      setzeBau(el, occ, B.mauer, x, z, yaw, step / mauerL, hoehe, 1, tintOf(rs, 0.05));
    }
    strecke += kn.len;
  }

  /* --- Ecken -------------------------------------------------------------
     `mauerecke` hat einen Schenkel nach +x und einen nach +z, ihre Winkel-
     halbierende liegt also lokal auf (1,0,1)/sqrt(2). Nach der Drehung um yaw
     zeigt sie nach (sin(yaw+PI/4), cos(yaw+PI/4)); soll das die innere
     Winkelhalbierende b der Polygonecke sein, folgt yaw = atan2(bx,bz) - PI/4.
     Dass das Eckstueck starre 90 Grad hat, der Grundriss aber jeden Winkel
     zulaesst, ist die bewusste Naeherung — auf der Halbierenden sitzt sie
     symmetrisch falsch statt einseitig. */
  for (i = 0; i < kanten.length; i++) {
    var e1 = kanten[i], e0 = kanten[(i + kanten.length - 1) % kanten.length];
    var bx = e0.inX + e1.inX, bz = e0.inZ + e1.inZ;
    var bl = Math.sqrt(bx * bx + bz * bz);
    if (bl < 0.001) continue;                 // gestreckte Ecke: kein Eckstueck
    var re = ortsRng(i, 0, el.seed + 602);
    var yawE = B.steinbau ? Math.atan2(bx / bl, bz / bl) - Math.PI / 4
                          : Math.atan2(bx / bl, bz / bl);
    setzeBau(el, occ, B.ecke, e1.ax, e1.az, yawE, 1, hoehe, 1, tintOf(re, 0.04));
  }

  /* --- Zwinger: zweiter, niedrigerer Ring vor der Hauptmauer ------------- */
  if (p.zwinger) {
    var vorL = bauLaenge(B.vor), abstand = 3.6;
    for (i = 0; i < kanten.length; i++) {
      var kz = kanten[i];
      var yawZ = Math.atan2(kz.inX, kz.inZ);
      var nz = Math.max(1, Math.round(kz.len / vorL));
      var sz = kz.len / nz;
      for (k = 0; k < nz; k++) {
        var tz = (k + 0.5) * sz;
        // Vor dem Tor bleibt der Zwinger offen — sonst mauert er die Zufahrt zu.
        if (i === torI && Math.abs(tz - kz.len * 0.5) < torL * 0.6 + sz) continue;
        var zx = kz.ax + kz.dx * tz - kz.inX * abstand;
        var zz = kz.az + kz.dz * tz - kz.inZ * abstand;
        var rz = ortsRng(i, k, el.seed + 604);
        setzeBau(el, occ, B.vor, zx, zz, yawZ, sz / vorL, hoehe * 0.6, 1, tintOf(rz, 0.05));
      }
    }
  }

  /* --- Torgruppe --------------------------------------------------------- */
  var te = kanten[torI];
  var yawT = Math.atan2(te.inX, te.inZ);
  var outX = -te.inX, outZ = -te.inZ;
  var rg = ortsRng(torI, 0, el.seed + 605);
  setzeBau(el, occ, B.tor, te.mx, te.mz, yawT, 1, hoehe, 1, tintOf(rg, 0.04));
  // Liegt vor dem Tor Wasser oder ein Graben? Gemessen 5 m vor der Torachse:
  // entweder unter dem Wasserspiegel (Wassergraben) oder deutlich tiefer als
  // die Torschwelle (Trockengraben, Steilabfall).
  var hTor = heightAt(te.mx, te.mz);
  var hVor = heightAt(te.mx + outX * 5, te.mz + outZ * 5);
  var grabenDavor = hVor < WATER + 0.35 || hVor < hTor - 1.2;
  if (grabenDavor) {
    // yaw + PI: zugbruecke ist mit ihrem Kettenzug auf -z zum Torhaus gebaut.
    setzeBau(el, occ, "zugbruecke", te.mx + outX * 3.4, te.mz + outZ * 3.4,
      Math.atan2(outX, outZ), 1, 1, 1, tintOf(rg, 0.05));
    // Die Barbakane ist ein steinernes Aussenwerk — an einer Holzburg hat sie
    // nichts zu suchen; dort bleibt es beim Bruecken-Kopf.
    if (B.steinbau) {
      setzeBau(el, occ, "barbakane", te.mx + outX * 8, te.mz + outZ * 8,
        Math.atan2(outX, outZ), 1, 1, 1, tintOf(rg, 0.04));
    }
  }

  /* --- Hof ---------------------------------------------------------------
     Der Ring hat oben bereits occ-Kreise gelegt (siehe setzeBau); die Streuung
     kann ihn daher nicht mehr treffen. Genau das Muster, mit dem genViertel
     seine Gassen fuer die eigene Bebauung sperrt. */
  var flaeche = polyArea(pts);
  var saum = 4.5;
  var dichte = p.dichte === undefined ? 1 : p.dichte;
  // Rasterweite: Wunschwert aus der Dichte, aber nie so fein, dass ein grosser
  // Hof das Instanzbudget sprengt (gleicher Gedanke wie safeSpacing).
  var sp = Math.max(5.5 / dichte, Math.sqrt(flaeche / 400));
  var feld = innenRaster(pts, sp, saum);
  if (!feld.length) return;

  // Bergfried auf den hoechsten Punkt des Hofes — der Kanon des Katalogs
  // ("der Palas im Hof, der Bergfried oben").
  var top = feld[0], topH = -Infinity;
  for (i = 0; i < feld.length; i++) {
    var fh = heightAt(feld[i].x, feld[i].z);
    if (fh > topH) { topH = fh; top = feld[i]; }
  }
  var rk = ortsRng(top.cx, top.cz, el.seed + 607);
  var kernR = POOLS[B.kern] ? POOLS[B.kern].radius * 0.85 : 2.5;
  var hk = tryPlace(occ, top.x, top.z, kernR, { ignoreCorridor: true });
  if (hk !== null) {
    emit(el, B.kern, top.x, hk - 0.15, top.z, rk() * 6.28,
      1, B.steinbau ? 1 : 1.25, 1, tintOf(rk, 0.04));
  }

  /* Palas, Kapelle, Kueche verteilen: je Bau ein ortsstabiler Startindex im
     Rasterfeld, dann vorwaerts zyklisch bis der erste Platz frei ist. Der
     Startindex haengt nur an (Bauindex, seed) — die Verteilung bleibt also
     stehen, wenn der Nutzer die Dichte dreht, und wandert nicht mit. */
  for (k = 0; k < B.hof.length; k++) {
    var kind = B.hof[k];
    if (!POOLS[kind]) continue;
    var start = Math.floor(hashi(k, 1, el.seed + 607) * feld.length) % feld.length;
    for (var q = 0; q < feld.length; q++) {
      var c = feld[(start + q) % feld.length];
      var rb = ortsRng(c.cx, c.cz, el.seed + 607);
      var hb = tryPlace(occ, c.x, c.z, POOLS[kind].radius * 0.9, { ignoreCorridor: true });
      if (hb === null) continue;
      var sb = rr(rb, 0.92, 1.08);
      emit(el, kind, c.x, hb - 0.15, c.z, rb() * 6.28, sb, sb, sb, tintOf(rb, 0.05));
      break;
    }
  }

  // Restlicher Hof: Streuung aus der Kulturtabelle. Bewusst OHNE
  // ignoreCorridor — eine Strasse, die durch das Tor in den Hof laeuft, soll
  // ihre Spur behalten.
  var tab = KULTUR[B.tabelle] || KULTUR.burg;
  for (i = 0; i < feld.length; i++) {
    var z0 = feld[i];
    var rs2 = ortsRng(z0.cx, z0.cz, el.seed + 611);
    if (rs2() > 0.55 * dichte) continue;
    var art2 = wpick(rs2, tab);
    if (!POOLS[art2]) continue;
    var h2 = tryPlace(occ, z0.x, z0.z, POOLS[art2].radius * 0.85, null);
    if (h2 === null) continue;
    var s2 = rr(rs2, 0.85, 1.15);
    emit(el, art2, z0.x, h2 - 0.12, z0.z, rs2() * 6.28, s2, s2, s2, tintOf(rs2));
  }
}

/* ==========================================================================
   genWerft — alles auf EINE gemeinsame Kaiflucht

   Ausrichtungsmathematik (der Kern dieses Generators):
   1. Ueber das Polygon laeuft ein 25x25-Raster (fester Deckel — die Achse
      braucht keine feine Abtastung, nur eine stabile). An jedem Punkt steht
      der Hoehengradient per Zentraldifferenz ueber 4 m, exakt wie in
      tryPlaceUfer/dorfUfer.
   2. Die Gradienten werden mit 1/(1+|h-WATER|) gewichtet aufsummiert. Das
      Gewicht zieht das Ergebnis auf die Uferzone: Punkte weit oben am Hang
      oder tief im Becken beschreiben eine andere Neigung als die Kaiflucht.
      Summiert wird der VEKTOR, nicht der Winkel — eine Winkelmittelung waere
      an der +-PI-Naht falsch, und gegenlaeufige Haenge sollen sich hier
      ausdruecklich aufheben.
   3. wYaw = atan2(-gx, -gz). Damit zeigt das lokale +z jeder Instanz bergab,
      also aufs Wasser — genau die Konvention, in der die Hafen-Pools gebaut
      sind (kaimauer: Kaikante und Anlegeringe auf +z; slipbahn: "faellt nach
      +z ins Wasser"; werfthalle: offene Giebelseite zum Wasser auf +z).
   4. Daraus der Rahmen: w = (sin wYaw, cos wYaw) = Richtung Wasser (lokal +z),
      u = (cos wYaw, -sin wYaw) = laengs der Kaiflucht (lokal +x). Alle
      Bauteile werden in (a laengs, b quer) angegeben und erst zum Schluss
      nach Welt umgerechnet — damit ist "senkrecht zur Wasserlinie" keine
      Absicht, sondern eine Koordinate.
   5. Ursprung O = der Punkt auf der Achse durch die Polygonmitte, an dem die
      Hoehe der Wasserlinie am naechsten kommt (1-m-Suche, danach 0.1-m-
      Nachsuche). Auf O sitzt b = 0.
   ========================================================================== */

/** Kleinkram der Werft. Streuware hoch, alles andere niedrig — dasselbe
 *  Gewichtsprinzip wie in OBJGRUPPEN. */
var WERFT_KRAM = [["holzstapel", 5], ["tauhaufen", 5], ["fass", 2], ["kiste", 2],
  ["reusenstapel", 2], ["netzgestell", 2]];

function werftAchse(el) {
  var pts = el.points;
  if (pts.length < 3) return null;
  var bb = polyBBox(pts), ctr = polyCenter(pts);
  var bw = bb.x1 - bb.x0, bd = bb.z1 - bb.z0;
  if (!(bw > 1) || !(bd > 1)) return null;
  var N = 24, gx = 0, gz = 0, i, j, x, z;
  for (j = 0; j <= N; j++) {
    for (i = 0; i <= N; i++) {
      x = bb.x0 + bw * (i / N); z = bb.z0 + bd * (j / N);
      if (!inPoly(pts, x, z)) continue;
      var g = 1 / (1 + Math.abs(heightAt(x, z) - WATER));
      gx += (heightAt(x + 2, z) - heightAt(x - 2, z)) * g;
      gz += (heightAt(x, z + 2) - heightAt(x, z - 2)) * g;
    }
  }
  var yaw;
  if (Math.sqrt(gx * gx + gz * gz) < 1e-9) {
    // Voellig ebenes Gelaende: dann gibt es keine Wasserlinie, die man messen
    // koennte. Ersatzregel — die laengste Polygonkante IST die Kaiflucht, das
    // Wasser liegt auf ihrer Aussenseite.
    var kn = ringKanten(pts), best = null;
    for (i = 0; i < kn.length; i++) if (!best || kn[i].len > best.len) best = kn[i];
    if (!best) return null;
    yaw = Math.atan2(-best.inX, -best.inZ);
  } else {
    yaw = Math.atan2(-gx, -gz);
  }
  var wx = Math.sin(yaw), wz = Math.cos(yaw);
  var ux = Math.cos(yaw), uz = -Math.sin(yaw);

  // Ursprung: entlang der Wasserrichtung durch die Mitte den Punkt suchen, der
  // der Wasserlinie am naechsten kommt. Die Suche bleibt in der Huellbox — nur
  // so deckt elementBox (core/dirty.js) den Korridorstempel sicher ab.
  var reich = Math.max(bw, bd);
  var ox = ctr.x, oz = ctr.z, bestE = Infinity, t, e;
  for (t = -reich; t <= reich; t += 1) {
    x = ctr.x + wx * t; z = ctr.z + wz * t;
    if (x < bb.x0 - 2 || x > bb.x1 + 2 || z < bb.z0 - 2 || z > bb.z1 + 2) continue;
    e = Math.abs(heightAt(x, z) - WATER);
    if (e < bestE) { bestE = e; ox = x; oz = z; }
  }
  for (t = -1; t <= 1; t += 0.1) {          // Nachsuche im 0.1-m-Raster
    x = ox + wx * t; z = oz + wz * t;
    e = Math.abs(heightAt(x, z) - WATER);
    if (e < bestE) { bestE = e; ox = x; oz = z; }
  }
  // Reichweite der Kaiflucht: vom Ursprung nach beiden Seiten, solange das
  // Polygon traegt. Sie begrenzt Kai, Landzeile und Korridorstempel.
  var halbA = 0;
  for (t = 1; t <= reich; t += 1) {
    if (!imBereich(pts, ox + ux * t, oz + uz * t, 2) &&
        !imBereich(pts, ox - ux * t, oz - uz * t, 2)) break;
    halbA = t;
  }
  return { yaw: yaw, wx: wx, wz: wz, ux: ux, uz: uz, ox: ox, oz: oz,
           halbA: Math.max(6, halbA) };
}

/**
 * Querversatz der Wasserlinie an der Station a.
 *
 * Die Kaiflucht — also der YAW, auf den sich laut Katalog alles ausrichten
 * muss — bleibt global; nur der NULLPUNKT der Querachse folgt der
 * tatsaechlichen Kueste. Ohne das steht eine Werft an einer gekruemmten Bucht
 * zur Haelfte im Wasser und zur Haelfte am Hang: tryPlaceUfer laesst nur ein
 * 1.6 m hohes Band gelten, und ein paar Grad Kruemmung ueber 30 m Kailaenge
 * verlassen es sicher. Gemessen wird in 0.75-m-Schritten ueber +-12 m; feiner
 * braucht es nicht, das Uferband ist breiter als der Suchschritt.
 */
function uferVersatz(A, a) {
  var bestB = 0, bestE = Infinity;
  for (var b = -12; b <= 12; b += 0.75) {
    var e = Math.abs(heightAt(A.ox + A.ux * a + A.wx * b,
                              A.oz + A.uz * a + A.wz * b) - WATER);
    if (e < bestE) { bestE = e; bestB = b; }
  }
  return bestB;
}

/** Rahmenkoordinate (a laengs Kai, b quer, positiv Richtung Wasser) -> Welt.
 *  b = 0 ist immer die Wasserlinie an DIESER Station, nicht am Ursprung. */
function werftPunkt(A, a, b) {
  var bb = b + uferVersatz(A, a);
  return { x: A.ox + A.ux * a + A.wx * bb, z: A.oz + A.uz * a + A.wz * bb };
}

/**
 * Uferbauteil. tryPlaceUfer wird NUR als Praedikat benutzt (liegt der Punkt im
 * Uferband, ist er frei, wie hoch ist er) — sein `yaw` folgt dem LOKALEN
 * Gradienten und wird hier verworfen: die Werft richtet sich definitionsgemaess
 * auf EINE gemeinsame Kaiflucht aus, sonst stuenden Kran, Kai und Slipbahn
 * jeweils ein paar Grad gegeneinander verdreht.
 */
function uferBau(el, A, occ, pts, kind, a, b, tint) {
  if (!POOLS[kind]) return false;
  var q = werftPunkt(A, a, b);
  if (!imBereich(pts, q.x, q.z, 6)) return false;
  var u = tryPlaceUfer(occ, q.x, q.z, POOLS[kind].radius * 0.8);
  if (!u) return false;
  emit(el, kind, q.x, u.h - 0.1, q.z, A.yaw, 1, 1, 1, tint);
  return true;
}

/** Landbauteil derselben Flucht. ignoreCorridor, weil der Kaistempel dieses
 *  Elements sein EIGENER ist — er darf die eigene Anlage nicht ausduennen. */
function landBau(el, A, occ, pts, kind, a, b, tint) {
  if (!POOLS[kind]) return false;
  var q = werftPunkt(A, a, b);
  if (!imBereich(pts, q.x, q.z, 6)) return false;
  var h = tryPlace(occ, q.x, q.z, POOLS[kind].radius * 0.85, { ignoreCorridor: true });
  if (h === null) return false;
  emit(el, kind, q.x, h - 0.12, q.z, A.yaw, 1, 1, 1, tint);
  return true;
}

function genWerft(el) {
  var p = el.params, pts = el.points;
  var A = werftAchse(el);
  if (!A) return;
  var occ = newOcc(4);
  var i, k, a;

  /* --- Hellingen: senkrecht zur Wasserlinie, also entlang b ---------------
     b = +0.8  Slipbahn (Fuss im Wasser, Widerlager an Land)
     b = -5.2  Helling mit dem Rumpf auf den Kielpallen
     b = -13.5 Werfthalle, offene Giebelseite auf die Helling zu
     Die Zahlen sind die halben Bautiefen aus geometry.js plus zwei Meter
     Arbeitsgang, nicht gegriffen: helling 6.6 lang, werfthalle 8.0 tief. */
  var n = clamp(Math.round(p.hellingen || 2), 1, 4);
  var spur = 11;
  for (k = 0; k < n; k++) {
    a = (k - (n - 1) / 2) * spur;
    var rh = ortsRng(k, 0, el.seed + 641);
    uferBau(el, A, occ, pts, "slipbahn", a, 0.8, tintOf(rh, 0.05));
    landBau(el, A, occ, pts, "helling", a, -5.2, tintOf(rh, 0.05));
    landBau(el, A, occ, pts, "werfthalle", a, -13.5, tintOf(rh, 0.04));
  }

  /* --- Kai: beidseits der Hellingen, laengs der Wasserlinie --------------
     Takt statt Wuerfel: eine Kaimauer lebt von der Wiederholung, gewuerfelte
     Abstaende liessen sie zufaellig aussehen. Die Kaitreppe ERSETZT das dritte
     Joch, statt daneben zu stehen — sie ist in die Mauer eingelassen, und ein
     zweites Bauteil auf derselben Station scheiterte ohnehin am
     Belegungsraster (dieselbe Loesung wie Turm statt Mauerjoch in genBurg).
     Der Kran steht auf LUECKE zwischen zwei Jochen und einen Schritt
     landeinwaerts — dort traegt der Kai, und dort ist Platz. */
  var kaiL = bauLaenge("kaimauer");
  var kaiStart = (n - 1) * 0.5 * spur + 7;
  var m = p.kai ? Math.max(0, Math.floor((A.halbA - kaiStart) / kaiL)) : 0;
  for (var seite = -1; seite <= 1; seite += 2) {
    for (i = 0; i < m; i++) {
      a = seite * (kaiStart + (i + 0.5) * kaiL);
      var rk = ortsRng(i, seite < 0 ? 0 : 1, el.seed + 643);
      uferBau(el, A, occ, pts, i % 3 === 2 ? "kaitreppe" : "kaimauer", a, 0, tintOf(rk, 0.04));
      if (i % 4 === 1) {
        landBau(el, A, occ, pts, "kaikran", a + seite * kaiL * 0.5, -3.6, tintOf(rk, 0.05));
      }
    }
    if (m > 0) {
      var ra = ortsRng(m, seite < 0 ? 0 : 1, el.seed + 643);
      uferBau(el, A, occ, pts, "anleger", seite * (kaiStart + m * kaiL + 2.5), 1.2,
        tintOf(ra, 0.05));
    }
  }
  // Bootshaus in die Luecke zwischen aeusserster Helling und Kaianfang — die
  // einzige Station der Flucht, die sonst leer bliebe, und weit genug von
  // beiden Nachbarn, dass das Belegungsraster sie durchlaesst.
  var rb = ortsRng(0, 2, el.seed + 643);
  uferBau(el, A, occ, pts, "bootshaus", -(kaiStart - 2.5), 0.6, tintOf(rb, 0.05));

  /* --- Landzeile: Lagerhaus und Seilerbahn parallel zum Kai ---------------
     Beide sind mit ihrer Laengs- bzw. Schauseite auf x/+z gebaut (Seilerbahn:
     Seile laufen in x; Lagerhaus: Fachwerk und Ladeluke auf +z) — mit A.yaw
     stehen sie damit automatisch in der Flucht statt quer dazu. */
  var zeile = Math.min(8, Math.floor(A.halbA / 8) * 2 + 1);
  for (i = 0; i < zeile; i++) {
    a = (i - (zeile - 1) / 2) * 8;
    var rz = ortsRng(i, 0, el.seed + 645);
    if (Math.abs(a) < kaiStart - 8) continue;         // Platz fuer die Hellingen
    landBau(el, A, occ, pts, rz() < 0.55 ? "lagerhaus" : "seilerbahn", a, -9.5,
      tintOf(rz, 0.05));
  }

  /* --- Kleinkram ---------------------------------------------------------
     Ueber das ganze Polygon, aber ohne ignoreCorridor: der Kaistempel und eine
     zufuehrende Strasse bleiben frei. */
  var dichte = p.dichte === undefined ? 1 : p.dichte;
  var flaeche = polyArea(pts);
  var sp = Math.max(4.5 / dichte, Math.sqrt(flaeche / 500));
  var feld = innenRaster(pts, sp, 1.5);
  for (i = 0; i < feld.length; i++) {
    var c = feld[i];
    var rs = ortsRng(c.cx, c.cz, el.seed + 647);
    if (rs() > 0.4 * dichte) continue;
    var art = wpick(rs, WERFT_KRAM);
    if (!POOLS[art]) continue;
    var h = tryPlace(occ, c.x, c.z, POOLS[art].radius * 0.85, null);
    if (h === null) continue;
    var s = rr(rs, 0.85, 1.2);
    emit(el, art, c.x, h - 0.08, c.z, rs() * 6.28, s, s, s, tintOf(rs));
  }
}

/* ==========================================================================
   genKloster — rechteckiger Arkadenhof mit geschlossenen Ecken

   Der Rahmen kommt aus den ERSTEN BEIDEN Punkten (sie geben die Achse und
   damit die Drehung des Hofes vor, wie `drehung` beim Feld) und aus der auf
   diese Achse projizierten Huellbox aller Punkte (sie gibt die Kantenlaengen).
   Damit ist der Hof gedreht zeichenbar, ohne dass ein zweiter Parameter noetig
   waere — und ohne dass eine achsparallele Bounding-Box ein schief gezogenes
   Polygon zu einem viel zu grossen Quadrat aufblaehte.

   Ausrichtung: e1 = Achse (lokal x), e2 = (-e1z, e1x) (lokal z). Ein
   Arkadenjoch (`arkade`) hat seine Saeulenreihe auf +z — mit
   yaw = atan2(inX, inZ) blickt die offene Seite jedes Fluegels in den Hof,
   dieselbe Formel wie beim Burgmauerring.

   Geschlossene Ecken: die beiden Fluegel laengs e1 laufen um die halbe
   Bautiefe UEBER die Ecke hinaus, die Fluegel laengs e2 enden entsprechend
   frueher. Das Eckjoch gehoert damit eindeutig zu einem Fluegel — genau so
   loest es ein realer Kreuzgang, und es braucht kein Eck-Sonderteil.
   ========================================================================== */

var KLOSTER_GARTEN = [["gartenbeet", 5], ["obstbaum", 3], ["zypresse", 3],
  ["busch", 3], ["baum", 2], ["bank", 2], ["bildstock", 1], ["brunnentrog", 1]];

/** Orientierter Rechteckrahmen des Klosters. Rein geometrisch, kein Zufall —
 *  deshalb auch von core/dirty.js fuer den Korridorstempel benutzbar. */
function klosterRahmen(el) {
  var pts = el.points, p = el.params;
  if (pts.length < 3) return null;
  var e1x = 1, e1z = 0;
  var dx = pts[1].x - pts[0].x, dz = pts[1].z - pts[0].z;
  var L = Math.sqrt(dx * dx + dz * dz);
  if (L > 0.001) { e1x = dx / L; e1z = dz / L; }
  var e2x = -e1z, e2z = e1x;
  var ctr = polyCenter(pts);
  var a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
  for (var i = 0; i < pts.length; i++) {
    var qx = pts[i].x - ctr.x, qz = pts[i].z - ctr.z;
    var a = qx * e1x + qz * e1z, b = qx * e2x + qz * e2z;
    if (a < a0) a0 = a;
    if (a > a1) a1 = a;
    if (b < b0) b0 = b;
    if (b > b1) b1 = b;
  }
  var g = p && p.groesse ? p.groesse : 1;
  // Untergrenze 8: unter zwei Arkadenjochen je Seite ist es kein Hof mehr.
  // Obergrenze 60: darueber wuerde ein Fehlklick eine halbe Karte zubauen.
  var A = clamp((a1 - a0) * 0.5 * g, 8, 60);
  var B = clamp((b1 - b0) * 0.5 * g, 8, 60);
  var mx = ctr.x + e1x * (a0 + a1) * 0.5 + e2x * (b0 + b1) * 0.5;
  var mz = ctr.z + e1z * (a0 + a1) * 0.5 + e2z * (b0 + b1) * 0.5;
  return { e1x: e1x, e1z: e1z, e2x: e2x, e2z: e2z, mx: mx, mz: mz, A: A, B: B };
}

/** Die vier Fluegel als Mittellinien: Mitte, Laufrichtung, Laenge und die
 *  nach innen (in den Hof) zeigende Normale. Tiefe = Bautiefe der Arkade. */
function klosterFluegel(R, tiefe) {
  var out = [];
  var s;
  // Laengs e1 (bei b = +-B): laufen um tiefe/2 ueber die Ecke -> Ecke zu.
  for (s = -1; s <= 1; s += 2) {
    out.push({
      cx: R.mx + R.e2x * (s * R.B), cz: R.mz + R.e2z * (s * R.B),
      dx: R.e1x, dz: R.e1z, len: 2 * R.A + tiefe,
      inX: -s * R.e2x, inZ: -s * R.e2z
    });
  }
  // Laengs e2 (bei a = +-A): enden entsprechend frueher.
  for (s = -1; s <= 1; s += 2) {
    out.push({
      cx: R.mx + R.e1x * (s * R.A), cz: R.mz + R.e1z * (s * R.A),
      dx: R.e2x, dz: R.e2z, len: Math.max(2, 2 * R.B - tiefe),
      inX: -s * R.e1x, inZ: -s * R.e1z
    });
  }
  return out;
}

function genKloster(el) {
  var p = el.params;
  var R = klosterRahmen(el);
  if (!R) return;
  var occ = newOcc(4);
  var jochL = bauLaenge("arkade");
  var tiefe = 2.6;                                  // z-Ausdehnung von geoArkade
  var fl = klosterFluegel(R, tiefe);
  var i, k;

  /* --- Vier Arkadenfluegel ------------------------------------------------ */
  for (i = 0; i < fl.length; i++) {
    var f = fl[i];
    var yaw = Math.atan2(f.inX, f.inZ);
    var n = Math.max(1, Math.round(f.len / jochL));
    var step = f.len / n;
    for (k = 0; k < n; k++) {
      var t = (k + 0.5) * step - f.len * 0.5;
      var x = f.cx + f.dx * t, z = f.cz + f.dz * t;
      var rj = ortsRng(i, k, el.seed + 681);
      setzeBau(el, occ, "arkade", x, z, yaw, step / jochL, 1, 1, tintOf(rj, 0.04));
    }
  }

  /* --- Kirche an der Nordseite ------------------------------------------
     Norden ist -z in Weltkoordinaten; gesucht ist also der Fluegel, dessen
     Mittelpunkt am weitesten im Minus-z liegt. Die Kirche steht AUSSERHALB
     dieses Fluegels (sie bildet den Nordriegel der Anlage) und laeuft mit
     ihrem Schiff parallel dazu: kathedralenschiff ist 9.0 lang in z, also
     dreht lokal +z auf die Fluegelrichtung. */
  var nordI = 0;
  for (i = 1; i < fl.length; i++) if (fl[i].cz < fl[nordI].cz) nordI = i;
  var nf = fl[nordI];
  var kirche = p.kirche === "kathedrale" ? "kathedralenschiff" : "kapelle";
  var kR = POOLS[kirche] ? POOLS[kirche].radius : 2;
  var kx = nf.cx - nf.inX * (tiefe * 0.5 + kR * 0.75);
  var kz = nf.cz - nf.inZ * (tiefe * 0.5 + kR * 0.75);
  var rki = ortsRng(nordI, 0, el.seed + 681);
  setzeBau(el, occ, kirche, kx, kz, Math.atan2(nf.dx, nf.dz), 1, 1, 1, tintOf(rki, 0.03));

  /* --- Glockenturm an einer Ecke der Kirchenseite -------------------------
     Deterministisch die westlichere der beiden Ecken (kleineres x) — kein
     Wuerfeln noetig, die Geometrie gibt die Antwort schon her. */
  var eA = { x: nf.cx + nf.dx * (nf.len * 0.5 - tiefe * 0.5),
             z: nf.cz + nf.dz * (nf.len * 0.5 - tiefe * 0.5) };
  var eB = { x: nf.cx - nf.dx * (nf.len * 0.5 - tiefe * 0.5),
             z: nf.cz - nf.dz * (nf.len * 0.5 - tiefe * 0.5) };
  var ecke = eA.x <= eB.x ? eA : eB;
  var rgt = ortsRng(nordI, 1, el.seed + 681);
  setzeBau(el, occ, "glockenturm", ecke.x, ecke.z, rgt() * 6.28, 1, 1, 1, tintOf(rgt, 0.03));

  /* --- Kreuzgarten -------------------------------------------------------
     Brunnen in der Mitte (der Brunnen IST die Mitte eines Kreuzgangs), Beete
     und Baeume ringsum. Das Raster laeuft in Rahmenkoordinaten, damit es mit
     dem Hof mitdreht; Schluessel sind die Rasterindizes, nicht der Laufindex. */
  var rbr = ortsRng(0, 0, el.seed + 683);
  var hB = tryPlace(occ, R.mx, R.mz, 1.1, { ignoreCorridor: true });
  if (hB !== null) emit(el, "brunnen", R.mx, hB - 0.1, R.mz, rbr() * 6.28, 1, 1, 1, tintOf(rbr, 0.04));

  var garten = p.garten === undefined ? 0.5 : p.garten;
  if (garten <= 0) return;
  var sp = 3.4 + (1 - clamp(garten, 0, 1)) * 5;
  var innenA = Math.max(0, R.A - tiefe), innenB = Math.max(0, R.B - tiefe);
  var na = Math.floor(innenA / sp), nb = Math.floor(innenB / sp);
  for (var ia = -na; ia <= na; ia++) {
    for (var ib = -nb; ib <= nb; ib++) {
      var ra = ortsRng(ia, ib, el.seed + 683);
      if (ra() > 0.35 + garten * 0.55) continue;
      // Leichter Versatz im Raster, sonst steht der Garten in Reih und Glied.
      var aa = ia * sp + rr(ra, -0.35, 0.35) * sp;
      var bb2 = ib * sp + rr(ra, -0.35, 0.35) * sp;
      if (Math.abs(aa) > innenA || Math.abs(bb2) > innenB) continue;
      var gx = R.mx + R.e1x * aa + R.e2x * bb2;
      var gz = R.mz + R.e1z * aa + R.e2z * bb2;
      var art = wpick(ra, KLOSTER_GARTEN);
      if (!POOLS[art]) continue;
      var hg = tryPlace(occ, gx, gz, POOLS[art].radius * 0.8, null);
      if (hg === null) continue;
      var sg = rr(ra, 0.8, 1.2);
      emit(el, art, gx, hg - 0.08, gz, ra() * 6.28, sg, sg, sg, tintOf(ra));
    }
  }
}

/* ==========================================================================
   Korridorstempel der Strukturen (fuer core/dirty.js)

   Mauerring, Kaiflucht und Kreuzgangfluegel sind harte Infrastruktur: dort
   soll spaeter kein fremder Wald und keine fremde Streuung mehr hineinwachsen
   — dieselbe Rolle, die die Gassen eines Viertels haben. Die Radien stehen
   hier und nicht in dirty.js, weil sie aus der Bauteilbreite folgen; dirty.js
   liest sie ueber KORRIDOR_R fuer stempelRadius/elementBox mit.

   Alle gelieferten Punkte liegen innerhalb der Punkt-Huellbox des Elements
   (der Ring IST das Polygon, die Kaiflucht wird in werftAchse auf die Box
   geklemmt, das Klosterrechteck entsteht aus den projizierten Punkten und
   waechst hoechstens mit `groesse`) — elementBox deckt sie damit ab.
   ========================================================================== */
var KORRIDOR_R = { burg: 2.6, werft: 3.2, kloster: 2.2 };
/* `groesse` kann das Klosterrechteck ueber die Punkt-Huellbox hinaus dehnen.
   Der Deckel steht hier, damit stempelRadius denselben Aufschlag einrechnen
   kann; ohne ihn bliebe beim Verkleinern ein Rest der alten Lage stehen. */
var KLOSTER_MAX_GROESSE = 2;
/* Maximaler Querversatz, den uferVersatz auf die Kaiflucht legen kann. Die
   Kaistempel koennen damit bis zu diesem Betrag ueber die Punkt-Huellbox
   hinausrutschen — stempelRadius schlaegt ihn deshalb auf. */
var WERFT_QUERSUCHE = 12;

function strukturKorridore(el) {
  var out = [], i, t;
  if (!el.points || el.points.length < 3) return out;
  if (el.variant === "burg") {
    var kanten = ringKanten(el.points);
    var r = KORRIDOR_R.burg * (el.params.zwinger ? 1.9 : 1);
    for (i = 0; i < kanten.length; i++) {
      var k = kanten[i];
      for (t = 0; t <= k.len; t += 2) {
        // Bei Zwinger liegt die Stempelmitte zwischen beiden Ringen.
        var vers = el.params.zwinger ? -1.8 : 0;
        out.push({ x: k.ax + k.dx * t + k.inX * vers, z: k.az + k.dz * t + k.inZ * vers, r: r });
      }
    }
  } else if (el.variant === "werft") {
    var A = werftAchse(el);
    if (!A) return out;
    // Ueber werftPunkt, damit der Stempel auf der TATSAECHLICHEN Kaiflucht
    // liegt (mit dem Querversatz je Station) und nicht auf der Ideallinie
    // durch den Ursprung — sonst sperrte er neben dem Kai statt auf ihm.
    for (t = -A.halbA; t <= A.halbA; t += 2) {
      var q = werftPunkt(A, t, 0);
      out.push({ x: q.x, z: q.z, r: KORRIDOR_R.werft });
    }
  } else if (el.variant === "kloster") {
    var R = klosterRahmen(el);
    if (!R) return out;
    var fl = klosterFluegel(R, 2.6);
    for (i = 0; i < fl.length; i++) {
      var f = fl[i];
      for (t = -f.len * 0.5; t <= f.len * 0.5; t += 2) {
        out.push({ x: f.cx + f.dx * t, z: f.cz + f.dz * t, r: KORRIDOR_R.kloster });
      }
    }
  }
  return out;
}

/** Ist diese Flaechenvariante eine Kompositstruktur? Eine Stelle, damit
 *  areas.js, dirty.js und tools.js nicht drei Listen fuehren. */
function istStruktur(variant) {
  return variant === "burg" || variant === "werft" || variant === "kloster";
}

export { polyBBox, inPoly, polyArea, polyCenter, randAbstand,
  ringKanten, klosterRahmen, klosterFluegel, werftAchse,
  genBurg, genWerft, genKloster,
  strukturKorridore, istStruktur, KORRIDOR_R, KLOSTER_MAX_GROESSE, WERFT_QUERSUCHE };
