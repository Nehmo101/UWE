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
const BAU_FORM = await ladeTerra('assets/bestand-bau-formensprache.js');
const UMWELT_FORM = await ladeTerra('assets/umwelt-formensprache.js');
const KATALOG = await ladeTerra('assets/bestand-katalog-veredelung.js');
const KATALOG_FORM = await ladeTerra('assets/bestand-katalog-formensprache.js');
const FLOTTE = await ladeTerra('assets/steampunk-luftflotte.js');
const INSELN = await ladeTerra('assets/luftinsel-assets.js');
const TIER = await ladeTerra('assets/tierwesen-formensprache.js');
const REQUISITEN_FINAL = await ladeTerra('assets/requisiten-final-formensprache.js');
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

test('Waldsaeule A veredelt den gesamten 216er-Architekturvertrag ohne Luecke', () => {
  for (const id of ARCH.ARCHITEKTUR_ASSET_NAMEN) {
    assert.equal(POOLS[id].geo.userData.architekturFormensprache, 'waldsaeule-a',
      id + ': neue Architektur-Formensprache fehlt');
    assert.ok(POOLS[id].geo.userData.architekturFormDetails > 0,
      id + ': keine semantischen Architekturdetails');
  }
});

test('Waldsaeule A veredelt den gesamten 42er-Umweltvertrag ohne Luecke', () => {
  assert.deepEqual(
    [...UMWELT_FORM.UMWELT_FORMSPRACHE_POOLS].sort(),
    [...UMWELT.UMWELT_VERFEINERTE_POOLS].sort()
  );
  for (const id of UMWELT_FORM.UMWELT_FORMSPRACHE_POOLS) {
    assert.equal(POOLS[id].geo.userData.umweltFormensprache, 'waldsaeule-a',
      id + ': neue Formensprache fehlt');
    assert.ok(POOLS[id].geo.userData.umweltFormDetails > 0,
      id + ': keine semantischen Formdetails');
  }
});

test('Waldsaeule A veredelt den gesamten 81er-Bauvertrag ohne Luecke', () => {
  assert.deepEqual(
    [...BAU_FORM.BESTAND_BAU_FORMSPRACHE_POOLS].sort(),
    [...BAU.BESTAND_BAU_VERFEINERTE_POOLS].sort()
  );
  for (const id of BAU_FORM.BESTAND_BAU_FORMSPRACHE_POOLS) {
    assert.equal(POOLS[id].geo.userData.bestandBauFormensprache, 'waldsaeule-a',
      id + ': neue Bau-Formensprache fehlt');
    assert.ok(POOLS[id].geo.userData.bestandBauFormDetails > 0,
      id + ': keine semantischen Baudetails');
  }
});

test('Waldsaeule A veredelt den gesamten 149er-Bestandskatalog ohne Luecke', () => {
  assert.deepEqual(
    [...KATALOG_FORM.BESTAND_KATALOG_FORMSPRACHE_POOLS].sort(),
    [...KATALOG.BESTAND_KATALOG_VERFEINERTE_POOLS].sort()
  );
  for (const id of KATALOG_FORM.BESTAND_KATALOG_FORMSPRACHE_POOLS) {
    assert.equal(POOLS[id].geo.userData.bestandKatalogFormensprache, 'waldsaeule-a',
      id + ': neue Katalog-Formensprache fehlt');
    assert.ok(POOLS[id].geo.userData.bestandKatalogFormDetails > 0,
      id + ': keine semantischen Katalogdetails');
  }
});

test('Waldsaeule A veredelt den gesamten 17er-Luftweltvertrag ohne Luecke', () => {
  for (const id of FLOTTE.STEAMPUNK_LUFTFLOTTEN_NAMEN) {
    assert.equal(POOLS[id].geo.userData.steampunkFormensprache, 'waldsaeule-a',
      id + ': neue Flugmaschinen-Formensprache fehlt');
    assert.ok(POOLS[id].geo.userData.steampunkFormDetails > 0,
      id + ': keine bewohnten Flugdeckdetails');
  }
  for (const id of Object.values(INSELN.LUFTINSEL_POOL_IDS)) {
    assert.equal(POOLS[id].geo.userData.terraLuftweltFormensprache, 'waldsaeule-a',
      id + ': neue Luftinsel-Formensprache fehlt');
    assert.ok(POOLS[id].geo.userData.terraLuftweltFormDetails > 0,
      id + ': keine Plateau- oder Materialdetails');
  }
  for (const id of Object.values(BAMBUS.HOCHBAMBUS_POOL_IDS)) {
    assert.equal(POOLS[id].geo.userData.terraHochbambusFormensprache, 'waldsaeule-a',
      id + ': neue Hochbambus-Formensprache fehlt');
    assert.ok(POOLS[id].geo.userData.terraHochbambusFormDetails > 0,
      id + ': keine Blattfaecher-Details');
  }
});

test('Waldsaeule A hebt die sieben Tierwesen auf den Final-Art-Vertrag', () => {
  for (const id of TIER.TIERWESEN_FORMSPRACHE_POOLS) {
    assert.equal(POOLS[id].geo.userData.tierwesenFormensprache, 'waldsaeule-a',
      id + ': Tierwesen-Formensprache fehlt');
    assert.ok(POOLS[id].geo.userData.tierwesenFormDetails >= 10,
      id + ': Tierwesen besitzt zu wenige zusammenhaengende Details');
  }
});

test('Waldsaeule A auditiert die komplette 51er-Requisitengalerie', () => {
  for (const id of REQUISITEN_FINAL.REQUISITEN_FINAL_POOLS) {
    assert.equal(POOLS[id].geo.userData.requisitenFinalAudit, true,
      id + ': Requisiten-Endabnahme fehlt');
  }
});

test('Asset-Modernisierung - alle Geometriepaesse liegen im Poolpfad', () => {
  const quelle = fs.readFileSync(
    path.join(SRC, 'generators', 'geometry.js'), 'utf8'
  );
  const umwelt = quelle.indexOf('geo = veredleUmweltGeometrie(name, geo)');
  const umweltForm = quelle.indexOf('geo = veredleUmweltFormensprache(name, geo)');
  const bau = quelle.indexOf('geo = veredleBestandBau(name, geo)');
  const bauForm = quelle.indexOf('geo = veredleBestandBauFormensprache(name, geo)');
  const katalog = quelle.indexOf('geo = veredleBestandKatalog(name, geo)');
  const registry = quelle.indexOf('poolDefinieren(name, geo, opts)');
  const katalogForm = quelle.indexOf(
    'geo = veredleBestandKatalogFormensprache(name, geo)'
  );
  const tierForm = quelle.indexOf('geo = veredleTierwesenFormensprache(name, geo)');
  assert.ok(umwelt >= 0, 'Umweltpass fehlt im Runtime-Poolpfad');
  const requisitenFinal = quelle.indexOf('geo = veredleRequisitenFinal(name, geo)');
  assert.ok(umwelt < umweltForm && umweltForm < bau && bau < bauForm &&
    bauForm < katalog && katalog < katalogForm && katalogForm < tierForm &&
    tierForm < requisitenFinal && requisitenFinal < registry,
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
  /* AAA-Runde (Welle B1): Bewuchs und Architektur haben bewusst Detail
     gewonnen — Kronen mit Formenhierarchie, Dachkante/Traufe/Ueberstand,
     Anbauten. Der Snapshot wandert deshalb von 794417 auf 819023 (+3,1 %).
     Der eigentliche Vertrag darueber ist unberuehrt: meshVertices ===
     quellVertices haelt weiterhin, das statische Merging verliert und
     dupliziert also nichts. Ebenso unveraendert: 505 Instanzen, 67 Material-
     gruppen, 58 Tiefen-Meshes, 9 Mikro-Pools, 5 Uint32-Gruppen. */
  assert.equal(meshVertices, 819023,
    'deterministischer Final-Art-Vertexsnapshot unerwartet verschoben');
  const uint32Gruppen = el.group.children.filter((mesh) =>
    mesh.geometry.index.array.BYTES_PER_ELEMENT === 4);
  assert.equal(uint32Gruppen.length, 5,
    'nur fuenf detailreiche Materialgruppen duerfen 32-Bit-Indizes benoetigen');
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
