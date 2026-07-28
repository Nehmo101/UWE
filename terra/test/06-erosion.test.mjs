/* ==========================================================================
   Ebene 6 — Erosion (world/erosion.js)

   Anders als die Ebenen 1–5 braucht diese Datei WEDER den Loader-Haken NOCH
   den Three-Ersatz: erosion.js importiert ausschliesslich core/rng.js und
   rechnet auf uebergebenen Float32Arrays. Deshalb ein gewoehnlicher statischer
   Import — kein `ladeTerra`, kein Testfenster, keine Ersatzmodule.

   Die sieben Zusagen, die hier geprueft werden:

     1. Der Zeitschnitt aendert nichts. Am Stueck == in unregelmaessigen
        Haeppchen, BITGLEICH. Das ist die zentrale Aussage des Moduls: die
        Erosion laeuft ueber viele Bilder, und das Ergebnis darf nicht davon
        abhaengen, wie die Bildrate gerade steht.
     2. Determinismus — zweimal derselbe Aufruf ergibt bitgleich dasselbe;
        zwei Seeds ergeben Verschiedenes (sonst waere 1. blind).
     3. Erhaltung — Material entsteht nicht aus dem Nichts. Was ueber den Rand
        abfliesst, wird in `randVerlust` mitgeschrieben und geht in die Bilanz
        ein statt still zu verschwinden.
     4. Plausibilitaet — die mittlere Hangneigung sinkt, und `abfluss` ist in
        Mulden hoch und auf Kaemmen niedrig. Ohne diese Eigenschaft waere das
        Abflussfeld fuer den Weltgenerator wertlos.
     5. Keine NaN, unter keiner Parameterkombination.
     6. Der Boeschungswinkel wird eingehalten (mit benannter Toleranz).
     7. erodiereRegion deckt sich im Inneren mit dem globalen Lauf — exakt,
        solange das Rechenfenster gross genug ist, und sonst innerhalb einer
        gemessenen Schranke. Siehe den langen Kommentar bei Zusage 7.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fractal, rngOf } from '../src/core/rng.js';
import {
  EROSION_STANDARD, haerteFeld, erodiere, erodiereRegion,
  erosionStarten, erosionSchritt, erosionErgebnis, erosionAbbrechen
} from '../src/world/erosion.js';

/* --------------------------------------------------------------------------
   Hilfen
   -------------------------------------------------------------------------- */

/** Testgelaende nach demselben Rezept wie terrain.js/genBaseIn: grobe Masse,
 *  feine Oktave, optional Grat-Rauschen. `rau` schaltet auf ein Profil um, das
 *  es in der Biomregistry wirklich gibt (Karst: fein 6, grat 0.6..0.7). */
function gelaende(VW, seed, rau) {
  const amp = 26, fein = rau ? 6 : 4, ff = rau ? 0.05 : 0.03, grat = rau ? 0.6 : 0;
  const h = new Float32Array(VW * VW), halb = (VW - 1) / 2;
  for (let j = 0; j < VW; j++) {
    for (let i = 0; i < VW; i++) {
      const x = i - halb, z = j - halb;
      let v = fractal(x * 0.006, z * 0.006, seed) * amp + fractal(x * ff, z * ff, seed + 77) * fein;
      if (grat) {
        const rg = fractal(x * 0.011, z * 0.011, seed + 211);
        v += (1 - Math.abs(rg * 2 - 1)) * grat * amp;
      }
      h[j * VW + i] = v;
    }
  }
  return h;
}

/** Bitgleichheit zweier Float32Arrays — ueber die Rohbytes, nicht ueber `===`.
 *  Grund wie in hilfen/hash.mjs: nur so faellt ein Unterschied im letzten Bit
 *  und die Verwechslung von +0 und -0 auf. */
function gleicheBits(a, b) {
  if (a.length !== b.length) return false;
  const va = Buffer.from(a.buffer, a.byteOffset, a.byteLength);
  const vb = Buffer.from(b.buffer, b.byteOffset, b.byteLength);
  return va.equals(vb);
}

function alleFelderGleich(x, y) {
  return gleicheBits(x.hoehe, y.hoehe) && gleicheBits(x.abfluss, y.abfluss)
    && gleicheBits(x.sediment, y.sediment) && gleicheBits(x.haerte, y.haerte)
    && x.randVerlust === y.randVerlust;
}

function zaehleNaN(f) {
  let n = 0;
  for (let k = 0; k < f.length; k++) if (!Number.isFinite(f[k])) n++;
  return n;
}

/** Mittlerer Betrag des Hoehengradienten ueber das Innere. */
function mittlereNeigung(f, VW) {
  let s = 0, n = 0;
  for (let j = 1; j < VW - 1; j++) {
    for (let i = 1; i < VW - 1; i++) {
      const id = j * VW + i;
      const gx = (f[id + 1] - f[id - 1]) * 0.5, gz = (f[id + VW] - f[id - VW]) * 0.5;
      s += Math.sqrt(gx * gx + gz * gz); n++;
    }
  }
  return s / n;
}

/** Groesster Hoehenunterschied zwischen zwei Kantennachbarn — genau die
 *  Groesse, die der thermische Pass unter die Boeschungsschwelle druecken soll. */
function groesstesGefaelle(f, VW) {
  let m = 0;
  for (let j = 0; j < VW; j++) {
    for (let i = 0; i < VW - 1; i++) {
      const d = Math.abs(f[j * VW + i] - f[j * VW + i + 1]);
      if (d > m) m = d;
    }
  }
  for (let j = 0; j < VW - 1; j++) {
    for (let i = 0; i < VW; i++) {
      const d = Math.abs(f[j * VW + i] - f[(j + 1) * VW + i]);
      if (d > m) m = d;
    }
  }
  return m;
}

/* ==========================================================================
   1. Der Zeitschnitt aendert nichts
   ========================================================================== */
test('Ebene 6 — Zeitschnitt aendert das Ergebnis nicht', async (t) => {
  const VW = 129, seed = 4711;
  const h0 = gelaende(VW, seed);
  const amStueck = erodiere(h0, VW, { seed });

  await t.test('unregelmaessige Haeppchen (Einheitendeckel)', () => {
    // Deterministisch unregelmaessig: die Haeppchengroessen kommen aus einem
    // eigenen Zufallsstrom, damit der Lauf reproduzierbar zerhackt wird.
    // Eine Uhr laesst sich nicht zweimal gleich anhalten — ein Einheiten-
    // deckel schon, und nur damit ist die Aussage nachpruefbar statt
    // wahrscheinlich.
    const wuerfel = rngOf(0xC0FFEE);
    const z = erosionStarten(h0, VW, { seed });
    let haeppchen = 0, r;
    do {
      r = erosionSchritt(z, Infinity, 1 + Math.floor(wuerfel() * 220));
      haeppchen++;
      assert.ok(r.anteil >= 0 && r.anteil <= 1, 'Anteil bleibt in 0..1');
    } while (!r.fertig);
    assert.ok(haeppchen >= 20, 'der Lauf wurde wirklich zerhackt (' + haeppchen + ' Haeppchen)');
    t.diagnostic(haeppchen + ' Haeppchen, Groessen 1..220 Einheiten');
    assert.ok(alleFelderGleich(amStueck, erosionErgebnis(z)),
      'alle vier Felder und randVerlust sind bitgleich');
  });

  await t.test('Haeppchen nach Zeitbudget (der echte Betriebsfall)', () => {
    const z = erosionStarten(h0, VW, { seed });
    let haeppchen = 0, r;
    do { r = erosionSchritt(z, 0.2); haeppchen++; } while (!r.fertig);
    t.diagnostic(haeppchen + ' Haeppchen a 0,2 ms');
    assert.ok(alleFelderGleich(amStueck, erosionErgebnis(z)));
  });

  await t.test('ein einziges Haeppchen mit riesigem Budget', () => {
    const z = erosionStarten(h0, VW, { seed });
    const r = erosionSchritt(z, Infinity);
    assert.equal(r.fertig, true);
    assert.equal(r.anteil, 1);
    assert.ok(alleFelderGleich(amStueck, erosionErgebnis(z)));
  });

  await t.test('Budget 0 kommt trotzdem voran', () => {
    const z = erosionStarten(h0, VW, { seed });
    let n = 0, r;
    do { r = erosionSchritt(z, 0); n++; } while (!r.fertig && n < 200000);
    assert.equal(r.fertig, true, 'kein Stillstand bei Budget 0');
    assert.ok(alleFelderGleich(amStueck, erosionErgebnis(z)));
  });

  await t.test('das Eingangsfeld bleibt unangetastet', () => {
    const kopie = gelaende(VW, seed);
    assert.ok(gleicheBits(h0, kopie), 'erodiere schreibt nicht in fremde Puffer');
  });

  await t.test('Abbruch gibt kein halbes Ergebnis heraus', () => {
    const z = erosionStarten(h0, VW, { seed });
    erosionSchritt(z, Infinity, 50);
    erosionAbbrechen(z);
    assert.equal(erosionErgebnis(z), null);
    assert.equal(erosionSchritt(z, Infinity).fertig, true);
  });
});

/* ==========================================================================
   2. Determinismus
   ========================================================================== */
test('Ebene 6 — Determinismus', async (t) => {
  const VW = 97;
  const h0 = gelaende(VW, 2024);

  await t.test('zweimal derselbe Aufruf ergibt bitgleich dasselbe', () => {
    const a = erodiere(h0, VW, { seed: 2024 });
    const b = erodiere(h0, VW, { seed: 2024 });
    assert.ok(alleFelderGleich(a, b));
  });

  await t.test('zwei Seeds ergeben Verschiedenes (Gegenprobe)', () => {
    const a = erodiere(h0, VW, { seed: 2024 });
    const b = erodiere(h0, VW, { seed: 2025 });
    assert.ok(!gleicheBits(a.hoehe, b.hoehe), 'Hoehen unterscheiden sich');
    assert.ok(!gleicheBits(a.abfluss, b.abfluss), 'Abfluss unterscheidet sich');
    assert.ok(!gleicheBits(a.haerte, b.haerte), 'Haerte unterscheidet sich');
  });

  await t.test('haerteFeld ist eine reine Funktion von Ort, Seed und Varianz', () => {
    const a = haerteFeld(VW, 2024, 0.35);
    const b = haerteFeld(VW, 2024, 0.35);
    assert.ok(gleicheBits(a, b));
    // Dasselbe Feld, das der Lauf intern benutzt — sonst laesen Biom-Ableitung
    // und Vegetation eine andere Haerte als die Erosion.
    const lauf = erodiere(h0, VW, { seed: 2024 });
    assert.ok(gleicheBits(a, lauf.haerte), 'gleiches Feld wie im Lauf');
    assert.ok(!gleicheBits(a, haerteFeld(VW, 2025, 0.35)), 'anderer Seed, anderes Feld');
    const eins = haerteFeld(VW, 2024, 0);
    for (let k = 0; k < eins.length; k++) assert.equal(eins[k], 1, 'Varianz 0 -> lauter Einsen');
  });
});

/* ==========================================================================
   3. Erhaltung

   Die Bilanz lautet:  Summe(nachher) - Summe(vorher) + randVerlust == 0.

   `randVerlust` ist die Fracht, die ein Tropfen ueber den Kartenrand
   hinaustraegt (dort versickert er). Ohne diesen Posten waere die Bilanz eine
   Luege; mit ihm ist sie eine Aussage. Der thermische Pass klemmt seine
   Nachbarn am Rand und ist fuer sich genommen streng erhaltend — er darf also
   gar nichts zur Differenz beitragen.

   Toleranz: die Felder sind Float32, jede Ablagerung schreibt gerundet zurueck.
   Der Fehler waechst mit der Zahl der Schreibzugriffe, nicht mit der Karte,
   deshalb wird gegen die BEWEGTE Masse gemessen, nicht gegen die Gesamtmasse.
   ========================================================================== */
test('Ebene 6 — Material entsteht nicht aus dem Nichts', async (t) => {
  const VW = 129, seed = 31337;
  const h0 = gelaende(VW, seed);

  await t.test('vollstaendige Bilanz mit Randverlust', () => {
    const r = erodiere(h0, VW, { seed });
    let vor = 0, nach = 0, bewegt = 0;
    for (let k = 0; k < h0.length; k++) {
      vor += h0[k]; nach += r.hoehe[k]; bewegt += Math.abs(r.hoehe[k] - h0[k]);
    }
    const rest = nach - vor + r.randVerlust;
    t.diagnostic('bewegt ' + bewegt.toFixed(1) + ', ueber den Rand ' + r.randVerlust.toFixed(2)
      + ', unerklaerter Rest ' + rest.toExponential(2));
    assert.ok(r.randVerlust > 0, 'ueber den Rand geht wirklich Material verloren');
    assert.ok(Math.abs(rest) < bewegt * 1e-4,
      'unerklaerter Rest ' + rest + ' liegt unter 0,01 % der bewegten Masse ' + bewegt);
  });

  await t.test('der thermische Pass allein ist masseerhaltend', () => {
    // Auf rauhem Gelaende, sonst gibt es ueberhaupt keinen Hang oberhalb der
    // Boeschung und der Pass haette nichts zu tun (er ist dann korrekt untaetig,
    // aber die Erhaltungsaussage waere leer).
    const rau = gelaende(VW, seed, true);
    const r = erodiere(rau, VW, { seed, tropfen: 0, durchgaengeFein: 12 });
    let vor = 0, nach = 0, bewegt = 0;
    for (let k = 0; k < rau.length; k++) {
      vor += rau[k]; nach += r.hoehe[k]; bewegt += Math.abs(r.hoehe[k] - rau[k]);
    }
    assert.equal(r.randVerlust, 0, 'ohne Tropfen kein Randverlust');
    assert.ok(bewegt > 0, 'der Pass hat ueberhaupt etwas getan');
    assert.ok(Math.abs(nach - vor) < bewegt * 1e-4,
      'Talus schiebt Material um, erzeugt aber keines');
  });

  await t.test('sediment ist die Netto-Hoehenaenderung des Wasserpasses', () => {
    // Ohne thermische Durchgaenge ist jede Hoehenaenderung eine des Wassers —
    // und genau die schreibt das Sedimentfeld mit. Faellt das auseinander,
    // faerbt die Schwemmlandschicht spaeter an der falschen Stelle.
    const r = erodiere(h0, VW, { seed, durchgaengeGrob: 0, durchgaengeFein: 0 });
    let maxAbw = 0;
    for (let k = 0; k < h0.length; k++) {
      const d = Math.abs((r.hoehe[k] - h0[k]) - r.sediment[k]);
      if (d > maxAbw) maxAbw = d;
    }
    t.diagnostic('groesste Abweichung Hoehenaenderung/Sediment: ' + maxAbw.toExponential(2));
    assert.ok(maxAbw < 1e-3, 'Sediment deckt sich mit der Hoehenaenderung');
  });
});

/* ==========================================================================
   4. Plausibilitaet
   ========================================================================== */
test('Ebene 6 — das Ergebnis sieht aus wie Erosion', async (t) => {
  await t.test('die mittlere Hangneigung sinkt (rauhes Gelaende)', () => {
    // BEWUSST auf rauhem Gelaende (Karstprofil: fein 6, grat 0.6). Auf einer
    // sanften Wiese, deren Haenge weit unter dem Boeschungswinkel liegen, hat
    // der Talus nichts zu tun, und der Wasserpass GRAEBT Rinnen — dort steigt
    // die mittlere Neigung um knapp ein Prozent. Das ist kein Fehler, sondern
    // der Zweck der Uebung: eine Rinne ist steiler als die Flaeche, in der sie
    // liegt. Die Glaettungswirkung ist dort messbar, wo es etwas zu glaetten
    // gibt — an Rauschkanten oberhalb der Boeschung.
    const VW = 193, seed = 8080;
    const h0 = gelaende(VW, seed, true);
    const r = erodiere(h0, VW, { seed });
    const vor = mittlereNeigung(h0, VW), nach = mittlereNeigung(r.hoehe, VW);
    t.diagnostic('mittlere Neigung ' + vor.toFixed(4) + ' -> ' + nach.toFixed(4));
    assert.ok(nach < vor, 'Neigung sinkt: ' + vor + ' -> ' + nach);
    const gVor = groesstesGefaelle(h0, VW), gNach = groesstesGefaelle(r.hoehe, VW);
    t.diagnostic('steilste Kante ' + gVor.toFixed(3) + ' -> ' + gNach.toFixed(3));
    assert.ok(gNach < gVor, 'auch die steilste Einzelkante wird flacher');
  });

  await t.test('abfluss ist in Mulden hoch und auf Kaemmen niedrig', () => {
    const VW = 193, seed = 606;
    const h0 = gelaende(VW, seed);
    const r = erodiere(h0, VW, { seed });
    // "Mulde" und "Kamm" sind Aussagen ueber eine LANDFORM, nicht ueber drei
    // Zellen: gemessen wird die Hoehe gegen das Mittel der Umgebung mit
    // Radius `rad`, und verglichen werden die extremsten Zehntel. Die
    // Massstabsabhaengigkeit ist selbst eine Aussage — bei Radius 1 (der
    // Kruemmung aus computeAO) liegt das Verhaeltnis bei knapp 2, weil jede
    // frisch gegrabene Rinnenwand als "Kamm" mitzaehlt; auf Talformmassstab
    // liegt es bei 6 bis 8. Genau in diesem Massstab liest der Weltgenerator
    // das Feld, wenn er Fluesse legt.
    const H = r.hoehe;
    function verhaeltnis(rad) {
      const li = [];
      for (let j = rad; j < VW - rad; j++) {
        for (let i = rad; i < VW - rad; i++) {
          let s = 0, n = 0;
          for (let b = -rad; b <= rad; b++) {
            for (let a = -rad; a <= rad; a++) { s += H[(j + b) * VW + i + a]; n++; }
          }
          li.push([H[j * VW + i] - s / n, r.abfluss[j * VW + i]]);
        }
      }
      li.sort((a, b) => a[0] - b[0]);
      const z = Math.floor(li.length / 10);
      let mulde = 0, kamm = 0;
      for (let k = 0; k < z; k++) mulde += li[k][1];
      for (let k = li.length - z; k < li.length; k++) kamm += li[k][1];
      return { mulde: mulde / z, kamm: kamm / z, v: (mulde / z) / (kamm / z) };
    }
    const fein = verhaeltnis(1), form = verhaeltnis(4);
    t.diagnostic('Abfluss Mulde/Kamm — Zellmassstab ' + fein.v.toFixed(2)
      + ', Talformmassstab ' + form.v.toFixed(2)
      + ' (Mulden ' + form.mulde.toFixed(3) + ', Kaemme ' + form.kamm.toFixed(3) + ')');
    assert.ok(form.v > 4, 'Talboeden fuehren ein Vielfaches des Wassers der Kaemme');
    assert.ok(fein.v > 1.5, 'auch im Zellmassstab stimmt das Vorzeichen');
  });

  await t.test('sediment sammelt sich unten, nicht oben', () => {
    const VW = 193, seed = 606;
    const h0 = gelaende(VW, seed);
    const r = erodiere(h0, VW, { seed });
    // Ablagerung ist ein Tieflandvorgang. Gemessen als mittlere Hoehe der
    // Zellen mit viel Sediment gegen die mittlere Hoehe der ganzen Karte.
    let sAbl = 0, hAbl = 0, hAlle = 0;
    for (let k = 0; k < r.sediment.length; k++) {
      hAlle += r.hoehe[k];
      if (r.sediment[k] > 0.05) { sAbl += 1; hAbl += r.hoehe[k]; }
    }
    hAlle /= r.sediment.length; hAbl /= sAbl;
    t.diagnostic('mittlere Hoehe: Schwemmzellen ' + hAbl.toFixed(2) + ', ganze Karte ' + hAlle.toFixed(2));
    assert.ok(sAbl > 0, 'es wird ueberhaupt abgelagert');
    assert.ok(hAbl < hAlle, 'Schwemmland liegt tiefer als der Kartendurchschnitt');
  });
});

/* ==========================================================================
   5. Keine NaN
   ========================================================================== */
test('Ebene 6 — keine NaN in irgendeinem Feld', async (t) => {
  const VW = 65;
  const gelaendeArten = {
    normal: gelaende(VW, 12345),
    flach: new Float32Array(VW * VW),                       // exakt eben
    stufe: (() => {                                          // senkrechte Wand
      const f = new Float32Array(VW * VW);
      for (let j = 0; j < VW; j++) for (let i = 0; i < VW; i++) f[j * VW + i] = i > VW / 2 ? 40 : 0;
      return f;
    })(),
    negativ: (() => {
      const f = gelaende(VW, 999);
      for (let k = 0; k < f.length; k++) f[k] -= 60;         // alles unter null
      return f;
    })()
  };
  const faelle = [
    ['Vorgaben', {}],
    ['staerke 0', { staerke: 0 }],
    ['staerke negativ', { staerke: -1 }],
    ['staerke 5', { staerke: 5 }],
    ['tropfen 0', { tropfen: 0 }],
    ['keine thermischen Durchgaenge', { durchgaengeGrob: 0, durchgaengeFein: 0 }],
    ['gar nichts', { tropfen: 0, durchgaengeGrob: 0, durchgaengeFein: 0 }],
    ['boeschung 1 Grad', { boeschung: 1 }],
    ['boeschung 89 Grad', { boeschung: 89 }],
    ['boeschung 0 (geklemmt)', { boeschung: 0 }],
    ['traegheit 0', { traegheit: 0 }],
    ['traegheit 1 (geklemmt)', { traegheit: 1 }],
    ['verdunstung 1', { verdunstung: 1 }],
    ['verdunstung 0', { verdunstung: 0 }],
    ['merkmalGroesse 1', { merkmalGroesse: 1 }],
    ['merkmalGroesse 6', { merkmalGroesse: 6 }],
    ['merkmalGroesse 0 (geklemmt)', { merkmalGroesse: 0 }],
    ['haerteVarianz 0', { haerteVarianz: 0 }],
    ['haerteVarianz 0.9', { haerteVarianz: 0.9 }],
    ['viele Tropfen, lange Wege', { tropfen: 4000, maxSchritte: 200 }],
    ['maxSchritte 1', { maxSchritte: 1 }],
    ['minGefaelle 0', { minGefaelle: 0 }],
    ['kapazitaet 0', { kapazitaet: 0 }],
    ['schwerkraft 0', { schwerkraft: 0 }],
    ['startWasser 0', { startWasser: 0 }],
    ['rutschRate 5 (geklemmt)', { rutschRate: 5 }]
  ];
  for (const [name, opt] of Object.keys(gelaendeArten).flatMap(
    (g) => faelle.map(([n, o]) => [g + ' / ' + n, Object.assign({ _g: g }, o)]))) {
    await t.test(name, () => {
      const g = opt._g; delete opt._g;
      const h0 = gelaendeArten[g];
      const r = erodiere(h0, VW, Object.assign({ seed: 5150 }, opt));
      for (const feld of ['hoehe', 'abfluss', 'sediment', 'haerte']) {
        assert.equal(zaehleNaN(r[feld]), 0, feld + ' enthaelt NaN oder Unendlich');
      }
      assert.ok(Number.isFinite(r.randVerlust), 'randVerlust ist endlich');
    });
  }

  await t.test('staerke 0 laesst die Hoehen exakt in Ruhe (misst aber den Abfluss)', () => {
    const h0 = gelaende(VW, 4242);
    const r = erodiere(h0, VW, { seed: 4242, staerke: 0 });
    assert.ok(gleicheBits(h0, r.hoehe), 'kein einziges Bit veraendert');
    let summe = 0;
    for (let k = 0; k < r.abfluss.length; k++) summe += r.abfluss[k];
    assert.ok(summe > 0, 'die Tropfen laufen trotzdem und messen den Abfluss');
  });

  await t.test('kleinste sinnvolle Karte', () => {
    const r = erodiere(new Float32Array(5 * 5), 5, { seed: 1 });
    assert.equal(zaehleNaN(r.hoehe), 0);
    assert.equal(zaehleNaN(r.abfluss), 0);
  });
});

/* ==========================================================================
   6. Boeschungswinkel

   Der thermische Pass ist eine RELAXATION: je Durchgang wandert hoechstens die
   halbe Ueberhoehe zum Nachbarn. Ein langer, gleichmaessig steiler Hang aendert
   sich dabei zunaechst gar nicht (jede Zelle gibt so viel ab, wie sie von oben
   bekommt) — die Abflachung frisst sich vom Hangfuss her hinein, rund eine
   Zelle je Durchgang. Die Zusage lautet deshalb nicht "nach drei Durchgaengen",
   sondern "nach genuegend Durchgaengen", und die Pruefung raeumt sie ein.

   Gemessen auf 65x65 mit 1600 feinen Durchgaengen — ein Vielfaches der sechs
   Standarddurchgaenge und der Kantenlaenge. TOLERANZ 2 % ueber tan(Winkel):
   die Relaxation naehert sich der Schwelle geometrisch von oben und erreicht
   sie nie exakt. Gemessen wurde bei 1600 Durchgaengen ein Ueberschuss von
   0,01 % (bei 400 waren es fuer 20 Grad noch 5 %: je flacher der Winkel, desto
   mehr Material muss wandern, desto laenger dauert es).

   `haerteVarianz: 0` ist Absicht: bei ungleichmaessiger Haerte ist der
   eingestellte Winkel der des Durchschnittsgesteins, harter Fels traegt
   steilere Waende. Der zweite Fall unten prueft genau diese Schranke.
   ========================================================================== */
test('Ebene 6 — der Boeschungswinkel wird eingehalten', async (t) => {
  const VW = 65, seed = 7;
  const h0 = gelaende(VW, seed, true);
  const TOLERANZ = 1.02;

  for (const grad of [20, 30, 45]) {
    await t.test(grad + ' Grad, gleichmaessige Haerte', () => {
      const r = erodiere(h0, VW, {
        seed, tropfen: 0, haerteVarianz: 0,
        durchgaengeGrob: 0, durchgaengeFein: 1600, boeschung: grad
      });
      const talus = Math.tan(grad * Math.PI / 180);
      const max = groesstesGefaelle(r.hoehe, VW);
      t.diagnostic('tan(' + grad + ') = ' + talus.toFixed(5) + ', steilste Kante ' + max.toFixed(5)
        + ' (+' + ((max / talus - 1) * 100).toFixed(2) + ' %)');
      assert.ok(max <= talus * TOLERANZ,
        'steilste Kante ' + max + ' liegt ueber tan(' + grad + ')*' + TOLERANZ);
    });
  }

  await t.test('mit Haertevarianz gilt die Schranke des haertesten Gesteins', () => {
    const varianz = 0.35, grad = 30;
    const r = erodiere(h0, VW, {
      seed, tropfen: 0, haerteVarianz: varianz,
      durchgaengeGrob: 0, durchgaengeFein: 1600, boeschung: grad
    });
    const talus = Math.tan(grad * Math.PI / 180);
    const max = groesstesGefaelle(r.hoehe, VW);
    t.diagnostic('steilste Kante ' + max.toFixed(4) + ', Schranke '
      + (talus * (1 + varianz)).toFixed(4));
    assert.ok(max <= talus * (1 + varianz) * TOLERANZ,
      'harter Fels darf steiler stehen, aber nicht beliebig steil');
    assert.ok(max > talus,
      'und er steht auch wirklich steiler — sonst waere die Haerte wirkungslos');
  });

  await t.test('die Standardwerte brechen die schaerfsten Kanten bereits sichtbar', () => {
    const r = erodiere(h0, VW, { seed });
    const vor = groesstesGefaelle(h0, VW), nach = groesstesGefaelle(r.hoehe, VW);
    t.diagnostic('steilste Kante ' + vor.toFixed(3) + ' -> ' + nach.toFixed(3)
      + ' (Standard: ' + EROSION_STANDARD.durchgaengeGrob + ' + '
      + EROSION_STANDARD.durchgaengeFein + ' Durchgaenge)');
    assert.ok(nach < vor * 0.9, 'mindestens ein Zehntel weniger');
  });
});

/* ==========================================================================
   7. Region gegen global

   Der Pinsel ist NICHT der globale Lauf in klein, und exakt kann er es auch
   nicht sein. Der Grund steht ausfuehrlich in erosion.js; kurz:

     Ein Tropfen, der 60 Zellen neben der Box faellt, veraendert dort das
     Gelaende. Ein spaeterer Tropfen laeuft ueber diese Stelle und dann in die
     Box hinein — mit einer Bahn, die es ohne den ersten nicht gaebe. Um das
     einzufangen, muesste das Rechenfenster um die doppelte Tropfenreichweite
     groesser sein, fuer den naechsten Grad um die dreifache, und so fort. Der
     einzige exakte Ausschnitt ist die ganze Karte.

   Geprueft wird deshalb beides:
     a) Mit einem Fenster, das die ganze Karte umfasst, ist das Ergebnis in der
        Box BITGLEICH mit dem globalen Lauf. Das beweist, dass Tropfen-
        nummerierung, Haertefeld aus globalen Koordinaten und Saumeinblendung
        stimmen — ein Fehler darin waere hier sichtbar.
     b) Mit dem Standardeinzug bleibt die Abweichung unter einer benannten
        Schranke, und sie SINKT, wenn das Fenster waechst. Gemessen (257er
        Karte, Box 76x76): Einzug 24 -> 44 %, 48 -> 36 %, 72 -> 22 % der
        Aenderung, die der globale Lauf in derselben Box vornimmt.
   ========================================================================== */
test('Ebene 6 — erodiereRegion deckt sich im Inneren mit dem globalen Lauf', async (t) => {
  const VW = 257, seed = 4711;
  const h0 = gelaende(VW, seed);
  const glob = erodiere(h0, VW, { seed });
  const bi0 = 90, bi1 = 165, bj0 = 90, bj1 = 165;

  /** RMS-Abweichung in der Kernbox, und zum Vergleich die RMS-Aenderung, die
   *  der globale Lauf dort ueberhaupt vornimmt. */
  function abweichung(reg) {
    let sq = 0, sqG = 0, max = 0, n = 0;
    for (let j = bj0; j <= bj1; j++) {
      for (let i = bi0; i <= bi1; i++) {
        const a = glob.hoehe[j * VW + i];
        const b = reg.hoehe[(j - reg.j0) * reg.w + (i - reg.i0)];
        const d = Math.abs(a - b);
        if (d > max) max = d;
        sq += d * d; n++;
        const dg = a - h0[j * VW + i]; sqG += dg * dg;
      }
    }
    return { max, rms: Math.sqrt(sq / n), rmsGlobal: Math.sqrt(sqG / n) };
  }

  await t.test('mit ganzer Karte als Fenster: bitgleich', () => {
    const reg = erodiereRegion(h0, VW, bi0, bi1, bj0, bj1, { seed, einzug: VW });
    assert.equal(reg.w, VW); assert.equal(reg.h, VW);
    assert.equal(reg.i0, 0); assert.equal(reg.j0, 0);
    let ungleich = 0;
    for (let j = bj0; j <= bj1; j++) {
      for (let i = bi0; i <= bi1; i++) {
        if (!Object.is(glob.hoehe[j * VW + i], reg.hoehe[j * VW + i])) ungleich++;
      }
    }
    assert.equal(ungleich, 0, 'kein einziger Wert weicht ab');
  });

  await t.test('mit Standardeinzug: Abweichung unter der benannten Schranke', () => {
    const reg = erodiereRegion(h0, VW, bi0, bi1, bj0, bj1, { seed });
    const a = abweichung(reg);
    t.diagnostic('Fenster ' + reg.w + 'x' + reg.h + ', RMS-Abweichung ' + a.rms.toFixed(5)
      + ' gegen RMS-Aenderung ' + a.rmsGlobal.toFixed(5)
      + ' (' + (100 * a.rms / a.rmsGlobal).toFixed(1) + ' %), groesste ' + a.max.toFixed(3));
    assert.ok(a.rms < a.rmsGlobal * 0.5,
      'die Abweichung bleibt klein gegen die Aenderung selbst');
  });

  await t.test('groesseres Fenster, kleinere Abweichung', () => {
    const eng = abweichung(erodiereRegion(h0, VW, bi0, bi1, bj0, bj1, { seed, einzug: 24 }));
    const weit = abweichung(erodiereRegion(h0, VW, bi0, bi1, bj0, bj1, { seed, einzug: 72 }));
    t.diagnostic('Einzug 24: ' + (100 * eng.rms / eng.rmsGlobal).toFixed(1)
      + ' % — Einzug 72: ' + (100 * weit.rms / weit.rmsGlobal).toFixed(1) + ' %');
    assert.ok(weit.rms < eng.rms, 'der Fehler ist eine Frage des Fensters, kein Grundrauschen');
  });

  await t.test('ausserhalb von Box und Saum bleibt das Ausgangsfeld stehen', () => {
    const reg = erodiereRegion(h0, VW, bi0, bi1, bj0, bj1, { seed });
    let verletzt = 0, geprueft = 0;
    const saum = EROSION_STANDARD.saum;
    for (let jl = 0; jl < reg.h; jl++) {
      for (let il = 0; il < reg.w; il++) {
        const gi = reg.i0 + il, gj = reg.j0 + jl;
        const d = Math.max(bi0 - gi, gi - bi1, bj0 - gj, gj - bj1);
        if (d < saum) continue;                       // im Saum oder in der Box
        geprueft++;
        if (!Object.is(reg.hoehe[jl * reg.w + il], h0[gj * VW + gi])) verletzt++;
        if (reg.abfluss[jl * reg.w + il] !== 0) verletzt++;
      }
    }
    t.diagnostic(geprueft + ' Zellen ausserhalb des Saums geprueft');
    assert.ok(geprueft > 0);
    assert.equal(verletzt, 0, 'der Pinsel wirkt nur, wo er soll');
  });

  await t.test('im Saum gibt es keine Abrisskante', () => {
    const reg = erodiereRegion(h0, VW, bi0, bi1, bj0, bj1, { seed });
    // Groesster Sprung zwischen zwei Nachbarn im Ergebnis gegen den groessten
    // Sprung im Ausgangsfeld: die Einblendung darf keine neue Stufe erzeugen.
    let maxNeu = 0;
    for (let jl = 0; jl < reg.h; jl++) {
      for (let il = 0; il < reg.w - 1; il++) {
        const d = Math.abs(reg.hoehe[jl * reg.w + il] - reg.hoehe[jl * reg.w + il + 1]);
        if (d > maxNeu) maxNeu = d;
      }
    }
    const maxAlt = groesstesGefaelle(h0, VW);
    t.diagnostic('steilste Kante im Fenster ' + maxNeu.toFixed(3)
      + ', im Ausgangsgelaende ' + maxAlt.toFixed(3));
    assert.ok(maxNeu < maxAlt * 2, 'kein Absatz am Boxrand');
  });
});
