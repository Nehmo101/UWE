// Farb-, Geometrie- und Cache-Helfer der Nachbarschafts-Graph-Engine.
//
// Aus `graph-engine.ts` herausgezogen (Modul-Disziplin: Monolith nicht anbauen).
// Reine, zustandslose Funktionen — Verhalten unverändert.

import type { GraphNodeCategory } from "@uwe/database/graph-types";

const POSITION_CACHE_LIMIT = 6000; // Positions-Cache jenseits dieser Koordinaten verwerfen

/**
 * Erdige Parchment-Palette (Design-Handoff). Wird als Fallback benutzt, wenn kein
 * `--uwe-graph-<kategorie>`-Token gesetzt ist. Zur Laufzeit werden diese Werte aus
 * `getComputedStyle` gelesen, damit der Graph über alle Themes mitzieht.
 */
export const GRAPH_CATEGORY_COLORS: Record<GraphNodeCategory, string> = {
  npc: "#c76b52",
  location: "#2f7d6e",
  faction: "#b08322",
  session: "#4f6d94",
  dungeon: "#7a5480",
  item: "#c78a3e",
  lore: "#6f7d5c",
  quest: "#b8462c",
  handout: "#4d8a9e",
};

/** Strukturelle Canvas-Farben (Fallbacks aus dem Parchment-OS-Handoff). */
export interface ChromeColors {
  ground: string; // Pergament-Grund
  ring: string; // Trennring um Knoten (Grundfarbe)
  ink: string; // Tinten-Kontur / selektiertes Label
  labelText: string; // Label-Text (nicht selektiert)
  labelHalo: string; // Label-Hintergrund
  accent: string; // radialer Wash, Minimap-Viewport, GM-Sichtbarkeits-Dot
  dmOnly: string; // Nur-GM-Sichtbarkeit (Dot)
  grid: string; // Punkteraster
}

export const CHROME_FALLBACK: ChromeColors = {
  ground: "#f1e8d4",
  ring: "#f1e8d4",
  ink: "#211d17",
  labelText: "#3d3832",
  labelHalo: "rgba(241,232,212,0.82)",
  accent: "#c2622b",
  dmOnly: "#c2622b",
  grid: "rgba(33,29,23,0.08)",
};

export const CANVAS_FONT = 'ui-monospace, "Space Mono", "Cascadia Code", Consolas, monospace';

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function capVector(fx: number, fy: number, max: number): [number, number] {
  const mag = Math.hypot(fx, fy);
  if (mag <= max) return [fx, fy];
  const scale = max / mag;
  return [fx * scale, fy * scale];
}

/** Positions-Cache aus Remounts/Rebuilds auf Plausibilität prüfen. */
export function isGraphPositionCacheValid(
  cache: Record<string, { x: number; y: number }>,
  nodeIds: Iterable<string>,
): boolean {
  for (const id of nodeIds) {
    const p = cache[id];
    if (!p) continue;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
    if (Math.abs(p.x) > POSITION_CACHE_LIMIT || Math.abs(p.y) > POSITION_CACHE_LIMIT) {
      return false;
    }
  }
  return true;
}

/** Parse `#rgb`/`#rrggbb`/`rgb()`/`rgba()` in `[r,g,b]`; null bei Unbekanntem. */
function parseRgb(color: string): [number, number, number] | null {
  const c = color.trim();
  if (c.startsWith("#")) {
    let h = c.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length < 6) return null;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return [r, g, b];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(",").map((p) => parseFloat(p));
    if (parts.length >= 3 && parts.slice(0, 3).every((n) => !Number.isNaN(n))) {
      return [parts[0], parts[1], parts[2]];
    }
  }
  return null;
}

/** Farbe mit Alpha versehen; funktioniert für Hex und rgb()/rgba(). */
export function withAlpha(color: string, a: number): string {
  const rgb = parseRgb(color);
  if (!rgb) return color;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}
