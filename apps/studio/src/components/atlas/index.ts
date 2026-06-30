export {
  AtlasEditor,
  type AtlasEditorProps,
  type EditorFeature,
  type EditorObject,
  type NodeAncestorItem,
  type EditorPaletteItem,
} from "./AtlasEditor";

// Builtin pictogram registry — re-exported from the canonical source so existing
// importers of `@/components/atlas` keep working.
export { BUILTIN_GLYPHS, type BuiltinGlyph } from "@uwe/atlas/glyphs";

export {
  ProceduralDraftPanel,
  type ProceduralDraftPanelProps,
} from "./ProceduralDraftPanel";

export {
  RegionDescribePanel,
  type RegionDescribePanelProps,
} from "./RegionDescribePanel";

export {
  AtlasStampGenerator,
  type AtlasStampGeneratorProps,
} from "./AtlasStampGenerator";
