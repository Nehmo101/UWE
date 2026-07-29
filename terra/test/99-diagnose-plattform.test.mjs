/* TEMPORÄR — Diagnose der Plattform-Divergenz im Terrainfarb-Hash.
   Wird nach der Auswertung wieder entfernt. */
import test from 'node:test';
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
  console.log('DIAG hgt          =', hh.hex());

  // 2) terrainColor bei KONSTANTEN Eingaben — Höhenfeld spielt keine Rolle.
  S.einheitMeter = 1;
  const c = new THREE.Color(), ch = new Hasher();
  for (let k = 0; k < 200; k++) {
    w.m.terrain.terrainColor(k * 0.37, 0.5 + (k % 7) * 0.05, k - 100, 100 - k, c, 1);
    ch.zahl(c.r).zahl(c.g).zahl(c.b);
  }
  console.log('DIAG farbe-konst  =', ch.hex());

  // 3) Roh-Werte einzelner Math-Funktionen, die in der Kette vorkommen.
  const probe = [Math.sin(0.7), Math.cos(1.3), Math.pow(0.7, 2.3),
                 Math.exp(1.7), Math.log(3.1), Math.atan2(0.3, 0.7),
                 Math.cbrt(7.3), Math.hypot(0.3, 0.7), Math.tanh(0.9)];
  console.log('DIAG math         =', probe.map((x) => x.toExponential(17)).join('|'));

  // 4) Version von three.
  console.log('DIAG three        =', THREE.REVISION);
});
