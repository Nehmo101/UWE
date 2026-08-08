// Tests für die Farb-Helfer der Graph-Engine (graph-engine-visuals.ts).

import test from "node:test";
import assert from "node:assert/strict";
import { darken, lighten, mixColors, withAlpha } from "./graph-engine-visuals";

test("mixColors mischt zwei Hex-Farben linear (t=0/0.5/1)", () => {
  assert.equal(mixColors("#000000", "#ffffff", 0), "rgb(0,0,0)");
  assert.equal(mixColors("#000000", "#ffffff", 1), "rgb(255,255,255)");
  assert.equal(mixColors("#000000", "#ffffff", 0.5), "rgb(128,128,128)");
});

test("mixColors klemmt t auf [0,1]", () => {
  assert.equal(mixColors("#000000", "#ffffff", -1), "rgb(0,0,0)");
  assert.equal(mixColors("#000000", "#ffffff", 2), "rgb(255,255,255)");
});

test("mixColors fällt bei unparsbarer Farbe auf colorA zurück", () => {
  assert.equal(mixColors("not-a-color", "#ffffff", 0.5), "not-a-color");
});

test("lighten hellt Richtung Weiß auf, darken Richtung Schwarz ab", () => {
  assert.equal(lighten("#808080", 1), "rgb(255,255,255)");
  assert.equal(darken("#808080", 1), "rgb(0,0,0)");
  assert.equal(lighten("#808080", 0), "rgb(128,128,128)");
});

test("withAlpha bleibt mit rgb()/rgba()-Eingaben kompatibel", () => {
  assert.equal(withAlpha("rgb(10,20,30)", 0.4), "rgba(10,20,30,0.4)");
  assert.equal(withAlpha("rgba(10,20,30,0.9)", 0.4), "rgba(10,20,30,0.4)");
});
