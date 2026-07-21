/**
 * Biome splat grid — the stepless biome paint layer (no tile system).
 *
 * A Uint8 index grid: 0 = unpainted (elevation bands decide the color),
 * 1..N = painted biome. The same grid works equirect (globe, uv from a unit
 * direction) and planar (flat levels, uv from map coordinates) — the caller
 * supplies the UV mapping.
 */

export interface SplatGrid {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface BiomeDefinition {
  key: string;
  label: string;
  /** Tuschelagen base color (hex) from the reduced palette. */
  color: string;
}

/** Painted biomes — index = position in this list + 1 (0 stays "unpainted"). */
export const ATLAS3D_BIOMES: readonly BiomeDefinition[] = [
  { key: "wiese", label: "Wiese", color: "#3a8878" },
  { key: "wald", label: "Wald", color: "#2f6f63" },
  { key: "wueste", label: "Wüste", color: "#d9cba1" },
  { key: "fels", label: "Fels", color: "#7a5a3a" },
  { key: "schnee", label: "Schnee", color: "#f1e8d4" },
  { key: "wasser", label: "Wasser", color: "#35597e" },
];

export function createSplat(width: number, height: number): SplatGrid {
  return { width, height, data: new Uint8Array(width * height) };
}

export function cloneSplat(grid: SplatGrid): SplatGrid {
  return { width: grid.width, height: grid.height, data: new Uint8Array(grid.data) };
}

/** Nearest-texel sample at UV in [0,1)² (u wraps, v clamps). */
export function sampleSplat(grid: SplatGrid, u: number, v: number): number {
  const x = ((Math.floor(u * grid.width) % grid.width) + grid.width) % grid.width;
  const y = Math.min(grid.height - 1, Math.max(0, Math.floor(v * grid.height)));
  return grid.data[y * grid.width + x];
}

/**
 * Paint a biome disc around a UV center. `radiusV` is a fraction of the V
 * axis; both grid layouts in use (equirect 2:1 and square planar) have square
 * texels, so the disc is a pixel-space circle of radius radiusV·height.
 * `biome` 0 erases back to "unpainted".
 */
export function applySplatBrush(grid: SplatGrid, centerU: number, centerV: number, radiusV: number, biome: number): void {
  const radius = Math.max(0.6, radiusV * grid.height);
  const cx = centerU * grid.width;
  const cy = centerV * grid.height;
  const minY = Math.max(0, Math.floor(cy - radius - 1));
  const maxY = Math.min(grid.height - 1, Math.ceil(cy + radius + 1));
  for (let y = minY; y <= maxY; y++) {
    for (let x = 0; x < grid.width; x++) {
      // wrap-aware distance in x (equirect longitude wraps; harmless planar)
      let dx = Math.abs(x + 0.5 - cx);
      dx = Math.min(dx, grid.width - dx);
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        grid.data[y * grid.width + x] = biome;
      }
    }
  }
}

export interface SplatJson {
  width: number;
  height: number;
  encoding: "u8-base64";
  data: string;
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function splatToJson(grid: SplatGrid): SplatJson {
  let out = "";
  const bytes = grid.data;
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += BASE64[b0 >> 2];
    out += BASE64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? BASE64[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < bytes.length ? BASE64[b2 & 63] : "=";
  }
  return { width: grid.width, height: grid.height, encoding: "u8-base64", data: out };
}

export function splatFromJson(value: unknown): SplatGrid | null {
  if (typeof value !== "object" || value === null) return null;
  const json = value as Partial<SplatJson>;
  if (json.encoding !== "u8-base64" || typeof json.data !== "string") return null;
  if (typeof json.width !== "number" || typeof json.height !== "number") return null;
  const clean = json.data.replace(/=+$/, "");
  const size = json.width * json.height;
  const out = new Uint8Array(size);
  let outIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (BASE64.indexOf(clean[i]) << 18) |
      (BASE64.indexOf(clean[i + 1]) << 12) |
      ((i + 2 < clean.length ? BASE64.indexOf(clean[i + 2]) : 0) << 6) |
      (i + 3 < clean.length ? BASE64.indexOf(clean[i + 3]) : 0);
    if (outIndex < size) out[outIndex++] = (n >> 16) & 0xff;
    if (outIndex < size) out[outIndex++] = (n >> 8) & 0xff;
    if (outIndex < size) out[outIndex++] = n & 0xff;
  }
  if (outIndex !== size) return null;
  return { width: json.width, height: json.height, data: out };
}

export function biomeColorRgb(biome: number): readonly [number, number, number] | null {
  const definition = ATLAS3D_BIOMES[biome - 1];
  if (!definition) return null;
  const hex = definition.color;
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}
