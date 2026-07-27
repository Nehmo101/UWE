import type { PrismaClient } from "./client";
import { toPrismaJsonValue } from "./json-utils";

interface PageBlockSnapshot {
  id: string;
  pageId: string;
  assetId: string | null;
  type: string;
  sortOrder: number;
  content: string;
  visibility: string;
  metadata: unknown;
}

export interface PageContentReplaceSnapshot {
  kind: "page";
  page: {
    id: string;
    worldId: string;
    campaignId: string | null;
    parentPageId: string | null;
    title: string;
    slug: string;
    type: string;
    summary: string | null;
    visibility: string;
    canonicalStatus: string;
    aiReviewedAt?: Date | null;
    tags: unknown;
    aliases: unknown;
  };
  blocks: PageBlockSnapshot[];
}

export async function capturePageContentReplaceUndo(db: PrismaClient, pageId: string) {
  const page = await db.page.findUnique({
    where: { id: pageId },
    include: { contentBlocks: { orderBy: { sortOrder: "asc" } } },
  });
  if (!page) throw new Error(`Seite ${pageId} nicht gefunden.`);

  const snapshot: PageContentReplaceSnapshot = {
    kind: "page",
    page: {
      id: page.id,
      worldId: page.worldId,
      campaignId: page.campaignId,
      parentPageId: page.parentPageId,
      title: page.title,
      slug: page.slug,
      type: page.type,
      summary: page.summary,
      visibility: page.visibility,
      canonicalStatus: page.canonicalStatus,
      aiReviewedAt: page.aiReviewedAt,
      tags: page.tags,
      aliases: page.aliases,
    },
    blocks: page.contentBlocks.map((block) => ({
      id: block.id,
      pageId: block.pageId,
      assetId: block.assetId,
      type: block.type,
      sortOrder: block.sortOrder,
      content: block.content,
      visibility: block.visibility,
      metadata: block.metadata,
    })),
  };

  return db.undoEntry.create({
    data: {
      worldId: page.worldId,
      operation: "page.content_replace",
      targetType: "page",
      targetId: page.id,
      snapshot: toPrismaJsonValue(snapshot),
    },
  });
}

export async function restorePageContentReplaceUndo(
  db: PrismaClient,
  snapshot: PageContentReplaceSnapshot,
): Promise<{ ok: boolean; message: string }> {
  const data = snapshot.page;
  const existing = await db.page.findUnique({ where: { id: data.id } });
  if (!existing) {
    return {
      ok: false,
      message: `Seite „${data.title}“ existiert nicht mehr — Undo nicht möglich.`,
    };
  }

  await db.page.update({
    where: { id: data.id },
    data: {
      canonicalStatus: data.canonicalStatus as never,
      aiReviewedAt: data.aiReviewedAt ?? null,
      tags: toPrismaJsonValue(data.tags),
      aliases: toPrismaJsonValue(data.aliases),
    },
  });

  await db.contentBlock.deleteMany({ where: { pageId: data.id } });
  if (snapshot.blocks.length > 0) {
    await db.contentBlock.createMany({
      data: snapshot.blocks.map((block) => ({
        id: block.id,
        pageId: block.pageId,
        assetId: block.assetId,
        type: block.type as never,
        sortOrder: block.sortOrder,
        content: block.content,
        visibility: block.visibility as never,
        metadata: toPrismaJsonValue(block.metadata),
      })),
    });
  }

  return { ok: true, message: `Seiteninhalt von „${data.title}“ wiederhergestellt.` };
}
