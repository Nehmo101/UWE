/* ==========================================================================
   Architektur-Details

   Die Veredelung wird getrennt von den 216 Grundgeometrien geprueft. Der
   Vertrag: alle zwoelf Stile liefern reproduzierbare, vollstaendige und
   sichtbar unterschiedliche BufferGeometry-Parts, ohne Uhr oder Zufall.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ladeTerra, SRC } from './hilfen/laden.mjs';

const KATALOG = await ladeTerra('assets/architektur-katalog.js');
const HILFEN = await ladeTerra('assets/geometrie-hilfen.js');
const DETAILS = await ladeTerra('assets/architektur-details.js');

const PFLICHT_ATTRIBUTE = Object.freeze({
  position: 3,
  normal: 3,
  color: 3,
  uv: 2
});

const VARIANTE = KATALOG.ARCHITEKTUR_VARIANTEN.find((eintrag) =>
  eintrag.id === 'palast');
const VARIANTEN_INDEX = KATALOG.ARCHITEKTUR_VARIANTEN.indexOf(VARIANTE);

function bytes(array) {
  return Buffer.from(array.buffer, array.byteOffset, array.byteLength);
}

function alleEndlich(array) {
  for (let i = 0; i < array.length; i++) {
    if (!Number.isFinite(array[i])) return false;
  }
  return true;
}

function farbenFuer(stil) {
  return Object.freeze({
    wand: stil.palette.wand,
    wandDunkel: HILFEN.farbton(stil.palette.wand, 0.74),
    dach: stil.palette.dach,
    akzent: stil.palette.akzent,
    holz: stil.palette.holz,
    fenster: stil.palette.fenster
  });
}

function masseFuer(stilIndex) {
  return Object.freeze({
    w: 7.2,
    d: 5.4,
    h: 6.8,
    spitze: 8.9,
    stilIndex,
    variantenIndex: VARIANTEN_INDEX
  });
}

function erzeugeDetails(stil, stilIndex) {
  const parts = [];
  const ergebnis = DETAILS.veredleArchitektur(
    parts,
    stil,
    VARIANTE,
    farbenFuer(stil),
    masseFuer(stilIndex)
  );
  assert.strictEqual(ergebnis, parts,
    stil.id + ': veredleArchitektur muss dasselbe Array zurueckgeben');
  assert.ok(parts.length > 0, stil.id + ': keine Detail-Parts erzeugt');
  return parts;
}

function pruefePart(geo, kontext) {
  assert.ok(geo && geo.isBufferGeometry && geo.attributes,
    kontext + ': kein BufferGeometry-Part');

  const positionen = geo.attributes.position;
  assert.ok(positionen && positionen.count > 0,
    kontext + ': leeres oder fehlendes position-Attribut');

  for (const [name, itemSize] of Object.entries(PFLICHT_ATTRIBUTE)) {
    const attribut = geo.attributes[name];
    assert.ok(attribut, kontext + ': Attribut ' + name + ' fehlt');
    assert.equal(attribut.itemSize, itemSize,
      kontext + ': falsche Komponentenanzahl fuer ' + name);
    assert.equal(attribut.count, positionen.count,
      kontext + ': Vertexzahl von ' + name + ' weicht ab');
    assert.ok(alleEndlich(attribut.array),
      kontext + ': ' + name + ' enthaelt NaN oder Infinity');
  }

  if (geo.index) {
    assert.ok(geo.index.count > 0, kontext + ': leerer Index');
    for (let i = 0; i < geo.index.array.length; i++) {
      const wert = geo.index.array[i];
      assert.ok(Number.isInteger(wert) && wert >= 0 && wert < positionen.count,
        kontext + ': ungueltiger Index ' + wert);
    }
  }

  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  const box = geo.boundingBox;
  const kugel = geo.boundingSphere;
  for (const [name, wert] of [
    ['box.min.x', box.min.x], ['box.min.y', box.min.y], ['box.min.z', box.min.z],
    ['box.max.x', box.max.x], ['box.max.y', box.max.y], ['box.max.z', box.max.z],
    ['sphere.center.x', kugel.center.x],
    ['sphere.center.y', kugel.center.y],
    ['sphere.center.z', kugel.center.z],
    ['sphere.radius', kugel.radius]
  ]) {
    assert.ok(Number.isFinite(wert), kontext + ': ' + name + ' ist nicht endlich');
  }
  assert.ok(kugel.radius > 0, kontext + ': transformierter Part ist entartet');

  let normaleVorhanden = false;
  const normalen = geo.attributes.normal.array;
  for (let i = 0; i < normalen.length; i += 3) {
    const laenge2 = normalen[i] * normalen[i]
      + normalen[i + 1] * normalen[i + 1]
      + normalen[i + 2] * normalen[i + 2];
    if (laenge2 > 1e-12) { normaleVorhanden = true; break; }
  }
  assert.ok(normaleVorhanden, kontext + ': nur Nullnormalen');
}

function signatur(parts, attribute) {
  const hash = createHash('sha256');
  hash.update('parts:' + parts.length + ';');
  for (let i = 0; i < parts.length; i++) {
    const geo = parts[i];
    hash.update('part:' + i + ';');
    for (const name of attribute) {
      const attr = geo.attributes[name];
      hash.update(name + ':' + attr.itemSize + ':' + attr.count + ':');
      hash.update(bytes(attr.array));
    }
    hash.update('#index:');
    if (geo.index) hash.update(bytes(geo.index.array));
  }
  return hash.digest('hex');
}

test('Architektur-Details - exportieren den stabilen Funktionsvertrag', () => {
  assert.deepEqual(Object.keys(DETAILS).sort(), ['veredleArchitektur']);
  assert.equal(typeof DETAILS.veredleArchitektur, 'function');
  assert.ok(VARIANTE, 'Testvariante palast fehlt im Architektur-Katalog');
  assert.ok(VARIANTEN_INDEX >= 0);
  assert.equal(KATALOG.ARCHITEKTUR_STILE.length, 12);
});

test('Architektur-Details - alle 12 Stile sind deterministisch und vollstaendig', () => {
  const detailSignaturen = [];
  const formSignaturen = [];

  for (let stilIndex = 0; stilIndex < KATALOG.ARCHITEKTUR_STILE.length; stilIndex++) {
    const stil = KATALOG.ARCHITEKTUR_STILE[stilIndex];
    const ersterLauf = erzeugeDetails(stil, stilIndex);
    const zweiterLauf = erzeugeDetails(stil, stilIndex);

    for (let i = 0; i < ersterLauf.length; i++) {
      pruefePart(ersterLauf[i], stil.id + ' Part ' + i);
    }

    const detailA = signatur(ersterLauf, ['position', 'normal', 'color', 'uv']);
    const detailB = signatur(zweiterLauf, ['position', 'normal', 'color', 'uv']);
    const formA = signatur(ersterLauf, ['position']);
    const formB = signatur(zweiterLauf, ['position']);
    assert.equal(detailA, detailB,
      stil.id + ': vollstaendige Details sind nicht deterministisch');
    assert.equal(formA, formB,
      stil.id + ': Geometrieform ist nicht deterministisch');
    detailSignaturen.push(detailA);
    formSignaturen.push(formA);
  }

  assert.equal(new Set(detailSignaturen).size, 12,
    'Alle Stile brauchen sichtbar unterschiedliche Detail-Signaturen');
  assert.equal(new Set(formSignaturen).size, 12,
    'Stile duerfen sich nicht nur durch ihre Farben unterscheiden');
});

test('Architektur-Details - verwenden weder Math.random noch Date', () => {
  const quelle = fs.readFileSync(path.join(SRC, 'assets', 'architektur-details.js'), 'utf8');
  const ohneKommentare = quelle
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(ohneKommentare, /\bMath\s*\.\s*random\b/);
  assert.doesNotMatch(ohneKommentare, /\bDate\s*(?:\.|\()/);

  const originalRandom = Math.random;
  const OriginalDate = globalThis.Date;
  let randomAufrufe = 0;
  let dateAufrufe = 0;
  Math.random = () => { randomAufrufe++; return 0.5; };
  globalThis.Date = new Proxy(OriginalDate, {
    apply(ziel, dies, args) {
      dateAufrufe++;
      return Reflect.apply(ziel, dies, args);
    },
    construct(ziel, args, neu) {
      dateAufrufe++;
      return Reflect.construct(ziel, args, neu);
    },
    get(ziel, eigenschaft, empfaenger) {
      if (eigenschaft === 'now') {
        return () => { dateAufrufe++; return 123456789; };
      }
      return Reflect.get(ziel, eigenschaft, empfaenger);
    }
  });
  try {
    for (let i = 0; i < KATALOG.ARCHITEKTUR_STILE.length; i++) {
      erzeugeDetails(KATALOG.ARCHITEKTUR_STILE[i], i);
    }
  } finally {
    Math.random = originalRandom;
    globalThis.Date = OriginalDate;
  }
  assert.equal(randomAufrufe, 0, 'veredleArchitektur hat Math.random aufgerufen');
  assert.equal(dateAufrufe, 0, 'veredleArchitektur hat Date verwendet');
});
