/* ==========================================================================
   Architektur-Katalog und Weltschildkroete

   Die Architektur-IDs entstehen dynamisch aus Stil und Bautyp. Darum kann
   der Registry-Test ihre Erreichbarkeit nicht durch eine Textsuche pruefen.
   Diese Datei sichert den 12-mal-18-Vertrag, die 216 individuellen
   Geometrien und die direkt animierbare Schildkroeten-Landmarke.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ladeTerra } from './hilfen/laden.mjs';
import { testWelt } from './hilfen/karte.mjs';

const KATALOG = await ladeTerra('assets/architektur-katalog.js');
const GEOMETRIE = await ladeTerra('assets/architektur-geometrie.js');
const SCHILDKROETE = await ladeTerra('generators/weltschildkroete.js');

const PFLICHT_ATTRIBUTE = ['position', 'normal', 'color', 'uv'];

function bytes(array) {
  return Buffer.from(array.buffer, array.byteOffset, array.byteLength);
}

function alleEndlich(array) {
  for (let i = 0; i < array.length; i++) {
    if (!Number.isFinite(array[i])) return false;
  }
  return true;
}

function geometrieHash(geo) {
  const hash = createHash('sha256');
  for (const name of Object.keys(geo.attributes).sort()) {
    const attr = geo.attributes[name];
    hash.update(name + ':' + attr.itemSize + ':');
    hash.update(bytes(attr.array));
  }
  hash.update('#index');
  if (geo.index) hash.update(bytes(geo.index.array));
  return hash.digest('hex');
}

function pruefeGeometrie(geo, kontext) {
  assert.ok(geo && geo.attributes, kontext + ': keine BufferGeometry');
  for (const name of PFLICHT_ATTRIBUTE) {
    assert.ok(geo.attributes[name], kontext + ': Attribut ' + name + ' fehlt');
  }
  const anzahl = geo.attributes.position.count;
  assert.ok(anzahl > 0, kontext + ': Geometrie ist leer');
  for (const name of PFLICHT_ATTRIBUTE) {
    const attr = geo.attributes[name];
    assert.equal(attr.count, anzahl,
      kontext + ': ' + name + ' hat eine andere Vertexzahl');
    assert.ok(alleEndlich(attr.array),
      kontext + ': ' + name + ' enthaelt NaN oder Infinity');
  }
  if (geo.index) {
    assert.ok(alleEndlich(geo.index.array),
      kontext + ': Index enthaelt NaN oder Infinity');
  }
}

function pruefeTransform(objekt, kontext) {
  for (const [name, wert] of [
    ['position.x', objekt.position.x],
    ['position.y', objekt.position.y],
    ['position.z', objekt.position.z],
    ['rotation.x', objekt.rotation.x],
    ['rotation.y', objekt.rotation.y],
    ['rotation.z', objekt.rotation.z],
    ['scale.x', objekt.scale.x],
    ['scale.y', objekt.scale.y],
    ['scale.z', objekt.scale.z]
  ]) {
    assert.ok(Number.isFinite(wert), kontext + ': ' + name + ' ist nicht endlich');
  }
}

test('Architektur - Katalog ist exakt 12 mal 18 und vollstaendig', () => {
  const {
    ARCHITEKTUR_STILE,
    ARCHITEKTUR_VARIANTEN,
    ARCHITEKTUR_GRUPPEN,
    ARCHITEKTUR_KULTURGRUPPEN,
    ARCHITEKTUR_KULTUREN,
    ARCHITEKTUR_ASSETS,
    ARCHITEKTUR_ASSET_NAMEN,
    ARCHITEKTUR_ASSET_LABELS,
    ARCHITEKTUR_ASSET_COUNT
  } = KATALOG;

  assert.equal(ARCHITEKTUR_STILE.length, 12);
  assert.equal(ARCHITEKTUR_VARIANTEN.length, 18);
  assert.equal(ARCHITEKTUR_ASSETS.length, 216);
  assert.equal(ARCHITEKTUR_ASSET_COUNT, 216);
  assert.equal(ARCHITEKTUR_ASSET_NAMEN.length, 216);
  assert.equal(new Set(ARCHITEKTUR_ASSET_NAMEN).size, 216);
  assert.equal(new Set(ARCHITEKTUR_ASSETS
    .map((asset) => asset.stilId + '/' + asset.variantenId)).size, 216);
  for (const stil of ARCHITEKTUR_STILE) {
    assert.equal(ARCHITEKTUR_ASSETS.filter((asset) => asset.stilId === stil.id).length, 18);
  }
  for (const variante of ARCHITEKTUR_VARIANTEN) {
    assert.equal(ARCHITEKTUR_ASSETS
      .filter((asset) => asset.variantenId === variante.id).length, 12);
  }
  assert.ok(ARCHITEKTUR_ASSET_NAMEN.every((id) => /^arch_[a-z0-9_]+$/.test(id)),
    'Pool-IDs muessen stabil und ASCII sein');
  assert.deepEqual(ARCHITEKTUR_ASSETS.map((asset) => asset.id),
    [...ARCHITEKTUR_ASSET_NAMEN]);
  assert.equal(Object.keys(ARCHITEKTUR_ASSET_LABELS).length, 216);
  assert.ok(ARCHITEKTUR_ASSETS.every((asset) =>
    typeof ARCHITEKTUR_ASSET_LABELS[asset.id] === 'string'
      && ARCHITEKTUR_ASSET_LABELS[asset.id].length > 0),
  'Jedes Architektur-Asset braucht ein Label');

  const variantenInGruppen = Object.values(ARCHITEKTUR_GRUPPEN)
    .flatMap((gruppe) => gruppe.varianten);
  assert.equal(variantenInGruppen.length, 18);
  assert.equal(new Set(variantenInGruppen).size, 18);
  assert.deepEqual([...new Set(variantenInGruppen)].sort(),
    ARCHITEKTUR_VARIANTEN.map((variante) => variante.id).sort());

  const stileInKulturgruppen = Object.values(ARCHITEKTUR_KULTURGRUPPEN)
    .flatMap((gruppe) => gruppe.stile);
  assert.equal(stileInKulturgruppen.length, 12);
  assert.equal(new Set(stileInKulturgruppen).size, 12);
  assert.deepEqual([...new Set(stileInKulturgruppen)].sort(),
    ARCHITEKTUR_STILE.map((stil) => stil.id).sort());
  assert.deepEqual(Object.keys(ARCHITEKTUR_KULTUREN).sort(),
    ARCHITEKTUR_STILE.map((stil) => stil.id).sort());
});

test('Architektur - alle 216 Pools haben eindeutige vollstaendige Geometrien', () => {
  const registriert = [];
  const namen = GEOMETRIE.registriereArchitekturPools((id, geo, optionen) => {
    registriert.push({ id, geo, optionen });
  });

  assert.deepEqual(namen, [...KATALOG.ARCHITEKTUR_ASSET_NAMEN]);
  assert.equal(registriert.length, 216);
  assert.equal(new Set(registriert.map((eintrag) => eintrag.id)).size, 216);

  const hashes = new Set();
  const assetsNachId = new Map(KATALOG.ARCHITEKTUR_ASSETS
    .map((asset) => [asset.id, asset]));
  for (const { id, geo, optionen } of registriert) {
    const asset = assetsNachId.get(id);
    assert.ok(asset, id + ': kein Katalogeintrag');
    pruefeGeometrie(geo, id);
    hashes.add(geometrieHash(geo));
    assert.ok(Number.isFinite(optionen.radius) && optionen.radius > 0,
      id + ': ungueltiger Radius');
    assert.ok(Number.isFinite(optionen.ao) && optionen.ao >= 0,
      id + ': ungueltige AO-Staerke');
    assert.ok(typeof optionen.familie === 'string' && optionen.familie.length > 0,
      id + ': Materialfamilie fehlt');
    assert.equal(geo.userData.architekturStil, asset.stilId,
      id + ': Stil-Metadatum passt nicht zum Katalog');
    assert.equal(geo.userData.architekturVariante, asset.variantenId,
      id + ': Varianten-Metadatum passt nicht zum Katalog');
    assert.ok(Number.isInteger(geo.userData.architekturTeile)
      && geo.userData.architekturTeile > 0,
    id + ': Teile-Metadatum fehlt');
  }
  assert.equal(hashes.size, 216,
    'Jede Stil-mal-Bautyp-Kombination braucht eine eigene Geometrie');
});

test('Weltschildkroete - direkte Meshes, bewegter Kopf und endliche Transforms', async () => {
  const welt = await testWelt({ seed: 4711 });
  const el = welt.element('objekt', 'weltschildkroete', [{ x: 0, z: 0 }],
    { groesse: 1.25, drehung: 27, kopfbewegung: 1 }, 0x7e77);

  SCHILDKROETE.genWeltschildkroete(el);

  assert.ok(el.group, 'Die Landmarke braucht eine Elementgruppe');
  const direkteMeshes = el.group.children.filter((kind) => kind.type === 'Mesh');
  const direkteLichter = el.group.children.filter((kind) => kind.type === 'PointLight');
  assert.equal(direkteMeshes.length, 4,
    'Koerper, Kopf, Fensterlicht und Stoffakzente muessen direkte Mesh-Kinder sein');
  assert.equal(direkteLichter.length, 1);
  assert.equal(el.group.children.length, 5,
    'Die Landmarke darf keine versteckten Pivot-Gruppen anlegen');
  assert.ok(direkteMeshes.every((mesh) => mesh.parent === el.group));
  assert.ok(direkteMeshes.every((mesh) =>
    !mesh.children.some((kind) => kind.type === 'Mesh')),
  'Meshes duerfen nicht ineinander verschachtelt sein');

  const kopf = direkteMeshes.find((mesh) => mesh.userData.terraWeltschildkroetenKopf);
  const akzente = direkteMeshes.find((mesh) => mesh.userData.terraWeltschildkroetenAkzente);
  assert.ok(kopf, 'Der animierbare Kopf ist nicht markiert');
  assert.ok(akzente, 'Die animierten Fahnen und Banner sind nicht markiert');
  assert.equal(SCHILDKROETE.BASIS_KOERPER.userData.terraAnatomie, 'landschildkroete');
  assert.equal(SCHILDKROETE.BASIS_KOERPER.userData.terraBeine, 4,
    'Eine Landschildkroete braucht vier tragende Beine');
  assert.equal(SCHILDKROETE.BASIS_KOERPER.userData.terraZehenProBein, 3,
    'Jeder Fuss braucht sichtbare Zehen und Krallen');
  assert.ok(SCHILDKROETE.BASIS_KOERPER.userData.terraFrontSockelBreite >= 9,
    'Der vordere Stein-Moos-Sockel muss die Burg breit mit dem Panzer verzahnen');
  assert.ok(SCHILDKROETE.BASIS_KOERPER.userData.terraHinterbeinSpur >= 12,
    'Die Hinterbeine muessen seitlich klar hinter dem Panzer hervortreten');
  assert.equal(SCHILDKROETE.BASIS_KOERPER.userData.terraPanzerplatten, 13,
    'Der alte Panzer braucht wenige grosse statt vieler niedlicher Platten');
  assert.ok(SCHILDKROETE.BASIS_KOERPER.userData.terraPanzerFlankenFaktor <= 0.92,
    'Die seitlichen Panzerflanken duerfen nicht hornartig hochgezogen sein');
  assert.equal(SCHILDKROETE.BASIS_KOERPER.userData.terraBeinSchuppen,
    'facettierte-polyeder');
  assert.equal(SCHILDKROETE.BASIS_KOERPER.userData.terraFussplattenKontrast, true);
  assert.equal(SCHILDKROETE.BASIS_KOERPER.userData.terraKrallenFarbe, 'elfenbein');
  assert.ok(SCHILDKROETE.BASIS_KOERPER.userData.terraBurgStrebepfeiler >= 15);
  assert.equal(SCHILDKROETE.BASIS_KOERPER.userData.terraBurgAbschluesse,
    'zinnen-giebel');
  assert.equal(SCHILDKROETE.BASIS_KOERPER.userData.terraArtDirection, 'alt-kantig');
  assert.equal(SCHILDKROETE.BASIS_KOERPER.userData.terraKoerperProfil, 'saurier-schwer');
  assert.equal(SCHILDKROETE.BASIS_KOERPER.userData.terraPanzerRandplatten, 18);
  assert.equal(SCHILDKROETE.BASIS_KOERPER.userData.terraBurgMaterial,
    'dunkler-verwitterter-stein');
  assert.equal(SCHILDKROETE.BASIS_KOERPER.userData.terraPanzerFlankenplatten, 8);
  assert.equal(SCHILDKROETE.BASIS_KOERPER.userData.terraBurgPanzerstreben, 8);
  assert.equal(SCHILDKROETE.BASIS_KOERPER.userData.terraMaterialTrennung,
    'haut-panzer-basalt-schiefer-metall');
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraKopfForm,
    'adulter-laengsschaedel-hornschnabel');
  assert.ok(SCHILDKROETE.BASIS_KOPF.userData.terraHalsLaengenFaktor >= 1.2);
  assert.ok(SCHILDKROETE.BASIS_KOPF.userData.terraKopfMassstab >= 1.3 &&
    SCHILDKROETE.BASIS_KOPF.userData.terraKopfMassstab <= 1.45);
  assert.ok(SCHILDKROETE.BASIS_KOPF.userData.terraKopfLaengenFaktor >= 1.25 &&
    SCHILDKROETE.BASIS_KOPF.userData.terraKopfLaengenFaktor <= 1.35);
  assert.ok(SCHILDKROETE.BASIS_KOPF.userData.terraKopfSchwereFaktor >= 1.12 &&
    SCHILDKROETE.BASIS_KOPF.userData.terraKopfSchwereFaktor <= 1.22);
  assert.ok(SCHILDKROETE.BASIS_KOPF.userData.terraKopfNeigungGrad >= 8 &&
    SCHILDKROETE.BASIS_KOPF.userData.terraKopfNeigungGrad <= 12);
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraSchaedelSilhouette,
    'schwer-lang-hinten-breit-stumpfer-schnabel');
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraSchaedelplatten, 4);
  assert.ok(SCHILDKROETE.BASIS_KOPF.userData.terraSchaedelVerjuengung <= 0.4);
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraBrauenplatten, 2);
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraBrauenUeberstand, 0);
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraWangenplatten, 2);
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraWangenUeberstand, 0);
  assert.ok(SCHILDKROETE.BASIS_KOPF.userData.terraAugenFlaechenFaktor <= 0.2);
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraAugenWeissanteil, 0);
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraAugenLichtpunkt, 'keiner');
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraAugenLage,
    'seitlich-tief-hinter-schnauzenbasis');
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraAugenFrontsicht,
    'nicht-sichtbar');
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraSchnabelProfil,
    'stumpfer-durchgehender-hornkeil');
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraMaulnaht,
    'seitlich-lang-frontal-extrem-kurz');
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraMaulnahtSegmente, 4);
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraNasenloecher,
    'zwei-kleine-schraege-schlitze');
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraNackenVerzahnung,
    'hinterhaupt-kiefermuskel-kehlschild');
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraHalsFalten, 0);
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraKehlSchuppen,
    'keine-aufgesetzte-zusatzgeometrie');
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraHalsSeitenschilde, 0);
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraHalsQuerschnitt,
    'elliptisch');
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraHalsSForm,
    'ausgepraegt');
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraHalsTopologie,
    'catmull-rom-tube', 'Der S-Hals muss eine echte Spline-Roehre sein');
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraHalsSplinePunkte, 8);
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraHalsSegmente, 24);
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraHalsRinge, 25,
    'Die kontinuierliche Spline-Roehre braucht 25 Ringquerschnitte');
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraHalsRadialSegmente, 12);
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraHalsKontinuierlich, true,
    'Der Hals darf keine Zylindernaehte mehr besitzen');
  assert.equal(SCHILDKROETE.BASIS_KOPF.userData.terraStatischeGeometrie, true,
    'Die Animation darf keine laufenden Vertexupdates brauchen');
  const basisGeometrien = [
    SCHILDKROETE.BASIS_KOERPER,
    SCHILDKROETE.BASIS_KOPF,
    SCHILDKROETE.BASIS_LICHT,
    SCHILDKROETE.BASIS_AKZENTE
  ];
  const dreieckeVon = (geo) =>
    (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
  const teilBudgets = [17000, 6500, 2000, 100];
  for (let i = 0; i < basisGeometrien.length; i++) {
    assert.ok(dreieckeVon(basisGeometrien[i]) <= teilBudgets[i],
      'Weltschildkroeten-Teil ' + i + ' ueberschreitet sein Dreiecksbudget');
  }
  const dreiecke = basisGeometrien.reduce((summe, geo) =>
    summe + dreieckeVon(geo), 0);
  assert.ok(dreiecke <= 22000,
    'Die Hero-Landmarke ueberschreitet ihr Dreiecksbudget: ' + dreiecke);

  const grenzen = (geo) => {
    const position = geo.attributes.position;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < position.count; i++) {
      for (let achse = 0; achse < 3; achse++) {
        const wert = position.array[i * 3 + achse];
        min[achse] = Math.min(min[achse], wert);
        max[achse] = Math.max(max[achse], wert);
      }
    }
    return { min, max };
  };
  const koerperGrenzen = grenzen(SCHILDKROETE.BASIS_KOERPER);
  const koerperHoehe = koerperGrenzen.max[1] - koerperGrenzen.min[1];
  const koerperBreite = Math.max(
    koerperGrenzen.max[0] - koerperGrenzen.min[0],
    koerperGrenzen.max[2] - koerperGrenzen.min[2]
  );
  assert.ok(koerperGrenzen.max[1] >= 20,
    'Die Festung ragt nicht hoch genug auf');
  assert.ok(koerperHoehe >= 21,
    'Tier und Festung bilden keine hohe gemeinsame Silhouette');
  assert.ok(koerperHoehe / koerperBreite >= 1.2,
    'Die Landmarke ist noch zu flach: ' + koerperHoehe / koerperBreite);
  const kopfGrenzen = grenzen(SCHILDKROETE.BASIS_KOPF);
  assert.ok(kopfGrenzen.min[2] <= 0.1,
    'Der Hals schliesst nicht am lokalen Brustansatz an');
  assert.ok(kopfGrenzen.max[1] - kopfGrenzen.min[1] >= 10.5,
    'Der S-Hals ist nicht deutlich aufgerichtet');
  assert.ok(kopfGrenzen.max[2] >= 9.35,
    'Der Hornschnabel tritt nicht deutlich genug vor den Schaedel');
  const kopfPosition = SCHILDKROETE.BASIS_KOPF.attributes.position;
  const hinterkopfX = [];
  const schnabelX = [];
  for (let i = 0; i < kopfPosition.count; i++) {
    const y = kopfPosition.getY(i);
    const z = kopfPosition.getZ(i);
    if (y >= 9 && z >= 4.5 && z <= 5.5) {
      hinterkopfX.push(kopfPosition.getX(i));
    }
    if (z >= 9.2) schnabelX.push(kopfPosition.getX(i));
  }
  const hinterkopfBreite = Math.max(...hinterkopfX) - Math.min(...hinterkopfX);
  const schnabelBreite = Math.max(...schnabelX) - Math.min(...schnabelX);
  assert.ok(hinterkopfBreite >= 4.7,
    'Der adulte Kopf braucht ein breites, tragendes Hinterhaupt');
  assert.ok(schnabelBreite >= 1.4 && schnabelBreite <= 1.9,
    'Der Hornschnabel muss kompakt und klar verjuengt enden: ' + schnabelBreite);
  assert.ok(schnabelBreite / hinterkopfBreite <= 0.4,
    'Der Schaedel verjuengt sich frontal noch nicht deutlich genug');
  for (const [index, mesh] of direkteMeshes.entries()) {
    pruefeGeometrie(mesh.geometry, 'Weltschildkroete Mesh ' + index);
  }
  for (const [index, objekt] of el.group.children.entries()) {
    pruefeTransform(objekt, 'Weltschildkroete Kind ' + index);
  }

  SCHILDKROETE.tickWeltschildkroeten(0);
  const start = [kopf.rotation.x, kopf.rotation.y, kopf.rotation.z];
  const stoffStart = [akzente.rotation.y, akzente.rotation.z, akzente.position.y];
  const lichtStart = direkteLichter[0].intensity;
  let bewegt = false;
  let belebt = false;
  for (const zeit of [11, 37, 83]) {
    SCHILDKROETE.tickWeltschildkroeten(zeit);
    bewegt ||= Math.abs(kopf.rotation.x - start[0]) > 1e-6
      || Math.abs(kopf.rotation.y - start[1]) > 1e-6
      || Math.abs(kopf.rotation.z - start[2]) > 1e-6;
    belebt ||= Math.abs(akzente.rotation.y - stoffStart[0]) > 1e-6
      || Math.abs(akzente.rotation.z - stoffStart[1]) > 1e-6
      || Math.abs(akzente.position.y - stoffStart[2]) > 1e-6
      || Math.abs(direkteLichter[0].intensity - lichtStart) > 1e-6;
  }
  assert.ok(bewegt, 'Der Kopf bewegt sich im Animationstakt nicht');
  assert.ok(belebt, 'Fahnen und Schlosslicht reagieren nicht auf den Animationstakt');
  pruefeTransform(kopf, 'Weltschildkroete Kopf nach Animation');
  pruefeTransform(akzente, 'Weltschildkroete Stoffakzente nach Animation');

  welt.m.store.dropElement(el);
  SCHILDKROETE.tickWeltschildkroeten(100);
});
