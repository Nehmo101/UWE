/**
 * Tusche-Assets, Batch 4b — Weltenbau, Gewässer & Himmel (Charge 4, Teil 2).
 *
 * Gleicher Kontrakt wie assets-ink.ts / batch2 / batch3 / batch4: reine
 * Geometriedaten (non-indexed Triangles, Tuschelagen-Farben, Idle-Animation
 * über das aAnim-Attribut), strikt deterministisch. Flaggschiff der Charge:
 * die Weltenschildkröte — gigantische Grundfläche (Kopf bis Schwanz ~3
 * Einheiten), Schloss auf dem Panzer, Gesamthöhe ≤ 2.2, damit die Weltwurzel
 * weiterhin alles überragt. Der Kometenstein kreist wie Asteroid/Mond im
 * Orbit (GLOBE_ONLY, Transform in scene-objects/editor-place-tools).
 */

import { Builder, hex, INK, shades, type AnimFn, type InkAssetData, type InkTint, type Rgb, type Vec } from "./assets-ink";

const WOOD = hex("#7a5a3a");
const WOOD_DARK = hex("#5c452c");
const PAPER = hex("#f1e8d4");
const PAPER_DARK = hex("#d9cba1");
const TERRA_BAND = hex("#c2622b");

/**
 * Weltenschildkröte (Flaggschiff): gigantische Schildkröte, die ein ganzes
 * Schloss auf dem Panzer trägt. Breiter Facetten-Panzer, vier Stummelbeine,
 * nickender Kopf, kleiner Schwanz; auf dem Panzer Mauerring mit Torbogen und
 * drei Türme verschiedener Höhe mit wippenden Fähnchen.
 */
export function buildWeltenschildkroete(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  // Bauch/Körper: flacher dunkler Sockel unter dem Panzer.
  b.blob(0, 0.42, 0, 0.95, 0.12, 0.28, 8, dark, null);
  // Panzer-Dom: Halbellipsoid mit angedeuteten Facetten-Platten.
  const latBands = 3;
  const lonBands = 8;
  const rx = 1.15;
  const rz = 0.85;
  const ry = 0.62;
  const at = (lat: number, lon: number): Vec => {
    const theta = (lat / latBands) * (Math.PI / 2);
    const phi = (lon / lonBands) * Math.PI * 2;
    return [rx * Math.sin(theta) * Math.cos(phi), 0.45 + ry * Math.cos(theta), rz * Math.sin(theta) * Math.sin(phi)];
  };
  for (let lat = 0; lat < latBands; lat++) {
    for (let lon = 0; lon < lonBands; lon++) {
      const plate = lat === latBands - 1 ? dark : (lat + lon) % 2 === 0 ? base : light;
      b.quad(at(lat, lon), at(lat, lon + 1), at(lat + 1, lon + 1), at(lat + 1, lon), plate, null);
    }
  }
  // Vier Stummelbeine mit hellen Füßen.
  const legs: readonly (readonly [number, number])[] = [
    [0.75, 0.62],
    [0.75, -0.62],
    [-0.72, 0.6],
    [-0.72, -0.6],
  ];
  for (const [lx, lz] of legs) {
    b.box(lx, 0.21, lz, 0.3, 0.42, 0.28, base, null);
    b.box(lx, 0.045, lz, 0.34, 0.09, 0.32, PAPER_DARK, null);
  }
  // Hals + Kopf vorn, langsames Kopf-Nicken über die anim-Amplitude.
  const nod: AnimFn = (p) => {
    const t = Math.max(0, p[0] - 0.95);
    return [0, 0.03 + t * 0.05, 0.01, 0.9 + t * 0.6];
  };
  b.tube([[0.95, 0.5, 0], [1.25, 0.6, 0], [1.45, 0.68, 0]], [0.17, 0.13, 0.1], 6, base, nod);
  b.blob(1.52, 0.72, 0, 0.17, 0.14, 0.12, 6, light, nod);
  b.box(1.62, 0.76, 0.08, 0.03, 0.03, 0.02, INK, nod);
  b.box(1.62, 0.76, -0.08, 0.03, 0.03, 0.02, INK, nod);
  // Kleiner Schwanz hinten.
  b.tube([[-0.95, 0.42, 0], [-1.2, 0.36, 0], [-1.34, 0.3, 0]], [0.1, 0.06, 0.02], 5, base, null);
  // ==== Schloss auf dem Panzer ====
  // Mauerring am Panzerrand, Zinnen über das Top-Jitter angedeutet.
  const wallJitter = [0, -0.06, 0, -0.06, 0, -0.06, 0, -0.06];
  b.column(0, 0.95, 0, 0.62, 0.58, 0.22, 8, PAPER_DARK, null, wallJitter);
  // Torbogen in der Mauer (zur Kopfseite).
  b.box(0.58, 1.02, 0, 0.08, 0.16, 0.14, INK, null);
  // Fähnchen wippen an den Turmspitzen.
  const flutter: AnimFn = (p) => [0, 0.02 + p[1] * 0.01, 0.04, 3 + p[0] * 4];
  const tower = (x: number, z: number, r: number, h: number, roofH: number, cloth: Rgb) => {
    b.column(x, 1.05, z, r, r * 0.85, h, 6, PAPER, null);
    if (roofH > 0) {
      b.column(x, 1.05 + h, z, r * 1.15, 0.02, roofH, 6, dark, null);
    } else {
      b.column(x, 1.05 + h, z, r * 1.05, r * 0.95, 0.08, 6, dark, null, [0, -0.05, 0, -0.05, 0, -0.05]);
    }
    const topY = 1.05 + h + Math.max(roofH, 0.08);
    b.box(x, topY + 0.08, z, 0.025, 0.16, 0.025, WOOD_DARK, null);
    b.quad([x, topY + 0.15, z], [x + 0.16, topY + 0.13, z], [x + 0.16, topY + 0.07, z], [x, topY + 0.09, z], cloth, flutter);
    b.quad([x, topY + 0.09, z], [x + 0.16, topY + 0.07, z], [x + 0.16, topY + 0.13, z], [x, topY + 0.15, z], cloth, flutter);
    b.box(x, 1.05 + h * 0.65, z + r * 0.92, 0.05, 0.09, 0.02, INK, null);
  };
  tower(0.18, 0.12, 0.16, 0.72, 0.22, TERRA_BAND);
  tower(-0.25, 0.25, 0.13, 0.5, 0.18, light);
  tower(-0.05, -0.3, 0.11, 0.38, 0, base);
  return b.finish(0.035);
}

/** Drachenschädel: gebleichter Schädel mit Hörnern und Zahnreihe. */
export function buildDrachenschaedel(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.blob(0, 0.4, 0, 0.45, 0.32, 0.28, 6, base, null);
  b.box(0.5, 0.32, 0, 0.6, 0.22, 0.34, light, null);
  b.box(0.5, 0.14, 0, 0.52, 0.1, 0.3, PAPER_DARK, null);
  b.box(0.24, 0.46, 0.2, 0.12, 0.12, 0.05, INK, null);
  b.box(0.24, 0.46, -0.2, 0.12, 0.12, 0.05, INK, null);
  b.box(0.76, 0.36, 0.1, 0.05, 0.05, 0.03, INK, null);
  for (let i = 0; i < 4; i++) {
    b.box(0.36 + i * 0.13, 0.22, 0.16, 0.04, 0.08, 0.03, PAPER, null);
    b.box(0.36 + i * 0.13, 0.22, -0.16, 0.04, 0.08, 0.03, PAPER, null);
  }
  b.tube([[-0.15, 0.6, 0.25], [-0.45, 0.85, 0.4], [-0.6, 1.05, 0.45]], [0.08, 0.05, 0.01], 5, dark, null);
  b.tube([[-0.15, 0.6, -0.25], [-0.45, 0.85, -0.4], [-0.6, 1.05, -0.45]], [0.08, 0.05, 0.01], 5, dark, null);
  return b.finish(0.025);
}

/** Schwebestein: Brockenstapel, der über Bodenschutt driftend schwebt. */
export function buildSchwebestein(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.blob(0, 0.08, 0, 0.3, 0.1, 0.05, 5, dark, null);
  b.box(0.27, 0.08, 0.15, 0.16, 0.14, 0.14, base, null);
  const drift1: AnimFn = () => [0.02, 0.05, 0.02, 0.8];
  const drift2: AnimFn = () => [0.03, 0.06, 0.02, 1.3];
  const drift3: AnimFn = () => [0.02, 0.07, 0.03, 1.7];
  b.blob(0, 0.62, 0, 0.42, 0.3, 0.26, 6, base, drift1);
  b.blob(0.1, 1.15, 0.05, 0.3, 0.22, 0.18, 5, light, drift2);
  b.blob(-0.06, 1.55, -0.04, 0.2, 0.15, 0.12, 5, dark, drift3);
  return b.finish(0.025);
}

/** Riesenschwert: schräg in den Boden gerammte Klinge mit Parier und Knauf. */
export function buildRiesenschwert(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.blob(0, 0.1, 0, 0.4, 0.14, 0.06, 6, dark, null);
  // Klinge entlang der Achse (0.28, 0.96), Breite entlang (-0.96, 0.28).
  const ux = 0.28;
  const uy = 0.96;
  const px = -0.96;
  const py = 0.28;
  const edge = (t: number, s: number): Vec => {
    const w = (0.17 - 0.12 * t) * s;
    return [t * 0.5 + px * w, 0.05 + t * 1.7 + py * w, 0];
  };
  for (const z of [0.02, -0.02]) {
    const flat = z > 0 ? base : light;
    b.quad(
      [edge(0, 1)[0], edge(0, 1)[1], z],
      [edge(1, 1)[0], edge(1, 1)[1], z],
      [edge(1, -1)[0], edge(1, -1)[1], z],
      [edge(0, -1)[0], edge(0, -1)[1], z],
      flat,
      null,
    );
    b.quad(
      [edge(0, -1)[0], edge(0, -1)[1], z],
      [edge(1, -1)[0], edge(1, -1)[1], z],
      [edge(1, 1)[0], edge(1, 1)[1], z],
      [edge(0, 1)[0], edge(0, 1)[1], z],
      flat,
      null,
    );
  }
  for (const s of [1, -1]) {
    b.quad(
      [edge(0, s)[0], edge(0, s)[1], 0.02 * s],
      [edge(1, s)[0], edge(1, s)[1], 0.02 * s],
      [edge(1, s)[0], edge(1, s)[1], -0.02 * s],
      [edge(0, s)[0], edge(0, s)[1], -0.02 * s],
      dark,
      null,
    );
  }
  b.tube([[0.5 + px * 0.32, 1.75 + py * 0.32, 0], [0.5 - px * 0.32, 1.75 - py * 0.32, 0]], [0.05, 0.05], 5, dark, null);
  b.tube([[0.5, 1.75, 0], [0.5 + ux * 0.3, 1.75 + uy * 0.3, 0]], [0.045, 0.04], 5, WOOD_DARK, null);
  b.blob(0.5 + ux * 0.38, 1.75 + uy * 0.38, 0, 0.07, 0.07, 0.06, 5, light, null);
  return b.finish(0.025);
}

/** Steinkreis: sechs Menhire im Ring um eine flache Altarplatte. */
export function buildSteinkreis(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const heights = [0.75, 0.6, 0.82, 0.55, 0.7, 0.62];
  const jitter = [0, -0.08, -0.02, -0.1];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const stone = i % 3 === 0 ? dark : i % 3 === 1 ? base : light;
    b.column(Math.cos(a) * 0.75, 0, Math.sin(a) * 0.75, 0.16, 0.11, heights[i], 4, stone, null, jitter);
  }
  b.box(0.75 * Math.cos(Math.PI / 6), 0.88, 0.75 * Math.sin(Math.PI / 6) - 0.37, 0.24, 0.14, 0.66, PAPER_DARK, null);
  b.box(0, 0.1, 0, 0.4, 0.2, 0.3, base, null);
  b.blob(0, 0.04, 0, 0.55, 0.05, 0.02, 6, PAPER_DARK, null);
  return b.finish(0.025);
}

/** Weltenauge: Sockelsäule mit schwebender, pulsierender Augen-Kugel. */
export function buildWeltenauge(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.box(0, 0.14, 0, 0.6, 0.28, 0.6, dark, null);
  b.column(0, 0.28, 0, 0.2, 0.12, 0.5, 6, base, null);
  const cy = 1.25;
  const orbPulse: AnimFn = (p) => {
    const dx = p[0];
    const dy = p[1] - cy;
    const dz = p[2];
    const r = Math.hypot(dx, dy, dz);
    if (r < 1e-6) return [0, 0.04, 0, 1.1];
    return [(dx / r) * 0.025, 0.04 + (dy / r) * 0.025, (dz / r) * 0.025, 1.1];
  };
  const latBands = 4;
  const lonBands = 6;
  const at = (lat: number, lon: number): Vec => {
    const theta = (lat / latBands) * Math.PI;
    const phi = (lon / lonBands) * Math.PI * 2;
    return [0.3 * Math.sin(theta) * Math.cos(phi), cy + 0.3 * Math.cos(theta), 0.3 * Math.sin(theta) * Math.sin(phi)];
  };
  for (let lat = 0; lat < latBands; lat++) {
    for (let lon = 0; lon < lonBands; lon++) {
      const facet = (lat + lon) % 2 === 0 ? light : base;
      b.quad(at(lat, lon), at(lat, lon + 1), at(lat + 1, lon + 1), at(lat + 1, lon), facet, orbPulse);
    }
  }
  b.box(0.29, cy, 0, 0.06, 0.16, 0.1, INK, orbPulse);
  return b.finish(0.025);
}

/** Himmelsleiter: spiralig aufsteigende Stufen, oben ausfransend. */
export function buildHimmelsleiter(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.column(0, 0, 0, 0.5, 0.42, 0.18, 7, dark, null);
  const steps = 14;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    if (i >= steps - 3 && i % 2 === 0) continue;
    const a = t * Math.PI * 2.6;
    const r = 0.42 - t * 0.1;
    const y = 0.2 + t * 1.9;
    const step = i % 3 === 0 ? light : i % 3 === 1 ? base : PAPER_DARK;
    const fray: AnimFn | null = t > 0.7 ? () => [0.02, 0.03, 0.02, 1.5 + t * 2] : null;
    b.box(Math.cos(a) * r, y, Math.sin(a) * r, 0.32 * (1 - t * 0.35), 0.05, 0.18 * (1 - t * 0.25), step, fray);
  }
  return b.finish(0.02);
}

/** Titanenhand: versteinerte Hand, die aus dem Boden greift. */
export function buildTitanenhand(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.blob(0, 0.25, 0, 0.55, 0.3, 0.2, 6, base, null);
  const heights = [1.0, 1.15, 1.05, 0.85];
  for (let i = 0; i < 4; i++) {
    const z = -0.33 + i * 0.22;
    const h = heights[i];
    b.tube([[0.3, 0.35, z], [0.5, h * 0.7, z], [0.42, h, z]], [0.11, 0.09, 0.05], 5, i % 2 === 0 ? base : light, null);
    b.box(0.32, 0.42, z, 0.14, 0.1, 0.12, dark, null);
  }
  b.tube([[-0.4, 0.3, 0.3], [-0.62, 0.55, 0.45], [-0.6, 0.75, 0.5]], [0.11, 0.08, 0.04], 5, dark, null);
  b.blob(0.1, 0.1, -0.5, 0.16, 0.1, 0.04, 5, PAPER_DARK, null);
  return b.finish(0.025);
}

/** Kristallportal: Bogen aus pulsierenden Prismen-Spitzen. */
export function buildKristallportal(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.box(0, 0.09, 0, 1.3, 0.18, 0.5, dark, null);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = Math.PI * (1 - t);
    const cx = Math.cos(a) * 0.6;
    const cyB = 0.18 + Math.sin(a) * 0.75;
    const apex: Vec = [cx + Math.cos(a) * 0.4, cyB + Math.sin(a) * 0.4, 0];
    const pulse: AnimFn = () => [Math.abs(Math.cos(a)) * 0.02 + 0.006, Math.sin(a) * 0.02 + 0.006, 0.008, 1.3 + t];
    const pts: Vec[] = [
      [cx - 0.09, cyB, 0.09],
      [cx + 0.09, cyB, 0.09],
      [cx + 0.09, cyB, -0.09],
      [cx - 0.09, cyB, -0.09],
    ];
    for (let k = 0; k < 4; k++) {
      const facet = k % 2 === 0 ? (i % 2 === 0 ? light : base) : dark;
      b.tri(pts[k], pts[(k + 1) % 4], apex, facet, pulse);
      b.tri(pts[(k + 1) % 4], pts[k], apex, facet, pulse);
    }
  }
  return b.finish(0.02);
}

/** Grabmal: Sarkophag auf Plattform, flankiert von zwei Stelen. */
export function buildGrabmal(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.box(0, 0.09, 0, 1.2, 0.18, 0.9, PAPER_DARK, null);
  b.box(0, 0.4, 0, 0.85, 0.45, 0.5, base, null);
  b.box(0, 0.68, 0, 0.95, 0.12, 0.6, dark, null);
  b.box(0, 0.78, 0, 0.6, 0.08, 0.35, light, null);
  b.column(-0.48, 0.18, -0.34, 0.09, 0.06, 0.85, 4, dark, null);
  b.column(0.48, 0.18, -0.34, 0.09, 0.06, 0.7, 4, base, null);
  b.box(0, 0.42, 0.26, 0.3, 0.16, 0.02, INK, null);
  b.box(-0.48, 0.7, -0.27, 0.04, 0.12, 0.02, INK, null);
  return b.finish(0.025);
}

/** Wurzelthron: Thron aus verwachsenen Wurzelsträngen. */
export function buildWurzelthron(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const micro: AnimFn = (p) => [0.003 * Math.max(0, p[1]), 0, 0.002, p[1] * 1.3];
  b.box(0, 0.3, 0, 0.6, 0.24, 0.5, WOOD_DARK, null);
  b.box(0, 0.44, 0, 0.52, 0.06, 0.44, base, null);
  const backHeights = [1.3, 1.55, 1.35];
  for (let i = 0; i < 3; i++) {
    const z = -0.18 + i * 0.18;
    const h = backHeights[i];
    b.tube([[-0.3, 0, z], [-0.36, h * 0.6, z * 0.8], [-0.24, h, z * 0.5]], [0.09, 0.07, 0.02], 5, i === 1 ? base : dark, micro);
  }
  b.tube([[0.28, 0, 0.32], [0.34, 0.5, 0.28], [0.2, 0.62, 0.22]], [0.07, 0.05, 0.02], 4, dark, micro);
  b.tube([[0.28, 0, -0.32], [0.34, 0.5, -0.28], [0.2, 0.62, -0.22]], [0.07, 0.05, 0.02], 4, dark, micro);
  b.tube([[0.2, 0.02, 0], [0.62, 0.06, 0.12], [0.85, 0.02, 0.08]], [0.06, 0.04, 0.01], 4, light, null);
  b.tube([[-0.2, 0.02, 0.3], [-0.5, 0.08, 0.55], [-0.7, 0.02, 0.6]], [0.06, 0.04, 0.01], 4, light, null);
  return b.finish(0.03);
}

/** Segelschiff: Zweimaster mit Rumpf, Achterkastell und Segeln — schaukelt. */
export function buildSegelschiff(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const rock: AnimFn = (p) => [p[1] * 0.025, p[0] * 0.05, 0, 1.0];
  const deckY = 0.34;
  const keelY = 0.1;
  const xw = 0.75;
  const zw = 0.24;
  const zk = zw * 0.6;
  b.quad([-xw, keelY, zk], [xw, keelY, zk], [xw, deckY, zw], [-xw, deckY, zw], base, rock);
  b.quad([xw, keelY, -zk], [-xw, keelY, -zk], [-xw, deckY, -zw], [xw, deckY, -zw], base, rock);
  b.quad([-xw, keelY, -zk], [xw, keelY, -zk], [xw, keelY, zk], [-xw, keelY, zk], dark, rock);
  b.quad([-xw, deckY, -zw], [xw, deckY, -zw], [xw, deckY, zw], [-xw, deckY, zw], dark, rock);
  const bow: Vec = [1.05, deckY + 0.06, 0];
  b.tri([xw, deckY, zw], [xw, keelY, zk], bow, base, rock);
  b.tri([xw, keelY, -zk], [xw, deckY, -zw], bow, base, rock);
  b.tri([xw, deckY, -zw], [xw, deckY, zw], bow, dark, rock);
  const stern: Vec = [-0.95, deckY + 0.04, 0];
  b.tri([-xw, keelY, zk], [-xw, deckY, zw], stern, base, rock);
  b.tri([-xw, deckY, -zw], [-xw, keelY, -zk], stern, base, rock);
  b.tri([-xw, deckY, zw], [-xw, deckY, -zw], stern, dark, rock);
  b.box(-0.6, 0.46, 0, 0.36, 0.24, 0.4, WOOD, rock);
  const sail: AnimFn = (p) => [p[1] * 0.025 + 0.02, p[0] * 0.05, 0.035, 1.3];
  b.box(0.3, 1.05, 0, 0.05, 1.5, 0.05, WOOD_DARK, rock);
  b.quad([0.27, 1.7, 0.02], [0.27, 0.95, 0.02], [-0.45, 0.9, 0.02], [-0.45, 1.5, 0.02], PAPER, sail);
  b.quad([-0.45, 1.5, 0.02], [-0.45, 0.9, 0.02], [0.27, 0.95, 0.02], [0.27, 1.7, 0.02], PAPER, sail);
  b.box(0.75, 0.85, 0, 0.04, 1.0, 0.04, WOOD_DARK, rock);
  b.tri([0.78, 1.3, 0.01], [0.78, 0.6, 0.01], [1.2, 0.66, 0.01], PAPER_DARK, sail);
  b.tri([1.2, 0.66, 0.01], [0.78, 0.6, 0.01], [0.78, 1.3, 0.01], PAPER_DARK, sail);
  b.quad([0.33, 1.78, 0], [0.55, 1.75, 0], [0.55, 1.66, 0], [0.33, 1.69, 0], light, sail);
  b.quad([0.33, 1.69, 0], [0.55, 1.66, 0], [0.55, 1.75, 0], [0.33, 1.78, 0], light, sail);
  return b.finish(0.03);
}

/** Fischerhütte: Pfahlbau mit Steg und ausgelegter Angelrute. */
export function buildFischerhuette(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base] = shades(tint);
  const piles: readonly (readonly [number, number])[] = [
    [-0.45, 0.3],
    [0.35, 0.3],
    [-0.45, -0.3],
    [0.35, -0.3],
    [0.8, 0.14],
    [0.8, -0.14],
  ];
  for (const [x, z] of piles) b.box(x, 0.22, z, 0.08, 0.44, 0.08, WOOD_DARK, null);
  b.box(-0.05, 0.47, 0, 0.95, 0.07, 0.8, WOOD, null);
  b.box(0.75, 0.47, 0, 0.7, 0.06, 0.4, WOOD, null);
  b.box(-0.1, 0.78, 0, 0.75, 0.56, 0.62, base, null);
  const y0 = 1.06;
  const y1 = 1.32;
  b.quad([-0.53, y0, 0.38], [0.33, y0, 0.38], [0.33, y1, 0], [-0.53, y1, 0], dark, null);
  b.quad([0.33, y0, -0.38], [-0.53, y0, -0.38], [-0.53, y1, 0], [0.33, y1, 0], dark, null);
  b.tri([0.33, y0, 0.38], [0.33, y0, -0.38], [0.33, y1, 0], PAPER_DARK, null);
  b.tri([-0.53, y0, -0.38], [-0.53, y0, 0.38], [-0.53, y1, 0], PAPER_DARK, null);
  b.box(0.05, 0.7, 0.32, 0.2, 0.4, 0.02, INK, null);
  const dangle: AnimFn = (p) => [0.02, 0.015, 0.02, 2 + p[0]];
  b.tube([[0.6, 0.55, 0.1], [1.0, 0.85, 0.14]], [0.02, 0.012], 4, WOOD_DARK, dangle);
  b.box(1.0, 0.68, 0.14, 0.015, 0.34, 0.015, PAPER_DARK, dangle);
  return b.finish(0.025);
}

/** Wrack: halb versunkener, schräg liegender Schiffsrumpf mit Maststumpf. */
export function buildWrack(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  // Rumpf schräg: Bug taucht auf, Heck versunken (unter y=0 abgeschnitten gedacht).
  const deck = (t: number) => 0.02 + t * 0.55;
  const zw = 0.24;
  for (let i = 0; i < 4; i++) {
    const t0 = i / 4;
    const t1 = (i + 1) / 4;
    const x0 = -0.55 + t0 * 1.25;
    const x1 = -0.55 + t1 * 1.25;
    if (i === 2) continue; // geborstene Planken — Lücke im Rumpf
    const plank = i % 2 === 0 ? base : dark;
    b.quad([x0, deck(t0), zw], [x1, deck(t1), zw], [x1, deck(t1) - 0.3, zw * 0.7], [x0, deck(t0) - 0.3, zw * 0.7], plank, null);
    b.quad([x1, deck(t1), -zw], [x0, deck(t0), -zw], [x0, deck(t0) - 0.3, -zw * 0.7], [x1, deck(t1) - 0.3, -zw * 0.7], plank, null);
    b.quad([x0, deck(t0), -zw], [x1, deck(t1), -zw], [x1, deck(t1), zw], [x0, deck(t0), zw], PAPER_DARK, null);
  }
  const bowTip: Vec = [0.95, 0.72, 0];
  b.tri([0.7, deck(1), zw], [0.7, deck(1) - 0.3, zw * 0.7], bowTip, base, null);
  b.tri([0.7, deck(1) - 0.3, -zw * 0.7], [0.7, deck(1), -zw], bowTip, base, null);
  b.tri([0.7, deck(1), -zw], [0.7, deck(1), zw], bowTip, dark, null);
  // Rippen im geborstenen Bereich.
  b.box(0.12, 0.18, 0.14, 0.04, 0.3, 0.04, WOOD_DARK, null);
  b.box(0.22, 0.22, -0.12, 0.04, 0.34, 0.04, WOOD_DARK, null);
  // Schräger Maststumpf mit Fetzensegel.
  b.tube([[0.35, 0.4, 0], [0.6, 0.95, 0.18]], [0.045, 0.03], 4, WOOD_DARK, null);
  const tatter: AnimFn = (p) => [0.03, 0.02, 0.04, 2.5 + p[1]];
  b.tri([0.55, 0.88, 0.15], [0.35, 0.62, 0.3], [0.5, 0.55, 0.22], light, tatter);
  b.tri([0.5, 0.55, 0.22], [0.35, 0.62, 0.3], [0.55, 0.88, 0.15], light, tatter);
  return b.finish(0.025);
}

/** Wasserfall: Kaskade über eine Felskante, Wasser schimmert, Gischt unten. */
export function buildWasserfall(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.box(0, 0.7, -0.32, 1.2, 1.4, 0.55, PAPER_DARK, null);
  b.box(0, 1.45, -0.38, 1.0, 0.16, 0.45, hex("#93744e"), null);
  b.box(-0.5, 0.35, 0.02, 0.24, 0.7, 0.3, hex("#7a5a3a"), null);
  const shimmer: AnimFn = (p) => [0.01, 0.02, 0.03, 3 + p[1] * 2];
  b.quad([-0.32, 1.45, -0.06], [0.32, 1.45, -0.06], [0.32, 0.02, 0.14], [-0.32, 0.02, 0.14], light, shimmer);
  b.quad([-0.32, 0.02, 0.14], [0.32, 0.02, 0.14], [0.32, 1.45, -0.06], [-0.32, 1.45, -0.06], light, shimmer);
  b.quad([-0.12, 1.46, -0.05], [0.12, 1.46, -0.05], [0.12, 0.03, 0.15], [-0.12, 0.03, 0.15], base, shimmer);
  b.quad([-0.12, 0.03, 0.15], [0.12, 0.03, 0.15], [0.12, 1.46, -0.05], [-0.12, 1.46, -0.05], base, shimmer);
  const mist: AnimFn = (p) => [0.03, 0.035, 0.03, 2 + p[0]];
  b.blob(0, 0.08, 0.3, 0.4, 0.1, 0.04, 6, dark, null);
  b.blob(-0.2, 0.1, 0.26, 0.14, 0.1, 0.05, 5, PAPER, mist);
  b.blob(0.22, 0.12, 0.3, 0.12, 0.09, 0.04, 5, PAPER, mist);
  return b.finish(0.025);
}

/** Floß: fünf zusammengebundene Stämme mit Querhölzern und Staken. */
export function buildFloss(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const bob: AnimFn = (p) => [0, 0.025, 0.01, 1.4 + p[0] * 1.2];
  for (let i = 0; i < 5; i++) {
    const z = -0.32 + i * 0.16;
    const log = i % 2 === 0 ? base : dark;
    b.box(0, 0.08, z, 0.95 - Math.abs(z) * 0.3, 0.12, 0.13, log, bob);
  }
  b.box(0, 0.17, 0, 0.14, 0.06, 0.72, light, bob);
  b.box(0.35, 0.17, 0, 0.14, 0.06, 0.72, light, bob);
  b.tube([[-0.2, 0.14, 0.1], [-0.5, 1.05, 0.22]], [0.03, 0.02], 4, WOOD_DARK, bob);
  b.blob(0.15, 0.24, -0.1, 0.12, 0.1, 0.02, 5, PAPER_DARK, bob);
  return b.finish(0.02);
}

/** Eisberg: schwimmende Facetten-Spitze aus Eis, hebt und senkt sich träge. */
export function buildEisberg(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const bob: AnimFn = () => [0.008, 0.03, 0.008, 0.7];
  b.blob(0, 0.12, 0, 0.72, 0.16, 0.1, 6, dark, bob);
  const jitter = [0, -0.18, -0.05, -0.3, -0.1, -0.22];
  b.column(0.05, 0.15, 0.05, 0.5, 0.04, 1.15, 6, light, bob, jitter);
  b.column(-0.35, 0.14, -0.15, 0.26, 0.03, 0.55, 5, base, bob, [0, -0.12, -0.04, -0.16, -0.08]);
  b.box(0.4, 0.3, 0.3, 0.2, 0.3, 0.18, base, bob);
  return b.finish(0.02);
}

/** Korallen: verästelte Stöcke mit Fächer — wiegt sich in der Strömung. */
export function buildKorallen(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.blob(0, 0.06, 0, 0.5, 0.08, 0.04, 6, PAPER_DARK, null);
  const current: AnimFn = (p) => [0.015 + p[1] * 0.03, 0, 0.02, 1.8 + p[1] * 1.5];
  const branch = (x: number, z: number, a: number, h: number, coral: Rgb) => {
    const ux = Math.cos(a) * 0.2;
    const uz = Math.sin(a) * 0.2;
    b.tube([[x, 0.05, z], [x + ux * 0.5, h * 0.55, z + uz * 0.5], [x + ux, h, z + uz]], [0.06, 0.045, 0.015], 4, coral, current);
    b.tube([[x + ux * 0.4, h * 0.45, z + uz * 0.4], [x + ux * 0.4 - uz, h * 0.8, z + uz * 0.4 + ux]], [0.035, 0.01], 4, coral, current);
  };
  branch(0, 0, 0.6, 0.72, base);
  branch(0.28, 0.14, 2.4, 0.55, dark);
  branch(-0.26, -0.08, 4.4, 0.6, light);
  // Fächerkoralle: flache Scheibe quer zur Strömung.
  for (let i = 0; i < 5; i++) {
    const a0 = 0.5 + (i / 5) * 2.2;
    const a1 = 0.5 + ((i + 1) / 5) * 2.2;
    const p0: Vec = [0.34 + Math.cos(a0) * 0.28, 0.14 + Math.sin(a0) * 0.28, -0.24];
    const p1: Vec = [0.34 + Math.cos(a1) * 0.28, 0.14 + Math.sin(a1) * 0.28, -0.24];
    const fan = i % 2 === 0 ? TERRA_BAND : base;
    b.tri(p0, p1, [0.34, 0.1, -0.24], fan, current);
    b.tri(p1, p0, [0.34, 0.1, -0.24], fan, current);
  }
  return b.finish(0.02);
}

/** Sternwarte: Rundbau mit Facetten-Kuppel, Spalt und Teleskopstutzen. */
export function buildSternwarte(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base] = shades(tint);
  b.column(0, 0, 0, 0.55, 0.48, 0.9, 8, PAPER, null);
  b.box(0, 0.3, 0.48, 0.22, 0.5, 0.04, INK, null);
  b.box(0.35, 0.55, 0.35, 0.14, 0.16, 0.02, base, null);
  const latBands = 2;
  const lonBands = 8;
  const at = (lat: number, lon: number): Vec => {
    const theta = (lat / latBands) * (Math.PI / 2);
    const phi = (lon / lonBands) * Math.PI * 2;
    return [0.5 * Math.sin(theta) * Math.cos(phi), 0.9 + 0.48 * Math.cos(theta), 0.5 * Math.sin(theta) * Math.sin(phi)];
  };
  for (let lat = 0; lat < latBands; lat++) {
    for (let lon = 0; lon < lonBands; lon++) {
      const facet = lon % 2 === 0 ? base : dark;
      b.quad(at(lat, lon), at(lat, lon + 1), at(lat + 1, lon + 1), at(lat + 1, lon), facet, null);
    }
  }
  b.box(0.02, 1.18, 0.3, 0.1, 0.34, 0.2, INK, null);
  b.tube([[0.05, 1.2, 0.1], [0.35, 1.62, 0.22]], [0.07, 0.05], 5, dark, null);
  return b.finish(0.025);
}

/** Heißluftballon: gestreifte Kugel mit Korb — schwebt und driftet (Basis y ≈ 0.5). */
export function buildBallon(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const drift: AnimFn = (p) => [0.05, 0.03, 0.04, 0.8 + p[1] * 0.1];
  const cy = 1.5;
  const latBands = 4;
  const lonBands = 8;
  const at = (lat: number, lon: number): Vec => {
    const theta = (lat / latBands) * Math.PI;
    const phi = (lon / lonBands) * Math.PI * 2;
    return [0.55 * Math.sin(theta) * Math.cos(phi), cy + 0.55 * Math.cos(theta), 0.55 * Math.sin(theta) * Math.sin(phi)];
  };
  for (let lat = 0; lat < latBands; lat++) {
    for (let lon = 0; lon < lonBands; lon++) {
      const stripe = lon % 2 === 0 ? (lat % 2 === 0 ? base : dark) : PAPER;
      b.quad(at(lat, lon), at(lat, lon + 1), at(lat + 1, lon + 1), at(lat + 1, lon), stripe, drift);
    }
  }
  b.column(0, 0.88, 0, 0.16, 0.2, 0.1, 6, light, drift);
  b.box(0, 0.62, 0, 0.3, 0.24, 0.3, WOOD, drift);
  const corners: readonly (readonly [number, number])[] = [
    [0.13, 0.13],
    [-0.13, 0.13],
    [0.13, -0.13],
    [-0.13, -0.13],
  ];
  for (const [x, z] of corners) b.tube([[x, 0.74, z], [x * 1.3, 0.96, z * 1.3]], [0.012, 0.012], 3, WOOD_DARK, drift);
  b.box(0.19, 0.6, 0, 0.06, 0.1, 0.06, PAPER_DARK, drift);
  b.box(-0.19, 0.6, 0, 0.06, 0.1, 0.06, PAPER_DARK, drift);
  return b.finish(0.025);
}

/** Sturmwolke: dunkle Wolkenballung mit Zickzack-Blitz — schwebt. */
export function buildSturmwolke(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  const float: AnimFn = (p) => [0.04, 0.03, 0.03, 0.6 + p[0] * 0.2];
  b.blob(0, 1.35, 0, 0.55, 0.3, 0.22, 6, dark, float);
  b.blob(0.42, 1.42, 0.1, 0.34, 0.24, 0.16, 5, base, float);
  b.blob(-0.4, 1.3, -0.08, 0.3, 0.2, 0.14, 5, dark, float);
  b.blob(0.05, 1.6, -0.05, 0.3, 0.2, 0.12, 5, base, float);
  const flash: AnimFn = () => [0.02, 0.04, 0.02, 5];
  const zig: readonly (readonly [number, number])[] = [
    [0.1, 1.12],
    [-0.05, 0.9],
    [0.12, 0.68],
    [0, 0.42],
  ];
  for (let i = 0; i < zig.length - 1; i++) {
    const [x0, y0] = zig[i];
    const [x1, y1] = zig[i + 1];
    b.quad([x0 - 0.04, y0, 0], [x0 + 0.04, y0, 0], [x1 + 0.04, y1, 0], [x1 - 0.04, y1, 0], light, flash);
    b.quad([x1 - 0.04, y1, 0], [x1 + 0.04, y1, 0], [x0 + 0.04, y0, 0], [x0 - 0.04, y0, 0], light, flash);
  }
  return b.finish(0.025);
}

/** Kometenstein: glühender Brocken mit Schweif — kreist wie Asteroid/Mond im Orbit. */
export function buildKometenstein(tint: InkTint): InkAssetData {
  const b = new Builder();
  const [dark, base, light] = shades(tint);
  b.blob(0, 0, 0, 0.42, 0.34, 0.36, 5, dark, null);
  b.box(0.15, 0.06, 0.1, 0.45, 0.4, 0.4, base, null);
  b.box(0.35, 0.12, -0.08, 0.14, 0.1, 0.1, light, null);
  b.box(0.1, -0.2, 0.2, 0.1, 0.08, 0.08, light, null);
  const flick: AnimFn = (p) => [0.02 + Math.max(0, -p[0]) * 0.03, 0.012, 0.02, 3 + p[0]];
  b.tri([-0.3, 0.16, 0.04], [-1.05, 0.32, 0.1], [-0.36, -0.04, 0.08], light, flick);
  b.tri([-0.36, -0.04, 0.08], [-1.05, 0.32, 0.1], [-0.3, 0.16, 0.04], light, flick);
  b.tri([-0.28, 0.06, -0.12], [-0.85, 0.05, -0.22], [-0.3, -0.1, -0.06], base, flick);
  b.tri([-0.3, -0.1, -0.06], [-0.85, 0.05, -0.22], [-0.28, 0.06, -0.12], base, flick);
  b.tri([-0.25, 0.2, -0.02], [-0.7, 0.4, -0.08], [-0.3, 0.08, -0.02], PAPER, flick);
  b.tri([-0.3, 0.08, -0.02], [-0.7, 0.4, -0.08], [-0.25, 0.2, -0.02], PAPER, flick);
  return b.finish(0.02);
}

/** Registry für assets-ink.ts — dort in BUILDERS eingemischt. */
export const INK_ASSET_BUILDERS_BATCH4B = {
  weltenschildkroete: buildWeltenschildkroete,
  drachenschaedel: buildDrachenschaedel,
  schwebestein: buildSchwebestein,
  riesenschwert: buildRiesenschwert,
  steinkreis: buildSteinkreis,
  weltenauge: buildWeltenauge,
  himmelsleiter: buildHimmelsleiter,
  titanenhand: buildTitanenhand,
  kristallportal: buildKristallportal,
  grabmal: buildGrabmal,
  wurzelthron: buildWurzelthron,
  segelschiff: buildSegelschiff,
  fischerhuette: buildFischerhuette,
  wrack: buildWrack,
  wasserfall: buildWasserfall,
  floss: buildFloss,
  eisberg: buildEisberg,
  korallen: buildKorallen,
  sternwarte: buildSternwarte,
  ballon: buildBallon,
  sturmwolke: buildSturmwolke,
  kometenstein: buildKometenstein,
} as const;
