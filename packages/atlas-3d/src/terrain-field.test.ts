import assert from "node:assert/strict";
import { test } from "node:test";
import type { CarveOp } from "@uwe/atlas-editor/carve";
import type { Vec2 } from "@uwe/atlas-editor/geometry";
import { createHeightmap } from "./planet-field";
import { applyPlanarBrush, createTerrainField, mapToUv } from "./terrain-field";
import { buildTerrainMeshData, terrainSurfaceColor } from "./terrain-mesh";
import { PLANET_COLORS } from "./planet-mesh";
import { applySplatBrush, biomeColorRgb, createSplat, sampleSplat, splatFromJson, splatToJson } from "./splat";

const triangle: Vec2[] = [
  [-1.2, -1.0],
  [1.2, -1.0],
  [0, 1.2],
];

test("terrain field is deterministic and silhouette masks the outside", () => {
  const a = createTerrainField({ seed: 5, silhouette: triangle });
  const b = createTerrainField({ seed: 5, silhouette: triangle });
  assert.equal(a.height(0.1, -0.2), b.height(0.1, -0.2));
  // far outside the triangle the land sinks below water
  assert.ok(a.height(1.9, 1.9) < a.options.waterLevel - 0.2, "outside sinks below the water level");
  assert.ok(a.silhouetteDistance(0, 0) < 0, "center is inside");
  assert.ok(a.silhouetteDistance(1.9, 1.9) > 0, "corner is outside");
});

test("planar sculpt brush raises only under the stroke", () => {
  const grid = createHeightmap(96, 96);
  applyPlanarBrush(grid, 2, [0.4, -0.3], 0.5, 0.3, "raise");
  const field = createTerrainField({ seed: 2, heightmap: grid });
  const plain = createTerrainField({ seed: 2 });
  assert.ok(field.height(0.4, -0.3) > plain.height(0.4, -0.3) + 0.15, "raised at brush center");
  assert.ok(Math.abs(field.height(-1.5, 1.5) - plain.height(-1.5, 1.5)) < 1e-9, "far corner untouched");
});

test("carve ops cut real geometry out of flat terrain", () => {
  const cave: CarveOp = { id: "c", kind: "cave", center: [0, -0.4, 0], radius: 0.3 };
  const field = createTerrainField({ seed: 3, carveOps: [cave] });
  assert.ok(field.distance([0, -0.4, 0]) > 0, "cave interior is empty");
  assert.ok(field.distance([1, -0.4, 1]) < 0, "elsewhere stays solid");
});

test("terrain mesh uses splat biome colors where painted", () => {
  const splat = createSplat(64, 64);
  // paint desert (biome 3) around the map center
  applySplatBrush(splat, 0.5, 0.5, 0.2, 3);
  const field = createTerrainField({ seed: 4 });
  const mesh = buildTerrainMeshData(field, { resolution: 40, splat });
  assert.ok(mesh.positions.length > 0);
  const desert = biomeColorRgb(3);
  assert.ok(desert);
  let found = 0;
  for (let v = 0; v < mesh.positions.length; v += 3) {
    const x = mesh.positions[v];
    const z = mesh.positions[v + 2];
    if (Math.hypot(x, z) < 0.3) {
      if (Math.abs(mesh.colors[v] - desert[0]) < 1e-6 && Math.abs(mesh.colors[v + 1] - desert[1]) < 1e-6) found++;
    }
  }
  assert.ok(found > 0, "painted center vertices carry the desert color");
});

test("splat brush + serialization round-trip", () => {
  const splat = createSplat(32, 32);
  applySplatBrush(splat, 0.25, 0.25, 0.1, 2);
  assert.equal(sampleSplat(splat, 0.25, 0.25), 2);
  assert.equal(sampleSplat(splat, 0.8, 0.8), 0);
  const restored = splatFromJson(splatToJson(splat));
  assert.ok(restored);
  assert.deepEqual(Array.from(restored.data), Array.from(splat.data));
  assert.equal(splatFromJson({ encoding: "u8-base64", width: 4, height: 4, data: "AA==" }), null);
});

test("uv mapping covers the map extent", () => {
  assert.deepEqual(mapToUv(-2, -2, 2), [0, 0]);
  assert.deepEqual(mapToUv(2, 2, 2), [1, 1]);
  assert.deepEqual(mapToUv(0, 0, 2), [0.5, 0.5]);
});

test("terrain color gradient: water is ink-blue, peaks are paper", () => {
  assert.deepEqual(terrainSurfaceColor(-0.5, 0), PLANET_COLORS.oceanDeep);
  assert.deepEqual(terrainSurfaceColor(0.9, 0), PLANET_COLORS.peak);
});
