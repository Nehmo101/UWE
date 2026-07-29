/**
 * Umrechnung der Modell-Boxen in Pixel. Unlimited-OCR gibt Koordinaten in einem
 * normierten Raster aus (0–999, seitenrelativ), nicht in Pixeln der gerenderten
 * Seite — ohne Umrechnung liegt jeder Zuschnitt falsch.
 */

import type { DetectionBox } from "./markers";

/** Kantenlänge des normierten Koordinatenrasters des Modells. */
export const MODEL_COORDINATE_SPACE = 1000;

export interface PixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Kleinster sinnvoller Zuschnitt — darunter ist es Deko, kein Bild. */
export const MIN_CROP_PIXELS = 48;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Rechnet eine Modell-Box auf die Pixelmaße der gerenderten Seite um und
 * beschneidet sie auf die Seitenfläche. Gibt `null` zurück, wenn der Zuschnitt
 * nach dem Beschneiden zu klein zum Speichern wäre.
 */
export function boxToPixelRect(
  box: DetectionBox,
  page: { width: number; height: number },
  options: { coordinateSpace?: number; minPixels?: number } = {},
): PixelRect | null {
  const space = options.coordinateSpace ?? MODEL_COORDINATE_SPACE;
  const minPixels = options.minPixels ?? MIN_CROP_PIXELS;
  if (page.width <= 0 || page.height <= 0 || space <= 0) {
    return null;
  }

  const left = clamp(Math.round((box.x1 / space) * page.width), 0, page.width);
  const top = clamp(Math.round((box.y1 / space) * page.height), 0, page.height);
  const right = clamp(Math.round((box.x2 / space) * page.width), 0, page.width);
  const bottom = clamp(Math.round((box.y2 / space) * page.height), 0, page.height);

  const width = right - left;
  const height = bottom - top;
  if (width < minPixels || height < minPixels) {
    return null;
  }
  return { left, top, width, height };
}

/**
 * Typen, deren Zuschnitt sich lohnt. Textblöcke und Überschriften stehen
 * bereits im Markdown — sie als Bild zu speichern wäre nur Ballast.
 */
const CROPPABLE_TYPES = new Set(["figure", "image", "picture", "map", "chart", "diagram"]);

export function isCroppableRegionType(type: string): boolean {
  return CROPPABLE_TYPES.has(type.trim().toLowerCase());
}
