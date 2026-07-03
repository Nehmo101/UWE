/**
 * Async text provider via the UWE job queue.
 *
 * **Scope note:** `agent_job` / `dev_agent_job` targets repo/dev automation,
 * not in-app campaign lore. Async lore drafts run through the regular
 * `ai_run` queue (deferredAiPrompt) instead: the job waits for the local RTX
 * and surfaces its result as an AI run — never auto-applied to canon.
 */

import { createJobService, prisma, type PrismaClient } from "@uwe/database/server";

export interface AgentJobTextRequest {
  prompt: string;
  taskType: string;
  worldSlug?: string;
  pageSlug?: string;
  /** Required for gateway permission/budget checks when the job runs. */
  userId?: string | null;
}

export interface AgentJobTextEnqueueResult {
  jobId: string;
}

/**
 * Enqueue async lore/text generation through the ai_run job pipeline.
 * Returns a job id; the completed job surfaces as an AI result for review
 * (never auto-apply).
 */
export async function enqueueAgentJobTextDraft(
  request: AgentJobTextRequest,
  db: PrismaClient = prisma,
): Promise<AgentJobTextEnqueueResult> {
  if (!request.prompt.trim()) {
    throw new Error("Async-Text-Entwurf erfordert einen Prompt.");
  }

  const jobs = createJobService(db);
  const job = await jobs.enqueue({
    type: "ai_run",
    title: `Async-Text-Entwurf (${request.taskType})`,
    worldSlug: request.worldSlug ?? null,
    userId: request.userId ?? null,
    payload: {
      deferredAiPrompt: true,
      prompt: request.prompt,
      providerMode: "auto",
      contextMode: request.worldSlug ? "brain" : "general_chat",
      worldSlug: request.worldSlug,
      pageSlug: request.pageSlug,
    },
  });

  return { jobId: job.id };
}
