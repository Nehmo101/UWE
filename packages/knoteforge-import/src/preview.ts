import type { UweRepository } from "@uwe/database/server";
import {
  buildAssetDuplicateIndex,
  buildExistingPageIndex,
  checkDuplicate,
  detectAssetConflicts,
} from "./duplicates";
import { mapEntityToPageDraft } from "./mapping";
import { resolveUniqueSlug } from "./slug";
import type {
  ImportFormat,
  ImportItemPreview,
  ImportPreviewResult,
  ImportStatus,
  NormalizedImportBundle,
} from "./types";

function emptySummary(): Record<ImportStatus, number> {
  return {
    new: 0,
    update: 0,
    duplicate: 0,
    conflict: 0,
    skipped: 0,
    error: 0,
  };
}

function makeItemId(index: number, knoteforgeId?: string): string {
  return knoteforgeId ? `kf:${knoteforgeId}` : `idx:${index}`;
}

/**
 * Builds an import preview without writing to the database.
 */
export async function previewImport(
  repo: UweRepository,
  bundle: NormalizedImportBundle,
  options: { worldSlug: string; format: ImportFormat },
): Promise<ImportPreviewResult> {
  const errors: string[] = [];
  const summary = emptySummary();
  const items: ImportItemPreview[] = [];

  const world = await repo.getWorldBySlug(options.worldSlug);
  if (!world) {
    return {
      worldSlug: options.worldSlug,
      format: options.format,
      totalEntities: bundle.entities.length,
      items: [],
      summary,
      errors: [`Welt „${options.worldSlug}" wurde nicht gefunden.`],
      canExecute: false,
    };
  }

  const existingPages = await repo.listPagesByWorld(options.worldSlug);
  const existingIndex = buildExistingPageIndex(existingPages);
  const takenSlugs = new Set(existingPages.map((page) => page.slug));

  const batchSlugs = new Map<string, string>();
  const batchTitles = new Map<string, string[]>();

  const drafts = bundle.entities.map((entity, index) => {
    const itemId = makeItemId(index, entity.id);
    const draft = mapEntityToPageDraft(entity);

    batchSlugs.set(draft.slug, itemId);
    const titleKey = draft.title.trim().toLocaleLowerCase("de");
    const titleOwners = batchTitles.get(titleKey) ?? [];
    titleOwners.push(itemId);
    batchTitles.set(titleKey, titleOwners);

    return { itemId, draft, entity };
  });

  for (const { itemId, draft } of drafts) {
    if (draft.missingFields.length > 0) {
      const preview: ImportItemPreview = {
        itemId,
        knoteforgeId: draft.knoteforgeId,
        knoteforgeType: draft.knoteforgeType,
        status: "skipped",
        title: draft.title,
        slug: draft.slug,
        resolvedSlug: draft.slug,
        pageType: draft.type,
        blockCount: draft.contentBlocks.length,
        missingFields: draft.missingFields,
        warnings: draft.warnings,
        conflicts: draft.missingFields.map((field) => ({
          kind: "missing_field" as const,
          message: `Pflichtfeld „${field}" fehlt.`,
        })),
      };
      items.push(preview);
      summary.skipped++;
      continue;
    }

    const duplicateResult = checkDuplicate(
      {
        draft,
        itemId,
        existing: existingIndex,
        batchSlugs,
        batchTitles,
      },
      takenSlugs,
    );

    const resolvedSlug =
      duplicateResult.status === "conflict"
        ? duplicateResult.resolvedSlug
        : resolveUniqueSlug(draft.slug, takenSlugs);

    takenSlugs.add(resolvedSlug);

    const preview: ImportItemPreview = {
      itemId,
      knoteforgeId: draft.knoteforgeId,
      knoteforgeType: draft.knoteforgeType,
      status: duplicateResult.status,
      title: draft.title,
      slug: draft.slug,
      resolvedSlug,
      pageType: draft.type,
      blockCount: draft.contentBlocks.length,
      missingFields: draft.missingFields,
      warnings: draft.warnings,
      conflicts: duplicateResult.conflicts,
      existingPageId: duplicateResult.existingPageId,
    };

    items.push(preview);
    summary[duplicateResult.status]++;
  }

  const assetConflicts = detectAssetConflicts(bundle.assets);
  if (assetConflicts.length > 0) {
    errors.push(...assetConflicts.map((c) => c.message));
  }

  const assetIndex = buildAssetDuplicateIndex(bundle.assets);
  if (assetIndex.byFilename.size > 0) {
    errors.push(`${bundle.assets.length} Assets erkannt (Import der Dateien folgt in Phase 2).`);
  }

  const canExecute = items.some(
    (item) =>
      item.status === "new" ||
      item.status === "update" ||
      (item.status === "conflict" && item.resolvedSlug !== item.slug),
  );

  return {
    worldSlug: options.worldSlug,
    format: options.format,
    totalEntities: bundle.entities.length,
    items,
    summary,
    errors,
    canExecute,
  };
}
