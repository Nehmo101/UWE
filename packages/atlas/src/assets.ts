/**
 * Atlas Gouache asset engine — painted, filled map assets (Canvas-of-Kings
 * style) as a counterpart to the stroke-only pictograms in `glyphs.ts`.
 *
 * Each asset is a deterministic, code-defined *recipe* that paints filled,
 * shaded shapes with a darker pigment edge (opaque "gouache" look). Recipes are
 * browser-only in their bodies (they touch a `CanvasRenderingContext2D`) but the
 * module has no DOM access at import time, so it is safe to import in Node —
 * exactly like `canvas-render.ts`. The registry metadata is pure data and is
 * exercised by the Node test suite.
 *
 * An object opts into gouache rendering via `AtlasObject.style.gouache = <key>`;
 * the renderers then call {@link drawGouacheAsset} instead of the glyph path.
 */

import { mulberry32, hashStringToSeed } from "./prng";

// ---------------------------------------------------------------------------
// Registry metadata (pure data — testable)
// ---------------------------------------------------------------------------

export type GouacheCategory =
  | "flora"
  | "structure"
  | "landmark"
  | "vehicle"
  | "market"
  | "prop";

export interface GouacheAsset {
  /** Stable key persisted in `AtlasObject.style.gouache`. Never rename. */
  key: string;
  /** German display name for the palette. */
  name: string;
  /** Grouping for the palette. */
  category: GouacheCategory;
}

export const GOUACHE_CATEGORY_LABELS: Record<GouacheCategory, string> = {
  flora: "Flora",
  structure: "Bauwerke",
  landmark: "Landmarken",
  vehicle: "Fahrzeuge",
  market: "Markt",
  prop: "Deko",
};

/** Canonical, ordered gouache asset registry (metadata only). */
export const GOUACHE_ASSETS: readonly GouacheAsset[] = [
  { key: "g_oak", name: "Eiche", category: "flora" },
  { key: "g_pine", name: "Nadelbaum", category: "flora" },
  { key: "g_bush", name: "Busch", category: "flora" },
  { key: "g_mushroom", name: "Riesenpilz", category: "flora" },
  { key: "g_house", name: "Haus", category: "structure" },
  { key: "g_tower", name: "Turm", category: "structure" },
  { key: "g_keep", name: "Bergfried", category: "structure" },
  { key: "g_church", name: "Kirche", category: "structure" },
  { key: "g_windmill", name: "Windmühle", category: "structure" },
  { key: "g_tent", name: "Zelt", category: "structure" },
  { key: "g_ruin", name: "Ruine", category: "structure" },
  { key: "g_pyramid", name: "Pyramide", category: "landmark" },
  { key: "g_obelisk", name: "Obelisk", category: "landmark" },
  { key: "g_floating_island", name: "Fliegende Insel", category: "landmark" },
  { key: "g_turtle_castle", name: "Schildkröten-Schloss", category: "landmark" },
  { key: "g_ship", name: "Schiff", category: "vehicle" },
  { key: "g_cart", name: "Pferdekarren", category: "vehicle" },
  { key: "g_airship", name: "Flugschiff", category: "vehicle" },
  { key: "g_stall", name: "Marktstand", category: "market" },
  { key: "g_well", name: "Brunnen", category: "prop" },
] as const;

export const GOUACHE_ASSET_KEYS: readonly string[] = GOUACHE_ASSETS.map(
  (a) => a.key,
);

const ASSETS_BY_KEY = new Map(GOUACHE_ASSETS.map((a) => [a.key, a]));

/** Look up gouache asset metadata by key. */
export function getGouacheAsset(key: string | null | undefined): GouacheAsset | undefined {
  return key ? ASSETS_BY_KEY.get(key) : undefined;
}

/** All gouache assets of a category, in registry order. */
export function listGouacheAssetsByCategory(cat: GouacheCategory): GouacheAsset[] {
  return GOUACHE_ASSETS.filter((a) => a.category === cat);
}

// ---------------------------------------------------------------------------
// Painting toolkit (browser-only bodies)
// ---------------------------------------------------------------------------

type Ctx = CanvasRenderingContext2D;
type Rng = () => number;
type PathFn = (ctx: Ctx) => void;

function hexRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function darken(h: string, f: number): string {
  const [r, g, b] = hexRgb(h);
  return `rgb(${Math.round(r * (1 - f))},${Math.round(g * (1 - f))},${Math.round(b * (1 - f))})`;
}
function lighten(h: string, f: number): string {
  const [r, g, b] = hexRgb(h);
  return `rgb(${Math.round(r + (255 - r) * f)},${Math.round(g + (255 - g) * f)},${Math.round(b + (255 - b) * f)})`;
}

function shadow(ctx: Ctx, x: number, y: number, rx: number): void {
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = "#2a1e0c";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, rx * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function rectFn(x: number, y: number, w: number, h: number): PathFn {
  return (c) => {
    c.beginPath();
    c.rect(x, y, w, h);
  };
}
function polyFn(pts: number[][]): PathFn {
  return (c) => {
    c.beginPath();
    c.moveTo(pts[0]![0]!, pts[0]![1]!);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i]![0]!, pts[i]![1]!);
    c.closePath();
  };
}
function blobFn(pts: number[][]): PathFn {
  return (c) => {
    const n = pts.length;
    c.beginPath();
    c.moveTo((pts[0]![0]! + pts[n - 1]![0]!) / 2, (pts[0]![1]! + pts[n - 1]![1]!) / 2);
    for (let i = 0; i < n; i++) {
      const cur = pts[i]!;
      const nx = pts[(i + 1) % n]!;
      c.quadraticCurveTo(cur[0]!, cur[1]!, (cur[0]! + nx[0]!) / 2, (cur[1]! + nx[1]!) / 2);
    }
    c.closePath();
  };
}
function iblob(cx: number, cy: number, rx: number, ry: number, rng: Rng, jag = 0.24, n = 12): number[][] {
  const p: number[][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (rng() - 0.5) * 2 * jag;
    p.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return p;
}

/** Fill (opaque) + darker pigment edge; `lw` drives the edge/ink weight. */
function paint(ctx: Ctx, pf: PathFn, fill: string, lw: number, edgeColor?: string): void {
  ctx.save();
  ctx.fillStyle = fill;
  pf(ctx);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = edgeColor ?? darken(fill, 0.42);
  ctx.lineWidth = Math.max(0.5, lw);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  pf(ctx);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Recipes — draw around origin (0,0) = base-centre; object grows upward (−y).
// `s` is the asset size in px. `lw` is the ink/edge weight in px.
// ---------------------------------------------------------------------------

type Recipe = (ctx: Ctx, s: number, rng: Rng, lw: number) => void;

function tree(ctx: Ctx, s: number, rng: Rng, lw: number, base: string, dark: string, hi: string): void {
  const cy = -s * 0.55;
  shadow(ctx, 0, s * 0.02, s * 0.5);
  paint(ctx, rectFn(-s * 0.07, -s * 0.3, s * 0.14, s * 0.34), "#7a5230", lw * 0.8, "#4a3320");
  const blob = iblob(0, cy, s * 0.5, s * 0.46, rng, 0.26, 12);
  const P = blobFn(blob);
  ctx.save(); ctx.fillStyle = base; P(ctx); ctx.fill(); ctx.restore();
  ctx.save(); ctx.fillStyle = dark; ctx.globalAlpha = 0.5; blobFn(blob.map((p) => [p[0]! + s * 0.08, p[1]! + s * 0.12]))(ctx); ctx.fill(); ctx.restore();
  ctx.save(); ctx.fillStyle = hi; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.ellipse(-s * 0.13, cy - s * 0.15, s * 0.2, s * 0.15, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.strokeStyle = darken(base, 0.5); ctx.lineWidth = Math.max(0.6, lw); ctx.lineJoin = "round"; P(ctx); ctx.stroke(); ctx.restore();
}

const RECIPES: Record<string, Recipe> = {
  g_oak: (ctx, s, rng, lw) => tree(ctx, s, rng, lw, "#5f9a4a", "#33613a", "#aacf7a"),
  g_bush: (ctx, s, rng, lw) => {
    shadow(ctx, 0, s * 0.02, s * 0.4);
    const b = iblob(0, -s * 0.24, s * 0.42, s * 0.3, rng, 0.3, 10);
    paint(ctx, blobFn(b), "#5c8f43", lw);
  },
  g_pine: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.02, s * 0.42);
    paint(ctx, rectFn(-s * 0.06, -s * 0.28, s * 0.12, s * 0.3), "#6a4a2a", lw * 0.8);
    for (let i = 0; i < 3; i++) {
      const y = -s * (0.25 + i * 0.22), w = s * (0.42 - i * 0.1);
      paint(ctx, polyFn([[-w, y], [0, y - s * 0.34], [w, y]]), i === 0 ? "#3f6d39" : "#478043", lw);
    }
  },
  g_mushroom: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.02, s * 0.42);
    paint(ctx, rectFn(-s * 0.13, -s * 0.5, s * 0.26, s * 0.52), "#e6dcc4", lw);
    paint(ctx, blobFn(iblob(0, -s * 0.5, s * 0.5, s * 0.26, () => 0.5, 0.05, 10)), "#b4402f", lw);
    ctx.save(); ctx.fillStyle = "#f0e6cf"; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * s * 0.24, -s * 0.56, s * 0.06, 0, Math.PI * 2); ctx.fill(); } ctx.restore();
  },
  g_house: (ctx, s, _rng, lw) => {
    const w = s * 0.95, h = s * 0.62;
    shadow(ctx, 0, s * 0.04, s * 0.6);
    paint(ctx, rectFn(-w / 2, -h, w, h), "#dcc79c", lw);
    paint(ctx, polyFn([[-w * 0.62, -h + 2], [0, -h * 1.7], [w * 0.62, -h + 2]]), "#a8432e", lw);
    ctx.save(); ctx.fillStyle = "#5a4026"; ctx.fillRect(-s * 0.08, -h * 0.55, s * 0.16, h * 0.55); ctx.restore();
  },
  g_tower: (ctx, s, _rng, lw) => {
    const w = s * 0.5, h = s * 0.95;
    shadow(ctx, 0, s * 0.03, s * 0.42);
    paint(ctx, rectFn(-w / 2, -h, w, h), "#cbb98e", lw);
    paint(ctx, polyFn([[-w * 0.72, -h + 1], [0, -h * 1.5], [w * 0.72, -h + 1]]), "#8a3526", lw);
  },
  g_keep: (ctx, s, _rng, lw) => {
    const w = s * 1.1, h = s * 1.1;
    shadow(ctx, 0, s * 0.05, s * 0.8);
    for (const sx of [-1, 1]) {
      paint(ctx, rectFn(sx * w * 0.42 - s * 0.13, -h * 1.15, s * 0.26, h * 1.15), "#bcac80", lw);
      paint(ctx, polyFn([[sx * w * 0.42 - s * 0.2, -h * 1.15], [sx * w * 0.42, -h * 1.45], [sx * w * 0.42 + s * 0.2, -h * 1.15]]), "#7f3222", lw);
    }
    paint(ctx, rectFn(-w / 2, -h, w, h), "#c6b487", lw);
    for (let i = 0; i < 3; i++) paint(ctx, rectFn(-w / 2 + w * (i / 2) - s * 0.12, -h - s * 0.16, s * 0.24, s * 0.18), "#c6b487", lw * 0.8);
    ctx.save(); ctx.fillStyle = "#4a3722"; ctx.fillRect(-s * 0.14, -h * 0.5, s * 0.28, h * 0.5); ctx.restore();
  },
  g_church: (ctx, s, _rng, lw) => {
    const w = s * 0.85, h = s * 0.6;
    shadow(ctx, 0, s * 0.04, s * 0.6);
    paint(ctx, rectFn(-w / 2, -h, w, h), "#d7cba6", lw);
    paint(ctx, polyFn([[-w * 0.6, -h], [0, -h * 1.5], [w * 0.6, -h]]), "#7a4a2a", lw);
    const tx = -w * 0.34, tw = s * 0.34, th = s * 1.15;
    paint(ctx, rectFn(tx - tw / 2, -th, tw, th), "#cdbd95", lw);
    paint(ctx, polyFn([[tx - tw * 0.62, -th], [tx, -th - s * 0.5], [tx + tw * 0.62, -th]]), "#5f6f78", lw);
    ctx.save(); ctx.strokeStyle = "#4a4030"; ctx.lineWidth = Math.max(1, lw); ctx.beginPath(); ctx.moveTo(tx, -th - s * 0.5); ctx.lineTo(tx, -th - s * 0.74); ctx.moveTo(tx - s * 0.08, -th - s * 0.66); ctx.lineTo(tx + s * 0.08, -th - s * 0.66); ctx.stroke(); ctx.restore();
  },
  g_windmill: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.44);
    paint(ctx, polyFn([[-s * 0.3, 0], [-s * 0.22, -s], [s * 0.22, -s], [s * 0.3, 0]]), "#cdbd95", lw);
    paint(ctx, polyFn([[-s * 0.28, -s], [0, -s * 1.28], [s * 0.28, -s]]), "#7a4a2a", lw);
    ctx.save(); ctx.translate(0, -s * 0.75); ctx.strokeStyle = "#4a3722"; ctx.lineWidth = Math.max(1, lw); ctx.fillStyle = "#e0d3ad";
    for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2 + 0.5); ctx.fillRect(s * 0.05, -s * 0.03, s * 0.5, s * 0.12); ctx.strokeRect(s * 0.05, -s * 0.03, s * 0.5, s * 0.12); } ctx.restore();
  },
  g_tent: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.5);
    paint(ctx, polyFn([[-s * 0.5, 0], [0, -s * 0.9], [s * 0.5, 0]]), "#c99a5a", lw);
    ctx.save(); ctx.strokeStyle = "#6a4a2a"; ctx.lineWidth = Math.max(1, lw); ctx.beginPath(); ctx.moveTo(0, -s * 0.9); ctx.lineTo(0, -s * 0.05); ctx.stroke(); ctx.restore();
  },
  g_ruin: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.55);
    paint(ctx, rectFn(-s * 0.45, -s * 0.5, s * 0.22, s * 0.5), "#b7a880", lw);
    paint(ctx, rectFn(s * 0.05, -s * 0.75, s * 0.2, s * 0.75), "#b0a179", lw);
    paint(ctx, rectFn(-s * 0.1, -s * 0.32, s * 0.12, s * 0.32), "#a99a72", lw);
    ctx.save(); ctx.strokeStyle = "#6f5c3c"; ctx.lineWidth = Math.max(0.8, lw * 0.7); ctx.beginPath(); ctx.moveTo(-s * 0.45, -s * 0.5); ctx.lineTo(-s * 0.34, -s * 0.62); ctx.lineTo(-s * 0.23, -s * 0.5); ctx.stroke(); ctx.restore();
  },
  g_pyramid: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.7);
    paint(ctx, polyFn([[-s * 0.7, 0], [0, -s], [s * 0.05, -s], [s * 0.05, 0]]), "#c8a75a", lw);
    paint(ctx, polyFn([[s * 0.05, 0], [s * 0.05, -s], [s * 0.7, 0]]), "#a98640", lw);
  },
  g_obelisk: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.02, s * 0.28);
    paint(ctx, polyFn([[-s * 0.12, 0], [-s * 0.08, -s], [0, -s * 1.15], [s * 0.08, -s], [s * 0.12, 0]]), "#9a9488", lw);
    ctx.save(); ctx.strokeStyle = "#4a4636"; ctx.lineWidth = Math.max(0.6, lw * 0.6); for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.06, -s * 0.2 * i); ctx.lineTo(s * 0.06, -s * 0.2 * i); ctx.stroke(); } ctx.restore();
  },
  g_floating_island: (ctx, s, rng, lw) => {
    shadow(ctx, s * 0.1, s * 0.5, s * 0.55);
    paint(ctx, polyFn([[-s * 0.55, -s * 0.5], [s * 0.55, -s * 0.5], [s * 0.3, -s * 0.05], [0, s * 0.2], [-s * 0.3, -s * 0.05]]), "#7a5a38", lw);
    paint(ctx, blobFn(iblob(0, -s * 0.55, s * 0.55, s * 0.16, rng, 0.18, 10)), "#5f9a4a", lw);
    for (const dx of [-0.28, 0.05, 0.3]) {
      ctx.save();
      ctx.translate(dx * s, -s * 0.5);
      tree(ctx, s * 0.34, () => 0.5, lw * 0.8, "#5f9a4a", "#33613a", "#aacf7a");
      ctx.restore();
    }
  },
  g_turtle_castle: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.05, s * 0.7);
    paint(ctx, blobFn(iblob(0, -s * 0.2, s * 0.6, s * 0.32, () => 0.5, 0.05, 12)), "#5c7a4a", lw);
    for (const dx of [-0.7, -0.35, 0.35, 0.7]) paint(ctx, polyFn([[dx * s - s * 0.06, 0], [dx * s, -s * 0.18], [dx * s + s * 0.06, 0]]), "#4a6640", lw);
    paint(ctx, polyFn([[s * 0.6, -s * 0.15], [s * 0.78, -s * 0.32], [s * 0.72, -s * 0.05]]), "#4a6640", lw);
    paint(ctx, rectFn(-s * 0.24, -s * 0.7, s * 0.48, s * 0.42), "#c6b487", lw);
    for (const sx of [-1, 1]) paint(ctx, rectFn(sx * s * 0.28 - s * 0.08, -s * 0.78, s * 0.16, s * 0.5), "#bcac80", lw);
  },
  g_ship: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.04, s * 0.5);
    paint(ctx, polyFn([[-s * 0.55, -s * 0.1], [s * 0.55, -s * 0.1], [s * 0.38, s * 0.16], [-s * 0.38, s * 0.16]]), "#7a4f2c", lw);
    ctx.save(); ctx.strokeStyle = "#4a3320"; ctx.lineWidth = Math.max(1, lw); ctx.beginPath(); ctx.moveTo(0, -s * 0.1); ctx.lineTo(0, -s * 0.95); ctx.stroke(); ctx.restore();
    paint(ctx, polyFn([[0, -s * 0.9], [s * 0.4, -s * 0.32], [0, -s * 0.32]]), "#efe4c6", lw);
  },
  g_airship: (ctx, s, _rng, lw) => {
    shadow(ctx, s * 0.1, s * 0.75, s * 0.4);
    paint(ctx, blobFn(iblob(0, -s * 0.7, s * 0.6, s * 0.34, () => 0.5, 0.04, 12)), "#b0563f", lw);
    ctx.save(); ctx.fillStyle = "#e8ddc0"; for (let i = -2; i <= 2; i++) ctx.fillRect(i * s * 0.2 - s * 0.02, -s * 1.04, s * 0.04, s * 0.68); ctx.restore();
    paint(ctx, polyFn([[-s * 0.28, -s * 0.32], [s * 0.28, -s * 0.32], [s * 0.2, -s * 0.1], [-s * 0.2, -s * 0.1]]), "#7a4f2c", lw);
  },
  g_stall: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.02, s * 0.42);
    ctx.save(); ctx.strokeStyle = "#6a4a2a"; ctx.lineWidth = Math.max(1, lw); ctx.beginPath(); ctx.moveTo(-s * 0.35, 0); ctx.lineTo(-s * 0.35, -s * 0.5); ctx.moveTo(s * 0.35, 0); ctx.lineTo(s * 0.35, -s * 0.5); ctx.stroke(); ctx.restore();
    paint(ctx, rectFn(-s * 0.42, -s * 0.64, s * 0.84, s * 0.17), "#c24a3a", lw * 0.7, "#8a2f22");
    ctx.save(); ctx.fillStyle = "#e8ddc0"; for (let i = 0; i < 3; i++) ctx.fillRect(-s * 0.42 + i * s * 0.28 + s * 0.07, -s * 0.64, s * 0.14, s * 0.17); ctx.restore();
  },
  g_cart: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.05, s * 0.5);
    paint(ctx, rectFn(-s * 0.4, -s * 0.45, s * 0.8, s * 0.3), "#8a5e34", lw);
    ctx.save(); ctx.fillStyle = "#3a2a18"; ctx.strokeStyle = "#2a1e10"; ctx.lineWidth = Math.max(1, lw);
    for (const dx of [-0.24, 0.24]) { ctx.beginPath(); ctx.arc(dx * s, -s * 0.05, s * 0.16, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } ctx.restore();
  },
  g_well: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.02, s * 0.3);
    paint(ctx, (c) => { c.beginPath(); c.ellipse(0, -s * 0.1, s * 0.22, s * 0.14, 0, 0, Math.PI * 2); }, "#b6a680", lw);
    ctx.save(); ctx.strokeStyle = "#5a4026"; ctx.lineWidth = Math.max(1, lw); ctx.beginPath(); ctx.moveTo(-s * 0.22, -s * 0.1); ctx.lineTo(-s * 0.26, -s * 0.5); ctx.moveTo(s * 0.22, -s * 0.1); ctx.lineTo(s * 0.26, -s * 0.5); ctx.moveTo(-s * 0.3, -s * 0.5); ctx.lineTo(s * 0.3, -s * 0.5); ctx.stroke(); ctx.restore();
  },
};

// ---------------------------------------------------------------------------
// drawGouacheAsset — public browser-only entry
// ---------------------------------------------------------------------------

export interface DrawGouacheAssetOptions {
  /** Canvas-pixel anchor (base-centre of the asset). */
  x: number;
  y: number;
  /** Rendered size in px (before per-object scale). Default 30. */
  size?: number;
  /** Per-object scale multiplier. Default 1. */
  scale?: number;
  /** Rotation in radians. Default 0. */
  rotation?: number;
  /** Ink/edge weight in px. Default 1.4. */
  lineWidth?: number;
  /** Blur in px applied to the whole asset (0 = crisp). Default 0. */
  blur?: number;
  /** Deterministic seed; defaults to a hash of the asset key. */
  seed?: number;
}

/**
 * Draw a gouache asset onto a Canvas 2D context. No-op for unknown keys.
 * Pure Canvas 2D — no DOM beyond `ctx`.
 */
export function drawGouacheAsset(
  ctx: Ctx,
  key: string,
  opts: DrawGouacheAssetOptions,
): void {
  const recipe = RECIPES[key];
  if (!recipe) return;
  const size = (opts.size ?? 30) * (opts.scale ?? 1);
  const lw = opts.lineWidth ?? 1.4;
  const rng = mulberry32(opts.seed ?? hashStringToSeed(key));
  ctx.save();
  if (opts.blur && opts.blur > 0) ctx.filter = `blur(${opts.blur}px)`;
  ctx.translate(opts.x, opts.y);
  if (opts.rotation) ctx.rotate(opts.rotation);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  recipe(ctx, size, rng, lw);
  ctx.restore();
}

/** Whether a key maps to a real gouache recipe (renderable). */
export function isGouacheAsset(key: string | null | undefined): boolean {
  return !!key && key in RECIPES;
}

// Silence unused in non-DOM lint contexts; lighten is used by future recipes.
void lighten;
