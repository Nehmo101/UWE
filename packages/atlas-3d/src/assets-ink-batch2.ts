/**
 * Tusche-Assets, Batch 2 — weitere prozedurale Miniaturen.
 *
 * Gleicher Kontrakt wie assets-ink.ts: reine Geometriedaten (non-indexed
 * Triangles, Tuschelagen-Farben, Idle-Animation über das aAnim-Attribut),
 * deterministisch — identische Inputs bauen identische Assets. Die Builder
 * leben in einer eigenen Datei, damit assets-ink.ts im Größenbudget bleibt.
 */

import { Builder, hex, INK, shades, type AnimFn, type InkAssetData, type InkTint, type Vec } from "./assets-ink";

/** Fels: kantiger Block aus 2–3 Facetten-Brocken, nahezu unbewegt. */
export function buildFels(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const micro: AnimFn = (p) => [0.003, 0, 0.002, p[1] * 2];
  b.blob(0, 0.26, 0, 0.52, 0.34, 0.24, 5, base, micro);
  b.box(0.3, 0.2, 0.16, 0.52, 0.4, 0.44, dark, micro);
  b.box(-0.34, 0.14, -0.12, 0.4, 0.28, 0.34, light, micro);
  return b.finish(0.025);
}

/** Busch: niedrige facettierte Kugel-Krone, sanftes Wippen. */
export function buildBusch(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const sway: AnimFn = (p) => {
    const w = Math.max(0, p[1] - 0.08) * 0.06;
    return [w, 0, w * 0.5, p[1] * 2.2];
  };
  b.blob(0, 0.3, 0, 0.5, 0.34, 0.28, 6, dark, sway);
  b.blob(0.16, 0.42, 0.08, 0.3, 0.26, 0.18, 5, base, sway);
  b.blob(-0.15, 0.4, -0.07, 0.24, 0.22, 0.15, 5, light, sway);
  return b.finish(0.025);
}

/** Brücke: zwei Auflager mit gewölbter Bogenplanke und Geländerpfosten. */
export function buildBruecke(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.box(-0.72, 0.19, 0, 0.4, 0.38, 0.52, dark, null);
  b.box(0.72, 0.19, 0, 0.4, 0.38, 0.52, dark, null);
  const micro: AnimFn = (p) => [0, 0.003, 0.002, p[0] * 2];
  const segments = 6;
  const zw = 0.22;
  const archX = (t: number) => -0.72 + t * 1.44;
  const archY = (t: number) => 0.38 + Math.sin(t * Math.PI) * 0.22;
  for (let i = 0; i < segments; i++) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    const x0 = archX(t0);
    const x1 = archX(t1);
    const y0 = archY(t0);
    const y1 = archY(t1);
    const plank = i % 2 === 0 ? base : light;
    b.quad([x0, y0, zw], [x1, y1, zw], [x1, y1, -zw], [x0, y0, -zw], plank, micro);
    b.quad([x0, y0 - 0.08, -zw], [x1, y1 - 0.08, -zw], [x1, y1 - 0.08, zw], [x0, y0 - 0.08, zw], dark, micro);
    b.quad([x0, y0 - 0.08, zw], [x1, y1 - 0.08, zw], [x1, y1, zw], [x0, y0, zw], dark, micro);
    b.quad([x1, y1 - 0.08, -zw], [x0, y0 - 0.08, -zw], [x0, y0, -zw], [x1, y1, -zw], dark, micro);
  }
  for (const t of [0.2, 0.5, 0.8]) {
    b.box(archX(t), archY(t) + 0.12, zw, 0.05, 0.24, 0.05, INK, null);
    b.box(archX(t), archY(t) + 0.12, -zw, 0.05, 0.24, 0.05, INK, null);
  }
  return b.finish(0.025);
}

/** Mühle: Turm mit Kegeldach und vier Flügeln, die um die Nabe wippen. */
export function buildMuehle(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base] = shades(tint);
  b.column(0, 0, 0, 0.44, 0.3, 1.4, 7, hex("#d9cba1"), null);
  b.column(0, 1.4, 0, 0.36, 0.03, 0.42, 7, dark, null);
  b.box(0, 0.32, 0.4, 0.24, 0.44, 0.08, INK, null);
  const hub: Vec = [0, 1.32, 0.4];
  b.box(hub[0], hub[1], hub[2], 0.12, 0.12, 0.16, hex("#5c452c"), null);
  // Der Shader kann nur sinusförmig auslenken — die Flügel wippen daher
  // tangential um die Nabe (angedeutete Rotation), alle phasengleich.
  const swing: AnimFn = (p) => {
    const dx = p[0] - hub[0];
    const dy = p[1] - hub[1];
    const r = Math.hypot(dx, dy);
    if (r < 1e-6) return [0, 0, 0, 0];
    const amp = 0.08 * r;
    return [(-dy / r) * amp, (dx / r) * amp, 0, 0];
  };
  for (let wing = 0; wing < 4; wing++) {
    const angle = wing * (Math.PI / 2) + Math.PI / 4;
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const z = hub[2] + 0.1;
    const q = (r: number, s: number): Vec => [hub[0] + ux * r - uy * s, hub[1] + uy * r + ux * s, z];
    const cloth = wing % 2 === 0 ? base : dark;
    b.quad(q(0.1, -0.09), q(0.75, -0.09), q(0.75, 0.09), q(0.1, 0.09), cloth, swing);
    b.quad(q(0.1, 0.09), q(0.75, 0.09), q(0.75, -0.09), q(0.1, -0.09), cloth, swing);
  }
  return b.finish(0.03);
}

/** Hafen: Pier-Planken auf Pfählen mit zwei Pollern. */
export function buildHafen(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const piles: readonly (readonly [number, number])[] = [
    [-0.62, 0.16],
    [-0.62, -0.16],
    [0, 0.16],
    [0, -0.16],
    [0.62, 0.16],
    [0.62, -0.16],
  ];
  for (const [x, z] of piles) b.box(x, 0.14, z, 0.09, 0.34, 0.09, dark, null);
  const micro: AnimFn = (p) => [0, 0.002, 0.002, p[0] * 3];
  for (let i = 0; i < 5; i++) {
    b.box(-0.64 + i * 0.32, 0.34, 0, 0.3, 0.06, 0.48, i % 2 === 0 ? base : light, micro);
  }
  b.column(0.55, 0.37, 0.18, 0.05, 0.045, 0.14, 5, INK, null);
  b.column(-0.55, 0.37, -0.18, 0.05, 0.045, 0.14, 5, INK, null);
  return b.finish(0.025);
}

/** Portal: stehender Ring auf einem Sockel, pulsiert leicht radial. */
export function buildPortal(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.box(0, 0.12, 0, 1.0, 0.24, 0.5, dark, null);
  b.box(0, 0.3, 0, 0.7, 0.12, 0.36, base, null);
  const cy = 1.02;
  const ringRadius = 0.62;
  const pulse: AnimFn = (p) => {
    const dx = p[0];
    const dy = p[1] - cy;
    const r = Math.hypot(dx, dy);
    if (r < 1e-6) return [0, 0, 0, 0];
    return [(dx / r) * 0.02, (dy / r) * 0.02, 0, 1.2];
  };
  const points: Vec[] = [];
  const radii: number[] = [];
  const segments = 14;
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    points.push([Math.cos(a) * ringRadius, cy + Math.sin(a) * ringRadius, 0]);
    radii.push(0.09);
  }
  b.tube(points, radii, 6, light, pulse);
  return b.finish(0.025);
}

/** Obelisk: schlanke, sich verjüngende Stele mit Pyramidenspitze, minimal bewegt. */
export function buildObelisk(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const micro: AnimFn = (p) => [0.002 * Math.min(1, Math.max(0, p[1])), 0, 0.0015, p[1]];
  b.box(0, 0.09, 0, 0.46, 0.18, 0.46, dark, null);
  b.column(0, 0.18, 0, 0.17, 0.09, 1.75, 4, base, micro);
  b.column(0, 1.93, 0, 0.09, 0.005, 0.24, 4, light, micro);
  return b.finish(0.02);
}

/** Mond: kleine facettierte Kugel — kreist wie der Asteroid im Orbit (Transform, keine Vertex-Animation). */
export function buildMond(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const radius = 0.5;
  const latBands = 4;
  const lonBands = 6;
  const at = (lat: number, lon: number): Vec => {
    const theta = (lat / latBands) * Math.PI;
    const phi = (lon / lonBands) * Math.PI * 2;
    return [
      radius * Math.sin(theta) * Math.cos(phi),
      radius * Math.cos(theta),
      radius * Math.sin(theta) * Math.sin(phi),
    ];
  };
  for (let lat = 0; lat < latBands; lat++) {
    for (let lon = 0; lon < lonBands; lon++) {
      const facet = (lat + lon) % 2 === 0 ? base : light;
      b.quad(at(lat, lon), at(lat, lon + 1), at(lat + 1, lon + 1), at(lat + 1, lon), facet, null);
    }
  }
  b.box(0.3, 0.22, 0.18, 0.16, 0.1, 0.16, dark, null);
  b.box(-0.2, -0.14, 0.3, 0.12, 0.12, 0.1, dark, null);
  return b.finish(0.02);
}

/** Registry für assets-ink.ts — dort in BUILDERS eingemischt. */
export const INK_ASSET_BUILDERS_BATCH2 = {
  fels: buildFels,
  busch: buildBusch,
  bruecke: buildBruecke,
  muehle: buildMuehle,
  hafen: buildHafen,
  portal: buildPortal,
  obelisk: buildObelisk,
  mond: buildMond,
} as const;
