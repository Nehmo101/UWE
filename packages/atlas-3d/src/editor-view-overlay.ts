/**
 * View overlays ("Ansicht") — temporäre Splat-Ableitungen für Klima- und
 * Höhen-Bänder. Reine Vorschau: der Original-Splat bleibt unberührt, der
 * Editor rendert mit dem abgeleiteten Grid, ohne zu committen.
 *
 * Deterministisch: gleiche Höhenfunktion → gleiche Bänder (kein Noise).
 * Biome-Indizes folgen ATLAS3D_BIOMES (splat.ts):
 * 1 Wiese · 3 Wüste · 4 Fels · 5 Schnee · 6 Wasser.
 */

import type { Vec3 } from "@uwe/atlas-editor/carve";
import { createSplat, type SplatGrid } from "./splat";

export type Atlas3DViewOverlay = "karte" | "klima" | "hoehe";

export interface OverlaySplatOptions {
  mode: "globe" | "terrain";
  overlay: "klima" | "hoehe";
  /** Dimensions of the node's splat grid (the overlay mirrors them). */
  width: number;
  height: number;
  /** Terrain: map half-extent; ignored on the globe. */
  mapSize: number;
  waterLevel: number;
  /** Terrain-mode surface height at map coordinates. */
  heightAt?: (x: number, z: number) => number;
  /** Globe-mode elevation along a unit direction. */
  elevationAt?: (dir: Vec3) => number;
}

/** Equirect direction for a splat texel (matches biome-derive's convention). */
function texelDir(u: number, v: number): Vec3 {
  const lat = v * Math.PI;
  const lon = (u - 0.5) * Math.PI * 2;
  return [Math.sin(lat) * Math.cos(lon), Math.cos(lat), Math.sin(lat) * Math.sin(lon)];
}

/** Klima: kalt → Schnee (5), mittel → Wiese (1), warm → Wüste (3). */
function classifyClimate(cold: number): number {
  if (cold >= 0.55) return 5;
  if (cold <= 0.25) return 3;
  return 1;
}

/** Höhe: tief → Wasser (6), mittel → Wiese (1), hoch → Fels (4), sehr hoch → Schnee (5). */
function classifyElevation(relative: number): number {
  if (relative <= 0) return 6;
  if (relative <= 0.08) return 1;
  if (relative <= 0.16) return 4;
  return 5;
}

/**
 * Build the temporary overlay splat. Climate uses the same cold metric as the
 * biome derivation (latitude × elevation on the globe, elevation-only on flat
 * levels) without the moisture noise; elevation banding is relative to the
 * water level.
 */
export function buildOverlaySplat(options: OverlaySplatOptions): SplatGrid {
  const { mode, overlay, width, height, mapSize, waterLevel } = options;
  const splat = createSplat(width, height);
  for (let y = 0; y < height; y++) {
    const v = height > 1 ? y / (height - 1) : 0.5;
    for (let x = 0; x < width; x++) {
      let elevation: number;
      let latitudeCold = 0;
      if (mode === "globe") {
        const u = x / width;
        elevation = options.elevationAt?.(texelDir(u, v)) ?? 0;
        latitudeCold = Math.abs(v - 0.5) * 2;
      } else {
        const u = width > 1 ? x / (width - 1) : 0.5;
        const mx = (u * 2 - 1) * mapSize;
        const mz = (v * 2 - 1) * mapSize;
        elevation = options.heightAt?.(mx, mz) ?? 0;
      }
      const relative = elevation - waterLevel;
      const cold = mode === "globe" ? latitudeCold * 0.85 + Math.max(0, elevation) * 1.6 : Math.max(0, relative) * 2.2;
      splat.data[y * width + x] = overlay === "klima" ? classifyClimate(cold) : classifyElevation(relative);
    }
  }
  return splat;
}
