import type { PrismaClient } from "./client";
import { brainPrisma } from "./brain-client";
import type {
  PageType,
  Prisma,
  PublishStatus,
  Visibility,
} from "./generated/prisma/client";
import { createActivityLogService } from "./activity-log-service";
import { createUndoService } from "./undo-service";
import { parseStringArray, toPrismaJsonValue } from "./json-utils";

/**
 * Massenbearbeitung von Wiki-Seiten ("mehrere Seiten auf einmal ändern").
 *
 * Jede Operation trifft eine Auswahl von Seiten-IDs innerhalb einer Welt und ist
 * vollständig rückgängig machbar: pro geänderter/gelöschter Seite wird ein
 * UndoEntry angelegt und der Lauf im Aktivitätsprotokoll vermerkt.
 */

export type PageBulkOperation =
  | { kind: "visibility"; visibility: Visibility }
  | { kind: "publishStatus"; publishStatus: PublishStatus }
  | { kind: "type"; type: PageType }
  | { kind: "addTags"; tags: string[] }
  | { kind: "removeTags"; tags: string[] }
  | { kind: "campaign"; campaignId: string | null }
  | { kind: "delete" };

export type PageBulkOperationKind = PageBulkOperation["kind"];

export interface PageBulkResult {
  ok: boolean;
  message: string;
  changedCount: number;
  failedCount: number;
  undoEntryIds: string[];
}

const OP_LABELS: Record<PageBulkOperationKind, string> = {
  visibility: "Sichtbarkeit geändert",
  publishStatus: "Status geändert",
  type: "Seitentyp geändert",
  addTags: "Tags hinzugefügt",
  removeTags: "Tags entfernt",
  campaign: "Kampagne zugewiesen",
  delete: "gelöscht",
};

/** Tags case-insensitiv und ohne Duplikate ergänzen (Reihenfolge bleibt stabil). */
export function addTagsTo(current: string[], toAdd: string[]): string[] {
  const seen = new Set(current.map((tag) => tag.toLocaleLowerCase("de")));
  const result = [...current];
  for (const tag of toAdd) {
    const trimmed = tag.trim();
    const key = trimmed.toLocaleLowerCase("de");
    if (trimmed && !seen.has(key)) {
      seen.add(key);
      result.push(trimmed);
    }
  }
  return result;
}

/** Tags case-insensitiv entfernen. */
export function removeTagsFrom(current: string[], toRemove: string[]): string[] {
  const drop = new Set(toRemove.map((tag) => tag.trim().toLocaleLowerCase("de")).filter(Boolean));
  return current.filter((tag) => !drop.has(tag.toLocaleLowerCase("de")));
}

type PageRecord = Awaited<ReturnType<PrismaClient["page"]["findFirst"]>>;

function buildUpdateData(
  page: NonNullable<PageRecord>,
  operation: PageBulkOperation,
): Prisma.PageUncheckedUpdateInput | null {
  switch (operation.kind) {
    case "visibility":
      return page.visibility === operation.visibility ? null : { visibility: operation.visibility };
    case "publishStatus":
      return page.publishStatus === operation.publishStatus
        ? null
        : { publishStatus: operation.publishStatus };
    case "type":
      return page.type === operation.type ? null : { type: operation.type };
    case "campaign":
      return (page.campaignId ?? null) === (operation.campaignId ?? null)
        ? null
        : { campaignId: operation.campaignId };
    case "addTags": {
      const current = parseStringArray(page.tags);
      const next = addTagsTo(current, operation.tags);
      return next.length === current.length ? null : { tags: toPrismaJsonValue(next) };
    }
    case "removeTags": {
      const current = parseStringArray(page.tags);
      const next = removeTagsFrom(current, operation.tags);
      return next.length === current.length ? null : { tags: toPrismaJsonValue(next) };
    }
    default:
      return null;
  }
}

export class PageBulkService {
  constructor(private readonly db: PrismaClient) {}

  async apply(
    worldSlug: string,
    pageIds: string[],
    operation: PageBulkOperation,
  ): Promise<PageBulkResult> {
    const empty = { changedCount: 0, failedCount: 0, undoEntryIds: [] as string[] };

    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return { ok: false, message: "Welt nicht gefunden.", ...empty };

    const ids = [...new Set(pageIds)].filter(Boolean);
    if (ids.length === 0) return { ok: false, message: "Keine Seiten ausgewählt.", ...empty };

    // Kampagnenzuweisung nur auf eine Kampagne dieser Welt.
    if (operation.kind === "campaign" && operation.campaignId) {
      const campaign = await this.db.campaign.findFirst({
        where: { id: operation.campaignId, worldId: world.id },
      });
      if (!campaign) {
        return { ok: false, message: "Kampagne gehört nicht zu dieser Welt.", ...empty };
      }
    }

    // Nur Seiten dieser Welt bearbeiten (Schutz gegen fremde IDs).
    const pages = await this.db.page.findMany({
      where: { id: { in: ids }, worldId: world.id },
    });
    if (pages.length === 0) {
      return { ok: false, message: "Keine passenden Seiten gefunden.", ...empty };
    }

    const undo = createUndoService(brainPrisma, this.db);
    const activity = createActivityLogService(this.db);
    const undoEntryIds: string[] = [];
    let changedCount = 0;
    let failedCount = 0;

    for (const page of pages) {
      try {
        if (operation.kind === "delete") {
          const entry = await undo.capturePageDelete(page.id);
          await this.db.page.delete({ where: { id: page.id } });
          undoEntryIds.push(entry.id);
          changedCount += 1;
          continue;
        }

        const data = buildUpdateData(page, operation);
        if (!data) continue; // schon im Zielzustand — nichts zu tun

        const entry = await undo.capturePageUpdate(page.id, "page.update");
        await this.db.page.update({ where: { id: page.id }, data });
        undoEntryIds.push(entry.id);
        changedCount += 1;
      } catch (error) {
        // Einzelne Seite mit blockierenden Verknüpfungen o. Ä. überspringen,
        // statt den ganzen Lauf abzubrechen. Fehler wird protokolliert, damit
        // stille Massenfehler nachvollziehbar bleiben.
        console.error(
          `[uwe/page-bulk] Operation "${operation.kind}" für Seite ${page.id} fehlgeschlagen:`,
          error,
        );
        failedCount += 1;
      }
    }

    const message =
      `${changedCount} Seite(n): ${OP_LABELS[operation.kind]}.` +
      (failedCount > 0 ? ` ${failedCount} übersprungen.` : "");

    if (changedCount > 0) {
      await activity.log({
        worldId: world.id,
        worldSlug: world.slug,
        action: operation.kind === "visibility" ? "visibility_changed" : "content_updated",
        targetType: "world",
        targetId: world.id,
        targetLabel: world.name,
        summary: message,
        details: {
          feature: "page_bulk_edit",
          operation: operation.kind,
          changedCount,
          failedCount,
          pageIds: ids,
          undoEntryIds,
        },
        undoEntryId: undoEntryIds[0],
      });
    }

    return { ok: changedCount > 0, message, changedCount, failedCount, undoEntryIds };
  }
}

export function createPageBulkService(db: PrismaClient): PageBulkService {
  return new PageBulkService(db);
}
