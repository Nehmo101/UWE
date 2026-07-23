/**
 * Heightmap erosion — pure, deterministic math on HeightmapGrid.
 *
 * Thermal erosion (talus-limited material transport to lower 4-neighbours)
 * plus a simple incise pass (flow accumulation along steepest descent, carved
 * as shallow channels). The x axis wraps (equirect longitude), y clamps.
 * No randomness, no time — same input → same output.
 */

import type { HeightmapGrid } from "./planet-field";

export interface ErosionOptions {
  /** Thermal iterations. Default 20. */
  iterations?: number;
  /** Slope threshold below which material rests. Default 0.012. */
  talus?: number;
  /** Fraction of the excess slope moved per step. Default 0.5. */
  carry?: number;
  /**
   * 0..1 — scales the talus threshold: small values erode even gentle slopes
   * (fine channels), large values only steep ones (broad forms). Default 0.5
   * keeps `talus` unchanged.
   */
  featureSize?: number;
  /** Carve flow channels into the grid. Default true. */
  incise?: boolean;
}

export interface ErosionResult {
  /** Normalized flow accumulation (0..1) per texel — mask for snow/debris. */
  flow: Float32Array;
}

/** Neighbour index with x-wrap and y-clamp (returns -1 when y leaves the grid). */
function neighborIndex(x: number, y: number, dx: number, dy: number, width: number, height: number): number {
  const ny = y + dy;
  if (ny < 0 || ny >= height) return -1;
  const nx = (x + dx + width) % width;
  return ny * width + nx;
}

const NEIGHBORS_4: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** One mass-conserving thermal step over the whole grid. */
function thermalStep(data: Float32Array, width: number, height: number, talus: number, carry: number, delta: Float32Array): void {
  delta.fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const h = data[index];
      let count = 0;
      for (const [dx, dy] of NEIGHBORS_4) {
        const n = neighborIndex(x, y, dx, dy, width, height);
        if (n >= 0 && h - data[n] > talus) count++;
      }
      if (count === 0) continue;
      for (const [dx, dy] of NEIGHBORS_4) {
        const n = neighborIndex(x, y, dx, dy, width, height);
        if (n < 0) continue;
        const diff = h - data[n];
        if (diff <= talus) continue;
        const amount = ((diff - talus) * carry) / count;
        delta[index] -= amount;
        delta[n] += amount;
      }
    }
  }
  for (let i = 0; i < data.length; i++) data[i] += delta[i];
}

/** Flow accumulation over steepest 4-neighbour descent (deterministic order). */
function accumulateFlow(data: Float32Array, width: number, height: number): Float32Array {
  const flow = new Float32Array(data.length).fill(1);
  const order = Array.from({ length: data.length }, (_, i) => i);
  order.sort((a, b) => (data[b] !== data[a] ? data[b] - data[a] : a - b));
  for (const index of order) {
    const x = index % width;
    const y = (index - x) / width;
    let best = -1;
    let bestDrop = 0;
    for (const [dx, dy] of NEIGHBORS_4) {
      const n = neighborIndex(x, y, dx, dy, width, height);
      if (n < 0) continue;
      const drop = data[index] - data[n];
      if (drop > bestDrop) {
        bestDrop = drop;
        best = n;
      }
    }
    if (best >= 0) flow[best] += flow[index];
  }
  let max = 0;
  for (let i = 0; i < flow.length; i++) if (flow[i] > max) max = flow[i];
  if (max > 0) for (let i = 0; i < flow.length; i++) flow[i] /= max;
  return flow;
}

/**
 * Erode the whole heightmap in place. Thermal transport is mass-conserving;
 * the optional incise pass removes a little material along flow channels.
 * Returns the normalized flow accumulation as a reusable mask.
 */
export function erodeHeightmap(grid: HeightmapGrid, options: ErosionOptions = {}): ErosionResult {
  const iterations = Math.max(0, Math.floor(options.iterations ?? 20));
  const carry = options.carry ?? 0.5;
  const featureSize = Math.min(1, Math.max(0, options.featureSize ?? 0.5));
  const talus = (options.talus ?? 0.012) * Math.pow(2, (featureSize - 0.5) * 2);
  const incise = options.incise ?? true;

  const { width, height, data } = grid;
  const delta = new Float32Array(data.length);
  for (let i = 0; i < iterations; i++) {
    thermalStep(data, width, height, talus, carry, delta);
  }

  const flow = accumulateFlow(data, width, height);
  if (incise) {
    const iterationsFactor = iterations / 20;
    for (let i = 0; i < data.length; i++) {
      data[i] -= Math.min(0.02, flow[i] * 0.015 * iterationsFactor);
    }
  }
  return { flow };
}

/**
 * Locally bounded erosion brush: 6 thermal iterations restricted to texels
 * within `radiusTexels` of `centerTexel` (x wraps), with a soft falloff toward
 * the rim. Only cells inside the radius ever change.
 */
export function applyErosionBrush(
  grid: HeightmapGrid,
  centerTexel: readonly [number, number],
  radiusTexels: number,
  strength = 1,
): void {
  const { width, height, data } = grid;
  const [cx, cy] = centerTexel;
  const radius = Math.max(1e-6, radiusTexels);
  const talus = 0.012;
  const carry = 0.5;
  const scale = Math.min(1, Math.max(0, strength));

  // Falloff weight per texel; 0 = outside the brush.
  const weight = new Float32Array(data.length);
  const cells: number[] = [];
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(height - 1, Math.ceil(cy + radius));
  for (let y = minY; y <= maxY; y++) {
    for (let x = 0; x < width; x++) {
      let dx = Math.abs(x - cx);
      dx = Math.min(dx, width - dx);
      const distance = Math.hypot(dx, y - cy);
      if (distance > radius) continue;
      const t = 1 - distance / radius;
      weight[y * width + x] = t * t * (3 - 2 * t);
      cells.push(y * width + x);
    }
  }

  const delta = new Float32Array(data.length);
  for (let iteration = 0; iteration < 6; iteration++) {
    delta.fill(0);
    for (const index of cells) {
      const x = index % width;
      const y = (index - x) / width;
      const h = data[index];
      let count = 0;
      for (const [dx, dy] of NEIGHBORS_4) {
        const n = neighborIndex(x, y, dx, dy, width, height);
        if (n >= 0 && weight[n] > 0 && h - data[n] > talus) count++;
      }
      if (count === 0) continue;
      for (const [dx, dy] of NEIGHBORS_4) {
        const n = neighborIndex(x, y, dx, dy, width, height);
        if (n < 0 || weight[n] <= 0) continue;
        const diff = h - data[n];
        if (diff <= talus) continue;
        const pairWeight = Math.min(weight[index], weight[n]) * scale;
        const amount = (((diff - talus) * carry) / count) * pairWeight;
        delta[index] -= amount;
        delta[n] += amount;
      }
    }
    for (const index of cells) data[index] += delta[index];
  }
}
