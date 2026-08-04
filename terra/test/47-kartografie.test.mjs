import test from 'node:test';
import assert from 'node:assert/strict';
import { ATLAS_STILE, ATLAS_STANDARD, atlasFarbe, wasserFarbe, hoehenIndex, hoeheInterpoliert, weltZuAtlas, atlasTitel } from '../src/editor/kartografie.js';
import { zeichneGebirge } from '../src/editor/kartografie-zeichen.js';

test('Atlasfarben sind deterministisch und bleiben im RGB-Bereich', () => {
  assert.deepEqual(atlasFarbe(8, .2, 'gemalt', 17, 23, 1337), atlasFarbe(8, .2, 'gemalt', 17, 23, 1337));
  for (const wert of atlasFarbe(90, 12, 'pergament', 2, 9, 5)) assert.ok(wert >= 0 && wert <= 255);
  for (const wert of wasserFarbe(-9, 'tinte', 2, 9, 5)) assert.ok(wert >= 0 && wert <= 255);
  assert.equal(ATLAS_STILE.gemalt.akzent, '#a33d31');
  assert.equal(ATLAS_STANDARD, 'pergament');
  assert.equal(ATLAS_STILE.tinte.akzent, ATLAS_STILE.tinte.tinte);

});

test('Raster- und Weltkoordinaten treffen Rand und Mitte exakt', () => {
  assert.equal(hoehenIndex(0, 0, 513, 513, 257), 0);
  assert.equal(hoehenIndex(512, 512, 513, 513, 257), 257 * 257 - 1);
  assert.deepEqual(weltZuAtlas(0, 0, 1000, 800, 128), { x: 500, y: 400 });
  assert.equal(hoeheInterpoliert(new Float32Array([0, 10, 20, 30]), 2, .5, .5, 2, 2), 15);
});

test('Kartentitel besitzt einen druckbaren Fallback', () => {
  assert.equal(atlasTitel('  Eibenwald  '), 'Eibenwald');
  assert.equal(atlasTitel('  '), 'Unbenannte Terra-Karte');
});

test('Gebirgssignaturen sind ortsstabil und bleiben endlich', () => {
  const feld = new Float32Array(17 * 17);
  for (let j = 0; j < 17; j++) for (let i = 0; i < 17; i++) feld[j * 17 + i] = 8 + i * .45 + j * .2;
  const fake = {
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {},
    closePath() {}, arc() {}, translate() {}, fillText() {}, quadraticCurveTo() {}, strokeRect() {},
    fillRect() {}, set strokeStyle(_v) {}, set fillStyle(_v) {}, set lineCap(_v) {},
    set lineJoin(_v) {}, set lineWidth(_v) {}, set globalAlpha(_v) {}, set font(_v) {}, set textAlign(_v) {}
  };
  const stil = ATLAS_STILE.gemalt;
  const a = zeichneGebirge(fake, feld, 17, 512, 512, stil, 1337);
  const b = zeichneGebirge(fake, feld, 17, 512, 512, stil, 1337);
  assert.deepEqual(a, b);
  assert.ok(a.length > 0);
  assert.ok(a.every((p) => Number.isFinite(p.x + p.y + p.h)));
});
