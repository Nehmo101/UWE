/**
 * Klima-Bänder (Roadmap W4 #22) — statische Breitengrad-Zonen von arktisch
 * (oben) bis tropisch (unten). Reine Daten + Mapping-Helfer; das Overlay
 * zeichnen die Renderer selbst (horizontale Bänder mit Zonenfarbe).
 * Später füttert dies Biom-Vorschläge und die Reiseplaner-Etappenkosten.
 */

export interface ClimateZone {
  key: string;
  /** German display label. */
  label: string;
  /** Low-alpha overlay fill for the band. */
  color: string;
}

/** Ordered north → south (normalised y 0 → 1). */
export const CLIMATE_ZONES: readonly ClimateZone[] = [
  { key: "arktisch", label: "Arktisch", color: "rgba(190,215,235,0.28)" },
  { key: "kalt", label: "Kalt-gemäßigt", color: "rgba(160,200,190,0.20)" },
  { key: "gemaessigt", label: "Gemäßigt", color: "rgba(150,190,120,0.16)" },
  { key: "subtropisch", label: "Subtropisch", color: "rgba(215,190,110,0.18)" },
  { key: "tropisch", label: "Tropisch", color: "rgba(200,150,90,0.22)" },
];

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Zone at normalised latitude `ny` (0 = north pole edge, 1 = south edge). */
export function climateZoneAt(ny: number): ClimateZone {
  const idx = Math.min(
    CLIMATE_ZONES.length - 1,
    Math.floor(clamp01(ny) * CLIMATE_ZONES.length),
  );
  return CLIMATE_ZONES[idx]!;
}

export interface ClimateBand {
  zone: ClimateZone;
  /** Normalised band top/bottom (y0 < y1). */
  y0: number;
  y1: number;
}

/** Equal-height latitude bands covering [0, 1] — one per zone, in order. */
export function climateBands(): ClimateBand[] {
  const n = CLIMATE_ZONES.length;
  return CLIMATE_ZONES.map((zone, i) => ({ zone, y0: i / n, y1: (i + 1) / n }));
}
