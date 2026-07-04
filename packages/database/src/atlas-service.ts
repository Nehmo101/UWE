import type {
  AtlasFeature,
  AtlasFeatureKind,
  AtlasLabelColor,
  AtlasNode,
  AtlasNodeLevel,
  AtlasPaletteReviewStatus,
  AtlasPaletteSource,
  Prisma,
  Visibility,
} from "./generated/prisma/client";
import { BUILTIN_GLYPHS, type BuiltinGlyph } from "@uwe/atlas/glyphs";
import { collectSubtreeNodeIds } from "./atlas-node-subtree";
import type { PrismaClient } from "./client";
import {
  isDmOnlyVisibility,
  isPlayerPortalVisibility,
} from "./content-access";
import type { AccessContext } from "./permissions";

// ---------------------------------------------------------------------------
// Hierarchy types
// ---------------------------------------------------------------------------

export interface NodeAncestor {
  id: string;
  title: string;
  level: AtlasNodeLevel;
}

export interface NodeWithHierarchy {
  node: AtlasNode;
  parentChain: NodeAncestor[];
  parentFeature: AtlasFeature | null;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateAtlasMapInput {
  worldId: string;
  title?: string;
  stylePreset?: string;
  settings?: Prisma.InputJsonValue;
  visibility?: Visibility;
}

export interface UpdateAtlasMapInput {
  title?: string;
  stylePreset?: string;
  settings?: Prisma.InputJsonValue;
  visibility?: Visibility;
  /** Terrain tile grid ({ cols, rows, tile, cells }); persisted as JSON. */
  tileLayer?: Prisma.InputJsonValue;
}

export interface CreateAtlasNodeInput {
  mapId: string;
  parentId?: string | null;
  parentFeatureId?: string | null;
  level: AtlasNodeLevel;
  title: string;
  slug?: string | null;
  extent?: Prisma.InputJsonValue;
  silhouette?: Prisma.InputJsonValue;
  seed?: number | null;
  backgroundAssetId?: string | null;
  pageId?: string | null;
  visibility?: Visibility;
  sortOrder?: number;
}

export interface UpdateAtlasNodeInput {
  parentId?: string | null;
  parentFeatureId?: string | null;
  level?: AtlasNodeLevel;
  title?: string;
  slug?: string | null;
  extent?: Prisma.InputJsonValue;
  silhouette?: Prisma.InputJsonValue;
  seed?: number | null;
  backgroundAssetId?: string | null;
  pageId?: string | null;
  visibility?: Visibility;
  sortOrder?: number;
}

export interface CreateAtlasFeatureInput {
  nodeId: string;
  kind: AtlasFeatureKind;
  geometry: Prisma.InputJsonValue;
  style?: Prisma.InputJsonValue;
  labelText?: string | null;
  labelColor?: AtlasLabelColor | null;
  childNodeId?: string | null;
  linkedPageId?: string | null;
  layer?: number;
  visibility?: Visibility;
  sortOrder?: number;
}

export interface UpdateAtlasFeatureInput {
  kind?: AtlasFeatureKind;
  geometry?: Prisma.InputJsonValue;
  style?: Prisma.InputJsonValue;
  labelText?: string | null;
  labelColor?: AtlasLabelColor | null;
  childNodeId?: string | null;
  linkedPageId?: string | null;
  layer?: number;
  visibility?: Visibility;
  sortOrder?: number;
}

export interface CreateAtlasObjectInput {
  nodeId: string;
  paletteItemId: string;
  x: number;
  y: number;
  scale?: number;
  rotation?: number;
  layer?: number;
  linkedPageId?: string | null;
  visibility?: Visibility;
}

export interface UpdateAtlasObjectInput {
  paletteItemId?: string;
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  layer?: number;
  linkedPageId?: string | null;
  visibility?: Visibility;
}

export interface CreateAtlasPaletteItemInput {
  worldId?: string | null;
  name: string;
  kind: string;
  source?: AtlasPaletteSource;
  assetId?: string | null;
  builtinGlyphKey?: string | null;
  reviewStatus?: AtlasPaletteReviewStatus;
  styleTags?: Prisma.InputJsonValue;
}

// ---------------------------------------------------------------------------
// Builtin glyphs
// ---------------------------------------------------------------------------

/**
 * Canonical set of builtin glyph stamps, derived from the single source of
 * truth in `@uwe/atlas/glyphs`. These are seeded as GLOBAL (worldId === null)
 * AtlasPaletteItem rows so that placing a builtin stamp always references a
 * real palette item (AtlasObject.paletteItemId FK is Restrict and required).
 *
 * Adding a pictogram to `@uwe/atlas/glyphs` automatically seeds it here — the
 * `ensureBuiltinPaletteItems` seed is idempotent and back-fills new keys.
 */
export const BUILTIN_ATLAS_GLYPHS: Array<{
  key: string;
  name: string;
  kind: string;
}> = BUILTIN_GLYPHS.map((glyph: BuiltinGlyph) => ({
  key: glyph.key,
  name: glyph.name,
  kind: glyph.kind,
}));

// ---------------------------------------------------------------------------
// Visibility helpers
// ---------------------------------------------------------------------------

export interface AtlasEntityAccessRecord {
  visibility: Visibility;
}

export function isAtlasEntityAccessible(
  entity: AtlasEntityAccessRecord,
  context: AccessContext,
): boolean {
  if (context === "dm") {
    return true;
  }
  if (isDmOnlyVisibility(entity.visibility)) {
    return false;
  }
  return isPlayerPortalVisibility(entity.visibility);
}

function filterAtlasEntities<T extends AtlasEntityAccessRecord>(
  entities: T[],
  context: AccessContext,
): T[] {
  if (context === "dm") return entities;
  return entities.filter((e) => isAtlasEntityAccessible(e, context));
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

export function createAtlasService(db: PrismaClient) {
  // -------------------------------------------------------------------------
  // AtlasMap
  // -------------------------------------------------------------------------

  /**
   * Idempotently ensure the global builtin glyph palette items exist. Calling
   * this multiple times never creates duplicates: each glyph is keyed by
   * (worldId === null, builtinGlyphKey).
   */
  async function ensureBuiltinPaletteItems() {
    for (const glyph of BUILTIN_ATLAS_GLYPHS) {
      const existing = await db.atlasPaletteItem.findFirst({
        where: { worldId: null, builtinGlyphKey: glyph.key },
      });
      if (existing) continue;
      await db.atlasPaletteItem.create({
        data: {
          worldId: null,
          name: glyph.name,
          kind: glyph.kind,
          source: "builtin",
          builtinGlyphKey: glyph.key,
          reviewStatus: "approved",
        },
      });
    }
  }

  async function getOrCreateAtlasForWorld(worldId: string) {
    const existing = await db.atlasMap.findUnique({ where: { worldId } });
    const map =
      existing ??
      (await db.atlasMap.create({
        data: { worldId },
      }));
    await ensureBuiltinPaletteItems();
    return map;
  }

  async function getAtlasMap(mapId: string) {
    return db.atlasMap.findUnique({ where: { id: mapId } });
  }

  async function updateAtlasMap(mapId: string, input: UpdateAtlasMapInput) {
    return db.atlasMap.update({
      where: { id: mapId },
      data: {
        title: input.title,
        stylePreset: input.stylePreset,
        settings: input.settings,
        visibility: input.visibility,
        tileLayer: input.tileLayer,
      },
    });
  }

  // -------------------------------------------------------------------------
  // AtlasNode CRUD
  // -------------------------------------------------------------------------

  async function createNode(input: CreateAtlasNodeInput) {
    return db.atlasNode.create({
      data: {
        mapId: input.mapId,
        parentId: input.parentId ?? null,
        parentFeatureId: input.parentFeatureId ?? null,
        level: input.level,
        title: input.title,
        slug: input.slug ?? null,
        extent: input.extent,
        silhouette: input.silhouette,
        seed: input.seed ?? null,
        backgroundAssetId: input.backgroundAssetId ?? null,
        pageId: input.pageId ?? null,
        visibility: input.visibility ?? "dm_only",
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  async function getNode(nodeId: string) {
    return db.atlasNode.findUnique({ where: { id: nodeId } });
  }

  async function updateNode(nodeId: string, input: UpdateAtlasNodeInput) {
    return db.atlasNode.update({
      where: { id: nodeId },
      data: {
        parentId: input.parentId,
        parentFeatureId: input.parentFeatureId,
        level: input.level,
        title: input.title,
        slug: input.slug,
        extent: input.extent,
        silhouette: input.silhouette,
        seed: input.seed,
        backgroundAssetId: input.backgroundAssetId,
        pageId: input.pageId,
        visibility: input.visibility,
        sortOrder: input.sortOrder,
      },
    });
  }

  async function deleteNode(nodeId: string) {
    return db.atlasNode.delete({ where: { id: nodeId } });
  }

  /**
   * Delete a node together with its entire descendant subtree (child nodes,
   * grandchildren, …). Each removed node's own features and objects cascade
   * away via the schema FK actions; child nodes must be collected and deleted
   * explicitly because the `AtlasNodeHierarchy` self-relation uses
   * `onDelete: SetNull` — deleting only the root would otherwise orphan its
   * children to the map root instead of removing them.
   *
   * Returns the number of nodes removed (including the root itself); 0 if the
   * node does not exist.
   */
  async function deleteNodeSubtree(nodeId: string): Promise<{ deletedCount: number }> {
    const root = await db.atlasNode.findUnique({
      where: { id: nodeId },
      select: { id: true, mapId: true },
    });
    if (!root) return { deletedCount: 0 };

    // Load the map's node graph once and walk it in memory (maps are small).
    const nodes = await db.atlasNode.findMany({
      where: { mapId: root.mapId },
      select: { id: true, parentId: true },
    });
    const ordered = collectSubtreeNodeIds(root.id, nodes);

    // Delete leaf-first (reverse BFS) in one transaction so the subtree — and
    // each node's cascading features/objects — is removed atomically.
    await db.$transaction(
      ordered
        .slice()
        .reverse()
        .map((id) => db.atlasNode.delete({ where: { id } })),
    );

    return { deletedCount: ordered.length };
  }

  async function listNodesForMap(mapId: string) {
    return db.atlasNode.findMany({
      where: { mapId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  // -------------------------------------------------------------------------
  // AtlasFeature CRUD
  // -------------------------------------------------------------------------

  async function createFeature(input: CreateAtlasFeatureInput) {
    return db.atlasFeature.create({
      data: {
        nodeId: input.nodeId,
        kind: input.kind,
        geometry: input.geometry,
        style: input.style,
        labelText: input.labelText ?? null,
        labelColor: input.labelColor ?? null,
        childNodeId: input.childNodeId ?? null,
        linkedPageId: input.linkedPageId ?? null,
        layer: input.layer ?? 0,
        visibility: input.visibility ?? "dm_only",
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  async function getFeature(featureId: string) {
    return db.atlasFeature.findUnique({ where: { id: featureId } });
  }

  async function updateFeature(featureId: string, input: UpdateAtlasFeatureInput) {
    return db.atlasFeature.update({
      where: { id: featureId },
      data: {
        kind: input.kind,
        geometry: input.geometry,
        style: input.style,
        labelText: input.labelText,
        labelColor: input.labelColor,
        childNodeId: input.childNodeId,
        linkedPageId: input.linkedPageId,
        layer: input.layer,
        visibility: input.visibility,
        sortOrder: input.sortOrder,
      },
    });
  }

  async function deleteFeature(featureId: string) {
    return db.atlasFeature.delete({ where: { id: featureId } });
  }

  async function listFeaturesForNode(nodeId: string) {
    return db.atlasFeature.findMany({
      where: { nodeId },
      orderBy: [{ layer: "asc" }, { sortOrder: "asc" }],
    });
  }

  // -------------------------------------------------------------------------
  // AtlasObject CRUD
  // -------------------------------------------------------------------------

  async function createObject(input: CreateAtlasObjectInput) {
    return db.atlasObject.create({
      data: {
        nodeId: input.nodeId,
        paletteItemId: input.paletteItemId,
        x: input.x,
        y: input.y,
        scale: input.scale ?? 1,
        rotation: input.rotation ?? 0,
        layer: input.layer ?? 0,
        linkedPageId: input.linkedPageId ?? null,
        visibility: input.visibility ?? "dm_only",
      },
    });
  }

  async function getObject(objectId: string) {
    return db.atlasObject.findUnique({ where: { id: objectId } });
  }

  async function updateObject(objectId: string, input: UpdateAtlasObjectInput) {
    return db.atlasObject.update({
      where: { id: objectId },
      data: {
        paletteItemId: input.paletteItemId,
        x: input.x,
        y: input.y,
        scale: input.scale,
        rotation: input.rotation,
        layer: input.layer,
        linkedPageId: input.linkedPageId,
        visibility: input.visibility,
      },
    });
  }

  async function deleteObject(objectId: string) {
    return db.atlasObject.delete({ where: { id: objectId } });
  }

  async function listObjectsForNode(nodeId: string) {
    return db.atlasObject.findMany({
      where: { nodeId },
      orderBy: [{ layer: "asc" }, { createdAt: "asc" }],
    });
  }

  // -------------------------------------------------------------------------
  // AtlasPaletteItem
  // -------------------------------------------------------------------------

  async function listPaletteItems(worldId: string) {
    return db.atlasPaletteItem.findMany({
      where: { OR: [{ worldId }, { worldId: null }] },
      orderBy: [{ worldId: "asc" }, { name: "asc" }],
    });
  }

  async function createPaletteItem(input: CreateAtlasPaletteItemInput) {
    return db.atlasPaletteItem.create({
      data: {
        worldId: input.worldId ?? null,
        name: input.name,
        kind: input.kind,
        source: input.source ?? "builtin",
        assetId: input.assetId ?? null,
        builtinGlyphKey: input.builtinGlyphKey ?? null,
        reviewStatus: input.reviewStatus ?? "approved",
        styleTags: input.styleTags,
      },
    });
  }

  async function approvePaletteItem(itemId: string) {
    return db.atlasPaletteItem.update({
      where: { id: itemId },
      data: { reviewStatus: "approved" },
    });
  }

  // -------------------------------------------------------------------------
  // Portal context query
  // -------------------------------------------------------------------------

  async function getAtlasForContext(
    worldSlug: string,
    context: AccessContext,
  ) {
    const world = await db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return null;

    const atlasMap = await db.atlasMap.findUnique({ where: { worldId: world.id } });
    if (!atlasMap) return null;

    if (!isAtlasEntityAccessible(atlasMap, context)) return null;

    const allNodes = await db.atlasNode.findMany({
      where: { mapId: atlasMap.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const nodes = filterAtlasEntities(allNodes, context);
    const nodeIds = nodes.map((n) => n.id);

    const allFeatures = nodeIds.length
      ? await db.atlasFeature.findMany({
          where: { nodeId: { in: nodeIds } },
          orderBy: [{ layer: "asc" }, { sortOrder: "asc" }],
        })
      : [];
    const features = filterAtlasEntities(allFeatures, context);

    const allObjects = nodeIds.length
      ? await db.atlasObject.findMany({
          where: { nodeId: { in: nodeIds } },
          orderBy: [{ layer: "asc" }, { createdAt: "asc" }],
        })
      : [];
    const objects = filterAtlasEntities(allObjects, context);

    return { map: atlasMap, nodes, features, objects };
  }

  // -------------------------------------------------------------------------
  // Hierarchy helpers
  // -------------------------------------------------------------------------

  /**
   * Create a child node linked to a parent node via a region feature.
   * The parent feature's polygon geometry is stored as the child's silhouette
   * so the editor can render a locked parent-boundary underlay.
   * Also sets the parent feature's childNodeId to point back to the new node.
   */
  async function createChildNode(
    parentNodeId: string,
    parentFeatureId: string,
    level: AtlasNodeLevel,
    title: string,
  ): Promise<AtlasNode> {
    const parentNode = await db.atlasNode.findUnique({ where: { id: parentNodeId } });
    if (!parentNode) throw new Error(`Parent node ${parentNodeId} not found`);

    const parentFeature = await db.atlasFeature.findUnique({ where: { id: parentFeatureId } });
    if (!parentFeature) throw new Error(`Parent feature ${parentFeatureId} not found`);
    if (parentFeature.nodeId !== parentNodeId) {
      throw new Error(`Feature ${parentFeatureId} does not belong to node ${parentNodeId}`);
    }

    // If the feature already points to a child node, return that node.
    if (parentFeature.childNodeId) {
      const existing = await db.atlasNode.findUnique({ where: { id: parentFeature.childNodeId } });
      if (existing) return existing;
    }

    const childNode = await db.atlasNode.create({
      data: {
        mapId: parentNode.mapId,
        parentId: parentNodeId,
        parentFeatureId,
        level,
        title,
        silhouette: parentFeature.geometry as Prisma.InputJsonValue,
        visibility: parentNode.visibility,
        sortOrder: 0,
      },
    });

    // Link the parent feature back to the new child node.
    await db.atlasFeature.update({
      where: { id: parentFeatureId },
      data: { childNodeId: childNode.id },
    });

    return childNode;
  }

  /**
   * Return a node together with its full ancestor chain (root first) and the
   * parent feature whose silhouette the editor uses as a locked boundary underlay.
   */
  async function getNodeWithHierarchy(nodeId: string): Promise<NodeWithHierarchy | null> {
    const node = await db.atlasNode.findUnique({ where: { id: nodeId } });
    if (!node) return null;

    const parentChain: NodeAncestor[] = [];
    let current: AtlasNode = node;

    // Walk up to root (max depth guard: 8 levels is more than enough for
    // Globe → Continent → Landscape → City).
    for (let depth = 0; depth < 8 && current.parentId; depth++) {
      const parent: AtlasNode | null = await db.atlasNode.findUnique({ where: { id: current.parentId } });
      if (!parent) break;
      parentChain.unshift({ id: parent.id, title: parent.title, level: parent.level });
      current = parent;
    }

    const parentFeature = node.parentFeatureId
      ? await db.atlasFeature.findUnique({ where: { id: node.parentFeatureId } })
      : null;

    return { node, parentChain, parentFeature };
  }

  /**
   * Link an existing feature to an existing child node (and keep back-references
   * on both sides in sync).
   */
  async function linkFeatureToChildNode(featureId: string, childNodeId: string): Promise<void> {
    const childNode = await db.atlasNode.findUnique({ where: { id: childNodeId } });
    if (!childNode) throw new Error(`Child node ${childNodeId} not found`);

    await db.atlasFeature.update({
      where: { id: featureId },
      data: { childNodeId },
    });

    await db.atlasNode.update({
      where: { id: childNodeId },
      data: { parentFeatureId: featureId },
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  async function linkNodeToPage(nodeId: string, pageId: string) {
    return db.atlasNode.update({
      where: { id: nodeId },
      data: { pageId },
    });
  }

  /** Link (or unlink) an AtlasFeature to a wiki Page via linkedPageId. */
  async function linkFeatureToPage(featureId: string, pageId: string | null) {
    return db.atlasFeature.update({
      where: { id: featureId },
      data: { linkedPageId: pageId },
    });
  }

  return {
    getOrCreateAtlasForWorld,
    ensureBuiltinPaletteItems,
    getAtlasMap,
    updateAtlasMap,
    createNode,
    getNode,
    updateNode,
    deleteNode,
    deleteNodeSubtree,
    listNodesForMap,
    createFeature,
    getFeature,
    updateFeature,
    deleteFeature,
    listFeaturesForNode,
    createObject,
    getObject,
    updateObject,
    deleteObject,
    listObjectsForNode,
    listPaletteItems,
    createPaletteItem,
    approvePaletteItem,
    getAtlasForContext,
    linkNodeToPage,
    linkFeatureToPage,
    isAtlasEntityAccessible,
    createChildNode,
    getNodeWithHierarchy,
    linkFeatureToChildNode,
  };
}

export type AtlasService = ReturnType<typeof createAtlasService>;
