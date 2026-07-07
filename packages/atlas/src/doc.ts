/**
 * Atlas document envelope — versioning, migration, and serialization.
 *
 * The Atlas single-file runtime persists a whole map as one JSON *document*.
 * This module owns the document-level contract (versioned envelope,
 * `migrateDoc`, `serializeDoc`) as distinct from `serialization.ts`, which
 * validates individual geometry values.
 *
 * v1 (implicit, no `schemaVersion`): `{ worldSlug, map, pageLinks, nodes[],
 * features[], objects[], ... }`.
 * v2 (additive): adds `schemaVersion: 2` and a `tileLayer` terrain grid.
 * v3 (additive): the tile layer gains an optional elevation height field
 * (`elevation`, sparse `"c,r"` → [0,1]) plus the per-map height-display
 * settings `parallaxStrength`, `contoursEnabled` and `contourSteps`.
 * Migration is additive and idempotent — features/objects are never touched,
 * they are rendered alongside the tile layer.
 *
 * Framework-agnostic: no DOM, React, or Prisma imports.
 */

import { AtlasParseError } from "./serialization";
import {
  normalizeContourSteps,
  normalizeElevationCells,
  normalizeParallaxStrength,
} from "./elevation";

/** Current Atlas document schema version. */
export const SCHEMA_VERSION = 3 as const;

/** Default soft biome-border blend width in world pixels at zoom 1. */
export const DEFAULT_TERRAIN_BLEND_WIDTH = 6 as const;

/**
 * Terrain tile grid. `cells` is keyed by `"c,r"` (column,row) → biome kind.
 * Defaults describe the world grid: 64×40 tiles at 32px (2048×1280 world px).
 */
export interface AtlasTileLayer {
  cols: number;
  rows: number;
  tile: number;
  /** Sparse map of painted tiles, keyed `"col,row"` → biome kind string. */
  cells: Record<string, string>;
  /**
   * Optional per-biome colour intensity (saturation/depth) factor; `1` =
   * unchanged, `<1` paler, `>1` more saturated. Missing = all `1`.
   */
  intensity?: Record<string, number>;
  /** Optional soft biome-border blend width at zoom 1; renderers scale it. */
  blendWidth?: number;
  /**
   * Optional sparse height field, keyed `"col,row"` → elevation [0, 1]
   * (`0` = sea level, missing cells are 0). Drives hillshade, contour lines,
   * parallax and elevation-coupled glyph scaling (v3).
   */
  elevation?: Record<string, number>;
  /**
   * Per-map parallax strength [0, 1]; `0` disables the effect. Owner decision:
   * parallax is configurable per map (light direction stays fixed NW).
   */
  parallaxStrength?: number;
  /** Per-map toggle for contour-line rendering (owner decision: toggleable). */
  contoursEnabled?: boolean;
  /** Number of contour steps between elevation 0 and 1 (default 5). */
  contourSteps?: number;
}

/**
 * A feature entry inside a document. Intentionally permissive — documents come
 * from the DB or raw JSON — but carries the transient client-only `_key` that
 * `serializeDoc` strips.
 */
export interface AtlasDocFeature {
  /** Client-local key, stripped on serialize. Never persisted. */
  _key?: string;
  [field: string]: unknown;
}

/** An object (placed palette stamp) entry inside a document. */
export interface AtlasDocObject {
  /** Client-local key, stripped on serialize. Never persisted. */
  _key?: string;
  [field: string]: unknown;
}

/** A node (map layer) entry inside a document. */
export interface AtlasDocNode {
  [field: string]: unknown;
}

/** A loosely-typed Atlas document, either v1 (no version) or v2. */
export interface AtlasDoc {
  schemaVersion?: number;
  worldSlug?: string;
  map?: unknown;
  rootNodeId?: string;
  pageLinks?: Record<string, unknown>;
  nodes?: AtlasDocNode[];
  features?: AtlasDocFeature[];
  objects?: AtlasDocObject[];
  tileLayer?: AtlasTileLayer;
  [field: string]: unknown;
}

/** A fully-migrated v2 document: every collection and the tile layer present. */
export interface AtlasDocV2 extends AtlasDoc {
  schemaVersion: number;
  pageLinks: Record<string, unknown>;
  nodes: AtlasDocNode[];
  features: AtlasDocFeature[];
  objects: AtlasDocObject[];
  tileLayer: AtlasTileLayer;
}

/** The serialized envelope produced by `serializeDoc` (v2 + any `extra`). */
export type SerializedAtlasDoc = AtlasDocV2 & Record<string, unknown>;

function emptyTileLayer(): AtlasTileLayer {
  return { cols: 64, rows: 40, tile: 32, cells: {}, blendWidth: DEFAULT_TERRAIN_BLEND_WIDTH };
}

function normalizeTerrainBlendWidth(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_TERRAIN_BLEND_WIDTH;
  return Math.max(0, value);
}

/**
 * Migrate any Atlas document to the current schema version (v1 → v3).
 *
 * - Missing `schemaVersion` marks a v1 document → set to {@link SCHEMA_VERSION};
 *   older versions are bumped (all migrations are additive).
 * - Missing `nodes` / `features` / `objects` default to `[]`, `pageLinks` to `{}`.
 * - Missing `tileLayer` gets an empty 64×40 grid; existing tiles are preserved.
 * - v3: the height field (`elevation`) and height-display settings are
 *   normalised — invalid entries are dropped, values clamped to [0, 1].
 * - Features and objects are left untouched (rendered alongside the tiles).
 *
 * Idempotent: `migrateDoc(migrateDoc(d))` equals `migrateDoc(d)`.
 *
 * @throws {AtlasParseError} when `doc` is null/undefined or not a plain object,
 *   so a corrupt payload surfaces as a visible Degraded state rather than
 *   silently losing data.
 */
export function migrateDoc(doc: unknown): AtlasDocV2 {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    throw new AtlasParseError("Atlas-Doc ist leer oder ungültig.");
  }
  const d: AtlasDoc = { ...(doc as AtlasDoc) };
  if (!d.schemaVersion || d.schemaVersion < SCHEMA_VERSION) d.schemaVersion = SCHEMA_VERSION;
  d.nodes = d.nodes ?? [];
  d.features = d.features ?? [];
  d.objects = d.objects ?? [];
  d.pageLinks = d.pageLinks ?? {};
  d.tileLayer = d.tileLayer ?? emptyTileLayer();
  d.tileLayer.cells = d.tileLayer.cells ?? {};
  d.tileLayer.blendWidth = normalizeTerrainBlendWidth(d.tileLayer.blendWidth);
  const elevation = normalizeElevationCells(d.tileLayer.elevation);
  if (elevation) d.tileLayer.elevation = elevation;
  else delete d.tileLayer.elevation;
  if (d.tileLayer.parallaxStrength !== undefined) {
    d.tileLayer.parallaxStrength = normalizeParallaxStrength(d.tileLayer.parallaxStrength);
  }
  if (d.tileLayer.contoursEnabled !== undefined) {
    d.tileLayer.contoursEnabled = d.tileLayer.contoursEnabled === true;
  }
  if (d.tileLayer.contourSteps !== undefined) {
    d.tileLayer.contourSteps = normalizeContourSteps(d.tileLayer.contourSteps);
  }
  return d as AtlasDocV2;
}

/**
 * Serialize a (migrated) document to a stable, persistable v2 envelope.
 *
 * Strips the transient `_key` from every feature and object, emits a fixed
 * field set, and appends any `extra` fields (e.g. a `savedAt` timestamp).
 * Feeding the result back through {@link migrateDoc} + `serializeDoc` is stable.
 *
 * @param doc   - A migrated v2 document.
 * @param extra - Optional extra fields merged into the envelope.
 */
export function serializeDoc(
  doc: AtlasDocV2,
  extra?: Record<string, unknown>,
): SerializedAtlasDoc {
  const clean = <T extends { _key?: string }>(arr: readonly T[] | undefined) =>
    (arr ?? []).map(({ _key, ...rest }) => rest);
  return {
    schemaVersion: SCHEMA_VERSION,
    worldSlug: doc.worldSlug,
    map: doc.map,
    rootNodeId: doc.rootNodeId,
    pageLinks: doc.pageLinks,
    nodes: doc.nodes,
    features: clean(doc.features),
    objects: clean(doc.objects),
    tileLayer: doc.tileLayer,
    ...(extra ?? {}),
  } as SerializedAtlasDoc;
}
