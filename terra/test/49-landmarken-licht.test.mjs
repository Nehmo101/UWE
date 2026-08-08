/* ==========================================================================
   Landmarken-Lichtpool

   Sichert den Vertrag von generators/landmarken-licht.js: eine feste Zahl
   vorab erzeugter PointLights, die zur Laufzeit nur umpositioniert und
   gedimmt werden. So bleibt die Lichtzahl der Szene konstant und three.js
   kompiliert beim Setzen oder Loeschen einer Landmarke keine Programme neu
   (gemessen: rund acht Sekunden Stillstand pro Lichtzahl-Aenderung).
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ladeTerra } from './hilfen/laden.mjs';

const LICHT = await ladeTerra('generators/landmarken-licht.js');
const store = await ladeTerra('core/store.js');

test('Landmarken-Lichtpool: feste Zahl, Zuteilung, Erschoepfung, Sweep', () => {
  const szene = { children: [], add(o) { this.children.push(o); } };
  LICHT.initLandmarkenLichter(szene);
  assert.equal(szene.children.length, 4,
    'Der Pool haengt genau vier Lichter in die Szene');
  LICHT.initLandmarkenLichter(szene);
  assert.equal(szene.children.length, 4,
    'Doppelte Initialisierung darf die Lichtzahl nicht erhoehen');
  assert.ok(szene.children.every((l) => l.type === 'PointLight'));
  assert.ok(szene.children.every((l) => l.intensity === 0),
    'Unbelegte Pool-Lichter sind dunkel');

  const a = {}, b = {}, c = {}, d = {}, e = {};
  store.S.elements.push(a, b, c, d, e);
  try {
    const la = LICHT.landmarkenLicht(a);
    assert.ok(la, 'Das erste Licht wird zugeteilt');
    assert.equal(LICHT.landmarkenLicht(a), la,
      'Eine erneute Anforderung gibt das bereits zugeteilte Licht wieder');
    LICHT.landmarkenLicht(b);
    LICHT.landmarkenLicht(c);
    LICHT.landmarkenLicht(d);
    assert.equal(LICHT.landmarkenLicht(e), null,
      'Ein erschoepfter Pool liefert null statt die Lichtzahl umzuwerfen');

    // Ein geloeschtes Element gibt sein Licht beim Sweep frei.
    store.S.elements.splice(store.S.elements.indexOf(a), 1);
    LICHT.landmarkenLichtSweep();
    assert.equal(la.userData.belegt, null, 'Der Sweep loest die Zuteilung');
    assert.equal(la.intensity, 0, 'Freie Lichter sind dunkel');
    assert.equal(LICHT.landmarkenLicht(e), la,
      'Das freigewordene Licht wird erneut zugeteilt');

    LICHT.landmarkenLichtFrei(e);
    assert.equal(la.userData.belegt, null,
      'Der Neuaufbau eines Elements loest seine Zuteilung');
  } finally {
    store.S.elements.length = 0;
    for (const el of [b, c, d, e]) LICHT.landmarkenLichtFrei(el);
  }
});
