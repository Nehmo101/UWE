/**
 * Atlas style preset definitions.
 *
 * Presets are plain-data constant objects (no React, no Canvas APIs).
 * They are consumed by the Studio editor and future renderer backends.
 *
 * Each preset implements `AtlasStylePreset`.
 */

// ---------------------------------------------------------------------------
// Style preset type contract
// ---------------------------------------------------------------------------

/** CSS/SVG-compatible colour string, e.g. "#3a2d1a" or "rgba(0,0,0,0.8)". */
export type CssColor = string;

/** Font family stack string, e.g. "Uncial Antiqua, serif". */
export type FontStack = string;

/** Scale bar display unit for the map legend. */
export type ScaleUnit = "km" | "mi" | "leagues" | "hexes" | "days";

export interface AtlasStylePreset {
  /** Unique slug used as `AtlasMap.stylePreset` value. */
  id: string;
  /** Human-readable display name. */
  label: string;
  /** Short prose description shown in the preset picker. */
  description: string;

  colors: {
    /** Parchment / background fill. */
    parchment: CssColor;
    /** Primary ink — outlines, text, roads. */
    ink: CssColor;
    /** Accent ink — rivers, named locations, emphasis. */
    inkAccent: CssColor;
    /** Water bodies fill. */
    water: CssColor;
    /** Land base fill (overlaid on parchment). */
    land: CssColor;
    /** Forest / woodland fill. */
    forest: CssColor;
    /** Mountain / relief shading tint. */
    mountain: CssColor;
    /** Road stroke colour. */
    road: CssColor;
  };

  typography: {
    /** Font stack for region / area labels. */
    labelRegion: FontStack;
    /** Font stack for city / settlement labels. */
    labelCity: FontStack;
    /** Font stack for map title / chapter header. */
    title: FontStack;
    /** Base label font size in px (canvas-space). */
    baseSizePx: number;
  };

  decorations: {
    /** Whether to render a compass rose. */
    compassRose: boolean;
    /** Compass rose orientation offset in degrees (0 = north up). */
    compassOffsetDeg: number;
    /** Whether to render a scale bar. */
    scaleBar: boolean;
    /** Default unit for scale bar legend. */
    scaleUnit: ScaleUnit;
    /** Stroke width multiplier applied to all ink lines. */
    lineWeightScale: number;
  };
}

// ---------------------------------------------------------------------------
// Tolkien-Ink preset
// ---------------------------------------------------------------------------

/**
 * "tolkien-ink" — hand-drawn parchment map in the style of classic fantasy
 * cartography: aged parchment background, black and red ink, Uncial lettering.
 */
export const TOLKIEN_INK: AtlasStylePreset = {
  id: "tolkien-ink",
  label: "Tolkien Ink",
  description:
    "Aged parchment with black and red calligraphic ink — classic fantasy hand-drawn cartography.",

  colors: {
    parchment: "#f2e8c9",
    ink: "#1a1008",
    inkAccent: "#8b1a10",
    water: "#a8c4d4",
    land: "#e8ddb5",
    forest: "#4a6741",
    mountain: "#7a6b52",
    road: "#6b4a2a",
  },

  typography: {
    labelRegion: "Uncial Antiqua, Cinzel Decorative, serif",
    labelCity: "MedievalSharp, IM Fell English, serif",
    title: "Uncial Antiqua, Cinzel Decorative, serif",
    baseSizePx: 14,
  },

  decorations: {
    compassRose: true,
    compassOffsetDeg: 0,
    scaleBar: true,
    scaleUnit: "leagues",
    lineWeightScale: 1.0,
  },
} as const;

// ---------------------------------------------------------------------------
// Preset registry
// ---------------------------------------------------------------------------

/** All built-in style presets indexed by their `id`. */
export const STYLE_PRESETS: Record<string, AtlasStylePreset> = {
  [TOLKIEN_INK.id]: TOLKIEN_INK,
} as const;

/**
 * Resolve a preset by id, falling back to `tolkien-ink` when unknown.
 */
export function resolveStylePreset(id: string | null | undefined): AtlasStylePreset {
  if (id && id in STYLE_PRESETS) {
    return STYLE_PRESETS[id]!;
  }
  return TOLKIEN_INK;
}
