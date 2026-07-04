import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createDevAgentJobService,
  createDevIdeaService,
  createJobService,
  parseIdeaAttachments,
  prisma,
  resolveAgentJobsConfig,
} from "@uwe/database/server";
import { guardStudioMutation, idSchema, parseBody, parseParams } from "@uwe/security";
import { dispatchJob } from "@/src/lib/job-executor";
import { renderAttachmentsBlock } from "@/src/lib/idea-prompt";
import { ownerForbiddenResponse, resolveOwnerApiUser } from "@/src/lib/owner-api-auth";

const ideaIdParamSchema = z.object({ id: idSchema });

const ideaDispatchBodySchema = z.object({
  provider: z.enum(["github_actions", "cursor_cloud", "cursor_cli_local"]).optional(),
  /** Optional edited prompt; overrides and persists the stored generatedPrompt. */
  prompt: z.string().max(32_000).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = guardStudioMutation(request);
  if (authError) return authError;

  const owner = await resolveOwnerApiUser();
  if (!owner) return ownerForbiddenResponse();

  const parsedParams = await parseParams(context.params, ideaIdParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  const parsed = await parseBody(request, ideaDispatchBodySchema);
  if (!parsed.success) return parsed.response;

  const config = resolveAgentJobsConfig();
  if (!config.enabled) {
    return NextResponse.json(
      { error: "Agent Jobs sind deaktiviert (AGENT_JOBS_ENABLED)." },
      { status: 403 },
    );
  }

  const provider = parsed.data.provider ?? "cursor_cloud";
  if (provider === "cursor_cloud") {
    if (!config.cursorCloudConfigured) {
      return NextResponse.json(
        { error: "CURSOR_CLOUD_API_KEY fehlt — Cursor-Übergabe nicht möglich." },
        { status: 503 },
      );
    }
    if (!config.githubRepo) {
      return NextResponse.json(
        { error: "AGENT_JOBS_GITHUB_REPO nicht gesetzt (Format: owner/repo)." },
        { status: 503 },
      );
    }
    const [owner, repo] = config.githubRepo.split("/");
    if (!owner || !repo) {
      return NextResponse.json(
        { error: "AGENT_JOBS_GITHUB_REPO ungültig — erwartet owner/repo." },
        { status: 503 },
      );
    }
  }

  const ideas = createDevIdeaService(prisma);
  const idea = await ideas.getIdea(parsedParams.data.id);
  if (!idea) {
    return NextResponse.json({ error: "Idee nicht gefunden." }, { status: 404 });
  }

  const overridePrompt = parsed.data.prompt?.trim();
  const prompt = overridePrompt || idea.generatedPrompt?.trim();
  if (!prompt) {
    return NextResponse.json(
      { error: "Es ist noch kein Prompt vorhanden. Bitte zuerst einen Prompt erstellen." },
      { status: 400 },
    );
  }

  if (overridePrompt && overridePrompt !== idea.generatedPrompt) {
    await ideas.setGeneratedPrompt(idea.id, overridePrompt);
  }

  // Attachments are referenced as served asset URLs so the coding agent can
  // fetch them; the stored prompt stays clean (block is appended only here).
  const attachmentsBlock = renderAttachmentsBlock(
    parseIdeaAttachments(idea.attachments),
    new URL(request.url).origin,
  );
  const dispatchPrompt = attachmentsBlock ? `${prompt}\n\n${attachmentsBlock}` : prompt;

  const agentJobs = createDevAgentJobService(prisma);
  const devJob = await agentJobs.createJob({
    title: idea.title,
    prompt: dispatchPrompt,
    provider,
  });

  await ideas.linkAgentJob(idea.id, devJob.id);

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
