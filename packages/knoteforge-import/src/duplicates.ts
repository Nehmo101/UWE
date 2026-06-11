import type { PageSummary } from "@uwe/database/server";
import { parseStringArray } from "@uwe/database/server";
import { knoteforgeIdFromTag } from "./mapping";
import { normalizeLookupKey } from "./slug";
import type {
  ImportConflict,
  ImportStatus,
  KnoteForgeExportAsset,
  MappedPageDraft,
} from "./types";

export interface ExistingPageIndex {
  bySlug: Map<string, PageSummary>;
  byTitle: Map<string, PageSummary[]>;
  byAlias: Map<string, PageSummary[]>;
  byKnoteForgeId: Map<string, PageSummary>;
}

export function buildExistingPageIndex(pages: PageSummary[]): ExistingPageIndex {
  const bySlug = new Map<string, PageSummary>();
  const byTitle = new Map<string, PageSummary[]>();
  const byAlias = new Map<string, PageSummary[]>();
  const byKnoteForgeId = new Map<string, PageSummary>();

  for (const page of pages) {
    bySlug.set(page.slug, page);

    const titleKey = normalizeLookupKey(page.title);
    const titleBucket = byTitle.get(titleKey) ?? [];
    titleBucket.push(page);
    byTitle.set(titleKey, titleBucket);

    for (const alias of parseStringArray(page.aliases)) {
      const aliasKey = normalizeLookupKey(alias);
      const aliasBucket = byAlias.get(aliasKey) ?? [];
      aliasBucket.push(page);
      byAlias.set(aliasKey, aliasBucket);
    }

    for (const tag of parseStringArray(page.tags)) {
      const kfId = knoteforgeIdFromTag(tag);
      if (kfId) {
        byKnoteForgeId.set(kfId, page);
      }
    }
  }

  return { bySlug, byTitle, byAlias, byKnoteForgeId };
}

export interface DuplicateCheckInput {
  draft: MappedPageDraft;
  itemId: string;
  existing: ExistingPageIndex;
  batchSlugs: Map<string, string>;
  batchTitles: Map<string, string[]>;
}

export interface DuplicateCheckResult {
  status: ImportStatus;
  resolvedSlug: string;
  conflicts: ImportConflict[];
  existingPageId?: string;
}

export function checkDuplicate(
  input: DuplicateCheckInput,
  takenSlugs: Set<string>,
): DuplicateCheckResult {
  const { draft, existing, batchSlugs, batchTitles } = input;
  const conflicts: ImportConflict[] = [];

  if (draft.missingFields.includes("title")) {
    return {
      status: "skipped",
      resolvedSlug: draft.slug,
      conflicts: [
        {
          kind: "missing_field",
          message: 'Pflichtfeld „title" fehlt.',
        },
      ],
    };
  }

  const existingByKfId = draft.knoteforgeId
    ? existing.byKnoteForgeId.get(draft.knoteforgeId)
    : undefined;

  if (existingByKfId) {
    return {
      status: "update",
      resolvedSlug: existingByKfId.slug,
      conflicts: [],
      existingPageId: existingByKfId.id,
    };
  }

  let resolvedSlug = draft.slug;
  const existingBySlug = existing.bySlug.get(draft.slug);
  const batchSlugOwner = batchSlugs.get(draft.slug);

  if (existingBySlug) {
    conflicts.push({
      kind: "slug",
      message: `Slug „${draft.slug}" existiert bereits als „${existingBySlug.title}".`,
      existingPageId: existingBySlug.id,
      existingTitle: existingBySlug.title,
      existingSlug: existingBySlug.slug,
    });
  }

  if (batchSlugOwner && batchSlugOwner !== input.itemId) {
    conflicts.push({
      kind: "slug",
      message: `Slug „${draft.slug}" kommt mehrfach im Import vor.`,
      relatedItemId: batchSlugOwner,
    });
  }

  const titleKey = normalizeLookupKey(draft.title);
  const existingByTitle = existing.byTitle.get(titleKey) ?? [];
  if (existingByTitle.length > 0) {
    for (const page of existingByTitle) {
      conflicts.push({
        kind: "title",
        message: `Gleicher Titel wie bestehende Seite „${page.title}" (${page.slug}).`,
        existingPageId: page.id,
        existingTitle: page.title,
        existingSlug: page.slug,
      });
    }
  }

  const batchTitleOwners = batchTitles.get(titleKey) ?? [];
  if (batchTitleOwners.length > 1) {
    conflicts.push({
      kind: "title",
      message: `Titel „${draft.title}" kommt mehrfach im Import vor.`,
    });
  }

  for (const alias of draft.aliases) {
    const aliasKey = normalizeLookupKey(alias);
    const existingByAlias = existing.byAlias.get(aliasKey) ?? [];
    for (const page of existingByAlias) {
      if (normalizeLookupKey(page.title) !== titleKey) {
        conflicts.push({
          kind: "alias",
          message: `Alias „${alias}" ähnelt bestehender Seite „${page.title}".`,
          existingPageId: page.id,
          existingTitle: page.title,
          existingSlug: page.slug,
        });
      }
    }
  }

  const hasSlugConflict = conflicts.some((c) => c.kind === "slug");
  if (hasSlugConflict) {
    resolvedSlug = resolveSlugWithSuffix(draft.slug, takenSlugs);
    return {
      status: "conflict",
      resolvedSlug,
      conflicts,
      existingPageId: existingBySlug?.id,
    };
  }

  const hasTitleOrAliasMatch = conflicts.some(
    (c) => c.kind === "title" || c.kind === "alias",
  );
  if (hasTitleOrAliasMatch) {
    return {
      status: "duplicate",
      resolvedSlug,
      conflicts,
    };
  }

  return {
    status: "new",
    resolvedSlug,
    conflicts: [],
  };
}

function resolveSlugWithSuffix(baseSlug: string, takenSlugs: Set<string>): string {
  if (!takenSlugs.has(baseSlug)) return baseSlug;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${baseSlug}-${i}`;
    if (!takenSlugs.has(candidate)) return candidate;
  }
  return `${baseSlug}-${Date.now()}`;
}

export interface AssetDuplicateIndex {
  byFilename: Map<string, KnoteForgeExportAsset[]>;
  byHash: Map<string, KnoteForgeExportAsset[]>;
}

export function buildAssetDuplicateIndex(
  assets: KnoteForgeExportAsset[],
): AssetDuplicateIndex {
  const byFilename = new Map<string, KnoteForgeExportAsset[]>();
  const byHash = new Map<string, KnoteForgeExportAsset[]>();

  for (const asset of assets) {
    const filenameKey = normalizeLookupKey(asset.filename);
    const filenameBucket = byFilename.get(filenameKey) ?? [];
    filenameBucket.push(asset);
    byFilename.set(filenameKey, filenameBucket);

    if (asset.hash) {
      const hashKey = asset.hash.trim().toLowerCase();
      const hashBucket = byHash.get(hashKey) ?? [];
      hashBucket.push(asset);
      byHash.set(hashKey, hashBucket);
    }
  }

  return { byFilename, byHash };
}

export function detectAssetConflicts(
  assets: KnoteForgeExportAsset[],
): ImportConflict[] {
  const index = buildAssetDuplicateIndex(assets);
  const conflicts: ImportConflict[] = [];

  for (const [, group] of index.byFilename) {
    if (group.length > 1) {
      conflicts.push({
        kind: "asset",
        message: `Asset-Dateiname „${group[0]?.filename}" kommt mehrfach vor.`,
      });
    }
  }

  for (const [, group] of index.byHash) {
    if (group.length > 1) {
      conflicts.push({
        kind: "asset",
        message: `Gleicher Asset-Hash (${group[0]?.hash}) für ${group.length} Dateien.`,
      });
    }
  }

  return conflicts;
}
