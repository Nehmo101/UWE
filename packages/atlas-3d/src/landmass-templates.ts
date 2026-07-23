/**
 * Landmass templates — one-click starting shapes for a world heightmap.
 *
 * `applyLandmassTemplate` OVERWRITES the grid with a deterministic template
 * (continent, archipelago, high island), seeded via an integer hash and the
 * shared fbm noise. Works in texel/UV space: on the globe distances are
 * great-circle approximated (u wraps, du scaled by sin(latitude)); on flat
 * levels the UV square maps 1:1 to the map.
 */

import { fbm, type HeightmapGrid } from "./planet-field";

export const LANDMASS_TEMPLATES = [
  { key: "kontinent", label: "Kontinent" },
  { key: "archipel", label: "Archipel" },
  { key: "hochinsel", label: "Hochinsel" },
] as const;

export type LandmassTemplateKind = (typeof LANDMASS_TEMPLATES)[number]["key"];

/** Deterministic 0..1 hash from (seed, n). */
function hash01(seed: number, n: number): number {
  let h = ((seed | 0) * 374761393 + (n | 0) * 668265263) | 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** UV distance; on the globe u wraps and du is scaled by sin(latitude). */
function uvDistance(u1: number, v1: number, u2: number, v2: number, isGlobe: boolean): number {
  let du = Math.abs(u1 - u2);
  if (isGlobe) {
    du = Math.min(du, 1 - du);
    const lat = ((v1 + v2) / 2) * Math.PI;
    du *= 2 * Math.max(0.05, Math.sin(lat));
  }
  return Math.hypot(du, v1 - v2);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / Math.max(1e-9, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Blob falloff: 1 inside the core, smooth to 0 at radius. */
function blobFalloff(distance: number, radius: number): number {
  if (distance >= radius) return 0;
  return 1 - smoothstep(radius * 0.55, radius, distance);
}

interface Blob {
  u: number;
  v: number;
  radius: number;
}

function continentBlobs(seed: number): Blob[] {
  const blobs: Blob[] = [];
  const u = 0.35 + 0.3 * hash01(seed, 1);
  const v = 0.38 + 0.24 * hash01(seed, 2);
  blobs.push({ u, v, radius: 0.45 });
  if (hash01(seed, 0) >= 0.5) {
    const angle = hash01(seed, 3) * Math.PI * 2;
    blobs.push({
      u: Math.min(0.9, Math.max(0.1, u + Math.cos(angle) * 0.28)),
      v: Math.min(0.85, Math.max(0.15, v + Math.sin(angle) * 0.2)),
      radius: 0.22,
    });
  }
  return blobs;
}

function archipelagoBlobs(seed: number): Blob[] {
  const count = 6 + Math.floor(hash01(seed, 10) * 3.999);
  const blobs: Blob[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (hash01(seed, 20 + i) - 0.5) * 0.5;
    const distance = 0.22 + 0.14 * hash01(seed, 40 + i);
    blobs.push({
      u: 0.5 + Math.cos(angle) * distance,
      v: 0.5 + Math.sin(angle) * distance,
      radius: 0.045 + 0.03 * hash01(seed, 60 + i),
    });
  }
  return blobs;
}

/** Seam-free fbm sample for a UV cell (3D direction on the globe, planar otherwise). */
function noiseAt(u: number, v: number, seed: number, isGlobe: boolean, frequency: number): number {
  if (isGlobe) {
    const theta = v * Math.PI;
    const phi = (u - 0.5) * Math.PI * 2;
    const sinTheta = Math.sin(theta);
    return fbm(sinTheta * Math.cos(phi) * frequency, Math.cos(theta) * frequency, sinTheta * Math.sin(phi) * frequency, seed);
  }
  return fbm(u * frequency + 4.7, 0, v * frequency + 9.1, seed);
}

/**
 * Overwrite `grid.data` with the chosen landmass template. Deterministic per
 * (kind, seed, isGlobe). Heights are sculpt-layer deltas: land ~+0.05..+0.14,
 * surrounding sea floor slightly negative.
 */
export function applyLandmassTemplate(
  grid: HeightmapGrid,
  kind: LandmassTemplateKind,
  seed: number,
  isGlobe: boolean,
): void {
  const { width, height, data } = grid;
  const blobs = kind === "kontinent" ? continentBlobs(seed) : kind === "archipel" ? archipelagoBlobs(seed) : [];

  for (let y = 0; y < height; y++) {
    const v = height > 1 ? y / (height - 1) : 0.5;
    for (let x = 0; x < width; x++) {
      const u = width > 1 ? x / (isGlobe ? width : width - 1) : 0.5;
      const index = y * width + x;

      if (kind === "hochinsel") {
        // Central plateau with a steep rim and lowered surroundings.
        const distance = uvDistance(u, v, 0.5, 0.5, isGlobe);
        const rim = smoothstep(0.16, 0.24, distance);
        const ripple = (noiseAt(u, v, seed, isGlobe, 6) - 0.5) * 0.016;
        data[index] = 0.14 * (1 - rim) + -0.06 * rim + ripple * (1 - rim);
        continue;
      }

      let mask = 0;
      for (const blob of blobs) {
        const falloff = blobFalloff(uvDistance(u, v, blob.u, blob.v, isGlobe), blob.radius);
        if (falloff > mask) mask = falloff;
      }
      const shapeNoise = noiseAt(u, v, seed, isGlobe, 3) - 0.5;
      const detailNoise = noiseAt(u, v, seed + 977, isGlobe, 5) - 0.5;

      if (kind === "kontinent") {
        const land = smoothstep(0.3, 0.55, mask + shapeNoise * 0.25);
        data[index] = -0.04 * (1 - land) + land * (0.085 + 0.07 * detailNoise);
      } else {
        // archipel — small separate islands, sea floor slightly negative.
        const land = smoothstep(0.35, 0.6, mask + shapeNoise * 0.12);
        data[index] = -0.04 * (1 - land) + land * (0.1 + 0.04 * detailNoise);
      }
    }
  }
}
