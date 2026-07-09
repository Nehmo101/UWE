"use server";

import { revalidateWorldRootAndWiki } from "@/src/lib/world-revalidate";
import { redirect } from "next/navigation";
import {
  createUweRepositoryFromClient,
  prisma,
  slugifyPageTitle,
} from "@uwe/database/server";
import {
  buildOneShotOutline,
  serializeOneShotOutline,
  type OneShotTone,
} from "@uwe/ai-brain";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";

export async function saveOneShotDraftAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug") || "");
  const worldId = String(formData.get("worldId") || "");
  const worldName = String(formData.get("worldName") || "");
  await requireStudioWorldEdit(worldSlug);

  const outline = buildOneShotOutline({
    worldName,
    worldSlug,
    locationName: String(formData.get("location") || ""),
    tone: String(formData.get("tone") || "mystery") as OneShotTone,
    npcs: formData
      .getAll("npc")
      .map((value) => String(value).trim())
      .filter(Boolean)
      .map((name) => ({ name })),
  });

  const repo = createUweRepositoryFromClient(prisma);
  const page = await repo.createPage({
    worldId,
    title: outline.title,
    slug: slugifyPageTitle(`${outline.title}-${Date.now()}`),
    type: "quest",
    summary: outline.hook,
    canonicalStatus: "draft",
    publishStatus: "draft",
    questStatus: "open",
    contentBlocks: [
      { type: "player_text", sortOrder: 0, content: outline.playerBrief, visibility: "player_visible" },
      { type: "gm_note", sortOrder: 1, content: serializeOneShotOutline(outline), visibility: "dm_only" },
    ],
  });

  revalidateWorldRootAndWiki(worldSlug);
  redirect(`/worlds/${worldSlug}/quest/${page.slug}/edit`);
}
