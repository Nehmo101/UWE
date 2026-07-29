import test from 'node:test';
import assert from 'node:assert/strict';
import { ladeTerra } from './hilfen/laden.mjs';
import { testWelt } from './hilfen/karte.mjs';

const LUFT = await ladeTerra('editor/luftwerkzeuge.js');
const ROUTEN = await ladeTerra('generators/flugrouten.js');
const SCHAU = await ladeTerra('generators/luftschau.js');

function farben(THREE) {
  const t = {};
  for (const k of ['grasKuehl','grasWarm','grasTrocken','erde','fels','schnee',
    'sand','seegrund','tiefe','tritt','brandung','driftGelb','driftBlau']) {
    t[k] = new THREE.Color(0xffffff);
  }
  return t;
}

test('Luftsysteme - Luftarchipel ist ein vollwertiges Biom', async () => {
  const THREE = await import('three');
  const registry = { wiese: { terrain: farben(THREE) } };
  LUFT.registriereLuftbiom(registry);
  const b = registry.luftarchipel;
  assert.equal(b.label, 'Luftarchipel');
  assert.ok(b.hoehe.sockel < -10, 'viel offener Himmel statt geschlossener Landplatte');
  assert.ok(b.luft.fogFern > 1, 'weite atmosphaerische Staffelung');
  assert.equal(b.vfx.typ, 'blueten');
  const erstes = b;
  LUFT.registriereLuftbiom(registry);
  assert.equal(registry.luftarchipel, erstes, 'Registrierung ist idempotent');
});

test('Luftsysteme - drei Editorvarianten tragen vollstaendige Schemata', () => {
  const varianten = { pfad: [], objekt: [] };
  const params = {};
  LUFT.registriereLuftWerkzeuge(varianten, params);
  assert.deepEqual(varianten.pfad, [['flugroute', 'Flugroute']]);
  assert.deepEqual(varianten.objekt.map((v) => v[0]), ['luftinseln', 'bambushain']);
  assert.equal(params['pfad:flugroute'].find((d) => d.k === 'fraktion').o.length, 5);
  assert.equal(params['objekt:luftinseln'].find((d) => d.k === 'hoehe').max, 220);
  assert.equal(params['objekt:bambushain'].find((d) => d.k === 'hoehe').max, 160);
});

test('Luftsysteme - Routen halten ihre Bodenfreiheit und Bogenlaenge', async () => {
  const welt = await testWelt({ seed: 4711, groesse: 256 });
  const el = welt.element('pfad', 'flugroute',
    [{ x: -70, z: -30 }, { x: 0, z: 45 }, { x: 75, z: -15 }],
    { fahrzeug: 'gemischt', fraktion: 'mondelfen', hoehe: 64, verkehr: 4,
      geschwindigkeit: 0.8, routeSichtbar: true, stationen: true });
  const route = ROUTEN.flugroutePunkte(el);
  assert.ok(route.length > 20);
  assert.ok(route.gesamt > 180);
  for (const p of route) {
    assert.ok(p.y >= welt.m.terrain.heightAt(p.x, p.z) + 63.99, 'Mindestfreiheit');
  }
  const erneut = ROUTEN.flugroutePunkte(el);
  assert.deepEqual(erneut.map((p) => [p.x, p.y, p.z]), route.map((p) => [p.x, p.y, p.z]));
  welt.leeren();
});

test('Luftsysteme - gezeichneter Pfad batcht und bewegt vier Fraktionsfahrzeuge', async () => {
  const welt = await testWelt({ seed: 4711, groesse: 256 });
  const el = welt.element('pfad', 'flugroute',
    [{ x: -75, z: -25 }, { x: -10, z: 50 }, { x: 72, z: -10 }],
    { fahrzeug: 'gemischt', fraktion: 'tiefenzwerge', hoehe: 58, verkehr: 4,
      geschwindigkeit: 1.1, routeSichtbar: true, stationen: true });
  welt.erzeuge(el);
  assert.ok(el.flugroute);
  assert.equal(el.flugroute.fahrzeuge.length, 4);
  assert.equal(el.flugroute.batches.length, 2,
    'gemischter Verkehr braucht genau einen Batch je Fahrzeugtyp');
  assert.equal(el.group.children.length, 4,
    'Linie, gebuendelte Bojen und zwei Fahrzeugbatches');
  const linie = el.group.children.find((kind) => kind.isLine);
  assert.equal(linie.material.type, 'LineDashedMaterial');
  assert.ok(linie.material.opacity <= 0.4, 'Routenlinie bleibt hinter den Fahrzeugen');
  assert.ok(linie.geometry.attributes.lineDistance,
    'gestrichelte Luftkorridore brauchen vorberechnete Bogenlaengen');
  assert.ok(el.flugroute.batches.every((batch) => batch.isInstancedMesh));
  assert.equal(el.flugroute.batches.reduce((n, batch) => n + batch.count, 0), 4);
  for (const batch of el.flugroute.batches) {
    assert.equal(batch.userData.el, el, 'Selection-Vertrag am Renderbatch');
    assert.equal(batch.castShadow, true);
    assert.equal(batch.frustumCulled, false);
  }
  for (const mesh of el.flugroute.fahrzeuge) assert.equal(mesh.userData.el, el);
  const matrizenVorher = el.flugroute.batches.map((batch) =>
    Array.from(batch.instanceMatrix.array));
  const vorher = el.flugroute.fahrzeuge.map((m) => [m.position.x, m.position.y, m.position.z]);
  assert.equal(ROUTEN.tickFlugrouten(3.5), 4);
  const nachher = el.flugroute.fahrzeuge.map((m) => [m.position.x, m.position.y, m.position.z]);
  assert.notDeepEqual(nachher, vorher, 'Fahrzeuge bewegen sich entlang der Route');
  const matrizenNachher = el.flugroute.batches.map((batch) =>
    Array.from(batch.instanceMatrix.array));
  assert.notDeepEqual(matrizenNachher, matrizenVorher,
    'animierte Transformationen erreichen die GPU-Batches');
  assert.ok(el.flugroute.batches.every((batch) => batch.instanceMatrix.needsUpdate));
  assert.equal(ROUTEN.flugroutePoolId('tiefenzwerge', 'zug'), 'luftzug_tiefenzwerge');
  assert.equal(ROUTEN.flugroutePoolId('unbekannt', 'schiff'), 'luftschiff_menschenbund');
  welt.leeren();
});

test('Luftsysteme - homogener Verkehr bleibt bei einem Fahrzeug-Draw-Call', async () => {
  const welt = await testWelt({ seed: 4712, groesse: 256 });
  const el = welt.element('pfad', 'flugroute',
    [{ x: -80, z: 20 }, { x: 0, z: -40 }, { x: 80, z: 25 }],
    { fahrzeug: 'schiff', fraktion: 'menschenbund', hoehe: 52, verkehr: 8,
      geschwindigkeit: 0.7, routeSichtbar: false, stationen: false });
  welt.erzeuge(el);
  assert.equal(el.flugroute.fahrzeuge.length, 8);
  assert.equal(el.flugroute.batches.length, 1);
  assert.equal(el.flugroute.batches[0].count, 8);
  assert.equal(el.group.children.length, 1, 'nur ein Fahrzeugbatch ohne Linie/Bojen');
  assert.equal(ROUTEN.tickFlugrouten(1.25), 8);
  welt.leeren();
});


test('Luftsysteme - Luftschau reduziert 16 Fahrzeuge auf sechs Renderbatches', async () => {
  const welt = await testWelt({ seed: 4713, groesse: 256 });
  const specs = SCHAU.erstelleLuftschauPlan().elements.filter((spec) =>
    spec.kind === 'pfad' && spec.variant === 'flugroute');
  let fahrzeuge = 0;
  let batches = 0;
  let hauptpassDraws = 0;
  for (const spec of specs) {
    const el = welt.element(spec.kind, spec.variant, spec.points, spec.params);
    welt.erzeuge(el);
    fahrzeuge += el.flugroute.fahrzeuge.length;
    batches += el.flugroute.batches.length;
    hauptpassDraws += el.group.children.length;
  }
  assert.equal(specs.length, 5);
  assert.equal(fahrzeuge, 16);
  assert.equal(batches, 6);
  assert.equal(hauptpassDraws, 15,
    '5 Linien + 4 Bojenbatches + 6 Fahrzeugbatches');
  welt.leeren();
});

test('Luftsysteme - Objektwerkzeuge erzeugen bewachsene Inseln und dichten Riesenbambus', async () => {
  const welt = await testWelt({ seed: 4711, groesse: 256 });
  const inseln = welt.element('objekt', 'luftinseln', [{ x: -24, z: -18 }],
    { anzahl: 6, streuung: 26, groesse: 1.5, hoehe: 72,
      form: 'gemischt', bewuchs: true });
  welt.erzeuge(inseln);
  const inselIds = Object.keys(inseln.inst).filter((id) => id.startsWith('luftinsel_'));
  assert.ok(inselIds.length >= 2, 'Formation mischt mehrere Inselformen');
  assert.equal(inselIds.reduce((n, id) => n + inseln.inst[id].length / 12, 0), 6);
  assert.ok(['baum2', 'busch', 'bluetenbaum'].some((id) => inseln.inst[id]),
    'bewohnbare Plateaus bekommen Vegetation');

  const bambus = welt.element('objekt', 'bambushain', [{ x: 35, z: 25 }],
    { anzahl: 72, streuung: 14, hoehe: 118, dicke: 1.2,
      dichte: 1.35, junganteil: 0.22 });
  welt.erzeuge(bambus);
  const bambusIds = Object.keys(bambus.inst).filter((id) => id.startsWith('bambus_'));
  assert.deepEqual(bambusIds.sort(), ['bambus_hoch', 'bambus_jung', 'bambus_kronendach']);
  assert.ok(bambus.kennzahl > 400, 'ein dichter Hain repraesentiert Hunderte Halme');
  const maxSy = Math.max(...bambusIds.flatMap((id) => {
    const a = bambus.inst[id], out = [];
    for (let i = 7; i < a.length; i += 12) out.push(a[i]);
    return out;
  }));
  assert.ok(maxSy > 6, 'extreme Hoehenskalierung ist im Instanzvertrag sichtbar');
  welt.leeren();
});
