/* ==========================================================================
   Architektur-Kollisionsradien

   Der Poolradius muss alle horizontalen Ausleger abdecken, unabhaengig von
   der spaeteren Instanzdrehung. Vermessen wird hier der gebaute Pool; die App
   tut dieselbe Arbeit einmal bei der Registry-Erzeugung, nie je Platzierung.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ladeTerra } from './hilfen/laden.mjs';
import { testWelt } from './hilfen/karte.mjs';

const RESERVE = 1.05;
const KATALOG = await ladeTerra('assets/architektur-katalog.js');
const ARCHITEKTUR = await ladeTerra('assets/architektur-geometrie.js');
const welt = await testWelt({ seed: 4711 });
const POOLS = welt.m.pools.POOLS;

function horizontalerRadius(geo, name) {
  const position = geo && geo.attributes && geo.attributes.position;
  assert.ok(position && position.itemSize >= 3 && position.count > 0,
    name + ': keine messbare Geometrie');
  let maxQuadrat = 0;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    assert.ok(Number.isFinite(x) && Number.isFinite(z),
      name + ': nicht-endliche x/z-Position');
    maxQuadrat = Math.max(maxQuadrat, x * x + z * z);
  }
  return Math.sqrt(maxQuadrat);
}

test('Architektur-Radius - alle 216 Pools decken Geometrie samt Reserve ab', () => {
  assert.equal(KATALOG.ARCHITEKTUR_ASSETS.length, 216);
  const korrigiert = [];

  for (const asset of KATALOG.ARCHITEKTUR_ASSETS) {
    const stil = KATALOG.ARCHITEKTUR_STILE[asset.stilIndex];
    const variante = KATALOG.ARCHITEKTUR_VARIANTEN[asset.variantenIndex];
    const pool = POOLS[asset.id];
    assert.ok(pool, asset.id + ': Pool fehlt');

    const ausleger = horizontalerRadius(pool.geo, asset.id);
    const katalogRadius = ARCHITEKTUR.architekturPoolOptionen(
      stil, variante, asset.variantenIndex).radius;
    const erwartet = Math.ceil(Math.max(katalogRadius, ausleger * RESERVE) * 100) / 100;

    assert.ok(Number.isFinite(pool.radius) && pool.radius > 0,
      asset.id + ': ungueltiger Poolradius');
    assert.ok(pool.radius + 1e-9 >= ausleger * RESERVE,
      asset.id + ': Radius ' + pool.radius + ' deckt Ausleger ' + ausleger + ' nicht ab');
    assert.equal(pool.radius, erwartet,
      asset.id + ': Radius folgt nicht der deterministischen Poolformel');
    if (pool.radius > katalogRadius) korrigiert.push(asset.id);
  }

  assert.ok(korrigiert.length > 0,
    'Der Test braucht mindestens einen echten Ausleger ueber dem Katalogradius');
});
