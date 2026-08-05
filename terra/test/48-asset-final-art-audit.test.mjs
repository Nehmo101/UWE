import test from 'node:test';
import assert from 'node:assert/strict';
import { testWelt } from './hilfen/karte.mjs';

const welt = await testWelt({ seed: 4711, biom: 'wiese' });
const POOLS = welt.m.pools.POOLS;

function luminanzSpanne(attribute) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < attribute.count; i++) {
    const offset = i * attribute.itemSize;
    const wert = attribute.array[offset] * 0.2126
      + attribute.array[offset + 1] * 0.7152
      + attribute.array[offset + 2] * 0.0722;
    min = Math.min(min, wert);
    max = Math.max(max, wert);
  }
  return max - min;
}

test('Finaler Art-Audit deckt alle 505 normalen Terra-Asset-Pools ab', () => {
  const namen = Object.keys(POOLS).filter((name) => !POOLS[name].karte);
  let vertices = 0;
  let dreiecke = 0;

  assert.equal(Object.keys(POOLS).length - namen.length, 50,
    'Anzahl der bewusst separat behandelten Kartenzeichen');
  assert.equal(namen.length, 505);
  for (const name of namen) {
    const pool = POOLS[name];
    const geo = pool.geo;
    const position = geo.attributes.position;
    const normal = geo.attributes.normal;
    const color = geo.attributes.color;

    assert.ok(position && normal && color, name + ': Positions-, Normal- oder Farbattribut fehlt');
    assert.equal(normal.count, position.count, name + ': abweichende Normalanzahl');
    assert.equal(color.count, position.count, name + ': abweichende Farbanzahl');
    assert.ok(Array.from(position.array).every(Number.isFinite), name + ': ungueltige Position');
    assert.ok(Array.from(normal.array).every(Number.isFinite), name + ': ungueltige Normale');
    assert.ok(Array.from(color.array).every(Number.isFinite), name + ': ungueltige Farbe');

    geo.computeBoundingBox();
    const box = geo.boundingBox;
    assert.ok(box.max.x - box.min.x > 0, name + ': Breite ist null');
    assert.ok(box.max.y - box.min.y > 0, name + ': Hoehe ist null');
    assert.ok(box.max.z - box.min.z > 0, name + ': Tiefe ist null');

    const poolDreiecke = (geo.index ? geo.index.count : position.count) / 3;
    assert.ok(poolDreiecke <= 6500, name + ': Detailbudget ueberschritten: ' + poolDreiecke);
    assert.ok(luminanzSpanne(color) >= 0.025 || pool.mat.map,
      name + ': flache Vertexfarbe ohne Texturkontrast');

    vertices += position.count;
    dreiecke += poolDreiecke;
  }

  assert.equal(vertices, 542981);
  assert.equal(dreiecke, 418656);
});
