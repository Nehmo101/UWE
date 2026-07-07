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

import { BATCH4_RECIPES, GOUACHE_ASSETS_BATCH4 } from "./assets-batch4";
import { BATCH5_RECIPES, GOUACHE_ASSETS_BATCH5, GLYPH_TO_GOUACHE } from "./assets-batch5";
import {
  type Ctx,
  type Recipe,
  type Rng,
  blobFn,
  darken,
  ellipseFn,
  iblob,
  lighten,
  paint,
  polyFn,
  rectFn,
  shadow,
} from "./assets-toolkit";

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
  { key: "g_watermill", name: "Wassermühle", category: "structure" },
  { key: "g_tent", name: "Zelt", category: "structure" },
  { key: "g_ruin", name: "Ruine", category: "structure" },
  { key: "g_signal_tower", name: "Signalturm", category: "structure" },
  { key: "g_bridge", name: "Steinbrücke", category: "structure" },
  { key: "g_lighthouse", name: "Leuchtturm", category: "structure" },
  { key: "g_amphitheater", name: "Amphitheater", category: "structure" },
  { key: "g_burial_mound", name: "Grabhügel", category: "structure" },
  { key: "g_caravanserai", name: "Karawanserei", category: "structure" },
  { key: "g_pyramid", name: "Pyramide", category: "landmark" },
  { key: "g_obelisk", name: "Obelisk", category: "landmark" },
  { key: "g_cave_mouth", name: "Höhleneingang", category: "landmark" },
  { key: "g_magic_crystal", name: "Magiekristall", category: "landmark" },
  { key: "g_stone_circle", name: "Steinkreis", category: "landmark" },
  { key: "g_floating_island", name: "Fliegende Insel", category: "landmark" },
  { key: "g_turtle_castle", name: "Schildkröten-Schloss", category: "landmark" },
  { key: "g_ziggurat", name: "Ziggurat", category: "landmark" },
  { key: "g_portal_arch", name: "Portalbogen", category: "landmark" },
  { key: "g_ship", name: "Schiff", category: "vehicle" },
  { key: "g_cart", name: "Pferdekarren", category: "vehicle" },
  { key: "g_airship", name: "Flugschiff", category: "vehicle" },
  { key: "g_stall", name: "Marktstand", category: "market" },
  { key: "g_well", name: "Brunnen", category: "prop" },
  ...GOUACHE_ASSETS_BATCH4,
  ...GOUACHE_ASSETS_BATCH5,
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
// Recipes — draw around origin (0,0) = base-centre; object grows upward (−y).
// `s` is the asset size in px. `lw` is the ink/edge weight in px.
// The painting toolkit (paint/shadow/blob helpers) lives in `assets-toolkit.ts`;
// newer recipe batches live in their own modules (e.g. `assets-batch4.ts`).
// ---------------------------------------------------------------------------

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
  g_watermill: (ctx, s, _rng, lw) => {
    const h = s * 0.58;
    shadow(ctx, 0, s * 0.04, s * 0.6);
    paint(ctx, blobFn(iblob(s * 0.4, -s * 0.02, s * 0.3, s * 0.1, () => 0.5, 0.12, 8)), "#7290a2", lw * 0.55, "#46606e");
    paint(ctx, rectFn(-s * 0.66, -h, s * 0.78, h), "#cdbd95", lw);
    paint(ctx, polyFn([[-s * 0.76, -h + 1], [-s * 0.27, -h * 1.55], [s * 0.22, -h + 1]]), "#7a4a2a", lw);
    ctx.save(); ctx.fillStyle = "#5a4026"; ctx.fillRect(-s * 0.42, -h * 0.55, s * 0.16, h * 0.55); ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = lighten("#cdbd95", 0.32); ctx.fillRect(-s * 0.6, -h + s * 0.04, s * 0.14, h * 0.34); ctx.restore();
    paint(ctx, ellipseFn(s * 0.36, -s * 0.34, s * 0.3, s * 0.3), "#8a5e34", lw, "#4a3320");
    paint(ctx, ellipseFn(s * 0.36, -s * 0.34, s * 0.12, s * 0.12), "#cdbd95", lw * 0.6, "#4a3320");
    ctx.save(); ctx.strokeStyle = "#4a3320"; ctx.lineWidth = Math.max(0.8, lw * 0.75);
    for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 4; ctx.beginPath(); ctx.moveTo(s * 0.36 - Math.cos(a) * s * 0.27, -s * 0.34 - Math.sin(a) * s * 0.27); ctx.lineTo(s * 0.36 + Math.cos(a) * s * 0.27, -s * 0.34 + Math.sin(a) * s * 0.27); ctx.stroke(); }
    ctx.restore();
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
  g_signal_tower: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.42);
    for (const dx of [-0.18, 0.18]) paint(ctx, polyFn([[dx * s - s * 0.04, 0], [dx * s + s * 0.04, 0], [dx * s + s * 0.02, -s * 0.82], [dx * s - s * 0.02, -s * 0.82]]), "#7a5230", lw * 0.65, "#4a3320");
    ctx.save(); ctx.strokeStyle = "#5a4026"; ctx.lineWidth = Math.max(0.8, lw * 0.7); ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.22); ctx.lineTo(s * 0.2, -s * 0.58); ctx.moveTo(s * 0.2, -s * 0.22); ctx.lineTo(-s * 0.2, -s * 0.58); ctx.stroke(); ctx.restore();
    paint(ctx, rectFn(-s * 0.3, -s * 0.9, s * 0.6, s * 0.17), "#8a5e34", lw, "#4a3320");
    paint(ctx, polyFn([[-s * 0.2, -s * 0.91], [0, -s * 1.2], [s * 0.2, -s * 0.91]]), "#c96a2f", lw, "#80301d");
    paint(ctx, polyFn([[-s * 0.09, -s * 0.92], [0, -s * 1.1], [s * 0.08, -s * 0.92]]), "#f0c35c", lw * 0.65, "#9a4a22");
  },
  g_bridge: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.62);
    paint(ctx, polyFn([[-s * 0.62, -s * 0.08], [-s * 0.5, -s * 0.46], [s * 0.5, -s * 0.46], [s * 0.62, -s * 0.08], [s * 0.5, s * 0.02], [-s * 0.5, s * 0.02]]), "#b9aa86", lw, "#6f6145");
    paint(ctx, (c) => { c.beginPath(); c.moveTo(-s * 0.3, s * 0.01); c.lineTo(-s * 0.3, -s * 0.1); c.quadraticCurveTo(0, -s * 0.4, s * 0.3, -s * 0.1); c.lineTo(s * 0.3, s * 0.01); c.closePath(); }, "#4a4638", lw * 0.7, "#5a513d");
    for (let i = 0; i < 4; i++) {
      const x = -s * 0.44 + i * s * 0.29;
      paint(ctx, rectFn(x, -s * 0.5, s * 0.16, s * 0.12), "#c7ba92", lw * 0.45, "#756845");
    }
  },
  g_lighthouse: (ctx, s, rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.5);
    paint(ctx, blobFn(iblob(0, -s * 0.02, s * 0.42, s * 0.12, rng, 0.2, 9)), "#9a9488", lw * 0.7, "#5f5a4d");
    const half = (t: number) => s * (0.24 - 0.12 * ((t - 0.04) / 0.92));
    paint(ctx, polyFn([[-half(0.04), -s * 0.04], [-half(0.96), -s * 0.96], [half(0.96), -s * 0.96], [half(0.04), -s * 0.04]]), "#e0d6b4", lw);
    for (const [a, b] of [[0.22, 0.38], [0.56, 0.72]] as const) {
      paint(ctx, polyFn([[-half(a), -s * a], [-half(b), -s * b], [half(b), -s * b], [half(a), -s * a]]), "#a8432e", lw * 0.55, "#7f2f20");
    }
    ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = lighten("#e0d6b4", 0.35); ctx.fillRect(-s * 0.1, -s * 0.9, s * 0.05, s * 0.8); ctx.restore();
    paint(ctx, rectFn(-s * 0.17, -s * 1.02, s * 0.34, s * 0.07), "#6f665a", lw * 0.6);
    ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = "#f0c35c"; ctx.beginPath(); ctx.ellipse(0, -s * 1.1, s * 0.34, s * 0.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    paint(ctx, rectFn(-s * 0.09, -s * 1.16, s * 0.18, s * 0.14), "#f0c35c", lw * 0.6, "#9a4a22");
    paint(ctx, polyFn([[-s * 0.13, -s * 1.16], [0, -s * 1.32], [s * 0.13, -s * 1.16]]), "#8a3526", lw);
  },
  g_amphitheater: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.04, s * 0.75);
    paint(ctx, ellipseFn(0, -s * 0.34, s * 0.64, s * 0.36), "#c1b28a", lw, "#75664a");
    paint(ctx, ellipseFn(0, -s * 0.4, s * 0.46, s * 0.24), "#a99a72", lw * 0.7, "#6f5c3c");
    paint(ctx, ellipseFn(0, -s * 0.42, s * 0.3, s * 0.14), "#c8a75a", lw * 0.6, "#8a6f3a");
    ctx.save(); ctx.fillStyle = "#4a4030";
    for (let i = -2; i <= 2; i++) {
      const x = i * s * 0.22, y = -s * 0.05 - Math.abs(i) * s * 0.05;
      ctx.beginPath(); ctx.moveTo(x - s * 0.05, y); ctx.lineTo(x - s * 0.05, y - s * 0.1); ctx.quadraticCurveTo(x, y - s * 0.18, x + s * 0.05, y - s * 0.1); ctx.lineTo(x + s * 0.05, y); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = lighten("#c1b28a", 0.35); ctx.lineWidth = Math.max(1, lw * 1.3); ctx.beginPath(); ctx.ellipse(0, -s * 0.34, s * 0.56, s * 0.3, 0, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke(); ctx.restore();
  },
  g_burial_mound: (ctx, s, rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.6);
    paint(ctx, (c) => { c.beginPath(); c.moveTo(-s * 0.58, 0); c.quadraticCurveTo(-s * 0.55, -s * 0.52, 0, -s * 0.56); c.quadraticCurveTo(s * 0.55, -s * 0.52, s * 0.58, 0); c.closePath(); }, "#6b8a4f", lw, "#41582f");
    ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = "#a9c77a"; ctx.beginPath(); ctx.ellipse(-s * 0.16, -s * 0.4, s * 0.22, s * 0.1, -0.25, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.fillStyle = "#9a9488"; ctx.strokeStyle = "#5f5a4d"; ctx.lineWidth = Math.max(0.6, lw * 0.5);
    for (const [dx, dy] of [[-0.3, -0.48], [0, -0.58], [0.3, -0.48]] as const) {
      const x = (dx + (rng() - 0.5) * 0.05) * s;
      ctx.beginPath(); ctx.arc(x, dy * s, s * 0.05, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    paint(ctx, polyFn([[-s * 0.2, 0], [-s * 0.16, -s * 0.3], [s * 0.16, -s * 0.3], [s * 0.2, 0]]), "#9a9488", lw * 0.8, "#5f5a4d");
    paint(ctx, (c) => { c.beginPath(); c.moveTo(-s * 0.1, 0); c.lineTo(-s * 0.1, -s * 0.12); c.quadraticCurveTo(0, -s * 0.26, s * 0.1, -s * 0.12); c.lineTo(s * 0.1, 0); c.closePath(); }, "#2f2a24", lw * 0.6, "#4a4030");
  },
  g_caravanserai: (ctx, s, _rng, lw) => {
    const w = s * 1.2, h = s * 0.46;
    shadow(ctx, 0, s * 0.04, s * 0.8);
    paint(ctx, rectFn(-w / 2, -h, w, h), "#d0bd8e", lw, "#8a7448");
    for (let i = -2; i <= 2; i++) paint(ctx, rectFn(i * s * 0.26 - s * 0.05, -h - s * 0.1, s * 0.1, s * 0.12), "#d0bd8e", lw * 0.55, "#8a7448");
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = lighten("#d0bd8e", 0.32); ctx.fillRect(-w / 2 + s * 0.05, -h + s * 0.04, s * 0.2, s * 0.14); ctx.restore();
    for (const sx of [-1, 1]) {
      paint(ctx, rectFn(sx * (w / 2) - s * 0.09, -s * 0.6, s * 0.18, s * 0.6), "#c4b083", lw, "#8a7448");
      paint(ctx, (c) => { c.beginPath(); c.arc(sx * (w / 2), -s * 0.6, s * 0.1, Math.PI, 0); c.closePath(); }, "#5f6f78", lw * 0.7, "#3d4a52");
    }
    paint(ctx, rectFn(-s * 0.21, -s * 0.7, s * 0.42, s * 0.7), "#c9b586", lw, "#8a7448");
    paint(ctx, (c) => { c.beginPath(); c.arc(0, -s * 0.7, s * 0.14, Math.PI, 0); c.closePath(); }, "#5f6f78", lw * 0.7, "#3d4a52");
    paint(ctx, (c) => { c.beginPath(); c.moveTo(-s * 0.1, 0); c.lineTo(-s * 0.1, -s * 0.26); c.quadraticCurveTo(0, -s * 0.44, s * 0.1, -s * 0.26); c.lineTo(s * 0.1, 0); c.closePath(); }, "#3a3226", lw * 0.6, "#57492f");
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
  g_cave_mouth: (ctx, s, rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.55);
    paint(ctx, blobFn(iblob(0, -s * 0.34, s * 0.56, s * 0.42, rng, 0.18, 11)), "#8f8774", lw, "#5f5846");
    paint(ctx, (c) => { c.beginPath(); c.moveTo(-s * 0.28, 0); c.lineTo(-s * 0.24, -s * 0.2); c.quadraticCurveTo(0, -s * 0.58, s * 0.24, -s * 0.2); c.lineTo(s * 0.28, 0); c.closePath(); }, "#2f2a24", lw * 0.8, "#4a4030");
    paint(ctx, blobFn(iblob(-s * 0.22, -s * 0.6, s * 0.16, s * 0.08, () => 0.5, 0.08, 7)), "#5f8a4a", lw * 0.45, "#3a5f35");
    paint(ctx, blobFn(iblob(s * 0.22, -s * 0.52, s * 0.14, s * 0.07, () => 0.5, 0.08, 7)), "#5f8a4a", lw * 0.45, "#3a5f35");
  },
  g_magic_crystal: (ctx, s, _rng, lw) => {
    shadow(ctx, s * 0.08, s * 0.35, s * 0.42);
    ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = "#7fcfe0"; ctx.beginPath(); ctx.ellipse(0, -s * 0.62, s * 0.46, s * 0.78, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    paint(ctx, polyFn([[0, -s * 1.25], [s * 0.28, -s * 0.78], [s * 0.18, -s * 0.22], [0, -s * 0.04], [-s * 0.18, -s * 0.22], [-s * 0.28, -s * 0.78]]), "#68b9cf", lw, "#2e6376");
    paint(ctx, polyFn([[0, -s * 1.25], [s * 0.28, -s * 0.78], [0, -s * 0.7]]), lighten("#68b9cf", 0.28), lw * 0.55, "#4f91a2");
    paint(ctx, polyFn([[0, -s * 0.7], [s * 0.18, -s * 0.22], [0, -s * 0.04], [-s * 0.18, -s * 0.22]]), "#4c94b0", lw * 0.55, "#2e6376");
  },
  g_stone_circle: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.04, s * 0.58);
    const stones: Array<[number, number, number, number]> = [[-0.42, -0.12, 0.16, 0.44], [-0.22, -0.32, 0.14, 0.5], [0, -0.42, 0.16, 0.52], [0.22, -0.32, 0.14, 0.5], [0.42, -0.12, 0.16, 0.44]];
    for (const [x, y, w, h] of stones) paint(ctx, polyFn([[x * s - w * s * 0.5, y * s], [x * s - w * s * 0.38, y * s - h * s * 0.78], [x * s, y * s - h * s], [x * s + w * s * 0.38, y * s - h * s * 0.78], [x * s + w * s * 0.5, y * s]]), "#9a9488", lw, "#5f5a4d");
    ctx.save(); ctx.strokeStyle = "#6f664f"; ctx.lineWidth = Math.max(0.7, lw * 0.55); ctx.beginPath(); ctx.ellipse(0, -s * 0.18, s * 0.42, s * 0.16, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
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
  g_ziggurat: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.75);
    const tiers: Array<[number, number, number]> = [[0.66, 0, 0.26], [0.48, 0.26, 0.24], [0.31, 0.5, 0.22]];
    for (const [hw, b, ht] of tiers) {
      const y0 = -s * b, y1 = -s * (b + ht), tw = hw * 0.82;
      paint(ctx, polyFn([[-s * hw, y0], [-s * tw, y1], [s * tw, y1], [s * hw, y0]]), "#c8a75a", lw, "#7f6531");
      paint(ctx, polyFn([[s * 0.02, y0], [s * 0.02, y1], [s * tw, y1], [s * hw, y0]]), "#a98640", lw * 0.5, "#7f6531");
    }
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = lighten("#c8a75a", 0.32); ctx.beginPath(); ctx.moveTo(-s * 0.62, -s * 0.03); ctx.lineTo(-s * 0.52, -s * 0.24); ctx.lineTo(-s * 0.42, -s * 0.24); ctx.lineTo(-s * 0.52, -s * 0.03); ctx.closePath(); ctx.fill(); ctx.restore();
    paint(ctx, rectFn(-s * 0.13, -s * 0.94, s * 0.26, s * 0.22), "#b0563f", lw, "#6e3325");
    paint(ctx, polyFn([[-s * 0.09, 0], [-s * 0.06, -s * 0.72], [s * 0.06, -s * 0.72], [s * 0.09, 0]]), "#e0d3ad", lw * 0.6, "#8a6f3a");
    ctx.save(); ctx.strokeStyle = "#8a6f3a"; ctx.lineWidth = Math.max(0.6, lw * 0.5);
    for (let i = 1; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.07, -s * 0.12 * i); ctx.lineTo(s * 0.07, -s * 0.12 * i); ctx.stroke(); }
    ctx.restore();
  },
  g_portal_arch: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.55);
    ctx.save(); ctx.globalAlpha = 0.15; ctx.fillStyle = "#9b8fd0"; ctx.beginPath(); ctx.ellipse(0, -s * 0.6, s * 0.62, s * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.42; ctx.fillStyle = "#8fb7cf"; ctx.beginPath(); ctx.moveTo(-s * 0.33, 0); ctx.lineTo(-s * 0.33, -s * 0.55); ctx.arc(0, -s * 0.55, s * 0.33, Math.PI, 0); ctx.lineTo(s * 0.33, 0); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = "#e6f2f7"; ctx.lineWidth = Math.max(1, lw); ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.78); ctx.quadraticCurveTo(s * 0.12, -s * 0.5, -s * 0.04, -s * 0.12); ctx.stroke(); ctx.restore();
    for (const sx of [-1, 1]) paint(ctx, rectFn(sx * s * 0.415 - s * 0.085, -s * 0.55, s * 0.17, s * 0.55), "#9a9488", lw, "#5f5a4d");
    paint(ctx, (c) => { c.beginPath(); c.arc(0, -s * 0.55, s * 0.5, Math.PI, 0); c.lineTo(s * 0.33, -s * 0.55); c.arc(0, -s * 0.55, s * 0.33, 0, Math.PI, true); c.closePath(); }, "#9a9488", lw, "#5f5a4d");
    ctx.save(); ctx.strokeStyle = "#4a4636"; ctx.lineWidth = Math.max(0.6, lw * 0.5);
    for (const a of [-2.5, -2.05, -1.57, -1.09, -0.64]) {
      const px = Math.cos(a), py = Math.sin(a);
      ctx.beginPath(); ctx.moveTo(px * s * 0.38, -s * 0.55 + py * s * 0.38); ctx.lineTo(px * s * 0.45, -s * 0.55 + py * s * 0.45); ctx.stroke();
    }
    ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = lighten("#9a9488", 0.35); ctx.beginPath(); ctx.ellipse(-s * 0.18, -s * 0.96, s * 0.12, s * 0.05, -0.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
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
  ...BATCH4_RECIPES,
  ...BATCH5_RECIPES,
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

// ---------------------------------------------------------------------------
// Ink glyph → gouache mapping (batch 5)
// ---------------------------------------------------------------------------

export { GLYPH_TO_GOUACHE } from "./assets-batch5";

/**
 * Gouache asset key for a builtin ink glyph key, or `undefined` when no
 * painted equivalent exists. Complete for every `BUILTIN_GLYPHS` entry
 * (asserted by tests) — renderers use this to paint legacy ink-glyph objects
 * and scatter/attachment glyphs without touching stored data.
 */
export function gouacheKeyForGlyph(glyphKey: string | null | undefined): string | undefined {
  if (!glyphKey) return undefined;
  const mapped = GLYPH_TO_GOUACHE[glyphKey];
  return mapped && mapped in RECIPES ? mapped : undefined;
}
