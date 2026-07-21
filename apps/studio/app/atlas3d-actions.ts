"use server";

import { createPrismaClient } from "@uwe/database/server";
import { createAtlas3DService } from "@uwe/database/atlas3d";
import { parseCarveOps, serializeCarveOps } from "@uwe/atlas-editor/carve";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";

/**
 * Atlas 3D server actions — separate file by design: the legacy
 * atlas-actions.ts is frozen at its size baseline and must not grow.
 * Atlas 3D content is entirely player-visible (owner decision 2026-07-21),
 * so there is no visibility handling here.
 */

export interface SaveAtlas3DTerrainResult {
  ok: boolean;
  error?: string;
}

async function requireNodeInWorld(worldSlug: string, nodeId: string) {
  const db = createPrismaClient();
  const atlas3d = createAtlas3DService(db);
  const chain = await atlas3d.getNodeChain(nodeId);
  if (!chain) throw new Error("Atlas-3D-Ebene nicht gefunden");
  const world = await db.world.findUnique({ where: { slug: worldSlug }, select: { id: true } });
  if (!world || chain.atlasWorld.worldId !== world.id) {
    throw new Error("Atlas-3D-Ebene gehört nicht zu dieser Welt");
  }
  return { db, atlas3d, chain };
}

/**
 * Persist the sculpted terrain document of a node: carve operations and the
 * sculpt heightmap (as JSON in terrain.meta until the asset pipeline lands in
 * phase 2). No revalidatePath — the editor owns the live scene; a remount
 * would reset the camera.
 */
export async function saveAtlas3DTerrainAction(formData: FormData): Promise<SaveAtlas3DTerrainResult> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const nodeId = String(formData.get("nodeId"));
  try {
    const { atlas3d } = await requireNodeInWorld(worldSlug, nodeId);

    // Round-trip through the validator: unknown/invalid ops are dropped, key
    // order is normalized — the stored list is always deterministic.
    const carveOps = parseCarveOps(JSON.parse(String(formData.get("carveOps") || "[]")));
    const heightmapRaw = String(formData.get("heightmap") || "null");
    const heightmap: unknown = JSON.parse(heightmapRaw);

    const splitOp = carveOps.find((op) => op.kind === "split");
    await atlas3d.saveTerrain(nodeId, {
      carveOps: JSON.parse(serializeCarveOps(carveOps)),
      meta: {
        heightmap: heightmap ?? null,
        splitGap: splitOp?.kind === "split" ? splitOp.gap : 0,
      },
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Speichern fehlgeschlagen" };
  }
}

/** Update node title or seed from the inspector. */
export async function updateAtlas3DNodeAction(formData: FormData): Promise<SaveAtlas3DTerrainResult> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const nodeId = String(formData.get("nodeId"));
  try {
    const { atlas3d } = await requireNodeInWorld(worldSlug, nodeId);
    const title = formData.get("title");
    const seed = formData.get("seed");
    await atlas3d.updateNode(nodeId, {
      title: title !== null ? String(title) : undefined,
      seed: seed !== null ? Number(seed) : undefined,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Speichern fehlgeschlagen" };
  }
}
