import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  createDevAgentJobService,
  prisma,
  resolveAgentJobsConfig,
} from "@uwe/database/server";
import {
  fetchCursorAgentStatus,
  fetchPullRequestForBranch,
  fetchWorkflowRunStatus,
  mapCursorStatusToDevAgentStatus,
  resolveAgentJobsDispatchConfig,
} from "@uwe/agent-jobs";
import { dispatchJob } from "@/src/lib/job-executor";
import { idSchema, parseBody, parseParams } from "@uwe/security";
import { z } from "zod";

const jobIdParamSchema = z.object({ id: idSchema });

const agentJobActionSchema = z.object({
  action: z.enum(["retry", "poll"]),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsedParams = await parseParams(context.params, jobIdParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  const agentJobs = createDevAgentJobService(prisma);
  const job = await agentJobs.getJob(parsedParams.data.id);
  if (!job) {
    return jsonError("Agent-Job nicht gefunden.", 404);
  }

  return NextResponse.json({ job });
}

export async function POST(request: Request, context: RouteContext) {
  const authError = await guardStudioApiMutation(request);
  if (authError) return authError;

  const parsedParams = await parseParams(context.params, jobIdParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  const parsed = await parseBody(request, agentJobActionSchema);
  if (!parsed.success) return parsed.response;

  const agentJobs = createDevAgentJobService(prisma);
  const jobId = parsedParams.data.id;

  if (parsed.data.action === "retry") {
    const config = resolveAgentJobsConfig();
    if (!config.enabled) {
      return jsonError("Agent Jobs sind deaktiviert.", 403);
    }

    try {
      const { job, queueJobId } = await agentJobs.enqueueRetryDispatch(jobId);
      void dispatchJob(queueJobId);
      return NextResponse.json({ job, queueJobId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Retry fehlgeschlagen.";
      return jsonError(message, 400);
    }
  }

  const existing = await agentJobs.getJob(jobId);
  if (!existing) {
    return jsonError("Agent-Job nicht gefunden.", 404);
  }

  if (existing.provider === "cursor_cloud") {
    if (!existing.cursorJobId) {
      return NextResponse.json({ job: existing, polled: false });
    }

    const cursorConfig = resolveAgentJobsDispatchConfig();
    if (!cursorConfig.cursorCloudApiKey) {
      return jsonError("CURSOR_CLOUD_API_KEY fehlt.", 503);
    }

    try {
      const cursorStatus = await fetchCursorAgentStatus(existing.cursorJobId, cursorConfig);
      const job = await agentJobs.applyCursorPollResult(jobId, {
        status: mapCursorStatusToDevAgentStatus(cursorStatus.status),
        rawStatus: cursorStatus.status,
        branchName: cursorStatus.branchName,
        prUrl: cursorStatus.prUrl,
        url: cursorStatus.url,
        summary: cursorStatus.summary,
      });
      return NextResponse.json({ job, polled: true, cursorStatus });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cursor-Poll fehlgeschlagen.";
      return jsonError(message, 502);
    }
  }

  if (existing.provider !== "github_actions" || !existing.branchName) {
    const job = await agentJobs.applyPollResult(jobId, {
      status: existing.status === "running" ? "in_progress" : existing.status,
      branchName: existing.branchName,
    });
    return NextResponse.json({ job, polled: false });
  }

  const dispatchConfig = resolveAgentJobsDispatchConfig();
  const githubRepo = dispatchConfig.githubRepo;
  const githubToken = dispatchConfig.githubToken;

  if (!githubRepo || !githubToken) {
    return jsonError("GitHub-Konfiguration fehlt.", 503);
  }

  const [owner, repo] = githubRepo.split("/");
  if (!owner || !repo) {
    return jsonError("AGENT_JOBS_GITHUB_REPO ungültig.", 503);
  }

  try {
    const runStatus = await fetchWorkflowRunStatus(
      owner,
      repo,
      githubToken,
      existing.branchName,
    );

    let prUrl = existing.prUrl;
    if (
      runStatus.status === "completed" &&
      runStatus.conclusion === "success" &&
      !prUrl
    ) {
      try {
        const pullRequest = await fetchPullRequestForBranch(
          owner,
          repo,
          githubToken,
          existing.branchName,
        );
        prUrl = pullRequest.url ?? existing.prUrl;
      } catch {
        // Best effort — workflow status still updates the job.
      }
    }

    const job = await agentJobs.applyPollResult(jobId, {
      status: runStatus.status,
      conclusion: runStatus.conclusion,
      runId: runStatus.runId != null ? String(runStatus.runId) : null,
      htmlUrl: runStatus.htmlUrl,
      branchName: existing.branchName,
      prUrl,
    });
    return NextResponse.json({ job, polled: true, runStatus });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Poll fehlgeschlagen.";
    return jsonError(message, 502);
  }
}
