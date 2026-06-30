"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createAtlasService,
  createPrismaClient,
  getAppRepository,
  type CreateAtlasFeatureInput,
  type CreateAtlasNodeInput,
  type UpdateAtlasFeatureInput,
  type UpdateAtlasNodeInput,
} from "@uwe/database/server";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";

function getAtlasDeps() {
  const db = createPrismaClient();
  return { db, atlas: createAtlasService(db), repo: getAppRepository() };
}

// ---------------------------------------------------------------------------
// Atlas map / node bootstrap
// ---------------------------------------------------------------------------

/**
 * Ensures an AtlasMap exists for the world and returns its first continent
 * node (creating one if needed), then redirects to the editor.
 */
export async function ensureAtlasAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const { db, atlas, repo } = getAtlasDeps();
  let nodeId: string;

  try {
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) throw new Error("Welt nicht gefunden");

    const map = await atlas.getOrCreateAtlasForWorld(world.id);

    const nodes = await atlas.listNodesForMap(map.id);
    let continentNode = nodes.find((n) => n.level === "continent");

    if (!continentNode) {
      continentNode = await atlas.createNode({
        mapId: map.id,
        level: "continent",
        title: world.name,
        visibility: "dm_only",
        sortOrder: 0,
      } satisfies CreateAtlasNodeInput);
    }
    nodeId = continentNode.id;
  } finally {
    await db.$disconnect();
  }

  redirect(`/worlds/${worldSlug}/atlas/${nodeId}`);
}

// ---------------------------------------------------------------------------
// AtlasNode
// ---------------------------------------------------------------------------

export async function createAtlasNodeAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const { db, atlas, repo } = getAtlasDeps();
  let nodeId: string;

  try {
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) throw new Error("Welt nicht gefunden");

    const map = await atlas.getOrCreateAtlasForWorld(world.id);
    const title = String(formData.get("title") || "Neuer Knoten").trim();
    const parentId = String(formData.get("parentId") || "") || null;
    const level = (String(formData.get("level") || "continent") as CreateAtlasNodeInput["level"]);

    const node = await atlas.createNode({
      mapId: map.id,
      parentId,
      level,
      title,
      visibility: "dm_only",
    } satisfies CreateAtlasNodeInput);
    nodeId = node.id;
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/atlas`);
  redirect(`/worlds/${worldSlug}/atlas/${nodeId}`);
}

export async function updateAtlasNodeAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const nodeId = String(formData.get("nodeId"));
  const title = String(formData.get("title") || "").trim() || undefined;

  const { db, atlas } = getAtlasDeps();

  try {
    await atlas.updateNode(nodeId, {
      title,
    } satisfies UpdateAtlasNodeInput);
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/atlas/${nodeId}`);
}

// ---------------------------------------------------------------------------
// AtlasFeature (polygon regions, rivers, labels, pins, …)
// ---------------------------------------------------------------------------

export async function saveAtlasFeaturesAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const nodeId = String(formData.get("nodeId"));
  const featuresJson = String(formData.get("features") || "[]");

  interface FeaturePayload {
    id?: string;
    kind: string;
    geometry: unknown;
    style?: unknown;
    labelText?: string | null;
    labelColor?: string | null;
    layer?: number;
    sortOrder?: number;
    visibility?: string;
  }

  let features: FeaturePayload[];
  try {
    features = JSON.parse(featuresJson) as FeaturePayload[];
  } catch {
    throw new Error("Ungültige Features-JSON");
  }

  const { db, atlas } = getAtlasDeps();

  try {
    const existing = await atlas.listFeaturesForNode(nodeId);
    const existingIds = new Set(existing.map((f) => f.id));
    const incomingIds = new Set(features.filter((f) => f.id).map((f) => f.id as string));

    // Delete features that were removed in the editor
    for (const old of existing) {
      if (!incomingIds.has(old.id)) {
        await atlas.deleteFeature(old.id);
      }
    }

    for (const feat of features) {
      const input: CreateAtlasFeatureInput = {
        nodeId,
        kind: feat.kind as CreateAtlasFeatureInput["kind"],
        geometry: feat.geometry as CreateAtlasFeatureInput["geometry"],
        style: feat.style as CreateAtlasFeatureInput["style"],
        labelText: feat.labelText ?? null,
        labelColor: feat.labelColor as CreateAtlasFeatureInput["labelColor"],
        layer: feat.layer ?? 0,
        sortOrder: feat.sortOrder ?? 0,
        visibility: (feat.visibility ?? "dm_only") as CreateAtlasFeatureInput["visibility"],
      };

      if (feat.id && existingIds.has(feat.id)) {
        const update: UpdateAtlasFeatureInput = {
          kind: input.kind,
          geometry: input.geometry,
          style: input.style,
          labelText: input.labelText,
          labelColor: input.labelColor,
          layer: input.layer,
          sortOrder: input.sortOrder,
          visibility: input.visibility,
        };
        await atlas.updateFeature(feat.id, update);
      } else {
        await atlas.createFeature(input);
      }
    }
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/atlas/${nodeId}`);
}

export async function deleteAtlasFeatureAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const featureId = String(formData.get("featureId"));
  const nodeId = String(formData.get("nodeId"));

  const { db, atlas } = getAtlasDeps();

  try {
    await atlas.deleteFeature(featureId);
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/atlas/${nodeId}`);
}

// ---------------------------------------------------------------------------
// AtlasObject (stamp/glyph placements)
// ---------------------------------------------------------------------------

export async function saveAtlasObjectsAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const nodeId = String(formData.get("nodeId"));
  const objectsJson = String(formData.get("objects") || "[]");

  interface ObjectPayload {
    id?: string;
    paletteItemId: string;
    x: number;
    y: number;
    scale?: number;
    rotation?: number;
    layer?: number;
    visibility?: string;
  }

  let objects: ObjectPayload[];
  try {
    objects = JSON.parse(objectsJson) as ObjectPayload[];
  } catch {
    throw new Error("Ungültige Objects-JSON");
  }

  const { db, atlas } = getAtlasDeps();

  try {
    const existing = await atlas.listObjectsForNode(nodeId);
    const existingIds = new Set(existing.map((o) => o.id));
    const incomingIds = new Set(objects.filter((o) => o.id).map((o) => o.id as string));

    for (const old of existing) {
      if (!incomingIds.has(old.id)) {
        await atlas.deleteObject(old.id);
      }
    }

    for (const obj of objects) {
      if (obj.id && existingIds.has(obj.id)) {
        await atlas.updateObject(obj.id, {
          paletteItemId: obj.paletteItemId,
          x: obj.x,
          y: obj.y,
          scale: obj.scale,
          rotation: obj.rotation,
          layer: obj.layer,
          visibility: (obj.visibility ?? "dm_only") as UpdateAtlasNodeInput["visibility"],
        });
      } else {
        await atlas.createObject({
          nodeId,
          paletteItemId: obj.paletteItemId,
          x: obj.x,
          y: obj.y,
          scale: obj.scale,
          rotation: obj.rotation,
          layer: obj.layer,
          visibility: (obj.visibility ?? "dm_only") as CreateAtlasFeatureInput["visibility"],
        });
      }
    }
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/atlas/${nodeId}`);
}
