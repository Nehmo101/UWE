/* ==========================================================================
   Bestandsbau-Veredelung

   Dieser Vertrag fixiert den vollstaendigen, disjunkten Umfang des Passes und
   prueft, dass jeder Pool eine eigene, deterministische Einzelgeometrie mit
   vollstaendigen Attributen und kleinem Dreiecksbudget erhaelt.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ladeTerra, SRC } from './hilfen/laden.mjs';

const THREE = await import('three');
const BAU = await ladeTerra('assets/bestand-bau-veredelung.js');
const UMWELT = await ladeTerra('assets/umwelt-geometrie.js');
const ARCHITEKTUR = await ladeTerra('assets/architektur-katalog.js');
const KATALOG = await ladeTerra('assets/bestand-katalog-veredelung.js');

const GRUPPEN = Object.freeze({
  kultur: [
    'turm', 'kuppel', 'arkade', 'windmuehle', 'tholos', 'tempel', 'bogen',
    'saeule', 'zwergenhalle', 'schmiedeturm', 'zwergentor', 'mauer',
    'elfenturm', 'pavillon', 'industrie', 'kran'
  ],
  begleiter: [
    'rankenblatt', 'stammliegend', 'fass', 'kiste', 'karren', 'brunnen',
    'laterne', 'heuhaufen', 'marktstand', 'boot', 'fensterlicht', 'pechnase',
    'zugbruecke', 'burgpalas', 'burgkapelle', 'burgkueche', 'schlossfluegel',
    'schlossturmhaube', 'schlossportal', 'aquaedukt', 'aquaeduktkopf',
    'stumpf'
  ],
  wehr: [
    'mauerstueck', 'mauerecke', 'mauerdurchlass', 'mauerbogen', 'zwingermauer',
    'mauertreppe', 'schildmauer', 'wehrturm', 'geschuetzturm', 'bergfried',
    'torhaus', 'barbakane', 'bastion', 'kettenturm', 'wappenstein',
    'wehrbanner', 'palisadentor', 'wachturm'
  ],
  hafen: [
    'fischerboot', 'kutter', 'floss', 'boje', 'bake', 'kogge', 'dreimaster',
    'ruderschiff', 'wrack', 'holzbruecke', 'steinbruecke', 'tauhaufen',
    'reusenstapel', 'netzgestell', 'fischtrockner', 'hafenlaterne', 'bootshaus',
    'kaikran', 'leuchtfeuer', 'slipbahn', 'salzgarten', 'werfthalle', 'helling',
    'leuchtturm', 'kanalschleuse'
  ]
});
const ERWARTET = Object.freeze(Object.values(GRUPPEN).flat());

function basisGeometrie() {
  const geo = new THREE.BoxGeometry(2, 2, 2);
  const n = geo.attributes.position.count;
  const farben = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    farben[i * 3] = 0.62 + (i % 3) * 0.035;
    farben[i * 3 + 1] = 0.55 + (i % 5) * 0.025;
    farben[i * 3 + 2] = 0.43 + (i % 2) * 0.04;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(farben, 3));
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

function endlich(array) {
  for (let i = 0; i < array.length; i++) {
    if (!Number.isFinite(array[i])) return false;
  }
  return true;
}

function dreiecke(geo) {
  return (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
}

function pruefeGeometrie(name, basis, geo) {
  assert.ok(geo && geo.isBufferGeometry, name + ': Ergebnis ist keine BufferGeometry');
  assert.notStrictEqual(geo, basis, name + ': bekannte Kennung wurde durchgereicht');
  const position = geo.attributes.position;
  assert.ok(position.count > basis.attributes.position.count,
    name + ': keine sichtbaren Details hinzugefuegt');
  for (const [attrName, itemSize] of Object.entries({
    position: 3, normal: 3, color: 3, uv: 2
  })) {
    const attr = geo.attributes[attrName];
    assert.ok(attr, name + ': Attribut ' + attrName + ' fehlt');
    assert.equal(attr.itemSize, itemSize, name + ': falsches itemSize bei ' + attrName);
    assert.equal(attr.count, position.count, name + ': Attributlaenge weicht ab');
    assert.ok(endlich(attr.array), name + ': ' + attrName + ' enthaelt NaN/Infinity');
  }
  assert.ok(geo.index && geo.index.count > 0, name + ': Index fehlt');
  for (let i = 0; i < geo.index.count; i++) {
    const wert = geo.index.array[i];
    assert.ok(Number.isInteger(wert) && wert >= 0 && wert < position.count,
      name + ': ungueltiger Index ' + wert);
  }
  assert.ok(position.count <= basis.attributes.position.count + 700,
    name + ': Vertexbudget ueberschritten');
  assert.ok(dreiecke(geo) - dreiecke(basis) <= 520,
    name + ': Dreiecksbudget ueberschritten');
  basis.computeBoundingBox();
  geo.computeBoundingBox();
  assert.ok(geo.boundingBox.min.y <= basis.boundingBox.min.y + 0.08,
    name + ': kein glaubhafter Bodenkontakt');
  const silhouette = geo.boundingBox.min.x < basis.boundingBox.min.x - 0.01 ||
    geo.boundingBox.max.x > basis.boundingBox.max.x + 0.01 ||
    geo.boundingBox.min.y < basis.boundingBox.min.y - 0.01 ||
    geo.boundingBox.max.y > basis.boundingBox.max.y + 0.01 ||
    geo.boundingBox.min.z < basis.boundingBox.min.z - 0.01 ||
    geo.boundingBox.max.z > basis.boundingBox.max.z + 0.01;
  assert.ok(silhouette, name + ': Silhouette blieb unveraendert');
}

test('Bestandsbau - umfasst exakt 81 gefrorene Pools in vier Gruppen', () => {
  assert.deepEqual(Object.keys(BAU).sort(), [
    'BESTAND_BAU_FAMILIEN',
    'BESTAND_BAU_VERFEINERTE_POOLS',
    'veredleBestandBau'
  ]);
  assert.equal(Object.isFrozen(BAU.BESTAND_BAU_VERFEINERTE_POOLS), true);
  assert.equal(ERWARTET.length, 81);
  assert.equal(new Set(ERWARTET).size, 81);
  assert.deepEqual([...BAU.BESTAND_BAU_VERFEINERTE_POOLS].sort(),
    [...ERWARTET].sort());
});

test('Bestandsbau - bleibt disjunkt zu Architektur, Umwelt und Welle 3', () => {
  const bestand = new Set(BAU.BESTAND_BAU_VERFEINERTE_POOLS);
  for (const name of ARCHITEKTUR.ARCHITEKTUR_ASSET_NAMEN) {
    assert.equal(bestand.has(name), false, name + ': Architekturueberschneidung');
  }
  for (const name of UMWELT.UMWELT_VERFEINERTE_POOLS) {
    assert.equal(bestand.has(name), false, name + ': Umweltueberschneidung');
  }
  for (const name of KATALOG.BESTAND_KATALOG_VERFEINERTE_POOLS) {
    assert.equal(bestand.has(name), false, name + ': Welle-3-Ueberschneidung');
  }
});

test('Bestandsbau - alle 81 Pools sind vollstaendig, deterministisch und einzigartig', () => {
  const signaturen = new Set();
  for (const name of BAU.BESTAND_BAU_VERFEINERTE_POOLS) {
    const basisA = basisGeometrie();
    const basisB = basisGeometrie();
    const a = BAU.veredleBestandBau(name, basisA);
    const b = BAU.veredleBestandBau(name, basisB);
    pruefeGeometrie(name, basisA, a);
    pruefeGeometrie(name, basisB, b);
    const sigA = signatur(a);
    assert.equal(sigA, signatur(b), name + ': Ausgabe ist nicht deterministisch');
    assert.equal(signaturen.has(sigA), false, name + ': Geometrie ist nicht einzigartig');
    signaturen.add(sigA);
  }
  assert.equal(signaturen.size, 81);
});

test('Bestandsbau - unbekannte Kennungen bleiben referenzidentisch und unveraendert', () => {
  const geo = basisGeometrie();
  const vorher = signatur(geo);
  assert.strictEqual(BAU.veredleBestandBau('karte_ort', geo), geo);
  assert.strictEqual(BAU.veredleBestandBau('arch_mondelfen_palast', geo), geo);
  assert.strictEqual(BAU.veredleBestandBau('baum', geo), geo);
  assert.equal(signatur(geo), vorher);
});

test('Bestandsbau - arbeitet ohne Zufall, Uhr, neue Pools oder Renderobjekte', () => {
  const datei = path.join(SRC, 'assets', 'bestand-bau-veredelung.js');
  const quelle = fs.readFileSync(datei, 'utf8');
  const ohneKommentare = quelle
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(ohneKommentare, /\bMath\s*\.\s*random\b/);
  assert.doesNotMatch(ohneKommentare, /\bDate\s*(?:\.|\()/);
  assert.doesNotMatch(quelle, /\bdefinePool\s*\(/);
  assert.doesNotMatch(quelle, /\bInstancedMesh\s*\(/);
  assert.doesNotMatch(quelle, /\b(?:Mesh|Material)\s*\(/);
  assert.ok(quelle.split(/\r?\n/).length < 700, 'Quelldatei ueberschreitet 700 Zeilen');
  assert.ok(fs.readFileSync(new URL(import.meta.url), 'utf8').split(/\r?\n/).length < 700,
    'Testdatei ueberschreitet 700 Zeilen');
});
