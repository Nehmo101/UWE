/**
 * Scatter brush — one click plants a small cluster of the active asset with
 * deterministic variation in position, scale and rotation (hash-based, no
 * randomness: same click + seed → same cluster).
 */

import type { Vec3 } from "@uwe/atlas-editor/carve";

export interface ScatterInstance {
  /** Globe: unit direction. Terrain: map position (y unused). */
  position: Vec3;
  scale: number;
  rotation: number;
}

function hash01(a: number, b: number, seed: number): number {
  let n = Math.imul(Math.round(a * 8191) + Math.round(b * 131071) + seed * 7919, 2654435761);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export interface ScatterOptions {
  mode: "globe" | "terrain";
  /** Click point: unit direction (globe) or map point (terrain). */
  center: Vec3;
  /** Cluster radius — radians on the globe, map units on flat levels. */
  radius: number;
  seed: number;
  count?: number;
}

export function scatterInstances(options: ScatterOptions): ScatterInstance[] {
  const count = Math.max(2, Math.min(12, options.count ?? 7));
  const [cx, cy, cz] = options.center;
  const clickSalt = Math.round((cx * 31 + cy * 57 + cz * 91) * 997);
  const instances: ScatterInstance[] = [];

  // tangent basis for globe offsets
  const up: Vec3 = Math.abs(cy) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const ex = up[1] * cz - up[2] * cy;
  const ey = up[2] * cx - up[0] * cz;
  const ez = up[0] * cy - up[1] * cx;
  const el = Math.hypot(ex, ey, ez) || 1;
  const east: Vec3 = [ex / el, ey / el, ez / el];
  const north: Vec3 = [
    cy * east[2] - cz * east[1],
    cz * east[0] - cx * east[2],
    cx * east[1] - cy * east[0],
  ];

  for (let i = 0; i < count; i++) {
    const angle = hash01(i, 1, options.seed + clickSalt) * Math.PI * 2;
    const dist = Math.sqrt(hash01(i, 2, options.seed + clickSalt)) * options.radius;
    const dx = Math.cos(angle) * dist;
    const dz = Math.sin(angle) * dist;
    const scale = 0.6 + hash01(i, 3, options.seed + clickSalt) * 0.7;
    const rotation = hash01(i, 4, options.seed + clickSalt) * Math.PI * 2;
    if (options.mode === "globe") {
      const px = cx + east[0] * dx + north[0] * dz;
      const py = cy + east[1] * dx + north[1] * dz;
      const pz = cz + east[2] * dx + north[2] * dz;
      const len = Math.hypot(px, py, pz) || 1;
      instances.push({ position: [px / len, py / len, pz / len], scale, rotation });
    } else {
      instances.push({ position: [cx + dx, 0, cz + dz], scale, rotation });
    }
  }
  return instances;
}
