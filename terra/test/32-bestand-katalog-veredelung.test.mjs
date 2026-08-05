/* ==========================================================================
   Veredelung des Welle-3-Bestandskatalogs

   Der Test rekonstruiert den auditierten Scope direkt aus geometry.js und
   prueft jeden der 149 Pools auf deterministische, sichtbare Einzelgeometrie.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ladeTerra, SRC } from './hilfen/laden.mjs';

const THREE = await import('three');
const KATALOG = await ladeTerra('assets/bestand-katalog-veredelung.js');
const ARCHITEKTUR = await ladeTerra('assets/architektur-katalog.js');
const UMWELT = await ladeTerra('assets/umwelt-geometrie.js');
const BAU_PFAD = path.join(SRC, 'assets', 'bestand-bau-veredelung.js');
const BAU = fs.existsSync(BAU_PFAD)
  ? await ladeTerra('assets/bestand-bau-veredelung.js')
  : null;

const UMWELT_AUSSCHLUSS = Object.freeze([
  'obstbaum', 'findling', 'geroell', 'felsnadel', 'basaltsaeulen', 'eisfels',
  'ackerscholle', 'lattenzaun', 'pferch', 'moorsteg', 'langhaus',
  'grubenhaus', 'turmhaus', 'giebelhaus', 'laubenhaus'
]);

function welleDreiPools() {
  const quelle = fs.readFileSync(
    path.join(SRC, 'generators', 'geometry.js'), 'utf8'
  );
  const start = quelle.indexOf('Kategorie 13 des Objektkatalogs');
  const ende = quelle.indexOf('/* --- Anker der neuen Buendel', start);
  assert.ok(start >= 0 && ende > start, 'Welle-3-Katalogbereich fehlt');
  const bereich = quelle.slice(start, ende);
  return [...bereich.matchAll(/\bdefinePool\s*\(\s*["']([^"']+)["']/g)]
    .map((treffer) => treffer[1]);
}

function basisGeometrie() {
  const geo = new THREE.BoxGeometry(1.4, 1.7, 0.9);
  const n = geo.attributes.position.count;
  const farben = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    farben[i * 3] = 0.61;
    farben[i * 3 + 1] = 0.57;
    farben[i * 3 + 2] = 0.49;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(farben, 3));
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (!geo.attributes.uv) {
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
  geo.computeBoundingBox();
  return geo;
}

function bytes(array) {
  return Buffer.from(array.buffer, array.byteOffset, array.byteLength);
}

function signatur(geo) {
  const hash = createHash('sha256');
  for (const name of ['position', 'normal', 'color', 'uv']) {
    const attr = geo.attributes[name];
    hash.update(name + ':' + attr.itemSize + ':' + attr.count + ':');
    hash.update(bytes(attr.array));
  }
  hash.update('#index:');
  if (geo.index) hash.update(bytes(geo.index.array));
  return hash.digest('hex');
}

function alleEndlich(array) {
  for (let i = 0; i < array.length; i++) {
    if (!Number.isFinite(array[i])) return false;
  }
  return true;
}

function dreiecke(geo) {
  return (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
}

function istErweitert(vorher, nachher) {
  const epsilon = 1e-4;
  return nachher.min.x < vorher.min.x - epsilon ||
    nachher.min.y < vorher.min.y - epsilon ||
    nachher.min.z < vorher.min.z - epsilon ||
    nachher.max.x > vorher.max.x + epsilon ||
    nachher.max.y > vorher.max.y + epsilon ||
    nachher.max.z > vorher.max.z + epsilon;
}

function pruefeGeometrie(geo, name, basis) {
  assert.ok(geo && geo.isBufferGeometry, name + ': kein BufferGeometry-Ergebnis');
  const position = geo.attributes.position;
  const basisVertices = basis.attributes.position.count;
  assert.ok(position.count > basisVertices, name + ': keine Detailvertices');
  for (const [attrName, itemSize] of Object.entries({
    position: 3, normal: 3, color: 3, uv: 2
  })) {
    const attr = geo.attributes[attrName];
    assert.ok(attr, name + ': Attribut ' + attrName + ' fehlt');
    assert.equal(attr.itemSize, itemSize, name + ': falsches itemSize fuer ' + attrName);
    assert.equal(attr.count, position.count, name + ': abweichende Attributlaenge');
    assert.ok(alleEndlich(attr.array), name + ': ' + attrName + ' enthaelt NaN/Infinity');
  }
  assert.ok(geo.index && geo.index.count > 0, name + ': Index fehlt');
  for (let i = 0; i < geo.index.count; i++) {
    const wert = geo.index.array[i];
    assert.ok(Number.isInteger(wert) && wert >= 0 && wert < position.count,
      name + ': ungueltiger Index ' + wert);
  }
  assert.ok(position.count <= basisVertices + 260,
    name + ': Vertexbudget ueberschritten');
  assert.ok(dreiecke(geo) - dreiecke(basis) <= 180,
    name + ': Dreiecksbudget ueberschritten');
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  assert.ok(istErweitert(basis.boundingBox, geo.boundingBox),
    name + ': Silhouette wurde nicht sichtbar erweitert');
  assert.ok(Number.isFinite(geo.boundingSphere.radius) && geo.boundingSphere.radius > 0,
    name + ': ungueltige Huelle');
  for (let i = basisVertices; i < geo.attributes.uv.count; i++) {
    assert.equal(geo.attributes.uv.getX(i), 0.5,
      name + ': Detail verlaesst opaken Texturanker');
    assert.ok(Math.abs(geo.attributes.uv.getY(i) - 0.008) < 1e-7,
      name + ': Detail verlaesst windstillen Texturanker');
  }
}

test('Bestandskatalog - erfasst exakt die 149 auditierten Welle-3-Pools', () => {
  assert.deepEqual(Object.keys(KATALOG).sort(), [
    'BESTAND_KATALOG_FAMILIEN',
    'BESTAND_KATALOG_VERFEINERTE_POOLS',
    'veredleBestandKatalog'
  ]);
  assert.ok(Object.isFrozen(KATALOG.BESTAND_KATALOG_VERFEINERTE_POOLS));
  const alle = welleDreiPools();
  assert.equal(alle.length, 164, 'Welle-3-Quellumfang hat sich verschoben');
  assert.equal(new Set(alle).size, 164, 'Welle-3-Quelle enthaelt Dubletten');
  const ausgeschlossen = new Set(UMWELT_AUSSCHLUSS);
  const erwartet = alle.filter((name) => !ausgeschlossen.has(name));
  assert.equal(erwartet.length, 149);
  assert.equal(KATALOG.BESTAND_KATALOG_VERFEINERTE_POOLS.length, 149);
  assert.equal(new Set(KATALOG.BESTAND_KATALOG_VERFEINERTE_POOLS).size, 149);
  assert.deepEqual(
    [...KATALOG.BESTAND_KATALOG_VERFEINERTE_POOLS].sort(),
    erwartet.sort()
  );
  for (const name of KATALOG.BESTAND_KATALOG_VERFEINERTE_POOLS) {
    assert.match(name, /^[a-z0-9_]+$/, name + ': Kennung ist nicht ASCII-stabil');
  }
});

test('Bestandskatalog - bleibt disjunkt zu Architektur, Umwelt und Bau-Batch A', () => {
  const katalog = new Set(KATALOG.BESTAND_KATALOG_VERFEINERTE_POOLS);
  for (const name of ARCHITEKTUR.ARCHITEKTUR_ASSET_NAMEN) {
    assert.ok(!katalog.has(name), name + ': kollidiert mit Architektur');
  }
  for (const name of UMWELT.UMWELT_VERFEINERTE_POOLS) {
    assert.ok(!katalog.has(name), name + ': kollidiert mit Umwelt');
  }
  if (BAU) {
    assert.equal(BAU.BESTAND_BAU_VERFEINERTE_POOLS.length, 81,
      'Batch-A-Umfang hat sich verschoben');
    for (const name of BAU.BESTAND_BAU_VERFEINERTE_POOLS) {
      assert.ok(!katalog.has(name), name + ': kollidiert mit Bau-Batch A');
    }
  }
});

test('Bestandskatalog - alle Pools sind vollstaendig, sichtbar und deterministisch', () => {
  const signaturen = new Set();
  const familien = new Set();
  for (const name of KATALOG.BESTAND_KATALOG_VERFEINERTE_POOLS) {
    const basisA = basisGeometrie();
    const basisB = basisGeometrie();
    const a = KATALOG.veredleBestandKatalog(name, basisA);
    const b = KATALOG.veredleBestandKatalog(name, basisB);
    assert.notStrictEqual(a, basisA, name + ': bekannte Kennung nur durchgereicht');
    assert.notStrictEqual(b, basisB, name + ': zweiter Lauf nur durchgereicht');
    pruefeGeometrie(a, name, basisA);
    assert.equal(signatur(a), signatur(b), name + ': Ausgabe ist nicht deterministisch');
    assert.equal(a.userData.bestandKatalogName, name);
    assert.match(a.userData.bestandKatalogFamilie, /^[a-z_]+$/);
    assert.ok(Number.isInteger(a.userData.bestandKatalogDetails));
    assert.ok(a.userData.bestandKatalogDetails >= 2);
    signaturen.add(signatur(a));
    familien.add(a.userData.bestandKatalogFamilie);
  }
  assert.equal(signaturen.size, 149, 'Geometriehashes sind nicht eindeutig');
  assert.equal(familien.size, 15, 'nicht alle 15 Formsprachen werden erreicht');
});

test('Bestandskatalog - unbekannte IDs und Kartenzeichen bleiben identisch', () => {
  for (const name of ['karte_ort', 'arch_nebelhain_palast', 'baum']) {
    const geo = basisGeometrie();
    const vorher = signatur(geo);
    assert.strictEqual(KATALOG.veredleBestandKatalog(name, geo), geo);
    assert.equal(signatur(geo), vorher);
  }
});

test('Bestandskatalog - erzeugt keine Zufallswerte, IDs oder Renderobjekte', () => {
  const pfad = path.join(SRC, 'assets', 'bestand-katalog-veredelung.js');
  const quelle = fs.readFileSync(pfad, 'utf8');
  const ohneKommentare = quelle
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.ok(quelle.split(/\r?\n/).length <= 700, 'Produktionsmodul ist zu gross');
  assert.doesNotMatch(ohneKommentare, /\bMath\s*\.\s*random\b/);
  assert.doesNotMatch(ohneKommentare, /\bDate\s*(?:\.|\()/);
  assert.doesNotMatch(ohneKommentare, /\bdefinePool\s*\(/);
  assert.doesNotMatch(ohneKommentare, /\bnew\s+THREE\s*\.\s*Mesh\b/);
  assert.doesNotMatch(ohneKommentare, /\bInstancedMesh\b/);
  assert.doesNotMatch(ohneKommentare, /\b(?:Mesh|Shader|RawShader)Material\b/);
});
