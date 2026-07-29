import test from 'node:test';
import assert from 'node:assert/strict';
import { testWelt } from './hilfen/karte.mjs';
import { ladeTerra } from './hilfen/laden.mjs';

const welt = await testWelt({ seed: 4711, groesse: 512 });
const LUFT_ASSETS = await ladeTerra('assets/luftinsel-assets.js');
const LUFT = await ladeTerra('generators/luftinseln.js');
const BAMBUS_ASSETS = await ladeTerra('assets/hochbambus-assets.js');
const BAMBUS = await ladeTerra('generators/hochbambus.js');
const { POOLS, definePool, setPoolNames } = welt.m.pools;

function registriereEinmal(ids, registrieren) {
  const vorhanden = ids.filter((id) => !!POOLS[id]);
  assert.ok(vorhanden.length === 0 || vorhanden.length === ids.length,
    'Assetfamilie nur teilweise registriert: ' + vorhanden.join(', '));
  if (!vorhanden.length) registrieren(definePool);
  setPoolNames();
}

registriereEinmal(Object.values(LUFT_ASSETS.LUFTINSEL_POOL_IDS),
  LUFT_ASSETS.registriereLuftinselPools);
registriereEinmal(Object.values(BAMBUS_ASSETS.HOCHBAMBUS_POOL_IDS),
  BAMBUS_ASSETS.registriereHochbambusPools);

function pruefeGeometrie(id, familie, maxDreiecke) {
  const pool = POOLS[id];
  assert.ok(pool, id + ': Pool fehlt');
  const g = pool.geo;
  assert.equal(g.userData.terraAssetFamilie, familie);
  for (const name of ['position', 'normal', 'color', 'uv']) {
    assert.ok(g.attributes[name], id + ': Attribut fehlt: ' + name);
    assert.equal(g.attributes[name].count, g.attributes.position.count,
      id + ': Attributlaenge weicht ab: ' + name);
  }
  const dreiecke = (g.index ? g.index.count : g.attributes.position.count) / 3;
  assert.ok(dreiecke > 40 && dreiecke <= maxDreiecke,
    id + ': Dreiecksbudget unplausibel: ' + dreiecke);
  for (const attribut of Object.values(g.attributes)) {
    for (const wert of attribut.array) {
      assert.ok(Number.isFinite(wert), id + ': NaN/Infinity in Geometrie');
    }
  }
  g.computeBoundingBox();
  assert.ok(g.boundingBox.max.y > g.boundingBox.min.y, id + ': flache Geometrie');
  return { pool, g, dreiecke };
}

test('Luftinseln - vier harte Formen registrieren skalierbare Poolgeometrien', () => {
  const grenzen = {};
  for (const form of LUFT_ASSETS.LUFTINSEL_FORMEN) {
    const id = LUFT_ASSETS.LUFTINSEL_POOL_IDS[form];
    const { pool, g } = pruefeGeometrie(id, 'luftinsel', 900);
    const horizontal = Math.max(
      Math.abs(g.boundingBox.min.x), Math.abs(g.boundingBox.max.x),
      Math.abs(g.boundingBox.min.z), Math.abs(g.boundingBox.max.z)
    );
    assert.ok(pool.radius >= horizontal,
      id + ': Poolradius ' + pool.radius + ' unterschreitet Geometrie ' + horizontal);

    assert.equal(g.userData.terraLuftinselForm, form);
    assert.equal(g.userData.terraArtDirection, 'kantig-erwachsen');
    assert.ok(g.boundingBox.min.y < -5.5, form + ': Unterbau nicht maechtig genug');
    assert.ok(g.boundingBox.max.y < 0.5, form + ': Plateauursprung verschoben');
    assert.ok(pool.radius >= 5.8, form + ': Kollisionsradius zu klein');
    assert.equal(g.userData.terraUnterseite, 'facetten-streben-mineral');
    assert.equal(g.userData.terraMaterialZonen, 8);
    grenzen[form] = [
      g.boundingBox.max.x - g.boundingBox.min.x,
      -g.boundingBox.min.y,
      g.boundingBox.max.z - g.boundingBox.min.z
    ].map((wert) => Number(wert.toFixed(2)));
  }
  assert.notDeepEqual(grenzen.fels, grenzen.scherbe);
  assert.notDeepEqual(grenzen.scherbe, grenzen.tafel);
  assert.ok(grenzen.scherbe[1] > grenzen.tafel[1] * 1.5,
    'Scherbe braucht eine deutlich tiefere Silhouette');
  assert.ok(grenzen.tafel[0] > grenzen.fels[0],
    'Tafelinsel braucht die breiteste Baukante');
});

test('Luftinseln - Einzel-API skaliert Form, Maechtigkeit und Bauanker', () => {
  const el = welt.element('objekt', 'luftinsel-test', [{ x: 0, z: 0 }], {}, 0x3551);
  const insel = LUFT.emittiereLuftinsel(el, {
    x: 18,
    z: -22,
    y: 140,
    form: 'tafel',
    groesse: 3,
    breite: 1.8,
    tiefe: 1.15,
    maechtigkeit: 1.4,
    drehung: 0.75,
    seed: 0x3551
  });
  assert.equal(insel.gesetzt, true);
  assert.equal(insel.pool, 'luftinsel_tafel');
  assert.equal(insel.sx, 5.4);
  assert.ok(Math.abs(insel.sy - 4.2) < 1e-12);
  assert.ok(Math.abs(insel.sz - 3.45) < 1e-12);
  assert.ok(insel.plateauRadius > 12);
  assert.ok(insel.unterkanteY < 115);
  assert.equal(el.inst.luftinsel_tafel.length, 12);
  assert.equal(el.schatten.length, 0, 'Luftinsel darf keinen Bodenschatten erhalten');
  welt.m.store.dropElement(el);
});

test('Luftinseln - Formationen sind deterministisch und mischen Massstaebe', () => {
  function bauen() {
    const el = welt.element('objekt', 'luftinsel-test',
      [{ x: -40, z: 30 }, { x: 80, z: -50 }], {}, 0x35a7);
    const ergebnis = LUFT.genLuftinselFormation(el, {
      anzahl: 24,
      radius: 70,
      hoehe: 120,
      hoehenStreuung: 0.4,
      minGroesse: 0.45,
      maxGroesse: 3.2,
      bodenY: 8,
      seed: 0x35a7
    });
    return { el, ergebnis };
  }
  const a = bauen();
  const b = bauen();
  assert.equal(a.ergebnis.gesetzt, 24);
  assert.deepEqual(a.el.inst, b.el.inst);
  assert.ok(Object.keys(a.el.inst).length >= 3,
    'Formation nutzt zu wenige Silhouettenfamilien');
  const groessen = a.ergebnis.inseln.map((insel) => insel.sx);
  assert.ok(Math.max(...groessen) > Math.min(...groessen) * 3,
    'Formation mischt keine deutlich verschiedenen Massstaebe');
  welt.m.store.dropElement(a.el);
  welt.m.store.dropElement(b.el);
});

test('Hochbambus - drei Pooltypen bilden extreme Hoehe bei begrenzter Geometrie', () => {
  const erwarteteHoehen = BAMBUS_ASSETS.HOCHBAMBUS_BASIS_HOEHEN;
  const vertexZahl = {};
  for (const [art, id] of Object.entries(BAMBUS_ASSETS.HOCHBAMBUS_POOL_IDS)) {
    const { pool, g } = pruefeGeometrie(id, 'hochbambus', 3200);
    const horizontal = Math.max(
      Math.abs(g.boundingBox.min.x), Math.abs(g.boundingBox.max.x),
      Math.abs(g.boundingBox.min.z), Math.abs(g.boundingBox.max.z)
    );
    assert.ok(pool.radius >= horizontal,
      id + ': Poolradius deckt Blattfaecher nicht ab');
    vertexZahl[id] = g.attributes.position.count;
    assert.equal(g.userData.terraHochbambusArt, art);
    assert.equal(g.userData.terraBasisHoehe, erwarteteHoehen[id]);
    assert.equal(g.userData.terraStaengel,
      BAMBUS_ASSETS.HOCHBAMBUS_STAENGEL_PRO_INSTANZ[id]);
    assert.equal(g.userData.terraArtDirection, 'hoch-kantig-erwachsen');
    assert.ok(g.boundingBox.max.y > erwarteteHoehen[id] * 0.9);
    const uv = g.attributes.uv;
    let uvOben = 0;
    assert.equal(g.userData.terraMaterialZonen, 10);
    assert.equal(g.userData.terraBlattFaechern, art === 'kronendach' ? 3 : 2);
    for (let i = 0; i < uv.count; i++) uvOben = Math.max(uvOben, uv.getY(i));
    assert.ok(uvOben > 0.9, id + ': Wind-UV erreicht die Krone nicht');
  }
  assert.ok(vertexZahl.bambus_kronendach > vertexZahl.bambus_hoch * 3.8,
    'Kronendach ist visuell nicht dicht genug');
  assert.equal(BAMBUS_ASSETS.HOCHBAMBUS_STAENGEL_PRO_INSTANZ.bambus_kronendach, 7);
});

test('Hochbambus - dichter 180m-Hain bleibt bei drei Pools und wenigen Instanzen', () => {
  function bauen() {
    const el = welt.element('objekt', 'hochbambus-test',
      [{ x: -60, z: -20 }, { x: 70, z: 55 }], {}, 0x3671);
    const ergebnis = BAMBUS.genHochbambusHain(el, {
      horste: 240,
      dichte: 1,
      radius: 46,
      hoehe: 180,
      hoehenVariation: 0.28,
      breite: 0.9,
      bodenAn: () => 34,
      seed: 0x3671
    });
    return { el, ergebnis };
  }
  const a = bauen();
  const b = bauen();
  assert.equal(a.ergebnis.instanzen, 240);
  assert.equal(a.el.total, 240);
  assert.ok(a.ergebnis.staengel >= 1000,
    'Horst-Geometrie spart zu wenige Instanzen: ' + a.ergebnis.staengel);
  assert.ok(Object.keys(a.el.inst).length <= 3,
    'Hain erzeugt mehr als drei Pool-Draw-Calls');
  assert.deepEqual(a.el.inst, b.el.inst);
  assert.ok(Math.max(...a.ergebnis.plan.map((p) => p.zielHoehe)) >= 180);
  assert.ok(Math.max(...a.ergebnis.plan.map((p) => p.zielHoehe))
    <= BAMBUS.HOCHBAMBUS_MAX_HOEHE);
  assert.ok(a.ergebnis.plan.every((p) => p.y === 34));
  welt.m.store.dropElement(a.el);
  welt.m.store.dropElement(b.el);
});

test('Hochbambus - Dichtekappe schuetzt den Instanzhaushalt', () => {
  const el = welt.element('objekt', 'hochbambus-test', [{ x: 0, z: 0 }], {}, 0x36d1);
  const plan = BAMBUS.planeHochbambusHain(el, {
    horste: 10000,
    dichte: 5,
    maxHorste: 10000,
    hoehe: 500,
    radius: 120,
    bodenAn: () => 0,
    seed: 0x36d1
  });
  assert.equal(plan.length, BAMBUS.HOCHBAMBUS_MAX_HORSTE);
  assert.ok(plan.every((p) => p.zielHoehe <= BAMBUS.HOCHBAMBUS_MAX_HOEHE));
  welt.m.store.dropElement(el);
});

test('Hochbambus - Junganteil steuert den Randwuchs deterministisch', () => {
  const el = welt.element('objekt', 'hochbambus-test', [{ x: 0, z: 0 }], {}, 0x3719);
  const basis = {
    horste: 512,
    radius: 90,
    hoehe: 120,
    bodenAn: () => 0,
    seed: 0x3719
  };
  const ohne = BAMBUS.planeHochbambusHain(el, {
    ...basis,
    junganteil: 0
  });
  const dicht = BAMBUS.planeHochbambusHain(el, {
    ...basis,
    junganteil: 0.7
  });
  const jungeOhne = ohne.filter((p) => p.pool === 'bambus_jung').length;
  const jungeDicht = dicht.filter((p) => p.pool === 'bambus_jung').length;
  assert.equal(jungeOhne, 0);
  assert.ok(jungeDicht > 220,
    'Maximaler Junganteil wirkt zu schwach: ' + jungeDicht);
  welt.m.store.dropElement(el);
});
