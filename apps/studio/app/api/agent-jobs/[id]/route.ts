import { NextResponse } from "next/server";
import {
  createDevAgentJobService,
  prisma,
  resolveAgentJobsConfig,
} from "@uwe/database/server";
import { fetchWorkflowRunStatus, resolveAgentJobsDispatchConfig } from "@uwe/agent-jobs";
import { dispatchJob } from "@/src/lib/job-executor";
import {
  guardStudioMutation,
  idSchema,
  parseBody,
  parseParams,
  requireStudioApiAuth,
} from "@uwe/security";
import { z } from "zod";

const jobIdParamSchema = z.object({ id: idSchema });

const agentJobActionSchema = z.object({
  action: z.enum(["retry", "poll"]),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const parsedParams = await parseParams(context.params, jobIdParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  const agentJobs = createDevAgentJobService(prisma);
  const job = await agentJobs.getJob(parsedParams.data.id);
  if (!job) {
    return NextResponse.json({ error: "Agent-Job nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ job });
}

export async function POST(request: Request, context: RouteContext) {
  const authError = guardStudioMutation(request);
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
      return NextResponse.json({ error: "Agent Jobs sind deaktiviert." }, { status: 403 });
    }

    try {
      const { job, queueJobId } = await agentJobs.enqueueRetryDispatch(jobId);
      void dispatchJob(queueJobId);
      return NextResponse.json({ job, queueJobId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Retry fehlgeschlagen.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const existing = await agentJobs.getJob(jobId);
  if (!existing) {
    return NextResponse.json({ error: "Agent-Job nicht gefunden." }, { status: 404 });
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
    return NextResponse.json({ error: "GitHub-Konfiguration fehlt." }, { status: 503 });
  }

  const [owner, repo] = githubRepo.split("/");
  if (!owner || !repo) {
    return NextResponse.json({ error: "AGENT_JOBS_GITHUB_REPO ungültig." }, { status: 503 });
  }

  try {
    const runStatus = await fetchWorkflowRunStatus(
      owner,
      repo,
      githubToken,
      existing.branchName,
    );
    const job = await agentJobs.applyPollResult(jobId, {
      status: runStatus.status,
      conclusion: runStatus.conclusion,
      runId: runStatus.runId != null ? String(runStatus.runId) : null,
      htmlUrl: runStatus.htmlUrl,
      branchName: existing.branchName,
    });
    return NextResponse.json({ job, polled: true, runStatus });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Poll fehlgeschlagen.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
