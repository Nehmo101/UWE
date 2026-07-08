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
// Additional presets (Theme-System, Roadmap Welle 3 #6)
// ---------------------------------------------------------------------------

/** "pergament-klassik" — brighter, neutral parchment with blue waterways. */
export const PARCHMENT_CLASSIC: AtlasStylePreset = {
  id: "pergament-klassik",
  label: "Pergament Klassik",
  description:
    "Helles, neutrales Pergament mit blauen Wasserwegen und warmem Braun — der zeitlose Schulatlas-Look.",
  colors: {
    parchment: "#f6efdb",
    ink: "#2b2118",
    inkAccent: "#3f6f9a",
    water: "#9dc0d6",
    land: "#efe6c8",
    forest: "#557347",
    mountain: "#8a7a5e",
    road: "#7a5a34",
  },
  typography: { ...TOLKIEN_INK.typography },
  decorations: { ...TOLKIEN_INK.decorations },
} as const;

/** "nachtkarte" — dark chart with pale ink, for star-lit war rooms. */
export const NIGHT_CHART: AtlasStylePreset = {
  id: "nachtkarte",
  label: "Nachtkarte",
  description:
    "Dunkles Kartenblatt mit heller Tinte und kühlem Wasser — Kriegsrat bei Kerzenlicht.",
  colors: {
    parchment: "#232732",
    ink: "#e6e2d2",
    inkAccent: "#d9a44a",
    water: "#3d5a74",
    land: "#2c313e",
    forest: "#3d5a45",
    mountain: "#5a5a68",
    road: "#a08a63",
  },
  typography: { ...TOLKIEN_INK.typography },
  decorations: { ...TOLKIEN_INK.decorations },
} as const;

/** "winterfeldzug" — cold, desaturated palette with icy water. */
export const WINTER_CAMPAIGN: AtlasStylePreset = {
  id: "winterfeldzug",
  label: "Winterfeldzug",
  description:
    "Kalte, entsättigte Töne, eisiges Wasser und schneegraues Land — Kampagnen im tiefen Winter.",
  colors: {
    parchment: "#eef0ee",
    ink: "#2a303a",
    inkAccent: "#8a3a2a",
    water: "#a9c6d9",
    land: "#e2e7e4",
    forest: "#4f6a58",
    mountain: "#8b93a0",
    road: "#6f6354",
  },
  typography: { ...TOLKIEN_INK.typography },
  decorations: { ...TOLKIEN_INK.decorations, scaleUnit: "days" },
} as const;

// ---------------------------------------------------------------------------
// Preset registry
// ---------------------------------------------------------------------------

/** All built-in style presets indexed by their `id`. */
export const STYLE_PRESETS: Record<string, AtlasStylePreset> = {
  [TOLKIEN_INK.id]: TOLKIEN_INK,
  [PARCHMENT_CLASSIC.id]: PARCHMENT_CLASSIC,
  [NIGHT_CHART.id]: NIGHT_CHART,
  [WINTER_CAMPAIGN.id]: WINTER_CAMPAIGN,
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
