import test from 'node:test';
import assert from 'node:assert/strict';
import { ladeTerra } from './hilfen/laden.mjs';

const BEREICH = await ladeTerra('generators/landmarken-bereich.js');
const SCHLOSS = await ladeTerra('generators/weltschloss.js');
const SCHILDKROETE = await ladeTerra('generators/weltschildkroete.js');

test('Landmarken-Bereich skaliert Ort, Region und Nation monoton', () => {
  const ort = BEREICH.landmarkenSkala({ groesse: 1, bereich: 'ort' }, 0.55, 2.2);
  const region = BEREICH.landmarkenSkala({ groesse: 1, bereich: 'region' }, 0.55, 2.2);
  const nation = BEREICH.landmarkenSkala({ groesse: 1, bereich: 'nation' }, 0.55, 2.2);
  assert.ok(ort < region && region < nation);
  assert.equal(BEREICH.landmarkenBereich({ bereich: 'unbekannt' }).id, 'region');
});

test('Weltschloss veraendert je Bereich Ausbau und Silhouette', () => {
  assert.equal(SCHLOSS.WELTSCHLOSS_GEOMETRIEN.length, 4);
  const counts = SCHLOSS.WELTSCHLOSS_GEOMETRIEN.slice(1)
    .map((geo) => geo.attributes.position.count);
  assert.ok(counts[0] < counts[1] && counts[1] < counts[2]);
  assert.deepEqual(SCHLOSS.WELTSCHLOSS_GEOMETRIEN.slice(1)
    .map((geo) => geo.userData.terraBereichAusbau), [1, 2, 3]);
  assert.match(SCHLOSS.WELTSCHLOSS_GEOMETRIEN[3].userData.terraSilhouette,
    /nationalburg/);
});

test('Schildkroeten-Hals und Gesicht tragen den modernen Geometrievertrag', () => {
  const kopf = SCHILDKROETE.BASIS_KOPF.userData;
  assert.equal(kopf.terraHalsSegmente, 32);
  assert.equal(kopf.terraHalsRinge, 33);
  assert.equal(kopf.terraHalsRadialSegmente, 16);
  assert.equal(kopf.terraGesichtsStandard, '2026-organisch-weich');
});
