/* ==========================================================================
   Ebene 21 — Bedienung, letzte Luecken: Ringanfang, Kartenzeichen-Marker,
   Zusammenfluesse

   Drei Stuecke dieser Runde, geprueft dort, wo sie OHNE Bild pruefbar sind
   (dieselbe Arbeitsteilung wie Ebene 18: tools.js, selection.js und panels.js
   sind hier durch Ersatzmodule getauscht, was dort gebaut wird, prueft der
   Browsertest test/browser/runde-h-voll.mjs):

     1  `ringFenster` (ui/beschriftung.js) — der Anfang einer Beschriftung am
        geschlossenen Ring: das Fenster liegt mittig auf der dem Anker
        naechstgelegenen Ringstelle, und die Leserichtung loest die
        Sehnen-Mechanik von glyphenAufKurve fuer JEDE Ankerseite.
     2  Der Ladeweg (editor/io.js): ein `anPfad`-Verweis auf eine FLAECHE ist
        so legitim wie einer auf einen Pfad, und ein marker:zeichen-Element
        uebersteht die Pruefung mit seinen Parametern.
     3  Die Flussauswahl (generators/welt.js): `bericht.zusammenfluesse`
        existiert, ist deterministisch und traegt auf der Messkarte den
        gemessenen Wert.

   TESTISOLATION: jede Welt entsteht IM Test, nie beim Import (Begruendung in
   Ebene 18: der Sammeleinstieg laesst alle Importe vor allen Tests laufen).
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ladeTerra } from './hilfen/laden.mjs';
import { testWelt } from './hilfen/karte.mjs';

const B = await ladeTerra('ui/beschriftung.js');

/** Kreisring mit n Stuetzen, Radius r, Mitte (mx, mz). */
function kreisRing(n, r, mx, mz) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push({ x: mx + Math.cos(a) * r, z: mz + Math.sin(a) * r });
  }
  return out;
}

function bogenLaenge(pfad) {
  let l = 0;
  for (let i = 1; i < pfad.length; i++) {
    l += Math.hypot(pfad[i].x - pfad[i - 1].x, pfad[i].z - pfad[i - 1].z);
  }
  return l;
}

/* ==========================================================================
   1 — Der Ringanfang
   ========================================================================== */

test('Ebene 21/1 — das Ringfenster liegt mittig auf der ankernaechsten Stelle', () => {
  const ring = kreisRing(48, 40, 0, 0);
  const U = 2 * Math.PI * 40;

  // Anker oestlich des Rings: die Fenstermitte gehoert nach (40, 0).
  const f = B.ringFenster(ring, { x: 70, z: 0 });
  assert.ok(f, 'Fenster entsteht');
  assert.equal(f.lage, 0.5, 'die Zeile sitzt mittig im Fenster');
  const mitte = f.pfad[Math.floor(f.pfad.length / 2)];
  assert.ok(Math.hypot(mitte.x - 40, mitte.z - 0) < 6,
    'Fenstermitte nahe der ankernaechsten Ringstelle: ' + JSON.stringify(mitte));
  // Fensterlaenge: der halbe Umfang, stuetzengenau (± zwei Segmente).
  const L = bogenLaenge(f.pfad);
  assert.ok(Math.abs(L - U / 2) < (U / 48) * 2.5,
    'Fensterlaenge ~ halber Umfang: ' + L.toFixed(1) + ' vs ' + (U / 2).toFixed(1));
  // Alle Fensterpunkte liegen auf dem Ring.
  for (const p of f.pfad) {
    assert.ok(Math.abs(Math.hypot(p.x, p.z) - 40) < 1e-6, 'Fensterpunkt liegt auf dem Ring');
  }

  // Anker im Norden (−z): die Mitte wandert mit.
  const fn = B.ringFenster(ring, { x: 0, z: -90 });
  const mn = fn.pfad[Math.floor(fn.pfad.length / 2)];
  assert.ok(Math.hypot(mn.x - 0, mn.z + 40) < 6, 'Nordanker -> Fenstermitte bei (0, −40)');
});

test('Ebene 21/1 — doppelter Schlusspunkt und Unrat aendern das Fenster nicht', () => {
  const ring = kreisRing(36, 25, 10, -5);
  const zu = ring.concat([{ x: ring[0].x, z: ring[0].z }]);          // geschlossen angeliefert
  const dreck = ring.concat([{ x: NaN, z: 3 }, null]);               // kaputte Punkte
  const a = B.ringFenster(ring, { x: 60, z: -5 });
  const b = B.ringFenster(zu, { x: 60, z: -5 });
  const c = B.ringFenster(dreck, { x: 60, z: -5 });
  assert.deepEqual(b.pfad, a.pfad, 'Schlusspunkt = Anfangspunkt wird erkannt');
  assert.deepEqual(c.pfad, a.pfad, 'nicht-endliche Punkte fallen heraus');
  assert.equal(B.ringFenster([{ x: 0, z: 0 }, { x: 1, z: 1 }], { x: 0, z: 0 }), null,
    'zwei Punkte sind kein Ring');
  assert.equal(B.ringFenster(null, { x: 0, z: 0 }), null, 'kein Ring, kein Fenster');
});

test('Ebene 21/1 — das Fenster traegt den Text auf JEDER Ankerseite ohne Kopfstand', () => {
  /* Genau der Punkt des alten Berichts: ein geschlossener Ring hat keine
     brauchbare Sehne, das FENSTER hat eine — glyphenAufKurve entscheidet
     daran die Leserichtung. Nord- und Suedufer muessen beide tauglich sein. */
  const ring = kreisRing(64, 60, 0, 0);
  for (const anker of [{ x: 0, z: -80 }, { x: 0, z: 80 }, { x: 80, z: 0 }, { x: -80, z: 0 }]) {
    const f = B.ringFenster(ring, anker);
    const k = B.kurvenBeschriftung('Silbersee', 'gewaesser', { pfad: f.pfad, lage: f.lage });
    assert.equal(k.tauglich, true,
      'Anker ' + JSON.stringify(anker) + ' -> tauglich (Grund: ' + k.grund + ')');
    // Die Weltmitte des Quads liegt auf der Ankerseite des Rings.
    const richtung = k.mitte.x * anker.x + k.mitte.z * anker.z;
    assert.ok(richtung > 0, 'die Zeile sitzt auf der Ankerseite: ' + JSON.stringify(k.mitte));
  }
});

/* ==========================================================================
   2 — Der Ladeweg: anPfad an der Flaeche, marker:zeichen
   ========================================================================== */

test('Ebene 21/2 — anPfad darf auf eine Flaeche zeigen, marker:zeichen uebersteht das Laden', async () => {
  const io = await ladeTerra('editor/io.js');

  const elemente = [
    { kind: 'flaeche', variant: 'see', points: [{ x: 0, z: 0 }, { x: 30, z: 0 }, { x: 30, z: 30 }, { x: 0, z: 30 }],
      params: { stau: 0, saum: 5, ufer: true, dichte: 1 }, seed: 7, id: 4 },
    { kind: 'marker', variant: 'beschriftung', points: [{ x: 15, z: -2 }],
      params: { text: 'Silbersee', klasse: 'gewaesser', groesse: 1, anPfad: 4 }, seed: 8, id: 5 },
    { kind: 'marker', variant: 'zeichen', points: [{ x: 40, z: 40 }],
      params: { art: 'sig_hauptstadt', groesse: 1.2, dreh: 15, laenge: 60 }, seed: 9, id: 6 }
  ];
  const geprueft = io.pruefeElemente(elemente, 'Element');
  assert.equal(geprueft.length, 3, 'alle drei Elemente kommen durch');
  assert.equal(geprueft[1].params.anPfad, 4,
    'der Verweis auf die Flaeche bleibt stehen — er ist so legitim wie einer auf einen Pfad');
  assert.equal(geprueft[2].params.art, 'sig_hauptstadt', 'die Zeichenart bleibt erhalten');
  assert.equal(geprueft[2].params.groesse, 1.2, 'die Groesse bleibt erhalten');

  // Die Erlaubnisliste bleibt scharf: eine krumme Zahl ist kein Verweis.
  assert.throws(() => io.pruefeElemente(
    [{ kind: 'marker', variant: 'beschriftung', points: [{ x: 0, z: 0 }],
       params: { text: 'x', anPfad: 1.5 }, seed: 1 }], 'Element'),
    /anPfad/, 'anPfad 1.5 wird abgelehnt');
});

test('Ebene 21/2 — marker:zeichen faellt in genElement (noch) folgenlos durch', async () => {
  /* Dokumentiert die bekannte Luecke: core/dirty.js kennt den Zweig fuer
     marker-Elemente nicht (die noetige Zeile steht im Rundenbericht und in
     editor/tools.js beim Erzeuger). Bis dahin gilt: ein geladenes
     marker:zeichen-Element darf beim Aufbau NICHT werfen — seine Instanz
     entsteht im Browser ueber zeichenMarkerNachziehen. Faellt dieser Test um,
     weil genElement das Element ploetzlich BAUT, ist das der Tag, an dem die
     Selbstheilung in tools.js ueberfluessig wird. */
  const welt = await testWelt({ seed: 4711, groesse: 256 });
  const el = welt.element('marker', 'zeichen', [{ x: 10, z: 10 }],
    { art: 'sig_hauptstadt', groesse: 1, dreh: 0, laenge: 60 });
  assert.doesNotThrow(() => welt.erzeuge(el), 'genElement wirft nicht');
  const pools = Object.keys(el.inst).filter((p) => el.inst[p].length > 0);
  assert.ok(pools.length === 0 || (pools.length === 1 && pools[0] === 'sig_hauptstadt'),
    'entweder Durchfall (heute) oder genau das eine Zeichen (nach der dirty.js-Zeile): '
    + JSON.stringify(pools));
});

/* ==========================================================================
   3 — Zusammenfluesse
   ========================================================================== */

test('Ebene 21/3 — bericht.zusammenfluesse: vorhanden, deterministisch, gemessener Wert', async () => {
  /* 256/Seed 99 ist eine der zehn Messkarten der Stellschraube (Messtabelle
     im Kommentar an minZufluss, generators/welt.js): 4 Laeufe, 2 davon
     muendend. Der Wert ist exakt reproduzierbar — der Generator wuerfelt
     nicht, er hasht. */
  const welt = await testWelt({ seed: 99, groesse: 256 });
  const w = await ladeTerra('generators/welt.js');
  welt.m.terrain.terrainGeometrienNeu();
  welt.m.terrain.genBase(99);
  const vw = welt.m.store.KARTE.vw;
  welt.m.terrain.recomputeHeights(0, vw - 1, 0, vw - 1);
  welt.m.terrain.computeAO(0, vw - 1, 0, vw - 1);

  const a = w.erzeugeWelt(99, { abfluss: null });
  assert.ok(Number.isInteger(a.bericht.zusammenfluesse), 'die Kennzahl steht im Bericht');
  assert.equal(a.bericht.zusammenfluesse, 2, 'Messwert der Stellschraube auf 256/99');
  assert.ok(a.bericht.zusammenfluesse <= a.bericht.fluesse,
    'nicht mehr Muendungen als Laeufe');

  const b = w.erzeugeWelt(99, { abfluss: null });
  assert.equal(b.bericht.zusammenfluesse, a.bericht.zusammenfluesse, 'derselbe Seed, derselbe Wert');
  assert.equal(b.length, a.length, 'dieselbe Elementzahl');
});
