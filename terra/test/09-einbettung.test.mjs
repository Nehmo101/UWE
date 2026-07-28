/* ==========================================================================
   Ebene 6 — Einbettung

   Die Ebenen 1 bis 5 pruefen Module. Diese Datei prueft die NAEHTE: ob die in
   Runde I gebauten Kerne (Erosion, Biomfeld, Beschriftung) an den Stellen
   wirken, an denen sie eingehaengt wurden.

   Das ist eine eigene Fehlerklasse. Ein Kernmodul kann tadellos rechnen und
   trotzdem wirkungslos sein, weil sein Aufruf an der falschen Stelle der Kette
   steht oder das Ergebnis niemand liest. Genau so lag `rebuildAll` in Runde I5
   falsch herum: jede beteiligte Funktion war fuer sich richtig.

   Bewusst NICHT hier: was die Kerne selbst zusagen (das steht in 06, 07, 08).
   Hier steht nur, was erst durch die Verdrahtung entsteht.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { testWelt, hashElement, BEISPIEL_SEED } from './hilfen/karte.mjs';
import { ladeTerra } from './hilfen/laden.mjs';

/* Eine Flaeche, die sicher auf Land liegt (Seed 4711, siehe hilfen/karte.mjs).
   Klein genug, dass ringsum unberuehrtes Gelaende bleibt — die Vergleichs-
   punkte draussen sollen wirklich draussen liegen. */
const BIOM_POLY = [{ x: -30, z: -30 }, { x: 10, z: -34 }, { x: 14, z: 6 }, { x: -26, z: 10 }];
const DRINNEN = { x: -8, z: -12 };
const DRAUSSEN = { x: 78, z: 74 };

/* --- I2: wirkt die Biomflaeche auf die Terrainfarbe? -------------------- */

async function farbeAn(welt, x, z) {
  const THREE = await import('three');
  const out = new THREE.Color();
  const { terrain } = welt.m;
  // normalAt schreibt in einen uebergebenen Vektor (kein Rueckgabeobjekt) —
  // dieselbe Schreibweise wie im Bestand, wo der Aufrufer den Puffer haelt.
  const n = terrain.normalAt(x, z, new THREE.Vector3());
  terrain.terrainColor(terrain.heightAt(x, z), n.y, x, z, out, 1);
  return [out.r, out.g, out.b];
}

function abstand(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

test('Ebene 6 — eine Biomflaeche faerbt das Terrain in ihrem Inneren um', async () => {
  const welt = await testWelt({ seed: BEISPIEL_SEED, biom: 'wiese' });
  const vorher = await farbeAn(welt, DRINNEN.x, DRINNEN.z);
  const vorherDraussen = await farbeAn(welt, DRAUSSEN.x, DRAUSSEN.z);

  // `schnee` gegen `wiese`: zwei Paletten, die sich in jedem Kanal deutlich
  // unterscheiden. Ein knapper Kontrast wuerde die Pruefung von der Toleranz
  // abhaengig machen statt von der Sache.
  welt.element('flaeche', 'biom', BIOM_POLY, { biom: 'schnee', weich: 6 });
  welt.alleNeu();

  const nachher = await farbeAn(welt, DRINNEN.x, DRINNEN.z);
  const nachherDraussen = await farbeAn(welt, DRAUSSEN.x, DRAUSSEN.z);

  assert.ok(abstand(vorher, nachher) > 0.05,
    'Die Farbe im Inneren hat sich kaum geaendert (' + abstand(vorher, nachher).toFixed(4)
    + ') — die Flaeche wirkt nicht auf terrainColor');
  assert.deepEqual(nachherDraussen, vorherDraussen,
    'Weit ausserhalb hat sich die Farbe geaendert — die Maske blutet');
});

test('Ebene 6 — ohne Biomflaeche ist die Farbe Bit fuer Bit die bisherige', async () => {
  /* Die Zusage aus dem Eingriff in terrainColor: bei Gewicht 0 wird die
     Registry-Palette benutzt und kein einziger Rechenschritt anders. Wenn das
     nicht mehr stimmt, hat sich das ganze Bild verschoben, ohne dass jemand
     eine Biomflaeche gezeichnet haette. */
  const a = await testWelt({ seed: BEISPIEL_SEED, biom: 'wiese' });
  const p1 = await farbeAn(a, 12, -20);
  const p2 = await farbeAn(a, -44, 30);
  const b = await testWelt({ seed: BEISPIEL_SEED, biom: 'wiese' });
  assert.deepEqual(await farbeAn(b, 12, -20), p1);
  assert.deepEqual(await farbeAn(b, -44, 30), p2);
});

test('Ebene 6 — die Bepflanzung folgt der Biomflaeche, nicht dem Kartenbiom', async () => {
  /* genWald fragt das Biom je Kandidat ab. Ein Wald, der halb in einer
     Wuestenflaeche liegt, muss dort duenner stehen — das ist der einzige
     beobachtbare Beleg dafuer, dass die Abfrage wirklich je Kandidat laeuft
     und nicht einmal je Element. */
  const ohne = await testWelt({ seed: BEISPIEL_SEED, biom: 'wiese' });
  const w1 = ohne.element('flaeche', 'wald', BIOM_POLY);
  ohne.alleNeu();
  const h1 = hashElement(w1);

  const mit = await testWelt({ seed: BEISPIEL_SEED, biom: 'wiese' });
  const w2 = mit.element('flaeche', 'wald', BIOM_POLY);
  mit.element('flaeche', 'biom', BIOM_POLY, { biom: 'wueste', weich: 4 });
  mit.alleNeu();
  const h2 = hashElement(w2);

  assert.notEqual(h1, h2,
    'Derselbe Wald mit und ohne Wuestenflaeche darunter ergibt dasselbe — '
    + 'die Biomabfrage je Kandidat greift nicht');
});

test('Ebene 6 — die Biomflaeche ist deterministisch und reihenfolgefest', async () => {
  const bauen = async (zuerstWald) => {
    const w = await testWelt({ seed: BEISPIEL_SEED, biom: 'wiese' });
    let wald;
    if (zuerstWald) {
      wald = w.element('flaeche', 'wald', BIOM_POLY);
      w.element('flaeche', 'biom', BIOM_POLY, { biom: 'moor', weich: 5 });
    } else {
      w.element('flaeche', 'biom', BIOM_POLY, { biom: 'moor', weich: 5 });
      wald = w.element('flaeche', 'wald', BIOM_POLY);
    }
    w.alleNeu();
    return hashElement(wald);
  };
  const a = await bauen(true);
  assert.equal(await bauen(true), a, 'Zweimal derselbe Aufbau ergibt Verschiedenes');
  assert.equal(await bauen(false), a,
    'Die Reihenfolge der Elemente aendert das Ergebnis — die Maske haengt an ihr');
});

test('Ebene 6 — zweimal rebuildAll aendert die Biomflaeche nicht', async () => {
  /* Dieselbe Falle wie bei rebuildAll in I5: die Maske muss VOR der
     Elementschleife stehen. Steht sie danach, sieht der erste Aufbau anders
     aus als jeder folgende. */
  const w = await testWelt({ seed: BEISPIEL_SEED, biom: 'wiese' });
  const wald = w.element('flaeche', 'wald', BIOM_POLY);
  w.element('flaeche', 'biom', BIOM_POLY, { biom: 'wueste', weich: 5 });
  w.alleNeu();
  const erste = hashElement(wald);
  w.alleNeu();
  assert.equal(hashElement(wald), erste,
    'Der zweite Neuaufbau ergibt einen anderen Wald als der erste');
});

test('Ebene 6 — die Biomflaeche wirkt auch nach einer KLEINEREN Karte', async () => {
  /* REGRESSION, und ein Fehler, der ohne diese Ebene niemandem aufgefallen
     waere: felderSichern laesst die Felder nur wachsen. Nach einer 1024er
     Karte ist biomFeld 1.050.625 Eintraege lang — auch wenn danach eine 256er
     geladen wird. biomFeldBauen prueft aber `opt.feld.length === VW*VW` und
     legte bei Abweichung still ein eigenes Feld an: die Ableitung lief ins
     Leere, jede Biomflaeche war wirkungslos. Ohne Fehlermeldung, nur ohne
     Bild. Behoben ueber eine subarray-Sicht in rebuildBiomFeld.

     Die Reihenfolge gross -> klein ist der ganze Punkt der Pruefung. */
  const gross = await testWelt({ seed: BEISPIEL_SEED, biom: 'wiese', groesse: 512 });
  gross.alleNeu();

  const klein = await testWelt({ seed: BEISPIEL_SEED, biom: 'wiese', groesse: 256 });
  const vorher = await farbeAn(klein, DRINNEN.x, DRINNEN.z);
  klein.element('flaeche', 'biom', BIOM_POLY, { biom: 'schnee', weich: 6 });
  klein.alleNeu();
  const nachher = await farbeAn(klein, DRINNEN.x, DRINNEN.z);

  assert.ok(abstand(vorher, nachher) > 0.05,
    'Nach einer groesseren Karte wirkt die Biomflaeche nicht mehr '
    + '(' + abstand(vorher, nachher).toFixed(4) + ') — die Feldlaenge passt nicht');
});

/* --- I3: greift das Erosionsergebnis ins Hoehenfeld? --------------------

   ACHTUNG, Reihenfolge: terrain.js ist ein Einzelbestand, seine Felder leben
   ueber die ganze Datei. Die Pruefung des UNBERUEHRTEN Zustands muss deshalb
   VOR der laufen, die erodiert — danach steht in `abfluss` etwas drin, und das
   ist dann richtig so. Das ist keine Schwaeche der Pruefung, sondern die Lage:
   ein zweiter Prozess je Test waere hier teurer als die Regel, diesen Block
   nicht umzusortieren.                                                      */

test('Ebene 6 — die Messfelder stehen auch ohne gelaufene Erosion bereit', async () => {
  /* Zusage aus felderSichern: Abfluss und Sediment 0, Haerte neutral 1. Wer
     sie liest, darf das bedingungslos tun — sonst braeuchte jede Auswertung
     eine Sonderbehandlung fuer "noch nie erodiert". */
  const w = await testWelt({ seed: BEISPIEL_SEED });
  const { terrain } = w.m;
  const n = w.m.store.KARTE.vw * w.m.store.KARTE.vw;   // nur die aktuelle Karte, s. u.
  assert.ok(n > 0 && terrain.abfluss.length >= n);
  for (let i = 0; i < n; i += 97) {
    assert.equal(terrain.abfluss[i], 0);
    assert.equal(terrain.sediment[i], 0);
    assert.equal(terrain.haerte[i], 1);
  }
});

test('Ebene 6 — wendeErosionAn schreibt Hoehen und Messfelder', async () => {
  const w = await testWelt({ seed: BEISPIEL_SEED });
  const { terrain } = w.m;
  const erosion = await ladeTerra('world/erosion.js');
  const VW = w.m.store.KARTE.vw;

  /* Nur die ersten VW*VW Eintraege zaehlen. felderSichern laesst die Felder
     nur wachsen — nach einer groesseren Karte im selben Prozess ist `base`
     laenger als die aktuelle Karte, und der Rest dahinter ist Altbestand, der
     niemanden interessiert. Gegen `base.length` zu messen hiesse, das
     Ergebnis von der Reihenfolge der Testdateien abhaengig zu machen. */
  const n = VW * VW;
  const vorher = Float32Array.from(terrain.base.subarray(0, n));
  const e = erosion.erodiere(terrain.base, VW, { seed: 99, tropfenDichte: 0.02 });
  terrain.wendeErosionAn(e);

  let geaendert = 0;
  for (let i = 0; i < n; i++) if (vorher[i] !== terrain.base[i]) geaendert++;
  assert.ok(geaendert > n * 0.2,
    'Nur ' + geaendert + ' von ' + n + ' Hoehen geaendert — das Ergebnis kommt nicht an');

  let mitAbfluss = 0;
  for (let i = 0; i < n; i++) if (terrain.abfluss[i] > 0) mitAbfluss++;
  assert.ok(mitAbfluss > 0, 'Das Abflussfeld ist leer geblieben');

  for (let i = 0; i < n; i++) {
    assert.ok(Number.isFinite(terrain.base[i]), 'NaN im Hoehenfeld bei ' + i);
  }
  // hgt muss mitgezogen sein: wendeErosionAn ruft recomputeHeights.
  assert.ok(Number.isFinite(terrain.heightAt(0, 0)));
});

/* --- I4: haelt die Zielpruefung beim Laden dicht? ----------------------- */

test('Ebene 6 — validiereKarte lehnt ein gefaehrliches Klickziel ab', async () => {
  const io = await ladeTerra('editor/io.js');
  const validiere = io.TEST && io.TEST.validiereKarte ? io.TEST.validiereKarte : io.validiereKarte;
  assert.equal(typeof validiere, 'function',
    'io.js gibt validiereKarte nicht heraus — das Testfenster in hilfen/haken.mjs fehlt');

  const karte = (ziel) => JSON.stringify({
    format: 'terra', version: 4, seed: 1337, kartenGroesse: 256,
    hoehenDelta: [], elemente: [{ kind: "marker", variant: "beschriftung", points: [{ x: 0, z: 0 }],
      params: { text: 'Hafen', klasse: 'ort', groesse: 1, ziel: ziel }, seed: 1 }]
  });

  const boese = [
    'javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=', 'vbscript:msgbox', 'file:///C:/',
    '//example.com/x', 'http:/example.com'
  ];
  for (const ref of boese) {
    assert.throws(() => validiere(karte({ art: 'extern', ref: ref })),
      /ziel ungültig/, 'Durchgelassen: ' + JSON.stringify(ref));
  }

  // Und die Gegenprobe: gueltige Adressen muessen ankommen, sonst prueft der
  // Test nur, dass alles scheitert.
  const gut = validiere(karte({ art: 'extern', ref: 'https://uweanddragons.org/wiki/hafen' }));
  assert.equal(gut.elemente[0].params.ziel.art, 'extern');
  assert.equal(gut.elemente[0].params.ziel.ref, 'https://uweanddragons.org/wiki/hafen');
});

test('Ebene 6 — ein abgelehntes Ziel laesst die Karte ganz scheitern', async () => {
  /* Atomar heisst: kein halbes Ergebnis. Die Pruefung sitzt in derselben
     Schleife wie die Punkt- und Seedpruefung und muss sich genauso verhalten —
     ein gueltiges Element VOR dem kaputten darf nicht durchrutschen. */
  const io = await ladeTerra('editor/io.js');
  const validiere = io.TEST && io.TEST.validiereKarte ? io.TEST.validiereKarte : io.validiereKarte;
  const text = JSON.stringify({
    format: 'terra', version: 4, seed: 1337, kartenGroesse: 256, hoehenDelta: [],
    elemente: [
      { kind: 'objekt', variant: 'baeume', points: [{ x: 0, z: 0 }], params: {}, seed: 1 },
      { kind: 'marker', variant: 'beschriftung', points: [{ x: 4, z: 4 }],
        params: { text: 'X', ziel: { art: 'extern', ref: 'javascript:1' } }, seed: 2 }
    ]
  });
  assert.throws(() => validiere(text), /ziel ungültig/);
});

test('Ebene 6 — die Klimaachse ueberlebt einen Speicher-Ladezyklus', async () => {
  const io = await ladeTerra('editor/io.js');
  const validiere = io.TEST && io.TEST.validiereKarte ? io.TEST.validiereKarte : io.validiereKarte;
  const mit = validiere(JSON.stringify({
    format: 'terra', version: 4, seed: 1337, kartenGroesse: 256, hoehenDelta: [], elemente: [],
    klima: { richtung: 210, staerke: 0.8, grund: 0.3, hoeheKuehl: 0.02 }
  }));
  assert.equal(mit.klima.richtung, 210);
  assert.equal(mit.klima.staerke, 0.8);

  // Und tolerant: eine Datei ohne Klima laedt mit den Vorgabewerten, statt zu
  // scheitern — Beiwerk scheitert nicht atomar (siehe terra-runde-i-plan.md).
  const ohne = validiere(JSON.stringify({
    format: 'terra', version: 4, seed: 1337, kartenGroesse: 256, hoehenDelta: [], elemente: []
  }));
  assert.equal(ohne.klima.richtung, 0);
  assert.equal(ohne.klima.staerke, 0.5);

  const kaputt = validiere(JSON.stringify({
    format: 'terra', version: 4, seed: 1337, kartenGroesse: 256, hoehenDelta: [], elemente: [],
    klima: { richtung: NaN, staerke: 'viel' }
  }));
  assert.equal(kaputt.klima.richtung, 0, 'NaN muss auf die Vorgabe fallen');
  assert.equal(kaputt.klima.staerke, 0.5);
});
