import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  createDevAgentJobService,
  createJobService,
  prisma,
  resolveAgentJobsConfig,
} from "@uwe/database/server";
import { nonEmptyString, parseBody } from "@uwe/security";
import { dispatchJob } from "@/src/lib/job-executor";
import { z } from "zod";

const agentJobCreateSchema = z.object({
  title: nonEmptyString.max(500),
  prompt: nonEmptyString.max(32_000),
  provider: z.enum(["github_actions", "cursor_cloud", "cursor_cli_local"]).optional(),
});

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const agentJobs = createDevAgentJobService(prisma);
  const jobs = await agentJobs.listJobs(50);
  const config = resolveAgentJobsConfig();

  return NextResponse.json({
    jobs,
    config: {
      enabled: config.enabled,
      githubRepo: config.githubRepo,
      githubWorkflow: config.githubWorkflow,
      githubTokenConfigured: config.githubTokenConfigured,
      cursorCloudConfigured: config.cursorCloudConfigured,
      defaultProvider: config.defaultProvider,
      autoMerge: config.autoMerge,
    },
  });
}

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request);
  if (authError) return authError;

  const config = resolveAgentJobsConfig();
  if (!config.enabled) {
    return jsonError("Agent Jobs sind deaktiviert (AGENT_JOBS_ENABLED).", 403);
  }

  const parsed = await parseBody(request, agentJobCreateSchema);
  if (!parsed.success) return parsed.response;

  const agentJobs = createDevAgentJobService(prisma);
  const devJob = await agentJobs.createJob({
    title: parsed.data.title,
    prompt: parsed.data.prompt,
    provider: parsed.data.provider ?? config.defaultProvider,
  });

  const jobs = createJobService(prisma);
  const queueJob = await jobs.enqueue({
    type: "agent_job",
    title: `Agent: ${devJob.title}`,
    payload: { devAgentJobId: devJob.id },
    relatedType: "dev_agent_job",
    relatedId: devJob.id,
  });

  void dispatchJob(queueJob.id);

  return NextResponse.json({ job: devJob, queueJobId: queueJob.id }, { status: 201 });
}
