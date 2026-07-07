// Single-file Atlas editor embedding (M3/M4): the iframe host + the workspace
// that composes it with the retained AI tools.
export { AtlasStudioHost, type AtlasStudioHostProps } from "./AtlasStudioHost";
export {
  AtlasStudioWorkspace,
  type AtlasStudioWorkspaceProps,
} from "./AtlasStudioWorkspace";

// Server → embedded-editor document adapter + palette id map.
export {
  buildStudioAtlasDoc,
  buildPaletteIdMap,
  type BuildStudioAtlasDocInput,
  type StudioAtlasNodeInput,
  type StudioAtlasFeatureInput,
  type StudioAtlasObjectInput,
  type StudioAtlasRtxPaletteItemInput,
} from "./atlas-doc-adapter";

// Builtin pictogram registry — re-exported from the canonical source so existing
// importers of `@/components/atlas` keep working.
export { BUILTIN_GLYPHS, type BuiltinGlyph } from "@uwe/atlas/glyphs";

// AI tools retained alongside the embedded editor (not part of atlas.html).
export {
  AtlasStampGenerator,
  type AtlasStampGeneratorProps,
} from "./AtlasStampGenerator";

export {
  AtlasAssetProposalStudio,
  type AtlasAssetProposalStudioProps,
} from "./AtlasAssetProposalStudio";

export {
  RegionDescribePanel,
  type RegionDescribePanelProps,
  type RegionDescribeTarget,
} from "./RegionDescribePanel";
