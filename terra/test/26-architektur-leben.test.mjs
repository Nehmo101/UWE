/* ==========================================================================
   Architektur-Leben: deterministische Rauchquellen

   Die Architektur wird in Vierteln und an Strassen als Poolinstanz gesetzt.
   Der Rauchanker muss deshalb Kulturmass, Schlottyp, Instanzskalierung und
   Drehung nachvollziehen, ohne einen eigenen Zufallsstrom zu verbrauchen.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ladeTerra } from './hilfen/laden.mjs';

const KATALOG = await ladeTerra('assets/architektur-katalog.js');
const ARCHITEKTUR = await ladeTerra('assets/architektur-geometrie.js');
const POOLMODUL = await ladeTerra('core/pools.js');
ARCHITEKTUR.registriereArchitekturPools();
const HANDWERK = Object.freeze(['werkstatt', 'schmiede']);
const BASIS = Object.freeze({ x: 12, y: 3, z: -9 });

function elementMitInstanz(kind, yaw, sx = 1.25, sy = 1.1, sz = 1.25) {
  return {
    rauch: [],
    inst: {
      [kind]: [BASIS.x, BASIS.y, BASIS.z, 0, yaw, 0, sx, sy, sz, 1, 1, 1]
    }
  };
}

function quelle(kind, yaw = 0, sx = 1.25, sy = 1.1, sz = 1.25) {
  const el = elementMitInstanz(kind, yaw, sx, sy, sz);
  // Absichtlich andere Fallbackwerte: bei vorhandener Instanz muss deren
  // tatsaechlicher Transform die Quelle bestimmen.
  POOLMODUL.rauchAus(el, kind, 999, 777, 555, 0.25);
  assert.equal(el.rauch.length, 3, kind + ': genau eine Rauchquelle erwartet');
  assert.ok(el.rauch.every(Number.isFinite), kind + ': Rauchquelle ist nicht endlich');
  return el.rauch;
}

function fastGleich(a, b, meldung) {
  assert.ok(Math.abs(a - b) < 1e-9, meldung + ': ' + a + ' != ' + b);
}

test('Architektur-Leben - alle 12 mal 2 Handwerksassets rauchen deterministisch', () => {
  assert.equal(KATALOG.ARCHITEKTUR_STILE.length, 12);
  const signaturen = new Set();

  for (const stil of KATALOG.ARCHITEKTUR_STILE) {
    const hoehen = [];
    for (const variante of HANDWERK) {
      const kind = KATALOG.architekturAssetId(stil.id, variante);
      assert.ok(KATALOG.ARCHITEKTUR_ASSET_NAMEN.includes(kind), kind + ': Pool fehlt');
      assert.equal(POOLMODUL.POOLS[kind].rauchAnker.length, 3,
        kind + ': lokaler Rauchanker fehlt im Poolvertrag');
      const erster = quelle(kind);
      const zweiter = quelle(kind);
      assert.deepEqual(erster, zweiter, kind + ': Rauchanker ist nicht deterministisch');
      assert.ok(erster[1] > BASIS.y + 1, kind + ': Rauch sitzt nicht ueber dem Bau');
      signaturen.add(erster.map((wert) => wert.toFixed(9)).join('/'));
      hoehen.push(erster[1]);
    }
    assert.ok(hoehen[1] > hoehen[0], stil.id + ': Schmiedeschlot muss hoeher als Werkstatt sein');
  }

  assert.equal(signaturen.size, 24,
    'Jeder Kultur-Schlottyp braucht einen eigenen, passenden Anker');
});

test('Architektur-Leben - Rauchanker folgt Drehung und nichtuniformer Skalierung', () => {
  const kind = KATALOG.architekturAssetId('mondelfen', 'werkstatt');
  const q0 = quelle(kind, 0, 1.4, 1.0, 0.9);
  const q90 = quelle(kind, Math.PI / 2, 1.4, 1.0, 0.9);
  const dx = q0[0] - BASIS.x, dz = q0[2] - BASIS.z;

  fastGleich(q90[0] - BASIS.x, dz, '90-Grad-Drehung x');
  fastGleich(q90[2] - BASIS.z, -dx, '90-Grad-Drehung z');
  fastGleich(q90[1], q0[1], 'Drehung darf die Schlothoehe nicht aendern');

  const doppeltHoch = quelle(kind, 0, 1.4, 2.0, 0.9);
  fastGleich(doppeltHoch[1] - BASIS.y, (q0[1] - BASIS.y) * 2,
    'Vertikalskalierung wird nicht uebernommen');
});

test('Architektur-Leben - Legacyrauch bleibt unveraendert und Gasthaeuser bleiben ehrlich', () => {
  const faelle = [
    ['industrie', [10 - 1.3 * 2, 20 + 6.3 * 2, 30 + 0.6 * 2]],
    ['schmiedeturm', [10 + 1.0 * 2, 20 + 6.5 * 2, 30 + 0.3 * 2]],
    ['zwergenhalle', [10, 20 + 4.2 * 2, 30]]
  ];
  for (const [kind, erwartet] of faelle) {
    const el = { rauch: [], inst: {} };
    POOLMODUL.rauchAus(el, kind, 10, 20, 30, 2);
    assert.deepEqual(el.rauch, erwartet, kind + ': Legacyanker hat sich verschoben');
  }

  for (const stil of KATALOG.ARCHITEKTUR_STILE) {
    const el = { rauch: [], inst: {} };
    const kind = KATALOG.architekturAssetId(stil.id, 'gasthaus');
    assert.equal(POOLMODUL.POOLS[kind].rauchAnker, null,
      stil.id + ': Gasthaus darf keinen Rauchanker tragen');
    POOLMODUL.rauchAus(el, kind, 0, 0, 0, 1);
    assert.deepEqual(el.rauch, [], stil.id + ': Gasthaus besitzt keinen gebauten Schlot');
  }
});
