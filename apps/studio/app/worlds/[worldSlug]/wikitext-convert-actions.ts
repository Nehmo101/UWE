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

export interface WikitextConvertTypeChangeView {
  pageId: string;
  pageTitle: string;
  pageHref: string;
  fromType: string;
  toType: string;
}

export interface WikitextConvertPreviewView {
  totalPages: number;
  totalBlocks: number;
  changedBlockCount: number;
  structuredBlockCount: number;
  addedLinkCount: number;
  typeChangeCount: number;
  pages: WikitextConvertPreviewPageView[];
  typeChanges: WikitextConvertTypeChangeView[];
}

export interface WikitextConvertActionOptions {
  /** Seitentyp aus Titel/Inhalt/Tags ableiten. */
  detectType?: boolean;
  /** Nur diese Seiten konvertieren (Massenaktion aus der Seitentabelle), statt der ganzen Welt. */
  pageIds?: string[];
}

/** Dry run for "Alle Wikitexte konvertieren" / die Massenaktion — computes changes, writes nothing. */
export async function previewWikitextConversionAction(
  worldSlug: string,
  options?: WikitextConvertActionOptions,
): Promise<WikitextConvertPreviewView> {
  await requireStudioActionAuth();
  await requireStudioWorldEdit(worldSlug);

  const preview = await createWikitextConvertService(prisma).previewWorldConversion(
    worldSlug,
    { detectType: options?.detectType ?? false, pageIds: options?.pageIds },
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
    typeChangeCount: preview.typeChanges.length,
    pages: [...pages.values()],
    typeChanges: preview.typeChanges.map((change) => ({
      pageId: change.pageId,
      pageTitle: change.pageTitle,
      pageHref: change.pageHref,
      fromType: change.fromType,
      toType: change.toType,
    })),
  };
}

/** Applies the conversion for all (or selected) wiki texts of the world (undoable). */
export async function applyWikitextConversionAction(
  worldSlug: string,
  options?: WikitextConvertActionOptions,
): Promise<WikitextConvertApplyResult> {
  await requireStudioActionAuth();
  await requireStudioWorldEdit(worldSlug);

  const result = await createWikitextConvertService(prisma).applyWorldConversion(
    worldSlug,
    { detectType: options?.detectType ?? false, pageIds: options?.pageIds },
  );

  if (result.ok && result.changedBlockCount > 0) {
    revalidatePath(`/worlds/${worldSlug}`);
    revalidatePath(`/worlds/${worldSlug}/import`);
    revalidatePath(`/worlds/${worldSlug}/graph`);
  }

  return result;
}
