/**
 * Biome derivation — the Whittaker-style shortcut: temperature (latitude ×
 * elevation) and moisture (seeded noise) propose a biome per splat texel.
 * The result is written into the normal splat layer, so it stays fully
 * hand-paintable and undoes as one "Biom malen" step.
 *
 * Biome indices follow ATLAS3D_BIOMES (splat.ts):
 * 1 Wiese · 2 Wald · 3 Wüste · 4 Fels · 5 Schnee · 6 Wasser.
 */

import type { Vec3 } from "@uwe/atlas-editor/carve";
import { fbm } from "./planet-field";
import type { SplatGrid } from "./splat";

export interface BiomeSample {
  /** 0 warm equator … 1 frozen (already includes elevation cooling). */
  cold: number;
  /** 0 arid … 1 lush. */
  moisture: number;
  /** Surface elevation as fraction of radius (negative = below sea). */
  elevation: number;
}

/** Pure classifier — the single source of truth for both grid walkers. */
export function classifyBiome(sample: BiomeSample, waterLevel: number): number {
  if (sample.elevation <= waterLevel) return 6; // wasser
  if (sample.cold > 0.72) return 5; // schnee
  if (sample.elevation > 0.16) return 4; // fels
  if (sample.moisture < 0.34 && sample.cold < 0.45) return 3; // wueste
  if (sample.moisture > 0.55) return 2; // wald
  return 1; // wiese
}

/** Equirect direction for a splat texel (matches dirToUv's inverse). */
function texelDir(u: number, v: number): Vec3 {
  const lat = v * Math.PI; // 0 = north pole
  const lon = (u - 0.5) * Math.PI * 2;
  return [Math.sin(lat) * Math.cos(lon), Math.cos(lat), Math.sin(lat) * Math.sin(lon)];
}

/** Fill the globe splat from latitude × elevation × seeded moisture. */
export function deriveGlobeBiomes(options: {
  splat: SplatGrid;
  seed: number;
  elevationAt: (dir: Vec3) => number;
  waterLevel?: number;
}): void {
  const { splat, seed } = options;
  const waterLevel = options.waterLevel ?? 0;
  for (let y = 0; y < splat.height; y++) {
    const v = splat.height > 1 ? y / (splat.height - 1) : 0.5;
    for (let x = 0; x < splat.width; x++) {
      const u = x / splat.width;
      const dir = texelDir(u, v);
      const elevation = options.elevationAt(dir);
      const latitudeCold = Math.abs(v - 0.5) * 2; // 0 equator … 1 pole
      const cold = latitudeCold * 0.85 + Math.max(0, elevation) * 1.6;
      const moisture = fbm(dir[0] * 2.3, dir[1] * 2.3, dir[2] * 2.3, seed + 733);
      splat.data[y * splat.width + x] = classifyBiome({ cold, moisture, elevation }, waterLevel);
    }
  }
}

/** Fill a flat-level splat from elevation × seeded moisture (no latitude). */
export function derivePlanarBiomes(options: {
  splat: SplatGrid;
  seed: number;
  mapSize: number;
  heightAt: (x: number, z: number) => number;
  waterLevel?: number;
}): void {
  const { splat, seed, mapSize } = options;
  const waterLevel = options.waterLevel ?? 0;
  for (let y = 0; y < splat.height; y++) {
    const v = splat.height > 1 ? y / (splat.height - 1) : 0.5;
    for (let x = 0; x < splat.width; x++) {
      const u = splat.width > 1 ? x / (splat.width - 1) : 0.5;
      const mx = (u * 2 - 1) * mapSize;
      const mz = (v * 2 - 1) * mapSize;
      const elevation = options.heightAt(mx, mz);
      const cold = Math.max(0, elevation - waterLevel) * 2.2 + (fbm(mx * 0.9, 0, mz * 0.9, seed + 311) - 0.5) * 0.3;
      const moisture = fbm(mx * 1.7, 4.2, mz * 1.7, seed + 733);
      splat.data[y * splat.width + x] = classifyBiome({ cold, moisture, elevation }, waterLevel);
    }
  }
}
