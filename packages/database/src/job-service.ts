import type { JobStatus, JobType, Prisma } from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import { toPrismaJsonValue } from "./json-utils";

export type { JobStatus, JobType } from "./generated/prisma/client";

export {
  JobStatus as JobStatusEnum,
  JobType as JobTypeEnum,
} from "./generated/prisma/client";

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  mail_send: "Mail senden",
  mail_sync: "IMAP Sync",
  ai_run: "KI-Aufgabe",
  embedding: "Embedding berechnen",
  reindex: "Brain-Reindex",
  import: "Import",
  backup: "Backup erstellen",
  backup_restore: "Backup wiederherstellen",
  canon_check: "Kanonprüfung",
  image_studio: "Image Studio",
  agent_job: "Agent-Job",
  calendar_sync: "Kalender-Sync",
  research: "Deep Research",
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  pending: "Wartend",
  running: "Läuft",
  completed: "Abgeschlossen",
  failed: "Fehlgeschlagen",
  cancelled: "Abgebrochen",
};

/** Job types that may be retried safely after failure. */
export const RETRYABLE_JOB_TYPES = new Set<JobType>([
  "mail_send",
  "mail_sync",
  "ai_run",
  "embedding",
  "reindex",
  "import",
  "backup",
  "canon_check",
  "image_studio",
  "agent_job",
  "calendar_sync",
  "research",
]);

export interface EnqueueJobInput {
  type: JobType;
  title: string;
  worldId?: string | null;
  worldSlug?: string | null;
  userId?: string | null;
  payload?: Record<string, unknown> | null;
  maxAttempts?: number;
  relatedType?: string | null;
  relatedId?: string | null;
}

export interface ListJobsOptions {
  status?: JobStatus | JobStatus[];
  type?: JobType | JobType[];
  worldId?: string;
  worldSlug?: string;
  limit?: number;
  offset?: number;
}

export interface JobLogView {
  id: string;
  level: string;
  message: string;
  details: unknown;
  createdAt: Date;
}

export interface JobView {
  id: string;
  type: JobType;
  status: JobStatus;
  title: string;
  worldId: string | null;
  worldSlug: string | null;
  userId: string | null;
  payload: unknown;
  result: unknown;
  errorMessage: string | null;
  errorDetails: unknown;
  progress: number | null;
  progressLabel: string | null;
  attemptCount: number;
  maxAttempts: number;
  relatedType: string | null;
  relatedId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  logs?: JobLogView[];
  canRetry: boolean;
  canCancel: boolean;
}

export interface JobSummary {
  pending: number;
  running: number;
  failed: number;
  completed: number;
  cancelled: number;
  recentFailed: JobView[];
}

type JobRecord = Prisma.JobGetPayload<{ include: { logs: true } }> | Prisma.JobGetPayload<object>;

function toJobView(job: JobRecord, includeLogs = false): JobView {
  const canRetry =
    (job.status === "failed" || job.status === "cancelled") &&
    RETRYABLE_JOB_TYPES.has(job.type) &&
    job.attemptCount < job.maxAttempts;

  const canCancel = job.status === "pending" || job.status === "running";

  return {
    id: job.id,
    type: job.type,
    status: job.status,
    title: job.title,
    worldId: job.worldId,
    worldSlug: job.worldSlug,
    userId: job.userId,
    payload: job.payload,
    result: job.result,
    errorMessage: job.errorMessage,
    errorDetails: job.errorDetails,
    progress: job.progress,
    progressLabel: job.progressLabel,
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    relatedType: job.relatedType,
    relatedId: job.relatedId,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    cancelledAt: job.cancelledAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    canRetry,
    canCancel,
    logs: includeLogs && "logs" in job
      ? (job.logs ?? []).map((log) => ({
          id: log.id,
          level: log.level,
          message: log.message,
          details: log.details,
          createdAt: log.createdAt,
        }))
      : undefined,
  };
}

export class JobService {
  constructor(private readonly db: PrismaClient) {}

  async enqueue(input: EnqueueJobInput): Promise<JobView> {
    const job = await this.db.job.create({
      data: {
        type: input.type,
        title: input.title,
        worldId: input.worldId ?? null,
        worldSlug: input.worldSlug ?? null,
        userId: input.userId ?? null,
        payload: toPrismaJsonValue(input.payload ?? undefined),
        maxAttempts: input.maxAttempts ?? 3,
        relatedType: input.relatedType ?? null,
        relatedId: input.relatedId ?? null,
        status: "pending",
      },
    });

    await this.appendLog(job.id, "info", "Job in Warteschlange eingereiht.");

    return toJobView(job);
  }

  async getById(id: string, includeLogs = false): Promise<JobView | null> {
    const job = await this.db.job.findUnique({
      where: { id },
      include: includeLogs ? { logs: { orderBy: { createdAt: "asc" } } } : undefined,
    });
    return job ? toJobView(job, includeLogs) : null;
  }

  async list(options: ListJobsOptions = {}): Promise<JobView[]> {
    const statuses = options.status
      ? Array.isArray(options.status)
        ? options.status
        : [options.status]
      : undefined;
    const types = options.type
      ? Array.isArray(options.type)
        ? options.type
        : [options.type]
      : undefined;

    const jobs = await this.db.job.findMany({
      where: {
        ...(statuses ? { status: { in: statuses } } : {}),
        ...(types ? { type: { in: types } } : {}),
        ...(options.worldId ? { worldId: options.worldId } : {}),
        ...(options.worldSlug ? { worldSlug: options.worldSlug } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    });

    return jobs.map((job) => toJobView(job));
  }

  async getSummary(): Promise<JobSummary> {
    const [pending, running, failed, completed, cancelled, recentFailedRows] =
      await Promise.all([
        this.db.job.count({ where: { status: "pending" } }),
        this.db.job.count({ where: { status: "running" } }),
        this.db.job.count({ where: { status: "failed" } }),
        this.db.job.count({ where: { status: "completed" } }),
        this.db.job.count({ where: { status: "cancelled" } }),
        this.db.job.findMany({
          where: { status: "failed" },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
      ]);

    return {
      pending,
      running,
      failed,
      completed,
      cancelled,
      recentFailed: recentFailedRows.map((job) => toJobView(job)),
    };
  }

  async markRunning(id: string): Promise<JobView | null> {
    const existing = await this.db.job.findUnique({ where: { id } });
    if (!existing || existing.status === "cancelled") {
      return existing ? toJobView(existing) : null;
    }

    const job = await this.db.job.update({
      where: { id },
      data: {
        status: "running",
        startedAt: new Date(),
        attemptCount: existing.attemptCount + 1,
        errorMessage: null,
        errorDetails: undefined,
        completedAt: null,
        cancelledAt: null,
      },
    });

    await this.appendLog(job.id, "info", `Ausführung gestartet (Versuch ${job.attemptCount}).`);

    return toJobView(job);
  }

  async markCompleted(id: string, result?: Record<string, unknown> | null): Promise<JobView | null> {
    const job = await this.db.job.update({
      where: { id },
      data: {
        status: "completed",
        result: toPrismaJsonValue(result ?? undefined),
        completedAt: new Date(),
        progress: 100,
        progressLabel: "Abgeschlossen",
        errorMessage: null,
        errorDetails: undefined,
      },
    });

    await this.appendLog(job.id, "info", "Job erfolgreich abgeschlossen.");

    return toJobView(job);
  }

  async markFailed(
    id: string,
    errorMessage: string,
    errorDetails?: Record<string, unknown> | null,
  ): Promise<JobView | null> {
    const job = await this.db.job.update({
      where: { id },
      data: {
        status: "failed",
        errorMessage,
        errorDetails: toPrismaJsonValue(errorDetails ?? undefined),
        completedAt: new Date(),
      },
    });

    await this.appendLog(job.id, "error", errorMessage, errorDetails ?? undefined);

    return toJobView(job);
  }

  async markCancelled(id: string): Promise<JobView | null> {
    const existing = await this.db.job.findUnique({ where: { id } });
    if (!existing) return null;
    if (existing.status !== "pending" && existing.status !== "running") {
      return toJobView(existing);
    }

    const job = await this.db.job.update({
      where: { id },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        completedAt: new Date(),
      },
    });

    await this.appendLog(job.id, "warn", "Job abgebrochen.");

    return toJobView(job);
  }

  async updateProgress(
    id: string,
    progress: number,
    progressLabel?: string,
  ): Promise<void> {
    await this.db.job.update({
      where: { id },
      data: {
        progress: Math.max(0, Math.min(100, progress)),
        ...(progressLabel !== undefined ? { progressLabel } : {}),
      },
    });
  }

  async appendLog(
    jobId: string,
    level: "info" | "warn" | "error",
    message: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.db.jobLog.create({
        data: {
          jobId,
          level,
          message,
          details: toPrismaJsonValue(details),
        },
      });
    } catch (error) {
      console.error("[JobService] Log schreiben fehlgeschlagen:", error);
    }
  }

  async retry(id: string): Promise<JobView | null> {
    const existing = await this.db.job.findUnique({ where: { id } });
    if (!existing) return null;

    if (existing.status !== "failed" && existing.status !== "cancelled") {
      throw new Error("Nur fehlgeschlagene oder abgebrochene Jobs können wiederholt werden.");
    }

    if (!RETRYABLE_JOB_TYPES.has(existing.type)) {
      throw new Error(`Job-Typ „${existing.type}" unterstützt kein Retry.`);
    }

    if (existing.attemptCount >= existing.maxAttempts) {
      throw new Error("Maximale Versuche erreicht.");
    }

    const job = await this.db.job.update({
      where: { id },
      data: {
        status: "pending",
        errorMessage: null,
        errorDetails: undefined,
        result: undefined,
        progress: null,
        progressLabel: null,
        startedAt: null,
        completedAt: null,
        cancelledAt: null,
      },
    });

    await this.appendLog(job.id, "info", "Job für erneuten Versuch eingereiht.");

    return toJobView(job);
  }

  async isCancelled(id: string): Promise<boolean> {
    const job = await this.db.job.findUnique({
      where: { id },
      select: { status: true },
    });
    return job?.status === "cancelled";
  }
}

export function createJobService(db: PrismaClient): JobService {
  return new JobService(db);
}
