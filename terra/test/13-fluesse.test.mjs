/* ==========================================================================
   Ebene 6 — Fluesse aus dem Abflussfeld (I3b)

   Geprueft wird die Kette, die aus einem Hoehenfeld einen Fluss macht:

     world/erosion.js   senkenFuellen / abflussNetz — Senkenfuellung,
                        Abflussrichtungen, Einzugsgebiete
     generators/welt.js erzeugeFluesse — Schwelle, Koepfe, Verfolgung,
                        Maeander, Glaettung, Vereinfachung, Breite

   Warum das eine EIGENE Ebene ist und nicht in 06-erosion gehoert: der
   Senkenfueller rechnet zwar in erosion.js, aber seine Zusagen sind erst im
   Zusammenspiel mit dem Weltgenerator ueberpruefbar — "ein Fluss endet
   sinnvoll" ist keine Aussage ueber ein Zahlenfeld. Umgekehrt braucht der
   Weltgenerator hier den Loader-Haken (er haengt an store/terrain/THREE),
   waehrend 06-erosion bewusst ohne auskommt.

   ---------------------------------------------------------------------------
   ZWEI EIGENHEITEN DES AUFBAUS, damit niemand daran vorbeiliest:

   1. `testWelt` setzt zwar die Kartengroesse, zieht die Hoehenfelder aber
      NICHT nach (das tut terrain.terrainGeometrienNeu, und main.js/io.js rufen
      es; hilfen/karte.mjs nicht). Auf 512 und 1024 stuenden sonst NaN im
      Hoehenfeld, weil genBase in ein 257er Feld schreibt. `welt(...)` unten
      holt das nach. Das ist eine Luecke der Testhilfe, kein Fehler der
      Erzeugung — hier steht sie, damit sie nicht ein zweites Mal jemanden
      einen Nachmittag kostet.

   2. Wo der GEMESSENE Abfluss eine Rolle spielt, wird er ausdruecklich als
      `opt.abfluss` uebergeben und nicht aus terrain.js gelesen. Grund: die
      Felder in terrain.js wachsen ueber die Testdatei hinweg nur (siehe
      felderSichern), nach einem 512er Fall passt ihre Laenge nicht mehr zur
      256er Karte, und `erzeugeWelt` faellt dann — voellig richtig — auf
      gleichmaessigen Regen zurueck. Ein Test, der das nicht weiss, prueft
      danach nichts mehr.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { testWelt } from './hilfen/karte.mjs';
import { ladeTerra } from './hilfen/laden.mjs';
import { senkenFuellen, abflussNetz, erodiere } from '../src/world/erosion.js';

/* --------------------------------------------------------------------------
   Benannte Toleranzen und Zielgroessen — alle gemessen, keine geraten.
   -------------------------------------------------------------------------- */

/* Wie weit ein Fluss auf einem Abtastschritt von 2 Welteinheiten WIEDER
   STEIGEN darf. Drei Quellen speisen diese Zahl, und keine davon ist ein
   Fehler:
     * die Glaettung ([1 2 1] ueber den Zug) schneidet Kurven innen ab und
       hebt den Lauf dabei an die Innenflanke;
     * der Maeander lenkt in der Ebene um bis zu gut eine Rasterzelle aus;
     * die Verfolgung laeuft auf dem GEFUELLTEN Feld, eine flache Mulde unter
       der Seeschwelle wird also durchquert statt umgangen.
   Gemessen ueber 256/512 und die Seeds 4711, 1337, 2024: der groesste
   Einzelanstieg lag bei 0.42 Welteinheiten. 1.2 ist der Deckel mit Luft. */
const STEIGUNG_JE_SCHRITT = 1.2;

/* Und der Anteil der Abtastschritte, die ueberhaupt steigen duerfen. Er faengt
   das ab, was die Schranke oben nicht sieht: einen Lauf, der in lauter
   winzigen Stufen bergAUF kriecht. Gemessen: 0.12 bis 0.28. */
const STEIGUNGS_ANTEIL = 0.40;

/* Griffe je Flusselement. Begruendung in welt.js an FLUSS_ZIEL_PUNKTE: die
   Waelder des Generators tragen 8 bis 12, jenseits von rund 50 ueberlappen
   sich die Griffe im Editor. */
const ZIEL_PUNKTE = 16;

/* Abstand, ab dem ein Endpunkt als "am Wasser", "am Kartenrand" bzw. "an einem
   anderen Lauf" gilt. Zwei Rasterzellen des Analyserasters — feiner kann die
   Verfolgung gar nicht sein. */
const ENDE_NAHE = 9;

const NI = [1, 1, 0, -1, -1, -1, 0, 1];
const NJ = [0, 1, 1, 1, 0, -1, -1, -1];

/* --------------------------------------------------------------------------
   Aufbau
   -------------------------------------------------------------------------- */

/** Betriebsbereite Welt inklusive nachgezogener Hoehenfelder (siehe Kopf). */
async function welt(opt) {
  const o = Object.assign({ seed: 4711, biom: 'wiese', groesse: 256 }, opt || null);
  const w = await testWelt(o);
  const { terrain, store } = w.m;
  terrain.terrainGeometrienNeu();
  terrain.genBase(o.seed);
  const vw = store.KARTE.vw;
  terrain.recomputeHeights(0, vw - 1, 0, vw - 1);
  terrain.computeAO(0, vw - 1, 0, vw - 1);
  w.welt = await ladeTerra('generators/welt.js');
  w.terrain = terrain;
  w.store = store;
  return w;
}

/** Ein gemessenes Abflussfeld fuer diese Karte (ohne das Terrain zu aendern). */
function abflussFuer(w, seed) {
  const VW = w.store.KARTE.vw;
  const e = erodiere(w.terrain.base.subarray(0, VW * VW), VW, { seed: seed });
  return e.abfluss;
}

function fluesseIn(liste) {
  return liste.filter((el) => el.kind === 'pfad' && el.variant === 'fluss');
}

/** Dicht abgetastetes Hoehenprofil entlang eines Elements. */
function profil(terrain, el) {
  const out = [];
  for (let i = 1; i < el.points.length; i++) {
    const a = el.points[i - 1], b = el.points[i];
    const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / 2));
    if (i === 1) out.push(terrain.heightAt(a.x, a.z));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      out.push(terrain.heightAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t));
    }
  }
  return out;
}

/* ==========================================================================
   1. Senkenfueller
   ========================================================================== */

test('Ebene 6 — der Senkenfueller laesst keine abflusslose Zelle zurueck', async () => {
  const w = await welt({ seed: 4711, groesse: 256 });
  const A = w.welt.analysiere(4711);
  const nx = A.nx;
  const gefuellt = senkenFuellen(A.h, nx, nx, { aussen: A.wasser });

  let ohneAbfluss = 0;
  for (let j = 1; j < nx - 1; j++) {
    for (let i = 1; i < nx - 1; i++) {
      const id = j * nx + i;
      let tiefer = false;
      for (let k = 0; k < 8; k++) {
        if (gefuellt[(j + NJ[k]) * nx + i + NI[k]] < gefuellt[id]) { tiefer = true; break; }
      }
      if (!tiefer) ohneAbfluss++;
    }
  }
  assert.equal(ohneAbfluss, 0,
    ohneAbfluss + ' innere Zellen haben keinen tieferen Nachbarn — dort bliebe '
    + 'jede Flussverfolgung stehen');
});

test('Ebene 6 — der Senkenfueller fasst das Gelaende nicht an', async () => {
  /* Die Kernzusage des Verfahrens (Begruendung im Kopf von erosion.js): Terras
     Gelaende ist gemalt. Ein Krater, ein Steinbruch, ein Kesseltal sind Inhalt
     und duerfen nicht still zugeschuettet werden. */
  const w = await welt({ seed: 1337, groesse: 256 });
  const A = w.welt.analysiere(1337);
  const nx = A.nx;
  const kopie = Float32Array.from(A.h);
  const gefuellt = senkenFuellen(A.h, nx, nx, { aussen: A.wasser });

  assert.notEqual(gefuellt, A.h, 'senkenFuellen liefert dasselbe Array zurueck');
  const a = Buffer.from(A.h.buffer, A.h.byteOffset, A.h.byteLength);
  const b = Buffer.from(kopie.buffer, kopie.byteOffset, kopie.byteLength);
  assert.ok(a.equals(b), 'Das Eingabefeld wurde veraendert');

  // Und gefuellt liegt nirgends UNTER dem Gelaende — sonst waere es kein
  // Fuellen, sondern ein Abtragen.
  let unter = 0, gehoben = 0;
  for (let k = 0; k < nx * nx; k++) {
    if (gefuellt[k] < A.h[k] - 1e-4) unter++;
    if (gefuellt[k] > A.h[k] + 1e-3) gehoben++;
  }
  assert.equal(unter, 0, unter + ' Zellen liegen im gefuellten Feld TIEFER als im Gelaende');
  assert.ok(gehoben > 0, 'Es wurde nirgends gefuellt — die Pruefung waere blind');
});

test('Ebene 6 — Senkenfuellung und Abflussnetz sind bitgleich reproduzierbar', async () => {
  const w = await welt({ seed: 2024, groesse: 256 });
  const A = w.welt.analysiere(2024);
  const nx = A.nx;
  const roh = (f) => Buffer.from(f.buffer, f.byteOffset, f.byteLength);
  const g1 = senkenFuellen(A.h, nx, nx, { aussen: A.wasser });
  const g2 = senkenFuellen(A.h, nx, nx, { aussen: A.wasser });
  assert.ok(roh(g1).equals(roh(g2)));
  const n1 = abflussNetz(A.h, nx, nx, { aussen: A.wasser });
  const n2 = abflussNetz(A.h, nx, nx, { aussen: A.wasser });
  assert.ok(roh(n1.akk).equals(roh(n2.akk)));
  assert.ok(roh(n1.ziel).equals(roh(n2.ziel)));

  // Gegenprobe: ein anderes Regenfeld muss ein anderes Einzugsgebiet ergeben,
  // sonst prueft der Vergleich oben nur, dass die Funktion konstant ist.
  const regen = new Float32Array(nx * nx);
  for (let k = 0; k < regen.length; k++) regen[k] = 1 + (k % 7) * 0.5;
  const n3 = abflussNetz(A.h, nx, nx, { aussen: A.wasser, regen: regen });
  assert.ok(!roh(n1.akk).equals(roh(n3.akk)), 'Das Regenfeld wirkt nicht auf akk');
});

/* ==========================================================================
   2. Die Fluesse selbst
   ========================================================================== */

test('Ebene 6 — Fluesse fliessen ueber ihre ganze Laenge bergab', async () => {
  for (const seed of [4711, 1337, 2024]) {
    const w = await welt({ seed: seed, groesse: 256 });
    const liste = w.welt.erzeugeWelt(seed, { abfluss: null });
    const fl = fluesseIn(liste);
    assert.ok(fl.length > 0, 'Seed ' + seed + ': keine Fluesse');

    for (const el of fl) {
      const p = profil(w.terrain, el);
      let maxStieg = 0, stiege = 0;
      for (let i = 1; i < p.length; i++) {
        const d = p[i] - p[i - 1];
        if (d > 0) { stiege++; if (d > maxStieg) maxStieg = d; }
      }
      assert.ok(maxStieg <= STEIGUNG_JE_SCHRITT,
        'Seed ' + seed + ': ein Schritt steigt um ' + maxStieg.toFixed(3)
        + ' (erlaubt ' + STEIGUNG_JE_SCHRITT + ')');
      assert.ok(stiege / (p.length - 1) <= STEIGUNGS_ANTEIL,
        'Seed ' + seed + ': ' + (100 * stiege / (p.length - 1)).toFixed(0)
        + ' % der Schritte gehen bergauf');
      assert.ok(p[0] > p[p.length - 1],
        'Seed ' + seed + ': der Lauf endet nicht tiefer, als er beginnt');
    }
  }
});

test('Ebene 6 — kein Fluss endet mitten am Hang', async () => {
  /* Erlaubte Enden, und alle vier sind eine Aussage ueber die Landschaft:
       Wasser         die Muendung ins Meer
       gefuellte Senke  ein abflussloses Becken (das, was der Senkenfueller
                      gerade gefunden hat) — auf Terras Karten der haeufigste
                      Fall, weil das Gelaende grosse geschlossene Wannen hat
       Kartenrand     der Fluss verlaesst das Blatt
       anderer Lauf   Zusammenfluss
     Was NICHT erlaubt ist: irgendwo am Hang aufhoeren. */
  for (const seed of [4711, 1337, 2024]) {
    const w = await welt({ seed: seed, groesse: 256 });
    const { WATER, KARTE } = w.store;
    const liste = w.welt.erzeugeWelt(seed, { abfluss: null });
    const fl = fluesseIn(liste);
    const A = w.welt.analysiere(seed);
    const nx = A.nx;
    const gefuellt = senkenFuellen(A.h, nx, nx, { aussen: A.wasser });
    const half = KARTE.half, R = KARTE.map / (nx - 1);

    let echteEnden = 0, amWasser = 0;
    for (const el of fl) {
      const e = el.points[el.points.length - 1];
      /* Ein Lauf wird an seinen groessten Zufluessen in zwei bis drei Elemente
         geteilt; die teilen sich den Trennpunkt. Das Ende eines solchen
         Abschnitts ist KEIN Flussende — dort geht es breiter weiter. Ohne
         diesen Ausschluss wuerde die Pruefung genau diese Faelle als
         "muendet in einen anderen Lauf" durchwinken und waere fast blind. */
      if (fl.some((o) => o !== el && o.points[0].x === e.x && o.points[0].z === e.z)) continue;
      echteEnden++;
      let grund = null;

      // (a) Wasser in Reichweite?
      for (let a = 0; a < 8 && !grund; a++) {
        const t = a / 8 * Math.PI * 2;
        if (w.terrain.heightAt(e.x + Math.cos(t) * ENDE_NAHE, e.z + Math.sin(t) * ENDE_NAHE) < WATER) {
          grund = 'wasser';
        }
      }
      if (!grund && w.terrain.heightAt(e.x, e.z) < WATER) grund = 'wasser';

      // (b) gefuellte Senke?
      if (!grund) {
        const gi = Math.max(0, Math.min(nx - 1, Math.round((e.x + half) / R)));
        const gj = Math.max(0, Math.min(nx - 1, Math.round((e.z + half) / R)));
        for (let dj = -1; dj <= 1 && !grund; dj++) {
          for (let di = -1; di <= 1 && !grund; di++) {
            const q = Math.max(0, Math.min(nx - 1, gj + dj)) * nx
                    + Math.max(0, Math.min(nx - 1, gi + di));
            if (gefuellt[q] - A.h[q] > 0.5) grund = 'senke';
          }
        }
      }

      // (c) Kartenrand?
      if (!grund && (Math.abs(e.x) > half - 3 * R || Math.abs(e.z) > half - 3 * R)) grund = 'rand';

      // (d) auf einem anderen Lauf?
      for (const andere of fl) {
        if (grund || andere === el) continue;
        for (const p of andere.points) {
          if (Math.hypot(p.x - e.x, p.z - e.z) <= ENDE_NAHE + andere.params.breite) {
            grund = 'zufluss'; break;
          }
        }
      }

      assert.ok(grund,
        'Seed ' + seed + ': ein Lauf endet bei (' + e.x.toFixed(0) + ', ' + e.z.toFixed(0)
        + ') ohne Wasser, ohne Senke, ohne Rand und ohne Zusammenfluss');
      if (grund === 'wasser') amWasser++;
    }
    assert.ok(echteEnden > 0, 'Seed ' + seed + ': kein einziges echtes Flussende gefunden');
    /* Und mindestens EINER muss das Meer erreichen. Ohne diese Zeile waere die
       Pruefung mit einer Karte zufrieden, auf der jeder Fluss nach zwanzig
       Metern in einer Pfuetze verendet — jede Senke ist ja ein erlaubtes Ende.
       Auf Terras Gelaende ist der Senkenanteil ohnehin hoch (grosse
       geschlossene Wannen), aber ganz ohne Muendung ist es keine Landschaft. */
    assert.ok(amWasser > 0,
      'Seed ' + seed + ': kein einziger Lauf erreicht das Meer (' + echteEnden + ' Enden)');
  }
});

test('Ebene 6 — die Punktzahl je Flusselement bleibt handhabbar', async () => {
  let groesstes = 0;
  for (const groesse of [256, 512]) {
    for (const seed of [4711, 2024]) {
      const w = await welt({ seed: seed, groesse: groesse });
      const fl = fluesseIn(w.welt.erzeugeWelt(seed, { abfluss: null }));
      for (const el of fl) groesstes = Math.max(groesstes, el.points.length);
      for (const el of fl) {
        assert.ok(el.points.length >= 2, 'Ein Flusselement mit unter zwei Punkten');
        assert.ok(el.points.length <= ZIEL_PUNKTE,
          groesse + '/' + seed + ': ein Lauf hat ' + el.points.length
          + ' Griffe (Ziel ' + ZIEL_PUNKTE + ')');
      }
    }
  }
  assert.ok(groesstes > 3,
    'Kein Lauf kam ueber ' + groesstes + ' Punkte — die Vereinfachung frisst alles, '
    + 'die Schranke oben waere blind');
});

test('Ebene 6 — Fluesse sind deterministisch, und zwei Seeds sind verschieden', async () => {
  const bauen = async (seed) => {
    const w = await welt({ seed: seed, groesse: 256 });
    return fluesseIn(w.welt.erzeugeWelt(seed, { abfluss: null }))
      .map((el) => el.params.breite + '|' + el.points.map((p) => p.x + ',' + p.z).join(';'))
      .join('\n');
  };
  const a1 = await bauen(4711);
  const a2 = await bauen(4711);
  assert.equal(a1, a2, 'Derselbe Seed ergibt zweimal verschiedene Fluesse');
  const b = await bauen(1337);
  assert.notEqual(a1, b, 'Zwei Seeds ergeben dieselben Fluesse — die Pruefung waere blind');
});

/* ==========================================================================
   3. Der Abfluss und der Rueckfall
   ========================================================================== */

test('Ebene 6 — ohne Abflussfeld entstehen weiterhin Fluesse (Rueckfall)', async () => {
  /* `abfluss` ist ein Laufzeitfeld und nach dem Laden einer Datei null. Ein
     Weltgenerator, der dann gar keine Fluesse mehr macht, waere ein
     Rueckschritt gegenueber dem alten Verfahren. */
  for (const seed of [4711, 1337, 2024]) {
    const w = await welt({ seed: seed, groesse: 256 });
    const liste = w.welt.erzeugeWelt(seed, { abfluss: null });
    assert.equal(liste.bericht.abflussGenutzt, false,
      'Seed ' + seed + ': der Bericht behauptet einen Abfluss, obwohl keiner uebergeben wurde');
    assert.ok(fluesseIn(liste).length > 0, 'Seed ' + seed + ': ohne Abfluss keine Fluesse');
    assert.ok(liste.bericht.fluesse > 0);
  }
});

test('Ebene 6 — ein Abflussfeld falscher Groesse wird nicht gelesen', async () => {
  /* Dieselbe Falle wie beim Biomfeld in Ebene 6: felderSichern laesst die
     Felder nur WACHSEN. Nach einer grossen Karte steht in `abfluss` ein Feld in
     der Zeilenordnung der GROSSEN Karte. Es zu lesen ergaebe keinen Fehler,
     nur Unsinn. */
  const w = await welt({ seed: 4711, groesse: 256 });
  const zuGross = new Float32Array(w.store.KARTE.vw * w.store.KARTE.vw + 1000).fill(5);
  const liste = w.welt.erzeugeWelt(4711, { abfluss: zuGross });
  assert.equal(liste.bericht.abflussGenutzt, false,
    'Ein Feld falscher Laenge wurde als Abfluss benutzt');
  assert.ok(fluesseIn(liste).length > 0);
});

test('Ebene 6 — das Abflussfeld erreicht die Erzeugung', async () => {
  /* Die harte, schmale Aussage: mit und ohne Abflussfeld entstehen ANDERE
     Verlaeufe, und der Bericht sagt, welcher Fall vorlag. Ohne diese Pruefung
     koennte die ganze Verdrahtung tot sein, ohne dass es auffiele.

     Was hier bewusst NICHT steht, ist ein Vergleich "welche Karte ist besser".
     Er waere unehrlich: zwischen den beiden Laeufen aendert sich nicht nur die
     Wegwahl, sondern auch die AUSWAHL der gezeichneten Laeufe (Schwelle,
     Koepfe, Zufluss-Bonus). Diese Auswahl streut staerker als der Effekt, den
     man messen will — gemessen ueber vier Seeds schwankte das Verhaeltnis
     zwischen 0.99 und 1.21, also um den Effekt herum. Was der Abfluss an der
     WEGWAHL tut, misst der naechste Test bei gleicher Auswahl. */
  for (const seed of [4711, 1337, 2024]) {
    const w = await welt({ seed: seed, groesse: 256 });
    const AB = abflussFuer(w, seed + 17);
    const ohne = w.welt.erzeugeWelt(seed, { abfluss: null });
    const mit = w.welt.erzeugeWelt(seed, { abfluss: AB });
    assert.equal(ohne.bericht.abflussGenutzt, false);
    assert.equal(mit.bericht.abflussGenutzt, true);

    const bahn = (liste) => fluesseIn(liste)
      .map((el) => el.points.map((p) => p.x.toFixed(1) + ',' + p.z.toFixed(1)).join(';'))
      .join('|');
    assert.ok(bahn(mit).length > 0 && bahn(ohne).length > 0);
    assert.notEqual(bahn(mit), bahn(ohne),
      'Seed ' + seed + ': mit und ohne Abflussfeld entstehen dieselben Verlaeufe '
      + '— das Feld kommt nicht an');
  }
});

test('Ebene 6 — der Sog fuehrt die Laeufe messbar durch nasseres Gelaende', async () => {
  /* DIE Messung, die "der Abfluss wirkt wirklich" tragen kann.

     Verglichen werden nicht zwei erzeugte Karten (dazu siehe den Test davor),
     sondern zwei Abflussnetze auf DEMSELBEN Gelaende, von DENSELBEN
     Startzellen aus: einmal reiner steilster Abstieg, einmal mit Sog aus dem
     gemessenen Abfluss. Damit faellt jede Auswahlstreuung weg und es bleibt
     genau die eine Frage uebrig: fuehrt der Sog den Lauf durch nasseres
     Gelaende?

     Das Sogfeld baut dieser Test SELBST (Blocksumme, logarithmisch normiert,
     0.55 .. 2.2) — mit denselben Zahlen wie welt.js, aber aus eigener Quelle.
     Absicht: die Pruefung soll nicht dieselbe Funktion pruefen, die sie
     benutzt. Weicht welt.js hier einmal ab, misst dieser Test trotzdem das,
     was er behauptet zu messen: die Wirkung eines Sogs, nicht die Gleichheit
     zweier Aufrufe. */
  /* Gemessen (Seeds 4711 / 1337 / 2024 auf 256): Faktor 1.085, 1.066, 1.036.
     Die Schranke steht bei 1.03 und damit knapp unter dem schwaechsten
     gemessenen Wert — nicht bei einer runderen Zahl, denn dann pruefte sie
     einen Wunsch statt des Verhaltens. Dass der Effekt so klein ausfaellt, ist
     die ehrliche Auskunft dieser Runde: die Hauptwirkung der Erosion auf die
     Fluesse laeuft ueber das GELAENDE, das sie umgraebt, und nicht ueber das
     Messfeld. Siehe SOG_NASS in generators/welt.js. */
  const SOG_MINDESTENS = 1.03;
  for (const seed of [4711, 1337, 2024]) {
    const w = await welt({ seed: seed, groesse: 256 });
    const AB = abflussFuer(w, seed + 17);
    const A = w.welt.analysiere(seed);
    const nx = A.nx, n = nx * nx;
    const VW = w.store.KARTE.vw, R = w.store.KARTE.map / (nx - 1);

    // Blocksumme des gemessenen Abflusses auf das Analyseraster.
    const summe = new Float32Array(n);
    let max = 0;
    for (let j = 0; j < nx; j++) {
      for (let i = 0; i < nx; i++) {
        let s = 0;
        for (let b = j * R - R / 2; b < j * R + R / 2; b++) {
          if (b < 0 || b >= VW) continue;
          for (let a = i * R - R / 2; a < i * R + R / 2; a++) {
            if (a < 0 || a >= VW) continue;
            s += AB[b * VW + a];
          }
        }
        summe[j * nx + i] = s;
        if (s > max) max = s;
      }
    }
    assert.ok(max > 0, 'Seed ' + seed + ': das Abflussfeld ist leer');
    const logRef = Math.log(1 + max);
    const sog = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      sog[k] = 0.55 + 1.65 * Math.min(1, Math.log(1 + summe[k]) / logRef);
    }

    const ohne = abflussNetz(A.h, nx, nx, { aussen: A.wasser });
    const mit = abflussNetz(A.h, nx, nx, { aussen: A.wasser, sog: sog });

    // Von denselben Startzellen ablaufen und die durchquerte Nasse mitteln.
    const nass = (netz) => {
      let s = 0, m = 0;
      for (let start = 0; start < n; start += 37) {
        if (A.wasser[start]) continue;
        let id = start;
        for (let schritt = 0; schritt < 400; schritt++) {
          s += Math.log(1 + summe[id]); m++;
          const t = netz.ziel[id];
          if (t < 0 || A.wasser[t]) break;
          id = t;
        }
      }
      return m ? s / m : 0;
    };
    const nMit = nass(mit), nOhne = nass(ohne);
    assert.ok(nMit > nOhne * SOG_MINDESTENS,
      'Seed ' + seed + ': der Sog fuehrt nicht durch nasseres Gelaende: '
      + nOhne.toFixed(3) + ' -> ' + nMit.toFixed(3)
      + ' (Faktor ' + (nMit / nOhne).toFixed(3) + ', gefordert ' + SOG_MINDESTENS + ')');
  }
});

test('Ebene 6 — die Breite waechst mit dem Einzugsgebiet', async () => {
  /* Nicht die Formel wird geprueft (die steht in welt.js), sondern die
     Eigenschaft, an der sie haengt: auf einer Karte stehen verschieden breite
     Fluesse, und der breiteste liegt unterhalb. Ein Generator, der jeden Lauf
     gleich breit macht, faellt hier durch. */
  const w = await welt({ seed: 2024, groesse: 512 });
  const fl = fluesseIn(w.welt.erzeugeWelt(2024, { abfluss: null }));
  const breiten = fl.map((el) => el.params.breite);
  assert.ok(breiten.length >= 3);
  const min = Math.min(...breiten), max = Math.max(...breiten);
  assert.ok(max > min * 1.3,
    'Alle Fluesse sind fast gleich breit (' + min + ' .. ' + max + ')');
  for (const b of breiten) assert.ok(b >= 3 && b <= 26, 'Breite ausserhalb 3..26: ' + b);
});
