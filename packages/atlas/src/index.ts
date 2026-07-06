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

// Geometry helpers — coordinate transforms + point/polygon math
export {
  worldToCanvas,
  canvasToWorld,
  pointInPolygon,
  distToSegment,
  centroid,
  translateGeometry,
} from "./geometry";

// Deterministic PRNG (mulberry32) + string-seed hashing
export { mulberry32, hashStringToSeed } from "./prng";

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
  BIOME_SCATTER_GLYPH,
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
export type { ScatterExclusion } from "./terrain";

// Plot fill — deterministic object scatter for `plot` features
export { fillPlotWithGouacheAssets } from "./plot-fill";
export type {
  PlotFillAssetChoice,
  PlotFillOptions,
  PlotFillObject,
} from "./plot-fill";

// Serialization (geometry-level)
export {
  AtlasParseError,
  parseGeometry,
  serializeGeometry,
  parseFeatureGeometry,
  parseExtent,
  tryParseGeometry,
} from "./serialization";

// Document envelope — versioning, migration, serialization (document-level)
export {
  DEFAULT_TERRAIN_BLEND_WIDTH,
  SCHEMA_VERSION,
  migrateDoc,
  serializeDoc,
} from "./doc";
export type {
  AtlasTileLayer,
  AtlasDocFeature,
  AtlasDocObject,
  AtlasDocNode,
  AtlasDoc,
  AtlasDocV2,
  SerializedAtlasDoc,
} from "./doc";

// Canvas 2D rendering helpers (browser-only)
export {
  roundedRectPath,
  paintTerrainBlobs,
  applyColorIntensity,
  drawSvgPath,
  drawCompassRose,
  drawScaleBar,
  drawVine,
} from "./canvas-render";
export type {
  PaintTerrainBlobsOptions,
  CompassRoseOptions,
  ScaleBarOptions,
  DrawVineOptions,
} from "./canvas-render";

// Vine / giant-root layout engine — deterministic pseudo-3D beanstalk
export { buildVineLayout } from "./vine";
export type { VineOptions, VineLayout, VineAura } from "./vine";

// Gouache painted-asset engine (Canvas-of-Kings style)
export {
  GOUACHE_ASSETS,
  GOUACHE_ASSET_KEYS,
  GOUACHE_CATEGORY_LABELS,
  getGouacheAsset,
  listGouacheAssetsByCategory,
  drawGouacheAsset,
  isGouacheAsset,
} from "./assets";
export type {
  GouacheAsset,
  GouacheCategory,
  DrawGouacheAssetOptions,
} from "./assets";

// RTX Asset Studio proposal validation and prompt context
export {
  RTX_ATLAS_ASSET_STYLEGUIDE_PATH,
  RTX_ATLAS_ASSET_CATALOG_PATH,
  RTX_ATLAS_ASSET_REGISTRY_EXPORT,
  RTX_ATLAS_ASSET_OUTPUT_TYPES,
  RTX_ATLAS_ASSET_ENGINE_TAGS,
  RTX_ATLAS_ASSET_GOUACHE_CATEGORIES,
  RTX_GOUACHE_RECIPE_LAYER_ROLES,
  RTX_GOUACHE_RECIPE_SHAPES,
  buildRtxAtlasAssetPromptContext,
  formatRtxAtlasAssetPromptContext,
  validateRtxAtlasAssetProposal,
  isRtxAtlasAssetProposal,
} from "./rtx-asset-proposal";
export type {
  RtxAtlasAssetEngineTag,
  RtxAtlasAssetOutputType,
  RtxAtlasAssetPromptContext,
  RtxAtlasAssetProposal,
  RtxAtlasAssetProposalBase,
  RtxAtlasAssetProposalIssue,
  RtxAtlasAssetProposalIssueCode,
  RtxAtlasAssetProposalValidationResult,
  RtxGouacheJsonRecipe,
  RtxGouacheRecipeLayer,
  RtxGouacheRecipeLayerRole,
  RtxGouacheRecipeShape,
  RtxPngFallbackMetadata,
} from "./rtx-asset-proposal";

// Procedural draft generators
export {
  generateDraft,
  rerollDraft,
  proceduralDraft,
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

// Settlement generator — deterministic wall/road/building layout inside a polygon
export { generateSettlement } from "./settlement";
export type {
  SettlementFeatureKind,
  SettlementObjectKind,
  SettlementOptions,
  SettlementFeatureStyle,
  SettlementFeature,
  SettlementObjectStyle,
  SettlementObject,
  SettlementLayout,
} from "./settlement";

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
  SimpleProceduralFeature,
  SimpleProceduralDraft,
} from "./procedural";
