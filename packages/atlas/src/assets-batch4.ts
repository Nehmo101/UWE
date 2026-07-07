/**
 * Atlas Gouache assets — batch 4 (catalog expansion).
 *
 * Recipe data in the established `assets.ts` format, split into its own
 * module to keep both files inside the file-size budget. `assets.ts` merges
 * {@link GOUACHE_ASSETS_BATCH4} / {@link BATCH4_RECIPES} into the canonical
 * registry; existing assets keep their order and behavior.
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

/**
 * Batch-4 registry metadata, appended to `GOUACHE_ASSETS` after the existing
 * entries (palette grouping happens per category, so append order is safe).
 *
 * Note: `g_giant_mushroom` is deliberately distinct from `g_mushroom` (small
 * red toadstool) — a towering, bent-stalk violet cap. `g_smithy` replaces the
 * planned `g_watch_beacon`, which would have duplicated `g_signal_tower`
 * (already a wooden tower with a burning fire basket).
 */
export const GOUACHE_ASSETS_BATCH4: readonly GouacheAsset[] = [
  { key: "g_giant_mushroom", name: "Titanenpilz", category: "flora" },
  { key: "g_smithy", name: "Schmiede", category: "structure" },
  { key: "g_wizard_tower", name: "Zauberturm", category: "landmark" },
  { key: "g_dragon_perch", name: "Drachenhorst", category: "landmark" },
  { key: "g_waterfall", name: "Wasserfall", category: "landmark" },
  { key: "g_shipwreck", name: "Schiffswrack", category: "vehicle" },
  { key: "g_hot_spring", name: "Heiße Quelle", category: "prop" },
  { key: "g_shrine", name: "Wegschrein", category: "prop" },
] as const;

export const BATCH4_RECIPES: Record<string, Recipe> = {
  g_giant_mushroom: (ctx, s, rng, lw) => {
    shadow(ctx, s * 0.05, s * 0.03, s * 0.62);
    // towering, slightly bent stalk
    paint(ctx, (c) => {
      c.beginPath();
      c.moveTo(-s * 0.17, 0);
      c.quadraticCurveTo(-s * 0.22, -s * 0.55, -s * 0.04, -s * 0.94);
      c.lineTo(s * 0.14, -s * 0.94);
      c.quadraticCurveTo(s * 0.05, -s * 0.5, s * 0.19, 0);
      c.closePath();
    }, "#d8cdb0", lw, "#8a7d5c");
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = lighten("#d8cdb0", 0.32); ctx.beginPath(); ctx.ellipse(-s * 0.06, -s * 0.5, s * 0.05, s * 0.36, 0.1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // pale gill plate under the cap
    paint(ctx, ellipseFn(s * 0.04, -s * 0.92, s * 0.46, s * 0.13), "#c4b699", lw * 0.6, "#8a7d5c");
    ctx.save(); ctx.strokeStyle = "#8a7d5c"; ctx.lineWidth = Math.max(0.5, lw * 0.4); ctx.globalAlpha = 0.7;
    for (const dx of [-0.32, -0.14, 0.22, 0.4]) { ctx.beginPath(); ctx.moveTo(s * 0.04, -s * 0.92); ctx.lineTo(s * (0.04 + dx), -s * 0.92 + Math.abs(dx) * s * 0.24); ctx.stroke(); }
    ctx.restore();
    // huge drooping violet cap (deterministic blob)
    paint(ctx, blobFn(iblob(s * 0.04, -s * 1.04, s * 0.6, s * 0.28, rng, 0.12, 14)), "#7d6b8f", lw, "#4e4060");
    ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = lighten("#7d6b8f", 0.3); ctx.beginPath(); ctx.ellipse(-s * 0.16, -s * 1.15, s * 0.24, s * 0.1, -0.15, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.fillStyle = "#d9d2e2";
    for (const [dx, dy, r] of [[-0.28, -1.07, 0.05], [0.06, -1.17, 0.06], [0.34, -1.02, 0.04]] as const) { ctx.beginPath(); ctx.arc(dx * s, dy * s, r * s, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    // tiny mushroom at the base for scale
    paint(ctx, rectFn(s * 0.3, -s * 0.13, s * 0.05, s * 0.13), "#d8cdb0", lw * 0.5, "#8a7d5c");
    paint(ctx, blobFn(iblob(s * 0.325, -s * 0.15, s * 0.1, s * 0.05, () => 0.5, 0.06, 8)), "#7d6b8f", lw * 0.5, "#4e4060");
  },
  g_smithy: (ctx, s, rng, lw) => {
    const w = s * 0.95, h = s * 0.55;
    shadow(ctx, 0, s * 0.04, s * 0.62);
    paint(ctx, rectFn(-w / 2, -h, w, h), "#b09a72", lw, "#6f5c3c");
    // stone chimney (base hidden behind the roof), then roof
    paint(ctx, rectFn(-s * 0.3, -h * 1.9, s * 0.16, h * 0.95), "#9a9488", lw, "#5f5a4d");
    paint(ctx, polyFn([[-w * 0.62, -h + 1], [-w * 0.05, -h * 1.6], [w * 0.62, -h + 1]]), "#6e5a44", lw);
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = lighten("#b09a72", 0.3); ctx.fillRect(-w / 2 + s * 0.04, -h + s * 0.05, s * 0.16, s * 0.12); ctx.restore();
    // open forge front with ember glow
    paint(ctx, rectFn(s * 0.08, -h * 0.62, s * 0.3, h * 0.62), "#2f2a24", lw * 0.6, "#4a4030");
    ctx.save(); ctx.globalAlpha = 0.75; ctx.fillStyle = "#c96a2f"; ctx.beginPath(); ctx.ellipse(s * 0.23, -h * 0.26, s * 0.1, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f0c35c"; ctx.beginPath(); ctx.ellipse(s * 0.23, -h * 0.25, s * 0.05, s * 0.035, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // anvil silhouette beside the door
    paint(ctx, polyFn([[-s * 0.38, -s * 0.16], [-s * 0.18, -s * 0.16], [-s * 0.24, -s * 0.1], [-s * 0.22, -s * 0.02], [-s * 0.34, -s * 0.02], [-s * 0.32, -s * 0.1]]), "#4a4636", lw * 0.6, "#2f2a24");
    // smoke puffs drifting off the chimney (deterministic)
    ctx.save(); ctx.fillStyle = "#8f8a84"; ctx.globalAlpha = 0.45;
    for (let i = 0; i < 3; i++) {
      const t = i / 2;
      const x = -s * 0.22 + t * s * 0.18 + (rng() - 0.5) * s * 0.06;
      const y = -h * 1.98 - t * s * 0.28;
      const r = s * (0.06 + t * 0.05);
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  },
  g_wizard_tower: (ctx, s, rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.48);
    // tapered violet-grey shaft with masonry bands
    paint(ctx, polyFn([[-s * 0.3, 0], [-s * 0.2, -s * 1.05], [s * 0.2, -s * 1.05], [s * 0.3, 0]]), "#8f8a9c", lw, "#565064");
    ctx.save(); ctx.strokeStyle = "#565064"; ctx.lineWidth = Math.max(0.6, lw * 0.5);
    for (let i = 1; i <= 3; i++) { const hw = s * (0.3 - 0.024 * i * 4); ctx.beginPath(); ctx.moveTo(-hw, -s * i * 0.25); ctx.lineTo(hw, -s * i * 0.25); ctx.stroke(); }
    ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = lighten("#8f8a9c", 0.3); ctx.fillRect(-s * 0.16, -s, s * 0.07, s * 0.92); ctx.restore();
    // arched door
    paint(ctx, (c) => { c.beginPath(); c.moveTo(-s * 0.09, 0); c.lineTo(-s * 0.09, -s * 0.16); c.quadraticCurveTo(0, -s * 0.3, s * 0.09, -s * 0.16); c.lineTo(s * 0.09, 0); c.closePath(); }, "#3a3226", lw * 0.6, "#57492f");
    // observatory platform + glowing light dome
    paint(ctx, rectFn(-s * 0.3, -s * 1.12, s * 0.6, s * 0.09), "#6f665a", lw * 0.6);
    ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = "#f0c35c"; ctx.beginPath(); ctx.ellipse(0, -s * 1.28, s * 0.42, s * 0.28, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    paint(ctx, (c) => { c.beginPath(); c.arc(0, -s * 1.12, s * 0.24, Math.PI, 0); c.closePath(); }, "#f0c35c", lw, "#9a4a22");
    ctx.save(); ctx.strokeStyle = "#9a4a22"; ctx.lineWidth = Math.max(0.5, lw * 0.45); ctx.beginPath(); ctx.moveTo(0, -s * 1.36); ctx.lineTo(0, -s * 1.12); ctx.stroke(); ctx.restore();
    // deterministic star sparks around the dome
    ctx.save(); ctx.fillStyle = "#e6f2f7"; ctx.globalAlpha = 0.85;
    for (const dx of [-0.4, 0.36, 0.12]) {
      const x = dx * s + (rng() - 0.5) * s * 0.08;
      const y = -s * (1.34 + rng() * 0.2);
      ctx.beginPath(); ctx.arc(x, y, s * 0.025, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  },
  g_dragon_perch: (ctx, s, rng, lw) => {
    shadow(ctx, 0, s * 0.04, s * 0.6);
    // craggy rock spire with shaded flank
    paint(ctx, polyFn([[-s * 0.5, 0], [-s * 0.34, -s * 0.42], [-s * 0.4, -s * 0.62], [-s * 0.22, -s * 0.9], [s * 0.24, -s * 0.9], [s * 0.36, -s * 0.55], [s * 0.3, -s * 0.36], [s * 0.5, 0]]), "#8f8774", lw, "#5f5846");
    paint(ctx, polyFn([[s * 0.05, 0], [s * 0.24, -s * 0.9], [s * 0.36, -s * 0.55], [s * 0.3, -s * 0.36], [s * 0.5, 0]]), "#766e5c", lw * 0.5, "#5f5846");
    ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = lighten("#8f8774", 0.3); ctx.beginPath(); ctx.ellipse(-s * 0.18, -s * 0.55, s * 0.09, s * 0.22, 0.2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // twig nest ring on top (deterministic scatter)
    paint(ctx, ellipseFn(0, -s * 0.92, s * 0.34, s * 0.13), "#7a5230", lw, "#4a3320");
    ctx.save(); ctx.strokeStyle = "#4a3320"; ctx.lineWidth = Math.max(0.6, lw * 0.55);
    for (let i = 0; i < 7; i++) {
      const a = rng() * Math.PI * 2;
      const x = Math.cos(a) * s * 0.3, y = -s * 0.92 + Math.sin(a) * s * 0.1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rng() - 0.5) * s * 0.2, y - rng() * s * 0.08); ctx.stroke();
    }
    ctx.restore();
    // hollow with a speckled egg
    paint(ctx, ellipseFn(0, -s * 0.94, s * 0.2, s * 0.07), "#57492f", lw * 0.5, "#3a3226");
    paint(ctx, ellipseFn(s * 0.02, -s * 1.0, s * 0.09, s * 0.12), "#e0d6b4", lw * 0.6, "#8a6f3a");
    ctx.save(); ctx.fillStyle = "#b0a179";
    for (const [dx, dy] of [[-0.01, -1.04], [0.05, -0.98]] as const) { ctx.beginPath(); ctx.arc(dx * s, dy * s, s * 0.016, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  },
  g_waterfall: (ctx, s, rng, lw) => {
    shadow(ctx, 0, s * 0.02, s * 0.55);
    // plunge pool
    paint(ctx, blobFn(iblob(0, -s * 0.04, s * 0.52, s * 0.15, rng, 0.14, 10)), "#7290a2", lw * 0.6, "#46606e");
    // cliff flanks
    paint(ctx, polyFn([[-s * 0.62, 0], [-s * 0.56, -s * 0.85], [-s * 0.2, -s * 0.9], [-s * 0.24, -s * 0.14]]), "#8f8774", lw, "#5f5846");
    paint(ctx, polyFn([[s * 0.62, 0], [s * 0.56, -s * 0.85], [s * 0.2, -s * 0.9], [s * 0.24, -s * 0.14]]), "#8f8774", lw, "#5f5846");
    ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = lighten("#8f8774", 0.3); ctx.fillRect(-s * 0.52, -s * 0.8, s * 0.08, s * 0.6); ctx.restore();
    // river lip and falling sheet
    paint(ctx, rectFn(-s * 0.2, -s * 0.94, s * 0.4, s * 0.08), "#7290a2", lw * 0.5, "#46606e");
    paint(ctx, polyFn([[-s * 0.2, -s * 0.88], [s * 0.2, -s * 0.88], [s * 0.24, -s * 0.08], [-s * 0.24, -s * 0.08]]), "#9fc0cf", lw * 0.6, "#5b7f91");
    // deterministic streaks in the sheet
    ctx.save(); ctx.strokeStyle = "#e6f2f7"; ctx.globalAlpha = 0.7; ctx.lineWidth = Math.max(0.7, lw * 0.6);
    for (let i = 0; i < 4; i++) {
      const x = -s * 0.14 + i * s * 0.09 + (rng() - 0.5) * s * 0.04;
      ctx.beginPath(); ctx.moveTo(x, -s * 0.85); ctx.lineTo(x + s * 0.02, -s * 0.14); ctx.stroke();
    }
    ctx.restore();
    // spray mist at the base
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = "#e6f2f7";
    for (const [dx, dy, r] of [[-0.2, -0.1, 0.12], [0.18, -0.08, 0.14], [0, -0.16, 0.1]] as const) { ctx.beginPath(); ctx.ellipse(dx * s, dy * s, r * s, r * s * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  },
  g_shipwreck: (ctx, s, rng, lw) => {
    // half sunken — water pool instead of a ground shadow
    paint(ctx, blobFn(iblob(0, -s * 0.02, s * 0.6, s * 0.14, rng, 0.14, 10)), "#7290a2", lw * 0.55, "#46606e");
    // broken mast with a torn sail scrap (behind the hull)
    ctx.save(); ctx.strokeStyle = "#4a3320"; ctx.lineWidth = Math.max(1, lw); ctx.beginPath(); ctx.moveTo(-s * 0.18, -s * 0.4); ctx.lineTo(s * 0.02, -s * 0.92); ctx.stroke(); ctx.restore();
    paint(ctx, polyFn([[s * 0.0, -s * 0.88], [s * 0.26, -s * 0.62], [s * 0.06, -s * 0.56], [s * 0.12, -s * 0.72]]), "#e8ddc0", lw * 0.6, "#9a8c66");
    // tilted hull, bow rearing out of the water
    paint(ctx, (c) => {
      c.beginPath();
      c.moveTo(-s * 0.52, -s * 0.02);
      c.quadraticCurveTo(-s * 0.52, -s * 0.34, -s * 0.36, -s * 0.52);
      c.lineTo(-s * 0.24, -s * 0.36);
      c.lineTo(-s * 0.04, -s * 0.42);
      c.lineTo(s * 0.4, -s * 0.1);
      c.lineTo(s * 0.34, s * 0.03);
      c.closePath();
    }, "#6a4a2a", lw, "#3a2a18");
    ctx.save(); ctx.strokeStyle = "#3a2a18"; ctx.globalAlpha = 0.8; ctx.lineWidth = Math.max(0.5, lw * 0.45);
    ctx.beginPath(); ctx.moveTo(-s * 0.46, -s * 0.16); ctx.lineTo(s * 0.3, -s * 0.02); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.44, -s * 0.3); ctx.lineTo(s * 0.08, -s * 0.14); ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = lighten("#6a4a2a", 0.3); ctx.beginPath(); ctx.ellipse(-s * 0.36, -s * 0.36, s * 0.05, s * 0.1, -0.6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // exposed ribs of the sunken stern
    ctx.save(); ctx.strokeStyle = "#4a3320"; ctx.lineWidth = Math.max(0.8, lw * 0.7);
    for (const [x0, y1] of [[0.48, 0.26], [0.58, 0.2], [0.66, 0.13]] as const) {
      ctx.beginPath(); ctx.moveTo(x0 * s, -s * 0.01); ctx.quadraticCurveTo(x0 * s - s * 0.05, -y1 * s, x0 * s - s * 0.11, -y1 * s + s * 0.04); ctx.stroke();
    }
    ctx.restore();
  },
  g_hot_spring: (ctx, s, rng, lw) => {
    shadow(ctx, 0, s * 0.02, s * 0.5);
    // mineral terrace rim around a turquoise pool
    paint(ctx, blobFn(iblob(0, -s * 0.12, s * 0.5, s * 0.2, rng, 0.12, 11)), "#c9b586", lw, "#8a7448");
    paint(ctx, ellipseFn(0, -s * 0.13, s * 0.34, s * 0.13), "#b6a680", lw * 0.5, "#8a7448");
    paint(ctx, ellipseFn(0, -s * 0.14, s * 0.26, s * 0.1), "#6fa8a0", lw * 0.6, "#3f6b64");
    ctx.save(); ctx.globalAlpha = 0.65; ctx.fillStyle = lighten("#6fa8a0", 0.35); ctx.beginPath(); ctx.ellipse(-s * 0.08, -s * 0.16, s * 0.1, s * 0.035, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.strokeStyle = "#e6f2f7"; ctx.globalAlpha = 0.8; ctx.lineWidth = Math.max(0.5, lw * 0.4);
    for (const dx of [-0.1, 0.08]) { ctx.beginPath(); ctx.arc(dx * s, -s * 0.13, s * 0.02, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    // rising steam wisps (deterministic)
    ctx.save(); ctx.strokeStyle = "#e6f2f7"; ctx.globalAlpha = 0.55; ctx.lineWidth = Math.max(1, lw * 0.9); ctx.lineCap = "round";
    for (const dx of [-0.14, 0.02, 0.16]) {
      const x = dx * s + (rng() - 0.5) * s * 0.05;
      const top = s * (0.55 + rng() * 0.2);
      ctx.beginPath(); ctx.moveTo(x, -s * 0.2); ctx.bezierCurveTo(x - s * 0.08, -s * 0.35, x + s * 0.08, -top + s * 0.15, x - s * 0.03, -top); ctx.stroke();
    }
    ctx.restore();
  },
  g_shrine: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.02, s * 0.34);
    // plinth + pillar body
    paint(ctx, rectFn(-s * 0.16, -s * 0.16, s * 0.32, s * 0.16), "#9a9488", lw * 0.8, "#5f5a4d");
    paint(ctx, rectFn(-s * 0.13, -s * 0.62, s * 0.26, s * 0.46), "#b7a880", lw, "#6f5c3c");
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = lighten("#b7a880", 0.32); ctx.fillRect(-s * 0.11, -s * 0.6, s * 0.04, s * 0.42); ctx.restore();
    // arched niche with a candle glow
    paint(ctx, (c) => { c.beginPath(); c.moveTo(-s * 0.07, -s * 0.22); c.lineTo(-s * 0.07, -s * 0.42); c.quadraticCurveTo(0, -s * 0.52, s * 0.07, -s * 0.42); c.lineTo(s * 0.07, -s * 0.22); c.closePath(); }, "#2f2a24", lw * 0.5, "#4a4030");
    ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = "#f0c35c"; ctx.beginPath(); ctx.ellipse(0, -s * 0.34, s * 0.09, s * 0.11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(0, -s * 0.31, s * 0.035, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // peaked slate roof slab
    paint(ctx, polyFn([[-s * 0.2, -s * 0.6], [0, -s * 0.82], [s * 0.2, -s * 0.6]]), "#5f6f78", lw);
  },
};
