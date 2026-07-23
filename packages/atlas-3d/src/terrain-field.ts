/**
 * Flat terrain field — continent/landscape/city levels as pure math.
 *
 * A planar heightfield (seeded fBm + planar sculpt heightmap) expressed as a
 * signed distance field (y minus surface height), so the same carve ops and
 * surface-nets mesher work as on the globe: canyons, caves and undercuts are
 * real geometry on flat levels too. The inherited parent silhouette is a hard
 * boundary: outside it the land sinks below the water level.
 */

import { applyCarveOps, carveOpDistance, type CarveOp, type Vec3 } from "@uwe/atlas-editor/carve";
import { distanceToPolygon, type Vec2 } from "@uwe/atlas-editor/geometry";
import { fbm, type HeightmapGrid } from "./planet-field";

export interface TerrainFieldOptions {
  seed: number;
  /** Map half-extent: terrain spans [-size, size] in x and z. */
  size: number;
  /** Max procedural height. */
  noiseAmplitude: number;
  noiseFrequency: number;
  /** Water level in world units (plane height). */
  waterLevel: number;
  heightmap: HeightmapGrid | null;
  carveOps: readonly CarveOp[];
  /** Locked boundary from the parent level (map units), or null. */
  silhouette: readonly Vec2[] | null;
}

export const TERRAIN_FIELD_DEFAULTS: TerrainFieldOptions = {
  seed: 1,
  size: 2,
  noiseAmplitude: 0.55,
  noiseFrequency: 0.9,
  waterLevel: 0,
  heightmap: null,
  carveOps: [],
  silhouette: null,
};

/** Map coordinates → planar heightmap UV in [0,1]². */
export function mapToUv(x: number, z: number, size: number): readonly [number, number] {
  return [(x / size + 1) / 2, (z / size + 1) / 2];
}

export function samplePlanarHeightmap(grid: HeightmapGrid, u: number, v: number): number {
  const x = Math.min(grid.width - 1, Math.max(0, u * (grid.width - 1)));
  const y = Math.min(grid.height - 1, Math.max(0, v * (grid.height - 1)));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(grid.width - 1, x0 + 1);
  const y1 = Math.min(grid.height - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const s = (xx: number, yy: number) => grid.data[yy * grid.width + xx];
  const top = s(x0, y0) + (s(x1, y0) - s(x0, y0)) * fx;
  const bottom = s(x0, y1) + (s(x1, y1) - s(x0, y1)) * fx;
  return top + (bottom - top) * fy;
}

/** Planar sculpt brush (map units); mirrors applyHeightBrush on the sphere. */
export function applyPlanarBrush(
  grid: HeightmapGrid,
  size: number,
  center: Vec2,
  radius: number,
  strength: number,
  mode: "raise" | "lower" | "smooth" | "flatten",
): void {
  const [cu, cv] = mapToUv(center[0], center[1], size);
  const texRadius = (radius / (size * 2)) * grid.width;
  const cx = cu * (grid.width - 1);
  const cy = cv * (grid.height - 1);
  const minX = Math.max(0, Math.floor(cx - texRadius - 1));
  const maxX = Math.min(grid.width - 1, Math.ceil(cx + texRadius + 1));
  const minY = Math.max(0, Math.floor(cy - texRadius - 1));
  const maxY = Math.min(grid.height - 1, Math.ceil(cy + texRadius + 1));

  let regionSum = 0;
  let regionCount = 0;
  if (mode === "smooth" || mode === "flatten") {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        regionSum += grid.data[y * grid.width + x];
        regionCount++;
      }
    }
  }
  const regionMean = regionCount > 0 ? regionSum / regionCount : 0;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const distance = Math.hypot(dx, dy);
      if (distance > texRadius) continue;
      const t = 1 - distance / Math.max(texRadius, 1e-6);
      const falloff = t * t * (3 - 2 * t);
      const index = y * grid.width + x;
      switch (mode) {
        case "raise":
          grid.data[index] += strength * falloff;
          break;
        case "lower":
          grid.data[index] -= strength * falloff;
          break;
        case "smooth":
          grid.data[index] += (regionMean - grid.data[index]) * falloff * Math.min(1, strength * 10);
          break;
        case "flatten":
          grid.data[index] += (0 - grid.data[index]) * falloff * Math.min(1, strength * 10);
          break;
      }
    }
  }
}

export interface TerrainField {
  readonly options: TerrainFieldOptions;
  /** Surface height at map coordinates (after silhouette masking). */
  height(x: number, z: number): number;
  /** Signed distance including carve subtraction. Negative = inside ground. */
  distance(p: Vec3): number;
  carveIndexAt(p: Vec3, epsilon?: number): number;
  /** Negative inside the silhouette; large negative when no silhouette. */
  silhouetteDistance(x: number, z: number): number;
}

export function createTerrainField(partial: Partial<TerrainFieldOptions>): TerrainField {
  const options: TerrainFieldOptions = { ...TERRAIN_FIELD_DEFAULTS, ...partial };
  const floor = options.waterLevel - options.noiseAmplitude * 0.9 - 0.25;

  function silhouetteDistance(x: number, z: number): number {
    if (!options.silhouette || options.silhouette.length < 3) return -options.size;
    return distanceToPolygon([x, z], options.silhouette);
  }

  function rawHeight(x: number, z: number): number {
    let h = (fbm(x * options.noiseFrequency + 5.2, 0, z * options.noiseFrequency + 8.7, options.seed, 5) - 0.48) *
      options.noiseAmplitude * 2;
    if (options.heightmap) {
      const [u, v] = mapToUv(x, z, options.size);
      h += samplePlanarHeightmap(options.heightmap, u, v);
    }
    return h;
  }

  function height(x: number, z: number): number {
    const h = rawHeight(x, z);
    const boundary = silhouetteDistance(x, z);
    if (boundary <= 0) {
      // inside: soften toward the edge so the rim reads as a drawn coastline
      const edge = Math.min(1, -boundary / (options.size * 0.08));
      return floor + (h - floor) * (0.35 + 0.65 * edge);
    }
    // outside the locked boundary the land sinks away
    const fall = Math.min(1, boundary / (options.size * 0.15));
    return h * (1 - fall) + floor * fall;
  }

  function distance(p: Vec3): number {
    const base = p[1] - height(p[0], p[2]);
    return applyCarveOps(base, p, options.carveOps);
  }

  function carveIndexAt(p: Vec3, epsilon = 0): number {
    let best = -1;
    let bestDepth = epsilon;
    for (let i = 0; i < options.carveOps.length; i++) {
      if (options.carveOps[i].disabled) continue;
      const d = carveOpDistance(options.carveOps[i], p);
      if (d < bestDepth) {
        bestDepth = d;
        best = i;
      }
    }
    return best;
  }

  return { options, height, distance, carveIndexAt, silhouetteDistance };
}
