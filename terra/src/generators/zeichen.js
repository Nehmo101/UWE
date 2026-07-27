/* ==========================================================================
   Kartenzeichen fuer die Generatoren (Runde I1, vierter Teilschritt)

   Entwurf: docs/engineering/terra-signaturenkatalog.md

   render/signaturen.js kennt die Zeichen, ihre Baender, ihre Groessen und
   ihren Atlas. Es kennt aber keine Elemente, keine Pfade und kein Gelaende —
   und es darf sie auch nicht kennen, sonst entstuende genau der Zyklus, den
   sein Kopfkommentar beschreibt.

   Diese Datei ist die fehlende Haelfte: sie uebersetzt „diese Sache liegt
   hier" in emit()-Aufrufe und Bandgeometrie. Sie steht zwischen den
   Generatoren und der Darstellung und wird von paths.js, objects.js,
   strukturen.js und vines.js geteilt.

   --- Warum ein eigenes Modul und keine vierte Kopie ---------------------
   generators/areas.js hat denselben Bedarf zuerst gehabt und traegt seine
   Helfer (flaechenZeichen, ortsZeichen, alsKoerper, alsZeichen) deshalb bei
   sich. Vier weitere Generatoren mit demselben Bedarf sind der Punkt, an dem
   aus „bei sich" ein Modul wird: alsKoerper/alsZeichen entscheiden ueber die
   Uebergabe zwischen den beiden Bildsprachen, und wenn diese Entscheidung an
   fuenf Stellen steht, laeuft sie beim naechsten Verschieben der Uebergabe an
   fuenf Stellen auseinander. `flaechenZeichen` und `ortsZeichen` aus areas.js
   gehoeren aus demselben Grund hierher — der Umzug ist ein Dreizeiler in
   areas.js und steht im Bericht, nicht in diesem Zweig.

   --- Was hier NICHT steht ----------------------------------------------
   Keine Zeichnung, kein Atlasfeld, keine Bandgrenze: das ist alles
   render/signaturen.js. Diese Datei rechnet ausschliesslich Weltkoordinaten.
   ========================================================================== */
import * as THREE from 'three';
import { clamp, lerp } from '../core/rng.js';
import { S, KARTE, WATER, groupOf } from '../core/store.js';
import { emit } from '../core/pools.js';
import { heightAt } from '../world/terrain.js';
import { terraMat } from '../render/materials.js';
import { zeichenFuer, zeichenDaten, signaturPlatzierung, atlasStreifenUV,
  holeSignaturAtlas, UEBERGABE, BLENDE } from '../render/signaturen.js';


/* ==========================================================================
   1 — Die Uebergabe zwischen Koerper und Zeichen

   Wortgleich zu areas.js, und das ist Absicht: solange beide Fassungen
   existieren, muessen sie dieselbe Zahl benutzen. Sie tun es, weil beide
   UEBERGABE.koerper und BLENDE aus signaturen.js lesen und keine eigene
   Konstante fuehren.
   ========================================================================== */

/** Zeichnet der Generator noch Koerper? Unterhalb der Uebergabe immer, im
 *  Ueberblendbereich weiter mit — sonst risse ein Loch, wo beide
 *  Darstellungen ineinanderblenden sollen. */
function alsKoerper(m) { return m <= UEBERGABE.koerper * BLENDE; }
/** Zeichnet der Generator Kartenzeichen? Ab der Uebergabe. */
function alsZeichen(m) { return m >= UEBERGABE.koerper; }

/**
 * Platzierung eines Zeichens auf DIESER Karte.
 *
 * Der Massstab entscheidet, OB ein Zeichen erscheint; die Kartenkante,
 * wie gross es ist. Das Biom entscheidet ueber die Tinte — eine
 * Waldsignatur liegt im Nadelwaldbiom in dessen Gruen. `S.biom` wird
 * deshalb mitgereicht und nicht (wie in areas.js) weggelassen; ohne ihn
 * faellt signaturTint auf die Wiesenpalette zurueck, und die Karte traegt
 * in jedem Biom dieselben Farben.
 */
function kartenPlatz(name, opt) {
  opt = opt || {};
  return signaturPlatzierung(name, {
    massstab: S.einheitMeter,
    kante: KARTE.map,
    biom: opt.biom === undefined ? S.biom : opt.biom,
    skala: opt.skala,
    dreh: opt.dreh
  });
}


/* ==========================================================================
   2 — Punktzeichen: aus vielen Dingen wird eines

   Der Gegensatz zur Flaechenstreuung in areas.js: ein Wald wird gekachelt,
   weil er eine Flaeche IST. Eine Burg, ein Hafen, eine Mine bekommen EIN
   Zeichen, weil sie auf Kartenmassstab ein Punkt sind — und ein Ort mit
   dreissig Haeusern bekommt eine Dorfsignatur, nicht dreissig Weiler.

   `zeichenFuer` kann mehrere Namen liefern (Stadt + Mauerkranz), deshalb die
   Schleife statt eines Zugriffs auf [0].
   ========================================================================== */

/**
 * Setzt die Zeichen einer Sache an EINEN Punkt.
 * @returns Zahl der gesetzten Zeichen (0 = auf diesem Massstab weggelassen,
 *          und das ist kein Fehler: ein Hain gehoert auf keine Kontinentkarte)
 */
function punktZeichen(el, sache, kennzahl, x, z, opt) {
  opt = opt || {};
  var wahl = zeichenFuer(sache, kennzahl, S.einheitMeter, opt);
  if (!wahl || !wahl.length) return 0;
  var y0 = Math.max(heightAt(x, z), WATER);
  var n = 0;
  for (var i = 0; i < wahl.length; i++) {
    var pl = kartenPlatz(wahl[i], opt);
    if (!pl) continue;
    emit(el, wahl[i], x, y0 + pl.schwebe, z, opt.dreh || 0,
      pl.sx, pl.sy, pl.sz, pl.tint);
    n++;
  }
  return n;
}

/** Schwerpunkt einer Punktliste — der Ort, an dem das eine Zeichen steht. */
function mitteVon(punkte) {
  var x = 0, z = 0, n = punkte.length;
  for (var i = 0; i < n; i++) { x += punkte[i].x; z += punkte[i].z; }
  return { x: x / n, z: z / n };
}


/* ==========================================================================
   3 — Linienzeichen: ein Band entlang des Pfades

   Strasse, Fluss, Kueste, Grenze und Seeweg sind keine gestreuten Quads,
   sondern ein Band — dieselbe Mechanik wie das Wegband in paths.js, nur mit
   Signaturbreite statt Wegbreite und mit einem Streifen aus dem Atlas.

   --- Die Kachelung, und warum sie den eigenen UV-Bereich braucht --------
   Die Atlastextur ist EINE Textur fuer 49 Zeichen und liegt deshalb auf
   ClampToEdge: „wiederholen" kann sie gar nicht. Wiederholt wird stattdessen
   der UV-BEREICH — jede Kachel bekommt ihre eigenen Vertices, deren u von
   su0 nach su1 laeuft, und die naechste faengt wieder bei su0 an.

   Genommen wird dafuer `atlasStreifenUV` (der Inhaltskasten) und NICHT
   `atlasUV` (das ganze Feld). Der Unterschied ist der Sicherheitsrand gegen
   Mip-Ausblutung: er ist 12 % je Seite, und kachelte man ihn mit, klaffte an
   jeder Kachelgrenze ein Viertel der Strecke leer. Die Streifenmaler
   zeichnen umgekehrt ueber den Inhaltskasten hinaus (STREIFEN_UEBER in
   signaturen.js) und werden an seiner Kante glatt abgeschnitten — an der
   Naht trifft deshalb Strichmitte auf Strichmitte.

   --- Die Naht selbst ---------------------------------------------------
   An jeder Kachelgrenze liegen zwei Vertexpaare auf DERSELBEN Weltposition;
   nur ihr u springt von su1 auf su0. Es gibt dort also keine Luecke, sondern
   eine Doppelkante — geometrisch der Abstand null. Genau das misst
   14-signaturen-generatoren.

   --- Ganze Kacheln statt eines Restes ----------------------------------
   Die Kachellaenge wird aus der Pfadlaenge zurueckgerechnet (kl = L / n)
   statt fest vorgegeben. Sonst bliebe am Pfadende ein angeschnittenes
   Muster stehen — bei einer Strichlinie ein halber Strich, bei der Grenze
   ein halber Punkt. Der Preis ist eine Kachellaenge, die um bis zu ein
   Halbes von der Zielstreckung abweicht; das sieht niemand, den halben Punkt
   sieht jeder.
   ========================================================================== */

/* Zielverhaeltnis Kachellaenge zu Bandbreite. 2,6 ist der Kompromiss aus
   zwei Richtungen: kuerzer gestaucht macht aus der Flusswelle ein Zittern
   und aus dem Grenzpunkt einen Strich, laenger gezogen wird der Punkt zum
   Strich und die Strichlinie zur Volllinie. */
var KACHEL_STRECKUNG = 2.6;
/* Deckel gegen ein Band aus zehntausend Kacheln auf einem langen Pfad. */
var KACHELN_MAX = 400;
/* Stuetzstellen je Kachel. Vier reichen: das Band folgt einer geglaetteten
   Kurve, und die Kachel ist nur wenige Welteinheiten lang. */
var PUNKTE_JE_KACHEL = 4;

/** Aufsummierte Bogenlaenge einer Punktliste. */
function pfadMasse(linie) {
  var kum = [0];
  for (var i = 1; i < linie.length; i++) {
    var dx = linie[i].x - linie[i - 1].x, dz = linie[i].z - linie[i - 1].z;
    kum.push(kum[i - 1] + Math.sqrt(dx * dx + dz * dz));
  }
  return kum;
}

/** Punkt und Richtung bei Bogenlaenge s. */
function pfadPunkt(linie, kum, s, out) {
  var n = linie.length, i = 1;
  while (i < n - 1 && kum[i] < s) i++;
  var a = linie[i - 1], b = linie[i];
  var l = kum[i] - kum[i - 1];
  var t = l > 1e-9 ? clamp((s - kum[i - 1]) / l, 0, 1) : 0;
  var dx = b.x - a.x, dz = b.z - a.z;
  var d = Math.sqrt(dx * dx + dz * dz) || 1;
  out.x = lerp(a.x, b.x, t);
  out.z = lerp(a.z, b.z, t);
  out.dx = dx / d;
  out.dz = dz / d;
  return out;
}

/* Das Bandmaterial. Traege erzeugt wie die Atlastextur selbst: dieses Modul
   wird auch dort geladen, wo niemand ein Canvas will (Pruefung, Kopfloser
   Lauf), und ein Material im Modulkopf zoege den Atlas dort mit hoch.

   `flach: true` liefert das unbeleuchtete Kartenmaterial — dieselbe Zutat,
   die auch die Zeichen-Pools bekommen (siehe signaturPoolOpts). Ein Wegband
   mit Lichtrichtung und Malschicht waere kein Kartenzeichen, sondern eine
   liegende Latte. */
var bandMat = null;
function kartenBandMat() {
  if (bandMat) return bandMat;
  bandMat = terraMat({
    flach: true,
    vertexColors: true,
    map: holeSignaturAtlas(),
    alphaTest: 0.03,
    side: THREE.DoubleSide
  });
  return bandMat;
}

var _bp = { x: 0, z: 0, dx: 1, dz: 0 };

/**
 * Bandgeometrie eines Streifenzeichens entlang einer Punktliste.
 *
 * Die Verblassung steckt im ALPHAKANAL der Vertexfarbe und nicht — wie bei
 * den Instanzen — in `sy`: kartenPatch (render/materials.js) liest `sy` aus
 * der Instanzmatrix, und ein Mesh hat keine. Ein vierkomponentiges
 * Farbattribut ist der Weg, den three dafuer vorsieht (USE_COLOR_ALPHA), und
 * er kostet weder einen Uniform noch eine Shaderaenderung.
 *
 * @returns { geo, kacheln, breite } oder null
 */
function bandGeoZeichen(name, linie, opt) {
  opt = opt || {};
  var pl = kartenPlatz(name, opt);
  if (!pl) return null;
  var uv = atlasStreifenUV(name);
  if (!uv) return null;
  var kum = pfadMasse(linie), L = kum[kum.length - 1];
  if (!(L > 1e-4)) return null;

  var breite = pl.marke * (Number.isFinite(opt.breite) ? opt.breite : 1);
  var halb = breite * 0.5;
  var n = clamp(Math.round(L / (breite * KACHEL_STRECKUNG)), 1, KACHELN_MAX);
  var kl = L / n;
  var deckung = clamp(pl.faktor, 0, 1);
  var t0 = pl.tint;

  var pos = [], col = [], uvs = [], idx = [];
  var P = PUNKTE_JE_KACHEL;
  for (var k = 0; k < n; k++) {
    var basis = pos.length / 3;
    for (var j = 0; j <= P; j++) {
      var f = j / P;
      pfadPunkt(linie, kum, (k + f) * kl, _bp);
      var nx = -_bp.dz, nz = _bp.dx;
      var u = lerp(uv[0], uv[2], f);
      for (var seite = 0; seite < 2; seite++) {
        var s = seite === 0 ? -1 : 1;
        var vx = _bp.x + nx * halb * s, vz = _bp.z + nz * halb * s;
        // Ueber WATER geklemmt: Fluss, Kueste und Seeweg laufen ueber
        // Wasser, und dort ist die Terrainhoehe der Beckenboden.
        pos.push(vx, Math.max(heightAt(vx, vz), WATER) + pl.schwebe, vz);
        col.push(t0[0], t0[1], t0[2], deckung);
        uvs.push(u, seite === 0 ? uv[1] : uv[3]);
      }
      if (j > 0) {
        var A = basis + (j - 1) * 2, B = basis + j * 2;
        idx.push(A, B, A + 1, A + 1, B, B + 1);
      }
    }
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 4));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  g.setIndex(idx);
  return { geo: g, kacheln: n, breite: breite };
}

/** Bandzeichen als Mesh in die Elementgruppe haengen. */
function bandZeichen(el, name, linie, opt) {
  if (!linie || linie.length < 2) return null;
  var b = bandGeoZeichen(name, linie, opt);
  if (!b) return null;
  var mesh = new THREE.Mesh(b.geo, kartenBandMat());
  mesh.userData.el = el;
  // Ueber Gelaende und Wasserflaeche, unter der Beschriftung. Das Flussmesh
  // liegt auf 5, die Karte gehoert darueber.
  mesh.renderOrder = 6;
  groupOf(el).add(mesh);
  return mesh;
}

/**
 * I6 — Grundriss einer Kompositstruktur: der Umriss ihres Polygons als
 * Mauerzug.
 *
 * Der Signaturenkatalog nennt das selbst als naechsten Schritt: Burg, Werft
 * und Kloster bekamen bis hierher dasselbe Punktzeichen wie ein Turm, obwohl
 * die Anlage ihre FORM kennt — sie steht als Polygon im Element, und aus
 * genau diesem Polygon baut strukturen.js Mauerringe, Kaifluchten und
 * Kreuzgaenge. Ein Grundriss ist deshalb keine neue Information, sondern die
 * vorhandene, die bisher auf Kartenmassstab weggeworfen wurde.
 *
 * Gebaut wird er mit derselben Bandmechanik wie ein Weg. Der einzige
 * Unterschied ist, dass die Linie GESCHLOSSEN ist: der erste Punkt haengt
 * hinten wieder an. Ein offener Zug haette an der Anfangsecke eine Fuge, und
 * eine Burg mit einem Loch in der Mauer ist keine Burg.
 *
 * @returns true, wenn ein Umriss entstanden ist. false heisst „kein Polygon"
 *          oder „Massstab ausserhalb des Bandes" — beides regulaer und kein
 *          Fehler.
 */
function umrissZeichen(el, punkte, opt) {
  if (!punkte || punkte.length < 3) return null;
  var linie = [];
  for (var i = 0; i < punkte.length; i++) linie.push({ x: punkte[i].x, z: punkte[i].z });
  var a = punkte[0], b = punkte[punkte.length - 1];
  // Schon geschlossen? Dann nicht doppelt schliessen — eine Kachel der Laenge
  // null teilte in bandGeoZeichen durch die Pfadlaenge.
  if (Math.abs(a.x - b.x) > 1e-6 || Math.abs(a.z - b.z) > 1e-6) {
    linie.push({ x: a.x, z: a.z });
  }
  /* Ueber linienZeichen und nicht direkt ueber bandZeichen: so laeuft der
     Grundriss durch dieselbe Kette wie jedes andere Zeichen — Sache,
     Darstellungsstufe, Band, Rueckfall. Ein Direktaufruf haette das Zeichen
     an der Massstabsleiter vorbeigeschmuggelt, und genau solche Nebenwege
     sind der Grund, warum 11-signaturen jedes Zeichen auf Erreichbarkeit
     ueber eine Zuordnung prueft. */
  return linienZeichen(el, 'grundriss', linie, el.kennzahl, opt) > 0;
}

/**
 * Kette aus Einzelzeichen entlang einer Linie — fuer Liniensachen, deren
 * Zeichen KEIN Streifen ist (die Bruchkante ist ein Quad aus der
 * Arborgruppe). Die Zeichen stehen auf Stoss und drehen sich in die
 * Pfadrichtung, dadurch liest die Kette als durchgehende Linie.
 */
function kettenZeichen(el, name, linie, opt) {
  opt = opt || {};
  var pl = kartenPlatz(name, opt);
  if (!pl) return 0;
  var kum = pfadMasse(linie), L = kum[kum.length - 1];
  if (!(L > 1e-4)) return 0;
  // Marke statt Quad als Schrittweite: der Sicherheitsrand des Atlasfeldes
  // soll ueberlappen, sonst reisst die Kette optisch auf.
  var schritt = Math.max(1e-3, pl.marke * 0.9);
  var n = clamp(Math.round(L / schritt), 1, KACHELN_MAX);
  var gesetzt = 0;
  for (var k = 0; k <= n; k++) {
    pfadPunkt(linie, kum, (k / n) * L, _bp);
    // Das Quad liegt in XZ; nach der Drehung um y zeigt seine lokale
    // x-Achse auf (cos, -sin). Damit die Zeichnung LAENGS des Pfades
    // laeuft, ist der Gierwinkel atan2(-dz, dx).
    var yaw = Math.atan2(-_bp.dz, _bp.dx);
    var y = Math.max(heightAt(_bp.x, _bp.z), WATER) + pl.schwebe;
    emit(el, name, _bp.x, y, _bp.z, yaw, pl.sx, pl.sy, pl.sz, pl.tint);
    gesetzt++;
  }
  return gesetzt;
}

/**
 * Linienzeichen einer Sache: waehlt das Zeichen und legt es als Band oder
 * als Kette. Welches von beiden, entscheidet der Katalog (`streifen`) und
 * nicht der Aufrufer — sonst muesste jeder Generator wissen, wie sein
 * Zeichen im Atlas gebaut ist.
 */
function linienZeichen(el, sache, linie, kennzahl, opt) {
  opt = opt || {};
  if (!linie || linie.length < 2) return 0;
  var wahl = zeichenFuer(sache, kennzahl, S.einheitMeter, opt);
  if (!wahl || !wahl.length) return 0;
  var n = 0;
  for (var i = 0; i < wahl.length; i++) {
    var Z = zeichenDaten(wahl[i]);
    if (Z && Z.streifen) { if (bandZeichen(el, wahl[i], linie, opt)) n++; }
    else n += kettenZeichen(el, wahl[i], linie, opt);
  }
  return n;
}


/* ==========================================================================
   4 — Grate: dem Kamm folgen, nicht die Flaeche fuellen

   Die Regel des Katalogs fuer die Reliefgruppe lautet woertlich: „Ein
   Gebirge wird durch seine Kammlinie erzaehlt, nicht durch ein Feld aus
   Bergchen." Damit ist die eigentliche Arbeit benannt — man muss die
   Kammlinie erst einmal HABEN.

   --- Wie hier gesucht wird ---------------------------------------------
   Profilerkennung, das aelteste und robusteste der Verfahren: ein Punkt
   liegt auf einem Kamm, wenn er QUER zum Kamm ein Hochpunkt ist. Geprueft
   werden vier Achsen (0°, 45°, 90°, 135°); je Achse ist

       fall = min( h - h(+d), h - h(-d) )

   der Betrag, um den es nach beiden Seiten hinuntergeht. Ist er auf
   mindestens einer Achse groesser als die Schwelle, ist der Punkt ein
   Kammpunkt, und der Kamm laeuft SENKRECHT zur Achse mit dem groessten
   Fall. Sind alle vier Achsen ueber der Schwelle, geht es nach allen Seiten
   hinunter: das ist kein Kamm mehr, sondern ein Gipfel.

   Warum nicht ueber die Hesse-Matrix (Hauptkruemmungen)? Sie liefert
   dasselbe Ergebnis, braucht sechs Ableitungen statt acht Abfragen, ist auf
   verrauschtem Gelaende aber deutlich zappeliger — die zweite Ableitung
   verstaerkt jedes Rauschkorn. Die Profilerkennung mittelt ueber die
   Stuetzweite `d` und ist damit von selbst geglaettet.

   --- Was die Genauigkeit bestimmt --------------------------------------
   Die Stuetzweite `d`. Auf einem Dachprofil erfuellt JEDER Punkt naeher als
   d am First die Bedingung und keiner weiter weg — der gefundene Kamm liegt
   also garantiert innerhalb von d um den echten. Deshalb ist d an die
   Zeichengroesse gekoppelt und nicht frei gewaehlt: ein Zeichen, das um
   weniger als seine eigene Kantenlaenge neben dem Kamm sitzt, sitzt auf dem
   Kamm.

   Die SCHWELLE haengt an der Hoehenspanne des Suchfeldes, nicht an einer
   absoluten Zahl. Ein Huegelland mit 12 Einheiten Spanne braucht eine
   andere Schwelle als ein Gebirge mit 90, und eine feste Zahl fuende
   entweder ueberall Grate oder nirgends.

   --- Der Gipfel braucht eine zweite Regel -------------------------------
   Die Profilerkennung allein FINDET EINEN KEGEL NICHT, und das ist kein
   Schoenheitsfehler: auf einem Kegel erfuellt nur die Spitze selbst die
   Bedingung, und die liegt so gut wie nie auf einer Rasterstelle. Schon zwei
   Einheiten daneben zeigt eine der acht Abfragen bergauf, und der Punkt
   faellt durch. Ein Gebirge ohne Gipfelzeichen waere aber genau das, was der
   Katalog vermeiden will.

   Deshalb die zweite, unabhaengige Regel: ein Rasterpunkt, der HOEHER liegt
   als alle acht Nachbarn und sich um mehr als die Schwelle vom niedrigsten
   abhebt, ist ein Gipfel — auch wenn die Profilerkennung ihn verwirft. Auf
   einem Dach greift sie nie (entlang des Firstes sind die Nachbarn
   gleich hoch), sie erfindet also keine Gipfel auf Graten.
   ========================================================================== */

var GRAT_ACHSEN = [[1, 0], [0.7071067811865476, 0.7071067811865476],
  [0, 1], [-0.7071067811865476, 0.7071067811865476]];

/**
 * Kammpunkte im Rechteck.
 *
 * o: { x0, z0, x1, z1, sp, d, maxN, schwelleAnteil }
 *   sp    Abtastweite (in der Regel die Zeichengroesse)
 *   d     Stuetzweite der Profilpruefung (Vorgabe sp)
 * Rueckgabe: [{ x, z, h, dx, dz, fall, gipfel }] — `dx/dz` ist die
 * KAMMRICHTUNG, nicht die Fallrichtung.
 */
function gratPunkte(o) {
  var sp = Number.isFinite(o.sp) && o.sp > 0 ? o.sp : 4;
  var d = Number.isFinite(o.d) && o.d > 0 ? o.d : sp;
  var maxN = Number.isFinite(o.maxN) ? o.maxN : 240;
  var ni = Math.max(1, Math.min(96, Math.ceil((o.x1 - o.x0) / sp)));
  var nj = Math.max(1, Math.min(96, Math.ceil((o.z1 - o.z0) / sp)));
  var i, j, k;
  // 1) Hoehenraster und Spanne. Das Raster laeuft ueber feste Weltpunkte,
  //    haengt also weder an einer Reihenfolge noch an einem Zufallsstrom.
  var H = new Float64Array((ni + 1) * (nj + 1));
  var hMin = Infinity, hMax = -Infinity;
  for (j = 0; j <= nj; j++) {
    for (i = 0; i <= ni; i++) {
      var hx = o.x0 + (o.x1 - o.x0) * (i / ni), hz = o.z0 + (o.z1 - o.z0) * (j / nj);
      var h = heightAt(hx, hz);
      H[j * (ni + 1) + i] = h;
      if (h < hMin) hMin = h;
      if (h > hMax) hMax = h;
    }
  }
  var spanne = hMax - hMin;
  var anteil = Number.isFinite(o.schwelleAnteil) ? o.schwelleAnteil : 0.04;
  var schwelle = Math.max(0.08, spanne * anteil);
  // 2) Profilerkennung je Rasterpunkt, dazu die Gipfelregel
  var aus = [];
  for (j = 0; j <= nj && aus.length < maxN; j++) {
    for (i = 0; i <= ni && aus.length < maxN; i++) {
      var x = o.x0 + (o.x1 - o.x0) * (i / ni), z = o.z0 + (o.z1 - o.z0) * (j / nj);
      var hm = H[j * (ni + 1) + i];
      if (hm < WATER + 0.5) continue;            // ein Grat unter Wasser ist keiner
      var besterFall = -Infinity, beste = 0, ueber = 0;
      for (k = 0; k < GRAT_ACHSEN.length; k++) {
        var ax = GRAT_ACHSEN[k][0] * d, az = GRAT_ACHSEN[k][1] * d;
        var fall = Math.min(hm - heightAt(x + ax, z + az), hm - heightAt(x - ax, z - az));
        if (fall > schwelle) ueber++;
        if (fall > besterFall) { besterFall = fall; beste = k; }
      }
      var grat = besterFall > schwelle;
      var lokal = istRasterGipfel(H, ni, nj, i, j, schwelle);
      if (!grat && !lokal) continue;
      // Kammrichtung: senkrecht zur Achse mit dem groessten Fall.
      var A = GRAT_ACHSEN[beste];
      aus.push({ x: x, z: z, h: hm, dx: -A[1], dz: A[0],
        fall: besterFall, gipfel: lokal || ueber === GRAT_ACHSEN.length });
    }
  }
  return aus;
}

/** Hoeher als alle acht Nachbarn und um mehr als `schwelle` ueber dem
 *  niedrigsten von ihnen. Randpunkte kennen ihre Nachbarn nicht und sind
 *  deshalb nie Gipfel — ein Gipfel am Rand des Suchfeldes ist ohnehin ein
 *  Gipfel des NACHBARfeldes. */
function istRasterGipfel(H, ni, nj, i, j, schwelle) {
  if (i <= 0 || j <= 0 || i >= ni || j >= nj) return false;
  var b = ni + 1, hm = H[j * b + i], tief = Infinity;
  for (var dj = -1; dj <= 1; dj++) {
    for (var di = -1; di <= 1; di++) {
      if (di === 0 && dj === 0) continue;
      var hn = H[(j + dj) * b + (i + di)];
      if (hn >= hm) return false;
      if (hn < tief) tief = hn;
    }
  }
  return hm - tief > schwelle;
}


/* ==========================================================================
   5 — Die Wasserlinie: eine Kueste ist keine Sache, die jemand zeichnet

   Der Katalog fuehrt die Kuestenlinie unter Q = A, also „aus einer
   Ableitung". Das ist ehrlich: In Terra gibt es kein Kuesten-Element. Es
   gibt ein Hoehenfeld und einen Wasserspiegel, und die Kueste ist die Kurve
   dazwischen.

   Verfolgt wird sie als Hoehenlinie: vom Ausgangspunkt auf WATER
   zulaufen (ein Newton-Schritt entlang des Gradienten pro Runde), dann
   quer zum Gradienten weitermarschieren und nach jedem Schritt wieder auf
   die Linie zurueckfallen. Zwei Korrekturschritte je Marschschritt reichen,
   weil der Fehler nach einem Schritt hoechstens die halbe Schrittweite mal
   der Kruemmung betraegt.

   Vorwaerts UND rueckwaerts, sonst begaenne die Kueste am Klickpunkt statt
   durch ihn hindurchzulaufen.

   Grenze, bewusst: das liefert das Kuestenstueck IN DER UMGEBUNG eines
   Elements, nicht den Umriss der ganzen Landmasse. Der braeuchte einen
   Aufrufer, der keinem Element gehoert — siehe Bericht.
   ========================================================================== */

var _wg = { gx: 0, gz: 0, l: 0 };
/** Hoehengradient an einer Weltstelle (Zentraldifferenz ueber 2 Einheiten). */
function hoehenGradient(x, z, out) {
  out.gx = (heightAt(x + 1, z) - heightAt(x - 1, z)) * 0.5;
  out.gz = (heightAt(x, z + 1) - heightAt(x, z - 1)) * 0.5;
  out.l = Math.sqrt(out.gx * out.gx + out.gz * out.gz);
  return out;
}

/** Ein Newton-Schritt auf die Hoehe `ziel` zu. Rueckgabe: false, wenn die
 *  Stelle zu flach ist, um eine Richtung zu kennen. */
function aufHoehe(p, ziel, maxSchritt) {
  hoehenGradient(p.x, p.z, _wg);
  if (!(_wg.l > 1e-4)) return false;
  var d = clamp((ziel - heightAt(p.x, p.z)) / (_wg.l * _wg.l), -maxSchritt, maxSchritt);
  p.x += _wg.gx * d;
  p.z += _wg.gz * d;
  return true;
}

/**
 * Kuestenlinie durch (x, z).
 * o: { x, z, schritt, maxN, reichweite, ziel }
 * Rueckgabe: [{x, z}] in Marschrichtung geordnet, oder [] wenn hier keine
 * Wasserlinie liegt.
 */
function wasserlinie(o) {
  var schritt = Number.isFinite(o.schritt) && o.schritt > 0 ? o.schritt : 3;
  var maxN = Number.isFinite(o.maxN) ? o.maxN : 120;
  var weit = Number.isFinite(o.reichweite) ? o.reichweite : 60;
  var ziel = Number.isFinite(o.ziel) ? o.ziel : WATER;
  var start = { x: o.x, z: o.z };
  var i;
  for (i = 0; i < 24; i++) {
    if (!aufHoehe(start, ziel, schritt * 2)) return [];
    if (Math.abs(heightAt(start.x, start.z) - ziel) < 0.05) break;
  }
  if (Math.abs(heightAt(start.x, start.z) - ziel) > 0.5) return [];
  var haelfte = [];
  for (var richtung = -1; richtung <= 1; richtung += 2) {
    var p = { x: start.x, z: start.z }, kette = [];
    for (i = 0; i < maxN; i++) {
      hoehenGradient(p.x, p.z, _wg);
      if (!(_wg.l > 1e-4)) break;
      // Quer zum Gefaelle: das Wasser bleibt auf derselben Seite.
      p.x += (-_wg.gz / _wg.l) * schritt * richtung;
      p.z += (_wg.gx / _wg.l) * schritt * richtung;
      if (!aufHoehe(p, ziel, schritt)) break;
      aufHoehe(p, ziel, schritt);
      var dx = p.x - start.x, dz = p.z - start.z;
      if (dx * dx + dz * dz > weit * weit) break;
      kette.push({ x: p.x, z: p.z });
    }
    haelfte.push(kette);
  }
  haelfte[0].reverse();
  return haelfte[0].concat([{ x: start.x, z: start.z }], haelfte[1]);
}


export {
  alsKoerper, alsZeichen, kartenPlatz,
  hoehenGradient, wasserlinie,
  punktZeichen, mitteVon,
  KACHEL_STRECKUNG, KACHELN_MAX, PUNKTE_JE_KACHEL,
  pfadMasse, pfadPunkt, bandGeoZeichen, bandZeichen, kettenZeichen, linienZeichen,
  umrissZeichen,
  kartenBandMat,
  GRAT_ACHSEN, gratPunkte, istRasterGipfel
};
