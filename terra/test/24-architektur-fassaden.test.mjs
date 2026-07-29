/* ==========================================================================
   Architektur-Fassaden

   Fassaden sind eine eigene Geometrieschicht. Dieser Test prueft alle
   Kulturstile gegen jede Rollenfamilie und trennt Formsignaturen bewusst von
   Farben: zwoelf Paletten allein reichen nicht als zwoelf Fassadenstile.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ladeTerra, SRC } from './hilfen/laden.mjs';

const KATALOG = await ladeTerra('assets/architektur-katalog.js');
const HILFEN = await ladeTerra('assets/geometrie-hilfen.js');
const FASSADEN = await ladeTerra('assets/architektur-fassaden.js');

const PFLICHT_ATTRIBUTE = Object.freeze({
  position: 3,
  normal: 3,
  color: 3,
  uv: 2
});

const ROLLEN_VARIANTEN = Object.freeze({
  wohnen: 'wohnhaus',
  gemeinschaft: 'rathaus',
  handwerk: 'werkstatt',
  wissen: 'bibliothek',
  sakral: 'tempel',
  wehr: 'wehrturm',
  herrschaft: 'palast',
  infrastruktur: 'bruecke'
});

const ROLLEN = Object.freeze(Object.entries(ROLLEN_VARIANTEN).map(([gruppe, id]) => {
  const variante = KATALOG.ARCHITEKTUR_VARIANTEN.find((eintrag) => eintrag.id === id);
  return Object.freeze({
    gruppe,
    variante,
    variantenIndex: KATALOG.ARCHITEKTUR_VARIANTEN.indexOf(variante)
  });
}));

const WOHNHAUS = KATALOG.ARCHITEKTUR_VARIANTEN.find((eintrag) =>
  eintrag.id === 'wohnhaus');
const WOHNHAUS_INDEX = KATALOG.ARCHITEKTUR_VARIANTEN.indexOf(WOHNHAUS);

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

function masseFuer(stilIndex, variantenIndex, etagen) {
  return Object.freeze({
    w: 7.2,
    d: 5.4,
    h: 6.8,
    spitze: 8.9,
    stilIndex,
    variantenIndex,
    etagen
  });
}

function erzeugeFassade(stil, stilIndex, variante, variantenIndex, etagen) {
  const parts = [];
  const ergebnis = FASSADEN.gestalteArchitekturFassade(
    parts,
    stil,
    variante,
    farbenFuer(stil),
    masseFuer(stilIndex, variantenIndex, etagen)
  );
  assert.strictEqual(ergebnis, parts,
    stil.id + '/' + variante.id + ': Fassadengestalter muss dasselbe Array zurueckgeben');
  assert.ok(parts.length > 0,
    stil.id + '/' + variante.id + ': keine Fassaden-Parts erzeugt');
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
      const attribut = geo.attributes[name];
      hash.update(name + ':' + attribut.itemSize + ':' + attribut.count + ':');
      hash.update(bytes(attribut.array));
    }
    hash.update('#index:');
    if (geo.index) hash.update(bytes(geo.index.array));
  }
  return hash.digest('hex');
}

function vertexAnzahl(parts) {
  return parts.reduce((summe, geo) => summe + geo.attributes.position.count, 0);
}

function geometrieGrenzen(parts) {
  const grenzen = { minY: Infinity, maxZ: -Infinity };
  for (const geo of parts) {
    const positionen = geo.attributes.position.array;
    for (let i = 0; i < positionen.length; i += 3) {
      grenzen.minY = Math.min(grenzen.minY, positionen[i + 1]);
      grenzen.maxZ = Math.max(grenzen.maxZ, positionen[i + 2]);
    }
  }
  return grenzen;
}

test('Architektur-Fassaden - exportieren API und decken alle acht Rollen ab', () => {
  assert.deepEqual(Object.keys(FASSADEN).sort(), ['gestalteArchitekturFassade']);
  assert.equal(typeof FASSADEN.gestalteArchitekturFassade, 'function');
  assert.equal(KATALOG.ARCHITEKTUR_STILE.length, 12);
  assert.equal(ROLLEN.length, 8);
  assert.deepEqual(ROLLEN.map((rolle) => rolle.gruppe).sort(),
    Object.keys(KATALOG.ARCHITEKTUR_GRUPPEN).sort());
  for (const rolle of ROLLEN) {
    assert.ok(rolle.variante, rolle.gruppe + ': repraesentative Variante fehlt');
    assert.equal(rolle.variante.gruppe, rolle.gruppe,
      rolle.variante.id + ': Variante gehoert zur falschen Rolle');
    assert.ok(rolle.variantenIndex >= 0);
  }
});

test('Architektur-Fassaden - 12 Stile mal 8 Rollen sind deterministisch und endlich', () => {
  for (let stilIndex = 0; stilIndex < KATALOG.ARCHITEKTUR_STILE.length; stilIndex++) {
    const stil = KATALOG.ARCHITEKTUR_STILE[stilIndex];
    for (const rolle of ROLLEN) {
      const etagen = Math.max(1, rolle.variante.etagen);
      const ersterLauf = erzeugeFassade(stil, stilIndex, rolle.variante,
        rolle.variantenIndex, etagen);
      const zweiterLauf = erzeugeFassade(stil, stilIndex, rolle.variante,
        rolle.variantenIndex, etagen);

      const kontext = stil.id + '/' + rolle.variante.id;
      assert.equal(signatur(ersterLauf, ['position', 'normal', 'color', 'uv']),
        signatur(zweiterLauf, ['position', 'normal', 'color', 'uv']),
        kontext + ': Fassade ist nicht deterministisch');
      for (let i = 0; i < ersterLauf.length; i++) {
        pruefePart(ersterLauf[i], kontext + ' Part ' + i);
      }
    }
  }
});

test('Architektur-Fassaden - 12 Formsprachen und Etagenwachstum sind sichtbar', () => {
  const formSignaturen = [];
  for (let stilIndex = 0; stilIndex < KATALOG.ARCHITEKTUR_STILE.length; stilIndex++) {
    const stil = KATALOG.ARCHITEKTUR_STILE[stilIndex];
    const nachEtagen = [1, 2, 3, 4].map((etagen) =>
      erzeugeFassade(stil, stilIndex, WOHNHAUS, WOHNHAUS_INDEX, etagen));
    const partZahlen = nachEtagen.map((parts) => parts.length);
    const vertexZahlen = nachEtagen.map(vertexAnzahl);

    assert.ok(partZahlen[0] < partZahlen[1] && partZahlen[1] < partZahlen[2],
      stil.id + ': Fenster-/Rahmen-Parts wachsen nicht mit Etagen 1-3');
    assert.ok(vertexZahlen[0] < vertexZahlen[1] && vertexZahlen[1] < vertexZahlen[2],
      stil.id + ': Fassaden-Vertices wachsen nicht mit Etagen 1-3');
    assert.equal(partZahlen[2], partZahlen[3],
      stil.id + ': Fassadenraster soll ab drei Etagen saturieren');
    assert.equal(signatur(nachEtagen[2], ['position']),
      signatur(nachEtagen[3], ['position']),
      stil.id + ': Etage vier darf das gesaettigte Raster nicht veraendern');

    formSignaturen.push(signatur(nachEtagen[2], ['position']));
  }
  assert.equal(new Set(formSignaturen).size, 12,
    'Alle zwoelf Stile brauchen eine eigene Formsignatur ohne Farbunterschiede');
});

test('Architektur-Fassaden - offene Profile tragen nur verankerte Kulturzeichen', () => {
  const offeneProfile = [
    ['halle', 0.39], ['schrein', 0.53], ['tor', 0.46],
    ['bruecke', 0.90], ['pavillon', 0.38]
  ];
  for (let stilIndex = 0; stilIndex < KATALOG.ARCHITEKTUR_STILE.length; stilIndex++) {
    const stil = KATALOG.ARCHITEKTUR_STILE[stilIndex];
    for (const [profil, mindestHoehe] of offeneProfile) {
      const variante = KATALOG.ARCHITEKTUR_VARIANTEN.find((v) => v.profil === profil);
      const variantenIndex = KATALOG.ARCHITEKTUR_VARIANTEN.indexOf(variante);
      const parts = erzeugeFassade(stil, stilIndex, variante, variantenIndex,
        Math.max(1, variante.etagen));
      const grenzen = geometrieGrenzen(parts);
      assert.ok(grenzen.minY >= 6.8 * mindestHoehe,
        stil.id + '/' + variante.id + ': frei schwebendes Fenster oder Bodenportal');
    }

    const tempel = KATALOG.ARCHITEKTUR_VARIANTEN.find((v) => v.profil === 'tempel');
    const tempelIndex = KATALOG.ARCHITEKTUR_VARIANTEN.indexOf(tempel);
    const tempelGrenzen = geometrieGrenzen(erzeugeFassade(
      stil, stilIndex, tempel, tempelIndex, Math.max(1, tempel.etagen)));
    assert.ok(tempelGrenzen.maxZ <= 5.4 * 0.34,
      stil.id + '/tempel: Fassade liegt vor dem zurueckgesetzten Tempelkern');
  }
});
test('Architektur-Fassaden - verwenden weder Math.random noch Date', () => {
  const quelle = fs.readFileSync(path.join(SRC, 'assets', 'architektur-fassaden.js'), 'utf8');
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
    for (let stilIndex = 0; stilIndex < KATALOG.ARCHITEKTUR_STILE.length; stilIndex++) {
      for (const rolle of ROLLEN) {
        erzeugeFassade(KATALOG.ARCHITEKTUR_STILE[stilIndex], stilIndex,
          rolle.variante, rolle.variantenIndex, Math.max(1, rolle.variante.etagen));
      }
    }
  } finally {
    Math.random = originalRandom;
    globalThis.Date = OriginalDate;
  }
  assert.equal(randomAufrufe, 0,
    'gestalteArchitekturFassade hat Math.random aufgerufen');
  assert.equal(dateAufrufe, 0,
    'gestalteArchitekturFassade hat Date verwendet');
});
