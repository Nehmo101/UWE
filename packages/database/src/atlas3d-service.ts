import { Prisma } from "./generated/prisma/client";
import type { Atlas3DNode, Atlas3DWorld, AtlasNodeLevel } from "./generated/prisma/client";
import { pickUniqueSlug, slugifyDe } from "@uwe/shared-utils";
import type { PrismaClient } from "./client";

/**
 * Atlas 3D data access — thin repository layer for the new 3D world-builder.
 *
 * Atlas 3D content is entirely player-visible (owner decision 2026-07-21):
 * there are no visibility columns and therefore no per-entity filtering here.
 * Access control happens at the world membership level (Studio auth guards,
 * Portal world login) — never per atlas entity.
 *
 * Domain logic (inheritance resolution, carve validation, editor commands)
 * lives in @uwe/atlas-editor; this module only talks to the database.
 */

const ATLAS3D_LEVEL_ORDER: AtlasNodeLevel[] = ["globe", "continent", "landscape", "city"];
const MAX_CHAIN_DEPTH = 8;

export interface Atlas3DNodePatch {
  title?: string;
  seed?: number;
  environment?: Prisma.InputJsonValue | null;
  stylePresetOverride?: string | null;
  pageId?: string | null;
  sortOrder?: number;
  extent?: Prisma.InputJsonValue | null;
  silhouette?: Prisma.InputJsonValue | null;
}

export interface Atlas3DTerrainInput {
  carveOps?: Prisma.InputJsonValue | null;
  meta?: Prisma.InputJsonValue | null;
  heightmapAssetId?: string | null;
  splatmapAssetId?: string | null;
}

export interface Atlas3DObjectInput {
  id?: string;
  assetKind: string;
  assetParams?: Prisma.InputJsonValue | null;
  position: Prisma.InputJsonValue;
  scale?: number;
  rotation?: number;
  tint?: string | null;
  sortOrder?: number;
}

export interface Atlas3DFeatureInput {
  id?: string;
  kind: string;
  geometry: Prisma.InputJsonValue;
  style?: Prisma.InputJsonValue | null;
  labelText?: string | null;
  childNodeId?: string | null;
  linkedPageId?: string | null;
  sortOrder?: number;
}

export interface Atlas3DBookmarkInput {
  id?: string;
  name: string;
  pose: Prisma.InputJsonValue;
  sortOrder?: number;
}

export function createAtlas3DService(db: PrismaClient) {
  async function requireWorldBySlug(worldSlug: string) {
    const world = await db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) throw new Error(`world not found: ${worldSlug}`);
    return world;
  }

  /** Get or lazily create the Atlas3D world + its root globe node. */
  async function getOrCreateForWorld(worldSlug: string): Promise<{ atlasWorld: Atlas3DWorld; rootNode: Atlas3DNode }> {
    const world = await requireWorldBySlug(worldSlug);
    let atlasWorld = await db.atlas3DWorld.findUnique({ where: { worldId: world.id } });
    if (!atlasWorld) {
      atlasWorld = await db.atlas3DWorld.create({
        data: { worldId: world.id, title: `${world.name} — Atlas 3D` },
      });
    }
    let rootNode = await db.atlas3DNode.findFirst({
      where: { atlasWorldId: atlasWorld.id, level: "globe", parentId: null },
      orderBy: { createdAt: "asc" },
    });
    if (!rootNode) {
      rootNode = await db.atlas3DNode.create({
        data: {
          atlasWorldId: atlasWorld.id,
          level: "globe",
          title: world.name,
          slug: "globus",
        },
      });
    }
    return { atlasWorld, rootNode };
  }

  async function getAtlasWorldBySlug(worldSlug: string) {
    const world = await requireWorldBySlug(worldSlug);
    return db.atlas3DWorld.findUnique({
      where: { worldId: world.id },
      include: { nodes: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    });
  }

  function getNode(nodeId: string) {
    return db.atlas3DNode.findUnique({
      where: { id: nodeId },
      include: {
        terrain: true,
        features: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        objects: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        bookmarks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        children: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      },
    });
  }

  /**
   * Ancestor chain for inheritance, root-first: [atlasWorld, globe, …, node].
   * The caller maps this onto @uwe/atlas-editor chain entries.
   */
  async function getNodeChain(nodeId: string): Promise<{ atlasWorld: Atlas3DWorld; nodes: Atlas3DNode[] } | null> {
    const target = await db.atlas3DNode.findUnique({ where: { id: nodeId } });
    if (!target) return null;
    const atlasWorld = await db.atlas3DWorld.findUnique({ where: { id: target.atlasWorldId } });
    if (!atlasWorld) return null;
    const nodes: Atlas3DNode[] = [target];
    let current: Atlas3DNode = target;
    for (let depth = 0; depth < MAX_CHAIN_DEPTH && current.parentId; depth++) {
      const parent = await db.atlas3DNode.findUnique({ where: { id: current.parentId } });
      if (!parent) break;
      nodes.unshift(parent);
      current = parent;
    }
    return { atlasWorld, nodes };
  }

  /** Create a drill-down child under `parentId`, wiring the source feature both ways. */
  async function createChildNode(options: {
    parentId: string;
    title: string;
    sourceFeatureId?: string;
    extent?: Prisma.InputJsonValue | null;
    silhouette?: Prisma.InputJsonValue | null;
    seed?: number;
  }): Promise<Atlas3DNode> {
    const parent = await db.atlas3DNode.findUnique({ where: { id: options.parentId } });
    if (!parent) throw new Error(`atlas3d node not found: ${options.parentId}`);
    const levelIndex = ATLAS3D_LEVEL_ORDER.indexOf(parent.level);
    const childLevel = ATLAS3D_LEVEL_ORDER[levelIndex + 1];
    if (!childLevel) throw new Error(`cannot drill down below level ${parent.level}`);

    const siblings = await db.atlas3DNode.findMany({
      where: { atlasWorldId: parent.atlasWorldId },
      select: { slug: true },
    });
    const slug = pickUniqueSlug(
      slugifyDe(options.title, { fallback: "ebene" }),
      siblings.map((s) => s.slug),
    );

    const child = await db.atlas3DNode.create({
      data: {
        atlasWorldId: parent.atlasWorldId,
        parentId: parent.id,
        level: childLevel,
        title: options.title,
        slug,
        seed: options.seed ?? Math.floor(Math.random() * 2 ** 31),
        extent: options.extent ?? undefined,
        silhouette: options.silhouette ?? undefined,
      },
    });
    if (options.sourceFeatureId) {
      await db.atlas3DFeature.update({
        where: { id: options.sourceFeatureId },
        data: { childNodeId: child.id },
      });
    }
    return child;
  }

  function updateNode(nodeId: string, patch: Atlas3DNodePatch): Promise<Atlas3DNode> {
    return db.atlas3DNode.update({
      where: { id: nodeId },
      data: {
        title: patch.title,
        seed: patch.seed,
        environment: patch.environment === null ? Prisma.DbNull : patch.environment,
        stylePresetOverride: patch.stylePresetOverride,
        pageId: patch.pageId,
        sortOrder: patch.sortOrder,
        extent: patch.extent === null ? Prisma.DbNull : patch.extent,
        silhouette: patch.silhouette === null ? Prisma.DbNull : patch.silhouette,
      },
    });
  }

  async function updateAtlasWorld(
    atlasWorldId: string,
    patch: { title?: string; stylePreset?: string; environment?: Prisma.InputJsonValue | null; projection?: Prisma.InputJsonValue | null; seed?: number },
  ): Promise<Atlas3DWorld> {
    return db.atlas3DWorld.update({
      where: { id: atlasWorldId },
      data: {
        title: patch.title,
        stylePreset: patch.stylePreset,
        environment: patch.environment === null ? Prisma.DbNull : patch.environment,
        projection: patch.projection === null ? Prisma.DbNull : patch.projection,
        seed: patch.seed,
      },
    });
  }

  /** Delete a node and its whole subtree, leaf-first (FK-safe). */
  async function deleteNodeSubtree(nodeId: string): Promise<number> {
    const layers: string[][] = [[nodeId]];
    const seen = new Set<string>([nodeId]);
    for (let depth = 0; depth < MAX_CHAIN_DEPTH; depth++) {
      const children = await db.atlas3DNode.findMany({
        where: { parentId: { in: layers[layers.length - 1] } },
        select: { id: true },
      });
      const next = children.map((c) => c.id).filter((id) => !seen.has(id));
      if (next.length === 0) break;
      next.forEach((id) => seen.add(id));
      layers.push(next);
    }
    for (const layer of layers.reverse()) {
      await db.atlas3DNode.deleteMany({ where: { id: { in: layer } } });
    }
    return seen.size;
  }

  async function saveTerrain(nodeId: string, input: Atlas3DTerrainInput) {
    return db.atlas3DTerrain.upsert({
      where: { nodeId },
      create: {
        nodeId,
        carveOps: input.carveOps ?? undefined,
        meta: input.meta ?? undefined,
        heightmapAssetId: input.heightmapAssetId ?? undefined,
        splatmapAssetId: input.splatmapAssetId ?? undefined,
      },
      update: {
        carveOps: input.carveOps === null ? Prisma.DbNull : input.carveOps,
        meta: input.meta === null ? Prisma.DbNull : input.meta,
        heightmapAssetId: input.heightmapAssetId,
        splatmapAssetId: input.splatmapAssetId,
      },
    });
  }

  /** Replace-all save of a node's objects (the editor always sends the full set). */
  async function saveObjects(nodeId: string, objects: readonly Atlas3DObjectInput[]) {
    return db.$transaction(async (tx) => {
      const keepIds = objects.filter((o) => o.id).map((o) => o.id as string);
      await tx.atlas3DObject.deleteMany({
        where: keepIds.length > 0 ? { nodeId, id: { notIn: keepIds } } : { nodeId },
      });
      const saved = [];
      for (const [index, object] of objects.entries()) {
        const data = {
          nodeId,
          assetKind: object.assetKind,
          assetParams: object.assetParams ?? undefined,
          position: object.position,
          scale: object.scale ?? 1,
          rotation: object.rotation ?? 0,
          tint: object.tint ?? null,
          sortOrder: object.sortOrder ?? index,
        };
        saved.push(
          object.id
            ? await tx.atlas3DObject.upsert({ where: { id: object.id }, create: { id: object.id, ...data }, update: data })
            : await tx.atlas3DObject.create({ data }),
        );
      }
      return saved;
    });
  }

  /**
   * Replace-all save of a node's features. With `options.kinds` the replace
   * scope is restricted to those kinds — e.g. the editor saves
   * river/road/label without touching drill-down "region" features.
   */
  async function saveFeatures(
    nodeId: string,
    features: readonly Atlas3DFeatureInput[],
    options?: { kinds?: readonly string[] },
  ) {
    return db.$transaction(async (tx) => {
      const keepIds = features.filter((f) => f.id).map((f) => f.id as string);
      await tx.atlas3DFeature.deleteMany({
        where: {
          nodeId,
          ...(options?.kinds ? { kind: { in: [...options.kinds] } } : {}),
          ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {}),
        },
      });
      const saved = [];
      for (const [index, feature] of features.entries()) {
        const data = {
          nodeId,
          kind: feature.kind,
          geometry: feature.geometry,
          style: feature.style ?? undefined,
          labelText: feature.labelText ?? null,
          childNodeId: feature.childNodeId ?? null,
          linkedPageId: feature.linkedPageId ?? null,
          sortOrder: feature.sortOrder ?? index,
        };
        saved.push(
          feature.id
            ? await tx.atlas3DFeature.upsert({ where: { id: feature.id }, create: { id: feature.id, ...data }, update: data })
            : await tx.atlas3DFeature.create({ data }),
        );
      }
      return saved;
    });
  }

  /** Replace-all save of a node's camera bookmarks. */
  async function saveBookmarks(nodeId: string, bookmarks: readonly Atlas3DBookmarkInput[]) {
    return db.$transaction(async (tx) => {
      await tx.atlas3DCameraBookmark.deleteMany({ where: { nodeId } });
      const saved = [];
      for (const [index, bookmark] of bookmarks.entries()) {
        saved.push(
          await tx.atlas3DCameraBookmark.create({
            data: { nodeId, name: bookmark.name, pose: bookmark.pose, sortOrder: bookmark.sortOrder ?? index },
          }),
        );
      }
      return saved;
    });
  }

  /** Full player-visible read for the Portal viewer (identical data to Studio, read-only). */
  async function getForViewer(worldSlug: string) {
    const world = await requireWorldBySlug(worldSlug);
    return db.atlas3DWorld.findUnique({
      where: { worldId: world.id },
      include: {
        nodes: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: { terrain: true, features: true, objects: true, bookmarks: true },
        },
      },
    });
  }

  return {
    getOrCreateForWorld,
    getAtlasWorldBySlug,
    getNode,
    getNodeChain,
    createChildNode,
    updateNode,
    updateAtlasWorld,
    deleteNodeSubtree,
    saveTerrain,
    saveObjects,
    saveFeatures,
    saveBookmarks,
    getForViewer,
  };
}

export type Atlas3DService = ReturnType<typeof createAtlas3DService>;
