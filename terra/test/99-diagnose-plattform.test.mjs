/* TEMPORÄR — Diagnose der Plattform-Divergenz im Terrainfarb-Hash.
   Wird nach der Auswertung wieder entfernt. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { testWelt } from './hilfen/karte.mjs';
import { Hasher } from './hilfen/hash.mjs';

test('DIAGNOSE — wo laufen die Plattformen auseinander', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const THREE = await import('three');
  const { VW, S } = w.m.store;

  // 1) Das Höhenfeld allein — ohne jede Farbrechnung.
  const hh = new Hasher();
  for (let j = 2; j < VW - 2; j += 5) {
    for (let i = 2; i < VW - 2; i += 5) hh.zahl(w.m.terrain.hgt[j * VW + i]);
  }
  const H_HGT = hh.hex();

  // 2) terrainColor bei KONSTANTEN Eingaben — Höhenfeld spielt keine Rolle.
  S.einheitMeter = 1;
  const c = new THREE.Color(), ch = new Hasher();
  for (let k = 0; k < 200; k++) {
    w.m.terrain.terrainColor(k * 0.37, 0.5 + (k % 7) * 0.05, k - 100, 100 - k, c, 1);
    ch.zahl(c.r).zahl(c.g).zahl(c.b);
  }
  const H_FARBE = ch.hex();

  // Erzwungener Fehlschlag: nur so landen die Werte sicher im CI-Log.
  // Rohwerte der ersten Farben — zeigt die Groessenordnung der Abweichung.
  const roh = [];
  for (let k = 0; k < 4; k++) {
    w.m.terrain.terrainColor(k * 0.37, 0.5 + (k % 7) * 0.05, k - 100, 100 - k, c, 1);
    roh.push(c.r.toExponential(17), c.g.toExponential(17), c.b.toExponential(17));
  }

  const bericht = [
    'hgt=' + H_HGT,
    'farbe-konst=' + H_FARBE,
    'three=' + THREE.REVISION,
    'roh=' + roh.join(','),
  ].join(' || ');
  assert.equal(bericht, 'ABSICHTLICH-ROT', 'DIAGNOSEWERTE');
});
