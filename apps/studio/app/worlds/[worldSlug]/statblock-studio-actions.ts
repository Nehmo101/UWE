"use server";

import { revalidatePath } from "next/cache";
import {
  createPrismaClient,
  createStructuredStatblockService,
  getAppRepository,
  type Prisma,
} from "@uwe/database/server";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioContentEdit } from "@/src/lib/authz";

function editPath(worldSlug: string, category: string, pageSlug: string) {
  return `/worlds/${worldSlug}/${category}/${pageSlug}/edit`;
}

export async function upsertStatblockAction(input: {
  worldSlug: string;
  pageId: string;
  pageSlug: string;
  category: string;
  rulesEdition: string;
  dataJson: string;
}) {
  await requireStudioActionAuth();
  await requireStudioContentEdit(input.worldSlug, input.pageId);

  let data: Prisma.InputJsonValue;
  try {
    data = JSON.parse(input.dataJson) as Prisma.InputJsonValue;
  } catch {
    throw new Error("Statblock JSON ist ungültig.");
  }

  const db = createPrismaClient();
  try {
    const repo = getAppRepository();
    const world = await repo.getWorldBySlug(input.worldSlug);
    if (!world) {
      throw new Error("Welt nicht gefunden.");
    }

    const page = await repo.getPageById(input.pageId);
    if (!page || (page.type !== "monster" && page.type !== "npc")) {
      throw new Error("Statblock Studio ist nur für Monster- und NPC-Seiten verfügbar.");
    }

    const statblocks = createStructuredStatblockService(db);
    await statblocks.upsert({
      worldId: world.id,
      pageId: input.pageId,
      data,
      rulesEdition: input.rulesEdition === "dnd5e_2014" ? "dnd5e_2014" : "dnd5e_2024",
    });
  } finally {
    await db.$disconnect();
  }

  revalidatePath(editPath(input.worldSlug, input.category, input.pageSlug));
}
