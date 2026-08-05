import test from 'node:test';
import assert from 'node:assert/strict';
import { ladeTerra } from './hilfen/laden.mjs';
import { testWelt } from './hilfen/karte.mjs';

const welt = await testWelt({ seed: 4711, groesse: 256 });
const TIER = await ladeTerra('assets/tierwesen-formensprache.js');
const POOLS = welt.m.pools.POOLS;

test('Waldsaeule A modernisiert alle sieben Tierwesen ohne Auslassung', () => {
  assert.deepEqual(TIER.TIERWESEN_FORMSPRACHE_POOLS, [
    'pferd', 'rind', 'schaf', 'ziege', 'moewe',
    'ochsengespann', 'rankengleiter'
  ]);
  for (const id of TIER.TIERWESEN_FORMSPRACHE_POOLS) {
    const geo = POOLS[id].geo;
    assert.equal(geo.userData.tierwesenFormensprache, 'waldsaeule-a', id);
    assert.ok(geo.userData.tierwesenFormDetails >= 10, id + ': zu wenige Formdetails');
    assert.ok(geo.attributes.position.count >= 500, id + ': zu einfache Geometrie');
    assert.ok(Array.from(geo.attributes.position.array).every(Number.isFinite), id);
    assert.ok(Array.from(geo.attributes.normal.array).every(Number.isFinite), id);
  }
});

test('Tierwesen bleiben in ihren bestehenden Pool- und Materialvertraegen', () => {
  assert.equal(POOLS.pferd.radius, 1.0);
  assert.equal(POOLS.rind.radius, 0.8);
  assert.equal(POOLS.schaf.radius, 0.5);
  assert.equal(POOLS.ziege.radius, 0.4);
  assert.equal(POOLS.moewe.radius, 0.2);
  assert.equal(POOLS.ochsengespann.radius, 2.2);
  assert.equal(POOLS.rankengleiter.radius, 3.0);
  assert.equal(POOLS.ziege.mat.side, POOLS.moewe.mat.side);
  assert.equal(POOLS.moewe.mat.side, POOLS.rankengleiter.mat.side);
});
