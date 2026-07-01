"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createPrismaClient,
  createQuestLifecycleService,
  getAppRepository,
  type QuestLifecycleStatus,
} from "@uwe/database/server";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioContentEdit } from "@/src/lib/authz";

function editPath(worldSlug: string, category: string, pageSlug: string) {
  return `/worlds/${worldSlug}/${category}/${pageSlug}/edit`;
}

const VALID_STATUSES = new Set<QuestLifecycleStatus | "">(["", "open", "completed", "failed"]);

export async function updateQuestStatusAction(formData: FormData) {
  await requireStudioActionAuth();

  const worldSlug = String(formData.get("worldSlug"));
  const pageId = String(formData.get("pageId"));
  const pageSlug = String(formData.get("pageSlug"));
  const category = String(formData.get("category"));
  const rawStatus = String(formData.get("questStatus") ?? "");

  if (!VALID_STATUSES.has(rawStatus as QuestLifecycleStatus | "")) {
    throw new Error("Ungültiger Quest-Status.");
  }

  await requireStudioContentEdit(worldSlug, pageId);

  const db = createPrismaClient();
  try {
    const repo = getAppRepository();
    const page = await repo.getPageById(pageId);
    if (!page || page.type !== "quest") {
      throw new Error("Quest-Status ist nur für Quest-Seiten verfügbar.");
    }

    const quests = createQuestLifecycleService(db);
    await quests.updateQuestStatus(
      pageId,
      rawStatus === "" ? null : (rawStatus as QuestLifecycleStatus),
    );
  } finally {
    await db.$disconnect();
  }

  revalidatePath(editPath(worldSlug, category, pageSlug));
  redirect(`${editPath(worldSlug, category, pageSlug)}?saved=1`);
}
