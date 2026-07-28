/* ==========================================================================
   Ebene 1 — Determinismus

   Die zentrale Zusage des Projekts: gleiche Seed, gleiche Eingaben, gleiches
   Ergebnis. Geprueft wird sie ueber einen Hash, der ALLE emit()-Argumente
   (12 Zahlen je Instanz), die Kontaktschatten, die Rauchpunkte UND saemtliche
   Attribute der elementeigenen Meshes umfasst — siehe hilfen/karte.mjs.

   Vier Sorten Pruefung, die verschiedene Fehlerklassen fangen:
     a) Je Generator zweimal erzeugen (fangt Math.random, Datum, Zaehlerreste)
     b) Gesamtlauf ueber die Beispielkarte, zweimal (fangt Reste zwischen
        Elementen: gemeinsame Belegungsraster, Korridore, Flussstempel)
     c) Reihenfolgeunabhaengigkeit: A vor B und B vor A muessen fuer A dasselbe
        ergeben (fangt heimliche Kopplung zweier Elemente)
     d) Zwei getrennte PROZESSE (fangt Determinismusfehler in den 272
        Pool-Geometrien, die nur beim Modulstart entstehen)
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { testWelt, hashElement, hashInstanzen, beispielKarte, hashKarte, BEISPIEL_SEED,
  BEISPIEL_LINIE, BEISPIEL_POLY } from './hilfen/karte.mjs';
import { TEST } from './hilfen/laden.mjs';

/* Je Generator ein Fall. Die Punkte sind so gewaehlt, dass jeder Generator
   wirklich etwas erzeugt — ein leeres Ergebnis waere trivial deterministisch. */
const FAELLE = [
  ['pfad', 'strasse', BEISPIEL_LINIE, null],
  ['pfad', 'mauer', BEISPIEL_LINIE, null],
  ['pfad', 'fluss', BEISPIEL_LINIE, null],
  ['pfad', 'hecke', BEISPIEL_LINIE, null],
  ['pfad', 'bruch', BEISPIEL_LINIE, null],
  ['flaeche', 'wald', BEISPIEL_POLY, null],
  ['flaeche', 'feld', BEISPIEL_POLY, null],
  ['flaeche', 'wiese', BEISPIEL_POLY, null],
  ['flaeche', 'viertel', BEISPIEL_POLY, null],
  ['flaeche', 'burg', BEISPIEL_POLY, null],
  ['flaeche', 'werft', BEISPIEL_POLY, null],
  ['flaeche', 'kloster', BEISPIEL_POLY, null],
  ['objekt', 'baeume', [{ x: 12, z: 8 }], { anzahl: 12, streuung: 12 }],
  ['objekt', 'felsen', [{ x: -25, z: 35 }], { anzahl: 9, streuung: 14 }],
  ['ranke', 'ranke', [{ x: 5, z: 5 }], null]
];

test('Ebene 1 — je Generator: zweimal erzeugen ergibt denselben Hash', async (t) => {
  const welt = await testWelt({ seed: 4711 });
  for (const [kind, variant, punkte, extra] of FAELLE) {
    await t.test(kind + ':' + variant, () => {
      const el = welt.element(kind, variant, punkte, extra, 0x51ee7);
      welt.erzeuge(el);
      const ersteZahl = el.total;
      const erste = hashElement(el);
      welt.erzeuge(el);                       // genau derselbe Aufruf, zweites Mal
      assert.equal(hashElement(el), erste,
        kind + ':' + variant + ' ist beim zweiten Erzeugen anders');
      assert.equal(el.total, ersteZahl, 'Instanzzahl schwankt');
      assert.ok(ersteZahl > 0 || (el.group && el.group.children.length > 0),
        kind + ':' + variant + ' hat gar nichts erzeugt — der Fall waere wertlos');
    });
  }
});

test('Ebene 1 — zwei getrennt aufgebaute Welten mit gleicher Seed sind gleich', async () => {
  const a = await testWelt({ seed: 20260727 });
  const elA = a.element('flaeche', 'wald', BEISPIEL_POLY, null, 0x777);
  a.erzeuge(elA);
  const hashA = hashElement(elA);

  // Zweite Welt im selben Prozess: setzt Terrain und Zaehler neu auf.
  const b = await testWelt({ seed: 20260727 });
  const elB = b.element('flaeche', 'wald', BEISPIEL_POLY, null, 0x777);
  b.erzeuge(elB);
  assert.equal(hashElement(elB), hashA);
});

test('Ebene 1 — andere Seed ergibt ein anderes Ergebnis', async () => {
  const a = await testWelt({ seed: 1000 });
  const ea = a.element('flaeche', 'wald', BEISPIEL_POLY, null, 0x777);
  a.erzeuge(ea);
  const b = await testWelt({ seed: 1001 });
  const eb = b.element('flaeche', 'wald', BEISPIEL_POLY, null, 0x777);
  b.erzeuge(eb);
  assert.notEqual(hashElement(eb), hashElement(ea),
    'Zwei Seeds liefern dasselbe Bild — der Determinismustest waere blind');
});

test('Ebene 1 — Gesamtlauf: rebuildAll zweimal ergibt dieselbe Karte', async () => {
  const welt = await testWelt({ seed: BEISPIEL_SEED });
  beispielKarte(welt);
  welt.alleNeu();
  const erste = hashKarte(welt.m.store.S);
  welt.alleNeu();
  assert.equal(hashKarte(welt.m.store.S), erste);
});

/* ------------------------------------------------------------------------
   REGRESSION zu einem Fund aus Runde I5.

   `rebuildAll()` rief einmal in dieser Reihenfolge auf:
       rebuildRivers()  ->  rebuildCorridors()  ->  refreshTerrainFull()
   `rebuildCorridors()` stempelt fuer eine Werft den Korridor entlang der
   Kaiflucht, und die berechnet `werftAchse()` (generators/strukturen.js)
   aus `heightAt()` — also aus `hgt`, dem EINGESCHNITTENEN Hoehenfeld.
   Geschrieben wurde `hgt` aber erst danach, in `refreshTerrainFull()`.

   Folge war: der erste vollstaendige Neuaufbau nach dem Laden benutzte ein
   Hoehenfeld ohne Flusseinschnitt (bzw. das der ZUVOR geladenen Karte), jeder
   spaetere das eingeschnittene. Karte und Bild aenderten sich also beim
   zweiten Neuaufbau, ohne dass der Nutzer etwas getan hatte (gemessen: 32
   Instanzen nach dem ersten Lauf, 33 nach jedem weiteren).

   Behoben, indem rebuildAll die Hoehen VOR den Korridoren schreibt und AO und
   Gitter danach nachzieht. Diese Pruefung haelt die Reihenfolge fest.

   Reproduktion: Werft, durch deren Polygon ein Fluss laeuft.
   ------------------------------------------------------------------------ */
test('Ebene 1 — rebuildAll ist schon beim ERSTEN Lauf stabil (Werft ueber Fluss)', async () => {
  const welt = await testWelt({ seed: BEISPIEL_SEED });
  const werft = welt.element('flaeche', 'werft',
    [{ x: -40, z: -20 }, { x: 10, z: -24 }, { x: 14, z: 20 }, { x: -36, z: 24 }], null, 0x2006);
  welt.element('pfad', 'fluss',
    [{ x: -60, z: -40 }, { x: -10, z: 0 }, { x: 40, z: 40 }], { breite: 16, tiefe: 9 }, 0x1003);
  welt.alleNeu();
  const erste = hashElement(werft);
  welt.alleNeu();
  assert.equal(hashElement(werft), erste,
    'Die Werft sieht nach dem zweiten rebuildAll anders aus als nach dem ersten');
});

test('Ebene 1 — ab dem zweiten rebuildAll ist die Karte stabil', async () => {
  const welt = await testWelt({ seed: BEISPIEL_SEED });
  const werft = welt.element('flaeche', 'werft',
    [{ x: -40, z: -20 }, { x: 10, z: -24 }, { x: 14, z: 20 }, { x: -36, z: 24 }], null, 0x2006);
  welt.element('pfad', 'fluss',
    [{ x: -60, z: -40 }, { x: -10, z: 0 }, { x: 40, z: 40 }], { breite: 16, tiefe: 9 }, 0x1003);
  welt.alleNeu();
  welt.alleNeu();
  const zweite = hashElement(werft);
  welt.alleNeu();
  welt.alleNeu();
  assert.equal(hashElement(werft), zweite,
    'Der Zustand pendelt weiter — dann waere der Fehler schlimmer als beschrieben');
});

test('Ebene 1 — Reihenfolgeunabhaengigkeit: A vor B == B vor A', async (t) => {
  /* Zwei Elemente, die sich raeumlich ueberlappen — genau dort waere eine
     heimliche Kopplung (gemeinsames Belegungsraster, gemeinsamer Zaehler)
     ueberhaupt moeglich. Geprueft wird der Hash der INSTANZEN von A. */
  const paare = [
    ['flaeche:wald vor objekt:baeume',
      ['flaeche', 'wald', BEISPIEL_POLY, null],
      ['objekt', 'baeume', [{ x: 0, z: 0 }], { anzahl: 10, streuung: 20 }]],
    ['flaeche:wiese vor flaeche:feld',
      ['flaeche', 'wiese', BEISPIEL_POLY, null],
      ['flaeche', 'feld', BEISPIEL_POLY, null]],
    ['pfad:strasse vor flaeche:viertel',
      ['pfad', 'strasse', BEISPIEL_LINIE, null],
      ['flaeche', 'viertel', BEISPIEL_POLY, null]]
  ];
  for (const [name, A, B] of paare) {
    await t.test(name, async () => {
      const w1 = await testWelt({ seed: 909 });
      const a1 = w1.element(A[0], A[1], A[2], A[3], 0xa1);
      const b1 = w1.element(B[0], B[1], B[2], B[3], 0xb1);
      w1.erzeuge(a1); w1.erzeuge(b1);
      const hashAzuerst = hashInstanzen(a1);

      const w2 = await testWelt({ seed: 909 });
      const b2 = w2.element(B[0], B[1], B[2], B[3], 0xb1);
      const a2 = w2.element(A[0], A[1], A[2], A[3], 0xa1);
      w2.erzeuge(b2); w2.erzeuge(a2);
      assert.equal(hashInstanzen(a2), hashAzuerst,
        'Element A haengt an der Erzeugungsreihenfolge');
    });
  }
});

test('Ebene 1 — zwei Prozesse liefern dieselben Karten- und Pool-Hashes', () => {
  const skript = path.join(TEST, 'hilfen', 'gesamthash.mjs');
  const lauf = () => {
    let text;
    try {
      text = execFileSync(process.execPath, [skript, String(BEISPIEL_SEED), 'wiese'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      throw new Error('gesamthash.mjs brach ab (Status ' + e.status + '):\n' + e.stderr);
    }
    return JSON.parse(text);
  };
  const a = lauf();
  const b = lauf();
  assert.equal(b.pools, a.pools, 'Die Pool-Geometrien unterscheiden sich zwischen zwei Laeufen');
  assert.equal(b.karte, a.karte, 'Die Beispielkarte unterscheidet sich zwischen zwei Laeufen');
  assert.ok(a.instanzen > 500, 'Die Beispielkarte ist unerwartet leer: ' + a.instanzen);
  assert.equal(a.elemente, 17, 'Die Beispielkarte hat nicht mehr 17 Elemente');
});
