/* ==========================================================================
   Ebene 4 — Shader-Anker

   terra veraendert die Shader von Three nicht durch eigene Materialien,
   sondern durch Textersatz in `onBeforeCompile`: an einer bekannten Stelle
   (`#include <name>`) wird zusaetzlicher GLSL-Code eingehaengt. Findet ein
   Patch seinen Anker nicht, meldet das Projekt eine Konsolenwarnung — und
   das Bild ist still kaputt (kein Wrap-Licht, kein Nebel, kein Schnee), ohne
   dass irgendetwas abstuerzt.

   Genau diese Klasse faengt dieser Test ab: JEDER Anker, den terra ersetzt,
   muss es in der GEPINNTEN Three-Fassung geben. Ein Versionssprung faellt
   damit hier laut auf statt spaeter im Bild.

   Die Anker werden NICHT von Hand gepflegt, sondern aus dem Quelltext der
   fuenf patchenden Dateien gelesen. Ein neuer Patch ist dadurch automatisch
   mitgeprueft.

   Geprueft wird gegen die echte Three-Datei, wenn sie erreichbar ist, sonst
   gegen die mitgelieferte Ankerliste — siehe hilfen/three-quelle.mjs.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SRC } from './hilfen/laden.mjs';
import { ANKERLISTE, echteThreeQuelle, includesVon } from './hilfen/three-quelle.mjs';

/* Die patchenden Dateien und das Three-Programm, in dessen Shader ihre Anker
   stehen muessen. Die Zuordnung folgt dem Material, an dem der Patch haengt:
     materials.js  terraMat() erzeugt ein MeshPhongMaterial   -> phong
     water.js      Wasser ueber terraMat, Schaum ueber Basic  -> phong + basic
     sky.js        Himmelskuppel/Wolken als Basic-Material    -> basic
     vfx.js        Partikel als MeshBasicMaterial (InstancedMesh) -> basic
     pipeline.js   eigene ShaderPasses, keine Chunk-Anker     -> keins */
const PATCHDATEIEN = [
  { datei: 'render/materials.js', programme: ['phong'] },
  { datei: 'world/water.js', programme: ['phong', 'basic'] },
  { datei: 'world/sky.js', programme: ['basic', 'sprite'] },
  { datei: 'world/vfx.js', programme: ['basic'] },
  { datei: 'render/pipeline.js', programme: ['basic', 'phong', 'depth'] }
];

function quelltext(rel) { return fs.readFileSync(path.join(SRC, rel), 'utf8'); }

/** Alle `#include <…>`-Anker einer Datei — auch die in Kommentaren genannten,
 *  denn die beschreiben dieselbe Stelle und sollen mitaltern. */
function ankerVon(rel) { return includesVon(quelltext(rel)); }

/* Textanker INNERHALB eines Chunks. Sie stehen in render/materials.js als
   Zeichenketten (aAlt, bAlt, fogKey) und lassen sich nicht aus einem
   `#include` ableiten — deshalb hier ausgeschrieben. Der erste Test unten
   sichert ab, dass diese Liste und materials.js nicht auseinanderlaufen. */
const CHUNK_TEXTANKER = {
  lights_phong_pars_fragment: [
    'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );',
    'vec3 irradiance = dotNL * directLight.color;'
  ],
  fog_fragment: [
    'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );'
  ]
};

const echt = await echteThreeQuelle();

test('Ebene 4 — die Ankerliste passt zur gepinnten Fassung', () => {
  assert.equal(ANKERLISTE.pin, '0.185.1', 'Ankerliste ist fuer eine andere Fassung');
  const importMap = fs.readFileSync(path.join(SRC, '..', 'index.html'), 'utf8');
  assert.ok(importMap.includes('three@' + ANKERLISTE.pin + '/build/three.module.js'),
    'terra/index.html pinnt eine andere Three-Fassung als die Ankerliste (' + ANKERLISTE.pin + ')');
  assert.ok(importMap.includes('three@' + ANKERLISTE.pin + '/examples/jsm/'),
    'Import-Map: three/addons zeigt auf eine andere Fassung');
});

test('Ebene 4 — jeder ersetzte Anker existiert in der gepinnten Fassung', async (t) => {
  const chunks = new Set(echt ? echt.chunks : ANKERLISTE.chunks);
  const programme = echt ? echt.programme : ANKERLISTE.programme;
  for (const { datei, programme: erlaubt } of PATCHDATEIEN) {
    await t.test(datei, () => {
      const anker = ankerVon(datei);
      if (!anker.length) return;                 // pipeline.js patcht ohne Chunks
      const unbekannt = anker.filter((a) => !chunks.has(a));
      assert.deepEqual(unbekannt, [],
        'Diese Chunks gibt es in Three ' + ANKERLISTE.revision + ' nicht (mehr)');

      const nichtImProgramm = [];
      for (const a of anker) {
        const gefunden = erlaubt.some((p) => programme[p] &&
          (programme[p].vertex.includes(a) || programme[p].fragment.includes(a)));
        if (!gefunden) nichtImProgramm.push(a);
      }
      assert.deepEqual(nichtImProgramm, [],
        'Anker kommen in keinem der Programme ' + erlaubt.join('/') + ' vor — ' +
        'der Patch wuerde zur Laufzeit still nichts tun');
    });
  }
});

test('Ebene 4 — die Textanker in den Chunks stehen so noch in materials.js', () => {
  const src = quelltext('render/materials.js');
  const fehlend = [];
  for (const chunk of Object.keys(CHUNK_TEXTANKER)) {
    for (const anker of CHUNK_TEXTANKER[chunk]) {
      if (!src.includes(anker)) fehlend.push(chunk + ': ' + anker);
    }
  }
  assert.deepEqual(fehlend, [],
    'materials.js ersetzt andere Textstellen als hier geprueft — diese Liste nachziehen');
  // Und umgekehrt: die beiden Chunks werden dort auch wirklich gelesen.
  assert.ok(src.includes('THREE.ShaderChunk.lights_phong_pars_fragment'));
  assert.ok(src.includes('THREE.ShaderChunk.fog_fragment'));
});

test('Ebene 4 — die Textanker existieren in den Chunks der gepinnten Fassung', (t) => {
  if (!echt) {
    /* Ohne die echte Datei bleibt nur die Aussage der Ankerliste: sie wurde
       aus der gepinnten Fassung erzeugt und enthaelt dieselben Textanker. */
    assert.deepEqual(ANKERLISTE.chunkAnker, CHUNK_TEXTANKER,
      'Ankerliste und Test nennen verschiedene Textanker');
    t.diagnostic('Keine echte Three-Quelle gefunden — geprueft wurde gegen ' +
      'fixtures/three-0.185.1-anker.json. Fuer die starke Pruefung siehe ' +
      'hilfen/three-quelle.mjs (TERRA_THREE oder terra/test/.three/).');
    return;
  }
  const fehlend = [];
  for (const chunk of Object.keys(CHUNK_TEXTANKER)) {
    const text = echt.ShaderChunk[chunk];
    if (!text) { fehlend.push(chunk + ' (Chunk fehlt ganz)'); continue; }
    for (const anker of CHUNK_TEXTANKER[chunk]) {
      if (!text.includes(anker)) fehlend.push(chunk + ': ' + anker);
    }
  }
  assert.deepEqual(fehlend, [], 'Textanker in Three ' + echt.revision + ' nicht gefunden');
});

test('Ebene 4 — die mitgelieferte Ankerliste ist noch aktuell', (t) => {
  if (!echt) {
    t.diagnostic('uebersprungen: keine echte Three-Quelle erreichbar');
    return;
  }
  assert.equal(echt.revision, ANKERLISTE.revision,
    'Die gefundene Three-Datei ist Revision ' + echt.revision +
    ', die Ankerliste beschreibt ' + ANKERLISTE.revision);
  assert.deepEqual(echt.chunks, ANKERLISTE.chunks, 'Chunk-Bestand weicht ab');
  for (const p of Object.keys(ANKERLISTE.programme)) {
    assert.deepEqual(echt.programme[p], ANKERLISTE.programme[p], 'Programm ' + p + ' weicht ab');
  }
});

test('Ebene 4 — die gepatchten Anker sind vollstaendig erfasst', () => {
  /* Gegenprobe gegen einen leeren Test: die Anker, von denen wir WISSEN, dass
     terra sie ersetzt, muessen in der gelesenen Liste auftauchen. Verschwindet
     einer aus dem Quelltext, faellt das hier auf und nicht erst im Bild. */
  const pflicht = {
    'render/materials.js': ['project_vertex', 'lights_phong_pars_fragment', 'lights_fragment_end',
      'fog_vertex', 'defaultnormal_vertex', 'fog_fragment', 'color_fragment',
      'opaque_fragment', 'uv_vertex'],
    'world/sky.js': ['map_fragment', 'map_pars_fragment'],
    'world/water.js': ['lights_fragment_end', 'alphatest_fragment'],
    'world/vfx.js': ['project_vertex', 'uv_vertex', 'color_fragment']
  };
  for (const datei of Object.keys(pflicht)) {
    const gefunden = new Set(ankerVon(datei));
    const fehlt = pflicht[datei].filter((a) => !gefunden.has(a));
    assert.deepEqual(fehlt, [], datei + ': erwartete Patch-Anker fehlen im Quelltext');
  }
});

test('Ebene 4 — jeder Patch meldet sich, wenn sein Anker fehlt', () => {
  /* Die Projektkonvention lautet: kein stiller Ausfall. Jede Datei, die
     Anker ersetzt, muss auch den Fehlerfall behandeln — geprueft ueber die
     Warnzeile, die render/materials.js vorgibt. */
  for (const { datei } of PATCHDATEIEN) {
    const src = quelltext(datei);
    if (!includesVon(src).length) continue;
    assert.ok(/console\.warn\([^)]*Anker nicht/.test(src) || /ersetze\(/.test(src),
      datei + ' ersetzt Anker, meldet aber nirgends, wenn einer fehlt');
  }
});
