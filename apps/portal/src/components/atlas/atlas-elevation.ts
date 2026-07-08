/**
 * Höhen-Rendering (2.5D) für den Portal-Atlas-Viewer.
 *
 * Kapselt Hillshade-Overlay, Konturlinien, Objekt-Bodenschatten und Parallax
 * auf Basis der puren Engine in `@uwe/atlas/elevation`, damit AtlasViewer.tsx
 * pro Integrationspunkt nur 1–4 Zeilen braucht (File-Size-Budget).
 *
 * Cache-Strategie: Hillshade-Canvas und Konturlinien werden per
 * Referenzvergleich auf `tileLayer.elevation` (plus Kontur-Schrittzahl)
 * invalidiert — bei Pan/Zoom ändert sich nur das Ziel-Rect, nicht der Cache.
 */

import {
  sampleElevation,
  sampleElevationAlongPath,
  hasElevation,
  buildHillshadeRGBA,
  buildContourLines,
  parallaxCanvasOffset,
  elevationShadowOffset,
  DEFAULT_PARALLAX_STRENGTH,
  DEFAULT_CONTOUR_STEPS,
  type ContourLine,
} from "@uwe/atlas/elevation";
import { createHillshadeCanvas } from "@uwe/atlas/canvas-render";

/** Minimale tileLayer-Form, die das Höhen-Rendering braucht. */
export interface ElevationTileLayer {
  cols: number;
  rows: number;
  /** Sparse `"col,row"` → Höhe [0,1]; fehlende Zellen = 0. */
  elevation?: Record<string, number> | null;
  /** Parallax-Stärke pro Karte [0,1]; undefined ⇒ Default, 0 = aus. */
  parallaxStrength?: number | null;
  contoursEnabled?: boolean | null;
  contourSteps?: number | null;
  /** Globale Lichtrichtung (W3 #7); undefined ⇒ "nw" wie bisher. */
  lightDir?: string | null;
}

/** Unterhalb dieser Höhe gibt es weder Schatten noch Parallax. */
const MIN_VISIBLE_ELEVATION = 0.02;

type W2C = (nx: number, ny: number) => [number, number];

/** Render-Cache für Hillshade + Konturen; in einem useRef halten. */
export interface ElevationRenderCache {
  /** Referenz des elevation-Records, für den die Caches gebaut wurden. */
  key: Record<string, number> | null | undefined;
  lightDir: string;
  hillshade: HTMLCanvasElement | null;
  contours: ContourLine[] | null;
  contourSteps: number;
}

export function createElevationCache(): ElevationRenderCache {
  return { key: undefined, lightDir: "nw", hillshade: null, contours: null, contourSteps: 0 };
}

/**
 * Zeichnet das Hillshade-Overlay (gestreckt über das Karten-Rect) und —
 * falls aktiviert — die Konturlinien. No-op ohne Höhenfeld.
 */
export function drawElevationOverlays(
  ctx: CanvasRenderingContext2D,
  tileLayer: ElevationTileLayer,
  w2c: W2C,
  zoom: number,
  cache: ElevationRenderCache,
  inkColor: string,
): void {
  if (!hasElevation(tileLayer)) return;

  const lightDir = tileLayer.lightDir ?? "nw";
  if (cache.key !== tileLayer.elevation || cache.lightDir !== lightDir) {
    cache.key = tileLayer.elevation;
    cache.lightDir = lightDir;
    cache.hillshade = createHillshadeCanvas(
      buildHillshadeRGBA(tileLayer, { lightDir }),
      tileLayer.cols,
      tileLayer.rows,
    );
    cache.contours = null;
  }

  // Hillshade: winziges Grid-Canvas über die ganze Karte strecken; der
  // bilineare Filter des Browsers macht daraus eine weiche Schattierung.
  if (cache.hillshade) {
    const [x0, y0] = w2c(0, 0);
    const [x1, y1] = w2c(1, 1);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(cache.hillshade, x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
  }

  if (!tileLayer.contoursEnabled) return;
  const steps = tileLayer.contourSteps ?? DEFAULT_CONTOUR_STEPS;
  if (!cache.contours || cache.contourSteps !== steps) {
    cache.contours = buildContourLines(tileLayer, steps);
    cache.contourSteps = steps;
  }

  ctx.save();
  ctx.strokeStyle = inkColor;
  ctx.globalAlpha = 0.45;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const line of cache.contours) {
    if (line.points.length < 2) continue;
    ctx.lineWidth = (line.major ? 1.6 : 0.9) * zoom;
    ctx.beginPath();
    const [sx, sy] = w2c(line.points[0]![0], line.points[0]![1]);
    ctx.moveTo(sx, sy);
    for (let i = 1; i < line.points.length; i++) {
      const [px, py] = w2c(line.points[i]![0], line.points[i]![1]);
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Höhe eines Objekts: expliziter Style-Wert vor Feldabtastung an der
 * Boden-Position. 0 ohne tileLayer.
 */
export function resolveObjectElevation(
  tileLayer: ElevationTileLayer | null | undefined,
  obj: { x: number; y: number; style?: { elevation?: number | null } | null },
): number {
  const styleElevation = obj.style?.elevation;
  if (typeof styleElevation === "number" && Number.isFinite(styleElevation)) {
    return Math.max(0, Math.min(1, styleElevation));
  }
  return tileLayer ? sampleElevation(tileLayer, obj.x, obj.y) : 0;
}

/**
 * Weicher elliptischer Bodenschatten, geworfen entgegen der Karten-
 * Lichtrichtung (Default NW-Licht ⇒ Schatten nach Südosten) — VOR dem
 * Objekt zeichnen. No-op für flache Objekte.
 */
export function drawObjectElevationShadow(
  ctx: CanvasRenderingContext2D,
  e: number,
  ox: number,
  oy: number,
  size: number,
  zoom: number,
  lightDir?: string | null,
): void {
  if (!(e > MIN_VISIBLE_ELEVATION)) return;
  const [dx, dy] = elevationShadowOffset(e, zoom, lightDir ?? undefined);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(ox + dx, oy + dy, size * 0.45, size * 0.28, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(26,16,8,${0.10 + 0.15 * e})`;
  ctx.fill();
  ctx.restore();
}

/**
 * Parallax-Versatz (Canvas-Pixel) für ein Objekt auf Höhe `e`. Rein visuell —
 * das Hit-Testing bleibt an der Boden-Position (taktischer Anker).
 */
export function objectParallax(
  tileLayer: ElevationTileLayer | null | undefined,
  e: number,
  ox: number,
  oy: number,
  canvasW: number,
  canvasH: number,
): [number, number] {
  if (!(e > MIN_VISIBLE_ELEVATION)) return [0, 0];
  const strength = tileLayer?.parallaxStrength ?? DEFAULT_PARALLAX_STRENGTH;
  return parallaxCanvasOffset(e, ox, oy, canvasW / 2, canvasH / 2, strength);
}

/**
 * Höhen entlang eines Pfads für `scatterGlyphsAlongPath`-Kopplung;
 * `undefined` ohne Höhenfeld (Verhalten dann exakt wie bisher).
 */
export function elevationPathHeights(
  tileLayer: ElevationTileLayer | null | undefined,
  coords: readonly [number, number][],
): number[] | undefined {
  if (!tileLayer || !hasElevation(tileLayer)) return undefined;
  return sampleElevationAlongPath(tileLayer, coords);
}
