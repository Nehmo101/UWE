/* ==========================================================================
   Erosion (I3) — thermischer Talus und hydraulische Tropfen.

   Das Modul veraendert nicht nur Hoehen, es GEWINNT drei Felder, die der Rest
   des Systems weiterbenutzt:

     abfluss    Summe des Wassers, das ueber eine Zelle gelaufen ist. Die
                Tropfenbahnen SIND die Messung — ein zweiter Durchgang waere
                dieselbe Rechnung noch einmal. Der Weltgenerator legt daran
                seine Fluesse, die Biom-Ableitung ihre Feuchte.
     sediment   Netto abgelagertes Material (negativ, wo abgetragen wurde).
                Schwemmland, Uferbaenke, fruchtbare Talboeden.
     haerte     Ausgangswert je Zelle, aus Rauschen. Weicher Fels traegt
                schneller ab und steht flacher — daraus entstehen Haertlinge,
                Schichtstufen und Klippen statt gleichmaessiger Weichzeichnung.

   ABHAENGIGKEITEN: ausschliesslich core/rng.js. Kein terrain.js, kein
   store.js, kein dirty.js. Kartengroesse, Hoehenfeld und Seed kommen als
   Parameter herein — nur so ist der Kern allein pruefbar, und nur so
   bestimmt die Einbettung die Kopplung statt umgekehrt.

   ---------------------------------------------------------------------------
   ZEITSCHNITT UND DETERMINISMUS

   Der Lauf ist eine feste Folge von ARBEITSEINHEITEN (eine Gitterzeile eines
   thermischen Teilpasses, ein Tropfen). Jede Einheit ist in sich abgeschlossen
   und haengt nur vom Zustand ab, den ihre Vorgaenger hinterlassen haben —
   nie davon, wie viele Einheiten im selben Aufruf gerechnet wurden. Das
   Zeitbudget entscheidet ausschliesslich, WANN die Schleife abbricht, nicht
   WAS gerechnet wird. Ein Lauf am Stueck und ein Lauf in 37 unregelmaessigen
   Haeppchen liefern deshalb bitgleiche Felder; `erodiere()` ist buchstaeblich
   `erosionStarten` + `erosionSchritt(z, Infinity)`, also derselbe Code.

   Zwei Stellen, an denen das haette schiefgehen koennen, und wie sie geloest
   sind:
   * Der thermische Pass schreibt beim Sammeln auch in NACHBARzeilen. Deshalb
     zwei getrennte Teilpaesse ueber je alle Zeilen: erst sammeln (liest nur
     `H`, schreibt nur `HD`), dann anwenden (liest `HD`, schreibt `H`). Eine
     Zeilengrenze mitten im Sammeln ist damit folgenlos.
   * Tropfen ziehen ihren Startpunkt aus `hashi(index, 0/1, seed)`, nicht aus
     einem fortlaufenden Zufallsstrom. Tropfen k faellt an derselben Stelle,
     ganz gleich, wann er gerechnet wird — und `erodiereRegion` kann dieselbe
     Nummerierung benutzen und nur die Tropfen ueberspringen, die ihr Fenster
     nicht treffen.

   ---------------------------------------------------------------------------
   FENSTER

   Intern rechnet alles auf einem FENSTER [i0..i0+w-1] x [j0..j0+h-1] des
   Gitters; der globale Lauf ist der Sonderfall Fenster = ganze Karte. Alle
   Puffer sind fenstergross (Zeilen-Major, Schrittweite w), die Haerte wird
   aber aus GLOBALEN Gitterkoordinaten gehasht — sonst waere das Ergebnis
   eines Ausschnitts ein anderes als das des Ganzen.

   RAND: Wer den Fensterrand erreicht, versickert dort. Kein Wrap-around —
   die Karte ist keine Torus-Welt, und ein Fluss, der am Nordrand hinauslaeuft
   und im Sueden wieder hereinkommt, waere Unsinn. Das mitgefuehrte Sediment
   verlaesst dabei das Gebiet und wird in `randVerlust` mitgeschrieben, damit
   die Massenbilanz aufgeht statt still zu bluten. Der thermische Pass klemmt
   seine Nachbarn am Fensterrand (die Randzelle sieht sich selbst als
   Aussennachbar) und ist damit streng masseerhaltend.
   ========================================================================== */
import { clamp, hashi, fractal } from '../core/rng.js';

/* --------------------------------------------------------------------------
   Standardwerte

   Geeicht auf VW = 1025 (rund 1,05 Mio. Zellen) und einen Softwarerasterer:
   ein voller Lauf mit diesen Werten bleibt im Bereich einer knappen Sekunde,
   verteilt ueber ein paar Dutzend Bilder also unauffaellig. Die Regler duerfen
   deutlich hoeher gehen — die Standardwerte sind das, was man ohne Nachdenken
   anwerfen koennen soll.
   -------------------------------------------------------------------------- */
export const EROSION_STANDARD = {
  seed: 1337,             // eigener Seed; ueblich S.worldSeed + fester Versatz
  staerke: 1,             // Gesamtwirkung (0 = nur messen, siehe unten)

  // -- hydraulisch ---------------------------------------------------------
  tropfen: null,          // null = aus tropfenDichte; 0 heisst wirklich KEINE
  tropfenDichte: 0.05,    // Tropfen je Gitterzelle, wenn `tropfen` null ist
  maxSchritte: 48,        // Lebensdauer eines Tropfens in Zellen
  traegheit: 0.05,        // 0 = folgt dem Gefaelle sklavisch, 1 = geradeaus
  kapazitaet: 3.2,        // wie viel Fracht Gefaelle*Tempo*Wasser tragen
  minGefaelle: 0.012,     // damit ein Tropfen im Flachen nicht alles fallen laesst
  erosionsRate: 0.35,
  ablagerungsRate: 0.28,
  verdunstung: 0.02,      // Wasserverlust je Schritt
  schwerkraft: 5,
  startWasser: 1,
  startTempo: 1,
  merkmalGroesse: 2,      // Abtragsradius in Zellen: kleiner = feinere Rinnen

  // -- Haerte --------------------------------------------------------------
  haerteVarianz: 0.35,    // Haerte laeuft in 1 +- varianz
  haerteFrequenz: 0.012,  // ~80 Zellen Wellenlaenge: Massen, keine Sprenkel

  // -- thermisch -----------------------------------------------------------
  boeschung: 34,          // stabiler Boeschungswinkel in Grad
  rutschRate: 0.5,        // Anteil des Ueberhangs je Durchgang (<=0.5, s.u.)
  durchgaengeGrob: 3,     // vor dem Wasser: Rauschkanten brechen
  durchgaengeFein: 6,     // nach dem Wasser: Rinnenwaende nachrutschen lassen

  // -- nur fuer erodiereRegion --------------------------------------------
  saum: 12,               // Breite des Uebergangs am Boxrand (Zellen)
  einzug: 0               // 0 = maxSchritte; Einzugsgebiet ausserhalb des Saums
};

var GRAD = Math.PI / 180;
var PH_GROB = 0, PH_HYDRO = 1, PH_FEIN = 2, PH_FERTIG = 3;

function jetzt() {
  return (typeof performance !== 'undefined' && performance.now)
    ? performance.now() : Date.now();
}

function optionen(opt) {
  var o = {}, k;
  for (k in EROSION_STANDARD) o[k] = EROSION_STANDARD[k];
  if (opt) for (k in opt) if (opt[k] !== undefined) o[k] = opt[k];
  return o;
}

/* ==========================================================================
   Haertefeld

   Eigenstaendig, weil ausser der Erosion auch die Biom-Ableitung und die
   Vegetation es lesen wollen (Fels traegt keinen Wald). Reine Funktion von
   Gitterposition, Seed und Varianz — zweimal gerufen ergibt zweimal dasselbe,
   und ein Ausschnitt ist Zelle fuer Zelle derselbe wie im Ganzen.

   Die Koordinaten sind wie in terrain.js um die Kartenmitte zentriert, damit
   dasselbe Seed ueber die Kartengroessen hinweg dieselbe Landschaftsmitte
   ergibt.
   ========================================================================== */
function haerteWert(i, j, halb, seed, varianz, frequenz) {
  if (varianz <= 0) return 1;
  var n = fractal((i - halb) * frequenz, (j - halb) * frequenz, (seed + 6151) | 0);
  return 1 + (n - 0.5) * 2 * varianz;
}

/**
 * Haertefeld der ganzen Karte, VW*VW gross (Zeilen-Major, j*VW+i).
 * `varianz` 0 liefert ein konstantes Feld aus Einsen — dann erodiert alles
 * gleich, was fuer Pruefungen der Boeschung genau richtig ist.
 */
export function haerteFeld(VW, seed, varianz, frequenz) {
  if (varianz === undefined) varianz = EROSION_STANDARD.haerteVarianz;
  if (frequenz === undefined) frequenz = EROSION_STANDARD.haerteFrequenz;
  var halb = (VW - 1) * 0.5;
  var f = new Float32Array(VW * VW);
  for (var j = 0; j < VW; j++) {
    for (var i = 0; i < VW; i++) f[j * VW + i] = haerteWert(i, j, halb, seed, varianz, frequenz);
  }
  return f;
}

/* ==========================================================================
   Zustand
   ========================================================================== */

/** Gewichtete Abtragsscheibe: Offsets + auf 1 normierte Gewichte.
 *  Ein Tropfen frisst nicht in EINE Zelle (das ergaebe Nadelstiche und ein
 *  Feld voller Einzelpixel), sondern in eine kegelfoermig gewichtete Scheibe.
 *  `merkmalGroesse` ist damit buchstaeblich die Breite der Rinnen. */
function scheibe(r) {
  r = Math.max(1, Math.round(r));
  var di = [], dj = [], gw = [], summe = 0;
  for (var b = -r; b <= r; b++) {
    for (var a = -r; a <= r; a++) {
      var d = Math.sqrt(a * a + b * b);
      if (d > r) continue;
      var g = 1 - d / r;
      if (g <= 0) continue;
      di.push(a); dj.push(b); gw.push(g); summe += g;
    }
  }
  var n = gw.length, W = new Float32Array(n);
  for (var q = 0; q < n; q++) W[q] = gw[q] / summe;
  return { di: Int16Array.from(di), dj: Int16Array.from(dj), gw: W };
}

/**
 * Baut den Laufzustand fuer ein Fenster. `bi0..bj1` ist die KERNBOX (bei einem
 * globalen Lauf identisch mit dem Fenster); ausserhalb davon blendet der
 * Abschluss das Ergebnis in das Ausgangsfeld zurueck.
 */
function neuerZustand(hoehen, VW, i0, j0, w, h, bi0, bi1, bj0, bj1, istRegion, opt) {
  var o = optionen(opt);
  var z = {
    quelle: hoehen, VW: VW, i0: i0, j0: j0, w: w, h: h,
    bi0: bi0, bi1: bi1, bj0: bj0, bj1: bj1,
    istRegion: istRegion, opt: o, seed: o.seed | 0,
    abgebrochen: false, randVerlust: 0
  };
  var n = w * h;
  z.H = new Float32Array(n);
  z.HD = new Float32Array(n);
  z.AB = new Float32Array(n);
  z.SE = new Float32Array(n);
  z.HA = new Float32Array(n);
  var halb = (VW - 1) * 0.5;
  for (var jl = 0; jl < h; jl++) {
    var zeileQ = (j0 + jl) * VW + i0, zeileZ = jl * w;
    for (var il = 0; il < w; il++) {
      z.H[zeileZ + il] = hoehen[zeileQ + il];
      z.HA[zeileZ + il] = haerteWert(i0 + il, j0 + jl, halb, z.seed, o.haerteVarianz, o.haerteFrequenz);
    }
  }

  var st = o.staerke < 0 ? 0 : o.staerke;
  z.talus = Math.tan(clamp(o.boeschung, 0.5, 89) * GRAD);
  // rutschRate ueber 0.5 kann die Hoehenordnung zweier Nachbarn umdrehen und
  // laesst den Hang schwingen statt sich zu setzen. Deshalb hart gedeckelt.
  z.rutschRate = clamp(o.rutschRate, 0, 0.5) * st;
  z.maxSchritte = Math.max(1, o.maxSchritte | 0);
  z.traegheit = clamp(o.traegheit, 0, 0.999);
  z.kapazitaet = o.kapazitaet;
  z.minGefaelle = o.minGefaelle;
  z.erosionsRate = o.erosionsRate * st;
  z.ablagerungsRate = clamp(o.ablagerungsRate * st, 0, 1);
  z.verdunstung = clamp(o.verdunstung, 0, 1);
  z.schwerkraft = o.schwerkraft;
  z.startWasser = o.startWasser;
  z.startTempo = o.startTempo;
  var sch = scheibe(o.merkmalGroesse);
  z.pdi = sch.di; z.pdj = sch.dj; z.pw = sch.gw;
  z.saum = Math.max(0, o.saum | 0);

  // Tropfenzahl haengt an der GANZEN Karte, nicht am Fenster: nur so traegt
  // Tropfen k in einem Regionslauf dieselbe Nummer wie im globalen Lauf.
  z.tropfenZahl = (o.tropfen === null || o.tropfen === undefined)
    ? Math.round(o.tropfenDichte * VW * VW) : Math.max(0, o.tropfen | 0);

  z.durchgaengeGrob = Math.max(0, o.durchgaengeGrob | 0);
  z.durchgaengeFein = Math.max(0, o.durchgaengeFein | 0);

  // Fortschrittsgewichte: eine Zeile kostet w Zellen, ein Tropfen bis zu
  // maxSchritte Schritte mit je einem Scheibendurchlauf. Nur fuer die Anzeige.
  z.gewZeile = w;
  z.gewTropfen = z.maxSchritte * (2 + z.pw.length);
  z.gesamt = (z.durchgaengeGrob + z.durchgaengeFein) * 2 * h * z.gewZeile
           + z.tropfenZahl * z.gewTropfen;
  if (z.gesamt <= 0) z.gesamt = 1;
  z.getan = 0;

  z.phase = -1; z.durchgang = 0; z.teil = 0; z.zeile = 0; z.tropfenIndex = 0;
  z.durchgaenge = 0;
  setzePhase(z, PH_GROB);
  return z;
}

/** Schaltet auf die naechste nicht-leere Phase weiter (und schliesst ab). */
function setzePhase(z, p) {
  while (p !== PH_FERTIG) {
    if (p === PH_GROB && z.durchgaengeGrob > 0) { z.durchgaenge = z.durchgaengeGrob; break; }
    if (p === PH_HYDRO && z.tropfenZahl > 0) break;
    if (p === PH_FEIN && z.durchgaengeFein > 0) { z.durchgaenge = z.durchgaengeFein; break; }
    p++;
  }
  z.phase = p;
  z.durchgang = 0; z.teil = 0; z.zeile = 0;
  if (p === PH_FERTIG) abschluss(z);
}

/* ==========================================================================
   Thermischer Pass (Talus)

   Je Zelle: der GROESSTE Hoehenunterschied zu einem der vier Nachbarn
   bestimmt, wie viel Material ueberhaupt in Bewegung geraet
   (rutschRate * (maxDiff - Schwelle)); verteilt wird es proportional auf alle
   Nachbarn, die ueber der Schwelle liegen. Diese Bindung an maxDiff (statt an
   die Summe aller Ueberhaenge) ist der Grund, warum eine Zelle nie unter ihren
   tiefsten Nachbarn durchfaellt — bei rutschRate 0.5 sinkt sie hoechstens bis
   auf die halbe Differenz.

   Die Schwelle skaliert mit der Haerte: harter Fels traegt steilere Waende.
   Der eingestellte Boeschungswinkel ist damit der Winkel des DURCHSCHNITTS-
   gesteins, nicht eine harte Obergrenze — bei haerteVarianz 0 ist er beides.

   Nur die vier Kantennachbarn. Die Diagonalen kosten das Doppelte und aendern
   das Bild kaum, weil ueber mehrere Durchgaenge ohnehin eine runde Schutthalde
   entsteht.
   ========================================================================== */
function sammleZeile(z, j) {
  var w = z.w, hh = z.h, H = z.H, D = z.HD, HA = z.HA;
  var talus = z.talus, rate = z.rutschRate;
  if (rate <= 0) return;
  var row = j * w;
  var rOben = (j > 0 ? j - 1 : 0) * w;
  var rUnten = (j < hh - 1 ? j + 1 : hh - 1) * w;
  for (var i = 0; i < w; i++) {
    var id = row + i, hZ = H[id];
    var nL = row + (i > 0 ? i - 1 : 0), nR = row + (i < w - 1 ? i + 1 : w - 1);
    var nU = rOben + i, nD = rUnten + i;
    var s = talus * HA[id];
    var dL = hZ - H[nL], dR = hZ - H[nR], dU = hZ - H[nU], dD = hZ - H[nD];
    var maxD = dL;
    if (dR > maxD) maxD = dR;
    if (dU > maxD) maxD = dU;
    if (dD > maxD) maxD = dD;
    if (maxD <= s) continue;
    var eL = dL > s ? dL - s : 0, eR = dR > s ? dR - s : 0;
    var eU = dU > s ? dU - s : 0, eD = dD > s ? dD - s : 0;
    var summe = eL + eR + eU + eD;
    if (summe <= 0) continue;
    var menge = (maxD - s) * rate, f = menge / summe;
    if (eL > 0) D[nL] += eL * f;
    if (eR > 0) D[nR] += eR * f;
    if (eU > 0) D[nU] += eU * f;
    if (eD > 0) D[nD] += eD * f;
    D[id] -= menge;
  }
}

function wendeZeileAn(z, j) {
  var w = z.w, H = z.H, D = z.HD, row = j * w;
  for (var i = 0; i < w; i++) {
    var id = row + i;
    if (D[id] !== 0) { H[id] += D[id]; D[id] = 0; }
  }
}

/* ==========================================================================
   Hydraulischer Pass (Tropfen)
   ========================================================================== */

/** Ablagerung an der bilinear gewichteten Zelle — dieselben vier Ecken, aus
 *  denen die Hoehe gelesen wurde. Wuerde nur in die naechste Zelle abgelagert,
 *  entstuenden Treppen entlang der Bahn. */
function ablagern(H, SE, id, w, fx, fy, menge) {
  var a = (1 - fx) * (1 - fy), b = fx * (1 - fy), c = (1 - fx) * fy, d = fx * fy;
  var m;
  m = menge * a; H[id] += m; SE[id] += m;
  m = menge * b; H[id + 1] += m; SE[id + 1] += m;
  m = menge * c; H[id + w] += m; SE[id + w] += m;
  m = menge * d; H[id + w + 1] += m; SE[id + w + 1] += m;
}

/** Abtrag ueber die Scheibe; liefert die TATSAECHLICH entfernte Menge zurueck.
 *  Sie weicht von `menge` ab, weil weicher Fels mehr hergibt (Division durch
 *  die Haerte) und weil Scheibenanteile ausserhalb des Fensters entfallen.
 *  Der Rueckgabewert ist das, was der Tropfen wirklich aufnimmt — so bleibt
 *  die Bilanz auch dann sauber, wenn beides zutrifft. */
function abtragen(z, xi, yi, menge) {
  var w = z.w, hh = z.h, H = z.H, SE = z.SE, HA = z.HA;
  var pdi = z.pdi, pdj = z.pdj, pw = z.pw, n = pw.length, entfernt = 0;
  for (var q = 0; q < n; q++) {
    var ii = xi + pdi[q];
    if (ii < 0 || ii >= w) continue;
    var jj = yi + pdj[q];
    if (jj < 0 || jj >= hh) continue;
    var id = jj * w + ii;
    var m = menge * pw[q] / HA[id];
    H[id] -= m; SE[id] -= m; entfernt += m;
  }
  return entfernt;
}

/**
 * Ein Tropfen. Startpunkt aus `hashi(k, 0|1, seed)` — ortsgebunden, nicht aus
 * einem fortlaufenden Strom (siehe Kopf). Trifft der Start das Fenster nicht,
 * faellt der Tropfen ersatzlos aus; das ist der Hebel, mit dem
 * `erodiereRegion` dieselbe Nummerierung benutzen kann wie der globale Lauf.
 */
function einTropfen(z, k) {
  var w = z.w, hh = z.h, H = z.H, AB = z.AB, SE = z.SE;
  var randX = w - 1, randY = hh - 1;
  var x = 1 + hashi(k, 0, z.seed) * (z.VW - 3) - z.i0;
  var y = 1 + hashi(k, 1, z.seed) * (z.VW - 3) - z.j0;
  if (!(x >= 1 && y >= 1 && x < randX && y < randY)) return;

  var traeg = z.traegheit, gegen = 1 - traeg;
  var kapa = z.kapazitaet, minG = z.minGefaelle;
  var eRate = z.erosionsRate, aRate = z.ablagerungsRate;
  var dx = 0, dy = 0, tempo = z.startTempo, wasser = z.startWasser, sed = 0;
  var xi = 0, yi = 0, fx = 0, fy = 0, id = 0;

  for (var s = 0; s < z.maxSchritte; s++) {
    xi = x | 0; yi = y | 0; fx = x - xi; fy = y - yi;
    id = yi * w + xi;
    var h00 = H[id], h10 = H[id + 1], h01 = H[id + w], h11 = H[id + w + 1];
    var hAlt = (h00 + (h10 - h00) * fx) * (1 - fy) + (h01 + (h11 - h01) * fx) * fy;
    // Die Bahn IST die Abflussmessung: was hier durchlaeuft, laeuft hier durch.
    AB[id] += wasser;

    var grx = (h10 - h00) * (1 - fy) + (h11 - h01) * fy;
    var gry = (h01 - h00) * (1 - fx) + (h11 - h10) * fx;
    dx = dx * traeg - grx * gegen;
    dy = dy * traeg - gry * gegen;
    var len = Math.sqrt(dx * dx + dy * dy);
    // Senke ohne Gefaelle und ohne Schwung: der Tropfen steht. Kein Ersatz-
    // wuerfel fuer eine Richtung — das waere ein zweiter Zufallsstrom neben
    // dem Starthash, und stehendes Wasser hat schlicht keine Vorzugsrichtung.
    if (!(len > 1e-9)) break;
    dx /= len; dy /= len;
    x += dx; y += dy;
    if (!(x >= 1 && y >= 1 && x < randX && y < randY)) {
      z.randVerlust += sed;                 // versickert am Rand, mit Fracht
      return;
    }
    var nxi = x | 0, nyi = y | 0, nfx = x - nxi, nfy = y - nyi;
    var nid = nyi * w + nxi;
    var n00 = H[nid], n10 = H[nid + 1], n01 = H[nid + w], n11 = H[nid + w + 1];
    var hNeu = (n00 + (n10 - n00) * nfx) * (1 - nfy) + (n01 + (n11 - n01) * nfx) * nfy;
    var diff = hNeu - hAlt;

    if (diff > 0) {
      // Bergauf: der Tropfen ist in eine Senke gelaufen. Hoechstens so viel
      // ablagern, dass die Senke aufgefuellt wird — sonst baut er einen Huegel.
      var mA = sed < diff ? sed : diff;
      if (mA > 0) { ablagern(H, SE, id, w, fx, fy, mA); sed -= mA; }
    } else {
      var kap = (-diff > minG ? -diff : minG) * tempo * wasser * kapa;
      if (sed > kap) {
        var mB = (sed - kap) * aRate;
        if (mB > 0) { ablagern(H, SE, id, w, fx, fy, mB); sed -= mB; }
      } else {
        // Nie mehr abtragen als das Gefaelle hergibt: sonst gruebe sich der
        // Tropfen unter seinen eigenen Zielpunkt und liefe rueckwaerts.
        var mC = (kap - sed) * eRate;
        if (mC > -diff) mC = -diff;
        if (mC > 0) sed += abtragen(z, xi, yi, mC);
      }
    }
    var v2 = tempo * tempo + (-diff) * z.schwerkraft;
    tempo = v2 > 0 ? Math.sqrt(v2) : 0;
    wasser *= 1 - z.verdunstung;
    if (wasser <= 0) break;
  }
  // Verdunstet, ausgelaufen oder stehen geblieben: die Fracht faellt aus.
  if (sed > 0) {
    xi = x | 0; yi = y | 0;
    ablagern(H, SE, yi * w + xi, w, x - xi, y - yi, sed);
  }
}

/* ==========================================================================
   Abschluss: Saum

   Nur fuer den Regionslauf. Innerhalb der Kernbox steht das Ergebnis
   unveraendert; nach aussen blendet ein Smoothstep ueber `saum` Zellen auf das
   Ausgangsfeld zurueck. Ohne das haette die Box eine Abrisskante, weil das
   Wasser dahinter aufhoert zu existieren.
   ========================================================================== */
function saumGewicht(z, gi, gj) {
  var d = 0, t;
  t = z.bi0 - gi; if (t > d) d = t;
  t = gi - z.bi1; if (t > d) d = t;
  t = z.bj0 - gj; if (t > d) d = t;
  t = gj - z.bj1; if (t > d) d = t;
  if (d <= 0) return 1;
  if (z.saum <= 0 || d >= z.saum) return 0;
  var u = 1 - d / z.saum;
  return u * u * (3 - 2 * u);
}

function abschluss(z) {
  if (!z.istRegion) return;
  var w = z.w, hh = z.h, H = z.H, AB = z.AB, SE = z.SE, Q = z.quelle, VW = z.VW;
  for (var jl = 0; jl < hh; jl++) {
    var gj = z.j0 + jl, zeile = jl * w, qz = gj * VW + z.i0;
    for (var il = 0; il < w; il++) {
      var g = saumGewicht(z, z.i0 + il, gj);
      if (g >= 1) continue;
      var id = zeile + il, alt = Q[qz + il];
      H[id] = alt + (H[id] - alt) * g;
      AB[id] *= g; SE[id] *= g;
    }
  }
}

/* ==========================================================================
   Oeffentliche Schnittstelle
   ========================================================================== */

/**
 * Startet einen zeitgeschnittenen globalen Lauf. `hoehen` (Float32Array,
 * VW*VW, Zeilen-Major) wird NICHT angefasst — gearbeitet wird auf einer Kopie.
 */
export function erosionStarten(hoehen, VW, opt) {
  return neuerZustand(hoehen, VW, 0, 0, VW, VW, 0, VW - 1, 0, VW - 1, false, opt);
}

/**
 * Rechnet Arbeitseinheiten, bis `budgetMs` Millisekunden verbraucht sind
 * (Vorgabe 8 ms, also gut ein halbes Bild bei 60 Hz). Mindestens eine Einheit
 * je Aufruf, damit auch ein Budget von 0 vorankommt.
 *
 * `maxEinheiten` (optional) deckelt zusaetzlich die Zahl der Einheiten. Nicht
 * im Entwurf vorgesehen, aber der einzige Weg, den Zeitschnitt REPRODUZIERBAR
 * zu pruefen: eine Uhr laesst sich nicht zweimal gleich anhalten, ein
 * Einheitendeckel schon. Die Prueffolge 06-erosion haengt daran.
 *
 * Rueckgabe { fertig, anteil } — `anteil` ist eine Schaetzung fuer die Anzeige.
 */
export function erosionSchritt(z, budgetMs, maxEinheiten) {
  if (z.abgebrochen) return { fertig: true, anteil: 1 };
  if (z.phase === PH_FERTIG) return { fertig: true, anteil: 1 };
  if (budgetMs === undefined || budgetMs === null) budgetMs = 8;
  var deckel = (maxEinheiten === undefined || maxEinheiten === null)
    ? Infinity : Math.max(1, maxEinheiten | 0);
  var t0 = jetzt(), getan = 0, seit = 0;
  while (z.phase !== PH_FERTIG) {
    if (z.phase === PH_HYDRO) {
      einTropfen(z, z.tropfenIndex++);
      z.getan += z.gewTropfen;
      if (z.tropfenIndex >= z.tropfenZahl) setzePhase(z, PH_FEIN);
    } else {
      if (z.teil === 0) sammleZeile(z, z.zeile); else wendeZeileAn(z, z.zeile);
      z.getan += z.gewZeile;
      z.zeile++;
      if (z.zeile >= z.h) {
        z.zeile = 0;
        if (z.teil === 0) z.teil = 1;
        else {
          z.teil = 0; z.durchgang++;
          if (z.durchgang >= z.durchgaenge) setzePhase(z, z.phase + 1);
        }
      }
    }
    getan++;
    if (getan >= deckel) break;
    // Die Uhr nur alle 16 Einheiten lesen: performance.now() kostet sonst
    // mehr als die Zeile, die es abmisst. Auf das ERGEBNIS hat der Takt
    // keinen Einfluss, nur auf die Genauigkeit der Budgeteinhaltung.
    if (++seit >= 16) { seit = 0; if (jetzt() - t0 >= budgetMs) break; }
  }
  var a = z.getan / z.gesamt;
  return { fertig: z.phase === PH_FERTIG, anteil: z.phase === PH_FERTIG ? 1 : (a > 1 ? 1 : a) };
}

/**
 * Ergebnisfelder. Alle vier sind FENSTERgross (beim globalen Lauf also
 * VW*VW) und gehoeren dem Aufrufer. `randVerlust` ist die Materialmenge, die
 * ueber den Rand abgeflossen ist — ohne sie geht keine Massenbilanz auf.
 * Nach `erosionAbbrechen` null.
 */
export function erosionErgebnis(z) {
  if (z.abgebrochen) return null;
  return {
    hoehe: z.H, abfluss: z.AB, sediment: z.SE, haerte: z.HA,
    randVerlust: z.randVerlust,
    i0: z.i0, j0: z.j0, w: z.w, h: z.h,          // Lage des Fensters im Gitter
    bi0: z.bi0, bi1: z.bi1, bj0: z.bj0, bj1: z.bj1,  // Kernbox (Saum aussen herum)
    fertig: z.phase === PH_FERTIG
  };
}

/** Bricht ab und gibt die Puffer frei. Danach liefert erosionErgebnis null —
 *  ein halber Lauf ist kein Ergebnis, und der Aufrufer soll nicht aus
 *  Versehen ein zur Haelfte erodiertes Feld ins Terrain schreiben. */
export function erosionAbbrechen(z) {
  z.abgebrochen = true;
  z.phase = PH_FERTIG;
  z.H = z.HD = z.AB = z.SE = z.HA = null;
  return z;
}

/** Ganzer Lauf am Stueck — fuer Weltgenerator und Pruefungen. Bitgleich mit
 *  jedem zeitgeschnittenen Lauf derselben Eingaben. */
export function erodiere(hoehen, VW, opt) {
  var z = erosionStarten(hoehen, VW, opt);
  while (erosionSchritt(z, Infinity).fertig === false) { /* laeuft durch */ }
  return erosionErgebnis(z);
}

/* --------------------------------------------------------------------------
   Pinsel: Erosion nur in einer Box.

   Das ist NICHT der globale Lauf in klein. Zwei ehrliche Probleme und was
   dagegen getan wird:

   1. WASSER VON AUSSEN fehlt. Ein Tropfen, der ausserhalb der Box faellt und
      hineinlaeuft, gehoert zum Bild — er ist der Grund, warum die Rinne in der
      Box ueberhaupt Wasser fuehrt. Deshalb ist das Rechenfenster groesser als
      die Box: Box + Saum + EINZUG, wobei der Einzug standardmaessig
      maxSchritte betraegt. Weiter als maxSchritte Zellen kann ein Tropfen
      nicht kommen, also faellt jeder Tropfen, der die Box ueberhaupt
      erreichen KANN, in dieses Fenster. Und weil die Tropfennummerierung
      dieselbe ist wie global, ist es sogar derselbe Tropfen mit demselben
      Startpunkt.

   2. MATERIAL, DAS HINAUSLIEFE, staut sich. Am Fensterrand versickern Tropfen
      (wie am Kartenrand), und der thermische Pass klemmt dort — das Fenster
      verhaelt sich an seinem Rand also wie eine kleine eigene Karte. Sichtbar
      waere das als Kante. Deshalb der Saum: nur die Kernbox uebernimmt das
      Ergebnis voll, ueber `saum` Zellen nach aussen blendet es per Smoothstep
      auf das Ausgangsfeld zurueck, und der Einzugsring bleibt komplett auf 0.
      Der Fensterrand liegt damit immer im Gewicht 0 und kann nichts anrichten.

   Was dadurch NICHT exakt wird: ein Tropfen, der ausserhalb des Fensters
   startet, dort Gelaende umgraebt und dessen VERAENDERUNG die Bahn eines
   spaeteren Tropfens knapp neben der Box verbiegt, der dann hineinlaeuft.
   Dieser Effekt zweiter Ordnung bleibt uebrig; er wird in 06-erosion.test.mjs
   gemessen statt behauptet.
   -------------------------------------------------------------------------- */

/**
 * Erosion in der Gitterbox [i0..i1] x [j0..j1]. Rueckgabe wie `erodiere`,
 * aber FENSTERgross: `i0/j0/w/h` im Ergebnis nennen die Lage des Fensters im
 * Gitter, `hoehe` enthaelt bereits das eingeblendete Ergebnis und kann
 * zeilenweise in das Ausgangsfeld zurueckgeschrieben werden.
 */
export function erodiereRegion(hoehen, VW, i0, i1, j0, j1, opt) {
  var z = erosionRegionStarten(hoehen, VW, i0, i1, j0, j1, opt);
  while (erosionSchritt(z, Infinity).fertig === false) { /* laeuft durch */ }
  return erosionErgebnis(z);
}

/** Zeitgeschnittener Regionslauf — gleicher Zustand, gleiche Schrittfunktion,
 *  gleiches Ergebnis wie erodiereRegion. */
export function erosionRegionStarten(hoehen, VW, i0, i1, j0, j1, opt) {
  var o = optionen(opt);
  var bi0 = clamp(Math.min(i0, i1) | 0, 0, VW - 1), bi1 = clamp(Math.max(i0, i1) | 0, 0, VW - 1);
  var bj0 = clamp(Math.min(j0, j1) | 0, 0, VW - 1), bj1 = clamp(Math.max(j0, j1) | 0, 0, VW - 1);
  // Fenster = Box + Saum (Einblendung) + Einzug (Tropfen von aussen).
  var rand = Math.max(0, o.saum | 0)
    + ((o.einzug | 0) > 0 ? (o.einzug | 0) : Math.max(1, o.maxSchritte | 0));
  var fi0 = clamp(bi0 - rand, 0, VW - 1), fi1 = clamp(bi1 + rand, 0, VW - 1);
  var fj0 = clamp(bj0 - rand, 0, VW - 1), fj1 = clamp(bj1 + rand, 0, VW - 1);
  return neuerZustand(hoehen, VW, fi0, fj0, fi1 - fi0 + 1, fj1 - fj0 + 1,
    bi0, bi1, bj0, bj1, true, opt);
}
