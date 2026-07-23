/**
 * Terrain stamps — one-click landform profiles (Krater · Gebirge · Dünen),
 * composed from the existing sculpt brushes so globe and flat levels share
 * the math. Deterministic: same click + parameters → same stamp.
 */

import type { Vec3 } from "@uwe/atlas-editor/carve";
import { applyHeightBrush, fbm, type HeightmapGrid } from "./planet-field";
import { applyPlanarBrush, mapToUv } from "./terrain-field";

export const TERRAIN_STAMPS = [
  { key: "krater", label: "Krater" },
  { key: "gebirge", label: "Gebirge" },
  { key: "duenen", label: "Dünen" },
] as const;

export type TerrainStampKind = (typeof TERRAIN_STAMPS)[number]["key"];

export interface StampOptions {
  kind: TerrainStampKind;
  /** Brush radius — radians on the globe, map units on flat levels. */
  radius: number;
  strength: number;
}

interface StampStroke {
  /** Offset from the stamp center in tangent units (relative to radius). */
  offset: readonly [number, number];
  radiusFactor: number;
  strengthFactor: number;
  mode: "raise" | "lower";
}

/** Shared stroke plans — offsets are in units of the stamp radius. */
function stampStrokes(kind: TerrainStampKind): StampStroke[] {
  switch (kind) {
    case "krater": {
      const rim: StampStroke[] = [];
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        rim.push({
          offset: [Math.cos(angle) * 0.8, Math.sin(angle) * 0.8],
          radiusFactor: 0.38,
          strengthFactor: 0.55,
          mode: "raise",
        });
      }
      return [{ offset: [0, 0], radiusFactor: 0.62, strengthFactor: 1.2, mode: "lower" }, ...rim];
    }
    case "gebirge":
      return [
        { offset: [0, 0], radiusFactor: 0.5, strengthFactor: 1.6, mode: "raise" },
        { offset: [-0.55, -0.25], radiusFactor: 0.34, strengthFactor: 0.8, mode: "raise" },
        { offset: [0.5, -0.35], radiusFactor: 0.3, strengthFactor: 0.7, mode: "raise" },
        { offset: [0.25, 0.55], radiusFactor: 0.32, strengthFactor: 0.75, mode: "raise" },
        { offset: [-0.3, 0.5], radiusFactor: 0.28, strengthFactor: 0.6, mode: "raise" },
      ];
    case "duenen": {
      const stripes: StampStroke[] = [];
      for (let i = -2; i <= 2; i++) {
        stripes.push({ offset: [0, i * 0.42], radiusFactor: 0.55, strengthFactor: 0.45, mode: "raise" });
        stripes.push({ offset: [0.35, i * 0.42 + 0.21], radiusFactor: 0.4, strengthFactor: 0.25, mode: "lower" });
      }
      return stripes;
    }
  }
}

/** Tangent basis at a unit direction (matches the world-root convention). */
function tangentBasis(dir: Vec3): { east: Vec3; north: Vec3 } {
  const up: Vec3 = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const ex = up[1] * dir[2] - up[2] * dir[1];
  const ey = up[2] * dir[0] - up[0] * dir[2];
  const ez = up[0] * dir[1] - up[1] * dir[0];
  const el = Math.hypot(ex, ey, ez) || 1;
  const east: Vec3 = [ex / el, ey / el, ez / el];
  const nx = dir[1] * east[2] - dir[2] * east[1];
  const ny = dir[2] * east[0] - dir[0] * east[2];
  const nz = dir[0] * east[1] - dir[1] * east[0];
  return { east, north: [nx, ny, nz] };
}

/** Stamp around a unit direction on the globe heightmap. */
export function applyGlobeStamp(grid: HeightmapGrid, center: Vec3, options: StampOptions): void {
  const { east, north } = tangentBasis(center);
  for (const stroke of stampStrokes(options.kind)) {
    const [ox, oz] = stroke.offset;
    const dx = ox * options.radius;
    const dz = oz * options.radius;
    const dir: Vec3 = [
      center[0] + east[0] * dx + north[0] * dz,
      center[1] + east[1] * dx + north[1] * dz,
      center[2] + east[2] * dx + north[2] * dz,
    ];
    const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    applyHeightBrush(
      grid,
      [dir[0] / len, dir[1] / len, dir[2] / len],
      options.radius * stroke.radiusFactor,
      options.strength * stroke.strengthFactor,
      stroke.mode,
    );
  }
}

/** Stamp around a map position on a flat level heightmap. */
export function applyPlanarStamp(
  grid: HeightmapGrid,
  mapSize: number,
  center: readonly [number, number],
  options: StampOptions,
): void {
  for (const stroke of stampStrokes(options.kind)) {
    const [ox, oz] = stroke.offset;
    applyPlanarBrush(
      grid,
      mapSize,
      [center[0] + ox * options.radius, center[1] + oz * options.radius],
      options.radius * stroke.radiusFactor,
      options.strength * stroke.strengthFactor,
      stroke.mode,
    );
  }
}
