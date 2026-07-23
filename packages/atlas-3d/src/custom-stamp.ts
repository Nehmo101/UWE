/**
 * Custom stamps — user-provided grayscale images as terrain stamps.
 *
 * A CustomStampGrid (0..1 per texel, white = full lift, black = none) is
 * sampled bilinearly over the brush square; the image alone defines the shape
 * (no extra radial falloff). Planar and globe (tangent-space) variants.
 * Deterministic: same inputs → same result.
 */

import type { Vec3 } from "@uwe/atlas-editor/carve";
import type { HeightmapGrid } from "./planet-field";

export interface CustomStampGrid {
  width: number;
  height: number;
  /** Grayscale 0..1, row-major. */
  data: Float32Array;
}

/** Bilinear sample of a stamp at UV in [0,1]² (clamped). */
export function sampleCustomStamp(stamp: CustomStampGrid, u: number, v: number): number {
  const x = Math.min(stamp.width - 1, Math.max(0, u * (stamp.width - 1)));
  const y = Math.min(stamp.height - 1, Math.max(0, v * (stamp.height - 1)));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(stamp.width - 1, x0 + 1);
  const y1 = Math.min(stamp.height - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const s = (xx: number, yy: number) => stamp.data[yy * stamp.width + xx];
  const top = s(x0, y0) + (s(x1, y0) - s(x0, y0)) * fx;
  const bottom = s(x0, y1) + (s(x1, y1) - s(x0, y1)) * fx;
  return top + (bottom - top) * fy;
}

/**
 * Apply a custom stamp on a flat level heightmap. The stamp covers the square
 * of side 2*radius centered at `center` (map units); texels outside the square
 * stay untouched. `grid += stampValue * strength` — the image is the shape.
 */
export function applyCustomStampPlanar(
  grid: HeightmapGrid,
  mapSize: number,
  center: readonly [number, number],
  stamp: CustomStampGrid,
  radius: number,
  strength: number,
): void {
  const [cx, cz] = center;
  const side = Math.max(1e-9, radius * 2);
  for (let y = 0; y < grid.height; y++) {
    const v = grid.height > 1 ? y / (grid.height - 1) : 0.5;
    const z = (v * 2 - 1) * mapSize;
    if (Math.abs(z - cz) > radius) continue;
    for (let x = 0; x < grid.width; x++) {
      const u = grid.width > 1 ? x / (grid.width - 1) : 0.5;
      const mx = (u * 2 - 1) * mapSize;
      if (Math.abs(mx - cx) > radius) continue;
      const su = (mx - (cx - radius)) / side;
      const sv = (z - (cz - radius)) / side;
      grid.data[y * grid.width + x] += sampleCustomStamp(stamp, su, sv) * strength;
    }
  }
}

/** Tangent basis at a unit direction (same convention as stamps.ts). */
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

/**
 * Apply a custom stamp on the globe heightmap around `centerDir` (unit
 * vector). The stamp covers the tangent-space square of side 2*radiusRad
 * (radians, small-angle approximation); texels outside stay untouched.
 */
export function applyCustomStampGlobe(
  grid: HeightmapGrid,
  centerDir: Vec3,
  stamp: CustomStampGrid,
  radiusRad: number,
  strength: number,
): void {
  const length = Math.hypot(centerDir[0], centerDir[1], centerDir[2]) || 1;
  const center: Vec3 = [centerDir[0] / length, centerDir[1] / length, centerDir[2] / length];
  const { east, north } = tangentBasis(center);
  const side = Math.max(1e-9, radiusRad * 2);

  for (let y = 0; y < grid.height; y++) {
    const theta = (y / Math.max(1, grid.height - 1)) * Math.PI;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    for (let x = 0; x < grid.width; x++) {
      const phi = (x / grid.width - 0.5) * Math.PI * 2;
      const dx = sinTheta * Math.cos(phi);
      const dy = cosTheta;
      const dz = sinTheta * Math.sin(phi);
      const dot = dx * center[0] + dy * center[1] + dz * center[2];
      if (dot <= 0) continue;
      // Tangent-plane offsets ≈ arc lengths for small radii.
      const du = dx * east[0] + dy * east[1] + dz * east[2];
      const dv = dx * north[0] + dy * north[1] + dz * north[2];
      if (Math.abs(du) > radiusRad || Math.abs(dv) > radiusRad) continue;
      const su = (du + radiusRad) / side;
      const sv = (dv + radiusRad) / side;
      grid.data[y * grid.width + x] += sampleCustomStamp(stamp, su, sv) * strength;
    }
  }
}
