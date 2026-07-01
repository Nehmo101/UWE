import type {
  ImportJob,
  ImportJobStatus,
  ImportSourceType,
  ImportTargetType,
  PrismaClient,
} from "./generated/prisma/client";
import { toPrismaJsonValue } from "./json-utils";

export type {
  ImportJob,
  ImportJobStatus,
  ImportSourceType,
  ImportTargetType,
} from "./generated/prisma/client";

export { ImportJobStatus as ImportJobStatusEnum } from "./generated/prisma/client";
export { ImportSourceType as ImportSourceTypeEnum } from "./generated/prisma/client";
export { ImportTargetType as ImportTargetTypeEnum } from "./generated/prisma/client";

export const IMPORT_JOB_STATUS_LABELS: Record<ImportJobStatus, string> = {
  pending: "Ausstehend",
  preview: "Vorschau",
  executing: "Wird ausgeführt",
  completed: "Abgeschlossen",
  failed: "Fehlgeschlagen",
  rolled_back: "Zurückgerollt",
};

export const IMPORT_SOURCE_TYPE_LABELS: Record<ImportSourceType, string> = {
  knoteforge: "KnoteForge JSON",
  obsidian: "Obsidian",
  pdf: "PDF",
  markdown: "Markdown",
  bulk_image: "Bulk-Bilder",
};

export const IMPORT_TARGET_TYPE_LABELS: Record<ImportTargetType, string> = {
  world: "Welt",
  personal_brain: "Life Brain",
  capture: "Capture",
  dnd_page: "DnD-Seite",
};

export interface CreateImportJobInput {
  sourceType: ImportSourceType;
  targetType: ImportTargetType;
  targetWorldId?: string | null;
  fileName?: string | null;
  previewPayload?: Record<string, unknown> | null;
  createdByUserId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateImportJobInput {
  status?: ImportJobStatus;
  previewPayload?: Record<string, unknown> | null;
  resultSummary?: Record<string, unknown> | null;
  undoToken?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ListImportJobsOptions {
  status?: ImportJobStatus;
  targetType?: ImportTargetType;
  limit?: number;
}

export class ImportJobService {
  constructor(private readonly db: PrismaClient) {}

  async listJobs(options: ListImportJobsOptions = {}): Promise<ImportJob[]> {
    return this.db.importJob.findMany({
      where: {
        ...(options.status ? { status: options.status } : {}),
        ...(options.targetType ? { targetType: options.targetType } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: options.limit ?? 100,
    });
  }

  async getJob(id: string): Promise<ImportJob | null> {
    return this.db.importJob.findUnique({ where: { id } });
  }

  async createJob(input: CreateImportJobInput): Promise<ImportJob> {
    return this.db.importJob.create({
      data: {
        sourceType: input.sourceType,
        targetType: input.targetType,
        targetWorldId: input.targetWorldId ?? null,
        fileName: input.fileName ?? null,
        previewPayload: toPrismaJsonValue(input.previewPayload),
        createdByUserId: input.createdByUserId ?? null,
        metadata: toPrismaJsonValue(input.metadata),
      },
    });
  }

  async updateJob(id: string, input: UpdateImportJobInput): Promise<ImportJob> {
    return this.db.importJob.update({
      where: { id },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.previewPayload !== undefined
          ? { previewPayload: toPrismaJsonValue(input.previewPayload) }
          : {}),
        ...(input.resultSummary !== undefined
          ? { resultSummary: toPrismaJsonValue(input.resultSummary) }
          : {}),
        ...(input.undoToken !== undefined ? { undoToken: input.undoToken } : {}),
        ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
        ...(input.metadata !== undefined
          ? { metadata: toPrismaJsonValue(input.metadata) }
          : {}),
      },
    });
  }

  async markExecuting(id: string): Promise<ImportJob> {
    return this.db.importJob.update({ where: { id }, data: { status: "executing" } });
  }

  async markCompleted(
    id: string,
    resultSummary: Record<string, unknown>,
    undoToken?: string | null,
  ): Promise<ImportJob> {
    return this.db.importJob.update({
      where: { id },
      data: {
        status: "completed",
        resultSummary: toPrismaJsonValue(resultSummary),
        undoToken: undoToken ?? null,
        errorMessage: null,
      },
    });
  }

  async markFailed(id: string, errorMessage: string): Promise<ImportJob> {
    return this.db.importJob.update({
      where: { id },
      data: { status: "failed", errorMessage },
    });
  }

  async markRolledBack(id: string): Promise<ImportJob> {
    return this.db.importJob.update({ where: { id }, data: { status: "rolled_back" } });
  }
}

export function createImportJobService(db: PrismaClient): ImportJobService {
  return new ImportJobService(db);
}
