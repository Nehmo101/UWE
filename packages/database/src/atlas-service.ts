import type {
  AtlasFeatureKind,
  AtlasLabelColor,
  AtlasNodeLevel,
  AtlasPaletteReviewStatus,
  AtlasPaletteSource,
  Prisma,
  Visibility,
} from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import {
  isDmOnlyVisibility,
  isPlayerPortalVisibility,
} from "./content-access";
import type { AccessContext } from "./permissions";

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

  async function getOrCreateAtlasForWorld(worldId: string) {
    const existing = await db.atlasMap.findUnique({ where: { worldId } });
    if (existing) return existing;
    return db.atlasMap.create({
      data: { worldId },
    });
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
  // Helpers
  // -------------------------------------------------------------------------

  async function linkNodeToPage(nodeId: string, pageId: string) {
    return db.atlasNode.update({
      where: { id: nodeId },
      data: { pageId },
    });
  }

  return {
    getOrCreateAtlasForWorld,
    getAtlasMap,
    updateAtlasMap,
    createNode,
    getNode,
    updateNode,
    deleteNode,
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
    isAtlasEntityAccessible,
  };
}

export type AtlasService = ReturnType<typeof createAtlasService>;
