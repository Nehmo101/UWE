/**
 * Flat terrain mesh data — buffers for continent/landscape/city levels.
 *
 * Colors: painted biome splat wins, otherwise a stepless elevation gradient
 * (ink-blue below water → sand shore → teal meadows → sepia rock → paper
 * peaks). Cut faces use the shared strata/ember scheme.
 */

import type { Vec3 } from "@uwe/atlas-editor/carve";
import { surfaceNets } from "./surface-nets";
import { cutFaceColorFor, PLANET_COLORS } from "./planet-mesh";
import { biomeColorRgb, sampleSplat, type SplatGrid } from "./splat";
import { mapToUv, type TerrainField } from "./terrain-field";

export interface TerrainMeshData {
  positions: Float32Array;
  indices: Uint32Array;
  colors: Float32Array;
}

function mix(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): readonly [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function terrainSurfaceColor(height: number, waterLevel: number): readonly [number, number, number] {
  const h = height - waterLevel;
  if (h < -0.15) return PLANET_COLORS.oceanDeep;
  if (h < -0.02) return PLANET_COLORS.ocean;
  if (h < 0.02) return PLANET_COLORS.coast;
  if (h < 0.22) return mix(PLANET_COLORS.lowland, PLANET_COLORS.midland, Math.min(1, (h - 0.02) / 0.2));
  if (h < 0.45) return mix(PLANET_COLORS.midland, PLANET_COLORS.highland, (h - 0.22) / 0.23);
  if (h < 0.62) return mix(PLANET_COLORS.highland, PLANET_COLORS.peak, (h - 0.45) / 0.17);
  return PLANET_COLORS.peak;
}

export interface BuildTerrainMeshOptions {
  resolution: number;
  splat: SplatGrid | null;
  /** Vertical bounds of the sampling box. */
  minY?: number;
  maxY?: number;
}

export function buildTerrainMeshData(field: TerrainField, options: BuildTerrainMeshOptions): TerrainMeshData {
  const size = field.options.size;
  const minY = options.minY ?? field.options.waterLevel - 1.4;
  const maxY = options.maxY ?? field.options.waterLevel + 1.6;
  const n = options.resolution;
  const ny = Math.max(10, Math.round((n * (maxY - minY)) / (size * 2)));
  const mesh = surfaceNets(
    (x, y, z) => field.distance([x, y, z]),
    [-size, minY, -size],
    [size, maxY, size],
    [n, ny, n],
  );

  const colors = new Float32Array(mesh.positions.length);
  const vertexCount = mesh.positions.length / 3;
  const cellSize = (size * 2) / n;
  for (let v = 0; v < vertexCount; v++) {
    const p: Vec3 = [mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2]];
    const carveIndex = field.carveIndexAt(p, cellSize * 0.8);
    let rgb: readonly [number, number, number];
    if (carveIndex >= 0) {
      const depth = Math.min(1, Math.max(0, (p[1] - minY) / Math.max(1e-6, maxY - minY)));
      rgb = cutFaceColorFor(depth);
    } else {
      let biome = 0;
      if (options.splat) {
        const [u, uvV] = mapToUv(p[0], p[2], size);
        biome = sampleSplat(options.splat, u, uvV);
      }
      const biomeRgb = biome > 0 ? biomeColorRgb(biome) : null;
      rgb = biomeRgb ?? terrainSurfaceColor(p[1], field.options.waterLevel);
    }
    colors[v * 3] = rgb[0];
    colors[v * 3 + 1] = rgb[1];
    colors[v * 3 + 2] = rgb[2];
  }

  return { positions: mesh.positions, indices: mesh.indices, colors };
}
