import { sampleElevation, type ElevationGrid } from "@uwe/atlas/elevation";
import type { Ray3 } from "./camera-math";
import type { Vec3 } from "./types";

export interface PickOptions {
  worldWidth?: number;
  worldDepth?: number;
  heightScale?: number;
  maxDistance?: number;
  steps?: number;
}

function pointAt(ray: Ray3, distance: number): [number, number, number] {
  return [
    ray.origin[0] + ray.direction[0] * distance,
    ray.origin[1] + ray.direction[1] * distance,
    ray.origin[2] + ray.direction[2] * distance,
  ];
}

function normalised(point: Vec3, worldWidth: number, worldDepth: number): [number, number] {
  return [point[0] / worldWidth + 0.5, point[2] / worldDepth + 0.5];
}

function signedHeight(
  ray: Ray3,
  distance: number,
  grid: ElevationGrid,
  worldWidth: number,
  worldDepth: number,
  heightScale: number,
): number {
  const point = pointAt(ray, distance);
  const [nx, ny] = normalised(point, worldWidth, worldDepth);
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return Number.POSITIVE_INFINITY;
  return point[1] - sampleElevation(grid, nx, ny) * heightScale;
}

export function raycastHeightfield(
  ray: Ray3,
  grid: ElevationGrid,
  options: PickOptions = {},
): [number, number] | null {
  const worldWidth = options.worldWidth ?? 2;
  const worldDepth = options.worldDepth ?? 1.25;
  const heightScale = options.heightScale ?? 0.45;
  const maxDistance = options.maxDistance ?? 20;
  const steps = Math.max(16, options.steps ?? 160);
  let previousDistance = 0;
  let previousHeight = signedHeight(ray, 0, grid, worldWidth, worldDepth, heightScale);
  for (let step = 1; step <= steps; step++) {
    const distance = (step / steps) * maxDistance;
    const height = signedHeight(ray, distance, grid, worldWidth, worldDepth, heightScale);
    if (Number.isFinite(height) && Number.isFinite(previousHeight) && height <= 0 && previousHeight >= 0) {
      let lo = previousDistance;
      let hi = distance;
      for (let iteration = 0; iteration < 18; iteration++) {
        const mid = (lo + hi) / 2;
        if (signedHeight(ray, mid, grid, worldWidth, worldDepth, heightScale) > 0) lo = mid;
        else hi = mid;
      }
      const [nx, ny] = normalised(pointAt(ray, (lo + hi) / 2), worldWidth, worldDepth);
      return [Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny))];
    }
    previousDistance = distance;
    previousHeight = height;
  }

  if (Math.abs(ray.direction[1]) > 1e-8) {
    const distance = -ray.origin[1] / ray.direction[1];
    if (distance >= 0) {
      const [nx, ny] = normalised(pointAt(ray, distance), worldWidth, worldDepth);
      if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) return [nx, ny];
    }
  }
  return null;
}
