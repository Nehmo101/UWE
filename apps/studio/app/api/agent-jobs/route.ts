import { NextResponse } from "next/server";
import {
  createDevAgentJobService,
  createJobService,
  prisma,
  resolveAgentJobsConfig,
} from "@uwe/database/server";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";
import { dispatchJob } from "@/src/lib/job-executor";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
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
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const config = resolveAgentJobsConfig();
  if (!config.enabled) {
    return NextResponse.json({ error: "Agent Jobs sind deaktiviert (AGENT_JOBS_ENABLED)." }, { status: 403 });
  }

  const body = (await request.json()) as {
    title?: string;
    prompt?: string;
    provider?: "github_actions" | "cursor_cloud" | "cursor_cli_local";
  };

  if (!body.title?.trim() || !body.prompt?.trim()) {
    return NextResponse.json({ error: "title und prompt sind erforderlich." }, { status: 400 });
  }

  const agentJobs = createDevAgentJobService(prisma);
  const devJob = await agentJobs.createJob({
    title: body.title,
    prompt: body.prompt,
    provider: body.provider ?? config.defaultProvider,
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
