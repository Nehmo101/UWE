import type {
  DevAgentJobProvider,
  DevAgentJobStatus,
} from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import { toPrismaJsonValue } from "./json-utils";
import { createJobService } from "./job-service";

export type {
  DevAgentJob,
  DevAgentJobStatus,
  DevAgentJobProvider,
} from "./generated/prisma/client";

export {
  DevAgentJobStatus as DevAgentJobStatusEnum,
  DevAgentJobProvider as DevAgentJobProviderEnum,
} from "./generated/prisma/client";

export const DEV_AGENT_JOB_STATUS_LABELS: Record<DevAgentJobStatus, string> = {
  pending: "Wartend",
  dispatched: "Abgesendet",
  running: "Läuft",
  completed: "Abgeschlossen",
  failed: "Fehlgeschlagen",
  cancelled: "Abgebrochen",
};

export const DEV_AGENT_JOB_PROVIDER_LABELS: Record<DevAgentJobProvider, string> = {
  github_actions: "GitHub Actions",
  cursor_cloud: "Cursor Cloud Agents",
  cursor_cli_local: "Cursor CLI (lokal)",
};

export interface CreateDevAgentJobInput {
  title: string;
  prompt: string;
  provider?: DevAgentJobProvider;
}

export interface UpdateDevAgentJobInput {
  status?: DevAgentJobStatus;
  branchName?: string | null;
  prUrl?: string | null;
  issueUrl?: string | null;
  githubRunId?: string | null;
  cursorJobId?: string | null;
  result?: Record<string, unknown> | null;
  errorMessage?: string | null;
  completedAt?: Date | null;
}

export interface AgentJobPollResult {
  status?: string | null;
  conclusion?: string | null;
  runId?: string | null;
  htmlUrl?: string | null;
  prUrl?: string | null;
  branchName?: string | null;
}

export interface AgentJobCompletionInput {
  status: "completed" | "failed";
  prUrl?: string | null;
  branchName?: string | null;
  errorMessage?: string | null;
  githubRunId?: string | null;
}

export interface CursorAgentPollResult {
  /** Already-normalized DevAgentJob status (mapped from the Cursor API status). */
  status: DevAgentJobStatus;
  /** Raw Cursor status string, kept for diagnostics in result.cursor. */
  rawStatus?: string | null;
  branchName?: string | null;
  prUrl?: string | null;
  url?: string | null;
  summary?: string | null;
  errorMessage?: string | null;
}

export class DevAgentJobService {
  constructor(private readonly db: PrismaClient) {}

  async listJobs(limit = 50) {
    return this.db.devAgentJob.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async getJob(id: string) {
    return this.db.devAgentJob.findUnique({ where: { id } });
  }

  async createJob(input: CreateDevAgentJobInput) {
    return this.db.devAgentJob.create({
      data: {
        title: input.title.trim(),
        prompt: input.prompt.trim(),
        provider: input.provider ?? "github_actions",
        status: "pending",
      },
    });
  }

  async updateJob(id: string, input: UpdateDevAgentJobInput) {
    return this.db.devAgentJob.update({
      where: { id },
      data: {
        ...(input.status != null ? { status: input.status } : {}),
        ...(input.branchName !== undefined ? { branchName: input.branchName } : {}),
        ...(input.prUrl !== undefined ? { prUrl: input.prUrl } : {}),
        ...(input.issueUrl !== undefined ? { issueUrl: input.issueUrl } : {}),
        ...(input.githubRunId !== undefined ? { githubRunId: input.githubRunId } : {}),
        ...(input.cursorJobId !== undefined ? { cursorJobId: input.cursorJobId } : {}),
        ...(input.result !== undefined ? { result: toPrismaJsonValue(input.result) } : {}),
        ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
        ...(input.completedAt !== undefined ? { completedAt: input.completedAt } : {}),
      },
    });
  }

  async cancelJob(id: string) {
    return this.updateJob(id, {
      status: "cancelled",
      completedAt: new Date(),
    });
  }

  async retryJob(id: string) {
    const existing = await this.getJob(id);
    if (!existing) {
      throw new Error("Agent-Job nicht gefunden.");
    }
    if (existing.status !== "failed" && existing.status !== "cancelled") {
      throw new Error("Nur fehlgeschlagene oder abgebrochene Jobs können wiederholt werden.");
    }

    return this.updateJob(id, {
      status: "pending",
      errorMessage: null,
      completedAt: null,
      githubRunId: null,
      cursorJobId: null,
      result: null,
    });
  }

  async applyPollResult(id: string, result: AgentJobPollResult) {
    const existing = await this.getJob(id);
    if (!existing) {
      throw new Error("Agent-Job nicht gefunden.");
    }

    const workflowStatus = result.status?.toLowerCase() ?? null;
    const conclusion = result.conclusion?.toLowerCase() ?? null;

    let status: DevAgentJobStatus = existing.status;
    let completedAt: Date | null = existing.completedAt;
    let errorMessage: string | null = existing.errorMessage;

    if (workflowStatus === "queued" || workflowStatus === "in_progress" || workflowStatus === "waiting") {
      status = "running";
      completedAt = null;
    } else if (workflowStatus === "completed") {
      if (conclusion === "success") {
        status = "completed";
        completedAt = new Date();
        errorMessage = null;
      } else if (conclusion === "failure" || conclusion === "cancelled" || conclusion === "timed_out") {
        status = "failed";
        completedAt = new Date();
        errorMessage = `GitHub Actions: ${conclusion}`;
      }
    }

    return this.updateJob(id, {
      status,
      branchName: result.branchName ?? existing.branchName,
      prUrl: result.prUrl ?? existing.prUrl,
      githubRunId: result.runId ?? existing.githubRunId,
      errorMessage,
      completedAt,
      result: {
        ...(existing.result && typeof existing.result === "object"
          ? (existing.result as Record<string, unknown>)
          : {}),
        poll: {
          status: result.status ?? null,
          conclusion: result.conclusion ?? null,
          htmlUrl: result.htmlUrl ?? null,
        },
      },
    });
  }

  async applyCursorPollResult(id: string, result: CursorAgentPollResult) {
    const existing = await this.getJob(id);
    if (!existing) {
      throw new Error("Agent-Job nicht gefunden.");
    }

    const terminal = result.status === "completed" || result.status === "failed";
    const completedAt = terminal ? (existing.completedAt ?? new Date()) : null;
    const errorMessage =
      result.status === "failed"
        ? (result.errorMessage ?? existing.errorMessage ?? "Cursor Agent fehlgeschlagen.")
        : null;

    return this.updateJob(id, {
      status: result.status,
      branchName: result.branchName ?? existing.branchName,
      prUrl: result.prUrl ?? existing.prUrl,
      errorMessage,
      completedAt,
      result: {
        ...(existing.result && typeof existing.result === "object"
          ? (existing.result as Record<string, unknown>)
          : {}),
        cursor: {
          status: result.rawStatus ?? null,
          url: result.url ?? null,
          summary: result.summary ?? null,
          at: new Date().toISOString(),
        },
      },
    });
  }

  async applyCompletionCallback(id: string, input: AgentJobCompletionInput) {
    const existing = await this.getJob(id);
    if (!existing) {
      throw new Error("Agent-Job nicht gefunden.");
    }

    if (existing.status === "completed" || existing.status === "cancelled") {
      return existing;
    }

    const completedAt = new Date();

    return this.updateJob(id, {
      status: input.status,
      prUrl: input.prUrl ?? existing.prUrl,
      branchName: input.branchName ?? existing.branchName,
      githubRunId: input.githubRunId ?? existing.githubRunId,
      errorMessage:
        input.status === "failed"
          ? (input.errorMessage ?? existing.errorMessage ?? "Agent-Job fehlgeschlagen.")
          : null,
      completedAt,
      result: {
        ...(existing.result && typeof existing.result === "object"
          ? (existing.result as Record<string, unknown>)
          : {}),
        callback: {
          status: input.status,
          at: completedAt.toISOString(),
        },
      },
    });
  }

  async enqueueRetryDispatch(id: string) {
    const job = await this.retryJob(id);
    const jobs = createJobService(this.db);
    const queueJob = await jobs.enqueue({
      type: "agent_job",
      title: `Agent (Retry): ${job.title}`,
      payload: { devAgentJobId: job.id },
      relatedType: "dev_agent_job",
      relatedId: job.id,
    });
    return { job, queueJobId: queueJob.id };
  }
}

export function createDevAgentJobService(db: PrismaClient): DevAgentJobService {
  return new DevAgentJobService(db);
}

export interface AgentJobsConfig {
  enabled: boolean;
  githubRepo: string | null;
  githubWorkflow: string | null;
  githubTokenConfigured: boolean;
  cursorCloudConfigured: boolean;
  defaultProvider: DevAgentJobProvider;
  autoMerge: boolean;
}

export function resolveAgentJobsConfig(env: NodeJS.ProcessEnv = process.env): AgentJobsConfig {
  return {
    enabled: env.AGENT_JOBS_ENABLED === "true",
    githubRepo: env.AGENT_JOBS_GITHUB_REPO?.trim() || null,
    githubWorkflow: env.AGENT_JOBS_GITHUB_WORKFLOW?.trim() || "cursor-agent.yml",
    githubTokenConfigured: Boolean(env.GITHUB_TOKEN?.trim() || env.AGENT_JOBS_GITHUB_TOKEN?.trim()),
    cursorCloudConfigured: Boolean(env.CURSOR_CLOUD_API_KEY?.trim()),
    defaultProvider: (env.AGENT_JOBS_DEFAULT_PROVIDER?.trim() as DevAgentJobProvider) || "github_actions",
    autoMerge: env.AGENT_JOBS_AUTO_MERGE === "true",
  };
}
