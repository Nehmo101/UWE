/**
 * Planet mesh data — pure buffer generation from a PlanetField.
 *
 * Vertex colors implement the Pergament ink palette: elevation bands on the
 * surface (ink-blue oceans → sand coast → teal lowland → sepia highland →
 * paper peaks, polar caps), and sepia strata with an ember core on carved
 * cut faces. three.js consumption happens in editor-app; this module stays
 * dependency-free and testable.
 */

import type { Vec3 } from "@uwe/atlas-editor/carve";
import type { PlanetField } from "./planet-field";
import { surfaceNets, type SurfaceNetsResult } from "./surface-nets";

export interface PlanetMeshData extends SurfaceNetsResult {
  colors: Float32Array;
}

function hexToRgb(hex: string): readonly [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

/** Tuschelagen shades of the reduced palette (surface + cut faces). */
export const PLANET_COLORS = {
  oceanDeep: hexToRgb("#27425d"),
  ocean: hexToRgb("#35597e"),
  oceanShallow: hexToRgb("#4a76a3"),
  coast: hexToRgb("#d9cba1"),
  lowland: hexToRgb("#3a8878"),
  midland: hexToRgb("#2f6f63"),
  highland: hexToRgb("#7a5a3a"),
  peak: hexToRgb("#f1e8d4"),
  polar: hexToRgb("#f1e8d4"),
  strataLight: hexToRgb("#93744e"),
  strata: hexToRgb("#7a5a3a"),
  strataDark: hexToRgb("#5c452c"),
  ember: hexToRgb("#c2622b"),
} as const;

export function surfaceColorFor(elevation: number, dirY: number): readonly [number, number, number] {
  const polar = Math.abs(dirY) > 0.78;
  if (polar && elevation > -0.06) return PLANET_COLORS.polar;
  if (elevation <= 0) {
    if (elevation < -0.07) return PLANET_COLORS.oceanDeep;
    if (elevation < -0.025) return PLANET_COLORS.ocean;
    return PLANET_COLORS.oceanShallow;
  }
  if (elevation < 0.018) return PLANET_COLORS.coast;
  if (elevation < 0.05) return PLANET_COLORS.lowland;
  if (elevation < 0.085) return PLANET_COLORS.midland;
  if (elevation < 0.115) return PLANET_COLORS.highland;
  return PLANET_COLORS.peak;
}

export function cutFaceColorFor(radialFraction: number): readonly [number, number, number] {
  if (radialFraction > 0.92) return PLANET_COLORS.strataLight;
  if (radialFraction > 0.8) return PLANET_COLORS.strata;
  if (radialFraction > 0.62) return PLANET_COLORS.strataDark;
  return PLANET_COLORS.ember;
}

export interface BuildPlanetMeshOptions {
  /** Cells per axis of the sampling grid. */
  resolution: number;
  /** Bounds half-extent as multiple of planet radius. */
  boundsScale?: number;
}

export function buildPlanetMeshData(field: PlanetField, options: BuildPlanetMeshOptions): PlanetMeshData {
  const radius = field.options.radius;
  const half = radius * (options.boundsScale ?? 1.45);
  const n = options.resolution;
  const mesh = surfaceNets(
    (x, y, z) => field.distance([x, y, z]),
    [-half, -half, -half],
    [half, half, half],
    [n, n, n],
  );

  const colors = new Float32Array(mesh.positions.length);
  const vertexCount = mesh.positions.length / 3;
  const cellSize = (half * 2) / n;
  for (let v = 0; v < vertexCount; v++) {
    const p: Vec3 = [mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2]];
    const len = Math.hypot(p[0], p[1], p[2]);
    const dir: Vec3 = len > 1e-9 ? [p[0] / len, p[1] / len, p[2] / len] : [0, 1, 0];
    const carveIndex = field.carveIndexAt(p, cellSize * 0.8);
    let rgb: readonly [number, number, number];
    if (carveIndex >= 0) {
      rgb = cutFaceColorFor(len / radius);
    } else {
      rgb = surfaceColorFor(field.elevation(dir), dir[1]);
    }
    colors[v * 3] = rgb[0];
    colors[v * 3 + 1] = rgb[1];
    colors[v * 3 + 2] = rgb[2];
  }

  return { ...mesh, colors };
}
