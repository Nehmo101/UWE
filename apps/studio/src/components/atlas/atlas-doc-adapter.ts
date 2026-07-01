/**
 * Adapt the Studio route's per-node atlas data into the document shape the
 * single-file editor (atlas.html) loads via the bridge `load` message, plus the
 * client-palette-key → DB-id map the save path needs (M4 groundwork).
 *
 * Pure and framework-free (types only from @uwe/atlas) so it is unit-tested
 * without Next.js or Prisma.
 */

import type { AtlasGeometry } from "@uwe/atlas";
import type { AtlasDocV2, AtlasTileLayer } from "@uwe/atlas/doc";

export interface StudioAtlasNodeInput {
  id: string;
  title: string;
  level: string;
  visibility?: string | null;
}

export interface StudioAtlasFeatureInput {
  id?: string;
  kind: string;
  geometry: AtlasGeometry;
  style?: Record<string, unknown>;
  labelText?: string | null;
  labelColor?: string | null;
  childNodeId?: string | null;
  linkedPageId?: string | null;
  layer?: number;
  sortOrder?: number;
  visibility?: string;
  _key: string;
}

export interface StudioAtlasObjectInput {
  id?: string;
  paletteItemId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  layer?: number;
  visibility?: string;
  _key: string;
}

export interface BuildStudioAtlasDocInput {
  worldSlug: string;
  node: StudioAtlasNodeInput;
  /** Ancestors ordered root → immediate parent (for the breadcrumb chain). */
  parentChain: StudioAtlasNodeInput[];
  features: StudioAtlasFeatureInput[];
  objects: StudioAtlasObjectInput[];
  tileLayer?: AtlasTileLayer | null;
  stylePreset?: string;
  mapVisibility?: string;
}

const EMPTY_TILE_LAYER: AtlasTileLayer = { cols: 64, rows: 40, tile: 32, cells: {} };

/**
 * Build a full v2 atlas doc for the current node (rootNodeId = node.id), with the
 * parent chain linked via parentId so the embedded editor's breadcrumb resolves.
 * Features/objects are stamped with the current nodeId (they all belong to it).
 */
export function buildStudioAtlasDoc(input: BuildStudioAtlasDocInput): AtlasDocV2 {
  const {
    worldSlug,
    node,
    parentChain,
    features,
    objects,
    tileLayer,
    stylePreset = "tolkien-ink",
    mapVisibility = "dm_only",
  } = input;

  const nodes: Array<Record<string, unknown>> = [];
  let parentId: string | null = null;
  for (const ancestor of parentChain) {
    nodes.push({
      id: ancestor.id,
      parentId,
      level: ancestor.level,
      title: ancestor.title,
      parentFeatureId: null,
      visibility: ancestor.visibility ?? "dm_only",
    });
    parentId = ancestor.id;
  }
  nodes.push({
    id: node.id,
    parentId,
    level: node.level,
    title: node.title,
    parentFeatureId: null,
    visibility: node.visibility ?? "dm_only",
  });

  return {
    schemaVersion: 2,
    worldSlug,
    map: { title: "Atlas", stylePreset, visibility: mapVisibility },
    rootNodeId: node.id,
    pageLinks: {},
    nodes,
    features: features.map((f) => ({
      id: f.id,
      nodeId: node.id,
      kind: f.kind,
      geometry: f.geometry,
      style: f.style,
      labelText: f.labelText ?? null,
      labelColor: f.labelColor ?? null,
      childNodeId: f.childNodeId ?? null,
      linkedPageId: f.linkedPageId ?? null,
      layer: f.layer,
      sortOrder: f.sortOrder,
      visibility: f.visibility,
      _key: f._key,
    })),
    objects: objects.map((o) => ({
      id: o.id,
      nodeId: node.id,
      paletteItemId: o.paletteItemId,
      x: o.x,
      y: o.y,
      scale: o.scale,
      rotation: o.rotation,
      layer: o.layer,
      visibility: o.visibility,
      _key: o._key,
    })),
    tileLayer: tileLayer ?? { ...EMPTY_TILE_LAYER },
  };
}

/**
 * Map client palette keys → real AtlasPaletteItem DB ids for splitDocForSave's
 * `resolvePaletteId`. Builtin glyphs are keyed by `builtinGlyphKey` (the editor
 * places them by glyph key); real ids also map to themselves so existing objects
 * pass through unchanged.
 */
export function buildPaletteIdMap(
  items: ReadonlyArray<{ id: string; builtinGlyphKey?: string | null }>,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of items) {
    if (item.builtinGlyphKey) map[item.builtinGlyphKey] = item.id;
    map[item.id] = item.id;
  }
  return map;
}
