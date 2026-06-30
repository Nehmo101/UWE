/**
 * Renderer-agnostic draw model for the Atlas World Builder.
 *
 * Defines the canonical layer stack and the types consumed by any rendering
 * backend (Canvas 2D, SVG, WebGL, …).  No DOM or React imports here.
 */

import type { AtlasGeometry, BBox } from "./geometry";
import type { AtlasFeatureKind } from "./constants";
import type { AtlasStylePreset } from "./style-presets";
import type { ScatteredGlyphItem, ReliefShadingDescriptor } from "./terrain";

// Re-export terrain render types so consumers can import them from the draw-model.
export type { ScatteredGlyphItem, ReliefShadingDescriptor } from "./terrain";

// ---------------------------------------------------------------------------
// Layer definitions
// ---------------------------------------------------------------------------

/**
 * Canonical render layers, listed bottom-to-top.
 * The order matches LAYER_Z in constants.ts.
 */
export const DRAW_LAYERS = [
  "background",
  "biome",
  "relief",
  "rivers",
  "roads",
  "objects",
  "labels",
  "overlay",
] as const;

export type DrawLayer = (typeof DRAW_LAYERS)[number];

// ---------------------------------------------------------------------------
// Draw items
// ---------------------------------------------------------------------------

/** A single renderable unit within a layer. */
export interface DrawItem {
  /** Stable id — mirrors the AtlasFeature / AtlasObject id from the DB. */
  id: string;
  layer: DrawLayer;
  kind: AtlasFeatureKind;
  geometry: AtlasGeometry;
  /** Inline style overrides (renderer interprets these). */
  style: DrawStyle;
  /** Human-readable label, if applicable. */
  labelText?: string;
  /** Sort priority within the layer — higher renders on top. */
  sortOrder: number;
  /** Whether this item is currently selected in the editor. */
  selected?: boolean;
}

// ---------------------------------------------------------------------------
// Style overrides
// ---------------------------------------------------------------------------

/**
 * Per-item style values.  All fields are optional — unset fields fall back to
 * the active `AtlasStylePreset` defaults for the item's layer/kind.
 */
export interface DrawStyle {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
  lineDash?: number[];
  fontSize?: number;
  fontFamily?: string;
}

// ---------------------------------------------------------------------------
// Layer group (for rendering a whole node)
// ---------------------------------------------------------------------------

/** All draw items for a single map node, organised by layer. */
export interface DrawLayerMap extends Record<DrawLayer, DrawItem[]> {
  /**
   * Scattered glyph instances produced by `scatterGlyphsInPolygon` /
   * `scatterGlyphsAlongPath` — rendered in the biome and relief layers.
   */
  scatteredGlyphs: ScatteredGlyphItem[];
  /** Relief-shading gradient descriptors produced by `buildReliefShading`. */
  reliefShadings: ReliefShadingDescriptor[];
}

export function emptyDrawLayerMap(): DrawLayerMap {
  return {
    background: [],
    biome: [],
    relief: [],
    rivers: [],
    roads: [],
    objects: [],
    labels: [],
    overlay: [],
    scatteredGlyphs: [],
    reliefShadings: [],
  };
}

// ---------------------------------------------------------------------------
// Draw context (passed to the renderer)
// ---------------------------------------------------------------------------

export interface DrawContext {
  /** Viewport bounding box in normalised canvas space. */
  viewport: BBox;
  /** Pixel ratio for high-DPI rendering. */
  devicePixelRatio: number;
  /** Active style preset resolved from AtlasMap.stylePreset. */
  preset: AtlasStylePreset;
  /** Current zoom level [0.0, 1.0] — used to suppress cluttered detail. */
  zoom: number;
  /** Whether the editor is in interactive (editable) mode. */
  editable: boolean;
}

// ---------------------------------------------------------------------------
// Map draw descriptor (full snapshot for one render pass)
// ---------------------------------------------------------------------------

/**
 * Complete data passed from the service/store layer to a renderer.
 * Renderers must not fetch additional data — everything needed for a
 * render pass is present here.
 */
export interface MapDrawDescriptor {
  /** Atlas node id. */
  nodeId: string;
  layers: DrawLayerMap;
  context: DrawContext;
}
