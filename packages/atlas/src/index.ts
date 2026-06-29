/**
 * @uwe/atlas — Atlas World Builder engine package.
 *
 * Framework-agnostic geometry types, style presets, draw model, serialization
 * helpers, and constants for the UWE Atlas World Builder.
 *
 * NOT included here (planned for later phases):
 *   - Procedural generator / biome brush scatter (P2)
 *   - River pathing algorithm (P2)
 *   - Canvas / WebGL renderer (P4)
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
  LAYER_Z,
} from "./constants";
export type {
  AtlasNodeLevel as AtlasNodeLevelValue,
  AtlasFeatureKind as AtlasFeatureKindValue,
  AtlasLabelColor as AtlasLabelColorValue,
  AtlasPaletteSource as AtlasPaletteSourceValue,
  AtlasPaletteReviewStatus as AtlasPaletteReviewStatusValue,
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
} from "./draw-model";

// Serialization
export {
  AtlasParseError,
  parseGeometry,
  serializeGeometry,
  parseFeatureGeometry,
  parseExtent,
  tryParseGeometry,
} from "./serialization";
