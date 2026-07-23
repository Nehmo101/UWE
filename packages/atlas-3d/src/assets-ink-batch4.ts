/**
 * Tusche-Assets, Batch 4 — Natur & Siedlung (Charge 4, Teil 1 von 2).
 *
 * Gleicher Kontrakt wie assets-ink.ts / batch2 / batch3: reine Geometriedaten
 * (non-indexed Triangles, Tuschelagen-Farben, Idle-Animation über das
 * aAnim-Attribut), strikt deterministisch — identische Inputs bauen identische
 * Assets (Owner-Entscheid: keine Zufallszahlen). Alle Kinds bleiben unter
 * max-Y ≈ 2.3, damit die Weltwurzel weiterhin alles überragt.
 */

import { Builder, hex, INK, shades, type AnimFn, type InkAssetData, type InkTint, type Rgb, type Vec } from "./assets-ink";

const WOOD = hex("#7a5a3a");
const WOOD_DARK = hex("#5c452c");
const PAPER = hex("#f1e8d4");
const PAPER_DARK = hex("#d9cba1");
const TERRA_BAND = hex("#c2622b");

/** Vertikale Facetten-Scheibe in der XY-Ebene (Räder), beidseitig sichtbar. */
function disc(b: Builder, cx: number, cy: number, z: number, r: number, sides: number, color: Rgb, animFn: AnimFn): void {
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2;
    const a1 = ((i + 1) / sides) * Math.PI * 2;
    const p0: Vec = [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, z];
    const p1: Vec = [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, z];
    b.tri(p0, p1, [cx, cy, z], color, animFn);
    b.tri(p1, p0, [cx, cy, z], color, animFn);
  }
}

/** Eiche: knorriger dicker Stamm mit zwei Ast-Strängen und Riesenkrone. */
export function buildEiche(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const sway: AnimFn = (p) => {
    const w = Math.max(0, p[1] - 0.6) * 0.04;
    return [w, 0, w * 0.4, p[1] * 1.3];
  };
  b.column(0, 0, 0, 0.3, 0.18, 0.9, 7, WOOD_DARK, null);
  b.tube([[0.1, 0.7, 0], [0.5, 1.1, 0.15], [0.75, 1.3, 0.25]], [0.09, 0.05, 0.02], 5, WOOD_DARK, null);
  b.tube([[-0.08, 0.8, 0], [-0.45, 1.15, -0.1], [-0.7, 1.35, -0.2]], [0.09, 0.05, 0.02], 5, WOOD_DARK, null);
  b.blob(0, 1.35, 0, 0.95, 0.55, 0.45, 7, dark, sway);
  b.blob(0.55, 1.55, 0.2, 0.55, 0.4, 0.3, 6, base, sway);
  b.blob(-0.55, 1.6, -0.15, 0.5, 0.38, 0.28, 6, base, sway);
  b.blob(0, 1.95, 0, 0.45, 0.3, 0.2, 5, light, sway);
  return b.finish(0.03);
}

/** Trauerweide: Krone mit sechs hängenden, wippenden Zweig-Strängen. */
export function buildWeide(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.column(0, 0, 0, 0.18, 0.1, 1.1, 6, WOOD, null);
  const crownSway: AnimFn = (p) => [0.03, 0, 0.02, p[1] * 1.4];
  b.blob(0, 1.3, 0, 0.55, 0.35, 0.25, 6, base, crownSway);
  const hang: AnimFn = (p) => {
    const w = 0.03 + Math.max(0, 1.4 - p[1]) * 0.05;
    return [w, 0, w * 0.7, 1.2 + p[1]];
  };
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const ux = Math.cos(a);
    const uz = Math.sin(a);
    const pts: Vec[] = [
      [ux * 0.35, 1.45, uz * 0.35],
      [ux * 0.6, 1.1, uz * 0.6],
      [ux * 0.68, 0.55, uz * 0.68],
      [ux * 0.66, 0.15, uz * 0.66],
    ];
    b.tube(pts, [0.05, 0.045, 0.035, 0.01], 4, i % 2 === 0 ? dark : light, hang);
  }
  return b.finish(0.03);
}

/** Birkengruppe: drei schlanke helle Stämme mit Rindenmarken und Kronen. */
export function buildBirke(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const sway: AnimFn = (p) => {
    const w = Math.max(0, p[1] - 0.4) * 0.045;
    return [w, 0, w * 0.5, p[1] * 1.8];
  };
  const bark = hex("#faf5e8");
  const stem = (x: number, z: number, h: number, crown: Rgb) => {
    b.column(x, 0, z, 0.07, 0.04, h, 5, bark, null);
    b.box(x, h * 0.35, z + 0.055, 0.05, 0.03, 0.02, INK, null);
    b.box(x, h * 0.6, z + 0.045, 0.04, 0.025, 0.02, INK, null);
    b.blob(x, h + 0.18, z, 0.26, 0.28, 0.18, 5, crown, sway);
  };
  stem(0, 0, 1.5, base);
  stem(0.38, 0.16, 1.15, dark);
  stem(-0.34, -0.1, 1.3, light);
  return b.finish(0.025);
}

/** Windbaum: sturmgebeugter Stamm, die Krone komplett auf Lee-Seite geweht. */
export function buildWindbaum(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const gust: AnimFn = (p) => {
    const w = 0.02 + Math.max(0, p[1] - 0.3) * 0.06;
    return [w, 0, w * 0.3, 1.1 + p[1] * 0.8];
  };
  const pts: Vec[] = [];
  const radii: number[] = [];
  for (let k = 0; k <= 5; k++) {
    const t = k / 5;
    pts.push([t * t * 0.7, t * 1.15, 0]);
    radii.push(0.13 * (1 - t * 0.6) + 0.02);
  }
  b.tube(pts, radii, 6, WOOD_DARK, gust);
  b.blob(0.8, 1.25, 0, 0.45, 0.26, 0.2, 6, dark, gust);
  b.blob(1.05, 1.32, 0.06, 0.3, 0.18, 0.14, 5, base, gust);
  b.blob(1.24, 1.36, -0.04, 0.18, 0.12, 0.09, 5, light, gust);
  return b.finish(0.03);
}

/** Farngruppe: sieben bogig auslaufende Wedel um ein Zentrum. */
export function buildFarn(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const sway: AnimFn = (p) => [0.02 + p[1] * 0.05, 0.01, 0.02, 1.6 + p[1] * 2];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    const ux = Math.cos(a);
    const uz = Math.sin(a);
    const cloth = i % 3 === 0 ? dark : i % 3 === 1 ? base : light;
    const sx = -uz * 0.07;
    const sz = ux * 0.07;
    const mid: Vec = [ux * 0.3, 0.42, uz * 0.3];
    const tip: Vec = [ux * 0.62, 0.32, uz * 0.62];
    b.quad([sx, 0.05, sz], [mid[0] + sx, mid[1], mid[2] + sz], [mid[0] - sx, mid[1], mid[2] - sz], [-sx, 0.05, -sz], cloth, sway);
    b.quad([-sx, 0.05, -sz], [mid[0] - sx, mid[1], mid[2] - sz], [mid[0] + sx, mid[1], mid[2] + sz], [sx, 0.05, sz], cloth, sway);
    b.tri([mid[0] + sx, mid[1], mid[2] + sz], tip, [mid[0] - sx, mid[1], mid[2] - sz], cloth, sway);
    b.tri([mid[0] - sx, mid[1], mid[2] - sz], tip, [mid[0] + sx, mid[1], mid[2] + sz], cloth, sway);
  }
  return b.finish(0.02);
}

/** Schilf: Büschel dünner Halme mit Kolben, wippt deutlich im Wind. */
export function buildSchilf(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const sway: AnimFn = (p) => {
    const w = p[1] * 0.09;
    return [w, 0, w * 0.6, 2.2 + p[0] * 1.5];
  };
  const stalks: readonly (readonly [number, number, number])[] = [
    [0, 0, 0.95],
    [0.14, 0.08, 0.8],
    [-0.13, 0.05, 0.85],
    [0.05, -0.14, 0.7],
    [-0.06, 0.15, 0.75],
    [0.2, -0.05, 0.6],
    [-0.2, -0.08, 0.65],
  ];
  stalks.forEach(([x, z, h], i) => {
    b.column(x, 0, z, 0.025, 0.015, h, 4, i % 2 === 0 ? base : light, sway);
    b.box(x, h + 0.08, z, 0.045, 0.16, 0.045, dark, sway);
  });
  return b.finish(0.02);
}

/** Blütenbaum: Krone in Terra-Rosa-Tönen aus Paper-/Terra-Lagen, wippt sanft. */
export function buildBluetenbaum(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [, , light] = shades(tint);
  const sway: AnimFn = (p) => {
    const w = Math.max(0, p[1] - 0.5) * 0.05;
    return [w, 0, w * 0.5, p[1] * 1.6];
  };
  b.column(0, 0, 0, 0.14, 0.08, 0.85, 6, WOOD_DARK, null);
  b.tube([[0, 0.7, 0], [0.3, 1.0, 0.1]], [0.06, 0.02], 4, WOOD_DARK, null);
  b.blob(0, 1.15, 0, 0.65, 0.42, 0.3, 7, light, sway);
  b.blob(0.35, 1.4, 0.12, 0.4, 0.3, 0.2, 6, PAPER, sway);
  b.blob(-0.3, 1.35, -0.1, 0.34, 0.26, 0.18, 5, hex("#faf5e8"), sway);
  b.blob(0.05, 1.62, 0, 0.3, 0.24, 0.14, 5, PAPER_DARK, sway);
  return b.finish(0.03);
}

/** Felsnadel: hoher Hoodoo aus gestapelten, sich verjüngenden Segmenten. */
export function buildFelsnadel(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.blob(0, 0.15, 0, 0.55, 0.18, 0.12, 6, dark, null);
  b.column(0, 0, 0, 0.4, 0.26, 0.8, 6, base, null);
  b.column(0, 0.8, 0, 0.3, 0.18, 0.7, 5, dark, null);
  b.column(0.04, 1.5, 0, 0.2, 0.05, 0.55, 5, light, null);
  b.box(0.05, 2.1, 0.02, 0.18, 0.12, 0.16, base, null);
  return b.finish(0.025);
}

/** Bogenfels: zwei Felspfeiler, verbunden durch einen natürlichen Bogen. */
export function buildBogenfels(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.box(-0.72, 0.45, 0, 0.5, 0.9, 0.55, base, null);
  b.box(0.74, 0.4, 0.05, 0.46, 0.8, 0.5, dark, null);
  const pts: Vec[] = [];
  const radii: number[] = [];
  for (let k = 0; k <= 6; k++) {
    const t = k / 6;
    pts.push([-0.72 + t * 1.46, 0.8 + Math.sin(t * Math.PI) * 0.5, 0]);
    radii.push(0.2 - Math.sin(t * Math.PI) * 0.05);
  }
  b.tube(pts, radii, 5, light, null);
  b.box(0.15, 0.12, 0.3, 0.24, 0.24, 0.2, dark, null);
  return b.finish(0.025);
}

/** Geysir: Sinterkegel mit pulsierend aufsteigender Fontäne. */
export function buildGeysir(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.blob(0, 0.16, 0, 0.55, 0.2, 0.12, 6, PAPER_DARK, null);
  b.column(0, 0.1, 0, 0.3, 0.18, 0.2, 6, hex("#93744e"), null);
  const spout: AnimFn = (p) => [0.015, 0.05 + p[1] * 0.06, 0.015, 1.8];
  b.column(0, 0.3, 0, 0.1, 0.16, 1.1, 5, light, spout);
  b.blob(0, 1.5, 0, 0.28, 0.2, 0.1, 5, base, spout);
  b.blob(0.2, 1.3, 0.08, 0.12, 0.1, 0.06, 4, light, spout);
  b.blob(-0.18, 1.25, -0.06, 0.1, 0.09, 0.05, 4, light, spout);
  b.blob(0, 0.34, 0, 0.34, 0.05, 0.02, 6, dark, spout);
  return b.finish(0.025);
}

/** Kaktus: Säulenkaktus mit zwei Armen und Blüte, nahezu unbewegt. */
export function buildKaktus(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const micro: AnimFn = (p) => [0.004, 0, 0.003, p[1] * 1.4];
  b.column(0, 0, 0, 0.2, 0.14, 1.15, 6, base, micro);
  b.blob(0, 1.15, 0, 0.14, 0.12, 0.02, 5, dark, micro);
  b.tube([[0.16, 0.45, 0], [0.42, 0.5, 0], [0.46, 0.85, 0]], [0.09, 0.08, 0.05], 5, dark, micro);
  b.tube([[-0.15, 0.65, 0.02], [-0.38, 0.7, 0.02], [-0.4, 0.95, 0.02]], [0.08, 0.07, 0.045], 5, light, micro);
  b.blob(0.02, 1.28, 0, 0.06, 0.06, 0.02, 4, TERRA_BAND, micro);
  return b.finish(0.025);
}

/** Dünengras: sandige Kuppe mit wehenden Grasbüscheln. */
export function buildDuenengras(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.blob(0, 0.05, 0, 0.5, 0.1, 0.04, 6, PAPER_DARK, null);
  const sway: AnimFn = (p) => {
    const w = p[1] * 0.1;
    return [w, 0, w * 0.5, 2.4 + p[0] * 2];
  };
  const tufts: readonly (readonly [number, number])[] = [
    [0, 0],
    [0.3, 0.12],
    [-0.26, 0.08],
    [0.1, -0.24],
    [-0.12, 0.22],
  ];
  tufts.forEach(([x, z], i) => {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + i;
      const tip: Vec = [x + Math.cos(a) * 0.14, 0.5 + (i % 3) * 0.06, z + Math.sin(a) * 0.14];
      const blade = k === 0 ? dark : k === 1 ? base : light;
      b.tri([x - 0.03, 0.08, z], [x + 0.03, 0.08, z], tip, blade, sway);
      b.tri([x + 0.03, 0.08, z], [x - 0.03, 0.08, z], tip, blade, sway);
    }
  });
  return b.finish(0.02);
}

/** Leuchtpilz: großer Glühpilz mit pulsierender Kappe und kleinem Ableger. */
export function buildLeuchtpilz(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const cy = 0.78;
  const pulse: AnimFn = (p) => {
    const dx = p[0];
    const dy = p[1] - cy;
    const dz = p[2];
    const r = Math.hypot(dx, dy, dz);
    if (r < 1e-6) return [0, 0, 0, 0];
    return [(dx / r) * 0.03, (dy / r) * 0.03, (dz / r) * 0.03, 1.4];
  };
  b.column(0, 0, 0, 0.14, 0.1, 0.62, 6, PAPER, null);
  b.column(0, 0.6, 0, 0.5, 0.04, 0.42, 7, base, pulse);
  b.blob(0, 1.0, 0, 0.2, 0.12, 0.05, 5, light, pulse);
  b.column(0.32, 0, 0.2, 0.06, 0.045, 0.3, 5, PAPER, null);
  b.column(0.32, 0.28, 0.2, 0.18, 0.02, 0.18, 6, dark, pulse);
  return b.finish(0.025);
}

/** Taverne: Giebelhaus mit Ausleger und schaukelndem Wirtshausschild. */
export function buildTaverne(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base] = shades(tint);
  b.box(0, 0.5, 0, 1.4, 1.0, 1.0, PAPER, null);
  const y0 = 1.0;
  const y1 = 1.5;
  const xw = 0.8;
  const zw = 0.6;
  b.quad([-xw, y0, zw], [xw, y0, zw], [xw, y1, 0], [-xw, y1, 0], base, null);
  b.quad([xw, y0, -zw], [-xw, y0, -zw], [-xw, y1, 0], [xw, y1, 0], dark, null);
  b.tri([xw, y0, zw], [xw, y0, -zw], [xw, y1, 0], PAPER_DARK, null);
  b.tri([-xw, y0, -zw], [-xw, y0, zw], [-xw, y1, 0], PAPER_DARK, null);
  b.box(-0.25, 0.36, 0.51, 0.3, 0.66, 0.02, INK, null);
  b.box(0.3, 0.62, 0.51, 0.3, 0.28, 0.02, base, null);
  b.box(0.62, 1.05, 0.3, 0.05, 0.05, 0.5, WOOD_DARK, null);
  const swing: AnimFn = (p) => [0.045, 0.02, 0.055, 1.2 + p[1]];
  b.box(0.62, 0.88, 0.52, 0.26, 0.2, 0.03, base, swing);
  b.box(0.62, 0.88, 0.54, 0.18, 0.12, 0.02, PAPER, swing);
  return b.finish(0.03);
}

/** Schmiede: Werkhalle mit Esse, rauchendem Kamin und Amboss auf dem Klotz. */
export function buildSchmiede(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.box(0, 0.42, 0, 1.2, 0.84, 0.9, PAPER_DARK, null);
  const y0 = 0.84;
  const y1 = 1.22;
  const xw = 0.68;
  const zw = 0.55;
  b.quad([-xw, y0, zw], [xw, y0, zw], [xw, y1, 0], [-xw, y1, 0], dark, null);
  b.quad([xw, y0, -zw], [-xw, y0, -zw], [-xw, y1, 0], [xw, y1, 0], base, null);
  b.tri([xw, y0, zw], [xw, y0, -zw], [xw, y1, 0], PAPER, null);
  b.tri([-xw, y0, -zw], [-xw, y0, zw], [-xw, y1, 0], PAPER, null);
  b.box(0, 0.4, 0.46, 0.5, 0.5, 0.02, INK, null);
  b.box(0.05, 0.44, 0.47, 0.16, 0.16, 0.02, TERRA_BAND, null);
  b.box(-0.35, 1.3, -0.2, 0.24, 0.7, 0.24, dark, null);
  const smoke: AnimFn = (p) => [0.04, 0.05, 0.03, 0.8 + p[1] * 0.5];
  b.blob(-0.35, 1.78, -0.2, 0.14, 0.12, 0.06, 5, PAPER_DARK, smoke);
  b.blob(-0.28, 1.98, -0.16, 0.1, 0.1, 0.05, 4, PAPER, smoke);
  b.box(0.8, 0.16, 0.3, 0.24, 0.32, 0.24, WOOD_DARK, null);
  b.box(0.8, 0.38, 0.3, 0.3, 0.12, 0.14, dark, null);
  b.box(0.8, 0.46, 0.3, 0.34, 0.05, 0.1, light, null);
  return b.finish(0.03);
}

/** Scheune: breiter Holzbau mit hohem Giebeldach und großem Tor. */
export function buildScheune(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.box(0, 0.55, 0, 1.6, 1.1, 1.05, base, null);
  const y0 = 1.1;
  const y1 = 1.75;
  const xw = 0.9;
  const zw = 0.62;
  b.quad([-xw, y0, zw], [xw, y0, zw], [xw, y1, 0], [-xw, y1, 0], dark, null);
  b.quad([xw, y0, -zw], [-xw, y0, -zw], [-xw, y1, 0], [xw, y1, 0], dark, null);
  b.tri([xw, y0, zw], [xw, y0, -zw], [xw, y1, 0], light, null);
  b.tri([-xw, y0, -zw], [-xw, y0, zw], [-xw, y1, 0], light, null);
  b.box(0, 0.5, 0.535, 0.62, 1.0, 0.02, WOOD_DARK, null);
  b.box(0, 0.5, 0.55, 0.05, 1.0, 0.02, PAPER_DARK, null);
  b.box(0.85, 1.28, 0.02, 0.24, 0.24, 0.02, INK, null);
  return b.finish(0.03);
}

/** Windrad: hölzerner Bockturm, vier Flügel wippen um die Nabe. */
export function buildWindrad(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base] = shades(tint);
  b.column(0, 0, 0, 0.36, 0.16, 1.5, 4, WOOD, null);
  b.box(0, 1.6, 0, 0.38, 0.3, 0.38, dark, null);
  const hub: Vec = [0, 1.62, 0.24];
  b.box(hub[0], hub[1], hub[2], 0.1, 0.1, 0.14, WOOD_DARK, null);
  const swing: AnimFn = (p) => {
    const dx = p[0] - hub[0];
    const dy = p[1] - hub[1];
    const r = Math.hypot(dx, dy);
    if (r < 1e-6) return [0, 0, 0, 0];
    const amp = 0.09 * r;
    return [(-dy / r) * amp, (dx / r) * amp, 0, 0];
  };
  for (let wing = 0; wing < 4; wing++) {
    const angle = wing * (Math.PI / 2) + Math.PI / 4;
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const z = hub[2] + 0.09;
    const q = (r: number, s: number): Vec => [hub[0] + ux * r - uy * s, hub[1] + uy * r + ux * s, z];
    const cloth = wing % 2 === 0 ? base : PAPER;
    b.quad(q(0.08, -0.08), q(0.6, -0.08), q(0.6, 0.08), q(0.08, 0.08), cloth, swing);
    b.quad(q(0.08, 0.08), q(0.6, 0.08), q(0.6, -0.08), q(0.08, -0.08), cloth, swing);
  }
  return b.finish(0.03);
}

/** Holzturm: Palisaden-Wachturm auf Stelzen mit Leiter und Zeltdach. */
export function buildHolzturm(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base] = shades(tint);
  const legs: readonly (readonly [number, number])[] = [
    [-0.3, -0.3],
    [0.3, -0.3],
    [-0.3, 0.3],
    [0.3, 0.3],
  ];
  for (const [x, z] of legs) b.box(x, 0.55, z, 0.1, 1.1, 0.1, WOOD_DARK, null);
  b.box(0, 1.14, 0, 0.9, 0.08, 0.9, WOOD, null);
  b.box(0, 1.4, 0, 0.74, 0.5, 0.74, base, null);
  b.column(0, 1.65, 0, 0.62, 0.02, 0.45, 4, dark, null);
  b.box(0, 1.32, 0.375, 0.24, 0.18, 0.02, INK, null);
  b.box(-0.09, 0.6, 0.42, 0.04, 1.1, 0.04, WOOD, null);
  b.box(0.09, 0.6, 0.42, 0.04, 1.1, 0.04, WOOD, null);
  for (let i = 0; i < 4; i++) b.box(0, 0.28 + i * 0.24, 0.42, 0.2, 0.035, 0.035, WOOD_DARK, null);
  return b.finish(0.03);
}

/** Marktstand: Tisch, vier Pfosten, gestreifte Markise und Auslage. */
export function buildMarktstand(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.box(0, 0.32, 0.05, 1.0, 0.12, 0.6, WOOD, null);
  b.box(0, 0.13, 0.05, 0.8, 0.26, 0.4, WOOD_DARK, null);
  const posts: readonly (readonly [number, number, number])[] = [
    [-0.46, 0.35, 0.97],
    [0.46, 0.35, 0.97],
    [-0.46, -0.28, 1.1],
    [0.46, -0.28, 1.1],
  ];
  for (const [x, z, h] of posts) b.box(x, h / 2, z, 0.06, h, 0.06, WOOD_DARK, null);
  const flutter: AnimFn = (p) => [0, 0.02 + (p[2] - 0.2) * 0.04, 0.035, 2.6 + p[0] * 1.5];
  const strips = 4;
  for (let i = 0; i < strips; i++) {
    const x0 = -0.5 + i * 0.25;
    const x1 = x0 + 0.25;
    const cloth = i % 2 === 0 ? base : PAPER;
    b.quad([x0, 1.08, -0.32], [x1, 1.08, -0.32], [x1, 0.92, 0.44], [x0, 0.92, 0.44], cloth, flutter);
    b.quad([x0, 0.92, 0.44], [x1, 0.92, 0.44], [x1, 1.08, -0.32], [x0, 1.08, -0.32], cloth, flutter);
  }
  b.blob(-0.25, 0.44, 0.05, 0.13, 0.1, 0.02, 5, dark, null);
  b.blob(0.05, 0.44, 0.12, 0.11, 0.09, 0.02, 5, TERRA_BAND, null);
  b.blob(0.3, 0.44, -0.02, 0.1, 0.08, 0.02, 5, light, null);
  return b.finish(0.025);
}

/** Kapelle: kleines Schiff mit Satteldach und Türmchen samt Spitzhelm. */
export function buildKapelle(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base] = shades(tint);
  b.box(0.15, 0.45, 0, 1.0, 0.9, 0.7, PAPER, null);
  const y0 = 0.9;
  const y1 = 1.3;
  const zw = 0.42;
  b.quad([-0.35, y0, zw], [0.65, y0, zw], [0.65, y1, 0], [-0.35, y1, 0], base, null);
  b.quad([0.65, y0, -zw], [-0.35, y0, -zw], [-0.35, y1, 0], [0.65, y1, 0], dark, null);
  b.tri([0.65, y0, zw], [0.65, y0, -zw], [0.65, y1, 0], PAPER_DARK, null);
  b.box(-0.55, 0.75, 0, 0.4, 1.5, 0.4, PAPER_DARK, null);
  b.column(-0.55, 1.5, 0, 0.28, 0.02, 0.55, 4, dark, null);
  b.box(-0.55, 1.32, 0.21, 0.1, 0.18, 0.02, INK, null);
  b.box(0.15, 0.3, 0.36, 0.24, 0.6, 0.02, INK, null);
  b.box(0.45, 0.6, 0.36, 0.12, 0.2, 0.02, base, null);
  return b.finish(0.03);
}

/** Ruine: geborstener Mauerwinkel mit Turmstumpf und Schuttbrocken. */
export function buildRuine(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const jitter = [0, -0.25, 0.1, -0.4, 0.05, -0.3];
  b.column(-0.4, 0, -0.2, 0.4, 0.34, 0.9, 6, base, null, jitter);
  b.box(0.45, 0.3, 0.1, 0.16, 0.6, 0.7, dark, null);
  b.box(0.45, 0.72, 0.32, 0.16, 0.24, 0.22, dark, null);
  b.box(0.2, 0.18, 0.5, 0.8, 0.36, 0.14, light, null);
  b.box(0.45, 0.32, -0.05, 0.14, 0.28, 0.02, INK, null);
  b.blob(0.1, 0.08, -0.1, 0.2, 0.1, 0.04, 5, PAPER_DARK, null);
  b.box(0.75, 0.09, 0.45, 0.16, 0.18, 0.14, base, null);
  return b.finish(0.025);
}

/** Speicher: Kornspeicher auf Stelzen mit Leiter. */
export function buildSpeicher(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base] = shades(tint);
  const legs: readonly (readonly [number, number])[] = [
    [-0.4, -0.28],
    [0.4, -0.28],
    [-0.4, 0.28],
    [0.4, 0.28],
  ];
  for (const [x, z] of legs) b.box(x, 0.25, z, 0.1, 0.5, 0.1, WOOD_DARK, null);
  b.box(0, 0.54, 0, 1.1, 0.08, 0.85, WOOD, null);
  b.box(0, 0.95, 0, 1.0, 0.75, 0.72, base, null);
  const y0 = 1.32;
  const y1 = 1.62;
  const zw = 0.44;
  b.quad([-0.56, y0, zw], [0.56, y0, zw], [0.56, y1, 0], [-0.56, y1, 0], dark, null);
  b.quad([0.56, y0, -zw], [-0.56, y0, -zw], [-0.56, y1, 0], [0.56, y1, 0], dark, null);
  b.tri([0.56, y0, zw], [0.56, y0, -zw], [0.56, y1, 0], PAPER_DARK, null);
  b.tri([-0.56, y0, -zw], [-0.56, y0, zw], [-0.56, y1, 0], PAPER_DARK, null);
  b.box(0, 0.85, 0.37, 0.26, 0.3, 0.02, INK, null);
  b.box(0.16, 0.3, 0.4, 0.04, 0.65, 0.04, WOOD, null);
  b.box(-0.16, 0.3, 0.4, 0.04, 0.65, 0.04, WOOD, null);
  for (let i = 0; i < 3; i++) b.box(0, 0.14 + i * 0.18, 0.4, 0.32, 0.03, 0.03, WOOD_DARK, null);
  return b.finish(0.03);
}

/** Stall: niedriger Schuppen mit Pultdach und umzäuntem Auslauf. */
export function buildStall(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base] = shades(tint);
  b.box(-0.35, 0.35, 0, 0.9, 0.7, 0.8, base, null);
  b.quad([-0.85, 0.92, 0.46], [0.15, 0.78, 0.46], [0.15, 0.78, -0.46], [-0.85, 0.92, -0.46], dark, null);
  b.quad([-0.85, 0.86, -0.46], [0.15, 0.72, -0.46], [0.15, 0.72, 0.46], [-0.85, 0.86, 0.46], PAPER_DARK, null);
  b.box(-0.35, 0.3, 0.41, 0.34, 0.6, 0.02, INK, null);
  const rail = (x0: number, z0: number, x1: number, z1: number) => {
    b.box((x0 + x1) / 2, 0.3, (z0 + z1) / 2, Math.max(Math.abs(x1 - x0), 0.04), 0.04, Math.max(Math.abs(z1 - z0), 0.04), WOOD, null);
    b.box((x0 + x1) / 2, 0.16, (z0 + z1) / 2, Math.max(Math.abs(x1 - x0), 0.04), 0.04, Math.max(Math.abs(z1 - z0), 0.04), WOOD, null);
  };
  const postsAt: readonly (readonly [number, number])[] = [
    [0.15, 0.42],
    [0.75, 0.42],
    [0.75, -0.42],
    [0.15, -0.42],
  ];
  for (const [x, z] of postsAt) b.box(x, 0.21, z, 0.06, 0.42, 0.06, WOOD_DARK, null);
  rail(0.15, 0.42, 0.75, 0.42);
  rail(0.75, 0.42, 0.75, -0.42);
  rail(0.15, -0.42, 0.75, -0.42);
  return b.finish(0.025);
}

/** Torbogen: Stadttor — zwei Zinnentürme über dunkler Durchfahrt. */
export function buildTorbogen(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.box(0, 0.52, 0, 0.74, 1.04, 0.42, INK, null);
  b.box(-0.62, 0.7, 0, 0.5, 1.4, 0.55, base, null);
  b.box(0.62, 0.7, 0, 0.5, 1.4, 0.55, base, null);
  b.box(0, 1.28, 0, 0.8, 0.45, 0.5, light, null);
  for (const x of [-0.78, -0.62, -0.46, 0.46, 0.62, 0.78]) {
    b.box(x, 1.48, 0, 0.12, 0.16, 0.5, dark, null);
  }
  for (const x of [-0.15, 0.15]) b.box(x, 1.56, 0, 0.12, 0.12, 0.44, dark, null);
  b.box(-0.62, 0.9, 0.28, 0.1, 0.22, 0.02, INK, null);
  b.box(0.62, 0.9, 0.28, 0.1, 0.22, 0.02, INK, null);
  return b.finish(0.03);
}

/** Wassermühle: Mühlenhaus mit seitlichem Wasserrad, das wippt. */
export function buildWassermuehle(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base] = shades(tint);
  b.box(-0.15, 0.45, -0.1, 1.0, 0.9, 0.75, PAPER, null);
  const y0 = 0.9;
  const y1 = 1.32;
  const zw = 0.45;
  b.quad([-0.65, y0, -0.1 + zw], [0.35, y0, -0.1 + zw], [0.35, y1, -0.1], [-0.65, y1, -0.1], base, null);
  b.quad([0.35, y0, -0.1 - zw], [-0.65, y0, -0.1 - zw], [-0.65, y1, -0.1], [0.35, y1, -0.1], dark, null);
  b.tri([0.35, y0, -0.1 + zw], [0.35, y0, -0.1 - zw], [0.35, y1, -0.1], PAPER_DARK, null);
  b.tri([-0.65, y0, -0.1 - zw], [-0.65, y0, -0.1 + zw], [-0.65, y1, -0.1], PAPER_DARK, null);
  b.box(-0.4, 0.3, 0.28, 0.26, 0.6, 0.02, INK, null);
  const hubX = 0.42;
  const hubY = 0.52;
  const wheelZ = 0.42;
  const swing: AnimFn = (p) => {
    const dx = p[0] - hubX;
    const dy = p[1] - hubY;
    const r = Math.hypot(dx, dy);
    if (r < 1e-6) return [0, 0, 0, 0];
    const amp = 0.07 * r;
    return [(-dy / r) * amp, (dx / r) * amp, 0, 0];
  };
  disc(b, hubX, hubY, wheelZ, 0.46, 8, WOOD_DARK, swing);
  disc(b, hubX, hubY, wheelZ + 0.03, 0.2, 6, WOOD, swing);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.box(hubX + Math.cos(a) * 0.46, hubY + Math.sin(a) * 0.46, wheelZ, 0.1, 0.1, 0.08, WOOD, swing);
  }
  b.box(hubX, hubY, 0.3, 0.08, 0.08, 0.3, WOOD_DARK, null);
  return b.finish(0.03);
}

/** Lagerfeuer: Steinring, gekreuzte Scheite und flackernde Flamme. */
export function buildLagerfeuer(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    b.box(Math.cos(a) * 0.42, 0.06, Math.sin(a) * 0.42, 0.12, 0.12, 0.12, PAPER_DARK, null);
  }
  b.tube([[-0.34, 0.08, 0.1], [0.34, 0.16, -0.1]], [0.055, 0.055], 4, WOOD_DARK, null);
  b.tube([[-0.3, 0.16, -0.18], [0.26, 0.08, 0.22]], [0.05, 0.05], 4, WOOD, null);
  b.tube([[0.05, 0.08, -0.3], [-0.1, 0.16, 0.3]], [0.045, 0.045], 4, WOOD_DARK, null);
  const flicker: AnimFn = (p) => [0.05 + p[1] * 0.08, 0.06, 0.05, 2.6 + p[1] * 3];
  b.blob(0, 0.28, 0, 0.22, 0.34, 0.08, 5, dark, flicker);
  b.blob(0.02, 0.42, 0, 0.14, 0.28, 0.05, 4, base, flicker);
  b.blob(0, 0.56, 0.01, 0.08, 0.2, 0.03, 4, light, flicker);
  return b.finish(0.02);
}

/** Karren: Handkarren mit zwei Speichenrädern, Deichsel und Säcken. */
export function buildKarren(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base] = shades(tint);
  b.box(0.05, 0.38, 0, 0.9, 0.1, 0.55, base, null);
  b.box(0.05, 0.51, 0.26, 0.9, 0.16, 0.04, dark, null);
  b.box(0.05, 0.51, -0.26, 0.9, 0.16, 0.04, dark, null);
  b.box(0.48, 0.51, 0, 0.04, 0.16, 0.48, dark, null);
  disc(b, 0.15, 0.26, 0.3, 0.26, 7, WOOD_DARK, null);
  disc(b, 0.15, 0.26, -0.3, 0.26, 7, WOOD_DARK, null);
  b.box(0.15, 0.26, 0, 0.06, 0.06, 0.66, WOOD, null);
  b.tube([[-0.4, 0.4, 0.16], [-0.95, 0.26, 0.13]], [0.035, 0.03], 4, WOOD, null);
  b.tube([[-0.4, 0.4, -0.16], [-0.95, 0.26, -0.13]], [0.035, 0.03], 4, WOOD, null);
  b.blob(-0.1, 0.52, 0.05, 0.16, 0.14, 0.03, 5, PAPER_DARK, null);
  b.blob(0.22, 0.52, -0.08, 0.13, 0.12, 0.03, 5, PAPER, null);
  return b.finish(0.025);
}

/** Zeltlager: drei Spitzzelte um eine Bannerstange mit wehendem Banner. */
export function buildZeltlager(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const tent = (x: number, z: number, r: number, h: number, cloth: Rgb) => {
    b.column(x, 0, z, r, 0.02, h, 4, cloth, null);
    b.column(x, h * 0.34, z, r * 0.68 + 0.02, r * 0.6 + 0.02, h * 0.09, 4, TERRA_BAND, null);
  };
  tent(0.4, 0.32, 0.42, 0.7, base);
  tent(-0.48, 0.26, 0.36, 0.6, light);
  tent(-0.02, -0.46, 0.3, 0.5, base);
  b.box(0, 0.62, 0, 0.035, 1.24, 0.035, WOOD_DARK, null);
  const flutter: AnimFn = (p) => [0, 0.02 + p[0] * 0.06, 0.045, 2 + p[0] * 6];
  b.quad([0.02, 1.22, 0], [0.4, 1.17, 0], [0.4, 1.05, 0], [0.02, 1.1, 0], dark, flutter);
  b.quad([0.02, 1.1, 0], [0.4, 1.05, 0], [0.4, 1.17, 0], [0.02, 1.22, 0], base, flutter);
  b.blob(0.55, 0.08, -0.35, 0.14, 0.1, 0.03, 5, PAPER_DARK, null);
  return b.finish(0.025);
}

/** Bienenstöcke: Bank mit drei geflochtenen Körben samt Fluglöchern. */
export function buildBienenstoecke(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.box(0, 0.09, 0, 1.05, 0.06, 0.45, WOOD, null);
  b.box(-0.42, 0.03, 0.16, 0.08, 0.08, 0.08, WOOD_DARK, null);
  b.box(0.42, 0.03, 0.16, 0.08, 0.08, 0.08, WOOD_DARK, null);
  b.box(-0.42, 0.03, -0.16, 0.08, 0.08, 0.08, WOOD_DARK, null);
  b.box(0.42, 0.03, -0.16, 0.08, 0.08, 0.08, WOOD_DARK, null);
  const skep = (x: number, r: number, h: number, body: Rgb, ring: Rgb) => {
    b.column(x, 0.12, 0, r, r * 0.92, h * 0.38, 6, body, null);
    b.column(x, 0.12 + h * 0.38, 0, r * 0.92, r * 0.68, h * 0.34, 6, ring, null);
    b.column(x, 0.12 + h * 0.72, 0, r * 0.68, r * 0.3, h * 0.22, 6, body, null);
    b.blob(x, 0.12 + h * 0.94, 0, r * 0.3, h * 0.12, 0.01, 5, ring, null);
    b.box(x, 0.18, r * 0.95, 0.07, 0.07, 0.03, INK, null);
  };
  skep(-0.34, 0.24, 0.5, base, dark);
  skep(0.02, 0.2, 0.42, light, base);
  skep(0.36, 0.17, 0.36, base, dark);
  return b.finish(0.025);
}

/** Registry für assets-ink.ts — dort in BUILDERS eingemischt. */
export const INK_ASSET_BUILDERS_BATCH4 = {
  eiche: buildEiche,
  weide: buildWeide,
  birke: buildBirke,
  windbaum: buildWindbaum,
  farn: buildFarn,
  schilf: buildSchilf,
  bluetenbaum: buildBluetenbaum,
  felsnadel: buildFelsnadel,
  bogenfels: buildBogenfels,
  geysir: buildGeysir,
  kaktus: buildKaktus,
  duenengras: buildDuenengras,
  leuchtpilz: buildLeuchtpilz,
  taverne: buildTaverne,
  schmiede: buildSchmiede,
  scheune: buildScheune,
  windrad: buildWindrad,
  holzturm: buildHolzturm,
  marktstand: buildMarktstand,
  kapelle: buildKapelle,
  ruine: buildRuine,
  speicher: buildSpeicher,
  stall: buildStall,
  torbogen: buildTorbogen,
  wassermuehle: buildWassermuehle,
  lagerfeuer: buildLagerfeuer,
  karren: buildKarren,
  zeltlager: buildZeltlager,
  bienenstoecke: buildBienenstoecke,
} as const;
