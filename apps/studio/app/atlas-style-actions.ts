"use server";

import {
  createAtlasService,
  createPrismaClient,
  getAppRepository,
  type UpdateAtlasMapInput,
} from "@uwe/database/server";
import { STYLE_PRESETS } from "@uwe/atlas/style-presets";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";

/**
 * Persist the map-wide style preset (theme) chosen in the editor's theme
 * picker. Validated against STYLE_PRESETS; deliberately NO revalidatePath —
 * the editor applies the theme live and a remount would reset the iframe.
 */
export async function setAtlasMapStyleAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const stylePreset = String(formData.get("stylePreset") || "");
  if (!Object.prototype.hasOwnProperty.call(STYLE_PRESETS, stylePreset)) {
    throw new Error(`Unbekanntes Style-Preset: ${stylePreset}`);
  }

  const db = createPrismaClient();
  const atlas = createAtlasService(db);
  const repo = getAppRepository();

  try {
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) throw new Error("Welt nicht gefunden");
    const map = await atlas.getOrCreateAtlasForWorld(world.id);
    await atlas.updateAtlasMap(map.id, { stylePreset } satisfies UpdateAtlasMapInput);
  } finally {
    await db.$disconnect();
  }
}
