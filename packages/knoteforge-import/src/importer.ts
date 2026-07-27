import type { UweRepository } from "@uwe/database/server";
import { mapEntityToPageDraft } from "./mapping";
import { previewImport } from "./preview";
import { parseImportContent } from "./registry";
import { resolveUniqueSlug } from "./slug";
import type {
  ImportExecuteOptions,
  ImportExecuteResult,
  ImportFormat,
  ImportItemPreview,
  ImportLogEntry,
  NormalizedImportBundle,
} from "./types";

function appendLog(
  log: ImportLogEntry[],
  entry: Omit<ImportLogEntry, "timestamp">,
): void {
  log.push({ ...entry, timestamp: new Date().toISOString() });
}

function makeItemId(index: number, knoteforgeId?: string): string {
  return knoteforgeId ? `kf:${knoteforgeId}` : `idx:${index}`;
}

function shouldImportItem(
  preview: ImportItemPreview,
  options: ImportExecuteOptions,
): boolean {
  if (preview.status === "skipped") return false;

  if (options.itemIds && !options.itemIds.includes(preview.itemId)) {
    return false;
  }

  if (preview.status === "duplicate") return false;

  if (preview.status === "conflict" && !options.autoResolveSlugConflicts) {
    return false;
  }

  if (preview.status === "update" && !options.allowUpdates) {
    return false;
  }

  return preview.status === "new" || preview.status === "update" || preview.status === "conflict";
}

async function executeFromBundle(
  repo: UweRepository,
  bundle: NormalizedImportBundle,
  worldSlug: string,
  format: ImportFormat,
  options: ImportExecuteOptions,
): Promise<ImportExecuteResult> {
  if (!options.confirmed) {
    throw new Error("Import erfordert confirmed: true.");
  }

  const preview = await previewImport(repo, bundle, { worldSlug, format });
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    throw new Error(`Welt „${worldSlug}" wurde nicht gefunden.`);
  }

  const previewById = new Map(preview.items.map((item) => [item.itemId, item]));
  const existingPages = await repo.listPagesByWorld(worldSlug);
  const takenSlugs = new Set(existingPages.map((page) => page.slug));

  const result: ImportExecuteResult = {
    worldSlug,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    items: [],
    log: [],
    undo: { createdPageIds: [], updatedPages: [] },
  };

  appendLog(result.log, {
    status: "new",
    message: `Import gestartet: ${bundle.entities.length} Einträge, Format ${format}.`,
  });

  for (let index = 0; index < bundle.entities.length; index++) {
    const entity = bundle.entities[index]!;
    const itemId = makeItemId(index, entity.id);
    const itemPreview = previewById.get(itemId);

    if (!itemPreview) {
      result.failed++;
      result.items.push({
        itemId,
        status: "error",
        error: "Vorschau-Eintrag fehlt.",
      });
      appendLog(result.log, {
        itemId,
        status: "error",
        message: "Vorschau-Eintrag fehlt.",
      });
      continue;
    }

    if (!shouldImportItem(itemPreview, options)) {
      result.skipped++;
      result.items.push({
        itemId,
        status: itemPreview.status,
        slug: itemPreview.resolvedSlug,
      });
      appendLog(result.log, {
        itemId,
        title: itemPreview.title,
        status: itemPreview.status,
        message: `Übersprungen (${itemPreview.status}).`,
      });
      continue;
    }

    try {
      const draft = mapEntityToPageDraft(entity);
      const slug =
        itemPreview.status === "conflict" && options.autoResolveSlugConflicts
          ? resolveUniqueSlug(itemPreview.resolvedSlug, takenSlugs)
          : itemPreview.resolvedSlug;

      if (itemPreview.status === "update" && itemPreview.existingPageId) {
        const existingPage = await repo.getPageById(itemPreview.existingPageId);
        if (!existingPage) {
          throw new Error("Bestehende Seite für Update nicht gefunden.");
        }
        const previousBlockIds = existingPage.contentBlocks.map((block) => block.id);
        const addedBlockIds: string[] = [];

        const updated = await repo.updatePage(itemPreview.existingPageId, {
          title: draft.title,
          type: draft.type,
          summary: draft.summary,
          visibility: draft.visibility,
          tags: draft.tags,
          aliases: draft.aliases,
        });

        for (const block of draft.contentBlocks) {
          const createdBlock = await repo.createContentBlock(updated.id, {
            type: block.type,
            sortOrder: block.sortOrder,
            content: block.content,
            visibility: block.visibility,
            metadata: block.metadata,
          });
          addedBlockIds.push(createdBlock.id);
        }

        result.undo?.updatedPages.push({
          pageId: existingPage.id,
          page: {
            id: existingPage.id,
            worldId: existingPage.worldId,
            campaignId: existingPage.campaignId,
            parentPageId: existingPage.parentPageId,
            title: existingPage.title,
            slug: existingPage.slug,
            type: existingPage.type,
            summary: existingPage.summary,
            visibility: existingPage.visibility,
            canonicalStatus: existingPage.canonicalStatus,
            tags: existingPage.tags,
            aliases: existingPage.aliases,
          },
          previousBlockIds,
          addedBlockIds,
        });

        takenSlugs.add(updated.slug);
        result.updated++;
        result.items.push({
          itemId,
          status: "update",
          pageId: updated.id,
          slug: updated.slug,
        });
        appendLog(result.log, {
          itemId,
          title: draft.title,
          status: "update",
          message: `Seite aktualisiert: ${updated.slug}`,
        });
        continue;
      }

      const page = await repo.createPage({
        worldId: world.id,
        title: draft.title,
        slug,
        type: draft.type,
        summary: draft.summary,
        visibility: draft.visibility,
        tags: draft.tags,
        aliases: draft.aliases,
        contentBlocks: draft.contentBlocks.map((block) => ({
          type: block.type,
          sortOrder: block.sortOrder,
          content: block.content,
          visibility: block.visibility,
          metadata: block.metadata,
        })),
      });

      takenSlugs.add(page.slug);
      result.undo?.createdPageIds.push(page.id);
      result.created++;
      result.items.push({
        itemId,
        status: "new",
        pageId: page.id,
        slug: page.slug,
      });
      appendLog(result.log, {
        itemId,
        title: draft.title,
        status: "new",
        message: `Seite erstellt: ${page.slug}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
      result.failed++;
      result.items.push({
        itemId,
        status: "error",
        error: message,
      });
      appendLog(result.log, {
        itemId,
        title: itemPreview.title,
        status: "error",
        message,
      });
    }
  }

  appendLog(result.log, {
    status: "new",
    message: `Import abgeschlossen: ${result.created} erstellt, ${result.updated} aktualisiert, ${result.skipped} übersprungen, ${result.failed} fehlgeschlagen.`,
  });

  if (
    result.undo &&
    result.undo.createdPageIds.length === 0 &&
    result.undo.updatedPages.length === 0
  ) {
    delete result.undo;
  }

  return result;
}

export async function executeImport(
  repo: UweRepository,
  bundle: NormalizedImportBundle,
  worldSlug: string,
  format: ImportFormat,
  options: ImportExecuteOptions,
): Promise<ImportExecuteResult> {
  return executeFromBundle(repo, bundle, worldSlug, format, options);
}

export async function importFromContent(
  repo: UweRepository,
  format: ImportFormat,
  content: string,
  worldSlug: string,
  options: ImportExecuteOptions,
): Promise<ImportExecuteResult> {
  const { bundle } = parseImportContent(format, content);
  return executeImport(repo, bundle, worldSlug, format, options);
}

export async function previewFromContent(
  repo: UweRepository,
  format: ImportFormat,
  content: string,
  worldSlug: string,
) {
  const { bundle, validationErrors } = parseImportContent(format, content);
  const preview = await previewImport(repo, bundle, { worldSlug, format });
  return {
    ...preview,
    errors: [...validationErrors, ...preview.errors],
  };
}
