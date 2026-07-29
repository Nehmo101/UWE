/* ==========================================================================
   End-to-End-Vertrag der vollstaendigen Asset-Modernisierung

   Die Einzeltests der fuenf Wellen pruefen Formqualitaet. Dieser Test beweist
   zusaetzlich, dass ihre Scopes gemeinsam die echte Runtime-Registry exakt
   abdecken und dass rebuild/genObjekt die 505er-Schau nicht wieder leert.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ladeTerra, SRC } from './hilfen/laden.mjs';
import { testWelt } from './hilfen/karte.mjs';

const welt = await testWelt({ seed: 4711, groesse: 512 });
const ARCH = await ladeTerra('assets/architektur-katalog.js');
const UMWELT = await ladeTerra('assets/umwelt-geometrie.js');
const BAU = await ladeTerra('assets/bestand-bau-veredelung.js');
const KATALOG = await ladeTerra('assets/bestand-katalog-veredelung.js');
const FLOTTE = await ladeTerra('assets/steampunk-luftflotte.js');
const INSELN = await ladeTerra('assets/luftinsel-assets.js');
const BAMBUS = await ladeTerra('assets/hochbambus-assets.js');
const SCHAU = await ladeTerra('generators/asset-schau.js');
const SCHAU_MESHES = await ladeTerra('generators/asset-schau-meshes.js');
const POOLS = welt.m.pools.POOLS;

const VERTRAEGE = Object.freeze([
  Object.freeze({ name: 'Architektur', soll: 216,
    ids: ARCH.ARCHITEKTUR_ASSET_NAMEN }),
  Object.freeze({ name: 'Umwelt', soll: 42,
    ids: UMWELT.UMWELT_VERFEINERTE_POOLS }),
  Object.freeze({ name: 'Bau/Wehr/Hafen', soll: 81,
    ids: BAU.BESTAND_BAU_VERFEINERTE_POOLS }),
  Object.freeze({ name: 'Welle-3-Katalog', soll: 149,
    ids: KATALOG.BESTAND_KATALOG_VERFEINERTE_POOLS }),
  Object.freeze({ name: 'Luftwelt/Hochbambus', soll: 17,
    ids: FLOTTE.STEAMPUNK_LUFTFLOTTEN_NAMEN.concat(
      Object.values(INSELN.LUFTINSEL_POOL_IDS),
      Object.values(BAMBUS.HOCHBAMBUS_POOL_IDS)) })
]);

test('Asset-Modernisierung - fuenf disjunkte Vertraege decken 505/505 Pools', () => {
  const physisch = Object.keys(POOLS).filter((name) => !name.startsWith('sig_')).sort();
  const union = new Set();
  for (const vertrag of VERTRAEGE) {
    assert.equal(vertrag.ids.length, vertrag.soll,
      vertrag.name + ': Umfang verschoben');
    assert.equal(new Set(vertrag.ids).size, vertrag.soll,
      vertrag.name + ': Dublette im Vertrag');
    for (const id of vertrag.ids) {
      assert.ok(POOLS[id], vertrag.name + ': unbekannter Runtime-Pool ' + id);
      assert.ok(!union.has(id), id + ': in mehreren Modernisierungswellen');
      union.add(id);
    }
  }

  assert.equal(physisch.length, 505);
  assert.equal(union.size, 505);
  assert.deepEqual([...union].sort(), physisch);
  assert.deepEqual(physisch.filter((id) => !union.has(id)), []);
});

test('Asset-Modernisierung - alle drei Geometriepaesse liegen im Poolpfad', () => {
  const quelle = fs.readFileSync(
    path.join(SRC, 'generators', 'geometry.js'), 'utf8'
  );
  const umwelt = quelle.indexOf('geo = veredleUmweltGeometrie(name, geo)');
  const bau = quelle.indexOf('geo = veredleBestandBau(name, geo)');
  const katalog = quelle.indexOf('geo = veredleBestandKatalog(name, geo)');
  const registry = quelle.indexOf('poolDefinieren(name, geo, opts)');
  assert.ok(umwelt >= 0, 'Umweltpass fehlt im Runtime-Poolpfad');
  assert.ok(umwelt < bau && bau < katalog && katalog < registry,
    'Geometriepaesse stehen nicht vor der Registry-Uebergabe');

  for (const id of KATALOG.BESTAND_KATALOG_VERFEINERTE_POOLS) {
    assert.equal(POOLS[id].geo.userData.bestandKatalogName, id,
      id + ': Katalogpass wurde in der Registry nicht angewendet');
  }
});

test('Asset-Modernisierung - echter Objektgenerator behaelt 505 Instanzen', () => {
  const erzeugt = SCHAU.erzeugeAssetSchau({
    einhaengen: true,
    markiere: false,
    hoeheAn: welt.m.terrain.heightAt
  });
  welt.erzeuge(erzeugt.element);
  const el = erzeugt.element;
  const ids = Object.keys(el.assetSchauInstanzen).sort();

  assert.equal(el.kennzahl, 505);
  assert.equal(el.total, 505);
  assert.equal(el.karteTotal, 0);
  assert.equal(ids.length, 505);
  assert.deepEqual(ids, Object.keys(POOLS).filter((id) => !id.startsWith('sig_')).sort());
  assert.equal(Object.keys(el.inst).length, 0,
    'Einzelpools duerfen neben der statischen Schau nicht doppelt rendern');
  assert.equal(el.group.children.length, el.assetSchauMeshGruppen);
  assert.equal(el.assetSchauMeshGruppen, 67,
    'Materialgruppenvertrag verschoben: ' + el.assetSchauMeshGruppen);
  const tiefenMeshes = el.group.children.filter((mesh) => mesh.userData.terraDepthDetail);
  const mikroIds = el.group.children.filter((mesh) => !mesh.userData.terraDepthDetail)
    .flatMap((mesh) => mesh.userData.terraAssetNamen || [])
    .sort();
  assert.equal(tiefenMeshes.length, 58);
  assert.equal(el.group.children.length - tiefenMeshes.length, 9);
  assert.deepEqual(mikroIds, [
    'blume', 'blumenkasten', 'fensterlicht', 'gras', 'irrlicht', 'kamin',
    'laterne', 'moewe', 'sporenlaterne'
  ]);
  const meshIds = el.group.children.flatMap((mesh) =>
    mesh.userData.terraAssetNamen || []).sort();
  assert.deepEqual(meshIds, ids, 'statische Rendergruppen verlieren oder duplizieren Pools');
  const quellDreiecke = ids.reduce((summe, id) => summe +
    (POOLS[id].geo.index ? POOLS[id].geo.index.count :
      POOLS[id].geo.attributes.position.count) / 3, 0);
  const meshDreiecke = el.group.children.reduce((summe, mesh) => summe +
    (mesh.geometry.index ? mesh.geometry.index.count :
      mesh.geometry.attributes.position.count) / 3, 0);
  assert.equal(meshDreiecke, quellDreiecke,
    'statisches Material-Merging veraendert den Geometrieumfang');
  const quellVertices = ids.reduce((summe, id) =>
    summe + POOLS[id].geo.attributes.position.count, 0);
  const meshVertices = el.group.children.reduce((summe, mesh) =>
    summe + mesh.geometry.attributes.position.count, 0);
  assert.equal(meshVertices, quellVertices);
  // Final-Art-Geometrien duerfen Detail gewinnen, solange der statische Merge
  // exakt dieselbe Vertexmenge wie die 505 Quellpools traegt (Assertion oben).
  assert.equal(meshVertices, 542981,
    'deterministischer Final-Art-Vertexsnapshot unerwartet verschoben');
  const uint32Gruppen = el.group.children.filter((mesh) =>
    mesh.geometry.index.array.BYTES_PER_ELEMENT === 4);
  assert.equal(uint32Gruppen.length, 4);
  for (const id of ids) {
    const instanz = el.assetSchauInstanzen[id];
    assert.deepEqual(instanz.slice(9, 12), [1, 1, 1],
      id + ': Galerie-Tint muss beim statischen Merge neutral bleiben');
    assert.equal(instanz.length, 12, id + ': Instanzvertrag beschaedigt');
    POOLS[id].geo.computeBoundingBox();
    const kontakt = instanz[1] + POOLS[id].geo.boundingBox.min.y * instanz[7];
    const boden = welt.m.terrain.heightAt(instanz[0], instanz[2]);
    assert.ok(Math.abs(kontakt - boden) < 1e-5, id + ': kein Bodenkontakt');
  }
  welt.leeren();

});

test('Asset-Schau-Merging - Fehler faellt transaktional auf Einzelpools zurueck', () => {
  const erzeugt = SCHAU.erzeugeAssetSchau({
    einhaengen: false,
    markiere: false,
    hoeheAn: welt.m.terrain.heightAt
  });
  const erste = erzeugt.layout.placements[0];
  const defekt = { placements: [erste, erste] };
  const warn = console.warn;
  let ergebnis;
  console.warn = () => {};
  try {
    ergebnis = SCHAU_MESHES.baueAssetSchauMeshes(erzeugt.element, defekt);
  } finally {
    console.warn = warn;
  }

  assert.equal(ergebnis.fallback, true);
  assert.equal(ergebnis.groups, 0);
  assert.equal(erzeugt.element.assetSchauMeshGruppen, 0);
  assert.equal(erzeugt.element.assetSchauInstanzen, erzeugt.element.inst);
  assert.equal(Object.keys(erzeugt.element.inst).length, 505);
  assert.equal(erzeugt.element.group, null,
    'ein fehlgeschlagener Merge darf keine Teilgruppe einhaengen');
});
