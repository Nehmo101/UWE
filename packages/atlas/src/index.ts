/**
 * @uwe/atlas — Atlas World Builder engine package.
 *
 * Framework-agnostic geometry types, style presets, draw model, serialization
 * helpers, constants, and terrain scatter/relief engine.
 */

// Geometry types
export type {
  Coordinate,
  BBox,
  Point,
  Path,
  Polygon,
  LabelAnchor,
  AtlasGeometry,
  AtlasExtent,
  AtlasFeatureGeometry,
} from "./geometry";

// Constants / enums (mirror Prisma schema enums)
export {
  AtlasNodeLevel,
  AtlasFeatureKind,
  AtlasLabelColor,
  AtlasPaletteSource,
  AtlasPaletteReviewStatus,
  BiomeKind,
  LAYER_Z,
} from "./constants";
export type {
  AtlasNodeLevel as AtlasNodeLevelValue,
  AtlasFeatureKind as AtlasFeatureKindValue,
  AtlasLabelColor as AtlasLabelColorValue,
  AtlasPaletteSource as AtlasPaletteSourceValue,
  AtlasPaletteReviewStatus as AtlasPaletteReviewStatusValue,
  BiomeKind as BiomeKindValue,
} from "./constants";

// Style presets
export {
  TOLKIEN_INK,
  STYLE_PRESETS,
  resolveStylePreset,
} from "./style-presets";
export type {
  CssColor,
  FontStack,
  ScaleUnit,
  AtlasStylePreset,
} from "./style-presets";

// Builtin pictogram (glyph) registry — single source of truth
export {
  ATLAS_GLYPH_CATEGORIES,
  BUILTIN_GLYPHS,
  BUILTIN_GLYPH_KEYS,
  getGlyphByKey,
  listGlyphsByCategory,
  groupGlyphsByCategory,
} from "./glyphs";
export type {
  AtlasGlyphCategory,
  AtlasGlyphCategoryInfo,
  BuiltinGlyph,
} from "./glyphs";

// Draw model
export {
  DRAW_LAYERS,
  emptyDrawLayerMap,
} from "./draw-model";
export type {
  DrawLayer,
  DrawItem,
  DrawStyle,
  DrawLayerMap,
  DrawContext,
  MapDrawDescriptor,
  ScatteredGlyphItem,
  ReliefShadingDescriptor,
} from "./draw-model";

// Terrain scatter / relief engine (types re-exported via draw-model above)
export {
  scatterGlyphsInPolygon,
  scatterGlyphsAlongPath,
  buildReliefShading,
} from "./terrain";

// Serialization
export {
  AtlasParseError,
  parseGeometry,
  serializeGeometry,
  parseFeatureGeometry,
  parseExtent,
  tryParseGeometry,
} from "./serialization";

// Procedural draft generator
export {
  generateDraft,
  rerollDraft,
} from "./procedural";

// AI stamp generation — P5
export {
  ATLAS_STAMP_STYLE_PROMPT,
  assembleStampPrompt,
} from "./stamp-prompt";

export {
  layoutCharactersOnPath,
  pathLength,
  pointAtDistance,
} from "./label-layout";
export type { CharacterPlacement } from "./label-layout";

// Stamp variation — deterministic scale/rotation jitter (CoK-style)
export {
  randomStampVariation,
  stampSeedFromKey,
} from "./stamp-variation";
export type {
  StampVariationOptions,
  StampVariation,
} from "./stamp-variation";

// Path smoothing — Catmull-Rom densification + tapered widths
export {
  smoothPath,
  sampleTaperedWidths,
} from "./path-smoothing";
export type { SmoothPathOptions } from "./path-smoothing";

// Path attachments — objects auto-placed along a path
export { generatePathAttachments } from "./path-attachments";
export type {
  PathAttachmentKind,
  PathAttachmentSide,
  PathAttachmentOptions,
  PathAttachmentPlacement,
} from "./path-attachments";

// Export grid — square/hex grid line geometry for map export
export { buildGridLines } from "./export-grid";
export type {
  GridKind,
  ExportRect,
  GridSpec,
  GridLine,
} from "./export-grid";
export type {
  DraftFeatureKind,
  ProceduralPromptHints,
  ProceduralBounds,
  DraftFeature,
  AtlasDraft,
} from "./procedural";
