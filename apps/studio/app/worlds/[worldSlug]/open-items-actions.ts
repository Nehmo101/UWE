"use server";

import { revalidatePath } from "next/cache";
import {
  createPrismaClient,
  createQuestLifecycleService,
  getAppRepository,
} from "@uwe/database/server";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";

export async function bulkCloseOpenQuestsAction(formData: FormData) {
  await requireStudioActionAuth();

  const worldSlug = String(formData.get("worldSlug") ?? "").trim();
  if (!worldSlug) throw new Error("Welt fehlt.");

  await requireStudioWorldEdit(worldSlug);

  const itemIds = formData.getAll("itemIds").map(String).filter(Boolean);
  if (itemIds.length === 0) throw new Error("Keine Items ausgewählt.");

  const db = createPrismaClient();
  const repo = getAppRepository();
  const questService = createQuestLifecycleService(db);

  try {
    for (const pageId of itemIds) {
      const page = await repo.getPageById(pageId);
      if (!page || page.type !== "quest") continue;
      await questService.updateQuestStatus(pageId, "completed");
    }
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/open-items`);
  revalidatePath(`/worlds/${worldSlug}/radar`);
}
