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
  type PageType,
} from "@uwe/database/server";
import type { AtlasNodeLevel } from "@uwe/database/server";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";
import { generateDraft, rerollDraft } from "@uwe/atlas/procedural";
import type { AtlasDraft, ProceduralPromptHints, ProceduralBounds } from "@uwe/atlas/procedural";
import { runImageStudioTask, resolveImageProviderConfig } from "@uwe/image-studio";
import { assembleStampPrompt } from "@uwe/atlas/stamp-prompt";

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
    linkedPageId?: string | null;
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
        linkedPageId: feat.linkedPageId ?? null,
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
          linkedPageId: input.linkedPageId,
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

// ---------------------------------------------------------------------------
// Pin → Page linking
// ---------------------------------------------------------------------------

/**
 * Link a pin feature (by featureId) to an existing wiki page (by pageId).
 */
export async function linkPinToPageAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const featureId = String(formData.get("featureId"));
  const pageId = String(formData.get("pageId")) || null;
  const nodeId = String(formData.get("nodeId"));

  const { db, atlas } = getAtlasDeps();
  try {
    await atlas.linkFeatureToPage(featureId, pageId);
  } finally {
    await db.$disconnect();
  }
  revalidatePath(`/worlds/${worldSlug}/atlas/${nodeId}`);
}

/**
 * Create a new wiki page (region or location type) and link the given pin feature to it.
 * Returns the new pageId so the client can store it in the EditorFeature.
 */
export async function createPinPageAction(
  formData: FormData,
): Promise<{ pageId: string; pageSlug: string }> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const featureId = String(formData.get("featureId"));
  const nodeId = String(formData.get("nodeId"));
  const title = String(formData.get("title") || "Unbenannter Ort").trim();
  const pageType = (String(formData.get("pageType") || "location") as PageType);

  const { db, atlas, repo } = getAtlasDeps();
  let pageId: string;
  let pageSlug: string;
  try {
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) throw new Error("Welt nicht gefunden");

    // Build a URL-safe slug from the title
    const slug =
      title
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .slice(0, 60) || `pin-${Date.now()}`;

    const page = await repo.createPage({
      worldId: world.id,
      title,
      slug,
      type: pageType,
      visibility: "dm_only",
    });
    pageId = page.id;
    pageSlug = page.slug;

    if (featureId) {
      await atlas.linkFeatureToPage(featureId, pageId);
    }
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/atlas/${nodeId}`);
  return { pageId, pageSlug };
}

// ---------------------------------------------------------------------------
// Export PNG → Handout stub
// ---------------------------------------------------------------------------

/**
 * Create a handout page stub linked to the current atlas node.
 * Returns the new handout page URL for the client to redirect to.
 */
export async function createAtlasHandoutPageAction(
  formData: FormData,
): Promise<{ pageId: string; pageSlug: string }> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const nodeId = String(formData.get("nodeId"));
  const title = String(formData.get("title") || "Karten-Handout").trim();

  const { db, atlas, repo } = getAtlasDeps();
  let pageId: string;
  let pageSlug: string;
  try {
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) throw new Error("Welt nicht gefunden");

    const slug =
      `handout-${title
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .slice(0, 50)}-${Date.now() % 10000}`;

    const page = await repo.createPage({
      worldId: world.id,
      title,
      slug,
      type: "handout" as PageType,
      visibility: "dm_only",
      summary: `Karten-Handout für Atlas-Knoten ${nodeId}`,
    });
    pageId = page.id;
    pageSlug = page.slug;

    // Link the atlas node to the handout page
    await atlas.linkNodeToPage(nodeId, pageId);
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/atlas/${nodeId}`);
  revalidatePath(`/worlds/${worldSlug}/pages`);
  return { pageId, pageSlug };
}

// ---------------------------------------------------------------------------
// Background image underlay
// ---------------------------------------------------------------------------

/** Set (or clear) the backgroundAssetId on an atlas node. */
export async function setNodeBackgroundAssetAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const nodeId = String(formData.get("nodeId"));
  const assetId = String(formData.get("assetId") || "") || null;

  const { db, atlas } = getAtlasDeps();
  try {
    await atlas.updateNode(nodeId, { backgroundAssetId: assetId } satisfies UpdateAtlasNodeInput);
  } finally {
    await db.$disconnect();
  }
  revalidatePath(`/worlds/${worldSlug}/atlas/${nodeId}`);
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

// ---------------------------------------------------------------------------
// AI Stamp Generation — P5
// ---------------------------------------------------------------------------

export interface StampVariantResult {
  imageBase64: string;
  mimeType: string;
  prompt: string;
  providerUsed: string;
}

export interface GenerateAtlasStampVariantsSuccess {
  variants: StampVariantResult[];
  error?: never;
}
export interface GenerateAtlasStampVariantsError {
  variants?: never;
  error: string;
}

/**
 * Generate 5 AI stamp image variants from a keyword.
 *
 * Uses `runImageStudioTask` with `contextMode=prompt_only` so no world/brain
 * data is injected into the cloud prompt.  All 5 calls run in parallel.
 *
 * Returns base64-encoded PNG images for client preview and optional save.
 */
export async function generateAtlasStampVariantsAction(
  formData: FormData,
): Promise<GenerateAtlasStampVariantsSuccess | GenerateAtlasStampVariantsError> {
  await requireStudioActionAuth();

  const worldSlug = String(formData.get("worldSlug") || "");
  if (worldSlug) {
    await requireStudioWorldEdit(worldSlug);
  }

  const keyword = String(formData.get("keyword") || "").trim();
  if (!keyword) {
    return { error: "Keyword ist erforderlich." };
  }

  const prompt = assembleStampPrompt(keyword);
  const config = resolveImageProviderConfig();

  const VARIANT_COUNT = 5;

  const jobs = Array.from({ length: VARIANT_COUNT }, () =>
    runImageStudioTask(
      {
        task: "generate",
        prompt,
        contextMode: "prompt_only",
        width: 512,
        height: 512,
      },
      config,
    ),
  );

  const settled = await Promise.allSettled(jobs);

  const variants: StampVariantResult[] = [];
  const errors: string[] = [];

  for (const result of settled) {
    if (result.status === "rejected") {
      errors.push(String(result.reason));
      continue;
    }
    const r = result.value;
    if (!r.success || !r.imageBase64) {
      errors.push(r.error ?? "Unbekannter Fehler");
      continue;
    }
    variants.push({
      imageBase64: r.imageBase64,
      mimeType: r.mimeType ?? "image/png",
      prompt,
      providerUsed: r.providerUsed,
    });
  }

  if (variants.length === 0) {
    return {
      error:
        errors[0] ??
        "KI-Bildgenerierung nicht verfügbar. RTX Agent offline und Cloud-KI nicht konfiguriert.",
    };
  }

  return { variants };
}

export interface SaveAtlasStampVariantsSuccess {
  savedIds: string[];
  error?: never;
}
export interface SaveAtlasStampVariantsError {
  savedIds?: never;
  error: string;
}

/**
 * Save selected AI stamp variants as AtlasPaletteItems.
 *
 * Each item is saved with `source=ai` and `reviewStatus=pending` until the DM
 * approves it via `approveAtlasPaletteItemAction`.
 *
 * The base64 image data is stored in `styleTags` so that the Atlas editor can
 * render it without a separate asset upload round-trip.
 */
export async function saveAtlasStampVariantsAction(
  formData: FormData,
): Promise<SaveAtlasStampVariantsSuccess | SaveAtlasStampVariantsError> {
  await requireStudioActionAuth();

  const worldSlug = String(formData.get("worldSlug") || "");
  await requireStudioWorldEdit(worldSlug);

  const keyword = String(formData.get("keyword") || "").trim();
  const nodeId = String(formData.get("nodeId") || "").trim();

  const variantsJson = String(formData.get("variants") || "[]");
  let variants: Array<{ imageBase64: string; mimeType: string; prompt: string }>;
  try {
    variants = JSON.parse(variantsJson) as Array<{
      imageBase64: string;
      mimeType: string;
      prompt: string;
    }>;
  } catch {
    return { error: "Ungültige Varianten-JSON" };
  }

  if (!variants.length) {
    return { error: "Keine Varianten zum Speichern ausgewählt." };
  }

  const { db, atlas, repo } = getAtlasDeps();
  const savedIds: string[] = [];

  try {
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) return { error: "Welt nicht gefunden" };

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i]!;
      const item = await atlas.createPaletteItem({
        worldId: world.id,
        name: keyword ? `${keyword} ${i + 1}` : `KI-Stempel ${i + 1}`,
        kind: "ai_stamp",
        source: "ai",
        reviewStatus: "pending",
        styleTags: {
          imageData: v.imageBase64,
          mimeType: v.mimeType,
          prompt: v.prompt,
          keyword,
        },
      });
      savedIds.push(item.id);
    }
  } finally {
    await db.$disconnect();
  }

  if (nodeId) {
    revalidatePath(`/worlds/${worldSlug}/atlas/${nodeId}`);
  }
  revalidatePath(`/worlds/${worldSlug}/atlas`);

  return { savedIds };
}

/**
 * Approve a pending AtlasPaletteItem (AI stamp review).
 */
export async function approveAtlasPaletteItemAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();

  const worldSlug = String(formData.get("worldSlug") || "");
  await requireStudioWorldEdit(worldSlug);

  const itemId = String(formData.get("itemId") || "");
  const nodeId = String(formData.get("nodeId") || "");

  const { db, atlas } = getAtlasDeps();

  try {
    await atlas.approvePaletteItem(itemId);
  } finally {
    await db.$disconnect();
  }

  if (nodeId) {
    revalidatePath(`/worlds/${worldSlug}/atlas/${nodeId}`);
  }
  revalidatePath(`/worlds/${worldSlug}/atlas`);
}

/**
 * Delete an AtlasPaletteItem (remove AI stamp from palette).
 */
export async function deleteAtlasPaletteItemAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();

  const worldSlug = String(formData.get("worldSlug") || "");
  await requireStudioWorldEdit(worldSlug);

  const itemId = String(formData.get("itemId") || "");
  const nodeId = String(formData.get("nodeId") || "");

  const { db } = getAtlasDeps();

  try {
    await db.atlasPaletteItem.delete({ where: { id: itemId } });
  } finally {
    await db.$disconnect();
  }

  if (nodeId) {
    revalidatePath(`/worlds/${worldSlug}/atlas/${nodeId}`);
  }
  revalidatePath(`/worlds/${worldSlug}/atlas`);
}
