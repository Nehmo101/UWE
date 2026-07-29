/* ==========================================================================
   Umwelt-Geometriepass

   Der Pass hebt die schwächeren Bestandsassets an, ohne neue Poolkennungen
   oder Renderobjekte einzuführen. Geprüft werden alle Kategorien, die
   deterministische Einzelgeometrie und der opake UV-Anker der Baumwurzeln.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ladeTerra, SRC } from './hilfen/laden.mjs';

const THREE = await import('three');
const UMWELT = await ladeTerra('assets/umwelt-geometrie.js');

const GRUPPEN = Object.freeze({
  baum: ['baum', 'baum2', 'nadelbaum', 'zypresse', 'sumpfbaum', 'bluetenbaum', 'obstbaum'],
  bodendecker: ['busch', 'gras', 'blume', 'farn', 'moos'],
  fels: ['fels', 'findling', 'geroell', 'felsnadel', 'basaltsaeulen', 'eisfels'],
  feld: ['feldreihe', 'ackerscholle'],
  zaun: ['pfosten', 'lattenzaun', 'palisade', 'pferch'],
  ufer: ['steg', 'anleger', 'kaimauer', 'kaitreppe', 'uferdamm', 'moorsteg'],
  gebaeude: ['haus', 'hausA', 'hausB', 'hausC', 'haus2', 'scheune', 'villa',
    'langhaus', 'grubenhaus', 'turmhaus', 'giebelhaus', 'laubenhaus']
});

function basisGeometrie() {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const n = geo.attributes.position.count;
  const farben = new Float32Array(n * 3);
  farben.fill(0.72);
  geo.setAttribute('color', new THREE.BufferAttribute(farben, 3));
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (!geo.attributes.uv) {
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
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

function pruefeGeometrie(geo, name, basisVertices) {
  assert.ok(geo && geo.isBufferGeometry, name + ': kein BufferGeometry-Ergebnis');
  const position = geo.attributes.position;
  assert.ok(position.count > basisVertices, name + ': keine Detailvertices hinzugefügt');
  for (const [attrName, itemSize] of Object.entries({
    position: 3, normal: 3, color: 3, uv: 2
  })) {
    const attr = geo.attributes[attrName];
    assert.ok(attr, name + ': Attribut ' + attrName + ' fehlt');
    assert.equal(attr.itemSize, itemSize, name + ': falsches itemSize für ' + attrName);
    assert.equal(attr.count, position.count, name + ': Vertexzahl von ' + attrName + ' weicht ab');
    assert.ok(alleEndlich(attr.array), name + ': ' + attrName + ' enthält NaN/Infinity');
  }
  assert.ok(geo.index && geo.index.count > 0, name + ': Index fehlt');
  for (let i = 0; i < geo.index.array.length; i++) {
    const wert = geo.index.array[i];
    assert.ok(Number.isInteger(wert) && wert >= 0 && wert < position.count,
      name + ': ungültiger Index ' + wert);
  }
  assert.ok(position.count < basisVertices + 900,
    name + ': Detailbudget überschritten (' + position.count + ' Vertices)');
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  assert.ok(Number.isFinite(geo.boundingSphere.radius) && geo.boundingSphere.radius > 0,
    name + ': ungültige Hüllkugel');
  assert.ok(geo.boundingBox.min.y <= 0.01,
    name + ': Details verlieren den Kontakt zur Grundebene');
}

test('Umwelt-Geometrie - erfasst 42 eindeutige Pools in sieben Bestandsgruppen', () => {
  assert.deepEqual(Object.keys(UMWELT).sort(),
    ['UMWELT_VERFEINERTE_POOLS', 'veredleUmweltGeometrie']);
  const erwartet = Object.values(GRUPPEN).flat();
  assert.equal(erwartet.length, 42);
  assert.equal(new Set(erwartet).size, 42);
  assert.deepEqual([...UMWELT.UMWELT_VERFEINERTE_POOLS].sort(), erwartet.sort());
});

test('Umwelt-Geometrie - alle Pools liefern eine deterministische, vollständige Einzelgeometrie', () => {
  const signaturen = [];
  for (const name of UMWELT.UMWELT_VERFEINERTE_POOLS) {
    const basisA = basisGeometrie();
    const basisB = basisGeometrie();
    const a = UMWELT.veredleUmweltGeometrie(name, basisA);
    const b = UMWELT.veredleUmweltGeometrie(name, basisB);
    assert.notStrictEqual(a, basisA, name + ': bekannte Kennung wurde nur durchgereicht');
    assert.notStrictEqual(b, basisB, name + ': zweiter Lauf wurde nur durchgereicht');
    pruefeGeometrie(a, name, basisA.attributes.position.count);
    assert.equal(signatur(a), signatur(b), name + ': Ausgabe ist nicht deterministisch');
    signaturen.push(signatur(a));
  }
  assert.ok(new Set(signaturen).size >= 32,
    'Detailgruppen unterscheiden sich geometrisch/farblich nicht ausreichend');
});

test('Umwelt-Geometrie - haeufige Instanzpools bleiben im schlanken Detailbudget', () => {
  for (const name of GRUPPEN.baum) {
    const basis = basisGeometrie();
    const geo = UMWELT.veredleUmweltGeometrie(name, basis);
    assert.ok(geo.attributes.position.count <= basis.attributes.position.count + 30,
      name + ': Wurzelkontakt ist fuer einen Instanzpool zu teuer');
  }
  for (const name of GRUPPEN.bodendecker) {
    const basis = basisGeometrie();
    const geo = UMWELT.veredleUmweltGeometrie(name, basis);
    assert.ok(geo.attributes.position.count <= basis.attributes.position.count * 2,
      name + ': Bodenhorst dupliziert die Basis mehr als einmal');
  }
});

test('Umwelt-Geometrie - Baumwurzeln bleiben im opaken, windstillen Texturanker', () => {
  for (const name of GRUPPEN.baum) {
    const basis = basisGeometrie();
    const basisVertices = basis.attributes.position.count;
    const geo = UMWELT.veredleUmweltGeometrie(name, basis);
    const uv = geo.attributes.uv;
    for (let i = basisVertices; i < uv.count; i++) {
      assert.equal(uv.getX(i), 0.5, name + ': Wurzel-u verlässt den opaken Anker');
      assert.ok(Math.abs(uv.getY(i) - 0.008) < 1e-7,
        name + ': Wurzel-v verlässt den opaken/windstillen Anker');
    }
  }
});

test('Umwelt-Geometrie - unbekannte IDs und damit Kartenzeichen bleiben identisch', () => {
  const geo = basisGeometrie();
  const vorher = signatur(geo);
  assert.strictEqual(UMWELT.veredleUmweltGeometrie('karte_ort', geo), geo);
  assert.strictEqual(UMWELT.veredleUmweltGeometrie('arch_nebelhain_palast', geo), geo);
  assert.equal(signatur(geo), vorher);
});

test('Umwelt-Geometrie - verwendet weder Zufall/Uhr noch zusätzliche Pool-Registrierungen', () => {
  const quelle = fs.readFileSync(path.join(SRC, 'assets', 'umwelt-geometrie.js'), 'utf8');
  const generator = fs.readFileSync(path.join(SRC, 'generators', 'geometry.js'), 'utf8');
  const ohneKommentare = quelle
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(ohneKommentare, /\bMath\s*\.\s*random\b/);
  assert.doesNotMatch(ohneKommentare, /\bDate\s*(?:\.|\()/);
  const veredelung = generator.indexOf('geo = veredleUmweltGeometrie(name, geo)');
  const registry = generator.indexOf('poolDefinieren(name, geo, opts)');
  assert.ok(veredelung >= 0 && veredelung < registry,
    'Umweltveredelung muss vor den weiteren Paessen und der Registry liegen');
  assert.doesNotMatch(quelle, /\bdefinePool\s*\(/);
  assert.doesNotMatch(quelle, /\bInstancedMesh\s*\(/);
});
