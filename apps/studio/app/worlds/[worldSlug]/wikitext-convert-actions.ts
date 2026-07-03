"use server";

import { revalidatePath } from "next/cache";
import {
  createWikitextConvertService,
  prisma,
  type WikitextConvertApplyResult,
} from "@uwe/database/server";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";

export interface WikitextConvertPreviewPageView {
  pageTitle: string;
  pageHref: string;
  blocks: Array<{
    blockId: string;
    blockType: string;
    structured: boolean;
    addedLinks: Array<{ target: string; matched: string }>;
  }>;
}

export interface WikitextConvertPreviewView {
  totalPages: number;
  totalBlocks: number;
  changedBlockCount: number;
  structuredBlockCount: number;
  addedLinkCount: number;
  pages: WikitextConvertPreviewPageView[];
}

/** Dry run for "Alle Wikitexte konvertieren" — computes changes, writes nothing. */
export async function previewWikitextConversionAction(
  worldSlug: string,
): Promise<WikitextConvertPreviewView> {
  await requireStudioActionAuth();
  await requireStudioWorldEdit(worldSlug);

  const preview = await createWikitextConvertService(prisma).previewWorldConversion(
    worldSlug,
  );
  if (!preview) {
    throw new Error("Welt nicht gefunden.");
  }

  const pages = new Map<string, WikitextConvertPreviewPageView>();
  for (const block of preview.changedBlocks) {
    const entry = pages.get(block.pageId) ?? {
      pageTitle: block.pageTitle,
      pageHref: block.pageHref,
      blocks: [],
    };
    entry.blocks.push({
      blockId: block.blockId,
      blockType: block.blockType,
      structured: block.structured,
      addedLinks: block.addedLinks,
    });
    pages.set(block.pageId, entry);
  }

  return {
    totalPages: preview.totalPages,
    totalBlocks: preview.totalBlocks,
    changedBlockCount: preview.changedBlocks.length,
    structuredBlockCount: preview.structuredBlockCount,
    addedLinkCount: preview.addedLinkCount,
    pages: [...pages.values()],
  };
}

/** Applies the conversion for all wiki texts of the world (undoable). */
export async function applyWikitextConversionAction(
  worldSlug: string,
): Promise<WikitextConvertApplyResult> {
  await requireStudioActionAuth();
  await requireStudioWorldEdit(worldSlug);

  const result = await createWikitextConvertService(prisma).applyWorldConversion(
    worldSlug,
  );

  if (result.ok && result.changedBlockCount > 0) {
    revalidatePath(`/worlds/${worldSlug}`);
    revalidatePath(`/worlds/${worldSlug}/import`);
    revalidatePath(`/worlds/${worldSlug}/graph`);
  }

  return result;
}
