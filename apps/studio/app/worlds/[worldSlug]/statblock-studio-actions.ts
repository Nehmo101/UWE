"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createLabelService,
  createPrismaClient,
  createStructuredStatblockService,
  defaultElementsForMode,
  getAppRepository,
  type Prisma,
} from "@uwe/database/server";
import { exportStructuredStatblockHomebrewery } from "@uwe/dnd-api";
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

export async function createStatblockLabelAction(input: {
  worldSlug: string;
  pageId: string;
  pageSlug: string;
  category: string;
}) {
  await requireStudioActionAuth();
  await requireStudioContentEdit(input.worldSlug, input.pageId);

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
    const existing = await statblocks.getByPageId(input.pageId);
    if (!existing) {
      throw new Error("Kein strukturierter Statblock gespeichert — bitte zuerst speichern.");
    }

    const markdown = exportStructuredStatblockHomebrewery(existing.data);
    const labelService = createLabelService();
    const template = await labelService.getDefaultTemplate();

    const baseContent = {
      title: page.title,
      text: markdown,
      originalText: markdown,
      sourceTitle: page.title,
      containsDmOnly: false,
      dmOnlyBlockCount: 0,
      editorMode: "visual" as const,
    };

    const layoutSettings = {
      mode: "text_only" as const,
      truncateToPage: true,
      truncateLongWords: true,
      widthInches: 6,
      heightInches: 4,
    };

    const label = await labelService.createLabel({
      worldId: world.id,
      campaignId: page.campaignId,
      title: page.title,
      sourceType: "page",
      sourceId: input.pageId,
      templateId: template.id,
      content: {
        ...baseContent,
        elements: defaultElementsForMode(baseContent, layoutSettings.mode),
      },
      layoutSettings,
    });

    revalidatePath(`/worlds/${input.worldSlug}/labels`);
    redirect(`/worlds/${input.worldSlug}/labels/${label.id}?created=1&from=statblock`);
  } finally {
    await db.$disconnect();
  }
}
