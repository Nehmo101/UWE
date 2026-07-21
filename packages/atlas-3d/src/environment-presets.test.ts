import assert from "node:assert/strict";
import { test } from "node:test";
import { ENVIRONMENT_PRESETS, environmentPreset } from "./environment-presets";

test("all four times of day exist with normalized-ish light and valid colors", () => {
  for (const key of ["morning", "noon", "evening", "night"] as const) {
    const preset = ENVIRONMENT_PRESETS[key];
    assert.equal(preset.key, key);
    assert.ok(preset.label.length > 0);
    assert.ok(Math.hypot(...preset.lightDir) > 0.5);
    assert.match(preset.sky, /^#[0-9a-f]{6}$/i);
    assert.match(preset.fogColor, /^#[0-9a-f]{6}$/i);
    assert.equal(preset.tint.length, 3);
  }
});

test("night dims and blues the tint; evening warms it", () => {
  const night = ENVIRONMENT_PRESETS.night;
  assert.ok(night.tint[2] > night.tint[0], "night tint leans blue");
  assert.ok(night.tint[0] < 0.8, "night is dim");
  const evening = ENVIRONMENT_PRESETS.evening;
  assert.ok(evening.tint[0] > evening.tint[2], "evening tint leans warm");
});

test("unknown keys fall back to noon", () => {
  assert.equal(environmentPreset("banana").key, "noon");
  assert.equal(environmentPreset(undefined).key, "noon");
  assert.equal(environmentPreset("evening").key, "evening");
});
