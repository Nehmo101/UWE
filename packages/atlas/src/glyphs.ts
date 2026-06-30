/**
 * Atlas World Builder — canonical builtin pictogram (glyph) registry.
 *
 * SINGLE SOURCE OF TRUTH for every builtin map stamp / pictogram. Every
 * consumer (Studio editor palette, Portal read-only viewer, the static HTML
 * export viewer, and the `@uwe/database` builtin-palette seed) imports from
 * here, so adding one entry below makes the pictogram available everywhere
 * automatically — no per-app duplication.
 *
 * Design rules (see `docs/prompts/atlas-pictogram-styleguide.md`):
 *   - Hand-drawn ink cartography look: stroke-only outlines, never filled.
 *   - Drawn in a 24×24 viewBox; structures rest on the ~y=21 baseline.
 *   - `pathData` uses only absolute `M L H V Q C Z` commands, one segment per
 *     command, because the Canvas2D path parser in the renderers is minimal.
 *   - `color` is a muted earth/ink tone that fits parchment.
 *
 * Framework-agnostic: no DOM, React, or Prisma imports.
 */

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/**
 * Pictogram category. Mirrors the `kind` stored on builtin `AtlasPaletteItem`
 * rows. These are the "Atlas-Kategorien" the palette groups glyphs by.
 */
export type AtlasGlyphCategory = "relief" | "biome" | "pin";

export interface AtlasGlyphCategoryInfo {
  key: AtlasGlyphCategory;
  /** German display label used in palette headers and the styleguide. */
  label: string;
  /** Short description of what belongs in this category. */
  description: string;
}

/**
 * Ordered category metadata. The palette and styleguide iterate this list so
 * categories always render in a stable, intentional order.
 */
export const ATLAS_GLYPH_CATEGORIES: readonly AtlasGlyphCategoryInfo[] = [
  {
    key: "relief",
    label: "Relief",
    description: "Höhen & Landformen — Berge, Hügel, Vulkane, Klippen.",
  },
  {
    key: "biome",
    label: "Biom",
    description: "Vegetation & Gewässer — Wälder, Grasland, Sümpfe, Wüsten, Seen.",
  },
  {
    key: "pin",
    label: "Marker",
    description: "Orte & Bauwerke — Städte, Burgen, Türme, Brücken, Tempel.",
  },
] as const;

// ---------------------------------------------------------------------------
// Glyph type
// ---------------------------------------------------------------------------

export interface BuiltinGlyph {
  /** Stable key persisted as `AtlasPaletteItem.builtinGlyphKey`. Never rename. */
  key: string;
  /** German display name (palette tooltip / label, DB `name`). */
  name: string;
  /** Pictogram category (DB `kind`). */
  kind: AtlasGlyphCategory;
  /** SVG path data — drawn centred in a 24×24 viewBox, stroked (never filled). */
  pathData: string;
  /** Stroke colour (muted earth/ink tone). */
  color: string;
}

// ---------------------------------------------------------------------------
// Canonical registry
// ---------------------------------------------------------------------------

/**
 * The canonical, ordered builtin pictogram set, grouped by category.
 *
 * To add a pictogram: append an entry to the matching category block with a
 * unique `key`, a German `name`, the correct `kind`, stroke-only `pathData`
 * (24×24, absolute commands), and a fitting `color`. It is then immediately
 * usable in the editor, portal, static export, and seeded into the DB.
 */
export const BUILTIN_GLYPHS: readonly BuiltinGlyph[] = [
  // --- Relief — Höhen & Landformen -----------------------------------------
  {
    key: "mountain",
    name: "Berg",
    kind: "relief",
    pathData: "M12 2 L22 20 L2 20 Z M7 20 L12 10 L17 20",
    color: "#7a6b52",
  },
  {
    key: "mountain_snow",
    name: "Schneeberg",
    kind: "relief",
    pathData: "M12 2 L22 20 L2 20 Z M9 11 L12 6 L15 11 Z",
    color: "#a8b8c4",
  },
  {
    key: "hill",
    name: "Hügel",
    kind: "relief",
    pathData: "M2 19 Q7 10 12 19 M10 19 Q15 11 20 19",
    color: "#8a7a5c",
  },
  {
    key: "volcano",
    name: "Vulkan",
    kind: "relief",
    pathData: "M4 21 L9 8 L15 8 L20 21 M9 8 Q12 10 15 8 M11 8 Q9 4 12 2 Q15 4 13 8",
    color: "#8a5a4a",
  },
  {
    key: "mountain_range",
    name: "Gebirgskette",
    kind: "relief",
    pathData: "M1 21 L6 11 L10 17 L14 8 L18 16 L23 21 Z M6 11 L4 16 M14 8 L12 14",
    color: "#6e6048",
  },
  {
    key: "cliff",
    name: "Klippe",
    kind: "relief",
    pathData: "M3 21 L3 10 L13 10 L13 6 L21 6 L21 21 M3 14 L13 14 M13 12 L21 12",
    color: "#7a6a52",
  },

  // --- Biome — Vegetation & Gewässer ---------------------------------------
  {
    key: "tree",
    name: "Wald",
    kind: "biome",
    pathData: "M12 3 L19 17 L5 17 Z M12 17 L12 22 M10 22 L14 22",
    color: "#4a6741",
  },
  {
    key: "water",
    name: "See/Meer",
    kind: "biome",
    pathData: "M2 12 Q6 8 10 12 Q14 16 18 12 Q20 10 22 12 M2 16 Q6 12 10 16 Q14 20 18 16 Q20 14 22 16",
    color: "#a8c4d4",
  },
  {
    key: "pine",
    name: "Nadelwald",
    kind: "biome",
    pathData: "M12 2 L9 8 L11 8 L8 13 L10.5 13 L7 18 L17 18 L13.5 13 L16 13 L13 8 L15 8 Z M12 18 L12 22",
    color: "#3f5d39",
  },
  {
    key: "grass",
    name: "Grasland",
    kind: "biome",
    pathData: "M3 20 L21 20 M5 20 Q3 14 5 10 M9 20 Q7 14 9 10 M12 20 Q11 13 13 10 M16 20 Q14 14 16 10 M19 20 Q18 14 20 11",
    color: "#6f8a3a",
  },
  {
    key: "swamp",
    name: "Sumpf",
    kind: "biome",
    pathData: "M2 17 Q6 15 10 17 Q14 19 18 17 Q20 16 22 17 M2 20 Q6 18 10 20 Q14 22 18 20 Q20 19 22 20 M8 17 L8 10 M8 12 L6 10 M8 12 L10 10 M15 18 L15 11",
    color: "#5e7850",
  },
  {
    key: "desert",
    name: "Wüste",
    kind: "biome",
    pathData: "M2 18 Q8 12 13 17 Q18 22 22 17 M2 21 Q5 19 9 20 M16 6 Q18.5 6 18.5 8.5 Q18.5 11 16 11 Q13.5 11 13.5 8.5 Q13.5 6 16 6",
    color: "#c8a85a",
  },

  // --- Pin — Orte & Bauwerke -----------------------------------------------
  {
    key: "city",
    name: "Stadt",
    kind: "pin",
    pathData: "M7 22 L7 12 L9 12 L9 10 L11 10 L11 8 L13 8 L13 10 L15 10 L15 12 L17 12 L17 22 Z M10 22 L10 16 L14 16 L14 22",
    color: "#1a1008",
  },
  {
    key: "village",
    name: "Dorf",
    kind: "pin",
    pathData: "M12 4 L20 11 L20 22 L4 22 L4 11 Z M4 11 L12 4 L20 11 M9 22 L9 15 L15 15 L15 22",
    color: "#6b4a2a",
  },
  {
    key: "ruin",
    name: "Ruine",
    kind: "pin",
    pathData: "M5 22 L5 12 L8 12 L8 8 M8 8 L10 10 M16 8 L16 12 L19 12 L19 22 M10 14 L14 14 L14 22 L10 22 Z",
    color: "#8b7355",
  },
  {
    key: "castle",
    name: "Burg",
    kind: "pin",
    pathData: "M4 22 L4 14 L6 14 L6 12 L8 12 L8 14 L10 14 L10 12 L14 12 L14 14 L16 14 L16 12 L18 12 L18 14 L20 14 L20 22 Z M10 22 L10 17 L14 17 L14 22",
    color: "#1a1008",
  },
  {
    key: "tower",
    name: "Turm",
    kind: "pin",
    pathData: "M9 22 L9 7 L15 7 L15 22 M9 7 L9 4 L10.5 4 L10.5 5.5 L13.5 5.5 L13.5 4 L15 4 L15 7 M9 22 L15 22 M9 13 L15 13 M11 22 L11 17 Q12 15.5 13 17 L13 22",
    color: "#2a1d10",
  },
  {
    key: "bridge",
    name: "Brücke",
    kind: "pin",
    pathData: "M2 16 Q12 6 22 16 M3 16 L3 19 M21 16 L21 19 M3 19 L21 19 M2 21 Q7 20 12 21 Q17 22 22 21",
    color: "#6b4a2a",
  },
  {
    key: "harbor",
    name: "Hafen",
    kind: "pin",
    pathData: "M12 3 Q14 3 14 5 Q14 7 12 7 Q10 7 10 5 Q10 3 12 3 M12 7 L12 20 M8 10 L16 10 M12 20 Q5 20 5 13 M12 20 Q19 20 19 13",
    color: "#1a3a4a",
  },
  {
    key: "temple",
    name: "Tempel",
    kind: "pin",
    pathData: "M3 9 L12 4 L21 9 Z M4 11 L20 11 M5 11 L5 18 M9 11 L9 18 M15 11 L15 18 M19 11 L19 18 M4 18 L20 18 M2 21 L22 21",
    color: "#2a1d10",
  },
] as const;

// ---------------------------------------------------------------------------
// Derived lookups & helpers
// ---------------------------------------------------------------------------

/** All builtin glyph keys, in registry order. */
export const BUILTIN_GLYPH_KEYS: readonly string[] = BUILTIN_GLYPHS.map(
  (glyph) => glyph.key,
);

const GLYPHS_BY_KEY: ReadonlyMap<string, BuiltinGlyph> = new Map(
  BUILTIN_GLYPHS.map((glyph) => [glyph.key, glyph]),
);

/** Look up a builtin glyph by its stable key. */
export function getGlyphByKey(key: string | null | undefined): BuiltinGlyph | undefined {
  if (!key) return undefined;
  return GLYPHS_BY_KEY.get(key);
}

/** All glyphs belonging to a category, in registry order. */
export function listGlyphsByCategory(category: AtlasGlyphCategory): BuiltinGlyph[] {
  return BUILTIN_GLYPHS.filter((glyph) => glyph.kind === category);
}

/**
 * Glyphs grouped by category, preserving `ATLAS_GLYPH_CATEGORIES` ordering.
 * Handy for rendering a category-grouped palette or styleguide table.
 */
export function groupGlyphsByCategory(): Array<{
  category: AtlasGlyphCategoryInfo;
  glyphs: BuiltinGlyph[];
}> {
  return ATLAS_GLYPH_CATEGORIES.map((category) => ({
    category,
    glyphs: listGlyphsByCategory(category.key),
  }));
}
