/**
 * Tusche-Assets, Batch 3 — Natur, Siedlung, Weltenbau, Himmel & Gewässer.
 *
 * Gleicher Kontrakt wie assets-ink.ts / assets-ink-batch2.ts: reine
 * Geometriedaten (non-indexed Triangles, Tuschelagen-Farben, Idle-Animation
 * über das aAnim-Attribut), strikt deterministisch — identische Inputs bauen
 * identische Assets (Owner-Entscheid: keine Zufallszahlen). Himmel-Assets
 * (Wolkeninsel, Luftschiff) schweben rein über ihre Geometrie (Basis bei
 * y ≈ 0.5), ohne Sonderfall in scene-objects.
 */

import { Builder, hex, INK, shades, type AnimFn, type InkAssetData, type InkTint, type Vec } from "./assets-ink";

const WOOD = hex("#7a5a3a");
const WOOD_DARK = hex("#5c452c");
const PAPER = hex("#f1e8d4");
const PAPER_DARK = hex("#d9cba1");
const TERRA_BAND = hex("#c2622b");

/** Tanne: 2–3 gestapelte Nadel-Kegel auf kurzem Stamm, sanftes Wippen. */
export function buildTanne(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const sway: AnimFn = (p) => {
    const w = Math.max(0, p[1] - 0.35) * 0.035;
    return [w, 0, w * 0.4, p[1] * 1.5];
  };
  b.column(0, 0, 0, 0.14, 0.09, 0.5, 6, WOOD, null);
  b.column(0, 0.45, 0, 0.62, 0.02, 0.75, 7, dark, sway);
  b.column(0, 1.0, 0, 0.48, 0.02, 0.65, 7, base, sway);
  b.column(0, 1.5, 0, 0.32, 0.01, 0.55, 6, light, sway);
  return b.finish(0.03);
}

/** Palme: gebogener Stamm, 6 Wedel-Flächen — die Wedel wippen deutlich stärker. */
export function buildPalme(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const points: Vec[] = [];
  const radii: number[] = [];
  for (let k = 0; k <= 6; k++) {
    const t = k / 6;
    points.push([t * t * 0.42, t * 1.45, t * 0.08]);
    radii.push(0.1 * (1 - t * 0.55) + 0.02);
  }
  const trunkSway: AnimFn = (p) => {
    const w = Math.max(0, p[1]) * 0.03;
    return [w, 0, w * 0.5, p[1] * 1.3];
  };
  b.tube(points, radii, 6, hex("#93744e"), trunkSway);
  const top: Vec = [0.42, 1.45, 0.08];
  const frondSway: AnimFn = (p) => {
    const d = Math.hypot(p[0] - top[0], p[1] - top[1], p[2] - top[2]);
    const w = 0.05 + d * 0.09;
    return [w * 0.7, w * 0.5, w * 0.7, 2 + d * 1.6];
  };
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.35;
    const ux = Math.cos(a);
    const uz = Math.sin(a);
    const sx = -uz * 0.09;
    const sz = ux * 0.09;
    const mid: Vec = [top[0] + ux * 0.5, top[1] + 0.14, top[2] + uz * 0.5];
    const tip: Vec = [top[0] + ux * 0.95, top[1] - 0.18, top[2] + uz * 0.95];
    const cloth = i % 3 === 0 ? dark : i % 3 === 1 ? base : light;
    const i0: Vec = [top[0] + sx, top[1], top[2] + sz];
    const i1: Vec = [mid[0] + sx, mid[1], mid[2] + sz];
    const i2: Vec = [mid[0] - sx, mid[1], mid[2] - sz];
    const i3: Vec = [top[0] - sx, top[1], top[2] - sz];
    b.quad(i0, i1, i2, i3, cloth, frondSway);
    b.quad(i3, i2, i1, i0, cloth, frondSway);
    b.tri(i1, tip, i2, cloth, frondSway);
    b.tri(i2, tip, i1, cloth, frondSway);
  }
  return b.finish(0.03);
}

/** Pilzhain: drei Pilze verschiedener Größe (Stiel + Kappenkegel), minimal bewegt. */
export function buildPilzhain(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const micro: AnimFn = (p) => [0.003, 0, 0.002, p[1] * 2.4];
  const mushroom = (x: number, z: number, capR: number, h: number, cap: readonly [number, number, number]) => {
    b.column(x, 0, z, capR * 0.34, capR * 0.26, h, 5, PAPER, null);
    b.column(x, h * 0.82, z, capR, 0.03, capR * 0.85, 6, cap, micro);
  };
  mushroom(0, 0, 0.42, 0.52, base);
  mushroom(0.42, 0.2, 0.28, 0.36, dark);
  mushroom(-0.36, -0.15, 0.22, 0.28, light);
  return b.finish(0.025);
}

/** Kristalle: fünf schräg stehende, spitze Prismen — leichtes Pulsieren. */
export function buildKristalle(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const spikes: readonly (readonly [number, number, number, number, number, number])[] = [
    [0, 0, 0.2, 1.15, 0.14, 0.05],
    [0.34, 0.14, 0.13, 0.7, -0.1, 0.12],
    [-0.3, 0.1, 0.12, 0.6, 0.08, -0.14],
    [0.12, -0.3, 0.1, 0.45, 0.16, 0.06],
    [-0.16, -0.24, 0.08, 0.34, -0.12, -0.08],
  ];
  spikes.forEach(([cx, cz, r, h, tx, tz], idx) => {
    const apex: Vec = [cx + tx, h, cz + tz];
    const pulse: AnimFn = (p) => [0.008, 0.014 * (p[1] / h), 0.008, 1.5 + idx * 0.4];
    const pts: Vec[] = [];
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + idx * 0.7;
      pts.push([cx + Math.cos(ang) * r, 0, cz + Math.sin(ang) * r]);
    }
    for (let i = 0; i < 4; i++) {
      const facet = i % 2 === 0 ? (idx % 2 === 0 ? base : light) : dark;
      b.tri(pts[i], pts[(i + 1) % 4], apex, facet, pulse);
    }
  });
  return b.finish(0.02);
}

/** Toter Baum: kahler Stamm mit knorrigen Ast-Keilen, minimal bewegt. */
export function buildToterbaum(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base] = shades(tint);
  const micro: AnimFn = (p) => [0.004 * Math.max(0, p[1]), 0, 0.003, p[1] * 1.2];
  b.column(0, 0, 0, 0.16, 0.06, 1.35, 6, dark, micro);
  const branch = (a: number, y0: number, len: number, rise: number) => {
    const ux = Math.cos(a);
    const uz = Math.sin(a);
    const pts: Vec[] = [
      [ux * 0.08, y0, uz * 0.08],
      [ux * len * 0.6, y0 + rise * 0.7, uz * len * 0.6],
      [ux * len, y0 + rise, uz * len],
    ];
    b.tube(pts, [0.05, 0.03, 0.008], 4, dark, micro);
  };
  branch(0.4, 0.85, 0.55, 0.35);
  branch(2.4, 1.0, 0.45, 0.3);
  branch(4.2, 0.7, 0.5, 0.25);
  branch(5.5, 1.15, 0.35, 0.3);
  b.box(0.02, 1.38, 0, 0.08, 0.1, 0.08, base, micro);
  return b.finish(0.025);
}

/** Hütte: Rundhütte aus Zylinderstumpf mit Kegeldach und Tür. */
export function buildHuette(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base] = shades(tint);
  b.column(0, 0, 0, 0.52, 0.48, 0.6, 7, PAPER, null);
  b.column(0, 0.6, 0, 0.62, 0.02, 0.5, 7, base, null);
  b.box(0, 0.28, 0.47, 0.26, 0.5, 0.06, INK, null);
  b.box(0, 1.12, 0, 0.06, 0.12, 0.06, dark, null);
  return b.finish(0.03);
}

/** Brunnen: niedriger Ring mit Wasser, zwei Pfosten, Querbalken und Mini-Dach. */
export function buildBrunnen(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.column(0, 0, 0, 0.4, 0.36, 0.3, 7, base, null);
  const shimmer: AnimFn = (p) => [0, 0.004, 0.003, p[0] * 4 + p[2] * 4];
  b.blob(0, 0.31, 0, 0.27, 0.015, 0.01, 6, hex("#35597e"), shimmer);
  b.box(0.3, 0.55, 0, 0.06, 0.5, 0.06, WOOD, null);
  b.box(-0.3, 0.55, 0, 0.06, 0.5, 0.06, WOOD, null);
  b.box(0, 0.78, 0, 0.66, 0.05, 0.05, WOOD_DARK, null);
  b.quad([-0.42, 0.86, 0.26], [-0.42, 0.86, -0.26], [0, 1.02, -0.26], [0, 1.02, 0.26], dark, null);
  b.quad([0, 1.02, 0.26], [0, 1.02, -0.26], [0.42, 0.86, -0.26], [0.42, 0.86, 0.26], light, null);
  return b.finish(0.025);
}

/** Zelt: drei Spitzzelte aus schrägen Dreiecksflächen mit Terra-Bändern. */
export function buildZelt(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const tent = (x: number, z: number, r: number, h: number, cloth: readonly [number, number, number]) => {
    b.column(x, 0, z, r, 0.02, h, 4, cloth, null);
    b.column(x, h * 0.34, z, r * 0.68 + 0.02, r * 0.6 + 0.02, h * 0.09, 4, TERRA_BAND, null);
  };
  tent(0, 0, 0.5, 0.85, base);
  tent(0.55, 0.24, 0.32, 0.55, light);
  tent(-0.5, 0.18, 0.28, 0.5, base);
  b.box(0, 0.9, 0, 0.025, 0.14, 0.025, dark, null);
  const flutter: AnimFn = (p) => [0, 0.02 + (p[0] - 0.01) * 0.06, 0.04, p[0] * 8];
  b.tri([0.01, 1.0, 0], [0.16, 0.96, 0], [0.01, 0.92, 0], TERRA_BAND, flutter);
  b.tri([0.01, 0.92, 0], [0.16, 0.96, 0], [0.01, 1.0, 0], TERRA_BAND, flutter);
  return b.finish(0.025);
}

/** Leuchtturm: sich verjüngender Turm mit Ringstreifen, die Laterne pulsiert. */
export function buildLeuchtturm(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.box(0, 0.09, 0, 0.7, 0.18, 0.7, dark, null);
  const rAt = (t: number) => 0.3 - t * 0.13;
  let y = 0.18;
  for (let i = 0; i < 4; i++) {
    b.column(0, y, 0, rAt(i / 4), rAt((i + 1) / 4), 0.42, 7, i % 2 === 0 ? base : TERRA_BAND, null);
    y += 0.42;
  }
  b.box(0, 0.42, 0.28, 0.2, 0.36, 0.08, INK, null);
  b.box(0, 1.92, 0, 0.4, 0.06, 0.4, dark, null);
  const cy = 2.04;
  const pulse: AnimFn = (p) => {
    const dx = p[0];
    const dy = p[1] - cy;
    const dz = p[2];
    const r = Math.hypot(dx, dy, dz);
    if (r < 1e-6) return [0, 0, 0, 0];
    return [(dx / r) * 0.025, (dy / r) * 0.025, (dz / r) * 0.025, 1.6];
  };
  b.box(0, cy, 0, 0.24, 0.22, 0.24, light, pulse);
  b.column(0, 2.15, 0, 0.2, 0.01, 0.22, 6, dark, null);
  return b.finish(0.03);
}

/** Statue: Sockelquader mit stilisierter stehender Figur aus Keilen. */
export function buildStatue(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.box(0, 0.15, 0, 0.6, 0.3, 0.6, dark, null);
  b.box(0, 0.36, 0, 0.44, 0.12, 0.44, base, null);
  b.column(0, 0.42, 0, 0.17, 0.1, 0.72, 4, base, null);
  b.box(0, 1.19, 0, 0.34, 0.1, 0.14, light, null);
  b.box(0.19, 1.0, 0.03, 0.08, 0.3, 0.1, base, null);
  b.box(-0.19, 1.02, -0.02, 0.08, 0.26, 0.1, base, null);
  b.blob(0, 1.31, 0, 0.1, 0.12, 0.07, 5, light, null);
  return b.finish(0.02);
}

/** Runenstein: schiefer Monolith mit eingekerbten Facetten. */
export function buildRunenstein(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base] = shades(tint);
  const micro: AnimFn = (p) => [0.002 * Math.max(0, p[1]), 0, 0.0015, p[1] * 1.1];
  const spine: Vec[] = [
    [0, 0, 0],
    [0.06, 0.52, 0.03],
    [0.16, 1.05, 0.07],
  ];
  b.tube(spine, [0.3, 0.25, 0.11], 5, base, micro);
  b.box(0.32, 0.08, 0.12, 0.2, 0.16, 0.16, dark, null);
  b.box(-0.26, 0.06, -0.12, 0.16, 0.12, 0.14, dark, null);
  b.box(0.03, 0.4, 0.26, 0.04, 0.14, 0.03, INK, micro);
  b.box(0.08, 0.66, 0.24, 0.1, 0.04, 0.03, INK, micro);
  b.box(0.11, 0.84, 0.2, 0.04, 0.1, 0.03, INK, micro);
  return b.finish(0.025);
}

/** Schrein: kleiner Sockel, zwei Pfosten und ein geschwungenes Dach. */
export function buildSchrein(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base] = shades(tint);
  b.box(0, 0.08, 0, 0.9, 0.16, 0.6, PAPER_DARK, null);
  b.box(0.28, 0.52, 0, 0.09, 0.72, 0.09, base, null);
  b.box(-0.28, 0.52, 0, 0.09, 0.72, 0.09, base, null);
  b.box(0, 0.94, 0, 0.74, 0.07, 0.12, base, null);
  const zw = 0.3;
  const roofY = (t: number) => 1.02 + 0.16 * (2 * t - 1) * (2 * t - 1);
  const segments = 4;
  for (let i = 0; i < segments; i++) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    const x0 = -0.55 + t0 * 1.1;
    const x1 = -0.55 + t1 * 1.1;
    b.quad([x0, roofY(t0), zw], [x1, roofY(t1), zw], [x1, roofY(t1), -zw], [x0, roofY(t0), -zw], dark, null);
    b.quad([x0, roofY(t0) - 0.05, -zw], [x1, roofY(t1) - 0.05, -zw], [x1, roofY(t1) - 0.05, zw], [x0, roofY(t0) - 0.05, zw], base, null);
  }
  b.box(0, 1.08, 0, 0.1, 0.12, 0.1, dark, null);
  return b.finish(0.025);
}

/** Wolkeninsel: umgedrehter Erdkegel mit Mini-Baum und Wolkenpuffs — schwebt (Basis y ≈ 0.5). */
export function buildWolkeninsel(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const float: AnimFn = (p) => [0.01, 0.045, 0.01, 0.9 + p[1] * 0.2];
  const puffFloat: AnimFn = (p) => [0.02, 0.035, 0.015, 0.5 + p[0] * 0.3];
  b.blob(0, 0.95, 0, 0.6, 0.1, 0.5, 6, dark, float);
  b.column(0, 0.95, 0, 0.58, 0.5, 0.1, 6, base, float);
  b.column(0.12, 1.05, 0, 0.05, 0.03, 0.2, 5, WOOD, float);
  b.blob(0.12, 1.36, 0, 0.2, 0.17, 0.12, 5, hex("#3a8878"), float);
  b.blob(0.68, 0.82, 0.16, 0.2, 0.12, 0.12, 5, light, puffFloat);
  b.blob(-0.62, 0.72, -0.12, 0.16, 0.1, 0.1, 5, light, puffFloat);
  return b.finish(0.025);
}

/** Luftschiff: ellipsoider Ballon mit Terra-Streifen und Gondel — driftet sanft (Basis y ≈ 0.5). */
export function buildLuftschiff(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [, base, light] = shades(tint);
  const drift: AnimFn = (p) => [0.05, 0.02, 0.03, 0.7 + p[0] * 0.15];
  const cy = 1.15;
  const rx = 0.8;
  const ry = 0.38;
  const latBands = 4;
  const lonBands = 8;
  const at = (lat: number, lon: number): Vec => {
    const theta = (lat / latBands) * Math.PI;
    const phi = (lon / lonBands) * Math.PI * 2;
    return [rx * Math.cos(theta), cy + ry * Math.sin(theta) * Math.cos(phi), ry * Math.sin(theta) * Math.sin(phi)];
  };
  for (let lat = 0; lat < latBands; lat++) {
    for (let lon = 0; lon < lonBands; lon++) {
      const facet = lat === 1 || lat === 2 ? (lon % 4 === 0 ? TERRA_BAND : base) : light;
      b.quad(at(lat, lon), at(lat, lon + 1), at(lat + 1, lon + 1), at(lat + 1, lon), facet, drift);
    }
  }
  b.box(0, 0.62, 0, 0.4, 0.16, 0.18, WOOD, drift);
  b.box(0.12, 0.735, 0, 0.03, 0.11, 0.03, WOOD_DARK, drift);
  b.box(-0.12, 0.735, 0, 0.03, 0.11, 0.03, WOOD_DARK, drift);
  b.tri([-0.74, 1.2, 0], [-0.98, 1.32, 0], [-0.96, 1.1, 0], TERRA_BAND, drift);
  b.tri([-0.96, 1.1, 0], [-0.98, 1.32, 0], [-0.74, 1.2, 0], TERRA_BAND, drift);
  return b.finish(0.025);
}

/** Boot: kleiner Rumpf mit Mast und Segeldreieck — schaukelt auf dem Wasser. */
export function buildBoot(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base] = shades(tint);
  const rock: AnimFn = (p) => [p[1] * 0.02, p[0] * 0.045, 0, 1.1];
  const deckY = 0.26;
  const keelY = 0.08;
  const zw = 0.17;
  const xw = 0.44;
  const zk = zw * 0.6;
  b.quad([-xw, keelY, zk], [xw, keelY, zk], [xw, deckY, zw], [-xw, deckY, zw], base, rock);
  b.quad([xw, keelY, -zk], [-xw, keelY, -zk], [-xw, deckY, -zw], [xw, deckY, -zw], base, rock);
  b.quad([-xw, keelY, -zk], [xw, keelY, -zk], [xw, keelY, zk], [-xw, keelY, zk], dark, rock);
  b.quad([-xw, deckY, -zw], [xw, deckY, -zw], [xw, deckY, zw], [-xw, deckY, zw], dark, rock);
  const bow: Vec = [0.68, deckY + 0.04, 0];
  b.tri([xw, deckY, zw], [xw, keelY, zk], bow, base, rock);
  b.tri([xw, keelY, -zk], [xw, deckY, -zw], bow, base, rock);
  b.tri([xw, deckY, -zw], [xw, deckY, zw], bow, dark, rock);
  const stern: Vec = [-0.62, deckY + 0.02, 0];
  b.tri([-xw, keelY, zk], [-xw, deckY, zw], stern, base, rock);
  b.tri([-xw, deckY, -zw], [-xw, keelY, -zk], stern, base, rock);
  b.tri([-xw, deckY, zw], [-xw, deckY, -zw], stern, dark, rock);
  b.box(0.02, 0.62, 0, 0.04, 0.72, 0.04, WOOD_DARK, rock);
  const sailAnim: AnimFn = (p) => [p[1] * 0.02 + 0.02, p[0] * 0.045, 0.03, 1.3];
  b.tri([0.05, 0.92, 0], [0.05, 0.4, 0], [0.5, 0.44, 0], PAPER, sailAnim);
  b.tri([0.5, 0.44, 0], [0.05, 0.4, 0], [0.05, 0.92, 0], PAPER, sailAnim);
  return b.finish(0.025);
}

/** Seerosen: flache Blatt-Scheiben knapp über dem Wasser mit einer Blüte. */
export function buildSeerosen(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const bob: AnimFn = (p) => [0, 0.006, 0.004, p[0] * 2 + p[2] * 2];
  const leaf = (x: number, z: number, r: number, color: readonly [number, number, number]) => {
    b.blob(x, 0.035, z, r, 0.015, 0.015, 6, color, bob);
  };
  leaf(0, 0, 0.26, base);
  leaf(0.4, 0.18, 0.2, dark);
  leaf(-0.34, 0.12, 0.17, light);
  leaf(0.1, -0.36, 0.15, dark);
  b.blob(0.02, 0.07, -0.02, 0.09, 0.12, 0.02, 5, PAPER, bob);
  b.blob(0.02, 0.1, -0.02, 0.04, 0.08, 0.01, 4, hex("#faf5e8"), bob);
  return b.finish(0.02);
}

/** Registry für assets-ink.ts — dort in BUILDERS eingemischt. */
export const INK_ASSET_BUILDERS_BATCH3 = {
  tanne: buildTanne,
  palme: buildPalme,
  pilzhain: buildPilzhain,
  kristalle: buildKristalle,
  toterbaum: buildToterbaum,
  huette: buildHuette,
  brunnen: buildBrunnen,
  zelt: buildZelt,
  leuchtturm: buildLeuchtturm,
  statue: buildStatue,
  runenstein: buildRunenstein,
  schrein: buildSchrein,
  wolkeninsel: buildWolkeninsel,
  luftschiff: buildLuftschiff,
  boot: buildBoot,
  seerosen: buildSeerosen,
} as const;
