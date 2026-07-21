import assert from "node:assert/strict";
import { test } from "node:test";
import type { CarveOp } from "@uwe/atlas-editor/carve";
import {
  applyHeightBrush,
  cloneHeightmap,
  createHeightmap,
  createPlanetField,
  dirToUv,
  sampleHeightmap,
} from "./planet-field";
import { buildPlanetMeshData, cutFaceColorFor, PLANET_COLORS, surfaceColorFor } from "./planet-mesh";

test("field is deterministic per seed and differs across seeds", () => {
  const a = createPlanetField({ seed: 7 });
  const b = createPlanetField({ seed: 7 });
  const c = createPlanetField({ seed: 8 });
  const dir: [number, number, number] = [0.3, 0.5, 0.81];
  assert.equal(a.elevation(dir), b.elevation(dir));
  assert.notEqual(a.elevation(dir), c.elevation(dir));
});

test("distance is negative inside, positive outside", () => {
  const field = createPlanetField({ seed: 1, radius: 1 });
  assert.ok(field.distance([0, 0, 0]) < 0);
  assert.ok(field.distance([2, 0, 0]) > 0);
});

test("carve ops remove regions from the planet", () => {
  const bite: CarveOp = { id: "b", kind: "bite", center: [1, 0, 0], radius: 0.6 };
  const carved = createPlanetField({ seed: 1, carveOps: [bite] });
  const solid = createPlanetField({ seed: 1 });
  assert.ok(solid.distance([0.8, 0, 0]) < 0, "solid planet contains the point");
  assert.ok(carved.distance([0.8, 0, 0]) > 0, "bite removes it");
  assert.equal(carved.carveIndexAt([0.9, 0, 0]), 0);
  assert.equal(carved.carveIndexAt([-0.9, 0, 0]), -1);
});

test("heightmap brush raises terrain under the stroke only", () => {
  const grid = createHeightmap(64, 32);
  const north: [number, number, number] = [0, 0, 1];
  const south: [number, number, number] = [0, 0, -1];
  applyHeightBrush(grid, north, 0.3, 0.1, "raise");
  assert.ok(sampleHeightmap(grid, north) > 0.05, "raised at center");
  assert.equal(sampleHeightmap(grid, south), 0, "antipode untouched");
  const field = createPlanetField({ seed: 1, heightmap: grid });
  const plain = createPlanetField({ seed: 1 });
  assert.ok(field.elevation(north) > plain.elevation(north));
});

test("lower and flatten brushes counteract raise", () => {
  const grid = createHeightmap(64, 32);
  const spot: [number, number, number] = [1, 0, 0];
  applyHeightBrush(grid, spot, 0.25, 0.2, "raise");
  const raised = sampleHeightmap(grid, spot);
  const snapshot = cloneHeightmap(grid);
  applyHeightBrush(grid, spot, 0.25, 0.2, "lower");
  assert.ok(sampleHeightmap(grid, spot) < raised);
  applyHeightBrush(snapshot, spot, 0.25, 1, "flatten");
  assert.ok(Math.abs(sampleHeightmap(snapshot, spot)) < raised * 0.2, "flatten pulls toward zero");
});

test("dirToUv maps poles and equator sensibly", () => {
  assert.ok(Math.abs(dirToUv([0, 1, 0])[1]) < 1e-6, "north pole at v=0");
  assert.ok(Math.abs(dirToUv([0, -1, 0])[1] - 1) < 1e-6, "south pole at v=1");
  assert.ok(Math.abs(dirToUv([1, 0, 0])[1] - 0.5) < 1e-6, "equator at v=0.5");
});

test("planet mesh colors cut faces with strata and surface with palette bands", () => {
  const split: CarveOp = { id: "s", kind: "split", normal: [1, 0, 0], gap: 0.3 };
  const field = createPlanetField({ seed: 3, carveOps: [split] });
  const mesh = buildPlanetMeshData(field, { resolution: 28 });
  assert.ok(mesh.positions.length > 0);
  assert.equal(mesh.colors.length, mesh.positions.length);
  // some vertex near the cut plane must carry a strata/ember hue
  let strataFound = false;
  for (let v = 0; v < mesh.positions.length; v += 3) {
    if (Math.abs(mesh.positions[v]) < 0.16) {
      const rgb = [mesh.colors[v], mesh.colors[v + 1], mesh.colors[v + 2]] as const;
      const strata = [PLANET_COLORS.strataLight, PLANET_COLORS.strata, PLANET_COLORS.strataDark, PLANET_COLORS.ember];
      if (strata.some((s) => Math.abs(s[0] - rgb[0]) < 1e-6 && Math.abs(s[1] - rgb[1]) < 1e-6)) {
        strataFound = true;
        break;
      }
    }
  }
  assert.ok(strataFound, "cut face vertices use strata colors");
});

test("color bands: ocean is ink-blue, peaks are paper, deep cut is ember", () => {
  assert.deepEqual(surfaceColorFor(-0.1, 0), PLANET_COLORS.oceanDeep);
  assert.deepEqual(surfaceColorFor(0.2, 0), PLANET_COLORS.peak);
  assert.deepEqual(surfaceColorFor(0.01, 0.9), PLANET_COLORS.polar);
  assert.deepEqual(cutFaceColorFor(0.3), PLANET_COLORS.ember);
});
