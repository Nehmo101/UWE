import assert from "node:assert/strict";
import { test } from "node:test";
import type { Atlas3DChainEntry } from "./doc";
import { resolveEffectiveNodeSettings, ATLAS3D_DEFAULT_PALETTE_SCOPE } from "./inheritance";

const world: Atlas3DChainEntry = {
  id: "world",
  title: "Welt",
  level: "world",
  stylePreset: "pergament",
  seed: 42,
  environment: { timeOfDay: "noon", lightAzimuthDeg: 315, fogDensity: 0, waterLevel: 0, climate: "temperate" },
};

test("empty chain falls back to defaults", () => {
  const settings = resolveEffectiveNodeSettings([]);
  assert.equal(settings.stylePreset, "pergament");
  assert.equal(settings.environment.timeOfDay, "noon");
  assert.equal(settings.origins.stylePreset, "default");
  assert.deepEqual(settings.paletteScope, ATLAS3D_DEFAULT_PALETTE_SCOPE);
});

test("leaf inherits everything from the world entry", () => {
  const settings = resolveEffectiveNodeSettings([
    world,
    { id: "globe", title: "Globus", level: "globe" },
    { id: "continent", title: "Velthara", level: "continent" },
  ]);
  assert.equal(settings.stylePreset, "pergament");
  assert.equal(settings.seed, 42);
  assert.equal(settings.origins.stylePreset, "world");
  assert.equal(settings.origins.environment.timeOfDay, "world");
});

test("intermediate override wins for descendants, field-by-field", () => {
  const settings = resolveEffectiveNodeSettings([
    world,
    { id: "globe", title: "Globus", level: "globe" },
    { id: "continent", title: "Velthara", level: "continent", environment: { timeOfDay: "evening" } },
    { id: "landscape", title: "Aschmark", level: "landscape", environment: { fogDensity: 0.8 } },
  ]);
  assert.equal(settings.environment.timeOfDay, "evening");
  assert.equal(settings.origins.environment.timeOfDay, "continent");
  assert.equal(settings.environment.fogDensity, 0.8);
  assert.equal(settings.origins.environment.fogDensity, "landscape");
  // untouched fields keep the world origin
  assert.equal(settings.environment.waterLevel, 0);
  assert.equal(settings.origins.environment.waterLevel, "world");
});

test("style preset overrides cascade below the overriding node", () => {
  const settings = resolveEffectiveNodeSettings([
    world,
    { id: "globe", title: "Globus", level: "globe", stylePreset: "aschewelt" },
    { id: "continent", title: "Velthara", level: "continent" },
  ]);
  assert.equal(settings.stylePreset, "aschewelt");
  assert.equal(settings.origins.stylePreset, "globe");
});

test("palette scope narrows per level and is inherited", () => {
  const settings = resolveEffectiveNodeSettings([
    world,
    { id: "globe", title: "Globus", level: "globe", paletteScope: ["weltenbau"] },
    { id: "continent", title: "Velthara", level: "continent" },
  ]);
  assert.deepEqual(settings.paletteScope, ["weltenbau"]);
  assert.equal(settings.origins.paletteScope, "globe");
});
