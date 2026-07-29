/* ==========================================================================
   Vollstaendige Asset-Schau

   Der Schaukasten ist zugleich ein Registry-Vertrag: alle physischen Pools
   stehen genau einmal, Kartenzeichen nie. Architektur behaelt ihr bewusstes
   12x18-Raster; die Restwelt wird in beschriftbare Familien gepackt.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ladeTerra } from './hilfen/laden.mjs';
import { testWelt } from './hilfen/karte.mjs';

const welt = await testWelt({ seed: 1337, groesse: 512 });
const SCHAU = await ladeTerra('generators/asset-schau.js');
const KATALOG = await ladeTerra('assets/architektur-katalog.js');
const POOLS = welt.m.pools.POOLS;
const LAYOUT = SCHAU.baueAssetSchauLayout();

function centerKey(p) {
  return p.x.toFixed(6) + ':' + p.z.toFixed(6);
}

function endlich(wert, text) {
  assert.ok(Number.isFinite(wert), text + ': ' + wert);
}

test('Asset-Schau - enthaelt exakt alle 505 physischen Pools genau einmal', () => {
  const registryNamen = Object.keys(POOLS).filter((name) => !name.startsWith('sig_')).sort();
  const schauNamen = LAYOUT.placements.map((p) => p.name);

  assert.equal(Object.keys(POOLS).length, 555);
  assert.equal(Object.keys(POOLS).filter((name) => name.startsWith('sig_')).length, 50);
  assert.equal(registryNamen.length, SCHAU.ASSET_SCHAU_ERWARTETE_POOLS);
  assert.equal(LAYOUT.counts.physical, 505);
  assert.equal(LAYOUT.counts.architecture, 216);
  assert.equal(LAYOUT.counts.other, 289);
  assert.equal(schauNamen.length, 505);
  assert.equal(new Set(schauNamen).size, 505);
  assert.deepEqual([...schauNamen].sort(), registryNamen);
  assert.deepEqual(schauNamen.filter((name) => name.startsWith('sig_')), []);
  assert.deepEqual(SCHAU.assetSchauPoolNamen(), registryNamen);
});

test('Asset-Schau - Architektur steht als stabiler 12x18-Block', () => {
  const block = LAYOUT.blocks.find((b) => b.id === 'architektur');
  assert.ok(block, 'Architekturblock fehlt');
  assert.equal(block.rows, 12);
  assert.equal(block.columns, 18);
  assert.equal(block.count, 216);

  const jeName = new Map(LAYOUT.placements.map((p) => [p.name, p]));
  for (const asset of KATALOG.ARCHITEKTUR_ASSETS) {
    const p = jeName.get(asset.id);
    assert.ok(p, asset.id + ': fehlt im Architekturblock');
    assert.equal(p.family, 'architektur');
    assert.equal(p.blockId, 'architektur');
    assert.equal(p.row, asset.stilIndex);
    assert.equal(p.column, asset.variantenIndex);
    assert.equal(p.label, asset.label);
  }
  assert.equal(KATALOG.ARCHITEKTUR_STILE.length, 12);
  assert.equal(KATALOG.ARCHITEKTUR_VARIANTEN.length, 18);
});

test('Asset-Schau - Restassets bilden zehn nichtleere beschriftbare Familien', () => {
  const familienBloecke = LAYOUT.blocks.filter((b) => b.id !== 'architektur');
  assert.equal(familienBloecke.length, SCHAU.ASSET_SCHAU_FAMILIEN.length);
  assert.deepEqual(familienBloecke.map((b) => b.id),
    SCHAU.ASSET_SCHAU_FAMILIEN.map((f) => f.id));
  assert.equal(familienBloecke.reduce((summe, b) => summe + b.count, 0), 289);

  for (const block of familienBloecke) {
    assert.ok(block.count > 0, block.id + ': Familie ist leer');
    assert.ok(block.label && block.label.length > 5, block.id + ': Label fehlt');
    assert.ok(block.rows > 0 && block.columns > 0, block.id + ': Raster ist leer');
    assert.ok(block.rows * block.columns >= block.count, block.id + ': Raster zu klein');
    endlich(block.labelPosition.x, block.id + '.labelPosition.x');
    endlich(block.labelPosition.z, block.id + '.labelPosition.z');
  }
});

test('Asset-Schau - Platzierungen sind endlich, eindeutig und kollisionsfrei', () => {
  const zentren = new Set();
  for (const p of LAYOUT.placements) {
    assert.ok(POOLS[p.name], p.name + ': unbekannter Pool');
    for (const key of ['x', 'y', 'z', 'yaw', 'scale']) endlich(p[key], p.name + '.' + key);
    assert.ok(p.scale > 0 && p.scale <= 3, p.name + ': unplausible Anzeigeskala');
    assert.ok(Number.isInteger(p.row) && p.row >= 0, p.name + ': ungueltige Zeile');
    assert.ok(Number.isInteger(p.column) && p.column >= 0, p.name + ': ungueltige Spalte');
    const key = centerKey(p);
    assert.ok(!zentren.has(key), p.name + ': Zellzentrum doppelt ' + key);
    zentren.add(key);
  }

  let kleinsterAbstand = Infinity;
  let kleinsteLuecke = Infinity;
  for (let i = 0; i < LAYOUT.placements.length; i++) {
    const a = LAYOUT.placements[i];
    for (let j = i + 1; j < LAYOUT.placements.length; j++) {
      const b = LAYOUT.placements[j];
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      kleinsterAbstand = Math.min(kleinsterAbstand, d);
      kleinsteLuecke = Math.min(kleinsteLuecke,
        d - POOLS[a.name].radius * a.scale - POOLS[b.name].radius * b.scale);
    }
  }
  assert.ok(kleinsterAbstand >= 12 - 1e-9,
    'Zellzentren stehen zu dicht: ' + kleinsterAbstand);
  assert.ok(kleinsteLuecke >= 2,
    'Pool-Huellkreise brauchen sichtbare Luft: ' + kleinsteLuecke);
});

test('Asset-Schau - Bounds sind zentriert und passen mit Rand auf eine 512er Karte', () => {
  const b = LAYOUT.bounds;
  for (const key of ['minX', 'maxX', 'minZ', 'maxZ', 'width', 'depth', 'centerX', 'centerZ']) {
    endlich(b[key], 'bounds.' + key);
  }
  assert.ok(Math.abs(b.centerX) < 1e-9);
  assert.ok(Math.abs(b.centerZ) < 1e-9);
  assert.ok(b.width > 420 && b.width < 450, 'unplausible Breite: ' + b.width);
  assert.ok(b.depth > 390 && b.depth < 430, 'unplausible Tiefe: ' + b.depth);
  assert.equal(LAYOUT.recommendedMapSize, 512);
  const halbMitRand = LAYOUT.recommendedMapSize / 2 - 30;
  assert.ok(b.minX >= -halbMitRand && b.maxX <= halbMitRand);
  assert.ok(b.minZ >= -halbMitRand && b.maxZ <= halbMitRand);
});

test('Asset-Schau - Layout ist ueber Wiederholungen bitgleich deterministisch', () => {
  const zweites = SCHAU.baueAssetSchauLayout();
  assert.deepEqual(zweites, LAYOUT);
  assert.deepEqual(SCHAU.baueAssetSchauLayout(POOLS), LAYOUT);
});

test('Asset-Schau - Store-Element nutzt jede Pool-ID einmal und vergibt Runtime-IDs sauber', () => {
  const vorher = welt.m.store.S.elements.length;
  const a = SCHAU.erzeugeAssetSchau({
    einhaengen: false,
    markiere: false,
    hoeheAn: () => 3
  });
  const b = SCHAU.erzeugeAssetSchau({
    einhaengen: false,
    markiere: false,
    hoeheAn: () => 3
  });
  assert.notEqual(a.element.id, b.element.id, 'mkElement muss jede Runtime-ID frisch vergeben');
  assert.equal(welt.m.store.S.elements.length, vorher);

  const el = a.element;
  assert.equal(el.kind, 'objekt');
  assert.equal(el.variant, 'asset-schau');
  assert.equal(el.total, 505);
  assert.equal(el.karteTotal, 0);
  const schattenPools = a.layout.placements.filter((p) =>
    POOLS[p.name].radius * p.scale >= 0.6).length;
  assert.equal(el.schatten.length, schattenPools * 7);
  for (let i = 0; i < el.schatten.length; i += 7) {
    assert.ok(Math.abs(el.schatten[i + 1] - 3.06) < 1e-6,
      'Schatten liegt nicht auf Schauhoehe');
    assert.ok(el.schatten[i + 3] >= 0.6 && el.schatten[i + 3] <= 8,
      'Schattenradius unplausibel');
    for (let k = 0; k < 7; k++) assert.ok(Number.isFinite(el.schatten[i + k]));
  }
  assert.equal(el.rauch.length, 0);
  assert.equal(Object.keys(el.inst).length, 505);
  for (const p of a.layout.placements) {
    const inst = el.inst[p.name];
    assert.ok(inst, p.name + ': Instanzdaten fehlen');
    assert.equal(inst.length, 12, p.name + ': falscher Instanzvertrag');
    for (const wert of inst) assert.ok(Number.isFinite(wert), p.name + ': NaN/Infinity');
    POOLS[p.name].geo.computeBoundingBox();
    const bodenkontakt = inst[1] + POOLS[p.name].geo.boundingBox.min.y * inst[7];
    assert.ok(Math.abs(bodenkontakt - 3) < 1e-6, p.name + ': steht nicht auf Schauhoehe');
  }

  const eingebaut = SCHAU.erzeugeAssetSchau({
    einhaengen: true,
    markiere: false,
    hoeheAn: () => 0
  });
  const wieder = SCHAU.erzeugeAssetSchau({ einhaengen: true, markiere: false });
  assert.equal(wieder.reused, true);
  assert.strictEqual(wieder.element, eingebaut.element);
  assert.equal(welt.m.store.S.elements.length, vorher + 1);
  welt.m.store.dropElement(eingebaut.element);
});
