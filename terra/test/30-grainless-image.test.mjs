/* ==========================================================================
   Ruhiges Bild — keine bildschirmfeste Koernung

   Malerische Materialtexturen und weiche Tiefenstaffelung bleiben erhalten.
   Verboten sind dagegen Vollbild-Korn, Bayer-Dither und eine CSS-Wash-Lage,
   die unabhaengig vom dargestellten Objekt ueber jedem Pixel liegen.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SRC } from './hilfen/laden.mjs';

const pipeline = fs.readFileSync(path.join(SRC, 'render', 'pipeline.js'), 'utf8');
const textures = fs.readFileSync(path.join(SRC, 'render', 'textures.js'), 'utf8');
const css = fs.readFileSync(path.join(SRC, 'ui', 'storybook.css'), 'utf8');
const basisCss = fs.readFileSync(path.join(SRC, 'ui', 'style.css'), 'utf8');
const main = fs.readFileSync(path.join(SRC, 'main.js'), 'utf8');

test('Bildpipeline legt kein Korn, Dither oder Malschicht-Sampling ueber das Vollbild', () => {
  for (const muster of [
    /\buKorn\b/, /float\s+korn\s*\(/, /papierRauschen\s*\(/,
    /bayer4\s*\(/, /\buPaletteQuant\b/, /\buMalStaerke\b/,
    /texture2D\s*\(\s*tMal\b/, /\buZeit\b/
  ]) assert.doesNotMatch(pipeline, muster);

  assert.doesNotMatch(main, /setMalschicht\s*\(/,
    'der Standardstart darf die alte Vollbild-Malschicht nicht aktivieren');
  assert.doesNotMatch(main, /quant\s*:/,
    'der Standardstart darf keinen Pixel-Dither konfigurieren');
  assert.match(pipeline, /palette\.quant\s*=\s*0/,
    'alte Kartenfelder muessen Dither weiterhin sicher abgeschaltet lassen');
  assert.match(pipeline, /malschicht\.staerke\s*=\s*0/,
    'alte Kartenfelder muessen die Vollbildstruktur sicher abgeschaltet lassen');
});

test('UI legt weder Textur, Farbwaschung noch CSS-Filter ueber das Vollbild', () => {
  assert.doesNotMatch(css, /painted-wash/i);
  assert.doesNotMatch(css, /body::before/);
  assert.doesNotMatch(css, /body::after/);
  assert.doesNotMatch(css + basisCss, /canvas\s*\{[^}]*filter\s*:/s);
});

test('malerische Flaechen bleiben, Tiefenstaffelung ist rein tonal und scharf', () => {
  assert.match(textures, /aquarellGrob/);
  assert.match(textures, /aquarellMittel/);
  assert.match(textures, /aquarellFein/);
  assert.match(pipeline, /uMultiStaerke/);
  assert.match(pipeline, /uMultiGrenzen/);
  assert.doesNotMatch(pipeline, /uMultiWeich/);
  assert.doesNotMatch(pipeline, /\bverwischt\b/);
  assert.doesNotMatch(pipeline,
    /texture2D\s*\(\s*tDiffuse\s*,\s*vUv\s*[+-]/,
    'Tiefenstaffelung darf das Farbbild nicht raeumlich weichzeichnen');
  assert.match(pipeline, /t\.minFilter\s*=\s*t\.magFilter\s*=\s*THREE\.LinearFilter/,
    'die Palette soll weich zwischen Stuetzfarben interpolieren');
  assert.match(pipeline, /float wellig/,
    'die Papierkante bleibt weich und organisch, nur das Pixelrauschen entfaellt');
});

test('Retina-Aufloesung bleibt bei Asset-Schau, Resize und Depth-Pass konsistent', () => {
  assert.doesNotMatch(pipeline, /assetSchauDpr|schau'\)\s*===\s*'assets'\s*\?\s*1\.5/);
  assert.match(pipeline, /berechneRenderMasse\(w,\s*h,\s*window\.devicePixelRatio\)/);
  assert.match(pipeline, /new THREE\.WebGLRenderTarget\(\s*w,\s*h,/);
  assert.match(pipeline, /composer\.setPixelRatio\(pr\)/);
  assert.doesNotMatch(pipeline, /bloomPass\.setSize\(w,\s*h\)/);
  assert.match(pipeline, /uTexel\.value\.set\(1\s*\/\s*dw,\s*1\s*\/\s*dh\)/);
  assert.match(textures, /textur\.anisotropy\s*=\s*wert/);
  assert.match(pipeline,
    /setzeTexturAnisotropie\(Math\.min\(8,\s*renderer\.capabilities\.getMaxAnisotropy\(\)\)\)/);
});
