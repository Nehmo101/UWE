import type {
  DevAgentJobProvider,
  DevAgentJobStatus,
} from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import { toPrismaJsonValue } from "./json-utils";

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
