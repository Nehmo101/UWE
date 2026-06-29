/**
 * Atlas World Builder — shared constants.
 *
 * These `const` enums mirror the Prisma enums defined in
 * `packages/database/prisma/schema.prisma` so that framework-agnostic code
 * (renderers, generators, tests) can reference them without a Prisma client
 * dependency.  Keep in sync with the schema enums.
 */

// ---------------------------------------------------------------------------
// AtlasNodeLevel
// ---------------------------------------------------------------------------

/**
 * Zoom / administrative hierarchy of an atlas node.
 *
 *   globe      — whole-world overview
 *   continent  — large landmass / sub-continent
 *   landscape  — region / biome / county
 *   city       — settlement / dungeon / building interior
 */
export const AtlasNodeLevel = {
  globe: "globe",
  continent: "continent",
  landscape: "landscape",
  city: "city",
} as const;

export type AtlasNodeLevel = (typeof AtlasNodeLevel)[keyof typeof AtlasNodeLevel];

// ---------------------------------------------------------------------------
// AtlasFeatureKind
// ---------------------------------------------------------------------------

/**
 * Semantic kind of a drawn feature on a map node.
 *
 *   region  — named area / territory outline
 *   river   — flowing waterway (open path)
 *   road    — travel route (open path)
 *   biome   — vegetation / climate zone fill
 *   relief  — elevation / mountain range
 *   label   — text annotation
 *   pin     — point-of-interest marker
 */
export const AtlasFeatureKind = {
  region: "region",
  river: "river",
  road: "road",
  biome: "biome",
  relief: "relief",
  label: "label",
  pin: "pin",
} as const;

export type AtlasFeatureKind = (typeof AtlasFeatureKind)[keyof typeof AtlasFeatureKind];

// ---------------------------------------------------------------------------
// AtlasLabelColor
// ---------------------------------------------------------------------------

export const AtlasLabelColor = {
  black: "black",
  red: "red",
} as const;

export type AtlasLabelColor = (typeof AtlasLabelColor)[keyof typeof AtlasLabelColor];

// ---------------------------------------------------------------------------
// AtlasPaletteSource
// ---------------------------------------------------------------------------

export const AtlasPaletteSource = {
  builtin: "builtin",
  ai: "ai",
  upload: "upload",
} as const;

export type AtlasPaletteSource =
  (typeof AtlasPaletteSource)[keyof typeof AtlasPaletteSource];

// ---------------------------------------------------------------------------
// AtlasPaletteReviewStatus
// ---------------------------------------------------------------------------

export const AtlasPaletteReviewStatus = {
  pending: "pending",
  approved: "approved",
} as const;

export type AtlasPaletteReviewStatus =
  (typeof AtlasPaletteReviewStatus)[keyof typeof AtlasPaletteReviewStatus];

// ---------------------------------------------------------------------------
// Draw layer ordering indices
// ---------------------------------------------------------------------------

/**
 * Canonical z-index values for each draw layer.
 * Higher numbers render on top.
 */
export const LAYER_Z: Record<string, number> = {
  background: 0,
  biome: 10,
  relief: 20,
  rivers: 30,
  roads: 40,
  objects: 50,
  labels: 60,
  overlay: 70,
} as const;
