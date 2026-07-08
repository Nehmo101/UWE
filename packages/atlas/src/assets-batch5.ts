/**
 * Atlas Gouache assets — batch 5: painted equivalents for every builtin ink
 * pictogram, so the editor/viewers can render ALL objects in the gouache look
 * and the ink glyph set can retire from the palette (it stays in the DB as the
 * stable `paletteItemId` FK carrier — AtlasObject.paletteItemId is Restrict).
 *
 * Also exports {@link GLYPH_TO_GOUACHE}: builtin ink glyph key → gouache asset
 * key. Renderers use it to paint legacy objects (placed before the gouache
 * era) and scatter/attachment glyph keys without touching stored data.
 *
 * Same contract as every gouache recipe: draw around origin (0,0) =
 * base-centre, grow upward (−y), muted earth palette, shadow + highlight +
 * pigment edge, deterministic variation only via the provided `rng`.
 */

import type { GouacheAsset } from "./assets";
import {
  type Recipe,
  blobFn,
  ellipseFn,
  iblob,
  lighten,
  paint,
  polyFn,
  rectFn,
  shadow,
} from "./assets-toolkit";

// ---------------------------------------------------------------------------
// Registry metadata
// ---------------------------------------------------------------------------

export const GOUACHE_ASSETS_BATCH5: readonly GouacheAsset[] = [
  { key: "g_mountain", name: "Berg", category: "landmark" },
  { key: "g_mountain_snow", name: "Schneeberg", category: "landmark" },
  { key: "g_hill", name: "Hügel", category: "landmark" },
  { key: "g_volcano", name: "Vulkan", category: "landmark" },
  { key: "g_mountain_range", name: "Gebirgskette", category: "landmark" },
  { key: "g_cliff", name: "Klippe", category: "landmark" },
  { key: "g_rock", name: "Fels", category: "prop" },
  { key: "g_cloud", name: "Wolke", category: "prop" },
  { key: "g_lake", name: "See", category: "landmark" },
  { key: "g_grass_tuft", name: "Grasbüschel", category: "flora" },
  { key: "g_swamp_tuft", name: "Sumpf", category: "flora" },
  { key: "g_dunes", name: "Dünen", category: "landmark" },
  { key: "g_beanstalk", name: "Bohnenranke", category: "flora" },
  { key: "g_giant_root", name: "Weltenwurzel", category: "flora" },
  { key: "g_city", name: "Stadt", category: "structure" },
  { key: "g_harbor", name: "Hafen", category: "structure" },
  { key: "g_temple", name: "Tempel", category: "structure" },
  { key: "g_wall", name: "Stadtmauer", category: "structure" },
  { key: "g_gate", name: "Stadttor", category: "structure" },
  { key: "g_root_knot", name: "Wurzelknoten", category: "prop" },
] as const;

/**
 * Builtin ink glyph key → gouache asset key. Complete for every entry in
 * `BUILTIN_GLYPHS` (asserted by tests) so renderers can always paint.
 */
export const GLYPH_TO_GOUACHE: Record<string, string> = {
  mountain: "g_mountain",
  mountain_snow: "g_mountain_snow",
  hill: "g_hill",
  volcano: "g_volcano",
  mountain_range: "g_mountain_range",
  cliff: "g_cliff",
  rock: "g_rock",
  cloud: "g_cloud",
  tree: "g_oak",
  water: "g_lake",
  pine: "g_pine",
  grass: "g_grass_tuft",
  swamp: "g_swamp_tuft",
  desert: "g_dunes",
  beanstalk: "g_beanstalk",
  giant_root: "g_giant_root",
  city: "g_city",
  village: "g_house",
  ruin: "g_ruin",
  castle: "g_keep",
  tower: "g_tower",
  bridge: "g_bridge",
  harbor: "g_harbor",
  temple: "g_temple",
  tent: "g_tent",
  stall: "g_stall",
  wall: "g_wall",
  gate: "g_gate",
  root_knot: "g_root_knot",
};

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

const STONE = "#9a8a68";
const STONE_DARK = "#6f6046";
const SNOW = "#eef1f2";

export const BATCH5_RECIPES: Record<string, Recipe> = {
  g_mountain: (ctx, s, _rng, lw) => {
    shadow(ctx, s * 0.06, s * 0.02, s * 0.62);
    paint(ctx, polyFn([[-s * 0.62, 0], [-s * 0.08, -s], [0, -s], [0, 0]]), STONE, lw, STONE_DARK);
    paint(ctx, polyFn([[0, 0], [0, -s], [s * 0.08, -s * 0.92], [s * 0.62, 0]]), "#7c6d4f", lw, STONE_DARK);
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = lighten(STONE, 0.3);
    ctx.beginPath(); ctx.moveTo(-s * 0.4, 0); ctx.lineTo(-s * 0.08, -s * 0.62); ctx.lineTo(-s * 0.16, 0); ctx.closePath(); ctx.fill(); ctx.restore();
  },
  g_mountain_snow: (ctx, s, rng, lw) => {
    BATCH5_RECIPES.g_mountain!(ctx, s, rng, lw);
    paint(ctx, polyFn([[-s * 0.22, -s * 0.66], [-s * 0.06, -s], [s * 0.05, -s * 0.94], [s * 0.2, -s * 0.62], [s * 0.05, -s * 0.7], [-s * 0.08, -s * 0.58]]), SNOW, lw * 0.8, "#b9c4cc");
  },
  g_hill: (ctx, s, rng, lw) => {
    shadow(ctx, s * 0.04, s * 0.02, s * 0.58);
    paint(ctx, blobFn(iblob(0, -s * 0.26, s * 0.58, s * 0.3, rng, 0.08, 10)), "#8aa65e", lw, "#59703a");
    ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = lighten("#8aa65e", 0.3);
    ctx.beginPath(); ctx.ellipse(-s * 0.18, -s * 0.34, s * 0.22, s * 0.12, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  },
  g_volcano: (ctx, s, _rng, lw) => {
    shadow(ctx, s * 0.05, s * 0.02, s * 0.6);
    paint(ctx, polyFn([[-s * 0.58, 0], [-s * 0.16, -s * 0.86], [s * 0.16, -s * 0.86], [s * 0.58, 0]]), "#6b5344", lw, "#43332a");
    paint(ctx, ellipseFn(0, -s * 0.86, s * 0.16, s * 0.06), "#b3492f", lw * 0.8, "#7c2c1c");
    ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = "#c7c0b2";
    for (const [dx, dy, r] of [[0.02, 1.12, 0.1], [0.12, 1.28, 0.13], [0.0, 1.42, 0.16]] as const) {
      ctx.beginPath(); ctx.arc(dx * s, -dy * s, r * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  },
  g_mountain_range: (ctx, s, _rng, lw) => {
    shadow(ctx, s * 0.05, s * 0.02, s * 0.75);
    paint(ctx, polyFn([[-s * 0.9, 0], [-s * 0.55, -s * 0.62], [-s * 0.2, 0]]), "#8a7a5c", lw, STONE_DARK);
    paint(ctx, polyFn([[s * 0.1, 0], [s * 0.5, -s * 0.7], [s * 0.9, 0]]), "#8a7a5c", lw, STONE_DARK);
    paint(ctx, polyFn([[-s * 0.45, 0], [0, -s], [s * 0.45, 0]]), STONE, lw, STONE_DARK);
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = lighten(STONE, 0.3);
    ctx.beginPath(); ctx.moveTo(-s * 0.3, 0); ctx.lineTo(0, -s * 0.66); ctx.lineTo(-s * 0.1, 0); ctx.closePath(); ctx.fill(); ctx.restore();
  },
  g_cliff: (ctx, s, _rng, lw) => {
    shadow(ctx, s * 0.08, s * 0.02, s * 0.55);
    paint(ctx, polyFn([[-s * 0.5, 0], [-s * 0.44, -s * 0.72], [s * 0.3, -s * 0.72], [s * 0.42, -s * 0.5], [s * 0.34, 0]]), STONE, lw, STONE_DARK);
    paint(ctx, polyFn([[-s * 0.44, -s * 0.72], [-s * 0.3, -s * 0.84], [s * 0.44, -s * 0.84], [s * 0.3, -s * 0.72]]), "#8aa65e", lw * 0.8, "#59703a");
    ctx.save(); ctx.strokeStyle = STONE_DARK; ctx.globalAlpha = 0.5; ctx.lineWidth = Math.max(0.5, lw * 0.7);
    for (const dx of [-0.22, 0, 0.2]) { ctx.beginPath(); ctx.moveTo(dx * s, -s * 0.66); ctx.lineTo(dx * s + s * 0.05, -s * 0.14); ctx.stroke(); }
    ctx.restore();
  },
  g_rock: (ctx, s, rng, lw) => {
    shadow(ctx, s * 0.03, s * 0.02, s * 0.42);
    paint(ctx, blobFn(iblob(0, -s * 0.26, s * 0.4, s * 0.28, rng, 0.14, 9)), "#98907e", lw, "#5f584a");
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = lighten("#98907e", 0.3);
    ctx.beginPath(); ctx.ellipse(-s * 0.12, -s * 0.34, s * 0.14, s * 0.09, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  },
  g_cloud: (ctx, s, _rng, lw) => {
    // Floats — no ground shadow; soft grey belly instead.
    paint(ctx, (c) => {
      c.beginPath();
      c.moveTo(-s * 0.52, -s * 0.34);
      c.quadraticCurveTo(-s * 0.66, -s * 0.34, -s * 0.6, -s * 0.5);
      c.quadraticCurveTo(-s * 0.56, -s * 0.68, -s * 0.34, -s * 0.62);
      c.quadraticCurveTo(-s * 0.26, -s * 0.84, -s * 0.02, -s * 0.8);
      c.quadraticCurveTo(s * 0.22, -s * 0.8, s * 0.26, -s * 0.62);
      c.quadraticCurveTo(s * 0.52, -s * 0.66, s * 0.56, -s * 0.46);
      c.quadraticCurveTo(s * 0.58, -s * 0.34, s * 0.42, -s * 0.34);
      c.closePath();
    }, "#f2f0e6", lw * 0.9, "#a9b0b6");
    ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = "#c3c9cd";
    ctx.beginPath(); ctx.ellipse(-s * 0.05, -s * 0.38, s * 0.4, s * 0.07, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  },
  g_lake: (ctx, s, _rng, lw) => {
    paint(ctx, ellipseFn(0, -s * 0.22, s * 0.58, s * 0.3), "#7fa8bc", lw, "#4f7488");
    ctx.save(); ctx.globalAlpha = 0.6; ctx.strokeStyle = lighten("#7fa8bc", 0.4); ctx.lineWidth = Math.max(0.6, lw * 0.8); ctx.lineCap = "round";
    for (const [dx, dy, w] of [[-0.2, 0.24, 0.22], [0.08, 0.16, 0.26], [-0.05, 0.32, 0.18]] as const) {
      ctx.beginPath(); ctx.moveTo((dx - w / 2) * s, -dy * s); ctx.quadraticCurveTo(dx * s, -(dy + 0.04) * s, (dx + w / 2) * s, -dy * s); ctx.stroke();
    }
    ctx.restore();
  },
  g_grass_tuft: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.01, s * 0.3);
    ctx.save(); ctx.lineCap = "round";
    for (const [dx, tip, lean] of [[-0.18, 0.62, -0.1], [-0.06, 0.82, -0.02], [0.06, 0.74, 0.05], [0.18, 0.56, 0.12], [0, 0.5, -0.16]] as const) {
      paint(ctx, (c) => {
        c.beginPath();
        c.moveTo(dx * s - s * 0.035, 0);
        c.quadraticCurveTo((dx + lean) * s - s * 0.02, -tip * s * 0.6, (dx + lean) * s, -tip * s);
        c.quadraticCurveTo((dx + lean) * s + s * 0.02, -tip * s * 0.6, dx * s + s * 0.035, 0);
        c.closePath();
      }, "#7a9a4a", lw * 0.6, "#4d6630");
    }
    ctx.restore();
  },
  g_swamp_tuft: (ctx, s, rng, lw) => {
    paint(ctx, ellipseFn(0, -s * 0.1, s * 0.44, s * 0.14), "#77906e", lw * 0.8, "#4c6247");
    for (const dx of [-0.2, -0.02, 0.18]) {
      paint(ctx, (c) => {
        c.beginPath();
        c.moveTo(dx * s - s * 0.02, -s * 0.08);
        c.lineTo(dx * s, -s * (0.5 + rng() * 0.2));
        c.lineTo(dx * s + s * 0.02, -s * 0.08);
        c.closePath();
      }, "#5e7850", lw * 0.6, "#3c5136");
      ctx.save(); ctx.fillStyle = "#6b5a3a"; ctx.beginPath();
      ctx.ellipse(dx * s, -s * 0.52, s * 0.035, s * 0.09, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  },
  g_dunes: (ctx, s, _rng, lw) => {
    paint(ctx, (c) => {
      c.beginPath(); c.moveTo(-s * 0.62, 0);
      c.quadraticCurveTo(-s * 0.3, -s * 0.5, 0, -s * 0.18);
      c.lineTo(0, 0); c.closePath();
    }, "#d9bd7f", lw, "#a58a50");
    paint(ctx, (c) => {
      c.beginPath(); c.moveTo(-s * 0.08, 0);
      c.quadraticCurveTo(s * 0.26, -s * 0.42, s * 0.62, 0);
      c.closePath();
    }, "#cbae6f", lw, "#a58a50");
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = lighten("#d9bd7f", 0.3);
    ctx.beginPath(); ctx.moveTo(-s * 0.5, 0); ctx.quadraticCurveTo(-s * 0.3, -s * 0.36, -s * 0.06, -s * 0.16); ctx.lineTo(-s * 0.2, 0); ctx.closePath(); ctx.fill(); ctx.restore();
  },
  g_beanstalk: (ctx, s, _rng, lw) => {
    shadow(ctx, s * 0.08, s * 0.02, s * 0.34);
    paint(ctx, (c) => {
      c.beginPath();
      c.moveTo(-s * 0.1, 0);
      c.bezierCurveTo(-s * 0.34, -s * 0.3, s * 0.26, -s * 0.5, -s * 0.02, -s * 0.74);
      c.quadraticCurveTo(-s * 0.14, -s * 0.86, -s * 0.02, -s * 0.98);
      c.quadraticCurveTo(s * 0.06, -s * 0.86, s * 0.02, -s * 0.72);
      c.bezierCurveTo(s * 0.3, -s * 0.5, -s * 0.22, -s * 0.32, s * 0.06, 0);
      c.closePath();
    }, "#5f9a4a", lw, "#33531f");
    for (const [dx, dy, r, a] of [[-0.24, 0.36, 0.14, -0.5], [0.22, 0.55, 0.12, 0.6], [-0.12, 0.8, 0.1, -0.4]] as const) {
      paint(ctx, ellipseFn(dx * s, -dy * s, r * s, r * s * 0.55), "#74ad55", lw * 0.6, "#33531f");
      void a;
    }
  },
  g_giant_root: (ctx, s, _rng, lw) => {
    shadow(ctx, s * 0.02, s * 0.02, s * 0.52);
    paint(ctx, (c) => {
      c.beginPath();
      c.moveTo(-s * 0.08, -s * 0.95);
      c.lineTo(s * 0.08, -s * 0.95);
      c.quadraticCurveTo(s * 0.1, -s * 0.5, s * 0.34, -s * 0.14);
      c.quadraticCurveTo(s * 0.44, 0, s * 0.28, 0);
      c.quadraticCurveTo(s * 0.14, -s * 0.06, s * 0.05, -s * 0.22);
      c.quadraticCurveTo(s * 0.02, -s * 0.04, -s * 0.06, 0);
      c.quadraticCurveTo(-s * 0.2, 0, -s * 0.16, -s * 0.16);
      c.quadraticCurveTo(-s * 0.3, -s * 0.04, -s * 0.42, 0);
      c.quadraticCurveTo(-s * 0.56, 0, -s * 0.44, -s * 0.18);
      c.quadraticCurveTo(-s * 0.18, -s * 0.5, -s * 0.08, -s * 0.95);
      c.closePath();
    }, "#8a6a42", lw, "#54401f");
    ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = lighten("#8a6a42", 0.3);
    ctx.fillRect(-s * 0.06, -s * 0.9, s * 0.05, s * 0.6); ctx.restore();
  },
  g_city: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.66);
    paint(ctx, rectFn(-s * 0.6, -s * 0.4, s * 1.2, s * 0.4), "#c9b98f", lw, "#6f5c3c");
    for (const dx of [-0.6, 0.6]) {
      paint(ctx, rectFn(dx * s - s * 0.1, -s * 0.62, s * 0.2, s * 0.62), "#bcac80", lw, "#6f5c3c");
      paint(ctx, polyFn([[dx * s - s * 0.14, -s * 0.62], [dx * s, -s * 0.8], [dx * s + s * 0.14, -s * 0.62]]), "#8a3526", lw * 0.8);
    }
    paint(ctx, rectFn(-s * 0.2, -s * 0.66, s * 0.4, s * 0.3), "#d2c49a", lw * 0.8, "#6f5c3c");
    paint(ctx, polyFn([[-s * 0.26, -s * 0.66], [0, -s * 0.92], [s * 0.26, -s * 0.66]]), "#a8432e", lw * 0.8);
    ctx.save(); ctx.fillStyle = "#5a4630";
    ctx.fillRect(-s * 0.05, -s * 0.24, s * 0.1, s * 0.24); ctx.restore();
  },
  g_harbor: (ctx, s, _rng, lw) => {
    paint(ctx, ellipseFn(0, -s * 0.14, s * 0.5, s * 0.18), "#7fa8bc", lw * 0.8, "#4f7488");
    paint(ctx, rectFn(-s * 0.5, -s * 0.34, s * 0.34, s * 0.2), "#9c7a4e", lw, "#5a3f22");
    ctx.save(); ctx.strokeStyle = "#3a3026"; ctx.lineWidth = Math.max(1, lw); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(s * 0.14, -s * 0.9); ctx.lineTo(s * 0.14, -s * 0.28); ctx.stroke();
    ctx.beginPath(); ctx.arc(s * 0.14, -s * 0.32, s * 0.18, 0.25, Math.PI - 0.25); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.02, -s * 0.74); ctx.lineTo(s * 0.26, -s * 0.74); ctx.stroke();
    ctx.beginPath(); ctx.arc(s * 0.14, -s * 0.94, s * 0.05, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  },
  g_temple: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.58);
    paint(ctx, rectFn(-s * 0.5, -s * 0.12, s, s * 0.12), "#cfc3a0", lw, "#6f5c3c");
    for (const dx of [-0.36, -0.12, 0.12, 0.36]) {
      paint(ctx, rectFn(dx * s - s * 0.05, -s * 0.6, s * 0.1, s * 0.48), "#ddd2b2", lw * 0.7, "#6f5c3c");
    }
    paint(ctx, rectFn(-s * 0.5, -s * 0.7, s, s * 0.1), "#cfc3a0", lw, "#6f5c3c");
    paint(ctx, polyFn([[-s * 0.56, -s * 0.7], [0, -s * 0.95], [s * 0.56, -s * 0.7]]), "#c2b28a", lw, "#6f5c3c");
  },
  g_wall: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.02, s * 0.6);
    paint(ctx, rectFn(-s * 0.6, -s * 0.42, s * 1.2, s * 0.42), "#b3a687", lw, "#665a42");
    for (let i = 0; i < 4; i++) {
      paint(ctx, rectFn(-s * 0.6 + i * s * 0.34, -s * 0.56, s * 0.16, s * 0.15), "#b3a687", lw * 0.7, "#665a42");
    }
    ctx.save(); ctx.strokeStyle = "#665a42"; ctx.globalAlpha = 0.4; ctx.lineWidth = Math.max(0.5, lw * 0.6);
    ctx.beginPath(); ctx.moveTo(-s * 0.6, -s * 0.2); ctx.lineTo(s * 0.6, -s * 0.2); ctx.stroke(); ctx.restore();
  },
  g_gate: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.56);
    for (const dx of [-1, 1]) {
      paint(ctx, rectFn(dx * s * 0.42 - s * 0.13, -s * 0.78, s * 0.26, s * 0.78), "#bcac80", lw, "#6f5c3c");
      paint(ctx, polyFn([[dx * s * 0.42 - s * 0.18, -s * 0.78], [dx * s * 0.42, -s * 0.98], [dx * s * 0.42 + s * 0.18, -s * 0.78]]), "#8a3526", lw * 0.8);
    }
    paint(ctx, rectFn(-s * 0.3, -s * 0.62, s * 0.6, s * 0.16), "#b3a687", lw * 0.8, "#665a42");
    paint(ctx, (c) => {
      c.beginPath();
      c.moveTo(-s * 0.2, 0); c.lineTo(-s * 0.2, -s * 0.3);
      c.quadraticCurveTo(0, -s * 0.52, s * 0.2, -s * 0.3);
      c.lineTo(s * 0.2, 0); c.closePath();
    }, "#4a3a26", lw * 0.8, "#2c2113");
  },
  g_root_knot: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.02, s * 0.42);
    paint(ctx, (c) => {
      c.beginPath();
      c.moveTo(-s * 0.3, 0);
      c.quadraticCurveTo(-s * 0.4, -s * 0.1, -s * 0.26, -s * 0.2);
      c.quadraticCurveTo(-s * 0.34, -s * 0.52, -s * 0.08, -s * 0.6);
      c.quadraticCurveTo(s * 0.2, -s * 0.66, s * 0.28, -s * 0.4);
      c.quadraticCurveTo(s * 0.44, -s * 0.16, s * 0.28, 0);
      c.closePath();
    }, "#8a6a42", lw, "#54401f");
    ctx.save(); ctx.strokeStyle = "#54401f"; ctx.globalAlpha = 0.5; ctx.lineWidth = Math.max(0.5, lw * 0.7); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-s * 0.14, -s * 0.42); ctx.quadraticCurveTo(0, -s * 0.3, s * 0.12, -s * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.08, -s * 0.2); ctx.quadraticCurveTo(s * 0.06, -s * 0.12, s * 0.16, -s * 0.2); ctx.stroke();
    ctx.restore();
  },
};
