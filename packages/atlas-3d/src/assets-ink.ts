/**
 * Tusche-Assets — procedural ink-style miniatures.
 *
 * Pure geometry data (non-indexed triangles with position/color/anim per
 * vertex) so builders stay testable without three.js. Every instance is
 * tintable from the reduced palette; there is deliberately NO random
 * variation (owner decision) — identical inputs build identical assets.
 * Idle animation is baked as per-vertex (direction, phase) consumed by the
 * ink shader's uTime.
 */

import { INK_ASSET_BUILDERS_BATCH2 } from "./assets-ink-batch2";

export interface InkAssetData {
  /** Interleaved-free flat arrays, non-indexed triangles. */
  positions: Float32Array;
  colors: Float32Array;
  anim: Float32Array;
  /** Suggested outline width in object units. */
  outlineWidth: number;
}

export const INK_ASSET_KINDS = [
  "worldroot",
  "tree",
  "house",
  "tower",
  "asteroid",
  "fels",
  "busch",
  "bruecke",
  "muehle",
  "hafen",
  "portal",
  "obelisk",
  "mond",
] as const;
export type InkAssetKind = (typeof INK_ASSET_KINDS)[number];

export const INK_ASSET_LABELS: Record<InkAssetKind, string> = {
  worldroot: "Weltwurzel",
  tree: "Baum",
  house: "Haus",
  tower: "Turm",
  asteroid: "Asteroid",
  fels: "Fels",
  busch: "Busch",
  bruecke: "Brücke",
  muehle: "Mühle",
  hafen: "Hafen",
  portal: "Portal",
  obelisk: "Obelisk",
  mond: "Mond",
};

export interface InkAssetGroup {
  key: string;
  label: string;
  kinds: InkAssetKind[];
}

/** Asset palette groups for the editor panel — every kind appears exactly once. */
export const INK_ASSET_GROUPS: InkAssetGroup[] = [
  { key: "natur", label: "Natur", kinds: ["tree", "fels", "busch"] },
  { key: "siedlung", label: "Siedlung", kinds: ["house", "tower", "bruecke", "muehle", "hafen"] },
  { key: "weltenbau", label: "Weltenbau", kinds: ["worldroot", "portal", "obelisk"] },
  { key: "himmel", label: "Himmel", kinds: ["asteroid", "mond"] },
];

/** Kinds that live on an orbit around the globe — only placeable in globe mode. */
export const GLOBE_ONLY_ASSET_KINDS: readonly InkAssetKind[] = ["asteroid", "mond"];

export type InkTint = "paper" | "sepia" | "terra" | "teal" | "blue";

/** Tuschelagen per tint: [dark, base, light]. */
const TINT_SHADES: Record<InkTint, [string, string, string]> = {
  paper: ["#d9cba1", "#f1e8d4", "#faf5e8"],
  sepia: ["#5c452c", "#7a5a3a", "#93744e"],
  terra: ["#a34e1f", "#c2622b", "#d47030"],
  teal: ["#2f6f63", "#3a8878", "#6fa393"],
  blue: ["#27425d", "#35597e", "#4a76a3"],
};

export function isInkAssetKind(value: unknown): value is InkAssetKind {
  return typeof value === "string" && (INK_ASSET_KINDS as readonly string[]).includes(value);
}

export function isInkTint(value: unknown): value is InkTint {
  return typeof value === "string" && value in TINT_SHADES;
}

export type Vec = readonly [number, number, number];
export type Rgb = readonly [number, number, number];
export type AnimFn = ((p: Vec) => readonly [number, number, number, number]) | null;

/** Internal builder toolkit — shared with assets-ink-batch2 (kept out of the app API). */
export function hex(hexColor: string): Rgb {
  return [
    parseInt(hexColor.slice(1, 3), 16) / 255,
    parseInt(hexColor.slice(3, 5), 16) / 255,
    parseInt(hexColor.slice(5, 7), 16) / 255,
  ];
}

export class Builder {
  positions: number[] = [];
  colors: number[] = [];
  anim: number[] = [];

  tri(a: Vec, b: Vec, c: Vec, color: Rgb, animFn: AnimFn): void {
    for (const p of [a, b, c]) {
      this.positions.push(p[0], p[1], p[2]);
      this.colors.push(color[0], color[1], color[2]);
      const an = animFn ? animFn(p) : [0, 0, 0, 0];
      this.anim.push(an[0], an[1], an[2], an[3]);
    }
  }

  quad(a: Vec, b: Vec, c: Vec, d: Vec, color: Rgb, animFn: AnimFn): void {
    this.tri(a, b, c, color, animFn);
    this.tri(a, c, d, color, animFn);
  }

  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: Rgb, animFn: AnimFn): void {
    const x = sx / 2;
    const y = sy / 2;
    const z = sz / 2;
    const p = (dx: number, dy: number, dz: number): Vec => [cx + dx * x, cy + dy * y, cz + dz * z];
    this.quad(p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1), color, animFn);
    this.quad(p(1, -1, -1), p(-1, -1, -1), p(-1, 1, -1), p(1, 1, -1), color, animFn);
    this.quad(p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1), color, animFn);
    this.quad(p(1, -1, 1), p(1, -1, -1), p(1, 1, -1), p(1, 1, 1), color, animFn);
    this.quad(p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1), p(-1, 1, -1), color, animFn);
    this.quad(p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1), color, animFn);
  }

  column(
    cx: number,
    cy: number,
    cz: number,
    rBottom: number,
    rTop: number,
    height: number,
    sides: number,
    color: Rgb,
    animFn: AnimFn,
    topJitter?: readonly number[],
  ): void {
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2;
      const a1 = ((i + 1) / sides) * Math.PI * 2;
      const j0 = topJitter ? topJitter[i % topJitter.length] : 0;
      const j1 = topJitter ? topJitter[(i + 1) % topJitter.length] : 0;
      const b0: Vec = [cx + Math.cos(a0) * rBottom, cy, cz + Math.sin(a0) * rBottom];
      const b1: Vec = [cx + Math.cos(a1) * rBottom, cy, cz + Math.sin(a1) * rBottom];
      const t0: Vec = [cx + Math.cos(a0) * rTop, cy + height + j0, cz + Math.sin(a0) * rTop];
      const t1: Vec = [cx + Math.cos(a1) * rTop, cy + height + j1, cz + Math.sin(a1) * rTop];
      this.quad(b0, b1, t1, t0, color, animFn);
      this.tri(t0, t1, [cx, cy + height + Math.min(j0, j1), cz], color, animFn);
    }
  }

  blob(cx: number, cy: number, cz: number, r: number, hUp: number, hDown: number, sides: number, color: Rgb, animFn: AnimFn): void {
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2;
      const a1 = ((i + 1) / sides) * Math.PI * 2;
      const p0: Vec = [cx + Math.cos(a0) * r, cy, cz + Math.sin(a0) * r];
      const p1: Vec = [cx + Math.cos(a1) * r, cy, cz + Math.sin(a1) * r];
      this.tri(p0, p1, [cx, cy + hUp, cz], color, animFn);
      this.tri(p1, p0, [cx, cy - hDown, cz], color, animFn);
    }
  }

  tube(points: readonly Vec[], radii: readonly number[], sides: number, color: Rgb, animFn: AnimFn): void {
    const rings: Vec[][] = [];
    for (let i = 0; i < points.length; i++) {
      const next = points[Math.min(points.length - 1, i + 1)];
      const prev = points[Math.max(0, i - 1)];
      const dirRaw: Vec = [next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]];
      const len = Math.hypot(dirRaw[0], dirRaw[1], dirRaw[2]) || 1;
      const dir: Vec = [dirRaw[0] / len, dirRaw[1] / len, dirRaw[2] / len];
      const up: Vec = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      const sxRaw: Vec = [
        dir[1] * up[2] - dir[2] * up[1],
        dir[2] * up[0] - dir[0] * up[2],
        dir[0] * up[1] - dir[1] * up[0],
      ];
      const sxLen = Math.hypot(sxRaw[0], sxRaw[1], sxRaw[2]) || 1;
      const sx: Vec = [sxRaw[0] / sxLen, sxRaw[1] / sxLen, sxRaw[2] / sxLen];
      const sy: Vec = [
        sx[1] * dir[2] - sx[2] * dir[1],
        sx[2] * dir[0] - sx[0] * dir[2],
        sx[0] * dir[1] - sx[1] * dir[0],
      ];
      const ring: Vec[] = [];
      for (let k = 0; k < sides; k++) {
        const angle = (k / sides) * Math.PI * 2;
        const r = radii[i];
        ring.push([
          points[i][0] + (sx[0] * Math.cos(angle) + sy[0] * Math.sin(angle)) * r,
          points[i][1] + (sx[1] * Math.cos(angle) + sy[1] * Math.sin(angle)) * r,
          points[i][2] + (sx[2] * Math.cos(angle) + sy[2] * Math.sin(angle)) * r,
        ]);
      }
      rings.push(ring);
    }
    for (let i = 0; i < rings.length - 1; i++) {
      for (let k = 0; k < sides; k++) {
        const k2 = (k + 1) % sides;
        this.quad(rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k], color, animFn);
      }
    }
    const last = points[points.length - 1];
    const lastRing = rings[rings.length - 1];
    for (let k = 0; k < sides; k++) {
      this.tri(lastRing[k], lastRing[(k + 1) % sides], last, color, animFn);
    }
  }

  finish(outlineWidth: number): InkAssetData {
    return {
      positions: new Float32Array(this.positions),
      colors: new Float32Array(this.colors),
      anim: new Float32Array(this.anim),
      outlineWidth,
    };
  }
}

export function shades(tint: InkTint): [Rgb, Rgb, Rgb] {
  const [dark, base, light] = TINT_SHADES[tint];
  return [hex(dark), hex(base), hex(light)];
}

export const INK = hex("#211d17");

/** Weltwurzel: white spiral strands that tower above everything else. */
function buildWorldroot(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base] = shades(tint);
  const sway: AnimFn = (p) => {
    const w = Math.max(0, p[1]) * 0.03;
    return [w, 0, w * 0.5, p[1] * 1.6];
  };
  for (let strand = 0; strand < 3; strand++) {
    const phase = strand * 2.1;
    const points: Vec[] = [];
    const radii: number[] = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      const spiral = 0.28 * (1 - t * 0.55);
      points.push([Math.cos(t * 8 + phase) * spiral, t * 3.1, Math.sin(t * 8 + phase) * spiral]);
      radii.push(0.13 * (1 - t * 0.8) + 0.02);
    }
    b.tube(points, radii, 7, strand % 2 === 0 ? base : dark, sway);
  }
  for (let root = 0; root < 4; root++) {
    const angle = (root / 4) * Math.PI * 2 + 0.6;
    const points: Vec[] = [];
    const radii: number[] = [];
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      points.push([Math.cos(angle) * t * 0.6, 0.16 - t * 0.2, Math.sin(angle) * t * 0.6]);
      radii.push(0.08 * (1 - t) + 0.015);
    }
    b.tube(points, radii, 5, dark, null);
  }
  b.blob(0, 3.25, 0, 0.2, 0.32, 0.12, 5, base, sway);
  return b.finish(0.02);
}

/** Baum: faceted swaying crown on a trunk. */
function buildTree(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const trunk = hex("#7a5a3a");
  const sway: AnimFn = (p) => {
    const w = Math.max(0, p[1] - 0.5) * 0.05;
    return [w, 0, w * 0.4, p[1] * 1.4];
  };
  b.column(0, 0, 0, 0.2, 0.11, 1.0, 7, trunk, null);
  b.blob(0, 1.25, 0, 0.78, 0.6, 0.42, 7, dark, sway);
  b.blob(0.12, 1.78, 0.05, 0.55, 0.5, 0.3, 6, base, sway);
  b.blob(-0.05, 2.2, -0.04, 0.34, 0.4, 0.2, 5, light, sway);
  return b.finish(0.03);
}

/** Haus: gabled paper house, roof takes the tint, smoke handled by the app. */
function buildHouse(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base] = shades(tint);
  const paper = hex("#f1e8d4");
  const paperDark = hex("#d9cba1");
  b.box(0, 0.45, 0, 1.5, 0.9, 1.1, paper, null);
  const y0 = 0.9;
  const y1 = 1.42;
  const xw = 0.86;
  const zw = 0.66;
  b.quad([-xw, y0, zw], [xw, y0, zw], [xw, y1, 0], [-xw, y1, 0], base, null);
  b.quad([xw, y0, -zw], [-xw, y0, -zw], [-xw, y1, 0], [xw, y1, 0], dark, null);
  b.tri([xw, y0, zw], [xw, y0, -zw], [xw, y1, 0], paperDark, null);
  b.tri([-xw, y0, -zw], [-xw, y0, zw], [-xw, y1, 0], paperDark, null);
  b.box(0.42, 1.42, 0.15, 0.2, 0.5, 0.2, hex("#93744e"), null);
  b.box(-0.2, 0.34, 0.556, 0.3, 0.6, 0.02, INK, null);
  b.box(0.35, 0.58, 0.556, 0.26, 0.26, 0.02, base, null);
  return b.finish(0.03);
}

/** Turm: jagged ruin with a waving banner in the tint hue. */
function buildTower(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base] = shades(tint);
  const stone = hex("#d9cba1");
  const jitter = [0, 0.12, -0.3, 0.05, -0.15, 0.22, -0.42, 0.1];
  b.column(0, 0, 0, 0.6, 0.46, 1.7, 8, stone, null, jitter);
  b.box(0, 0.42, 0.55, 0.3, 0.5, 0.1, INK, null);
  b.box(0.18, 1.15, 0.5, 0.12, 0.3, 0.08, INK, null);
  b.box(-0.05, 1.95, 0, 0.04, 0.55, 0.04, hex("#5c452c"), null);
  const flag: AnimFn = (p) => [0, 0.03 + p[0] * 0.05, 0.05, p[0] * 7];
  b.quad([-0.03, 2.2, 0], [0.42, 2.14, 0], [0.42, 2.0, 0], [-0.03, 2.06, 0], base, flag);
  b.quad([-0.03, 2.06, 0], [0.42, 2.0, 0], [0.42, 2.14, 0], [-0.03, 2.2, 0], dark, flag);
  return b.finish(0.03);
}

/** Asteroid: craggy chunk, tumbling handled by the app's orbit transform. */
function buildAsteroid(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, , light] = shades(tint);
  b.blob(0, 0, 0, 0.55, 0.45, 0.5, 5, light, null);
  b.box(0.2, 0.1, 0.15, 0.6, 0.5, 0.55, dark, null);
  return b.finish(0.02);
}

const BUILDERS: Record<InkAssetKind, (tint: InkTint) => InkAssetData> = {
  worldroot: buildWorldroot,
  tree: buildTree,
  house: buildHouse,
  tower: buildTower,
  asteroid: buildAsteroid,
  ...INK_ASSET_BUILDERS_BATCH2,
};

/** Default tint per kind (worldroots are lore-white). */
export const INK_ASSET_DEFAULT_TINT: Record<InkAssetKind, InkTint> = {
  worldroot: "paper",
  tree: "teal",
  house: "terra",
  tower: "paper",
  asteroid: "sepia",
  fels: "sepia",
  busch: "teal",
  bruecke: "sepia",
  muehle: "paper",
  hafen: "sepia",
  portal: "blue",
  obelisk: "sepia",
  mond: "paper",
};

export function buildInkAsset(kind: InkAssetKind, tint?: InkTint): InkAssetData {
  const builder = BUILDERS[kind];
  return builder(tint ?? INK_ASSET_DEFAULT_TINT[kind]);
}
