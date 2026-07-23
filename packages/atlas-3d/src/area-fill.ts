/**
 * "Bereich ausmalen" — fill a polygon (terrain-map coordinates) with decor
 * instances on a kind-specific grid. Deterministic hash jitter, no randomness.
 * Asset kinds are plain strings; the caller filters unsupported kinds.
 */

import { pointInPolygon, type Vec2 } from "@uwe/atlas-editor/geometry";

export const AREA_FILL_KINDS = [
  { key: "wald", label: "Wald" },
  { key: "hain", label: "Hain" },
  { key: "markt", label: "Markt" },
  { key: "felder", label: "Felder" },
] as const;

export type AreaFillKind = (typeof AREA_FILL_KINDS)[number];
export type AreaFillKindKey = AreaFillKind["key"];

export interface AreaFillInstance {
  assetKind: string;
  tint: string;
  x: number;
  z: number;
  scale: number;
  rotation: number;
}

export interface AreaFillOptions {
  /** Polygon in [x, z] terrain-map coordinates. */
  polygon: readonly [number, number][];
  kind: AreaFillKindKey;
  seed: number;
}

function hash01(a: number, b: number, seed: number): number {
  let n = Math.imul(Math.round(a * 8191) + Math.round(b * 131071) + seed * 7919, 2654435761);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

interface KindConfig {
  spacing: number;
  /** Position jitter as a fraction of the spacing (± range). */
  jitter: number;
  /** Only every 2nd grid row (field rows). */
  rowsOnly: boolean;
  pickAsset(h: number): { assetKind: string; tint: string };
}

const KIND_CONFIG: Record<AreaFillKindKey, KindConfig> = {
  wald: {
    spacing: 0.09,
    jitter: 0.38,
    rowsOnly: false,
    pickAsset: (h) => (h < 0.15 ? { assetKind: "busch", tint: "teal" } : { assetKind: "tree", tint: "teal" }),
  },
  hain: {
    spacing: 0.16,
    jitter: 0.3,
    rowsOnly: false,
    pickAsset: () => ({ assetKind: "tree", tint: "teal" }),
  },
  markt: {
    spacing: 0.12,
    jitter: 0.25,
    rowsOnly: false,
    pickAsset: (h) => (h < 0.12 ? { assetKind: "tower", tint: "paper" } : { assetKind: "house", tint: "terra" }),
  },
  felder: {
    spacing: 0.14,
    jitter: 0.04,
    rowsOnly: true,
    pickAsset: () => ({ assetKind: "busch", tint: "sepia" }),
  },
};

/**
 * Fill the polygon with instances on a kind-specific grid: wald dense trees,
 * hain loose trees, markt houses with the odd tower, felder in rows (every 2nd
 * grid row, barely any jitter) with hedge bushes. Only points inside the
 * polygon are returned.
 */
export function fillArea(options: AreaFillOptions): AreaFillInstance[] {
  const { polygon, kind, seed } = options;
  if (polygon.length < 3) return [];
  const config = KIND_CONFIG[kind];

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of polygon) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }

  const instances: AreaFillInstance[] = [];
  const spacing = config.spacing;
  const rows = Math.max(1, Math.floor((maxZ - minZ) / spacing) + 1);
  const cols = Math.max(1, Math.floor((maxX - minX) / spacing) + 1);

  for (let row = 0; row < rows; row++) {
    if (config.rowsOnly && row % 2 === 1) continue;
    for (let col = 0; col < cols; col++) {
      const cell = row * 1000 + col;
      const jx = (hash01(cell, 1, seed) - 0.5) * 2 * config.jitter * spacing;
      const jz = (hash01(cell, 2, seed) - 0.5) * 2 * config.jitter * spacing;
      const x = minX + spacing * 0.5 + col * spacing + jx;
      const z = minZ + spacing * 0.5 + row * spacing + jz;
      const point: Vec2 = [x, z];
      if (!pointInPolygon(point, polygon)) continue;
      const asset = config.pickAsset(hash01(cell, 3, seed));
      instances.push({
        assetKind: asset.assetKind,
        tint: asset.tint,
        x,
        z,
        scale: 0.7 + hash01(cell, 4, seed) * 0.6,
        rotation: hash01(cell, 5, seed) * Math.PI * 2,
      });
    }
  }
  return instances;
}
