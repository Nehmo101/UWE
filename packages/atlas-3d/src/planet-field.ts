/**
 * Planet distance field — the editable globe as pure math.
 *
 * Base shape: sphere + deterministic fBm elevation + an editable equirect
 * heightmap delta (the sculpt layer). Carve operations from
 * @uwe/atlas-editor/carve are CSG-subtracted on top. Everything is seeded and
 * deterministic: same inputs → same field → same mesh.
 */

import { applyCarveOps, carveOpDistance, type CarveOp, type Vec3 } from "@uwe/atlas-editor/carve";

export interface HeightmapGrid {
  width: number;
  height: number;
  /** Elevation delta per texel, row-major, equirectangular (lon × lat). */
  data: Float32Array;
}

export interface PlanetFieldOptions {
  seed: number;
  radius: number;
  /** Max procedural elevation as fraction of radius. */
  noiseAmplitude: number;
  noiseFrequency: number;
  /** Elevation below which the surface counts as ocean (fraction of radius). */
  seaLevel: number;
  heightmap: HeightmapGrid | null;
  carveOps: readonly CarveOp[];
}

export const PLANET_FIELD_DEFAULTS: PlanetFieldOptions = {
  seed: 1,
  radius: 1,
  noiseAmplitude: 0.16,
  noiseFrequency: 2.1,
  seaLevel: 0,
  heightmap: null,
  carveOps: [],
};

// --- deterministic value noise -------------------------------------------------

function hash3(x: number, y: number, z: number, seed: number): number {
  let n = (x | 0) * 374761393 + (y | 0) * 668265263 + (z | 0) * 1440662683 + (seed | 0) * 1013904223;
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  const g = (i: number, j: number, k: number) => hash3(xi + i, yi + j, zi + k, seed);
  const a = g(0, 0, 0) + (g(1, 0, 0) - g(0, 0, 0)) * u;
  const b = g(0, 1, 0) + (g(1, 1, 0) - g(0, 1, 0)) * u;
  const c = g(0, 0, 1) + (g(1, 0, 1) - g(0, 0, 1)) * u;
  const d = g(0, 1, 1) + (g(1, 1, 1) - g(0, 1, 1)) * u;
  const e = a + (b - a) * v;
  const f = c + (d - c) * v;
  return e + (f - e) * w;
}

export function fbm(x: number, y: number, z: number, seed: number, octaves = 5): number {
  let total = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let i = 0; i < octaves; i++) {
    total += amplitude * valueNoise(x * frequency + 13.7, y * frequency + 7.1, z * frequency + 3.3, seed + i * 101);
    amplitude *= 0.5;
    frequency *= 2.05;
  }
  return total;
}

// --- heightmap sampling & brushes ---------------------------------------------

export function createHeightmap(width: number, height: number): HeightmapGrid {
  return { width, height, data: new Float32Array(width * height) };
}

export function cloneHeightmap(grid: HeightmapGrid): HeightmapGrid {
  return { width: grid.width, height: grid.height, data: new Float32Array(grid.data) };
}

/** Direction (unit) → equirect UV in [0,1)². */
export function dirToUv(dir: Vec3): readonly [number, number] {
  const u = (Math.atan2(dir[2], dir[0]) / (Math.PI * 2) + 0.5) % 1;
  const v = Math.acos(Math.min(1, Math.max(-1, dir[1]))) / Math.PI;
  return [u, v];
}

export function sampleHeightmap(grid: HeightmapGrid, dir: Vec3): number {
  const [u, v] = dirToUv(dir);
  const x = u * grid.width;
  const y = v * (grid.height - 1);
  const x0 = Math.floor(x) % grid.width;
  const x1 = (x0 + 1) % grid.width;
  const y0 = Math.min(grid.height - 1, Math.floor(y));
  const y1 = Math.min(grid.height - 1, y0 + 1);
  const fx = x - Math.floor(x);
  const fy = y - y0;
  const s = (xx: number, yy: number) => grid.data[yy * grid.width + xx];
  const top = s(x0, y0) + (s(x1, y0) - s(x0, y0)) * fx;
  const bottom = s(x0, y1) + (s(x1, y1) - s(x0, y1)) * fx;
  return top + (bottom - top) * fy;
}

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Environment-agnostic base64 (works in browser workers and Node alike). */
function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += BASE64_CHARS[b0 >> 2];
    out += BASE64_CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? BASE64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < bytes.length ? BASE64_CHARS[b2 & 63] : "=";
  }
  return out;
}

function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let outIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (BASE64_CHARS.indexOf(clean[i]) << 18) |
      (BASE64_CHARS.indexOf(clean[i + 1]) << 12) |
      ((i + 2 < clean.length ? BASE64_CHARS.indexOf(clean[i + 2]) : 0) << 6) |
      (i + 3 < clean.length ? BASE64_CHARS.indexOf(clean[i + 3]) : 0);
    if (outIndex < out.length) out[outIndex++] = (n >> 16) & 0xff;
    if (outIndex < out.length) out[outIndex++] = (n >> 8) & 0xff;
    if (outIndex < out.length) out[outIndex++] = n & 0xff;
  }
  return out;
}

export interface HeightmapJson {
  width: number;
  height: number;
  encoding: "f32-base64";
  data: string;
}

export function heightmapToJson(grid: HeightmapGrid): HeightmapJson {
  return {
    width: grid.width,
    height: grid.height,
    encoding: "f32-base64",
    data: bytesToBase64(new Uint8Array(grid.data.buffer.slice(0))),
  };
}

export function heightmapFromJson(value: unknown): HeightmapGrid | null {
  if (typeof value !== "object" || value === null) return null;
  const json = value as Partial<HeightmapJson>;
  if (json.encoding !== "f32-base64" || typeof json.data !== "string") return null;
  if (typeof json.width !== "number" || typeof json.height !== "number") return null;
  const bytes = base64ToBytes(json.data);
  if (bytes.length !== json.width * json.height * 4) return null;
  return { width: json.width, height: json.height, data: new Float32Array(bytes.buffer, 0, json.width * json.height) };
}

export type BrushMode = "raise" | "lower" | "smooth" | "flatten";

/**
 * Apply a sculpt brush around a surface direction. `radius` is angular
 * (radians on the unit sphere); strength is the elevation delta per stroke.
 * Mutates the grid; the editor snapshots before a drag for undo.
 */
export function applyHeightBrush(
  grid: HeightmapGrid,
  center: Vec3,
  radius: number,
  strength: number,
  mode: BrushMode,
): void {
  const [cu, cv] = dirToUv(center);
  const texRadiusV = (radius / Math.PI) * grid.height;
  const minY = Math.max(0, Math.floor(cv * grid.height - texRadiusV - 1));
  const maxY = Math.min(grid.height - 1, Math.ceil(cv * grid.height + texRadiusV + 1));
  const cosRadius = Math.cos(radius);
  const cy3 = Math.cos(cv * Math.PI);
  const sy3 = Math.sin(cv * Math.PI);
  const cLon = (cu - 0.5) * Math.PI * 2;
  const cx3 = sy3 * Math.cos(cLon);
  const cz3 = sy3 * Math.sin(cLon);

  let regionSum = 0;
  let regionCount = 0;
  if (mode === "smooth" || mode === "flatten") {
    for (let y = minY; y <= maxY; y++) {
      for (let x = 0; x < grid.width; x++) {
        regionSum += grid.data[y * grid.width + x];
        regionCount++;
      }
    }
  }
  const regionMean = regionCount > 0 ? regionSum / regionCount : 0;

  for (let y = minY; y <= maxY; y++) {
    const lat = (y / (grid.height - 1)) * Math.PI;
    const sinLat = Math.sin(lat);
    const cosLat = Math.cos(lat);
    for (let x = 0; x < grid.width; x++) {
      const lon = (x / grid.width - 0.5) * Math.PI * 2;
      const dot = sinLat * Math.cos(lon) * cx3 + cosLat * cy3 + sinLat * Math.sin(lon) * cz3;
      if (dot < cosRadius) continue;
      const t = (dot - cosRadius) / Math.max(1e-6, 1 - cosRadius);
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

// --- the field -----------------------------------------------------------------

export interface PlanetField {
  readonly options: PlanetFieldOptions;
  /** Elevation (fraction of radius, may be negative) for a unit direction. */
  elevation(dir: Vec3): number;
  /** Signed distance including carve subtraction. Negative = inside. */
  distance(p: Vec3): number;
  /**
   * Index of the carve op whose removed region contains p (within epsilon —
   * mesh vertices sit ON the cut boundary, so pass ~one cell size), or -1.
   */
  carveIndexAt(p: Vec3, epsilon?: number): number;
}

export function createPlanetField(partial: Partial<PlanetFieldOptions>): PlanetField {
  const options: PlanetFieldOptions = { ...PLANET_FIELD_DEFAULTS, ...partial };

  function elevation(dir: Vec3): number {
    const n = fbm(dir[0] * options.noiseFrequency, dir[1] * options.noiseFrequency, dir[2] * options.noiseFrequency, options.seed) - 0.5;
    let e = Math.max(-0.35, n) * options.noiseAmplitude * 2;
    if (options.heightmap) {
      e += sampleHeightmap(options.heightmap, dir);
    }
    return e;
  }

  function distance(p: Vec3): number {
    const len = Math.hypot(p[0], p[1], p[2]);
    const dir: Vec3 = len > 1e-9 ? [p[0] / len, p[1] / len, p[2] / len] : [0, 1, 0];
    const surface = options.radius * (1 + Math.max(options.seaLevel, elevation(dir)));
    const base = len - surface;
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

  return { options, elevation, distance, carveIndexAt };
}
