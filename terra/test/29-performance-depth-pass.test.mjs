/* ==========================================================================
   Performance-P0 ? Mikrodetails nur einmal statt zweimal zeichnen

   Der halbaufgeloeste Tiefenpass liefert Kanten, Tiefenbaender und die
   Himmelsmaske. Pool-Instanzen unter einer Welteinheit sind darin nur
   flimmernde Einzelpixel; im Farbbild bleiben sie unveraendert erhalten.
   Wichtig: Entscheidend ist Poolradius MAL groesster Instanzskala ? ein stark
   vergroessertes Kleinteil muss weiterhin Tiefe schreiben.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { testWelt } from './hilfen/karte.mjs';
import { SRC } from './hilfen/laden.mjs';

function instanz(skala) {
  return [0, 4, 0, 0, 0, 0, skala, skala, skala, 1, 1, 1];
}

test('Performance-P0 ? Tiefendetail folgt dem skalierten Welt-Radius', async () => {
  const welt = await testWelt({ seed: 4711 });
  const { POOLS, repack } = welt.m.pools;
  const { S } = welt.m.store;
  const name = Object.keys(POOLS).find((n) => {
    const p = POOLS[n];
    return !p.karte && p.radius > 0.1 && p.radius < 0.9;
  });
  assert.ok(name, 'Test braucht einen vorhandenen Mikrodetail-Pool');

  const pool = POOLS[name];
  const el = welt.element('objekt', 'natur', [{ x: 0, z: 0 }], null, 0x2901);

  el.inst[name] = instanz(0.5 / pool.radius);
  repack([name]);
  assert.equal(pool.mesh.userData.terraDepthDetail, false,
    'Welt-Radius 0.5 soll den zweiten Draw im halbaufgeloesten Prepass sparen');

  el.inst[name] = instanz(2 / pool.radius);
  repack([name]);
  assert.equal(pool.mesh.userData.terraDepthDetail, true,
    'hochskaliertes Kleinteil muss trotz kleinem Poolradius Tiefe schreiben');

  el.inst[name] = [];
  repack([name]);
  S.elements.pop();
});

test('Performance-P0 ? der Filter greift nur im Tiefen-Vorpass', () => {
  const pipeline = fs.readFileSync(path.join(SRC, 'render', 'pipeline.js'), 'utf8');
  const start = pipeline.indexOf('function prepassAn()');
  const ende = pipeline.indexOf('function prepassAus()', start);
  assert.ok(start >= 0 && ende > start);
  const prepass = pipeline.slice(start, ende);
  assert.match(prepass, /terraDepthDetail\s*===\s*false/,
    'Mikrodetail-Markierung wird nicht im Tiefenpass ausgewertet');
  assert.doesNotMatch(pipeline.slice(0, start), /terraDepthDetail\s*===\s*false/,
    'der Farbrender darf Mikrodetails nicht filtern');
});
