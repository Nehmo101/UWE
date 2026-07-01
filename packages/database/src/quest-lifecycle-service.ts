import type { QuestLifecycleStatus, PrismaClient } from "./generated/prisma/client";

export const QUEST_LIFECYCLE_LABELS: Record<QuestLifecycleStatus, string> = {
  open: "Offen",
  completed: "Erledigt",
  failed: "Gescheitert",
};

export function isOpenQuest(questStatus: QuestLifecycleStatus | null | undefined): boolean {
  return questStatus === null || questStatus === undefined || questStatus === "open";
}

export class QuestLifecycleService {
  constructor(private readonly db: PrismaClient) {}

  async updateQuestStatus(pageId: string, questStatus: QuestLifecycleStatus | null) {
    const page = await this.db.page.findUnique({
      where: { id: pageId },
      select: { id: true, type: true },
    });
    if (!page) {
      throw new Error("Seite nicht gefunden.");
    }
    if (page.type !== "quest") {
      throw new Error("Quest-Status ist nur für Quest-Seiten verfügbar.");
    }

    return this.db.page.update({
      where: { id: pageId },
      data: { questStatus },
    });
  }

  async listQuestsForWorld(
    worldId: string,
    options?: { status?: QuestLifecycleStatus | "open" | "all" },
  ) {
    const statusFilter = options?.status ?? "all";
    return this.db.page.findMany({
      where: {
        worldId,
        type: "quest",
        ...(statusFilter === "open"
          ? { OR: [{ questStatus: null }, { questStatus: "open" }] }
          : statusFilter !== "all"
            ? { questStatus: statusFilter }
            : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
    });
  }
}

export function createQuestLifecycleService(db: PrismaClient): QuestLifecycleService {
  return new QuestLifecycleService(db);
}
