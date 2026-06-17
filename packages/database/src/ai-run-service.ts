import type { Prisma, AiRunStatus } from "./generated/prisma/client";
import { createPrismaClient, type PrismaClient } from "./client";
import { toPrismaJsonValue } from "./json-utils";

export type { AiRun, AiRunStatus } from "./generated/prisma/client";

export { AiRunStatus as AiRunStatusEnum } from "./generated/prisma/client";

export const AI_RUN_STATUS_LABELS: Record<AiRunStatus, string> = {
  pending: "Ausstehend",
  running: "Läuft",
  completed: "Abgeschlossen",
  failed: "Fehlgeschlagen",
  cancelled: "Abgebrochen",
  applied: "Übernommen",
  discarded: "Verworfen",
};

const TERMINAL_STATUSES: AiRunStatus[] = [
  "completed",
  "failed",
  "cancelled",
  "applied",
  "discarded",
];

export interface CreateAiRunInput {
  worldId?: string | null;
  pageId?: string | null;
  gameSessionId?: string | null;
  userId?: string | null;
  source?: string | null;
  taskType: string;
  provider: string;
  model: string;
  systemPrompt?: string | null;
  userPrompt?: string | null;
  contextData?: Prisma.InputJsonValue | null;
  targetType?: string | null;
  targetId?: string | null;
}

export interface CompleteAiRunInput {
  resultText: string;
  resultMeta?: Prisma.InputJsonValue | null;
  contextData?: Prisma.InputJsonValue | null;
  systemPrompt?: string | null;
  userPrompt?: string | null;
  durationMs?: number | null;
}

export interface FailAiRunInput {
  errorMessage: string;
  errorDetails?: Prisma.InputJsonValue | null;
  durationMs?: number | null;
}

export interface ListAiRunsOptions {
  worldId?: string;
  pageId?: string;
  gameSessionId?: string;
  status?: AiRunStatus | AiRunStatus[];
  limit?: number;
  offset?: number;
}

export interface AiRunView {
  id: string;
  worldId: string | null;
  pageId: string | null;
  gameSessionId: string | null;
  userId: string | null;
  source: string | null;
  taskType: string;
  provider: string;
  model: string;
  status: AiRunStatus;
  systemPrompt: string | null;
  userPrompt: string | null;
  contextData: unknown;
  resultText: string | null;
  resultMeta: unknown;
  errorMessage: string | null;
  errorDetails: unknown;
  durationMs: number | null;
  targetType: string | null;
  targetId: string | null;
  proposals: unknown;
  appliedAt: Date | null;
  discardedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  pageTitle: string | null;
  pageSlug: string | null;
  gameSessionTitle: string | null;
  gameSessionNumber: number | null;
}

function toView(
  run: Prisma.AiRunGetPayload<{
    include: {
      page: { select: { title: true; slug: true } };
      gameSession: { select: { title: true; sessionNumber: true } };
    };
  }>,
): AiRunView {
  return {
    id: run.id,
    worldId: run.worldId,
    pageId: run.pageId,
    gameSessionId: run.gameSessionId,
    userId: run.userId,
    source: run.source,
    taskType: run.taskType,
    provider: run.provider,
    model: run.model,
    status: run.status,
    systemPrompt: run.systemPrompt,
    userPrompt: run.userPrompt,
    contextData: run.contextData,
    resultText: run.resultText,
    resultMeta: run.resultMeta,
    errorMessage: run.errorMessage,
    errorDetails: run.errorDetails,
    durationMs: run.durationMs,
    targetType: run.targetType,
    targetId: run.targetId,
    proposals: run.proposals,
    appliedAt: run.appliedAt,
    discardedAt: run.discardedAt,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    pageTitle: run.page?.title ?? null,
    pageSlug: run.page?.slug ?? null,
    gameSessionTitle: run.gameSession?.title ?? null,
    gameSessionNumber: run.gameSession?.sessionNumber ?? null,
  };
}

function runInclude() {
  return {
    page: { select: { title: true, slug: true } },
    gameSession: { select: { title: true, sessionNumber: true } },
  };
}

export class AiRunService {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateAiRunInput): Promise<AiRunView> {
    const run = await this.db.aiRun.create({
      data: {
        worldId: input.worldId ?? null,
        pageId: input.pageId ?? null,
        gameSessionId: input.gameSessionId ?? null,
        userId: input.userId ?? null,
        source: input.source ?? null,
        taskType: input.taskType,
        provider: input.provider,
        model: input.model,
        status: "pending",
        systemPrompt: input.systemPrompt ?? null,
        userPrompt: input.userPrompt ?? null,
        contextData: toPrismaJsonValue(input.contextData),
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
      },
      include: runInclude(),
    });
    return toView(run);
  }

  async markRunning(id: string): Promise<AiRunView> {
    const run = await this.db.aiRun.update({
      where: { id },
      data: { status: "running" },
      include: runInclude(),
    });
    return toView(run);
  }

  async markCompleted(id: string, input: CompleteAiRunInput): Promise<AiRunView> {
    const run = await this.db.aiRun.update({
      where: { id },
      data: {
        status: "completed",
        resultText: input.resultText,
        resultMeta: toPrismaJsonValue(input.resultMeta),
        contextData: toPrismaJsonValue(input.contextData),
        systemPrompt: input.systemPrompt ?? undefined,
        userPrompt: input.userPrompt ?? undefined,
        durationMs: input.durationMs ?? null,
      },
      include: runInclude(),
    });
    return toView(run);
  }

  async markFailed(id: string, input: FailAiRunInput): Promise<AiRunView> {
    const run = await this.db.aiRun.update({
      where: { id },
      data: {
        status: "failed",
        errorMessage: input.errorMessage,
        errorDetails: toPrismaJsonValue(input.errorDetails),
        durationMs: input.durationMs ?? null,
      },
      include: runInclude(),
    });
    return toView(run);
  }

  async markCancelled(id: string): Promise<AiRunView> {
    const run = await this.db.aiRun.update({
      where: { id },
      data: { status: "cancelled" },
      include: runInclude(),
    });
    return toView(run);
  }

  async markApplied(id: string): Promise<AiRunView> {
    const run = await this.db.aiRun.update({
      where: { id },
      data: {
        status: "applied",
        appliedAt: new Date(),
      },
      include: runInclude(),
    });
    return toView(run);
  }

  async markDiscarded(id: string): Promise<AiRunView> {
    const run = await this.db.aiRun.update({
      where: { id },
      data: {
        status: "discarded",
        discardedAt: new Date(),
      },
      include: runInclude(),
    });
    return toView(run);
  }

  async setProposals(id: string, proposals: unknown): Promise<AiRunView> {
    const run = await this.db.aiRun.update({
      where: { id },
      data: {
        proposals: toPrismaJsonValue(proposals as Prisma.InputJsonValue),
      },
      include: runInclude(),
    });
    return toView(run);
  }

  async getById(id: string): Promise<AiRunView | null> {
    const run = await this.db.aiRun.findUnique({
      where: { id },
      include: runInclude(),
    });
    return run ? toView(run) : null;
  }

  async list(options: ListAiRunsOptions = {}): Promise<{ runs: AiRunView[]; total: number }> {
    const where: Prisma.AiRunWhereInput = {};

    if (options.worldId) where.worldId = options.worldId;
    if (options.pageId) where.pageId = options.pageId;
    if (options.gameSessionId) where.gameSessionId = options.gameSessionId;
    if (options.status) {
      where.status = Array.isArray(options.status) ? { in: options.status } : options.status;
    }

    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const [runs, total] = await Promise.all([
      this.db.aiRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: runInclude(),
      }),
      this.db.aiRun.count({ where }),
    ]);

    return { runs: runs.map(toView), total };
  }

  async getLatestForWorld(worldId: string): Promise<AiRunView | null> {
    const run = await this.db.aiRun.findFirst({
      where: { worldId },
      orderBy: { createdAt: "desc" },
      include: runInclude(),
    });
    return run ? toView(run) : null;
  }

  isTerminalStatus(status: AiRunStatus): boolean {
    return TERMINAL_STATUSES.includes(status);
  }
}

export function createAiRunService(databaseUrl?: string): AiRunService {
  return new AiRunService(createPrismaClient(databaseUrl));
}

export function createAiRunServiceFromClient(db: PrismaClient): AiRunService {
  return new AiRunService(db);
}
