/**
 * Hydrology — deterministic river tracing and channel carving.
 *
 * `traceRiver` walks the steepest descent of an arbitrary height function
 * until it reaches water, the map edge, or a local minimum (escaped with a
 * bounded, hash-seeded jitter — no randomness). `carveRiverChannel` lowers the
 * heightmap along a traced path using the shared planar sculpt brush.
 */

import type { HeightmapGrid } from "./planet-field";
import { applyPlanarBrush } from "./terrain-field";

export interface TraceRiverOptions {
  heightAt: (x: number, z: number) => number;
  start: readonly [number, number];
  /** Map half-extent: the level spans [-mapSize, mapSize] in x and z. */
  mapSize: number;
  /** Stop once the height drops below this. Default 0. */
  waterLevel?: number;
  /** Maximum path points. Default 200. */
  maxSteps?: number;
  /** Step length in map units. Default 0.04. */
  stepSize?: number;
}

export interface RiverPoint {
  x: number;
  z: number;
}

/** Deterministic 0..1 hash from point coordinates (no Math.random). */
function pointHash(x: number, z: number, salt: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453123;
  return s - Math.floor(s);
}

const DESCENT_DIRECTIONS: readonly (readonly [number, number])[] = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2;
  return [Math.cos(angle), Math.sin(angle)] as const;
});

/**
 * Trace a river downhill from `start`. Samples 8 directions per step and
 * follows the steepest descent. Ends below `waterLevel`, past the map edge,
 * or in a local minimum after at most 5 jitter escape attempts. The returned
 * path always contains at least the start point.
 */
export function traceRiver(options: TraceRiverOptions): RiverPoint[] {
  const waterLevel = options.waterLevel ?? 0;
  const maxSteps = options.maxSteps ?? 200;
  const stepSize = options.stepSize ?? 0.04;
  const { heightAt, mapSize } = options;

  let x = options.start[0];
  let z = options.start[1];
  const path: RiverPoint[] = [{ x, z }];
  let jitterAttempts = 0;

  for (let step = 0; step < maxSteps; step++) {
    const here = heightAt(x, z);
    if (here < waterLevel) break;

    let bestX = x;
    let bestZ = z;
    let bestHeight = Infinity;
    for (const [dx, dz] of DESCENT_DIRECTIONS) {
      const nx = x + dx * stepSize;
      const nz = z + dz * stepSize;
      const h = heightAt(nx, nz);
      if (h < bestHeight) {
        bestHeight = h;
        bestX = nx;
        bestZ = nz;
      }
    }

    if (bestHeight < here - 1e-9) {
      x = bestX;
      z = bestZ;
    } else {
      // Local minimum — deterministic jitter from the point coordinates.
      if (jitterAttempts >= 5) break;
      jitterAttempts++;
      const angle = pointHash(x, z, jitterAttempts) * Math.PI * 2;
      x += Math.cos(angle) * stepSize * 0.5;
      z += Math.sin(angle) * stepSize * 0.5;
    }

    if (Math.abs(x) > mapSize || Math.abs(z) > mapSize) break;
    path.push({ x, z });
  }
  return path;
}

/**
 * Carve a channel along a traced river path by lowering the planar heightmap
 * with the shared sculpt brush. `depth` is the lowering strength per point,
 * `width` the brush radius in map units.
 */
export function carveRiverChannel(
  grid: HeightmapGrid,
  mapSize: number,
  path: readonly RiverPoint[],
  depth = 0.03,
  width = 0.05,
): void {
  for (const point of path) {
    applyPlanarBrush(grid, mapSize, [point.x, point.z], width, depth, "lower");
  }
}
