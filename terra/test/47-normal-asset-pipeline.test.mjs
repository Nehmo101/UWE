import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ladeTerra, SRC } from './hilfen/laden.mjs';

const ROOT = path.resolve(SRC, '..', '..');
const lesen = (datei) => fs.readFileSync(path.join(ROOT, datei), 'utf8');
function minimalesGlbMitEngemStride() {
  const json = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: 36 }],
    bufferViews: [{
      buffer: 0, byteOffset: 0, byteLength: 36, byteStride: 12, target: 34962
    }],
    accessors: [{
      bufferView: 0, byteOffset: 0, componentType: 5126, count: 3, type: 'VEC3'
    }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, mode: 4 }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0
  };
  const jsonRaw = Buffer.from(JSON.stringify(json));
  const jsonChunk = Buffer.concat([
    jsonRaw, Buffer.alloc((4 - jsonRaw.length % 4) % 4, 0x20)
  ]);
  const binChunk = Buffer.from(new Float32Array([
    0, 0, 0, 1, 0, 0, 0, 1, 0
  ]).buffer);
  const glb = Buffer.alloc(12 + 8 + jsonChunk.length + 8 + binChunk.length);
  glb.writeUInt32LE(0x46546c67, 0);
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(jsonChunk.length, 12);
  glb.writeUInt32LE(0x4e4f534a, 16);
  jsonChunk.copy(glb, 20);
  const binHeader = 20 + jsonChunk.length;
  glb.writeUInt32LE(binChunk.length, binHeader);
  glb.writeUInt32LE(0x004e4942, binHeader + 4);
  binChunk.copy(glb, binHeader + 8);
  return glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength);
}

test('Normaler Terra-Baum hat drei gerichtete Blender-Kandidaten und feste Szenen', () => {
  const brief = JSON.parse(lesen('terra/art-direction/briefs/baum.json'));
  const scenes = JSON.parse(lesen('terra/art-direction/scenes.json'));
  const generator = lesen('tools/terra-art/blender/generate_asset.py');

  assert.equal(brief.assetId, 'baum');
  assert.equal(brief.type, 'normal-instanced-pool');
  assert.deepEqual(brief.candidates.map((candidate) => candidate.id), ['a', 'b', 'c']);
  assert.deepEqual(brief.scenes, ['tree-detail', 'tree-family']);
  for (const id of brief.scenes) {
    assert.ok(scenes.scenes.some((scene) => scene.id === id), 'Szene fehlt: ' + id);
  }
  assert.match(generator, /def stylized_tree\(variant\):/);
  assert.match(generator, /elif asset_id == "baum":/);
});

test('Nadelbaum kalibriert das neue 505-Asset-Niveau mit drei dichten Kronenformen', () => {
  const brief = JSON.parse(lesen('terra/art-direction/briefs/nadelbaum.json'));
  const generator = lesen('tools/terra-art/blender/generate_asset.py');
  const adapter = lesen('tools/terra-art/blender/conifer_asset.py');

  assert.equal(brief.assetId, 'nadelbaum');
  assert.equal(brief.type, 'normal-instanced-pool');
  assert.deepEqual(brief.candidates.map((candidate) => candidate.id), ['a', 'b', 'c']);
  assert.deepEqual(brief.scenes, ['tree-detail', 'tree-family']);
  assert.match(generator, /elif asset_id == "nadelbaum":/);
  assert.match(adapter, /def bough_cluster\(/);
  assert.match(adapter, /TerraConiferCrownBase/);
});

test('Externes Baum-GLB wird zu einer farbigen Instancing-Geometrie gebacken', async () => {
  const THREE = await import('three');
  const { backeGruppeZuPoolGeometrie, installiereExternenPool } =
    await ladeTerra('assets/external-pool-geometrie.js');
  const gruppe = new THREE.Group();

  const rinde = new THREE.Mesh(
    new THREE.BoxGeometry(.6, 2.8, .6),
    new THREE.MeshStandardMaterial({ color: 0x704326 })
  );
  rinde.material.name = 'TerraBark';
  rinde.position.y = 1.4;
  gruppe.add(rinde);

  const krone = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x64873b })
  );
  krone.material.name = 'TerraLeafMid';
  krone.position.y = 3.6;
  gruppe.add(krone);

  const geo = backeGruppeZuPoolGeometrie(gruppe);
  assert.ok(geo.attributes.position.count > 100);
  assert.equal(geo.index, null);
  assert.equal(geo.attributes.position.count, geo.attributes.normal.count);
  assert.equal(geo.attributes.position.count, geo.attributes.color.count);
  assert.equal(geo.attributes.position.count, geo.attributes.uv.count);
  assert.ok(Array.from(geo.attributes.position.array).every(Number.isFinite));
  assert.ok(Array.from(geo.attributes.color.array).every(Number.isFinite));
  const wind = new Set(Array.from(geo.attributes.uv.array).filter((_, index) => index % 2));
  assert.ok(Array.from(wind).some((wert) => Math.abs(wert - 0.008) < 1e-6));
  assert.ok(Array.from(wind).some((wert) => Math.abs(wert - 0.72) < 1e-6));
  assert.equal(geo.userData.terraExternPool, true);
  assert.equal(installiereExternenPool('__proto__', gruppe), false);
  assert.equal(installiereExternenPool('constructor', gruppe), false);
});

test('GLB-Decoder respektiert den Byte-Offset bei engem Vertex-Stride', async () => {
  const { szeneFuer } = await ladeTerra('assets/external-assets.js');
  const { backeGruppeZuPoolGeometrie } =
    await ladeTerra('assets/external-pool-geometrie.js');
  const geo = backeGruppeZuPoolGeometrie(szeneFuer(minimalesGlbMitEngemStride()));

  assert.equal(geo.attributes.position.count, 3);
  assert.deepEqual(geo.boundingBox.min.toArray(), [0, 0, 0]);
  assert.deepEqual(geo.boundingBox.max.toArray(), [1, 1, 0]);
});

test('Ausgewaehlter Kandidat rendert isoliert und bleibt texturfrei optimierbar', () => {
  const cli = lesen('tools/terra-art/cli.mjs');
  const main = lesen('terra/src/main.js');
  const leistung = lesen('terra/src/render/leistungsregler.js');

  assert.match(cli, /options\.candidate && id !== options\.candidate/);
  assert.match(cli, /spawnSync\(tool, \['optimize'/);
  assert.match(cli, /'--palette', 'false'/);
  assert.match(cli, /'--texture-compress', 'false'/);
  assert.match(cli, /const brief = options\.brief \? readJson\(briefFile\(options\.brief\)\) : null/);
  assert.match(cli, /scene\.id === 'tree-detail'/);
  assert.match(cli, /terraFocus=/);
  assert.match(cli, /options\.scene/);
  assert.match(cli, /for \(const scene of selectedScenes\)/);
  assert.match(cli, /devicePixelRatio: window\.devicePixelRatio/);
  assert.match(main, /placements: \[fokusPlatz\]/);
  assert.match(main, /SCHAU_FOKUS \? 128/);
  assert.match(main, /kopf\.textContent = titel/);
  assert.doesNotMatch(main, /legende\.innerHTML/);
  assert.match(main, /if \(!SCHAU_MODUS\) tickLeistung\(raw\)/);
  assert.match(leistung, /\[1, 0\.92, 0\.82, 0\.72, 0\.6\]/);
});
