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
  /* Die Regel gilt der TIEFENSTAFFELUNG und deshalb genau dem Pass, der sie
     rechnet: KanteBildShader (Kante, Kontakthof, Tiefenbaender, Palette,
     Papierkante). Dort darf kein Nachbarpixel des Farbbildes gelesen werden —
     sonst wuerde die Staffelung raeumlich weichzeichnen statt tonal zu wirken.

     Die Kantenglaettung am Ende der Kette ist ausdruecklich NICHT gemeint und
     war es nie: sie ist kein Weichzeichner, sondern ein Kantenfilter. Sie
     mischt nur dort, wo die Luminanzspanne der fuenf Kreuznachbarn eine
     Schwelle reisst, und nur QUER zur erkannten Kantenrichtung — auf einer
     Flaeche liefert sie Bit fuer Bit den Mittelwert zurueck. Der zweite Test
     unten haelt genau diese Eigenschaft fest.
     Geprueft wird deshalb der Quelltextabschnitt des Kante-Passes, nicht die
     ganze Datei. */
  const kanteVon = pipeline.indexOf('const KanteBildShader');
  const kanteBis = pipeline.indexOf('const KantenglaettungShader');
  assert.ok(kanteVon > 0 && kanteBis > kanteVon, 'KanteBildShader nicht gefunden');
  assert.doesNotMatch(pipeline.slice(kanteVon, kanteBis),
    /texture2D\s*\(\s*tDiffuse\s*,\s*vUv\s*[+-]/,
    'Tiefenstaffelung darf das Farbbild nicht raeumlich weichzeichnen');
  assert.match(pipeline, /t\.minFilter\s*=\s*t\.magFilter\s*=\s*THREE\.LinearFilter/,
    'die Palette soll weich zwischen Stuetzfarben interpolieren');
  assert.match(pipeline, /float wellig/,
    'die Papierkante bleibt weich und organisch, nur das Pixelrauschen entfaellt');
});

test('Kantenglaettung greift nur an Kanten und laesst Flaechen unberuehrt', () => {
  const von = pipeline.indexOf('const KantenglaettungShader');
  assert.ok(von > 0, 'die Kantenglaettung fehlt — Silhouetten treppen wieder');
  const shader = pipeline.slice(von, pipeline.indexOf('function initPipeline', von));
  // Der Frueh-Ausstieg IST die Zusage: liegt die Luminanzspanne der fuenf
  // Kreuznachbarn unter der Schwelle, wird der Mittelwert unveraendert
  // zurueckgegeben. Ohne ihn waere der Pass ein Vollbild-Weichzeichner.
  assert.match(shader, /if \( spanne < max\( uMinKante, lMax \* uKante \) \)/);
  assert.match(shader, /gl_FragColor = vec4\( mitteRGB, 1\.0 \);[\s\S]{0,24}return;/);
  // Sie mischt entlang der ERKANNTEN Richtung, nicht mit festen Nachbarn.
  assert.match(shader, /richtung = clamp\( richtung \* kehr, -uSpanne, uSpanne \) \* t;/);
  // Und sie laeuft nach dem OutputPass, also auf gammakodierten Werten.
  assert.match(pipeline, /composer\.addPass\(outputPass\);\s*\n\s*composer\.addPass\(aaPass\);/);
  assert.doesNotMatch(shader, /\buZeit\b|\bkorn\b/);
});

test('Retina-Aufloesung bleibt bei Asset-Schau, Resize und Depth-Pass konsistent', () => {
  assert.doesNotMatch(pipeline, /assetSchauDpr|schau'\)\s*===\s*'assets'\s*\?\s*1\.5/);
  // Seit der Leistungsrunde nimmt der Aufruf die adaptive Renderskala als
  // vierten Parameter mit — ohne Skala (1) ist das Ergebnis byteidentisch.
  assert.match(pipeline,
    /berechneRenderMasse\(w,\s*h,\s*window\.devicePixelRatio,\s*renderSkala\)/);
  assert.match(pipeline, /new THREE\.WebGLRenderTarget\(\s*w,\s*h,/);
  assert.match(pipeline, /composer\.setPixelRatio\(pr\)/);
  assert.doesNotMatch(pipeline, /bloomPass\.setSize\(w,\s*h\)/);
  assert.match(pipeline, /uTexel\.value\.set\(1\s*\/\s*dw,\s*1\s*\/\s*dh\)/);
  assert.match(textures, /textur\.anisotropy\s*=\s*wert/);
  assert.match(pipeline,
    /setzeTexturAnisotropie\(Math\.min\(8,\s*renderer\.capabilities\.getMaxAnisotropy\(\)\)\)/);
});
