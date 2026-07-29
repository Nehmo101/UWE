/* ==========================================================================
   Steampunk-Luftflotte

   Fixiert Fraktionen, Pool-IDs, hochwertige Einzelgeometrien und die isoliert
   injizierbare Registry-API. Das Assetmodul selbst darf beim Import keine
   globale Poolmutation ausloesen; geometry.js integriert die Serie spaeter
   gesammelt mit den weiteren neuen Weltassets.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ladeTerra, SRC } from './hilfen/laden.mjs';

const FLOTTE = await ladeTerra('assets/steampunk-luftflotte.js');

const FRAKTIONEN = Object.freeze([
  'menschenbund', 'mondelfen', 'tiefenzwerge', 'goblinzunft', 'orklegion'
]);
const NAMEN = Object.freeze(FRAKTIONEN.flatMap((fraktion) => [
  'luftschiff_' + fraktion,
  'luftzug_' + fraktion
]));

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

function endlich(array) {
  for (let i = 0; i < array.length; i++) {
    if (!Number.isFinite(array[i])) return false;
  }
  return true;
}

function pruefeGeometrie(asset, geo) {
  assert.ok(geo && geo.isBufferGeometry, asset.id + ': keine BufferGeometry');
  const position = geo.attributes.position;
  assert.ok(position.count >= 900, asset.id + ': Form ist zu grob');
  assert.ok(position.count < 9000, asset.id + ': Vertexbudget ueberschritten');
  for (const [name, itemSize] of Object.entries({
    position: 3, normal: 3, color: 3, uv: 2
  })) {
    const attr = geo.attributes[name];
    assert.ok(attr, asset.id + ': Attribut ' + name + ' fehlt');
    assert.equal(attr.itemSize, itemSize, asset.id + ': falsches itemSize ' + name);
    assert.equal(attr.count, position.count, asset.id + ': Attributlaenge ' + name);
    assert.ok(endlich(attr.array), asset.id + ': NaN/Infinity in ' + name);
  const farben = new Set();
  const farbattribut = geo.attributes.color;
  for (let i = 0; i < farbattribut.count; i++) {
    farben.add([farbattribut.getX(i), farbattribut.getY(i), farbattribut.getZ(i)]
      .map((wert) => wert.toFixed(4)).join(':'));
  }
  assert.ok(farben.size >= 9, asset.id + ': Materialtrennung zu schwach');
  }
  assert.ok(geo.index && geo.index.count > 0, asset.id + ': Index fehlt');
  assert.ok(geo.index.count / 3 < 9000, asset.id + ': Dreiecksbudget ueberschritten');
  for (let i = 0; i < geo.index.count; i++) {
    const wert = geo.index.array[i];
    assert.ok(Number.isInteger(wert) && wert >= 0 && wert < position.count,
      asset.id + ': ungueltiger Index ' + wert);
  }
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  const b = geo.boundingBox;
  const breite = b.max.x - b.min.x;
  const hoehe = b.max.y - b.min.y;
  const laenge = b.max.z - b.min.z;
  assert.ok(breite >= 4.5, asset.id + ': Silhouette zu schmal');
  assert.ok(hoehe >= 4.0, asset.id + ': Silhouette zu flach');
  assert.ok(laenge >= (asset.typ === 'luftzug' ? 10 : 8),
    asset.id + ': Silhouette zu kurz');
  assert.ok(b.min.y < 0.65, asset.id + ': glaubwuerdiger Maschinenunterbau fehlt');
  assert.ok(Number.isFinite(geo.boundingSphere.radius) && geo.boundingSphere.radius > 4);
  assert.equal(geo.userData.steampunkFraktion, asset.fraktion);
  assert.equal(geo.userData.steampunkTyp, asset.typ);
  assert.equal(geo.userData.steampunkArtPass, 'final-hart');
  assert.equal(geo.userData.steampunkMaterialZonen, 10);
  assert.ok(geo.userData.steampunkTeile >= 70, asset.id + ': zu wenige Formbauteile');
}

test('Steampunk-Luftflotte - fixiert fuenf Fraktionen und zehn Pool-IDs', () => {
  assert.deepEqual(Object.keys(FLOTTE).sort(), [
    'STEAMPUNK_FRAKTIONEN',
    'STEAMPUNK_LUFTFLOTTEN_ASSETS',
    'STEAMPUNK_LUFTFLOTTEN_NAMEN',
    'erstelleSteampunkLuftfahrzeug',
    'registriereSteampunkLuftflotte',
    'steampunkLuftflottePoolOptionen'
  ].sort());
  assert.equal(Object.isFrozen(FLOTTE.STEAMPUNK_FRAKTIONEN), true);
  assert.equal(Object.isFrozen(FLOTTE.STEAMPUNK_LUFTFLOTTEN_ASSETS), true);
  assert.equal(Object.isFrozen(FLOTTE.STEAMPUNK_LUFTFLOTTEN_NAMEN), true);
  assert.deepEqual(FLOTTE.STEAMPUNK_FRAKTIONEN.map((f) => f.id), FRAKTIONEN);
  assert.deepEqual(FLOTTE.STEAMPUNK_LUFTFLOTTEN_NAMEN, NAMEN);
  assert.equal(new Set(FLOTTE.STEAMPUNK_LUFTFLOTTEN_NAMEN).size, 10);
  for (const fraktion of FLOTTE.STEAMPUNK_FRAKTIONEN) {
    assert.ok(Object.isFrozen(fraktion));
    assert.ok(Object.isFrozen(fraktion.palette));
  }
  for (let i = 0; i < FLOTTE.STEAMPUNK_LUFTFLOTTEN_ASSETS.length; i++) {
    const asset = FLOTTE.STEAMPUNK_LUFTFLOTTEN_ASSETS[i];
    assert.equal(asset.id, NAMEN[i]);
    assert.equal(asset.fraktion, FRAKTIONEN[Math.floor(i / 2)]);
    assert.equal(asset.typ, i % 2 ? 'luftzug' : 'luftschiff');
  }
});

test('Steampunk-Luftflotte - Import ist vom globalen Poolvertrag entkoppelt', () => {
  const datei = path.join(SRC, 'assets', 'steampunk-luftflotte.js');
  const quelle = fs.readFileSync(datei, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(quelle, /\bterraDefinePool\s*\(/);
});

test('Steampunk-Luftflotte - alle Varianten sind vollstaendig und deterministisch', () => {
  const hashes = new Set();
  for (const asset of FLOTTE.STEAMPUNK_LUFTFLOTTEN_ASSETS) {
    const a = FLOTTE.erstelleSteampunkLuftfahrzeug(asset.id);
    const b = FLOTTE.erstelleSteampunkLuftfahrzeug(asset);
    pruefeGeometrie(asset, a);
    pruefeGeometrie(asset, b);
    const hash = signatur(a);
    assert.equal(hash, signatur(b), asset.id + ': nicht deterministisch');
    assert.equal(hashes.has(hash), false, asset.id + ': keine eigene Geometrie');
    hashes.add(hash);
  }
  assert.equal(hashes.size, 10);
});

test('Steampunk-Luftflotte - Fraktionen besitzen unterscheidbare harte Silhouetten', () => {
  const profile = new Set();
  for (const fraktion of FRAKTIONEN) {
    const geo = FLOTTE.erstelleSteampunkLuftfahrzeug('luftschiff_' + fraktion);
    geo.computeBoundingBox();
    const b = geo.boundingBox;
    profile.add([
      (b.max.x - b.min.x).toFixed(3),
      (b.max.y - b.min.y).toFixed(3),
      (b.max.z - b.min.z).toFixed(3),
      geo.userData.steampunkTeile
    ].join(':'));
  }
  assert.equal(profile.size, 5,
    'Fraktionsschiffe unterscheiden sich nicht in Silhouette/Komplexitaet');
});

test('Steampunk-Luftflotte - Registry-API liefert zehn abgedeckte Pools', () => {
  const eintraege = [];
  const registriert = FLOTTE.registriereSteampunkLuftflotte((id, geo, opts) => {
    eintraege.push({ id, geo, opts });
  });
  assert.deepEqual(registriert, NAMEN);
  assert.equal(eintraege.length, 10);
  for (const eintrag of eintraege) {
    const asset = FLOTTE.STEAMPUNK_LUFTFLOTTEN_ASSETS.find((a) => a.id === eintrag.id);
    assert.ok(asset);
    assert.equal(eintrag.opts.familie, 'metall');
    assert.ok(eintrag.opts.ao >= 0.16 && eintrag.opts.ao <= 0.24);
    assert.equal(eintrag.opts.sichtbarBis, 120);
    const position = eintrag.geo.attributes.position;
    let maxQuadrat = 0;
    for (let i = 0; i < position.count; i++) {
      const quadrat = position.getX(i) ** 2 + position.getZ(i) ** 2;
      if (quadrat > maxQuadrat) maxQuadrat = quadrat;
    }
    assert.ok(eintrag.opts.radius >= Math.sqrt(maxQuadrat) * 1.079,
      eintrag.id + ': Kollisionsradius deckt die Form nicht ab');
  }
  assert.throws(() => FLOTTE.registriereSteampunkLuftflotte({}),
    /definePool-Funktion fehlt/);
  assert.throws(() => FLOTTE.erstelleSteampunkLuftfahrzeug('luftschiff_unbekannt'),
    /Unbekanntes Steampunk-Luftfahrzeug/);
});

test('Steampunk-Luftflotte - bleibt deterministisch und frei von Renderobjekten', () => {
  const datei = path.join(SRC, 'assets', 'steampunk-luftflotte.js');
  const quelle = fs.readFileSync(datei, 'utf8');
  const ohneKommentare = quelle
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(ohneKommentare, /\bMath\s*\.\s*random\b/);
  assert.doesNotMatch(ohneKommentare, /\bDate\s*(?:\.|\()/);
  assert.doesNotMatch(quelle, /\bInstancedMesh\s*\(/);
  assert.doesNotMatch(quelle, /\b(?:Mesh|Material)\s*\(/);
  assert.ok(quelle.split(/\r?\n/).length < 700, 'Quelldatei ueberschreitet 700 Zeilen');
  assert.ok(fs.readFileSync(new URL(import.meta.url), 'utf8').split(/\r?\n/).length < 700,
    'Testdatei ueberschreitet 700 Zeilen');
});
