import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyBiome, deriveGlobeBiomes, derivePlanarBiomes } from "./biome-derive";
import { createSplat } from "./splat";

test("classifyBiome covers the Whittaker corners", () => {
  assert.equal(classifyBiome({ cold: 0.2, moisture: 0.5, elevation: -0.05 }, 0), 6, "below sea → wasser");
  assert.equal(classifyBiome({ cold: 0.9, moisture: 0.5, elevation: 0.05 }, 0), 5, "frozen → schnee");
  assert.equal(classifyBiome({ cold: 0.3, moisture: 0.5, elevation: 0.3 }, 0), 4, "high → fels");
  assert.equal(classifyBiome({ cold: 0.2, moisture: 0.1, elevation: 0.05 }, 0), 3, "hot + arid → wueste");
  assert.equal(classifyBiome({ cold: 0.3, moisture: 0.8, elevation: 0.05 }, 0), 2, "lush → wald");
  assert.equal(classifyBiome({ cold: 0.3, moisture: 0.45, elevation: 0.05 }, 0), 1, "default → wiese");
});

test("globe derivation: snow at the poles, water below sea level", () => {
  const splat = createSplat(64, 32);
  deriveGlobeBiomes({ splat, seed: 7, elevationAt: (dir) => (dir[1] > 0.999 || dir[1] < -0.999 ? 0.05 : dir[0] < 0 ? -0.1 : 0.05) });
  assert.equal(splat.data[0], 5, "north pole texel is schnee");
  // a texel on the equator at u=0 (lon = -π → x ≈ -1) is below sea → wasser
  const y = 16;
  const x = 0;
  assert.equal(splat.data[y * 64 + x], 6, "submerged side is wasser");
  assert.ok(splat.data.every((v) => v >= 1 && v <= 6), "every texel classified");
});

test("planar derivation is deterministic and fully classified", () => {
  const a = createSplat(32, 32);
  const b = createSplat(32, 32);
  const heightAt = (x: number, z: number) => 0.1 * Math.sin(x * 3) * Math.cos(z * 2);
  derivePlanarBiomes({ splat: a, seed: 11, mapSize: 2, heightAt, waterLevel: 0 });
  derivePlanarBiomes({ splat: b, seed: 11, mapSize: 2, heightAt, waterLevel: 0 });
  assert.deepEqual(Array.from(a.data), Array.from(b.data));
  assert.ok(a.data.every((v) => v >= 1 && v <= 6));
  assert.ok(new Set(a.data).size >= 2, "more than one biome appears");
});
