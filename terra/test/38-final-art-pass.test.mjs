/* ==========================================================================
   Final-Art-Pass - filmische Tiefe ohne zusaetzliche Renderlast

   Die Veredelung bleibt absichtlich in vorhandenen Shadern und Instanzen:
   keine Vollbild-Koernung, keine neue Textur und kein weiterer Renderpass.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SRC } from './hilfen/laden.mjs';

const lesen = (...teile) => fs.readFileSync(path.join(SRC, ...teile), 'utf8');
const sky = lesen('world', 'sky.js');
const water = lesen('world', 'water.js');
const materials = lesen('render', 'materials.js');
const pipeline = lesen('render', 'pipeline.js');

test('Wolken gewinnen Volumen und im Luftarchipel echte Tiefenstaffelung', () => {
  assert.match(sky, /terraWolkenKern/);
  assert.match(sky, /diffuseColor\.a \*= smoothstep/);
  assert.match(sky, /LUFT_WOLKEN_ABSENKUNG = \[145, 90, 25\]/);
  assert.match(sky, /S\.biom === 'luftarchipel' \? LUFT_WOLKEN_ABSENKUNG\[c\.lage\] : 0/);
  assert.equal((sky.match(/new THREE\.InstancedMesh/g) || []).length, 2,
    'Wolken und Cirren muessen bei ihren zwei bestehenden Instanz-Draws bleiben');
});

test('Meer und Seen beleuchten die vorhandene Woge statt eine Normalmap zu laden', () => {
  assert.match(water, /function patchWasserNormale/);
  assert.match(water, /cross\( dFdx\( vViewPosition \), dFdy\( vViewPosition \) \)/);
  assert.match(water, /terraWasserLuft/);
  assert.match(water, /terraSeeLuft/);
  assert.equal((water.match(/patchWasserNormale\(shader\);/g) || []).length, 2,
    'Wogennormalen duerfen nur an Meer und Seeflaeche gebunden sein');
  assert.doesNotMatch(water, /new THREE\.TextureLoader/);
});

test('Fernharmonie und Kontaktkante nutzen bestehende Daten ohne neuen Pass', () => {
  assert.match(materials, /terraHoch/);
  assert.match(materials, /terraFern \* terraHoch \* 0\.18/);
  assert.match(materials, /terraFern \* 0\.055/);
  assert.match(pipeline, /float fussKante/);
  assert.match(pipeline, /max\( max\( bl, b \), br \)/);
  assert.equal((pipeline.match(/new ShaderPass/g) || []).length, 3,
    'Final-Art-Pass darf keinen weiteren Vollbildpass einfuehren');
  assert.doesNotMatch(pipeline, /\buKorn\b|float\s+korn\s*\(|\bbayer4\s*\(/);
});
