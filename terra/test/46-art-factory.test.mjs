import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SRC } from './hilfen/laden.mjs';

const ROOT = path.resolve(SRC, '..', '..');
const lesen = (datei) => fs.readFileSync(path.join(ROOT, datei), 'utf8');

test('Terra Art Factory - Vertraege und agentenunabhaengige CLI sind gueltig', () => {
  const contract = JSON.parse(lesen('terra/art-direction/quality-contract.json'));
  const scenes = JSON.parse(lesen('terra/art-direction/scenes.json'));
  assert.equal(contract.version, 1);
  assert.equal(contract.workflow.candidateCount, 3);
  assert.equal(contract.workflow.requireIntermediateApproval, true);
  assert.equal(contract.workflow.requireFinalApproval, true);
  assert.ok(contract.budgets.heroAsset.maxDownloadBytes > 0);
  assert.ok(scenes.scenes.length >= 4);
  assert.equal(new Set(scenes.scenes.map((scene) => scene.id)).size, scenes.scenes.length);

  const run = spawnSync(process.execPath, ['tools/terra-art/cli.mjs', 'doctor'], {
    cwd: ROOT, encoding: 'utf8'
  });
  assert.equal(run.status, 0, run.stderr);
  const report = JSON.parse(run.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.required.contractVersion, 1);
});

test('Terra Art Factory - leeres Runtime-Manifest und Fallback sind stabil', () => {
  const manifest = JSON.parse(lesen('terra/assets/models/manifest.json'));
  assert.deepEqual(manifest, { version: 1, assets: [] });
  const loader = lesen('terra/src/assets/external-assets.js');
  assert.match(loader, /GLB-v2-Kopf fehlt/);
  assert.match(loader, /console\.warn\('\[terra-assets\] Fallback/);
  assert.match(loader, /a-zA-Z0-9\/_-/,
    'Kandidatenpfad braucht eine enge Positivliste');
  assert.match(lesen('terra/src/generators/weltschildkroete.js'),
    /externesAsset\('weltschildkroete'\) \|\| new THREE\.Mesh/);
});

test('Terra Art Factory - Skills existieren fuer Codex, Claude und Cursor', () => {
  const files = [
    '.codex/skills/uweterra/SKILL.md',
    '.claude/skills/uweterra/SKILL.md',
    '.cursor/skills/uwe-terra/SKILL.md'
  ];
  for (const file of files) {
    const content = lesen(file);
    // \r? weil ein frischer Windows-Checkout mit core.autocrlf=true CRLF liefert.
    assert.match(content, /^---\r?\nname: (?:uweterra|uwe-terra)\r?\n/);
    assert.match(content, /pnpm terra:art:doctor/);
    assert.match(content, /Zwischenabnahme stoppen/);
    assert.match(content, /tools\/terra-art\/windows\/setup\.ps1/,
      'der Windows-Weg gehoert in jeden Skill, sonst wird er nachgebaut');
  }
  const cursor = JSON.parse(lesen('.cursor/skills/manifest.json'));
  assert.ok(cursor.skills.some((skill) => skill.id === 'uwe-terra'));
});

test('Terra Art Factory - Windows-Starter ist versioniert und passt zur CLI', () => {
  const shim = lesen('tools/terra-art/windows/gltf-transform-shim.cs');
  const setup = lesen('tools/terra-art/windows/setup.ps1');
  const cli = lesen('tools/terra-art/cli.mjs');
  assert.ok(shim.includes('node_modules\\@gltf-transform\\cli\\bin\\cli.js'),
    'der Starter muss die CLI von glTF Transform finden');
  assert.ok(setup.includes('gltf-transform-shim.cs'),
    'das Setup baut genau den versionierten Starter');
  for (const variable of ['GLTF_TRANSFORM_BIN', 'BLENDER_BIN']) {
    assert.ok(cli.includes(`process.env.${variable}`), `${variable} wird von der CLI gelesen`);
    assert.ok(setup.includes(variable), `${variable} wird vom Setup gesetzt`);
  }
});

test('Terra Art Factory - Approval ist ohne explizite Identitaet gesperrt', () => {
  const run = spawnSync(process.execPath,
    ['tools/terra-art/cli.mjs', 'approve', '--asset', 'weltschildkroete', '--candidate', 'a'],
    { cwd: ROOT, encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /--asset, --candidate und --by/);
});
