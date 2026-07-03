import type { PrismaClient } from "@uwe/database/server";

export const QUEST_PRIORITIES = ["high", "normal", "low"] as const;
export type QuestPriority = (typeof QUEST_PRIORITIES)[number];

export const QUEST_PRIORITY_LABELS: Record<QuestPriority, string> = {
  high: "Wichtig",
  normal: "Normal",
  low: "Später",
};

export function normalizeQuestPriority(raw: string | null | undefined): QuestPriority {
  const value = raw?.trim().toLowerCase();
  return (QUEST_PRIORITIES as readonly string[]).includes(value ?? "")
    ? (value as QuestPriority)
    : "normal";
}

export interface QuestFlagView {
  pageId: string;
  priority: QuestPriority;
  note: string | null;
}

export class QuestFlagService {
  constructor(private readonly db: PrismaClient) {}

  /** Persönliche Prioritäten des Spielers für die angegebenen Quest-Seiten. */
  async listForUser(userId: string, pageIds?: string[]): Promise<Map<string, QuestFlagView>> {
    const rows = await this.db.playerQuestFlag.findMany({
      where: {
        userId,
        ...(pageIds ? { pageId: { in: pageIds } } : {}),
      },
    });
    return new Map(
      rows.map((row) => [
        row.pageId,
        {
          pageId: row.pageId,
          priority: normalizeQuestPriority(row.priority),
          note: row.note,
        },
      ]),
    );
  }

  async upsert(input: {
    pageId: string;
    userId: string;
    priority: QuestPriority;
    note?: string | null;
  }): Promise<void> {
    await this.db.playerQuestFlag.upsert({
      where: { pageId_userId: { pageId: input.pageId, userId: input.userId } },
      create: {
        pageId: input.pageId,
        userId: input.userId,
        priority: input.priority,
        note: input.note?.trim() || null,
      },
      update: {
        priority: input.priority,
        note: input.note === undefined ? undefined : input.note?.trim() || null,
      },
    });
  }

  async remove(pageId: string, userId: string): Promise<void> {
    await this.db.playerQuestFlag.deleteMany({ where: { pageId, userId } });
  }
}

export function createQuestFlagService(db: PrismaClient): QuestFlagService {
  return new QuestFlagService(db);
}
