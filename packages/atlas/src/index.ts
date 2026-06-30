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
export type {
  DraftFeatureKind,
  ProceduralPromptHints,
  ProceduralBounds,
  DraftFeature,
  AtlasDraft,
} from "./procedural";
