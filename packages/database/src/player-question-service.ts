import type { PlayerQuestionStatus, PrismaClient } from "./generated/prisma/client";

export type { PlayerQuestion, PlayerQuestionStatus } from "./generated/prisma/client";

export const PLAYER_QUESTION_STATUS_LABELS: Record<PlayerQuestionStatus, string> = {
  open: "Offen",
  answered: "Beantwortet",
  archived: "Archiviert",
};

/** Player-safe view of a question — no internal ids beyond what the UI needs. */
export interface PlayerQuestionView {
  id: string;
  worldId: string;
  campaignId: string | null;
  authorUserId: string | null;
  authorName: string;
  question: string;
  answer: string | null;
  status: PlayerQuestionStatus;
  createdAt: Date;
  answeredAt: Date | null;
}

export interface AskPlayerQuestionInput {
  worldSlug: string;
  authorName: string;
  authorUserId?: string | null;
  question: string;
  campaignId?: string | null;
}

export interface ListPlayerQuestionsOptions {
  status?: PlayerQuestionStatus;
}

function toView(record: {
  id: string;
  worldId: string;
  campaignId: string | null;
  authorUserId: string | null;
  authorName: string;
  question: string;
  answer: string | null;
  status: PlayerQuestionStatus;
  createdAt: Date;
  answeredAt: Date | null;
}): PlayerQuestionView {
  return {
    id: record.id,
    worldId: record.worldId,
    campaignId: record.campaignId,
    authorUserId: record.authorUserId,
    authorName: record.authorName,
    question: record.question,
    answer: record.answer,
    status: record.status,
    createdAt: record.createdAt,
    answeredAt: record.answeredAt,
  };
}

/**
 * "Fragen an den DM" — players ask questions in the portal, the DM answers
 * them in the studio. Business logic lives here; routes/actions stay thin.
 */
export class PlayerQuestionService {
  constructor(private readonly db: PrismaClient) {}

  private async resolveWorldId(worldSlug: string): Promise<string> {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });
    if (!world) {
      throw new Error("Welt nicht gefunden.");
    }
    return world.id;
  }

  /** Create an open question for a world (resolved via slug). */
  async ask(input: AskPlayerQuestionInput): Promise<PlayerQuestionView> {
    const question = input.question.trim();
    if (question.length === 0) {
      throw new Error("Frage darf nicht leer sein.");
    }
    const authorName = input.authorName.trim() || "Unbekannt";

    const worldId = await this.resolveWorldId(input.worldSlug);
    const created = await this.db.playerQuestion.create({
      data: {
        worldId,
        campaignId: input.campaignId ?? null,
        authorUserId: input.authorUserId ?? null,
        authorName,
        question,
        status: "open",
      },
    });
    return toView(created);
  }

  /** All questions of a world, newest first, optionally filtered by status. */
  async listForWorld(
    worldSlug: string,
    options?: ListPlayerQuestionsOptions,
  ): Promise<PlayerQuestionView[]> {
    const worldId = await this.resolveWorldId(worldSlug);
    const records = await this.db.playerQuestion.findMany({
      where: {
        worldId,
        ...(options?.status ? { status: options.status } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return records.map(toView);
  }

  /** Count of still-open questions for a world (for badges/dashboards). */
  async countOpenForWorld(worldSlug: string): Promise<number> {
    const worldId = await this.resolveWorldId(worldSlug);
    return this.db.playerQuestion.count({
      where: { worldId, status: "open" },
    });
  }

  /** DM answers a question → status=answered, answeredAt set. */
  async answer(id: string, answerText: string): Promise<PlayerQuestionView> {
    const answer = answerText.trim();
    if (answer.length === 0) {
      throw new Error("Antwort darf nicht leer sein.");
    }
    const updated = await this.db.playerQuestion.update({
      where: { id },
      data: {
        answer,
        status: "answered",
        answeredAt: new Date(),
      },
    });
    return toView(updated);
  }

  /** Archive a question (e.g. duplicate or off-topic). */
  async archive(id: string): Promise<PlayerQuestionView> {
    const updated = await this.db.playerQuestion.update({
      where: { id },
      data: { status: "archived" },
    });
    return toView(updated);
  }
}

export function createPlayerQuestionService(db: PrismaClient): PlayerQuestionService {
  return new PlayerQuestionService(db);
}
