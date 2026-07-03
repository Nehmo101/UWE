import type { PrismaClient } from "./client";
import type { ContentBlockType } from "./generated/prisma/client";
import { createActivityLogService } from "./activity-log-service";
import { createUndoService } from "./undo-service";
import { parseStringArray } from "./json-utils";
import { buildPageUrl } from "./page-types";
import {
  buildWikitextLinkTerms,
  convertWikitext,
  type WikitextAddedLink,
  type WikitextConversionOptions,
} from "./wikitext-convert";

/**
 * Bulk wikitext conversion for a whole world ("Alle Wikitexte konvertieren").
 *
 * Walks every text block of every page, normalizes the markdown structure and
 * auto-links mentions of other pages. Apply is fully undoable: every changed
 * block gets an UndoEntry, and the run is recorded in the activity log.
 */

/** Only prose blocks are converted — statblocks, images etc. stay untouched. */
const CONVERTIBLE_BLOCK_TYPES: ContentBlockType[] = [
  "rich_text",
  "gm_note",
  "player_text",
];

export interface WikitextConvertBlockPreview {
  pageId: string;
  pageTitle: string;
  pageHref: string;
  blockId: string;
  blockType: ContentBlockType;
  structured: boolean;
  addedLinks: WikitextAddedLink[];
  previousContent: string;
  nextContent: string;
}

export interface WikitextConvertPreview {
  totalPages: number;
  totalBlocks: number;
  changedBlocks: WikitextConvertBlockPreview[];
  addedLinkCount: number;
  structuredBlockCount: number;
}

export interface WikitextConvertApplyResult {
  ok: boolean;
  message: string;
  changedBlockCount: number;
  changedPageCount: number;
  addedLinkCount: number;
  undoEntryIds: string[];
}

export type WikitextConvertOptions = Pick<
  WikitextConversionOptions,
  "structure" | "autoLink"
>;

export class WikitextConvertService {
  constructor(private readonly db: PrismaClient) {}

  /** Dry run — computes all changes without writing anything. */
  async previewWorldConversion(
    worldSlug: string,
    options?: WikitextConvertOptions,
  ): Promise<WikitextConvertPreview | null> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return null;

    const pages = await this.db.page.findMany({
      where: { worldId: world.id },
      orderBy: { title: "asc" },
      include: {
        contentBlocks: { orderBy: { sortOrder: "asc" } },
      },
    });

    const linkIndex = pages.map((page) => ({
      id: page.id,
      title: page.title,
      aliases: parseStringArray(page.aliases),
    }));

    const changedBlocks: WikitextConvertBlockPreview[] = [];
    let totalBlocks = 0;

    for (const page of pages) {
      const terms = buildWikitextLinkTerms(linkIndex, page.id);
      const pageHref = buildPageUrl(worldSlug, page.type, page.slug);

      for (const block of page.contentBlocks) {
        if (!CONVERTIBLE_BLOCK_TYPES.includes(block.type)) continue;
        if (!block.content.trim()) continue;
        totalBlocks += 1;

        const result = convertWikitext(block.content, terms, options);
        if (!result.changed) continue;

        changedBlocks.push({
          pageId: page.id,
          pageTitle: page.title,
          pageHref,
          blockId: block.id,
          blockType: block.type,
          structured: result.structured,
          addedLinks: result.addedLinks,
          previousContent: block.content,
          nextContent: result.content,
        });
      }
    }

    return {
      totalPages: pages.length,
      totalBlocks,
      changedBlocks,
      addedLinkCount: changedBlocks.reduce(
        (sum, block) => sum + block.addedLinks.length,
        0,
      ),
      structuredBlockCount: changedBlocks.filter((block) => block.structured).length,
    };
  }

  /** Applies the conversion — one UndoEntry per changed block, logged per run. */
  async applyWorldConversion(
    worldSlug: string,
    options?: WikitextConvertOptions,
  ): Promise<WikitextConvertApplyResult> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) {
      return {
        ok: false,
        message: "Welt nicht gefunden.",
        changedBlockCount: 0,
        changedPageCount: 0,
        addedLinkCount: 0,
        undoEntryIds: [],
      };
    }

    const preview = await this.previewWorldConversion(worldSlug, options);
    if (!preview || preview.changedBlocks.length === 0) {
      return {
        ok: true,
        message: "Alle Wikitexte sind bereits konvertiert — keine Änderungen nötig.",
        changedBlockCount: 0,
        changedPageCount: 0,
        addedLinkCount: 0,
        undoEntryIds: [],
      };
    }

    const undo = createUndoService(this.db);
    const activity = createActivityLogService(this.db);
    const undoEntryIds: string[] = [];
    const changedPageIds = new Set<string>();

    for (const change of preview.changedBlocks) {
      // Re-check against the current content so a stale preview never
      // overwrites edits that happened in between.
      const block = await this.db.contentBlock.findUnique({
        where: { id: change.blockId },
      });
      if (!block || block.content !== change.previousContent) continue;

      const undoEntry = await undo.captureBlock(change.blockId, "block.update");
      undoEntryIds.push(undoEntry.id);

      await this.db.contentBlock.update({
        where: { id: change.blockId },
        data: { content: change.nextContent },
      });
      changedPageIds.add(change.pageId);
    }

    const changedPages = preview.changedBlocks.filter((change) =>
      changedPageIds.has(change.pageId),
    );
    const addedLinkCount = changedPages.reduce(
      (sum, change) => sum + change.addedLinks.length,
      0,
    );

    const message = `Wikitext-Konvertierung: ${undoEntryIds.length} Block/Blöcke auf ${changedPageIds.size} Seite(n) konvertiert, ${addedLinkCount} Verbindung(en) neu verlinkt.`;

    await activity.log({
      worldId: world.id,
      worldSlug: world.slug,
      action: "content_updated",
      targetType: "world",
      targetId: world.id,
      targetLabel: world.name,
      summary: message,
      details: {
        feature: "wikitext_convert_all",
        changedBlockCount: undoEntryIds.length,
        changedPageCount: changedPageIds.size,
        addedLinkCount,
        undoEntryIds,
      },
      undoEntryId: undoEntryIds[0],
    });

    return {
      ok: true,
      message,
      changedBlockCount: undoEntryIds.length,
      changedPageCount: changedPageIds.size,
      addedLinkCount,
      undoEntryIds,
    };
  }
}

export function createWikitextConvertService(db: PrismaClient): WikitextConvertService {
  return new WikitextConvertService(db);
}
