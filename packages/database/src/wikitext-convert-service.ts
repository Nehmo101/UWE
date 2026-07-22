import type { PrismaClient } from "./client";
import { brainPrisma } from "./brain-client";
import type { ContentBlockType, PageType } from "./generated/prisma/client";
import { createActivityLogService } from "./activity-log-service";
import { createUndoService } from "./undo-service";
import { parseStringArray } from "./json-utils";
import { buildPageUrl } from "./page-types";
import { detectPageType } from "./page-type-detect";
import {
  buildWikitextLinkTerms,
  convertWikitext,
  type WikitextAddedLink,
} from "./wikitext-convert";

/**
 * Bulk wikitext conversion for a world, or a selection of its pages
 * ("Alle Wikitexte konvertieren" / Massenaktion "Konvertieren").
 *
 * Walks every text block of every (or every selected) page, normalizes the
 * markdown structure and auto-links mentions of other pages. Apply is fully
 * undoable: every changed block gets an UndoEntry, and the run is recorded in
 * the activity log.
 */

/** Only prose blocks are converted — statblocks, images etc. stay untouched. */
const CONVERTIBLE_BLOCK_TYPES: ContentBlockType[] = [
  "rich_text",
  "gm_note",
  "player_text",
];

/**
 * Sammelbecken-Typen für importierten Inhalt ohne eigene KnoteForge-
 * Feinkategorie (siehe `KNOTEFORGE_TYPE_MAP`). Nur bei ihnen ersetzt ein
 * erkannter Marker den bestehenden Seitentyp — ein bereits gezielt gesetzter
 * Typ (z. B. „item") wird nicht durch eine beiläufige Text-/Titel-/Tag-
 * Erwähnung überschrieben.
 */
const RECLASSIFIABLE_TYPES: PageType[] = ["lore", "note"];

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

/** Ein aus dem Inhalt abgeleiteter Seitentyp-Wechsel (z. B. „Kategorie: NPC"). */
export interface WikitextConvertTypeChange {
  pageId: string;
  pageTitle: string;
  pageHref: string;
  fromType: PageType;
  toType: PageType;
}

export interface WikitextConvertPreview {
  totalPages: number;
  totalBlocks: number;
  changedBlocks: WikitextConvertBlockPreview[];
  typeChanges: WikitextConvertTypeChange[];
  addedLinkCount: number;
  structuredBlockCount: number;
}

export interface WikitextConvertApplyResult {
  ok: boolean;
  message: string;
  changedBlockCount: number;
  changedPageCount: number;
  addedLinkCount: number;
  typeChangeCount: number;
  undoEntryIds: string[];
}

export interface WikitextConvertOptions {
  /** Markdown-Struktur normalisieren (Standard: true). */
  structure?: boolean;
  /** Erwähnungen anderer Seiten automatisch verlinken (Standard: true). */
  autoLink?: boolean;
  /** Seitentyp aus Titel/Inhalt/Tags ableiten (Standard: false). */
  detectType?: boolean;
  /** Nur diese Seiten konvertieren, statt der ganzen Welt (z. B. Mehrfachauswahl in der Seitentabelle). */
  pageIds?: string[];
}

export class WikitextConvertService {
  constructor(private readonly db: PrismaClient) {}

  /** Dry run — computes all changes without writing anything. */
  async previewWorldConversion(
    worldSlug: string,
    options?: WikitextConvertOptions,
  ): Promise<WikitextConvertPreview | null> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return null;

    // Der Link-Index braucht immer ALLE Seiten der Welt, auch wenn nur eine
    // Auswahl konvertiert wird — sonst können Erwähnungen nicht ausgewählter
    // Seiten nicht verlinkt werden.
    const allPages = await this.db.page.findMany({
      where: { worldId: world.id },
      orderBy: { title: "asc" },
      include: {
        contentBlocks: { orderBy: { sortOrder: "asc" } },
      },
    });

    const linkIndex = allPages.map((page) => ({
      id: page.id,
      title: page.title,
      aliases: parseStringArray(page.aliases),
    }));

    const pages = options?.pageIds
      ? allPages.filter((page) => options.pageIds!.includes(page.id))
      : allPages;

    const changedBlocks: WikitextConvertBlockPreview[] = [];
    const typeChanges: WikitextConvertTypeChange[] = [];
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

      // Seitentyp aus Titel, Inhalt und Tags ableiten — nur für Sammelbecken-
      // Typen, damit ein bereits gezielt gesetzter Typ nicht überschrieben wird.
      if (options?.detectType && RECLASSIFIABLE_TYPES.includes(page.type)) {
        const combined = page.contentBlocks
          .filter((block) => CONVERTIBLE_BLOCK_TYPES.includes(block.type))
          .map((block) => block.content)
          .join("\n");
        const detected = detectPageType({
          content: combined,
          title: page.title,
          tags: parseStringArray(page.tags),
        });
        if (detected && detected !== page.type) {
          typeChanges.push({
            pageId: page.id,
            pageTitle: page.title,
            pageHref,
            fromType: page.type,
            toType: detected,
          });
        }
      }
    }

    return {
      totalPages: pages.length,
      totalBlocks,
      changedBlocks,
      typeChanges,
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
        typeChangeCount: 0,
        undoEntryIds: [],
      };
    }

    const preview = await this.previewWorldConversion(worldSlug, options);
    if (!preview || (preview.changedBlocks.length === 0 && preview.typeChanges.length === 0)) {
      return {
        ok: true,
        message: "Alle Wikitexte sind bereits konvertiert — keine Änderungen nötig.",
        changedBlockCount: 0,
        changedPageCount: 0,
        addedLinkCount: 0,
        typeChangeCount: 0,
        undoEntryIds: [],
      };
    }

    const undo = createUndoService(brainPrisma, this.db);
    const activity = createActivityLogService(this.db);
    const undoEntryIds: string[] = [];
    const changedPageIds = new Set<string>();

    let changedBlockCount = 0;
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
      changedBlockCount += 1;
    }

    // Seitentyp-Wechsel anwenden (rückgängig machbar). Nur wenn der aktuelle Typ
    // noch dem Vorschau-Ausgangstyp entspricht — so wird keine zwischenzeitliche
    // manuelle Änderung überschrieben.
    let typeChangeCount = 0;
    for (const change of preview.typeChanges) {
      const page = await this.db.page.findUnique({ where: { id: change.pageId } });
      if (!page || page.type !== change.fromType) continue;

      const undoEntry = await undo.capturePageUpdate(change.pageId, "page.update");
      undoEntryIds.push(undoEntry.id);

      await this.db.page.update({
        where: { id: change.pageId },
        data: { type: change.toType },
      });
      changedPageIds.add(change.pageId);
      typeChangeCount += 1;
    }

    const changedPages = preview.changedBlocks.filter((change) =>
      changedPageIds.has(change.pageId),
    );
    const addedLinkCount = changedPages.reduce(
      (sum, change) => sum + change.addedLinks.length,
      0,
    );

    const messageParts = [
      `${changedBlockCount} Block/Blöcke auf ${changedPageIds.size} Seite(n) konvertiert`,
      `${addedLinkCount} Verbindung(en) neu verlinkt`,
    ];
    if (typeChangeCount > 0) {
      messageParts.push(`${typeChangeCount} Seitentyp(en) gesetzt`);
    }
    const message = `Wikitext-Konvertierung: ${messageParts.join(", ")}.`;

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
        changedBlockCount,
        changedPageCount: changedPageIds.size,
        addedLinkCount,
        typeChangeCount,
        undoEntryIds,
      },
      undoEntryId: undoEntryIds[0],
    });

    return {
      ok: true,
      message,
      changedBlockCount,
      changedPageCount: changedPageIds.size,
      addedLinkCount,
      typeChangeCount,
      undoEntryIds,
    };
  }
}

export function createWikitextConvertService(db: PrismaClient): WikitextConvertService {
  return new WikitextConvertService(db);
}
