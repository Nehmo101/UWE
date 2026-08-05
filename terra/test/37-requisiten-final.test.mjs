import test from 'node:test';
import assert from 'node:assert/strict';
import { ladeTerra } from './hilfen/laden.mjs';
import { testWelt } from './hilfen/karte.mjs';

const welt = await testWelt({ seed: 4711, groesse: 512 });
const FINAL = await ladeTerra('assets/requisiten-final-formensprache.js');
const POOLS = welt.m.pools.POOLS;
const NEU = Object.freeze([
  'laterne', 'dreimaster', 'marktstand',
  'schubkarre', 'marktkorb', 'zwergentor'
]);

test('Requisiten-Finalrunde auditiert exakt alle 51 Galerie-Pools', () => {
  assert.equal(FINAL.REQUISITEN_FINAL_POOLS.length, 51);
  assert.equal(new Set(FINAL.REQUISITEN_FINAL_POOLS).size, 51);
  for (const id of FINAL.REQUISITEN_FINAL_POOLS) {
    const pool = POOLS[id];
    assert.ok(pool, id + ': Pool fehlt');
    assert.equal(pool.geo.userData.requisitenFinalFormensprache, 'waldsaeule-a');
    assert.equal(pool.geo.userData.requisitenFinalAudit, true);
    assert.ok(pool.geo.attributes.position.count > 0, id + ': Geometrie ist leer');
  }
});

test('Sechs visuell schwache Requisiten sind vollstaendig neu aufgebaut', () => {
  const neu = FINAL.REQUISITEN_FINAL_POOLS.filter((id) =>
    POOLS[id].geo.userData.requisitenFinalNeuaufbau);
  assert.deepEqual(neu.sort(), [...NEU].sort());
  for (const id of NEU) {
    const geo = POOLS[id].geo;
    assert.ok(geo.userData.requisitenFinalDetails >= 10,
      id + ': zu wenige semantische Bauteile');
    const positions = geo.attributes.position.array;
    for (let i = 0; i < positions.length; i++) {
      assert.ok(Number.isFinite(positions[i]), id + ': ungueltige Position');
    }
    geo.computeBoundingBox();
    assert.ok(geo.boundingBox.min.y > -0.1, id + ': verliert Bodenkontakt');
  }
});
