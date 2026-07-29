/* ==========================================================================
   Wegrand-Querprofil

   Der Saum steckt als sieben Punkte im bestehenden Weg-Mesh. Die Tests
   sichern Terrainuebergang, Fahrspuren und die ebene Holzbruecke, ohne eine
   Welt oder einen Renderer aufbauen zu muessen.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ladeTerra, SRC } from './hilfen/laden.mjs';

const PROFIL = await ladeTerra('assets/wegrand-profil.js');

function optionen(extra = {}) {
  return Object.freeze({
    x: 12,
    z: -5,
    nx: 0.8,
    nz: 0.6,
    links: 2.4,
    rechts: 1.8,
    deck: 3.2,
    einsinken: 0.12,
    variation: 1,
    farbe: Object.freeze([0.72, 0.58, 0.39]),
    bruecke: false,
    hoeheAt(x, z) { return 1 + x * 0.01 + z * 0.02; },
    bodenFarbe(x, z, h) { return [0.2 + x * 0.001, 0.3 + h * 0.001, 0.4 + z * 0.001]; },
    ...extra
  });
}

function alleEndlich(punkt) {
  return [punkt.x, punkt.y, punkt.z, punkt.quer, ...punkt.farbe]
    .every(Number.isFinite);
}

test('Wegrand-Profil - sieben Punkte verbinden Terrain, Spuren und Wegkrone', () => {
  assert.equal(PROFIL.WEG_PROFIL_PUNKTE, 7);
  const opt = optionen();
  const profil = PROFIL.wegrandProfil(opt);
  assert.equal(profil.length, 7);
  assert.ok(profil.every(alleEndlich));
  assert.equal(profil[0].quer, 1.12);
  assert.equal(profil[3].quer, 0);
  assert.equal(profil[6].quer, -1.12);
  assert.equal(profil[3].x, opt.x);
  assert.equal(profil[3].z, opt.z);
  assert.ok(profil[2].farbe[0] < profil[3].farbe[0],
    'linke Fahrspur hebt sich nicht von der Krone ab');
  assert.ok(profil[4].farbe[0] < profil[3].farbe[0],
    'rechte Fahrspur hebt sich nicht von der Krone ab');
  assert.deepEqual(profil[0].farbe,
    opt.bodenFarbe(profil[0].x, profil[0].z,
      opt.hoeheAt(profil[0].x, profil[0].z)));
  assert.deepEqual(profil[6].farbe,
    opt.bodenFarbe(profil[6].x, profil[6].z,
      opt.hoeheAt(profil[6].x, profil[6].z)));
  assert.deepEqual(opt.farbe, [0.72, 0.58, 0.39], 'Eingabefarbe wurde mutiert');
});

test('Wegrand-Profil - Bruecken bleiben eben, holzfarben und exakt breit', () => {
  let hoehenAufrufe = 0;
  let bodenAufrufe = 0;
  const opt = optionen({
    bruecke: true,
    hoeheAt() { hoehenAufrufe++; return -99; },
    bodenFarbe() { bodenAufrufe++; return [1, 0, 1]; }
  });
  const profil = PROFIL.wegrandProfil(opt);
  assert.ok(profil.every((p) => p.y === opt.deck));
  assert.equal(hoehenAufrufe, 0);
  assert.equal(bodenAufrufe, 0);
  const linksDistanz = Math.hypot(profil[0].x - opt.x, profil[0].z - opt.z);
  const rechtsDistanz = Math.hypot(profil[6].x - opt.x, profil[6].z - opt.z);
  assert.ok(Math.abs(linksDistanz - opt.links) < 1e-12);
  assert.ok(Math.abs(rechtsDistanz - opt.rechts) < 1e-12);
  assert.ok(profil[2].farbe[0] < profil[3].farbe[0],
    'Bruecken-Fahrspur hebt sich nicht von der Mitte ab');
});

test('Wegrand-Profil - Ausgabe ist deterministisch und validiert Eingaben', () => {
  assert.deepEqual(PROFIL.wegrandProfil(optionen()), PROFIL.wegrandProfil(optionen()));
  assert.throws(() => PROFIL.wegrandProfil(optionen({ links: 0 })), RangeError);
  assert.throws(() => PROFIL.wegrandProfil(optionen({ x: Number.NaN })), TypeError);
  assert.throws(() => PROFIL.wegrandProfil(optionen({ farbe: [0.4, Number.NaN, 0.2] })),
    TypeError);
});

test('Wegrand-Profil - Generator nutzt das Profil ohne neue Renderobjekte', () => {
  const quelle = fs.readFileSync(path.join(SRC, 'assets', 'wegrand-profil.js'), 'utf8');
  const generator = fs.readFileSync(path.join(SRC, 'generators', 'paths.js'), 'utf8');
  const ohneKommentare = quelle
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(ohneKommentare, /\bMath\s*\.\s*random\b|\bDate\s*(?:\.|\()/);
  assert.doesNotMatch(quelle, /\b(?:Mesh|InstancedMesh|Material)\s*\(/);
  assert.match(generator, /wegrandProfil\s*\(\s*\{/);
  assert.match(generator, /WEG_PROFIL_PUNKTE\s*-\s*1/);
});
