import assert from "node:assert/strict";
import test from "node:test";
import { boxToPixelRect, isCroppableRegionType, MIN_CROP_PIXELS } from "./crop";

const PAGE = { width: 1000, height: 2000 };

test("rechnet normierte Modellkoordinaten in Pixel um", () => {
  const rect = boxToPixelRect({ x1: 100, y1: 250, x2: 600, y2: 750 }, PAGE);

  assert.deepEqual(rect, { left: 100, top: 500, width: 500, height: 1000 });
});

test("beschneidet Boxen, die über den Seitenrand hinausragen", () => {
  const rect = boxToPixelRect({ x1: 900, y1: 900, x2: 1400, y2: 1400 }, PAGE);

  assert.ok(rect);
  assert.equal(rect.left + rect.width, PAGE.width);
  assert.equal(rect.top + rect.height, PAGE.height);
});

test("verwirft Zuschnitte unter der Mindestgröße", () => {
  // 10/1000 der Breite sind 10 px — deutlich unter MIN_CROP_PIXELS.
  assert.equal(boxToPixelRect({ x1: 0, y1: 0, x2: 10, y2: 10 }, PAGE), null);
});

test("akzeptiert einen Zuschnitt genau auf der Mindestgröße", () => {
  const span = MIN_CROP_PIXELS;
  const rect = boxToPixelRect({ x1: 0, y1: 0, x2: span, y2: span / 2 }, PAGE);

  assert.ok(rect);
  assert.equal(rect.width, MIN_CROP_PIXELS);
});

test("Seiten ohne Maße ergeben keinen Zuschnitt", () => {
  assert.equal(boxToPixelRect({ x1: 0, y1: 0, x2: 500, y2: 500 }, { width: 0, height: 0 }), null);
});

test("schneidet nur Bildhaftes zu, keine Textblöcke", () => {
  for (const type of ["figure", "image", "map", "chart", "Diagram"]) {
    assert.equal(isCroppableRegionType(type), true, type);
  }
  for (const type of ["text", "title", "table", "footer", ""]) {
    assert.equal(isCroppableRegionType(type), false, type);
  }
});
