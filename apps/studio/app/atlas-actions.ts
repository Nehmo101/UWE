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
import type { AtlasNodeLevel } from "@uwe/database/server";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";
import { generateDraft, rerollDraft } from "@uwe/atlas/procedural";
import type { AtlasDraft, ProceduralPromptHints, ProceduralBounds } from "@uwe/atlas/procedural";

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

// ---------------------------------------------------------------------------
// Drill-down hierarchy actions
// ---------------------------------------------------------------------------

/**
 * Create a child node for a parent feature (or return existing one) and
 * navigate to the child editor.  Called from the client with useTransition so
 * it can return the new nodeId without a server-side redirect.
 */
export async function createChildNodeAction(formData: FormData): Promise<{ nodeId: string }> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const parentNodeId = String(formData.get("parentNodeId"));
  const parentFeatureId = String(formData.get("parentFeatureId"));
  const level = String(formData.get("level") || "continent") as AtlasNodeLevel;
  const title = String(formData.get("title") || "Neuer Bereich").trim();

  const { db, atlas } = getAtlasDeps();

  let nodeId: string;
  try {
    const child = await atlas.createChildNode(parentNodeId, parentFeatureId, level, title);
    nodeId = child.id;
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/atlas`);
  revalidatePath(`/worlds/${worldSlug}/atlas/${parentNodeId}`);
  return { nodeId };
}

/**
 * Link an existing feature to an existing child node (used when re-linking
 * after manual node creation).
 */
export async function linkFeatureToChildNodeAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const featureId = String(formData.get("featureId"));
  const childNodeId = String(formData.get("childNodeId"));
  const parentNodeId = String(formData.get("parentNodeId"));

  const { db, atlas } = getAtlasDeps();

  try {
    await atlas.linkFeatureToChildNode(featureId, childNodeId);
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/atlas/${parentNodeId}`);
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

// ---------------------------------------------------------------------------
// Procedural draft generation
// ---------------------------------------------------------------------------

export interface GenerateAtlasDraftResult {
  draft: AtlasDraft;
  error?: never;
}
export interface GenerateAtlasDraftError {
  draft?: never;
  error: string;
}

/**
 * Generate a procedural map draft server-side from a seed and optional hints.
 * Pure computation — no DB access, no RTX required.
 * Returns the draft JSON for the client to preview and optionally apply.
 */
export async function generateAtlasDraftAction(
  formData: FormData,
): Promise<GenerateAtlasDraftResult | GenerateAtlasDraftError> {
  await requireStudioActionAuth();

  const worldSlug = String(formData.get("worldSlug") || "");
  if (worldSlug) {
    await requireStudioWorldEdit(worldSlug);
  }

  const seedRaw = String(formData.get("seed") || "");
  const seed = seedRaw ? (parseInt(seedRaw, 10) || hashString(seedRaw)) : Math.floor(Math.random() * 0xffffff);

  const hintsJson = String(formData.get("hints") || "{}");
  let hints: ProceduralPromptHints = {};
  try {
    hints = JSON.parse(hintsJson) as ProceduralPromptHints;
  } catch {
    // ignore bad JSON — use empty hints
  }

  const boundsJson = String(formData.get("bounds") || "null");
  let bounds: ProceduralBounds | undefined;
  try {
    const parsed = JSON.parse(boundsJson) as ProceduralBounds | null;
    if (parsed && typeof parsed.minX === "number") bounds = parsed;
  } catch {
    // use default bounds
  }

  const prevDraftJson = String(formData.get("prevDraft") || "null");
  const lockedIdsJson = String(formData.get("lockedIds") || "null");

  try {
    let draft: AtlasDraft;
    if (prevDraftJson !== "null") {
      const prevDraft = JSON.parse(prevDraftJson) as AtlasDraft;
      const lockedIds = lockedIdsJson !== "null"
        ? (JSON.parse(lockedIdsJson) as string[])
        : undefined;
      draft = rerollDraft(prevDraft, seed, lockedIds);
    } else {
      draft = generateDraft(seed, hints, bounds);
    }
    return { draft };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Generierung fehlgeschlagen" };
  }
}

/** Simple string hash for seed generation from a text phrase. */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

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
