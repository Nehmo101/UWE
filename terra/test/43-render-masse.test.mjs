import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_RENDER_PIXEL,
  berechneRenderMasse
} from '../src/render/render-masse.js';

test('normale Ansichten behalten volle Retina-Schaerfe', () => {
  const masse = berechneRenderMasse(1280, 720, 2);
  assert.equal(masse.pixelRatio, 2);
  assert.deepEqual(
    [masse.tiefenBreite, masse.tiefenHoehe],
    [1280, 720]
  );
});

test('DPR 1 und 1,5 werden nicht kuenstlich hochskaliert', () => {
  assert.equal(berechneRenderMasse(1280, 720, 1).pixelRatio, 1);
  assert.equal(berechneRenderMasse(1280, 720, 1.5).pixelRatio, 1.5);
});

test('sehr grosse Retina-Fenster bleiben innerhalb des 4K-Pixelbudgets', () => {
  const masse = berechneRenderMasse(2560, 1440, 2);
  assert.equal(masse.pixelRatio, 1.5);
  assert.ok(2560 * 1440 * masse.pixelRatio ** 2 <= MAX_RENDER_PIXEL);
  assert.deepEqual(
    [masse.tiefenBreite, masse.tiefenHoehe],
    [1920, 1080]
  );
});
