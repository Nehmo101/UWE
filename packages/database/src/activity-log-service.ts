import type { PrismaClient } from "./client";
import { toPrismaJsonValue } from "./json-utils";
import type {
  ActivityAction,
  ActivityTargetType,
} from "./generated/prisma/client";

/**
 * Activity log (audit log): records content changes, visibility changes,
 * inspector fixes, template usage, imports/exports and relevant errors.
 *
 * Entries intentionally have no foreign keys to content tables — they must
 * survive the deletion of the objects they describe. `targetHref` lets the
 * dashboard link to the affected object as long as it still exists.
 */

export const ACTIVITY_ACTION_LABELS: Record<ActivityAction, string> = {
  content_created: "Erstellt",
  content_updated: "Geändert",
  content_deleted: "Gelöscht",
  content_restored: "Wiederhergestellt",
  inspector_fix_applied: "Inspector-Fix",
  template_created: "Template erstellt",
  template_updated: "Template geändert",
  template_used: "Template genutzt",
  import_executed: "Import",
  export_executed: "Export",
  backup_created: "Backup erstellt",
  backup_restored: "Backup wiederhergestellt",
  seed_applied: "Seed ausgeführt",
  ai_proposal_applied: "KI-Vorschlag übernommen",
  ai_proposal_discarded: "KI-Vorschlag verworfen",
  review_submitted: "Review eingereicht",
  review_approved: "Review freigegeben",
  review_rejected: "Review abgelehnt",
  review_commented: "Review kommentiert",
  error: "Fehler",
  warning: "Warnung",
};

export interface LogActivityInput {
  worldId?: string | null;
  worldSlug?: string | null;
  action: ActivityAction;
  targetType: ActivityTargetType;
  targetId?: string | null;
  targetLabel?: string | null;
  targetHref?: string | null;
  summary: string;
  details?: Record<string, unknown> | null;
  undoEntryId?: string | null;
}

export interface ActivityLogEntryView {
  id: string;
  worldId: string | null;
  worldSlug: string | null;
  action: ActivityAction;
  targetType: ActivityTargetType;
  targetId: string | null;
  targetLabel: string | null;
  targetHref: string | null;
  summary: string;
  details: unknown;
  createdAt: Date;
  undo: {
    entryId: string;
    undoneAt: Date | null;
  } | null;
}

export interface ListActivityOptions {
  worldId?: string;
  limit?: number;
  offset?: number;
  actions?: ActivityAction[];
  since?: Date;
  until?: Date;
}

export class ActivityLogService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Write a log entry. Logging must never break the action being logged, so
   * failures are reported to stderr instead of being thrown.
   */
  async log(input: LogActivityInput): Promise<void> {
    try {
      await this.db.activityLog.create({
        data: {
          worldId: input.worldId ?? null,
          worldSlug: input.worldSlug ?? null,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId ?? null,
          targetLabel: input.targetLabel ?? null,
          targetHref: input.targetHref ?? null,
          summary: input.summary,
          details: toPrismaJsonValue(input.details),
          undoEntryId: input.undoEntryId ?? null,
        },
      });
    } catch (error) {
      console.error("[uwe] activity log write failed:", error);
    }
  }

  async list(options: ListActivityOptions = {}): Promise<ActivityLogEntryView[]> {
    const entries = await this.db.activityLog.findMany({
      where: {
        ...(options.worldId ? { worldId: options.worldId } : {}),
        ...(options.actions ? { action: { in: options.actions } } : {}),
        ...(options.since || options.until
          ? {
              createdAt: {
                ...(options.since ? { gte: options.since } : {}),
                ...(options.until ? { lt: options.until } : {}),
              },
            }
          : {}),
      },
      include: { undoEntry: { select: { id: true, undoneAt: true } } },
      orderBy: { createdAt: "desc" },
      take: options.limit ?? 25,
      skip: options.offset ?? 0,
    });

    return entries.map((entry) => ({
      id: entry.id,
      worldId: entry.worldId,
      worldSlug: entry.worldSlug,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      targetLabel: entry.targetLabel,
      targetHref: entry.targetHref,
      summary: entry.summary,
      details: entry.details,
      createdAt: entry.createdAt,
      undo: entry.undoEntry
        ? { entryId: entry.undoEntry.id, undoneAt: entry.undoEntry.undoneAt }
        : null,
    }));
  }

  async count(worldId?: string, since?: Date, until?: Date): Promise<number> {
    return this.db.activityLog.count({
      where: {
        ...(worldId ? { worldId } : {}),
        ...(since || until
          ? {
              createdAt: {
                ...(since ? { gte: since } : {}),
                ...(until ? { lt: until } : {}),
              },
            }
          : {}),
      },
    });
  }
}

/**
 * Export-Aktivität von Labels/Drucklisten protokollieren.
 *
 * Lag früher als Server Action in apps/studio (label-actions/print-list-
 * actions) und wurde von Route-Handlern importiert — ein Import aus einem
 * `"use server"`-Modul in einen Route-Handler ist eine Grenzverletzung.
 * Jetzt importieren beide Seiten von hier. Bewusst schluckend: das Protokoll
 * darf einen Export nie scheitern lassen.
 */
export async function logExportActivity(
  db: PrismaClient,
  input: {
    worldSlug: string;
    targetType: "label" | "print_list";
    targetId: string;
    title: string;
    summary: string;
    targetHref: string;
  },
): Promise<void> {
  try {
    const world = await db.world.findUnique({
      where: { slug: input.worldSlug },
      select: { id: true },
    });
    if (!world) return;

    await db.activityLog.create({
      data: {
        worldId: world.id,
        worldSlug: input.worldSlug,
        action: "export_executed",
        targetType: input.targetType,
        targetId: input.targetId,
        targetLabel: input.title,
        targetHref: input.targetHref,
        summary: input.summary,
      },
    });
  } catch {
    // Activity log must not break exports.
  }
}

export function createActivityLogService(db: PrismaClient): ActivityLogService {
  return new ActivityLogService(db);
}
